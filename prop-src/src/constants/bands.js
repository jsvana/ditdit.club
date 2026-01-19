// BAND CONFIGURATION
// Skip zones represent the "dead zone" where ground wave fades but skywave hasn't landed yet.
// NVIS (Near Vertical Incidence Skywave) uses high takeoff angles to fill in 0-500km on lower bands.
export const BANDS = [
  { name: '160m', min: 1800, max: 2000, color: '#ef4444', skipZone: { min: 80, max: 600 }, nvisCapable: true },
  { name: '80m', min: 3500, max: 4000, color: '#f97316', skipZone: { min: 50, max: 400 }, nvisCapable: true },
  { name: '40m', min: 7000, max: 7300, color: '#eab308', skipZone: { min: 150, max: 800 }, nvisCapable: true },
  { name: '30m', min: 10100, max: 10150, color: '#84cc16', skipZone: { min: 250, max: 1000 }, nvisCapable: false },
  { name: '20m', min: 14000, max: 14350, color: '#22c55e', skipZone: { min: 400, max: 1500 }, nvisCapable: false },
  { name: '17m', min: 18068, max: 18168, color: '#14b8a6', skipZone: { min: 500, max: 1800 }, nvisCapable: false },
  { name: '15m', min: 21000, max: 21450, color: '#06b6d4', skipZone: { min: 600, max: 2000 }, nvisCapable: false },
  { name: '12m', min: 24890, max: 24990, color: '#3b82f6', skipZone: { min: 800, max: 2300 }, nvisCapable: false },
  { name: '10m', min: 28000, max: 29700, color: '#8b5cf6', skipZone: { min: 1000, max: 2500 }, nvisCapable: false },
];

export const getBandFromFreq = (freq) => BANDS.find(b => freq >= b.min && freq <= b.max) || null;
