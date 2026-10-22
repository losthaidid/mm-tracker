/**
 * TNG statement rules and coordinates, independent of the browser/PDF library.
 * Retains both card tables and dispatches eWallet history to its separate reader. Money stays in integer sen.
 * PDF bytes and unselected transactions are temporary; only confirmed expenses are saved.
 */
(function (root) {
  'use strict';
  const MAX_ROWS = 3000,
    MAX_PAGES = 60;
  const clean = value =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  const dateValid = value => root.WorkHubClaimsEngine.validDate(value);
  function date(value) {
    const m = clean(value).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    const result = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
    return dateValid(result) ? result : '';
  }
  function cents(value) {
    const v = clean(value)
      .replace(/,/g, '')
      .replace(/^RM\s*/i, '');
    if (!/^\d{1,7}\.\d{2}$/.test(v)) return null;
    const [whole, fraction] = v.split('.');
    const result = Number(whole) * 100 + Number(fraction);
    return Number.isSafeInteger(result) && result > 0 && result <= 100000000 ? result : null;
  }
  function rectangle(value, width, height) {
    return (
      !!value &&
      ['x', 'y', 'w', 'h'].every(k => Number.isFinite(value[k])) &&
      value.x >= 0 &&
      value.y >= 0 &&
      value.w >= 1 &&
      value.h >= 1 &&
      value.x + value.w <= width + 0.1 &&
      value.y + value.h <= height + 0.1
    );
  }
  function clampRect(value, width, height) {
    const x = Math.max(0, Math.min(width - 1, Number(value.x) || 0));
    const y = Math.max(0, Math.min(height - 1, Number(value.y) || 0));
    return {
      x,
      y,
      w: Math.max(1, Math.min(width - x, Number(value.w) || 1)),
      h: Math.max(1, Math.min(height - y, Number(value.h) || 1)),
    };
  }
  /** Reconstruct multiline cells by position, never by splitting arbitrary whitespace. */
  function parsePages(pages) {
    if (!Array.isArray(pages) || !pages.length || pages.length > MAX_PAGES)
      throw Error('Choose a statement with 1–60 pages.');
    if (root.WorkHubTngWallet?.matches(pages))
      return root.WorkHubTngWallet.parse(pages, { MAX_ROWS, clean, date, cents, clampRect });
    const rows = [],
      warnings = [];
    let serial = '',
      tables = 0;
    for (const [pageIndex, page] of pages.entries()) {
      if (
        !(page.width > 0 && page.width <= 3000 && page.height > 0 && page.height <= 4000) ||
        !Array.isArray(page.items)
      )
        throw Error('This page size is not supported.');
      const scale = page.width / 595;
      const items = page.items
        .filter(i => clean(i.str) && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(i[k])))
        .map(i => ({ ...i, str: clean(i.str) }));
      const pageText = items.map(i => i.str).join(' ');
      const serialMatch = pageText.match(/Serial\s*No\.?\s*:?\s*([A-Z0-9-]{4,40})/i);
      if (serialMatch) {
        if (serial && serial !== serialMatch[1])
          throw Error(
            'This file contains more than one card. Upload one card statement at a time.'
          );
        serial = serialMatch[1];
      }
      const headers = items
        .filter(i => i.x < 70 * scale && /^(Trans\s*No\.?|Transaction)$/i.test(i.str))
        .sort((a, b) => a.y - b.y);
      for (const [index, header] of headers.entries()) {
        const section = /^Trans\s*No/i.test(header.str) ? 'offline' : 'online';
        const bottom = headers[index + 1]?.y - 22 * scale || page.height - 32 * scale;
        const nearHeader = items.filter(
          i => Math.abs(i.y - header.y) < 18 * scale && i.x > 470 * scale
        );
        if (!nearHeader.some(i => /Amount/i.test(i.str))) {
          warnings.push(`Page ${pageIndex + 1}: an unfamiliar table was not read.`);
          continue;
        }
        tables++;
        const bounds = (
          section === 'offline'
            ? [20, 70, 120, 177, 205, 235, 280, 330, 380, 420, 470, 505, 535, 575]
            : [20, 70, 120, 177, 205, 255, 315, 375, 430, 475, 530, 575]
        ).map(x => x * scale);
        const references = items
          .filter(
            i =>
              i.x < bounds[1] &&
              i.x >= bounds[0] - 2 * scale &&
              i.y > header.y + 11 * scale &&
              i.y < bottom &&
              /^[A-Z0-9-]{4,40}$/i.test(i.str) &&
              /\d/.test(i.str)
          )
          .sort((a, b) => a.y - b.y);
        const groups = [];
        for (const item of references) {
          const last = groups.at(-1);
          if (section === 'online' && last && item.y - last.at(-1).y < 12 * scale) last.push(item);
          else groups.push([item]);
        }
        const lines = (page.lines || [])
          .filter(l => Number.isFinite(l.y) && l.x2 - l.x1 > page.width * 0.8)
          .map(l => l.y)
          .sort((a, b) => a - b);
        for (const [n, refs] of groups.entries()) {
          if (rows.length >= MAX_ROWS)
            throw Error(
              'This statement exceeds 3,000 transactions. Use a shorter statement period.'
            );
          const center = (refs[0].y + refs.at(-1).y + refs.at(-1).h) / 2;
          const bandTop = lines.filter(y => y < center).at(-1);
          const bandEnd = lines.find(y => y > center);
          const top = bandTop ?? refs[0].y - (section === 'offline' ? 12 : 3) * scale;
          const end =
            bandEnd ??
            (groups[n + 1]
              ? groups[n + 1][0].y - (section === 'offline' ? 12 : 3) * scale
              : bottom);
          const content = items.filter(
            i => i.y >= top && i.y < end && i.x >= bounds[0] - 2 * scale && i.x < bounds.at(-1)
          );
          const cells = Array.from({ length: bounds.length - 1 }, (_, c) =>
            content
              .filter(i => i.x + i.w / 2 >= bounds[c] && i.x + i.w / 2 < bounds[c + 1])
              .sort((a, b) => a.y - b.y || a.x - b.x)
              .map(i => i.str)
              .join(' ')
          );
          const type = cells[4],
            sector = cells.at(-1).toUpperCase();
          const postedDate = date(cells[3].replace(/\s+/g, ''));
          const transactionDate = date(cells[2]),
            entryDate = date(cells[1]);
          const time = cells[2].match(/\b\d{2}:\d{2}:\d{2}\b/)?.[0] || '';
          const amountCents = cents(cells[section === 'offline' ? 10 : 9]);
          const kind = /reload|top.?up/i.test(type)
            ? 'reload'
            : /refund|reversal/i.test(type)
              ? 'credit'
              : sector === 'TOLL'
                ? 'toll'
                : /parking/i.test(sector + ' ' + type)
                  ? 'parking'
                  : 'other';
          const errors = [];
          if (!transactionDate) errors.push('Check the transaction date');
          if (!postedDate) errors.push('Check the posted date');
          if (amountCents === null) errors.push('Check the amount');
          if (!type || !sector) errors.push('Check the transaction type');
          const rowItems = content.filter(i => i.y >= top && i.y < end);
          const y = bandTop ?? Math.max(0, Math.min(...rowItems.map(i => i.y)) - scale);
          const y2 =
            bandEnd ?? Math.min(page.height, Math.max(...rowItems.map(i => i.y + i.h)) + scale);
          const rect = { x: bounds[0], y, w: bounds.at(-1) - bounds[0], h: Math.max(1, y2 - y) };
          const hy = lines.filter(y => y < header.y).at(-1) ?? Math.max(0, header.y - 12 * scale);
          const headerEnd = lines.find(y => y > header.y) ?? hy + 32 * scale;
          const headerRect = {
            x: bounds[0],
            y: hy,
            w: bounds.at(-1) - bounds[0],
            h: headerEnd - hy,
          };
          rows.push({
            id: `p${pageIndex + 1}-${section}-${n}`,
            transactionNo: refs.map(i => i.str).join(''),
            section,
            page: pageIndex + 1,
            width: page.width,
            height: page.height,
            date: transactionDate,
            entryDate,
            postedDate,
            time,
            type,
            sector,
            entry: cells[5],
            exit: cells[7],
            amountCents,
            kind,
            category: kind === 'toll' ? 'toll' : kind === 'parking' ? 'parking' : 'other',
            rect,
            originalRect: { ...rect },
            headerRect: clampRect(headerRect, page.width, page.height),
            errors,
            manual: false,
            selected: false,
            bookingKey: '',
            description: clean(
              cells[5] === cells[7] ? cells[5] : cells[5] + ' → ' + cells[7]
            ).slice(0, 300),
          });
        }
      }
    }
    if (!tables || !rows.length)
      throw Error(
        'No supported TNG transaction table was found. Use a text-based Customer Transactions Statement or eWallet Transaction History; scanned PDFs need OCR.'
      );
    if (!serial)
      warnings.push(
        'No card serial was found. Duplicate checks can recognise this exact file, but not overlapping statements from the same card. Check your existing expenses before saving.'
      );
    const identities = new Set();
    for (const row of rows) {
      const key = row.section + '|' + row.transactionNo;
      if (identities.has(key)) row.errors.push('Duplicate transaction reference within the file');
      identities.add(key);
    }
    return { rows, serial, warnings, tables };
  }
  function matches(d, day, type = '') {
    const groups = new Map();
    for (const s of d.schedule || []) {
      if (s.date !== day || root.WorkHubLeave?.isLeave(s.kind)) continue;
      if (type && root.WorkHubClaimsEngine.claimType(s) !== type) continue;
      const onSite =
        !!s.travel || !!s.claimLocationName || /client|site|on.?site/i.test(s.location || '');
      if (!onSite) continue;
      const key = s.bookingId || s.planId || s.date + '|' + s.time;
      if (groups.has(key)) continue;
      const plan = d.projectPlans?.find(p => p.id === s.planId),
        task = d.tasks?.find(t => t.id === s.linkId);
      const projectId =
        plan?.projectId || (s.kind === 'project' ? s.linkId : task?.projectId) || '';
      const project = d.projects?.find(p => p.id === projectId);
      groups.set(key, {
        key,
        bookingId: s.bookingId || '',
        locationId: s.travel?.locationId || '',
        locationName: s.travel?.locationName || s.claimLocationName || s.location || '',
        claimType: root.WorkHubClaimsEngine.claimType(s),
        title: clean(plan?.title || task?.task || s.text || 'On-site visit').slice(0, 200),
        project: project?.name || '',
        time: s.time,
      });
    }
    return [...groups.values()];
  }
  function sourceKey(cardKey, row) {
    return `${cardKey}|${row.section}|${row.transactionNo}`;
  }
  const isExcluded = row =>
    ['reload', 'credit', 'transfer', 'unsuccessful', 'unsupported'].includes(row.kind);
  /** Evidence always follows the transaction date/time, even when the ledger uses posted dates. */
  function evidenceGroups(rows) {
    const groups = new Map();
    for (const row of rows
      .filter(r => !r.manual)
      .slice()
      .sort(
        (a, b) =>
          (a.date + a.time).localeCompare(b.date + b.time) || a.page - b.page || a.rect.y - b.rect.y
      )) {
      if (!dateValid(row.date))
        throw Error('Review the transaction dates before exporting evidence.');
      const toll = row.category === 'toll',
        hasTime = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(row.time || ''),
        direction = !toll
          ? 'other'
          : !hasTime
            ? 'review'
            : Number(row.time.slice(0, 2)) < 12
              ? 'to'
              : 'return',
        key = row.date + '|' + direction;
      if (!groups.has(key)) groups.set(key, { key, date: row.date, direction, rows: [] });
      groups.get(key).rows.push(row);
    }
    return [...groups.values()]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          ['to', 'return', 'review', 'other'].indexOf(a.direction) -
            ['to', 'return', 'review', 'other'].indexOf(b.direction)
      )
      .map(g => {
        const date = g.date.split('-').reverse().join('/');
        return {
          ...g,
          caption:
            g.direction === 'other'
              ? `Other expenses (${date})`
              : g.direction === 'review'
                ? `Tolls (${date} - review time)`
                : `tol ${g.rows.length} of ${g.rows.length} (${date} ${g.direction})`,
        };
      });
  }
  function duplicate(d, key) {
    return (d.workhub?.claims?.expenses || []).some(e => e.tngSource?.key === key);
  }
  function validateSource(s) {
    const text = (v, n) =>
      typeof v === 'string' && v.length <= n && !/[\u0000-\u001f\u007f]/.test(v);
    if (
      !s ||
      s.version !== 1 ||
      !text(s.key, 250) ||
      !s.key ||
      !/^[a-f0-9]{64}$/.test(s.fileHash) ||
      !text(s.fileName, 200) ||
      !text(s.transactionNo, 100) ||
      !['online', 'offline', 'ewallet'].includes(s.section) ||
      !dateValid(s.transactionDate) ||
      !dateValid(s.postedDate) ||
      !Number.isInteger(s.page) ||
      s.page < 1 ||
      s.page > MAX_PAGES ||
      (s.headerPage !== undefined &&
        (!Number.isInteger(s.headerPage) || s.headerPage < 1 || s.headerPage > MAX_PAGES)) ||
      !Number.isFinite(s.width) ||
      s.width < 1 ||
      s.width > 3000 ||
      !Number.isFinite(s.height) ||
      s.height < 1 ||
      s.height > 4000 ||
      !rectangle(s.rect, s.width, s.height) ||
      !rectangle(s.headerRect, s.width, s.height)
    )
      throw Error('Check the TNG expense source details.');
  }
  /** Build confirmed ledger rows. The caller saves the complete selection in one mutation. */
  function expenses(d, rows, source, basis = 'transaction', claimType = 'client-site') {
    if (!['transaction', 'posted'].includes(basis)) throw Error('Choose a valid date basis.');
    if (!Object.hasOwn(root.WorkHubClaimsEngine.CLAIM_TYPES, claimType))
      throw Error('Choose a valid claim type.');
    if (!rows.length || rows.length > MAX_ROWS) throw Error('Select at least one expense.');
    const out = [],
      keys = new Set(),
      now = new Date().toISOString();
    for (const row of rows) {
      const day = basis === 'posted' ? row.postedDate : row.date;
      if (
        !dateValid(day) ||
        !Number.isSafeInteger(row.amountCents) ||
        row.amountCents < 1 ||
        row.amountCents > 100000000 ||
        !clean(row.description) ||
        row.description.length > 300 ||
        !Object.hasOwn(root.WorkHubClaimsEngine.CATEGORIES, row.category) ||
        row.errors?.length ||
        isExcluded(row)
      )
        throw Error(
          'Review the selected dates, amounts and transaction types first. Reloads, credits, transfers and unsuccessful or unknown transactions cannot be imported as expenses.'
        );
      const key = row.manual ? '' : sourceKey(source.cardKey, row);
      if (key && (keys.has(key) || duplicate(d, key)))
        throw Error(
          'A selected transaction is already in your expense ledger. Refresh the review before saving.'
        );
      if (key) keys.add(key);
      const choices = matches(d, day, claimType),
        match = choices.find(m => m.key === row.bookingKey);
      if (row.bookingKey && !match)
        throw Error('A linked visit changed. Choose the visit again before saving.');
      const e = {
        id:
          root.crypto?.randomUUID?.() ||
          'tng-' +
            Date.now().toString(36) +
            '-' +
            out.length +
            '-' +
            Math.random().toString(36).slice(2),
        date: day,
        category: row.category,
        amountCents: row.amountCents,
        description: clean(row.description),
        payment: 'Touch ’n Go',
        claimable: true,
        claimType,
        locationId: match?.locationId || '',
        locationName: match?.locationName || '',
        bookingId: match?.bookingId || '',
        reference: row.manual ? '' : row.transactionNo.slice(0, 160),
        notes: clean(row.notes || '').slice(0, 2000),
        createdAt: now,
        updatedAt: now,
      };
      if (!row.manual) {
        e.tngSource = {
          version: 1,
          key,
          fileHash: source.fileHash,
          fileName: source.fileName.slice(0, 200),
          transactionNo: row.transactionNo,
          section: row.section,
          transactionDate: row.date,
          postedDate: row.postedDate,
          page: row.page,
          width: row.width,
          height: row.height,
          rect: { ...row.rect },
          headerRect: { ...row.headerRect },
          ...(row.headerPage !== undefined ? { headerPage: row.headerPage } : {}),
        };
        validateSource(e.tngSource);
      }
      out.push(e);
    }
    if (d.workhub.claims.expenses.length + out.length > 5000)
      throw Error('The expense ledger supports up to 5,000 entries.');
    return out;
  }
  root.WorkHubTngEngine = {
    MAX_ROWS,
    MAX_PAGES,
    clean,
    date,
    cents,
    rectangle,
    clampRect,
    parsePages,
    matches,
    evidenceGroups,
    sourceKey,
    isExcluded,
    duplicate,
    validateSource,
    expenses,
  };
})(typeof window !== 'undefined' ? window : globalThis);
