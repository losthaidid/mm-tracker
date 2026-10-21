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
    return `<svg class="momo-umbrella-back" viewBox="0 0 100 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M50 4v102" fill="none" stroke="#35566c" stroke-width="2.2" stroke-linecap="round"/>
 <path d="M5 39a45 35 0 0190 0q-12-10-23 0-12-10-22 0-12-10-23 0-12-10-22 0" fill="#c5b7ef" stroke="#35566c" stroke-width="2"/>
 <path d="M50 5q-22 12-23 34M50 5q22 12 22 34" fill="none" stroke="#8a78ba" stroke-width="2"/>
</svg><svg class="momo-umbrella-front" viewBox="0 0 100 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id="momo-umbrella-sleeve" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b7dacb"/><stop offset=".45" stop-color="#85b5a5"/><stop offset="1" stop-color="#477b70"/></linearGradient>
  <radialGradient id="momo-umbrella-skin" cx="35%" cy="25%"><stop stop-color="#ffe5cf"/><stop offset=".7" stop-color="#f6c7ab"/><stop offset="1" stop-color="#dca58e"/></radialGradient>
 </defs>
 <path class="momo-umbrella-shaft" d="M50 102v20q0 14 10 7" fill="none" stroke="#35566c" stroke-width="2.2" stroke-linecap="round"/>
 <g class="momo-umbrella-grip">
  <path class="momo-umbrella-sleeve" d="M56 98q6-1 8 9l3 8q0 5-4 5-3 1-6-2l-8-6q-3-3 0-6l4-1 6 5-3-7Z" fill="url(#momo-umbrella-sleeve)" stroke="#527f73" stroke-width=".7" stroke-linejoin="round"/>
  <path d="m60 103 2 7m-4 5 5 2" fill="none" stroke="#d3e8db" stroke-width=".9" stroke-linecap="round" opacity=".7"/>
  <path d="m48 111 6-1 3 4-5 3-5-3Z" fill="url(#momo-umbrella-sleeve)" stroke="#527f73" stroke-width=".7"/>
  <g class="momo-umbrella-hand" fill="url(#momo-umbrella-skin)" stroke="#c5917f" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round">
   <path d="M48 101q-3 0-3 3v5q0 4 4 4h3q3-1 3-4v-4q-1-3-3-3Z"/>
   <path d="M49 104q-4-3-4 1l1 5q1 2 3 1l2-4"/>
   <path d="m49 105 4 .3m-4 2.4 4 .3m-3 2.3h2.5" fill="none" opacity=".8"/>
   <path d="m47 103 3-.3" fill="none" stroke="#fff0df" stroke-width=".9"/>
  </g>
 </g>
</svg>`;
  }
  function accessory(name) {
    if (name === 'none') return '';
    if (name === 'helmet')
      return '<path d="M39 37a31 29 0 0162 0H39" fill="#f2c362" stroke="#9c753b" stroke-width="1.2"/><path d="M36 37h68M70 12v19" stroke="#ffe8a6" stroke-width="4" stroke-linecap="round"/>';
    if (name === 'partyhat')
      return '<path d="M48 20L66-4 86 19Z" fill="#c4adf0" stroke="#765d9c"/><path d="m52 16 25-6m-20 1 12-9" stroke="#f7d486" stroke-width="3"/><circle cx="66" cy="-3" r="4" fill="#f4b8c9"/>';
    return '<g fill="none" stroke="#594e54" stroke-width=".9"><rect x="50.7" y="48.9" width="14.1" height="10.8" rx="4.2"/><rect x="74.4" y="48" width="14.1" height="10.8" rx="4.2"/><path d="M65 53.5q4.5-2.8 9.3-.5m-24-.6-6-1m44-1 6-1"/></g>';
  }
  function svg(name = 'glasses') {
    // Keep each raster image in its rendered viewport. A shared image in <defs>
    // can become Chromium's broken-image placeholder when cloned with <use>.
    const part = (cls, source, target, clip = '') =>
      `<g class="${cls}"><svg x="${target[0]}" y="${target[1]}" width="${target[2]}" height="${target[3]}" viewBox="${source.join(' ')}" preserveAspectRatio="none" overflow="hidden" style="width:${target[2]}px;height:${target[3]}px;overflow:hidden;filter:none"><g${clip ? ` clip-path="url(#${clip})"` : ''}><image class="momo-part-image" href="${ATLAS}" width="1024" height="1536"/></g></svg></g>`;
    const eye = (side, x, y) =>
      `<g class="momo-eye-${side}"><g clip-path="url(#momo-eye-clip-${side})"><g class="momo-pupils"><ellipse cx="${x}" cy="${y + 0.6}" rx="3.75" ry="4.65" fill="url(#momo-iris)"/><ellipse cx="${x}" cy="${y}" rx="1.85" ry="3.1" fill="#182b34"/><ellipse cx="${x - 1.2}" cy="${y - 2.4}" rx="1.45" ry="1.7" fill="#fff"/><circle cx="${x + 1.6}" cy="${y + 2.4}" r=".7" fill="#d5ffff"/></g></g></g>`;
    return `<svg class="momo-anime-art" data-art-ready="false" viewBox="0 0 140 155" role="img" aria-label="Momo, an original anime boy in a mint hoodie" xmlns="http://www.w3.org/2000/svg">
 <defs>
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
  ${part('momo-arm-left', [158, 515, 198, 467], [36, 78, 20, 47], 'momo-arm-left-clip')}
  ${part('momo-arm-right', [668, 515, 199, 467], [84, 78, 20, 47], 'momo-arm-right-clip')}
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
   <g class="momo-headphones" fill="#cdb8e8" stroke="#6d5993" stroke-width="1.1"><path d="M38 50V35a32 30 0 0164 0v15" fill="none" stroke="#b29bd4" stroke-width="3"/><rect x="35" y="45" width="6" height="15" rx="3"/><rect x="99" y="44" width="6" height="15" rx="3"/></g>
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
