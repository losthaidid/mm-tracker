/** Standalone, positional comparison of two independently uploaded files. */
(function (root) {
  'use strict';
  const text = value => String(value ?? '');
  function sheet(book, sheetIndex = 0, headerRow = 1) {
    const current = book?.sheets?.[sheetIndex];
    if (!current) throw Error('Choose a worksheet.');
    if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > current.rows.length)
      throw Error('Choose a header row within this worksheet.');
    const header = current.rows[headerRow - 1] || [];
    if (!header.some(value => text(value) !== '')) throw Error('The selected header row is empty.');
    let end = current.rows.length,
      width = header.length;
    while (end > headerRow && !(current.rows[end - 1] || []).some(value => text(value) !== ''))
      end--;
    const rows = current.rows.slice(headerRow, end);
    for (const row of rows) width = Math.max(width, row.length);
    while (
      width &&
      text(header[width - 1]) === '' &&
      !rows.some(row => text(row[width - 1]) !== '')
    )
      width--;
    const limits = root.WorkHubValidatorEngine.LIMITS;
    if (width > limits.columns || rows.length > limits.rows || rows.length * width > limits.cells)
      throw Error('Use up to 200 columns, 25,000 data rows and 5,000,000 cells per file.');
    return {
      sheet: current.name,
      headerRow,
      headers: Array.from({ length: width }, (_, i) => text(header[i])),
      rows,
    };
  }
  function selected(source, settings = {}) {
    const width = source.headers.length;
    let skipped;
    if ((settings.mode || 'count') === 'count') {
      const count = Number(settings.count ?? 0);
      if (settings.count === '' || !Number.isInteger(count) || count < 0 || count >= width)
        throw Error(
          'Enter a whole skip count from 0 to ' + (width - 1) + '. Keep at least one column.'
        );
      skipped = new Set(Array.from({ length: count }, (_, i) => i));
    } else if (settings.mode === 'checkboxes') {
      skipped = new Set(settings.skipped || []);
      if ([...skipped].some(i => !Number.isInteger(i) || i < 0 || i >= width))
        throw Error('Choose columns from the current worksheet.');
    } else throw Error('Choose a skip method.');
    const columns = Array.from({ length: width }, (_, i) => i).filter(i => !skipped.has(i));
    if (!columns.length) throw Error('Keep at least one column to compare.');
    return {
      ...source,
      columns,
      skipMode: settings.mode || 'count',
      skipped: [...skipped].sort((a, b) => a - b),
    };
  }
  function cell(report, row, column) {
    const pair = report.columns[column];
    if (!pair || !Number.isInteger(row) || row < 0 || row >= report.rowCount)
      throw Error('Choose a record and column from this comparison.');
    const hasA = row < report.a.rows.length && pair.a !== null,
      hasB = row < report.b.rows.length && pair.b !== null,
      a = hasA ? text(report.a.rows[row][pair.a]) : '',
      b = hasB ? text(report.b.rows[row][pair.b]) : '';
    return { a, b, hasA, hasB, match: hasA && hasB && a === b };
  }
  async function compare(a, b, { pause = () => Promise.resolve(), cancelled = () => false } = {}) {
    if (!a?.columns?.length || !b?.columns?.length)
      throw Error('Choose columns in both files first.');
    const columns = Array.from({ length: Math.max(a.columns.length, b.columns.length) }, (_, i) => {
      const ai = a.columns[i] ?? null,
        bi = b.columns[i] ?? null;
      return {
        a: ai,
        b: bi,
        aHeader: ai === null ? '' : a.headers[ai],
        bHeader: bi === null ? '' : b.headers[bi],
        differences: 0,
      };
    });
    const report = {
      a,
      b,
      columns,
      rowCount: Math.max(a.rows.length, b.rows.length),
      extraColumns: Math.abs(a.columns.length - b.columns.length),
      differentCells: 0,
      differentRows: 0,
      rowDifferences: new Uint16Array(Math.max(a.rows.length, b.rows.length)),
      generatedAt: new Date().toISOString(),
    };
    for (let row = 0; row < report.rowCount; row++) {
      if (!(row % 128)) {
        await pause();
        if (cancelled()) {
          const error = Error('Comparison cancelled.');
          error.name = 'AbortError';
          throw error;
        }
      }
      const rowA = a.rows[row],
        rowB = b.rows[row];
      for (let column = 0; column < columns.length; column++) {
        const pair = columns[column];
        if (
          !rowA ||
          !rowB ||
          pair.a === null ||
          pair.b === null ||
          text(rowA[pair.a]) !== text(rowB[pair.b])
        ) {
          report.rowDifferences[row]++;
          columns[column].differences++;
          report.differentCells++;
        }
      }
      if (report.rowDifferences[row]) report.differentRows++;
    }
    report.matchingRows = report.rowCount - report.differentRows;
    report.matchingCells = report.rowCount * columns.length - report.differentCells;
    report.match = !report.extraColumns && !report.differentRows;
    return report;
  }
  root.WorkHubValidatorCompareEngine = Object.freeze({ sheet, selected, cell, compare });
})(window);
