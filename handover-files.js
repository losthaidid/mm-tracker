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
    const W = 1240,
      H = 1754,
      M = 84,
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
      ctx.fillStyle = '#078597';
      ctx.fillRect(M, 55, 48, 5);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillStyle = '#527077';
      ctx.fillText('WORKHUB / HANDOVER', M + 64, 65);
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
        await write(value);
        y += 13;
      }
    }
    start();
    await write(pack.title, 42, true);
    y += 18;
    await write(
      new Date(pack.createdAt).toLocaleString() + ' · ' + pack.records.length + ' work records',
      21,
      false,
      '#527a82'
    );
    y += 25;
    await field('From', pack.from);
    await field('To', pack.to);
    await field('Handover note', pack.summary);
    await write('A dated copy of the selected work', 26, true);
    y += 8;
    await write(
      'Statuses, identifiers and dates are captured as shown at preview time. Later edits to your workspace do not change this file.',
      21
    );
    y += 24;
    for (const [i, r] of pack.records.entries()) {
      check();
      if (y > bottom - 170) {
        await finish();
        start();
      }
      ctx.fillStyle = '#d1e6e5';
      ctx.fillRect(M, y, W - M * 2, 2);
      y += 20;
      await write(
        `${String(i + 1).padStart(2, '0')} / ${root.WorkHubHandoverEngine.labels[r.kind]}${r.childId ? ' · Sub-item' : ''}`,
        18,
        true,
        '#078597'
      );
      y += 8;
      await write([r.identifier, r.title].filter(Boolean).join(' · '), 29, true);
      y += 12;
      if (r.parent)
        await field(
          'Parent record',
          [r.parent.identifier, r.parent.title, '(ID: ' + r.parent.id + ')']
            .filter(Boolean)
            .join(' · ')
        );
      await field('Record ID', r.childId ? r.id + ' / ' + r.childId : r.id);
      await field('Project', r.project || r.projectId);
      await field('Status / Priority', [r.status, r.priority].filter(Boolean).join(' · '));
      await field('Owner', r.owner);
      await field('Due / Follow-up', r.due);
      await field('Expected date', r.expected);
      await field('Notes', r.notes);
      await field(r.kind === 'tickets' ? 'Latest ticket update' : 'Feedback', r.feedback);
      await field('Next step', r.nextStep);
      await field('Blocker', r.blocker);
      for (const ref of r.references) await field('Reference · ' + ref.label, ref.url || ref.label);
      y += 20;
    }
    await finish();
    check();
    const bytes = await doc.save();
    check();
    return new Blob([bytes], { type: 'application/pdf' });
  }
  root.WorkHubHandoverFiles = { pdf };
})(globalThis);
