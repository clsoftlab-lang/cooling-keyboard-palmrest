<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->

# 💨⌨️ 땀 날아가는 키보드 팜레스트 — 시뮬레이터 & 스펙

**높이·길이 + 각도 조절**과 **손 땀을 말려주는 내장 냉각팬**을 갖춘 키보드 팜레스트
개념입니다. 손땀이 많거나 손목터널 완화가 필요한 분을 위한 아이디어이며, 본 저장소는
**빌드가 필요 없는 정적 사이트**로 인터랙티브 시뮬레이터와 설계/스펙 페이지를 제공합니다.

> 🇬🇧 English: [README.md](README.md)

## 🔴 데모 모드 / 개념 경계

- **이 사이트는 개념 설계 + 추정 시뮬레이터이며 실제 제품이 아닙니다.**
- **모든 수치는 단순 모델 추정치입니다 — reference not verified**(실측·양산·의료 검증 없음).
- **AI 기능은 기본적으로 오프라인 결정론적 목업으로 동작합니다** — API 키·네트워크 불필요.
  실제 Claude 연동은 선택 사항입니다(아래 참고).

## 🔗 라이브 데모

**https://clsoftlab-lang.github.io/cooling-keyboard-palmrest/**

## ✨ 기능

- **인터랙티브 시뮬레이터** — 팜레스트 위 손을 인라인 SVG로 표현. 팬 세기·높이·각도·실내
  습도·온도 조절 → 손 위 공기 흐름 애니메이션과 함께 **손 건조도 / 쾌적 지수 / 소음(dB) /
  전력(W)** 실시간 추정, 인체공학 각도 가이드 제공.
- **설계 / 스펙 페이지** — 팬, 높이조절 기구, 소재, USB 전원, 대략 BOM(reference not
  verified), 인체공학 노트.
- 추정 산식은 순수 모듈 `comfort.js`에 문서화.
- 라이트+다크 테마, 모바일 우선 반응형, 한국어 UI, 인라인 SVG만 사용.
- 설정은 `localStorage`에 저장(초기화 버튼 포함).

## 🤖 AI 기능 (API 연동)

목업으로 제공되는 3가지 AI 도우미:

1. **AI 셋업 도우미 챗봇** — 손땀 정도·환경에 맞는 팬/높이/각도 추천.
2. **시뮬 결과 설명** — 현재 지표를 쉬운 한국어로 해설.
3. **자세/휴식 코칭 팁** — 손목 건강 자세·휴식 팁.

**데모 = 목업**(결정론적, 오프라인, `comfort.js` 산식 재사용).

**실제 Claude 활성화:**

1. [`server/`](server/README.md) 프록시를 실행하고 서버 환경변수로 `ANTHROPIC_API_KEY`
   설정(모델 `claude-opus-5`).
2. [`ai/config.js`](ai/config.js)의 `AI_ENDPOINT`를 프록시 URL로 설정.

**API 키는 서버에만 존재합니다 — 브라우저·저장소에는 절대 넣지 않습니다.**

## ▶️ 로컬 실행

```bash
python -m http.server 9024
# http://localhost:9024/ 접속
```

정적 서버면 무엇이든 동작하며, 사이트는 상대 경로만 사용합니다.

## ✅ 검증

```bash
node check.mjs
```

JSON 파싱, 모든 JS(`ai/`+`server/` 포함) `node --check`, 필수 HTML 컨테이너,
`comfort.js` 단위 테스트, 결정론적 AI 목업, `AI_ENDPOINT` 비어있음 및 실제 `sk-ant-…`
키 미커밋을 확인합니다. CI(`.github/workflows/ci.yml`)도 동일 스크립트를 실행하며
**npm install·API 호출 없음**입니다.

## 🎓 아이디어 출처 / Idea origin

이 개념은 **용인대학교(Yongin University)** 이일국 박사(Dr. Lee Il-guk)의 창업 수업에서
나온 한 수강생의 **돋보이는 아이디어**에서 출발했습니다. 원 발상에 감사드리며 저작·상표
없이 **클린룸**으로 새로 작성했습니다(복제 문장·PII 없음).

## 👥 기여자

Dr. Lee Il-guk (이일국), LWJ, LMJ, Claude.

## 📄 라이선스

- 코드: **Apache-2.0** ([LICENSE](LICENSE) 참고)
- 문서/콘텐츠: **CC BY 4.0**

**Not an official Anthropic product.**
