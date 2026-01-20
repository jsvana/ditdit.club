// Solar data from hamqsl.com
// Reference: https://www.arrl.org/files/file/Technology/tis/info/pdf/0209038.pdf

const SOLAR_API_URL = 'https://www.hamqsl.com/solarxml.php';
const CORS_PROXY = 'https://corsproxy.io/?';

// Map API band ranges to our band names
const BAND_RANGE_MAP = {
  '80m': '80m-40m',
  '40m': '80m-40m',
  '30m': '30m-20m',
  '20m': '30m-20m',
  '17m': '17m-15m',
  '15m': '17m-15m',
  '12m': '12m-10m',
  '10m': '12m-10m',
};

export function getBandCondition(solarData, bandName, isDaytime) {
  if (!solarData?.bandConditions) return null;
  const rangeKey = BAND_RANGE_MAP[bandName];
  if (!rangeKey) return null;
  const conditions = isDaytime ? solarData.bandConditions.day : solarData.bandConditions.night;
  return conditions?.[rangeKey] || null;
}

export async function fetchSolarData() {
  try {
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(SOLAR_API_URL)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    return parseSolarXml(text);
  } catch (error) {
    console.error('Failed to fetch solar data:', error);
    return { error: error.message };
  }
}

function parseSolarXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const getText = (tag) => doc.querySelector(tag)?.textContent || '';
  const getNumber = (tag) => {
    const val = getText(tag);
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  // Parse band conditions
  const bandConditions = { day: {}, night: {} };

  // The API structure has <calculatedconditions> with band entries
  // Each band has: <band name="80m-40m" time="day">Poor</band>
  doc.querySelectorAll('band').forEach(band => {
    const name = band.getAttribute('name');
    const time = band.getAttribute('time');
    const condition = band.textContent;
    if (name && time && condition) {
      if (time === 'day') {
        bandConditions.day[name] = condition;
      } else if (time === 'night') {
        bandConditions.night[name] = condition;
      }
    }
  });

  return {
    solarFlux: getNumber('solarflux'),
    aIndex: getNumber('aindex'),
    kIndex: getNumber('kindex'),
    sunspots: getNumber('sunspots'),
    xray: getText('xray'),
    geomagField: getText('geomagfield'),
    solarWind: getNumber('solarwind'),
    magneticField: getNumber('magneticfield'),
    signalNoise: getText('signalnoise'),
    protonFlux: getNumber('protonflux'),
    electronFlux: getNumber('electronflux'),
    aurora: getNumber('aurora'),
    bandConditions,
    updated: getText('updated'),
    error: null,
  };
}
