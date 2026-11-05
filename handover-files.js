/* Paginated, local PDF export. Canvas preserves browser-rendered Unicode and exact identifier text. */
(function (root) {
  'use strict';
  const base = new URL('./', document.currentScript?.src || document.baseURI);
  let library;
  async function pdf(pack, { alive = () => true } = {}) {
    const check = () => {
      if (!alive()) throw Error('Export stopped because the account or permissions changed.');
    };
    check();
    if (!library)
      library = import(new URL('vendor/pdf-lib/pdf-lib.esm.min.js', base)).catch(e => {
        library = null;
        throw e;
      });
    const { PDFDocument } = await library;
    check();
    if (document.fonts?.ready) await document.fonts.ready;
    check();
    const doc = await PDFDocument.create();
    doc.setTitle(pack.title);
    doc.setSubject('WorkHub handover snapshot · ' + pack.createdAt);
    doc.setCreationDate(new Date(pack.createdAt));
    const E = root.WorkHubHandoverEngine,
      compact = pack.layout === 'compact',
      W = 1240,
      H = 1754,
      M = compact ? 72 : 84,
      bottom = H - 100;
    let canvas,
      ctx,
      y,
      pages = 0;
    function start() {
      if (pages >= 240)
        throw Error(
          'This report exceeds 240 pages. Choose fewer records or exclude notes. No partial report was downloaded.'
        );
      canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      if (!ctx) throw Error('PDF drawing is unavailable. Try a current desktop browser.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#eef4fb';
      ctx.fillRect(0, 0, W, 88);
      ctx.fillStyle = '#0064d9';
      ctx.fillRect(0, 0, W, 7);
      ctx.fillRect(M, 48, 32, 5);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillStyle = '#527077';
      ctx.fillText('WORKHUB / HANDOVER PACK', M + 50, 62);
      y = 115;
    }
    async function finish() {
      check();
      ctx.fillStyle = '#64777e';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(
        pack.createdAt.replace('T', ' ').replace('Z', ' UTC') + ' · Snapshot',
        M,
        H - 48
      );
      ctx.textAlign = 'right';
      ctx.fillText(String(pages + 1), W - M, H - 48);
      ctx.textAlign = 'left';
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      check();
      if (!blob) throw Error('Could not render a PDF page.');
      const image = await doc.embedPng(await blob.arrayBuffer());
      check();
      const page = doc.addPage([595.28, 841.89]);
      page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
      pages++;
      canvas.width = canvas.height = 1;
      await new Promise(resolve => setTimeout(resolve, 0));
      check();
    }
    function lines(value, size = 23, bold = false) {
      ctx.font = `${bold ? 650 : 400} ${size}px system-ui, sans-serif`;
      const out = [];
      for (const paragraph of String(value).split(/\r?\n/)) {
        if (!paragraph) {
          out.push('');
          continue;
        }
        let line = '';
        for (const chunk of paragraph.split(/(\s+)/)) {
          if (ctx.measureText(line + chunk).width <= W - 2 * M) {
            line += chunk;
            continue;
          }
          if (line) {
            out.push(line);
            line = '';
          }
          for (const char of chunk) {
            if (line && ctx.measureText(line + char).width > W - 2 * M) {
              out.push(line);
              line = '';
            }
            line += char;
          }
        }
        if (line) out.push(line);
      }
      return out;
    }
    async function write(value, size = 23, bold = false, colour = '#23454d') {
      const wrapped = lines(value, size, bold),
        height = Math.ceil(size * 1.45);
      for (const line of wrapped) {
        if (y + height > bottom) {
          await finish();
          start();
        }
        ctx.font = `${bold ? 650 : 400} ${size}px system-ui, sans-serif`;
        ctx.fillStyle = colour;
        ctx.fillText(line, M, y + size);
        y += height;
      }
    }
    async function field(label, value) {
      if (value) {
        await write(label.toUpperCase(), 17, true, '#527a82');
        await write(value, compact ? 21 : 23);
        y += compact ? 7 : 13;
      }
    }
    async function heading(title, size = 27) {
      if (y > bottom - 150) {
        await finish();
        start();
      }
      y += compact ? 10 : 18;
      await write(title, size, true, '#004b8d');
      y += 9;
    }
    const recordName = r => [r.identifier, r.title].filter(Boolean).join(' · ');
    const info = E.overview(pack);
    start();
    await write('HANDOVER SNAPSHOT', 18, true, '#0064d9');
    y += 8;
    await write(pack.title, 42, true, '#152935');
    y += 18;
    await write(
      new Date(pack.createdAt).toLocaleString() + ' · ' + info.groups + ' work groups',
      21, false, '#527a82'
    );
    y += 20;
    await field('From', pack.from);
    await field('To', pack.to);
    await field('Handover note', pack.summary);
    await heading('At a glance', 30);
    await write(
      info.total + ' selected records  ·  ' + info.open + ' open  ·  ' +
      info.completed + ' finished  ·  ' + info.overdue + ' overdue',
      24, true
    );
    y += 10;
    await write(
      info.main + ' main records · ' + info.children +
      ' sub-items. Summary counts cover selected records; each parent progress count covers all of its source sub-items.',
      21
    );
    await field('Status breakdown', info.statuses.map(s => s.status + ': ' + s.count).join(' · '));
    await write(
      'Statuses, identifiers and dates are captured at preview time. Later edits do not change this dated file. Missing values are left blank; no owner, date or next action has been inferred.',
      20, false, '#527077'
    );
    await heading('Needs attention');
    await write(
      'Based on recorded priority, due dates, status and prerequisites as of ' +
      (pack.asOf || pack.createdAt.slice(0, 10)) + '.', 20
    );
    y += 12;
    if (!info.attention.length)
      await write('No overdue, blocked or high-priority records in this selection.', 21);
    for (const item of info.attention) {
      check();
      await write(recordName(item.record), 23, true);
      await field('Attention', [
        item.record.parent && 'Under ' +
          [item.record.parent.identifier, item.record.parent.title].filter(Boolean).join(' · '),
        item.reasons.join(' · '),
        item.record.owner && 'Owner: ' + item.record.owner,
      ].filter(Boolean).join('\n'));
    }
    await heading('Next actions');
    if (!info.actions.length)
      await write('No next actions were recorded in the included fields.', 21);
    for (const r of info.actions) {
      await write(recordName(r), 23, true);
      await field('Next action', [
        r.nextStep,
        r.owner && 'Owner: ' + r.owner,
        r.due && 'Due: ' + r.due,
      ].filter(Boolean).join('\n'));
    }
    if (info.unassigned)
      await write(
        info.unassigned + ' open record(s) have no owner / PIC recorded. The pack recipient is not assigned as their owner.',
        21, false, '#735200'
      );
    await heading('Work records', 32);
    await write(
      'Only selected records are included. Parent labels identify the correct group; unselected parent notes and unselected child records are not copied into this pack.',
      20
    );
    let number = 0;
    for (const group of E.groups(pack.records)) {
      check();
      await heading(E.labels[group.kind] + ' / ' + group.title, 29);
      if (!group.parentSelected)
        await write('Parent shown for identification. Its details were not selected.', 20);
      for (const r of group.records) {
        check();
        if (y > bottom - 170) {
          await finish();
          start();
        }
        ctx.fillStyle = '#d4e2ef';
        ctx.fillRect(M, y, W - M * 2, 2);
        y += compact ? 12 : 20;
        await write(
          String(++number).padStart(2, '0') + ' / ' +
          (r.childId ? 'SUB-ITEM' : 'MAIN RECORD') + ' · ' + r.status,
          18, true, E.closed(r.status) ? '#256f3a' : '#0064d9'
        );
        y += 8;
        await write(recordName(r), compact ? 26 : 29, true);
        y += 12;
        if (r.parent)
          await field(
            'Parent record',
            [r.parent.identifier, r.parent.title, '(ID: ' + r.parent.id + ')']
              .filter(Boolean).join(' · ')
          );
        for (const section of E.sections(r)) {
          await heading(section.title, compact ? 23 : 25);
          for (const f of section.fields) await field(f.label, f.value);
        }
        await field('Record ID', r.childId ? r.id + ' / ' + r.childId : r.id);
        y += compact ? 10 : 20;
      }
    }
    await finish();
    check();
    const bytes = await doc.save();
    check();
    return new Blob([bytes], { type: 'application/pdf' });
  }
  root.WorkHubHandoverFiles = { pdf };
})(globalThis);
