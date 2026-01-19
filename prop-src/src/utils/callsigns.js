import { getCachedHamDbGrid } from '../api/hamdb.js';

const prefixToGrid = {
  'W1': 'FN31', 'K1': 'FN31', 'N1': 'FN31', 'AA1': 'FN31', 'AB1': 'FN31', 'KC1': 'FN31',
  'W2': 'FN20', 'K2': 'FN20', 'N2': 'FN20', 'AA2': 'FN20', 'AB2': 'FN20',
  'W3': 'FM19', 'K3': 'FM19', 'N3': 'FM19', 'AA3': 'FM19',
  'W4': 'EM73', 'K4': 'EM73', 'N4': 'EM73', 'AA4': 'EM73', 'KN4': 'EM73', 'KO4': 'EM73',
  'W5': 'EM12', 'K5': 'EM12', 'N5': 'EM12', 'AA5': 'EM12', 'AG5': 'EM12', 'KI5': 'EM12',
  'W6': 'CM87', 'K6': 'CM87', 'N6': 'CM87', 'AA6': 'CM87', 'AC6': 'CM87', 'KE6': 'CM87', 'KN6': 'CM87',
  'W7': 'DN31', 'K7': 'DN31', 'N7': 'DN31', 'AA7': 'DN31', 'KG7': 'DN31', 'KJ7': 'DN31',
  'W8': 'EN81', 'K8': 'EN81', 'N8': 'EN81', 'AA8': 'EN81', 'AC8': 'EN81', 'KE8': 'EN81',
  'W9': 'EN52', 'K9': 'EN52', 'N9': 'EN52', 'AA9': 'EN52', 'KD9': 'EN52',
  'W0': 'DN70', 'K0': 'DN70', 'N0': 'DN70', 'AA0': 'DN70', 'KC0': 'DN70', 'KE0': 'DN70', 'AE0': 'DN70',
  'VE1': 'FN74', 'VE2': 'FN35', 'VE3': 'FN03', 'VE4': 'EN19', 'VE5': 'DO51', 'VE6': 'DO33', 'VE7': 'CN89', 'VA': 'FN03',
  'G': 'IO91', 'M': 'IO91', '2E': 'IO91',
  'DL': 'JO51', 'DJ': 'JO51', 'DK': 'JO51', 'DF': 'JO51', 'DG': 'JO51', 'DO': 'JO51',
  'F': 'JN18', 'ON': 'JO20', 'PA': 'JO22', 'PD': 'JO22',
  'EA': 'IN80', 'I': 'JN62', 'IK': 'JN62', 'IZ': 'JN62',
  'JA': 'PM95', 'JH': 'PM95', 'JR': 'PM95', 'JE': 'PM95', 'JG': 'PM95', 'JI': 'PM95',
  'VK': 'QF22', 'VK2': 'QF56', 'VK3': 'QF22', 'VK4': 'QG62',
  'ZL': 'RF72', 'ZL1': 'RF72', 'ZL2': 'RE78',
  'LU': 'GF05', 'PY': 'GG87', 'CE': 'FF46',
  'SP': 'KO02', 'OK': 'JO70', 'OM': 'JN88', 'HA': 'JN97', 'YO': 'KN34',
  'SM': 'JO89', 'LA': 'JO59', 'OH': 'KP20', 'OZ': 'JO55',
  'KH6': 'BL10', 'KH': 'BL10', 'KP4': 'FK68', 'UA': 'KO85', 'RU': 'KO85', 'R': 'KO85',
  'BY': 'OM89', 'BV': 'PL05', 'HL': 'PM37', 'DS': 'PM37', 'YB': 'OI33', 'ZS': 'KG33',
};

export const getGridFromCall = (call) => {
  if (!call) return null;
  const c = call.toUpperCase().replace(/[\/\-].*/g, '');

  // Check HamDB cache first (more accurate)
  const cachedGrid = getCachedHamDbGrid(c);
  if (cachedGrid) return cachedGrid;

  // Fall back to prefix-based lookup
  for (let len = 3; len >= 1; len--) if (prefixToGrid[c.substring(0, len)]) return prefixToGrid[c.substring(0, len)];
  return prefixToGrid[c[0]] || null;
};

export const getRegionFromCall = (call) => {
  if (!call) return 'Unknown';
  const c = call.toUpperCase();
  const regions = { 'W': 'USA', 'K': 'USA', 'N': 'USA', 'AA': 'USA', 'VE': 'Canada', 'VA': 'Canada', 'G': 'UK', 'M': 'UK', 'DL': 'Germany', 'DJ': 'Germany', 'DK': 'Germany', 'F': 'France', 'EA': 'Spain', 'I': 'Italy', 'JA': 'Japan', 'JH': 'Japan', 'VK': 'Australia', 'ZL': 'NZ', 'SP': 'Poland', 'SM': 'Sweden', 'LA': 'Norway', 'OH': 'Finland' };
  for (let len = 3; len >= 1; len--) if (regions[c.substring(0, len)]) return regions[c.substring(0, len)];
  return c.substring(0, 2);
};
