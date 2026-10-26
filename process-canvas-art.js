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
  function anchor(step, value = { side: 'right', offset: 0.5 }) {
    const t = clamp(value.offset, 0, 1);
    return value.side === 'left'
      ? { x: step.x, y: step.y + t * 100, nx: -1, ny: 0 }
      : value.side === 'top'
        ? { x: step.x + t * 210, y: step.y, nx: 0, ny: -1 }
        : value.side === 'bottom'
          ? { x: step.x + t * 210, y: step.y + 100, nx: 0, ny: 1 }
          : { x: step.x + 210, y: step.y + t * 100, nx: 1, ny: 0 };
  }
  function nearestAnchor(step, point) {
    const x = clamp((point.x - step.x) / 210, 0, 1),
      y = clamp((point.y - step.y) / 100, 0, 1);
    return [
      { side: 'top', offset: x },
      { side: 'right', offset: y },
      { side: 'bottom', offset: x },
      { side: 'left', offset: y },
    ].sort((a, b) => {
      const pa = anchor(step, a),
        pb = anchor(step, b);
      return (
        Math.hypot(pa.x - point.x, pa.y - point.y) - Math.hypot(pb.x - point.x, pb.y - point.y)
      );
    })[0];
  }
  function linkGeometry(a, b, edge = {}) {
    const start = anchor(a, edge.start),
      end = anchor(b, edge.end || { side: 'left', offset: 0.5 }),
      via = edge.via || [],
      segments = [],
      points = [start, ...via, end];
    const line = (a, b) => segments.push([a, a, b, b]);
    if (edge.style === 'straight')
      for (let i = 1; i < points.length; i++) line(points[i - 1], points[i]);
    else if (edge.style === 'elbow') {
      const route = [
        start,
        { x: clamp(start.x + start.nx * 32, 0, 8000), y: clamp(start.y + start.ny * 32, 0, 8000) },
        ...via,
        { x: clamp(end.x + end.nx * 32, 0, 8000), y: clamp(end.y + end.ny * 32, 0, 8000) },
        end,
      ];
      for (let i = 1; i < route.length; i++) {
        const prev = route[i - 1],
          next = route[i];
        if (i === 1 || i === route.length - 1 || prev.x === next.x || prev.y === next.y) {
          line(prev, next);
          continue;
        }
        // A dogleg leaves each bend without retracing the incoming leg.
        const horizontal = i === route.length - 2 ? !end.nx : !!start.nx,
          mid = horizontal ? (prev.x + next.x) / 2 : (prev.y + next.y) / 2,
          first = horizontal ? { x: mid, y: prev.y } : { x: prev.x, y: mid },
          second = horizontal ? { x: mid, y: next.y } : { x: next.x, y: mid };
        line(prev, first);
        line(first, second);
        line(second, next);
      }
    } else
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1],
          next = points[i],
          k = Math.max(70, Math.abs(next.x - prev.x) * 0.45),
          before = points[i - 2] || prev,
          after = points[i + 1] || next;
        segments.push([
          prev,
          i === 1
            ? { x: prev.x + start.nx * k, y: prev.y + start.ny * k }
            : { x: prev.x + (next.x - before.x) * 0.2, y: prev.y + (next.y - before.y) * 0.2 },
          i === points.length - 1
            ? { x: next.x + end.nx * k, y: next.y + end.ny * k }
            : { x: next.x - (after.x - prev.x) * 0.2, y: next.y - (after.y - prev.y) * 0.2 },
          next,
        ]);
      }
    for (const segment of segments)
      for (const i of [1, 2])
        segment[i] = { x: clamp(segment[i].x, 0, 8000), y: clamp(segment[i].y, 0, 8000) };
    const at = (s, t) => {
      const u = 1 - t;
      return {
        x:
          u * u * u * s[0].x + 3 * u * u * t * s[1].x + 3 * u * t * t * s[2].x + t * t * t * s[3].x,
        y:
          u * u * u * s[0].y + 3 * u * u * t * s[1].y + 3 * u * t * t * s[2].y + t * t * t * s[3].y,
      };
    };
    const lengths = segments.map(s => {
        let total = 0,
          prev = s[0];
        for (let i = 1; i <= 12; i++) {
          const pt = at(s, i / 12);
          total += Math.hypot(pt.x - prev.x, pt.y - prev.y);
          prev = pt;
        }
        return total;
      }),
      length = lengths.reduce((a, b) => a + b, 0);
    return {
      start,
      end,
      segments,
      path:
        'M ' +
        start.x +
        ' ' +
        start.y +
        segments
          .map(
            s =>
              ' C ' +
              s[1].x +
              ' ' +
              s[1].y +
              ', ' +
              s[2].x +
              ' ' +
              s[2].y +
              ', ' +
              s[3].x +
              ' ' +
              s[3].y
          )
          .join(''),
      point(t) {
        let distance = clamp(t, 0, 1) * length;
        for (let i = 0; i < segments.length; i++) {
          if (distance <= lengths[i] || i === segments.length - 1)
            return at(segments[i], lengths[i] ? distance / lengths[i] : 0);
          distance -= lengths[i];
        }
        return start;
      },
    };
  }
  function linkHandles(p, edge) {
    if (!edge) return '';
    const a = p.steps.find(s => s.id === edge.from),
      b = p.steps.find(s => s.id === edge.to);
    if (!a || !b) return '';
    const route = linkGeometry(a, b, edge),
      handles = [
        ['start', route.start],
        ['end', route.end],
        ...(edge.via?.length
          ? edge.via.map((pt, i) => ['bend-' + i, pt])
          : [['bend-new', route.point(0.5)]]),
      ];
    return handles
      .map(([key, pt]) => {
        const attributes =
          ' class="pc-connection-handle" data-link-handle="' +
          key +
          '" role="button" tabindex="0" aria-label="' +
          (key === 'start'
            ? 'Move link starting point'
            : key === 'end'
              ? 'Move link endpoint'
              : 'Move route bend') +
          '"';
        const title =
          '<title>' +
          (key.startsWith('bend')
            ? 'Drag to shape route; Delete removes a bend'
            : 'Drag to any edge of a step') +
          '</title>';
        return key.startsWith('bend')
          ? '<rect' +
              attributes +
              ' x="' +
              (pt.x - 6) +
              '" y="' +
              (pt.y - 6) +
              '" width="12" height="12" rx="1" transform="rotate(45 ' +
              pt.x +
              ' ' +
              pt.y +
              ')">' +
              title +
              '</rect>'
          : '<circle' +
              attributes +
              ' cx="' +
              pt.x +
              '" cy="' +
              pt.y +
              '" r="9">' +
              title +
              '</circle>';
      })
      .join('');
  }
  function dimensions(p) {
    const boxes = (p.annotations || []).map(m => box(m, p.steps));
    for (const edge of p.connectors || p.edges || [])
      for (const pt of edge.via || []) boxes.push({ x: pt.x, y: pt.y, w: 50, h: 50 });
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
    anchor,
    nearestAnchor,
    linkGeometry,
    linkHandles,
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
