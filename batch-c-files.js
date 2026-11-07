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
  async function loadLayers(step, alive) {
    const layers = new Map();
    for (const mark of step.marks) {
      if (mark.type === 'image' && !layers.has(mark.image.src))
        layers.set(mark.image.src, await loadImage(mark.image, alive));
    }
    check(alive);
    return layers;
  }
  function contain(image, box) {
    const ratio = Math.min(box.w / image.width, box.h / image.height),
      w = image.width * ratio,
      h = image.height * ratio;
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
  }
  function draw(c, step, img, original = false, layers = new Map()) {
    c.width = step.image.width;
    c.height = step.image.height;
    const ctx = c.getContext('2d'),
      w = c.width,
      h = c.height;
    ctx.drawImage(img, 0, 0, w, h);
    if (original) return c;
    // Zooms always sample a source with every privacy edit applied, irrespective of layer order.
    const protectedSource = step.marks.some(m => m.type === 'inset')
      ? draw(
          canvas(1, 1),
          { ...step, marks: step.marks.filter(m => ['cover', 'brush', 'blur'].includes(m.type)) },
          img
        )
      : null;
    try {
      for (const mark of step.marks) {
        const points = mark.points.map(p => [p[0] * w, p[1] * h]),
          area = E.bounds(mark.points),
          [a, b] = [points[0], points.at(-1)];
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle = mark.color;
        ctx.lineWidth = Math.max(2, mark.size * w);
        ctx.lineJoin = ctx.lineCap = 'round';
        if (mark.type === 'image') {
          const layer = layers.get(mark.image.src);
          if (!layer)
            throw Error('An image layer is not ready. Reopen the screenshot and try again.');
          const box = contain(mark.image, {
            x: area.x * w,
            y: area.y * h,
            w: area.w * w,
            h: area.h * h,
          });
          ctx.globalAlpha = mark.opacity ?? 1;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(layer, box.x, box.y, box.w, box.h);
        } else if (mark.type === 'number') {
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
        } else if (mark.type === 'ellipse') {
          const thickness = Math.min(ctx.lineWidth, Math.min(area.w * w, area.h * h) / 2);
          ctx.lineWidth = thickness;
          ctx.beginPath();
          ctx.ellipse(
            (area.x + area.w / 2) * w,
            (area.y + area.h / 2) * h,
            Math.max(0.1, (area.w * w - thickness) / 2),
            Math.max(0.1, (area.h * h - thickness) / 2),
            0,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        } else if (mark.type === 'spotlight') {
          ctx.globalAlpha = mark.opacity;
          ctx.fillRect(0, 0, w, area.y * h);
          ctx.fillRect(0, (area.y + area.h) * h, w, (1 - area.y - area.h) * h);
          ctx.fillRect(0, area.y * h, area.x * w, area.h * h);
          ctx.fillRect((area.x + area.w) * w, area.y * h, (1 - area.x - area.w) * w, area.h * h);
        } else if (mark.type === 'inset') {
          const s = mark.source,
            dx = area.x * w,
            dy = area.y * h,
            dw = area.w * w,
            dh = area.h * h;
          ctx.lineWidth = Math.max(2, mark.size * w);
          ctx.beginPath();
          const right = dx > (s.x + s.w / 2) * w;
          ctx.moveTo((right ? s.x + s.w : s.x) * w, (s.y + s.h / 2) * h);
          ctx.lineTo(right ? dx : dx + dw, dy + dh / 2);
          ctx.stroke();
          ctx.drawImage(protectedSource, s.x * w, s.y * h, s.w * w, s.h * h, dx, dy, dw, dh);
          ctx.strokeRect(dx, dy, dw, dh);
          ctx.strokeRect(s.x * w, s.y * h, s.w * w, s.h * h);
        } else if (['text', 'callout'].includes(mark.type)) {
          const x = area.x * w,
            y = area.y * h,
            width = area.w * w,
            height = area.h * h,
            callout = mark.type === 'callout',
            fontSize = Math.max(10, mark.size * w),
            padding = callout ? Math.min(12, width / 10) : 0,
            bodyHeight = height * (callout ? 0.8 : 1);
          if (callout) {
            ctx.fillRect(x, y, width, bodyHeight);
            ctx.beginPath();
            ctx.moveTo(x + width * 0.18, y + bodyHeight);
            ctx.lineTo(x + width * 0.18, y + height);
            ctx.lineTo(x + width * 0.36, y + bodyHeight);
            ctx.fill();
            ctx.fillStyle = palette({ accent: mark.color, paper: mark.color }).ink;
          }
          ctx.beginPath();
          ctx.rect(x, y, width, bodyHeight);
          ctx.clip();
          ctx.font = '500 ' + fontSize + 'px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const lines = wrap(ctx, mark.text, Math.max(1, width - 2 * padding)),
            lineHeight = fontSize * 1.25;
          for (let i = 0; i < lines.length && padding + (i + 1) * lineHeight <= bodyHeight; i++)
            ctx.fillText(lines[i], x + padding, y + padding + i * lineHeight);
        } else if (mark.type === 'rectangle') {
          ctx.lineWidth = Math.min(
            ctx.lineWidth,
            Math.max(1, Math.min(area.w * w, area.h * h) / 2)
          );
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
            ctx.lineTo(
              b[0] - length * Math.cos(angle - 0.5),
              b[1] - length * Math.sin(angle - 0.5)
            );
            ctx.moveTo(...b);
            ctx.lineTo(
              b[0] - length * Math.cos(angle + 0.5),
              b[1] - length * Math.sin(angle + 0.5)
            );
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    } finally {
      if (protectedSource) release(protectedSource);
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
    const img = await loadImage(step.image, alive),
      layers = await loadLayers(step, alive),
      c = canvas(1, 1);
    try {
      return cropped(draw(c, step, img, false, layers), step.crop);
    } catch (err) {
      release(c);
      throw err;
    }
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
      preferred = contrast('#17232d') > contrast('#fffdf7') ? '#17232d' : '#fffdf7',
      ink =
        contrast(preferred) >= 4.5
          ? preferred
          : contrast('#000000') > contrast('#ffffff')
            ? '#000000'
            : '#ffffff';
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
          if (!lines) lines = wrap(ctx, E.caption(step, guide.linkedInstructions), 1100);
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
      gap = 20,
      textSize = compact ? 22 : 23,
      lineHeight = compact ? 30 : 32,
      planned = new Map();
    const blend = (base, ink, amount) =>
      '#' +
      [1, 3, 5]
        .map(i =>
          Math.round(
            parseInt(base.slice(i, i + 2), 16) * (1 - amount) +
              parseInt(ink.slice(i, i + 2), 16) * amount
          )
            .toString(16)
            .padStart(2, '0')
        )
        .join('');
    const cardFill = blend(colour.paper, colour.ink, 0.025),
      line = blend(colour.paper, colour.ink, 0.15),
      soft = blend(colour.paper, colour.accent, 0.065),
      cardInk = palette({ paper: cardFill, accent: colour.accent }).ink,
      cardAccent = palette({ paper: cardFill, accent: colour.accent }).accent,
      linkedInk = palette({ paper: soft, accent: colour.accent }).ink,
      softAccent = palette({ paper: soft, accent: colour.accent }).accent,
      onAccent = palette({ paper: colour.accent, accent: colour.paper }).ink;
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
      ctx.font = (bold ? '600 ' : '') + size + 'px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };
    const box = (context, x, top, w, h, fill, stroke = null, radius = 8) => {
      context.beginPath();
      if (context.roundRect) context.roundRect(x, top, w, h, radius);
      else context.rect(x, top, w, h);
      if (fill) {
        context.fillStyle = fill;
        context.fill();
      }
      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 1.5;
        context.stroke();
      }
    };
    function newPage() {
      if (++pageNo > 120)
        throw Error(
          'This guide exceeds 120 pages. Shorten captions or split it into smaller guides.'
        );
      c = canvas(1240, 1754);
      ctx = c.getContext('2d');
      ctx.fillStyle = colour.paper;
      ctx.fillRect(0, 0, 1240, 1754);
      const heading = (guide.exportHeading ?? E.DEFAULT_GUIDE_HEADING).replace(/\s+/g, ' ').trim();
      font(17, true);
      const headings = heading ? wrap(ctx, heading, 970) : [],
        band = headings.length ? Math.max(86, 30 + headings.length * 23) : 12;
      ctx.fillStyle = colour.accent;
      ctx.fillRect(0, 0, 1240, band);
      if (headings.length) {
        ctx.fillStyle = onAccent;
        headings.forEach((s, i) => ctx.fillText(s, 70, 34 + i * 23));
        box(ctx, 1072, 24, 100, 36, blend(colour.accent, onAccent, 0.12), null, 5);
        font(14, true);
        ctx.fillStyle = onAccent;
        ctx.fillText('PAGE ' + String(pageNo).padStart(2, '0'), 1084, 47);
      }
      let top = band + 48;
      font(compact ? 35 : 38, true);
      ctx.fillStyle = colour.ink;
      for (const title of wrap(ctx, guide.title || 'Screenshot guide', 1100)) {
        ctx.fillText(title, 70, top);
        top += 45;
      }
      font(17);
      ctx.fillStyle = colour.body;
      ctx.fillText(
        guide.steps.length + ' illustrated ' + (guide.steps.length === 1 ? 'step' : 'steps'),
        70,
        top + 5
      );
      ctx.fillStyle = line;
      ctx.fillRect(70, top + 25, 1100, 1);
      bodyTop = y = top + 46;
      usedBottom = y;
      column = 0;
      rowBottom = y;
      firstStep = lastStep = 0;
    }
    function finishPage() {
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
      context.fillStyle = line;
      context.fillRect(70, 1686 + offset, 1100, 1);
      context.font = '16px Arial, sans-serif';
      context.fillStyle = colour.body;
      context.fillText(
        'Steps ' +
          firstStep +
          (lastStep === firstStep ? '' : '–' + lastStep) +
          ' of ' +
          guide.steps.length,
        70,
        1716 + offset
      );
      box(context, 1086, 1698 + offset, 84, 29, soft, null, 5);
      context.font = '600 15px Arial, sans-serif';
      context.fillStyle = softAccent;
      context.fillText('Page ' + pageNo, 1096, 1718 + offset);
      c = null;
      return out;
    }
    function advance() {
      if (compact && column === 0) {
        column = 1;
        return null;
      }
      if (pageNo >= 120)
        throw Error(
          'This guide exceeds 120 pages. Shorten captions or split it into smaller guides.'
        );
      const page = finishPage();
      newPage();
      return page;
    }
    function rowsFor(step, width) {
      const rows = [];
      font(textSize);
      if (step.caption.trim()) {
        rows.push({ kind: 'label', text: 'WHAT TO DO', h: 24 });
        for (const text of wrap(ctx, step.caption.trimEnd(), width))
          rows.push({ kind: text ? 'body' : 'space', text, h: text ? lineHeight : 10 });
      }
      const links = guide.linkedInstructions
        ? step.marks
            .filter(m => m.type === 'number' && m.instruction?.trim())
            .sort((a, b) => a.number - b.number)
        : [];
      if (links.length) {
        if (rows.length) rows.push({ kind: 'space', h: 12 });
        rows.push({ kind: 'label', text: 'FOLLOW THE NUMBERED MARKERS', h: 24 });
        for (const mark of links) {
          const lines = wrap(ctx, mark.instruction.trim(), width - 42);
          lines.forEach((text, i) =>
            rows.push({ kind: 'linked', text, number: i === 0 ? mark.number : null, h: lineHeight })
          );
        }
      }
      return rows;
    }
    function plan(step, dims, first = true) {
      font(compact ? 24 : 28, true);
      const titles = wrap(
          ctx,
          (step.title || 'Step') + (first ? '' : ' · continued'),
          cardWidth - 122
        ),
        header = Math.max(56, titles.length * (compact ? 31 : 34) + 16),
        textWidth = split ? 420 : cardWidth - 48,
        rows = rowsFor(step, textWidth),
        imageWidth = split ? 580 : cardWidth - 72,
        cap = compact ? 260 : split ? 570 : dims.width / dims.height < 0.9 ? 820 : 580,
        scale = Math.min(imageWidth / dims.width, cap / dims.height);
      return {
        titles,
        header,
        textWidth,
        rows,
        scale,
        imageH: first ? dims.height * scale : 0,
        imageW: first ? dims.width * scale : 0,
      };
    }
    const rowTotal = rows => rows.reduce((n, r) => n + r.h, 0);
    const cardHeight = (p, rowsHeight) =>
      20 +
      p.header +
      14 +
      (split
        ? Math.max(p.imageH ? p.imageH + 24 : 0, rowsHeight)
        : (p.imageH ? p.imageH + 24 : 0) + (rowsHeight && p.imageH ? 18 : 0) + rowsHeight) +
      20;
    function dimsOf(step) {
      return {
        width: Math.max(1, Math.round(step.image.width * (step.crop?.w || 1))),
        height: Math.max(1, Math.round(step.image.height * (step.crop?.h || 1))),
      };
    }
    function firstRows(rows, start) {
      let h = 0;
      for (let i = start; i < rows.length; i++) {
        h += rows[i].h;
        if (!['label', 'space'].includes(rows[i].kind)) break;
      }
      return h;
    }
    function paintCard(p, screenshot, stepIndex, first, shown, height) {
      const x = 70 + (compact ? column * 566 : 0),
        top = y,
        contentY = top + 20 + p.header + 14;
      box(ctx, x, top, cardWidth, height, cardFill, line, 10);
      box(ctx, x + 22, top + 22, 48, 48, colour.accent, null, 8);
      font(22, true);
      ctx.fillStyle = onAccent;
      const number = String(stepIndex + 1).padStart(2, '0');
      ctx.fillText(number, x + 46 - ctx.measureText(number).width / 2, top + 54);
      font(compact ? 24 : 28, true);
      ctx.fillStyle = cardInk;
      p.titles.forEach((title, i) =>
        ctx.fillText(title, x + 86, top + 43 + i * (compact ? 31 : 34))
      );
      if (first) {
        const frameX = x + 24,
          frameW = split ? 604 : cardWidth - 48;
        ctx.save();
        ctx.shadowColor = '#10243a16';
        ctx.shadowBlur = 9;
        ctx.shadowOffsetY = 3;
        box(ctx, frameX, contentY, frameW, p.imageH + 24, colour.paper, null, 6);
        ctx.restore();
        box(ctx, frameX, contentY, frameW, p.imageH + 24, null, line, 6);
        ctx.drawImage(
          screenshot,
          frameX + (frameW - p.imageW) / 2,
          contentY + 12,
          p.imageW,
          p.imageH
        );
      }
      const textX = split ? x + 656 : x + 24;
      let rowY = split
        ? contentY
        : contentY + (first ? p.imageH + 24 : 0) + (first && shown.length ? 18 : 0);
      for (const row of shown) {
        if (row.kind === 'space') {
          rowY += row.h;
          continue;
        }
        if (row.kind === 'label') {
          font(12, true);
          ctx.fillStyle = cardAccent;
          ctx.fillText(row.text, textX, rowY + 14);
        } else if (row.kind === 'linked') {
          ctx.fillStyle = soft;
          ctx.fillRect(textX - 6, rowY - 2, p.textWidth + 12, row.h + 4);
          if (row.number !== null) {
            box(ctx, textX + 1, rowY + 2, 28, 26, colour.accent, null, 5);
            font(13, true);
            ctx.fillStyle = onAccent;
            const n = String(row.number);
            ctx.fillText(n, textX + 15 - ctx.measureText(n).width / 2, rowY + 20);
          }
          font(textSize);
          ctx.fillStyle = linkedInk;
          ctx.fillText(row.text, textX + 42, rowY + 23);
        } else {
          font(textSize);
          ctx.fillStyle = cardInk;
          ctx.fillText(row.text, textX, rowY + 23);
        }
        rowY += row.h;
      }
      return top + height;
    }
    try {
      for (let i = 0; i < guide.steps.length; i++) {
        check(alive);
        const step = guide.steps[i],
          screenshot = await raster(step, alive);
        try {
          if (!c) newPage();
          const full = plan(step, screenshot),
            rows = full.rows;
          let cursor = 0,
            first = true;
          do {
            check(alive);
            const p = plan(step, screenshot, first),
              remaining = rows.slice(cursor),
              allRows = rowTotal(remaining);
            if (first && !compact && !split && !planned.has(i) && i + 1 < guide.steps.length) {
              const other = plan(guide.steps[i + 1], dimsOf(guide.steps[i + 1])),
                sum = p.imageH + other.imageH,
                bases =
                  cardHeight({ ...p, imageH: 0 }, allRows) +
                  (allRows ? 18 + 24 : 24) +
                  cardHeight({ ...other, imageH: 0 }, rowTotal(other.rows)) +
                  (other.rows.length ? 18 + 24 : 24),
                factor = Math.min(1, (bottom - y - gap - bases) / sum);
              if (factor >= 0.8) {
                planned.set(i, factor);
                planned.set(i + 1, factor);
              }
            }
            const factor = first ? planned.get(i) || 1 : 1;
            p.imageH *= factor;
            p.imageW *= factor;
            const whole = cardHeight(p, allRows),
              fresh = bottom - bodyTop;
            if (whole > bottom - y && whole <= fresh && usedBottom > bodyTop) {
              const page = advance();
              if (page) {
                check(alive);
                yield page;
              }
              continue;
            }
            let minimum = cardHeight(p, firstRows(rows, cursor));
            if (minimum > bottom - y && usedBottom > bodyTop) {
              const page = advance();
              if (page) {
                check(alive);
                yield page;
              }
              continue;
            }
            if (minimum > fresh && first) {
              const maxH = Math.max(1, p.imageH - (minimum - fresh)),
                ratio = maxH / Math.max(1, p.imageH);
              p.imageH = maxH;
              p.imageW *= ratio;
              minimum = cardHeight(p, firstRows(rows, cursor));
            }
            const bodyStart =
                20 +
                p.header +
                14 +
                (split ? 0 : (first ? p.imageH + 24 : 0) + (first && remaining.length ? 18 : 0)),
              capacity = bottom - y - bodyStart - 20;
            let used = 0,
              take = 0;
            while (cursor + take < rows.length && used + rows[cursor + take].h <= capacity) {
              used += rows[cursor + take].h;
              take++;
            }
            while (take && ['label', 'space'].includes(rows[cursor + take - 1].kind)) {
              take--;
              used -= rows[cursor + take].h;
            }
            if (!take && remaining.length)
              throw Error(
                'This page cannot fit an instruction. Shorten the guide heading or step title.'
              );
            const shown = rows.slice(cursor, cursor + take),
              height = cardHeight(p, used),
              end = paintCard(p, screenshot, i, first, shown, height);
            usedBottom = Math.max(usedBottom, end);
            if (!firstStep) firstStep = i + 1;
            lastStep = i + 1;
            if (compact && column === 0) {
              rowBottom = end;
              column = 1;
            } else {
              y = Math.max(end, compact ? rowBottom : 0) + gap;
              rowBottom = y;
              column = 0;
            }
            cursor += take;
            first = false;
          } while (cursor < rows.length || first);
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
  async function coverPage(guide, alive) {
    const cover = guide.cover,
      colour = palette(guide.colours),
      footer = E.footer(guide.footer),
      layout = E.logoLayout(footer),
      bottom = footer.logo ? Math.min(1510, layout.y - 40) : footer.text.trim() ? 1510 : 1620,
      c = canvas(1240, 1754),
      ctx = c.getContext('2d');
    try {
      const images = [];
      for (const image of cover.images) images.push(await loadImage(image, alive));
      const logo = footer.logo ? await loadImage(footer.logo, alive, 1600, 600) : null;
      check(alive);
      ctx.fillStyle = colour.paper;
      ctx.fillRect(0, 0, 1240, 1754);
      const margin = 90,
        width = 1060,
        heading = guide.exportHeading.replace(/\s+/g, ' ').trim(),
        accentInk = palette({ accent: colour.accent, paper: colour.accent }).ink;
      ctx.imageSmoothingQuality = 'high';
      ctx.textBaseline = 'top';
      ctx.font = '700 19px Arial, sans-serif';
      const headings = heading ? wrap(ctx, heading, width) : [],
        headHeight = headings.length * 26;
      if (cover.design === 'band') {
        ctx.fillStyle = colour.accent;
        ctx.fillRect(0, 0, 1240, Math.max(150, 92 + headHeight));
        ctx.fillStyle = accentInk;
      } else {
        ctx.fillStyle = colour.accent;
        ctx.fillRect(margin, 58, cover.design === 'editorial' ? 90 : width, 6);
      }
      ctx.textAlign = cover.align;
      const x = cover.align === 'center' ? 620 : margin;
      for (const [i, line] of headings.entries()) ctx.fillText(line, x, 92 + i * 26);
      const block = (text, key, bold = false) => {
          const size = cover[key + 'Size'],
            font =
              (bold ? '700 ' : '400 ') + size + 'px ' + E.GUIDE_FONTS[cover[key + 'Font']].family;
          ctx.font = font;
          const lines = text.trim() ? wrap(ctx, text.trim(), width) : [];
          return { lines, font, lineHeight: size * 1.28, height: lines.length * size * 1.28 };
        },
        title = block(
          cover.title.trim() || guide.title.trim() || 'Screenshot guide',
          'title',
          true
        ),
        subtitle = block(cover.subtitle, 'subtitle'),
        details = block(cover.details, 'details'),
        textHeight = title.height + (subtitle.height ? 28 + subtitle.height : 0),
        top = Math.max(222, 130 + headHeight),
        detailsTop = bottom - details.height,
        available = detailsTop - (details.height ? 48 : 0) - top,
        imageHeight = images.length ? Math.min(620, available - textHeight - 54) : 0;
      if (textHeight > available || (images.length && imageHeight < 160))
        throw Error(
          'The cover text does not fit at these sizes. Shorten the text, reduce its size or remove an image.'
        );
      const text = (b, y, ink) => {
        ctx.font = b.font;
        ctx.fillStyle = ink;
        ctx.textAlign = cover.align;
        ctx.textBaseline = 'top';
        for (const [i, line] of b.lines.entries()) ctx.fillText(line, x, y + i * b.lineHeight);
      };
      const gallery = y => {
        const boxes =
          images.length === 1
            ? [{ x: margin, y, w: width, h: imageHeight }]
            : images.length === 2
              ? [0, 1].map(i => ({
                  x: margin + (i * (width + 24)) / 2,
                  y,
                  w: (width - 24) / 2,
                  h: imageHeight,
                }))
              : [
                  { x: margin, y, w: 664, h: imageHeight },
                  { x: 778, y, w: 372, h: (imageHeight - 24) / 2 },
                  { x: 778, y: y + (imageHeight + 24) / 2, w: 372, h: (imageHeight - 24) / 2 },
                ];
        for (const [i, box] of boxes.entries()) {
          ctx.strokeStyle = colour.accent;
          ctx.lineWidth = 1;
          ctx.strokeRect(box.x, box.y, box.w, box.h);
          const fit = contain(cover.images[i], {
            x: box.x + 14,
            y: box.y + 14,
            w: box.w - 28,
            h: box.h - 28,
          });
          ctx.drawImage(images[i], fit.x, fit.y, fit.w, fit.h);
        }
      };
      let titleY = top;
      if (cover.design === 'gallery' && images.length) {
        gallery(top);
        titleY += imageHeight + 54;
      } else if (!images.length) titleY += Math.min(110, Math.max(0, (available - textHeight) / 3));
      text(title, titleY, colour.ink);
      text(subtitle, titleY + title.height + 28, colour.body);
      if (cover.design !== 'gallery' && images.length) gallery(top + textHeight + 54);
      if (cover.design === 'editorial') {
        ctx.fillStyle = colour.accent;
        ctx.fillRect(margin, titleY - 30, width, 2);
      }
      if (details.height) {
        ctx.fillStyle = colour.accent;
        ctx.fillRect(margin, detailsTop - 24, width, 1);
        text(details, detailsTop, colour.muted);
      }
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      drawFooter(ctx, footer, logo, colour, layout);
      return c;
    } catch (err) {
      release(c);
      throw err;
    }
  }
  async function* pages(value, alive) {
    const guide = E.guide(value);
    let count = 0;
    if (guide.cover.enabled) {
      yield await coverPage(guide, alive);
      count++;
    }
    const content =
      guide.layout === 'classic' ? classicPages(guide, alive) : designedPages(guide, alive);
    for await (const page of content) {
      if (++count > 120) {
        release(page);
        throw Error(
          'This guide exceeds 120 pages including its cover. Shorten captions or split the guide.'
        );
      }
      yield page;
    }
  }
  async function preview(value, alive, contentOnly = false) {
    const guide = E.guide(value);
    if (contentOnly) guide.cover.enabled = false;
    if (!guide.steps.length && !guide.cover.enabled)
      throw Error('Add a screenshot to preview your guide.');
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
    loadLayers,
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
