/* Original repeating motifs inspired by anime and cartoons. Only small preference values sync. */
(function (root) {
  'use strict';
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const TYPE = {
    impact: {
      label: 'Bold adventure',
      family: 'Impact,"Arial Black",sans-serif',
      weight: '700',
      spacing: '.035em',
      body: 'system',
    },
    comic: {
      label: 'Playful comic',
      family: '"Comic Sans MS","Chalkboard SE",cursive',
      weight: '700',
      spacing: '-.025em',
      body: 'rounded',
    },
    rounded: {
      label: 'Soft & rounded',
      family: '"Trebuchet MS","Arial Rounded MT Bold",sans-serif',
      weight: '800',
      spacing: '-.035em',
      body: 'rounded',
    },
    story: {
      label: 'Storybook serif',
      family: 'Georgia,"Times New Roman",serif',
      weight: '700',
      spacing: '-.025em',
      body: 'serif',
    },
    elegant: {
      label: 'Magical classic',
      family: '"Palatino Linotype","Book Antiqua",Georgia,serif',
      weight: '700',
      spacing: '.025em',
      body: 'system',
    },
    tech: {
      label: 'Retro technology',
      family: '"Courier New",ui-monospace,monospace',
      weight: '700',
      spacing: '-.04em',
      body: 'system',
    },
  };
  function pack(id, group, series, name, motif, accent, secondary, page, type, dark = false) {
    return Object.freeze({
      id,
      group,
      series,
      name,
      motif,
      accent,
      colors: Object.freeze({
        page,
        surface: dark ? '#182331' : '#fffdf8',
        text: dark ? '#f1f5fc' : '#243449',
        secondary,
      }),
      type,
      font: TYPE[type].body,
      dark,
    });
  }
  const SETS = Object.freeze([
    pack(
      'naruto-clouds',
      'anime',
      'Naruto',
      'Crimson Clouds',
      'cloud',
      '#ee5269',
      '#f5d6c8',
      '#191c29',
      'impact',
      true
    ),
    pack(
      'one-piece-voyage',
      'anime',
      'One Piece',
      'Grand Line',
      'hat',
      '#b64535',
      '#e8bb55',
      '#eaf6fb',
      'story'
    ),
    pack(
      'dragon-ball-orbs',
      'anime',
      'Dragon Ball',
      'Seven-Star Energy',
      'orb',
      '#b8560b',
      '#ffae38',
      '#fff2d9',
      'impact'
    ),
    pack(
      'demon-slayer-checks',
      'anime',
      'Demon Slayer',
      'Wisteria & Checks',
      'check',
      '#4fc7ac',
      '#bc8cd7',
      '#102a29',
      'elegant',
      true
    ),
    pack(
      'sailor-moon-prism',
      'anime',
      'Sailor Moon',
      'Moon Prism',
      'moon',
      '#b34686',
      '#efc76e',
      '#fff0f8',
      'elegant'
    ),
    pack(
      'pokemon-trainer',
      'anime',
      'Pokémon',
      'Trainer Trail',
      'capture',
      '#bd353f',
      '#e4b33f',
      '#edf6ff',
      'rounded'
    ),
    pack(
      'doraemon-pocket',
      'anime',
      'Doraemon',
      'Pocket Gadgets',
      'bell',
      '#1475bd',
      '#efc143',
      '#e6f7ff',
      'rounded'
    ),
    pack(
      'totoro-forest',
      'anime',
      'My Neighbor Totoro',
      'Forest Spirits',
      'leaf',
      '#486f48',
      '#a8bd7a',
      '#eff3df',
      'story'
    ),
    pack(
      'spirited-lanterns',
      'anime',
      'Spirited Away',
      'Lantern Bathhouse',
      'lantern',
      '#ad4949',
      '#e2b366',
      '#fcf0dd',
      'story'
    ),
    pack(
      'howl-starlight',
      'anime',
      'Howl’s Moving Castle',
      'Starlit Magic',
      'shooting',
      '#7862a7',
      '#d4a66b',
      '#f2eefb',
      'elegant'
    ),
    pack(
      'jujutsu-charms',
      'anime',
      'Jujutsu Kaisen',
      'Midnight Charms',
      'charm',
      '#61d9d0',
      '#cf6884',
      '#141d2f',
      'tech',
      true
    ),
    pack(
      'titan-wings',
      'anime',
      'Attack on Titan',
      'Wings & Walls',
      'wings',
      '#587355',
      '#a79a7e',
      '#efeee5',
      'impact'
    ),
    pack(
      'bleach-butterflies',
      'anime',
      'Bleach',
      'Soul Butterflies',
      'butterfly',
      '#f0a555',
      '#c0a6e9',
      '#1c1d2a',
      'elegant',
      true
    ),
    pack(
      'one-punch-impact',
      'anime',
      'One-Punch Man',
      'Hero Impact',
      'punch',
      '#bc373e',
      '#e9be39',
      '#fff1dc',
      'impact'
    ),
    pack(
      'spy-family-signals',
      'anime',
      'Spy × Family',
      'Secret Signals',
      'spy',
      '#27685c',
      '#d39aab',
      '#e9f5e8',
      'tech'
    ),
    pack(
      'haikyu-court',
      'anime',
      'Haikyu!!',
      'Court Energy',
      'volley',
      '#be5c14',
      '#626474',
      '#fff2df',
      'impact'
    ),
    pack(
      'hero-academia-panels',
      'anime',
      'My Hero Academia',
      'Hero Panels',
      'burst',
      '#3c775d',
      '#e7bc37',
      '#f0f6df',
      'impact'
    ),
    pack(
      'fullmetal-alchemy',
      'anime',
      'Fullmetal Alchemist',
      'Alchemy Circles',
      'alchemy',
      '#a44b3b',
      '#b59a5f',
      '#f3ede0',
      'elegant'
    ),
    pack(
      'evangelion-grid',
      'anime',
      'Neon Genesis Evangelion',
      'Mecha Grid',
      'mecha',
      '#b69be6',
      '#8ee56b',
      '#221b36',
      'tech',
      true
    ),
    pack(
      'sakura-clow',
      'anime',
      'Cardcaptor Sakura',
      'Clow Blossoms',
      'blossom',
      '#b64a7c',
      '#d7b34d',
      '#fff0f3',
      'elegant'
    ),
    pack(
      'spongebob-bottom',
      'cartoon',
      'SpongeBob SquarePants',
      'Bikini Bottom',
      'sea-flower',
      '#197b9b',
      '#dab341',
      '#e7f8ed',
      'comic'
    ),
    pack(
      'adventure-candy',
      'cartoon',
      'Adventure Time',
      'Candy Kingdom',
      'candy',
      '#9864b2',
      '#74b7b7',
      '#fff0f8',
      'rounded'
    ),
    pack(
      'simpsons-skies',
      'cartoon',
      'The Simpsons',
      'Springfield Skies',
      'donut',
      '#a8488b',
      '#e8bd42',
      '#eaf7ff',
      'comic'
    ),
    pack(
      'powerpuff-sparks',
      'cartoon',
      'The Powerpuff Girls',
      'Sugar & Sparks',
      'hearts',
      '#c94c82',
      '#79b8d6',
      '#fff0f6',
      'rounded'
    ),
    pack(
      'avatar-elements',
      'cartoon',
      'Avatar: The Last Airbender',
      'Four Elements',
      'elements',
      '#a45935',
      '#4e92a6',
      '#f6efdc',
      'elegant'
    ),
    pack(
      'steven-gems',
      'cartoon',
      'Steven Universe',
      'Crystal Gems',
      'gem',
      '#b75791',
      '#b59ddb',
      '#fcf0ff',
      'rounded'
    ),
    pack(
      'gravity-pines',
      'cartoon',
      'Gravity Falls',
      'Mystery Pines',
      'pines',
      '#c9a45a',
      '#75a28b',
      '#243029',
      'story',
      true
    ),
    pack(
      'rick-portals',
      'cartoon',
      'Rick and Morty',
      'Portal Circuit',
      'portal',
      '#b0e262',
      '#68c9c1',
      '#172b25',
      'tech',
      true
    ),
    pack(
      'tom-jerry-chase',
      'cartoon',
      'Tom and Jerry',
      'Cat & Mouse Chase',
      'chase',
      '#537d9b',
      '#d3a35a',
      '#f9f0e3',
      'comic'
    ),
    pack(
      'looney-rings',
      'cartoon',
      'Looney Tunes',
      'Showtime Rings',
      'rings',
      '#bb4144',
      '#dfaa3b',
      '#fff1e4',
      'impact'
    ),
    pack(
      'scooby-mystery',
      'cartoon',
      'Scooby-Doo',
      'Mystery Machine',
      'groovy',
      '#529a8a',
      '#9476b8',
      '#eff5d8',
      'comic'
    ),
    pack(
      'titans-tower',
      'cartoon',
      'Teen Titans',
      'Hero Tower',
      'tower',
      '#5e76b6',
      '#68bdad',
      '#eaf2fc',
      'impact'
    ),
    pack(
      'ben-alien',
      'cartoon',
      'Ben 10',
      'Alien Signal',
      'alien',
      '#89d34c',
      '#79a5a1',
      '#182b22',
      'tech',
      true
    ),
    pack(
      'dexter-lab',
      'cartoon',
      'Dexter’s Laboratory',
      'Atomic Lab',
      'atom',
      '#bd5747',
      '#7fb8d0',
      '#eef7fc',
      'tech'
    ),
    pack(
      'courage-twilight',
      'cartoon',
      'Courage the Cowardly Dog',
      'Nowhere Twilight',
      'farm',
      '#c583bf',
      '#c5a362',
      '#32213e',
      'story',
      true
    ),
    pack(
      'flintstones-bedrock',
      'cartoon',
      'The Flintstones',
      'Bedrock Party',
      'bone',
      '#af5f29',
      '#61b8bd',
      '#fff0dc',
      'comic'
    ),
    pack(
      'jetsons-orbit',
      'cartoon',
      'The Jetsons',
      'Orbit City',
      'orbit',
      '#438b9c',
      '#c986a9',
      '#e5f6fa',
      'tech'
    ),
    pack(
      'ducktales-treasure',
      'cartoon',
      'DuckTales',
      'Treasure Dive',
      'treasure',
      '#a56a13',
      '#5889a6',
      '#fff6d9',
      'story'
    ),
    pack(
      'pooh-honey',
      'cartoon',
      'Winnie the Pooh',
      'Hundred Acre Honey',
      'honey',
      '#a37622',
      '#b45b4d',
      '#fff7dc',
      'story'
    ),
    pack(
      'mickey-classic',
      'cartoon',
      'Mickey & Friends',
      'Classic Toon',
      'toon',
      '#b64444',
      '#e3b34c',
      '#f9f1e8',
      'rounded'
    ),
  ]);
  const byId = new Map(SETS.map(set => [set.id, set]));
  function motif(name, a, b, ink) {
    const paths = {
      cloud: `<path d="M-43 14C-63-4-46-28-25-23C-19-52 20-49 25-24C50-34 65-5 44 11C37 32-4 34-13 19C-28 31-42 29-43 14Z" fill="${a}" stroke="${b}" stroke-width="5"/>`,
      hat: `<ellipse cy="16" rx="52" ry="16" fill="${b}" stroke="${a}" stroke-width="4"/><path d="M-30 12L-25-24Q0-43 25-24L30 12Z" fill="${b}" stroke="${a}" stroke-width="4"/><path d="M-29 1Q0 14 29 1" fill="none" stroke="${a}" stroke-width="10"/><path d="M-46 41q12-12 24 0t24 0t24 0t24 0" fill="none" stroke="${a}" stroke-width="4"/>`,
      orb: `<circle r="43" fill="${b}" stroke="${a}" stroke-width="5"/><path d="m0-27 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1Z" fill="${a}"/><circle cx="-15" cy="20" r="5" fill="${a}"/><circle cx="15" cy="20" r="5" fill="${a}"/><path d="M-29-21q9-12 18-12" fill="none" stroke="white" stroke-width="6" stroke-linecap="round"/>`,
      check: `<rect x="-40" y="-40" width="80" height="80" rx="9" fill="${a}"/><path d="M-40-40H0V0H40V40H0V0H-40Z" fill="#132d28"/><path d="M-50-7q-17-18-16-32q17 3 18 24M48 10q18-12 20-30q-18 0-20 16" fill="${b}"/>`,
      moon: `<path d="M18-42a44 44 0 1 0 19 69a35 35 0 0 1-19-69Z" fill="${b}" stroke="${a}" stroke-width="3"/><path d="m19 12-20 13 20 7 20-7Z M19 12 3-3-1 12l20 13L39 12 35-3Z" fill="${a}"/><circle cx="19" cy="17" r="8" fill="${b}"/>`,
      capture: `<circle r="42" fill="#fffdf7" stroke="${ink}" stroke-width="5"/><path d="M-42 0a42 42 0 0 1 84 0Z" fill="${a}"/><path d="M-41 0h82" stroke="${ink}" stroke-width="7"/><circle r="13" fill="#fffdf7" stroke="${ink}" stroke-width="5"/><path d="m47-31 15-20-3 17 11-2-18 27 4-22Z" fill="${b}"/>`,
      bell: `<path d="M-30 20q-17-58 30-58t30 58Z" fill="${b}" stroke="${a}" stroke-width="5"/><path d="M-32-11h64M0 2v16" stroke="${a}" stroke-width="5"/><circle cy="3" r="7" fill="${a}"/><path d="M-41 31q41 27 82 0v6q-41 34-82 0Z" fill="${a}"/>`,
      leaf: `<path d="M-7 35Q-53 1-25-39Q22-42 42-25Q49 19-7 35Z" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M-16 49 22-23M-3 26-23 6M5 10 30 3" fill="none" stroke="${b}" stroke-width="4"/><path d="M-43 36q-23-3-18-27q22-7 27 12" fill="${b}"/>`,
      lantern: `<rect x="-29" y="-36" width="58" height="70" rx="22" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M-23-36h46M-23 34h46M0 34v22M-18-27q-12 24 0 51M18-27q12 24 0 51" fill="none" stroke="${b}" stroke-width="5"/><path d="M-10-7h20v18h-20Z" fill="${b}"/>`,
      shooting: `<path d="m5-38 9 24 25 2-19 17 6 25-21-14-22 14 7-25-20-17 26-2Z" fill="${b}" stroke="${a}" stroke-width="3"/><path d="M-17 22-51 44M-26 4-61 22M1 33-26 59" stroke="${a}" stroke-width="5" stroke-linecap="round"/>`,
      charm: `<path d="m-25-46 57 9-13 85-57-9Z" fill="${b}" stroke="${a}" stroke-width="4"/><path d="M-13-24 10-20M-19-5 16 0M-19 13 10 18M-8-24-16 32" fill="none" stroke="${ink}" stroke-width="5"/><path d="m35-21 17-16-7 28 13-4-22 32 4-25-13 3Z" fill="${a}"/>`,
      wings: `<path d="M-5 36Q-51 17-48-43L-8-12Z M5 36Q51 17 48-43L8-12Z" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M-12 22-36-18M12 22 36-18M-8 8-38-4M8 8 38-4M0-24v68" stroke="${b}" stroke-width="4"/>`,
      butterfly: `<path d="M0-4Q-59-68-49-10Q-62 36-8 28L0 6Q59 60 48 6Q60-43 7-20Z" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M0-21v63M0-11-12-35M0-11 15-34" fill="none" stroke="${ink}" stroke-width="4"/>`,
      punch: `<path d="m-44-4 16-7-4-22 17 5 12-27 11 28 24-9-4 25 25 15-29 10 9 23-27-6-20 23-6-28-27 3Z" fill="${b}" stroke="${a}" stroke-width="4"/><path d="m-18 6 2-25 11-3 8 5 10-3 12 7 2 22-18 15-17-4-10-12-10-1-3-12Z" fill="${a}"/>`,
      spy: `<path d="M-48 0Q0-47 48 0Q0 46-48 0Z" fill="${a}"/><circle r="19" fill="${b}"/><circle r="9" fill="${ink}"/><path d="M-17 43q-17-20 1-23q17-3 13 13q11-9 20 0q6 19-12 24Z" fill="${b}" stroke="${a}" stroke-width="3"/>`,
      volley: `<circle r="43" fill="${b}" stroke="${ink}" stroke-width="4"/><path d="M0-43Q30-17 12 16Q-6 43-37 22M-37-22Q-6-33 12-12Q35 10 29 32M-9 42Q-32 12-16-11Q0-35 33-27" fill="none" stroke="${a}" stroke-width="6"/>`,
      burst: `<path d="m-51-14 26-4-9-31 28 17 8-27 16 30 30-13-12 28 27 10-31 13 15 30-29-13-15 27-6-31-30 9 12-24-28-8Z" fill="${b}" stroke="${a}" stroke-width="4"/><path d="m5-29-22 34h20l-9 27 28-39H1Z" fill="${a}"/>`,
      alchemy: `<circle r="45" fill="none" stroke="${a}" stroke-width="4"/><circle r="34" fill="none" stroke="${b}" stroke-width="3"/><path d="m0-34 30 51h-60ZM0 34-30-17h60Z" fill="none" stroke="${a}" stroke-width="3"/><circle r="11" fill="${b}"/>`,
      mecha: `<path d="m0-49 40 24v47L0 47-40 22v-47Z" fill="none" stroke="${a}" stroke-width="5"/><path d="m-27-9 20-17 7 14 7-14L27-9 14 29H-14Z" fill="${a}"/><path d="m-21-3 17 7M21-3 4 4M0-12v39" fill="none" stroke="${b}" stroke-width="6"/>`,
      blossom: `<g fill="${a}" stroke="${b}" stroke-width="2"><ellipse cy="-23" rx="14" ry="23"/><ellipse cy="-23" rx="14" ry="23" transform="rotate(72)"/><ellipse cy="-23" rx="14" ry="23" transform="rotate(144)"/><ellipse cy="-23" rx="14" ry="23" transform="rotate(216)"/><ellipse cy="-23" rx="14" ry="23" transform="rotate(288)"/></g><circle r="11" fill="${b}"/><circle r="52" fill="none" stroke="${b}" stroke-width="2" stroke-dasharray="4 8"/>`,
      'sea-flower': `<path d="M0-12C-38-55-70-26-28 2C-77 26-37 62-8 23C-2 78 42 53 14 17C69 41 78-7 23-6C57-47 11-68 0-12Z" fill="none" stroke="${a}" stroke-width="7"/><circle cy="5" r="9" fill="${b}"/>`,
      candy: `<path d="m-40-21 18 13v-24Z M40 21-18-13v24Z" fill="${b}"/><rect x="-29" y="-28" width="58" height="56" rx="17" fill="${a}"/><path d="M-17-27 19 26M-28-10-4 27M7-28 29 6" stroke="${b}" stroke-width="9"/><path d="m-43 28 13 15M37-35 14-14" stroke="${a}" stroke-width="5"/>`,
      donut: `<circle r="44" fill="${b}" stroke="${a}" stroke-width="4"/><path d="M-37-10q8-29 30-26q30-7 43 24q-8 12-17 6q-7 10-19 4q-11 10-22-1q-11 9-15-7Z" fill="${a}"/><circle r="14" fill="${b}"/><path d="m-25-21 6-6M3-25l5 6M22-13l7-5" stroke="#fff9e9" stroke-width="4" stroke-linecap="round"/>`,
      hearts: `<path d="M0 40-39 3C-65-28-17-51 0-19C17-51 65-28 39 3Z" fill="${a}"/><path d="M-34 46-57 23q-16-19-5-30q18-12 29 4q14-17 28-4" fill="${b}"/><path d="m32-43 4 10 11 1-8 7 2 10-9-5-9 5 2-10-8-7 11-1Z" fill="${b}"/>`,
      elements: `<path d="M-45-20q28-40 40-10q-26-9-21 13t28 2" fill="none" stroke="${a}" stroke-width="5"/><path d="M16-8q-8-22 13-40q0 24 15 30q14 24-11 28q-23 0-17-18Z" fill="${b}"/><path d="m-39 38 19-30 19 30Z" fill="none" stroke="${b}" stroke-width="5"/><path d="M13 29q10-16 20 0t20 0M13 43q10-16 20 0t20 0" fill="none" stroke="${a}" stroke-width="5"/>`,
      gem: `<path d="m-42-13 20-26h44l20 26L0 44Z" fill="${b}" stroke="${a}" stroke-width="4"/><path d="M-42-13h84M-22-39-14-13 0 44 14-13 22-39M-14-13 0-39 14-13" fill="none" stroke="${a}" stroke-width="3"/>`,
      pines: `<path d="m-27-42-25 34h14l-20 29h23v25h16V21H4L-16-8h14Z" fill="${b}"/><path d="m25-27-23 43h46Z" fill="${a}" stroke="${b}" stroke-width="3"/><path d="M10 3q15-17 30 0q-15 17-30 0" fill="${ink}"/><circle cx="25" cy="3" r="5" fill="${b}"/>`,
      portal: `<ellipse rx="42" ry="49" fill="none" stroke="${a}" stroke-width="8"/><path d="M3-38q-43 5-28 48q29 52 53 2q14-38-19-35q-24 3-12 24q21 23 20-1" fill="none" stroke="${b}" stroke-width="6"/><path d="m-51-26 8 4M43 29l12 9M20-51l4-9" stroke="${a}" stroke-width="4"/>`,
      chase: `<path d="m9-22 42 33-47 27Z" fill="${b}" stroke="${a}" stroke-width="3"/><circle cx="17" cy="11" r="5" fill="${a}"/><circle cx="29" cy="21" r="4" fill="${a}"/><ellipse cx="-28" cy="-1" rx="18" ry="15" fill="${a}"/><g fill="${a}"><ellipse cx="-46" cy="-23" rx="7" ry="10"/><ellipse cx="-28" cy="-32" rx="7" ry="10"/><ellipse cx="-10" cy="-24" rx="7" ry="10"/></g>`,
      rings: `<circle r="47" fill="${a}"/><circle r="35" fill="${b}"/><circle r="24" fill="${a}"/><circle r="12" fill="${b}"/><path d="m38 34 4 10 12 1-9 7 3 11-10-7-10 7 3-11-9-7 12-1Z" fill="${a}"/>`,
      groovy: `<path d="M0-12C-50-60-60 10-20 9C-62 55 2 65 7 25C44 69 70 5 26 0C69-43 3-65 0-12Z" fill="${a}" stroke="${b}" stroke-width="5"/><circle cx="4" cy="5" r="14" fill="${b}"/><circle cx="4" cy="5" r="6" fill="#f4b752"/>`,
      tower: `<path d="M-45-42h90v25H15v60h-30v-60h-30Z" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M-33-31h9M-9-31H0M15-31h9M-5-7h10M-5 11h10M-5 29h10" stroke="${b}" stroke-width="5"/>`,
      alien: `<circle r="45" fill="${ink}" stroke="${a}" stroke-width="5"/><path d="M-28-30h56L9 0l19 30h-56L-9 0Z" fill="${a}"/><path d="M-49 0h-9M49 0h9M0-49v-9M0 49v9" stroke="${b}" stroke-width="5"/>`,
      atom: `<g fill="none" stroke="${a}" stroke-width="3"><ellipse rx="48" ry="17"/><ellipse rx="48" ry="17" transform="rotate(60)"/><ellipse rx="48" ry="17" transform="rotate(120)"/></g><circle r="9" fill="${b}"/><circle cx="39" cy="10" r="7" fill="${b}"/><circle cx="-9" cy="-30" r="7" fill="${b}"/>`,
      farm: `<path d="m-45 8 40-35 40 35v36h-80Z" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M-51 8-5-34 41 8M-8 14v30M10 13h13v13H10Z" fill="none" stroke="${b}" stroke-width="4"/><path d="M25-49a19 19 0 1 0 18 27a17 17 0 0 1-18-27Z" fill="${b}"/>`,
      bone: `<path d="M-32-16C-56-39-65-2-40 3C-64 22-42 44-26 23L27-6C44 14 65-12 43-24C60-49 27-55 23-30Z" fill="${b}" stroke="${a}" stroke-width="4"/><path d="m-27 47 9-9 10 13ZM33 38l8-10 9 11Z" fill="${a}"/>`,
      orbit: `<ellipse rx="53" ry="18" fill="none" stroke="${a}" stroke-width="5" transform="rotate(-25)"/><ellipse rx="31" ry="27" fill="${b}" stroke="${a}" stroke-width="4"/><path d="M-45 21Q-8 20 49-21" fill="none" stroke="${a}" stroke-width="5"/><circle cx="-38" cy="-36" r="7" fill="${a}"/>`,
      treasure: `<circle cx="-20" cy="16" r="25" fill="${b}" stroke="${a}" stroke-width="4"/><circle cx="-20" cy="16" r="16" fill="none" stroke="${a}" stroke-width="3"/><path d="M-26 11q12-11 14 0q0 5-13 10M-19 3v26" fill="none" stroke="${a}" stroke-width="3"/><path d="m9-30 16-17 24 17-20 34Z" fill="${a}" stroke="${b}" stroke-width="3"/>`,
      honey: `<path d="M-29-26q29-15 58 0v54q-29 20-58 0Z" fill="${a}" stroke="${b}" stroke-width="5"/><path d="M-25-17q9 15 16 0q9 27 16 0q9 15 18 0" fill="none" stroke="${b}" stroke-width="9"/><path d="M-35-31h70" stroke="${b}" stroke-width="7"/><ellipse cx="40" cy="-41" rx="12" ry="8" fill="${b}"/><path d="M36-49v16M45-49v16" stroke="${a}" stroke-width="4"/>`,
      toon: `<g fill="${ink}"><circle r="30"/><circle cx="-29" cy="-29" r="19"/><circle cx="29" cy="-29" r="19"/></g><path d="M-28 7h56v19q-28 23-56 0Z" fill="${a}"/><ellipse cx="-10" cy="21" rx="4" ry="7" fill="${b}"/><ellipse cx="10" cy="21" rx="4" ry="7" fill="${b}"/>`,
    };
    return paths[name];
  }
  const images = new Map();
  function image(id, strength = 70) {
    const set = byId.get(id);
    if (!set) return '';
    const key = id + ':' + strength;
    if (images.has(key)) return images.get(key);
    const shape = motif(
      set.motif,
      set.accent,
      set.colors.secondary,
      set.dark ? '#f6eee1' : '#263347'
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="220" viewBox="0 0 280 220"><g opacity="${Math.max(0.2, Math.min(1, strength / 100))}"><g transform="translate(66 63) rotate(-8)">${shape}</g><g transform="translate(210 169) rotate(12) scale(.82)">${shape}</g><path d="m211 42 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z M65 166l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="${set.colors.secondary}"/></g></svg>`;
    const result = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    if (images.size > 180) images.clear();
    images.set(key, result);
    return result;
  }
  function validate(p) {
    if (
      (p.patternSet !== undefined && p.patternSet !== '' && !byId.has(p.patternSet)) ||
      (p.patternStrength !== undefined &&
        (!Number.isInteger(p.patternStrength) ||
          p.patternStrength < 20 ||
          p.patternStrength > 100)) ||
      (p.patternScale !== undefined &&
        (!Number.isInteger(p.patternScale) || p.patternScale < 60 || p.patternScale > 180)) ||
      (p.patternTypography !== undefined && typeof p.patternTypography !== 'boolean')
    )
      throw Error('Check your pattern collection, strength, size and typography.');
  }
  function values(form, p) {
    return {
      patternSet: form.elements.namedItem('patternSet')?.value ?? p.patternSet ?? '',
      patternStrength: Number(
        form.elements.namedItem('patternStrength')?.value ?? p.patternStrength ?? 70
      ),
      patternScale: Number(form.elements.namedItem('patternScale')?.value ?? p.patternScale ?? 100),
      patternTypography:
        form.elements.namedItem('patternTypography')?.checked ?? p.patternTypography ?? true,
    };
  }
  function fields(p) {
    const active = byId.get(p.patternSet),
      group = active?.group || 'anime';
    return `<section class="hub-theme-section pc-collection" aria-labelledby="pcTitle"><div class="pc-intro"><span class="hub-kicker">40 WORLDS · ONE WORKSPACE</span><h4 id="pcTitle">Anime &amp; cartoon collections</h4><p>20 anime sets and 20 cartoon sets. Each pairs an original repeating motif with coordinated colours and heading typography.</p></div><input type="hidden" name="patternSet" value="${esc(p.patternSet || '')}"><div class="pc-tabs" role="group" aria-label="Pattern collection"><button type="button" data-hub="pattern-group" data-group="anime" aria-pressed="${group === 'anime'}">Anime · 20</button><button type="button" data-hub="pattern-group" data-group="cartoon" aria-pressed="${group === 'cartoon'}">Cartoons · 20</button></div>${[
      'anime',
      'cartoon',
    ]
      .map(
        category =>
          `<div class="pc-grid" data-pattern-group="${category}"${category === group ? '' : ' hidden'}>${SETS.filter(
            set => set.group === category
          )
            .map(
              set =>
                `<button type="button" class="pc-set" data-hub="pattern-set" data-id="${set.id}" aria-pressed="${p.patternSet === set.id}" aria-label="Preview ${esc(set.series)}: ${esc(set.name)}"><span class="pc-art" style="--pc-card-image:${esc(image(set.id, 90))};--pc-card-page:${set.colors.page};--pc-card-ink:${set.dark ? '#f1f5fc' : '#243449'};--pc-card-font:${esc(TYPE[set.type].family)}"><span>Aa</span></span><span class="pc-card-copy"><strong>${esc(set.series)}</strong><span>${esc(set.name)}</span><span class="pc-swatches" aria-hidden="true"><i style="background:${set.accent}"></i><i style="background:${set.colors.secondary}"></i><i style="background:${set.colors.page}"></i></span><small>${TYPE[set.type].label}</small></span></button>`
            )
            .join('')}</div>`
      )
      .join(
        ''
      )}<p id="pcSelection" class="pc-selection" role="status">${active ? esc(active.series + ' · ' + active.name) : 'Choose a set to preview its pattern, colours and typography.'}</p><div class="pc-adjustments"><label>Pattern strength <output id="pcStrengthValue">${p.patternStrength ?? 70}%</output><input type="range" name="patternStrength" min="20" max="100" step="5" value="${p.patternStrength ?? 70}"></label><label>Pattern size <output id="pcScaleValue">${p.patternScale ?? 100}%</output><input type="range" name="patternScale" min="60" max="180" step="10" value="${p.patternScale ?? 100}"></label></div><label class="check-label"><input type="checkbox" name="patternTypography"${p.patternTypography !== false ? ' checked' : ''}> Use the set’s heading typography</label><div class="actions"><button type="button" data-hub="pattern-clear">Use original background</button></div>${['page', 'both'].includes(document.body.dataset.photoBackground) ? '<p class="hub-meta">A background picture is active. Open My background pictures and choose Use theme background to show the pattern on your page. The preview card shows your selected set.</p>' : ''}<p class="hub-meta">Preview first, then use Save theme to keep your choice. Body text stays readable; available display fonts follow your device.</p></section>`;
  }
  function choose(form, id) {
    const set = byId.get(id);
    if (!set) throw Error('Choose a pattern from this collection.');
    const put = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    };
    put('patternSet', set.id);
    put('theme', 'custom');
    put('accent', set.accent);
    put('background', 'plain');
    put('font', set.font);
    for (const [name, value] of Object.entries(set.colors)) put('color-' + name, value);
    form.elements.namedItem('patternTypography').checked = true;
  }
  function showGroup(form, group) {
    if (!['anime', 'cartoon'].includes(group)) return;
    form.querySelectorAll('[data-pattern-group]').forEach(el => {
      el.hidden = el.dataset.patternGroup !== group;
    });
    form
      .querySelectorAll('[data-hub="pattern-group"]')
      .forEach(el => el.setAttribute('aria-pressed', String(el.dataset.group === group)));
  }
  function sync(form, p) {
    if (!form) return;
    form
      .querySelectorAll('[data-hub="pattern-set"]')
      .forEach(el => el.setAttribute('aria-pressed', String(el.dataset.id === p.patternSet)));
    const set = byId.get(p.patternSet),
      status = form.querySelector('#pcSelection');
    if (status)
      status.textContent = set
        ? set.series + ' · ' + set.name
        : 'Original background · no collection pattern selected.';
    for (const [id, value] of [
      ['pcStrengthValue', p.patternStrength ?? 70],
      ['pcScaleValue', p.patternScale ?? 100],
    ]) {
      const el = form.querySelector('#' + id);
      if (el) el.textContent = value + '%';
    }
  }
  let applied = '';
  function apply(p) {
    const set = byId.get(p.patternSet),
      key = JSON.stringify([set?.id, p.patternStrength, p.patternScale, p.patternTypography]);
    if (key === applied) return;
    applied = key;
    const body = document.body,
      style = body.style;
    if (!set) {
      delete body.dataset.hubPatternSet;
      delete body.dataset.hubPatternTypography;
      for (const name of ['image', 'size', 'heading-font', 'heading-weight', 'heading-spacing'])
        style.removeProperty('--pc-' + name);
      return;
    }
    body.dataset.hubPatternSet = set.id;
    body.toggleAttribute('data-hub-pattern-typography', p.patternTypography !== false);
    style.setProperty('--pc-image', image(set.id, p.patternStrength ?? 70));
    const scale = (p.patternScale ?? 100) / 100;
    style.setProperty('--pc-size', 280 * scale + 'px ' + 220 * scale + 'px');
    style.setProperty('--pc-heading-font', TYPE[set.type].family);
    style.setProperty('--pc-heading-weight', TYPE[set.type].weight);
    style.setProperty('--pc-heading-spacing', TYPE[set.type].spacing);
  }
  root.WorkHubPatternCollection = Object.freeze({
    SETS,
    TYPE,
    image,
    validate,
    values,
    fields,
    choose,
    showGroup,
    sync,
    apply,
  });
})(typeof window === 'undefined' ? globalThis : window);
