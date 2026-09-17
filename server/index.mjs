// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// Backend AI proxy for the Cooling Keyboard Palm-Rest demo.
//
// Keeps the Anthropic API key SERVER-SIDE ONLY. The browser talks to this
// endpoint (set AI_ENDPOINT in ../ai/config.js to this server's URL); this
// server talks to Claude and streams the reply back as plain text.
//
// The key is read from process.env.ANTHROPIC_API_KEY — never hard-coded,
// never sent to the client.
//
// 고도화 — 무인·저비용 실 AI:
//   • 비용 우선 기본 모델 claude-haiku-4-5 (AI_MODEL 로 상향 가능)
//   • 프롬프트 캐싱(cache_control: ephemeral) 으로 반복 호출 비용 절감
//   • per-IP rate limit + 월 토큰 예산(초과 시 429 {fallback:true})
//
// Run:  ANTHROPIC_API_KEY=sk-ant-... node index.mjs
//   (or copy .env.example to .env and load it however you prefer)

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;

// Cost-first default. Raise to 'claude-sonnet-5' or 'claude-opus-5' for higher
// quality by setting AI_MODEL in the environment.
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const IS_HAIKU = MODEL.startsWith('claude-haiku');

// Cost guardrails ------------------------------------------------------------
const RATE_LIMIT = Number(process.env.AI_RATE_PER_MIN || 20); // requests / IP / min
const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP || 2_000_000);
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 700); // modest output cap

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompts per task. The heavy comfort math lives client-side; the model
// only turns numbers into helpful Korean guidance. Stable text → cache-friendly.
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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ── In-memory cost guardrails ───────────────────────────────────────────────
// Per-IP sliding-window request counter (resets each minute).
const hits = new Map(); // ip -> { count, windowStart }
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.windowStart >= 60_000) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

// Monthly token budget (resets on calendar-month change).
let usedTokens = 0;
let budgetMonth = new Date().getUTCMonth();
function budgetExceeded() {
  const m = new Date().getUTCMonth();
  if (m !== budgetMonth) {
    budgetMonth = m;
    usedTokens = 0;
  }
  return usedTokens >= MONTHLY_TOKEN_CAP;
}

function send429(res) {
  res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ fallback: true }));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method !== 'POST' || !req.url.startsWith('/api/ai')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ANTHROPIC_API_KEY 가 설정되지 않았습니다 (서버 환경변수).');
  }

  // Cost guardrails: rate limit + monthly token budget → 429 {fallback:true}.
  const ip = req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip) || budgetExceeded()) return send429(res);

  try {
    const { task, payload } = JSON.parse((await readBody(req)) || '{}');
    const system = SYSTEM[task] || SYSTEM.explain;
    const userMsg = `작업: ${task}\n입력(JSON): ${JSON.stringify(payload)}`;

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    });

    // Prompt caching: stable per-task system prompt as a cache-controlled block.
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    };
    // Haiku 4.5 does not accept adaptive thinking / effort → send neither.
    if (!IS_HAIKU) {
      params.thinking = { type: 'adaptive' };
      params.output_config = { effort: process.env.AI_EFFORT || 'low' };
    }

    const stream = client.messages.stream(params);

    stream.on('text', (t) => res.write(t));
    const final = await stream.finalMessage();

    // Accumulate token usage toward the monthly budget.
    const u = final?.usage || {};
    usedTokens +=
      (u.input_tokens || 0) +
      (u.output_tokens || 0) +
      (u.cache_creation_input_tokens || 0) +
      (u.cache_read_input_tokens || 0);

    res.end();
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`오류: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}/api/ai (model: ${MODEL})`);
});
