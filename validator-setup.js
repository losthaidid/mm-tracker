/** Excel setup definitions for Validation Studio. All workbook content stays declarative. */
(function (root) {
  'use strict';
  const HEADERS = {
    Template: ['Name', 'Description', 'Format version'],
    Columns: [
      'Field',
      'Label',
      'Type',
      'Required',
      'Unique',
      'Min length',
      'Max length',
      'Min',
      'Max',
      'Allowed values',
      'Aliases',
      'Trim',
      'Case sensitive',
      'Format',
      'Description',
    ],
    Conditions: [
      'Rule ID',
      'Name',
      'Severity',
      'Enabled',
      'Part',
      'Group',
      'Join',
      'Field',
      'Operator',
      'Value',
      'Other field',
      'Reference ID',
      'Reference column',
      'Pairs',
      'Message',
    ],
    References: [
      'Reference ID',
      'Name',
      'Sheet',
      'Code column',
      'Name column',
      'Description columns',
    ],
    'Unique combinations': ['Fields'],
  };
  const key = s =>
    String(s ?? '')
      .trim()
      .toLowerCase();
  function parse(book) {
    const E = root.WorkHubValidatorEngine;
    if (!Array.isArray(book?.sheets)) throw Error('Choose an Excel setup workbook.');
    const sheets = new Map();
    for (const s of book.sheets) {
      if (sheets.has(key(s.name))) throw Error('Worksheet names must be unique.');
      sheets.set(key(s.name), s);
    }
    function table(name, required = []) {
      const sheet = sheets.get(key(name));
      if (!sheet) {
        if (name === 'Template' || name === 'Columns')
          throw Error('Missing ' + name + ' sheet. Download the Excel setup template.');
        return [];
      }
      const headers = (sheet.rows[0] || []).map(key);
      while (headers.length && !headers.at(-1)) headers.pop();
      if (new Set(headers).size !== headers.length || headers.some(h => !h))
        throw Error(name + ': use unique, non-empty column headers in row 1.');
      if (headers.some(h => !HEADERS[name].map(key).includes(h)))
        throw Error(name + ': unknown header. Keep the headers from the setup template.');
      for (const h of required)
        if (!headers.includes(key(h))) throw Error(name + ': missing ' + h + ' header.');
      return (sheet.rows || []).slice(1).flatMap((row, i) => {
        if (row.every(E.blank)) return [];
        const at = name + ' row ' + (i + 2);
        if (row.slice(headers.length).some(v => !E.blank(v)))
          throw Error(at + ': a value has no column header.');
        const values = new Map(headers.map((h, x) => [h, String(row[x] ?? '').trim()]));
        return [{ at, get: h => values.get(key(h)) || '' }];
      });
    }
    function bool(row, h, fallback) {
      const v = key(row.get(h));
      if (!v) return fallback;
      if (['true', 'yes', '1'].includes(v)) return true;
      if (['false', 'no', '0'].includes(v)) return false;
      throw Error(row.at + ': ' + h + ' must be Yes or No.');
    }
    function number(row, h) {
      const v = row.get(h);
      if (!v) return '';
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v) || !Number.isFinite(Number(v)))
        throw Error(row.at + ': ' + h + ' must be a number.');
      return Number(v);
    }
    const metadata = table('Template', ['Name']);
    if (
      metadata.length !== 1 ||
      (metadata[0].get('Format version') && metadata[0].get('Format version') !== '1')
    )
      throw Error('Template: provide one name row with format version 1.');
    const t = E.create(metadata[0].get('Name'));
    t.description = metadata[0].get('Description');
    t.columns = table('Columns', ['Field', 'Label']).map((r, i) => ({
      ...E.column(i),
      key: r.get('Field'),
      label: r.get('Label'),
      type: key(r.get('Type')) || 'text',
      required: bool(r, 'Required', false),
      unique: bool(r, 'Unique', false),
      minLength: number(r, 'Min length'),
      maxLength: number(r, 'Max length'),
      min: number(r, 'Min'),
      max: number(r, 'Max'),
      values: r.get('Allowed values'),
      aliases: r.get('Aliases'),
      trim: bool(r, 'Trim', true),
      caseSensitive: bool(r, 'Case sensitive', false),
      format: key(r.get('Format')),
      description: r.get('Description'),
    }));
    // Validate columns before resolving rule and reference links.
    E.checkSchema(t);
    const referenceIds = new Set();
    for (const r of table('References', ['Reference ID', 'Name', 'Sheet'])) {
      const id = r.get('Reference ID'),
        sheetName = r.get('Sheet'),
        s = sheets.get(key(sheetName));
      if (!id || referenceIds.has(id))
        throw Error(r.at + ': reference IDs must be non-empty and unique.');
      if (
        Object.keys(HEADERS).map(key).includes(key(sheetName)) ||
        key(sheetName) === 'guide' ||
        !s
      )
        throw Error(r.at + ': choose an existing reference data sheet, such as Plants.');
      const headers = (s.rows[0] || []).map(v => String(v ?? '').trim());
      while (headers.length && !headers.at(-1)) headers.pop();
      const rows = s.rows
        .slice(1)
        .filter(row => row.some(v => !E.blank(v)))
        .map((row, i) => {
          if (row.slice(headers.length).some(v => !E.blank(v)))
            throw Error(sheetName + ' row ' + (i + 2) + ': a value has no column header.');
          return Array.from({ length: headers.length }, (_, x) => String(row[x] ?? ''));
        });
      t.lookups.push({
        id,
        name: r.get('Name'),
        headers,
        rows,
        codeColumn: r.get('Code column') || headers[0],
        nameColumn: r.get('Name column'),
        descriptionColumns: r
          .get('Description columns')
          .split(/[;\n]/)
          .map(s => s.trim())
          .filter(Boolean),
      });
      referenceIds.add(id);
    }
    const rules = new Map();
    for (const r of table('Conditions', ['Rule ID', 'Part'])) {
      const id = r.get('Rule ID');
      if (!id || id.length > 100) throw Error(r.at + ': provide a Rule ID up to 100 characters.');
      let entry = rules.get(id);
      if (!entry) {
        const rule = {
          ...E.rule(),
          id,
          name: r.get('Name') || id,
          severity: key(r.get('Severity')) || 'error',
          enabled: bool(r, 'Enabled', true),
          message: r.get('Message'),
        };
        entry = {
          rule,
          assertion: false,
          groups: new Map([['root', rule.when]]),
          joins: new Map(),
        };
        rules.set(id, entry);
      } else {
        for (const [h, prop] of [
          ['Name', 'name'],
          ['Severity', 'severity'],
          ['Message', 'message'],
        ])
          if (r.get(h) && r.get(h) !== entry.rule[prop])
            throw Error(r.at + ': conflicting ' + h + ' for Rule ID ' + id + '.');
        if (r.get('Enabled') && bool(r, 'Enabled', true) !== entry.rule.enabled)
          throw Error(r.at + ': conflicting Enabled value.');
      }
      const part = key(r.get('Part'));
      if (!['assert', 'when', 'group'].includes(part))
        throw Error(r.at + ': Part must be assert, when or group.');
      if (part !== 'group' && !r.get('Operator'))
        throw Error(r.at + ': choose an Operator for each when/assert row.');
      const clause = {
        ...E.condition(r.get('Field')),
        operator: r.get('Operator') || 'notEmpty',
        value: r.get('Value'),
        otherField: r.get('Other field'),
        lookupId: r.get('Reference ID'),
        lookupColumn: r.get('Reference column'),
      };
      if (r.get('Pairs')) {
        clause.pairs = r
          .get('Pairs')
          .split(/[;\n]/)
          .map(s => {
            const pair = s.split('=').map(x => x.trim());
            if (pair.length !== 2 || pair.some(x => !x))
              throw Error(
                r.at + ': write pairs as FIELD=Reference column; OTHER_FIELD=Other column.'
              );
            return { field: pair[0], referenceColumn: pair[1] };
          });
      }
      if (part === 'assert') {
        if (entry.assertion) throw Error(r.at + ': each Rule ID needs exactly one assert row.');
        if (r.get('Group') || r.get('Join'))
          throw Error(r.at + ': Group and Join apply to when/group rows.');
        entry.rule.assertion = clause;
        entry.assertion = true;
      } else {
        const path = r.get('Group') || 'root',
          join = key(r.get('Join'));
        if (path !== 'root' && !/^[1-9]\d?(?:\.[1-9]\d?){0,3}$/.test(path))
          throw Error(r.at + ': use root, 1, 1.1, etc. for Group (up to four levels).');
        if (join && !['all', 'any'].includes(join))
          throw Error(r.at + ': Join must be all or any.');
        let group = entry.rule.when,
          prefix = '';
        if (path !== 'root')
          for (const segment of path.split('.')) {
            prefix += (prefix ? '.' : '') + segment;
            if (!entry.groups.has(prefix)) {
              const child = E.group();
              group.groups.push(child);
              entry.groups.set(prefix, child);
            }
            group = entry.groups.get(prefix);
          }
        if (join) {
          if (entry.joins.has(path) && entry.joins.get(path) !== join)
            throw Error(r.at + ': conflicting Join for group ' + path + '.');
          group.join = join;
          entry.joins.set(path, join);
        }
        if (part === 'when') group.conditions.push(clause);
        else if (
          [
            'Field',
            'Operator',
            'Value',
            'Other field',
            'Reference ID',
            'Reference column',
            'Pairs',
          ].some(h => r.get(h))
        )
          throw Error(r.at + ': group rows define Group and Join only.');
      }
    }
    for (const [id, entry] of rules) {
      if (!entry.assertion) throw Error('Conditions: Rule ID ' + id + ' needs an assert row.');
      t.rules.push(entry.rule);
    }
    t.uniqueGroups = table('Unique combinations', ['Fields']).map(r => E.tokens(r.get('Fields')));
    E.checkSchema(t);
    return t;
  }
  root.WorkHubValidatorSetup = { HEADERS, parse };
})(window);
