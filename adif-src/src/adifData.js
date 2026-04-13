// ADIF Specification Data (based on ADIF 3.1.5/3.1.6)
// Band enumeration with frequency ranges in MHz

export const BANDS = {
  '2190m': { lower: 0.1357, upper: 0.1378 },
  '630m':  { lower: 0.472,  upper: 0.479 },
  '560m':  { lower: 0.501,  upper: 0.504 },
  '160m':  { lower: 1.8,    upper: 2.0 },
  '80m':   { lower: 3.5,    upper: 4.0 },
  '60m':   { lower: 5.06,   upper: 5.45 },
  '40m':   { lower: 7.0,    upper: 7.3 },
  '30m':   { lower: 10.1,   upper: 10.15 },
  '20m':   { lower: 14.0,   upper: 14.35 },
  '17m':   { lower: 18.068, upper: 18.168 },
  '15m':   { lower: 21.0,   upper: 21.45 },
  '12m':   { lower: 24.890, upper: 24.99 },
  '10m':   { lower: 28.0,   upper: 29.7 },
  '8m':    { lower: 40.0,   upper: 45.0 },
  '6m':    { lower: 50.0,   upper: 54.0 },
  '5m':    { lower: 54.000001, upper: 69.9 },
  '4m':    { lower: 70.0,   upper: 71.0 },
  '2m':    { lower: 144.0,  upper: 148.0 },
  '1.25m': { lower: 222.0,  upper: 225.0 },
  '70cm':  { lower: 420.0,  upper: 450.0 },
  '33cm':  { lower: 902.0,  upper: 928.0 },
  '23cm':  { lower: 1240.0, upper: 1300.0 },
  '13cm':  { lower: 2300.0, upper: 2450.0 },
  '9cm':   { lower: 3300.0, upper: 3500.0 },
  '6cm':   { lower: 5650.0, upper: 5925.0 },
  '3cm':   { lower: 10000.0, upper: 10500.0 },
  '1.25cm': { lower: 24000.0, upper: 24250.0 },
  '6mm':   { lower: 47000.0, upper: 47200.0 },
  '4mm':   { lower: 75500.0, upper: 81000.0 },
  '2.5mm': { lower: 119980.0, upper: 123000.0 },
  '2mm':   { lower: 134000.0, upper: 149000.0 },
  '1mm':   { lower: 241000.0, upper: 250000.0 },
  'submm': { lower: 300000.0, upper: 7500000.0 },
};

// Mode enumeration with valid submodes
export const MODES = {
  'AM':           [],
  'ARDOP':        [],
  'ATV':          [],
  'CHIP':         ['CHIP64', 'CHIP128'],
  'CLO':          [],
  'CONTESTI':     [],
  'CW':           ['PCW'],
  'DIGITALVOICE': ['C4FM', 'DMR', 'DSTAR', 'FREEDV', 'M17'],
  'DOMINO':       ['DOMINOEX', 'DOMINOF', 'DOM-M', 'DOM4', 'DOM5', 'DOM8', 'DOM11', 'DOM16', 'DOM22', 'DOM44', 'DOM88'],
  'DYNAMIC':      ['VARA HF', 'VARA SATELLITE', 'VARA FM 1200', 'VARA FM 9600'],
  'FAX':          [],
  'FM':           [],
  'FSK441':       [],
  'FT8':          [],
  'HELL':         ['FMHELL', 'FSKHELL', 'HELL80', 'HELLX5', 'HELLX9', 'HFSK', 'PSKHELL', 'SLOWHELL'],
  'ISCAT':        ['ISCAT-A', 'ISCAT-B'],
  'JT4':          ['JT4A', 'JT4B', 'JT4C', 'JT4D', 'JT4E', 'JT4F', 'JT4G'],
  'JT6M':         [],
  'JT9':          ['JT9-1', 'JT9-2', 'JT9-5', 'JT9-10', 'JT9-30', 'JT9A', 'JT9B', 'JT9C', 'JT9D', 'JT9E', 'JT9E FAST', 'JT9F', 'JT9F FAST', 'JT9G', 'JT9G FAST', 'JT9H', 'JT9H FAST'],
  'JT44':         [],
  'JT65':         ['JT65A', 'JT65B', 'JT65B2', 'JT65C', 'JT65C2'],
  'MFSK':         ['MFSK4', 'MFSK8', 'MFSK11', 'MFSK16', 'MFSK22', 'MFSK31', 'MFSK32', 'MFSK64', 'MFSK64L', 'MFSK128', 'MFSK128L', 'FST4', 'FST4W', 'FT4', 'JS8', 'JTMS', 'Q65', 'SCAMP_FAST', 'SCAMP_OO', 'SCAMP_OO_SLW', 'SCAMP_SLOW', 'SCAMP_VSLOW', 'FSQCALL', 'NAVTEX'],
  'MSK144':       [],
  'MT63':         [],
  'OLIVIA':       ['OLIVIA 4/125', 'OLIVIA 4/250', 'OLIVIA 8/250', 'OLIVIA 8/500', 'OLIVIA 16/500', 'OLIVIA 16/1000', 'OLIVIA 32/1000'],
  'OPERA':        ['OPERA-BEACON', 'OPERA-QSO'],
  'PAC':          ['PAC2', 'PAC3', 'PAC4'],
  'PAX':          ['PAX2'],
  'PKT':          [],
  'PSK':          ['FSK31', 'PSK10', 'PSK31', 'PSK63', 'PSK63F', 'PSK125', 'PSK250', 'PSK500', 'PSK1000', 'PSKAM10', 'PSKAM31', 'PSKAM50', 'PSKFEC31', 'PSKHELL', 'QPSK31', 'QPSK63', 'QPSK125', 'QPSK250', 'QPSK500', 'SIM31', 'PSK63RC4', 'PSK63RC5', 'PSK63RC10', 'PSK63RC20', 'PSK63RC32', 'PSK125RC4', 'PSK125RC5', 'PSK125RC10', 'PSK125RC12', 'PSK125RC16', 'PSK250RC2', 'PSK250RC3', 'PSK250RC5', 'PSK250RC6', 'PSK250RC7', 'PSK500RC2', 'PSK500RC3', 'PSK500RC4', 'PSK800RC2', 'PSK1000RC2', '8PSK125', '8PSK125F', '8PSK125FL', '8PSK250', '8PSK250F', '8PSK250FL', '8PSK500', '8PSK500F', '8PSK1000', '8PSK1000F', '8PSK1200F'],
  'PSK2K':        [],
  'Q15':          [],
  'QRA64':        ['QRA64A', 'QRA64B', 'QRA64C', 'QRA64D', 'QRA64E'],
  'ROS':          ['ROS-EME', 'ROS-HF', 'ROS-MF'],
  'RTTY':         ['ASCI'],
  'RTTYM':        [],
  'SSB':          ['LSB', 'USB'],
  'SSTV':         [],
  'T10':          [],
  'THOR':         ['THOR-M', 'THOR4', 'THOR5', 'THOR8', 'THOR11', 'THOR16', 'THOR22', 'THOR25X4', 'THOR50X1', 'THOR50X2', 'THOR100'],
  'THRB':         ['THRBX', 'THRBX1', 'THRBX2', 'THRBX4', 'THROB1', 'THROB2', 'THROB4'],
  'TOR':          ['AMTORFEC', 'GTOR', 'SITORB'],
  'V4':           [],
  'VOI':          [],
  'WINMOR':       [],
  'WSPR':         [],
};

// Build reverse lookup: submode -> parent mode
export const SUBMODE_TO_MODE = {};
for (const [mode, submodes] of Object.entries(MODES)) {
  for (const sub of submodes) {
    SUBMODE_TO_MODE[sub.toUpperCase()] = mode;
  }
}

// All valid submodes as a Set for fast lookup
export const ALL_SUBMODES = new Set(
  Object.values(MODES).flat().map(s => s.toUpperCase())
);

// Propagation mode enumeration
export const PROP_MODES = [
  'AS', 'AUE', 'AUR', 'BS', 'ECH', 'EME', 'ES', 'F2', 'FAI',
  'GWAVE', 'INTERNET', 'ION', 'IRL', 'LOS', 'MS', 'RPT', 'RS',
  'SAT', 'TEP', 'TR',
];

// QSL_Rcvd enumeration
export const QSL_RCVD = ['Y', 'N', 'R', 'I', 'V'];

// QSL_Sent enumeration
export const QSL_SENT = ['Y', 'N', 'R', 'I', 'Q'];

// QSL_Via enumeration
export const QSL_VIA = ['B', 'D', 'E', 'M'];

// QSO_Upload_Status enumeration
export const QSO_UPLOAD_STATUS = ['Y', 'N', 'M'];

// QSO_Complete enumeration
export const QSO_COMPLETE = ['Y', 'N', 'NIL', '?'];

// Continent enumeration
export const CONTINENTS = ['NA', 'SA', 'EU', 'AF', 'OC', 'AS', 'AN'];

// Ant_Path enumeration
export const ANT_PATHS = ['G', 'O', 'S', 'L'];

// Data type codes used in field definitions below:
// S = String, D = Date, T = Time, N = Number, B = Boolean,
// E = Enumeration (specify which), L = Location, G = GridSquare,
// M = MultilineString, I = IntlString, IM = IntlMultilineString,
// P = PositiveInteger, Int = Integer, IOTA = IOTARefNo,
// SOTA = SOTARef, POTA = POTARef, POTALIST = POTARefList,
// WWFF = WWFFRef, CreditList, AwardList, SponsoredAwardList,
// SecSubList = SecondarySubdivisionList, GridList = GridSquareList

export const FIELD_DEFS = {
  // Core QSO fields
  CALL:               { type: 'S', desc: 'Contacted station callsign' },
  QSO_DATE:           { type: 'D', desc: 'QSO date (UTC)' },
  QSO_DATE_OFF:       { type: 'D', desc: 'QSO end date (UTC)' },
  TIME_ON:            { type: 'T', desc: 'QSO start time (UTC)' },
  TIME_OFF:           { type: 'T', desc: 'QSO end time (UTC)' },
  BAND:               { type: 'E', enum: 'Band', desc: 'QSO band' },
  BAND_RX:            { type: 'E', enum: 'Band', desc: 'Receive band (split/crossband)' },
  MODE:               { type: 'E', enum: 'Mode', desc: 'Operating mode' },
  SUBMODE:            { type: 'E', enum: 'Submode', desc: 'Operating submode' },
  FREQ:               { type: 'N', desc: 'QSO frequency (MHz)' },
  FREQ_RX:            { type: 'N', desc: 'Receive frequency (MHz)' },

  // Signal reports
  RST_SENT:           { type: 'S', desc: 'Signal report sent' },
  RST_RCVD:           { type: 'S', desc: 'Signal report received' },
  TX_PWR:             { type: 'N', desc: 'Transmit power (watts)' },
  RX_PWR:             { type: 'N', desc: 'Contacted station power (watts)' },

  // Contacted station info
  NAME:               { type: 'S', desc: 'Contacted operator name' },
  NAME_INTL:          { type: 'I', desc: 'Contacted operator name (intl)' },
  QTH:                { type: 'S', desc: 'Contacted station city' },
  QTH_INTL:           { type: 'I', desc: 'Contacted station city (intl)' },
  GRIDSQUARE:         { type: 'G', desc: 'Contacted station grid' },
  GRIDSQUARE_EXT:     { type: 'S', desc: 'Grid extension (chars 9-12)' },
  LAT:                { type: 'L', desc: 'Contacted station latitude' },
  LON:                { type: 'L', desc: 'Contacted station longitude' },
  COUNTRY:            { type: 'S', desc: 'DXCC entity name' },
  COUNTRY_INTL:       { type: 'I', desc: 'DXCC entity name (intl)' },
  DXCC:               { type: 'E', enum: 'DXCC', desc: 'DXCC entity code' },
  CQZ:                { type: 'P', desc: 'CQ zone (1-40)', min: 1, max: 40 },
  ITUZ:               { type: 'P', desc: 'ITU zone (1-90)', min: 1, max: 90 },
  CONT:               { type: 'E', enum: 'Continent', desc: 'Continent' },
  STATE:              { type: 'E', enum: 'Primary_Subdivision', desc: 'Contacted station state/province' },
  CNTY:               { type: 'S', desc: 'Contacted station county' },
  PFX:                { type: 'S', desc: 'WPX prefix' },
  AGE:                { type: 'N', desc: 'Contacted operator age', min: 0, max: 120 },
  EMAIL:              { type: 'S', desc: 'Contacted station email' },
  WEB:                { type: 'S', desc: 'Contacted station web URL' },
  ADDRESS:            { type: 'M', desc: 'Contacted station address' },
  ADDRESS_INTL:       { type: 'IM', desc: 'Contacted station address (intl)' },
  ALTITUDE:           { type: 'N', desc: 'Contacted station altitude (m)' },

  // My station info
  STATION_CALLSIGN:   { type: 'S', desc: 'Logging station callsign' },
  OPERATOR:           { type: 'S', desc: 'Logging operator callsign' },
  OWNER_CALLSIGN:     { type: 'S', desc: 'Station owner callsign' },
  MY_GRIDSQUARE:      { type: 'G', desc: 'My grid square' },
  MY_GRIDSQUARE_EXT:  { type: 'S', desc: 'My grid extension (chars 9-12)' },
  MY_LAT:             { type: 'L', desc: 'My latitude' },
  MY_LON:             { type: 'L', desc: 'My longitude' },
  MY_CITY:            { type: 'S', desc: 'My city' },
  MY_CITY_INTL:       { type: 'I', desc: 'My city (intl)' },
  MY_COUNTRY:         { type: 'S', desc: 'My DXCC entity name' },
  MY_COUNTRY_INTL:    { type: 'I', desc: 'My DXCC entity name (intl)' },
  MY_DXCC:            { type: 'E', enum: 'DXCC', desc: 'My DXCC entity code' },
  MY_CQ_ZONE:         { type: 'P', desc: 'My CQ zone', min: 1, max: 40 },
  MY_ITU_ZONE:        { type: 'P', desc: 'My ITU zone', min: 1, max: 90 },
  MY_STATE:           { type: 'E', enum: 'Primary_Subdivision', desc: 'My state/province' },
  MY_CNTY:            { type: 'S', desc: 'My county' },
  MY_STREET:          { type: 'S', desc: 'My street address' },
  MY_STREET_INTL:     { type: 'I', desc: 'My street address (intl)' },
  MY_POSTAL_CODE:     { type: 'S', desc: 'My postal code' },
  MY_POSTAL_CODE_INTL:{ type: 'I', desc: 'My postal code (intl)' },
  MY_NAME:            { type: 'S', desc: 'My name' },
  MY_NAME_INTL:       { type: 'I', desc: 'My name (intl)' },
  MY_ALTITUDE:        { type: 'N', desc: 'My altitude (m)' },
  MY_ANTENNA:         { type: 'S', desc: 'My antenna' },
  MY_ANTENNA_INTL:    { type: 'I', desc: 'My antenna (intl)' },
  MY_RIG:             { type: 'S', desc: 'My rig' },
  MY_RIG_INTL:        { type: 'I', desc: 'My rig (intl)' },
  MY_ARRL_SECT:       { type: 'E', enum: 'ARRL_Section', desc: 'My ARRL section' },
  MY_FISTS:           { type: 'P', desc: 'My FISTS member number' },
  MY_USACA_COUNTIES:  { type: 'S', desc: 'My USACA counties' },
  MY_VUCC_GRIDS:      { type: 'S', desc: 'My VUCC grids' },

  // QSL fields
  QSL_RCVD:           { type: 'E', enum: 'QSL_Rcvd', desc: 'QSL received status' },
  QSL_SENT:           { type: 'E', enum: 'QSL_Sent', desc: 'QSL sent status' },
  QSL_RCVD_VIA:       { type: 'E', enum: 'QSL_Via', desc: 'QSL received via' },
  QSL_SENT_VIA:       { type: 'E', enum: 'QSL_Via', desc: 'QSL sent via' },
  QSLRDATE:           { type: 'D', desc: 'QSL received date' },
  QSLSDATE:           { type: 'D', desc: 'QSL sent date' },
  QSLMSG:             { type: 'M', desc: 'QSL card message' },
  QSLMSG_INTL:        { type: 'IM', desc: 'QSL card message (intl)' },
  QSO_RANDOM:         { type: 'B', desc: 'Random QSO flag' },
  QSO_COMPLETE:       { type: 'E', enum: 'QSO_Complete', desc: 'QSO completeness' },

  // LoTW
  LOTW_QSL_RCVD:      { type: 'E', enum: 'QSL_Rcvd', desc: 'LoTW QSL received' },
  LOTW_QSL_SENT:      { type: 'E', enum: 'QSL_Sent', desc: 'LoTW QSL sent' },
  LOTW_QSLRDATE:      { type: 'D', desc: 'LoTW QSL received date' },
  LOTW_QSLSDATE:      { type: 'D', desc: 'LoTW QSL sent date' },

  // eQSL
  EQSL_QSL_RCVD:      { type: 'E', enum: 'QSL_Rcvd', desc: 'eQSL received' },
  EQSL_QSL_SENT:      { type: 'E', enum: 'QSL_Sent', desc: 'eQSL sent' },
  EQSL_QSLRDATE:      { type: 'D', desc: 'eQSL received date' },
  EQSL_QSLSDATE:      { type: 'D', desc: 'eQSL sent date' },

  // Club Log
  CLUBLOG_QSO_UPLOAD_DATE:    { type: 'D', desc: 'Club Log upload date' },
  CLUBLOG_QSO_UPLOAD_STATUS:  { type: 'E', enum: 'QSO_Upload_Status', desc: 'Club Log upload status' },

  // QRZ.com
  QRZCOM_QSO_UPLOAD_DATE:     { type: 'D', desc: 'QRZ.com upload date' },
  QRZCOM_QSO_UPLOAD_STATUS:   { type: 'E', enum: 'QSO_Upload_Status', desc: 'QRZ.com upload status' },

  // HRDLog
  HRDLOG_QSO_UPLOAD_DATE:     { type: 'D', desc: 'HRDLog upload date' },
  HRDLOG_QSO_UPLOAD_STATUS:   { type: 'E', enum: 'QSO_Upload_Status', desc: 'HRDLog upload status' },

  // HamlogEU
  HAMLOGEU_QSO_UPLOAD_DATE:   { type: 'D', desc: 'HamlogEU upload date' },
  HAMLOGEU_QSO_UPLOAD_STATUS: { type: 'E', enum: 'QSO_Upload_Status', desc: 'HamlogEU upload status' },

  // HamQTH
  HAMQTH_QSO_UPLOAD_DATE:     { type: 'D', desc: 'HamQTH upload date' },
  HAMQTH_QSO_UPLOAD_STATUS:   { type: 'E', enum: 'QSO_Upload_Status', desc: 'HamQTH upload status' },

  // DCL
  DCL_QSL_RCVD:       { type: 'E', enum: 'QSL_Rcvd', desc: 'DCL QSL received' },
  DCL_QSL_SENT:       { type: 'E', enum: 'QSL_Sent', desc: 'DCL QSL sent' },
  DCL_QSLRDATE:       { type: 'D', desc: 'DCL QSL received date' },
  DCL_QSLSDATE:       { type: 'D', desc: 'DCL QSL sent date' },

  // Propagation
  PROP_MODE:          { type: 'E', enum: 'Propagation_Mode', desc: 'Propagation mode' },
  ANT_PATH:           { type: 'E', enum: 'Ant_Path', desc: 'Antenna path' },
  ANT_AZ:             { type: 'N', desc: 'Antenna azimuth (degrees)', min: 0, max: 360 },
  ANT_EL:             { type: 'N', desc: 'Antenna elevation (degrees)', min: -90, max: 90 },
  A_INDEX:            { type: 'N', desc: 'A index', min: 0, max: 400 },
  K_INDEX:            { type: 'P', desc: 'K index', min: 0, max: 9 },
  SFI:                { type: 'N', desc: 'Solar flux index', min: 0, max: 300 },
  FORCE_INIT:         { type: 'B', desc: 'Force initial (EME)' },
  MAX_BURSTS:         { type: 'N', desc: 'Max meteor scatter bursts' },
  NR_BURSTS:          { type: 'N', desc: 'Number of meteor scatter bursts' },
  NR_PINGS:           { type: 'N', desc: 'Number of meteor scatter pings' },
  MS_SHOWER:          { type: 'S', desc: 'Meteor scatter shower name' },
  DISTANCE:           { type: 'N', desc: 'Distance (km)' },

  // Satellite
  SAT_NAME:           { type: 'S', desc: 'Satellite name' },
  SAT_MODE:           { type: 'S', desc: 'Satellite mode' },

  // Awards & programs
  IOTA:               { type: 'IOTA', desc: 'IOTA reference' },
  IOTA_ISLAND_ID:     { type: 'P', desc: 'IOTA island ID' },
  MY_IOTA:            { type: 'IOTA', desc: 'My IOTA reference' },
  MY_IOTA_ISLAND_ID:  { type: 'P', desc: 'My IOTA island ID' },
  SOTA_REF:           { type: 'SOTA', desc: 'Contacted station SOTA ref' },
  MY_SOTA_REF:        { type: 'SOTA', desc: 'My SOTA reference' },
  POTA_REF:           { type: 'POTALIST', desc: 'Contacted station POTA ref(s)' },
  MY_POTA_REF:        { type: 'POTALIST', desc: 'My POTA reference(s)' },
  WWFF_REF:           { type: 'WWFF', desc: 'Contacted station WWFF ref' },
  MY_WWFF_REF:        { type: 'WWFF', desc: 'My WWFF reference' },
  SIG:                { type: 'S', desc: 'Special interest group' },
  SIG_INTL:           { type: 'I', desc: 'Special interest group (intl)' },
  SIG_INFO:           { type: 'S', desc: 'SIG information' },
  SIG_INFO_INTL:      { type: 'I', desc: 'SIG information (intl)' },
  MY_SIG:             { type: 'S', desc: 'My special interest group' },
  MY_SIG_INTL:        { type: 'I', desc: 'My SIG (intl)' },
  MY_SIG_INFO:        { type: 'S', desc: 'My SIG information' },
  MY_SIG_INFO_INTL:   { type: 'I', desc: 'My SIG information (intl)' },
  VUCC_GRIDS:         { type: 'S', desc: 'VUCC grids (2 or 4, comma-separated)' },
  USACA_COUNTIES:     { type: 'S', desc: 'USACA counties' },
  ARRL_SECT:          { type: 'E', enum: 'ARRL_Section', desc: 'ARRL section' },
  DARC_DOK:           { type: 'S', desc: 'DARC DOK' },
  FISTS:              { type: 'P', desc: 'FISTS member number' },
  FISTS_CC:           { type: 'P', desc: 'FISTS Century Certificate number' },
  TEN_TEN:            { type: 'P', desc: 'Ten-Ten member number' },
  UKSMG:              { type: 'P', desc: 'UKSMG member number' },
  SKCC:               { type: 'S', desc: 'SKCC member number' },
  REGION:             { type: 'E', enum: 'Region', desc: 'WAE/CQ region' },

  // Contest
  CONTEST_ID:         { type: 'S', desc: 'Contest identifier' },
  SRX:                { type: 'Int', desc: 'Contest serial received' },
  STX:                { type: 'Int', desc: 'Contest serial sent' },
  SRX_STRING:         { type: 'S', desc: 'Contest exchange received' },
  STX_STRING:         { type: 'S', desc: 'Contest exchange sent' },
  CHECK:              { type: 'S', desc: 'Contest check' },
  CLASS:              { type: 'S', desc: 'Contest class' },
  PRECEDENCE:         { type: 'S', desc: 'Contest precedence' },

  // Credits
  CREDIT_GRANTED:     { type: 'S', desc: 'Credits granted' },
  CREDIT_SUBMITTED:   { type: 'S', desc: 'Credits submitted' },
  AWARD_GRANTED:      { type: 'S', desc: 'Awards granted' },
  AWARD_SUBMITTED:    { type: 'S', desc: 'Awards submitted' },

  // Misc
  COMMENT:            { type: 'S', desc: 'Comment' },
  COMMENT_INTL:       { type: 'I', desc: 'Comment (intl)' },
  NOTES:              { type: 'M', desc: 'Notes' },
  NOTES_INTL:         { type: 'IM', desc: 'Notes (intl)' },
  RIG:                { type: 'S', desc: 'Contacted station rig' },
  RIG_INTL:           { type: 'I', desc: 'Contacted station rig (intl)' },
  GUEST_OP:           { type: 'S', desc: 'Guest operator callsign' },
  EQ_CALL:            { type: 'S', desc: 'Owner callsign of contacted station' },
  CONTACTED_OP:       { type: 'S', desc: 'Contacted operator callsign' },
  PUBLIC_KEY:         { type: 'S', desc: 'Public encryption key' },
  SWL:                { type: 'B', desc: 'SWL QSO flag' },
  SILENT_KEY:         { type: 'B', desc: 'Contacted operator is silent key' },
  CNTY_ALT:           { type: 'S', desc: 'Alternate county list' },
};

// Enumeration lookup tables for validation
export const ENUMERATIONS = {
  Band: new Set(Object.keys(BANDS).map(b => b.toUpperCase())),
  Mode: new Set(Object.keys(MODES).map(m => m.toUpperCase())),
  Submode: ALL_SUBMODES,
  QSL_Rcvd: new Set(QSL_RCVD),
  QSL_Sent: new Set(QSL_SENT),
  QSL_Via: new Set(QSL_VIA),
  QSO_Upload_Status: new Set(QSO_UPLOAD_STATUS),
  QSO_Complete: new Set(QSO_COMPLETE),
  Continent: new Set(CONTINENTS),
  Ant_Path: new Set(ANT_PATHS),
  Propagation_Mode: new Set(PROP_MODES),
};

// Known APP_ program IDs and their descriptions
export const KNOWN_APP_PROGRAMS = {
  'LOTW':     'Logbook of The World (ARRL)',
  'N1MM':     'N1MM Logger+',
  'L4ONG':    'Log4OM',
  'LOG4OM':   'Log4OM (legacy)',
  'MONOLOG':  'MonoLog',
  'HAMRS':    'HAMRS',
  'WSJTX':    'WSJT-X',
  'JTDX':     'JTDX',
  'FLRIG':    'flrig',
  'FLDIGI':   'fldigi',
  'LOGGER32': 'Logger32',
  'DXLAB':    'DXLab Suite',
  'HRD':      'Ham Radio Deluxe',
  'SWISSLOG': 'Swisslog',
  'UCXLOG':   'UCXLog',
  'CQRLOG':   'CQRLog',
  'RUMLOG':   'RUMlogNG',
  'MACLOGGER':'MacLoggerDX',
  'CLOUDLOG': 'Cloudlog',
  'WAVELOG':  'Wavelog',
  'POTAPLUS': 'POTA+',
};

// Header-only fields
export const HEADER_FIELDS = new Set([
  'ADIF_VER', 'CREATED_TIMESTAMP', 'PROGRAMID', 'PROGRAMVERSION',
]);
