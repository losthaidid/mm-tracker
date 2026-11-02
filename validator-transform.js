/* Pure, previewed upload preparation. No template changes, persistence or numeric coercion. */
(function (root) {
  'use strict';
  const E = root.WorkHubValidatorEngine;
  const MAX_TEXT = E.LIMITS.text,
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
      throw Error('Preparation supports up to 200 columns, 25,000 rows and 5,000,000 cells.');
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
      throw Error('Prepared data exceeds 50 million text characters. Split the upload.');
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
            throw Error('Prepared data exceeds 50 million text characters. Split the upload.');
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
    if (options.mode && !['position', 'dependent'].includes(options.mode))
      throw Error('Choose positional lists or parent + dependent mapping.');
    if (options.mode === 'dependent') return dependent(headers, rows, options);
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
          'Expansion exceeds 25,000 rows or 5,000,000 cells. Split the upload or choose fewer values.'
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
          throw Error('Prepared data exceeds 50 million text characters. Split the upload.');
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
  // A grouped cell names its parents explicitly. Plain cells keep positional
  // pairing; there is deliberately no implicit Cartesian product or fallback.
  function dependentParts(parent, child, { delimiter = ',', trim = true, repeatSingle = false }) {
    const split = text => text.split(delimiter).map(v => (trim ? v.trim() : v));
    const parents = split(parent);
    if (
      parents.some(v => !v || /[()\[\]{}\r\n]/.test(v)) ||
      new Set(parents).size !== parents.length
    )
      throw Error('Dependent mapping needs distinct, nonblank parent values.');
    if (/[\[\]{}\r\n]/.test(child))
      throw Error(
        'Unsupported dependent format. Use (parent) values or a plain list paired by position.'
      );
    if (!/[()]/.test(child)) {
      const children = split(child);
      if (children.length !== parents.length && !(repeatSingle && children.length === 1))
        throw Error(
          parents.length +
            ' parent values, but ' +
            children.length +
            ' dependent values. Plain lists pair by position; use explicit groups for one-to-many values.'
        );
      return {
        format: 'Paired list',
        pairs: parents.map((p, i) => [p, children[children.length === 1 ? 0 : i]]),
      };
    }
    const groups = [...child.matchAll(/\(([^()]*)\)/g)],
      assignments = new Map(parents.map(p => [p, []]));
    if (!groups.length || child.slice(0, groups[0].index).trim())
      throw Error('Every grouped value must follow a (parent) marker.');
    let count = 0;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i],
        keys = split(group[1]);
      if (keys.some(k => !assignments.has(k)) || new Set(keys).size !== keys.length)
        throw Error(
          'A group names an unknown, blank or repeated parent. Match the parent list exactly.'
        );
      let text = child.slice(group.index + group[0].length, groups[i + 1]?.index ?? child.length);
      if (trim) text = text.trim();
      if (i < groups.length - 1 && text.trimEnd().endsWith(delimiter))
        text = text.trimEnd().slice(0, -delimiter.length);
      if (/[()]/.test(text)) throw Error('Unbalanced or nested parentheses in a dependent group.');
      const values = split(text);
      if (values.some(v => !v.trim()))
        throw Error('A grouped parent has an empty dependent value. Review this row.');
      count += values.length * keys.length;
      if (count > E.LIMITS.rows) throw Error('Expansion exceeds 25,000 rows. Split the upload.');
      for (const key of keys) assignments.get(key).push(...values);
    }
    if (parents.some(p => !assignments.get(p).length))
      throw Error('Every parent must have a dependent group. No parent will be silently dropped.');
    return { format: 'Grouped', pairs: parents.flatMap(p => assignments.get(p).map(v => [p, v])) };
  }
  function dependent(headers, rows, options) {
    inspect(headers, rows);
    const { primary, mapped = [], delimiter = ',' } = options;
    if (
      mapped.length !== 1 ||
      ![primary, mapped[0]].every(i => Number.isInteger(i) && i >= 0 && i < headers.length) ||
      mapped[0] === primary
    )
      throw Error('Choose one parent column and exactly one different dependent column.');
    if (
      typeof delimiter !== 'string' ||
      !delimiter.length ||
      delimiter.length > 5 ||
      /[()\r\n]/.test(delimiter)
    )
      throw Error(
        'Choose a literal delimiter of 1–5 characters without parentheses or line breaks.'
      );
    const plans = [],
      warnings = [],
      formats = { Grouped: 0, 'Paired list': 0 };
    let count = 0,
      changes = 0,
      warningCount = 0;
    rows.forEach((row, index) => {
      try {
        const plan = dependentParts(row[primary], row[mapped[0]], options);
        count += plan.pairs.length;
        if (count > E.LIMITS.rows || count * headers.length > E.LIMITS.cells)
          throw Error('Expansion exceeds 25,000 rows or 5,000,000 cells. Split the upload.');
        plans.push(plan);
        formats[plan.format]++;
        if (
          plan.pairs.length !== 1 ||
          plan.pairs[0][0] !== row[primary] ||
          plan.pairs[0][1] !== row[mapped[0]]
        )
          changes++;
      } catch (error) {
        if (/Expansion exceeds/.test(error.message)) throw error;
        warningCount++;
        if (warnings.length < SAMPLE_LIMIT)
          warnings.push({ index, field: headers[mapped[0]], message: error.message });
      }
    });
    if (warningCount)
      return {
        kind: 'explode',
        rows: [],
        parents: [],
        sample: [],
        columns: [primary, ...mapped],
        changes,
        outputCount: count,
        warningCount,
        warnings,
        blocked: true,
        formats,
      };
    const output = [],
      parents = [],
      sample = [];
    let size = 0;
    plans.forEach((plan, index) =>
      plan.pairs.forEach((pair, part) => {
        const next = rows[index].slice();
        next[primary] = pair[0];
        next[mapped[0]] = pair[1];
        size += next.reduce((n, value) => n + value.length, 0);
        if (size > MAX_TEXT)
          throw Error('Prepared data exceeds 50 million text characters. Split the upload.');
        output.push(next);
        parents.push({ index, part: plan.pairs.length > 1 ? String(part + 1) : '' });
        if (sample.length < SAMPLE_LIMIT)
          sample.push({ index, part: part + 1, format: plan.format, values: pair });
      })
    );
    return {
      kind: 'explode',
      rows: output,
      parents,
      sample,
      columns: [primary, ...mapped],
      changes,
      outputCount: count,
      warningCount: 0,
      warnings,
      blocked: false,
      formats,
    };
  }
  // Reconstruct the original combinations independently of current corrections.
  // Source row lineage, rather than a Material lookup, owns every child record.
  function recombine(headers, originalRows, sourceRows, origins, steps = [], headerRow = 1) {
    inspect(headers, originalRows);
    inspect(headers, sourceRows);
    if (!Array.isArray(origins) || origins.length !== sourceRows.length)
      throw Error('Original source row links are unavailable. Upload and prepare the file again.');
    let expected = originalRows,
      expectedOrigins = originalRows.map((_, i) => i);
    const splitColumns = new Set(),
      explosions = steps.filter(s => s.kind === 'explode');
    for (const step of explosions) {
      const plan = explode(headers, expected, step.options);
      if (plan.blocked)
        throw Error(
          'The original values cannot be paired with this preparation: ' + plan.warnings[0].message
        );
      expectedOrigins = plan.parents.map(p => expectedOrigins[p.index]);
      expected = plan.rows;
      for (const c of plan.columns) splitColumns.add(c);
    }
    const columns = [...splitColumns].sort((a, b) => a - b),
      groups = originalRows.map((original, index) => ({
        index,
        sourceRow: headerRow + index + 1,
        original,
        indices: [],
        expected: [],
        changed: [],
        conflicts: [],
        missing: [],
        extra: [],
        values: [],
        status: 'Match',
      }));
    expected.forEach((row, i) => groups[expectedOrigins[i]].expected.push(row));
    sourceRows.forEach((row, index) => {
      const parent = origins[index]?.row - headerRow - 1;
      if (!Number.isInteger(parent) || !groups[parent])
        throw Error('A working row has no original source row. Upload the file again.');
      groups[parent].indices.push(index);
    });
    const bag = records => {
      const result = new Map();
      for (const row of records) {
        const values = columns.map(c => row[c]),
          key = JSON.stringify(values);
        if (!result.has(key)) result.set(key, { values, count: 0 });
        result.get(key).count++;
      }
      return result;
    };
    for (const group of groups) {
      const current = group.indices.map(i => sourceRows[i]),
        before = bag(group.expected),
        after = bag(current);
      for (const [key, item] of before)
        if (item.count > (after.get(key)?.count || 0))
          group.missing.push({
            values: item.values,
            count: item.count - (after.get(key)?.count || 0),
          });
      for (const [key, item] of after)
        if (item.count > (before.get(key)?.count || 0))
          group.extra.push({
            values: item.values,
            count: item.count - (before.get(key)?.count || 0),
          });
      // Keep one list value for each split output row, preserving blanks and
      // duplicates. The complete tuples below retain relationships between fields.
      group.values = headers.map((_, c) => {
        const values = [...new Set(current.map(row => row[c]))];
        if (splitColumns.has(c)) return current.map(row => row[c]).join(', ');
        if (values.length > 1) group.conflicts.push(c);
        if (values.length !== 1 || values[0] !== group.original[c]) group.changed.push(c);
        return values.length > 1
          ? values.map(v => JSON.stringify(v)).join(' | ')
          : (values[0] ?? '');
      });
      // Display the common Plant / dependent case in its original group notation.
      if (explosions.length === 1 && explosions[0].options.mode === 'dependent') {
        const { primary, mapped } = explosions[0].options,
          paired = new Map();
        for (const row of current) {
          if (!paired.has(row[primary])) paired.set(row[primary], []);
          paired.get(row[primary]).push(row[mapped[0]]);
        }
        group.values[primary] = [...paired.keys()].join(', ');
        group.values[mapped[0]] = [...paired]
          .map(([parent, values]) => '(' + parent + ') ' + values.join(', '))
          .join(', ');
      }
      group.tuples = [...after.values()];
      // Highlight only the split fields whose value multiset differs. When
      // marginals match but pairings differ, highlight all combination fields.
      const changedSplit = columns.filter(c => {
        const counts = list => {
          const map = new Map();
          for (const row of list) map.set(row[c], (map.get(row[c]) || 0) + 1);
          return map;
        };
        const a = counts(group.expected),
          b = counts(current);
        return a.size !== b.size || [...a].some(([v, n]) => b.get(v) !== n);
      });
      if (group.missing.length || group.extra.length)
        group.changed.push(...(changedSplit.length ? changedSplit : columns));
      group.changed.sort((a, b) => a - b);
      group.status = !current.length
        ? 'Missing records'
        : group.conflicts.length
          ? 'Conflict'
          : group.changed.length || group.missing.length || group.extra.length
            ? 'Not match'
            : 'Match';
    }
    return {
      rows: groups,
      columns,
      headers,
      originalCount: originalRows.length,
      workingCount: sourceRows.length,
      matched: groups.filter(g => g.status === 'Match').length,
      different: groups.filter(g => g.status !== 'Match').length,
      conflicts: groups.filter(g => g.conflicts.length).length,
    };
  }
  root.WorkHubValidatorTransform = Object.freeze({
    sap,
    explode,
    convert,
    inspect,
    MAX_TEXT,
    recombine,
  });
})(typeof window === 'undefined' ? globalThis : window);
