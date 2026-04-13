// ADIF Validation Engine
// Validates parsed ADIF data against the specification

import {
  BANDS, MODES, SUBMODE_TO_MODE, ALL_SUBMODES,
  FIELD_DEFS, ENUMERATIONS, HEADER_FIELDS, KNOWN_APP_PROGRAMS,
  US_STATE_GRID_FIELDS, CA_PROVINCE_GRID_FIELDS,
  US_DXCC_CODES, POTA_PREFIX_TO_DXCC,
  PHONE_MODES, CW_MODES,
} from './adifData.js';

// Severity levels
export const SEV = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export function validateAdif(parsed) {
  const issues = [];
  const extensions = { appFields: {}, userDefFields: [], unknownFields: [] };
  const programInfo = detectProgram(parsed);

  // Include parse-level errors
  for (const err of parsed.parseErrors) {
    issues.push({
      severity: SEV.ERROR,
      category: 'syntax',
      message: err.message,
      record: null,
      field: null,
      position: err.position,
    });
  }

  // Validate header
  if (parsed.header) {
    validateHeader(parsed.header, issues);
  }

  // Validate each record
  for (const record of parsed.records) {
    validateRecord(record, parsed, issues, extensions);
  }

  // Cross-record checks
  crossRecordChecks(parsed.records, issues);

  // Program-specific checks
  programSpecificChecks(parsed, issues, programInfo);

  // Collect extension info
  collectExtensions(parsed, extensions);

  return { issues, extensions, programInfo };
}

function detectProgram(parsed) {
  const info = { id: null, version: null, adifVersion: null };
  if (!parsed.header) return info;

  for (const field of parsed.header.fields) {
    if (field.name === 'PROGRAMID') info.id = field.value;
    if (field.name === 'PROGRAMVERSION') info.version = field.value;
    if (field.name === 'ADIF_VER') info.adifVersion = field.value;
  }
  return info;
}

function validateHeader(header, issues) {
  const fieldNames = new Set();

  for (const field of header.fields) {
    const name = field.name;

    // Check for USERDEF fields (valid in header)
    if (/^USERDEF\d+$/.test(name)) continue;

    // Check length mismatch
    if (field.lengthMismatch) {
      issues.push({
        severity: SEV.ERROR,
        category: 'syntax',
        message: `Header field ${name}: declared length ${field.declaredLength} but actual value is ${field.actualLength} chars`,
        record: null,
        field: name,
      });
    }

    // Warn if non-header field appears in header
    if (!HEADER_FIELDS.has(name) && !name.startsWith('APP_') && !/^USERDEF\d+$/.test(name)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'structure',
        message: `Field "${name}" is not a standard header field`,
        record: null,
        field: name,
      });
    }

    // Check for duplicates
    if (fieldNames.has(name)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'structure',
        message: `Duplicate header field "${name}"`,
        record: null,
        field: name,
      });
    }
    fieldNames.add(name);
  }
}

function validateRecord(record, parsed, issues, extensions) {
  const recNum = record.index + 1;
  const fieldMap = {};

  for (const field of record.fields) {
    fieldMap[field.name] = field.value;
  }

  // Check for missing recommended fields
  const missingRequired = [];
  if (!fieldMap.CALL) missingRequired.push('CALL');
  if (!fieldMap.QSO_DATE) missingRequired.push('QSO_DATE');
  if (!fieldMap.TIME_ON) missingRequired.push('TIME_ON');
  if (!fieldMap.MODE) missingRequired.push('MODE');
  if (!fieldMap.BAND && !fieldMap.FREQ) missingRequired.push('BAND or FREQ');

  if (missingRequired.length > 0) {
    issues.push({
      severity: SEV.WARNING,
      category: 'completeness',
      message: `Missing recommended field(s): ${missingRequired.join(', ')}`,
      record: recNum,
      field: null,
    });
  }

  // Check for missing EOR
  if (record.missingEor) {
    issues.push({
      severity: SEV.ERROR,
      category: 'syntax',
      message: 'Record is missing <EOR> tag',
      record: recNum,
      field: null,
    });
  }

  // Validate each field
  const fieldNames = new Set();
  for (const field of record.fields) {
    // Length mismatch
    if (field.lengthMismatch) {
      issues.push({
        severity: SEV.ERROR,
        category: 'syntax',
        message: `Declared length ${field.declaredLength} but actual value "${field.value}" is ${field.actualLength} chars`,
        record: recNum,
        field: field.name,
      });
    }

    // Duplicate fields
    if (fieldNames.has(field.name)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'structure',
        message: `Duplicate field "${field.name}" in record`,
        record: recNum,
        field: field.name,
      });
    }
    fieldNames.add(field.name);

    // Skip empty values
    if (!field.value && field.declaredLength === 0) continue;

    // Header field in record
    if (HEADER_FIELDS.has(field.name)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'structure',
        message: `"${field.name}" is a header-only field but appears in a QSO record`,
        record: recNum,
        field: field.name,
      });
    }

    // Track APP_ fields
    if (field.name.startsWith('APP_')) {
      const parts = field.name.match(/^APP_([A-Z0-9]+)_(.+)$/);
      if (parts) {
        const programId = parts[1];
        if (!extensions.appFields[programId]) {
          extensions.appFields[programId] = new Set();
        }
        extensions.appFields[programId].add(parts[2]);
      } else {
        issues.push({
          severity: SEV.WARNING,
          category: 'extension',
          message: `APP field "${field.name}" doesn't follow APP_{PROGRAMID}_{FIELDNAME} convention`,
          record: recNum,
          field: field.name,
        });
      }
      continue; // Don't validate APP_ field values against spec
    }

    // Check if field is known
    const fieldDef = FIELD_DEFS[field.name];
    if (!fieldDef && !/^USERDEF\d+$/.test(field.name)) {
      if (!extensions.unknownFields.includes(field.name)) {
        extensions.unknownFields.push(field.name);
      }
      continue;
    }

    if (!fieldDef) continue;

    // Type-specific validation
    validateFieldValue(field, fieldDef, recNum, issues);
  }

  // Cross-field validation within record
  crossFieldChecks(fieldMap, recNum, issues);
}

function validateFieldValue(field, fieldDef, recNum, issues) {
  const value = field.value;
  if (!value) return;

  const { type } = fieldDef;

  switch (type) {
    case 'D':
      validateDate(value, field.name, recNum, issues);
      break;
    case 'T':
      validateTime(value, field.name, recNum, issues);
      break;
    case 'B':
      validateBoolean(value, field.name, recNum, issues);
      break;
    case 'N':
      validateNumber(value, field.name, fieldDef, recNum, issues);
      break;
    case 'P':
      validatePositiveInteger(value, field.name, fieldDef, recNum, issues);
      break;
    case 'Int':
      validateInteger(value, field.name, recNum, issues);
      break;
    case 'G':
      validateGridSquare(value, field.name, recNum, issues);
      break;
    case 'L':
      validateLocation(value, field.name, recNum, issues);
      break;
    case 'IOTA':
      validateIOTA(value, field.name, recNum, issues);
      break;
    case 'SOTA':
      validateSOTA(value, field.name, recNum, issues);
      break;
    case 'POTALIST':
      validatePOTAList(value, field.name, recNum, issues);
      break;
    case 'WWFF':
      validateWWFF(value, field.name, recNum, issues);
      break;
    case 'E':
      validateEnumeration(value, field.name, fieldDef, recNum, issues);
      break;
    // S, I, M, IM - string types, no format validation needed
  }
}

function validateDate(value, fieldName, recNum, issues) {
  if (!/^\d{8}$/.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Expected YYYYMMDD format (8 digits), got "${value}"`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const year = parseInt(value.substring(0, 4), 10);
  const month = parseInt(value.substring(4, 6), 10);
  const day = parseInt(value.substring(6, 8), 10);

  if (year < 1930) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: `Year ${year} is before 1930`,
      record: recNum,
      field: fieldName,
    });
  }

  if (month < 1 || month > 12) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `Month ${month} is out of range (01-12)`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `Day ${day} is invalid for ${year}-${String(month).padStart(2, '0')} (max ${daysInMonth})`,
      record: recNum,
      field: fieldName,
    });
  }

  // Future date warning
  const dateVal = new Date(year, month - 1, day);
  if (dateVal > new Date()) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: `Date ${value} is in the future`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateTime(value, fieldName, recNum, issues) {
  if (!/^\d{4}$/.test(value) && !/^\d{6}$/.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Expected HHMM or HHMMSS format, got "${value}"`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const hours = parseInt(value.substring(0, 2), 10);
  const minutes = parseInt(value.substring(2, 4), 10);

  if (hours > 23) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `Hours ${hours} out of range (00-23)`,
      record: recNum,
      field: fieldName,
    });
  }
  if (minutes > 59) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `Minutes ${minutes} out of range (00-59)`,
      record: recNum,
      field: fieldName,
    });
  }

  if (value.length === 6) {
    const seconds = parseInt(value.substring(4, 6), 10);
    if (seconds > 59) {
      issues.push({
        severity: SEV.ERROR,
        category: 'value',
        message: `Seconds ${seconds} out of range (00-59)`,
        record: recNum,
        field: fieldName,
      });
    }
  }
}

function validateBoolean(value, fieldName, recNum, issues) {
  if (!/^[YyNn]$/.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Boolean field must be "Y" or "N", got "${value}"`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateNumber(value, fieldName, fieldDef, recNum, issues) {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Expected numeric value, got "${value}"`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const num = parseFloat(value);
  if (fieldDef.min !== undefined && num < fieldDef.min) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: `Value ${num} is below minimum ${fieldDef.min}`,
      record: recNum,
      field: fieldName,
    });
  }
  if (fieldDef.max !== undefined && num > fieldDef.max) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: `Value ${num} is above maximum ${fieldDef.max}`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validatePositiveInteger(value, fieldName, fieldDef, recNum, issues) {
  if (!/^\d+$/.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Expected positive integer, got "${value}"`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const num = parseInt(value, 10);
  if (fieldDef.min !== undefined && num < fieldDef.min) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: `Value ${num} is below minimum ${fieldDef.min}`,
      record: recNum,
      field: fieldName,
    });
  }
  if (fieldDef.max !== undefined && num > fieldDef.max) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: `Value ${num} is above maximum ${fieldDef.max}`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateInteger(value, fieldName, recNum, issues) {
  if (!/^-?\d+$/.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Expected integer, got "${value}"`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateGridSquare(value, fieldName, recNum, issues) {
  const len = value.length;
  if (![2, 4, 6, 8].includes(len)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Grid square must be 2, 4, 6, or 8 characters, got ${len} ("${value}")`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const upper = value.toUpperCase();

  // Chars 1-2: A-R
  if (!/^[A-R]{2}/.test(upper)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Grid field characters 1-2 must be A-R, got "${value.substring(0, 2)}"`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  if (len >= 4) {
    // Chars 3-4: 0-9
    if (!/^\d{2}$/.test(value.substring(2, 4))) {
      issues.push({
        severity: SEV.ERROR,
        category: 'format',
        message: `Grid square characters 3-4 must be digits, got "${value.substring(2, 4)}"`,
        record: recNum,
        field: fieldName,
      });
      return;
    }
  }

  if (len >= 6) {
    // Chars 5-6: A-X (case-insensitive)
    if (!/^[A-Xa-x]{2}$/.test(value.substring(4, 6))) {
      issues.push({
        severity: SEV.ERROR,
        category: 'format',
        message: `Grid square characters 5-6 must be A-X, got "${value.substring(4, 6)}"`,
        record: recNum,
        field: fieldName,
      });
      return;
    }
  }

  if (len === 8) {
    // Chars 7-8: 0-9
    if (!/^\d{2}$/.test(value.substring(6, 8))) {
      issues.push({
        severity: SEV.ERROR,
        category: 'format',
        message: `Grid square characters 7-8 must be digits, got "${value.substring(6, 8)}"`,
        record: recNum,
        field: fieldName,
      });
    }
  }
}

function validateLocation(value, fieldName, recNum, issues) {
  // Format: XDDD MM.MMM (11 chars)
  if (value.length !== 11) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Location must be 11 characters (XDDD MM.MMM), got ${value.length} ("${value}")`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const match = value.match(/^([NSEW])(\d{3}) (\d{2}\.\d{3})$/);
  if (!match) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `Location format must be XDDD MM.MMM (e.g., "N045 12.345"), got "${value}"`,
      record: recNum,
      field: fieldName,
    });
    return;
  }

  const dir = match[1];
  const degrees = parseInt(match[2], 10);
  const minutes = parseFloat(match[3]);

  const maxDeg = (dir === 'E' || dir === 'W') ? 180 : 90;
  if (degrees > maxDeg) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `Degrees ${degrees} exceeds maximum ${maxDeg} for ${dir === 'E' || dir === 'W' ? 'longitude' : 'latitude'}`,
      record: recNum,
      field: fieldName,
    });
  }
  if (minutes >= 60) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `Minutes ${minutes} must be less than 60`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateIOTA(value, fieldName, recNum, issues) {
  // Format: CC-NNN (e.g., NA-001)
  if (!/^(AF|AN|AS|EU|NA|OC|SA)-\d{3}$/.test(value.toUpperCase())) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `IOTA reference must be CC-NNN (e.g., NA-001), got "${value}"`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateSOTA(value, fieldName, recNum, issues) {
  // Format: association/region-NNN (e.g., G/LD-003, W4C/CM-001)
  if (!/^[A-Z0-9]{1,3}[A-Z0-9/]*\/[A-Z]{2}-\d{3}$/i.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `SOTA reference must be Assoc/Region-NNN (e.g., G/LD-003), got "${value}"`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validatePOTAList(value, fieldName, recNum, issues) {
  // Comma-separated list of POTA references
  const refs = value.split(',');
  for (const ref of refs) {
    const trimmed = ref.trim();
    if (!/^[A-Z0-9]{1,4}-\d+$/i.test(trimmed)) {
      issues.push({
        severity: SEV.ERROR,
        category: 'format',
        message: `POTA reference must be XX-NNNN (e.g., US-0001), got "${trimmed}"`,
        record: recNum,
        field: fieldName,
      });
    }
  }
}

function validateWWFF(value, fieldName, recNum, issues) {
  // Format: xxFF-nnnn (e.g., KFF-1234, DLFF-0001)
  if (!/^[A-Z0-9]{1,4}FF-\d{4}$/i.test(value)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'format',
      message: `WWFF reference must be xxFF-NNNN (e.g., KFF-1234), got "${value}"`,
      record: recNum,
      field: fieldName,
    });
  }
}

function validateEnumeration(value, fieldName, fieldDef, recNum, issues) {
  const enumName = fieldDef.enum;
  if (!enumName) return;

  // Special handling for enumerations we don't have full data for
  if (['DXCC', 'Primary_Subdivision', 'ARRL_Section', 'Region', 'Secondary_Subdivision'].includes(enumName)) {
    return; // Skip - too many values to enumerate, or advisory
  }

  const enumSet = ENUMERATIONS[enumName];
  if (!enumSet) return;

  const upper = value.toUpperCase();

  // Special handling for Band - case-insensitive with mixed case
  if (enumName === 'Band') {
    const bandKeys = Object.keys(BANDS);
    const found = bandKeys.some(b => b.toUpperCase() === upper);
    if (!found) {
      issues.push({
        severity: SEV.ERROR,
        category: 'value',
        message: `"${value}" is not a valid ADIF band`,
        record: recNum,
        field: fieldName,
      });
    }
    return;
  }

  // Special handling for Mode
  if (enumName === 'Mode') {
    if (!ENUMERATIONS.Mode.has(upper)) {
      // Check if it's actually a submode (common mistake)
      if (ALL_SUBMODES.has(upper)) {
        const parentMode = SUBMODE_TO_MODE[upper];
        issues.push({
          severity: SEV.WARNING,
          category: 'value',
          message: `"${value}" is a submode of ${parentMode}, not a mode. Use MODE:${parentMode} with SUBMODE:${value}`,
          record: recNum,
          field: fieldName,
        });
      } else {
        issues.push({
          severity: SEV.ERROR,
          category: 'value',
          message: `"${value}" is not a valid ADIF mode`,
          record: recNum,
          field: fieldName,
        });
      }
    }
    return;
  }

  // Special handling for Submode
  if (enumName === 'Submode') {
    if (!ALL_SUBMODES.has(upper)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'value',
        message: `"${value}" is not a recognized ADIF submode`,
        record: recNum,
        field: fieldName,
      });
    }
    return;
  }

  // General enum check
  if (!enumSet.has(upper)) {
    issues.push({
      severity: SEV.ERROR,
      category: 'value',
      message: `"${value}" is not a valid value for ${fieldName} (expected: ${[...enumSet].join(', ')})`,
      record: recNum,
      field: fieldName,
    });
  }
}

function crossFieldChecks(fieldMap, recNum, issues) {
  // Band/Frequency consistency
  if (fieldMap.BAND && fieldMap.FREQ) {
    checkBandFreqConsistency(fieldMap.BAND, fieldMap.FREQ, 'BAND', 'FREQ', recNum, issues);
  }
  if (fieldMap.BAND_RX && fieldMap.FREQ_RX) {
    checkBandFreqConsistency(fieldMap.BAND_RX, fieldMap.FREQ_RX, 'BAND_RX', 'FREQ_RX', recNum, issues);
  }

  // Frequency without band - suggest the correct band
  if (fieldMap.FREQ && !fieldMap.BAND) {
    const suggested = inferBandFromFreq(parseFloat(fieldMap.FREQ));
    if (suggested) {
      issues.push({
        severity: SEV.INFO,
        category: 'consistency',
        message: `FREQ ${fieldMap.FREQ} MHz corresponds to ${suggested} band, but BAND is not set`,
        record: recNum,
        field: 'BAND',
      });
    }
  }

  // Mode/Submode consistency
  if (fieldMap.MODE && fieldMap.SUBMODE) {
    const mode = fieldMap.MODE.toUpperCase();
    const submode = fieldMap.SUBMODE.toUpperCase();
    const modeDef = MODES[mode];
    if (modeDef) {
      const validSubs = modeDef.map(s => s.toUpperCase());
      if (validSubs.length > 0 && !validSubs.includes(submode)) {
        issues.push({
          severity: SEV.ERROR,
          category: 'value',
          message: `Submode "${fieldMap.SUBMODE}" is not valid for mode "${fieldMap.MODE}"`,
          record: recNum,
          field: 'SUBMODE',
        });
      } else if (validSubs.length === 0 && submode) {
        issues.push({
          severity: SEV.WARNING,
          category: 'value',
          message: `Mode "${fieldMap.MODE}" has no defined submodes, but SUBMODE "${fieldMap.SUBMODE}" is set`,
          record: recNum,
          field: 'SUBMODE',
        });
      }
    }
  }

  // RST vs MODE consistency
  if (fieldMap.MODE) {
    checkRstModeConsistency(fieldMap, recNum, issues);
  }

  // Satellite checks
  if (fieldMap.PROP_MODE && fieldMap.PROP_MODE.toUpperCase() === 'SAT') {
    if (!fieldMap.SAT_NAME) {
      issues.push({
        severity: SEV.WARNING,
        category: 'completeness',
        message: 'PROP_MODE is SAT but SAT_NAME is missing',
        record: recNum,
        field: 'SAT_NAME',
      });
    }
  }
  if (fieldMap.SAT_NAME && (!fieldMap.PROP_MODE || fieldMap.PROP_MODE.toUpperCase() !== 'SAT')) {
    issues.push({
      severity: SEV.WARNING,
      category: 'value',
      message: 'SAT_NAME is set but PROP_MODE is not SAT',
      record: recNum,
      field: 'PROP_MODE',
    });
  }

  // QSO_DATE / QSO_DATE_OFF consistency
  if (fieldMap.QSO_DATE && fieldMap.QSO_DATE_OFF) {
    if (fieldMap.QSO_DATE_OFF < fieldMap.QSO_DATE) {
      issues.push({
        severity: SEV.WARNING,
        category: 'value',
        message: `QSO_DATE_OFF (${fieldMap.QSO_DATE_OFF}) is before QSO_DATE (${fieldMap.QSO_DATE})`,
        record: recNum,
        field: 'QSO_DATE_OFF',
      });
    }
  }

  // SIG / SIG_INFO consistency
  if (fieldMap.SIG_INFO && !fieldMap.SIG) {
    issues.push({
      severity: SEV.WARNING,
      category: 'completeness',
      message: 'SIG_INFO is set but SIG is missing',
      record: recNum,
      field: 'SIG',
    });
  }
  if (fieldMap.MY_SIG_INFO && !fieldMap.MY_SIG) {
    issues.push({
      severity: SEV.WARNING,
      category: 'completeness',
      message: 'MY_SIG_INFO is set but MY_SIG is missing',
      record: recNum,
      field: 'MY_SIG',
    });
  }

  // STATE / GRIDSQUARE consistency (contacted station)
  if (fieldMap.STATE && fieldMap.GRIDSQUARE) {
    checkStateGridConsistency(fieldMap.STATE, fieldMap.GRIDSQUARE, fieldMap.DXCC, 'STATE', 'GRIDSQUARE', recNum, issues);
  }
  // MY_STATE / MY_GRIDSQUARE consistency
  if (fieldMap.MY_STATE && fieldMap.MY_GRIDSQUARE) {
    checkStateGridConsistency(fieldMap.MY_STATE, fieldMap.MY_GRIDSQUARE, fieldMap.MY_DXCC, 'MY_STATE', 'MY_GRIDSQUARE', recNum, issues);
  }

  // CNTY / STATE consistency
  if (fieldMap.CNTY && fieldMap.STATE) {
    checkCountyStateConsistency(fieldMap.CNTY, fieldMap.STATE, 'CNTY', 'STATE', recNum, issues);
  }
  if (fieldMap.MY_CNTY && fieldMap.MY_STATE) {
    checkCountyStateConsistency(fieldMap.MY_CNTY, fieldMap.MY_STATE, 'MY_CNTY', 'MY_STATE', recNum, issues);
  }

  // LAT/LON vs GRIDSQUARE consistency (contacted station)
  if (fieldMap.LAT && fieldMap.LON && fieldMap.GRIDSQUARE) {
    checkCoordGridConsistency(fieldMap.LAT, fieldMap.LON, fieldMap.GRIDSQUARE, 'GRIDSQUARE', recNum, issues);
  }
  // MY_LAT/MY_LON vs MY_GRIDSQUARE consistency
  if (fieldMap.MY_LAT && fieldMap.MY_LON && fieldMap.MY_GRIDSQUARE) {
    checkCoordGridConsistency(fieldMap.MY_LAT, fieldMap.MY_LON, fieldMap.MY_GRIDSQUARE, 'MY_GRIDSQUARE', recNum, issues);
  }

  // DXCC / STATE consistency
  if (fieldMap.DXCC && fieldMap.STATE) {
    checkDxccStateConsistency(fieldMap.DXCC, fieldMap.STATE, 'DXCC', 'STATE', recNum, issues);
  }
  if (fieldMap.MY_DXCC && fieldMap.MY_STATE) {
    checkDxccStateConsistency(fieldMap.MY_DXCC, fieldMap.MY_STATE, 'MY_DXCC', 'MY_STATE', recNum, issues);
  }

  // POTA reference country vs DXCC
  if (fieldMap.POTA_REF && fieldMap.DXCC) {
    checkPotaDxccConsistency(fieldMap.POTA_REF, fieldMap.DXCC, 'POTA_REF', recNum, issues);
  }
  if (fieldMap.MY_POTA_REF && fieldMap.MY_DXCC) {
    checkPotaDxccConsistency(fieldMap.MY_POTA_REF, fieldMap.MY_DXCC, 'MY_POTA_REF', recNum, issues);
  }
}

function checkBandFreqConsistency(bandValue, freqValue, bandField, freqField, recNum, issues) {
  const bandKey = bandValue.toLowerCase();
  const freq = parseFloat(freqValue);

  if (isNaN(freq)) return;

  const bandInfo = BANDS[bandKey];
  if (!bandInfo) return; // Unknown band, already reported

  if (freq < bandInfo.lower || freq > bandInfo.upper) {
    issues.push({
      severity: SEV.WARNING,
      category: 'consistency',
      message: `Frequency ${freq} MHz is outside ${bandValue} band range (${bandInfo.lower}-${bandInfo.upper} MHz)`,
      record: recNum,
      field: freqField,
    });
  }
}

function inferBandFromFreq(freq) {
  if (isNaN(freq)) return null;
  for (const [band, range] of Object.entries(BANDS)) {
    if (freq >= range.lower && freq <= range.upper) return band;
  }
  return null;
}

function checkRstModeConsistency(fieldMap, recNum, issues) {
  const mode = fieldMap.MODE.toUpperCase();
  const isPhone = PHONE_MODES.has(mode);
  const isCW = CW_MODES.has(mode);

  for (const [rstField, label] of [['RST_SENT', 'sent'], ['RST_RCVD', 'received']]) {
    const rst = fieldMap[rstField];
    if (!rst) continue;

    if (isPhone && /^\d{3}$/.test(rst)) {
      issues.push({
        severity: SEV.INFO,
        category: 'consistency',
        message: `RST ${label} "${rst}" is 3 digits (RST) but mode ${fieldMap.MODE} is a phone mode (expected 2-digit RS like "${rst.substring(0, 2)}")`,
        record: recNum,
        field: rstField,
      });
    } else if (isCW && /^\d{2}$/.test(rst)) {
      issues.push({
        severity: SEV.INFO,
        category: 'consistency',
        message: `RST ${label} "${rst}" is 2 digits (RS) but mode ${fieldMap.MODE} uses 3-digit RST (e.g., "${rst}9")`,
        record: recNum,
        field: rstField,
      });
    }
  }
}

function checkStateGridConsistency(state, grid, dxcc, stateField, gridField, recNum, issues) {
  if (grid.length < 2) return;
  const gridField2 = grid.substring(0, 2).toUpperCase();

  // Determine if this is a US state or Canadian province
  const stateUpper = state.toUpperCase();
  let validFields = US_STATE_GRID_FIELDS[stateUpper];

  if (!validFields) {
    validFields = CA_PROVINCE_GRID_FIELDS[stateUpper];
    if (!validFields) return; // Unknown state/province, can't validate
  }

  if (!validFields.includes(gridField2)) {
    issues.push({
      severity: SEV.WARNING,
      category: 'consistency',
      message: `Grid "${grid}" (field ${gridField2}) is not expected for ${stateField === 'MY_STATE' ? 'my ' : ''}state "${state}" (expected fields: ${validFields.join(', ')})`,
      record: recNum,
      field: gridField,
    });
  }
}

function checkCountyStateConsistency(cnty, state, cntyField, stateField, recNum, issues) {
  // ADIF county format: "SS,County Name" where SS is the state abbreviation
  const commaIdx = cnty.indexOf(',');
  if (commaIdx === -1) return; // Non-standard format, skip

  const cntyState = cnty.substring(0, commaIdx).toUpperCase();
  if (cntyState !== state.toUpperCase()) {
    issues.push({
      severity: SEV.WARNING,
      category: 'consistency',
      message: `County "${cnty}" has state prefix "${cntyState}" which doesn't match ${stateField} "${state}"`,
      record: recNum,
      field: cntyField,
    });
  }
}

function parseAdifLocation(locStr) {
  const match = locStr.match(/^([NSEW])(\d{3}) (\d{2}\.\d{3})$/);
  if (!match) return null;
  const dir = match[1];
  const degrees = parseInt(match[2], 10);
  const minutes = parseFloat(match[3]);
  let decimal = degrees + minutes / 60;
  if (dir === 'S' || dir === 'W') decimal = -decimal;
  return { decimal, dir };
}

function coordsToGrid(lat, lon) {
  // Convert lat/lon to 4-character Maidenhead grid
  const lonAdj = lon + 180;
  const latAdj = lat + 90;
  const lonField = String.fromCharCode(65 + Math.floor(lonAdj / 20));
  const latField = String.fromCharCode(65 + Math.floor(latAdj / 10));
  const lonSquare = Math.floor((lonAdj % 20) / 2);
  const latSquare = Math.floor(latAdj % 10);
  return `${lonField}${latField}${lonSquare}${latSquare}`;
}

function checkCoordGridConsistency(latStr, lonStr, grid, gridField, recNum, issues) {
  const lat = parseAdifLocation(latStr);
  const lon = parseAdifLocation(lonStr);
  if (!lat || !lon) return;

  // Verify lat is N/S and lon is E/W
  if (lat.dir !== 'N' && lat.dir !== 'S') return;
  if (lon.dir !== 'E' && lon.dir !== 'W') return;

  const computedGrid = coordsToGrid(lat.decimal, lon.decimal);
  const gridUpper = grid.toUpperCase();

  // Compare at the resolution available (4 chars from computation)
  if (gridUpper.length >= 4) {
    if (computedGrid !== gridUpper.substring(0, 4)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'consistency',
        message: `LAT/LON (${latStr}, ${lonStr}) corresponds to grid ${computedGrid} but ${gridField} is "${grid}"`,
        record: recNum,
        field: gridField,
      });
    }
  } else if (gridUpper.length === 2) {
    if (computedGrid.substring(0, 2) !== gridUpper) {
      issues.push({
        severity: SEV.WARNING,
        category: 'consistency',
        message: `LAT/LON (${latStr}, ${lonStr}) corresponds to field ${computedGrid.substring(0, 2)} but ${gridField} is "${grid}"`,
        record: recNum,
        field: gridField,
      });
    }
  }
}

function checkDxccStateConsistency(dxcc, state, dxccField, stateField, recNum, issues) {
  const dxccNum = parseInt(dxcc, 10);
  if (isNaN(dxccNum)) return;

  const stateUpper = state.toUpperCase();

  // Check if state is a US state
  if (US_STATE_GRID_FIELDS[stateUpper]) {
    // US state present - DXCC should be a US entity
    if (stateUpper === 'HI') {
      if (dxccNum !== 110 && dxccNum !== 291) {
        issues.push({
          severity: SEV.WARNING,
          category: 'consistency',
          message: `${stateField} is "HI" (Hawaii) but ${dxccField} is ${dxcc} (expected 110 for Hawaii or 291 for US)`,
          record: recNum,
          field: dxccField,
        });
      }
    } else if (stateUpper === 'AK') {
      if (dxccNum !== 6 && dxccNum !== 291) {
        issues.push({
          severity: SEV.WARNING,
          category: 'consistency',
          message: `${stateField} is "AK" (Alaska) but ${dxccField} is ${dxcc} (expected 6 for Alaska or 291 for US)`,
          record: recNum,
          field: dxccField,
        });
      }
    } else {
      if (dxccNum !== 291) {
        issues.push({
          severity: SEV.WARNING,
          category: 'consistency',
          message: `${stateField} is "${state}" (US state) but ${dxccField} is ${dxcc} (expected 291 for United States)`,
          record: recNum,
          field: dxccField,
        });
      }
    }
  }
}

function checkPotaDxccConsistency(potaRef, dxcc, potaField, recNum, issues) {
  const dxccNum = parseInt(dxcc, 10);
  if (isNaN(dxccNum)) return;

  // POTA refs can be comma-separated lists
  const refs = potaRef.split(',');
  for (const ref of refs) {
    const trimmed = ref.trim();
    const match = trimmed.match(/^([A-Z0-9]+)-\d+$/i);
    if (!match) continue;

    const prefix = match[1].toUpperCase();
    const validDxcc = POTA_PREFIX_TO_DXCC[prefix];
    if (validDxcc && !validDxcc.includes(dxccNum)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'consistency',
        message: `POTA reference "${trimmed}" has country prefix "${prefix}" which doesn't match DXCC entity ${dxcc}`,
        record: recNum,
        field: potaField,
      });
      break; // One warning per field is enough
    }
  }
}

function crossRecordChecks(records, issues) {
  if (records.length === 0) return;

  // Check for exact duplicate records
  const seen = new Map();
  for (const record of records) {
    const fm = {};
    for (const f of record.fields) { fm[f.name] = f.value; }

    const key = `${fm.CALL || ''}|${fm.QSO_DATE || ''}|${fm.TIME_ON || ''}|${fm.BAND || ''}|${fm.MODE || ''}`;
    if (key !== '||||' && seen.has(key)) {
      issues.push({
        severity: SEV.WARNING,
        category: 'duplicate',
        message: `Possible duplicate of record ${seen.get(key)} (same CALL, QSO_DATE, TIME_ON, BAND, MODE)`,
        record: record.index + 1,
        field: null,
      });
    } else {
      seen.set(key, record.index + 1);
    }
  }
}

function programSpecificChecks(parsed, issues, programInfo) {
  // Detect POTA usage
  let hasPota = false;
  const potaParks = new Set();

  for (const record of parsed.records) {
    const fm = {};
    for (const f of record.fields) { fm[f.name] = f.value; }
    const recNum = record.index + 1;

    // POTA checks
    if (fm.MY_SIG && fm.MY_SIG.toUpperCase() === 'POTA') {
      hasPota = true;
      if (fm.MY_SIG_INFO) {
        potaParks.add(fm.MY_SIG_INFO);
        // Check for multiple parks in MY_SIG_INFO (common error)
        if (fm.MY_SIG_INFO.includes(',')) {
          issues.push({
            severity: SEV.ERROR,
            category: 'pota',
            message: 'MY_SIG_INFO contains multiple park references (POTA requires one park per file)',
            record: recNum,
            field: 'MY_SIG_INFO',
          });
        }
      }

      // Check P2P consistency
      if (fm.SIG_INFO && !fm.SIG) {
        issues.push({
          severity: SEV.WARNING,
          category: 'pota',
          message: 'SIG_INFO is set for P2P contact but SIG is not set to "POTA"',
          record: recNum,
          field: 'SIG',
        });
      }
    }

    if (fm.MY_SIG_INFO && !fm.MY_SIG) {
      // Common issue: MY_SIG_INFO without MY_SIG
      if (/^[A-Z]{1,4}-\d+$/i.test(fm.MY_SIG_INFO)) {
        issues.push({
          severity: SEV.INFO,
          category: 'pota',
          message: `MY_SIG_INFO looks like a POTA reference ("${fm.MY_SIG_INFO}") but MY_SIG is not set`,
          record: recNum,
          field: 'MY_SIG',
        });
      }
    }

    // SOTA checks
    if (fm.MY_SOTA_REF || fm.SOTA_REF) {
      // Validate format is handled by field validator
    }

    // LoTW readiness
    if (fm.PROP_MODE && fm.PROP_MODE.toUpperCase() === 'SAT') {
      if (!fm.SAT_NAME) {
        issues.push({
          severity: SEV.INFO,
          category: 'lotw',
          message: 'Satellite QSO without SAT_NAME will not match in LoTW',
          record: recNum,
          field: 'SAT_NAME',
        });
      }
    }

    // Contest checks
    if (fm.CONTEST_ID) {
      if (!fm.SRX && !fm.SRX_STRING && !fm.STX && !fm.STX_STRING) {
        issues.push({
          severity: SEV.INFO,
          category: 'contest',
          message: 'CONTEST_ID is set but no exchange fields (SRX, STX, SRX_STRING, STX_STRING) are present',
          record: recNum,
          field: 'CONTEST_ID',
        });
      }
    }
  }

  // POTA file-level checks
  if (hasPota && potaParks.size > 1) {
    issues.push({
      severity: SEV.WARNING,
      category: 'pota',
      message: `Multiple parks found in MY_SIG_INFO across records: ${[...potaParks].join(', ')}. POTA expects one park per file.`,
      record: null,
      field: 'MY_SIG_INFO',
    });
  }
}

function collectExtensions(parsed, extensions) {
  // Also scan records for USERDEF fields
  const userDefNames = new Set();
  if (parsed.header && parsed.header.userDefs) {
    for (const ud of parsed.header.userDefs) {
      userDefNames.add(ud.fieldName.toUpperCase());
    }
  }

  for (const record of parsed.records) {
    for (const field of record.fields) {
      if (userDefNames.has(field.name)) {
        if (!extensions.userDefFields.includes(field.name)) {
          extensions.userDefFields.push(field.name);
        }
      }
    }
  }
}

// Generate summary statistics
export function generateSummary(parsed) {
  const summary = {
    totalRecords: parsed.records.length,
    hasHeader: !!parsed.header,
    adifVersion: null,
    programId: null,
    programVersion: null,
    bands: {},
    modes: {},
    callsigns: new Set(),
    dateRange: { earliest: null, latest: null },
    countries: new Set(),
    grids: new Set(),
    fieldUsage: {},
  };

  if (parsed.header) {
    for (const f of parsed.header.fields) {
      if (f.name === 'ADIF_VER') summary.adifVersion = f.value;
      if (f.name === 'PROGRAMID') summary.programId = f.value;
      if (f.name === 'PROGRAMVERSION') summary.programVersion = f.value;
    }
  }

  for (const record of parsed.records) {
    for (const field of record.fields) {
      // Track field usage
      summary.fieldUsage[field.name] = (summary.fieldUsage[field.name] || 0) + 1;

      switch (field.name) {
        case 'BAND':
          summary.bands[field.value.toUpperCase()] = (summary.bands[field.value.toUpperCase()] || 0) + 1;
          break;
        case 'MODE':
          summary.modes[field.value.toUpperCase()] = (summary.modes[field.value.toUpperCase()] || 0) + 1;
          break;
        case 'CALL':
          summary.callsigns.add(field.value.toUpperCase());
          break;
        case 'QSO_DATE':
          if (!summary.dateRange.earliest || field.value < summary.dateRange.earliest) {
            summary.dateRange.earliest = field.value;
          }
          if (!summary.dateRange.latest || field.value > summary.dateRange.latest) {
            summary.dateRange.latest = field.value;
          }
          break;
        case 'COUNTRY':
          summary.countries.add(field.value);
          break;
        case 'GRIDSQUARE':
          summary.grids.add(field.value.toUpperCase());
          break;
      }
    }
  }

  return summary;
}
