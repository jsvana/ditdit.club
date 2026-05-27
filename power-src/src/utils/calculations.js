import { COAX_FREQS_MHZ, COAX_BY_ID } from '../constants/coaxData.js'

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

  const netDb = wattsToDbW(radiatedW) - wattsToDbW(txPowerW)

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
    netDb,
  }
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
