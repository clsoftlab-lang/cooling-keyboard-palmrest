// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// worker.js — Cloudflare Workers variant of the AI proxy (무인/free-tier).
//
// Same task routing + model/caching rules as server/index.mjs, but calls the
// Anthropic REST API directly so it can run on the Cloudflare Workers free tier
// with no server to babysit. The key is a Worker SECRET (ANTHROPIC_API_KEY),
// never shipped to the browser.
//
// Deploy:
//   cd server
//   wrangler secret put ANTHROPIC_API_KEY
//   wrangler deploy
// Then set AI_ENDPOINT in ../ai/config.js to the deployed Worker URL + /api/ai.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM = {
  setup:
    '당신은 손땀·손목 편안함을 돕는 키보드 팜레스트 셋업 도우미입니다. ' +
    '사용자 환경(습도/온도/손땀 정도)에 맞는 팬 세기·높이·각도를 한국어로 간결히 추천하세요.',
  explain:
    '당신은 시뮬레이터 결과 해설가입니다. 주어진 지표(손 건조도/쾌적 지수/소음/전력)를 ' +
    '한국어로 쉽게 설명하고 개선 팁을 덧붙이세요.',
  coach:
    '당신은 손목 건강 코치입니다. 현재 설정과 작업 시간을 바탕으로 자세·휴식 팁을 ' +
    '한국어 불릿으로 제시하세요. 의료 조언이 아님을 전제로 하세요.',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Simple per-instance rate limit (per Worker isolate). Cloudflare rotates
// isolates, so this is a soft guardrail; a monthly cap is enforced below too.
const hits = new Map();
let usedTokens = 0;
let budgetMonth = new Date().getUTCMonth();

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/ai')) {
      return new Response('Not found', { status: 404, headers: CORS });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return new Response('ANTHROPIC_API_KEY 가 설정되지 않았습니다 (Worker secret).', {
        status: 500,
        headers: CORS,
      });
    }

    const MODEL = env.AI_MODEL || 'claude-haiku-4-5';
    const IS_HAIKU = MODEL.startsWith('claude-haiku');
    const RATE_LIMIT = Number(env.AI_RATE_PER_MIN || 20);
    const MONTHLY_TOKEN_CAP = Number(env.AI_MONTHLY_TOKEN_CAP || 2_000_000);
    const MAX_TOKENS = Number(env.AI_MAX_TOKENS || 700);

    // Cost guardrails → 429 {fallback:true}.
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const rec = hits.get(ip);
    let limited;
    if (!rec || now - rec.windowStart >= 60_000) {
      hits.set(ip, { count: 1, windowStart: now });
      limited = false;
    } else {
      rec.count += 1;
      limited = rec.count > RATE_LIMIT;
    }
    const m = new Date().getUTCMonth();
    if (m !== budgetMonth) {
      budgetMonth = m;
      usedTokens = 0;
    }
    if (limited || usedTokens >= MONTHLY_TOKEN_CAP) {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 429,
        headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    let task, payload;
    try {
      ({ task, payload } = await request.json());
    } catch {
      task = 'explain';
      payload = {};
    }
    const system = SYSTEM[task] || SYSTEM.explain;
    const userMsg = `작업: ${task}\n입력(JSON): ${JSON.stringify(payload)}`;

    // Prompt caching + Haiku thinking/effort rules, matching index.mjs.
    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    };
    if (!IS_HAIKU) {
      body.thinking = { type: 'adaptive' };
      body.output_config = { effort: env.AI_EFFORT || 'low' };
    }

    let apiRes;
    try {
      apiRes = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return new Response(`오류: ${err.message}`, { status: 502, headers: CORS });
    }

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => '');
      return new Response(`오류: Anthropic ${apiRes.status} ${detail}`.trim(), {
        status: 502,
        headers: CORS,
      });
    }

    // Non-stream response is fine per spec: extract assistant text + count usage.
    const data = await apiRes.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const u = data.usage || {};
    usedTokens +=
      (u.input_tokens || 0) +
      (u.output_tokens || 0) +
      (u.cache_creation_input_tokens || 0) +
      (u.cache_read_input_tokens || 0);

    return new Response(text, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
