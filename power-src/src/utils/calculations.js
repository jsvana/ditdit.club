import { COAX_FREQS_MHZ, COAX_BY_ID } from '../constants/coaxData.js'
import {
  ANTENNA_BY_ID,
  HEIGHT_GAIN_CURVE,
  HORIZ_GROUND_OFFSET,
  FT_PER_LAMBDA,
} from '../constants/antennaData.js'

// --- Unit conversions ---

export const wattsToDbW = (w) => 10 * Math.log10(w)
export const dbwToWatts = (dbw) => Math.pow(10, dbw / 10)
export const wattsToDbm = (w) => 10 * Math.log10(w * 1000)

// --- S-units ---
// IARU Region 1 Technical Recommendation R.1 (1981) defines one S-unit as
// 6 dB. S9 corresponds to -73 dBm on HF (below 30 MHz) and -93 dBm on
// VHF/UHF. Many radios approximate this loosely, but 6 dB is canonical.
export const DB_PER_S_UNIT = 6

export const dbToSUnits = (db) => db / DB_PER_S_UNIT

// --- Coax loss ---

// Interpolate per-100-ft loss between table points. We linearly
// interpolate in √f rather than f, because coax loss is dominated by
// skin effect (loss ∝ √f) plus a smaller dielectric term (∝ f). Plain
// linear-in-f interpolation visibly undershoots in wide gaps like
// 28→50 MHz and 50→146 MHz; √f interpolation tracks datasheet values
// much more closely there.
export function coaxLossPer100ft(coaxId, freqMhz) {
  const coax = COAX_BY_ID[coaxId]
  if (!coax) return 0
  const xs = COAX_FREQS_MHZ
  const ys = coax.lossPer100ft
  if (freqMhz <= xs[0]) return ys[0]
  if (freqMhz >= xs[xs.length - 1]) return ys[ys.length - 1]
  const sq = Math.sqrt(freqMhz)
  for (let i = 0; i < xs.length - 1; i++) {
    if (freqMhz >= xs[i] && freqMhz <= xs[i + 1]) {
      const sq0 = Math.sqrt(xs[i])
      const sq1 = Math.sqrt(xs[i + 1])
      const t = (sq - sq0) / (sq1 - sq0)
      return ys[i] + t * (ys[i + 1] - ys[i])
    }
  }
  return 0
}

export function coaxLossDb(coaxId, freqMhz, lengthFt) {
  return coaxLossPer100ft(coaxId, freqMhz) * (lengthFt / 100)
}

// --- SWR mismatch loss ---
// At the antenna feedpoint, a fraction |Γ|² of forward power is reflected.
// The simple feedpoint mismatch loss is -10·log10(1 - |Γ|²). Note this
// does NOT include the extra coax loss the reflected wave incurs on its
// way back through the feedline — that's a separate (usually small) effect
// we skip for clarity.
export function swrMismatchLossDb(swr) {
  if (swr <= 1) return 0
  const gamma = (swr - 1) / (swr + 1)
  const reflectedFraction = gamma * gamma
  const delivered = 1 - reflectedFraction
  if (delivered <= 0) return Infinity
  return -10 * Math.log10(delivered)
}

// --- Antenna gain ---
//
// Returns peak forward gain in dBi for the configured antenna. We model
// three families:
//   * Verticals: ground-dependent only. Direct lookup from the gainByGround
//     table (sourced from Portable Antennas's 28.4 MHz NEC simulation).
//   * Horizontals: height- and ground-dependent. Linear-in-h/λ interpolation
//     of the height curve, plus a ground offset.
//   * Directional and small antennas: fixed published gain (we don't model
//     Yagi height variation — assume typical 1λ install).

function lerpHeightGain(hLambda) {
  const curve = HEIGHT_GAIN_CURVE
  if (hLambda <= curve[0].hLambda) return curve[0].dBi
  if (hLambda >= curve[curve.length - 1].hLambda) {
    return curve[curve.length - 1].dBi
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1]
    if (hLambda >= a.hLambda && hLambda <= b.hLambda) {
      const t = (hLambda - a.hLambda) / (b.hLambda - a.hLambda)
      return a.dBi + t * (b.dBi - a.dBi)
    }
  }
  return curve[curve.length - 1].dBi
}

export function antennaGainDbi(antennaConfig, freqMhz) {
  const { antennaId, groundType, heightFt } = antennaConfig
  const ant = ANTENNA_BY_ID[antennaId]
  if (!ant) return 0

  if (ant.groundDependent && !ant.heightDependent) {
    // Verticals: table lookup.
    return ant.gainByGround[groundType] ?? 0
  }

  if (ant.heightDependent) {
    // Horizontals: height curve + ground offset.
    const wavelengthFt = FT_PER_LAMBDA(freqMhz)
    const hLambda = (heightFt || 0) / wavelengthFt
    let gain = lerpHeightGain(hLambda)
    if (ant.groundDependent) {
      gain += HORIZ_GROUND_OFFSET[groundType] ?? 0
    }
    // For the full-wave loop, the height curve underestimates its
    // ~5.5 dBi figure; bias up by the difference between its fixed
    // value and the dipole baseline at λ/2 height (~7.24 dBi).
    if (ant.fixedGainDbi != null) {
      // Use the fixed gain as the "anchor" at λ/2 height instead of
      // the dipole anchor. We subtract the dipole-at-λ/2 baseline
      // and add the antenna's fixed dBi.
      gain = gain - 7.24 + ant.fixedGainDbi
    }
    return gain
  }

  // Fixed-gain antennas (loops, Yagis, hex beam).
  return ant.fixedGainDbi ?? 0
}

export function antennaFbDb(antennaConfig) {
  const ant = ANTENNA_BY_ID[antennaConfig.antennaId]
  const base = ant?.fbDb ?? 0
  // If the antenna has a published F/B and the user has overridden it,
  // use the override (clamped non-negative). Otherwise the published value.
  if (base > 0 && antennaConfig.fbOverride != null) {
    return Math.max(0, antennaConfig.fbOverride)
  }
  return base
}

// --- Amp gain ---
export function ampGainDb(inputW, outputW) {
  if (inputW <= 0 || outputW <= 0) return 0
  return 10 * Math.log10(outputW / inputW)
}

// --- Full chain calculation ---
// Returns a breakdown of every stage in dB, plus the net radiated power.
//
// Signal path (left to right):
//   TX → coax1 → [amp] → coax2 → antenna (mismatch loss)
export function computeChain(scenario) {
  const {
    txPowerW,
    freqMhz,
    coax1Id,
    coax1LengthFt,
    ampEnabled,
    ampOutputW,
    coax2Id,
    coax2LengthFt,
    antennaSwr,
  } = scenario

  const coax1Db = coaxLossDb(coax1Id, freqMhz, coax1LengthFt)
  const afterCoax1W = dbwToWatts(wattsToDbW(txPowerW) - coax1Db)

  let ampDb = 0
  let afterAmpW = afterCoax1W
  let coax2Db = 0
  let afterCoax2W = afterCoax1W
  if (ampEnabled && ampOutputW > 0) {
    ampDb = ampGainDb(afterCoax1W, ampOutputW)
    afterAmpW = ampOutputW
    coax2Db = coaxLossDb(coax2Id, freqMhz, coax2LengthFt)
    afterCoax2W = dbwToWatts(wattsToDbW(afterAmpW) - coax2Db)
  }

  const swrDb = swrMismatchLossDb(antennaSwr)
  const radiatedW = dbwToWatts(wattsToDbW(afterCoax2W) - swrDb)

  const antGainDbi = antennaGainDbi(scenario, scenario.freqMhz)
  const fbDb = antennaFbDb(scenario)
  // Peak EIRP in the favored direction. For omni antennas with gainDbi
  // near 0 this is essentially the same as the radiated power.
  const peakEirpW = dbwToWatts(wattsToDbW(radiatedW) + antGainDbi)

  const netDb = wattsToDbW(peakEirpW) - wattsToDbW(txPowerW)

  return {
    txPowerW,
    coax1Db,
    afterCoax1W,
    ampEnabled,
    ampDb,
    afterAmpW,
    coax2Db,
    afterCoax2W,
    swrDb,
    radiatedW,
    antGainDbi,
    fbDb,
    peakEirpW,
    netDb,
  }
}

// --- TX vs RX deltas ---
//
// TX delta: change in peak EIRP toward the receiver. Always relevant.
// RX SNR delta (noisy QTH): same forward gain plus a credit for the
// F/B noise rejection. F/B credit is conservatively half the F/B
// improvement — accounts for the fact that not all environmental noise
// comes from directly behind the antenna. With the simplifying
// assumption of roughly uniform noise distribution, half is a fair
// midpoint between "best case" (all noise from behind, full F/B credit)
// and "worst case" (noise from front, zero credit).
export const FB_NOISE_CREDIT_FRACTION = 0.5

export function txDeltaDb(beforeBreakdown, afterBreakdown) {
  return wattsToDbW(afterBreakdown.peakEirpW) - wattsToDbW(beforeBreakdown.peakEirpW)
}

export function rxSnrDeltaDb(beforeBreakdown, afterBreakdown) {
  const tx = txDeltaDb(beforeBreakdown, afterBreakdown)
  const fbCredit = FB_NOISE_CREDIT_FRACTION * (afterBreakdown.fbDb - beforeBreakdown.fbDb)
  return tx + fbCredit
}

// --- Warnings ---
// Surface edge cases where the simple model starts to drift from reality
// or where a result deserves a "double-check this" flag.
export function scenarioWarnings(scenario, breakdown) {
  const warnings = []

  const totalCoaxDb = breakdown.coax1Db + breakdown.coax2Db

  // Additional loss from reflected waves bouncing in lossy feedline
  // becomes non-trivial once matched-line loss is a few dB and SWR is
  // also high. The simple feedpoint mismatch formula will then
  // underestimate total system loss by ~0.5–2 dB.
  if (totalCoaxDb > 3 && scenario.antennaSwr > 2.5) {
    warnings.push({
      tone: 'warn',
      text:
        `High coax loss (${totalCoaxDb.toFixed(1)} dB) combined with ` +
        `${scenario.antennaSwr.toFixed(1)}:1 SWR — reflected-wave round-trip ` +
        `losses will make real loss 0.5–2 dB worse than shown.`,
    })
  }

  // Implied amp gain. Typical HF amps are spec'd for 13 dB or so of gain;
  // anything north of ~15 dB usually means the user has under-driven the
  // amp on paper, which means real-world output won't hit the rated wattage.
  if (scenario.ampEnabled && breakdown.ampDb > 15) {
    warnings.push({
      tone: 'warn',
      text:
        `Amp would need ${breakdown.ampDb.toFixed(1)} dB of gain to hit ` +
        `${breakdown.afterAmpW.toFixed(0)} W from ${breakdown.afterCoax1W.toFixed(1)} W ` +
        `of drive. Most HF amps top out around 13 dB — check the amp's ` +
        `drive requirements.`,
    })
  }

  // Very low horizontal antenna ("cloud warmer") — calls out the common
  // case where someone's dipole is up at 20 ft on 40m or 80m and they
  // wonder why DX is hard.
  const ant = ANTENNA_BY_ID[scenario.antennaId]
  if (ant?.heightDependent && scenario.heightFt && scenario.freqMhz) {
    const hLambda = scenario.heightFt / FT_PER_LAMBDA(scenario.freqMhz)
    if (hLambda < 0.2) {
      warnings.push({
        tone: 'info',
        text:
          `Horizontal antenna at ${hLambda.toFixed(2)} λ is a "cloud warmer" — ` +
          `it radiates mostly straight up, fine for regional NVIS but poor for DX. ` +
          `Raising it to ${(0.5 * FT_PER_LAMBDA(scenario.freqMhz)).toFixed(0)} ft ` +
          `(λ/2) would help a lot.`,
      })
    }
  }

  // Severe overall coax loss is worth calling out — a 6 dB feedline is a
  // whole S-unit before you even reach the antenna.
  if (totalCoaxDb > 6) {
    warnings.push({
      tone: 'info',
      text:
        `Feedline alone eats ${totalCoaxDb.toFixed(1)} dB — that's about ` +
        `${(totalCoaxDb / 6).toFixed(1)} S-unit${totalCoaxDb >= 12 ? 's' : ''} ` +
        `of signal lost in the cable. Consider lower-loss coax or a shorter run.`,
    })
  }

  return warnings
}

// --- Perceptibility verdict ---
// Roughly: 3 dB is the smallest change most ops can hear, one S-unit
// (6 dB) is clearly audible, two S-units is "definitely louder", three
// S-units (~18 dB / 64×) is the kind of difference QRP-vs-legal-limit
// people argue about. None of this turns a no-copy into a 599.
export function perceptibilityVerdict(deltaDb) {
  const abs = Math.abs(deltaDb)
  if (abs < 1) return { label: 'Negligible', tone: 'meh' }
  if (abs < 3) return { label: 'Barely perceptible', tone: 'meh' }
  if (abs < 6) return { label: 'Noticeable, under one S-unit', tone: 'modest' }
  if (abs < 12) return { label: 'Clearly noticeable, ~1–2 S-units', tone: 'good' }
  if (abs < 20) return { label: 'Big change, 2–3 S-units', tone: 'great' }
  return { label: 'Massive — 3+ S-units', tone: 'great' }
}

// Number formatting helpers.
export const fmtDb = (db) => (db >= 0 ? '+' : '') + db.toFixed(2) + ' dB'
export const fmtS = (s) => (s >= 0 ? '+' : '') + s.toFixed(2) + ' S'
export const fmtW = (w) => {
  if (w >= 1000) return (w / 1000).toFixed(2) + ' kW'
  if (w >= 10) return w.toFixed(1) + ' W'
  if (w >= 1) return w.toFixed(2) + ' W'
  return (w * 1000).toFixed(0) + ' mW'
}
