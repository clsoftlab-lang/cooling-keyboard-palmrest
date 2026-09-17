// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai.js — thin AI client.
//
//   askAI(task, payload, { onToken } = {})
//
// If AI_ENDPOINT is empty  → deterministic Korean MockProvider (offline demo),
//                            reusing the same comfort math as the simulator.
// If AI_ENDPOINT is set    → POST {task, payload} to the backend proxy and
//                            stream the reply, forwarding text via onToken.
//
// The API key lives ONLY on the server. This file never sees or sends a key.

import { AI_ENDPOINT } from './config.js';
import { computeMetrics, IDEAL_ANGLE, IDEAL_HEIGHT } from '../comfort.js';

const emit = (onToken, text) => {
  if (typeof onToken === 'function') onToken(text);
  return text;
};

// ── Deterministic mock providers (pure functions of the payload) ────────────
function mockSetup(payload) {
  const { humidity = 55, temp = 26, sweat = 'medium' } = payload || {};
  // Recommend a fan level from environment + reported sweat level.
  let fan = 30 + (humidity - 40) * 0.6 + (temp - 22) * 2;
  if (sweat === 'high') fan += 20;
  if (sweat === 'low') fan -= 10;
  fan = Math.max(15, Math.min(95, Math.round(fan / 5) * 5));
  const rec = { fan, height: IDEAL_HEIGHT, angle: IDEAL_ANGLE, humidity, temp };
  const m = computeMetrics(rec);
  return [
    `추천 설정 (${sweat === 'high' ? '손땀 많음' : sweat === 'low' ? '손땀 적음' : '보통'} 기준)`,
    `• 팬 세기: ${fan}%`,
    `• 높이: ${IDEAL_HEIGHT}mm, 각도: ${IDEAL_ANGLE}°`,
    `예상 결과 — 손 건조도 ${m.dryness}, 쾌적 지수 ${m.comfort}, 소음 ${m.noise}dB, 전력 ${m.power}W.`,
    `${m.guidance}`,
    `조용함이 더 중요하면 팬을 10~15% 낮추고, 땀이 계속 차면 5%씩 올려보세요.`,
  ].join('\n');
}

function mockExplain(payload) {
  const inputs = payload?.inputs || {};
  const m = computeMetrics(inputs);
  const drynessTxt = m.dryness >= 70 ? '빠르게 마르는' : m.dryness >= 40 ? '적당히 마르는' : '천천히 마르는';
  const comfortTxt = m.comfort >= 70 ? '쾌적한' : m.comfort >= 45 ? '무난한' : '개선이 필요한';
  return [
    `현재 설정 해설`,
    `• 손에 닿는 바람은 약 ${m.airVelocity} m/s로, 접촉면 땀을 ${drynessTxt} 수준입니다 (건조도 ${m.dryness}).`,
    `• 체감 온도는 약 ${m.perceivedTemp}°C이고 전체 쾌적 지수는 ${m.comfort}로 ${comfortTxt} 상태입니다.`,
    `• 소음은 약 ${m.noise} dB, 전력은 약 ${m.power} W (${m.current} A @ 5V)입니다.`,
    m.noise >= 40 ? '바람이 강해 소음이 큽니다. 필요 이상이면 팬을 낮춰보세요.' : '소음은 조용한 편입니다.',
    `자세 팁: ${m.guidance}`,
  ].join('\n');
}

function mockCoach(payload) {
  const inputs = payload?.inputs || {};
  const minutes = payload?.minutes || 50;
  const m = computeMetrics(inputs);
  const tips = [
    `자세·휴식 코칭 (${minutes}분 연속 작업 기준)`,
    `• ${Math.round(minutes)}분마다 손목을 털고 손가락을 5회 폈다 접으세요.`,
    `• 20-20-20: 20분마다 6m 밖을 20초 바라보며 손을 팬 위에 올려 말리세요.`,
    m.ergo >= 70 ? '• 현재 손목 각도는 양호합니다. 이 자세를 유지하세요.' : `• ${m.guidance}`,
    m.dryness < 40 ? '• 땀이 잘 안 마르면 팬 세기를 올리거나 습도를 낮춰보세요.' : '• 건조도는 충분합니다. 과건조 시 팬을 잠시 끄세요.',
    '• 1시간마다 일어나 어깨를 크게 돌려 순환을 도우세요.',
  ];
  return tips.join('\n');
}

function runMock(task, payload) {
  switch (task) {
    case 'setup': return mockSetup(payload);
    case 'explain': return mockExplain(payload);
    case 'coach': return mockCoach(payload);
    default: return `알 수 없는 작업: ${task}`;
  }
}

// Chunk a mock string so onToken consumers behave like a real stream.
async function streamMock(text, onToken) {
  const parts = text.split(/(\n)/);
  for (const p of parts) {
    emit(onToken, p);
    // no real delay in tests; UI adds its own pacing if desired
  }
  return text;
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function askAI(task, payload, { onToken } = {}) {
  if (!AI_ENDPOINT) {
    const text = runMock(task, payload);
    return streamMock(text, onToken);
  }

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, payload }),
  });
  if (!res.ok || !res.body) throw new Error(`AI 요청 실패: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    emit(onToken, chunk);
  }
  return full;
}

export const AI_TASKS = ['setup', 'explain', 'coach'];
export const isMock = () => !AI_ENDPOINT;
