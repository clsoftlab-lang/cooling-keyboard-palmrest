// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// comfort.js — PURE, dependency-free estimation model for the
// "땀 날아가는 키보드 팜레스트" (cooling keyboard palm-rest) simulator.
//
// Every function here is deterministic and side-effect free so it can be
// unit-tested in Node (see check.mjs) and reused by both the UI and the
// deterministic AI MockProvider.
//
// ─────────────────────────────────────────────────────────────────────────
// MODEL OVERVIEW (simplified engineering estimates — NOT lab-verified)
// ─────────────────────────────────────────────────────────────────────────
// Inputs:
//   fan       : fan power           [%]   0..100
//   height    : palm-rest height    [mm]  10..45
//   angle     : palm-rest tilt      [deg] -5..20  (positive = front lifted)
//   humidity  : room relative hum.  [%]   20..90
//   temp      : room temperature    [°C]  16..36
//
// Outputs (all estimates):
//   airVelocity   [m/s]  air speed reaching the hand
//   dryness       [0..100] sweat-drying index for the palm
//   comfort       [0..100] overall comfort index
//   noise         [dB(A)] estimated fan noise
//   power         [W]     estimated electrical draw (USB 5 V)
//   current       [A]     power / 5 V
//   perceivedTemp [°C]    wind-chill adjusted felt temperature
//   ergo          [0..100] ergonomic posture score
// ─────────────────────────────────────────────────────────────────────────

// ---- Documented physical constants (chosen for a small 40–50 mm USB fan) ----
export const MAX_AIR_VELOCITY = 3.5; // m/s at fan = 100% right at the outlet
export const IDEAL_ANGLE = 8;        // deg — neutral-wrist palm-rest tilt
export const IDEAL_HEIGHT = 25;      // mm — matches typical low-profile boards
export const SKIN_TEMP = 33;         // °C — approx palm skin temperature
export const USB_VOLTAGE = 5;        // V

export const clamp = (x, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
export const round1 = (x) => Math.round(x * 10) / 10;

// Magnus-Tetens saturation vapour pressure [hPa] for temperature T [°C].
// Used to make drying temperature-dependent (warm air holds more moisture).
export function saturationPressure(t) {
  return 6.112 * Math.exp((17.62 * t) / (243.12 + t));
}

// Air speed that actually reaches the hand, after height spread + tilt aiming.
// - Fan curve is treated as roughly linear in fan %.
// - heightFactor: raising the rest spreads the jet, so less reaches the palm.
// - angleFactor : airflow is best aimed at the palm near IDEAL_ANGLE.
export function airVelocity({ fan, height, angle }) {
  const base = MAX_AIR_VELOCITY * (fan / 100);
  const heightFactor = clamp(1 - 0.006 * (height - IDEAL_HEIGHT), 0.75, 1.1) / 1;
  const angleFactor = clamp(1 - Math.abs(angle - IDEAL_ANGLE) / 45, 0.6, 1) / 1;
  return base * heightFactor * angleFactor;
}

// Sweat-drying index [0..100].
// Convective mass-transfer analogy: evaporation ∝ h_m · (C_skin − C_air).
//   h_m (mass-transfer coeff) ∝ velocity^0.8  (turbulent flat-plate)
//   driving term ≈ (1 − RH/100) · Psat(T)/Psat(25)  (capacity left in the air)
export function drynessIndex({ fan, height, angle, humidity, temp }) {
  const v = airVelocity({ fan, height, angle });
  const capacity = (1 - humidity / 100) * (saturationPressure(temp) / saturationPressure(25));
  const raw = Math.pow(Math.max(v, 0), 0.8) * Math.max(capacity, 0);
  // k chosen so fan100 / RH40 / 25°C ≈ 85
  const k = 52;
  return clamp(round1(k * raw));
}

// Wind-chill adjusted felt temperature [°C]. Moving air feels cooler:
// ~1.5 °C per m/s, capped at 6 °C of cooling.
export function perceivedTemperature({ fan, height, angle, temp }) {
  const v = airVelocity({ fan, height, angle });
  const cooling = Math.min(v * 1.5, 6);
  return round1(temp - cooling);
}

// Ergonomic posture score [0..100] from tilt + height deviation from ideal.
export function ergoScore({ height, angle }) {
  return clamp(100 - Math.abs(angle - IDEAL_ANGLE) * 4 - Math.abs(height - IDEAL_HEIGHT) * 1.2);
}

// Overall comfort index [0..100]: weighted dryness + thermal + ergonomics,
// minus a draft penalty when air on the hand is too strong.
export function comfortIndex(inputs) {
  const dryness = drynessIndex(inputs);
  const v = airVelocity(inputs);
  const perceived = perceivedTemperature(inputs);
  const ergo = ergoScore(inputs);

  const drynessComfort = clamp(dryness * 1.1);
  const thermalComfort = clamp(100 - Math.abs(perceived - 22) * 7);
  const draftPenalty = Math.max(0, v - 3) * 10;

  const c = 0.35 * drynessComfort + 0.3 * thermalComfort + 0.35 * ergo - draftPenalty;
  return clamp(round1(c));
}

// Estimated fan noise [dB(A)]. Small fans sit ~18 dB (idle) to ~45 dB (full).
export function noiseDb({ fan }) {
  return round1(18 + 27 * Math.pow(fan / 100, 1.4));
}

// Estimated electrical draw [W] on USB 5 V. Base electronics + fan affinity
// law (power grows steeply with speed). Full ≈ 2.45 W (≈ 0.49 A).
export function powerW({ fan }) {
  return round1(0.15 + 2.3 * Math.pow(fan / 100, 2.6));
}

// Short Korean ergonomic guidance string for the current geometry.
export function ergoGuidance({ height, angle }) {
  const parts = [];
  if (angle < IDEAL_ANGLE - 3) parts.push('앞쪽을 조금 더 올려 손목 각도를 완만하게 하세요.');
  else if (angle > IDEAL_ANGLE + 3) parts.push('기울기가 큽니다. 손목이 젖혀지지 않게 각도를 낮추세요.');
  else parts.push('손목 각도가 중립 범위에 가깝습니다.');
  if (height < IDEAL_HEIGHT - 6) parts.push('높이를 조금 높여 손목 꺾임을 줄이세요.');
  else if (height > IDEAL_HEIGHT + 8) parts.push('너무 높습니다. 어깨 긴장을 줄이려면 낮추세요.');
  return parts.join(' ');
}

// Single entry point: compute every metric at once.
export function computeMetrics(inputs) {
  return {
    airVelocity: round1(airVelocity(inputs)),
    dryness: drynessIndex(inputs),
    comfort: comfortIndex(inputs),
    noise: noiseDb(inputs),
    power: powerW(inputs),
    current: round1(powerW(inputs) / USB_VOLTAGE),
    perceivedTemp: perceivedTemperature(inputs),
    ergo: ergoScore(inputs),
    guidance: ergoGuidance(inputs),
  };
}

export const DEFAULT_INPUTS = { fan: 55, height: 25, angle: 8, humidity: 55, temp: 26 };
