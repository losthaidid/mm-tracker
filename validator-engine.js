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
    columns: 200,
    rules: 100,
    requirements: 200,
    additionalRequirements: 400,
    rows: 25000,
    cells: 5000000,
    fileBytes: 50000000,
    text: 50000000,
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
  // SAP DDIC field formats, using ABAP 7.54's documented technical limits.
  // Domain values/conversion exits and TCURX scaling are deliberately configured separately.
  const SAP_TYPES = Object.freeze({
    CHAR: {
      label: 'Character',
      min: 1,
      max: 30000,
      length: 255,
      format: 'Text up to the configured length',
    },
    NUMC: {
      label: 'Numeric text',
      min: 1,
      max: 255,
      length: 10,
      format: 'Digits only, exactly the configured length; preserve leading zeros',
    },
    DATS: {
      label: 'Date',
      length: 8,
      format: 'YYYYMMDD; real calendar date or SAP initial 00000000',
    },
    TIMS: { label: 'Time', length: 6, format: 'HHMMSS, 000000–235959' },
    CLNT: { label: 'Client', length: 3, format: 'Three-digit internal client key, e.g. 100' },
    LANG: {
      label: 'Language key',
      length: 1,
      format: 'One-character internal SAP key, e.g. E; use References for valid keys',
    },
    CUKY: {
      label: 'Currency key',
      length: 5,
      format: 'Internal currency key up to 5 characters; use References for valid keys',
    },
    UNIT: {
      label: 'Unit key',
      min: 2,
      max: 3,
      length: 3,
      format: 'Internal unit key up to the configured length; use References for valid keys',
    },
    DEC: {
      label: 'Packed decimal',
      min: 1,
      max: 31,
      length: 15,
      decimals: 2,
      format:
        'Signed decimal with a dot; configured total digits and scale, no grouping or exponent',
    },
    CURR: {
      label: 'Currency amount',
      min: 1,
      max: 31,
      length: 15,
      decimals: 2,
      format:
        'DDIC amount digits/scale; currency display scaling depends on your SAP configuration',
    },
    QUAN: {
      label: 'Quantity',
      min: 1,
      max: 31,
      length: 13,
      decimals: 3,
      format: 'DDIC quantity digits/scale, decimal point is a dot',
    },
    INT1: {
      label: '1-byte integer',
      length: 3,
      range: ['0', '255'],
      format: 'Whole number from 0 to 255',
    },
    INT2: {
      label: '2-byte integer',
      length: 5,
      range: ['-32768', '32767'],
      format: 'Whole number from -32768 to 32767',
    },
    INT4: {
      label: '4-byte integer',
      length: 10,
      range: ['-2147483648', '2147483647'],
      format: 'Whole number from -2147483648 to 2147483647',
    },
    INT8: {
      label: '8-byte integer',
      length: 19,
      range: ['-9223372036854775808', '9223372036854775807'],
      format: '64-bit whole number; keep Excel cells as Text to preserve every digit',
    },
    SSTRING: {
      label: 'Short string',
      min: 1,
      max: 1333,
      length: 255,
      format: 'Text up to the configured maximum length',
    },
    STRING: {
      label: 'Variable string',
      min: 1,
      max: 32000,
      length: 32000,
      format: 'Variable text; this workspace supports up to 32000 characters per cell',
    },
    RAW: {
      label: 'Byte field',
      min: 1,
      max: 255,
      length: 16,
      format: 'Hexadecimal bytes: exactly two hex characters per configured byte',
    },
  });
  const sapMode = t => t?.mode === 'sap';
  function sapSettings(c) {
    const type = c.sapType || { integer: 'INT4', decimal: 'DEC', date: 'DATS' }[c.type] || 'CHAR';
    const spec = SAP_TYPES[type];
    return {
      type,
      spec,
      length: c.sapLength === '' || c.sapLength === undefined ? spec?.length : Number(c.sapLength),
      decimals:
        c.sapDecimals === '' || c.sapDecimals === undefined
          ? spec?.decimals || 0
          : Number(c.sapDecimals),
      reference: c.sapReference || '',
    };
  }
  function checkSAPColumn(c, t) {
    const { type, spec, length, decimals, reference } = sapSettings(c);
    if (
      (c.sapType !== undefined && !text(c.sapType, 20)) ||
      ['sapLength', 'sapDecimals'].some(
        k =>
          c[k] !== undefined &&
          c[k] !== '' &&
          !(
            (typeof c[k] === 'number' && Number.isFinite(c[k])) ||
            (typeof c[k] === 'string' && /^\d+$/.test(c[k]))
          )
      ) ||
      !Object.hasOwn(SAP_TYPES, type) ||
      !Number.isInteger(length) ||
      (spec.min ? length < spec.min || length > spec.max : length !== spec.length)
    )
      throw Error(c.label + ': choose a supported SAP type and valid DDIC length.');
    if (
      !Number.isInteger(decimals) ||
      decimals < (type === 'CURR' ? 1 : 0) ||
      decimals > (spec.decimals !== undefined ? Math.min(length, 14) : 0)
    )
      throw Error(
        c.label +
          ': check SAP decimal places (maximum 14, within the field length; CURR needs at least 1).'
      );
    if (
      !text(reference, 64) ||
      (reference &&
        (!['CURR', 'QUAN'].includes(type) ||
          !t.columns.some(
            f => f.key === reference && sapSettings(f).type === (type === 'CURR' ? 'CUKY' : 'UNIT')
          )))
    )
      throw Error(c.label + ': choose a CUKY field for CURR or a UNIT field for QUAN.');
  }
  function sapCheck(value, c) {
    const v = normalized(value, c),
      { type, spec, length, decimals } = sapSettings(c);
    if (!Object.hasOwn(SAP_TYPES, type)) return 'Choose a supported SAP type.';
    if (spec.range) {
      if (!/^[+-]?\d+$/.test(v)) return type + ' requires a whole number.';
      const n = BigInt(v);
      return n < BigInt(spec.range[0]) || n > BigInt(spec.range[1]) ? spec.format + '.' : '';
    }
    if (spec.decimals !== undefined) {
      if (!/^[+-]?\d+(?:\.\d+)?$/.test(v))
        return type + ' requires a plain decimal using a dot, without grouping or exponents.';
      const [whole, fraction = ''] = v.replace(/^[+-]/, '').split('.');
      if (fraction.length > decimals || whole.replace(/^0+/, '').length > length - decimals)
        return type + ' allows ' + length + ' total digits with ' + decimals + ' decimal places.';
      return '';
    }
    if (type === 'DATS') {
      if (v === '00000000') return '';
      return /^\d{8}$/.test(v) &&
        v.slice(0, 4) !== '0000' &&
        date(v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6))
        ? ''
        : 'DATS requires a real YYYYMMDD date, or SAP initial 00000000.';
    }
    if (type === 'TIMS')
      return /^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(v)
        ? ''
        : 'TIMS requires HHMMSS from 000000 to 235959.';
    if (type === 'NUMC' || type === 'CLNT')
      return /^\d+$/.test(v) && v.length === length
        ? ''
        : type + ' requires exactly ' + length + ' digits; keep leading zeros.';
    if (type === 'RAW')
      return /^[0-9a-f]+$/i.test(v) && v.length === length * 2
        ? ''
        : 'RAW requires exactly ' + length * 2 + ' hexadecimal characters (' + length + ' bytes).';
    return v.length <= length && (type !== 'LANG' || v.length === 1)
      ? ''
      : type + ' allows ' + length + ' character' + (length === 1 ? '' : 's') + '.';
  }
  function sapComparable(v, c) {
    const s = normalized(v, c),
      { type, spec } = sapSettings(c);
    if (sapCheck(s, c)) return null;
    if (spec.range || spec.decimals !== undefined) {
      const negative = s.startsWith('-'),
        [a, b = ''] = s.replace(/^[+-]/, '').split('.');
      const n = BigInt(a + b.padEnd(14, '0'));
      return negative ? -n : n;
    }
    return c.caseSensitive ? s : s.toLowerCase();
  }
  const valueKey = v =>
    JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? 'SAP#' + x.toString() : x));
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
      sapType: '',
      sapLength: '',
      sapDecimals: '',
      sapReference: '',
    };
  }
  function create(name = 'Untitled template') {
    return {
      id: uid(),
      name,
      description: '',
      mode: 'general',
      projectId: '',
      projectName: '',
      columns: [],
      rules: [],
      lookups: [],
      uniqueGroups: [],
      columnGroups: [],
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
      companyScope: 'all',
      companies: [],
      when: group(),
      assertion: { ...condition(field), operator: 'notEmpty' },
      message: '',
    };
  }
  // Keep the original single requirement compatible with saved definitions.
  function requirements(r) {
    return [r.assertion, ...(r.additionalAssertions || [])];
  }
  function describeRequirements(r, t) {
    return requirements(r)
      .map(c => describe(c, t))
      .join(' AND ');
  }
  function schema(t) {
    return copy({
      name: t.name,
      description: t.description,
      mode: t.mode || 'general',
      projectId: t.projectId || '',
      projectName: t.projectName || '',
      columns: t.columns,
      rules: t.rules,
      lookups: t.lookups,
      uniqueGroups: t.uniqueGroups,
      columnGroups: t.columnGroups || [],
    });
  }
  const GROUP_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn'];
  function resolveCondition(c, t) {
    if (c.valueSource !== 'group') return c;
    const g = t.columnGroups?.find(g => g.id === c.groupId),
      set = g?.sets.find(v => v.id === c.valueSetId);
    if (!g || !set || !g.fields.includes(c.field) || !GROUP_OPS.includes(c.operator))
      throw Error(
        'Choose an existing column group, value set and grouped field for this condition.'
      );
    return { ...c, value: set.values[c.field] };
  }
  function groupReferences(t, id, setId = '') {
    const found = [];
    const clause = c => {
      if (c.valueSource === 'group' && c.groupId === id && (!setId || c.valueSetId === setId))
        found.push(c);
    };
    const walk = g => {
      g.conditions.forEach(clause);
      g.groups.forEach(walk);
    };
    t.rules.forEach(r => {
      walk(r.when);
      requirements(r).forEach(clause);
    });
    return found;
  }
  function checkColumnGroups(t) {
    if (t.columnGroups === undefined) return;
    if (!Array.isArray(t.columnGroups) || t.columnGroups.length > 40)
      throw Error('Use up to 40 column groups.');
    const ids = new Set(),
      names = new Set();
    for (const g of t.columnGroups) {
      if (
        !g ||
        !text(g.id, 100) ||
        !g.id ||
        ids.has(g.id) ||
        !text(g.name, 120) ||
        !g.name.trim() ||
        names.has(g.name.trim().toLowerCase()) ||
        !Array.isArray(g.fields) ||
        !g.fields.length ||
        g.fields.length > 200 ||
        new Set(g.fields).size !== g.fields.length ||
        g.fields.some(key => !t.columns.some(c => c.key === key)) ||
        !Array.isArray(g.sets) ||
        !g.sets.length ||
        g.sets.length > 30
      )
        throw Error(
          'Column groups need unique names, existing fields and one to thirty value sets.'
        );
      ids.add(g.id);
      names.add(g.name.trim().toLowerCase());
      const setIds = new Set(),
        setNames = new Set();
      for (const v of g.sets) {
        if (
          !v ||
          !text(v.id, 100) ||
          !v.id ||
          setIds.has(v.id) ||
          !text(v.name, 120) ||
          !v.name.trim() ||
          setNames.has(v.name.trim().toLowerCase()) ||
          !v.values ||
          typeof v.values !== 'object' ||
          Array.isArray(v.values) ||
          Object.keys(v.values).length !== g.fields.length ||
          Object.keys(v.values).some(k => !g.fields.includes(k)) ||
          g.fields.some(k => !Object.hasOwn(v.values, k) || !text(v.values[k], 8000))
        )
          throw Error('Value sets need unique names and a value list for every grouped column.');
        setIds.add(v.id);
        setNames.add(v.name.trim().toLowerCase());
        for (const key of g.fields) {
          const field = t.columns.find(c => c.key === key);
          if (
            tokens(v.values[key]).some(
              value =>
                comparable(value, field, t.mode) === null ||
                (sapMode(t) && !!sapCheck(value, field))
            )
          )
            throw Error(
              'Use valid ' + (sapMode(t) ? 'SAP ' : '') + 'values for grouped column ' + key + '.'
            );
        }
      }
    }
  }
  // Review decisions stay with the current in-memory upload; no source values are saved.
  function issueKey(issue) {
    const key = [issue.index, issue.field, issue.ruleId, issue.message, issue.severity];
    if (issue.requirementIndex !== undefined) key.push(issue.requirementIndex);
    return JSON.stringify(key);
  }
  function reviewIssues(raw, rows, decisions = new Map()) {
    const result = copy(raw),
      snapshots = new Map();
    result.ignored = 0;
    result.ignoredErrors = 0;
    result.ignoredWarnings = 0;
    result.rawErrors = raw.errors;
    result.rawWarnings = raw.warnings;
    result.status.forEach(s => {
      s.ignored = 0;
    });
    for (const issue of result.issues) {
      const decision = decisions.get(issueKey(issue));
      if (!decision) continue;
      if (!snapshots.has(issue.index))
        snapshots.set(issue.index, JSON.stringify(rows[issue.index]));
      if (decision.row !== snapshots.get(issue.index)) continue;
      if (!text(decision.reason || '', 500))
        throw Error('Keep the ignore reason within 500 characters.');
      issue.ignored = true;
      issue.ignoreReason = decision.reason || '';
      const kind = issue.severity === 'warning' ? 'warnings' : 'errors';
      result.status[issue.index][kind]--;
      result.status[issue.index].ignored++;
      result[kind]--;
      result.ignored++;
      result[issue.severity === 'warning' ? 'ignoredWarnings' : 'ignoredErrors']++;
    }
    result.passed = result.status.filter(s => !s.errors).length;
    result.clean = result.status.filter(s => !s.errors && !s.warnings && !s.ignored).length;
    return result;
  }
  function checkSchema(t, allowEmpty = false) {
    if (!t || !text(t.name, 120) || !t.name.trim() || !text(t.description || '', 2000))
      throw Error('Give the template a name, up to 120 characters.');
    if (
      !Array.isArray(t.columns) ||
      t.columns.length > LIMITS.columns ||
      (!allowEmpty && !t.columns.length)
    )
      throw Error('Add between 1 and 200 columns.');
    if (t.mode !== undefined && !['general', 'sap'].includes(t.mode))
      throw Error('Choose General or SAP validation.');
    if (!text(t.projectId || '', 100) || !text(t.projectName || '', 200))
      throw Error('Check the linked project.');
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
      if (sapMode(t)) checkSAPColumn(c, t);
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
    checkColumnGroups(t);
    function checkCondition(c) {
      if (c?.valueSource !== undefined && !['literal', 'group'].includes(c.valueSource))
        throw Error('Choose a condition value source.');
      c = resolveCondition(c || {}, t);
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
        comparable(c.value, field, t.mode) === null
      )
        throw Error(
          'Use a valid ' +
            (sapMode(t) ? sapSettings(field).type : field.type) +
            ' value in the condition.'
        );
      if (
        ['in', 'notIn'].includes(c.operator) &&
        (!tokens(c.value).length ||
          tokens(c.value).some(v => comparable(v, field, t.mode) === null))
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
    let requirementCount = 0;
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
      if (
        !['all', 'selected'].includes(r.companyScope || 'all') ||
        (r.companies !== undefined && !Array.isArray(r.companies)) ||
        (r.companies || []).length > 200 ||
        (r.companies || []).some(
          c => !c || !text(c.id, 100) || !c.id.trim() || !text(c.name, 200) || !c.name.trim()
        ) ||
        new Set((r.companies || []).map(c => c.id)).size !== (r.companies || []).length ||
        (r.companyScope === 'selected'
          ? !t.projectId || !r.companies?.length
          : !!r.companies?.length)
      )
        throw Error('Company conditions need a linked project and at least one selected company.');
      checkGroup(r.when);
      if (r.additionalAssertions !== undefined && !Array.isArray(r.additionalAssertions))
        throw Error('THEN requirements must be a list of field checks.');
      const checks = requirements(r);
      if (checks.length > LIMITS.requirements)
        throw Error('Use up to 200 THEN requirements per condition.');
      requirementCount += checks.length - 1;
      if (requirementCount > LIMITS.additionalRequirements)
        throw Error('Use up to 400 additional THEN requirements per template.');
      checks.forEach(checkCondition);
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
  function checkRunSelection(s) {
    if (
      !s ||
      !Array.isArray(s.ruleIds) ||
      s.ruleIds.length > LIMITS.rules ||
      s.ruleIds.some(id => !text(id, 100) || !id.trim()) ||
      new Set(s.ruleIds).size !== s.ruleIds.length ||
      !Array.isArray(s.referenceChecks) ||
      s.referenceChecks.length > 20
    )
      throw Error('Choose up to 100 conditions and 20 additional reference checks.');
    const ids = new Set(),
      mappings = new Set();
    for (const c of s.referenceChecks) {
      if (
        !c ||
        !text(c.id, 80) ||
        !c.id.trim() ||
        ids.has(c.id) ||
        !text(c.field, 64) ||
        !c.field.trim() ||
        !text(c.lookupId, 100) ||
        !c.lookupId.trim() ||
        !text(c.lookupColumn, 120) ||
        !c.lookupColumn.trim()
      )
        throw Error('Each reference check needs a field, reference and reference column.');
      const mapping = JSON.stringify([c.field, c.lookupId, c.lookupColumn]);
      if (mappings.has(mapping)) throw Error('Choose each additional reference mapping once.');
      mappings.add(mapping);
      ids.add(c.id);
    }
  }
  function checkProfiles(v) {
    if (v.profiles === undefined) return;
    if (!Array.isArray(v.profiles) || v.profiles.length > 120)
      throw Error('Keep up to 120 validation profiles in this workspace.');
    const ids = new Set(),
      names = new Set(),
      counts = new Map();
    for (const p of v.profiles) {
      if (
        !p ||
        !text(p.id, 100) ||
        !p.id.trim() ||
        ids.has(p.id) ||
        !text(p.templateId, 100) ||
        !p.templateId.trim() ||
        !text(p.name, 120) ||
        !p.name.trim() ||
        !text(p.projectId || '', 100) ||
        !text(p.companyId || '', 100) ||
        (p.companyId && !p.projectId) ||
        !text(p.updatedAt, 50) ||
        !p.updatedAt
      )
        throw Error('Check validation profile identifiers, names and company settings.');
      const name = p.templateId + '\0' + p.name.trim().toLowerCase();
      if (names.has(name)) throw Error('Use a different profile name for this template.');
      counts.set(p.templateId, (counts.get(p.templateId) || 0) + 1);
      if (counts.get(p.templateId) > 30) throw Error('Keep up to 30 profiles per template.');
      ids.add(p.id);
      names.add(name);
      checkRunSelection(p);
    }
  }
  function ruleReferences(r) {
    const refs = [];
    const walk = g => {
      g.conditions.forEach(add);
      g.groups.forEach(walk);
    };
    const add = c => {
      if (['lookup', 'lookupTuple'].includes(c.operator)) refs.push(c);
    };
    walk(r.when);
    requirements(r).forEach(add);
    return refs;
  }
  /** Compile a run-only schema. Definitions, published releases and base checks stay unchanged. */
  function runSetup(t, selection, context = {}) {
    checkSchema(t);
    checkRunSelection(selection);
    if (selection.ruleIds.some(id => !t.rules.some(r => r.id === id)))
      throw Error(
        'This setup includes conditions unavailable in this version. Remove the unavailable selections or choose their template version.'
      );
    const selected = new Set(selection.ruleIds),
      active = t.rules.filter(r => selected.has(r.id) && ruleApplies(r, context)),
      skipped = t.rules
        .filter(r => !active.includes(r))
        .map(r => ({
          id: r.id,
          name: r.name,
          reason: !r.enabled
            ? 'Paused in template'
            : !ruleApplies(r, context)
              ? 'Different company'
              : 'Not selected for this run',
        })),
      schema = { ...t },
      additional = [];
    for (const c of selection.referenceChecks) {
      const field = t.columns.find(f => f.key === c.field),
        list = t.lookups.find(l => l.id === c.lookupId);
      if (!field || !list || !list.headers.includes(c.lookupColumn))
        throw Error(
          'A selected reference check is unavailable in this version. Remove it or choose its original field and reference again.'
        );
      const r = rule(c.field);
      r.id = 'runref:' + c.id;
      if (t.rules.some(saved => saved.id === r.id))
        throw Error('Choose another reference check identifier.');
      r.name = (field.label + ' → ' + list.name).slice(0, 160);
      r.assertion = {
        ...condition(c.field),
        operator: 'lookup',
        lookupId: c.lookupId,
        lookupColumn: c.lookupColumn,
      };
      additional.push(r);
    }
    if (active.length + additional.length > LIMITS.rules)
      throw Error('Select up to 100 active conditions and additional reference checks combined.');
    schema.rules = [...copy(active), ...additional];
    checkSchema(schema);
    const seen = new Set(),
      references = [];
    for (const r of schema.rules)
      for (const c of ruleReferences(r)) {
        const signature = JSON.stringify([c.field, c.lookupId, c.lookupColumn, c.pairs]);
        if (seen.has(signature)) continue;
        seen.add(signature);
        references.push({
          field: c.field,
          name: t.lookups.find(l => l.id === c.lookupId).name,
          lookupId: c.lookupId,
          column:
            c.lookupColumn || c.pairs.map(p => p.field + ' → ' + p.referenceColumn).join('; '),
          requiredBy: r.name,
        });
      }
    return {
      schema,
      summary: {
        conditions: active.map(r => ({ id: r.id, name: r.name })),
        references,
        skipped,
        additionalChecks: additional.length,
      },
    };
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
    checkProfiles(v);
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
      for (const rule of t.rules)
        for (const assigned of rule.companies || []) {
          const company = d.projectCompanies?.find(c => c.id === assigned.id);
          if (company && company.projectId !== t.projectId)
            throw Error('Condition companies must belong to the linked project.');
        }
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
          k => !Number.isInteger(r[k]) || r[k] < 0 || r[k] > 100000000
        )
      )
        throw Error('Check validation run summaries.');
      runIds.add(r.id);
      if (
        [
          'ignored',
          'ignoredErrors',
          'ignoredWarnings',
          'reviewedPassed',
          'reviewedErrors',
          'reviewedWarnings',
        ].some(
          k => r[k] !== undefined && (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > 100000000)
        ) ||
        (r.reviewedAt !== undefined && !text(r.reviewedAt, 50))
      )
        throw Error('Check validation review summaries.');
      if (r.context !== undefined) checkContext({ projectId: r.context?.projectId }, r.context);
      if (
        r.setup !== undefined &&
        (!r.setup ||
          !text(r.setup.name, 160) ||
          !text(r.setup.profileId || '', 100) ||
          ['conditions', 'references', 'skipped'].some(
            k => !Number.isInteger(r.setup[k]) || r.setup[k] < 0 || r.setup[k] > 500
          ))
      )
        throw Error('Check the validation setup summary.');
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
  function comparable(v, c, mode = 'general') {
    const s = normalized(v, c);
    if (blank(s)) return null;
    if (mode === 'sap') return sapComparable(s, c);
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
    c = resolveCondition(c, t);
    const field = t.columns.find(f => f.key === c.field),
      raw = own(row, c.field),
      a = comparable(raw, field, t.mode),
      other = t.columns.find(f => f.key === c.otherField),
      b = c.operator.startsWith('field')
        ? comparable(own(row, c.otherField), other, t.mode)
        : comparable(c.value, field, t.mode);
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
        return sapMode(t)
          ? stringMatch('includes')
          : a !== null && b !== null && String(a).includes(String(b));
      case 'starts':
        return sapMode(t)
          ? stringMatch('startsWith')
          : a !== null && b !== null && String(a).startsWith(String(b));
      case 'ends':
        return sapMode(t)
          ? stringMatch('endsWith')
          : a !== null && b !== null && String(a).endsWith(String(b));
      case 'in':
        return tokens(c.value).some(x => comparable(x, field, t.mode) === a);
      case 'notIn':
        return !tokens(c.value).some(x => comparable(x, field, t.mode) === a);
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
        if (!cache) return l.rows.some(r => comparable(r[i], field, t.mode) === a);
        const key = JSON.stringify([l.id, i, field.key]);
        if (!cache.has(key))
          cache.set(key, new Set(l.rows.map(r => valueKey(comparable(r[i], field, t.mode)))));
        return cache.get(key).has(valueKey(a));
      }
      case 'lookupTuple':
        return referenceRows(c, row, t, cache).count > 0;
      default:
        return false;
    }
    function stringMatch(method) {
      const strings = [raw, c.value].map(v => {
        const s = normalized(v, field);
        return field.caseSensitive ? s : s.toLowerCase();
      });
      return !blank(raw) && !blank(c.value) && strings[0][method](strings[1]);
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
        const values = mapping.map(m => comparable(r[m.index], m.field, t.mode));
        if (values.some(v => v === null)) return;
        const key = valueKey(values);
        if (!index.has(key)) index.set(key, { rows: [], count: 0 });
        const match = index.get(key);
        match.count++;
        if (match.rows.length < 5) match.rows.push({ values: r, sourceRow: i + 2 });
      });
      cache.set(key, index);
    }
    const values = mapping.map(m => comparable(own(row, m.field.key), m.field, t.mode));
    if (values.some(v => v === null)) return { rows: [], count: 0 };
    return cache.get(key).get(valueKey(values)) || { rows: [], count: 0 };
  }
  /** Offer maintained values for one field; tuple lookups retain the other mapped values. */
  function suggestions(t, row, fieldKey, query = '', context = {}) {
    checkSchema(t);
    checkContext(t, context);
    const field = t.columns.find(c => c.key === fieldKey);
    if (!field) throw Error('Choose an existing field.');
    const candidates = new Map(),
      cache = new Map();
    const add = (value, source, detail = '') => {
      if (
        blank(value) ||
        comparable(value, field, t.mode) === comparable(own(row, fieldKey), field, t.mode)
      )
        return;
      const key = valueKey(comparable(value, field, t.mode));
      if (!candidates.has(key)) candidates.set(key, { value: String(value), source, detail });
    };
    for (const value of tokens(field.values)) add(value, 'Allowed values');
    for (const rule of t.rules)
      for (const requirement of requirements(rule)) {
        const c = resolveCondition(requirement, t);
        if (
          !ruleApplies(rule, context) ||
          c.field !== fieldKey ||
          !testGroup(rule.when, row, t, cache) ||
          !['lookup', 'lookupTuple', 'in'].includes(c.operator)
        )
          continue;
        if (c.operator === 'in') {
          tokens(c.value).forEach(v => add(v, rule.name));
          continue;
        }
        const list = t.lookups.find(l => l.id === c.lookupId);
        const pairs =
          c.operator === 'lookupTuple'
            ? c.pairs
            : [{ field: c.field, referenceColumn: c.lookupColumn }];
        const target = pairs.find(p => p.field === fieldKey);
        if (!list || !target) continue;
        for (const reference of list.rows) {
          if (
            !pairs
              .filter(p => p.field !== fieldKey)
              .every(p => {
                const f = t.columns.find(f => f.key === p.field),
                  value = comparable(own(row, p.field), f, t.mode);
                return (
                  value !== null &&
                  value ===
                    comparable(reference[list.headers.indexOf(p.referenceColumn)], f, t.mode)
                );
              })
          )
            continue;
          const detail = [list.nameColumn, ...(list.descriptionColumns || [])]
            .filter(Boolean)
            .map(h => reference[list.headers.indexOf(h)])
            .filter(Boolean)
            .join(' · ');
          add(reference[list.headers.indexOf(target.referenceColumn)], list.name, detail);
        }
      }
    const q = String(query).trim().toLocaleLowerCase(),
      current = String(own(row, fieldKey)).trim().toLocaleLowerCase();
    const valid = value => {
      const v = normalized(value, field),
        n = comparable(value, field, t.mode),
        trial = { ...row, [fieldKey]: value };
      if (sapMode(t)) {
        if (sapCheck(v, field)) return false;
      }
      if (
        n === null ||
        (!sapMode(t) &&
          ((field.type === 'integer' && !Number.isInteger(n)) ||
            (field.type === 'date' && !date(v))))
      )
        return false;
      if (
        !sapMode(t) &&
        ((field.minLength !== '' && v.length < Number(field.minLength)) ||
          (field.maxLength !== '' && v.length > Number(field.maxLength)))
      )
        return false;
      if (
        !sapMode(t) &&
        ['integer', 'decimal'].includes(field.type) &&
        ((field.min !== '' && n < Number(field.min)) || (field.max !== '' && n > Number(field.max)))
      )
        return false;
      if (field.values && !tokens(field.values).some(x => comparable(x, field, t.mode) === n))
        return false;
      if (!sapMode(t) && field.format && !FORMATS[field.format].test(v)) return false;
      return t.rules.every(
        r =>
          !ruleApplies(r, context) ||
          !testGroup(r.when, trial, t, cache) ||
          requirements(r).every(c => c.field !== fieldKey || testCondition(c, trial, t, cache))
      );
    };
    const choices = [...candidates.values()].filter(
      c =>
        (!q || [c.value, c.source, c.detail].some(v => v.toLocaleLowerCase().includes(q))) &&
        valid(c.value)
    );
    choices.sort(
      (a, b) =>
        Number(b.value.toLocaleLowerCase().startsWith(current)) -
          Number(a.value.toLocaleLowerCase().startsWith(current)) || a.value.localeCompare(b.value)
    );
    return { total: choices.length, choices: choices.slice(0, 30) };
  }
  function referenceDetails(t, row, cache = new Map(), context = {}) {
    checkContext(t, context);
    const conditions = [],
      seen = new Set(),
      out = [];
    const walk = g => {
      conditions.push(...g.conditions);
      g.groups.forEach(walk);
    };
    for (const r of t.rules)
      if (ruleApplies(r, context)) {
        walk(r.when);
        conditions.push(...requirements(r));
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
    const binding =
      c.valueSource === 'group' ? t.columnGroups?.find(g => g.id === c.groupId) : null;
    const set = binding?.sets.find(v => v.id === c.valueSetId);
    c = resolveCondition(c, t);
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
            : ' ' + (c.value || '…')) +
      (binding ? ' [' + binding.name + ' / ' + set.name + ']' : '')
    );
  }
  /** A run is for one maintained company; scope is separate from uploaded cell values. */
  function checkContext(t, context = {}) {
    if (
      !context ||
      typeof context !== 'object' ||
      Array.isArray(context) ||
      ['projectId', 'companyId'].some(k => !text(context[k] || '', 100)) ||
      ['projectName', 'companyName'].some(k => !text(context[k] || '', 200)) ||
      (t.projectId
        ? context.projectId !== t.projectId || !context.companyId?.trim()
        : !!context.projectId || !!context.companyId)
    )
      throw Error('Choose a company from the template’s linked project before validation.');
    return context;
  }
  function runContext(d, t, companyId = '') {
    if (!t.projectId) return {};
    const project = (d.projects || []).find(p => p.id === t.projectId),
      company = (d.projectCompanies || []).find(
        c => c.id === companyId && c.projectId === t.projectId && c.active !== false
      );
    if (!project)
      throw Error('The linked project is unavailable. Relink the draft or choose another version.');
    if (!company)
      throw Error('Choose an active company from the template’s linked project before validation.');
    return {
      projectId: project.id,
      projectName: project.name,
      companyId: company.id,
      companyName: company.name,
    };
  }
  function ruleApplies(r, context = {}) {
    return (
      r.enabled &&
      (r.companyScope !== 'selected' || r.companies.some(c => c.id === context.companyId))
    );
  }
  function assignCompanies(r, destination) {
    r.companyScope = destination.companyScope || 'all';
    r.companies = r.companyScope === 'selected' ? copy(destination.companies || []) : [];
    return r;
  }
  function copyTemplate(source, name, destination, ruleIds = source.rules.map(r => r.id)) {
    if (
      !Array.isArray(ruleIds) ||
      new Set(ruleIds).size !== ruleIds.length ||
      ruleIds.some(id => !source.rules.some(r => r.id === id))
    )
      throw Error('Choose existing source conditions to copy.');
    const next = { ...create(name), ...schema(source), name };
    next.projectId = destination.projectId || '';
    next.projectName = destination.projectName || '';
    next.columns.forEach(c => (c.id = uid()));
    next.rules = next.rules.filter(r => ruleIds.includes(r.id));
    next.rules.forEach(r => {
      r.id = uid();
      assignCompanies(r, destination);
    });
    checkSchema(next, true);
    return next;
  }
  /** Copies are independent. Exact field keys must exist; referenced lists travel with the rules. */
  function copyConditions(source, target, ruleIds, destination) {
    checkSchema(source, true);
    if (
      !Array.isArray(ruleIds) ||
      !ruleIds.length ||
      new Set(ruleIds).size !== ruleIds.length ||
      ruleIds.some(id => !source.rules.some(r => r.id === id))
    )
      throw Error('Choose at least one source condition to copy.');
    const next = copy(target),
      lookups = new Map(),
      columnGroups = new Map(),
      rules = source.rules.filter(r => ruleIds.includes(r.id)).map(copy);
    const clause = c => {
      if (c.valueSource === 'group') {
        if (!columnGroups.has(c.groupId)) {
          const group = copy(source.columnGroups.find(g => g.id === c.groupId)),
            setIds = new Map();
          for (const key of group.fields)
            if (!next.columns.some(c => c.key === key))
              throw Error(
                'Add the technical field ' +
                  key +
                  ' to the destination template before copying this condition.'
              );
          const oldId = group.id;
          group.id = uid();
          group.sets.forEach(v => {
            const old = v.id;
            v.id = uid();
            setIds.set(old, v.id);
          });
          next.columnGroups ||= [];
          let name = group.name,
            n = 2;
          while (next.columnGroups.some(g => g.name.toLowerCase() === name.toLowerCase()))
            name = group.name.slice(0, 105) + ' copy ' + n++;
          group.name = name;
          next.columnGroups.push(group);
          columnGroups.set(oldId, { id: group.id, sets: setIds });
        }
        const binding = columnGroups.get(c.groupId);
        c.groupId = binding.id;
        c.valueSetId = binding.sets.get(c.valueSetId);
      }
      for (const key of [
        c.field,
        ...(c.otherField && c.operator.startsWith('field') ? [c.otherField] : []),
        ...(c.pairs || []).map(p => p.field),
      ])
        if (!next.columns.some(f => f.key === key))
          throw Error(
            'Add the technical field ' +
              key +
              ' to the destination template before copying this condition.'
          );
      if (['lookup', 'lookupTuple'].includes(c.operator)) {
        if (!lookups.has(c.lookupId)) {
          const list = copy(source.lookups.find(l => l.id === c.lookupId)),
            id = uid();
          lookups.set(c.lookupId, id);
          list.id = id;
          next.lookups.push(list);
        }
        c.lookupId = lookups.get(c.lookupId);
      }
    };
    const walk = g => {
      g.conditions.forEach(clause);
      g.groups.forEach(walk);
    };
    for (const r of rules) {
      r.id = uid();
      assignCompanies(r, destination);
      walk(r.when);
      requirements(r).forEach(clause);
    }
    next.rules.push(...rules);
    checkSchema(next, true);
    return next;
  }
  function validateRows(t, rows, context = {}) {
    checkSchema(t);
    checkContext(t, context);
    if (
      !Array.isArray(rows) ||
      rows.length > LIMITS.rows ||
      rows.length * t.columns.length > LIMITS.cells
    )
      throw Error('Validate up to 25,000 rows and 5,000,000 cells at a time.');
    const issues = [],
      status = rows.map(() => ({ errors: 0, warnings: 0 })),
      cache = new Map(),
      activeRules = t.rules
        .filter(r => ruleApplies(r, context))
        .map(r => ({ rule: r, checks: requirements(r) }));
    let totalIssues = 0;
    function add(
      index,
      key,
      message,
      severity = 'error',
      ruleId = 'column',
      name = 'Column check',
      requirementIndex
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
          ...(requirementIndex !== undefined ? { requirementIndex } : {}),
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
        const n = comparable(v, c, t.mode);
        if (sapMode(t)) {
          const issue = sapCheck(v, c);
          if (issue) add(i, c.key, issue);
          const ref = sapSettings(c).reference;
          if (ref && blank(own(row, ref)))
            add(i, c.key, 'Fill the linked currency/unit field ' + ref + '.');
        } else {
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
        }
        if (c.values && !tokens(c.values).some(x => comparable(x, c, t.mode) === n))
          add(i, c.key, 'Choose a value from the allowed list.');
        if (!sapMode(t) && c.format && !FORMATS[c.format].test(v))
          add(i, c.key, 'Use the ' + c.format + ' format.');
      }
      for (const { rule: r, checks } of activeRules)
        if (testGroup(r.when, row, t, cache))
          checks.forEach((c, index) => {
            if (!testCondition(c, row, t, cache))
              add(
                i,
                c.field,
                r.message || describe(c, t) + '.',
                r.severity,
                r.id,
                r.name,
                checks.length > 1 ? index : undefined
              );
          });
    }
    const groups = [...t.columns.filter(c => c.unique).map(c => [c.key]), ...t.uniqueGroups];
    for (const keys of groups) {
      const seen = new Map();
      rows.forEach((row, i) => {
        if (keys.some(k => blank(own(row, k)))) return;
        const value = valueKey(
          keys.map(k =>
            comparable(
              own(row, k),
              t.columns.find(c => c.key === k),
              t.mode
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
      context: copy(context),
      appliedRules: t.rules.filter(r => ruleApplies(r, context)).length,
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
    if (textValue.length > LIMITS.fileBytes) throw Error('Use a file below 50 MB.');
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
      cells = 0,
      quoted = false,
      closed = false;
    const endCell = () => {
      row.push(cell);
      cell = '';
      closed = false;
      if (row.length > LIMITS.columns) throw Error('Use up to 200 upload columns.');
      if (++cells > LIMITS.cells + LIMITS.columns)
        throw Error('Use up to 5,000,000 data cells (25,000 rows at 200 columns).');
    };
    const endRow = () => {
      endCell();
      rows.push(row);
      row = [];
      if (rows.length > LIMITS.rows + 1) throw Error('Use up to 25,000 data rows.');
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
      if (
        t.projectId &&
        t.projectId !== old?.projectId &&
        !next.projects?.some(p => p.id === t.projectId)
      )
        throw Error('Choose a maintained project for this validation template.');
      for (const r of t.rules) {
        const before = old?.rules.find(rule => rule.id === r.id);
        for (const c of r.companies || [])
          if (
            t.projectId !== old?.projectId ||
            !before?.companies?.some(saved => saved.id === c.id)
          ) {
            if (
              !next.projectCompanies?.some(
                company =>
                  company.id === c.id &&
                  company.projectId === t.projectId &&
                  company.active !== false
              )
            )
              throw Error('Choose active condition companies from the template’s linked project.');
          }
      }
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
    SAP_TYPES,
    sapSettings,
    sapCheck,
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
    requirements,
    describeRequirements,
    schema,
    GROUP_OPS,
    resolveCondition,
    groupReferences,
    checkColumnGroups,
    issueKey,
    reviewIssues,
    checkSchema,
    checkContext,
    runContext,
    ruleApplies,
    checkRunSelection,
    checkProfiles,
    ruleReferences,
    runSetup,
    copyTemplate,
    copyConditions,
    upgrade,
    validateState,
    prepare,
    validateRows,
    testCondition,
    testGroup,
    referenceRows,
    referenceDetails,
    suggestions,
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
