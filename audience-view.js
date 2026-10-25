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
      disposed = false;
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
    function update(snapshot, marks = [], options = {}) {
      if (disposed) return;
      data = snapshot;
      received = root.performance.now();
      host.dataset.kind = data.kind;
      host.dataset.scene = data.scene || 'coast';
      host.dataset.reduced = String(!!data.reduced);
      host.dataset.playing = String(!!data.playing);
      host.style.setProperty('--av-text', Math.max(0.85, Math.min(1.4, options.textScale || 1)));
      const key = JSON.stringify([
        data.kind,
        data.title,
        data.steps,
        data.edges,
        data.detail,
        data.decision,
        data.message,
        data.scene,
        options.overview,
      ]);
      if (key !== signature) {
        signature = key;
        markSignature = '';
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
                  .join('')}</text></g>`
            )
            .join('');
          host.innerHTML = `<div class="av-content"><header class="av-header"><div><span class="av-kicker">PROCESS WALKTHROUGH</span><h1>${esc(data.title)}</h1></div><span class="av-counter"></span></header><div class="av-layout"><div class="av-map"><svg class="av-graph" viewBox="0 0 ${w} ${h}" aria-label="Process diagram">${edges}${nodes}<g class="av-token"><circle r="12"/><path d="M-4-5H4V5H-4Z"/></g></svg></div><aside class="av-detail"><span class="av-kicker">CURRENT STEP</span><h2>${esc(data.detail?.title || '')}</h2>${data.detail?.owner ? `<p class="av-owner">${esc(data.detail.owner)}</p>` : ''}<p>${esc(data.detail?.explanation || '')}</p>${data.detail?.expected ? `<div class="av-result"><span>EXPECTED RESULT</span><p>${esc(data.detail.expected)}</p></div>` : ''}${data.decision ? `<section class="av-question"><strong>${esc(data.decision.question)}</strong><ol>${data.decision.answers.map(a => `<li>${esc(a.label)}</li>`).join('')}</ol><small>Waiting for the presenter’s choice</small></section>` : ''}</aside></div><footer class="av-footer"><span class="av-state"></span><span>PROCESS HUB</span></footer></div><svg class="av-annotations" viewBox="0 0 1000 562.5" aria-hidden="true"></svg>`;
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
        for (const n of host.querySelectorAll('.av-node'))
          n.dataset.active = String(n.dataset.node === data.active);
        for (const e of host.querySelectorAll('.av-edge'))
          e.dataset.active = String(
            e.dataset.from === data.active && e.dataset.to === data.next && !data.decision
          );
        const active = data.steps.find(s => s.id === data.active);
        if (!options.overview && active)
          host
            .querySelector('.av-graph')
            .setAttribute(
              'viewBox',
              `${Math.max(0, active.x - 110)} ${Math.max(0, active.y - 130)} 850 450`
            );
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
            ['pen', 'arrow'].includes(m.type) &&
            /^#[0-9a-f]{6}$/i.test(m.color) &&
            Number.isFinite(m.width) &&
            m.points?.length <= 300 &&
            m.points.every(
              p =>
                Array.isArray(p) &&
                p.length === 2 &&
                p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
            )
        );
      const markKey = JSON.stringify(valid);
      if (markKey !== markSignature) {
        markSignature = markKey;
        svg.innerHTML = valid
          .map(m => {
            const points = m.points.map(([x, y]) => [x * 1000, y * 562.5]);
            if (points.length < 2) return '';
            const line = `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${m.color}" stroke-width="${Math.max(1, Math.min(12, m.width))}" stroke-linecap="round" stroke-linejoin="round"/>`;
            if (m.type !== 'arrow') return line;
            const [a, b] = [points[0], points.at(-1)],
              angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
              size = 16;
            return (
              line +
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
      destroy() {
        disposed = true;
        stop();
        document.removeEventListener('visibilitychange', stop);
        host.replaceChildren();
      },
    };
  }
  root.WorkHubAudienceView = { create };
})(window);
