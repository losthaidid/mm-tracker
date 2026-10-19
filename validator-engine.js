/**
 * validator-engine.js
 * Declarative template/rule validation and row checks.
 * Saved definitions live under state.workhub.validator; uploaded row values are data, never code.
 * Pure schema/rule helpers are shared with the field library. Keep limits and type checks.
 * File map: docs/FILE-MAP.md
 */
/* A declarative validator. Uploaded values are data, never executable code. */
(function (root) {
  'use strict';
  const TYPES = ['text', 'integer', 'decimal', 'date', 'boolean'];
  const OPS = {
    eq: 'equals',
    neq: 'does not equal',
    empty: 'is empty',
    notEmpty: 'is not empty',
    gt: 'is greater than',
    gte: 'is at least',
    lt: 'is less than',
    lte: 'is at most',
    contains: 'contains',
    starts: 'starts with',
    ends: 'ends with',
    in: 'is in list',
    notIn: 'is not in list',
    fieldEq: 'equals field',
    fieldNeq: 'differs from field',
    fieldGte: 'is on/after field',
    fieldLte: 'is on/before field',
    lookup: 'exists in reference',
    lookupTuple: 'combination exists in reference',
    pattern: 'matches format',
  };
  const FORMATS = {
    digits: /^\d+$/,
    alphanumeric: /^[A-Za-z0-9]+$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^https?:\/\/[^\s]+$/i,
    identifier: /^[A-Za-z0-9_-]+$/,
  };
  const LIMITS = {
    templates: 60,
    columns: 80,
    rules: 100,
    rows: 5000,
    cells: 200000,
    lookups: 20,
    referenceRows: 2000,
    versions: 15,
    issues: 15000,
  };
  const copy = v => JSON.parse(JSON.stringify(v));
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'v' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const text = (v, n = 500) =>
    typeof v === 'string' && v.length <= n && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  const own = (r, k) => (Object.hasOwn(r || {}, k) ? r[k] : '');
  const blank = v => v === null || v === undefined || String(v).trim() === '';
  const tokens = v =>
    String(v || '')
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean);
  function column(index = 0) {
    return {
      id: uid(),
      key: 'FIELD_' + (index + 1),
      label: 'Column ' + (index + 1),
      type: 'text',
      required: false,
      unique: false,
      minLength: '',
      maxLength: '',
      min: '',
      max: '',
      values: '',
      aliases: '',
      trim: true,
      caseSensitive: false,
      format: '',
      description: '',
    };
  }
  function create(name = 'Untitled template') {
    return {
      id: uid(),
      name,
      description: '',
      columns: [],
      rules: [],
      lookups: [],
      uniqueGroups: [],
      releases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  function condition(field = '') {
    return { field, operator: 'eq', value: '', otherField: '', lookupId: '', lookupColumn: '' };
  }
  function group(field = '') {
    return { join: 'all', conditions: field ? [condition(field)] : [], groups: [] };
  }
  function rule(field = '') {
    return {
      id: uid(),
      name: 'New condition',
      severity: 'error',
      enabled: true,
      when: group(),
      assertion: { ...condition(field), operator: 'notEmpty' },
      message: '',
    };
  }
  function schema(t) {
    return copy({
      name: t.name,
      description: t.description,
      columns: t.columns,
      rules: t.rules,
      lookups: t.lookups,
      uniqueGroups: t.uniqueGroups,
    });
  }
  function checkSchema(t, allowEmpty = false) {
    if (!t || !text(t.name, 120) || !t.name.trim() || !text(t.description || '', 2000))
      throw Error('Give the template a name, up to 120 characters.');
    if (
      !Array.isArray(t.columns) ||
      t.columns.length > LIMITS.columns ||
      (!allowEmpty && !t.columns.length)
    )
      throw Error('Add between 1 and 80 columns.');
    const keys = new Set(),
      ids = new Set(),
      labels = new Set();
    for (const c of t.columns) {
      if (
        !c ||
        !text(c.id, 100) ||
        !c.id ||
        ids.has(c.id) ||
        !text(c.key, 64) ||
        !/^[A-Za-z_/][A-Za-z0-9_./-]*$/.test(c.key) ||
        ['constructor', 'prototype', '__proto__'].includes(c.key.toLowerCase()) ||
        keys.has(c.key.toLowerCase())
      )
        throw Error(
          'Technical field names must be unique, use letters, numbers, underscores, dots, slashes or hyphens.'
        );
      if (
        !text(c.label, 120) ||
        !c.label.trim() ||
        !TYPES.includes(c.type) ||
        !['required', 'unique', 'trim', 'caseSensitive'].every(k => typeof c[k] === 'boolean') ||
        !['values', 'aliases', 'description'].every(k => text(c[k] || '', 8000)) ||
        (c.format && !Object.hasOwn(FORMATS, c.format))
      )
        throw Error('Check the column labels, types and options.');
      for (const k of ['minLength', 'maxLength', 'min', 'max'])
        if (
          c[k] !== '' &&
          (!Number.isFinite(Number(c[k])) ||
            Math.abs(Number(c[k])) > 1e15 ||
            (['minLength', 'maxLength'].includes(k) &&
              (!Number.isInteger(Number(c[k])) || Number(c[k]) < 0 || Number(c[k]) > 32000)))
        )
          throw Error('Enter valid column limits.');
      if (
        (c.min !== '' && c.max !== '' && Number(c.min) > Number(c.max)) ||
        (c.minLength !== '' && c.maxLength !== '' && Number(c.minLength) > Number(c.maxLength))
      )
        throw Error('A minimum cannot be larger than its maximum.');
      if (labels.has(headerKey(c.label))) throw Error('Give each upload column a unique label.');
      labels.add(headerKey(c.label));
      keys.add(c.key.toLowerCase());
      ids.add(c.id);
    }
    const has = k => t.columns.some(c => c.key === k),
      references = new Map();
    if (!Array.isArray(t.lookups) || t.lookups.length > LIMITS.lookups)
      throw Error('Keep up to 20 reference lists per template.');
    for (const l of t.lookups) {
      if (
        !l ||
        !text(l.id, 100) ||
        !l.id ||
        references.has(l.id) ||
        !text(l.name, 120) ||
        !l.name.trim() ||
        !Array.isArray(l.headers) ||
        !l.headers.length ||
        l.headers.length > 30 ||
        l.headers.some(h => !text(h, 120) || !h.trim()) ||
        new Set(l.headers.map(h => h.toLowerCase())).size !== l.headers.length ||
        !Array.isArray(l.rows) ||
        l.rows.length > LIMITS.referenceRows ||
        l.rows.some(
          row =>
            !Array.isArray(row) || row.length > l.headers.length || row.some(v => !text(v, 2000))
        )
      )
        throw Error(
          'Check reference names, unique headers and reference values (up to 2,000 rows).'
        );
      if (
        l.codeColumn !== undefined &&
        (!text(l.codeColumn, 120) || !l.headers.includes(l.codeColumn))
      )
        throw Error('Choose the reference code column.');
      if (
        l.nameColumn !== undefined &&
        (!text(l.nameColumn, 120) || (l.nameColumn && !l.headers.includes(l.nameColumn)))
      )
        throw Error('Choose an existing reference display-name column.');
      if (
        l.descriptionColumns !== undefined &&
        (!Array.isArray(l.descriptionColumns) ||
          l.descriptionColumns.length > 5 ||
          new Set(l.descriptionColumns).size !== l.descriptionColumns.length ||
          l.descriptionColumns.some(k => !l.headers.includes(k)))
      )
        throw Error('Choose up to five existing reference description columns.');
      references.set(l.id, l);
    }
    if (!Array.isArray(t.rules) || t.rules.length > LIMITS.rules)
      throw Error('Keep up to 100 conditions per template.');
    function checkCondition(c) {
      if (
        !c ||
        !has(c.field) ||
        !Object.hasOwn(OPS, c.operator) ||
        !text(c.value || '', 8000) ||
        !text(c.otherField || '', 64)
      )
        throw Error('Every condition needs an existing field and a supported operator.');
      if (c.operator.startsWith('field') && !has(c.otherField))
        throw Error('Choose the other field for a field comparison.');
      if (
        c.operator === 'lookup' &&
        (!references.has(c.lookupId) ||
          !references.get(c.lookupId).headers.includes(c.lookupColumn))
      )
        throw Error('Choose an existing reference list and reference column.');
      if (c.operator === 'lookupTuple') {
        const l = references.get(c.lookupId);
        if (
          !l ||
          !Array.isArray(c.pairs) ||
          c.pairs.some(p => !p || typeof p !== 'object') ||
          c.pairs.length < 2 ||
          c.pairs.length > 10 ||
          new Set(c.pairs.map(p => p.field)).size !== c.pairs.length ||
          new Set(c.pairs.map(p => p.referenceColumn)).size !== c.pairs.length ||
          c.pairs.some(p => !p || !has(p.field) || !l.headers.includes(p.referenceColumn)) ||
          !c.pairs.some(p => p.field === c.field)
        )
          throw Error(
            'Map two to ten different upload fields to different reference columns, including the highlighted field.'
          );
      }
      if (c.operator === 'pattern' && !Object.hasOwn(FORMATS, c.value))
        throw Error('Choose a supported format.');
      const field = t.columns.find(f => f.key === c.field);
      if (
        ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(c.operator) &&
        !blank(c.value) &&
        comparable(c.value, field) === null
      )
        throw Error('Use a valid ' + field.type + ' value in the condition.');
      if (
        ['in', 'notIn'].includes(c.operator) &&
        (!tokens(c.value).length || tokens(c.value).some(v => comparable(v, field) === null))
      )
        throw Error('Provide valid values for the condition list.');
    }
    let count = 0;
    function checkGroup(g, depth = 0) {
      if (
        !g ||
        depth > 4 ||
        !['all', 'any'].includes(g.join) ||
        !Array.isArray(g.conditions) ||
        !Array.isArray(g.groups) ||
        g.conditions.length + g.groups.length > 30
      )
        throw Error('Condition groups support AND/OR and up to four nested levels.');
      if (depth && !allowEmpty && !g.conditions.length && !g.groups.length)
        throw Error('Add a condition to each nested group, or remove the empty group.');
      for (const c of g.conditions) {
        if (++count > 400) throw Error('Use up to 400 condition clauses.');
        checkCondition(c);
      }
      for (const child of g.groups) checkGroup(child, depth + 1);
    }
    const ruleIds = new Set();
    for (const r of t.rules) {
      if (
        !r ||
        !text(r.id, 100) ||
        !r.id ||
        ruleIds.has(r.id) ||
        !text(r.name, 160) ||
        !r.name.trim() ||
        !['error', 'warning'].includes(r.severity) ||
        typeof r.enabled !== 'boolean' ||
        !text(r.message || '', 1000)
      )
        throw Error('Check rule names, severity and messages.');
      ruleIds.add(r.id);
      checkGroup(r.when);
      checkCondition(r.assertion);
    }
    if (
      !Array.isArray(t.uniqueGroups) ||
      t.uniqueGroups.length > 20 ||
      t.uniqueGroups.some(
        g =>
          !Array.isArray(g) ||
          g.length < 2 ||
          g.length > 10 ||
          new Set(g).size !== g.length ||
          g.some(k => !has(k))
      )
    )
      throw Error('Unique combinations need two to ten different existing fields.');
    return t;
  }
  function upgrade(d) {
    if (!d.workhub) return d;
    if (d.workhub.validator === undefined) d.workhub.validator = { templates: [], runs: [] };
    return d;
  }
  function validateState(d) {
    const v = d.workhub?.validator;
    if (
      !v ||
      !Array.isArray(v.templates) ||
      v.templates.length > LIMITS.templates ||
      !Array.isArray(v.runs) ||
      v.runs.length > 150
    )
      throw Error('Check the validation workspace.');
    const ids = new Set();
    for (const t of v.templates) {
      if (
        !text(t.id, 100) ||
        !t.id ||
        ids.has(t.id) ||
        !text(t.createdAt, 50) ||
        !text(t.updatedAt, 50)
      )
        throw Error('Check template identifiers.');
      ids.add(t.id);
      checkSchema(t, true);
      if (!Array.isArray(t.releases) || t.releases.length > LIMITS.versions)
        throw Error('Keep up to 15 published versions per template.');
      let last = 0;
      for (const r of t.releases) {
        if (!Number.isInteger(r.version) || r.version <= last || !text(r.publishedAt, 50))
          throw Error('Check published template versions.');
        last = r.version;
        checkSchema(r.schema);
      }
    }
    const runIds = new Set();
    for (const r of v.runs) {
      if (
        !r ||
        !text(r.id, 100) ||
        !r.id ||
        runIds.has(r.id) ||
        !text(r.templateId, 100) ||
        !text(r.templateName, 120) ||
        !text(r.fileName, 240) ||
        !text(r.at, 50) ||
        !Number.isInteger(r.version) ||
        r.version < 0 ||
        ['rows', 'passed', 'errors', 'warnings'].some(
          k => !Number.isInteger(r[k]) || r[k] < 0 || r[k] > 10000000
        )
      )
        throw Error('Check validation run summaries.');
      runIds.add(r.id);
    }
    if (JSON.stringify(v).length > 6000000)
      throw Error(
        'Validation templates and reference lists exceed 6 MB. Remove unused versions or shorten reference lists.'
      );
  }
  function numeric(v) {
    const s = String(v).trim();
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s) && Number.isFinite(Number(s))
      ? Number(s)
      : null;
  }
  function date(v) {
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const n = Date.parse(s + 'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s ? s : null;
  }
  function normalized(v, c) {
    let s = String(v ?? '');
    if (c?.trim !== false) s = s.trim();
    return s;
  }
  function comparable(v, c) {
    const s = normalized(v, c);
    if (blank(s)) return null;
    if (['integer', 'decimal'].includes(c?.type)) return numeric(s);
    if (c?.type === 'date') return date(s);
    if (c?.type === 'boolean') {
      if (/^(true|yes|1)$/i.test(s)) return true;
      if (/^(false|no|0)$/i.test(s)) return false;
      return null;
    }
    return c?.caseSensitive ? s : s.toLowerCase();
  }
  function testCondition(c, row, t, cache) {
    const field = t.columns.find(f => f.key === c.field),
      raw = own(row, c.field),
      a = comparable(raw, field),
      other = t.columns.find(f => f.key === c.otherField),
      b = c.operator.startsWith('field')
        ? comparable(own(row, c.otherField), other)
        : comparable(c.value, field);
    switch (c.operator) {
      case 'empty':
        return blank(raw);
      case 'notEmpty':
        return !blank(raw);
      case 'eq':
        return a === b;
      case 'neq':
        return a !== b;
      case 'gt':
        return a !== null && b !== null && a > b;
      case 'gte':
        return a !== null && b !== null && a >= b;
      case 'lt':
        return a !== null && b !== null && a < b;
      case 'lte':
        return a !== null && b !== null && a <= b;
      case 'contains':
        return a !== null && b !== null && String(a).includes(String(b));
      case 'starts':
        return a !== null && b !== null && String(a).startsWith(String(b));
      case 'ends':
        return a !== null && b !== null && String(a).endsWith(String(b));
      case 'in':
        return tokens(c.value).some(x => comparable(x, field) === a);
      case 'notIn':
        return !tokens(c.value).some(x => comparable(x, field) === a);
      case 'fieldEq':
        return a === b;
      case 'fieldNeq':
        return a !== b;
      case 'fieldGte':
        return a !== null && b !== null && a >= b;
      case 'fieldLte':
        return a !== null && b !== null && a <= b;
      case 'pattern':
        return !blank(raw) && FORMATS[c.value].test(normalized(raw, field));
      case 'lookup': {
        const l = t.lookups.find(x => x.id === c.lookupId),
          i = l?.headers.indexOf(c.lookupColumn);
        if (!l || i < 0) return false;
        if (!cache) return l.rows.some(r => comparable(r[i], field) === a);
        const key = JSON.stringify([l.id, i, field.key]);
        if (!cache.has(key))
          cache.set(key, new Set(l.rows.map(r => JSON.stringify(comparable(r[i], field)))));
        return cache.get(key).has(JSON.stringify(a));
      }
      case 'lookupTuple':
        return referenceRows(c, row, t, cache).count > 0;
      default:
        return false;
    }
  }

  function referenceRows(c, row, t, cache = new Map()) {
    const l = t.lookups.find(l => l.id === c.lookupId);
    if (!l) return { rows: [], count: 0 };
    const pairs =
      c.operator === 'lookupTuple'
        ? c.pairs
        : [{ field: c.field, referenceColumn: c.lookupColumn }];
    if (!Array.isArray(pairs) || !pairs.length) return { rows: [], count: 0 };
    const mapping = pairs.map(p => ({
      field: t.columns.find(f => f.key === p.field),
      index: l.headers.indexOf(p.referenceColumn),
    }));
    if (mapping.some(m => !m.field || m.index < 0)) return { rows: [], count: 0 };
    const key = JSON.stringify(['reference-details', l.id, pairs]);
    if (!cache.has(key)) {
      const index = new Map();
      l.rows.forEach((r, i) => {
        const values = mapping.map(m => comparable(r[m.index], m.field));
        if (values.some(v => v === null)) return;
        const key = JSON.stringify(values);
        if (!index.has(key)) index.set(key, { rows: [], count: 0 });
        const match = index.get(key);
        match.count++;
        if (match.rows.length < 5) match.rows.push({ values: r, sourceRow: i + 2 });
      });
      cache.set(key, index);
    }
    const values = mapping.map(m => comparable(own(row, m.field.key), m.field));
    if (values.some(v => v === null)) return { rows: [], count: 0 };
    return cache.get(key).get(JSON.stringify(values)) || { rows: [], count: 0 };
  }
  function referenceDetails(t, row, cache = new Map()) {
    const conditions = [],
      seen = new Set(),
      out = [];
    const walk = g => {
      conditions.push(...g.conditions);
      g.groups.forEach(walk);
    };
    for (const r of t.rules)
      if (r.enabled) {
        walk(r.when);
        conditions.push(r.assertion);
      }
    for (const c of conditions) {
      if (!['lookup', 'lookupTuple'].includes(c.operator)) continue;
      const l = t.lookups.find(l => l.id === c.lookupId);
      if (!l || (!l.nameColumn && !l.descriptionColumns?.length)) continue;
      const signature = JSON.stringify([c.lookupId, c.operator, c.field, c.lookupColumn, c.pairs]);
      if (seen.has(signature)) continue;
      seen.add(signature);
      const match = referenceRows(c, row, t, cache),
        get = (r, k) => (k ? String(r[l.headers.indexOf(k)] ?? '') : '');
      for (const ref of match.rows)
        out.push({
          reference: l.name,
          code: get(ref.values, l.codeColumn || c.lookupColumn || c.pairs?.[0]?.referenceColumn),
          displayName: get(ref.values, l.nameColumn),
          description: (l.descriptionColumns || [])
            .map(k => k + ': ' + get(ref.values, k))
            .join('\n'),
          sourceRow: ref.sourceRow,
          matchCount: match.count,
          fields: (c.operator === 'lookupTuple' ? c.pairs.map(p => p.field) : [c.field]).map(
            k => t.columns.find(f => f.key === k)?.label || k
          ),
        });
    }
    return out;
  }

  function testGroup(g, row, t, cache) {
    const checks = [
      ...g.conditions.map(c => testCondition(c, row, t, cache)),
      ...g.groups.map(child => testGroup(child, row, t, cache)),
    ];
    return !checks.length || g.join === 'all' ? checks.every(Boolean) : checks.some(Boolean);
  }
  function describe(c, t) {
    const label = t.columns.find(f => f.key === c.field)?.label || c.field;
    return (
      label +
      ' ' +
      (OPS[c.operator] || c.operator) +
      (['empty', 'notEmpty'].includes(c.operator)
        ? ''
        : c.operator.startsWith('field')
          ? ' ' + (t.columns.find(f => f.key === c.otherField)?.label || c.otherField)
          : ['lookup', 'lookupTuple'].includes(c.operator)
            ? ' ' +
              (c.operator === 'lookupTuple'
                ? c.pairs
                    .map(
                      p =>
                        (t.columns.find(f => f.key === p.field)?.label || p.field) +
                        ' → ' +
                        p.referenceColumn
                    )
                    .join(' + ') + ' in '
                : '') +
              (t.lookups.find(l => l.id === c.lookupId)?.name || 'reference')
            : ' ' + (c.value || '…'))
    );
  }
  function validateRows(t, rows) {
    checkSchema(t);
    if (
      !Array.isArray(rows) ||
      rows.length > LIMITS.rows ||
      rows.length * t.columns.length > LIMITS.cells
    )
      throw Error('Validate up to 5,000 rows and 200,000 cells at a time.');
    const issues = [],
      status = rows.map(() => ({ errors: 0, warnings: 0 })),
      cache = new Map();
    let totalIssues = 0;
    function add(
      index,
      key,
      message,
      severity = 'error',
      ruleId = 'column',
      name = 'Column check'
    ) {
      totalIssues++;
      status[index][severity === 'warning' ? 'warnings' : 'errors']++;
      if (issues.length < LIMITS.issues)
        issues.push({
          row: index + 2,
          index,
          field: key,
          column: t.columns.find(c => c.key === key)?.label || key,
          value: String(own(rows[index], key) ?? '').slice(0, 1000),
          message,
          severity,
          ruleId,
          rule: name,
        });
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object' || Array.isArray(row))
        throw Error('Every data row must be a field/value record.');
      for (const c of t.columns) {
        const raw = own(row, c.key),
          v = normalized(raw, c);
        if (v.length > 32000) throw Error('A cell contains more than 32,000 characters.');
        if (blank(v)) {
          if (c.required) add(i, c.key, c.label + ' is required.');
          continue;
        }
        const n = comparable(v, c);
        if (c.type === 'integer' && (n === null || !Number.isSafeInteger(n)))
          add(i, c.key, 'Enter a whole number within the safe integer range.');
        if (c.type === 'decimal' && n === null)
          add(i, c.key, 'Enter a number using a dot as the decimal separator.');
        if (c.type === 'date' && n === null)
          add(i, c.key, 'Enter a real date in YYYY-MM-DD format.');
        if (c.type === 'boolean' && n === null) add(i, c.key, 'Use true/false, yes/no or 1/0.');
        if (c.minLength !== '' && v.length < Number(c.minLength))
          add(i, c.key, 'Use at least ' + c.minLength + ' characters.');
        if (c.maxLength !== '' && v.length > Number(c.maxLength))
          add(i, c.key, 'Use at most ' + c.maxLength + ' characters.');
        if (['integer', 'decimal'].includes(c.type) && n !== null) {
          if (c.min !== '' && n < Number(c.min))
            add(i, c.key, 'Value must be at least ' + c.min + '.');
          if (c.max !== '' && n > Number(c.max))
            add(i, c.key, 'Value must be at most ' + c.max + '.');
        }
        if (c.values && !tokens(c.values).some(x => comparable(x, c) === n))
          add(i, c.key, 'Choose a value from the allowed list.');
        if (c.format && !FORMATS[c.format].test(v))
          add(i, c.key, 'Use the ' + c.format + ' format.');
      }
      for (const r of t.rules)
        if (
          r.enabled &&
          testGroup(r.when, row, t, cache) &&
          !testCondition(r.assertion, row, t, cache)
        )
          add(
            i,
            r.assertion.field,
            r.message || describe(r.assertion, t) + '.',
            r.severity,
            r.id,
            r.name
          );
    }
    const groups = [...t.columns.filter(c => c.unique).map(c => [c.key]), ...t.uniqueGroups];
    for (const keys of groups) {
      const seen = new Map();
      rows.forEach((row, i) => {
        if (keys.some(k => blank(own(row, k)))) return;
        const value = JSON.stringify(
          keys.map(k =>
            comparable(
              own(row, k),
              t.columns.find(c => c.key === k)
            )
          )
        );
        if (!seen.has(value)) seen.set(value, []);
        seen.get(value).push(i);
      });
      for (const indices of seen.values())
        if (indices.length > 1)
          for (const i of indices)
            add(
              i,
              keys[0],
              (keys.length === 1
                ? 'Duplicate value.'
                : 'Duplicate combination: ' + keys.join(' + ') + '.') +
                ' Also appears on row ' +
                (indices.find(n => n !== i) + 2) +
                '.',
              'error',
              'unique',
              'Duplicate check'
            );
    }
    const errors = status.reduce((n, r) => n + r.errors, 0),
      warnings = status.reduce((n, r) => n + r.warnings, 0);
    return {
      rows: rows.length,
      passed: status.filter(r => !r.errors).length,
      clean: status.filter(r => !r.errors && !r.warnings).length,
      errors,
      warnings,
      issues,
      status,
      truncated: totalIssues > issues.length,
      totalIssues,
    };
  }
  function headerKey(v) {
    return String(v || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }
  function autoMap(headers, t) {
    const map = Object.create(null),
      used = new Set();
    for (const c of t.columns) {
      const names = [c.key, c.label, ...tokens(c.aliases)].map(headerKey),
        matches = headers
          .map((h, i) => (names.includes(headerKey(h)) ? i : -1))
          .filter(i => i >= 0 && !used.has(i));
      if (matches.length === 1) {
        map[c.key] = matches[0];
        used.add(matches[0]);
      } else map[c.key] = -1;
    }
    return map;
  }
  function mapRows(headers, data, t, mapping) {
    if (
      !headers.length ||
      headers.some(h => blank(h)) ||
      new Set(headers.map(headerKey)).size !== headers.length
    )
      throw Error('Upload headers must be nonblank and unique.');
    const indices = [];
    for (const c of t.columns) {
      const index = Number(mapping[c.key]);
      if (!Number.isInteger(index) || index < -1 || index >= headers.length)
        throw Error('Check column mapping.');
      if (index < 0 && c.required) throw Error('Map the required column ' + c.label + '.');
      if (index >= 0) indices.push(index);
    }
    if (new Set(indices).size !== indices.length)
      throw Error('An upload column can only be mapped once.');
    return data.map(row => {
      const out = Object.create(null);
      for (const c of t.columns)
        out[c.key] = Number(mapping[c.key]) < 0 ? '' : String(row[Number(mapping[c.key])] ?? '');
      return out;
    });
  }
  function parseCSV(input, delimiter = '') {
    const textValue = String(input).replace(/^\uFEFF/, '');
    if (textValue.length > 10000000) throw Error('Use a file below 10 MB.');
    if (!delimiter) {
      const count = { ',': 0, ';': 0, '\t': 0 };
      let q = false;
      for (let i = 0; i < textValue.length; i++) {
        const c = textValue[i];
        if (c === '"') {
          if (q && textValue[i + 1] === '"') i++;
          else q = !q;
        } else if (!q) {
          if (c === '\n' || c === '\r') break;
          if (Object.hasOwn(count, c)) count[c]++;
        }
      }
      delimiter = [',', ';', '\t'].sort((a, b) => count[b] - count[a])[0];
    }
    if (![',', ';', '\t'].includes(delimiter)) throw Error('Choose comma, semicolon or tab.');
    const rows = [];
    let row = [],
      cell = '',
      quoted = false,
      closed = false;
    const endCell = () => {
      row.push(cell);
      cell = '';
      closed = false;
      if (row.length > LIMITS.columns) throw Error('Use up to 80 upload columns.');
    };
    const endRow = () => {
      endCell();
      rows.push(row);
      row = [];
      if (rows.length > LIMITS.rows + 1) throw Error('Use up to 5,000 data rows.');
    };
    for (let i = 0; i < textValue.length; i++) {
      const c = textValue[i];
      if (quoted) {
        if (c === '"') {
          if (textValue[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            quoted = false;
            closed = true;
          }
        } else cell += c;
      } else if (c === '"') {
        if (cell || closed) throw Error('A CSV quote must begin a cell.');
        quoted = true;
      } else if (c === delimiter) endCell();
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && textValue[i + 1] === '\n') i++;
        endRow();
      } else {
        if (closed && c.trim()) throw Error('Unexpected text after a quoted CSV cell.');
        if (!closed) cell += c;
      }
    }
    if (quoted) throw Error('The CSV contains an unclosed quote.');
    if (cell || row.length || closed) endRow();
    while (rows.length && rows.at(-1).every(v => v === '')) rows.pop();
    return rows;
  }
  function csv(rows) {
    return (
      '\uFEFF' +
      rows
        .map(row =>
          row
            .map(v => {
              let s = String(v ?? '');
              if (/^[\s]*[=+@\t\r]/.test(s) || /^\s*-(?!\d+(?:\.\d+)?$)/.test(s)) s = "'" + s;
              return '"' + s.replace(/"/g, '""') + '"';
            })
            .join(',')
        )
        .join('\r\n')
    );
  }
  function example() {
    const t = create('Project intake');
    t.description =
      'A ready-to-explore example. Change every field and condition to make it yours.';
    t.columns = [
      ['REQUEST_ID', 'Request ID', 'text'],
      ['TYPE', 'Request type', 'text'],
      ['OWNER', 'Owner', 'text'],
      ['AMOUNT', 'Amount', 'decimal'],
      ['START_DATE', 'Start date', 'date'],
      ['END_DATE', 'End date', 'date'],
    ].map(([key, label, type], i) => ({
      ...column(i),
      key,
      label,
      type,
      required: ['REQUEST_ID', 'TYPE', 'START_DATE', 'END_DATE'].includes(key),
      unique: key === 'REQUEST_ID',
      values: key === 'TYPE' ? 'Standard\nUrgent' : '',
      min: key === 'AMOUNT' ? '0' : '',
    }));
    const r = rule('OWNER');
    r.name = 'Urgent requests need an owner';
    r.when.conditions = [{ ...condition('TYPE'), value: 'Urgent' }];
    r.message = 'Assign an owner before submitting an urgent request.';
    const dates = rule('END_DATE');
    dates.name = 'End follows start';
    dates.assertion = { ...condition('END_DATE'), operator: 'fieldGte', otherField: 'START_DATE' };
    dates.message = 'End date must be on or after the start date.';
    const review = rule('AMOUNT');
    review.name = 'Review larger requests';
    review.severity = 'warning';
    review.assertion = { ...condition('AMOUNT'), operator: 'lte', value: '10000' };
    review.message = 'Confirm approval for amounts above 10,000.';
    review.when.conditions = [{ ...condition('AMOUNT'), operator: 'notEmpty' }];
    t.rules = [r, dates, review];
    return t;
  }
  function prepare(next, previous, restoring = false) {
    if (restoring) return;
    for (const t of next.workhub?.validator?.templates || []) {
      const old = previous?.workhub?.validator?.templates.find(p => p.id === t.id);
      if (!old) continue;
      for (const release of old.releases) {
        const retained = t.releases.find(r => r.version === release.version);
        if (!retained || JSON.stringify(retained) !== JSON.stringify(release))
          throw Error(
            'Published versions are frozen. Copy a version into the draft to make changes.'
          );
      }
    }
  }
  root.WorkHubValidatorEngine = Object.freeze({
    TYPES,
    OPS,
    FORMATS,
    LIMITS,
    uid,
    copy,
    column,
    create,
    condition,
    group,
    rule,
    schema,
    checkSchema,
    upgrade,
    validateState,
    prepare,
    validateRows,
    testCondition,
    testGroup,
    referenceRows,
    referenceDetails,
    describe,
    headerKey,
    autoMap,
    mapRows,
    parseCSV,
    csv,
    example,
    blank,
    tokens,
  });
})(typeof window !== 'undefined' ? window : globalThis);
