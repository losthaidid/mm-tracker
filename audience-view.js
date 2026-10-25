/** Audience-only renderer shared by the projector window and private preview. */
(function (root) {
  'use strict';
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const clock = n =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function textBox(mark) {
    const size = clamp(mark.fontSize, 16, 40),
      rows = [];
    for (const paragraph of mark.text.split('\n')) {
      let line = '';
      for (const word of paragraph.match(/.{1,34}(?:\s|$)|\S{1,34}/g) || ['']) {
        if ((line + word).length > 34 && line) {
          rows.push(line.trim());
          line = '';
        }
        line += word;
      }
      rows.push(line.trim());
    }
    const shown = rows.slice(0, 10),
      width = Math.min(920, Math.max(100, ...shown.map(l => l.length * size * 0.62 + 24))),
      height = shown.length * size * 1.25 + 20;
    return {
      rows: shown,
      size,
      width,
      height,
      x: clamp(mark.points[0][0] * 1000, 8, 992 - width),
      y: clamp(mark.points[0][1] * 562.5, 8, 554.5 - height),
    };
  }
  function moveMark(mark, dx, dy) {
    const box = mark.type === 'text' ? textBox(mark) : null;
    const points = box ? [[box.x / 1000, box.y / 562.5]] : mark.points;
    const xs = points.map(p => p[0]),
      ys = points.map(p => p[1]);
    dx = clamp(
      dx,
      (box ? 0.008 : 0) - Math.min(...xs),
      (box ? (992 - box.width) / 1000 : 1) - Math.max(...xs)
    );
    dy = clamp(
      dy,
      (box ? 8 / 562.5 : 0) - Math.min(...ys),
      (box ? (554.5 - box.height) / 562.5 : 1) - Math.max(...ys)
    );
    return { ...mark, points: points.map(([x, y]) => [x + dx, y + dy]) };
  }
  function hitMark(marks, point) {
    const [x, y] = [point[0] * 1000, point[1] * 562.5];
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (m.type === 'text') {
        const b = textBox(m);
        if (x >= b.x - 5 && x <= b.x + b.width + 5 && y >= b.y - 5 && y <= b.y + b.height + 5)
          return i;
      } else
        for (let j = 1; j < m.points.length; j++) {
          const a = [m.points[j - 1][0] * 1000, m.points[j - 1][1] * 562.5],
            b = [m.points[j][0] * 1000, m.points[j][1] * 562.5];
          const vx = b[0] - a[0],
            vy = b[1] - a[1],
            t = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy || 1), 0, 1);
          if (Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy) <= Math.max(10, m.width + 5))
            return i;
        }
    }
    return -1;
  }
  function cameraFor(data, options = {}) {
    const width = Math.max(
        850,
        root.WorkHubProcessCanvasArt?.dimensions(data).width || 0,
        ...data.steps.map(s => s.x + 270)
      ),
      height = Math.max(
        450,
        root.WorkHubProcessCanvasArt?.dimensions(data).height || 0,
        ...data.steps.map(s => s.y + 160)
      ),
      c = options.camera;
    if (
      c &&
      ['x', 'y', 'width', 'height'].every(k => Number.isFinite(c[k])) &&
      c.width >= 200 &&
      c.height >= 100 &&
      c.width <= 20000 &&
      c.height <= 20000
    )
      return {
        x: clamp(c.x, -c.width * 0.9, width - c.width * 0.1),
        y: clamp(c.y, -c.height * 0.9, height - c.height * 0.1),
        width: c.width,
        height: c.height,
      };
    const active = data.steps.find(s => s.id === data.active);
    return !options.overview && active
      ? { x: Math.max(0, active.x - 110), y: Math.max(0, active.y - 130), width: 850, height: 450 }
      : { x: 0, y: 0, width, height };
  }
  function graphPoint(point, rect, camera) {
    const scale = Math.max(
      0.00001,
      Math.min(rect.width / camera.width, rect.height / camera.height)
    );
    return {
      x: camera.x + (point[0] - rect.left - (rect.width - camera.width * scale) / 2) / scale,
      y: camera.y + (point[1] - rect.top - (rect.height - camera.height * scale) / 2) / scale,
    };
  }
  function lines(value) {
    const result = [];
    let line = '';
    for (const word of String(value).split(/\s+/)) {
      if ((line + ' ' + word).length > 27 && line) {
        result.push(line);
        line = '';
      }
      line += (line ? ' ' : '') + word;
    }
    if (line) result.push(line);
    return result
      .slice(0, 3)
      .map((l, i) => (i === 2 && result.length > 3 ? l.slice(0, 24) + '…' : l));
  }
  function create(host) {
    let data = null,
      signature = '',
      markSignature = '',
      received = 0,
      frame = 0,
      disposed = false,
      camera = null,
      annotationKey = '';
    host.classList.add('audience-frame');
    function stop() {
      if (frame) root.cancelAnimationFrame(frame);
      frame = 0;
    }
    function draw(t) {
      frame = 0;
      if (!data || disposed || !host.isConnected) return;
      const token = host.querySelector('.av-token');
      if (data.kind === 'process' && token) {
        const a = data.steps.find(s => s.id === data.active),
          b = data.steps.find(s => s.id === data.next);
        let phase = data.phase;
        if (data.playing && !data.reduced)
          phase += (Math.min(500, t - received) * data.speed) / (data.duration * 1000);
        token.style.display =
          !a || !b || phase < 0.5 || data.decision || data.reduced ? 'none' : '';
        if (a && b) {
          const f = Math.max(0, Math.min(1, (phase - 0.5) * 2)),
            u = 1 - f,
            k = Math.max(70, Math.abs(b.x - a.x - 210) * 0.45);
          const x =
            u * u * u * (a.x + 210) +
            3 * u * u * f * (a.x + 210 + k) +
            3 * u * f * f * (b.x - k) +
            f * f * f * b.x;
          const y =
            u * u * u * (a.y + 50) +
            3 * u * u * f * (a.y + 50) +
            3 * u * f * f * (b.y + 50) +
            f * f * f * (b.y + 50);
          token.setAttribute('transform', `translate(${x},${y})`);
        }
        if (data.playing && !data.reduced && !document.hidden)
          frame = root.requestAnimationFrame(draw);
      }
    }
    function pointer(point) {
      let dot = host.querySelector('.av-laser');
      if (
        !point ||
        !Array.isArray(point) ||
        point.length !== 2 ||
        !point.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
      ) {
        if (dot) dot.hidden = true;
        return;
      }
      if (!dot) {
        dot = document.createElement('i');
        dot.className = 'av-laser';
        dot.setAttribute('aria-hidden', 'true');
        host.append(dot);
      }
      dot.hidden = false;
      dot.style.left = point[0] * 100 + '%';
      dot.style.top = point[1] * 100 + '%';
    }
    function update(snapshot, marks = [], options = {}) {
      if (disposed) return;
      data = snapshot;
      received = root.performance.now();
      host.dataset.kind = data.kind;
      host.dataset.scene = data.scene || 'coast';
      host.dataset.reduced = String(!!data.reduced);
      host.dataset.playing = String(!!data.playing);
      host.dataset.mapOnly = String(options.mapOnly === true);
      host.style.setProperty('--av-text', Math.max(0.85, Math.min(1.4, options.textScale || 1)));
      const key = JSON.stringify([
        data.kind,
        data.title,
        data.steps?.map(s => ({
          id: s.id,
          title: s.title,
          type: s.type,
          entity: s.entity,
          stackParent: s.stackParent,
        })),
        data.edges,
        data.detail,
        data.decision,
        data.message,
        data.scene,
      ]);
      if (key !== signature) {
        signature = key;
        markSignature = '';
        annotationKey = '';
        if (data.kind === 'process') {
          const w = Math.max(850, ...data.steps.map(s => s.x + 270)),
            h = Math.max(400, ...data.steps.map(s => s.y + 160));
          const map = new Map(data.steps.map(s => [s.id, s]));
          const edges = data.edges
            .map(e => {
              const a = map.get(e.from),
                b = map.get(e.to);
              if (!a || !b) return '';
              const k = Math.max(70, Math.abs(b.x - a.x - 210) * 0.45);
              return `<g class="av-edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}"><path d="M${a.x + 210},${a.y + 50} C${a.x + 210 + k},${a.y + 50} ${b.x - k},${b.y + 50} ${b.x},${b.y + 50}"/><text x="${(a.x + 210 + b.x) / 2}" y="${(a.y + b.y) / 2 + 35}">${esc(e.label)}</text></g>`;
            })
            .join('');
          const nodes = data.steps
            .map(
              s =>
                `<g class="av-node" data-node="${esc(s.id)}" transform="translate(${s.x},${s.y})"><rect width="210" height="100" rx="${s.type === 'decision' ? 28 : 12}"/><text class="av-type" x="15" y="22">${esc(s.type.toUpperCase())}</text><text class="av-step-title">${lines(
                  s.title
                )
                  .map((l, i) => `<tspan x="15" y="${45 + i * 19}">${esc(l)}</tspan>`)
                  .join(
                    ''
                  )}</text>${s.entity && Object.values(s.entity).some(Boolean) ? '<text class="pc-entity-label" x="15" y="94">' + esc(Object.values(s.entity).filter(Boolean).slice(0, 3).join(' · ').slice(0, 38)) + '</text>' : ''}</g>`
            )
            .join('');
          host.innerHTML = `<div class="av-content"><header class="av-header"><div><span class="av-kicker">PROCESS WALKTHROUGH</span><h1>${esc(data.title)}</h1></div><span class="av-counter"></span></header><div class="av-layout"><div class="av-map"><svg class="av-graph" viewBox="0 0 ${w} ${h}" aria-label="Process diagram">${edges}${nodes}<g class="pc-graph-annotations"></g><path class="pc-wire-preview" hidden/><g class="av-token"><circle r="12"/><path d="M-4-5H4V5H-4Z"/></g></svg></div><aside class="av-detail"><span class="av-kicker">CURRENT STEP</span><h2>${esc(data.detail?.title || '')}</h2>${data.detail?.owner ? `<p class="av-owner">${esc(data.detail.owner)}</p>` : ''}<p>${esc(data.detail?.explanation || '')}</p>${data.detail?.expected ? `<div class="av-result"><span>EXPECTED RESULT</span><p>${esc(data.detail.expected)}</p></div>` : ''}${data.decision ? `<section class="av-question"><strong>${esc(data.decision.question)}</strong><ol>${data.decision.answers.map(a => `<li>${esc(a.label)}</li>`).join('')}</ol><small>Waiting for the presenter’s choice</small></section>` : ''}</aside></div><footer class="av-footer"><span class="av-state"></span><span>PROCESS HUB</span></footer></div><svg class="av-annotations" viewBox="0 0 1000 562.5" aria-hidden="true"></svg>`;
        } else if (data.kind === 'break') {
          host.innerHTML = `<div class="av-break-scenery" aria-hidden="true"><i class="av-sun"></i><i class="av-cloud"></i><i class="av-hill back"></i><i class="av-hill front"></i><i class="av-water"></i><i class="av-stars"></i></div><div class="av-break-copy"><span class="av-kicker">A MOMENT TO RESET</span><h1>${esc(data.message)}</h1><output class="av-clock" role="timer" aria-live="off"></output><p class="av-break-status"></p></div><svg class="av-annotations" viewBox="0 0 1000 562.5" aria-hidden="true"></svg>`;
        } else {
          host.innerHTML = `<div class="av-cover"><span class="av-cover-icon" aria-hidden="true">✦</span><span class="av-kicker">PRESENTATION</span><h1>${esc(data.message || 'We’ll be right back.')}</h1><p>${esc(data.subtitle || 'Please give us a moment.')}</p></div><svg class="av-annotations" viewBox="0 0 1000 562.5" aria-hidden="true"></svg>`;
        }
      }
      if (data.kind === 'process') {
        host.querySelector('.av-counter').textContent =
          `${Math.min(data.count, data.total)} / ${data.total}`;
        host.querySelector('.av-state').textContent = data.decision
          ? 'Choose the next path'
          : data.playing
            ? 'Following the process'
            : 'Playback paused';
        const positions = new Map(data.steps.map(s => [s.id, s]));
        for (const n of host.querySelectorAll('.av-node')) {
          const step = positions.get(n.dataset.node);
          if (step) n.setAttribute('transform', 'translate(' + step.x + ',' + step.y + ')');
          n.dataset.active = String(n.dataset.node === data.active);
          n.dataset.selected = String(n.dataset.node === options.selectedNode);
          n.dataset.type = step?.type || '';
          n.dataset.stacked = String(!!step?.stackParent);
          if (options.interactive && !n.hasAttribute('tabindex')) {
            n.setAttribute('tabindex', '0');
            n.setAttribute('role', 'button');
            n.setAttribute('aria-label', 'Explain ' + (step?.title || 'step'));
          }
          if (options.interactive && !n.querySelector('.pc-ports')) {
            const ports = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            ports.setAttribute('class', 'pc-ports');
            ports.innerHTML =
              '<circle data-pc-port="in" data-pc-step="' +
              esc(n.dataset.node) +
              '" cx="0" cy="50" r="9"/><circle data-pc-port="out" data-pc-step="' +
              esc(n.dataset.node) +
              '" cx="210" cy="50" r="9"/>';
            n.append(ports);
          }
        }
        for (const edge of host.querySelectorAll('.av-edge')) {
          const a = positions.get(edge.dataset.from),
            b = positions.get(edge.dataset.to);
          if (!a || !b) continue;
          const k = Math.max(70, Math.abs(b.x - a.x - 210) * 0.45);
          edge
            .querySelector('path')
            .setAttribute(
              'd',
              'M' +
                (a.x + 210) +
                ',' +
                (a.y + 50) +
                'C' +
                (a.x + 210 + k) +
                ',' +
                (a.y + 50) +
                ' ' +
                (b.x - k) +
                ',' +
                (b.y + 50) +
                ' ' +
                b.x +
                ',' +
                (b.y + 50)
            );
          const label = edge.querySelector('text');
          if (label) {
            label.setAttribute('x', (a.x + 210 + b.x) / 2);
            label.setAttribute('y', (a.y + b.y) / 2 + 35);
          }
        }
        const noteLayer = host.querySelector('.pc-graph-annotations');
        const key = JSON.stringify([
          data.annotations,
          data.steps.map(s => [s.id, s.x, s.y]),
          options.canvasSelection,
          options.interactive,
        ]);
        if (noteLayer && key !== annotationKey) {
          annotationKey = key;
          noteLayer.innerHTML =
            root.WorkHubProcessCanvasArt?.svg(data, options.canvasSelection, options.interactive) ||
            '';
        }
        for (const e of host.querySelectorAll('.av-edge'))
          e.dataset.active = String(
            e.dataset.from === data.active && e.dataset.to === data.next && !data.decision
          );
        camera = cameraFor(data, options);
        host
          .querySelector('.av-graph')
          .setAttribute('viewBox', [camera.x, camera.y, camera.width, camera.height].join(' '));
      } else if (data.kind === 'break') {
        host.querySelector('.av-clock').textContent = clock(data.seconds);
        host.querySelector('.av-break-status').textContent =
          data.seconds === 0
            ? data.completeMessage
            : data.paused
              ? 'Countdown paused'
              : 'Until we resume';
      }
      const svg = host.querySelector('.av-annotations');
      // All marks are bounded numeric points with a validated colour, never markup.
      const valid = marks
        .slice(0, 100)
        .filter(
          m =>
            ['pen', 'arrow', 'text'].includes(m.type) &&
            /^#[0-9a-f]{6}$/i.test(m.color) &&
            Number.isFinite(m.width) &&
            (m.type !== 'text' ||
              (typeof m.text === 'string' &&
                m.text.trim().length > 0 &&
                m.text.length <= 240 &&
                Number.isFinite(m.fontSize))) &&
            Array.isArray(m.points) &&
            m.points.length > 0 &&
            m.points.length <= 300 &&
            m.points.every(
              p =>
                Array.isArray(p) &&
                p.length === 2 &&
                p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
            )
        );
      const markKey = JSON.stringify([valid, options.selected]);
      if (markKey !== markSignature) {
        markSignature = markKey;
        svg.innerHTML = valid
          .map((m, index) => {
            const points = m.points.map(([x, y]) => [x * 1000, y * 562.5]);
            let selection = '';
            if (options.selected === index) {
              const b =
                m.type === 'text'
                  ? textBox(m)
                  : {
                      x: Math.min(...points.map(p => p[0])) - 8,
                      y: Math.min(...points.map(p => p[1])) - 8,
                      width:
                        Math.max(...points.map(p => p[0])) -
                        Math.min(...points.map(p => p[0])) +
                        16,
                      height:
                        Math.max(...points.map(p => p[1])) -
                        Math.min(...points.map(p => p[1])) +
                        16,
                    };
              selection =
                '<rect class="av-selection" x="' +
                (b.x - 4) +
                '" y="' +
                (b.y - 4) +
                '" width="' +
                (b.width + 8) +
                '" height="' +
                (b.height + 8) +
                '" rx="6" fill="none" stroke="#186fdb" stroke-width="2" stroke-dasharray="5 4"/>';
            }
            if (m.type === 'text') {
              const { x, y, width: boxWidth, height: boxHeight, size, rows: shown } = textBox(m);
              return `<g class="av-text-note"><title>${esc(m.text)}</title><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="8" fill="#16382e" fill-opacity=".94"/><text x="${x + 12}" y="${y + size + 6}" fill="${m.color}" font-size="${size}" font-family="system-ui,sans-serif">${shown.map((line, i) => `<tspan x="${x + 12}" dy="${i ? size * 1.25 : 0}">${esc(line)}</tspan>`).join('')}</text>${selection}</g>`;
            }
            if (points.length < 2) return '';
            const line = `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${m.color}" stroke-width="${Math.max(1, Math.min(12, m.width))}" stroke-linecap="round" stroke-linejoin="round"/>`;
            if (m.type !== 'arrow') return line + selection;
            const [a, b] = [points[0], points.at(-1)],
              angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
              size = 16;
            return (
              line +
              selection +
              `<path d="M${b[0] - size * Math.cos(angle - 0.5)},${b[1] - size * Math.sin(angle - 0.5)} L${b.join(',')} L${b[0] - size * Math.cos(angle + 0.5)},${b[1] - size * Math.sin(angle + 0.5)}" fill="none" stroke="${m.color}" stroke-width="${Math.max(1, Math.min(12, m.width))}" stroke-linecap="round"/>`
            );
          })
          .join('');
      }
      stop();
      draw(received);
    }
    document.addEventListener('visibilitychange', stop);
    return {
      update,
      pointer,
      camera: () => (camera ? { ...camera } : null),
      destroy() {
        disposed = true;
        stop();
        document.removeEventListener('visibilitychange', stop);
        host.replaceChildren();
      },
    };
  }
  root.WorkHubAudienceView = { create, textBox, moveMark, hitMark, cameraFor, graphPoint };
})(window);
