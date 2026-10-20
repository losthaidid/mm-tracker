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
    FRIENDS,
  });
})(typeof window !== 'undefined' ? window : globalThis);
