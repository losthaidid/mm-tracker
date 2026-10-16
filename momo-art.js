/* Momo's small, locally rendered SVG character. No images or network requests. */
(function (global) {
  'use strict';

  function accessory(name) {
    switch (name) {
      case 'glasses':
        return '<g class="momo-glasses" fill="none" stroke="#38617b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M28 70l8 3m69 0 8-3"/><rect x="33" y="61" width="33" height="29" rx="12" fill="#ddfaff" fill-opacity=".07"/><rect x="74" y="61" width="33" height="29" rx="12" fill="#ddfaff" fill-opacity=".07"/><path d="M66 72q4-4 8 0"/><path d="M38 66h11m30 0h10" stroke="#fff" stroke-opacity=".8" stroke-width="1.3"/></g>';
      case 'helmet':
        return '<g class="momo-helmet" stroke="#956326" stroke-width="1.7" stroke-linejoin="round"><path d="M35 43c0-23 15-34 35-34s35 11 35 34" fill="url(#momo-helmet)"/><path d="M64 12q6-4 12 0v29H64Z" fill="#ffe9a0"/><path d="M30 42q40-9 80 0v7q-40-5-80 0Z" fill="#ffc868"/><path d="M43 32q2-11 13-15" fill="none" stroke="#fff3ce" stroke-width="4" stroke-linecap="round"/></g>';
      case 'party':
        return '<g class="momo-party" stroke="#9b526d" stroke-width="1.5" stroke-linejoin="round"><path d="M47 36 73 3l15 38q-21 1-41-5Z" fill="url(#momo-party)"/><path d="m62 18 16 8m-23 1 27 9" stroke="#ffedb0" stroke-width="4"/><path d="M46 36q22-1 42 5" fill="none" stroke="#fff0d1" stroke-width="4" stroke-linecap="round"/><circle cx="73" cy="5" r="5" fill="#ffdd85" stroke="#d8a749"/></g>';
      default:
        return '';
    }
  }

  function svg(name) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 155" width="112" height="124" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="momo-body" cx=".32" cy=".22" r=".86">
          <stop offset="0" stop-color="#dbfff0"/>
          <stop offset=".3" stop-color="#a5ecda"/>
          <stop offset=".67" stop-color="#6fd2c6"/>
          <stop offset="1" stop-color="#42afa9"/>
        </radialGradient>
        <radialGradient id="momo-belly" cx=".35" cy=".2" r=".9">
          <stop offset="0" stop-color="#faffed"/>
          <stop offset=".65" stop-color="#e1f8d9"/>
          <stop offset="1" stop-color="#b4e5ce"/>
        </radialGradient>
        <linearGradient id="momo-limb" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#b6f3df"/><stop offset="1" stop-color="#59bfb6"/>
        </linearGradient>
        <linearGradient id="momo-ear" x1="0" y1="0" x2=".7" y2="1">
          <stop stop-color="#ffd3ce"/><stop offset="1" stop-color="#eaa9b1"/>
        </linearGradient>
        <radialGradient id="momo-eye-glass" cx=".32" cy=".2" r=".9">
          <stop stop-color="#456e86"/><stop offset=".45" stop-color="#203d58"/>
          <stop offset=".8" stop-color="#10283f"/><stop offset="1" stop-color="#37637b"/>
        </radialGradient>
        <radialGradient id="momo-iris" cx=".5" cy=".85" r=".8">
          <stop stop-color="#68b4c0"/><stop offset=".5" stop-color="#305c7b"/>
          <stop offset="1" stop-color="#10263c"/>
        </radialGradient>
        <radialGradient id="momo-blush">
          <stop stop-color="#f99cac" stop-opacity=".65"/>
          <stop offset="1" stop-color="#f99cac" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="momo-helmet" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#ffdf88"/><stop offset="1" stop-color="#eeab44"/>
        </linearGradient>
        <linearGradient id="momo-party" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#ffb8d7"/><stop offset="1" stop-color="#c87faf"/>
        </linearGradient>
        <radialGradient id="momo-ground">
          <stop stop-color="#234954" stop-opacity=".22"/>
          <stop offset="1" stop-color="#234954" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse class="momo-shadow" cx="71" cy="147" rx="45" ry="7" fill="url(#momo-ground)"/>
      <g class="pet-body">
        <path class="momo-tail" d="M108 119c18 9 25-3 21-12-3-6-8-4-8 0 0 5-6 7-12 1" fill="url(#momo-limb)" stroke="#399c99" stroke-width="2" stroke-linecap="round"/>
        <g class="momo-ear-left">
          <path d="M31 49C23 39 20 18 27 13c5-3 19 9 25 22" fill="url(#momo-body)" stroke="#399c99" stroke-width="2" stroke-linejoin="round"/>
          <path d="M32 37c-3-8-5-15-3-17 2-1 11 7 14 14" fill="url(#momo-ear)"/>
          <path d="M26 26q-1-8 2-9" fill="none" stroke="#efffef" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
        </g>
        <g class="momo-ear-right">
          <path d="M90 33c7-11 18-21 23-17 6 5 2 24-6 36" fill="url(#momo-body)" stroke="#399c99" stroke-width="2" stroke-linejoin="round"/>
          <path d="M99 35c4-7 10-13 12-12 2 2-1 11-4 17" fill="url(#momo-ear)"/>
        </g>
        <path class="momo-foot-left" d="M44 127c-9 1-12 10-9 14 3 4 20 3 23-1l2-13" fill="url(#momo-limb)" stroke="#399c99" stroke-width="2"/>
        <path class="momo-foot-right" d="M85 128v11c4 5 19 6 22 1 3-5-3-12-11-13" fill="url(#momo-limb)" stroke="#399c99" stroke-width="2"/>
        <path d="M70 28c24-1 42 12 47 33 4 16 0 26-1 37 0 20-9 36-30 40-11 2-24 2-35-1-19-5-27-19-26-37 0-10-7-22-3-38 5-21 23-34 48-34Z" fill="url(#momo-body)" stroke="#399c99" stroke-width="2" stroke-linejoin="round"/>
        <path d="M30 62c5-17 17-26 33-28" fill="none" stroke="#edfff0" stroke-width="5" stroke-linecap="round" opacity=".8"/>
        <path d="M111 91c1 24-7 35-24 39" fill="none" stroke="#36a8a2" stroke-width="5" stroke-linecap="round" opacity=".23"/>
        <ellipse class="momo-belly" cx="70" cy="114" rx="27" ry="20" fill="url(#momo-belly)"/>
        <path d="M52 107q11-9 23-7" fill="none" stroke="#fffef3" stroke-width="2" stroke-linecap="round" opacity=".65"/>
        <ellipse class="momo-cheek" cx="32" cy="87" rx="12" ry="9" fill="url(#momo-blush)"/>
        <ellipse class="momo-cheek" cx="109" cy="87" rx="12" ry="9" fill="url(#momo-blush)"/>
        <g class="momo-brows" fill="none" stroke="#398d91" stroke-width="2.3" stroke-linecap="round">
          <path d="M39 52q6-5 12-2"/><path d="M86 50q6-2 12 3"/>
        </g>
        <g class="pet-eye"><g class="momo-eye-left">
          <ellipse cx="49" cy="74" rx="15" ry="18" fill="#e1fff1" fill-opacity=".5"/>
          <ellipse cx="49" cy="74" rx="13.5" ry="16.5" fill="url(#momo-eye-glass)" stroke="#2d6877" stroke-width=".8"/>
          <g class="momo-pupils" style="transform:translate(var(--momo-look-x,0px),var(--momo-look-y,0px));transform-box:fill-box;transform-origin:center">
            <ellipse cx="49" cy="76" rx="9.3" ry="11.8" fill="url(#momo-iris)"/>
            <ellipse cx="49" cy="73.5" rx="6.1" ry="9" fill="#102337"/>
            <ellipse cx="45.6" cy="66.5" rx="4" ry="4.8" fill="#fff"/>
            <circle cx="53.5" cy="79.5" r="2.1" fill="#d5f8ff" fill-opacity=".95"/>
          </g>
          <path d="M41 83q7 7 14 0" fill="none" stroke="#92dce0" stroke-width="1" stroke-linecap="round" opacity=".55"/>
          </g><g class="momo-eye-right"><ellipse cx="91" cy="74" rx="15" ry="18" fill="#e1fff1" fill-opacity=".5"/>
          <ellipse cx="91" cy="74" rx="13.5" ry="16.5" fill="url(#momo-eye-glass)" stroke="#2d6877" stroke-width=".8"/>
          <g class="momo-pupils" style="transform:translate(var(--momo-look-x,0px),var(--momo-look-y,0px));transform-box:fill-box;transform-origin:center">
            <ellipse cx="91" cy="76" rx="9.3" ry="11.8" fill="url(#momo-iris)"/>
            <ellipse cx="91" cy="73.5" rx="6.1" ry="9" fill="#102337"/>
            <ellipse cx="87.6" cy="66.5" rx="4" ry="4.8" fill="#fff"/>
            <circle cx="95.5" cy="79.5" r="2.1" fill="#d5f8ff" fill-opacity=".95"/>
          </g>
          <path d="M83 83q7 7 14 0" fill="none" stroke="#92dce0" stroke-width="1" stroke-linecap="round" opacity=".55"/>
        </g></g>
        <g class="momo-eye-smiles" fill="none" stroke="#285a69" stroke-width="3" stroke-linecap="round"><path d="M38 76q11-13 22 0"/><path d="M80 76q11-13 22 0"/></g>
        <path class="momo-eye-wink" d="M80 76q11-9 22 0" fill="none" stroke="#285a69" stroke-width="3" stroke-linecap="round"/>
        <g class="momo-dizzy-eyes" fill="none" stroke="#285a69" stroke-width="2.7" stroke-linecap="round"><path d="m40 67 18 15m0-15-18 15m42-15 18 15m0-15-18 15"/></g>
        <path class="momo-nose" d="M66 85q4-2 8 0l-4 4Z" fill="#397981"/>
        <path class="pet-mouth" d="M62 92q4 5 8 0 4 5 8 0" fill="none" stroke="#2e6570" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="momo-mouth-grin"><path d="M60 92q10 4 20 0c-1 15-19 15-20 0Z" fill="#285769" stroke="#2e6570" stroke-width="1.6"/><path d="M64 101q6-6 12 0" fill="#f7a1b0"/></g>
        <ellipse class="momo-mouth-o" cx="70" cy="97" rx="4.5" ry="6" fill="#285769"/>
        <path class="momo-tongue" d="M66 95h8v6a4 4 0 01-8 0Z" fill="#f5a1b3" stroke="#b96483" stroke-width="1.2"/>
        <g class="momo-sparkles" fill="#ffc95d" stroke="#e0a53c" stroke-width=".6"><path d="m18 49 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/><path d="m119 47 1.5-5 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5Z"/></g>
        <path class="momo-sweat" d="M112 52q11 13 1 14-8-1-1-14Z" fill="#a9e2ff" stroke="#5b9dbe" stroke-width="1"/>
        <g class="momo-arm-left">
          <path d="M28 102C15 106 9 96 14 88c3-4 6-2 6 2 0 4 3 6 8 4" fill="url(#momo-limb)" stroke="#399c99" stroke-width="2" stroke-linecap="round"/>
          <path d="m14 91 3 1m-3 3 3 1" stroke="#e4fff0" stroke-width="1.6" stroke-linecap="round"/>
        </g>
        <g class="momo-arm-right">
          <path d="M113 98c10 3 13-4 11-11-2-5-6-4-6 1 0 3-1 4-4 3" fill="url(#momo-limb)" stroke="#399c99" stroke-width="2" stroke-linecap="round"/>
          <path d="m121 88 3 1m-3 3 3 1" stroke="#e4fff0" stroke-width="1.6" stroke-linecap="round"/>
        </g>
        <g id="hubPetAccessory">${accessory(name || 'glasses')}</g>
        <g class="momo-headphones" stroke="#6d5993" stroke-width="2" stroke-linejoin="round"><path d="M27 76V65a43 39 0 0186 0v11" fill="none" stroke="#b29bd4" stroke-width="5"/><rect x="21" y="67" width="13" height="25" rx="6" fill="#cdb8e8"/><rect x="107" y="67" width="13" height="25" rx="6" fill="#cdb8e8"/><path d="M25 73v12m91-12v12" stroke="#ede2fb" stroke-width="2.5" stroke-linecap="round"/></g>
      </g>
    </svg>`;
  }

  global.WorkHubMomoArt = Object.freeze({svg: svg, accessory: accessory});
})(window);
