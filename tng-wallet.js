/** TNG eWallet Transaction History layout. Card statement parsing stays in tng-engine.js. */
(function (root) {
  'use strict';
  const compact = value =>
    String(value)
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  const labels = [
    'date',
    'status',
    'transactiontype',
    'reference',
    'description',
    'details',
    'amountrm',
    'walletbalance',
  ];
  const matches = pages =>
    pages.some(page =>
      /TNG\s+WALLET\s+TRANSACTION\s+HISTORY/i.test(
        (page.items || []).map(i => i.str || '').join(' ')
      )
    );
  function heading(items, scale) {
    for (const date of items.filter(i => /^date$/i.test(i.str))) {
      const line = items.filter(i => Math.abs(i.y - date.y) < 3 * scale).sort((a, b) => a.x - b.x);
      const columns = [];
      let cursor = 0;
      for (const label of labels) {
        let found;
        for (let start = cursor; start < line.length && !found; start++) {
          for (let end = start; end < Math.min(line.length, start + 3); end++) {
            if (
              compact(
                line
                  .slice(start, end + 1)
                  .map(i => i.str)
                  .join(' ')
              ) === label
            ) {
              found = { x: line[start].x, right: line[end].x + line[end].w };
              cursor = end + 1;
              break;
            }
          }
        }
        if (!found) break;
        columns.push(found);
      }
      if (
        columns.length === labels.length &&
        columns.every((c, n) => !n || c.x > columns[n - 1].right)
      )
        return { columns, y: date.y, height: Math.max(...line.map(i => i.h)) };
    }
    return null;
  }
  function time(value) {
    const m = value.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
    if (!m) return '';
    let hour = Number(m[1]);
    if (Number(m[2]) > 59 || Number(m[3] || 0) > 59) return '';
    if (m[4]) {
      if (hour < 1 || hour > 12) return '';
      hour = (hour % 12) + (/pm/i.test(m[4]) ? 12 : 0);
    } else if (hour > 23) return '';
    return String(hour).padStart(2, '0') + ':' + m[2] + ':' + (m[3] || '00');
  }
  function kind(type, status) {
    const key = compact(type);
    if (!/^success(?:ful)?$/i.test(status)) return 'unsuccessful';
    if (/reload|topup/.test(key)) return 'reload';
    if (/refund|reversal|cashback|receivefrom|moneyreceived/.test(key)) return 'credit';
    if (/transfer|duitnowtrans/.test(key)) return 'transfer';
    if (/^rfidpayment$/.test(key)) return 'toll';
    if (/parking/.test(key)) return 'parking';
    if (key === 'payment') return 'other';
    return 'unsupported';
  }
  function parse(pages, E) {
    const rows = [],
      warnings = [
        'eWallet: Statement/posted date uses the Date column. Transaction date/time use Details when printed; otherwise the Date column is used without an invented time.',
        'Only successful payments are eligible for expense review. Reloads, credits, transfers and unsuccessful or unknown transaction types stay excluded.',
      ];
    let template = null,
      serial = '',
      tables = 0;
    for (const [pageIndex, page] of pages.entries()) {
      if (
        !(page.width > 0 && page.width <= 3000 && page.height > 0 && page.height <= 4000) ||
        !Array.isArray(page.items)
      )
        throw Error('This page size is not supported.');
      const scale = page.width / 842;
      const items = page.items
        .filter(i => E.clean(i.str) && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(i[k])))
        .map(i => ({ ...i, str: E.clean(i.str) }));
      for (const label of items.filter(i => /\bWallet\s*ID\b/i.test(i.str))) {
        const line = items
          .filter(i => Math.abs(i.y - label.y) < 3 * scale)
          .sort((a, b) => a.x - b.x)
          .map(i => i.str)
          .join(' ');
        const id = line.match(/\bWallet\s*ID\s*:?\s*([A-Z0-9-]{4,40})\b/i)?.[1];
        if (id) {
          if (serial && serial !== 'ewallet:' + id)
            throw Error(
              'This file contains more than one wallet. Upload one wallet statement at a time.'
            );
          serial = 'ewallet:' + id;
        }
      }
      const header = heading(items, scale);
      if (header) {
        const bounds = [
          header.columns[0].x,
          ...header.columns.slice(1).map((c, n) => (header.columns[n].right + c.x) / 2),
          Math.min(page.width, header.columns.at(-1).right + 5 * scale),
        ];
        template = {
          bounds,
          page: pageIndex + 1,
          width: page.width,
          height: page.height,
          rect: E.clampRect(
            {
              x: bounds[0],
              y: header.y - 2 * scale,
              w: bounds.at(-1) - bounds[0],
              h: header.height + 5 * scale,
            },
            page.width,
            page.height
          ),
        };
        tables++;
      }
      if (!template)
        throw Error(
          'The eWallet table headings were not found. Use the complete Transaction History export.'
        );
      if (
        Math.abs(page.width - template.width) > 0.1 ||
        Math.abs(page.height - template.height) > 0.1
      )
        throw Error(
          'The eWallet continuation page has a different layout. Upload one complete statement at a time.'
        );
      const bounds = template.bounds;
      const footer =
        items
          .filter(i => /^\*?\s*This is a system generated/i.test(i.str))
          .sort((a, b) => a.y - b.y)[0]?.y ?? page.height - 15 * scale;
      const starts = items
        .filter(
          i =>
            i.x >= bounds[0] - scale &&
            i.x < bounds[1] &&
            /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(i.str) &&
            i.y > (header ? header.y + header.height : 0) &&
            i.y < footer
        )
        .sort((a, b) => a.y - b.y);
      if (!starts.length)
        warnings.push(`Page ${pageIndex + 1}: no eWallet transaction rows were found.`);
      for (const [n, start] of starts.entries()) {
        if (rows.length >= E.MAX_ROWS)
          throw Error('This statement exceeds 3,000 transactions. Use a shorter statement period.');
        const top = Math.max(0, start.y - scale),
          end = Math.min(footer - scale, starts[n + 1] ? starts[n + 1].y - scale : footer - scale);
        const content = items.filter(
          i => i.y >= top && i.y < end && i.x >= bounds[0] - scale && i.x < bounds.at(-1)
        );
        // Left edges retain wrapped/overflowing text in its actual column; balances never enter Amount.
        const cells = labels.map((_, c) =>
          content
            .filter(i => i.x >= bounds[c] - 0.1 && i.x < bounds[c + 1] - 0.1)
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map(i => i.str)
            .join(' ')
        );
        const postedDate = E.date(cells[0]),
          detailDate = E.date(cells[5]),
          type = cells[2],
          status = cells[1],
          transactionNo = cells[3].replace(/\s+/g, ''),
          amountCents = E.cents(cells[6]),
          classification = kind(type, status),
          errors = [];
        if (!postedDate) errors.push('Check the statement date');
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(cells[5]) && !detailDate)
          errors.push('Check the transaction date in Details');
        if (amountCents === null) errors.push('Check the amount');
        if (!/^[A-Z0-9_-]{4,100}$/i.test(transactionNo))
          errors.push('Check the transaction reference');
        if (!E.clean(cells[4])) errors.push('Check the description');
        // PDF.js y+h is the baseline. Include font descenders, ending before the next row's ink.
        const cropEnd = starts[n + 1]
          ? (starts[n + 1].inkTop ?? starts[n + 1].y) - 0.5 * scale
          : footer - scale;
        const bottom = Math.min(
          cropEnd,
          Math.max(...content.map(i => i.inkBottom ?? i.y + i.h)) + scale
        );
        const rect = E.clampRect(
          { x: bounds[0], y: top, w: bounds.at(-1) - bounds[0], h: Math.max(1, bottom - top) },
          page.width,
          page.height
        );
        rows.push({
          id: `p${pageIndex + 1}-ewallet-${n}`,
          transactionNo,
          section: 'ewallet',
          page: pageIndex + 1,
          width: page.width,
          height: page.height,
          date: detailDate || postedDate,
          entryDate: '',
          postedDate,
          time: time(cells[5]),
          type,
          status,
          sector:
            classification === 'toll'
              ? 'TOLL'
              : classification === 'parking'
                ? 'PARKING'
                : 'EWALLET',
          entry: '',
          exit: '',
          amountCents,
          kind: classification,
          category:
            classification === 'toll' ? 'toll' : classification === 'parking' ? 'parking' : 'other',
          rect,
          originalRect: { ...rect },
          headerRect: { ...template.rect },
          headerPage: template.page,
          errors,
          manual: false,
          selected: false,
          bookingKey: '',
          description: E.clean(cells[4]).slice(0, 300),
        });
      }
    }
    if (!rows.length)
      throw Error('No supported eWallet transaction rows were found. Scanned PDFs need OCR.');
    if (!serial)
      warnings.push(
        'No wallet ID was found. Duplicate checks can recognise this exact file, but not overlapping statements from the same wallet.'
      );
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.transactionNo))
        row.errors.push('Duplicate transaction reference within the file');
      seen.add(row.transactionNo);
    }
    return { rows, serial, warnings, tables };
  }
  root.WorkHubTngWallet = { matches, parse };
})(typeof window !== 'undefined' ? window : globalThis);
