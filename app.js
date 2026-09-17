// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// app.js — UI orchestrator. Wires the controls to the pure comfort model,
// animates the inline SVG, renders specs/BOM/presets, persists settings to
// localStorage (try/catch + reset), and drives the AI panel via ai/ai.js.

import { computeMetrics, DEFAULT_INPUTS } from './comfort.js';
import { askAI, isMock } from './ai/ai.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'palmrest.settings.v1';

const FIELDS = ['fan', 'height', 'angle', 'humidity', 'temp'];
const svgNS = 'http://www.w3.org/2000/svg';

// ── localStorage (defensive) ────────────────────────────────────────────────
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INPUTS };
    const saved = JSON.parse(raw);
    const out = { ...DEFAULT_INPUTS };
    for (const f of FIELDS) if (Number.isFinite(saved[f])) out[f] = saved[f];
    return out;
  } catch {
    return { ...DEFAULT_INPUTS };
  }
}
function saveSettings(inputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    /* private mode / disabled storage — ignore */
  }
}

// ── Read current inputs from sliders ────────────────────────────────────────
function readInputs() {
  const inputs = {};
  for (const f of FIELDS) inputs[f] = Number($(`in-${f}`).value);
  return inputs;
}
function applyInputs(inputs) {
  for (const f of FIELDS) {
    $(`in-${f}`).value = inputs[f];
    $(`out-${f}`).textContent = inputs[f];
  }
}

// ── SVG helpers ─────────────────────────────────────────────────────────────
function buildStaticSvg() {
  // vents on the palm-rest top
  const vents = $('vents');
  for (let i = 0; i < 8; i++) {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', 70 + i * 22);
    c.setAttribute('cy', 200);
    c.setAttribute('r', 2.2);
    vents.appendChild(c);
  }
  // keyboard key hints
  const keys = $('key-hints');
  for (let i = 0; i < 8; i++) {
    const r = document.createElementNS(svgNS, 'rect');
    r.setAttribute('x', 256 + (i % 8) * 22);
    r.setAttribute('y', 232);
    r.setAttribute('width', 16);
    r.setAttribute('height', 8);
    r.setAttribute('rx', 2);
    keys.appendChild(r);
  }
}

function updateSvg(inputs, metrics) {
  // Height: raise the group. Angle: rotate about the front hinge (~x=250,y=213).
  const lift = (inputs.height - 25) * 0.8; // px per mm
  const rest = $('rest-group');
  rest.setAttribute(
    'transform',
    `translate(0 ${-lift}) rotate(${-inputs.angle} 250 213)`
  );
  $('angle-label').textContent = `각도 ${inputs.angle}°  ·  높이 ${inputs.height}mm`;

  // Airflow lines: number + animation speed scale with fan strength.
  const airflow = $('airflow');
  airflow.replaceChildren();
  const fan = inputs.fan;
  const count = Math.round((fan / 100) * 7);
  const duration = fan > 0 ? Math.max(0.35, 1.6 - fan / 90).toFixed(2) : 0;
  for (let i = 0; i < count; i++) {
    const y = 150 + i * 10 - lift;
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', `M60 ${y} q60 -14 130 -6 q40 3 70 -6`);
    p.setAttribute('class', 'air-line');
    p.setAttribute('stroke-dasharray', '10 30');
    p.style.opacity = String(0.35 + (i / count) * 0.5);
    if (duration) p.style.animationDuration = `${duration}s`;
    airflow.appendChild(p);
  }

  // Sweat droplets: more when dryness is low.
  const sweat = $('sweat');
  sweat.replaceChildren();
  const drops = Math.max(0, Math.round((100 - metrics.dryness) / 22));
  for (let i = 0; i < drops; i++) {
    const d = document.createElementNS(svgNS, 'circle');
    d.setAttribute('cx', 90 + i * 30);
    d.setAttribute('cy', 178 + (i % 2) * 8);
    d.setAttribute('r', 3);
    d.setAttribute('opacity', '0.8');
    sweat.appendChild(d);
  }
}

// ── Metrics rendering ───────────────────────────────────────────────────────
function renderMetrics(metrics) {
  $('m-dryness').textContent = `${metrics.dryness} / 100`;
  $('m-comfort').textContent = `${metrics.comfort} / 100`;
  $('m-air').textContent = `${metrics.airVelocity} m/s`;
  $('m-perceived').textContent = `${metrics.perceivedTemp} °C`;
  $('m-noise').textContent = `${metrics.noise} dB`;
  $('m-power').textContent = `${metrics.power} W · ${metrics.current} A`;
  $('ergo-guidance').textContent = `💡 ${metrics.guidance}`;
}

// ── Main update loop ────────────────────────────────────────────────────────
function update() {
  const inputs = readInputs();
  for (const f of FIELDS) $(`out-${f}`).textContent = inputs[f];
  const metrics = computeMetrics(inputs);
  renderMetrics(metrics);
  updateSvg(inputs, metrics);
  saveSettings(inputs);
  return { inputs, metrics };
}

// ── Data loading + rendering ────────────────────────────────────────────────
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} 로드 실패: ${res.status}`);
  return res.json();
}

function renderSpecs(specs) {
  const el = $('specs');
  const rows = [
    ['치수', `${specs.dimensions.width_mm}×${specs.dimensions.depth_mm}mm`],
    ['높이 범위', `${specs.dimensions.height_range_mm[0]}~${specs.dimensions.height_range_mm[1]}mm`],
    ['각도 범위', `${specs.dimensions.angle_range_deg[0]}~${specs.dimensions.angle_range_deg[1]}°`],
    ['팬', `${specs.cooling.fan_size_mm}mm × ${specs.cooling.fan_count}개`],
    ['최대 풍속', `${specs.cooling.max_air_velocity_mps} m/s`],
    ['전원', `${specs.power.input} · 최대 ${specs.power.max_power_w}W`],
    ['상판 소재', specs.materials.top_surface],
    ['본체 소재', specs.materials.body],
  ];
  el.replaceChildren(
    ...rows.map(([k, v]) => {
      const d = document.createElement('div');
      d.className = 'spec-item';
      d.innerHTML = `<span class="k"></span><span class="v"></span>`;
      d.querySelector('.k').textContent = k;
      d.querySelector('.v').textContent = v;
      return d;
    })
  );
}

function renderBom(parts) {
  const body = $('bom-body');
  let total = 0;
  const frag = document.createDocumentFragment();
  for (const p of parts.bom) {
    const sub = p.qty * p.unit_price;
    total += sub;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td></td><td class="num"></td><td class="num"></td><td class="num"></td><td></td>`;
    const tds = tr.querySelectorAll('td');
    tds[0].textContent = p.part;
    tds[1].textContent = p.qty;
    tds[2].textContent = p.unit_price.toLocaleString('ko-KR');
    tds[3].textContent = sub.toLocaleString('ko-KR');
    tds[4].textContent = p.note || '';
    frag.appendChild(tr);
  }
  body.replaceChildren(frag);
  $('bom-total').textContent = total.toLocaleString('ko-KR');
}

function renderPresets(presets) {
  const row = $('presets');
  row.replaceChildren(
    ...presets.presets.map((p) => {
      const b = document.createElement('button');
      b.className = 'preset-btn';
      b.type = 'button';
      b.textContent = p.label;
      b.title = p.desc;
      b.addEventListener('click', () => {
        applyInputs({ ...DEFAULT_INPUTS, ...p.inputs });
        update();
      });
      return b;
    })
  );
}

// ── AI panel ────────────────────────────────────────────────────────────────
let currentTask = 'setup';
function setupAi() {
  $('ai-mode-badge').textContent = isMock() ? 'mock' : 'live';
  const tabs = document.querySelectorAll('.ai-tab');
  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('is-active'));
      t.classList.add('is-active');
      currentTask = t.dataset.task;
      $('ai-setup-controls').style.display = currentTask === 'setup' ? '' : 'none';
    })
  );

  $('ai-run').addEventListener('click', async () => {
    const out = $('ai-output');
    out.textContent = '⏳ 생성 중...';
    const inputs = readInputs();
    let payload;
    if (currentTask === 'setup') {
      payload = { humidity: inputs.humidity, temp: inputs.temp, sweat: $('ai-sweat').value };
    } else if (currentTask === 'coach') {
      payload = { inputs, minutes: 50 };
    } else {
      payload = { inputs };
    }
    try {
      let acc = '';
      await askAI(currentTask, payload, {
        onToken: (t) => {
          acc += t;
          out.textContent = acc;
        },
      });
    } catch (err) {
      out.textContent = `⚠️ ${err.message}`;
    }
  });
}

// ── Autonomous on-load recommendation (온습도 기반, 무인) ─────────────────────
// Builds an auto digest from the app's existing engines via askAI('setup').
// Works offline through the deterministic mock, so it never breaks (무인).
async function runAutoRec() {
  const out = $('auto-rec-output');
  const badge = $('auto-rec-mode');
  if (!out) return;
  if (badge) badge.textContent = isMock() ? 'mock' : 'live';
  const inputs = readInputs();
  const payload = { humidity: inputs.humidity, temp: inputs.temp, sweat: 'medium' };
  try {
    let acc = '';
    await askAI('setup', payload, {
      onToken: (t) => {
        acc += t;
        out.textContent = acc;
      },
    });
    if (!acc) out.textContent = '추천을 생성하지 못했습니다.';
  } catch (err) {
    out.textContent = `⚠️ ${err.message}`;
  }
}

// ── Theme toggle ────────────────────────────────────────────────────────────
function setupTheme() {
  const KEY = 'palmrest.theme';
  let mode;
  try {
    mode = localStorage.getItem(KEY) || 'auto';
  } catch {
    mode = 'auto';
  }
  const apply = (m) => {
    document.documentElement.setAttribute('data-theme', m);
  };
  apply(mode);
  $('theme-toggle').addEventListener('click', () => {
    mode = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light';
    apply(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
  });
}

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  buildStaticSvg();
  setupTheme();
  applyInputs(loadSettings());

  for (const f of FIELDS) $(`in-${f}`).addEventListener('input', update);
  $('reset-btn').addEventListener('click', () => {
    applyInputs({ ...DEFAULT_INPUTS });
    update();
  });

  update();
  setupAi();
  runAutoRec(); // 무인 자동 추천 (온습도 기반) — mock offline로도 동작

  try {
    const [specs, parts, presets] = await Promise.all([
      loadJSON('data/specs.json'),
      loadJSON('data/parts.json'),
      loadJSON('data/presets.json'),
    ]);
    renderSpecs(specs);
    renderBom(parts);
    renderPresets(presets);
  } catch (err) {
    console.error(err);
    $('specs').textContent = '데이터를 불러오지 못했습니다.';
  }
}

init();
