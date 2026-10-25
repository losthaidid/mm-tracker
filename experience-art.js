/** Small code-native illustrations; no raster downloads or audio analysis. */
(function (root) {
  'use strict';
  function observatory() {
    return `<div class="observatory-art" aria-hidden="true"><div class="obs-stars"></div><div class="obs-stars far"></div><i class="obs-shooting"></i><div class="obs-moon"></div><svg viewBox="0 0 600 500"><path class="obs-cloud" d="M-50 165q70-30 150-8t160-7q55-15 100 8v18H-50Z" fill="#9cbac1" opacity=".13"/><path d="M0 440 125 350 250 430 410 320 600 430V500H0" fill="#344b65"/><path d="M0 474 160 412 350 465 600 402V500H0" fill="#203a4f"/><path class="obs-ground-mist" d="M-50 443q130-22 300 2t410-9v30H-50Z" fill="#a8c3cc" opacity=".13"/><path d="M158 300h284v130H158Z" fill="#4e7282"/><path d="M167 325h266m-266 16h266" stroke="#88a5ae" stroke-width="3"/><path class="obs-window" d="M276 430v-65a24 24 0 0 1 48 0v65" fill="#e6c88a"/><g class="obs-dome"><path d="M158 300a142 142 0 0 1 284 0" fill="#718d9e" stroke="#bad0d6" stroke-width="4"/><path d="M281 162v138h39V162" fill="#172f49"/></g><path d="m295 322-38 78m38-78 34 78m-34-78v81" stroke="#b0c6c9" stroke-width="6"/><g class="obs-telescope"><path d="m282 309 43-58 59-30 15 28-61 30-42 48Z" fill="#c1d8d7" stroke="#27465b" stroke-width="4"/><path d="m382 214 23 42" stroke="#edd4a1" stroke-width="12"/><path class="obs-lens" d="m383 216 19 36" stroke="#ecf6d4" stroke-width="4"/></g><g class="obs-grass" stroke="#86a7a4" stroke-width="3" fill="none"><path d="M83 476q-8-34-23-39m23 39q8-43 26-56m-26 56v-40"/><path d="M508 477q-9-34-25-41m25 41q6-32 21-42"/></g></svg><span>A LITTLE SPACE BENEATH THE STARS</span></div>`;
  }
  function habitat() {
    return `<svg class="experience-habitat" viewBox="0 0 100 80" aria-hidden="true"><path d="M8 31 50 4l42 27v44H8Z" fill="#ede4cd" stroke="#698b78" stroke-width="2"/><path d="M3 33 50 2l47 31" stroke="#789583" stroke-width="6" stroke-linecap="round"/><path d="M43 75V44h27v31" fill="#d0b997"/><g class="habitat-lamp"><path d="M21 67V41m-9 3h18l-4-13H16Z" stroke="#ae8c5c" stroke-width="2" fill="#f1d894"/></g><g class="habitat-book"><path d="M33 60q10-4 17 1 8-5 17-1v9q-10-3-17 1-9-4-17-1Z" fill="#fffaf0" stroke="#789583"/></g><g class="habitat-cushion"><ellipse cx="52" cy="68" rx="21" ry="6" fill="#aec4ad"/></g><g class="habitat-sleep"><text x="46" y="47" fill="#70878d" font-size="13">z</text><text x="59" y="35" fill="#70878d" font-size="10">z</text></g><path d="M79 70V47m0 11q-16-5-12-13 13 1 12 13m0-5q2-14 12-14 3 11-12 14" stroke="#72947c" stroke-width="2" fill="#a7bf98"/></svg><span class="momo-home-grip" aria-hidden="true">⠿</span>`;
  }
  function sound(kind) {
    const motifs = {
      rain: '<path class="sx-rain" d="m20 10-5 20m40-25-5 20m40-10-5 20m-60 20-5 20m40-25-5 20m40-10-5 20"/>',
      cafe: '<path d="M35 40h48v30a10 10 0 0 1-10 10H45a10 10 0 0 1-10-10Zm48 5h9a10 10 0 0 1 0 20h-9"/><path class="sx-steam" d="M45 30c-10-12 8-12 0-24m20 24c-10-12 8-12 0-24"/>',
      forest:
        '<g class="sx-leaves"><path d="M60 82V27m0 30Q18 60 23 28 57 27 60 57m0-14Q99 47 98 15 67 11 60 43"/></g>',
      fireplace:
        '<path d="M20 85V20h80v65M30 85V35h60v50"/><path class="sx-flame" d="M43 80Q28 65 53 42q-2 15 8 15l9-20Q95 70 72 80Z"/>',
      lofi: '<g class="sx-record"><circle cx="60" cy="50" r="36"/><circle cx="60" cy="50" r="13"/><path d="M60 21a29 29 0 0 1 29 29M60 79a29 29 0 0 1-29-29"/></g>',
      rest: '<path d="M86 15a36 36 0 1 0 16 58A36 36 0 0 1 86 15Z"/><path class="sx-steam" d="m20 20 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
    };
    return `<svg viewBox="0 0 120 100" aria-hidden="true">${motifs[kind] || motifs.lofi}</svg>`;
  }
  root.WorkHubExperienceArt = { observatory, habitat, sound };
})(window);
