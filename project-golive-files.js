/** Local, paginated issue reports. PDF and JPG share the same print-ready canvas pages. */
(function (root) {
  'use strict';
  const E = root.WorkHubGoLiveIssuesEngine;
  const base = new URL('./', document.currentScript?.src || document.baseURI);
  const fileBase = value =>
    String(value || 'Project')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'Project';
  function extras(issues) {
    const keys = [],
      seen = new Set();
    for (const issue of issues) {
      const counts = new Map();
      for (const extra of issue.extras) {
        const number = (counts.get(extra.header) || 0) + 1;
        counts.set(extra.header, number);
        const key = JSON.stringify([extra.header, number]);
        if (!seen.has(key)) {
          seen.add(key);
          keys.push({ key, header: extra.header, number });
        }
      }
    }
    return keys;
  }
  async function excel(pack, { alive = () => true } = {}) {
    const check = () => {
      if (!alive()) throw Error('Export stopped because the project or access changed.');
    };
    check();
    const keys = extras(pack.issues),
      metrics = E.metrics(pack.issues);
    const fixed = [
      'Issue ID / reference',
      'Issue / summary',
      'Details',
      'Status',
      'Priority',
      'Owner',
      'Reported date',
      'Resolution / remarks',
    ];
    const summary = [
      ['Go-Live issue report', 'Value'],
      ['Project', pack.project],
      ['Generated (UTC)', pack.createdAt],
      ['Issues in report', metrics.total],
      ['Open / pending', metrics.open],
      ['In progress', metrics.progress],
      ['Resolved / closed', metrics.resolved],
      ['Other or blank status', metrics.other],
      ['Report scope', pack.scope || 'All issues'],
    ];
    const data = [
      fixed.concat(
        keys.map(k => 'Extra · ' + k.header + (k.number > 1 ? ' (' + k.number + ')' : ''))
      ),
    ];
    for (const issue of pack.issues) {
      const counts = new Map(),
        values = new Map();
      for (const item of issue.extras) {
        const number = (counts.get(item.header) || 0) + 1;
        counts.set(item.header, number);
        values.set(JSON.stringify([item.header, number]), item.value);
      }
      const state = E.category(issue.status);
      data.push(
        [
          issue.reference,
          issue.title,
          issue.description,
          { value: issue.status, style: state === 'open' ? 3 : state === 'progress' ? 6 : 0 },
          issue.priority,
          issue.owner,
          issue.reported,
          issue.resolution,
        ].concat(keys.map(k => values.get(k.key) || ''))
      );
    }
    const blob = await root.WorkHubValidatorFiles.workbook([
      {
        name: 'Overview',
        rows: summary,
        width: 2,
        widths: [32, 55],
        keepTogether: true,
        escapeText: true,
      },
      {
        name: 'Issue details',
        rows: data,
        width: fixed.length + keys.length,
        widths: [22, 40, 56, 18, 16, 25, 20, 56, ...keys.map(() => 28)],
        keepTogether: true,
        escapeText: true,
      },
    ]);
    check();
    return {
      blob,
      extension: 'xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  function wrap(ctx, value, width, size, bold) {
    ctx.font = `${bold ? 700 : 400} ${size}px system-ui, sans-serif`;
    const result = [];
    for (const paragraph of String(value ?? '').split(/\r\n|\r|\n/)) {
      if (!paragraph) {
        result.push('');
        continue;
      }
      let line = '';
      for (const token of paragraph.split(/(\s+)/)) {
        if (ctx.measureText(line + token).width <= width) {
          line += token;
          continue;
        }
        if (line) {
          result.push(line.trimEnd());
          line = '';
        }
        for (const ch of token.trimStart()) {
          if (line && ctx.measureText(line + ch).width > width) {
            result.push(line);
            line = '';
          }
          line += ch;
        }
      }
      if (line) result.push(line.trimEnd());
    }
    return result.length ? result : [''];
  }
  async function renderPages(pack, onPage, { alive = () => true } = {}) {
    const W = 1240,
      H = 1754,
      M = 90,
      bottom = H - 100;
    const check = () => {
      if (!alive()) throw Error('Export stopped because the project or access changed.');
    };
    if (document.fonts?.ready) await document.fonts.ready;
    check();
    let canvas,
      ctx,
      y,
      pages = 0,
      continuation = '',
      currentField = '';
    function text(value, x, baseline, size, color, bold = false) {
      ctx.font = `${bold ? 700 : 400} ${size}px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(value, x, baseline);
    }
    function start() {
      if (pages >= 240)
        throw Error(
          'The report exceeds 240 pages. Choose fewer issues. No partial file was downloaded.'
        );
      canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Report drawing is unavailable in this browser.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#102c36';
      ctx.fillRect(0, 0, W, 106);
      ctx.fillStyle = '#58d6bd';
      ctx.fillRect(0, 103, W, 5);
      text(
        'W  /  ' + String(pack.workspace || 'WORKHUB').toUpperCase(),
        M,
        48,
        18,
        '#bcdfd7',
        true
      );
      text(
        pages ? 'GO-LIVE ISSUES  /  CONTINUED' : 'PROJECT REPORT  /  GO-LIVE ISSUES',
        M,
        78,
        16,
        '#ffffff',
        true
      );
      y = 150;
      if (pages && continuation) {
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.fillStyle = '#168b78';
        ctx.fillText(continuation + '  /  CONTINUED', M, y, W - M * 2);
        y += 24;
        if (currentField) {
          text(currentField.toUpperCase(), M, y, 13, '#6d8d89', true);
          y += 18;
        }
      }
    }
    async function finish() {
      check();
      ctx.fillStyle = '#e6eeee';
      ctx.fillRect(M, H - 78, W - M * 2, 2);
      text(
        'GENERATED ' + pack.createdAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC'),
        M,
        H - 45,
        14,
        '#6d8587',
        true
      );
      ctx.textAlign = 'right';
      text('GO-LIVE ISSUES  /  ' + (pages + 1), W - M, H - 45, 14, '#6d8587', true);
      ctx.textAlign = 'left';
      await onPage(canvas, pages + 1);
      check();
      pages++;
      canvas.width = canvas.height = 1;
      await new Promise(resolve => root.setTimeout(resolve, 0));
      check();
    }
    async function ensure(height) {
      if (y + height > bottom) {
        await finish();
        start();
      }
    }
    async function write(value, size = 22, color = '#243e42', bold = false, indent = 0) {
      const lines = wrap(ctx, value, W - 2 * M - indent, size, bold),
        lineHeight = Math.ceil(size * 1.42);
      for (const line of lines) {
        await ensure(lineHeight);
        text(line, M + indent, y + size, size, color, bold);
        y += lineHeight;
      }
    }
    async function field(label, value) {
      if (!String(value || '').trim()) return;
      await ensure(78);
      currentField = label;
      await write(label.toUpperCase(), 14, '#5c8783', true);
      await write(value, 20, '#244149');
      y += 12;
      currentField = '';
    }
    start();
    text('THE PROJECT RECORD', M, y, 16, '#188f7b', true);
    y += 23;
    await write('Go-Live issue report', 43, '#102c36', true);
    y += 12;
    await write(pack.project, 26, '#406669', false);
    y += 6;
    await write(pack.scope || 'All project issues', 17, '#73908d');
    y += 24;
    const m = E.metrics(pack.issues),
      cards = [
        ['ISSUES', m.total, '#143d43'],
        ['OPEN / PENDING', m.open, '#b46f18'],
        ['IN PROGRESS', m.progress, '#2778a9'],
        ['RESOLVED / CLOSED', m.resolved, '#168b72'],
        ['OTHER / BLANK', m.other, '#6d7a81'],
      ];
    const gap = 12,
      cardWidth = (W - M * 2 - gap * 4) / 5;
    await ensure(110);
    cards.forEach(([label, value, color], index) => {
      const x = M + index * (cardWidth + gap);
      ctx.fillStyle = '#f1f7f6';
      ctx.fillRect(x, y, cardWidth, 102);
      text(label, x + 14, y + 28, 11, '#55716f', true);
      text(String(value), x + 14, y + 77, 34, color, true);
    });
    y += 145;
    await write('ISSUE REGISTER', 17, '#138a78', true);
    await write('Details and follow-up', 28, '#102c36', true);
    y += 18;
    if (!pack.issues.length) await write('No issues are included in this report.', 21, '#66817e');
    for (let i = 0; i < pack.issues.length; i++) {
      const issue = pack.issues[i];
      continuation = '';
      currentField = '';
      await ensure(155);
      ctx.fillStyle = '#e8f3f1';
      ctx.fillRect(M, y, W - M * 2, 2);
      y += 18;
      continuation =
        'ISSUE ' +
        String(i + 1).padStart(2, '0') +
        (issue.reference ? ' / ' + issue.reference : '');
      await write(continuation, 14, '#188f7b', true);
      await write(issue.title, 25, '#102c36', true);
      y += 12;
      await field('Status', issue.status || 'Not specified');
      await field('Priority', issue.priority);
      await field('Owner', issue.owner);
      await field('Reported date', issue.reported);
      await field('Details', issue.description);
      await field('Resolution / remarks', issue.resolution);
      for (const item of issue.extras) await field(item.header, item.value);
      y += 20;
    }
    await finish();
    return pages;
  }
  const canvasBlob = (canvas, type, quality) =>
    new Promise((resolve, reject) =>
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(Error('Could not render a report page.'))),
        type,
        quality
      )
    );
  async function visual(pack, format, options = {}) {
    if (!['pdf', 'jpg'].includes(format)) throw Error('Choose PDF or JPG.');
    const alive = options.alive || (() => true),
      check = () => {
        if (!alive()) throw Error('Export stopped because the project or access changed.');
      };
    let pdf = null,
      zip = null,
      only = null,
      count = 0;
    if (format === 'pdf') {
      const { PDFDocument } = await import(new URL('vendor/pdf-lib/pdf-lib.esm.min.js', base));
      check();
      pdf = await PDFDocument.create();
      pdf.setTitle('Go-Live issues - ' + pack.project);
      pdf.setCreationDate(new Date(pack.createdAt));
    } else {
      if (!root.JSZip) throw Error('JPG export is unavailable. Refresh and try again.');
      zip = new root.JSZip();
    }
    count = await renderPages(
      pack,
      async (canvas, page) => {
        check();
        const blob = await canvasBlob(canvas, format === 'pdf' ? 'image/png' : 'image/jpeg', 0.93);
        check();
        if (pdf) {
          const image = await pdf.embedPng(await blob.arrayBuffer());
          check();
          const sheet = pdf.addPage([595.28, 841.89]);
          sheet.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
        } else {
          if (page === 1) only = blob;
          zip.file(
            fileBase(pack.project) +
              '-Go-Live-issues-page-' +
              String(page).padStart(2, '0') +
              '.jpg',
            await blob.arrayBuffer()
          );
        }
      },
      options
    );
    check();
    if (pdf)
      return {
        blob: new root.Blob([await pdf.save()], { type: 'application/pdf' }),
        extension: 'pdf',
        type: 'application/pdf',
        pages: count,
      };
    if (count === 1) return { blob: only, extension: 'jpg', type: 'image/jpeg', pages: count };
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    check();
    return { blob, extension: 'zip', type: 'application/zip', pages: count };
  }
  root.WorkHubGoLiveIssuesFiles = Object.freeze({ excel, visual, renderPages, extras, fileBase });
})(window);
