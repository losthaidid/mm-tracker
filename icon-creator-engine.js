/* Local icon geometry, contour tracing and SVG export. Uploaded images never leave the browser. */
(function (root) {
  'use strict';
  const SIZE = 256;
  const esc = value =>
    String(value).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const color = value => /^#[0-9a-f]{6}$/i.test(value);
  function create(initials = 'WH') {
    return {
      source: null,
      fit: { zoom: 1, x: 0, y: 0, rotation: 0, padding: 12 },
      shape: 'rounded',
      background: 'transparent',
      mode: 'image',
      threshold: 170,
      traceTarget: 'dark',
      detail: 96,
      ink: '#365f83',
      lineWidth: 3,
      text: initials,
      textSize: 82,
      textFont: 'sans-serif',
      strokes: [],
    };
  }
  function copy(d) {
    return {
      ...d,
      source: d.source,
      fit: { ...d.fit },
      strokes: d.strokes.map(s => ({ ...s, points: s.points.map(p => [...p]) })),
    };
  }
  function fit(d) {
    if (!d.source) return null;
    const ratio =
      (SIZE * (1 - d.fit.padding / 50) * d.fit.zoom) / Math.max(d.source.width, d.source.height);
    return {
      width: d.source.width * ratio,
      height: d.source.height * ratio,
      x: SIZE / 2 + d.fit.x,
      y: SIZE / 2 + d.fit.y,
      rotation: d.fit.rotation,
    };
  }
  function strokePath(points) {
    return points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join('');
  }
  function frame(shape) {
    return shape === 'circle'
      ? '<circle cx="128" cy="128" r="128"/>'
      : `<rect width="256" height="256" rx="${shape === 'rounded' ? 48 : 0}"/>`;
  }
  // Follow directed cell edges, keeping filled pixels on the right. Holes remain separate loops.
  function trace(pixels, width, height, threshold = 170, target = 'dark') {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 128 ||
      height > 128 ||
      pixels.length !== width * height * 4
    )
      throw Error('Choose a tracing detail between 1 and 128 pixels.');
    const filled = new Uint8Array(width * height),
      edges = new Map();
    for (let i = 0; i < filled.length; i++)
      filled[i] =
        pixels[i * 4 + 3] >= 24 &&
        (target === 'alpha' ||
          pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722 <
            threshold)
          ? 1
          : 0;
    const at = (x, y) => x >= 0 && y >= 0 && x < width && y < height && filled[y * width + x];
    const add = (x, y, nx, ny, direction) => {
      const key = y * (width + 1) + x;
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ x: nx, y: ny, direction });
    };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (at(x, y)) {
          if (!at(x, y - 1)) add(x, y, x + 1, y, 0);
          if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1, 1);
          if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1, 2);
          if (!at(x - 1, y)) add(x, y + 1, x, y, 3);
        }
    const paths = [];
    while (edges.size) {
      const first = edges.keys().next().value,
        points = [],
        sx = first % (width + 1),
        sy = Math.floor(first / (width + 1));
      let x = sx,
        y = sy,
        previous = -1,
        steps = 0;
      do {
        points.push([x, y]);
        const key = y * (width + 1) + x,
          choices = edges.get(key);
        if (!choices?.length) break;
        const rank = d => (previous < 0 ? 0 : [1, 0, 3, 2][(d - previous + 4) % 4]);
        choices.sort((a, b) => rank(a.direction) - rank(b.direction));
        const next = choices.shift();
        if (!choices.length) edges.delete(key);
        x = next.x;
        y = next.y;
        previous = next.direction;
      } while ((x !== sx || y !== sy) && ++steps < width * height * 4 + 4);
      if (x !== sx || y !== sy || points.length < 4) continue;
      const corners = points.filter((p, i) => {
        const prev = points[(i + points.length - 1) % points.length],
          next = points[(i + 1) % points.length];
        return (p[0] - prev[0]) * (next[1] - p[1]) !== (p[1] - prev[1]) * (next[0] - p[0]);
      });
      paths.push(
        corners
          .map(
            ([px, py], i) =>
              (i ? 'L' : 'M') +
              ((px * SIZE) / width).toFixed(2) +
              ' ' +
              ((py * SIZE) / height).toFixed(2)
          )
          .join('') + 'Z'
      );
    }
    return paths.join('');
  }
  function validate(d) {
    if (
      !d ||
      !['square', 'rounded', 'circle'].includes(d.shape) ||
      !['image', 'outline', 'silhouette'].includes(d.mode) ||
      !['alpha', 'dark'].includes(d.traceTarget) ||
      ![64, 96, 128].includes(d.detail) ||
      !color(d.ink) ||
      (d.background !== 'transparent' && !color(d.background)) ||
      typeof d.text !== 'string' ||
      Array.from(d.text).length > 3 ||
      /[\u0000-\u001f]/.test(d.text) ||
      !['sans-serif', 'serif', 'monospace'].includes(d.textFont) ||
      !Number.isFinite(d.textSize) ||
      d.textSize < 24 ||
      d.textSize > 160 ||
      !Number.isFinite(d.lineWidth) ||
      d.lineWidth < 1 ||
      d.lineWidth > 24 ||
      !Number.isFinite(d.threshold) ||
      d.threshold < 1 ||
      d.threshold > 255 ||
      !Array.isArray(d.strokes) ||
      d.strokes.length > 250
    )
      throw Error('Check the icon shape, colours, text and drawing settings.');
    for (const [name, min, max] of [
      ['zoom', 0.25, 3],
      ['x', -128, 128],
      ['y', -128, 128],
      ['rotation', -180, 180],
      ['padding', 0, 40],
    ])
      if (!Number.isFinite(d.fit?.[name]) || d.fit[name] < min || d.fit[name] > max)
        throw Error('Check the image fit and position.');
    if (
      d.source &&
      (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.source.data) ||
        d.source.data.length > 6000000 ||
        !Number.isFinite(d.source.width) ||
        !Number.isFinite(d.source.height) ||
        d.source.width < 1 ||
        d.source.height < 1 ||
        d.source.width > 1024 ||
        d.source.height > 1024)
    )
      throw Error('Open a supported image smaller than 1024 pixels after fitting.');
    let count = 0;
    for (const s of d.strokes) {
      if (
        typeof s.erase !== 'boolean' ||
        !color(s.color) ||
        !Number.isFinite(s.size) ||
        s.size < 1 ||
        s.size > 32 ||
        !Array.isArray(s.points) ||
        !s.points.length ||
        s.points.some(
          p =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            p.some(n => !Number.isFinite(n) || n < 0 || n > SIZE)
        )
      )
        throw Error('Check the drawing strokes.');
      count += s.points.length;
    }
    if (count > 50000)
      throw Error('This drawing has reached its detail limit. Export it before adding more.');
    return d;
  }
  function svg(d, outline = '', size = 512) {
    validate(d);
    if (!Number.isInteger(size) || size < 16 || size > 2048)
      throw Error('Choose an export size between 16 and 2048 pixels.');
    const box = fit(d),
      definitions = ['<clipPath id="frame">' + frame(d.shape) + '</clipPath>'];
    let art = '';
    if (d.source && d.mode === 'image')
      art += `<image href="${esc(d.source.data)}" x="${-box.width / 2}" y="${-box.height / 2}" width="${box.width}" height="${box.height}" transform="translate(${box.x} ${box.y}) rotate(${box.rotation})"/>`;
    else if (d.source && outline)
      art += `<path d="${esc(outline)}" fill="${d.mode === 'silhouette' ? d.ink : 'none'}" fill-rule="evenodd" stroke="${d.mode === 'outline' ? d.ink : 'none'}" stroke-width="${d.lineWidth}" stroke-linejoin="round"/>`;
    if (d.text.trim())
      art += `<text x="128" y="128" dominant-baseline="central" text-anchor="middle" font-family="${d.textFont}" font-size="${d.textSize}" font-weight="700" fill="${d.ink}">${esc(d.text)}</text>`;
    d.strokes.forEach((s, i) => {
      const mark =
        s.points.length === 1
          ? `<circle cx="${s.points[0][0]}" cy="${s.points[0][1]}" r="${s.size / 2}" fill="${s.erase ? '#000000' : s.color}"/>`
          : `<path d="${strokePath(s.points)}" fill="none" stroke="${s.erase ? '#000000' : s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (s.erase) {
        definitions.push(
          `<mask id="erase${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/>${mark}</mask>`
        );
        art = `<g mask="url(#erase${i})">${art}</g>`;
      } else art += mark;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><defs>${definitions.join('')}</defs><g clip-path="url(#frame)">${d.background === 'transparent' ? '' : `<rect width="256" height="256" fill="${d.background}"/>`}${art}</g></svg>`;
  }
  root.WorkHubIconEngine = Object.freeze({ SIZE, create, copy, fit, trace, validate, svg });
})(typeof window === 'undefined' ? globalThis : window);
