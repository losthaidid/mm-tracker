/** Small SVG figures for the existing vector landscape. Placement uses the landscape's viewBox. */
(function (root) {
  'use strict';

  const palette = {
    ink: '#263d38',
    skin: '#e7b384',
    linen: '#f5e4bc',
    wood: '#805946',
    red: '#ba6d56',
    blue: '#5d929f',
    moss: '#74916a',
    gold: '#f7d480',
    ripple: '#cee7d9',
  };
  const { ink, skin, linen, wood, red, blue, moss, gold, ripple } = palette;
  const stroke = (d, color = ink, width = 2) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
  const oval = (x, y, rx, ry, fill) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const circle = (x, y, r, fill) => oval(x, y, r, r, fill);
  const limb = (content, motion, pivot) =>
    `<g class="mv-figure-part" data-motion="${motion}" style="--mv-pivot:${pivot}">${content}</g>`;
  const place = (content, x, y, size = 1, face = 1) =>
    `<g transform="translate(${x} ${y}) scale(${size * face} ${size})">${content}</g>`;
  const shadow = oval(0, 0, 11, 2.3, '#263d3850');

  function wings(type) {
    const owl = type === 'owl';
    const bat = type === 'bat';
    const body = owl ? '#967456' : bat ? '#655570' : type === 'kingfisher' ? '#368c9e' : '#534e4c';
    const belly = owl ? '#d3b084' : type === 'kingfisher' ? '#dfa06a' : '#e2bd94';
    const wing = bat ? 'M0-2Q-8-9-21-11q6 5 6 12l5-2 4 4Z' : 'M0-3q-11-7-23-5 7 9 20 11Z';
    return (
      limb(
        path(wing, body) + place(path(wing, body), 0, 0, 1, -1),
        bat ? 'bats' : 'flap',
        '0px 0px'
      ) +
      oval(0, 0, owl ? 5 : 4, 4.9, body) +
      (owl
        ? path('M-4-4-5-9-1-6h2l4-3-1 5Z', body) +
          circle(-2, -2, 1.6, gold) +
          circle(2, -2, 1.6, gold) +
          path('M-1 0h2l-1 2Z', linen)
        : oval(1, 2, 2.7, 1.9, belly) + path('M3-1l5 1-5 1Z', gold))
    );
  }

  function duck(small = false) {
    const brown = small ? '#d4b170' : '#a27b5c';
    const wake = limb(stroke('M-19 1q6 2 15 0m-9 4q8 2 20-1', ripple, 1), 'ripple', '0px 0px');
    return (
      wake +
      path('M-10-2-13-9q7 3 12 2 6-3 10 0l3 4q-6 8-22 1Z', brown) +
      circle(7, small ? -7 : -10, small ? 4 : 5, small ? brown : '#437266') +
      path('M11-10l6 2-6 2Z', gold) +
      circle(8.5, -10.3, 0.85, ink) +
      stroke('M-8-3Q-2 1 5-3', linen, 1.3)
    );
  }

  function bird(type = 'robin') {
    const heron = type === 'heron';
    const color = heron ? '#9aaab0' : '#775b59';
    const legs = heron ? 'M0-9-3 0h4m2-9L5 0h4' : 'M-2-4-4 0h3m3-4 1 4h3';
    const neck = heron ? 'M3-11q5-6 2-14l5-3 3 3-4 4q5 7 0 11Z' : 'M1-9q1-8 8-6l4 4-6 1-2 5Z';
    return (
      shadow +
      stroke(legs, wood, 1.2) +
      oval(-1, heron ? -12 : -7, 8, 4, color) +
      limb(
        path(neck, color) +
          path(heron ? 'M12-27l10 1-10 2Z' : 'M11-13l5 2-5 1Z', gold) +
          circle(heron ? 10 : 9, heron ? -26 : -13, 0.9, ink),
        heron ? 'peck' : 'nod',
        '4px -10px'
      ) +
      path(
        heron ? 'M-10-13q7 1 12 2-5 5-14 0Z' : 'M1-11q4 2 5 5-3 3-6-1Z',
        heron ? '#6b7e87' : '#c67c61'
      )
    );
  }

  function smallAnimal(type) {
    const colors = {
      rabbit: ['#ba9779', '#e2c7a8'],
      squirrel: ['#a96648', '#dca07b'],
      cat: ['#c79163', '#eac897'],
      fox: ['#bd6e43', '#f3d8ad'],
      hedgehog: ['#775b4b', '#c99873'],
      frog: ['#799759', '#bac68a'],
      dog: ['#ad7a56', '#e8be91'],
      otter: ['#795744', '#c0997e'],
      mouse: ['#9b8182', '#e2bab5'],
    };
    const [body, belly] = colors[type];
    const tail = {
      squirrel: 'M-7-5q-19-5-14-18 5-7 11 1 5 6 0 11l5 4Z',
      fox: 'M-8-5q-19-8-25 0 9 7 24 3Z',
      cat: 'M-6-4q-14 1-14-9 0-5 4-3l-1 4q1 6 11 5Z',
      dog: 'M-7-6q-9 0-12-9 2-3 4 0 5 5 9 4Z',
      rabbit: 'M-7-5q-10-4-6-8 4-1 8 4Z',
      mouse: 'M-6-2q-7 5-13 1l1-1q7 3 11-3Z',
      otter: 'M-8-2q-15 0-22-5 12 1 20 0Z',
    }[type];
    const ears = {
      rabbit: 'M4-10q-5-11-2-13 3 0 6 10 1-10 4-8 2 4-1 12Z',
      fox: 'M5-9l1-8 5 5 4-4v8Z',
      cat: 'M4-8l1-9 5 6 4-5 1 8Z',
      dog: 'M4-11q-3-6 1-6 4 2 3 6Z',
      squirrel: 'M6-11l1-6 4 3 2-1v5Z',
      mouse: 'M6-6q-6-9 1-9 6 1 3 8Z',
    }[type];
    const long = ['fox', 'dog', 'otter'].includes(type);
    if (type === 'hedgehog')
      return (
        shadow +
        path('M-15-3l-2-5 3-1-1-5 6 1 2-4 5 2 4-3 3 4 4-1 3 7-1 5Z', body) +
        oval(10, -5, 6, 4, belly) +
        circle(14, -4, 1.2, ink) +
        circle(10, -7, 1, ink)
      );
    if (type === 'frog')
      return (
        shadow +
        oval(-1, -4, 10, 5, body) +
        circle(6, -8, 4, belly) +
        circle(7, -9, 1, ink) +
        stroke('M-7-3l-5 3h6m7-2 5 2h4', body, 2)
      );
    return (
      shadow +
      (tail ? limb(path(tail, body), 'tail', '-7px -5px') : '') +
      oval(-2, -6, long ? 12 : 8, long ? 5 : 5.7, body) +
      oval(8, long ? -9 : -8, 6, 4.6, body) +
      (ears ? path(ears, body) : '') +
      oval(11.5, -7, 4, 2.35, belly) +
      (type === 'cat' ? stroke('M10-6l7-2m-7 4h7', linen, 0.7) : '') +
      circle(10, -10, 1, ink) +
      circle(15, -7.7, 0.9, ink) +
      (type !== 'otter' ? stroke('M-7-3l-2 3h4M4-3l2 3h4', body, 2) : '')
    );
  }

  function deer(fawn = false) {
    const color = fawn ? '#b58a6f' : '#9d765b';
    return (
      shadow +
      oval(-5, -15, 14, 5.5, color) +
      stroke('M-13-14l-3 14m8-13-1 13m12-14 3 14m3-14 4 13', color, 2.2) +
      limb(
        stroke('M6-14l7-14', color, 5) +
          oval(16, -28, 6, 3.3, color) +
          path('M12-28l-2-7 5 3 4-3 1 4Z', color) +
          circle(18, -28, 0.9, ink),
        'graze',
        '6px -14px'
      ) +
      (fawn ? [-12, -7, -2].map(x => circle(x, -16, 1, linen)).join('') : '')
    );
  }

  function light(radius = 13) {
    return (
      oval(0, 0, radius, radius * 0.83, '#f6ce6e25') +
      oval(0, 0, radius * 0.6, radius * 0.49, '#ffdf8638')
    );
  }

  function person(motion, shirt = moss, seated = false) {
    const legs = seated ? 'M0-11l13 3L8 0h9m-11-8L4 0h7' : 'M-4-12-6 0h4m5-12 5 12h4';
    let arm = stroke('M2-24l7 8 5-2', shirt, 4) + circle(14, -18, 1.6, skin);
    const props = {
      water: path('M8-20h9l1 7H8Z', blue) + stroke('M14-20q5-4 6 2l-4 2m-8 0-5-4-3 1', blue, 1.8),
      sweep: stroke('M13-22 21 1', wood, 2) + path('M19-4l6 1 4 7h-9Z', gold),
      chop: stroke('M10-19 23-27', wood, 2) + path('M20-29l8-3 3 7-7 4Z', '#b0b6b4'),
      fishing: stroke('M14-18l17-10', wood, 1.6) + stroke('M31-28q12 4 10 23', linen, 0.75),
      laundry: path('M10-18l4-8 9 2-2 10-10 1Z', linen),
      feeder: stroke('M16-22v-9', wood, 1) + path('M11-26l6-5 6 5-2 1H13Zm3 1h6v7h-6Z', wood),
      gate: stroke('M10-19l9 1', wood, 2),
      herbs: path('M10-19h10l-2 8h-6Z', red) + stroke('M14-19v-9m0 7-4-4m4 3 4-5', moss, 1.8),
      bottle: path('M11-23h5v4l2 2v8h-8v-8l1-2Z', blue),
      berries: path('M9-18h12l-2 8h-8Z', wood) + stroke('M11-17q2-9 8 0', gold, 1.2),
      tea: path('M10-19h9l-2 6h-6Z', linen) + stroke('M17-18q7-1 3 3h-2', linen, 1.2),
      book: path('M9-18l4-5 8 3 4-3v7l-5 3-8-3-3 1Z', linen),
      lantern:
        stroke('M14-19v4', wood, 1.2) +
        place(light(12) + path('M-4-3 0-6l4 3v8h-8Z', wood) + path('M-2-2h4v5h-4Z', gold), 14, -10),
      kite: stroke('M13-18q8-13 38-39', linen, 0.7),
      basket: stroke('M11-16q4-12 9 0', gold, 1.2) + path('M10-16h12l-2 8h-8Z', wood),
      wood: stroke('M9-13l15-7m-14 4 16-8m-16 6 16-6', '#c19061', 3),
      paddle: stroke('M10-23 26 0', wood, 2) + path('M23-4l4-2 4 8-4 3Z', linen),
      shutters: stroke('M9-18l6-5', wood, 2),
      telescope: stroke('M10-23l6-3', wood, 2),
      stargaze: '',
    };
    if (motion === 'chop' || motion === 'sweep')
      arm = limb(arm + props[motion], motion, '2px -24px');
    else if (motion === 'fish') arm = limb(arm + props.fishing, 'cast', '2px -24px');
    else if (
      [
        'water',
        'laundry',
        'feeder',
        'gate',
        'curtains',
        'tea',
        'book',
        'paddle',
        'telescope',
      ].includes(motion)
    )
      arm = limb(
        arm + (motion === 'curtains' ? props.shutters : props[motion]),
        'reach',
        '2px -24px'
      );
    else arm += props[motion] || '';
    return (
      shadow +
      limb(stroke(legs, ink, 3.7), seated ? 'still' : 'step', '0px -12px') +
      path(seated ? 'M-5-25q6-3 11 3l2 12-14 1Z' : 'M-5-25q6-3 11 3l3 12h-15Z', shirt) +
      stroke('M-4-22l-3 10', shirt, 4) +
      circle(1, -31, 5.6, skin) +
      path('M-6-32q2-8 11-5 5 2 2 6l-3-3-6 1-2 4Z', wood) +
      stroke('M-8-34q9-3 16-1', motion === 'fishing' || motion === 'fish' ? linen : shirt, 2.6) +
      circle(5, -31, 0.65, ink) +
      arm
    );
  }

  const plants = (count = 3) =>
    Array.from({ length: count }, (_, i) =>
      place(
        stroke('M0 0v-10m0 6-3-3m3 4 4-5', '#668361', 1.1) +
          circle(0, -11, 2, [gold, '#e7aca0', linen][i % 3]),
        i * 7,
        0,
        1 - (i % 2) * 0.14
      )
    ).join('');

  function insect(type) {
    const glow = type === 'firefly' ? light(7) : '';
    const body = type === 'dragonfly' ? '#72b1ab' : type === 'moth' ? '#d4ad91' : gold;
    const wings =
      type === 'butterfly' || type === 'moth'
        ? path('M0 1q-10-10-12-3-1 7 12 6Zm0 0q10-10 12-3 1 7-12 6Z', body)
        : oval(-4, -2, 5, 2, linen) + oval(4, -2, 5, 2, linen);
    return (
      glow +
      limb(wings, 'flap', '0px 0px') +
      stroke('M0-4v8', body, 2) +
      (type === 'bee' ? stroke('M-3-1h6m-6 3h6', ink, 1) : '')
    );
  }

  const accents = {
    flowers: plants(),
    splash: limb(
      stroke('M-8 1q8 4 17 0m-14-5-3-4m6 3v-5m6 6 4-4', ripple, 1.35),
      'ripple',
      '0px 0px'
    ),
    drops: limb(stroke('M0 0l-2 3m5-2-1 4m4-2-1 3', ripple, 1.2), 'pour', '0px 0px'),
    stump:
      path('M-8 0l2-10H6L9 0Z', wood) +
      oval(0, -10, 6, 2.7, '#c58d59') +
      stroke('M-5-10q4 2 8 0', linen, 0.6),
    logPile: [
      [-8, -3],
      [1, -3],
      [10, -3],
      [-3, -8],
      [6, -8],
    ]
      .map(([x, y]) => place(oval(0, 0, 6, 3, wood) + circle(4, 0, 1.7, gold), x, y))
      .join(''),
    stone: path('M-9 0-5-6 0-7l8 3 2 4Z', '#88948c'),
    gate: stroke('M-10 0v-16m24 16v-16M-10-12l24 2m-24 6 24-1m-20-6v7m7-7v6m7-5v4', '#966f51', 2.4),
    clothes:
      stroke('M-22 0v-21m44 21v-21M-21-18Q0-13 21-18', wood, 1.3) +
      limb(path('M-14-17h11v9l-10 1Zm16 1 11-1 1 7-12 2Z', linen), 'reach', '0px -15px'),
    feeder:
      stroke('M0 0v-24m-1 0h10v4', wood, 2) +
      path('M4-18l5-5 5 5h-2v8H6v-8Z', '#c58d59') +
      circle(9, -15, 1.4, ink),
    telescope:
      stroke('M0-14 7 0m-7-14-6 14m6-14v14', wood, 1.8) +
      stroke('M-7-9 10-20', '#a6c8c2', 4) +
      stroke('M7-20l4 5', linen, 2),
    canoe:
      path('M-27-2q24 4 53-1-8 10-41 7-11-2-12-6Z', '#b87b54') +
      stroke('M-24-1q19 4 46 0', linen, 1.6) +
      stroke('M-29 6q23 5 48 0', ripple, 1.1),
    kite: limb(
      path('M0-7l7 5-5 9-8-8Z', red) + stroke('M0-7l2 14m-8-8 13-1M2 7q6 3 1 8', gold, 0.9),
      'flap',
      '0px 0px'
    ),
    berries: plants(5) + circle(3, -8, 1.5, red) + circle(10, -5, 1.5, red),
    curtains: limb(
      path('M-12-16q9 2 12 0l-3 17h-9Zm24 0q-9 2-12 0l3 17h9Z', '#db9373'),
      'curtain',
      '0px -16px'
    ),
    shootingStar:
      stroke('M-37 12 0 0', '#f4db9188', 1.6) +
      stroke('M-12 4 0 0', linen, 2) +
      circle(0, 0, 2, gold),
    cloud: path('M-46 6q13-13 26-9 9-22 30-8 15-6 23 5 18-2 25 10Z', '#81989899'),
    fish:
      oval(1, -3, 7, 3, '#a6c5b7') + path('M-4-3l-7-4v8Z', '#6d9d96') + circle(4.5, -4, 0.9, ink),
    lantern: light(16) + path('M-4-3 0-6l4 3v8h-8Z', wood) + circle(0, 0, 2.4, gold),
    window: light(19) + light(12) + path('M-5-6H5V5H-5Z', gold),
  };

  const sprites = {
    owl: () => wings('owl'),
    swallow: () => wings('swallow'),
    goose: () => wings('goose'),
    bat: () => wings('bat'),
    kingfisher: () => wings('kingfisher'),
    duck: () => duck(),
    duckling: () => duck(true),
    robin: () => bird(),
    heron: () => bird('heron'),
    deer: () => deer(),
    fawn: () => deer(true),
    person,
    ...Object.fromEntries(
      ['rabbit', 'squirrel', 'cat', 'fox', 'hedgehog', 'frog', 'dog', 'otter', 'mouse'].map(
        name => [name, () => smallAnimal(name)]
      )
    ),
    ...Object.fromEntries(
      ['firefly', 'dragonfly', 'moth', 'butterfly', 'bee'].map(name => [name, () => insect(name)])
    ),
    ...Object.fromEntries(Object.entries(accents).map(([name, art]) => [name, () => art])),
  };

  // Each frame mounts only the figures in the active moment.
  const figure = (kind, x, y, opts = {}) => {
    const { size = 1.18, face = 1, movement = '', dx = 0, dy = 0, delay = 0, args = [] } = opts;
    const art = sprites[kind](...args);
    const travel = movement
      ? `class="mv-figure" data-travel="${movement}" style="--mv-dx:${dx}px;--mv-dy:${dy}px;--mv-delay:${delay}s"`
      : '';
    return `<g transform="translate(${x} ${y})"><g ${travel}>${place(art, 0, 0, size, face)}</g></g>`;
  };

  const moving = (kind, x, y, movement, dx, dy = 0, size = 1.18, face = 1, delay = 0) =>
    figure(kind, x, y, { movement, dx, dy, size, face, delay });
  const human = (action, x, y, shirt, movingAcross = 0, seated = false, face = 1) =>
    figure('person', x, y, {
      args: [action, shirt, seated],
      size: 1.28,
      face,
      movement: movingAcross ? 'walk' : '',
      dx: movingAcross,
    });
  const flock = (kind, x, y, n, dx, dy, size = 0.85) =>
    Array.from({ length: n }, (_, i) =>
      moving(
        kind,
        x - i * 24,
        y + (i % 2 ? 9 : -3),
        'glide',
        dx,
        dy,
        size - i * 0.06,
        dx > 0 ? 1 : -1,
        i * -0.23
      )
    ).join('');
  const fishRipple = (x, y) => figure('splash', x, y, { size: 1 });
  const ducks = (x, y, n, young = false) =>
    [moving('duck', x, y, 'float', 50, 10)]
      .concat(
        Array.from({ length: n }, (_, i) =>
          moving(
            young ? 'duckling' : 'duck',
            x - 21 - i * 16,
            y + 4 + i * 5,
            'float',
            50,
            10,
            young ? 0.67 : 0.98,
            1,
            i * -0.3
          )
        )
      )
      .join('');
  const lights = (kind, x, y, n) =>
    Array.from({ length: n }, (_, i) =>
      moving(
        kind,
        x + i * 19,
        y + ((i * 7) % 20),
        'hover',
        (i % 2 ? 1 : -1) * 18,
        -13,
        kind === 'firefly' ? 0.68 : 0.58,
        1,
        i * -1.13
      )
    ).join('');
  const moment = (id, label, render, duration = 14) => ({ id, label, render, duration });

  const morning = [
    moment('dawn-owl', 'A dawn owl flies home', () =>
      moving('owl', 1115, 215, 'glide', -235, -75, 1.15, -1)
    ),
    moment('rabbit-meadow', 'A rabbit crosses the meadow', () =>
      moving('rabbit', 1152, 394, 'hop', -86, 21, 1.32, -1)
    ),
    moment(
      'water-flowers',
      'Someone waters the flowers',
      () =>
        human('water', 1090, 390, blue) + figure('flowers', 1100, 395) + figure('drops', 1102, 382)
    ),
    moment(
      'robin-bath',
      'A robin splashes in the shallows',
      () => figure('robin', 876, 401, { size: 1.22 }) + fishRipple(880, 403)
    ),
    moment(
      'kingfisher-dive',
      'A kingfisher dives for breakfast',
      () => moving('kingfisher', 827, 300, 'dive', 89, 87, 0.92) + fishRipple(918, 390)
    ),
    moment(
      'sweep-step',
      'Someone sweeps the front step',
      () => human('sweep', 1137, 365, red) + fishRipple(1164, 368)
    ),
    moment(
      'carry-wood',
      'Someone carries wood to the cabin',
      () => human('wood', 1070, 414, red, 54) + figure('logPile', 1168, 374)
    ),
    moment('ducklings', 'Ducklings follow their mother', () => ducks(961, 380, 3, true), 16),
    moment('squirrel-tree', 'A squirrel scampers up a tree', () =>
      moving('squirrel', 1199, 383, 'climb', 15, -63, 1.08)
    ),
    moment('morning-basket', 'Someone crosses the bridge with a basket', () =>
      human('basket', 1019, 356, blue, 67)
    ),
    moment('stretching-cat', 'A cat stretches at the doorstep', () =>
      moving('cat', 1165, 367, 'stretch', -8, 0, 1.13, -1)
    ),
    moment(
      'morning-bees',
      'Bees visit the blooms',
      () => figure('flowers', 1095, 419, { size: 1.4 }) + lights('bee', 1085, 394, 3)
    ),
    moment(
      'opening-shutters',
      'Someone opens the cabin shutters',
      () =>
        human('shutters', 1138, 366, moss, 0, false, -1) +
        figure('curtains', 1129, 335, { size: 0.55 })
    ),
    moment(
      'morning-frogs',
      'Frogs hop between river stones',
      () =>
        figure('stone', 856, 418) +
        figure('stone', 895, 422) +
        moving('frog', 856, 416, 'hop', 43, 4, 1.18)
    ),
    moment(
      'hang-feeder',
      'Someone hangs a bird feeder',
      () =>
        figure('feeder', 1074, 385) +
        human('feeder', 1056, 387, blue) +
        moving('robin', 1024, 362, 'glide', 49, -1, 0.64)
    ),
  ];

  const day = [
    moment(
      'split-wood',
      'Someone chops firewood',
      () =>
        human('chop', 1090, 399, red) + figure('stump', 1116, 399) + figure('logPile', 1142, 402)
    ),
    moment(
      'cast-a-line',
      'An angler casts into the river',
      () => human('fish', 1044, 414, moss, 0, true, -1) + fishRipple(993, 411)
    ),
    moment(
      'deer-drinks',
      'A deer drinks at the river',
      () => figure('deer', 1017, 398, { size: 1.32, face: -1 }) + fishRipple(992, 398)
    ),
    moment('afternoon-ducks', 'Ducks paddle downstream', () => ducks(1027, 420, 1), 17),
    moment(
      'skip-stones',
      'Someone skips stones',
      () =>
        human('fish', 862, 377, blue) +
        moving('stone', 881, 351, 'skip', 116, 53, 0.2) +
        fishRipple(955, 390) +
        fishRipple(988, 404)
    ),
    moment('dragonfly', 'A dragonfly hovers above the reeds', () =>
      moving('dragonfly', 1006, 384, 'hover', 56, -30, 1.23)
    ),
    moment(
      'read-under-tree',
      'Someone reads under a tree',
      () => human('book', 1172, 403, blue, 0, true) + figure('cat', 1200, 402, { size: 0.8 })
    ),
    moment(
      'hang-laundry',
      'Someone hangs laundry to dry',
      () => figure('clothes', 1089, 384) + human('laundry', 1067, 390, red)
    ),
    moment(
      'heron-shallows',
      'A heron stalks the shallows',
      () => moving('heron', 952, 371, 'walk', -35, 10, 1.22, -1) + fishRipple(923, 381)
    ),
    moment(
      'kite',
      'Someone flies a kite',
      () => human('kite', 1072, 409, moss) + moving('kite', 1137, 336, 'hover', 12, -9, 1.18)
    ),
    moment(
      'otter-roll',
      'An otter rolls in the river',
      () => moving('otter', 968, 425, 'roll', 70, 15, 1.15) + fishRipple(1022, 438)
    ),
    moment(
      'pick-berries',
      'Someone picks berries',
      () => figure('berries', 1118, 423, { size: 1.5 }) + human('berries', 1098, 423, red, 0, true)
    ),
    moment(
      'dog-butterfly',
      'A dog chases a butterfly',
      () =>
        moving('dog', 1065, 453, 'hop', 88, -28, 1.1) +
        moving('butterfly', 1101, 416, 'hover', 49, -15, 0.73)
    ),
    moment(
      'canoe',
      'A canoe drifts around the bend',
      () =>
        figure('canoe', 915, 399, { size: 1.15, movement: 'float', dx: 117, dy: 32 }) +
        figure('person', 910, 399, {
          size: 0.72,
          movement: 'float',
          dx: 117,
          dy: 32,
          args: ['paddle', red, true],
        }),
      18
    ),
    moment(
      'watch-current',
      'Someone watches the river',
      () => human('bottle', 1078, 429, blue, 0, false, -1) + fishRipple(1010, 423)
    ),
  ];

  const dusk = [
    moment(
      'windows-light',
      'Warm light fills the cabin windows',
      () =>
        moving('window', 1130, 335, 'kindle', 0, 0, 1) +
        moving('window', 1165, 335, 'kindle', 0, 0, 1, 1, 1)
    ),
    moment('dusk-lantern', 'Someone carries a lantern along the path', () =>
      human('lantern', 1078, 421, red, 62)
    ),
    moment('fox-trees', 'A fox slips past the trees', () =>
      moving('fox', 1190, 412, 'walk', -111, 23, 1.11, -1)
    ),
    moment(
      'bank-fireflies',
      'Fireflies blink along the bank',
      () => lights('firefly', 1030, 422, 6),
      16
    ),
    moment(
      'bring-laundry',
      'Someone brings the laundry inside',
      () => figure('clothes', 1083, 392) + human('laundry', 1085, 396, blue, 42)
    ),
    moment('swallows', 'Swallows sweep over the river', () =>
      flock('swallow', 914, 253, 4, 228, 42, 0.84)
    ),
    moment(
      'stack-firewood',
      'Someone stacks wood under the eaves',
      () => figure('logPile', 1168, 373) + human('wood', 1127, 378, red, 18)
    ),
    moment(
      'porch-tea',
      'Someone sips tea on the porch',
      () => human('tea', 1112, 371, blue, 0, true) + figure('cat', 1144, 370, { size: 0.72 })
    ),
    moment(
      'deer-and-fawn',
      'A deer and fawn cross the meadow',
      () =>
        moving('deer', 1169, 445, 'walk', -103, 22, 1.18, -1) +
        moving('fawn', 1203, 450, 'walk', -101, 21, 0.82, -1, -0.4)
    ),
    moment(
      'window-cat',
      'A cat curls up by the window',
      () =>
        moving('cat', 1163, 366, 'stretch', -5, 0, 1, -1) +
        figure('window', 1165, 335, { size: 0.56 })
    ),
    moment(
      'close-gate',
      'Someone closes the garden gate',
      () => figure('gate', 1097, 412) + human('gate', 1078, 416, blue)
    ),
    moment(
      'draw-curtains',
      'Someone draws the curtains',
      () =>
        figure('curtains', 1165, 341, { size: 0.52 }) +
        human('curtains', 1171, 370, blue, 0, false, -1)
    ),
    moment(
      'geese-to-roost',
      'Geese fly toward their roost',
      () => flock('goose', 1015, 153, 5, 192, 38, 0.94),
      17
    ),
    moment(
      'last-cast',
      'Someone checks the fishing line',
      () =>
        human('fish', 899, 371, red) +
        fishRipple(950, 373) +
        moving('lantern', 891, 370, 'kindle', 0, 0, 0.54)
    ),
    moment('carry-herbs', 'Someone brings herbs indoors', () =>
      human('herbs', 1097, 403, moss, 39)
    ),
  ];

  const night = [
    moment(
      'moon-owl',
      'An owl glides past the moon',
      () => moving('owl', 1204, 164, 'glide', -270, -58, 1.43, -1),
      16
    ),
    moment('hedgehog-door', 'A hedgehog snuffles by the doorstep', () =>
      moving('hedgehog', 1122, 374, 'walk', 62, 14, 1.2)
    ),
    moment('evening-bats', 'Bats skim above the river', () =>
      flock('bat', 1108, 237, 3, -187, 63, 0.92)
    ),
    moment(
      'telescope',
      'Someone looks through a telescope',
      () =>
        figure('telescope', 1084, 422, { size: 1.22 }) +
        human('telescope', 1069, 420, blue, 0, true)
    ),
    moment(
      'meteor',
      'A meteor streaks across the sky',
      () => moving('shootingStar', 1178, 56, 'shoot', -182, 91, 1, -1),
      9
    ),
    moment(
      'moth',
      'A moth circles the porch lamp',
      () =>
        figure('lantern', 1159, 332, { size: 0.8 }) +
        moving('moth', 1155, 338, 'hover', 18, -22, 0.76)
    ),
    moment(
      'night-frog',
      'A frog leaps off a riverside stone',
      () =>
        figure('stone', 851, 414) +
        moving('frog', 851, 410, 'hop', 72, 15, 1.35) +
        fishRipple(924, 426)
    ),
    moment('night-fox', 'A fox pauses at the water’s edge', () =>
      moving('fox', 1143, 402, 'creep', -91, 22, 1.2, -1)
    ),
    moment(
      'moonlit-fish',
      'A fish breaks the moonlit surface',
      () => moving('fish', 987, 429, 'leap', 40, 4, 1.23) + fishRipple(1019, 434)
    ),
    moment(
      'night-otter',
      'An otter slips into the river',
      () => moving('otter', 1040, 419, 'dive', -86, 9, 1.19, -1) + fishRipple(956, 430)
    ),
    moment(
      'woodpile-mouse',
      'A mouse scurries past the woodpile',
      () => figure('logPile', 1144, 381) + moving('mouse', 1150, 384, 'dash', -52, 6, 0.94, -1)
    ),
    moment('distant-lantern', 'A lantern passes behind the trees', () =>
      figure('person', 1179, 332, {
        size: 0.73,
        movement: 'creep',
        dx: -148,
        args: ['lantern', moss],
      })
    ),
    moment(
      'two-stargazers',
      'Two neighbours watch the stars',
      () =>
        human('stargaze', 1086, 434, blue, 0, true, -1) +
        human('tea', 1111, 438, red, 0, true, -1) +
        figure('lantern', 1129, 440, { size: 0.66 })
    ),
    moment('bridge-perch', 'A night bird perches on the bridge', () =>
      moving('owl', 1135, 255, 'perch', -77, 79, 0.88, -1)
    ),
    moment(
      'cloud-over-moon',
      'A cloud drifts across the moon',
      () => moving('cloud', 990, 116, 'glide', 155, 5, 1.05),
      18
    ),
  ];

  root.WorkHubMyDayScenes = { morning, day, dusk, night };
})(typeof window === 'undefined' ? globalThis : window);
