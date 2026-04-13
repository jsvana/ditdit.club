import React, { useState, useCallback, useMemo, useRef } from 'react';
import { parseAdif } from './parser.js';
import { validateAdif, generateSummary, SEV } from './validator.js';
import { FIELD_DEFS, KNOWN_APP_PROGRAMS, BANDS } from './adifData.js';

// ─── Color palette matching ditdit.club ───
const C = {
  bg: '#FAF8F5', cream: '#FAF8F5', black: '#1a1a1a',
  pink: '#E87A9F', pinkDark: '#D4587D',
  gray: '#6B6B6B', grayLight: '#E8E6E3', grayLighter: '#F2F0ED',
  white: '#FFFFFF',
  red: '#D94452', redBg: '#FDF0F0',
  orange: '#C67D2A', orangeBg: '#FEF7EC',
  blue: '#3B82C4', blueBg: '#EEF4FB',
  green: '#2E8B57', greenBg: '#EEFAF3',
};

const font = "'Space Grotesk', sans-serif";
const mono = "'IBM Plex Mono', 'JetBrains Mono', monospace";

// ─── Styles ───
const styles = {
  app: {
    fontFamily: font, background: C.bg, color: C.black,
    minHeight: '100vh', lineHeight: 1.5,
  },
  container: { maxWidth: 1100, margin: '0 auto', padding: '1.5rem' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 0 1.5rem', borderBottom: `2px solid ${C.black}`,
    marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem',
  },
  title: {
    fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(1.4rem, 4vw, 2rem)',
    fontWeight: 900, letterSpacing: '-0.02em',
  },
  titleAccent: { color: C.pinkDark },
  homeLink: {
    fontFamily: mono, fontSize: '0.85rem', color: C.gray,
    textDecoration: 'none', border: `1px solid ${C.grayLight}`,
    padding: '0.35rem 0.75rem', borderRadius: 4,
  },
  dropZone: {
    border: `2px dashed ${C.grayLight}`, borderRadius: 8,
    padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dropZoneActive: {
    borderColor: C.pink, background: '#fdf2f6',
  },
  dropZoneLoaded: {
    borderColor: C.green, borderStyle: 'solid', background: C.greenBg,
    padding: '1rem 2rem',
  },
  dropLabel: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' },
  dropSub: { fontSize: '0.85rem', color: C.gray },
  section: { marginTop: '1.5rem' },
  sectionTitle: {
    fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem',
    borderBottom: `1px solid ${C.grayLight}`, paddingBottom: '0.4rem',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  card: {
    background: C.white, border: `1px solid ${C.grayLight}`,
    borderRadius: 6, padding: '1rem', marginBottom: '0.75rem',
  },
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  stat: {
    background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6,
    padding: '0.75rem', textAlign: 'center',
  },
  statValue: { fontSize: '1.5rem', fontWeight: 700, fontFamily: mono },
  statLabel: { fontSize: '0.75rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' },
  badge: {
    display: 'inline-block', fontSize: '0.7rem', fontWeight: 600,
    padding: '0.15rem 0.5rem', borderRadius: 10, fontFamily: mono,
  },
  filterBar: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem',
  },
  filterBtn: {
    border: `1px solid ${C.grayLight}`, background: C.white, borderRadius: 4,
    padding: '0.3rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer',
    fontFamily: font, fontWeight: 500, transition: 'all 0.15s',
  },
  filterBtnActive: { background: C.black, color: C.white, borderColor: C.black },
  issue: {
    display: 'flex', gap: '0.6rem', padding: '0.5rem 0.7rem',
    borderRadius: 4, marginBottom: '0.35rem', fontSize: '0.85rem',
    alignItems: 'flex-start', fontFamily: mono,
  },
  issueSev: { fontWeight: 700, flexShrink: 0, fontSize: '0.7rem', marginTop: '0.15rem' },
  issueField: { fontWeight: 600 },
  issueMsg: { flex: 1 },
  issueRec: { color: C.gray, flexShrink: 0, fontSize: '0.75rem' },
  recordCard: {
    background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6,
    marginBottom: '0.5rem', overflow: 'hidden',
  },
  recordHeader: {
    padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 600, fontSize: '0.9rem', userSelect: 'none',
  },
  recordHeaderHover: { background: C.grayLighter },
  fieldTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: mono,
  },
  th: {
    textAlign: 'left', padding: '0.4rem 0.8rem', borderBottom: `1px solid ${C.grayLight}`,
    fontFamily: font, fontWeight: 600, fontSize: '0.75rem', color: C.gray,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: {
    padding: '0.35rem 0.8rem', borderBottom: `1px solid ${C.grayLighter}`,
    verticalAlign: 'top',
  },
  extSection: {
    background: C.blueBg, border: `1px solid ${C.blue}33`, borderRadius: 6,
    padding: '1rem', marginBottom: '0.75rem',
  },
  headerField: {
    display: 'flex', gap: '0.75rem', padding: '0.3rem 0', fontSize: '0.85rem',
    fontFamily: mono,
  },
  headerFieldName: { fontWeight: 600, minWidth: 160, color: C.gray },
  tabs: {
    display: 'flex', gap: 0, borderBottom: `2px solid ${C.grayLight}`,
    marginBottom: '1rem', overflow: 'auto',
  },
  tab: {
    padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.9rem',
    fontWeight: 600, fontFamily: font, border: 'none', background: 'none',
    borderBottom: '2px solid transparent', marginBottom: -2,
    color: C.gray, transition: 'all 0.15s', whiteSpace: 'nowrap',
  },
  tabActive: { color: C.black, borderBottomColor: C.pinkDark },
};

const sevColors = {
  [SEV.ERROR]:   { bg: C.redBg, color: C.red, label: 'ERR' },
  [SEV.WARNING]: { bg: C.orangeBg, color: C.orange, label: 'WARN' },
  [SEV.INFO]:    { bg: C.blueBg, color: C.blue, label: 'INFO' },
};

// ─── Timestamp utilities ───

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseQsoTimestamp(dateStr, timeStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  const y = parseInt(dateStr.substring(0, 4), 10);
  const m = parseInt(dateStr.substring(4, 6), 10) - 1;
  const d = parseInt(dateStr.substring(6, 8), 10);
  let h = 0, min = 0, s = 0;
  if (timeStr && (timeStr.length === 4 || timeStr.length === 6)) {
    h = parseInt(timeStr.substring(0, 2), 10);
    min = parseInt(timeStr.substring(2, 4), 10);
    if (timeStr.length === 6) s = parseInt(timeStr.substring(4, 6), 10);
  }
  const date = new Date(Date.UTC(y, m, d, h, min, s));
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatQsoDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const y = dateStr.substring(0, 4);
  const m = parseInt(dateStr.substring(4, 6), 10);
  const d = parseInt(dateStr.substring(6, 8), 10);
  if (m < 1 || m > 12) return dateStr;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

function formatQsoTime(timeStr) {
  if (!timeStr) return '';
  if (timeStr.length === 4) return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}z`;
  if (timeStr.length === 6) return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}z`;
  return timeStr;
}

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'in the future';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30.44);
  const years = Math.floor(days / 365.25);

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (months < 12) return `${months}mo ago`;
  if (years === 1 && months < 18) return '1y ago';
  return `${years}y ago`;
}

function timeAgoLong(date) {
  if (!date) return '';
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'in the future';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30.44);
  const years = Math.floor(days / 365.25);

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const remMonths = months - years * 12;
  if (years === 1 && remMonths === 0) return '1 year ago';
  if (years === 1) return `1 year, ${remMonths} month${remMonths !== 1 ? 's' : ''} ago`;
  if (remMonths === 0) return `${years} years ago`;
  return `${years} years, ${remMonths} month${remMonths !== 1 ? 's' : ''} ago`;
}

// ─── Type label mapping ───

const TYPE_LABELS = {
  S: { label: 'String', color: C.gray },
  D: { label: 'Date', color: '#7C5CBF' },
  T: { label: 'Time', color: '#7C5CBF' },
  N: { label: 'Number', color: '#2E8B57' },
  B: { label: 'Boolean', color: '#C67D2A' },
  E: { label: 'Enum', color: '#3B82C4' },
  L: { label: 'Location', color: '#C44B3B' },
  G: { label: 'Grid', color: '#C44B3B' },
  M: { label: 'Multiline', color: C.gray },
  I: { label: 'Intl String', color: C.gray },
  IM: { label: 'Intl Multiline', color: C.gray },
  P: { label: 'Positive Int', color: '#2E8B57' },
  Int: { label: 'Integer', color: '#2E8B57' },
  IOTA: { label: 'IOTA Ref', color: '#C44B3B' },
  SOTA: { label: 'SOTA Ref', color: '#C44B3B' },
  POTALIST: { label: 'POTA Refs', color: '#C44B3B' },
  WWFF: { label: 'WWFF Ref', color: '#C44B3B' },
};

// ─── Auto-linking ───

const CALLSIGN_FIELDS = new Set([
  'CALL', 'STATION_CALLSIGN', 'OPERATOR', 'OWNER_CALLSIGN',
  'EQ_CALL', 'GUEST_OP', 'CONTACTED_OP',
]);
const POTA_FIELDS = new Set(['POTA_REF', 'MY_POTA_REF']);
const SOTA_FIELDS = new Set(['SOTA_REF', 'MY_SOTA_REF']);
const WWFF_FIELDS = new Set(['WWFF_REF', 'MY_WWFF_REF']);

const extLinkStyle = { color: C.blue, textDecoration: 'none', borderBottom: `1px dotted ${C.blue}55` };

function PotaLinks({ value }) {
  const refs = value.split(',');
  return refs.map((ref, i) => {
    const trimmed = ref.trim();
    if (!trimmed) return null;
    return (
      <React.Fragment key={i}>
        {i > 0 && ', '}
        <a href={`https://pota.app/#/park/${encodeURIComponent(trimmed)}`}
          target="_blank" rel="noopener noreferrer" style={extLinkStyle}>{trimmed}</a>
      </React.Fragment>
    );
  });
}

function FieldValue({ field, record }) {
  const value = field.value;
  if (!value) return <em style={{ color: C.gray }}>(empty)</em>;

  // Callsign → QRZ
  if (CALLSIGN_FIELDS.has(field.name)) {
    return (
      <a href={`https://www.qrz.com/db/${encodeURIComponent(value)}`}
        target="_blank" rel="noopener noreferrer" style={extLinkStyle}>{value}</a>
    );
  }

  // POTA refs → pota.app
  if (POTA_FIELDS.has(field.name)) return <PotaLinks value={value} />;

  // SIG_INFO / MY_SIG_INFO → POTA if SIG/MY_SIG is POTA
  if (field.name === 'SIG_INFO' || field.name === 'MY_SIG_INFO') {
    const sigField = field.name === 'SIG_INFO' ? 'SIG' : 'MY_SIG';
    const sigValue = record?.fields.find(f => f.name === sigField)?.value;
    if (sigValue?.toUpperCase() === 'POTA') return <PotaLinks value={value} />;
  }

  // SOTA refs → sotadata
  if (SOTA_FIELDS.has(field.name)) {
    return (
      <a href={`https://www.sotadata.org.uk/en/summit/${encodeURIComponent(value)}`}
        target="_blank" rel="noopener noreferrer" style={extLinkStyle}>{value}</a>
    );
  }

  // WWFF refs → wwff.co
  if (WWFF_FIELDS.has(field.name)) {
    return (
      <a href={`https://wwff.co/directory/?showRef=${encodeURIComponent(value)}`}
        target="_blank" rel="noopener noreferrer" style={extLinkStyle}>{value}</a>
    );
  }

  return <>{value}</>;
}

// ─── Grid map ───

function gridToCenter(grid) {
  const upper = grid.toUpperCase();
  if (upper.length < 2) return null;

  let lon = (upper.charCodeAt(0) - 65) * 20 - 180;
  let lat = (upper.charCodeAt(1) - 65) * 10 - 90;

  if (upper.length >= 4) {
    const d2 = parseInt(upper[2], 10);
    const d3 = parseInt(upper[3], 10);
    if (isNaN(d2) || isNaN(d3)) return null;
    lon += d2 * 2;
    lat += d3 * 1;
  }

  if (upper.length >= 6) {
    const c4 = upper.charCodeAt(4) - 65;
    const c5 = upper.charCodeAt(5) - 65;
    if (c4 < 0 || c4 > 23 || c5 < 0 || c5 > 23) return null;
    lon += c4 * (2 / 24) + 1 / 24;
    lat += c5 * (1 / 24) + 1 / 48;
  } else if (upper.length >= 4) {
    lon += 1;
    lat += 0.5;
  } else {
    lon += 10;
    lat += 5;
  }

  return { lat, lon };
}

// Natural Earth 110m land outlines (public domain, naturalearthdata.com)
// Simplified with Douglas-Peucker, equirectangular lon,lat coordinates
const NE_LAND = `M-68,-54 -65,-55 -69,-55 -75,-53 -71,-54 -69,-53 -68,-54Z M145,-41 148,-41 148,-43 146,-44 145,-41Z M173,-41 174,-41 173,-44 169,-47 167,-46 173,-41Z M175,-36 177,-38 179,-38 175,-42 174,-40 175,-37 173,-35 175,-36Z M50,-14 50,-16 47,-25 44,-25 43,-22 44,-16 48,-15 49,-12 50,-14Z M144,-14 145,-15 146,-19 153,-26 153,-32 150,-37 146,-39 145,-38 144,-39 141,-38 138,-34 137,-35 138,-33 136,-35 134,-33 131,-31 118,-35 115,-34 116,-32 113,-26 114,-26 113,-24 114,-22 121,-20 126,-14 130,-15 132,-11 136,-12 136,-15 140,-18 142,-11 144,-14Z M109,-7 116,-8 108,-8 105,-7 106,-6 109,-7Z M152,-5 148,-6 151,-5 152,-4 152,-5Z M134,-1 135,-3 138,-2 145,-4 151,-11 148,-10 145,-8 143,-9 138,-8 139,-7 138,-5 133,-4 132,-3 134,-2 131,-1 134,-1Z M125,1 120,0 121,-1 123,-1 122,-2 123,-5 121,-5 121,-3 120,-6 119,-5 119,-3 120,1 125,1Z M106,-6 103,-4 95,5 97,5 104,0 103,-1 106,-3 106,-6Z M118,2 119,1 118,1 116,-4 110,-3 109,0 110,2 113,3 117,7 119,5 117,3 118,2Z M126,8 125,6 124,8 122,7 125,10 126,8Z M81,6 80,7 80,10 82,8 81,6Z M121,19 123,17 122,14 124,14 124,13 120,15 121,19Z M-73,20 -68,19 -74,18 -72,19 -73,20 -73,20Z M-80,23 -74,20 -78,20 -77,20 -79,22 -82,23 -85,22 -82,23 -80,23Z M121,23 121,22 120,24 121,25 121,23Z M141,37 140,35 136,33 135,35 131,34 132,33 130,31 129,33 139,38 140,41 142,40 141,37Z M144,44 145,44 146,43 140,42 142,46 144,44Z M-124,49 -128,51 -124,49Z M-56,51 -57,50 -53,49 -53,47 -54,48 -55,47 -59,48 -57,51 -56,52 -56,51Z M144,51 145,49 143,49 144,46 142,46 142,53 143,54 144,51Z M-7,52 -10,52 -10,54 -7,55 -6,55 -7,52Z M-3,59 -4,58 -2,58 -3,56 2,53 1,51 -5,50 -3,51 -5,52 -4,52 -5,53 -3,54 -6,57 -5,59 -3,59Z M-85,66 -80,64 -87,64 -85,66Z M-15,66 -14,65 -19,63 -23,64 -22,64 -24,65 -22,65 -24,66 -15,66Z M-175,67 -170,66 -173,65 -173,64 -179,66 -180,65 -180,69 -175,67Z M-91,69 -91,68 -89,69 -87,67 -86,70 -83,70 -81,69 -81,68 -86,67 -93,62 -95,59 -92,57 -82,55 -82,53 -80,51 -79,53 -80,55 -77,57 -79,59 -77,60 -78,62 -74,62 -70,61 -69,59 -68,58 -65,60 -62,56 -57,55 -56,52 -60,50 -66,50 -71,47 -65,49 -64,46 -62,46 -61,47 -60,46 -65,44 -66,44 -64,45 -67,45 -71,43 -70,42 -76,39 -76,37 -76,39 -76,36 -81,31 -80,25 -84,30 -94,30 -97,28 -98,22 -96,19 -94,18 -92,19 -90,21 -87,22 -89,16 -83,15 -84,11 -81,9 -80,10 -77,9 -75,11 -72,12 -72,9 -70,12 -68,11 -62,11 -62,10 -57,6 -51,4 -50,0 -45,-2 -45,-3 -40,-3 -36,-5 -35,-7 -39,-13 -41,-22 -48,-25 -49,-29 -54,-34 -58,-34 -57,-37 -59,-39 -62,-39 -63,-41 -65,-41 -63,-43 -67,-46 -66,-48 -69,-51 -68,-52 -71,-54 -75,-52 -76,-49 -74,-47 -76,-47 -73,-42 -74,-43 -74,-37 -71,-32 -70,-20 -71,-17 -76,-15 -81,-6 -80,-3 -81,-1 -77,4 -78,8 -80,9 -81,7 -86,10 -87,13 -104,18 -114,32 -115,32 -115,30 -109,23 -112,25 -115,28 -114,29 -117,33 -121,35 -124,40 -125,48 -123,47 -123,49 -127,51 -134,58 -147,61 -152,59 -151,61 -158,56 -165,54 -158,58 -157,59 -162,59 -162,60 -166,62 -165,63 -161,64 -161,65 -165,64 -168,66 -162,66 -167,68 -157,71 -137,69 -128,70 -109,67 -108,69 -106,69 -101,68 -98,69 -96,67 -94,69 -96,70 -95,72 -91,69Z M-114,73 -110,73 -108,72 -108,73 -107,73 -101,70 -116,69 -117,70 -112,70 -119,72 -114,73Z M-76,73 -81,73 -76,73Z M-87,73 -82,74 -81,72 -78,73 -72,72 -68,70 -67,69 -69,69 -62,67 -64,65 -68,66 -65,63 -69,64 -66,62 -75,65 -78,64 -78,65 -74,65 -73,68 -79,70 -89,70 -90,72 -88,74 -87,73Z M-100,74 -97,74 -98,73 -97,72 -102,73 -100,73 -102,73 -100,74Z M-93,73 -95,72 -96,73 -91,74 -93,73Z M-120,71 -126,72 -124,74 -125,74 -118,74 -116,73 -120,71Z M145,76 137,75 139,76 145,76Z M-98,77 -98,75 -103,76 -98,77Z M-108,76 -106,76 -106,75 -118,75 -115,76 -108,76Z M58,71 52,71 56,75 69,77 58,74 55,72 58,71Z M-95,77 -80,75 -92,75 -94,76 -97,77 -95,77Z M-116,78 -117,77 -123,76 -116,78Z M107,77 114,76 109,74 127,74 131,71 132,72 140,71 139,72 140,73 159,71 161,69 179,69 180,69 180,65 177,65 179,63 170,60 164,60 162,58 163,58 162,55 157,51 156,57 164,63 160,61 159,62 157,61 154,60 155,59 142,59 135,55 140,54 141,52 138,46 128,40 129,37 129,35 126,34 127,37 125,38 125,40 121,39 122,41 118,39 119,37 122,37 119,35 122,32 122,28 116,23 111,21 110,20 109,22 106,20 109,13 109,12 105,9 105,10 100,13 99,9 103,6 104,1 101,3 100,6 98,8 99,11 97,17 94,16 94,18 91,23 87,21 80,16 80,10 78,8 74,16 73,21 70,21 66,25 57,26 56,27 55,26 52,28 50,30 48,30 52,24 54,24 56,26 57,24 60,22 55,17 43,13 43,17 35,28 35,30 34,28 32,30 37,22 37,19 43,12 43,12 45,10 51,12 51,11 48,4 39,-5 41,-15 35,-20 36,-24 33,-26 32,-29 26,-34 18,-34 12,-18 14,-11 12,-5 9,-1 9,4 9,5 6,4 4,6 -2,5 -9,5 -17,12 -18,15 -16,18 -17,22 -6,36 -2,35 10,37 11,37 10,34 19,30 22,33 29,31 34,31 36,37 28,37 26,39 34,42 38,41 42,42 37,45 39,47 35,46 36,45 34,44 32,45 33,46 31,47 28,43 29,41 23,40 24,38 22,36 19,40 20,42 13,46 13,44 18,40 17,40 16,38 15,40 9,44 3,43 -2,37 -5,36 -9,37 -9,43 -1,44 -1,46 -5,49 -2,49 -2,50 1,50 5,53 8,54 9,57 11,58 10,55 11,54 20,54 21,55 22,57 24,57 23,59 29,60 21,61 22,63 25,65 22,66 18,63 17,61 19,60 16,56 13,55 10,59 6,59 5,62 15,68 25,71 28,71 31,70 30,70 31,70 40,68 41,67 40,66 33,67 37,64 37,65 40,65 42,66 44,66 43,69 46,68 46,67 54,69 60,68 61,69 61,70 69,68 69,69 67,69 67,71 69,73 73,73 72,71 74,68 71,66 72,66 75,68 73,71 75,73 76,71 76,72 78,72 82,72 81,74 87,74 86,74 87,75 104,78 107,77Z M-100,78 -105,78 -104,79 -105,79 -100,78Z M105,78 99,78 102,79 105,78Z M18,80 22,79 16,77 10,80 18,80Z M25,80 27,80 23,79 17,80 25,80Z M100,79 91,80 96,81 100,80 100,79Z M-87,80 -91,78 -97,80 -92,81 -87,80Z M-68,83 -62,82 -77,79 -75,79 -81,76 -89,76 -88,77 -88,78 -85,78 -88,78 -85,79 -87,80 -82,80 -92,82 -68,83Z M-27,84 -21,83 -31,82 -12,81 -20,80 -18,80 -20,79 -18,77 -22,77 -20,76 -21,75 -19,74 -24,73 -22,72 -25,72 -22,71 -26,71 -26,70 -22,70 -40,65 -43,63 -43,60 -48,61 -52,64 -54,67 -51,70 -55,70 -54,71 -51,71 -56,72 -55,73 -59,76 -69,76 -71,77 -67,77 -73,78 -66,79 -68,80 -63,82 -45,82 -47,83 -43,83 -27,84Z`;

// Reproject NE_LAND path from lon,lat space to SVG pixel space
function projectLandPath(pathStr, toX, toY) {
  return pathStr.replace(/([-\d.]+),([-\d.]+)/g, (_, lon, lat) =>
    `${toX(parseFloat(lon)).toFixed(1)},${toY(parseFloat(lat)).toFixed(1)}`
  );
}

// Compute great circle arc between two points as array of [lon,lat] pairs
function geodesicArc(lon1d, lat1d, lon2d, lat2d, numSegments) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const lat1 = toRad(lat1d), lon1 = toRad(lon1d);
  const lat2 = toRad(lat2d), lon2 = toRad(lon2d);

  // Central angle via haversine
  const dlat = lat2 - lat1, dlon = lon2 - lon1;
  const a = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon/2)**2;
  const d = 2 * Math.asin(Math.sqrt(a));
  if (d < 1e-10) return [[lon1d, lat1d], [lon2d, lat2d]];

  const points = [];
  for (let i = 0; i <= numSegments; i++) {
    const f = i / numSegments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x*x + y*y)))]);
  }
  return points;
}

function GridMap({ grids, myGrid, qsoLinks }) {
  const points = useMemo(() => {
    const pts = [];
    for (const grid of grids) {
      const center = gridToCenter(grid);
      if (center) pts.push({ ...center, grid });
    }
    return pts;
  }, [grids]);

  const myPoint = useMemo(() => myGrid ? gridToCenter(myGrid) : null, [myGrid]);

  if (points.length === 0 && !myPoint) return null;

  const allPts = myPoint ? [...points, myPoint] : points;

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of allPts) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  // Padding
  const padLon = Math.max(10, (maxLon - minLon) * 0.15);
  const padLat = Math.max(5, (maxLat - minLat) * 0.15);
  minLon = Math.max(-180, minLon - padLon);
  maxLon = Math.min(180, maxLon + padLon);
  minLat = Math.max(-90, minLat - padLat);
  maxLat = Math.min(90, maxLat + padLat);

  // Minimum extent
  if (maxLon - minLon < 30) { const mid = (minLon + maxLon) / 2; minLon = mid - 15; maxLon = mid + 15; }
  if (maxLat - minLat < 15) { const mid = (minLat + maxLat) / 2; minLat = mid - 7.5; maxLat = mid + 7.5; }
  minLon = Math.max(-180, minLon); maxLon = Math.min(180, maxLon);
  minLat = Math.max(-90, minLat); maxLat = Math.min(90, maxLat);

  const width = 700;
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const height = Math.max(200, Math.min(500, Math.round(width * (latRange / lonRange))));

  const toX = lon => ((lon - minLon) / lonRange) * width;
  const toY = lat => ((maxLat - lat) / latRange) * height;

  // Maidenhead field grid lines
  const vLines = [];
  for (let lon = Math.ceil(minLon / 20) * 20; lon <= maxLon; lon += 20) {
    const idx = Math.floor((lon + 180) / 20);
    if (idx >= 0 && idx < 18) vLines.push({ x: toX(lon), label: String.fromCharCode(65 + idx) });
  }
  const hLines = [];
  for (let lat = Math.ceil(minLat / 10) * 10; lat <= maxLat; lat += 10) {
    const idx = Math.floor((lat + 90) / 10);
    if (idx >= 0 && idx < 18) hLines.push({ y: toY(lat), label: String.fromCharCode(65 + idx) });
  }

  // Square sub-grid lines (every 2° lon, 1° lat) - only if zoomed in enough
  const showSquares = lonRange < 80;
  const sqVLines = [], sqHLines = [];
  if (showSquares) {
    for (let lon = Math.ceil(minLon / 2) * 2; lon <= maxLon; lon += 2) sqVLines.push(toX(lon));
    for (let lat = Math.ceil(minLat); lat <= maxLat; lat += 1) sqHLines.push(toY(lat));
  }

  // Project Natural Earth land outlines
  const projectedLand = useMemo(
    () => projectLandPath(NE_LAND, toX, toY),
    [minLon, maxLon, minLat, maxLat, width, height]
  );

  // Compute geodesic arcs
  const geodesics = useMemo(() => {
    if (!qsoLinks || qsoLinks.length === 0) return [];
    const arcs = [];
    const seen = new Set();
    for (const link of qsoLinks) {
      const key = `${link.from}-${link.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fromPt = gridToCenter(link.from);
      const toPt = gridToCenter(link.to);
      if (!fromPt || !toPt) continue;
      const numSeg = Math.max(8, Math.ceil(Math.abs(fromPt.lon - toPt.lon) / 5));
      const pts = geodesicArc(fromPt.lon, fromPt.lat, toPt.lon, toPt.lat, numSeg);
      const d = pts.map(([lon, lat], i) =>
        `${i === 0 ? 'M' : 'L'}${toX(lon).toFixed(1)},${toY(lat).toFixed(1)}`
      ).join(' ');
      arcs.push(d);
    }
    return arcs;
  }, [qsoLinks, minLon, maxLon, minLat, maxLat, width, height]);

  return (
    <div style={{ ...styles.card, marginTop: '0.75rem', padding: '0.75rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>QSO Map</div>
      <svg viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', maxHeight: 450, borderRadius: 4, background: '#DBEAF4', display: 'block', overflow: 'hidden' }}>
        {/* Land masses - Natural Earth 110m public domain */}
        <path d={projectedLand} fill="#E8E6DF" stroke="#C8C4BA" strokeWidth={0.5} strokeLinejoin="round" />
        {/* Square sub-grid */}
        {sqVLines.map((x, i) => <line key={`sv${i}`} x1={x} y1={0} x2={x} y2={height} stroke="#C0D0DD" strokeWidth={0.3} />)}
        {sqHLines.map((y, i) => <line key={`sh${i}`} x1={0} y1={y} x2={width} y2={y} stroke="#C0D0DD" strokeWidth={0.3} />)}
        {/* Field grid lines */}
        {vLines.map((l, i) => <line key={`v${i}`} x1={l.x} y1={0} x2={l.x} y2={height} stroke="#A0B4C4" strokeWidth={0.7} />)}
        {hLines.map((l, i) => <line key={`h${i}`} x1={0} y1={l.y} x2={width} y2={l.y} stroke="#A0B4C4" strokeWidth={0.7} />)}
        {/* Field labels at intersections */}
        {vLines.map((vl, vi) =>
          hLines.map((hl, hi) => (
            <text key={`lbl-${vi}-${hi}`} x={vl.x + 3} y={hl.y - 3}
              fontSize={11} fill="#7090A8" fontFamily="'IBM Plex Mono', monospace" fontWeight={600}>
              {vl.label}{hl.label}
            </text>
          ))
        )}
        {/* Geodesic arcs */}
        {geodesics.map((d, i) => (
          <path key={`arc${i}`} d={d} fill="none" stroke={C.pinkDark} strokeWidth={1} opacity={0.35} />
        ))}
        {/* QSO dots */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(p.lon)} cy={toY(p.lat)} r={4}
            fill={C.pink} stroke="#fff" strokeWidth={1} opacity={0.85}>
            <title>{p.grid}</title>
          </circle>
        ))}
        {/* My location */}
        {myPoint && (
          <g>
            <circle cx={toX(myPoint.lon)} cy={toY(myPoint.lat)} r={7}
              fill="none" stroke={C.blue} strokeWidth={2} />
            <circle cx={toX(myPoint.lon)} cy={toY(myPoint.lat)} r={2.5}
              fill={C.blue} />
            <title>{myGrid}</title>
          </g>
        )}
      </svg>
      <div style={{ fontSize: '0.75rem', color: C.gray, marginTop: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.pink, marginRight: 4, verticalAlign: 'middle' }} />
          QSO locations ({points.length})
        </span>
        {myPoint && (
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.blue}`, marginRight: 4, verticalAlign: 'middle', boxSizing: 'border-box' }} />
            My location ({myGrid})
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Components ───

function Badge({ severity, count }) {
  const c = sevColors[severity];
  return (
    <span style={{ ...styles.badge, background: c.bg, color: c.color }}>
      {c.label}{count !== undefined ? ` ${count}` : ''}
    </span>
  );
}

function SummaryPanel({ summary }) {
  const fmtDate = d => d ? formatQsoDate(d) : '—';
  const bandList = Object.entries(summary.bands).sort((a,b) => {
    const aInfo = BANDS[a[0].toLowerCase()];
    const bInfo = BANDS[b[0].toLowerCase()];
    return (aInfo?.lower || 0) - (bInfo?.lower || 0);
  });

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Summary</div>
      <div style={styles.statGrid}>
        <div style={styles.stat}>
          <div style={styles.statValue}>{summary.totalRecords}</div>
          <div style={styles.statLabel}>QSO Records</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>{summary.callsigns.size}</div>
          <div style={styles.statLabel}>Unique Calls</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>{Object.keys(summary.bands).length}</div>
          <div style={styles.statLabel}>Bands</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>{Object.keys(summary.modes).length}</div>
          <div style={styles.statLabel}>Modes</div>
        </div>
      </div>
      <div style={{ ...styles.card, marginTop: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div>
            <strong>Date range:</strong> {fmtDate(summary.dateRange.earliest)}
            {summary.dateRange.earliest !== summary.dateRange.latest && ` to ${fmtDate(summary.dateRange.latest)}`}
            {summary.dateRange.latest && (() => {
              const latestTs = parseQsoTimestamp(summary.dateRange.latest, null);
              const ago = latestTs ? timeAgoLong(latestTs) : null;
              return ago ? <span style={{ color: C.pink, marginLeft: 6, fontSize: '0.82rem' }}>({ago})</span> : null;
            })()}
          </div>
          {summary.programId && (
            <div><strong>Program:</strong> {summary.programId}{summary.programVersion ? ` v${summary.programVersion}` : ''}</div>
          )}
          {summary.adifVersion && (
            <div><strong>ADIF version:</strong> {summary.adifVersion}</div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Bands:</strong>{' '}
            {bandList.map(([b, cnt]) => (
              <span key={b} style={{ ...styles.badge, background: C.grayLighter, color: C.black, marginRight: 4, marginBottom: 2 }}>
                {b} ({cnt})
              </span>
            ))}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Modes:</strong>{' '}
            {Object.entries(summary.modes).sort((a,b) => b[1]-a[1]).map(([m, cnt]) => (
              <span key={m} style={{ ...styles.badge, background: C.grayLighter, color: C.black, marginRight: 4, marginBottom: 2 }}>
                {m} ({cnt})
              </span>
            ))}
          </div>
        </div>
      </div>
      {summary.grids.size > 0 && (
        <GridMap grids={[...summary.grids]} myGrid={summary.myGrid} qsoLinks={summary.qsoLinks} />
      )}
    </div>
  );
}

function ValidationPanel({ issues }) {
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const i of issues) c[i.severity] = (c[i.severity] || 0) + 1;
    return c;
  }, [issues]);

  const categories = useMemo(() => {
    const cats = new Set();
    for (const i of issues) cats.add(i.category);
    return [...cats].sort();
  }, [issues]);

  const filtered = useMemo(() =>
    issues.filter(i =>
      (filter === 'all' || i.severity === filter) &&
      (catFilter === 'all' || i.category === catFilter)
    ),
    [issues, filter, catFilter]
  );

  if (issues.length === 0) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Validation Results</div>
        <div style={{ ...styles.card, background: C.greenBg, borderColor: `${C.green}33`, textAlign: 'center' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 600, color: C.green }}>
            No issues found
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>
        Validation Results
        <span style={{ fontWeight: 400, fontSize: '0.85rem', color: C.gray }}>({issues.length} total)</span>
      </div>

      <div style={styles.filterBar}>
        {[
          { key: 'all', label: `All (${issues.length})` },
          { key: 'error', label: `Errors (${counts.error})` },
          { key: 'warning', label: `Warnings (${counts.warning})` },
          { key: 'info', label: `Info (${counts.info})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ ...styles.filterBtn, ...(filter === f.key ? styles.filterBtnActive : {}) }}>
            {f.label}
          </button>
        ))}
        <span style={{ width: 1, background: C.grayLight, margin: '0 0.3rem' }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ ...styles.filterBtn, appearance: 'auto', paddingRight: '0.5rem' }}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ maxHeight: 500, overflowY: 'auto', border: `1px solid ${C.grayLight}`, borderRadius: 6 }}>
        {filtered.map((issue, idx) => {
          const sc = sevColors[issue.severity];
          return (
            <div key={idx} style={{ ...styles.issue, background: idx % 2 ? C.white : C.grayLighter }}>
              <span style={{ ...styles.issueSev, color: sc.color }}>{sc.label}</span>
              {issue.record && <span style={styles.issueRec}>R{issue.record}</span>}
              {issue.field && <span style={styles.issueField}>{issue.field}</span>}
              <span style={styles.issueMsg}>{issue.message}</span>
              <span style={{ ...styles.badge, background: `${sc.color}18`, color: sc.color, fontSize: '0.65rem' }}>
                {issue.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderView({ header }) {
  if (!header) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Header</div>
      <div style={styles.card}>
        {header.freeText && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: C.grayLighter, borderRadius: 4, fontSize: '0.82rem', fontFamily: mono, whiteSpace: 'pre-wrap' }}>
            {header.freeText}
          </div>
        )}
        {header.fields.map((f, i) => (
          <div key={i} style={styles.headerField}>
            <span style={styles.headerFieldName}>{f.name}</span>
            <span>{f.value || <em style={{ color: C.gray }}>(empty)</em>}</span>
          </div>
        ))}
        {header.userDefs.length > 0 && (
          <>
            <div style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              User-Defined Fields
            </div>
            {header.userDefs.map((ud, i) => (
              <div key={i} style={styles.headerField}>
                <span style={styles.headerFieldName}>USERDEF{ud.id}: {ud.fieldName}</span>
                <span>
                  {ud.typeIndicator && `Type: ${ud.typeIndicator}`}
                  {ud.enumValues && ` Values: {${ud.enumValues.join(', ')}}`}
                  {ud.range && ` Range: ${ud.range.min} - ${ud.range.max}`}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AppProgramCard({ progId, fieldNames }) {
  const progInfo = KNOWN_APP_PROGRAMS[progId];
  const fields = [...fieldNames].sort();
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ ...styles.card, marginBottom: '0.6rem', borderLeft: `3px solid ${C.blue}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: mono, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            APP_{progId}_*
            {progInfo && <span style={{ fontWeight: 500, fontFamily: font, fontSize: '0.85rem' }}>{progInfo.name}</span>}
          </div>
          {progInfo && progInfo.desc && (
            <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: '0.25rem', lineHeight: 1.4 }}>
              {progInfo.desc}
            </div>
          )}
          {progInfo && progInfo.url && (
            <a href={progInfo.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.78rem', color: C.blue, textDecoration: 'none', display: 'inline-block', marginTop: '0.2rem' }}>
              {progInfo.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} &#x2197;
            </a>
          )}
        </div>
        <span style={{ ...styles.badge, background: C.blueBg, color: C.blue }}>
          {fields.length} field{fields.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        <button onClick={() => setExpanded(!expanded)}
          style={{ ...styles.filterBtn, fontSize: '0.75rem', padding: '0.2rem 0.5rem', fontFamily: font }}>
          {expanded ? '\u25BC Hide fields' : '\u25B6 Show fields'}
        </button>
        {expanded && (
          <table style={{ ...styles.fieldTable, marginTop: '0.4rem' }}>
            <thead>
              <tr>
                <th style={{ ...styles.th, fontSize: '0.7rem' }}>Field</th>
                <th style={{ ...styles.th, fontSize: '0.7rem' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(f => {
                const fieldDesc = progInfo?.fields?.[f];
                return (
                  <tr key={f}>
                    <td style={{ ...styles.td, fontFamily: mono, fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      APP_{progId}_{f}
                    </td>
                    <td style={{ ...styles.td, fontSize: '0.8rem', color: fieldDesc ? C.black : C.gray }}>
                      {fieldDesc || 'Application-defined field'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ExtensionsPanel({ extensions, programInfo }) {
  const appPrograms = Object.keys(extensions.appFields);
  const hasExtensions = appPrograms.length > 0 || extensions.userDefFields.length > 0 || extensions.unknownFields.length > 0;

  if (!hasExtensions) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Extensions &amp; Non-Standard Fields</div>
        <div style={{ ...styles.card, textAlign: 'center', color: C.gray }}>
          No extensions, APP_* fields, or non-standard fields found in this file.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Extensions &amp; Non-Standard Fields</div>

      {appPrograms.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: C.gray, marginBottom: '0.75rem', lineHeight: 1.5 }}>
            Application-defined fields follow the <code style={{ fontFamily: mono, background: C.grayLighter, padding: '0.1rem 0.3rem', borderRadius: 3, fontSize: '0.8rem' }}>
            APP_&#123;PROGRAMID&#125;_&#123;FIELDNAME&#125;</code> convention.
            Programs register their PROGRAMID with the{' '}
            <a href="https://adif.org/315/ADIF_315.htm#Application_defined_Fields" target="_blank" rel="noopener noreferrer"
              style={{ color: C.blue, textDecoration: 'none' }}>
              ADIF spec &#x2197;
            </a>.
            These fields are preserved on import by well-behaved logging programs.
          </div>
          {appPrograms.map(prog => (
            <AppProgramCard key={prog} progId={prog} fieldNames={extensions.appFields[prog]} />
          ))}
        </div>
      )}

      {extensions.userDefFields.length > 0 && (
        <div style={{ ...styles.card, background: C.greenBg, borderColor: `${C.green}33`, borderLeft: `3px solid ${C.green}`, marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.9rem' }}>User-Defined Fields (USERDEF)</div>
          <div style={{ fontSize: '0.82rem', color: C.gray, marginBottom: '0.5rem', lineHeight: 1.5 }}>
            Defined in the file header via <code style={{ fontFamily: mono, background: `${C.green}15`, padding: '0.1rem 0.3rem', borderRadius: 3, fontSize: '0.8rem' }}>
            USERDEFn</code> tags.
            These are custom fields created by the logging operator, with optional type, enumeration, or range constraints.
            See the{' '}
            <a href="https://adif.org/315/ADIF_315.htm#User_defined_Fields" target="_blank" rel="noopener noreferrer"
              style={{ color: C.blue, textDecoration: 'none' }}>
              ADIF spec &#x2197;
            </a>.
          </div>
          <div style={{ fontSize: '0.85rem', fontFamily: mono }}>
            {extensions.userDefFields.join(', ')}
          </div>
        </div>
      )}

      {extensions.unknownFields.length > 0 && (
        <div style={{ ...styles.card, background: C.orangeBg, borderColor: `${C.orange}33`, borderLeft: `3px solid ${C.orange}`, marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.9rem' }}>Unknown Fields</div>
          <div style={{ fontSize: '0.82rem', color: C.gray, marginBottom: '0.5rem', lineHeight: 1.5 }}>
            These field names are not in the{' '}
            <a href="https://adif.org/315/ADIF_315.htm#QSO_Fields" target="_blank" rel="noopener noreferrer"
              style={{ color: C.blue, textDecoration: 'none' }}>
              ADIF 3.1.5 specification &#x2197;
            </a>,
            and do not follow the <code style={{ fontFamily: mono, background: `${C.orange}15`, padding: '0.1rem 0.3rem', borderRadius: 3, fontSize: '0.8rem' }}>APP_*</code> or{' '}
            <code style={{ fontFamily: mono, background: `${C.orange}15`, padding: '0.1rem 0.3rem', borderRadius: 3, fontSize: '0.8rem' }}>USERDEF</code> convention.
            They may be from an older ADIF version, a non-compliant program, or a typo.
          </div>
          <div style={{ fontSize: '0.85rem', fontFamily: mono }}>
            {extensions.unknownFields.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordRow({ field, recordIssues, record }) {
  const fieldIssues = recordIssues.filter(i => i.field === field.name);
  const hasError = fieldIssues.some(i => i.severity === SEV.ERROR);
  const hasWarning = fieldIssues.some(i => i.severity === SEV.WARNING);
  const def = FIELD_DEFS[field.name];
  const bgColor = hasError ? C.redBg : hasWarning ? C.orangeBg : 'transparent';

  // Compute human-readable annotation for date/time fields
  let annotation = null;
  if (field.value) {
    const isDateField = ['QSO_DATE', 'QSO_DATE_OFF', 'QSLRDATE', 'QSLSDATE',
      'LOTW_QSLRDATE', 'LOTW_QSLSDATE', 'EQSL_QSLRDATE', 'EQSL_QSLSDATE',
      'CLUBLOG_QSO_UPLOAD_DATE', 'QRZCOM_QSO_UPLOAD_DATE',
      'HRDLOG_QSO_UPLOAD_DATE', 'HAMLOGEU_QSO_UPLOAD_DATE',
      'HAMQTH_QSO_UPLOAD_DATE', 'DCL_QSLRDATE', 'DCL_QSLSDATE'].includes(field.name);
    const isTimeField = ['TIME_ON', 'TIME_OFF'].includes(field.name);

    if (isDateField) {
      const formatted = formatQsoDate(field.value);
      // For QSO_DATE, also try to include TIME_ON for the time-ago calc
      let ts = null;
      if (field.name === 'QSO_DATE' && record) {
        const timeOn = record.fields.find(f => f.name === 'TIME_ON');
        ts = parseQsoTimestamp(field.value, timeOn?.value);
      } else {
        ts = parseQsoTimestamp(field.value, null);
      }
      const ago = ts ? timeAgoLong(ts) : null;
      if (formatted !== field.value || ago) {
        annotation = `${formatted}${ago ? ` (${ago})` : ''}`;
      }
    } else if (isTimeField) {
      const formatted = formatQsoTime(field.value);
      if (formatted !== field.value) {
        annotation = formatted;
      }
    }
  }

  const typeCode = field.typeIndicator || (def ? def.type : '');
  const typeInfo = TYPE_LABELS[typeCode];

  return (
    <tr style={{ background: bgColor }}>
      <td style={{ ...styles.td, fontWeight: 600 }}>{field.name}</td>
      <td style={{ ...styles.td, overflowWrap: 'break-word' }}>
        <FieldValue field={field} record={record} />
        {annotation && (
          <span style={{ color: C.pink, marginLeft: 8, fontSize: '0.78rem', fontWeight: 400 }}>
            {annotation}
          </span>
        )}
        {field.lengthMismatch && (
          <span style={{ ...styles.badge, background: C.redBg, color: C.red, marginLeft: 6 }}>
            len:{field.declaredLength} actual:{field.actualLength}
          </span>
        )}
      </td>
      <td style={styles.td}>
        {typeInfo ? (
          <span style={{ ...styles.badge, background: `${typeInfo.color}15`, color: typeInfo.color }}>
            {typeInfo.label}
          </span>
        ) : typeCode ? (
          <span style={{ ...styles.badge, background: C.grayLighter, color: C.gray }}>{typeCode}</span>
        ) : null}
      </td>
      <td style={{ ...styles.td, fontSize: '0.78rem', color: C.gray }}>
        {def ? def.desc : field.name.startsWith('APP_') ? 'Application field' : ''}
      </td>
      <td style={{ ...styles.td, width: 40 }}>
        {fieldIssues.map((iss, j) => (
          <div key={j} title={iss.message}>
            <Badge severity={iss.severity} />
          </div>
        ))}
      </td>
    </tr>
  );
}

function RecordCard({ record, issues }) {
  const [open, setOpen] = useState(false);
  const recNum = record.index + 1;
  const recordIssues = issues.filter(i => i.record === recNum);
  const errCount = recordIssues.filter(i => i.severity === SEV.ERROR).length;
  const warnCount = recordIssues.filter(i => i.severity === SEV.WARNING).length;

  const callField = record.fields.find(f => f.name === 'CALL');
  const bandField = record.fields.find(f => f.name === 'BAND');
  const modeField = record.fields.find(f => f.name === 'MODE');
  const dateField = record.fields.find(f => f.name === 'QSO_DATE');
  const timeField = record.fields.find(f => f.name === 'TIME_ON');

  const qsoDate = parseQsoTimestamp(dateField?.value, timeField?.value);
  const datePart = dateField?.value ? formatQsoDate(dateField.value) : null;
  const timePart = timeField?.value ? formatQsoTime(timeField.value) : null;
  const dateDisplay = [datePart, timePart].filter(Boolean).join(' ');
  const ago = timeAgo(qsoDate);

  const preview = [
    callField?.value,
    bandField?.value,
    modeField?.value,
  ].filter(Boolean).join(' / ');

  return (
    <div style={styles.recordCard}>
      <div style={styles.recordHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span>{open ? '\u25BC' : '\u25B6'}</span>
          <span>Record {recNum}</span>
          <span style={{ color: C.gray, fontWeight: 400, fontSize: '0.82rem', fontFamily: mono }}>
            {preview}
            {dateDisplay && (
              <>
                {preview ? ' / ' : ''}{dateDisplay}
                {ago && <span style={{ color: C.pink, marginLeft: 6, fontSize: '0.75rem' }}>({ago})</span>}
              </>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {errCount > 0 && <Badge severity={SEV.ERROR} count={errCount} />}
          {warnCount > 0 && <Badge severity={SEV.WARNING} count={warnCount} />}
          <span style={{ ...styles.badge, background: C.grayLighter, color: C.gray }}>
            {record.fields.length} fields
          </span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 1rem 0.5rem', overflowX: 'auto' }}>
          {recordIssues.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              {recordIssues.map((iss, i) => {
                const sc = sevColors[iss.severity];
                return (
                  <div key={i} style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', background: sc.bg, borderRadius: 3, marginBottom: 2, fontFamily: mono }}>
                    <span style={{ fontWeight: 700, color: sc.color }}>{sc.label}</span>
                    {iss.field && <span style={{ fontWeight: 600 }}> {iss.field}:</span>}
                    {' '}{iss.message}
                  </div>
                );
              })}
            </div>
          )}
          <table style={styles.fieldTable}>
            <thead>
              <tr>
                <th style={styles.th}>Field</th>
                <th style={styles.th}>Value</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {record.fields.map((f, i) => (
                <RecordRow key={i} field={f} recordIssues={recordIssues} record={record} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordsPanel({ records, issues }) {
  const [page, setPage] = useState(0);
  const perPage = 50;
  const totalPages = Math.ceil(records.length / perPage);
  const pageRecords = records.slice(page * perPage, (page + 1) * perPage);

  // Filter controls
  const [search, setSearch] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);

  const filteredRecords = useMemo(() => {
    let recs = pageRecords;
    if (search) {
      const q = search.toUpperCase();
      recs = recs.filter(r => r.fields.some(f =>
        f.name.includes(q) || f.value.toUpperCase().includes(q)
      ));
    }
    if (onlyIssues) {
      recs = recs.filter(r => issues.some(i => i.record === r.index + 1));
    }
    return recs;
  }, [pageRecords, search, onlyIssues, issues]);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>
        Records
        <span style={{ fontWeight: 400, fontSize: '0.85rem', color: C.gray }}>({records.length} total)</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search fields or values..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '0.4rem 0.7rem', border: `1px solid ${C.grayLight}`,
            borderRadius: 4, fontFamily: font, fontSize: '0.85rem', background: C.white,
          }}
        />
        <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
          Only records with issues
        </label>
      </div>

      {filteredRecords.map(record => (
        <RecordCard key={record.index} record={record} issues={issues} />
      ))}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1rem', alignItems: 'center' }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            style={{ ...styles.filterBtn, ...(page === 0 ? { opacity: 0.4 } : {}) }}>&laquo;</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ ...styles.filterBtn, ...(page === 0 ? { opacity: 0.4 } : {}) }}>&lsaquo;</button>
          <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ ...styles.filterBtn, ...(page >= totalPages - 1 ? { opacity: 0.4 } : {}) }}>&rsaquo;</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
            style={{ ...styles.filterBtn, ...(page >= totalPages - 1 ? { opacity: 0.4 } : {}) }}>&raquo;</button>
        </div>
      )}
    </div>
  );
}

function ProgramChecksPanel({ programInfo }) {
  if (!programInfo.id) return null;
  const progEntry = KNOWN_APP_PROGRAMS[programInfo.id.toUpperCase()];
  return (
    <div style={{ ...styles.card, background: C.blueBg, borderColor: `${C.blue}33`, marginTop: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
        Generated by: {programInfo.id}
        {programInfo.version && ` v${programInfo.version}`}
        {progEntry && <span style={{ fontWeight: 400, color: C.gray }}> ({progEntry.name})</span>}
      </div>
      {progEntry && progEntry.desc && (
        <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: '0.25rem' }}>{progEntry.desc}</div>
      )}
      {progEntry && progEntry.url && (
        <a href={progEntry.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.78rem', color: C.blue, textDecoration: 'none', display: 'inline-block', marginTop: '0.2rem' }}>
          {progEntry.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} &#x2197;
        </a>
      )}
    </div>
  );
}

// ─── Main App ───

export default function App() {
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('validation');
  const fileRef = useRef();

  const processFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const p = parseAdif(text);
      const v = validateAdif(p);
      const s = generateSummary(p);
      setParsed(p);
      setValidation(v);
      setSummary(s);
      setActiveTab('validation');
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e) => {
    processFile(e.target.files?.[0]);
  }, [processFile]);

  const reset = useCallback(() => {
    setParsed(null);
    setValidation(null);
    setSummary(null);
    setFileName(null);
  }, []);

  const errCount = validation ? validation.issues.filter(i => i.severity === SEV.ERROR).length : 0;
  const warnCount = validation ? validation.issues.filter(i => i.severity === SEV.WARNING).length : 0;
  const infoCount = validation ? validation.issues.filter(i => i.severity === SEV.INFO).length : 0;

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>
            ADIF <span style={styles.titleAccent}>Validator</span>
          </div>
          <a href="/" style={styles.homeLink}>ditdit.club</a>
        </div>

        {/* File upload */}
        <div
          style={{
            ...styles.dropZone,
            ...(dragging ? styles.dropZoneActive : {}),
            ...(parsed ? styles.dropZoneLoaded : {}),
          }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !parsed && fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".adi,.adif,.ADI,.ADIF" onChange={onFileChange}
            style={{ display: 'none' }} />
          {parsed ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{fileName}</span>
                <span style={{ color: C.gray, marginLeft: 12, fontSize: '0.85rem' }}>
                  {parsed.records.length} records
                </span>
                <span style={{ marginLeft: 12 }}>
                  {errCount > 0 && <Badge severity={SEV.ERROR} count={errCount} />}
                  {' '}{warnCount > 0 && <Badge severity={SEV.WARNING} count={warnCount} />}
                  {' '}{infoCount > 0 && <Badge severity={SEV.INFO} count={infoCount} />}
                  {errCount === 0 && warnCount === 0 && infoCount === 0 && (
                    <span style={{ ...styles.badge, background: C.greenBg, color: C.green }}>VALID</span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  style={{ ...styles.filterBtn, fontFamily: font }}>Load another</button>
                <button onClick={(e) => { e.stopPropagation(); reset(); }}
                  style={{ ...styles.filterBtn, fontFamily: font, color: C.red, borderColor: C.red }}>Clear</button>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.dropLabel}>
                {dragging ? 'Drop ADIF file here' : 'Drop ADIF file here or click to browse'}
              </div>
              <div style={styles.dropSub}>Supports .adi and .adif files</div>
            </>
          )}
        </div>

        {/* Results */}
        {parsed && validation && summary && (
          <>
            <ProgramChecksPanel programInfo={validation.programInfo} />
            <SummaryPanel summary={summary} />

            {/* Tabs */}
            <div style={styles.tabs}>
              {[
                { key: 'validation', label: `Validation (${validation.issues.length})` },
                { key: 'records', label: `Records (${parsed.records.length})` },
                { key: 'header', label: 'Header' },
                { key: 'extensions', label: 'Extensions' },
              ].map(t => (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{ ...styles.tab, ...(activeTab === t.key ? styles.tabActive : {}) }}>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'validation' && <ValidationPanel issues={validation.issues} />}
            {activeTab === 'records' && <RecordsPanel records={parsed.records} issues={validation.issues} />}
            {activeTab === 'header' && <HeaderView header={parsed.header} />}
            {activeTab === 'extensions' && <ExtensionsPanel extensions={validation.extensions} programInfo={validation.programInfo} />}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: `1px solid ${C.grayLight}`, fontSize: '0.78rem', color: C.gray, textAlign: 'center', lineHeight: 1.8 }}>
          <div>Validates against the ADIF specification. Checks syntax, field formats, enumerations, band/frequency consistency, and program-specific rules.</div>
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem 1.2rem' }}>
            <span style={{ fontWeight: 600 }}>Sources:</span>
            <a href="https://adif.org/315/ADIF_315.htm" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>ADIF 3.1.5 Spec</a>
            <a href="https://adif.org/316/ADIF_316.htm" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>ADIF 3.1.6 Spec</a>
            <a href="https://adif.org/317/ADIF_317.htm" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>ADIF 3.1.7 Spec</a>
            <a href="https://docs.pota.app/docs/activator_reference/ADIF_for_POTA_reference.html" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>POTA ADIF Reference</a>
            <a href="https://www.sota.org.uk/" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>SOTA</a>
            <a href="https://wwff.co/rules-faq/" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>WWFF</a>
            <a href="https://lotw.arrl.org/" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>LoTW</a>
            <a href="https://www.eqsl.cc/" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>eQSL</a>
            <a href="https://clublog.org/" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>Club Log</a>
          </div>
        </div>
      </div>
    </div>
  );
}
