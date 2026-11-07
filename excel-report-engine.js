/** In-memory worksheet projections and exact list matching for Excel Report. */
(function (root) {
  'use strict';
  const LIMITS = Object.freeze({ filters: 20, values: 25000, listCharacters: 2000000 });
  function columnName(index) {
    let result = '';
    for (index++; index > 0; index = Math.floor((index - 1) / 26))
      result = String.fromCharCode(65 + ((index - 1) % 26)) + result;
    return result;
  }
  function createReport(sheet, headerRow) {
    if (!sheet || !Array.isArray(sheet.rows)) throw Error('Choose a readable worksheet.');
    if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > sheet.rows.length)
      throw Error('Choose a header row within the worksheet.');
    const width = sheet.rows.reduce((n, row) => Math.max(n, row?.length || 0), sheet.width || 0);
    if (!width) throw Error('This worksheet has no columns to display.');
    const cells = sheet.rows[headerRow - 1] || [];
    const columns = Array.from({ length: width }, (_, index) => ({
      index,
      letter: columnName(index),
      header: String(cells[index] ?? ''),
      label: String(cells[index] ?? '').trim() || '(blank header)',
    }));
    return { columns, rows: sheet.rows.slice(headerRow), headerRow, sheet: sheet.name || 'Sheet' };
  }
  function normalize(value, caseSensitive) {
    const text = String(value ?? '').trim();
    return caseSensitive ? text : text.toLowerCase();
  }
  function parseList(text) {
    if (String(text ?? '').length > LIMITS.listCharacters)
      throw Error('The pasted list is too large. Use up to 2 million characters.');
    const values = String(text ?? '')
      .split(/\r\n|\r|\n|\t/)
      .map(value => value.trim())
      .filter(Boolean);
    if (!values.length) throw Error('Paste at least one value, one per line or Excel cell.');
    if (values.length > LIMITS.values)
      throw Error('Use no more than 25,000 pasted values per filter.');
    if (values.some(value => value.length > 32000)) throw Error('A pasted value is too long.');
    return values;
  }
  function pasteText(value) {
    const text = String(value ?? '').replace(/^\uFEFF/, '');
    if (text.length > LIMITS.listCharacters)
      throw Error('The pasted table is too large. Use up to 2 million characters.');
    if (!text.trim()) throw Error('Paste a list or table first.');
    return text;
  }
  function pastedGrid(rows, format) {
    if (!Array.isArray(rows) || !rows.length) throw Error('The pasted table has no rows.');
    if (rows.length > LIMITS.values + 1)
      throw Error('Use up to 25,000 pasted values and an optional header row.');
    const width = rows.reduce((n, row) => Math.max(n, row.length), 0);
    if (!width || width > 200) throw Error('Use a pasted table with 1 to 200 columns.');
    return { rows, width, format };
  }
  function pipeCells(line) {
    const text = line.trim(),
      cells = [];
    let cell = '',
      i = 0;
    while (i < text.length) {
      if (text[i] === '\\') {
        let end = i;
        while (text[end] === '\\') end++;
        const length = end - i;
        if (text[end] === '|' && length % 2) {
          cell += '\\'.repeat(length - 1) + '|';
          i = end + 1;
          continue;
        }
        cell += '\\'.repeat(length);
        i = end;
        continue;
      }
      if (text[i] === '|') {
        cells.push(cell.trim());
        cell = '';
      } else cell += text[i];
      i++;
    }
    cells.push(cell.trim());
    if (text.startsWith('|')) cells.shift();
    if (cells.at(-1) === '' && text.endsWith('|')) cells.pop();
    return cells;
  }
  /** Inspect before extracting: every value stays text and header removal is an explicit choice. */
  function parsePaste(input, format = 'auto') {
    const text = pasteText(input),
      lines = text.split(/\r\n|\n|\r/).filter(line => line.trim());
    const delimited = delimiter => {
      if (!root.WorkHubValidatorEngine?.parseCSV)
        throw Error('The pasted table reader is unavailable. Refresh and retry.');
      return root.WorkHubValidatorEngine.parseCSV(text, delimiter);
    };
    const pipes = () =>
      lines.map(pipeCells).filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell)));
    if (format === 'tabs') return pastedGrid(delimited('\t'), format);
    if (format === 'csv') return pastedGrid(delimited(''), format);
    if (format === 'pipes') return pastedGrid(pipes(), format);
    if (format === 'spaces')
      return pastedGrid(
        lines.map(line => line.trim().split(/ {2,}/)),
        format
      );
    if (format === 'lines')
      return pastedGrid(
        lines.map(line => [line]),
        format
      );
    if (format !== 'auto') throw Error('Choose an available pasted table format.');
    if (text.includes('\t')) return pastedGrid(delimited('\t'), 'tabs');
    if (
      lines.every(line => line.includes('|')) &&
      (lines.length > 1 || lines[0].trim().startsWith('|'))
    ) {
      const rows = pipes();
      if (rows.length && rows.every(row => row.length > 1)) return pastedGrid(rows, 'pipes');
    }
    if (lines.length > 1 && /[,;]/.test(lines[0])) {
      try {
        const rows = delimited('');
        if (
          rows.length > 1 &&
          rows[0].length > 1 &&
          rows.every(row => row.length === rows[0].length)
        )
          return pastedGrid(rows, 'csv');
      } catch {
        /* An ordinary list can contain quotes and commas. Explicit CSV mode reports errors. */
      }
    }
    if (lines.length > 1) {
      const rows = lines.map(line => line.trim().split(/ {2,}/));
      if (rows.every(row => row.length > 1)) return pastedGrid(rows, 'spaces');
    }
    return pastedGrid(
      lines.map(line => [line]),
      'lines'
    );
  }
  function extractPasteColumn(table, column, skipHeader = false) {
    if (
      !table ||
      !Array.isArray(table.rows) ||
      !Number.isInteger(column) ||
      column < 0 ||
      column >= table.width
    )
      throw Error('Choose a column from the pasted table.');
    const values = [];
    let skipped = 0;
    for (const row of table.rows.slice(skipHeader ? 1 : 0)) {
      const value = String(row[column] ?? '').trim();
      if (!value) {
        skipped++;
        continue;
      }
      if (value.length > 32000 || /[\r\n\t]/.test(value))
        throw Error(
          'The selected column contains a long or multi-line cell. Choose a column containing one lookup value per cell.'
        );
      values.push(value);
    }
    if (!values.length) throw Error('The selected pasted column has no values to use.');
    parseList(values.join('\n'));
    return { values, skipped };
  }
  /** A plain search matches anywhere; * matches any sequence and ? one character. */
  function wildcardContains(value, pattern, caseSensitive = false) {
    let text = String(value ?? ''),
      search = String(pattern ?? '');
    if (!caseSensitive) {
      text = text.toLowerCase();
      search = search.toLowerCase();
    }
    const parts = search.split('*').filter(Boolean);
    let position = 0;
    for (const part of parts) {
      if (!part.includes('?')) {
        const found = text.indexOf(part, position);
        if (found < 0) return false;
        position = found + part.length;
      } else {
        let found = -1;
        for (let i = position; i + part.length <= text.length; i++) {
          let j = 0;
          while (j < part.length && (part[j] === '?' || part[j] === text[i + j])) j++;
          if (j === part.length) {
            found = i;
            break;
          }
        }
        if (found < 0) return false;
        position = found + part.length;
      }
    }
    return true;
  }
  function rowsFor(report, prepared, live = null) {
    if (live?.text && !report.columns[live.column])
      throw Error('Choose a column for live text search.');
    const rows = [];
    for (let i = 0; i < report.rows.length; i++) {
      const row = report.rows[i];
      if (
        prepared.every(f => f.wanted.has(normalize(row?.[f.column], f.caseSensitive))) &&
        (!live?.text || wildcardContains(row?.[live.column], live.text, !!live.caseSensitive))
      )
        rows.push(i);
    }
    return rows;
  }
  /** Presence is against the original data, while matching rows satisfy every filter. */
  function evaluate(report, filters, live = null) {
    if (!report || !Array.isArray(report.rows)) throw Error('Upload a worksheet first.');
    if (filters.length > LIMITS.filters) throw Error('Use up to 20 column filters at a time.');
    const prepared = filters.map(filter => {
      if (!report.columns[filter.column]) throw Error('Choose an available filter column.');
      if (
        !Array.isArray(filter.values) ||
        !filter.values.length ||
        filter.values.length > LIMITS.values
      )
        throw Error('Paste at least one value for each filter.');
      const wanted = new Set(filter.values.map(value => normalize(value, filter.caseSensitive)));
      const counts = new Map();
      for (const row of report.rows) {
        const key = normalize(row?.[filter.column], filter.caseSensitive);
        if (wanted.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      }
      const values = filter.values.map(value => ({
        value,
        count: counts.get(normalize(value, filter.caseSensitive)) || 0,
      }));
      const found = values.filter(value => value.count > 0).length;
      return { ...filter, wanted, values, found, missing: values.length - found };
    });
    return { filters: prepared, rows: rowsFor(report, prepared, live) };
  }
  root.WorkHubExcelReportEngine = Object.freeze({
    LIMITS,
    columnName,
    createReport,
    parseList,
    parsePaste,
    pastedGrid,
    extractPasteColumn,
    normalize,
    wildcardContains,
    rowsFor,
    evaluate,
  });
})(typeof window === 'undefined' ? globalThis : window);
