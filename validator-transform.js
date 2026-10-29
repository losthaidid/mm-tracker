/* Pure, previewed upload preparation. No template changes, persistence or numeric coercion. */
(function (root) {
  'use strict';
  const E = root.WorkHubValidatorEngine;
  const MAX_TEXT = 12000000,
    SAMPLE_LIMIT = 12;
  function inspect(headers, rows) {
    if (
      !Array.isArray(headers) ||
      !headers.length ||
      headers.length > E.LIMITS.columns ||
      !Array.isArray(rows) ||
      rows.length > E.LIMITS.rows ||
      rows.length * headers.length > E.LIMITS.cells
    )
      throw Error('Preparation supports up to 200 columns, 5,000 rows and 200,000 cells.');
    let size = 0;
    for (const row of rows) {
      if (!Array.isArray(row)) throw Error('Choose a readable upload.');
      for (let i = 0; i < headers.length; i++) {
        if (typeof row[i] !== 'string' || row[i].length > 32000)
          throw Error('Upload values must be text up to 32,000 characters per cell.');
        size += row[i].length;
      }
    }
    if (size > MAX_TEXT)
      throw Error('Prepared data exceeds 12 million text characters. Split the upload.');
    return size;
  }
  function convert(value, column, mode = 'auto') {
    if (mode === 'keep' || E.blank(value)) return { value };
    const s = E.sapSettings(column),
      trimmed = value.trim();
    if (mode === 'zero' && !['CHAR', 'NUMC', 'CLNT'].includes(s.type))
      return { value, warning: 'Zero-padding is only supported for CHAR, NUMC and CLNT codes.' };
    if (!['auto', 'zero', 'keep'].includes(mode))
      throw Error('Choose a supported SAP formatting option.');
    let candidate = value;
    if (s.type === 'NUMC' || s.type === 'CLNT' || mode === 'zero') {
      if (!/^\d+$/.test(trimmed) || trimmed.length > s.length)
        return {
          value,
          warning: 'Not a digit-only code within the configured length. Kept unchanged.',
        };
      candidate = trimmed.padStart(s.length, '0');
    } else if (s.type === 'DATS' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      candidate = trimmed.replaceAll('-', '');
    } else if (s.type === 'TIMS' && /^\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
      candidate = trimmed.replaceAll(':', '').padEnd(6, '0');
    }
    // Invalid dates, signs, excess precision and unknown domain/conversion rules are never guessed.
    const problem = E.sapCheck(candidate, column);
    return problem ? { value, warning: problem + ' Kept unchanged.' } : { value: candidate };
  }
  function sap(headers, rows, schema, mapping, modes = {}) {
    if (schema.mode !== 'sap') throw Error('Apply SAP formatting requires a SAP template.');
    E.checkSchema(schema);
    E.mapRows(headers, [], schema, mapping);
    let size = inspect(headers, rows),
      changes = 0,
      warningCount = 0;
    const output = rows.map(r => r.slice()),
      sample = [],
      warnings = [];
    for (const c of schema.columns) {
      const index = Number(mapping[c.key]);
      if (index < 0) continue;
      const mode = modes[c.key] || 'auto';
      for (let i = 0; i < rows.length; i++) {
        const before = rows[i][index],
          next = convert(before, c, mode);
        if (next.warning) {
          warningCount++;
          if (warnings.length < SAMPLE_LIMIT)
            warnings.push({ index: i, field: c.label, message: next.warning });
        }
        if (next.value !== before) {
          size += next.value.length - before.length;
          if (size > MAX_TEXT)
            throw Error('Prepared data exceeds 12 million text characters. Split the upload.');
          output[i][index] = next.value;
          changes++;
          if (sample.length < SAMPLE_LIMIT)
            sample.push({ index: i, field: c.label, before, after: next.value });
        }
      }
    }
    return { kind: 'sap', rows: output, changes, warningCount, warnings, sample, blocked: false };
  }
  function explode(headers, rows, options) {
    inspect(headers, rows);
    const { primary, mapped = [], delimiter = ',', trim = true, repeatSingle = false } = options;
    const columns = [primary, ...mapped];
    if (
      columns.some(i => !Number.isInteger(i) || i < 0 || i >= headers.length) ||
      new Set(columns).size !== columns.length
    )
      throw Error('Choose one primary column and distinct mapped columns.');
    if (
      typeof delimiter !== 'string' ||
      !delimiter.length ||
      delimiter.length > 5 ||
      /[\r\n]/.test(delimiter)
    )
      throw Error('Choose a literal delimiter of 1–5 characters, without line breaks.');
    const split = value => value.split(delimiter).map(v => (trim ? v.trim() : v));
    const partCount = value => {
      let count = 1,
        from = 0,
        at;
      while ((at = value.indexOf(delimiter, from)) !== -1) {
        count++;
        from = at + delimiter.length;
      }
      return count;
    };
    const warnings = [],
      sample = [];
    let count = 0,
      changes = 0,
      warningCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const counts = columns.map(c => partCount(rows[i][c])),
        n = counts[0];
      count += n;
      if (count > E.LIMITS.rows || count * headers.length > E.LIMITS.cells)
        throw Error(
          'Expansion exceeds 5,000 rows or 200,000 cells. Split the upload or choose fewer values.'
        );
      for (let j = 1; j < counts.length; j++) {
        if (counts[j] !== n && !(repeatSingle && counts[j] === 1)) {
          warningCount++;
          if (warnings.length < SAMPLE_LIMIT)
            warnings.push({
              index: i,
              field: headers[columns[j]],
              message:
                n +
                ' primary values, but ' +
                counts[j] +
                ' mapped values. Fix the counts or explicitly repeat a single mapped value.',
            });
        }
      }
      if (counts.some(n => n > 1) || (trim && columns.some(c => rows[i][c].trim() !== rows[i][c])))
        changes++;
    }
    if (warningCount)
      return {
        kind: 'explode',
        rows: [],
        parents: [],
        changes,
        outputCount: count,
        warningCount,
        warnings,
        sample,
        blocked: true,
      };
    const output = [],
      parents = [];
    let size = 0;
    rows.forEach((row, i) => {
      const parts = columns.map(c => split(row[c]));
      const n = parts[0].length;
      for (let part = 0; part < n; part++) {
        const next = rows[i].slice();
        columns.forEach((c, j) => {
          next[c] = parts[j][parts[j].length === 1 ? 0 : part];
        });
        size += next.reduce((sum, v) => sum + v.length, 0);
        if (size > MAX_TEXT)
          throw Error('Prepared data exceeds 12 million text characters. Split the upload.');
        output.push(next);
        parents.push({ index: i, part: n > 1 ? String(part + 1) : '' });
        if (sample.length < SAMPLE_LIMIT)
          sample.push({ index: i, part: part + 1, values: columns.map(c => next[c]) });
      }
    });
    return {
      kind: 'explode',
      rows: output,
      parents,
      changes,
      outputCount: count,
      warningCount: 0,
      warnings,
      sample,
      blocked: false,
      columns,
    };
  }
  root.WorkHubValidatorTransform = Object.freeze({ sap, explode, convert, inspect, MAX_TEXT });
})(typeof window === 'undefined' ? globalThis : window);
