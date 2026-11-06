/** Local raster editing and paginated screenshot-guide exports. No file uploads or remote images. */
(function (root) {
  'use strict';
  const E = root.WorkHubBatchCEngine,
    base = document.baseURI;
  let pdfLibrary;
  function check(alive) {
    if (alive && !alive()) throw Error('The file operation was cancelled.');
  }
  function dimensions(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      ascii = (a, n) => String.fromCharCode(...bytes.slice(a, a + n));
    let w = 0,
      h = 0;
    if (
      bytes.length >= 24 &&
      ascii(1, 3) === 'PNG' &&
      bytes[0] === 137 &&
      ascii(12, 4) === 'IHDR'
    ) {
      w = v.getUint32(16);
      h = v.getUint32(20);
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      let i = 2;
      while (i + 8 < bytes.length) {
        if (bytes[i++] !== 255) break;
        while (bytes[i] === 255) i++;
        const marker = bytes[i++];
        if (marker === 217 || marker === 218) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        const length = v.getUint16(i);
        if (length < 2 || i + length > bytes.length) break;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
          h = v.getUint16(i + 3);
          w = v.getUint16(i + 5);
          break;
        }
        i += length;
      }
    } else if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
      const kind = ascii(12, 4);
      if (kind === 'VP8X') {
        w = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
        h = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      }
      if (kind === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
        w = v.getUint16(26, true) & 16383;
        h = v.getUint16(28, true) & 16383;
      }
      if (kind === 'VP8L' && bytes[20] === 47) {
        w = 1 + (v.getUint32(21, true) & 16383);
        h = 1 + ((v.getUint32(21, true) >>> 14) & 16383);
      }
    }
    if (!w || !h || w * h > 12000000)
      throw Error('Choose a PNG, JPEG or WebP image up to 12 megapixels.');
    return { width: w, height: h };
  }
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    if (!c.getContext('2d')) throw Error('This browser cannot open the image editor.');
    return c;
  }
  const release = c => {
    c.width = c.height = 1;
  };
  const blob = (c, type = 'image/png') =>
    new Promise((resolve, reject) =>
      c.toBlob(
        b => (b ? resolve(b) : reject(Error('The image could not be exported.'))),
        type,
        type === 'image/jpeg' ? 0.92 : undefined
      )
    );
  function read(file) {
    return new Promise((resolve, reject) => {
      const r = new root.FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(Error('The file could not be read.'));
      r.readAsDataURL(file);
    });
  }
  function decode(src) {
    return new Promise((resolve, reject) => {
      const image = new root.Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          Error('This screenshot could not be decoded. Choose another PNG, JPEG or WebP image.')
        );
      image.src = src;
    });
  }
  async function loadImage(image, alive, maxEdge = 2400, maxHeight = maxEdge) {
    check(alive);
    const comma = image.src.indexOf(','),
      raw = root.atob(image.src.slice(comma + 1)),
      bytes = Uint8Array.from(raw, c => c.charCodeAt(0)),
      size = dimensions(bytes);
    if (size.width > maxEdge || size.height > maxHeight || size.width * size.height > 12000000)
      throw Error(
        maxEdge < 2400
          ? 'This guide contains an oversized footer logo. Choose the logo again.'
          : 'This guide contains an oversized image. Open the original screenshot through Add screenshots first.'
      );
    const img = await decode(image.src);
    check(alive);
    if (img.naturalWidth !== image.width || img.naturalHeight !== image.height)
      throw Error('The guide image dimensions do not match its file.');
    return img;
  }
  async function imageFromFile(file, alive, maxEdge = 1800, maxHeight = maxEdge) {
    if (
      !file ||
      file.size > 8 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    )
      throw Error('Choose PNG, JPEG or WebP screenshots up to 8 MB each.');
    // Read dimensions before decoding to bound mobile image memory.
    const src = await read(file);
    check(alive);
    const raw = root.atob(src.slice(src.indexOf(',') + 1));
    dimensions(Uint8Array.from(raw, c => c.charCodeAt(0)));
    const img = await decode(src);
    check(alive);
    const scale = Math.min(1, maxEdge / img.naturalWidth, maxHeight / img.naturalHeight),
      c = canvas(
        Math.max(1, Math.round(img.naturalWidth * scale)),
        Math.max(1, Math.round(img.naturalHeight * scale))
      );
    try {
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return { src: c.toDataURL('image/png'), width: c.width, height: c.height };
    } finally {
      release(c);
    }
  }
  async function logoFromFile(file, alive) {
    if (!file || file.size > 2 * 1024 * 1024 || !['image/png', 'image/webp'].includes(file.type))
      throw Error('Choose a transparent PNG or WebP logo up to 2 MB.');
    return imageFromFile(file, alive, 1600, 600);
  }
  function draw(c, step, img, original = false) {
    c.width = step.image.width;
    c.height = step.image.height;
    const ctx = c.getContext('2d'),
      w = c.width,
      h = c.height;
    ctx.drawImage(img, 0, 0, w, h);
    if (original) return c;
    for (const mark of step.marks) {
      const points = mark.points.map(p => [p[0] * w, p[1] * h]),
        area = E.bounds(mark.points),
        [a, b] = [points[0], points.at(-1)];
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = mark.color;
      ctx.lineWidth = Math.max(2, mark.size * w);
      ctx.lineJoin = ctx.lineCap = 'round';
      if (mark.type === 'number') {
        const diameter = Math.min(Math.max(12, mark.size * w), w, h),
          radius = diameter / 2,
          x = Math.max(radius, Math.min(w - radius, a[0])),
          y = Math.max(radius, Math.min(h - radius, a[1])),
          ink = palette({ accent: mark.color, paper: mark.color }).ink;
        ctx.lineWidth = Math.min(3, diameter / 16);
        ctx.strokeStyle = ink;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.1, radius - ctx.lineWidth / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.font =
          '700 ' +
          diameter * (mark.number < 10 ? 0.57 : mark.number < 100 ? 0.48 : 0.38) +
          'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(mark.number), x, y);
      } else if (mark.type === 'rectangle') {
        ctx.lineWidth = Math.min(ctx.lineWidth, Math.max(1, Math.min(area.w * w, area.h * h) / 2));
        const inset = ctx.lineWidth / 2;
        ctx.strokeRect(
          area.x * w + inset,
          area.y * h + inset,
          Math.max(0, area.w * w - ctx.lineWidth),
          Math.max(0, area.h * h - ctx.lineWidth)
        );
      } else if (mark.type === 'cover')
        ctx.fillRect(area.x * w, area.y * h, area.w * w, area.h * h);
      else if (mark.type === 'blur') {
        // Downsample then smooth back into the selected area. Unlike canvas.filter,
        // this also works when iPhone browsers do not expose native canvas filters.
        const sw = Math.round(area.w * w),
          sh = Math.round(area.h * h),
          radius = Math.max(8, mark.size * w);
        if (sw && sh) {
          const small = canvas(
              Math.max(1, Math.ceil(sw / radius)),
              Math.max(1, Math.ceil(sh / radius))
            ),
            sample = small.getContext('2d');
          sample.imageSmoothingEnabled = ctx.imageSmoothingEnabled = true;
          sample.imageSmoothingQuality = ctx.imageSmoothingQuality = 'high';
          sample.drawImage(c, area.x * w, area.y * h, sw, sh, 0, 0, small.width, small.height);
          ctx.drawImage(small, 0, 0, small.width, small.height, area.x * w, area.y * h, sw, sh);
          release(small);
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(...a);
        for (const p of points.slice(1)) ctx.lineTo(...p);
        ctx.stroke();
        if (mark.type === 'arrow') {
          const angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
            length = Math.max(14, ctx.lineWidth * 3);
          ctx.beginPath();
          ctx.moveTo(...b);
          ctx.lineTo(b[0] - length * Math.cos(angle - 0.5), b[1] - length * Math.sin(angle - 0.5));
          ctx.moveTo(...b);
          ctx.lineTo(b[0] - length * Math.cos(angle + 0.5), b[1] - length * Math.sin(angle + 0.5));
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    return c;
  }
  function cropped(c, crop) {
    if (!crop) return c;
    const x = Math.floor(crop.x * c.width),
      y = Math.floor(crop.y * c.height),
      out = canvas(
        Math.max(1, Math.round(crop.w * c.width)),
        Math.max(1, Math.round(crop.h * c.height))
      );
    out.getContext('2d').drawImage(c, x, y, out.width, out.height, 0, 0, out.width, out.height);
    release(c);
    return out;
  }
  async function raster(step, alive) {
    const img = await loadImage(step.image, alive);
    return cropped(draw(canvas(1, 1), step, img), step.crop);
  }
  function wrap(ctx, text, width) {
    const out = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        if (!word) continue;
        if (line && ctx.measureText(line + ' ' + word).width > width) {
          out.push(line);
          line = '';
        }
        for (const letter of word) {
          if (line && ctx.measureText(line + letter).width > width) {
            out.push(line);
            line = '';
          }
          line += letter;
        }
        line += ' ';
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  function palette(value) {
    const { accent, paper } = E.colours(value);
    if (accent === '#285b4d' && paper === '#f8f7f1')
      return { accent, paper, ink: '#172f2c', body: '#354944', muted: '#657d73' };
    const luminance = hex => {
        const c = [1, 3, 5]
          .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      },
      contrast = hex => {
        const a = luminance(hex),
          b = luminance(paper);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      },
      ink = contrast('#17232d') > contrast('#fffdf7') ? '#17232d' : '#fffdf7';
    return { paper, accent: contrast(accent) >= 4.5 ? accent : ink, ink, body: ink, muted: ink };
  }
  function drawFooter(ctx, footer, logo, colour, layout, offset = 0) {
    if (!logo && !footer.text.trim()) return;
    const x = width =>
      footer.align === 'left' ? 70 : footer.align === 'right' ? 1170 - width : (1240 - width) / 2;
    ctx.save();
    ctx.globalAlpha = footer.opacity;
    if (logo) {
      ctx.drawImage(logo, layout.x, layout.y + offset, layout.width, layout.height);
    }
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = colour.accent;
    for (const [i, line] of wrap(ctx, footer.text.replace(/\s+/g, ' ').trim(), 1100).entries())
      ctx.fillText(line, x(ctx.measureText(line).width), 1650 + offset + i * 20);
    ctx.restore();
  }
  async function* classicPages(guide, alive) {
    const footer = E.footer(guide.footer),
      colour = palette(guide.colours),
      logo = footer.logo ? await loadImage(footer.logo, alive, 1600, 600) : null,
      layout = E.logoLayout(footer),
      contentBottom = logo ? Math.min(1510, layout.y - 40) : footer.text.trim() ? 1510 : 1620;
    let pageNo = 0;
    for (let i = 0; i < guide.steps.length; i++) {
      check(alive);
      const step = guide.steps[i],
        screenshot = await raster(step, alive);
      try {
        let lines,
          titleLines,
          first = true;
        do {
          if (++pageNo > 120)
            throw Error(
              'This guide exceeds 120 pages. Shorten captions or split it into smaller guides.'
            );
          const c = canvas(1240, 1754),
            ctx = c.getContext('2d');
          ctx.fillStyle = colour.paper;
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.fillStyle = colour.accent;
          ctx.font = '600 19px system-ui, sans-serif';
          const heading = (guide.exportHeading ?? E.DEFAULT_GUIDE_HEADING)
            .replace(/\s+/g, ' ')
            .trim();
          let y = 68;
          if (heading)
            for (const line of wrap(ctx, heading, 1100)) {
              ctx.fillText(line, 70, y);
              y += 25;
            }
          y = heading ? Math.max(120, y + 25) : 84;
          ctx.fillStyle = colour.ink;
          ctx.font = '600 27px system-ui, sans-serif';
          for (const line of wrap(ctx, guide.title || 'Screenshot guide', 1100)) {
            ctx.fillText(line, 70, y);
            y += 35;
          }
          ctx.font = '600 30px system-ui, sans-serif';
          titleLines = wrap(
            ctx,
            String(i + 1).padStart(2, '0') +
              '  ' +
              (step.title || 'Step ' + (i + 1)) +
              (first ? '' : ' · continued'),
            1100
          );
          y += 22;
          for (const line of titleLines) {
            ctx.fillText(line, 70, y);
            y += 39;
          }
          if (first) {
            const scale = Math.min(
              1100 / screenshot.width,
              880 / screenshot.height,
              (contentBottom - 70 - y) / screenshot.height
            );
            y += 20;
            ctx.drawImage(screenshot, 70, y, screenshot.width * scale, screenshot.height * scale);
            y += screenshot.height * scale + 35;
          }
          ctx.font = '24px system-ui, sans-serif';
          ctx.fillStyle = colour.body;
          if (!lines) lines = wrap(ctx, step.caption, 1100);
          const capacity = Math.max(1, Math.floor((contentBottom - y) / 35)),
            showing = lines.splice(0, capacity);
          for (const line of showing) {
            ctx.fillText(line, 70, y);
            y += 35;
          }
          drawFooter(ctx, footer, logo, colour, layout);
          ctx.fillStyle = colour.muted;
          ctx.font = '19px system-ui, sans-serif';
          ctx.fillText('Step ' + (i + 1) + ' of ' + guide.steps.length, 70, 1695);
          ctx.fillText('Page ' + pageNo, 1070, 1695);
          check(alive);
          yield c;
          first = false;
        } while (lines.length);
      } finally {
        release(screenshot);
      }
    }
  }
  // The same page iterator drives previews and every finished file format.
  async function* designedPages(guide, alive) {
    const compact = guide.layout === 'compact',
      split = guide.layout === 'split',
      footer = E.footer(guide.footer),
      colour = palette(guide.colours),
      logo = footer.logo ? await loadImage(footer.logo, alive, 1600, 600) : null,
      logoBox = E.logoLayout(footer),
      bottom = logo ? Math.min(1510, logoBox.y - 40) : footer.text.trim() ? 1510 : 1620,
      cardWidth = compact ? 534 : 1100,
      lineHeight = compact ? 32 : 35;
    let c = null,
      ctx,
      y = 0,
      bodyTop = 0,
      usedBottom = 0,
      column = 0,
      rowBottom = 0,
      pageNo = 0,
      firstStep = 0,
      lastStep = 0;
    const font = (size, bold = false) => {
      ctx.font = (bold ? '600 ' : '') + size + 'px system-ui, sans-serif';
    };
    const newPage = () => {
      if (++pageNo > 120)
        throw Error(
          'This guide exceeds 120 pages. Shorten captions or split it into smaller guides.'
        );
      c = canvas(1240, 1754);
      ctx = c.getContext('2d');
      ctx.fillStyle = colour.paper;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = colour.accent;
      font(19, true);
      let top = 68;
      const heading = (guide.exportHeading ?? E.DEFAULT_GUIDE_HEADING).replace(/\s+/g, ' ').trim();
      if (heading)
        for (const line of wrap(ctx, heading, 1100)) {
          ctx.fillText(line, 70, top);
          top += 25;
        }
      top = heading ? Math.max(120, top + 20) : 84;
      ctx.fillStyle = colour.ink;
      font(34, true);
      for (const line of wrap(ctx, guide.title || 'Screenshot guide', 1100)) {
        ctx.fillText(line, 70, top);
        top += 43;
      }
      font(18);
      ctx.fillStyle = colour.muted;
      ctx.fillText(
        E.GUIDE_LAYOUTS[guide.layout].label + ' · ' + guide.steps.length + ' steps',
        70,
        top + 5
      );
      ctx.fillStyle = colour.accent;
      ctx.fillRect(70, top + 24, 1100, 3);
      bodyTop = y = top + 52;
      usedBottom = y;
      column = 0;
      rowBottom = y;
      firstStep = lastStep = 0;
    };
    const finishPage = () => {
      // Compact cards trim the unused body, retaining the entire footer region.
      const height = compact
        ? Math.min(1754, Math.max(550, Math.ceil(usedBottom + 30 + 1754 - bottom)))
        : 1754;
      let out = c;
      if (height !== 1754) {
        out = canvas(1240, height);
        out.getContext('2d').drawImage(c, 0, 0, 1240, height, 0, 0, 1240, height);
        release(c);
      }
      const context = out.getContext('2d'),
        offset = height - 1754;
      drawFooter(context, footer, logo, colour, logoBox, offset);
      context.fillStyle = colour.muted;
      context.font = '19px system-ui, sans-serif';
      context.fillText(
        'Steps ' +
          firstStep +
          (lastStep === firstStep ? '' : '–' + lastStep) +
          ' of ' +
          guide.steps.length,
        70,
        1695 + offset
      );
      const label = 'Page ' + pageNo;
      context.fillText(label, 1170 - context.measureText(label).width, 1695 + offset);
      c = null;
      return out;
    };
    try {
      for (let i = 0; i < guide.steps.length; i++) {
        check(alive);
        const step = guide.steps[i],
          screenshot = await raster(step, alive);
        try {
          if (!c) newPage();
          const captionWidth = split ? 438 : cardWidth - 40;
          font(compact ? 22 : 24);
          const lines = step.caption.trim() ? wrap(ctx, step.caption, captionWidth) : [];
          let first = true;
          do {
            check(alive);
            font(compact ? 25 : 28, true);
            const titles = wrap(
                ctx,
                String(i + 1).padStart(2, '0') +
                  '  ' +
                  (step.title || 'Step ' + (i + 1)) +
                  (first ? '' : ' · continued'),
                cardWidth - 40
              ),
              scale = Math.min(
                (split ? 590 : cardWidth - 40) / screenshot.width,
                (compact ? 270 : split ? 560 : 440) / screenshot.height
              ),
              imageHeight = first ? screenshot.height * scale : 0,
              minimum =
                titles.length * 36 +
                40 +
                (split
                  ? Math.max(imageHeight, lines.length ? lineHeight + 46 : 0)
                  : imageHeight + (imageHeight ? 24 : 0) + (lines.length ? lineHeight + 46 : 0)) +
                24;
            if (y + minimum > bottom && usedBottom > bodyTop) {
              if (compact && column === 0) column = 1;
              else {
                const page = finishPage();
                check(alive);
                yield page;
                newPage();
              }
              continue;
            }
            const x = 70 + (compact ? column * 566 : 0),
              textX = split ? x + 642 : x + 20;
            let top = y + 30;
            ctx.fillStyle = colour.accent;
            ctx.fillRect(x, y, compact ? 50 : 64, 4);
            ctx.fillStyle = colour.ink;
            font(compact ? 25 : 28, true);
            for (const title of titles) {
              ctx.fillText(title, x + 20, top);
              top += 36;
            }
            top += 10;
            if (first)
              ctx.drawImage(screenshot, x + 20, top, screenshot.width * scale, imageHeight);
            let captionY = split ? top : top + imageHeight + (imageHeight ? 24 : 0);
            if (lines.length) {
              font(16, true);
              ctx.fillStyle = colour.accent;
              ctx.fillText('INSTRUCTIONS' + (first ? '' : ' · CONTINUED'), textX, captionY + 16);
              captionY += 46;
              font(compact ? 22 : 24);
              ctx.fillStyle = colour.body;
              const capacity = Math.max(1, Math.floor((bottom - 24 - captionY) / lineHeight));
              for (const line of lines.splice(0, capacity)) {
                ctx.fillText(line, textX, captionY);
                captionY += lineHeight;
              }
            }
            const end = Math.max(top + imageHeight, captionY) + 24;
            usedBottom = Math.max(usedBottom, end);
            if (!firstStep) firstStep = i + 1;
            lastStep = i + 1;
            if (compact && column === 0) {
              rowBottom = end;
              column = 1;
            } else {
              y = Math.max(end, compact ? rowBottom : 0) + 28;
              rowBottom = y;
              column = 0;
            }
            first = false;
          } while (lines.length || first);
        } finally {
          release(screenshot);
        }
      }
      if (c) {
        const page = finishPage();
        check(alive);
        yield page;
      }
    } finally {
      if (c) release(c);
    }
  }
  async function* pages(value, alive) {
    const guide = E.guide(value);
    yield* guide.layout === 'classic' ? classicPages(guide, alive) : designedPages(guide, alive);
  }
  async function preview(value, alive) {
    const guide = E.guide(value);
    if (!guide.steps.length) throw Error('Add a screenshot to preview your guide.');
    await document.fonts?.ready;
    check(alive);
    const iterator = pages(guide, alive);
    let page;
    try {
      const result = await iterator.next();
      page = result.value;
      check(alive);
      return page;
    } catch (err) {
      if (page) release(page);
      throw err;
    } finally {
      await iterator.return();
    }
  }
  async function exportFile(value, format, alive) {
    const guide = E.guide(value);
    if (!guide.steps.length) throw Error('Add at least one screenshot first.');
    await document.fonts?.ready;
    check(alive);
    if (format === 'png') {
      const c = await raster(guide.steps[0], alive);
      try {
        const result = await blob(c);
        check(alive);
        return result;
      } finally {
        release(c);
      }
    }
    let pdf = null,
      zip = null;
    const jpeg = format === 'jpg-images';
    if (format === 'images' || jpeg) {
      if (!root.JSZip) throw Error('The ZIP library is unavailable. Refresh and try again.');
      zip = new root.JSZip();
    } else {
      if (!pdfLibrary)
        pdfLibrary = import(new URL('vendor/pdf-lib/pdf-lib.esm.min.js', base).href).catch(err => {
          pdfLibrary = null;
          throw err;
        });
      const { PDFDocument } = await pdfLibrary;
      check(alive);
      pdf = await PDFDocument.create();
    }
    let n = 0;
    for await (const page of pages(guide, alive)) {
      try {
        const rendered = await blob(page, jpeg ? 'image/jpeg' : 'image/png');
        check(alive);
        const bytes = await rendered.arrayBuffer();
        check(alive);
        if (zip)
          zip.file(String(++n).padStart(3, '0') + '-guide-page.' + (jpeg ? 'jpg' : 'png'), bytes);
        else {
          const image = await pdf.embedPng(bytes),
            p = pdf.addPage([
              595.28,
              page.height === 1754 ? 841.89 : (595.28 * page.height) / page.width,
            ]);
          p.drawImage(image, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
        }
      } finally {
        release(page);
      }
    }
    check(alive);
    if (zip) {
      const result = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      check(alive);
      return result;
    }
    const result = new Blob([await pdf.save()], { type: 'application/pdf' });
    check(alive);
    if (format === 'pdf-zip') {
      if (!root.JSZip) throw Error('The ZIP library is unavailable. Refresh and try again.');
      const wrapped = new root.JSZip();
      wrapped.file('screenshot-guide.pdf', await result.arrayBuffer());
      const zipped = await wrapped.generateAsync({ type: 'blob', compression: 'STORE' });
      check(alive);
      return zipped;
    }
    return result;
  }
  root.WorkHubBatchCFiles = {
    dimensions,
    canvas,
    release,
    blob,
    read,
    decode,
    loadImage,
    imageFromFile,
    logoFromFile,
    palette,
    draw,
    cropped,
    raster,
    wrap,
    pages,
    preview,
    export: exportFile,
  };
})(window);
