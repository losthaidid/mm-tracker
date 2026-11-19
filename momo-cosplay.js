/** Local, account-scoped wardrobe rotation and finite character routines; never writes to Supabase. */
(function (root) {
  'use strict';
  const data = root.WorkHubMomoCosplayData;
  const series = new Map(data.SERIES.map(row => [row.id, row]));
  const looks = data.CHARACTERS.flatMap(character =>
    character.outfits.map(outfit => ({
      key: character.id + '/' + outfit.id,
      character,
      outfit,
      series: series.get(character.seriesId),
    }))
  );
  const byKey = new Map(looks.map(row => [row.key, row]));
  const STORE = 'mm-tracker.momo-cosplay.v1:';
  const runtime = { owner: null, current: null, recent: [], nextRotation: 0 };
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const enabled = p => p.cosplayEnabled !== false;
  const delayRotation = () => Date.now() + 480000 + Math.random() * 240000;
  function save() {
    if (!runtime.owner || !runtime.current) return;
    try {
      root.localStorage.setItem(
        STORE + runtime.owner,
        JSON.stringify({ key: runtime.current.key, recent: runtime.recent.slice(-8) })
      );
    } catch (_) {
      /* Local storage may be unavailable. */
    }
  }
  function choose() {
    const candidates = looks.filter(
      row => row.character.id !== runtime.current?.character.id && !runtime.recent.includes(row.key)
    );
    runtime.current = candidates[Math.floor(Math.random() * candidates.length)];
    runtime.recent = [...runtime.recent, runtime.current.key].slice(-8);
    runtime.nextRotation = delayRotation();
    save();
    return runtime.current;
  }
  function ensure(owner) {
    if (runtime.owner === owner) return runtime.current;
    runtime.owner = owner || '';
    runtime.current = null;
    runtime.recent = [];
    if (!owner) return null;
    try {
      const stored = JSON.parse(root.localStorage.getItem(STORE + owner) || 'null');
      runtime.current = byKey.get(stored?.key) || null;
      runtime.recent = Array.isArray(stored?.recent)
        ? stored.recent.filter(key => byKey.has(key)).slice(-8)
        : [];
    } catch (_) {
      /* Ignore stale local data. */
    }
    if (!runtime.current) choose();
    runtime.nextRotation = delayRotation();
    return runtime.current;
  }
  function apply(p, owner) {
    const pet = document.getElementById('hubPet');
    if (!enabled(p) || !owner) {
      root.WorkHubMomoCosplayArt.clear(pet);
      if (!owner) ensure('');
      return false;
    }
    const current = ensure(owner);
    return root.WorkHubMomoCosplayArt.render(pet, current, p.mascotName || 'Momo');
  }
  function validate(p) {
    for (const key of ['cosplayEnabled', 'cosplayMoves'])
      if (p[key] !== undefined && typeof p[key] !== 'boolean')
        throw Error('Check automatic cosplay and character moves.');
  }
  function fields(p) {
    return `<label class="hub-check"><input type="checkbox" name="cosplayEnabled"${enabled(p) ? ' checked' : ''}> Automatic anime & cartoon outfits</label><label class="hub-check"><input type="checkbox" name="cosplayMoves"${p.cosplayMoves !== false ? ' checked' : ''}> Character moves & temporary transformations</label><p class="hub-meta">Surprise outfits from 40 collections, with matching clothes and accessories. Changes wait for a quiet moment every 8–12 minutes. Turn off automatic cosplay to use the wardrobe below.</p>`;
  }
  const PROFILES = {
    stretch: ['Rubber-arm stretch', 'stretch', 6400],
    gear2: ['Gear Two · steam stance', 'power', 7000],
    gear4: ['Gear Four · bound pose', 'bound', 7200],
    gear5: ['Gear Five · cloud bounce', 'bounce', 8000],
    'super-saiyan': ['Super Saiyan transformation', 'power', 7500],
    'saiyan-blue': ['Super Saiyan Blue transformation', 'power', 7500],
    'ultra-instinct': ['Ultra Instinct dodge', 'dodge', 8000],
    'sword-flurry': ['Sword flourish', 'swords', 6500],
    'three-sword': ['Three-sword stance', 'swords', 7000],
    kick: ['Aerial kick practice', 'kick', 6500],
    'flame-kick': ['Flame-kick practice', 'kick', 7000],
    ninja: ['Shadow-step hand signs', 'ninja', 6500],
    spell: ['A little magic', 'spell', 6500],
    elemental: ['Element-bending forms', 'element', 7000],
    lightning: ['Lightning pose', 'power', 6000],
    wave: ['Friendly wave', 'wave', 5000],
    dance: ['Character dance', 'dance', 7000],
    flight: ['Hover pose', 'float', 6500],
    detective: ['Look for clues', 'inspect', 6500],
    cook: ['Kitchen flourish', 'cook', 6500],
    science: ['A tiny experiment', 'science', 6500],
    sport: ['Warm-up practice', 'sport', 6500],
    speed: ['Quick-foot shuffle', 'speed', 6000],
    mischief: ['Playful tiptoe', 'mischief', 6000],
    music: ['Musical sway', 'music', 7000],
    gentle: ['A gentle greeting', 'gentle', 6500],
    hero: ['Hero pose', 'hero', 6000],
    alchemy: ['Alchemy hand clap', 'alchemy', 6500],
    robot: ['Robot routine', 'robot', 6500],
    elastic: ['Squash-and-stretch bounce', 'elastic', 6500],
    portal: ['Portal peek', 'portal', 6500],
  };
  function install(a) {
    let owner = '',
      active = null,
      lastInteraction = Date.now() - 20000;
    let nextMove = Date.now() + 60000,
      pendingRotation = false,
      lastMove = '';
    const pet = () => document.getElementById('hubPet');
    const motion = () =>
      a.prefs().motion !== 'off' &&
      a.prefs().cosplayMoves !== false &&
      !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    function safeBase() {
      const p = a.prefs(),
        node = pet();
      return !!(
        a.ready() &&
        a.owner() &&
        enabled(p) &&
        p.mascot &&
        node?.querySelector('.momo-anime-art') &&
        !node.hidden &&
        node.style.display !== 'none' &&
        !document.hidden &&
        !document.body.matches(
          '.hub-private,.hub-present,.hub-focus,.rest-room-open,.presentation-break-open,.lab-drag-active,.hub-sorting'
        ) &&
        !node.dataset.umbrella &&
        !node.matches('[data-pose="umbrella"],[data-pose="drag"],[data-pose="sleep"]') &&
        !document.querySelector(
          'dialog[open],#hubMomoMenu:not([hidden]),details[open]#sectionsMenu'
        ) &&
        !document.activeElement?.matches(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
        ) &&
        !a.life()?.sleeping()
      );
    }
    function available() {
      const life = a.life();
      return (
        safeBase() &&
        !!life &&
        !life.busy() &&
        life.sceneAvailable() &&
        life.hobbyAvailable?.() !== false
      );
    }
    function finish() {
      if (!active) return;
      active = null;
      pet()?.removeAttribute('data-cosplay-move');
      pet()?.removeAttribute('data-cosplay-motion');
      root.WorkHubMomoCosplayArt.transform(pet(), null);
      a.life()?.releaseScene?.('cosplay');
      nextMove = Date.now() + 75000 + Math.random() * 75000;
    }
    function play(auto = false) {
      mount();
      if (!motion() || !available() || (auto && Date.now() - lastInteraction < 12000)) return false;
      const current = ensure(owner);
      if (!current) return false;
      const choices = current.character.moves.filter(id => id !== lastMove);
      const moves = choices.length ? choices : current.character.moves;
      const move = moves[Math.floor(Math.random() * moves.length)];
      const profile = PROFILES[move];
      if (
        !profile ||
        a.life().scene({ pose: 'cosplay', expression: 'delighted', source: 'cosplay' }) === false
      )
        return false;
      lastMove = move;
      active = { move, until: Date.now() + profile[2] };
      pet().dataset.cosplayMove = move;
      pet().dataset.cosplayMotion = profile[1];
      root.WorkHubMomoCosplayArt.transform(pet(), move);
      if (!auto) a.tell(`${current.character.name} · ${profile[0]}`);
      return true;
    }
    function rotate() {
      mount();
      pendingRotation = true;
      if (!available()) return false;
      choose();
      apply(a.prefs(), owner);
      pendingRotation = false;
      nextMove = Date.now() + 45000;
      return true;
    }
    function mount() {
      const currentOwner = a.ready() ? a.owner() : '';
      if (owner !== currentOwner) {
        finish();
        owner = currentOwner;
        pendingRotation = false;
        lastMove = '';
        nextMove = Date.now() + 60000;
        ensure(owner);
        root.WorkHubMomoCosplayArt.clear(pet());
      }
      if (!enabled(a.prefs())) {
        finish();
        pendingRotation = false;
      }
      apply(a.prefs(), owner);
    }
    function tick() {
      mount();
      if (active) {
        if (
          !safeBase() ||
          !motion() ||
          Date.now() >= active.until ||
          !pet()?.dataset.cosplayMove ||
          (a.life()?.sceneOwner && a.life().sceneOwner() !== 'cosplay')
        )
          finish();
        return;
      }
      if (!owner || !available() || Date.now() - lastInteraction < 12000) return;
      if (pendingRotation || Date.now() >= runtime.nextRotation) rotate();
      else if (Date.now() >= nextMove) {
        nextMove = Date.now() + 30000;
        play(true);
      }
    }
    function interact() {
      lastInteraction = Date.now();
      finish();
    }
    for (const type of ['pointerdown', 'keydown', 'focusin', 'wheel', 'scroll'])
      document.addEventListener(type, interact, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      interact();
    });
    root.addEventListener('pagehide', interact);
    const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    reduced?.addEventListener?.('change', () => {
      if (reduced.matches) finish();
    });
    return {
      mount,
      tick,
      play,
      rotate,
      finish,
      snapshot: () => ({
        active: active?.move || null,
        look: owner && enabled(a.prefs()) ? runtime.current : null,
        pendingRotation,
      }),
      gallery: () => {
        const current = ensure(owner);
        return `<span class="hub-kicker">AUTOMATIC COSPLAY</span><h3>${current ? esc(current.character.name) + ' · ' + esc(current.outfit.label) : 'Anime & cartoon wardrobe'}</h3><p>${current ? esc(current.series.name) + '. ' : ''}40 collections · 200 characters · 600 coordinated looks. Each character has three outfit variations with matching accessories. Your companion picks a new character at quiet intervals, without needing you to choose.</p><p>Character moves are brief and stay in his corner. They pause for your work, respect reduced motion, and never wake a requested nap.</p><div class="actions"><button type="button" data-momo-style="cosplay-random">Another random outfit</button><button type="button" data-momo-style="cosplay-move">Try his character move</button><button type="button" data-momo-style="appearance">Appearance settings</button></div>`;
      },
    };
  }
  root.WorkHubMomoCosplay = { apply, validate, fields, install, enabled, PROFILES, looks };
})(window);
