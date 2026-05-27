// Coax loss in dB per 100 ft (per 30.48 m) at common amateur frequencies.
// Values compiled from manufacturer datasheets (Times Microwave, Belden,
// Davis RF, CommScope/Andrew) and the ARRL Antenna Handbook. Where
// manufacturer datasheets don't publish at the exact ham-band point,
// values are interpolated in √f from the nearest published points or
// computed from the manufacturer's own attenuation formula. Treat as
// nominal — real-world cable varies with age, weather, and termination
// quality.

export const COAX_FREQS_MHZ = [1.8, 3.5, 7, 14, 21, 28, 50, 146, 222, 432]

// Ordered roughly by physical size / loss class, thin to thick.
export const COAX_TYPES = [
  {
    id: 'rg174',
    name: 'RG-174',
    blurb: '0.10" thin coax — handheld pigtails and QRP only',
    lossPer100ft: [2.0, 2.6, 2.8, 4.1, 5.1, 6.0, 8.4, 16.1, 21.0, 30.0],
  },
  {
    id: 'rg316',
    name: 'RG-316',
    blurb: '0.10" PTFE/FEP — high-temp upgrade over RG-174 for HT jumpers and rig pigtails',
    lossPer100ft: [1.44, 1.80, 2.34, 3.13, 3.75, 4.28, 5.60, 10.16, 12.71, 18.25],
  },
  {
    id: 'rg58',
    name: 'RG-58',
    blurb: '0.20" common patch cable — fine for short HF runs',
    lossPer100ft: [0.6, 0.9, 1.4, 2.1, 2.6, 3.1, 4.4, 7.5, 9.3, 13.0],
  },
  {
    id: 'rg8x',
    name: 'RG-8X / Mini-8',
    blurb: '0.24" — popular portable cable, decent through HF',
    lossPer100ft: [0.5, 0.7, 1.0, 1.5, 1.9, 2.2, 3.0, 5.8, 7.2, 11.0],
  },
  {
    id: 'lmr240',
    name: 'LMR-240',
    blurb: '0.24" low-loss flexible — SOTA/POTA standard, half the weight of LMR-400',
    lossPer100ft: [0.33, 0.45, 0.64, 0.91, 1.12, 1.29, 1.73, 2.97, 3.68, 5.17],
  },
  {
    id: 'rg213',
    name: 'RG-213',
    blurb: '0.40" — the classic base-station HF cable',
    lossPer100ft: [0.3, 0.4, 0.6, 1.0, 1.3, 1.5, 2.0, 3.5, 4.5, 6.6],
  },
  {
    id: 'buryflex',
    name: 'Davis Bury-Flex',
    blurb: '0.405" foam-PE with direct-burial PE jacket — RG-213 replacement for outdoor runs',
    lossPer100ft: [0.37, 0.44, 0.53, 0.67, 0.78, 0.87, 1.10, 1.75, 2.10, 2.93],
  },
  {
    id: 'lmr400',
    name: 'LMR-400',
    blurb: '0.40" low-loss — good for VHF/UHF and long HF runs',
    lossPer100ft: [0.18, 0.27, 0.39, 0.55, 0.69, 0.81, 1.1, 1.8, 2.3, 3.4],
  },
  {
    id: 'lmr600',
    name: 'LMR-600',
    blurb: '0.59" low-loss — for long VHF/UHF runs where LMR-400 still loses too much',
    lossPer100ft: [0.10, 0.14, 0.20, 0.29, 0.35, 0.41, 0.55, 0.95, 1.18, 1.68],
  },
  {
    id: 'ldf4',
    name: '½" Heliax (LDF4-50A)',
    blurb: 'Foam-dielectric hardline — overkill for HF, ideal for VHF/UHF tower runs',
    lossPer100ft: [0.10, 0.14, 0.20, 0.29, 0.36, 0.42, 0.58, 1.0, 1.3, 1.85],
  },
  {
    id: 'ldf5',
    name: '7/8" Heliax (LDF5-50A)',
    blurb: 'Bigger foam-dielectric hardline — tall towers and high-power VHF/UHF',
    lossPer100ft: [0.05, 0.07, 0.09, 0.13, 0.16, 0.19, 0.25, 0.44, 0.55, 0.79],
  },
]

export const COAX_BY_ID = Object.fromEntries(COAX_TYPES.map(c => [c.id, c]))

// Quick-pick frequencies that map to ham bands for the UI dropdown.
export const BAND_PRESETS = [
  { label: '160 m (1.8 MHz)', mhz: 1.8 },
  { label: '80 m (3.5 MHz)', mhz: 3.5 },
  { label: '40 m (7 MHz)', mhz: 7 },
  { label: '20 m (14 MHz)', mhz: 14 },
  { label: '15 m (21 MHz)', mhz: 21 },
  { label: '10 m (28 MHz)', mhz: 28 },
  { label: '6 m (50 MHz)', mhz: 50 },
  { label: '2 m (146 MHz)', mhz: 146 },
  { label: '1.25 m (222 MHz)', mhz: 222 },
  { label: '70 cm (432 MHz)', mhz: 432 },
]
