<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->

# AI Proxy (server)

Optional backend that lets the demo call **real Claude** while keeping the
Anthropic API key **server-side only**. Without this server, the app runs in
deterministic **mock mode** (see `../ai/`).

## Why a proxy?

The API key must **never** appear in the browser or the repository. The static
site talks to this proxy; the proxy holds the key and talks to Claude.

## Run

```bash
cd server
npm install                      # installs @anthropic-ai/sdk (do NOT run in CI)
cp .env.example .env             # then edit .env and set ANTHROPIC_API_KEY
ANTHROPIC_API_KEY=sk-ant-... node index.mjs
# → AI proxy listening on http://localhost:8787/api/ai (model: claude-opus-5)
```

Then point the front-end at it by editing `../ai/config.js`:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

## Endpoint

`POST /api/ai` with JSON body `{ "task": "setup|explain|coach", "payload": {...} }`.
Responds with a streamed `text/plain` Korean reply.

- Model: `claude-opus-5`
- `max_tokens`: 2048, `thinking: { type: "adaptive" }`
- Key source: `process.env.ANTHROPIC_API_KEY`
- CORS enabled for the static demo.

## Security notes

- **BOLD: the API key is used server-side only** — never returned to the client.
- Do not commit `.env`.
- This is a minimal reference proxy; add auth/rate-limiting before public use.
