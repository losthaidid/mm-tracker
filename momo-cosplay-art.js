/** Rig-attached cosplay: original Momo artwork stays in place underneath each removable layer. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const line =
    'fill="none" stroke="var(--momo-trim)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"';
  const cloth =
    'fill="url(#momo-fabric)" stroke="var(--momo-cloth-edge)" stroke-width=".7" stroke-linejoin="round"';
  const trim = 'fill="var(--momo-trim)"';
  function garment(kind) {
    const base = `<path d="M51 77q19 8 38 0l6 9-3 27H48l-3-27Z" ${cloth}/>`;
    const panel = {
      vest: `<path d="m62 78 8 8 8-8-2 35H64Z" fill="#f1c5a6"/><path d="M63 82v29m14-29v29" ${line}/><circle cx="59" cy="96" r="1" ${trim}/>`,
      robe: `<path d="M50 79 89 120H46l4-41Zm40 0-39 41h43Z" ${cloth}/><path d="m53 79 32 34m2-34-32 34" ${line}/><path d="M47 103h46v7H47Z" ${trim}/>`,
      suit: `<path d="m60 78 10 27 10-27-10 4Z" fill="#fff4df"/><path d="m60 79-5 12 12 13 3-7 3 7 12-13-5-12M70 104v9" ${line}/><path d="m69 84-2 11 3 4 3-4-2-11Z" ${trim}/>`,
      chef: `<path d="m62 78 18 13-17 22M49 104h42" ${line}/>${[91, 99, 107].map(y => `<circle cx="66" cy="${y}" r="1" ${trim}/><circle cx="78" cy="${y}" r="1" ${trim}/>`).join('')}`,
      jacket: `<path d="m61 78 9 16 9-16M70 94v19m-20-15h12v9H50Zm28 0h12v9H78Z" ${line}/><path d="M47 109h46v4H47Z" ${trim}/>`,
      tunic: `<path d="M49 107h42l3 13H46Z" ${cloth}/><path d="m65 79 5 10 5-10m-5 10v12M48 108h44" ${line}/><path d="M48 104h44v4H48Z" ${trim}/>`,
      uniform: `<path d="m60 79 10 12 10-12M70 91v22m-19-17h12v8H51Zm26 0h12v8H77Z" ${line}/>${[96, 103, 110].map(y => `<circle cx="73" cy="${y}" r="1" ${trim}/>`).join('')}`,
      gi: `<path d="m55 78 21 22 9-22-15 9Z" ${trim}/><path d="m57 79 24 26m2-26-24 26" ${line}/><path d="M47 102h46v7H47Z" ${trim}/><path d="m71 108 3 14 6-2-5-12Z" ${trim}/>`,
      dress: `<path d="M51 99h38l11 28H40Z" ${cloth}/><path d="M50 102h40v5H50Z" ${trim}/><path d="m54 110-5 14m12-13-2 14m20-14 2 14m5-15 5 14" ${line}/><path d="m62 79 8 9 8-9" ${line}/>`,
      hoodie: `<path d="M51 79q19 22 38 0l-7 13H58Z" ${trim}/><path d="M63 89v12m14-12v12m-21 5h28l-5 7H61Z" ${line}/>`,
      armor: `<path d="m50 81 20 6 20-6 3 20-23 13-23-13Z" ${trim}/><path d="m51 87 19 6 19-6M50 99h40M70 88v23m-12-8-2 6m26-6 2 6" fill="none" stroke="var(--momo-cloth)" stroke-width="2"/>`,
      overalls: `<path d="M53 78h6v15h22V78h6v35H53Z" ${trim}/><path d="M61 98h18v10H61Z" ${line}/><circle cx="57" cy="94" r="1.5" fill="var(--momo-cloth)"/><circle cx="83" cy="94" r="1.5" fill="var(--momo-cloth)"/>`,
      parka: `<path d="M48 80q22 15 44 0l-6 15H54Z" fill="#fff0dc"/><path d="M70 89v24m-20-14h14v9H50Zm26 0h14v9H76Z" ${line}/><path d="M48 111h44v5H48Z" fill="#fff0dc"/>`,
      sailor: `<path d="m49 79 21 19 21-19-12 2-9 10-9-10Z" ${trim}/><path d="m68 96-6 14 8-4 8 4-6-14Z" ${trim}/><path d="M48 111h44" ${line}/>`,
      apron: `<path d="m58 79 5 13h14l5-13-2 14 8 23H52l8-23Z" ${trim}/><path d="M61 101h18v9H61Z" fill="none" stroke="var(--momo-cloth)" stroke-width="1.3"/>`,
      shorts: `<path d="M48 100h44v13H48Z" ${trim}/><path d="m62 79 8 10 8-10m-8 10v8" ${line}/><path d="M52 86h7v9h-7Z" ${trim}/>`,
      cape: `<path d="m52 79 18 15 18-15M70 94v19" ${line}/><circle cx="70" cy="87" r="4" ${trim}/><path d="m62 101 8-4 8 4-8 8Z" ${trim}/>`,
      jersey: `<path d="m60 79 10 9 10-9M49 82v28m42-28v28" ${line}/><path d="M63 94h5v14h-5Zm10 0h6l-2 14h-5l3-10h-2Z" ${trim}/>`,
      gown: `<path d="M52 97h36l17 34H35Z" ${cloth}/><path d="M50 99h40v6H50Z" ${trim}/><path d="m55 107-9 20m18-20-3 23m15-23 3 23m6-23 9 20" ${line}/><circle cx="70" cy="88" r="4" ${trim}/>`,
      bodysuit: `<path d="m58 79 12 23 12-23m-12 23v11M47 93h46M51 109l12-7m26 7-12-7" ${line}/><circle cx="70" cy="92" r="4" ${trim}/>`,
      coat: `<path d="M51 78 70 85 89 78l9 48H76l-6-19-6 19H42Z" ${cloth}/><path d="m60 79-6 16 12 9m14-25 6 16-12 9M70 87v20m-19 6h10m18 0h10" ${line}/>`,
      poncho: `<path d="m53 77 17 7 17-7 17 35-34 11-34-11Z" ${cloth}/><path d="m41 105 29 9 29-9m-54-7 25 8 25-8m-25-14v22" ${line}/>${[44, 54, 64, 76, 86, 96].map(x => `<path d="m${x} 114 1 8" ${line}/>`).join('')}`,
    };
    return `<g class="mc-garment mc-${kind}">${base}${panel[kind] || ''}</g>`;
  }
  function sleeve(kind, side) {
    const flip = side === 'right' ? 'translate(140 0) scale(-1 1)' : '';
    const bare = ['vest', 'shorts', 'dress', 'gown'].includes(kind);
    const short = ['gi', 'jersey', 'sailor', 'overalls', 'apron'].includes(kind);
    const shape = bare
      ? 'M49 79q-6 0-8 8l-1 6 11 1 3-12Z'
      : short
        ? 'M49 79q-7 0-9 9l-1 10 13 1 3-17Z'
        : ['robe', 'poncho'].includes(kind)
          ? 'M49 79q-8 1-10 10l-5 22 17 7 3-35Z'
          : 'M49 79q-6 0-8 8l-2 18q-1 9 5 12l7-2 2-23 3-10Z';
    const skin =
      bare || short
        ? '<path d="M49 79q-6 0-8 8l-2 18q-1 9 5 12l7-2 2-23 3-10Z" fill="url(#momo-skin)" stroke="#d3a68e" stroke-width=".4"/>'
        : '';
    return `<g transform="${flip}">${skin}<path d="${shape}" ${cloth}/><path d="${bare ? 'm40 90 12 2' : short ? 'm39 96 13 1' : 'm39 108 12 4'}" stroke="var(--momo-trim)" stroke-width="3"/></g>`;
  }
  function legs(outfit, side) {
    const x = side === 'left' ? 48 : 71;
    const short = ['shorts', 'vest', 'dress', 'gown', 'jersey'].includes(outfit.garment);
    const shoe = outfit.accessories.find(x =>
      ['sandals', 'boots', 'sneakers', 'dress-shoes'].includes(x)
    );
    return `<path d="M${x + 1} 110h20l-2 ${short ? 17 : 30}h-15Z" fill="var(--mc-pants)" stroke="var(--momo-cloth-edge)" stroke-width=".6"/>${short ? `<path d="M${x + 4} 127h14v15h-14Z" fill="#edc2aa"/>` : ''}<path d="M${x + 3} ${shoe === 'boots' ? 130 : 141}h15l3 ${shoe === 'boots' ? 19 : 8}q-10 5-22 0Z" fill="${shoe === 'sandals' ? '#9c633b' : shoe === 'sneakers' ? 'var(--momo-trim)' : '#394452'}" stroke="#46505a" stroke-width=".6"/>${shoe === 'sandals' ? `<path d="m${x + 4} 141 13 7m0-7-13 7" fill="none" stroke="#f0cb94" stroke-width="2"/>` : shoe === 'sneakers' ? `<path d="M${x + 5} 143h10m-10 3h10" stroke="#fff4df"/>` : ''}`;
  }
  function wig(color, soft = false) {
    return soft
      ? `<path d="M36 34Q25 19 40 10q0-18 17-14 13-15 26-3 20-7 22 12 16 5 6 23l-12 8-4-14-9 9-9-10-10 11-10-9-9 13Z" fill="${color}" stroke="#8d92a4" stroke-width=".7"/>`
      : `<path d="m35 38 2-22 9 4-3-20 16 9L65-13 76 5 92-8l-1 22 17-6-7 18 10 9-17 5-6-15-10 13-11-16-11 16-8-11-7 17Z" fill="${color}" stroke="#51546d" stroke-width=".7"/>`;
  }
  const hair = {
    'saiyan-hair': '#242c3e',
    'golden-hair': '#f8d45c',
    'blue-hair': '#57bfe8',
    'white-hair': '#f7f6f2',
    'green-hair': '#6dbe7d',
    'red-hair': '#bd555a',
    'pink-hair': '#efa8bc',
    'orange-hair': '#ed9a4c',
  };
  const headAliases = {
    'straw-hat': 'explorer',
    'chef-hat': 'chef',
    'wizard-hat': 'wizard',
    beanie: 'beanie',
    crown: 'crown',
    bow: 'bow',
    helmet: 'knight',
    cap: 'cap',
    'sailor-hat': 'sailor',
    'top-hat': 'tophat',
    glasses: 'glasses',
    sunglasses: 'sunglasses',
    goggles: 'aviator',
    'pilot-goggles': 'aviator',
  };
  function head(id, character) {
    if (character?.name === 'Usagi Tsukino' && id === 'golden-hair')
      return '<g fill="#edd38b" stroke="#b6a075" stroke-width=".7"><path d="M37 38Q29 2 69-2q42-1 34 41L91 27 78 40l-8-15-8 15-13-13Z"/><circle cx="39" cy="15" r="11"/><circle cx="101" cy="15" r="11"/><path d="M34 22Q20 49 27 107l10 6Q27 51 43 25m54 0q16 26 6 88l10-6q7-58-7-85"/></g>';
    if (character?.name === 'Sanji' && id === 'golden-hair')
      return '<path d="M34 40Q25 3 67-3q44-3 42 41L98 49l-9-18Q78 34 60 51l6-24-20 17-3-9Z" fill="#efd17b" stroke="#b69b62" stroke-width=".7"/>';
    if (character?.name === 'Roronoa Zoro' && id === 'green-hair')
      return '<path d="m34 39 0-15 6-12 5 5 5-13 8 8 8-15 7 13 10-12 5 15 12-6 5 17 0 17-10-9-9 4-9-9-10 9-9-5-10 11-7-9Z" fill="#7dbb83" stroke="#527865" stroke-width=".7"/>';
    if (character?.name === 'Monkey D. Luffy' && id === 'white-hair') return wig('#fff9ef', true);
    if (character?.name === 'Pikachu' && id === 'mouse-ears')
      return '<path d="M43 22Q19 8 19-18 41-13 55 13m30 0q14-26 36-31 0 26-24 40" fill="#efd36b" stroke="#b49b57"/><path d="M19-18q14 3 24 15L25 1q-6-10-6-19m102 0q-14 3-24 15l18 4q6-10 6-19" fill="#454650"/>';
    if (hair[id]) return wig(hair[id]);
    if (id === 'straw-hat')
      return '<g fill="#e9c777" stroke="#a67b47" stroke-width=".8"><path d="M44 20q0-27 26-27t26 27Z"/><ellipse cx="70" cy="24" rx="40" ry="7"/><path d="M44 12h52v9H44Z" fill="#c95c58"/><path d="M34 25h72M49 3l43 12" fill="none" opacity=".45"/></g>';
    if (headAliases[id]) return root.WorkHubMomoArt?.accessory(headAliases[id]) || '';
    const shapes = {
      'ninja-band':
        '<path d="M38 27q32-12 64 0v9q-33-10-64 0Z" fill="var(--momo-cloth)"/><rect x="54" y="25" width="31" height="12" rx="3" fill="#b8c7ca"/><path d="m65 29 9 4-6 2 1-7" fill="none" stroke="#536274"/>',
      'fox-ears':
        '<path d="m38 20-1-30 23 20m23 0 22-20-2 31" fill="#db965b" stroke="#9b674d" stroke-width="2"/><path d="m42 13-1-14 12 10m37 0 11-10-2 15" fill="#fff0dd"/>',
      'cat-ears':
        '<path d="m38 22 2-29 22 20m19 0 21-20 1 30" fill="var(--momo-cloth)" stroke="#56536e"/><path d="m43 14 1-13 11 11m34 0 9-11v13" fill="#edb6b6"/>',
      'bunny-ears':
        '<path d="M45 17Q24-26 40-31q16-1 18 43m23 0q4-45 19-42 14 6-6 47" fill="#f3e5de" stroke="#a29197"/><path d="M47 9Q33-21 41-24m47 32q5-31 10-31" fill="none" stroke="#e8b3bb" stroke-width="5"/>',
      'bear-ears':
        '<g fill="var(--momo-cloth)" stroke="#886c69"><circle cx="41" cy="13" r="13"/><circle cx="99" cy="13" r="13"/></g><g fill="var(--momo-trim)"><circle cx="41" cy="13" r="7"/><circle cx="99" cy="13" r="7"/></g>',
      'mouse-ears':
        '<g fill="#343b48" stroke="#232d3b"><circle cx="37" cy="8" r="18"/><circle cx="103" cy="8" r="18"/></g>',
      antlers:
        '<path d="M43 23 32 5 24-3m9 11-16-1m14-3 3-16m63 35 11-18 8-8m-9 11 16-1m-14-3-3-16" fill="none" stroke="#aa7957" stroke-width="5" stroke-linecap="round"/>',
      'deer-hat':
        '<path d="M39 22Q37-7 70-7t31 29v10H39Z" fill="#d996a7" stroke="#955c79"/><path d="m61 6 18 15m0-15L61 21" stroke="#fff1e4" stroke-width="5"/>',
      tiara:
        '<path d="m43 26 8-13 9 8L70 3l10 18 10-8 8 13-28 6Z" fill="#efd37a" stroke="#a99156"/><circle cx="70" cy="21" r="4" fill="#e69ab7"/>',
      flower:
        '<g transform="translate(94 19)" fill="#f5b6c7" stroke="#c57e9f"><circle cy="-7" r="5"/><circle cx="7" r="5"/><circle cy="7" r="5"/><circle cx="-7" r="5"/><circle r="4" fill="#f5d67d"/></g>',
      horns:
        '<path d="M39 23Q21 6 30-11q3 19 21 22m38 0q18-3 21-22 9 17-9 34" fill="#e9ddba" stroke="#b9a784"/>',
      braid:
        '<path d="M91 27q15 12 7 29t0 30" fill="none" stroke="#b89463" stroke-width="10"/><path d="m94 37 8 4m-7 6 8 4m-8 6 7 4m-8 6 7 4m-7 6 6 4" stroke="#dec28a" stroke-width="2"/>',
      'long-hair':
        '<path d="M37 40Q25-5 69-6q46-1 36 48l6 38-15-3-7-43-11-13-16 12-11-4-4 48-17 3Z" fill="var(--momo-trim)" stroke="#77738a"/>',
      hood: '<path d="M31 50Q20-9 70-9q50 0 39 59l-12-11Q98 11 70 9T43 39Z" fill="var(--momo-cloth)" stroke="var(--momo-trim)" stroke-width="3"/>',
      'space-helmet':
        '<ellipse cx="70" cy="39" rx="48" ry="49" fill="#bdd8e7" fill-opacity=".14" stroke="#b7d2e1" stroke-width="3"/><path d="M38 11q-11 14-10 28" fill="none" stroke="#fff5df" stroke-width="3"/><path d="M43 78h54" stroke="#8c9bad" stroke-width="6"/>',
      'feather-hat':
        '<path d="m43 21 9-28 34 3 11 26-54 2Z" fill="var(--momo-cloth)" stroke="#667064"/><ellipse cx="70" cy="25" rx="36" ry="5" fill="var(--momo-cloth)"/><path d="M89 20Q84-15 106-22q6 24-17 42Z" fill="var(--momo-trim)"/>',
      'eye-mask':
        '<path d="M45 47q12-7 25 0 13-7 26 0l-6 15-20-4-19 4Z" fill="var(--momo-cloth)"/><ellipse cx="58" cy="53" rx="6" ry="3" fill="#fff2df"/><ellipse cx="82" cy="53" rx="6" ry="3" fill="#fff2df"/>',
      blindfold:
        '<path d="M39 45q32-6 63 0v14q-30-4-63 0Z" fill="#333c50"/><path d="m100 48 14-4-7 12 9 5-16-5" fill="#333c50"/>',
      earrings:
        '<g fill="none" stroke="#e3bd67" stroke-width="2"><circle cx="38" cy="58" r="4"/><circle cx="103" cy="58" r="4"/></g>',
    };
    return shapes[id] || '';
  }
  function chest(id) {
    const shapes = {
      necklace:
        '<path d="M55 78q15 23 30 0" fill="none" stroke="#e8c879" stroke-width="1.4"/><circle cx="70" cy="93" r="3" fill="#75babc"/>',
      scarf:
        '<path d="M49 77q21 11 42 0l-3 10q-20 5-36-1Z" fill="var(--momo-trim)"/><path d="m79 85 9 26 8-4-9-25Z" fill="var(--momo-trim)"/>',
      tie: '<path d="m66 82 4-3 4 3-2 4 4 16-6 5-6-5 4-16Z" fill="var(--momo-trim)" stroke="#737180" stroke-width=".5"/>',
      'bow-tie':
        '<path d="m69 84-10-6v13l10-5 11 5V78Z" fill="var(--momo-trim)"/><circle cx="70" cy="85" r="3" fill="var(--momo-cloth)"/>',
      badge:
        '<path d="m56 90 6-3 6 3v9l-6 5-6-5Z" fill="#d9c176" stroke="#8e8b65"/><path d="m59 94 2 4 4-6" fill="none" stroke="#586780"/>',
      star: '<path d="m70 88 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="var(--momo-trim)"/>',
      'leaf-symbol':
        '<path d="M64 95q9-12 14-1t-11 7q-9-3-4-9m4 0 2 6m7-7 5-4" fill="none" stroke="var(--momo-trim)" stroke-width="1.6"/>',
      lightning: '<path d="m72 86-9 13h7l-2 12 11-16h-7l4-9Z" fill="#f5d577"/>',
      moon: '<path d="M76 89a10 10 0 1 0 0 17q-14-3 0-17Z" fill="#f4d78c"/>',
      'pocket-watch':
        '<path d="M82 91q11 11 3 19" fill="none" stroke="#d3bd76"/><circle cx="84" cy="99" r="5" fill="#f7e5b1" stroke="#a59162"/><path d="M84 95v4l3 1" fill="none" stroke="#747083"/>',
      bell: '<path d="M59 79q11 7 22 0" fill="none" stroke="#c57875" stroke-width="3"/><circle cx="70" cy="87" r="5" fill="#e8c26b" stroke="#997c51"/><path d="M66 87h8m-4 0v4" stroke="#997c51"/>',
      sash: '<path d="m51 79 42 27-3 9-43-30Z" fill="var(--momo-trim)"/><path d="M48 106h44v7H48Z" fill="var(--momo-trim)"/>',
      armband:
        '<path d="M49 84h9v10h-9Z" fill="var(--momo-trim)"/><circle cx="53.5" cy="89" r="2" fill="var(--momo-cloth)"/>',
    };
    return shapes[id] || '';
  }
  function back(id) {
    const shapes = {
      cape: '<path d="M48 78q22 8 44 0l17 61q-20-6-39 3-19-9-39-3Z" fill="var(--momo-cloth)" stroke="var(--momo-trim)" stroke-width="1.2"/><path d="m49 93-8 38m50-38 8 38" fill="none" stroke="var(--momo-trim)" opacity=".5"/>',
      backpack:
        '<rect x="35" y="82" width="70" height="47" rx="14" fill="var(--momo-trim)" stroke="#737e83"/><path d="M40 93h60m-59 11h11m37 0h11" stroke="#737e83"/>',
      gourd:
        '<path d="M96 83q-15-16-1-22 17-7 17 10 0 6-6 13 27 21 4 42-22 10-26-9-1-17 12-34Z" fill="#bc9768" stroke="#806b54"/><path d="m88 99 25 3m-19-20 13 2" stroke="#8c645a" stroke-width="3"/>',
      wings:
        '<path d="M50 88Q18 51 12 80q-5 18 28 40l12-14m38-18q32-37 38-8 5 18-28 40l-12-14" fill="var(--momo-trim)" stroke="#9ba8bc"/><path d="m21 83 26 22m72-22-26 22M28 97l14 10m70-10-14 10" stroke="#fff1df" stroke-width="2"/>',
      tail: '<path d="M88 119q30 5 26-20-6-17-17-5" fill="none" stroke="var(--momo-trim)" stroke-width="10" stroke-linecap="round"/>',
      jetpack:
        '<g fill="#a6b9c8" stroke="#64798d"><rect x="32" y="85" width="16" height="45" rx="7"/><rect x="92" y="85" width="16" height="45" rx="7"/></g><path d="m36 131 4 14 4-14m52 0 4 14 4-14" fill="#f1ba78"/>',
      shell:
        '<ellipse cx="70" cy="104" rx="36" ry="30" fill="#8eaa75" stroke="#506d61" stroke-width="3"/><path d="m70 78-17 17 7 24h20l7-24Zm-17 17-17-4m24 28-14 11m34-11 14 11m-7-35 17-4M70 78v-5" fill="none" stroke="#506d61" stroke-width="2"/>',
      quiver:
        '<path d="m36 87 14-7 26 49-14 7Z" fill="#9c795d" stroke="#6c5a53"/><path d="M41 88 29 66m17 18L35 61m16 20L41 58" stroke="#dfd7b7" stroke-width="2"/>',
    };
    return shapes[id] || '';
  }
  function hand(id) {
    const shapes = {
      sword:
        '<path d="m-2-5-2-45 4-7 4 7L2-5Z" fill="#dae8ed" stroke="#6d889b"/><path d="M-8-5H8M0-4V9" stroke="#b49a5e" stroke-width="3"/>',
      katana:
        '<path d="M-1-5Q-7-37 4-58L8-61Q-2-31 2-5Z" fill="#e8edf0" stroke="#728496"/><path d="m-8-5 15-2M0-4 2 9" stroke="#70506d" stroke-width="3"/>',
      kunai:
        '<path d="m0-29-5 12 5 10 5-10Z" fill="#6f7e91" stroke="#465367"/><path d="M0-7V5" stroke="#717f8c" stroke-width="3"/><circle cy="8" r="3" fill="none" stroke="#717f8c"/>',
      slingshot:
        '<path d="M0 6V-12q-12-1-10-17m10 17q12-1 10-17" fill="none" stroke="#ad805a" stroke-width="4"/><path d="m-10-29 10 11 10-11" fill="none" stroke="#cda17b"/>',
      staff:
        '<path d="M0 17v-68" stroke="#9e7f68" stroke-width="3"/><path d="M0-49q-13-7-6-14 11-10 15 1 1 10-7 9" fill="none" stroke="#9e7f68" stroke-width="3"/>',
      wand: '<path d="m0 5 3-29" stroke="#9577a1" stroke-width="3"/><path d="m4-39 3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1Z" fill="#f2cc7f" stroke="#b68a8a"/>',
      hammer:
        '<path d="M0 9v-37" stroke="#a58766" stroke-width="4"/><rect x="-14" y="-37" width="29" height="18" rx="3" fill="#c6d6da" stroke="#708898"/>',
      book: '<path d="M-13-15q7-5 13 0 6-5 13 0V7q-6-5-13 0-7-5-13 0Z" fill="#d7b590" stroke="#907665"/><path d="M0-15V7m-10-17 6-1m8 0 6 1m-20 5h6m8 0h6" stroke="#fff0da"/>',
      scroll:
        '<path d="M-12-19h24V6h-24Z" fill="#f3dfb3" stroke="#ac9870"/><path d="M-14-20h28m-28 27h28" stroke="#9f7c60" stroke-width="4"/><path d="M-7-12H7M-7-6H4m-11 5h14" stroke="#9c8e75"/>',
      camera:
        '<path d="M-14-14h28V5h-28Zm6-4h9v4h-9Z" fill="#687d8e" stroke="#465c73"/><circle cy="-4" r="7" fill="#b2d5e0" stroke="#dee6df" stroke-width="2"/>',
      microphone:
        '<path d="M0-1V10" stroke="#697e94" stroke-width="4"/><ellipse cy="-9" rx="7" ry="11" fill="#b3bacb" stroke="#68728a"/><path d="M-5-12H5M-5-7H5" stroke="#69768c"/>',
      'cooking-pan':
        '<path d="M0 9V-4" stroke="#64727c" stroke-width="4"/><circle cy="-16" r="13" fill="#637384" stroke="#c5ccd0" stroke-width="2"/><ellipse cy="-17" rx="8" ry="6" fill="#e9c97d"/>',
      flask:
        '<path d="M-4-25h8v10L13 2q3 7-5 7H-8q-8-2-5-7l9-17Z" fill="#c3e4dc" fill-opacity=".9" stroke="#7a9dad"/><path d="M-9-1h18l2 6h-22Z" fill="#91c1ac"/>',
      volleyball:
        '<circle cy="-5" r="14" fill="#f7e1aa" stroke="#7f8d9b"/><path d="M-13-10Q0-9 6 7m-3-26Q-5-4-10 3m24-6Q2-2-3-18" fill="none" stroke="#82a8c2" stroke-width="3"/>',
      basketball:
        '<circle cy="-5" r="14" fill="#cf9265" stroke="#6e6267"/><path d="M-14-5h28M0-19V9m-9-25q14 10 0 23M9-16Q-5-5 9 7" fill="none" stroke="#6e6267"/>',
      'capture-ball':
        '<circle cy="-4" r="11" fill="#faf0db" stroke="#69788a"/><path d="M-11-4a11 11 0 0 1 22 0Z" fill="#ce6d79"/><path d="M-11-4h22" stroke="#69788a"/><circle cy="-4" r="3.5" fill="#faf0db" stroke="#69788a"/>',
      candy:
        '<path d="m-7-12-7-5 1 12 6-2m14-5 7-5-1 12-6-2" fill="#edc273"/><rect x="-8" y="-15" width="16" height="13" rx="4" fill="#d9a5c5"/><path d="m-4-14 4 11m2-11 4 11" stroke="#fae1d0" stroke-width="2"/>',
      'honey-pot':
        '<path d="M-10-14h20l4 18q-14 9-28 0Z" fill="#d3a76b" stroke="#94714d"/><path d="M-11-11h22l-4 9-7-4-6 6Z" fill="#efcb70"/><path d="M-5-16H5" stroke="#94714d" stroke-width="4"/>',
      umbrella:
        '<path d="M0 12v-47" fill="none" stroke="#71849c" stroke-width="2"/><path d="M-23-30a23 20 0 0 1 46 0q-7-5-12 0-11-5-11 0-8-5-12 0-7-5-11 0Z" fill="var(--momo-trim)" stroke="#71849c"/>',
      paintbrush:
        '<path d="M0 9v-29" stroke="#b99a77" stroke-width="3"/><path d="M-4-20v-8l4-9 4 9v8Z" fill="#b785ab" stroke="#7b7188"/>',
      rose: '<path d="M0 8v-27m0 14q-11-9-10-1m10-6q9-8 9-1" fill="none" stroke="#80a37b" stroke-width="2"/><path d="M0-20q-13-4-7-13 7-7 12 0 9 7-5 13Z" fill="#d68c9e" stroke="#a76885"/><path d="M-4-29q8-4 7 4l-5 2Z" fill="#ecc0c2"/>',
      mittens:
        '<path d="M-5-7q-5-11-9-4-3 5 6 11-3 12 10 12 9 0 8-10l-1-12q-8-9-14 3Z" fill="var(--momo-trim)" stroke="#818596"/>',
      gauntlets:
        '<path d="M-9-16H9V5L4 11H-4l-5-6Z" fill="#a9bdc6" stroke="#637b8f"/><path d="M-9-9H9M-6 2H6" stroke="#d6e2de" stroke-width="2"/>',
      bracelet: '<ellipse cy="-8" rx="8" ry="3" fill="none" stroke="#e0bf70" stroke-width="3"/>',
      watch:
        '<path d="M-7-12H7v9H-7Z" fill="#4f7173"/><circle cy="-8" r="6" fill="#a8cc9b" stroke="#355766" stroke-width="2"/><path d="M-3-8h6m-3-3v6" stroke="#426e63"/>',
      claws:
        '<path d="m-5-7-1-23m6 23v-27m5 27 1-23" stroke="#b6cbd6" stroke-width="2.5" stroke-linecap="round"/>',
    };
    return shapes[id] || '';
  }
  function layer(parent, cls, markup, prepend = false) {
    if (!parent) return;
    let node = parent.querySelector(':scope > .' + cls);
    if (!node) {
      node = document.createElementNS(NS, 'g');
      node.classList.add('momo-cosplay-layer', cls);
      if (prepend) parent.prepend(node);
      else parent.append(node);
    }
    node.innerHTML = markup;
    return node;
  }
  function render(pet, current, name = 'Momo') {
    const art = pet?.querySelector('.momo-anime-art');
    if (!art || !current) return false;
    const { character, outfit, series, key } = current;
    if (art.dataset.cosplay === key) return true;
    clear(pet);
    art.dataset.cosplay = key;
    delete art.dataset.wardrobe;
    pet.dataset.cosplay = character.id;
    pet.dataset.cosplaySeries = series.id;
    pet.dataset.outfit = outfit.garment;
    pet.dataset.accessory = 'cosplay';
    for (const [prop, value] of Object.entries({
      '--momo-cloth': outfit.color,
      '--momo-cloth-edge': outfit.color,
      '--momo-trim': outfit.trim,
      '--mc-pants': outfit.pants,
    }))
      pet.style.setProperty(prop, value);
    const body = art.querySelector('.pet-body');
    const accessories = outfit.accessories;
    const backs =
      accessories.map(back).join('') +
      (['cape', 'coat'].includes(outfit.garment) && !accessories.includes('cape')
        ? back('cape')
        : '');
    layer(body, 'mc-back', backs, true);
    const outfitNode = art.querySelector('#hubPetOutfit');
    if (outfitNode)
      outfitNode.innerHTML = garment(outfit.garment) + accessories.map(chest).join('');
    for (const side of ['left', 'right']) {
      const arm = art.querySelector('.momo-arm-' + side);
      let sleeveNode = arm?.querySelector('.momo-sleeve-overlay');
      if (arm && !sleeveNode) {
        sleeveNode = document.createElementNS(NS, 'g');
        sleeveNode.classList.add('momo-sleeve-overlay');
        arm.append(sleeveNode);
      }
      if (sleeveNode) sleeveNode.innerHTML = sleeve(outfit.garment, side);
      layer(art.querySelector('.momo-foot-' + side), 'mc-leg', legs(outfit, side));
    }
    const hands = accessories.filter(id => hand(id));
    if (accessories.includes('triple-swords')) hands.splice(0, hands.length, 'katana', 'sword');
    for (const [i, id] of hands.entries()) {
      const side = i % 2 ? 'left' : 'right';
      const arm = art.querySelector('.momo-arm-' + side);
      const node = layer(arm, 'mc-hand-' + i, hand(id));
      if (node)
        node.setAttribute(
          'transform',
          `translate(${side === 'left' ? 44 : 96} 112)${side === 'left' ? ' rotate(-12)' : ' rotate(12)'}`
        );
    }
    const acc = art.querySelector('#hubPetAccessory');
    if (acc) {
      acc.innerHTML = `<g class="mc-base-head">${accessories
        .filter(x => hair[x] || ['long-hair', 'braid'].includes(x))
        .map(id => head(id, character))
        .join('')}${accessories
        .filter(x => !hair[x] && !['long-hair', 'braid'].includes(x))
        .map(id => head(id, character))
        .join('')}</g><g class="mc-transform-hair"></g>`;
      if (accessories.includes('triple-swords'))
        layer(
          acc,
          'mc-mouth-sword',
          '<g transform="translate(70 69) rotate(90)">' + hand('katana') + '</g>'
        );
    }
    const effects = layer(
      art,
      'mc-effects',
      `<ellipse class="mc-aura" cx="70" cy="85" rx="48" ry="64"/><g class="mc-steam"><path d="M35 109q-12-13 0-23t0-25m70 44q12-13 0-23t0-25m-42 4q-10-14 0-24"/></g><g class="mc-arcs"><path d="M18 62Q122 20 120 109M19 111Q23 35 117 61M29 137Q126 112 114 54"/></g><g class="mc-flame"><path d="M80 133q-12-18 0-29 0 9 7 10 7-20 11-21-4 20 5 25 10 14-6 23Z"/></g><g class="mc-sparks">${[
        [23, 42],
        [113, 39],
        [16, 110],
        [120, 120],
        [45, 15],
        [97, 12],
      ]
        .map(([x, y]) => `<path d="m${x} ${y} 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>`)
        .join(
          ''
        )}</g><g class="mc-clouds" fill="#f7f2ed"><ellipse cx="33" cy="91" rx="12" ry="6"/><ellipse cx="107" cy="83" rx="13" ry="7"/><ellipse cx="58" cy="134" rx="14" ry="5"/></g>`,
      true
    );
    effects?.setAttribute('aria-hidden', 'true');
    art.setAttribute(
      'aria-label',
      `${name}, ${character.name} cosplay from ${series.name}: ${outfit.label}`
    );
    return true;
  }
  function transform(pet, move) {
    pet?.querySelectorAll('.mc-routine-prop').forEach(n => n.remove());
    const node = pet?.querySelector('.mc-transform-hair');
    const color = {
      'super-saiyan': '#ffda62',
      'saiyan-blue': '#67c9ef',
      'ultra-instinct': '#e3e8f0',
      gear5: '#fff9ef',
    }[move];
    if (node) node.innerHTML = color ? wig(color, move === 'gear5') : '';
    if (move === 'three-sword' || (move === 'sword-flurry' && !pet?.querySelector('.mc-hand-0'))) {
      for (const side of move === 'three-sword' ? ['left', 'right'] : ['right']) {
        const prop = layer(
          pet?.querySelector('.momo-arm-' + side),
          'mc-routine-prop',
          hand('katana')
        );
        prop?.setAttribute('transform', `translate(${side === 'left' ? 44 : 96} 112)`);
      }
      if (move === 'three-sword')
        layer(
          pet?.querySelector('#hubPetAccessory'),
          'mc-routine-prop',
          '<g transform="translate(70 69) rotate(90)">' + hand('katana') + '</g>'
        );
    }
  }
  function clear(pet) {
    if (!pet) return;
    pet.querySelectorAll('.momo-cosplay-layer').forEach(n => n.remove());
    const art = pet.querySelector('.momo-anime-art');
    if (art?.dataset.cosplay) {
      delete art.dataset.cosplay;
      delete art.dataset.wardrobe;
    }
    for (const attr of [
      'data-cosplay',
      'data-cosplay-series',
      'data-cosplay-move',
      'data-cosplay-motion',
    ])
      pet.removeAttribute(attr);
    pet.style.removeProperty('--mc-pants');
  }
  root.WorkHubMomoCosplayArt = {
    garment,
    sleeve,
    legs,
    head,
    chest,
    back,
    hand,
    wig,
    render,
    transform,
    clear,
  };
})(window);
