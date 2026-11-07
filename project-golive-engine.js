/** Import and validate project-owned Go-Live issue records without losing extra columns. */
(function (root) {
  'use strict';
  const FIELDS = Object.freeze([
    ['title', 'Issue / summary'],
    ['reference', 'Issue ID / reference'],
    ['description', 'Details'],
    ['status', 'Status'],
    ['priority', 'Priority'],
    ['owner', 'Owner / responsible person'],
    ['reported', 'Reported date'],
    ['resolution', 'Resolution / remarks'],
  ]);
  const LIMITS = Object.freeze({
    issues: 2000,
    columns: 200,
    text: 32000,
    title: 500,
    header: 500,
  });
  const aliases = {
    title: [
      'issue',
      'issue description',
      'issue summary',
      'problem',
      'problem description',
      'summary',
      'title',
      'description',
    ],
    reference: [
      'issue id',
      'issue no',
      'issue number',
      'id',
      'reference',
      'ref',
      'ticket',
      'ticket id',
    ],
    description: ['details', 'issue details', 'description', 'problem details', 'impact'],
    status: ['status', 'issue status', 'current status'],
    priority: ['priority', 'severity', 'urgency'],
    owner: ['owner', 'assigned to', 'assignee', 'responsible', 'responsible person'],
    reported: ['reported', 'reported date', 'date reported', 'date raised', 'raised date', 'date'],
    resolution: ['resolution', 'solution', 'remarks', 'comments', 'outcome', 'action taken'],
  };
  const normal = x =>
    String(x ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_\-./]+/g, ' ')
      .replace(/\s+/g, ' ');
  const letter = index => {
    let out = '';
    for (index++; index; index = Math.floor((index - 1) / 26))
      out = String.fromCharCode(65 + ((index - 1) % 26)) + out;
    return out;
  };
  function columns(sheet, headerRow) {
    if (
      !sheet ||
      !Array.isArray(sheet.rows) ||
      !Number.isInteger(headerRow) ||
      headerRow < 1 ||
      headerRow > sheet.rows.length
    )
      throw Error('Choose a header row within the uploaded file.');
    const width = sheet.rows.reduce((n, row) => Math.max(n, row?.length || 0), sheet.width || 0);
    if (!width) throw Error('The file has no columns.');
    if (width > LIMITS.columns) throw Error('The issue import supports up to 200 columns.');
    return Array.from({ length: width }, (_, i) => ({
      index: i,
      letter: letter(i),
      header: String(sheet.rows[headerRow - 1]?.[i] ?? ''),
      label: String(sheet.rows[headerRow - 1]?.[i] ?? '').trim() || 'Column ' + letter(i),
    }));
  }
  function suggest(cols) {
    const used = new Set(),
      map = {};
    for (const [field] of FIELDS) {
      let found = -1;
      for (const alias of aliases[field]) {
        found = cols.findIndex(c => !used.has(c.index) && normal(c.header) === alias);
        if (found >= 0) break;
      }
      if (found < 0 && field === 'title' && cols.length === 1) found = 0;
      map[field] = found;
      if (found >= 0) used.add(found);
    }
    return map;
  }
  function textSheet(text, kind = 'auto', name = 'Pasted issues') {
    const value = String(text ?? '').replace(/^\uFEFF/, '');
    if (!value.trim()) throw Error('Paste or upload at least one issue.');
    if (value.length > 20000000) throw Error('Use a text list below 20 million characters.');
    const table = kind === 'table' || (kind === 'auto' && value.includes('\t'));
    const rows = table
      ? root.WorkHubValidatorEngine.parseCSV(value, value.includes('\t') ? '\t' : '')
      : value
          .split(/\r\n|\n|\r/)
          .filter(line => line.trim())
          .map(line => [line]);
    if (!table) rows.unshift(['Issue']);
    if (rows.length > 25001) throw Error('A source file can contain up to 25,000 issue rows.');
    if (rows.length < 2) throw Error('Add at least one issue after the header row.');
    return { name, rows, width: rows.reduce((n, r) => Math.max(n, r.length), 0) };
  }
  function importRows(sheet, headerRow, map, uid) {
    const cols = columns(sheet, headerRow),
      used = new Set();
    for (const [field] of FIELDS) {
      const index = Number(map[field]);
      if (index === -1) continue;
      if (!Number.isInteger(index) || !cols[index])
        throw Error('Choose a valid column for ' + field + '.');
      if (used.has(index)) throw Error('Each imported column can only be mapped once.');
      used.add(index);
    }
    if (!Number.isInteger(Number(map.title)) || Number(map.title) < 0)
      throw Error('Choose the column containing each issue or summary.');
    const records = [],
      emptyRows = [],
      missing = [];
    sheet.rows.slice(headerRow).forEach((row, offset) => {
      const values = cols.map(c => String(row?.[c.index] ?? ''));
      if (!values.some(v => v.trim())) {
        emptyRows.push(offset + headerRow + 1);
        return;
      }
      const record = { id: uid(), extras: [] };
      for (const [field] of FIELDS)
        record[field] = Number(map[field]) < 0 ? '' : values[Number(map[field])];
      if (!record.title.trim()) {
        missing.push(offset + headerRow + 1);
        return;
      }
      for (const col of cols)
        if (!used.has(col.index) && values[col.index] !== '')
          record.extras.push({ header: col.label, value: values[col.index] });
      records.push(record);
    });
    if (missing.length)
      throw Error(
        'Issue / summary is blank on source row' +
          (missing.length > 1 ? 's ' : ' ') +
          missing.slice(0, 10).join(', ') +
          (missing.length > 10 ? ' and more' : '') +
          '. Choose a filled column or update the source.'
      );
    if (!records.length) throw Error('No issue rows were found after the header.');
    if (records.length > LIMITS.issues)
      throw Error('A project can hold up to 2,000 Go-Live issues.');
    validateIssues(records);
    return { records, emptyRows };
  }
  function validText(value, max) {
    return (
      typeof value === 'string' &&
      value.length <= max &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    );
  }
  function validateIssues(issues) {
    if (!Array.isArray(issues) || issues.length > LIMITS.issues)
      throw Error('A project can hold up to 2,000 Go-Live issues.');
    const ids = new Set();
    for (const issue of issues) {
      if (!issue || !validText(issue.id, 100) || !issue.id || ids.has(issue.id))
        throw Error('Check the Go-Live issue IDs.');
      ids.add(issue.id);
      for (const [field] of FIELDS)
        if (!validText(issue[field], field === 'title' ? LIMITS.title : LIMITS.text))
          throw Error('Check the Go-Live issue ' + field + ' field length or characters.');
      if (!issue.title.trim()) throw Error('Every Go-Live issue needs an issue or summary.');
      if (
        !Array.isArray(issue.extras) ||
        issue.extras.length > LIMITS.columns ||
        issue.extras.some(
          x => !x || !validText(x.header, LIMITS.header) || !validText(x.value, LIMITS.text)
        )
      )
        throw Error('Check the additional issue columns and their values.');
    }
  }
  function validate(state) {
    for (const p of state.projects || [])
      if (p.goLiveIssues !== undefined) validateIssues(p.goLiveIssues);
  }
  function category(status) {
    const x = normal(status);
    if (['closed', 'resolved', 'complete', 'completed', 'done', 'fixed'].includes(x))
      return 'resolved';
    if (['in progress', 'working', 'ongoing', 'investigating'].includes(x)) return 'progress';
    if (['open', 'new', 'pending', 'blocked', 'on hold', 'not started'].includes(x)) return 'open';
    return 'other';
  }
  function metrics(issues) {
    const m = { total: issues.length, open: 0, progress: 0, resolved: 0, other: 0 };
    for (const issue of issues) m[category(issue.status)]++;
    return m;
  }
  root.WorkHubGoLiveIssuesEngine = Object.freeze({
    FIELDS,
    LIMITS,
    columns,
    suggest,
    textSheet,
    importRows,
    validateIssues,
    validate,
    category,
    metrics,
    letter,
  });
})(typeof window === 'undefined' ? globalThis : window);
