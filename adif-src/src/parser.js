// ADIF ADI format parser
// Parses the text-based tag-delimited ADIF format into structured data

export function parseAdif(text) {
  const result = {
    rawText: text,
    header: null,
    records: [],
    parseErrors: [],
  };

  if (!text || !text.trim()) {
    result.parseErrors.push({ message: 'File is empty', position: 0 });
    return result;
  }

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Parse all tags from the text
  const { tags, errors } = extractTags(text);
  result.parseErrors.push(...errors);

  // Find EOH to split header from records
  const eohIndex = tags.findIndex(t => t.name === 'EOH');

  let headerTags = [];
  let recordTags = [];

  if (eohIndex !== -1) {
    headerTags = tags.slice(0, eohIndex);
    recordTags = tags.slice(eohIndex + 1);

    // Extract free text before first header tag
    const firstTagPos = headerTags.length > 0
      ? headerTags[0].position
      : tags[eohIndex].position;
    const freeText = text.substring(0, firstTagPos).trim();

    result.header = {
      fields: headerTags.filter(t => t.name !== 'EOR').map(tagToField),
      userDefs: extractUserDefs(headerTags),
      freeText: freeText || null,
    };
  } else {
    recordTags = tags;
  }

  // Split record tags by EOR markers
  let currentFields = [];
  let recordIndex = 0;

  for (const tag of recordTags) {
    if (tag.name === 'EOR') {
      if (currentFields.length > 0) {
        result.records.push({
          index: recordIndex++,
          fields: currentFields.map(tagToField),
        });
        currentFields = [];
      }
    } else if (tag.name === 'EOH') {
      // Stray EOH in records section
      result.parseErrors.push({
        message: 'Unexpected <EOH> found in records section',
        position: tag.position,
      });
    } else {
      currentFields.push(tag);
    }
  }

  // Check for trailing fields without EOR
  if (currentFields.length > 0) {
    result.parseErrors.push({
      message: `Record ${recordIndex + 1} is missing <EOR> tag (${currentFields.length} field(s) without record terminator)`,
      position: currentFields[0].position,
    });
    // Still include the record
    result.records.push({
      index: recordIndex,
      fields: currentFields.map(tagToField),
      missingEor: true,
    });
  }

  return result;
}

function tagToField(tag) {
  return {
    name: tag.name,
    value: tag.value,
    declaredLength: tag.declaredLength,
    actualLength: tag.actualLength,
    typeIndicator: tag.typeIndicator,
    position: tag.position,
    lengthMismatch: tag.declaredLength !== null && tag.actualLength !== tag.declaredLength,
  };
}

function extractTags(text) {
  const tags = [];
  const errors = [];
  let pos = 0;

  while (pos < text.length) {
    // Find next '<'
    const tagStart = text.indexOf('<', pos);
    if (tagStart === -1) break;

    // Find closing '>'
    const tagEnd = text.indexOf('>', tagStart);
    if (tagEnd === -1) {
      errors.push({
        message: `Unclosed tag starting at position ${tagStart}`,
        position: tagStart,
      });
      break;
    }

    // Parse tag content between < and >
    const tagContent = text.substring(tagStart + 1, tagEnd).trim();

    if (!tagContent) {
      errors.push({
        message: 'Empty tag <> found',
        position: tagStart,
      });
      pos = tagEnd + 1;
      continue;
    }

    // Check for EOH or EOR (no length)
    if (/^eoh$/i.test(tagContent)) {
      tags.push({
        name: 'EOH',
        declaredLength: null,
        typeIndicator: null,
        value: '',
        actualLength: 0,
        position: tagStart,
      });
      pos = tagEnd + 1;
      continue;
    }

    if (/^eor$/i.test(tagContent)) {
      tags.push({
        name: 'EOR',
        declaredLength: null,
        typeIndicator: null,
        value: '',
        actualLength: 0,
        position: tagStart,
      });
      pos = tagEnd + 1;
      continue;
    }

    // Parse: FIELDNAME:LENGTH[:TYPE]
    const match = tagContent.match(/^([A-Za-z][A-Za-z0-9_]*)(?::(\d+)(?::([A-Za-z]))?)?$/);

    if (!match) {
      errors.push({
        message: `Invalid tag format: <${tagContent}>`,
        position: tagStart,
      });
      pos = tagEnd + 1;
      continue;
    }

    const fieldName = match[1].toUpperCase();
    const declaredLength = match[2] !== undefined ? parseInt(match[2], 10) : null;
    const typeIndicator = match[3] ? match[3].toUpperCase() : null;

    // Extract value based on declared length
    let value = '';
    let actualLength = 0;
    let valueEnd = tagEnd + 1;

    if (declaredLength !== null && declaredLength > 0) {
      value = text.substring(tagEnd + 1, tagEnd + 1 + declaredLength);
      actualLength = value.length;
      valueEnd = tagEnd + 1 + declaredLength;

      if (actualLength < declaredLength) {
        errors.push({
          message: `Field ${fieldName}: value is ${actualLength} chars but declared length is ${declaredLength} (unexpected end of file)`,
          position: tagStart,
        });
      }
    } else if (declaredLength === 0) {
      value = '';
      actualLength = 0;
    } else if (declaredLength === null) {
      // Tag without length - treat as a marker or invalid
      errors.push({
        message: `Field ${fieldName}: tag has no length specifier (expected <${fieldName}:LENGTH>)`,
        position: tagStart,
      });
    }

    tags.push({
      name: fieldName,
      declaredLength,
      typeIndicator,
      value,
      actualLength,
      position: tagStart,
    });

    pos = valueEnd;
  }

  return { tags, errors };
}

function extractUserDefs(headerTags) {
  const userDefs = [];

  for (const tag of headerTags) {
    const match = tag.name.match(/^USERDEF(\d+)$/);
    if (!match) continue;

    const id = parseInt(match[1], 10);
    const value = tag.value;

    // Parse: FIELDNAME[,{ENUM_OR_RANGE}]
    let fieldName = value;
    let enumValues = null;
    let range = null;

    const enumMatch = value.match(/^(.+?),\{(.+)\}$/);
    if (enumMatch) {
      fieldName = enumMatch[1];
      const enumContent = enumMatch[2];

      // Check if it's a range (N:M) or enum (A,B,C)
      const rangeMatch = enumContent.match(/^(-?[\d.]+):(-?[\d.]+)$/);
      if (rangeMatch) {
        range = { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
      } else {
        enumValues = enumContent.split(',').map(v => v.trim());
      }
    }

    userDefs.push({
      id,
      fieldName,
      typeIndicator: tag.typeIndicator,
      enumValues,
      range,
    });
  }

  return userDefs;
}

// Get the line number for a character position
export function getLineNumber(text, position) {
  let line = 1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}
