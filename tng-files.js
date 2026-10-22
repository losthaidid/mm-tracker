/**
 * Local PDF reading, positioned text and cropped evidence downloads.
 * PDF.js is loaded only when needed. Files remain in memory on the current device.
 */
(function (root) {
  'use strict';
  const E = () => root.WorkHubTngEngine;
  const base = new URL('./', document.currentScript?.src || document.baseURI);
  let library;
  async function pdfLibrary() {
    if (!library)
      library = import(new URL('vendor/pdfjs/pdf.min.mjs', base).href)
        .then(lib => {
          lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', base).href;
          return lib;
        })
        .catch(error => {
          library = null;
          throw Error('The PDF reader could not load. Refresh and try again. ' + error.message);
        });
    return library;
  }
  async function digest(bytes) {
    if (!root.crypto?.subtle)
      throw Error('PDF fingerprinting needs a secure browser connection (HTTPS).');
    const hash = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  }
  /** Safari streams support getReader(), but may not support PDF.js's for-await loop.
   * Read the chunks directly, and always release/cancel the reader on exit.
   * See mozilla/pdf.js#21557. Keep this workaround outside the supplied library.
   */
  async function readTextItems(page, alive = () => true, styles = {}) {
    const reader = page.streamTextContent().getReader(),
      items = [];
    let complete = false;
    try {
      for (;;) {
        if (!alive()) throw Error('Import cancelled.');
        const chunk = await reader.read();
        if (!alive()) throw Error('Import cancelled.');
        if (chunk.done) {
          complete = true;
          return items;
        }
        Object.assign(styles, chunk.value.styles || {});
        for (const item of chunk.value.items) items.push(item);
      }
    } finally {
      try {
        if (!complete) await reader.cancel();
      } catch {
        // Preserve the original read/cancellation error if an errored stream rejects cancel.
      } finally {
        reader.releaseLock();
      }
    }
  }
  /** Read actual horizontal table borders so tall, wrapped records never crop their neighbour. */
  function borders(ops, lib, viewport) {
    const combined = new Map();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== lib.OPS.constructPath) continue;
      const b = ops.argsArray[i]?.[2];
      if (!b || b.length !== 4 || Math.abs(b[3] - b[1]) > 0.3 || b[2] - b[0] < 15) continue;
      const a = viewport.convertToViewportPoint(b[0], b[1]),
        z = viewport.convertToViewportPoint(b[2], b[3]);
      const key = Math.round(a[1] * 10) / 10,
        prior = combined.get(key);
      if (prior) {
        prior.x1 = Math.min(prior.x1, a[0], z[0]);
        prior.x2 = Math.max(prior.x2, a[0], z[0]);
      } else combined.set(key, { y: key, x1: Math.min(a[0], z[0]), x2: Math.max(a[0], z[0]) });
    }
    return [...combined.values()];
  }
  async function read(file, { progress = () => {}, alive = () => true } = {}) {
    if (!file || !/\.pdf$/i.test(file.name) || file.size < 1 || file.size > 20 * 1024 * 1024)
      throw Error('Choose a PDF statement below 20 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!alive()) throw Error('Import cancelled.');
    const lib = await pdfLibrary(),
      fileHash = await digest(bytes);
    if (!alive()) throw Error('Import cancelled.');
    const task = lib.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      enableXfa: false,
      useWasm: false,
      useSystemFonts: true,
      isImageDecoderSupported: false,
      stopAtErrors: true,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > E().MAX_PAGES) throw Error('Use a statement with no more than 60 pages.');
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        if (!alive()) throw Error('Import cancelled.');
        progress(`Reading page ${n} of ${pdf.numPages}…`);
        const page = await pdf.getPage(n),
          v = page.getViewport({ scale: 1 });
        const styles = {},
          text = await readTextItems(page, alive, styles),
          ops = await page.getOperatorList();
        const items = text
          .filter(i => i.str)
          .map(i => {
            const point = v.convertToViewportPoint(i.transform[4], i.transform[5]);
            const style = styles[i.fontName],
              ascent = Number.isFinite(style?.ascent) ? Math.max(0, Math.min(2, style.ascent)) : 1,
              descent = Number.isFinite(style?.descent)
                ? Math.max(-1, Math.min(0, style.descent))
                : -0.2;
            return {
              str: i.str,
              x: point[0],
              y: point[1] - i.height,
              w: i.width,
              h: i.height,
              inkTop: point[1] - i.height * ascent,
              inkBottom: point[1] - i.height * descent,
            };
          });
        pages.push({ width: v.width, height: v.height, items, lines: borders(ops, lib, v) });
      }
      const result = E().parsePages(pages);
      const cardKey = await digest(new TextEncoder().encode(result.serial || fileHash));
      if (!alive()) throw Error('Import cancelled.');
      const source = {
        fileHash,
        cardKey,
        fileName: E().clean(file.name).slice(0, 200),
        pages: pdf.numPages,
      };
      let cache = null,
        closed = false;
      async function renderPage(n) {
        if (closed || !alive()) throw Error('Reattach the statement to view evidence.');
        if (cache?.page === n) return cache.canvas;
        const page = await pdf.getPage(n),
          v = page.getViewport({ scale: 2 });
        if (v.width * v.height > 12000000) throw Error('This page is too large to render safely.');
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(v.width);
        canvas.height = Math.ceil(v.height);
        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport: v,
          background: 'rgb(255,255,255)',
        }).promise;
        if (closed || !alive()) throw Error('Evidence rendering cancelled.');
        cache = { page: n, canvas };
        return canvas;
      }
      return {
        rows: result.rows,
        warnings: result.warnings,
        source,
        renderPage,
        close() {
          closed = true;
          cache = null;
          void task.destroy();
        },
      };
    } catch (error) {
      await task.destroy();
      if (error.name === 'PasswordException')
        throw Error(
          'This PDF is password protected. Use an unlocked statement export for this version.'
        );
      throw error;
    }
  }
  async function crop(session, row, includeHeader = true) {
    if (row.manual || !E().rectangle(row.rect, row.width, row.height))
      throw Error('Choose a PDF transaction with a valid crop.');
    const page = await session.renderPage(row.page),
      scale = page.width / row.width,
      r = row.rect,
      h = row.headerRect;
    const headerPage =
      includeHeader && row.headerPage && row.headerPage !== row.page
        ? await session.renderPage(row.headerPage)
        : page;
    const headerScale = headerPage.width / row.width;
    const out = document.createElement('canvas'),
      gap = includeHeader ? 10 : 0;
    const headerHeight = includeHeader ? Math.ceil(h.h * headerScale) : 0;
    out.width = Math.ceil(r.w * scale);
    out.height = Math.ceil(r.h * scale) + headerHeight + gap;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    if (includeHeader)
      ctx.drawImage(
        headerPage,
        h.x * headerScale,
        h.y * headerScale,
        h.w * headerScale,
        h.h * headerScale,
        0,
        0,
        out.width,
        headerHeight
      );
    ctx.drawImage(
      page,
      r.x * scale,
      r.y * scale,
      r.w * scale,
      r.h * scale,
      0,
      headerHeight + gap,
      out.width,
      Math.ceil(r.h * scale)
    );
    return out;
  }
  const png = canvas =>
    new Promise((resolve, reject) =>
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(Error('The image could not be created.'))),
        'image/png'
      )
    );
  const filename = row =>
    `tng-${row.date}-${['online', 'offline', 'ewallet'].includes(row.section) ? row.section : 'manual'}-${row.transactionNo.replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'manual'}.png`;
  /** Lay source crops edge-to-edge beneath one journey caption. No giant combined canvas:
   * each row is embedded individually so long journeys can paginate without exhausting memory.
   */
  async function groupedPdf(pdf, font, rgb, session, rows, includeHeader, alive, captions) {
    const groups = E().evidenceGroups(rows);
    if (groups.some(g => g.direction === 'review'))
      throw Error(
        'Review missing transaction times before exporting To / Return evidence. Use Edit beside the toll record.'
      );
    const safeText = value =>
      String(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7e]/g, '?');
    let page, y;
    function next(group, continued = false) {
      page = pdf.addPage([595.28, 841.89]);
      page.drawText('Client site claims', {
        x: 36,
        y: 794,
        size: 16,
        font,
        color: rgb(0.13, 0.25, 0.27),
      });
      y = 764;
      const caption = safeText((captions[group.key] || group.caption).trim().slice(0, 120));
      // Wrap long custom captions while keeping the source table at its full readable width.
      let line = '';
      for (const char of caption) {
        if (font.widthOfTextAtSize(line + char, 13) > 523) {
          page.drawText(line, { x: 36, y, size: 13, font });
          y -= 18;
          line = '';
        }
        line += char;
      }
      if (line) page.drawText(line, { x: 36, y, size: 13, font });
      y -= 21;
      page.drawText(
        `${group.rows.length} records | RM ${(group.rows.reduce((n, r) => n + r.amountCents, 0) / 100).toFixed(2)}${continued ? ' | continued' : ''}`,
        { x: 36, y, size: 9, font }
      );
      y -= 22;
    }
    for (const group of groups) {
      next(group);
      let priorHeader = '';
      for (const row of group.rows) {
        if (!alive()) throw Error('Export cancelled.');
        const headerKey = `${row.headerPage || row.page}|${row.section}|${JSON.stringify(row.headerRect)}`;
        let withHeader = includeHeader && headerKey !== priorHeader;
        let canvas = await crop(session, row, withHeader);
        let factor = Math.min(523 / canvas.width, 640 / canvas.height);
        if (y - canvas.height * factor < 45) {
          next(group, true);
          if (includeHeader && !withHeader) {
            withHeader = true;
            canvas = await crop(session, row, true);
            factor = Math.min(523 / canvas.width, 640 / canvas.height);
          }
        }
        const blob = await png(canvas);
        if (!alive()) throw Error('Export cancelled.');
        const image = await pdf.embedPng(await blob.arrayBuffer()),
          width = image.width * factor,
          height = image.height * factor;
        page.drawImage(image, { x: 36, y: y - height, width, height });
        y -= height;
        priorHeader = headerKey;
      }
    }
    const pages = pdf.getPages();
    pages.forEach((p, i) =>
      p.drawText(`TNG source evidence | ${i + 1} of ${pages.length}`, {
        x: 36,
        y: 23,
        size: 8,
        font,
      })
    );
  }
  async function pdfPack(session, rows, includeHeader, alive = () => true, options = {}) {
    const type = options.claimType || 'special';
    if (!['client-site', 'special'].includes(type)) throw Error('Choose a valid claim type.');
    const { PDFDocument, StandardFonts, rgb } = await import(
      new URL('vendor/pdf-lib/pdf-lib.esm.min.js', base).href
    );
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.setTitle('TNG selected expense evidence');
    pdf.setCreator('SAP MM WorkHub');
    if (!alive()) throw Error('Export cancelled.');
    if (type === 'client-site') {
      if (!rows.some(r => !r.manual)) throw Error('Select PDF transactions for evidence.');
      await groupedPdf(pdf, font, rgb, session, rows, includeHeader, alive, options.captions || {});
      const bytes = await pdf.save();
      if (!alive()) throw Error('Export cancelled.');
      return new Blob([bytes], { type: 'application/pdf' });
    }
    let page, y;
    const next = () => {
      page = pdf.addPage([595.28, 841.89]);
      y = 794;
      page.drawText('TNG expense evidence', {
        x: 36,
        y,
        size: 16,
        font,
        color: rgb(0.13, 0.25, 0.27),
      });
      y -= 22;
    };
    next();
    page.drawText(
      `${rows.length} selected records | RM ${(rows.reduce((n, r) => n + r.amountCents, 0) / 100).toFixed(2)}`,
      { x: 36, y, size: 10, font }
    );
    y -= 32;
    for (const row of rows) {
      if (!alive()) throw Error('Export cancelled.');
      if (row.manual) continue;
      const canvas = await crop(session, row, includeHeader),
        blob = await png(canvas),
        image = await pdf.embedPng(await blob.arrayBuffer());
      const factor = Math.min(523 / image.width, 640 / image.height),
        width = image.width * factor,
        height = image.height * factor;
      if (y - height - 36 < 40) next();
      page.drawText(
        `${row.date} | RM ${(row.amountCents / 100).toFixed(2)} | Source page ${row.page}`,
        { x: 36, y, size: 9, font }
      );
      y -= 12;
      page.drawImage(image, { x: 36, y: y - height, width, height });
      y -= height + 26;
    }
    if (!alive()) throw Error('Export cancelled.');
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  }
  async function zipPack(session, rows, includeHeader, alive = () => true) {
    const zip = new root.JSZip();
    for (const row of rows) {
      if (!alive()) throw Error('Export cancelled.');
      if (row.manual) continue;
      const blob = await png(await crop(session, row, includeHeader));
      zip.file(filename(row), await blob.arrayBuffer());
    }
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    if (!alive()) throw Error('Export cancelled.');
    return new Blob([bytes], { type: 'application/zip' });
  }
  root.WorkHubTngFiles = { read, crop, png, filename, pdfPack, zipPack, borders, readTextItems };
})(window);
