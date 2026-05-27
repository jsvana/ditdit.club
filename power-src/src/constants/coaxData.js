// Coax loss in dB per 100 ft (per 30.48 m) at common amateur frequencies.
// Values compiled from manufacturer datasheets (Times Microwave, Belden,
// CommScope/Andrew) and the ARRL Antenna Handbook. Treat as nominal —
// real-world cable varies with age, weather, and termination quality.

export const COAX_FREQS_MHZ = [1.8, 3.5, 7, 14, 21, 28, 50, 146, 222, 432]

export const COAX_TYPES = [
  {
    id: 'rg174',
    name: 'RG-174',
    blurb: '0.10" thin coax — handheld pigtails and QRP only',
    lossPer100ft: [2.0, 2.6, 2.8, 4.1, 5.1, 6.0, 8.4, 16.1, 21.0, 30.0],
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
    id: 'rg213',
    name: 'RG-213',
    blurb: '0.40" — the classic base-station HF cable',
    lossPer100ft: [0.3, 0.4, 0.6, 1.0, 1.3, 1.5, 2.0, 3.5, 4.5, 6.6],
  },
  {
    id: 'lmr400',
    name: 'LMR-400',
    blurb: '0.40" low-loss — good for VHF/UHF and long HF runs',
    lossPer100ft: [0.18, 0.27, 0.39, 0.55, 0.69, 0.81, 1.1, 1.8, 2.3, 3.4],
  },
  {
    id: 'ldf4',
    name: '½" Heliax (LDF4-50A)',
    blurb: 'Foam-dielectric hardline — overkill for HF, ideal for VHF/UHF tower runs',
    lossPer100ft: [0.10, 0.14, 0.20, 0.29, 0.36, 0.42, 0.58, 1.0, 1.3, 1.85],
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
