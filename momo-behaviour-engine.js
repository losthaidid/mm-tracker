/**
 * Momo Batch B: small, pure calculations shared by the browser controllers.
 * Times are elapsed milliseconds. Positions use viewport pixels, never document scroll offsets.
 * This module has no timers, DOM changes, account writes or random values per animation frame.
 */
(function (root) {
  'use strict';
  const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
  const ease = n => {
    const q = clamp(n);
    return q * q * (3 - 2 * q);
  };
  const mix = (a, b, q) => ({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q });
  const FRIENDS = {
    butterfly: { name: 'Petal', role: 'companion', gift: 'flower' },
    bird: { name: 'Pip', role: 'gift', gift: 'flower' },
    firefly: { name: 'Glim', role: 'companion', gift: 'star' },
    bee: { name: 'Bumble', role: 'gift', gift: 'flower' },
    ladybird: { name: 'Dot', role: 'companion', gift: 'flower' },
    dragonfly: { name: 'Dash', role: 'rival', gift: 'star' },
    moth: { name: 'Velvet', role: 'companion', gift: 'star' },
    hummingbird: { name: 'Zip', role: 'rival', gift: 'flower' },
    owl: { name: 'Ollie', role: 'seat', gift: 'star' },
    bat: { name: 'Echo', role: 'companion', gift: 'star' },
    duck: { name: 'Waddle', role: 'seat', gift: 'flower' },
    sparrow: { name: 'Crumb', role: 'gift', gift: 'flower' },
    squirrel: { name: 'Nutmeg', role: 'gift', gift: 'acorn' },
    rabbit: { name: 'Clover', role: 'rival', gift: 'flower' },
    fox: { name: 'Rusty', role: 'rival', gift: 'acorn' },
    turtle: { name: 'Moss', role: 'gift', gift: 'leaf' },
    cat: { name: 'Miso', role: 'seat', gift: 'star' },
  };
  function path(points, q) {
    if (!points.length) return { x: 0, y: 0 };
    if (points.length === 1 || q >= 1) return { ...points[points.length - 1] };
    const p = clamp(q) * (points.length - 1),
      i = Math.floor(p);
    return mix(points[i], points[i + 1], ease(p - i));
  }
  function phase(ms, stops) {
    return stops.find(s => ms < s[1])?.[0] || stops[stops.length - 1][0];
  }
  function chase(ms) {
    const stage = phase(ms, [
      ['notice', 900],
      ['approach', 1800],
      ['chase', 7900],
      ['slow', 9400],
      ['recover', 11200],
    ]);
    return {
      stage,
      progress: clamp((ms - 1800) / 6100),
      approach: ease((ms - 900) / 900),
      recovery: ease((ms - 7900) / 1500),
    };
  }
  function tug(ms) {
    const stage = phase(ms, [
      ['check', 900],
      ['reach', 1700],
      ['tug', 3700],
      ['recoil', 4300],
      ['release', 5100],
      ['smile', 6100],
    ]);
    const stretch =
      stage === 'tug'
        ? Math.sin(clamp((ms - 1700) / 2000) * Math.PI) * 0.055
        : stage === 'recoil'
          ? -Math.sin(clamp((ms - 3700) / 600) * Math.PI) * 0.018
          : 0;
    return { stage, stretch, approach: ease(ms / 1300) };
  }
  function soccer(ms, count, size = 144) {
    const total = count * 650,
      time = clamp(ms, 0, total),
      kicks = Math.min(count, Math.floor(time / 650)),
      cycle = Math.min(count - 1, Math.floor(time / 650)),
      q = time === total ? 1 : (time % 650) / 650,
      awkward = cycle % 5 === 4,
      from = cycle % 2 ? 1 : -1,
      foot = size * 0.085,
      hop = q === 0 || q === 1 ? 0 : -4 * (awkward ? 76 : 62) * q * (1 - q);
    return {
      kicks,
      side: cycle % 2 ? 'right' : 'left',
      contact: time < total && q < 0.2,
      awkward: awkward && q < 0.38,
      hop,
      sway: from * foot * (1 - 2 * ease(q)),
      roll: (time / 650) * 170,
      lift: time < total && q < 0.2 ? Math.sin((q / 0.2) * Math.PI) * 9 : 0,
    };
  }
  const overlaps = (p, size, r, pad = 10) =>
    p.x < r.right + pad &&
    p.x + size > r.left - pad &&
    p.y < r.bottom + pad &&
    p.y + size > r.top - pad;
  /** Find the closest usable resting place, checking perimeter first and then a small grid. */
  function clearSpot(current, size, view, obstacles) {
    const left = view.x + 12,
      top = view.y + 12,
      right = Math.max(left, view.x + view.w - size - 12),
      bottom = Math.max(top, view.y + view.h - size - 12);
    const points = [];
    for (const x of [left, (left + right) / 2, right])
      for (const y of [top, (top + bottom) / 2, bottom]) points.push({ x, y });
    for (let i = 1; i < 5; i++)
      for (let j = 1; j < 4; j++)
        points.push({ x: left + ((right - left) * i) / 5, y: top + ((bottom - top) * j) / 4 });
    return (
      points
        .filter(p => !obstacles.some(r => overlaps(p, size, r)))
        .sort(
          (a, b) =>
            Math.hypot(a.x - current.x, a.y - current.y) -
            Math.hypot(b.x - current.x, b.y - current.y)
        )[0] || null
    );
  }
  /** Find the nearest position for a viewport overlay, including any space needed by its art. */
  function freePosition(point, { w, h }, view, obstacles) {
    const gap = 10,
      left = view.x + 12,
      top = view.y + 12,
      right = view.x + view.w - w - 12,
      bottom = view.y + view.h - h - 12;
    if (right < left || bottom < top || w <= 0 || h <= 0) return null;
    const x = clamp(point.x, left, right),
      y = clamp(point.y, top, bottom),
      blocked = (x, y) =>
        obstacles.some(
          r =>
            x > r.left - w - gap && x < r.right + gap && y > r.top - h - gap && y < r.bottom + gap
        );
    if (!blocked(x, y)) return { x, y };

    // The nearest free point lies against one or more obstacle edges.
    const xs = new Set([x, left, right]),
      ys = new Set([y, top, bottom]);
    for (const r of obstacles) {
      xs.add(clamp(r.left - w - gap, left, right)).add(clamp(r.right + gap, left, right));
      ys.add(clamp(r.top - h - gap, top, bottom)).add(clamp(r.bottom + gap, top, bottom));
    }
    let target = null,
      distance = Infinity;
    for (const x of xs) {
      for (const y of ys) {
        const d = Math.hypot(x - point.x, y - point.y);
        if (d < distance && !blocked(x, y)) {
          target = { x, y };
          distance = d;
        }
      }
    }
    return target;
  }
  /** Place a speech card beside its companion without covering visible workspace chrome. */
  function speechSpot(anchor, size, view, obstacles = []) {
    const width = Math.min(size.w, view.w - 24),
      blocked = [anchor, ...obstacles];
    // Keep longer messages scrollable when a small viewport cannot fit their full height.
    for (const height of [...new Set([size.h, Math.min(size.h, 92), Math.min(size.h, 56)])]) {
      const target = freePosition(
        {
          x: (anchor.left + anchor.right - width) / 2,
          y: (anchor.top + anchor.bottom - height) / 2,
        },
        { w: width, h: height },
        view,
        blocked
      );
      if (target) return { ...target, width, height };
    }
    return null;
  }
  root.WorkHubMomoBehaviourEngine = Object.freeze({
    clamp,
    ease,
    mix,
    path,
    phase,
    chase,
    tug,
    soccer,
    overlaps,
    clearSpot,
    freePosition,
    speechSpot,
    FRIENDS,
  });
})(typeof window !== 'undefined' ? window : globalThis);
