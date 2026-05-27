// Antenna gain catalog.
//
// Single-element ground-dependent values are from Portable Antennas's
// 28.4 MHz table (https://portable-antennas.com/), which models four
// ground types via NEC. Lower-band ground effects are similar in shape
// but the absolute differences grow at lower frequencies — we use the
// 10m values as a baseline and note that caveat in the UI.
//
// Yagi/hex-beam gains are typical "1λ above average ground" published
// figures from manufacturer specs (Cushcraft, Mosley, M2, K4KIO).
// F/B ratios are also typical published figures.

export const GROUND_TYPES = [
  { id: 'saltWater', label: 'Salt water (rare)' },
  { id: 'veryGood', label: 'Very good (rich soil, near water table)' },
  { id: 'average', label: 'Average soil' },
  { id: 'veryPoor', label: 'Very poor (rocky, sandy, dry)' },
]

// Reverse-lookup for nicer labels in the diagram block.
export const GROUND_LABEL_SHORT = {
  saltWater: 'salt water',
  veryGood: 'very good',
  average: 'average',
  veryPoor: 'very poor',
}

// Horizontal antenna height-vs-gain curve, in λ. Values are the gain
// of a λ/2 horizontal dipole over average ground at the given height,
// per standard antenna texts (ARRL Antenna Book ch.2, NEC simulations).
// Below ~0.2λ the antenna becomes a "cloud warmer" with high-angle
// radiation only; near 0.5λ it peaks at the canonical ~7 dBi with a
// usable low-angle lobe; gains plateau above ~1λ.
export const HEIGHT_GAIN_CURVE = [
  { hLambda: 0.05, dBi: -5.0 },
  { hLambda: 0.10, dBi:  1.0 },
  { hLambda: 0.15, dBi:  3.5 },
  { hLambda: 0.20, dBi:  5.0 },
  { hLambda: 0.25, dBi:  6.0 },
  { hLambda: 0.30, dBi:  6.5 },
  { hLambda: 0.375, dBi: 6.9 },
  { hLambda: 0.50, dBi:  7.24 }, // matches Portable Antennas table @ avg ground
  { hLambda: 0.625, dBi: 7.7 },
  { hLambda: 0.75, dBi:  7.6 },
  { hLambda: 1.00, dBi:  8.0 },
  { hLambda: 1.50, dBi:  8.1 },
  { hLambda: 2.00, dBi:  8.2 },
]

// Ground adjustments for horizontal antennas, relative to "average" at
// λ/2 height. From the same Portable Antennas table.
export const HORIZ_GROUND_OFFSET = {
  saltWater: +1.12,  // 8.36 − 7.24
  veryGood:  +0.49,  // 7.73 − 7.24
  average:    0,
  veryPoor:  -0.76,  // 6.48 − 7.24
}

// Antenna catalog. Each entry has the fields the UI needs to know how
// to compute and display gain.
export const ANTENNA_TYPES = [
  // --- Verticals (ground-dependent) ---
  {
    id: 'vert-buried',
    name: 'λ/4 vertical, ground-mounted (buried radials)',
    short: 'Vertical, ground-mounted',
    category: 'vertical',
    groundDependent: true,
    heightDependent: false,
    // Direct from the table: gain per ground type
    gainByGround: { saltWater: 4.27, veryGood: -0.56, average: -0.31, veryPoor: -1.69 },
    fbDb: 0,
    notes: 'Performance lives or dies by your radial field. 32+ buried radials assumed.',
  },
  {
    id: 'vert-half-dipole',
    name: 'λ/2 vertical dipole (e.g., end-fed half-wave vertical)',
    short: 'Vertical dipole',
    category: 'vertical',
    groundDependent: true,
    heightDependent: false,
    gainByGround: { saltWater: 5.64, veryGood: 0.69, average: 0.55, veryPoor: 0.15 },
    fbDb: 0,
    notes: 'Half-wave vertical needs no radials. Common in portable EFHW setups.',
  },
  {
    id: 'vert-elevated',
    name: 'λ/4 vertical, elevated (4 radials)',
    short: 'Vertical, elevated',
    category: 'vertical',
    groundDependent: true,
    heightDependent: false,
    gainByGround: { saltWater: 6.31, veryGood: 0.82, average: 1.15, veryPoor: 1.24 },
    fbDb: 0,
    notes: 'Elevating the radials decouples the antenna from soil losses.',
  },

  // --- Horizontals (height-dependent) ---
  {
    id: 'dipole-horiz',
    name: 'Horizontal λ/2 dipole',
    short: 'Horizontal dipole',
    category: 'horizontal',
    groundDependent: true,
    heightDependent: true,
    fbDb: 0,
    notes: 'Most people don\'t have one λ/2 above ground — height matters a lot, especially on 40/80m.',
  },
  {
    id: 'ocf-horiz',
    name: 'Off-center-fed dipole (OCF)',
    short: 'OCF dipole',
    category: 'horizontal',
    groundDependent: true,
    heightDependent: true,
    fbDb: 0,
    notes: 'Multi-band variant of the horizontal dipole — same height/ground behavior.',
  },
  {
    id: 'efhw-horiz',
    name: 'End-fed half-wave (horizontal)',
    short: 'EFHW (horiz)',
    category: 'horizontal',
    groundDependent: true,
    heightDependent: true,
    fbDb: 0,
    notes: 'Horizontal EFHW behaves like a dipole at typical heights.',
  },
  {
    id: 'loop-magnetic',
    name: 'Magnetic loop',
    short: 'Mag loop',
    category: 'small',
    groundDependent: false,
    heightDependent: false,
    fixedGainDbi: -3,
    fbDb: 0,
    notes: 'Small loops are very inefficient but have a deep null perpendicular to the loop — handy for nulling QRM.',
  },
  {
    id: 'loop-full',
    name: 'Full-wave loop (delta / quad)',
    short: 'Full-wave loop',
    category: 'horizontal',
    groundDependent: true,
    heightDependent: true,
    fixedGainDbi: 5.5,  // typical above λ/2; used at base height
    fbDb: 0,
    notes: 'Closed loops are 1–2 dB quieter than open antennas for receive.',
  },

  // --- Directional (with F/B) ---
  // Gain figures are real-world "at 1λ above average ground" — they
  // include the ~5 dB ground-reflection bonus, so they're directly
  // comparable to the height-curve values for horizontal dipoles. Free
  // space gain is roughly these numbers minus 5 dB.
  {
    id: 'hex-beam',
    name: 'Hex beam',
    short: 'Hex beam',
    category: 'directional',
    groundDependent: false,
    heightDependent: false,
    fixedGainDbi: 8.0,
    fbDb: 15,
    notes: 'Compact multi-band 2-element beam. Modest forward gain, decent F/B.',
  },
  {
    id: 'yagi-2el',
    name: '2-element Yagi',
    short: '2-el Yagi',
    category: 'directional',
    groundDependent: false,
    heightDependent: false,
    fixedGainDbi: 9.0,
    fbDb: 15,
    notes: 'Shortest monoband Yagi. Cheap forward gain, modest F/B.',
  },
  {
    id: 'yagi-3el',
    name: '3-element Yagi',
    short: '3-el Yagi',
    category: 'directional',
    groundDependent: false,
    heightDependent: false,
    fixedGainDbi: 11.0,
    fbDb: 20,
    notes: 'Workhorse DX antenna. Worth the tower.',
  },
  {
    id: 'yagi-4el',
    name: '4-element Yagi',
    short: '4-el Yagi',
    category: 'directional',
    groundDependent: false,
    heightDependent: false,
    fixedGainDbi: 12.5,
    fbDb: 22,
    notes: 'Diminishing returns vs. 3-el for the extra boom length.',
  },
  {
    id: 'yagi-5el',
    name: '5-element Yagi',
    short: '5-el Yagi',
    category: 'directional',
    groundDependent: false,
    heightDependent: false,
    fixedGainDbi: 13.5,
    fbDb: 25,
    notes: 'Contest/DX-station class. Big boom, big tower.',
  },
]

export const ANTENNA_BY_ID = Object.fromEntries(ANTENNA_TYPES.map(a => [a.id, a]))

// Wavelength of a freq in feet: c / f, with c ≈ 984 ft/MHz.
export const FT_PER_LAMBDA = (freqMhz) => 984 / freqMhz
