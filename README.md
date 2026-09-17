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
   `ANTHROPIC_API_KEY` (model `claude-opus-5`) as a server env var.
2. Set `AI_ENDPOINT` in [`ai/config.js`](ai/config.js) to the proxy URL.

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
