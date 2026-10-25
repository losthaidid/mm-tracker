/** Morning, afternoon and night, account-seeded outfits and finite, in-place hobbies. No movement or network. */
(function (root) {
  'use strict';
  const OUTFITS = [
    ['hoodie', 'Cloud hoodie'],
    ['varsity', 'Varsity jacket'],
    ['cable', 'Cable-knit jumper'],
    ['denim', 'Denim jacket'],
    ['quilt', 'Quilted vest'],
    ['raincoat', 'Raincoat'],
    ['bomber', 'Flight jacket'],
    ['cardigan', 'Pocket cardigan'],
    ['sailor', 'Sailor shirt'],
    ['blazer', 'Weekend blazer'],
    ['sport', 'Track jacket'],
    ['polo', 'Colour-block polo'],
    ['kimono', 'Festival jacket'],
    ['overalls', 'Denim overalls'],
    ['artist', 'Painter’s apron'],
    ['gardener', 'Garden apron'],
    ['tunic', 'Linen tunic'],
    ['winter', 'Winter parka'],
    ['rugby', 'Rugby shirt'],
    ['striped', 'Striped knit'],
    ['waistcoat', 'Sunday waistcoat'],
    ['festival', 'Patchwork jacket'],
    ['highcollar', 'High-collar knit'],
    ['pyjamas', 'Starry pyjamas'],
    ['pyjamas-moon', 'Crescent moon pyjamas'],
    ['pyjamas-cloud', 'Sleepy cloud pyjamas'],
    ['pyjamas-stripe', 'Bedtime stripe pyjamas'],
    ['pyjamas-check', 'Cosy check pyjamas'],
    ['pyjamas-dot', 'Polka-dot pyjamas'],
    ['pyjamas-comet', 'Dream comet pyjamas'],
    ['pyjamas-leaf', 'Soft fern pyjamas'],
  ];
  const PALETTES = [
    ['mint', 'Mint tide', '#85b5a5', '#e8edce'],
    ['rose', 'Rosewood', '#b8798a', '#f2d8c3'],
    ['indigo', 'Indigo dusk', '#526a9d', '#d7e0f0'],
    ['ochre', 'Golden hour', '#c79e4e', '#f3e2b1'],
    ['teal', 'Deep lagoon', '#408b91', '#c8e7df'],
    ['plum', 'Blackberry', '#887297', '#e5cce8'],
    ['coral', 'Apricot', '#d28e79', '#fae2b9'],
    ['olive', 'Olive grove', '#829363', '#e9e1bd'],
    ['slate', 'Storm blue', '#65788a', '#d9e1e4'],
    ['cream', 'Oat milk', '#d4bd99', '#fff1d5'],
    ['cherry', 'Cherry jam', '#b95c68', '#f7d9d1'],
    ['sky', 'Blue sky', '#79a9c7', '#e3eff2'],
  ];
  const ACCESSORIES = [
    ['daily', 'Daily surprise'],
    ['none', 'None'],
    ['glasses', 'Review glasses'],
    ['roundglasses', 'Round glasses'],
    ['sunglasses', 'Sunset shades'],
    ['helmet', 'Project helmet'],
    ['party', 'Party hat'],
    ['beanie', 'Ribbed beanie'],
    ['beret', 'Artist beret'],
    ['cap', 'Baseball cap'],
    ['bucket', 'Bucket hat'],
    ['tophat', 'Tiny top hat'],
    ['chef', 'Baker’s hat'],
    ['explorer', 'Explorer hat'],
    ['crown', 'Golden crown'],
    ['flowercrown', 'Flower crown'],
    ['earmuffs', 'Winter earmuffs'],
    ['headphones', 'Music headphones'],
    ['headband', 'Sports headband'],
    ['starglasses', 'Star glasses'],
    ['aviator', 'Aviator goggles'],
    ['visor', 'Sun visor'],
    ['pirate', 'Pirate hat'],
    ['sailor', 'Sailor cap'],
    ['cowboy', 'Cowboy hat'],
    ['wizard', 'Wizard hat'],
    ['knight', 'Knight’s helmet'],
    ['monocle', 'Monocle'],
    ['bow', 'Hair bow'],
    ['hairclip', 'Star hairclip'],
    ['leaf', 'Little leaf'],
    ['antenna', 'Space antennae'],
    ['wintercap', 'Snow cap'],
    ['graduation', 'Graduation cap'],
    ['headlamp', 'Explorer headlamp'],
  ];
  const HOBBIES = [
    ['reading', 'Read a chapter', '▤'],
    ['painting', 'Paint little skies', '✎'],
    ['gardening', 'Water a plant', '♧'],
    ['music', 'Play ukulele', '♫'],
    ['tea', 'Make a cup of tea', '☕'],
    ['photography', 'Practice photography', '▣'],
    ['astronomy', 'Watch the stars', '✦'],
    ['puzzles', 'Solve a puzzle', '◇'],
    ['origami', 'Fold paper cranes', '⌁'],
    ['knitting', 'Knit a scarf', '∞'],
    ['baking', 'Bake little cookies', '○'],
    ['chess', 'Think through chess', '♟'],
  ];
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function hash(s) {
    let h = 2166136261;
    for (const c of String(s)) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function day(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }
  function look(p, owner, date = new Date()) {
    const hour = date.getHours(),
      period = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 19 ? 'afternoon' : 'night';
    // A night belongs to the date on which it started, including after midnight.
    const n = day(date) - (hour < 6 ? 1 : 0),
      night = period === 'night';
    const daytime = OUTFITS.filter(x => !x[0].startsWith('pyjamas'));
    const sleepwear = OUTFITS.filter(x => x[0].startsWith('pyjamas'));
    const slot = n * 2 + (period === 'afternoon' ? 1 : 0);
    const nightCombo = ((n + hash(owner + 'night')) * 37) % (sleepwear.length * PALETTES.length);
    const outfit =
      p.outfit === 'daily'
        ? night
          ? sleepwear[Math.floor(nightCombo / PALETTES.length)][0]
          : daytime[((slot + hash(owner)) * 7) % daytime.length][0]
        : p.outfit || 'hoodie';
    const paletteIndex = night
      ? nightCombo % PALETTES.length
      : ((slot + hash(owner + 'palette')) * 5) % PALETTES.length;
    const palette =
      PALETTES.find(
        x => x[0] === (p.outfitPalette === 'daily' ? PALETTES[paletteIndex][0] : p.outfitPalette)
      ) || PALETTES[0];
    const choices = ACCESSORIES.filter(x => !['daily', 'none'].includes(x[0]));
    const accessory =
      p.accessory === 'daily'
        ? night
          ? 'none'
          : choices[((slot + hash(owner + 'accessory')) * 17) % choices.length][0]
        : p.accessory;
    return {
      outfit,
      palette,
      accessory,
      period,
      key: [n, period, outfit, palette[0], accessory].join('|'),
      label: (OUTFITS.find(x => x[0] === outfit)?.[1] || 'Cloud hoodie') + ' · ' + palette[1],
    };
  }
  function validate(p) {
    if (
      !['daily', ...OUTFITS.map(x => x[0])].includes(p.outfit) ||
      !['daily', ...PALETTES.map(x => x[0])].includes(p.outfitPalette) ||
      !ACCESSORIES.some(x => x[0] === p.accessory) ||
      typeof p.hobbies !== 'boolean'
    )
      throw Error('Check companion wardrobe and hobbies.');
  }
  function cloth(kind) {
    const line = 'stroke="var(--momo-trim)" stroke-width="1.2" fill="none" stroke-linecap="round"';
    const motifs = {
      hoodie: `<path d="M51 79q18 18 38 0l-4 10H56Z" fill="var(--momo-trim)"/><path d="M62 86v13m15-13v13m-20 6h26l-4 7H61Z" ${line}/>`,
      varsity: `<path d="M65 79v34h12V79Z" fill="var(--momo-trim)"/><path d="M55 95h8v8h-8Z" fill="var(--momo-trim)"/><path d="M49 110h42M50 107h40" ${line}/>`,
      cable: `<path d="M52 78q18 10 36 0v7q-18 8-36 0Z" fill="var(--momo-trim)"/>${[58, 70, 82].map(x => `<path d="M${x} 88q-5 4 0 8t0 8t0 8" ${line}/>`).join('')}`,
      denim: `<path d="m63 79 7 13 8-13M70 92v21m-19-20h12v9H51Zm26 0h12v9H77Z" ${line}/><path d="M51 97h12m14 0h12" ${line}/>`,
      quilt: `<path d="M62 79v33h16V79" fill="var(--momo-trim)"/><path d="m47 89 16 9-16 9m46-18-16 9 16 9M70 79v34" ${line}/>`,
      raincoat: `<path d="M49 79q21 10 42 0l-8 11H57Z" fill="var(--momo-trim)"/><path d="M70 86v27m-19-9h12m14 0h12" ${line}/><circle cx="74" cy="96" r="1.3" fill="var(--momo-trim)"/>`,
      bomber: `<path d="M59 79q11 6 22 0m-30 30h38m-38-4h38m-19-21v29" ${line}/><path d="M53 92h6v10h-6Z" fill="var(--momo-trim)"/>`,
      cardigan: `<path d="m61 79 9 18 9-18M70 96v17m-19-12h12v9H51Zm26 0h12v9H77Z" ${line}/>`,
      sailor: `<path d="m50 79 20 18 20-18-10 2-10 9-10-9Z" fill="var(--momo-trim)"/><path d="m69 95-4 12 5-3 5 3-4-12" fill="var(--momo-trim)"/>`,
      blazer: `<path d="m61 79-6 12 11 13 4-9 4 9 11-13-6-12M70 96v17m9-13h9" ${line}/><circle cx="74" cy="108" r="1" fill="var(--momo-trim)"/>`,
      sport: `<path d="M47 83h46v7H47Z" fill="var(--momo-trim)"/><path d="M70 79v34m-23-7 13-6m33 6-13-6" ${line}/>`,
      polo: `<path d="M47 96h46v17H47Z" fill="var(--momo-trim)"/><path d="m61 79 3 9 6-4 6 4 3-9M70 84v10" ${line}/>`,
      kimono: `<path d="m55 79 27 32M85 79l-24 32" ${line}/><path d="M47 103h46v7H47Z" fill="var(--momo-trim)"/>`,
      overalls: `<path d="M53 79h5v17h24V79h5v34H53Z" fill="var(--momo-trim)"/><path d="M60 98h20v11H60Z" ${line}/>`,
      artist: `<path d="m58 80 4 13h16l4-13m-23 12-5 21h32l-5-21" fill="var(--momo-trim)"/><path d="m64 99 2 8m5-9-1 9m7-7-3 7" stroke="var(--momo-cloth)" stroke-width="2"/>`,
      gardener: `<path d="m58 80 4 13h16l4-13m-23 12-5 21h32l-5-21" fill="var(--momo-trim)"/><path d="M64 107h12m-7 0v-8m0 4q-6-6-5-3m5 2 5-4" stroke="var(--momo-cloth)" fill="none"/>`,
      tunic: `<path d="m65 79 5 9 5-9M70 88v12m-20 9h40" ${line}/>`,
      winter: `<path d="M50 79q20 13 40 0l-4 12H54Z" fill="var(--momo-trim)"/><path d="M70 90v23m-21-17h42m-42 7h42m-40 6h38" ${line}/>`,
      rugby: `<path d="M47 87h46v7H47Zm0 14h46v7H47Z" fill="var(--momo-trim)"/><path d="m61 79 4 8 5-4 5 4 4-8" ${line}/>`,
      striped: `${[87, 94, 101, 108].map(y => `<path d="M48 ${y}h44" ${line}/>`).join('')}<path d="M59 79q11 9 22 0" ${line}/>`,
      waistcoat: `<path d="m59 79 11 19 11-19-1 34-10-5-10 5Z" fill="var(--momo-trim)"/><path d="M70 98v10" stroke="var(--momo-cloth)"/>`,
      festival: `<path d="M48 83h17v13H48Zm27 13h17v14H75Z" fill="var(--momo-trim)"/><path d="m66 81 7 9m-7 5 7 9m-7 1 7 7m-23-11 9 9m18-27 10 9" ${line}/>`,
      highcollar: `<path d="M59 78h22v10H59Z" fill="var(--momo-trim)"/><path d="M51 93h38m-38 5h38m-38 5h38m-38 5h38" ${line}/>`,
      pyjamas: `${[
        [56, 91],
        [80, 96],
        [65, 108],
      ]
        .map(
          ([x, y]) =>
            `<path d="m${x} ${y - 4} 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="var(--momo-trim)"/>`
        )
        .join('')}<path d="M70 82v31" ${line}/>`,
    };
    const dots = [
      [56, 91],
      [80, 96],
      [65, 108],
    ];
    const sleepMotifs = {
      'pyjamas-moon': dots
        .map(
          ([x, y]) =>
            `<path d="M${x + 3} ${y - 4}a5 5 0 1 0 0 8 4 4 0 0 1 0-8" fill="var(--momo-trim)"/>`
        )
        .join(''),
      'pyjamas-cloud': dots
        .map(
          ([x, y]) => `<path d="M${x - 5} ${y}q-2-5 2-5 4-5 6 0 5 0 3 5Z" fill="var(--momo-trim)"/>`
        )
        .join(''),
      'pyjamas-stripe': [86, 94, 102, 110].map(y => `<path d="M49 ${y}h42" ${line}/>`).join(''),
      'pyjamas-check': `<path d="M57 84v29m13-29v29m13-29v29m-34-22h42m-42 9h42m-42 9h42" ${line}/>`,
      'pyjamas-dot': dots
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="var(--momo-trim)"/>`)
        .join(''),
      'pyjamas-comet': dots
        .map(
          ([x, y]) =>
            `<path d="m${x - 4} ${y - 4} 6 6m-3-9 6 6" ${line}/><circle cx="${x + 3}" cy="${y + 3}" r="2.5" fill="var(--momo-trim)"/>`
        )
        .join(''),
      'pyjamas-leaf': dots
        .map(
          ([x, y]) => `<path d="M${x - 4} ${y + 4}q-3-10 8-8 2 10-8 8" fill="var(--momo-trim)"/>`
        )
        .join(''),
    };
    if (sleepMotifs[kind]) motifs[kind] = sleepMotifs[kind] + `<path d="M70 82v31" ${line}/>`;
    return `<path d="M51 77q19 8 38 0l6 9-3 27H48l-3-27Z" fill="url(#momo-fabric)" stroke="var(--momo-cloth-edge)" stroke-width=".7"/>${motifs[kind] || motifs.hoodie}`;
  }
  function sleeve(side) {
    return `<path d="${side === 'left' ? 'M49 79q-6 0-8 8l-2 18q-1 9 5 12l7-2 2-23 3-10Z' : 'M91 79q6 0 8 8l2 18q1 9-5 12l-7-2-2-23-3-10Z'}" fill="url(#momo-fabric)" stroke="var(--momo-cloth-edge)" stroke-width=".6"/><path d="${side === 'left' ? 'm41 110 9 2' : 'm90 112 9-2'}" stroke="var(--momo-trim)" stroke-width="2"/>`;
  }
  const PROP = {
    reading:
      '<path d="M53 107q8-4 17 0 9-4 17 0v15q-9-4-17 0-9-4-17 0Z" fill="#eeddb9" stroke="#8f7961"/><path d="M70 108v13m-13-10 9 1m8 0 9-1m-26 5 9 1m8 0 9-1" stroke="#a79573"/>',
    painting:
      '<ellipse cx="72" cy="115" rx="18" ry="9" fill="#d7b784"/><circle cx="61" cy="114" r="2.6" fill="#cc8891"/><circle cx="69" cy="110" r="2.5" fill="#72a299"/><circle cx="79" cy="111" r="2.5" fill="#e6c46d"/><path class="mh-tool" d="m82 105 9-15" stroke="#9a7452" stroke-width="2"/>',
    gardening:
      '<path d="M60 114h22l-4 13H64Z" fill="#be8b6e"/><path class="mh-sprout" d="M71 114V99q-13 1-10-8 12 0 10 12m0 0q1-12 11-11 3 10-11 11" fill="#83a875" stroke="#4f7c62"/>',
    music:
      '<g transform="rotate(-22 73 111)"><ellipse cx="69" cy="116" rx="12" ry="15" fill="#bd9369" stroke="#8d6753"/><circle cx="69" cy="113" r="4" fill="#624d44"/><path d="M67 110V88h5v22" fill="#af825c"/><path d="M68 88v39m2-39v39" stroke="#f1e2be" stroke-width=".5"/></g><text class="mh-note" x="94" y="103" fill="#8e7baf" font-size="13">♪</text>',
    tea: '<path d="M61 109h21v12q-10 8-21 0Z" fill="#ecdbbd" stroke="#a49075"/><path d="M82 111q12 0 2 9M57 126h30" fill="none" stroke="#a49075"/><path class="mh-steam" d="M67 104q-5-5 0-10m8 10q5-5 0-10" fill="none" stroke="#d3c3ae"/>',
    photography:
      '<rect x="55" y="104" width="33" height="22" rx="4" fill="#7b8995" stroke="#455b69"/><circle cx="72" cy="115" r="8" fill="#bddad8" stroke="#456879"/><circle cx="72" cy="115" r="4" fill="#587a8e"/><path d="M60 104v-4h9v4" fill="#657986"/>',
    astronomy:
      '<path class="mh-tool" d="m62 106 26-13 5 10-26 13Z" fill="#a9c2ca" stroke="#597d8c"/><path d="m73 112-9 17m9-17 9 17" stroke="#8b9fa4"/><path class="mh-note" d="m96 84 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#e2c976"/>',
    puzzles:
      '<rect x="56" y="104" width="29" height="22" rx="3" fill="#d9c79c"/><path d="M66 104v8q7-4 7 0v14m-17-12h11q-3 6 2 6h16" stroke="#987e68" fill="none"/>',
    origami:
      '<path class="mh-tool" d="m53 119 15-16 9 4 14-9-8 19-16 9Z" fill="#c2acd6" stroke="#88709e"/><path d="m68 103-1 23 10-19 6 10" fill="none" stroke="#ece0f2"/>',
    knitting:
      '<ellipse cx="71" cy="116" rx="14" ry="10" fill="#cb8d9c"/><path d="m58 112 25 7m-23-11 21 7m-18-10 15 5m-19 10 19 4" stroke="#e9bdc5"/><path class="mh-tool" d="m59 98 25 26m0-26-25 26" stroke="#a58e70" stroke-width="1.5"/>',
    baking:
      '<ellipse cx="72" cy="120" rx="20" ry="5" fill="#c7d4cd"/><g class="mh-tool" fill="#d3aa71" stroke="#a68053"><circle cx="63" cy="116" r="6"/><circle cx="77" cy="117" r="6"/></g><path d="m61 113 4 3m10-1 4 3" stroke="#805c42"/>',
    chess:
      '<path d="M54 111h35v15H54Z" fill="#d2bd96"/><path d="M54 116h35m-26-5v15m9-15v15m9-15v15" stroke="#9c8467"/><path class="mh-tool" d="m70 118 2-10h-3l6-9 4 2-2 7 2 10Z" fill="#56736f"/>',
  };
  function apply(p, owner) {
    const pet = document.getElementById('hubPet'),
      art = pet?.querySelector('.momo-anime-art');
    if (!art) return;
    const current = look(p, owner);
    if (art.dataset.wardrobe === current.key) return;
    art.dataset.wardrobe = current.key;
    pet.style.setProperty('--momo-cloth', current.palette[2]);
    pet.style.setProperty('--momo-trim', current.palette[3]);
    pet.style.setProperty('--momo-cloth-edge', current.palette[2]);
    pet.dataset.outfit = current.outfit;
    pet.dataset.accessory = current.accessory;
    const outfit = art.querySelector('#hubPetOutfit');
    if (outfit) outfit.innerHTML = cloth(current.outfit);
    for (const side of ['left', 'right']) {
      const arm = art.querySelector('.momo-arm-' + side);
      let layer = arm?.querySelector('.momo-sleeve-overlay');
      if (arm && !layer) {
        layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        layer.classList.add('momo-sleeve-overlay');
        arm.append(layer);
      }
      if (layer) layer.innerHTML = sleeve(side);
    }
    const acc = art.querySelector('#hubPetAccessory');
    if (acc) acc.innerHTML = root.WorkHubMomoArt.accessory(current.accessory);
    art.setAttribute('aria-label', (p.mascotName || 'Momo') + ', wearing ' + current.label);
  }
  function fields(p) {
    const select = (name, label, rows, value) =>
      `<label>${label}<select name="${name}">${rows.map(([id, text]) => `<option value="${id}"${value === id ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
    return (
      select(
        'outfit',
        'Wardrobe',
        [['daily', 'Automatic · morning, afternoon & night'], ...OUTFITS],
        p.outfit
      ) +
      select(
        'outfitPalette',
        'Outfit colours',
        [['daily', 'Daily surprise'], ...PALETTES],
        p.outfitPalette
      )
    );
  }
  function install(a) {
    let active = null,
      next = Date.now() + 80000,
      owner = '',
      lastHobby = -1;
    const pet = () => document.getElementById('hubPet');
    function finish() {
      if (!active) return;
      active = null;
      pet()?.querySelector('.momo-hobby-prop')?.remove();
      pet()?.removeAttribute('data-hobby');
      a.life()?.scene(null);
      next = Date.now() + 90000 + Math.random() * 90000;
    }
    function safe() {
      return (
        a.ready() &&
        a.prefs().mascot &&
        !document.hidden &&
        !document.body.matches(
          '.hub-private,.hub-present,.hub-focus,.rest-room-open,.presentation-break-open,.lab-drag-active'
        ) &&
        !document.querySelector('dialog[open]') &&
        !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
      );
    }
    function play(kind, auto = false) {
      if (
        auto &&
        (!a.prefs().hobbies ||
          a.prefs().motion === 'off' ||
          root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      )
        return false;
      if (!safe() || a.life()?.sleeping()) return false;
      if (active) finish();
      if (
        !a.life()?.sceneAvailable() ||
        a.life()?.hobbyAvailable?.() === false ||
        (auto && a.life()?.busy())
      )
        return false;
      const hobby = HOBBIES.find(x => x[0] === kind);
      if (!hobby) return false;
      const body = pet()?.querySelector('.pet-body');
      if (!body) return false;
      a.life().scene({ pose: 'hobby', expression: 'content' });
      active = { kind, until: Date.now() + 12000 };
      pet().dataset.hobby = kind;
      const prop = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      prop.classList.add('momo-hobby-prop');
      prop.innerHTML = PROP[kind];
      body.append(prop);
      if (!auto) a.tell((a.prefs().mascotName || 'Momo') + ' · ' + hobby[1]);
      return true;
    }
    function mount() {
      const current = a.ready() ? a.owner() : '';
      if (current !== owner) {
        finish();
        owner = current;
        next = Date.now() + 80000;
      }
      if (owner) apply(a.prefs(), owner);
    }
    function tick() {
      mount();
      if (active) {
        if (
          !safe() ||
          a.life()?.sleeping() ||
          Date.now() >= active.until ||
          !pet()?.querySelector('.momo-hobby-prop')
        )
          finish();
        return;
      }
      if (Date.now() < next || !safe()) return;
      next = Date.now() + 90000 + Math.random() * 90000;
      let n = Math.floor(Math.random() * HOBBIES.length);
      if (n === lastHobby) n = (n + 1) % HOBBIES.length;
      lastHobby = n;
      play(HOBBIES[n][0], true);
    }
    function gallery() {
      mount();
      if (!owner) return;
      const current = look(a.prefs(), owner);
      a.openModal(
        'Wardrobe & hobbies',
        `<section class="momo-wardrobe-gallery"><span class="hub-kicker">A LITTLE LIFE OF HIS OWN</span><h3>${esc(current.label)}</h3><p>Automatic wardrobe changes at 6 am, noon and 7 pm using your device’s local time. Morning and afternoon have different outfits; night brings one of 8 pajama designs in 12 colours, with a different design each night. The night outfit stays through midnight until 6 am. Choose Automatic in Appearance, or keep a fixed outfit. Headphones are optional.</p><button type="button" data-momo-style="appearance">Choose outfit & accessories</button><h3>His hobby shelf</h3><p>Try a quiet, in-place activity. Automatic hobbies wait while you work, type, focus or present, and never wake a requested nap.</p><div class="momo-hobby-grid">${HOBBIES.map(([id, label, icon]) => `<button type="button" data-momo-style="hobby" data-kind="${id}"><span aria-hidden="true">${icon}</span>${esc(label)}</button>`).join('')}</div></section>`
      );
    }
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-momo-style]');
      if (!b) return;
      if (b.dataset.momoStyle === 'gallery') gallery();
      else if (b.dataset.momoStyle === 'appearance') {
        finish();
        a.closeModal();
        a.appearance();
      } else if (b.dataset.momoStyle === 'hobby') {
        const kind = b.dataset.kind;
        a.closeModal();
        if (!play(kind))
          a.tell(
            'Show your companion and give him a quiet moment first. A requested nap ends only when you click him.'
          );
      }
    });
    document.addEventListener(
      'pointerdown',
      event => {
        if (active && event.target.closest?.('#hubPet,[data-momo],[data-adventure]')) finish();
      },
      { capture: true, passive: true }
    );
    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' ||
        (event.target.closest?.('#hubPet') && event.key.startsWith('Arrow'))
      )
        finish();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) finish();
    });
    root.addEventListener('pagehide', finish);
    return {
      mount,
      tick,
      gallery,
      play,
      finish,
      snapshot: () => ({
        active: active?.kind || null,
        look: owner ? look(a.prefs(), owner) : null,
      }),
    };
  }
  root.WorkHubMomoWardrobe = {
    OUTFITS,
    PALETTES,
    ACCESSORIES,
    HOBBIES,
    look,
    validate,
    apply,
    fields,
    install,
  };
})(window);
