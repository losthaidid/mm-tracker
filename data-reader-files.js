/** Report exports use the reader's exact string values. PDF pages are drawn locally, preserving Unicode. */
(function (root) {
  'use strict';
  const base = document.currentScript?.src || root.location.href;
  let library;
  function worksheets(sections) {
    return sections.map((s, i) => ({
      name: i + 1 + ' ' + s.title,
      rows: [s.columns, ...s.rows].map(row =>
        row.map(v => {
          const value = String(v ?? '');
          if (value.length > 32767 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
            throw Error(
              'A value cannot be represented safely in Excel. Download the original source or narrow the report.'
            );
          return value.replace(/_x[0-9a-f]{4}_/gi, part => '_x005F_' + part.slice(1));
        })
      ),
    }));
  }
  async function pdf(report, alive = () => true) {
    const check = () => {
      if (!alive()) throw Error('Export cancelled.');
    };
    check();
    if (
      report.sections.some(
        s => s.title.length > 200 || s.source.length > 1200 || s.columns.some(c => c.length > 200)
      )
    )
      throw Error(
        'A heading or source path is too long for this PDF layout. Shorten display labels or use Excel / Original export.'
      );
    library ||= import(new URL('vendor/pdf-lib/pdf-lib.esm.min.js', base).href).catch(() => {
      library = null;
      throw Error('The PDF exporter could not load. Please try again.');
    });
    const { PDFDocument } = await library,
      doc = await PDFDocument.create();
    check();
    doc.setTitle(report.title);
    doc.setCreator('My WorkHub · Data Reader');
    const W = 1240,
      H = 1754,
      M = 78,
      B = 1600,
      ink = '#243c43',
      muted = '#587079',
      accent = '#087f8c',
      soft = '#edf5f4';
    let canvas,
      ctx,
      y,
      pageCount = 0;
    const font = (size = 20, bold = false) =>
      `${bold ? '600' : '400'} ${size}px system-ui, sans-serif`;
    const wrap = (text, width, size = 19, bold = false) => {
      ctx.font = font(size, bold);
      const lines = [];
      for (const paragraph of String(text ?? '')
        .replace(/\t/g, '    ')
        .split(/\r\n|\n|\r/)) {
        if (!paragraph) {
          lines.push('');
          continue;
        }
        let line = '';
        for (const character of paragraph) {
          if (line && ctx.measureText(line + character).width > width) {
            const split = line.lastIndexOf(' ');
            if (split > 0) {
              lines.push(line.slice(0, split));
              line = line.slice(split + 1);
            } else {
              lines.push(line);
              line = '';
            }
          }
          line += character;
        }
        lines.push(line);
      }
      return lines;
    };
    async function finish() {
      if (!canvas) return;
      check();
      ctx.fillStyle = muted;
      ctx.font = font(17);
      ctx.fillText('MY WORKHUB · ' + report.kind.toUpperCase() + ' REPORT', M, H - 60);
      ctx.fillText('Page ' + pageCount, W - M - 120, H - 60);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          value => (value ? resolve(value) : reject(Error('PDF page could not be drawn.'))),
          'image/jpeg',
          0.94
        )
      );
      check();
      const image = await doc.embedJpg(await blob.arrayBuffer());
      check();
      const page = doc.addPage([595.28, 841.89]);
      page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
      canvas.width = canvas.height = 1;
    }
    async function page() {
      await finish();
      check();
      if (++pageCount > 100)
        throw Error('The PDF exceeds 100 pages. Select fewer report sections.');
      canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Canvas is unavailable for PDF export.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = accent;
      ctx.fillRect(M, 58, 56, 5);
      ctx.fillStyle = ink;
      const title = wrap(report.title, W - 2 * M, 28, true);
      y = 107;
      for (const line of title) {
        ctx.fillText(line, M, y);
        y += 35;
      }
      ctx.fillStyle = muted;
      for (const line of wrap(report.subtitle, W - 2 * M, 17)) {
        ctx.fillText(line, M, y);
        y += 23;
      }
      y += 26;
    }
    async function heading(title, source) {
      const titleLines = wrap(title, W - 2 * M, 23, true),
        sourceLines = wrap(source, W - 2 * M, 15);
      if (y + titleLines.length * 30 + sourceLines.length * 21 + 100 > B) await page();
      ctx.fillStyle = ink;
      ctx.font = font(23, true);
      for (const line of titleLines) {
        ctx.fillText(line, M, y);
        y += 30;
      }
      ctx.fillStyle = muted;
      ctx.font = font(15);
      for (const line of sourceLines) {
        ctx.fillText(line, M, y);
        y += 21;
      }
      y += 12;
    }
    await page();
    for (const section of report.sections) {
      check();
      const wide = section.columns.length > 5,
        groups = [];
      if (wide) {
        for (let at = 1; at < section.columns.length; at += 4)
          groups.push([
            0,
            ...Array.from({ length: Math.min(4, section.columns.length - at) }, (_, i) => at + i),
          ]);
      } else groups.push(section.columns.map((_, i) => i));
      for (const [part, indices] of groups.entries()) {
        const title =
          section.title +
          (groups.length > 1 ? ' · columns ' + (part + 1) + '/' + groups.length : '');
        await heading(title, section.source);
        const widths = indices.map(() => (W - 2 * M) / indices.length),
          lineH = 25;
        async function header() {
          const lines = indices.map((i, j) => wrap(section.columns[i], widths[j] - 20, 18, true)),
            height = Math.max(...lines.map(x => x.length)) * 24 + 20;
          if (y + height + 50 > B) {
            await page();
            await heading(title + ' · continued', section.source);
          }
          ctx.fillStyle = accent;
          ctx.fillRect(M, y - 17, W - 2 * M, height);
          let x = M;
          for (let j = 0; j < lines.length; j++) {
            ctx.fillStyle = '#fff';
            ctx.font = font(18, true);
            for (const [k, line] of lines[j].entries()) ctx.fillText(line, x + 10, y + 5 + k * 24);
            x += widths[j];
          }
          y += height + 5;
        }
        await header();
        for (const [rowIndex, row] of section.rows.entries()) {
          const lines = indices.map((i, j) => wrap(row[i], widths[j] - 20));
          let at = 0,
            max = Math.max(1, ...lines.map(x => x.length));
          while (at < max) {
            if (y + lineH + 22 > B) {
              await page();
              await heading(title + ' · continued', section.source);
              await header();
            }
            const count = Math.max(1, Math.min(max - at, Math.floor((B - y - 20) / lineH))),
              height = count * lineH + 18;
            let x = M;
            ctx.fillStyle = rowIndex % 2 === 0 ? soft : '#fff';
            ctx.fillRect(M, y - 14, W - 2 * M, height);
            for (let j = 0; j < lines.length; j++) {
              ctx.fillStyle = ink;
              ctx.font = font(19);
              for (let k = 0; k < count; k++)
                if (lines[j][at + k] !== undefined)
                  ctx.fillText(lines[j][at + k], x + 10, y + 5 + k * lineH);
              x += widths[j];
            }
            y += height;
            at += count;
          }
        }
        y += 38;
      }
    }
    await finish();
    check();
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }
  root.WorkHubDataReaderFiles = { worksheets, pdf };
})(window);
