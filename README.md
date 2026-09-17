<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->

# 💨⌨️ Cooling Keyboard Palm-Rest — Simulator & Spec

A keyboard palm-rest with **height/length + angle adjustment** and a **built-in
cooling fan that dries hand sweat** — aimed at sweaty hands and carpal-tunnel
comfort. This repo is a **no-build static site**: an interactive simulator plus
a design/spec page.

> 🇰🇷 한국어 문서: [README.ko.md](README.ko.md)

## 🔴 DEMO MODE / concept boundaries

- **This is a concept design + estimation simulator, NOT a real product.**
- **All numbers are simple-model estimates — reference not verified** (no lab,
  manufacturing, or medical validation).
- **The AI features run on a deterministic offline mock by default** — no API
  key, no network. Real Claude is optional (see below).

## 🔗 Live demo

**https://clsoftlab-lang.github.io/cooling-keyboard-palmrest/**

## ✨ Features

- **Interactive simulator** — inline SVG of a hand on the palm-rest. Controls for
  fan strength, height, angle, room humidity & temperature drive an animated
  airflow over the hand plus live estimates of **hand dryness / comfort index /
  noise (dB) / power (W)** and ergonomic angle guidance.
- **Design / spec page** — fan, height mechanism, materials, USB power, and a
  rough BOM (reference not verified) with an ergonomics note.
- Documented estimate formulas in the pure module `comfort.js`.
- Light + dark theme, mobile-first responsive, Korean UI, inline-SVG only.
- Settings persist in `localStorage` (with reset).

## 🤖 AI 기능 (API 연동)

Three AI helpers, all available in mock mode:

1. **AI 셋업 도우미 챗봇** — recommends fan/height/angle for your sweat level & room.
2. **시뮬 결과 설명** — explains the current simulator metrics in plain Korean.
3. **자세/휴식 코칭 팁** — posture & break coaching tips.

**Demo = mock** (deterministic, offline, reuses the same `comfort.js` math).

To enable **real Claude**:

1. Run the backend proxy in [`server/`](server/README.md) and set
   `ANTHROPIC_API_KEY` (cost-first default model `claude-haiku-4-5`) as a server env var.
2. Set `AI_ENDPOINT` in [`ai/config.js`](ai/config.js) to the proxy URL.

**The API key lives server-side only — never in the browser or the repo.**

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

- **비용 우선 기본 모델**: `claude-haiku-4-5` (~**$1 / $5 per MTok** in/out). 품질이 더 필요하면
  `AI_MODEL=claude-sonnet-5` 또는 `claude-opus-5` 로 상향. (Haiku 4.5 는 adaptive thinking/effort 를
  받지 않으므로 프록시가 자동으로 생략, 상위 모델에는 `thinking:adaptive` + `effort`(기본 low) 적용.)
- **프롬프트 캐싱**: 안정적인 per-task 시스템 프롬프트를 `cache_control:{type:'ephemeral'}` 블록으로
  전송 → 반복 호출은 캐시를 읽어 비용 절감.
- **출력 상한**: 태스크당 `max_tokens` 기본 ~700 로 억제.
- **비용 가드레일**: per-IP rate limit(기본 20/분) + 월 토큰 예산(`AI_MONTHLY_TOKEN_CAP`, 기본
  2,000,000). 초과 시 HTTP 429 `{fallback:true}` 반환.
- **대략 비용(추정)**: 요청당 in ~1.2K / out ~0.5K 토큰 가정 시 **1,000 요청 ≈ $3–4** 수준이며,
  캐시 적중 시 더 낮아집니다 (reference not verified).
- **무인 무료 배포**: `server/worker.js` 를 **Cloudflare Workers** 무료 티어에 원클릭 배포 —
  `wrangler secret put ANTHROPIC_API_KEY` 후 `wrangler deploy` (서버 상주 관리 불필요). 자세한 내용은
  [`server/README.md`](server/README.md).
- **자동 목업 폴백(무인)**: 엔드포인트 실패 / 429 `{fallback:true}` / 네트워크 오류 시 `ai/ai.js` 가
  자동으로 오프라인 목업으로 전환 → 앱은 절대 멈추지 않습니다.
- **무인 자동 추천**: 페이지 로드 시 현재 온·습도로 "오늘 환경 맞춤 설정 추천"을 `askAI` 로 자동 생성
  (목업 오프라인으로도 동작).

**The API key lives server-side only — never in the browser or the repo.**

## ▶️ Run locally

```bash
python -m http.server 9024
# open http://localhost:9024/
```

Any static file server works; the site uses relative paths only.

## ✅ Verify

```bash
node check.mjs
```

Checks: JSON parse, `node --check` on all JS (incl. `ai/` + `server/`),
required HTML containers, `comfort.js` unit tests, deterministic AI mock, and
that `AI_ENDPOINT` is empty with no real `sk-ant-…` key committed. CI runs the
same script (`.github/workflows/ci.yml`) — **no npm install, no API calls**.

## 🎓 아이디어 출처 / Idea origin

This concept began as a standout **student idea** in **Dr. Lee Il-guk's
entrepreneurship class at Yongin University (용인대학교)**. Built **clean-room**
with gratitude — no copied sentences, no PII, no trademarks.

## 👥 Contributors

Dr. Lee Il-guk (이일국), LWJ, LMJ, Claude.

## 📄 License

- Code: **Apache-2.0** (see [LICENSE](LICENSE))
- Documentation & content: **CC BY 4.0**

**Not an official Anthropic product.**
