/** Two independent files: group exploded B by exact keys and compare with original A. */
(function (root) {
  'use strict';
  const E = root.WorkHubValidatorEngine,
    F = root.WorkHubValidatorFiles;
  const text = value => String(value ?? '');
  const normalizeHeader = value =>
    text(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  const list = value => [
    ...new Set(
      text(value)
        .split(',')
        .map(v => v.trim())
    ),
  ];
  const equalValues = (a, b) => {
    const x = new Set(a),
      y = new Set(b);
    return x.size === y.size && [...x].every(v => y.has(v));
  };
  function sheet(book, index = 0, headerRow = 1) {
    return {
      ...root.WorkHubValidatorCompareEngine.sheet(book, index, headerRow),
      numericText: book.sheets[index].numericText || {},
    };
  }
  function autoFields(a, b) {
    const fields = a.headers.map((header, index) => {
      const key = normalizeHeader(header),
        matches = b.headers
          .map((h, i) => (normalizeHeader(h) === key && key ? i : -1))
          .filter(i => i >= 0);
      return {
        a: index,
        b: matches.length === 1 ? matches[0] : -1,
        include: true,
        key: false,
        mode: /descr|maktx|name|note|comment|text/.test(key) ? 'text' : 'values',
      };
    });
    const keys = fields.filter(
      f =>
        f.b >= 0 &&
        /^(material|materialnumber|materialno|matnr|id|recordid|code)$/.test(
          normalizeHeader(a.headers[f.a])
        )
    );
    if (keys.length === 1) keys[0].key = true;
    return fields;
  }
  function autoRelationship(a, fields) {
    const find = expression =>
      fields.find(f => f.include && f.b >= 0 && expression.test(normalizeHeader(a.headers[f.a])))
        ?.a ?? -1;
    const parent = find(/^(plant|werks)$/),
      dependent = find(/^(storage|storagelocation|sloc|lgort)$/);
    return { enabled: parent >= 0 && dependent >= 0, parent, dependent };
  }
  function configure(a, b, settings) {
    const fields = (settings.fields || [])
      .filter(f => f.include || f.key)
      .map(f => ({ ...f, include: true }));
    if (!fields.length || fields.length > E.LIMITS.columns)
      throw Error('Select at least one field to compare.');
    if (
      fields.some(
        f =>
          !Number.isInteger(f.a) ||
          f.a < 0 ||
          f.a >= a.headers.length ||
          !Number.isInteger(f.b) ||
          f.b < -1 ||
          f.b >= b.headers.length ||
          !['text', 'values'].includes(f.mode)
      )
    )
      throw Error('Map fields from the currently selected worksheets.');
    if (
      new Set(fields.map(f => f.a)).size !== fields.length ||
      new Set(fields.filter(f => f.b >= 0).map(f => f.b)).size !==
        fields.filter(f => f.b >= 0).length
    )
      throw Error('Map each File A and File B column only once.');
    const keys = fields.filter(f => f.key);
    if (!keys.length || keys.some(f => f.b < 0))
      throw Error('Choose and map at least one matching key column.');
    const relationship = { ...settings.relationship };
    if (
      relationship.enabled &&
      (relationship.parent === relationship.dependent ||
        ![relationship.parent, relationship.dependent].every(c =>
          fields.some(f => f.a === c && f.b >= 0)
        ))
    )
      throw Error('Choose two different mapped comparison fields for the parent/dependent check.');
    return { fields, keys, relationship };
  }
  function sourceValue(source, index, field, side) {
    const c = field[side.toLowerCase()],
      row = source.rows[index];
    if (c < 0 || !row) return '';
    const identifier =
      field.key ||
      /^(material|materialnumber|materialno|matnr)$/.test(normalizeHeader(source.headers[c]));
    return text(
      (identifier ? source.numericText?.[c]?.[source.headerRow + index] : undefined) ?? row[c]
    );
  }
  function cell(report, rowIndex, fieldIndex) {
    const row = report.rows[rowIndex],
      f = report.fields[fieldIndex];
    if (!row || !f) throw Error('Choose a record and field from this comparison.');
    const a = row.aIndex === null ? '' : sourceValue(report.a, row.aIndex, f, 'A');
    const b = row.ambiguous
      ? ''
      : (row.bValues?.[fieldIndex] ??
        (row.bIndices.length ? sourceValue(report.b, row.bIndices[0], f, 'B') : ''));
    const hasA = row.aIndex !== null,
      hasB = !row.ambiguous && row.bIndices.length > 0 && f.b >= 0;
    let match = hasA && hasB && !row.blankKey;
    if (match) {
      const semantic = row.pair?.expectedValues?.[f.a] ?? row.originalValues?.[f.a];
      match = f.key
        ? a === b
        : f.mode === 'text'
          ? a === b
          : a === b || equalValues(semantic || list(a), list(b));
      if (
        row.pair &&
        (row.pair.error || row.pair.missing.length || row.pair.extra.length) &&
        [report.relationship.parent, report.relationship.dependent].includes(f.a)
      )
        match = false;
    }
    return {
      a,
      b,
      hasA,
      hasB,
      match,
      reason: row.ambiguous
        ? 'Ambiguous key in File A'
        : row.blankKey
          ? 'Blank matching key'
          : !hasA
            ? 'Extra record in File B'
            : !row.bIndices.length
              ? 'Missing record in File B'
              : f.b < 0
                ? 'Missing mapped column in File B'
                : match
                  ? 'Match'
                  : 'Different values or assignments',
    };
  }
  async function compare(
    a,
    b,
    settings,
    { pause = () => Promise.resolve(), cancelled = () => false } = {}
  ) {
    const { fields, keys, relationship } = configure(a, b, settings),
      indexA = new Map(),
      indexB = new Map(),
      blankB = [];
    async function tick() {
      await pause();
      if (cancelled()) {
        const e = Error('Recombination cancelled.');
        e.name = 'AbortError';
        throw e;
      }
    }
    function key(source, index, side) {
      const values = keys.map(f => sourceValue(source, index, f, side));
      return values.some(v => v.trim() === '') ? null : JSON.stringify(values);
    }
    for (let i = 0; i < a.rows.length; i++) {
      if (!(i % 128)) await tick();
      const k = key(a, i, 'A');
      if (k !== null) {
        if (!indexA.has(k)) indexA.set(k, []);
        indexA.get(k).push(i);
      }
    }
    for (let i = 0; i < b.rows.length; i++) {
      if (!(i % 128)) await tick();
      const k = key(b, i, 'B');
      if (k === null) {
        blankB.push({ key: null, indices: [i] });
        continue;
      }
      if (!indexB.has(k)) indexB.set(k, { key: k, indices: [] });
      indexB.get(k).indices.push(i);
    }
    const report = {
      a,
      b,
      fields,
      keys,
      relationship,
      rows: [],
      matched: 0,
      different: 0,
      missing: 0,
      extra: 0,
      ambiguous: 0,
      blankKeys: 0,
      differentFields: 0,
      generatedAt: new Date().toISOString(),
      bGroups: indexB.size + blankB.length,
    };
    async function aggregate(group) {
      if (!group || group.indices.length <= 1 || group.values) return group?.values;
      group.values = [];
      for (let j = 0; j < fields.length; j++) {
        if (!(j % 16) && group.indices.length * fields.length >= 20000) await tick();
        const f = fields[j],
          values = new Set();
        for (const i of group.indices) {
          const value = sourceValue(b, i, f, 'B');
          if (!f.key && f.mode === 'values') for (const item of list(value)) values.add(item);
          else values.add(value);
        }
        group.values.push([...values].join(', '));
      }
      return group.values;
    }
    function pairings(row) {
      if (!relationship.enabled || row.aIndex === null || row.ambiguous || !row.bIndices.length)
        return null;
      const p = fields.find(f => f.a === relationship.parent),
        d = fields.find(f => f.a === relationship.dependent),
        pair = { missing: [], extra: [], error: '', expectedValues: null };
      try {
        const plan = root.WorkHubValidatorTransform.explode(
          ['Parent', 'Dependent'],
          [[sourceValue(a, row.aIndex, p, 'A'), sourceValue(a, row.aIndex, d, 'A')]],
          { mode: 'dependent', primary: 0, mapped: [1], trim: true }
        );
        if (plan.blocked) throw Error('File A assignments: ' + plan.warnings[0].message);
        const expected = new Map(plan.rows.map(v => [JSON.stringify(v), v])),
          actual = new Map();
        for (const i of row.bIndices) {
          const values = [sourceValue(b, i, p, 'B').trim(), sourceValue(b, i, d, 'B').trim()];
          if (values.some(v => /[,()\r\n]/.test(v)) || !values[0])
            throw Error(
              'File B must have one parent and dependent value per exploded row to check assignments.'
            );
          actual.set(JSON.stringify(values), values);
        }
        pair.missing = [...expected].filter(([k]) => !actual.has(k)).map(([, v]) => v);
        pair.extra = [...actual].filter(([k]) => !expected.has(k)).map(([, v]) => v);
        pair.expectedValues = {
          [p.a]: [...new Set(plan.rows.map(v => v[0]))],
          [d.a]: [...new Set(plan.rows.map(v => v[1]))],
        };
      } catch (error) {
        pair.error = error.message;
      }
      return pair;
    }
    async function add(aIndex, group, k, ambiguous = false) {
      if (!(report.rows.length % 128)) await tick();
      const row = {
        aIndex,
        bIndices: group?.indices || [],
        key: k,
        ambiguous,
        blankKey: k === null,
        bValues: ambiguous ? null : await aggregate(group),
        changed: [],
        status: 'Match',
      };
      row.pair = pairings(row);
      // Group notation can still be compared as values when assignment checking
      // is switched off, including when the parent column itself is excluded.
      const dependent = fields.find(f => f.a === relationship.dependent);
      if (
        !relationship.enabled &&
        !ambiguous &&
        row.bIndices.length &&
        aIndex !== null &&
        dependent?.mode === 'values' &&
        dependent.b >= 0 &&
        Number.isInteger(relationship.parent) &&
        relationship.parent >= 0 &&
        relationship.parent < a.headers.length
      ) {
        const parent = { a: relationship.parent, b: -1, key: false };
        try {
          const plan = root.WorkHubValidatorTransform.explode(
            ['Parent', 'Dependent'],
            [[sourceValue(a, aIndex, parent, 'A'), sourceValue(a, aIndex, dependent, 'A')]],
            { mode: 'dependent', primary: 0, mapped: [1], trim: true }
          );
          if (!plan.blocked)
            row.originalValues = { [dependent.a]: [...new Set(plan.rows.map(v => v[1]))] };
        } catch {
          /* Unsupported notation remains a literal value difference. */
        }
      }
      const i = report.rows.length;
      report.rows.push(row);
      for (let j = 0; j < fields.length; j++) if (!cell(report, i, j).match) row.changed.push(j);
      row.status = ambiguous
        ? 'Ambiguous key'
        : row.blankKey
          ? 'Blank key'
          : aIndex === null
            ? 'Extra record'
            : !row.bIndices.length
              ? 'Missing record'
              : row.pair?.error
                ? 'Review assignments'
                : row.changed.length
                  ? 'Not match'
                  : 'Match';
      if (row.status === 'Match') report.matched++;
      else report.different++;
      if (row.status === 'Missing record') report.missing++;
      if (row.status === 'Extra record') report.extra++;
      if (ambiguous) report.ambiguous++;
      if (row.blankKey) report.blankKeys++;
      report.differentFields += row.changed.length;
    }
    for (let i = 0; i < a.rows.length; i++) {
      const k = key(a, i, 'A');
      await add(i, k === null ? null : indexB.get(k), k, k !== null && indexA.get(k).length > 1);
    }
    for (const [k, group] of indexB) if (!indexA.has(k)) await add(null, group, k);
    for (const group of blankB) await add(null, group, null);
    await tick();
    report.match = !report.different;
    return report;
  }
  function rowKey(report, row) {
    const source = row.aIndex === null ? report.b : report.a,
      index = row.aIndex === null ? row.bIndices[0] : row.aIndex,
      side = row.aIndex === null ? 'B' : 'A';
    return report.keys
      .map(f => (report.a.headers[f.a] || F.col(f.a)) + ': ' + sourceValue(source, index, f, side))
      .join(' · ');
  }
  function rowReferences(source, indices) {
    const out = [];
    let start = null,
      end = null;
    for (const index of indices) {
      const n = source.headerRow + index + 1;
      if (end !== null && n === end + 1) end = n;
      else {
        if (start !== null) out.push(start === end ? String(start) : start + '–' + end);
        start = end = n;
      }
    }
    if (start !== null) out.push(start === end ? String(start) : start + '–' + end);
    return out.join(', ');
  }
  function detail(row) {
    return row.ambiguous
      ? 'File A key repeats. Add another unchanged key column; File B values are unassigned.'
      : row.blankKey
        ? 'A selected matching key is blank.'
        : row.pair?.error ||
          (row.pair
            ? row.pair.missing.length +
              ' missing / ' +
              row.pair.extra.length +
              ' extra distinct parent/dependent combinations.'
            : '');
  }
  function reportSheets(report) {
    const limit = 32000,
      label = 'Original vs Recombined',
      style = (value, bad) => ({ value: text(value), style: bad ? 2 : 0 });
    const endAt = (value, start) => {
      let end = Math.min(start + limit, value.length);
      if (
        end < value.length &&
        /[\uD800-\uDBFF]/.test(value[end - 1]) &&
        /[\uDC00-\uDFFF]/.test(value[end])
      )
        end--;
      return end;
    };
    const partCount = value => {
      let n = 0;
      for (let start = 0; start < value.length; start = endAt(value, start)) n++;
      return n;
    };
    const slice = (value, part) => {
      value = text(value);
      let start = 0;
      for (let i = 0; i < part && start < value.length; i++) start = endAt(value, start);
      return value.slice(start, endAt(value, start));
    };
    const fieldLabel = (source, index) => (source.headers[index] || F.col(index)).slice(0, 120);
    const headers = [
      'Comparison record',
      'Result',
      'Key preview',
      'File A worksheet',
      'File A Excel row',
      'File B worksheet',
      'File B Excel rows',
      'Part',
      'Details',
      ...report.fields.flatMap(f => [
        'A · ' + fieldLabel(report.a, f.a),
        'Recombined B · ' + (f.b < 0 ? 'Missing column' : fieldLabel(report.b, f.b)),
        'Field result',
      ]),
    ];
    const descriptors = report.rows.map((r, i) => {
      const refs = rowReferences(report.b, r.bIndices),
        details =
          detail(r) +
          (r.pair
            ? '\nMissing assignments: ' +
              r.pair.missing.map(p => JSON.stringify(p)).join(', ') +
              '\nExtra assignments: ' +
              r.pair.extra.map(p => JSON.stringify(p)).join(', ')
            : '');
      let parts = Math.max(1, partCount(refs), partCount(details));
      for (let j = 0; j < report.fields.length; j++) {
        const c = cell(report, i, j);
        parts = Math.max(parts, partCount(c.a), partCount(c.b));
      }
      return { parts, refs, details };
    });
    function* rows(onlyDifferent) {
      yield headers;
      if (onlyDifferent)
        yield [
          label,
          report.match ? 'Match' : 'Not match',
          '',
          '',
          '',
          '',
          '',
          '',
          `${report.a.fileName} (${report.a.rows.length} original rows) / ${report.b.fileName} (${report.b.rows.length} exploded rows); ${report.bGroups} recombined B keys; ${report.matched} matching records; ${report.different} different records; ${report.ambiguous} ambiguous original records. Distinct comma-list values compare without order; matching keys and Exact text fields compare literally. Formula cells use saved values.`,
        ];
      for (let i = 0; i < report.rows.length; i++) {
        const r = report.rows[i],
          desc = descriptors[i];
        if (onlyDifferent && r.status === 'Match') continue;
        for (let part = 0; part < desc.parts; part++) {
          const key = rowKey(report, r),
            out = [
              i + 1,
              style(r.status, r.status !== 'Match'),
              key.length > 160 ? key.slice(0, 160) + '… (full keys in field columns)' : key,
              report.a.sheet,
              r.aIndex === null ? 'Missing' : report.a.headerRow + r.aIndex + 1,
              report.b.sheet,
              slice(desc.refs, part),
              `${part + 1}/${desc.parts}`,
              slice(desc.details, part),
            ];
          for (let j = 0; j < report.fields.length; j++) {
            const c = cell(report, i, j);
            out.push(
              style(slice(c.a, part), !c.match),
              style(r.ambiguous ? '(Unassigned — ambiguous key)' : slice(c.b, part), !c.match),
              style(c.match ? 'Match' : c.reason, !c.match)
            );
          }
          yield out;
        }
      }
    }
    const count = onlyDifferent =>
      1 +
      (onlyDifferent ? 1 : 0) +
      descriptors.reduce(
        (n, d, i) => n + (!onlyDifferent || report.rows[i].status !== 'Match' ? d.parts : 0),
        0
      );
    return [
      {
        name: 'Summary',
        escapeText: true,
        keepTogether: true,
        width: headers.length,
        rowCount: count(true),
        rows: () => rows(true),
      },
      {
        name: 'Field Comparison',
        escapeText: true,
        keepTogether: true,
        width: headers.length,
        rowCount: count(false),
        rows: () => rows(false),
      },
    ];
  }
  root.WorkHubValidatorReconcileEngine = Object.freeze({
    sheet,
    autoFields,
    autoRelationship,
    configure,
    compare,
    cell,
    rowKey,
    rowReferences,
    detail,
    reportSheets,
    normalizeHeader,
  });
})(window);
