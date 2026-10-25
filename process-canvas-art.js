/** Graph-space process annotations. Shared by the private canvas, audience and file exports. */
(function (root) {
  'use strict';
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function resolved(m, steps) {
    const anchor = steps.find(s => s.id === m.anchorId);
    return { ...m, x: m.x + (anchor?.x || 0), y: m.y + (anchor?.y || 0) };
  }
  function box(m, steps = []) {
    const a = resolved(m, steps);
    if (a.type === 'text') return { x: a.x, y: a.y, w: a.w, h: a.h };
    const xs = a.points.map(p => p[0]),
      ys = a.points.map(p => p[1]);
    return {
      x: a.x + Math.min(...xs),
      y: a.y + Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }
  function dimensions(p) {
    const boxes = (p.annotations || []).map(m => box(m, p.steps));
    return {
      width: Math.max(850, ...p.steps.map(s => s.x + 270), ...boxes.map(b => b.x + b.w + 60)),
      height: Math.max(450, ...p.steps.map(s => s.y + 180), ...boxes.map(b => b.y + b.h + 60)),
    };
  }
  function wrap(text, width, size) {
    const max = Math.max(2, Math.floor((width - 22) / (size * 0.56))),
      rows = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (let word of paragraph.split(/\s+/)) {
        while (word.length > max) {
          if (line) {
            rows.push(line);
            line = '';
          }
          rows.push(word.slice(0, max));
          word = word.slice(max);
        }
        if ((line + ' ' + word).trim().length > max) {
          rows.push(line);
          line = '';
        }
        line += (line ? ' ' : '') + word;
      }
      rows.push(line);
    }
    return rows;
  }
  function head(a, b, size = 14) {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return (
      'M' +
      (b[0] - size * Math.cos(angle - 0.5)) +
      ',' +
      (b[1] - size * Math.sin(angle - 0.5)) +
      'L' +
      b.join(',') +
      'L' +
      (b[0] - size * Math.cos(angle + 0.5)) +
      ',' +
      (b[1] - size * Math.sin(angle + 0.5))
    );
  }
  function svg(p, selected = '', editable = false) {
    return (p.annotations || [])
      .map(raw => {
        const m = resolved(raw, p.steps);
        if (
          !m ||
          !/^#[0-9a-f]{6}$/i.test(m.color) ||
          !Number.isFinite(m.x) ||
          !Number.isFinite(m.y)
        )
          return '';
        let art = '',
          handles = '';
        const attrs = ' data-canvas-mark="' + esc(m.id) + '"';
        if (m.type === 'text') {
          const fs = clamp(m.fontSize, 8, 96),
            lines = wrap(m.text, m.w, fs),
            shown = lines.slice(0, Math.max(1, Math.floor((m.h - 16) / (fs * 1.22))));
          if (shown.length < lines.length)
            shown[shown.length - 1] = shown.at(-1).slice(0, -1) + '…';
          art =
            '<rect class="pc-note-fill" width="' +
            m.w +
            '" height="' +
            m.h +
            '" rx="10" fill="#193f38" fill-opacity=".96"/><text x="12" y="' +
            (fs + 5) +
            '" font-size="' +
            fs +
            '" fill="' +
            m.color +
            '">' +
            shown
              .map(
                (l, i) => '<tspan x="12" dy="' + (i ? fs * 1.22 : 0) + '">' + esc(l) + '</tspan>'
              )
              .join('') +
            '</text>';
          if (editable && selected === m.id)
            handles = [
              ['nw', 0, 0],
              ['ne', m.w, 0],
              ['sw', 0, m.h],
              ['se', m.w, m.h],
              ['e', m.w, m.h / 2],
              ['s', m.w / 2, m.h],
            ]
              .map(
                ([key, x, y]) =>
                  '<circle class="pc-handle" data-pc-resize="' +
                  key +
                  '"' +
                  attrs +
                  ' cx="' +
                  x +
                  '" cy="' +
                  y +
                  '" r="7"/>'
              )
              .join('');
        } else if (Array.isArray(m.points) && m.points.length > 1) {
          const points = m.points.map(pt => pt.map(n => clamp(Number(n) || 0, -8000, 8000)));
          art =
            '<polyline class="pc-mark-hit" points="' +
            points.map(p => p.join(',')).join(' ') +
            '" fill="none" stroke="transparent" stroke-width="22"/><polyline class="pc-ink-line" points="' +
            points.map(p => p.join(',')).join(' ') +
            '" fill="none" stroke="' +
            m.color +
            '" stroke-width="' +
            m.width +
            '" stroke-linecap="round" stroke-linejoin="round"/>';
          if (m.type === 'arrow')
            art +=
              '<path class="pc-arrow-head" d="' +
              head(points[0], points.at(-1), Math.max(12, m.width * 3)) +
              '" fill="none" stroke="' +
              m.color +
              '" stroke-width="' +
              m.width +
              '" stroke-linecap="round"/>';
          if (editable && selected === m.id)
            handles = [
              ['start', points[0]],
              ['end', points.at(-1)],
            ]
              .map(
                ([key, pt]) =>
                  '<circle class="pc-handle" data-pc-resize="' +
                  key +
                  '"' +
                  attrs +
                  ' cx="' +
                  pt[0] +
                  '" cy="' +
                  pt[1] +
                  '" r="8"/>'
              )
              .join('');
        }
        const b = box(raw, p.steps);
        const ring =
          editable && selected === m.id
            ? '<rect class="pc-selection" x="' +
              (b.x - m.x - 5) +
              '" y="' +
              (b.y - m.y - 5) +
              '" width="' +
              Math.max(10, b.w + 10) +
              '" height="' +
              Math.max(10, b.h + 10) +
              '" rx="6"/>'
            : '';
        return (
          '<g class="pc-annotation pc-' +
          esc(m.type) +
          '"' +
          attrs +
          ' transform="translate(' +
          m.x +
          ',' +
          m.y +
          ')"><title>' +
          esc(m.type === 'text' ? m.text : 'Process annotation') +
          '</title>' +
          art +
          ring +
          handles +
          '</g>'
        );
      })
      .join('');
  }
  function attach(mark, step, steps) {
    const m = resolved(mark, steps);
    if (typeof step === 'string') step = steps.find(s => s.id === step);
    return { ...m, anchorId: step?.id || '', x: m.x - (step?.x || 0), y: m.y - (step?.y || 0) };
  }
  function resize(mark, handle, dx, dy) {
    const m = JSON.parse(JSON.stringify(mark));
    if (m.type !== 'text') {
      const i = handle === 'start' ? 0 : m.points.length - 1;
      m.points[i] = [
        clamp(m.points[i][0] + dx, -8000, 8000),
        clamp(m.points[i][1] + dy, -8000, 8000),
      ];
      return m;
    }
    const oldW = m.w,
      oldH = m.h,
      left = handle.includes('w'),
      top = handle.includes('n');
    m.w = clamp(oldW + (left ? -dx : handle === 's' ? 0 : dx), 40, 2000);
    m.h = clamp(oldH + (top ? -dy : handle === 'e' ? 0 : dy), 25, 1600);
    if (left) m.x += oldW - m.w;
    if (top) m.y += oldH - m.h;
    if (!['e', 's'].includes(handle))
      m.fontSize = clamp(mark.fontSize * Math.min(m.w / oldW, m.h / oldH), 8, 96);
    return m;
  }
  function draw(c, p) {
    for (const raw of p.annotations || []) {
      const m = resolved(raw, p.steps);
      c.save();
      c.translate(m.x, m.y);
      c.strokeStyle = m.color;
      c.fillStyle = m.color;
      c.lineWidth = m.width;
      c.lineCap = 'round';
      if (m.type === 'text') {
        c.fillStyle = '#193f38';
        c.fillRect(0, 0, m.w, m.h);
        c.fillStyle = m.color;
        c.font = m.fontSize + 'px system-ui';
        const rows = wrap(m.text, m.w, m.fontSize).slice(
          0,
          Math.max(1, Math.floor((m.h - 16) / (m.fontSize * 1.22)))
        );
        rows.forEach((line, i) => c.fillText(line, 12, m.fontSize + 5 + i * m.fontSize * 1.22));
      } else {
        c.beginPath();
        m.points.forEach((pt, i) => (i ? c.lineTo(...pt) : c.moveTo(...pt)));
        c.stroke();
        if (m.type === 'arrow') {
          const a = m.points[0],
            b = m.points.at(-1),
            angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
            size = Math.max(12, m.width * 3);
          c.beginPath();
          c.moveTo(b[0] - size * Math.cos(angle - 0.5), b[1] - size * Math.sin(angle - 0.5));
          c.lineTo(...b);
          c.lineTo(b[0] - size * Math.cos(angle + 0.5), b[1] - size * Math.sin(angle + 0.5));
          c.stroke();
        }
      }
      c.restore();
    }
  }
  root.WorkHubProcessCanvasArt = {
    resolved,
    box,
    dimensions,
    wrap,
    svg,
    attach,
    resize,
    draw,
    clamp,
  };
})(window);
