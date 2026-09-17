// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// check.mjs — no-dependency verifier. Runs in CI and locally:
//   1. JSON.parse every data/*.json
//   2. `node --check` every .js/.mjs (incl. ai/ + server/)
//   3. index.html contains all required container IDs
//   4. unit-test comfort.js (pure model)
//   5. AI MockProvider is deterministic + Korean
//   6. AI_ENDPOINT is empty AND no real API key (sk-ant-…) is committed
//
// Usage: node check.mjs   (exit 0 = pass)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  console.error(`  ✗ ${m}`);
  failures++;
};
const section = (m) => console.log(`\n▶ ${m}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const allFiles = walk(ROOT);

// 1. JSON parse -------------------------------------------------------------
section('1. data/*.json parse');
for (const f of allFiles.filter((f) => f.endsWith('.json') && f.includes('data'))) {
  try {
    JSON.parse(readFileSync(f, 'utf8'));
    ok(relative(ROOT, f));
  } catch (e) {
    bad(`${relative(ROOT, f)} — ${e.message}`);
  }
}

// 2. node --check all JS ----------------------------------------------------
section('2. node --check (all .js / .mjs)');
const jsFiles = allFiles.filter((f) => /\.(mjs|js)$/.test(f));
const needAi = ['ai/config.js', 'ai/ai.js', 'server/index.mjs'];
for (const req of needAi) {
  if (!jsFiles.some((f) => relative(ROOT, f).replace(/\\/g, '/') === req)) bad(`missing ${req}`);
}
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    ok(relative(ROOT, f));
  } catch (e) {
    bad(`${relative(ROOT, f)} — ${e.stderr?.toString() || e.message}`);
  }
}

// 3. index.html containers --------------------------------------------------
section('3. index.html containers');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const requiredIds = [
  'idea-origin', 'simulator', 'palmrest-svg', 'controls', 'presets',
  'metrics', 'ai-panel', 'ai-output', 'spec-page', 'specs', 'bom', 'bom-total',
];
for (const id of requiredIds) {
  if (html.includes(`id="${id}"`)) ok(`#${id}`);
  else bad(`missing container #${id}`);
}
for (const f of FIELDSCHECK()) {
  if (html.includes(`id="in-${f}"`)) ok(`control #in-${f}`);
  else bad(`missing control #in-${f}`);
}
function FIELDSCHECK() {
  return ['fan', 'height', 'angle', 'humidity', 'temp'];
}

// 4. comfort.js unit tests --------------------------------------------------
section('4. comfort.js unit tests');
const comfort = await import('./comfort.js');
function assert(cond, msg) {
  if (cond) ok(msg);
  else bad(msg);
}
{
  const m = comfort.computeMetrics({ fan: 100, height: 25, angle: 8, humidity: 40, temp: 25 });
  assert(m.dryness >= 80 && m.dryness <= 90, `fan100/RH40/25°C dryness≈85 (got ${m.dryness})`);
  assert(m.noise > 40 && m.noise < 46, `fan100 noise≈45dB (got ${m.noise})`);
  assert(m.power > 2.2 && m.power < 2.6, `fan100 power≈2.45W (got ${m.power})`);

  const off = comfort.computeMetrics({ fan: 0, height: 25, angle: 8, humidity: 60, temp: 25 });
  assert(off.airVelocity === 0, `fan0 → 0 m/s (got ${off.airVelocity})`);
  assert(off.dryness === 0, `fan0 → dryness 0 (got ${off.dryness})`);

  // monotonic: more fan → more dryness (dry air)
  const lo = comfort.drynessIndex({ fan: 30, height: 25, angle: 8, humidity: 40, temp: 25 });
  const hi = comfort.drynessIndex({ fan: 80, height: 25, angle: 8, humidity: 40, temp: 25 });
  assert(hi > lo, `dryness increases with fan (${lo} < ${hi})`);

  // humidity: higher RH → less dryness
  const dry = comfort.drynessIndex({ fan: 60, height: 25, angle: 8, humidity: 30, temp: 25 });
  const humid = comfort.drynessIndex({ fan: 60, height: 25, angle: 8, humidity: 85, temp: 25 });
  assert(dry > humid, `dryness drops in humid air (${humid} < ${dry})`);

  // ergonomics: ideal geometry scores highest
  assert(comfort.ergoScore({ height: 25, angle: 8 }) === 100, 'ideal geometry ergo=100');
  assert(comfort.ergoScore({ height: 45, angle: 20 }) < 80, 'extreme geometry ergo<80');

  // all metrics within declared bounds
  for (const t of [0, 25, 50, 75, 100]) {
    const mm = comfort.computeMetrics({ fan: t, height: 30, angle: 5, humidity: 55, temp: 27 });
    const inRange = [mm.dryness, mm.comfort, mm.ergo].every((v) => v >= 0 && v <= 100);
    assert(inRange, `fan${t}: dryness/comfort/ergo within 0..100`);
  }
}

// 5. AI mock determinism ----------------------------------------------------
section('5. AI MockProvider deterministic + Korean');
const { askAI, isMock } = await import('./ai/ai.js');
assert(isMock() === true, 'isMock() true when AI_ENDPOINT empty');
for (const task of ['setup', 'explain', 'coach']) {
  const payload = { inputs: { fan: 60, height: 25, angle: 8, humidity: 55, temp: 27 }, humidity: 55, temp: 27, sweat: 'high', minutes: 50 };
  const a = await askAI(task, payload);
  const b = await askAI(task, payload);
  assert(a === b && a.length > 20, `mock '${task}' deterministic (${a.length} chars)`);
  assert(/[가-힣]/.test(a), `mock '${task}' contains Korean`);
}

// 6. AI_ENDPOINT empty + no committed real key ------------------------------
section('6. AI key hygiene');
const cfg = await import('./ai/config.js');
assert(cfg.AI_ENDPOINT === '', 'AI_ENDPOINT is empty (demo = mock)');

const keyRe = /sk-ant-[A-Za-z0-9_-]{20,}/g;
let leaked = 0;
for (const f of allFiles.filter((f) => /\.(js|mjs|json|html|md|txt|css)$/.test(f))) {
  const text = readFileSync(f, 'utf8');
  for (const match of text.match(keyRe) || []) {
    // Ignore obvious placeholders (all-x / repeated chars) — only real keys count.
    if (/x{8,}/i.test(match)) continue;
    bad(`possible real API key in ${relative(ROOT, f)}: ${match.slice(0, 12)}…`);
    leaked++;
  }
}
if (!leaked) ok('no real sk-ant-… key committed (placeholders ignored)');

// summary -------------------------------------------------------------------
console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
