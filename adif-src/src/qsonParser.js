// QSON (QSO Object Notation) parser
// Parses QSON JSON files and converts to the same internal format as parseAdif()
// so the existing validation pipeline can be reused.
//
// QSON is a JSON-based format from ham2k for representing amateur radio QSOs.
// See: https://github.com/ham2k/ham-js-libs/tree/main/packages/lib-qson-tools
//
// Handles both format variants:
//   - TypeScript/runtime form: refs/qsl as arrays, startAt/endAt, sent
//   - Spec form: refs/qsl as objects, start/end, report

export function parseQson(text) {
  const result = {
    rawText: text,
    header: null,
    records: [],
    parseErrors: [],
    sourceFormat: 'qson',
  };

  if (!text || !text.trim()) {
    result.parseErrors.push({ message: 'File is empty', position: 0 });
    return result;
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    result.parseErrors.push({
      message: `Invalid JSON: ${e.message}`,
      position: 0,
    });
    return result;
  }

  // Validate top-level structure
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.parseErrors.push({
      message: 'QSON file must be a JSON object with a "qsos" array',
      position: 0,
    });
    return result;
  }

  const qsos = data.qsos;
  if (!Array.isArray(qsos)) {
    result.parseErrors.push({
      message: 'QSON file must contain a "qsos" array',
      position: 0,
    });
    return result;
  }

  if (qsos.length === 0) {
    result.parseErrors.push({
      message: 'QSON file contains no QSO records',
      position: 0,
    });
  }

  // Build a synthetic header from QSON metadata
  const headerFields = [];
  if (data.source) {
    if (typeof data.source === 'string') {
      headerFields.push(makeField('PROGRAMID', data.source));
    } else if (typeof data.source === 'object') {
      if (data.source.program) headerFields.push(makeField('PROGRAMID', data.source.program));
      if (data.source.version) headerFields.push(makeField('PROGRAMVERSION', data.source.version));
    }
  }
  if (data.version) {
    headerFields.push(makeField('QSON_VERSION', String(data.version)));
  }

  if (headerFields.length > 0) {
    result.header = {
      fields: headerFields,
      userDefs: [],
      freeText: null,
    };
  }

  // Convert each QSO to an ADIF-compatible record
  for (let i = 0; i < qsos.length; i++) {
    const qso = qsos[i];
    if (typeof qso !== 'object' || qso === null || Array.isArray(qso)) {
      result.parseErrors.push({
        message: `QSO at index ${i} is not a valid object`,
        position: 0,
      });
      continue;
    }

    const fields = [];

    // Their station info
    if (qso.their) {
      mapCallInfo(qso.their, fields, 'their');
    }

    // Our station info
    if (qso.our) {
      mapCallInfo(qso.our, fields, 'our');
    }

    // Top-level QSO fields
    if (qso.freq != null) {
      // QSON freq is in kHz, ADIF FREQ is in MHz
      const freqMHz = qso.freq / 1000;
      fields.push(makeField('FREQ', String(freqMHz)));
    }

    if (qso.band) {
      fields.push(makeField('BAND', String(qso.band).toUpperCase()));
    }

    if (qso.mode) {
      fields.push(makeField('MODE', String(qso.mode).toUpperCase()));
    }

    if (qso.submode) {
      fields.push(makeField('SUBMODE', String(qso.submode).toUpperCase()));
    }

    // Date/time - handle both "startAt"/"endAt" and "start"/"end" variants
    const startTime = qso.startAt || qso.start;
    const endTime = qso.endAt || qso.end;
    const startMillis = qso.startAtMillis;
    const endMillis = qso.endAtMillis;

    if (startTime) {
      const dt = parseISODateTime(startTime);
      if (dt) {
        fields.push(makeField('QSO_DATE', dt.date));
        fields.push(makeField('TIME_ON', dt.time));
      } else {
        result.parseErrors.push({
          message: `QSO ${i + 1}: invalid start time "${startTime}"`,
          position: 0,
        });
      }
    } else if (startMillis) {
      const dt = millisToDateTime(startMillis);
      if (dt) {
        fields.push(makeField('QSO_DATE', dt.date));
        fields.push(makeField('TIME_ON', dt.time));
      }
    }

    if (endTime) {
      const dt = parseISODateTime(endTime);
      if (dt) {
        fields.push(makeField('QSO_DATE_OFF', dt.date));
        fields.push(makeField('TIME_OFF', dt.time));
      }
    } else if (endMillis) {
      const dt = millisToDateTime(endMillis);
      if (dt) {
        fields.push(makeField('QSO_DATE_OFF', dt.date));
        fields.push(makeField('TIME_OFF', dt.time));
      }
    }

    // RST exchange - handle both "sent" and "report" field names
    const theirRst = qso.their?.sent ?? qso.their?.report;
    const ourRst = qso.our?.sent ?? qso.our?.report;
    if (theirRst != null) {
      fields.push(makeField('RST_RCVD', String(theirRst)));
    }
    if (ourRst != null) {
      fields.push(makeField('RST_SENT', String(ourRst)));
    }

    // References (POTA, SOTA, IOTA, WWFF, contest, etc.)
    if (qso.refs) {
      if (Array.isArray(qso.refs)) {
        mapRefsArray(qso.refs, fields);
      } else if (typeof qso.refs === 'object') {
        mapRefsObject(qso.refs, fields);
      }
    }

    // QSL info
    if (qso.qsl) {
      if (Array.isArray(qso.qsl)) {
        mapQslArray(qso.qsl, fields);
      } else if (typeof qso.qsl === 'object') {
        mapQslObject(qso.qsl, fields);
      }
    }

    // Propagation mode
    if (qso.propMode) {
      fields.push(makeField('PROP_MODE', String(qso.propMode).toUpperCase()));
    }

    // Satellite
    if (qso.satName) {
      fields.push(makeField('SAT_NAME', String(qso.satName)));
    }

    // UUID
    if (qso.uuid) {
      fields.push(makeField('APP_QSON_UUID', String(qso.uuid)));
    }

    // Comment / notes
    if (qso.comment) {
      fields.push(makeField('COMMENT', String(qso.comment)));
    }
    if (qso.notes) {
      fields.push(makeField('NOTES', String(qso.notes)));
    }

    result.records.push({
      index: i,
      fields,
    });
  }

  return result;
}

function makeField(name, value) {
  const v = value || '';
  return {
    name,
    value: v,
    declaredLength: v.length,
    actualLength: v.length,
    typeIndicator: null,
    position: 0,
    lengthMismatch: false,
  };
}

function parseISODateTime(isoStr) {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    const year = String(d.getUTCFullYear()).padStart(4, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    return {
      date: `${year}${month}${day}`,
      time: `${hours}${minutes}${seconds}`,
    };
  } catch {
    return null;
  }
}

function millisToDateTime(millis) {
  if (typeof millis !== 'number' || !isFinite(millis)) return null;
  return parseISODateTime(new Date(millis).toISOString());
}

function mapCallInfo(info, fields, side) {
  if (!info || typeof info !== 'object') return;

  if (side === 'their') {
    if (info.call) fields.push(makeField('CALL', String(info.call).toUpperCase()));
    if (info.grid) fields.push(makeField('GRIDSQUARE', String(info.grid).toUpperCase()));
    if (info.name) fields.push(makeField('NAME', String(info.name)));
    if (info.dxccCode != null) fields.push(makeField('DXCC', String(info.dxccCode)));
    if (info.country) fields.push(makeField('COUNTRY', String(info.country)));
    if (info.entityName && !info.country) fields.push(makeField('COUNTRY', String(info.entityName)));
    if (info.state) fields.push(makeField('STATE', String(info.state).toUpperCase()));
    if (info.county) fields.push(makeField('CNTY', String(info.county)));
    if (info.continent) fields.push(makeField('CONT', String(info.continent).toUpperCase()));
    if (info.cqZone != null) fields.push(makeField('CQZ', String(info.cqZone)));
    if (info.ituZone != null) fields.push(makeField('ITUZ', String(info.ituZone)));
    if (info.city || info.qth) fields.push(makeField('QTH', String(info.city || info.qth)));
    if (info.lat) fields.push(makeField('LAT', String(info.lat)));
    if (info.lon) fields.push(makeField('LON', String(info.lon)));
    if (info.email) fields.push(makeField('EMAIL', String(info.email)));
  } else {
    // our station
    if (info.call) fields.push(makeField('STATION_CALLSIGN', String(info.call).toUpperCase()));
    if (info.grid) fields.push(makeField('MY_GRIDSQUARE', String(info.grid).toUpperCase()));
    if (info.name) fields.push(makeField('MY_NAME', String(info.name)));
    if (info.dxccCode != null) fields.push(makeField('MY_DXCC', String(info.dxccCode)));
    if (info.country) fields.push(makeField('MY_COUNTRY', String(info.country)));
    if (info.entityName && !info.country) fields.push(makeField('MY_COUNTRY', String(info.entityName)));
    if (info.state) fields.push(makeField('MY_STATE', String(info.state).toUpperCase()));
    if (info.county) fields.push(makeField('MY_CNTY', String(info.county)));
    if (info.cqZone != null) fields.push(makeField('MY_CQ_ZONE', String(info.cqZone)));
    if (info.ituZone != null) fields.push(makeField('MY_ITU_ZONE', String(info.ituZone)));
    if (info.city) fields.push(makeField('MY_CITY', String(info.city)));
    if (info.lat) fields.push(makeField('MY_LAT', String(info.lat)));
    if (info.lon) fields.push(makeField('MY_LON', String(info.lon)));
  }
}

// Handle refs as array: [{type: 'pota', ref: 'K-0001'}, ...]
function mapRefsArray(refs, fields) {
  const potaRefs = [];
  const myPotaRefs = [];

  for (const ref of refs) {
    if (!ref || typeof ref !== 'object') continue;
    const type = (ref.type || '').toLowerCase();
    const value = ref.ref || '';

    switch (type) {
      case 'pota':
        potaRefs.push(value);
        break;
      case 'potaactivation':
        myPotaRefs.push(value);
        break;
      case 'sota':
        fields.push(makeField('SOTA_REF', value));
        break;
      case 'sotaactivation':
        fields.push(makeField('MY_SOTA_REF', value));
        break;
      case 'iota':
        fields.push(makeField('IOTA', value));
        break;
      case 'wwff':
        fields.push(makeField('WWFF_REF', value));
        break;
      case 'wwffactivation':
        fields.push(makeField('MY_WWFF_REF', value));
        break;
      case 'contest':
        fields.push(makeField('CONTEST_ID', value));
        break;
      case 'sig':
        fields.push(makeField('SIG', value));
        if (ref.info) fields.push(makeField('SIG_INFO', String(ref.info)));
        break;
      default:
        if (type && value) {
          fields.push(makeField(`APP_QSON_REF_${type.toUpperCase()}`, value));
        }
        break;
    }
  }

  if (potaRefs.length > 0) {
    fields.push(makeField('POTA_REF', potaRefs.join(',')));
  }
  if (myPotaRefs.length > 0) {
    fields.push(makeField('MY_POTA_REF', myPotaRefs.join(',')));
  }
}

// Handle refs as object: {pota: {"K-0001": true}, contest: {"NAQPSSB": {...}}, ...}
function mapRefsObject(refs, fields) {
  const potaRefs = [];
  const myPotaRefs = [];

  for (const [type, value] of Object.entries(refs)) {
    const typeLower = type.toLowerCase();

    // value is an object whose keys are the reference values
    const refKeys = (typeof value === 'object' && value !== null) ? Object.keys(value) : [];
    const refStr = typeof value === 'string' ? value : refKeys[0] || '';

    switch (typeLower) {
      case 'pota':
        potaRefs.push(...refKeys);
        break;
      case 'potaactivation':
        myPotaRefs.push(...refKeys);
        break;
      case 'sota':
        if (refStr) fields.push(makeField('SOTA_REF', refStr));
        break;
      case 'sotaactivation':
        if (refStr) fields.push(makeField('MY_SOTA_REF', refStr));
        break;
      case 'iota':
        if (refStr) fields.push(makeField('IOTA', refStr));
        break;
      case 'wwff':
        if (refStr) fields.push(makeField('WWFF_REF', refStr));
        break;
      case 'wwffactivation':
        if (refStr) fields.push(makeField('MY_WWFF_REF', refStr));
        break;
      case 'contest':
        if (refStr) fields.push(makeField('CONTEST_ID', refStr));
        break;
      default:
        if (typeLower && refStr) {
          fields.push(makeField(`APP_QSON_REF_${type.toUpperCase()}`, refStr));
        }
        break;
    }
  }

  if (potaRefs.length > 0) {
    fields.push(makeField('POTA_REF', potaRefs.join(',')));
  }
  if (myPotaRefs.length > 0) {
    fields.push(makeField('MY_POTA_REF', myPotaRefs.join(',')));
  }
}

// Handle qsl as array: [{type: 'lotw', received: true}, ...]
function mapQslArray(qslEntries, fields) {
  for (const qsl of qslEntries) {
    if (!qsl || typeof qsl !== 'object') continue;
    const type = (qsl.type || '').toLowerCase();
    const received = qsl.received ? 'Y' : 'N';

    switch (type) {
      case 'lotw':
        fields.push(makeField('LOTW_QSL_RCVD', received));
        break;
      case 'eqsl':
        fields.push(makeField('EQSL_QSL_RCVD', received));
        break;
      case 'card':
      case 'qsl':
        fields.push(makeField('QSL_RCVD', received));
        break;
      case 'qrz':
        fields.push(makeField('QRZCOM_QSO_UPLOAD_STATUS', received === 'Y' ? 'Y' : 'N'));
        break;
      case 'clublog':
        fields.push(makeField('CLUBLOG_QSO_UPLOAD_STATUS', received === 'Y' ? 'Y' : 'N'));
        break;
      default:
        if (type) {
          fields.push(makeField(`APP_QSON_QSL_${type.toUpperCase()}`, received));
        }
        break;
    }
  }
}

// Handle qsl as object: {lotw: {received: "2023-01-15"}, qrz: {qsl: true}, ...}
function mapQslObject(qslObj, fields) {
  for (const [type, value] of Object.entries(qslObj)) {
    const typeLower = type.toLowerCase();
    // Determine received status from various possible formats
    let received = 'N';
    if (typeof value === 'boolean') {
      received = value ? 'Y' : 'N';
    } else if (typeof value === 'object' && value !== null) {
      if (value.received || value.qsl) received = 'Y';
    }

    switch (typeLower) {
      case 'lotw':
        fields.push(makeField('LOTW_QSL_RCVD', received));
        break;
      case 'eqsl':
        fields.push(makeField('EQSL_QSL_RCVD', received));
        break;
      case 'card':
      case 'qsl':
        fields.push(makeField('QSL_RCVD', received));
        break;
      case 'qrz':
        fields.push(makeField('QRZCOM_QSO_UPLOAD_STATUS', received));
        break;
      case 'clublog':
        fields.push(makeField('CLUBLOG_QSO_UPLOAD_STATUS', received));
        break;
      default:
        if (typeLower) {
          fields.push(makeField(`APP_QSON_QSL_${type.toUpperCase()}`, received));
        }
        break;
    }
  }
}

// Validate QSON-specific structure (called after ADIF validation)
export function validateQsonStructure(parsed) {
  const issues = [];

  if (parsed.sourceFormat !== 'qson') return issues;

  for (const record of parsed.records) {
    const recNum = record.index + 1;
    const fieldMap = {};
    for (const f of record.fields) fieldMap[f.name] = f.value;

    // Check for missing essential fields
    if (!fieldMap.CALL) {
      issues.push({
        severity: 'warning',
        category: 'qson',
        message: 'QSO is missing "their.call" (no contacted station callsign)',
        record: recNum,
        field: null,
      });
    }

    if (!fieldMap.QSO_DATE && !fieldMap.TIME_ON) {
      issues.push({
        severity: 'warning',
        category: 'qson',
        message: 'QSO is missing start time (no "startAt" or "start")',
        record: recNum,
        field: null,
      });
    }

    if (!fieldMap.FREQ && !fieldMap.BAND) {
      issues.push({
        severity: 'warning',
        category: 'qson',
        message: 'QSO is missing both "freq" and "band"',
        record: recNum,
        field: null,
      });
    }

    if (!fieldMap.MODE) {
      issues.push({
        severity: 'warning',
        category: 'qson',
        message: 'QSO is missing "mode"',
        record: recNum,
        field: null,
      });
    }
  }

  return issues;
}
