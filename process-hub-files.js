/** Local Process Hub exports. Canvas keeps user text literal and supports browser fonts.
 * PDF pages are rasterised individually to bound memory; no files are uploaded. */
(function (root) {
  'use strict';
  const E = root.WorkHubRehearsalEngine;
  const base = new URL('./', document.currentScript?.src || document.baseURI);
  let pdfLibrary;
  const ink = '#24453e',
    muted = '#61776f',
    accent = '#367c6b';
  const font = (size, bold = false) => `${bold ? 600 : 400} ${size}px system-ui, sans-serif`;
  function wrap(ctx, value, width) {
    const lines = [];
    for (const paragraph of String(value ?? '').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && ctx.measureText(line + ' ' + word).width <= width) {
          line += ' ' + word;
          continue;
        }
        if (line) {
          lines.push(line);
          line = '';
        }
        for (const char of word) {
          if (line && ctx.measureText(line + char).width > width) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function rounded(c, x, y, w, h, r = 14) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function context(canvas) {
    const c = canvas.getContext('2d');
    if (!c) throw Error('This browser could not open the exporter. Try a desktop browser.');
    return c;
  }
  function toBlob(canvas, type = 'image/png', quality) {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        blob =>
          blob ? resolve(blob) : reject(Error('The image could not be prepared. Try again.')),
        type,
        quality
      )
    );
  }
  function stepSections(p, s, scope, state = {}) {
    const title = id => p.steps.find(x => x.id === id)?.title || 'End of route';
    const common = [
      ['Responsible person / role', s.owner],
      ['Transaction / reference codes', s.tcode],
      ['Before you start', s.prerequisites],
      ['Instructions', scope === 'audience' ? s.audienceText || s.instruction : s.instruction],
      ['Inputs', s.inputs],
      ['Expected result', s.expected],
      ['Outputs', s.outputs],
      ['System / tool', s.system],
      ['Typical working time', s.workingTime],
      ['Normal next step', s.next ? title(s.next) : 'End of route'],
      ['Alternative routes', (s.alternatives || []).map(title).join('\n')],
      ['Exception route', s.failNext ? title(s.failNext) : 'Stop at the exception'],
    ];
    if (scope === 'reference')
      common.push(
        ['If it fails / common errors and solutions', s.failure],
        ['Configuration / setup', s.configuration],
        ['Testing checklist', s.testing],
        ['Explanation for users', s.audienceText],
        ['Reference URL', s.link],
        [
          'Sample value changes',
          s.changes
            .map(c => c.field + (c.operator === 'add' ? ' += ' : ' = ') + c.value)
            .join('\n'),
        ],
        ...[
          ['projectId', 'Related project', state.projects, 'name'],
          ['ticketId', 'Related ticket', state.tickets, 'ticket'],
          ['itemId', 'Related project item', state.specs, 'description'],
          ['noteId', 'Knowledge note', state.workhub?.notes, 'title'],
        ].map(([key, label, rows, field]) => [
          label,
          s[key] ? rows?.find(r => r.id === s[key])?.[field] || 'Saved reference unavailable' : '',
        ])
      );
    return common.filter(([, value]) => value);
  }
  function ordered(p) {
    const seen = new Set(),
      list = [],
      map = new Map(p.steps.map(s => [s.id, s]));
    let id = p.startId;
    while (id && map.has(id) && !seen.has(id)) {
      const step = map.get(id);
      list.push(step);
      seen.add(id);
      id = step.next;
    }
    return [...list, ...p.steps.filter(s => !seen.has(s.id))];
  }
  function diagram(process) {
    const p = E.normalize(process),
      canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 600;
    const c = context(canvas);
    c.font = font(38, true);
    const titles = wrap(c, p.name, 1488),
      header = Math.max(170, 100 + titles.length * 46);
    const minX = Math.min(0, ...p.steps.map(s => s.x - 90)),
      minY = Math.min(0, ...p.steps.map(s => s.y - 40));
    const w = Math.max(640, ...p.steps.map(s => s.x + 300)) - minX,
      h = Math.max(300, ...p.steps.map(s => s.y + 160)) - minY;
    const scale = Math.min(2, 1488 / w, 1950 / h),
      graphHeight = Math.ceil(h * scale);
    canvas.height = header + graphHeight + 85;
    c.fillStyle = '#f4f4ed';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#e1ece3';
    c.fillRect(0, 0, canvas.width, header);
    c.fillStyle = accent;
    c.font = font(15, true);
    c.fillText('PROCESS HUB / PROCESS MAP', 56, 37);
    c.fillStyle = ink;
    c.font = font(38, true);
    titles.forEach((line, i) => c.fillText(line, 56, 89 + i * 46));
    c.fillStyle = muted;
    c.font = font(17);
    c.fillText(
      `${p.steps.length} steps · ${p.scenarios.length} scenarios · Solid: normal route / Dashed: exception`,
      56,
      header - 24
    );
    c.save();
    c.translate(56 - minX * scale, header + 20 - minY * scale);
    c.scale(scale, scale);
    const map = new Map(p.steps.map(s => [s.id, s]));
    for (const s of p.steps)
      for (const [kind, id] of [
        ['normal', s.next],
        ...s.alternatives.map(id => ['normal', id]),
        ['exception', s.failNext],
      ]) {
        const b = map.get(id);
        if (!b) continue;
        const k = Math.max(70, Math.abs(b.x - s.x - 210) * 0.45),
          x = s.x + 210,
          y = s.y + 50;
        c.strokeStyle = kind === 'exception' ? '#ba7770' : '#7a9e8e';
        c.lineWidth = 2.5;
        c.setLineDash(kind === 'exception' ? [6, 6] : []);
        c.beginPath();
        c.moveTo(x, y);
        const offset = b.x <= x ? 150 : 0;
        c.bezierCurveTo(x + k, y + offset, b.x - k, b.y + 50 + offset, b.x, b.y + 50);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = c.strokeStyle;
        c.beginPath();
        c.moveTo(b.x, b.y + 50);
        c.lineTo(b.x - 10, b.y + 45);
        c.lineTo(b.x - 10, b.y + 55);
        c.closePath();
        c.fill();
      }
    for (const [i, s] of ordered(p).entries()) {
      c.fillStyle = '#fffefa';
      c.strokeStyle = s.id === p.startId ? accent : '#bacfc0';
      c.lineWidth = s.id === p.startId ? 3 : 1.5;
      rounded(c, s.x, s.y, 210, 100, s.type === 'document' ? 5 : 15);
      c.fill();
      c.stroke();
      c.fillStyle = accent;
      c.font = font(11, true);
      c.fillText(
        `${String(i + 1).padStart(2, '0')} / ${s.type.toUpperCase()}${s.id === p.startId ? ' / START' : ''}`,
        s.x + 13,
        s.y + 23
      );
      c.fillStyle = ink;
      c.font = font(15, true);
      const lines = wrap(c, s.title, 184);
      lines
        .slice(0, 3)
        .forEach((line, n) =>
          c.fillText(
            n === 2 && lines.length > 3 ? line.slice(0, -1) + '…' : line,
            s.x + 13,
            s.y + 47 + n * 18
          )
        );
    }
    c.restore();
    c.fillStyle = muted;
    c.font = font(16);
    c.fillText(
      'Defined process routes · Export the PDF for full step descriptions and reference details.',
      56,
      canvas.height - 25
    );
    return canvas;
  }
  async function pdf(p, options) {
    if (!pdfLibrary)
      pdfLibrary = import(new URL('vendor/pdf-lib/pdf-lib.esm.min.js', base).href).catch(() => {
        pdfLibrary = null;
        throw Error('The PDF exporter could not load. Refresh and try again.');
      });
    const { PDFDocument } = await pdfLibrary,
      doc = await PDFDocument.create();
    doc.setTitle(p.name);
    doc.setAuthor('Process Hub');
    let canvas,
      c,
      y,
      pageNumber = 0;
    const alive = options.alive || (() => true),
      check = () => {
        if (!alive()) throw Error('Export cancelled.');
      };
    async function finish() {
      if (!canvas) return;
      check();
      c.fillStyle = muted;
      c.font = font(17);
      c.fillText(
        `PROCESS HUB · ${options.scope === 'reference' ? 'Full reference' : 'User handout'} · Page ${pageNumber}`,
        64,
        1635
      );
      const blob = await toBlob(canvas, 'image/jpeg', 0.92),
        bytes = await blob.arrayBuffer();
      check();
      const picture = await doc.embedJpg(bytes),
        page = doc.addPage([595.28, 841.89]);
      page.drawImage(picture, { x: 0, y: 0, width: 595.28, height: 841.89 });
      canvas.width = 1;
      canvas.height = 1;
    }
    async function page() {
      await finish();
      check();
      if (++pageNumber > 240)
        throw Error(
          'This guide is very large. Choose User handout or shorten long reference notes before exporting.'
        );
      canvas = document.createElement('canvas');
      canvas.width = 1190;
      canvas.height = 1684;
      c = context(canvas);
      c.fillStyle = '#fffefa';
      c.fillRect(0, 0, 1190, 1684);
      c.fillStyle = accent;
      c.font = font(17, true);
      c.fillText(
        'PROCESS HUB / ' + (options.scope === 'reference' ? 'REFERENCE GUIDE' : 'USER HANDOUT'),
        64,
        55
      );
      c.strokeStyle = '#d4dfd2';
      c.beginPath();
      c.moveTo(64, 78);
      c.lineTo(1126, 78);
      c.stroke();
      y = 116;
    }
    async function paragraph(value, size = 22, bold = false, colour = ink) {
      if (!value) return;
      c.font = font(size, bold);
      const lines = wrap(c, value, 1062),
        lineHeight = size * 1.45;
      for (const line of lines) {
        if (y + lineHeight > 1580) await page();
        c.font = font(size, bold);
        c.fillStyle = colour;
        c.fillText(line, 64, y + size);
        y += lineHeight;
      }
      y += 14;
    }
    async function section(label, value) {
      if (!value) return;
      if (y + 100 > 1580) await page();
      await paragraph(label, 18, true, accent);
      await paragraph(value);
    }
    await page();
    await paragraph(p.name, 42, true);
    await paragraph(
      [
        p.processOwner && 'Owner: ' + p.processOwner,
        p.revision && 'Revision: ' + p.revision,
        p.steps.length + ' steps · ' + p.scenarios.length + ' scenarios',
      ]
        .filter(Boolean)
        .join(' · '),
      19,
      false,
      muted
    );
    const map = diagram(p),
      mapScale = Math.min(1062 / map.width, 780 / map.height),
      mapHeight = map.height * mapScale;
    if (y + mapHeight + 30 > 1580) await page();
    c.drawImage(map, 64, y, map.width * mapScale, mapHeight);
    y += mapHeight + 28;
    map.width = 1;
    map.height = 1;
    await section('Purpose / intended outcome', p.objective);
    await section('Description / context', p.notes);
    if (options.scope === 'reference') await section('Private presenter notes', p.presenterNotes);
    for (const [i, s] of ordered(p).entries()) {
      check();
      if (y + 230 > 1580) await page();
      await paragraph(`${String(i + 1).padStart(2, '0')} / ${s.title}`, 31, true);
      await paragraph(
        s.type.toUpperCase() + (s.id === p.startId ? ' · STARTING STEP' : ''),
        17,
        true,
        muted
      );
      for (const [label, value] of stepSections(p, s, options.scope, options.state))
        await section(label, value);
      if (s.image) {
        const image = await new Promise(resolve => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => resolve(null);
          i.src = s.image;
        });
        if (image) {
          const scale = Math.min(1062 / image.width, 640 / image.height, 1),
            height = image.height * scale;
          if (y + height + 40 > 1580) await page();
          c.drawImage(image, 64, y, image.width * scale, height);
          y += height + 30;
        } else await paragraph('Reference screenshot could not be decoded.', 18, false, muted);
      }
      y += 25;
    }
    if (options.scope === 'reference')
      for (const scenario of p.scenarios) {
        if (y + 200 > 1580) await page();
        await paragraph('Scenario / ' + scenario.name, 30, true);
        await section('Notes', scenario.notes);
        await section(
          'Initial sample values',
          Object.entries(scenario.initial)
            .map(([key, value]) => key + ' = ' + value)
            .join('\n')
        );
        await section(
          'Defined outcomes and routes',
          p.steps
            .map(
              s =>
                s.title +
                ': ' +
                (scenario.choices[s.id] === 'failure' ? 'Exception' : 'Success') +
                (scenario.routes?.[s.id]
                  ? ' → ' + p.steps.find(x => x.id === scenario.routes[s.id])?.title
                  : '')
            )
            .join('\n')
        );
      }
    await finish();
    check();
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }
  async function exportFile(process, options = {}) {
    const p = E.normalize(process);
    if (!p.steps.length) throw Error('Add at least one process step before exporting.');
    await document.fonts?.ready;
    if (options.alive && !options.alive()) throw Error('Export cancelled.');
    if (options.format === 'pdf' || options.format === 'pdf-zip') {
      const file = await pdf(p, {
        ...options,
        scope: options.scope === 'reference' ? 'reference' : 'audience',
      });
      if (options.format === 'pdf') return file;
      if (options.alive && !options.alive()) throw Error('Export cancelled.');
      if (!root.JSZip) throw Error('The ZIP exporter could not load. Refresh and try again.');
      const zip = new root.JSZip();
      zip.file('process-guide.pdf', await file.arrayBuffer());
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    }
    const canvas = diagram(p);
    try {
      return await toBlob(canvas);
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
  root.WorkHubProcessFiles = { export: exportFile, wrap, stepSections, diagram, ordered };
})(window);
