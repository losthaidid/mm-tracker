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
  const blob = c =>
    new Promise((resolve, reject) =>
      c.toBlob(
        b => (b ? resolve(b) : reject(Error('The image could not be exported.'))),
        'image/png'
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
  async function loadImage(image, alive) {
    check(alive);
    const comma = image.src.indexOf(','),
      raw = root.atob(image.src.slice(comma + 1)),
      bytes = Uint8Array.from(raw, c => c.charCodeAt(0)),
      size = dimensions(bytes);
    if (Math.max(size.width, size.height) > 2400 || size.width * size.height > 12000000)
      throw Error(
        'This guide contains an oversized image. Open the original screenshot through Add screenshots first.'
      );
    const img = await decode(image.src);
    check(alive);
    if (img.naturalWidth !== image.width || img.naturalHeight !== image.height)
      throw Error('The guide image dimensions do not match its file.');
    return img;
  }
  async function imageFromFile(file, alive) {
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
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight)),
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
      if (mark.type === 'cover') ctx.fillRect(area.x * w, area.y * h, area.w * w, area.h * h);
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
  async function* pages(guide, alive) {
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
          ctx.fillStyle = '#f8f7f1';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.fillStyle = '#285b4d';
          ctx.font = '600 19px system-ui, sans-serif';
          ctx.fillText('WORKHUB  /  SCREENSHOT GUIDE', 70, 68);
          ctx.fillStyle = '#172f2c';
          ctx.font = '600 27px system-ui, sans-serif';
          let y = 120;
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
              (1550 - y) / screenshot.height
            );
            y += 20;
            ctx.drawImage(screenshot, 70, y, screenshot.width * scale, screenshot.height * scale);
            y += screenshot.height * scale + 35;
          }
          ctx.font = '24px system-ui, sans-serif';
          ctx.fillStyle = '#354944';
          if (!lines) lines = wrap(ctx, step.caption, 1100);
          const capacity = Math.max(1, Math.floor((1620 - y) / 35)),
            showing = lines.splice(0, capacity);
          for (const line of showing) {
            ctx.fillText(line, 70, y);
            y += 35;
          }
          ctx.fillStyle = '#657d73';
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
    if (format === 'images') {
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
        const png = await blob(page);
        check(alive);
        const bytes = await png.arrayBuffer();
        check(alive);
        if (zip) zip.file(String(++n).padStart(3, '0') + '-guide-page.png', bytes);
        else {
          const image = await pdf.embedPng(bytes),
            p = pdf.addPage([595.28, 841.89]);
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
    draw,
    cropped,
    raster,
    wrap,
    pages,
    export: exportFile,
  };
})(window);
