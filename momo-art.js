/**
 * momo-art.js
 * Original Momo character artwork and render helpers.
 * Uses assets/momo/anime-rig.webp and CSS animation. No saved account data.
 * Change appearance here and momo-anime.css; behaviour belongs in the other Momo modules.
 * File map: docs/FILE-MAP.md
 */
/* Original soft-3D anime artwork, assembled as a browser-animated rig.
 * SVG viewports isolate the optimized atlas into six illustrated parts.
 * Eyes are live vector layers, so Momo can keep watching the cursor. */
(function (root) {
  'use strict';
  const ATLAS = './assets/momo/anime-rig.webp?v=20261017-momo-render-fix';
  // Keep the sleeve, fingers and shaft in one layer so the grip follows a mirrored canopy.
  function umbrella() {
    return `<g class="momo-umbrella-back"><path d="M98-65V113q0 10 9 6" fill="none" stroke="#35566c" stroke-width="1.8" stroke-linecap="round"/><path d="M48-27a50 38 0 01100 0q-13-10-25 0-13-10-25 0-13-10-25 0-13-10-25 0Z" fill="#c5b7ef" stroke="#62758a" stroke-width="1.2"/><path d="M98-64Q72-52 73-27m25-37q26 12 25 37" fill="none" stroke="#8a78ba" stroke-width="1.5"/></g><g class="momo-umbrella-front"><path class="momo-umbrella-sleeve" d="M88 80q6 0 8 6l6 10-7 5-8-10-2-8Z" fill="url(#momo-fabric)" stroke="var(--momo-cloth-edge,#527f73)" stroke-width=".6"/><path d="m95 94 6-3 3 6-6 4Z" fill="var(--momo-trim,#d3e8db)"/><g class="momo-umbrella-hand" fill="#f4c7ad" stroke="#c5917f" stroke-width=".5"><path d="M95 88q0-3 3-3h2q3 0 3 3v5q0 4-4 4-4 0-4-4Z"/><path d="m97 88 5 .3m-5 2 5 .3m-4 2 4 .3" fill="none"/></g></g>`;
  }
  function accessory(name) {
    const cap = (fill, path) =>
      `<g class="momo-wearable" fill="${fill}" stroke="#5d6172" stroke-width=".85">${path}</g>`;
    const motifs = {
      helmet: cap(
        '#f2c362',
        '<path d="M39 37a31 29 0 0162 0H39"/><path d="M36 37h68M70 12v19" stroke="#ffe8a6" stroke-width="4" stroke-linecap="round"/>'
      ),
      party: cap(
        '#c4adf0',
        '<path d="M48 20 66-4 86 19Z"/><path d="m52 16 25-6m-20 1 12-9" stroke="#f7d486" stroke-width="3"/><circle cx="66" cy="-3" r="4" fill="#f4b8c9"/>'
      ),
      glasses:
        '<g class="momo-wearable" fill="none" stroke="#594e54" stroke-width="1"><rect x="50.7" y="48.9" width="14.1" height="10.8" rx="4.2"/><rect x="74.4" y="48" width="14.1" height="10.8" rx="4.2"/><path d="M65 53.5q4.5-2.8 9.3-.5m-24-.6-6-1m44-1 6-1"/></g>',
      roundglasses: cap(
        'none',
        '<circle cx="58" cy="54" r="7"/><circle cx="81" cy="53" r="7"/><path d="M65 53q5-2 9 0m-23 0-6-2m43 1 6-2"/>'
      ),
      sunglasses: cap(
        '#46536c',
        '<path d="M49 49h18l-3 10H53Zm24 0h18l-3 10H77Z"/><path d="M67 51h6"/><path d="m53 51 8 4m17-4 8 4" stroke="#b4d6db"/>'
      ),
      beanie: cap(
        '#b98a9e',
        '<path d="M43 25q4-29 28-28 26-1 29 28Z"/><path d="M42 23h59v9H42Z" fill="#e8bdcc"/><path d="M52 5v17m11-23v23m12-23v23m11-17v17" stroke="#d8a6b7"/>'
      ),
      beret: cap(
        '#899c7d',
        '<ellipse cx="67" cy="12" rx="32" ry="13" transform="rotate(-9 67 12)"/><path d="M48 23h42v7H48Z"/><path d="m68 0 3-7" stroke-width="3"/>'
      ),
      cap: cap(
        '#7b98bf',
        '<path d="M43 23a29 27 0 0158 0Z"/><path d="M42 22q45-5 67 7l-10 4-57-4Z" fill="#b9cce4"/><path d="M69-1v22"/>'
      ),
      bucket: cap(
        '#d2bf90',
        '<path d="m48 4 41-2 9 27H40Z"/><path d="M35 27q34-9 68-1l5 10H31Z"/><path d="M45 20h48" stroke="#f3e4bd" stroke-width="4"/>'
      ),
      tophat: cap(
        '#536274',
        '<path d="M49-14h40v36H49Z"/><ellipse cx="69" cy="24" rx="31" ry="6"/><path d="M50 10h38v9H50Z" fill="#d1a3ba"/>'
      ),
      chef: cap(
        '#fff2d9',
        '<path d="M49 22V9q-20-17 0-24 13-18 27-4 21-4 21 12 0 12-11 16v13Z"/><path d="M47 18h42v11H47Z"/>'
      ),
      explorer: cap(
        '#bdab79',
        '<path d="M45 22q-2-23 25-23 25 0 27 23Z"/><ellipse cx="70" cy="26" rx="39" ry="7"/><path d="M44 17h53v6H44Z" fill="#8b8064"/>'
      ),
      crown: cap(
        '#e2bd65',
        '<path d="m44 23-5-24 19 10 12-20 13 20 18-10-6 24Z"/><path d="M43 22h53v7H43Z"/><circle cx="70" cy="14" r="3" fill="#b781a6"/>'
      ),
      flowercrown: cap(
        '#81a779',
        '<path d="M39 25q32-28 64 0" fill="none" stroke-width="4"/>' +
          [45, 58, 72, 86, 99]
            .map(
              (x, i) =>
                `<g fill="${i % 2 ? '#dcb0c0' : '#f3e5b4'}"><circle cx="${x}" cy="${x < 55 || x > 90 ? 21 : 14}" r="5"/><circle cx="${x}" cy="${x < 55 || x > 90 ? 21 : 14}" r="1.5" fill="#d3ac62"/></g>`
            )
            .join('')
      ),
      earmuffs: cap(
        '#c99ba9',
        '<path d="M38 48V33a32 30 0 0164 0v15" fill="none" stroke-width="3"/><ellipse cx="37" cy="52" rx="7" ry="11"/><ellipse cx="102" cy="52" rx="7" ry="11"/>'
      ),
      headphones: cap(
        '#cdb8e8',
        '<g class="momo-headphones"><path d="M38 50V35a32 30 0 0164 0v15" fill="none" stroke="#b29bd4" stroke-width="3"/><rect x="35" y="45" width="6" height="15" rx="3"/><rect x="99" y="44" width="6" height="15" rx="3"/></g>'
      ),
      headband: cap('#dfb683', '<path d="M37 31q31-20 66-2v7q-35-18-66 2Z"/>'),
      starglasses: cap(
        '#c4a3d6',
        '<path d="m58 45 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Zm23 0 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z"/><path d="M67 53h5"/>'
      ),
      aviator: cap(
        '#93aeb7',
        '<ellipse cx="57" cy="32" rx="12" ry="8"/><ellipse cx="82" cy="31" rx="12" ry="8"/><path d="M69 30h2m-26 1-9 1m58-2 10-2" stroke-width="2"/>'
      ),
      visor: cap(
        '#8dbbb0',
        '<path d="M41 26q28-13 59-1v7H41Z"/><path d="M43 31q35-8 61 7l-10 3-51-5Z"/>'
      ),
      pirate: cap(
        '#55596d',
        '<path d="m32 27 14-25 23 10L94 1l16 25-39-4Z"/><circle cx="70" cy="11" r="5" fill="#f4dfbf"/><path d="m66 16 8 4m0-4-8 4" stroke="#f4dfbf"/>'
      ),
      sailor: cap(
        '#eee7d4',
        '<path d="M44 20q1-24 26-24 26 0 26 24Z"/><path d="M43 18h54v10H43Z" fill="#708ba7"/>'
      ),
      cowboy: cap(
        '#bb956e',
        '<path d="m48-5 12 7 10-8 11 8 10-7 4 29H43Z"/><path d="M27 21q9 16 42 10 39 5 44-10l-8 19-77-2Z"/>'
      ),
      wizard: cap(
        '#8f89b2',
        '<path d="m44 22 31-52 18 55Z"/><ellipse cx="69" cy="27" rx="34" ry="6"/><path d="m72-8 2 4 4 1-4 1-2 4-1-4-4-1 4-1Z" fill="#f0d596"/>'
      ),
      knight: cap(
        '#a8b7bd',
        '<path d="M39 33q0-35 31-35t31 35l-11 6-2-18H51l-2 18Z"/><path d="M62-1v22h14V-1" fill="#d5cbd5"/>'
      ),
      monocle: cap('none', '<circle cx="81" cy="54" r="8"/><path d="M89 54q8 24-5 35"/>'),
      bow: cap(
        '#d6a1b8',
        '<path d="m84 14-11-12-2 20 13-5 12 9 5-18-16 6Z"/><circle cx="84" cy="16" r="4" fill="#f2c6d7"/>'
      ),
      hairclip: cap('#e5c576', '<path d="m91 14 2 5 6 1-5 3 1 6-5-4-5 3 2-6-4-4 6 1Z"/>'),
      leaf: cap('#8cb77d', '<path d="M68 9q-15-28 11-27Q88 0 68 9Z"/><path d="m68 9 6-18"/>'),
      antenna: cap(
        '#ab91c6',
        '<path d="m48 20-8-23m51 23 8-23" fill="none" stroke-width="2"/><circle cx="40" cy="-4" r="5"/><circle cx="100" cy="-4" r="5"/>'
      ),
      wintercap: cap(
        '#92b1bb',
        '<path d="M42 24q0-31 30-29 26 0 30 29Z"/><path d="M41 21h62v10H41Z" fill="#e9ded0"/><circle cx="73" cy="-7" r="6" fill="#e9ded0"/>'
      ),
      graduation: cap(
        '#576078',
        '<path d="m29 12 41-16 42 16-42 16Z"/><path d="M50 24v12h40V24"/><path d="M105 15v30" stroke="#e4c476" stroke-width="2"/>'
      ),
      headlamp: cap(
        '#a2a99a',
        '<path d="M38 26q31-10 64 0v9q-33-10-64 0Z"/><circle cx="70" cy="26" r="8" fill="#e5cf94"/><circle cx="70" cy="26" r="5" fill="#fff0bd"/>'
      ),
    };
    return motifs[name === 'partyhat' ? 'party' : name] || '';
  }
  function svg(name = 'glasses') {
    // Keep each raster image in its rendered viewport. A shared image in <defs>
    // can become Chromium's broken-image placeholder when cloned with <use>.
    const part = (cls, source, target, clip = '') =>
      `<g class="${cls}"><svg x="${target[0]}" y="${target[1]}" width="${target[2]}" height="${target[3]}" viewBox="${source.join(' ')}" preserveAspectRatio="none" overflow="hidden" style="width:${target[2]}px;height:${target[3]}px;overflow:hidden;filter:none"><g${clip ? ` clip-path="url(#${clip})"` : ''}><image class="momo-part-image" href="${ATLAS}" width="1024" height="1536"/></g></svg></g>`;
    const eye = (side, x, y) =>
      `<g class="momo-eye-${side}"><g clip-path="url(#momo-eye-clip-${side})"><g class="momo-pupils"><ellipse cx="${x}" cy="${y + 0.6}" rx="3.75" ry="4.65" fill="url(#momo-iris)"/><ellipse cx="${x}" cy="${y}" rx="1.85" ry="3.1" fill="#182b34"/><ellipse cx="${x - 1.2}" cy="${y - 2.4}" rx="1.45" ry="1.7" fill="#fff"/><circle cx="${x + 1.6}" cy="${y + 2.4}" r=".7" fill="#d5ffff"/></g></g></g>`;
    return `<svg class="momo-anime-art" data-art-ready="false" viewBox="0 0 140 155" role="img" aria-label="Momo, your illustrated companion" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id="momo-fabric" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--momo-trim,#d3e8db)"/><stop offset=".3" stop-color="var(--momo-cloth,#85b5a5)"/><stop offset="1" stop-color="var(--momo-cloth-edge,#527f73)"/></linearGradient>
 <radialGradient id="momo-iris" cx="45%" cy="25%"><stop stop-color="#244856"/><stop offset=".56" stop-color="#4d8d91"/><stop offset=".83" stop-color="#78c6bc"/><stop offset="1" stop-color="#244553"/></radialGradient>
  <radialGradient id="momo-skin"><stop stop-color="#f8d0b7"/><stop offset="1" stop-color="#f5c7b0"/></radialGradient>
  <filter id="momo-mouth-blend" x="-30%" y="-70%" width="160%" height="240%"><feGaussianBlur stdDeviation=".45"/></filter>
  <linearGradient id="momo-chair-metal"><stop stop-color="#c0d0d8"/><stop offset=".5" stop-color="#5c7789"/><stop offset="1" stop-color="#b7cbd2"/></linearGradient>
  <clipPath id="momo-eye-clip-left"><ellipse cx="58.1" cy="53.4" rx="4.9" ry="4.2"/></clipPath>
  <clipPath id="momo-eye-clip-right"><ellipse cx="80.6" cy="52.5" rx="5.05" ry="4.2"/></clipPath>
  <clipPath id="momo-arm-left-clip"><path d="M265 532H314L356 590V948H251V982H158V590Z"/></clipPath>
  <clipPath id="momo-arm-right-clip"><path d="M710 532H765L867 590V982H784V948H668V590Z"/></clipPath>
  <clipPath id="momo-leg-left-clip"><path d="M244 962H358V1522H161V1390L210 1190Z"/></clipPath>
  <clipPath id="momo-leg-right-clip"><path d="M665 962H780L810 1190 867 1390V1522H665Z"/></clipPath>
 </defs>
 <ellipse class="momo-ground" cx="70" cy="152" rx="27" ry="2.3" fill="#344954" opacity=".13"/>
 <g class="momo-folding-chair" aria-hidden="true">
  <g class="momo-chair-back"><path d="M44 137V102q0-4 4-4h44q4 0 4 4v35" fill="none" stroke="url(#momo-chair-metal)" stroke-width="3"/><path d="M47 101h46v21H47Z" fill="#c6a4bb" stroke="#93718d"/><path d="M51 106h37m-37 4h37" stroke="#eed7e5" opacity=".6"/></g>
  <g class="momo-chair-legs"><path d="m44 124 49 29m3-29-49 29" fill="none" stroke="url(#momo-chair-metal)" stroke-width="3.2" stroke-linecap="round"/><circle cx="70" cy="139" r="2.4" fill="#edf5f8" stroke="#587081"/></g>
  <path class="momo-chair-seat" d="m43 123 48-1 6 8H42Z" fill="#b491ac" stroke="#7d637e" stroke-width="1.2"/>
 </g>
 <g class="pet-body">
  ${part('momo-foot-left', [161, 962, 198, 561], [47, 108, 23, 44], 'momo-leg-left-clip')}
  ${part('momo-foot-right', [665, 962, 202, 561], [70, 108, 23, 44], 'momo-leg-right-clip')}
  ${part('momo-torso', [570, 50, 400, 460], [45, 75, 50, 39])}
  <g id="hubPetOutfit"></g>
  ${part('momo-arm-left', [158, 515, 198, 467], [38, 78, 20, 47], 'momo-arm-left-clip')}
  ${part('momo-arm-right', [668, 515, 199, 467], [82, 78, 20, 47], 'momo-arm-right-clip')}
  <g class="momo-face">
   ${part('momo-head', [45, 0, 508, 510], [29, 1, 82, 82])}
   <g class="pet-eye">${eye('left', 58.1, 53.4)}${eye('right', 80.6, 52.5)}</g>
   <g class="momo-eye-lids" fill="url(#momo-skin)"><ellipse cx="58.1" cy="53.4" rx="5.3" ry="4.5"/><ellipse cx="80.6" cy="52.5" rx="5.45" ry="4.5"/></g>
   <g class="momo-eye-smiles" fill="none" stroke="#634a44" stroke-width="1.15" stroke-linecap="round"><path d="M53.7 54q4.5-4.7 9 0m13.4-1q4.5-4.7 9 0"/></g>
   <path class="momo-eye-wink" d="M76 53q4.5-3.5 9 0" fill="none" stroke="#634a44" stroke-width="1.2" stroke-linecap="round"/>
   <g class="momo-dizzy-eyes" fill="none" stroke="#634a44" stroke-width="1.2"><path d="m54 50 8 7m0-7-8 7m23-8 8 7m0-7-8 7"/></g>
   <g class="momo-annoyed-eyes"><g clip-path="url(#momo-eye-clip-left)"><path d="M51 47H65V54L51 50Z" fill="url(#momo-skin)"/><path d="m52 50 12 3.6" fill="none" stroke="#715045" stroke-width=".8"/></g><g clip-path="url(#momo-eye-clip-right)"><path d="M74 46H87V49L74 53Z" fill="url(#momo-skin)"/><path d="m75 53 12-4" fill="none" stroke="#715045" stroke-width=".8"/></g></g>
   <g class="momo-brows" fill="none" stroke="#725345" stroke-width="1.3" stroke-linecap="round"><path d="M53 46q4.5-2 9-.5m14-.5q4.5-2 9-1"/></g>
   <ellipse class="momo-mouth-cover" cx="69.9" cy="65.5" rx="6.2" ry="2.2" fill="url(#momo-skin)" filter="url(#momo-mouth-blend)"/>
   <path class="pet-mouth" d="M66 65.3q4 1.9 8-.4" fill="none" stroke="#aa695d" stroke-width=".65" stroke-linecap="round"/>
   <g class="momo-mouth-grin"><path d="M66 65q4 1 8-.3c0 6-8 6-8 .3" fill="#74444c"/><path d="M68 68q2-1 4 0" stroke="#ef9b9f" stroke-width="1.4"/></g>
   <ellipse class="momo-mouth-o" cx="70" cy="66" rx="1.9" ry="2.5" fill="#74444c"/>
   <path class="momo-mouth-annoyed" d="m67 66 6-.5" stroke="#a25f58" stroke-width="1" stroke-linecap="round"/>
   <path class="momo-tongue" d="M68.5 66h3v2.7a1.5 1.5 0 01-3 0Z" fill="#f5a1b3"/>
   <g class="momo-mouth-yawn"><ellipse cx="70" cy="66" rx="2.8" ry="3.5" fill="#74444c"/><path d="M68.5 68q1.5-1 3 0" stroke="#ef9b9f" stroke-width="1"/></g>
   <g class="momo-sparkles" fill="#efc76d"><path d="m30 32 1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5Zm77 3 1-3 1 3 3 1-3 1-1 3-1-3-3-1Z"/></g>
   <path class="momo-sweat" d="M99 49q6 9 .5 9-4 0-.5-9Z" fill="#b8e9fa" stroke="#74a7bd" stroke-width=".6"/>
   <g id="hubPetAccessory">${accessory(name)}</g>

  </g>
 </g>
 <g class="momo-whistle-notes" fill="#7f75b8" aria-hidden="true"><path d="M111 77v-8l7-2v9m-7-5 7-2" fill="none" stroke="currentColor" stroke-width="1.2"/><ellipse cx="109" cy="78" rx="2.3" ry="1.6"/><ellipse cx="116" cy="77" rx="2.3" ry="1.6"/><path d="M124 59v-7l5-1v3l-4 1v5Z"/><ellipse cx="122.5" cy="60" rx="2.1" ry="1.4"/></g>
 <g class="momo-sleep-marks" fill="#8a83bb" aria-hidden="true"><text x="106" y="45" font-size="8" font-family="system-ui">z</text><text x="114" y="34" font-size="11" font-family="system-ui">z</text><text x="124" y="20" font-size="14" font-family="system-ui">Z</text></g>
 <path class="momo-surprise-mark" d="m109 39 2-8m-1 12h.1m7-8 4-5" fill="none" stroke="#e9aa62" stroke-width="2" stroke-linecap="round"/>
 </svg>`;
  }
  function mount(container) {
    const art = container?.querySelector('.momo-anime-art'),
      source = art?.querySelector('.momo-part-image')?.getAttribute('href');
    if (!art || !source) return;
    art.dataset.artReady = 'false';
    const image = new root.Image();
    image.onload = () => {
      art.dataset.artReady = 'true';
    };
    image.onerror = () => {
      art.dataset.artReady = 'false';
    };
    image.src = source;
  }
  root.WorkHubMomoArt = Object.freeze({ svg, accessory, mount, umbrella });
})(window);
