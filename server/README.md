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
# → AI proxy listening on http://localhost:8787/api/ai (model: claude-haiku-4-5)
```

Then point the front-end at it by editing `../ai/config.js`:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

## Endpoint

`POST /api/ai` with JSON body `{ "task": "setup|explain|coach", "payload": {...} }`.
Responds with a streamed `text/plain` Korean reply (or HTTP 429 `{fallback:true}`
when a cost guardrail trips — the client then auto-falls back to the mock).

- **Model (cost-first default): `claude-haiku-4-5`** — set `AI_MODEL=claude-sonnet-5`
  or `claude-opus-5` for higher quality. Haiku 4.5 gets **no** `thinking`/effort;
  higher models get `thinking:{type:'adaptive'}` + `output_config.effort` (`AI_EFFORT`, default `low`).
- **Prompt caching**: the stable per-task system prompt is sent as a
  `cache_control:{type:'ephemeral'}` block so repeated calls read cache.
- `max_tokens`: ~700 default (`AI_MAX_TOKENS`).
- **Cost guardrails**: per-IP rate limit (`AI_RATE_PER_MIN`, default 20/min) +
  monthly token budget (`AI_MONTHLY_TOKEN_CAP`, default 2,000,000). Over budget → 429.
- Key source: `process.env.ANTHROPIC_API_KEY`.
- CORS enabled for the static demo.

## ☁️ Free deploy — Cloudflare Workers (무인)

`worker.js` is a Workers variant that calls the Anthropic REST API directly, with
the same task routing + model/caching/guardrail rules. Free tier = no server to
babysit.

```bash
cd server
wrangler secret put ANTHROPIC_API_KEY   # server-side key, never in the repo
wrangler deploy                          # uses wrangler.toml
```

Then set `AI_ENDPOINT` in `../ai/config.js` to `https://<your-worker>/api/ai`.
Optional overrides via `wrangler.toml` vars / secrets: `AI_MODEL`, `AI_EFFORT`,
`AI_RATE_PER_MIN`, `AI_MONTHLY_TOKEN_CAP`, `AI_MAX_TOKENS`.

## Security notes

- **BOLD: the API key is used server-side only** — never returned to the client.
- Do not commit `.env` (it is git-ignored). Set the Worker key via `wrangler secret`.
- Cost guardrails (rate limit + monthly token cap) are built in; tune via env vars.
