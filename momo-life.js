/**
 * momo-life.js
 * Momo expressions, dragging, home and simple play.
 * Runs in the browser through the Studio adapter; it does not autosave movement.
 * Keep pause/cancel guards when adding behaviours so Momo can coexist with normal work.
 * File map: docs/FILE-MAP.md
 */
/* Momo's expressions, home and play run entirely in the browser. */
(function (root) {
  'use strict';
  function install(a) {
    const $ = id => document.getElementById(id),
      pet = () => a.pet(),
      motion = () =>
        a.prefs().motion !== 'off' &&
        !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let moving = 0,
      journey = null,
      restUntil = 0,
      nap = false,
      armed = false,
      perch = null,
      held = null,
      ballDrag = null,
      home = { x: 0.92, y: 0.84 },
      homeDrag = null,
      homeSuppress = 0,
      eyeFrame = 0,
      ballSuppress = 0,
      pointer = { x: 0, y: 0 },
      quiet = false,
      nextQuip = Date.now() + 45000 + Math.random() * 45000,
      lastQuip = -1;
    let sceneState = null,
      idleGesture = null,
      nextGesture = Date.now() + 45000 + Math.random() * 35000,
      lastGesture = '',
      reaction = null,
      nearCursor = false,
      nextStartle = 0,
      umbrellaUntil = 0,
      ballResumeUntil = 0,
      owner = null;
    function scene(value) {
      if (nap) return false;
      if (value) {
        endUmbrella();
        endGesture();
        reaction = null;
        cancelTravel();
        a.stop();
        nap = false;
        perch = null;
        sceneState = value;
        pose(value.pose || 'perch');
        if (value.expression) express(value.expression);
      } else if (sceneState) {
        sceneState = null;
        pose('idle');
        restUntil = Date.now() + 3000;
      }
    }
    const QUIPS = [
      ['stumble', 'dizzy', 'I tripped over a pixel. It was a very large pixel.'],
      ['sneeze', 'surprised', 'Achoo! Sorry. I’m allergic to Monday-shaped thoughts.'],
      ['wink', 'cheeky', 'My productivity method? Look cute. Offer moral support. Repeat.'],
      ['blep', 'cheeky', 'Brain buffering… please enjoy this tiny face.'],
      ['happy', 'delighted', 'I brought snacks. Then I ate the snacks. I brought enthusiasm!'],
      ['shy', 'shy', 'You do the clever work. I’ll supervise this extremely important corner.'],
      ['happy', 'delighted', 'One tiny step counts. Mine just comes with squeaky feet.'],
      ['wink', 'cheeky', 'I opened a new tab in my brain. There was a biscuit in it.'],
      ['stumble', 'dizzy', 'That was a dance move. A completely intentional floor inspection.'],
      ['shy', 'shy', 'If determination had ears, they would look a little like mine.'],
    ];
    QUIPS.push(
      ...[
        ['wink', 'cheeky', 'I have reorganised the air around this button. Much better.'],
        ['happy', 'delighted', 'A tiny win is still a win. I shall celebrate at a tiny volume.'],
        ['shy', 'shy', 'I practised being sensible. It lasted a respectable eleven seconds.'],
        ['blep', 'cheeky', 'Please hold. My last brain cell is fetching tea.'],
        [
          'happy',
          'delighted',
          'You handle the big plans. I will handle the small dramatic entrances.',
        ],
        ['wink', 'cheeky', 'This corner has excellent snack potential.'],
        ['stumble', 'dizzy', 'Gravity and I are having a friendly disagreement.'],
        ['sneeze', 'surprised', 'Achoo! A dust bunny filed a surprise visit.'],
        ['shy', 'shy', 'If this day gets complicated, we can still do one small thing.'],
        ['happy', 'delighted', 'I checked the clouds. No meetings scheduled up there.'],
        [
          'wink',
          'cheeky',
          'I would help with the spreadsheet, but my shoes keep clicking the cells.',
        ],
        ['blep', 'cheeky', 'My train of thought has stopped for a biscuit.'],
        ['happy', 'delighted', 'Your ideas have good company. Me. I am the company.'],
        ['wink', 'cheeky', 'One imaginary cup of tea, coming right up.'],
        ['shy', 'shy', 'A little pause can be part of making progress.'],
        ['happy', 'delighted', 'The window has changed again. Excellent work, sky department.'],
        ['stumble', 'dizzy', 'A graceful landing. From a very ungraceful beginning.'],
        ['wink', 'cheeky', 'I almost pulled that card off the page. It is surprisingly stretchy.'],
        ['happy', 'delighted', 'I am conducting important research into standing right here.'],
        ['blep', 'cheeky', 'New plan: tiny steps, fewer dramatic sighs.'],
        ['shy', 'shy', 'You have done difficult things before. I have seen the determined face.'],
        ['wink', 'cheeky', 'I ran across the screen and saved approximately zero seconds of work.'],
        ['happy', 'delighted', 'Some days call for a sprint. Some call for a cosy chair.'],
        ['shy', 'shy', 'You do not have to solve every loose end this minute.'],
        ['wink', 'cheeky', 'That visitor looked suspiciously qualified for the snack committee.'],
        ['happy', 'delighted', 'A round of applause! Mine is rather quiet, but heartfelt.'],
        ['blep', 'cheeky', 'I put my serious hat on. It slid over my eyes.'],
        ['happy', 'delighted', 'I found a pleasant pixel. I saved it a seat.'],
        ['shy', 'shy', 'If you need a nudge, I can find one useful next step.'],
        [
          'wink',
          'cheeky',
          'The ball says I am talented. The floor has requested a second opinion.',
        ],
      ]
    );
    try {
      quiet = localStorage.getItem('mm-tracker.momo-chatter.v1') === 'quiet';
    } catch {}
    try {
      const saved = JSON.parse(localStorage.getItem('mm-tracker.momo-home.v2') || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
        home = { x: Math.min(1, Math.max(0, saved.x)), y: Math.min(1, Math.max(0, saved.y)) };
      else {
        const old = JSON.parse(localStorage.getItem('mm-tracker.momo-home.v1') || 'null') || home,
          v = viewport(),
          size = v.w < 600 ? 80 : 96;
        setHomePixel(
          Math.min(v.w - 68, Math.max(8, 12 + old.x * Math.max(0, v.w - size - 24) + 14)) + v.x,
          Math.min(v.h - 58, Math.max(8, 12 + old.y * Math.max(0, v.h - size - 24) + 66)) + v.y
        );
      }
    } catch {}
    function viewport() {
      const v = root.visualViewport;
      return {
        w: v?.width || root.innerWidth || 375,
        h: v?.height || root.innerHeight || 667,
        x: v?.offsetLeft || 0,
        y: v?.offsetTop || 0,
      };
    }
    function safe() {
      return (
        a.ready() &&
        a.prefs().mascot &&
        !document.hidden &&
        !document.body.classList.contains('hub-present')
      );
    }
    function busy() {
      return (
        !!homeDrag ||
        !!sceneState ||
        !!idleGesture ||
        !!reaction ||
        !!journey ||
        nap ||
        armed ||
        Date.now() < restUntil ||
        !!held
      );
    }
    function express(value) {
      if (pet()) pet().dataset.expression = value;
    }
    function pose(value) {
      if (pet()) pet().dataset.pose = value;
      express(
        {
          happy: 'delighted',
          play: 'delighted',
          held: 'surprised',
          startled: 'surprised',
          annoyed: 'annoyed',
          land: 'shy',
          nap: 'sleepy',
          'idle-sleep': 'sleepy',
          stretch: 'sleepy',
          stumble: 'dizzy',
          sneeze: 'surprised',
          wink: 'cheeky',
          blep: 'cheeky',
          shy: 'shy',
        }[value] || 'curious'
      );
    }
    function endGesture() {
      if (!idleGesture) return;
      idleGesture = null;
      pet()?.removeAttribute('data-chair-phase');
      if (!nap && !held && !sceneState) pose('idle');
      nextGesture = Date.now() + 35000 + Math.random() * 65000;
    }
    function gesture(kind = '') {
      if (
        !safe() ||
        !motion() ||
        held ||
        journey ||
        nap ||
        sceneState ||
        document.body.matches('.hub-private,.hub-present,.hub-focus,.lab-drag-active') ||
        document.querySelector('dialog[open]') ||
        document.activeElement?.matches(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
        )
      )
        return false;
      endGesture();
      reaction = null;
      const types = [
        'sit',
        'yawn',
        'wave',
        'lookaround',
        'foot-tap',
        'little-stretch',
        'sleep',
        'daydream',
        'hair-tidy',
        'balance',
        'hop',
        'tiptoe',
        'hand-heart',
        'peek',
        'shadow-box',
        'toe-spin',
        'leaf-catch',
        'pocket-search',
      ];
      if (!types.includes(kind)) {
        kind = types[Math.floor(Math.random() * types.length)];
        if (kind === lastGesture) kind = types[(types.indexOf(kind) + 1) % types.length];
      }
      lastGesture = kind;
      a.stop();
      const duration =
        {
          sit: 15500,
          sleep: 18000,
          yawn: 4500,
          lookaround: 5500,
          daydream: 7000,
          'hair-tidy': 4800,
          balance: 5200,
        }[kind] || 4000;
      idleGesture = { kind, start: Date.now(), until: Date.now() + duration };
      pose('idle-' + kind);
      express(
        ['yawn', 'sleep'].includes(kind)
          ? 'sleepy'
          : kind === 'wave'
            ? 'delighted'
            : kind === 'sit'
              ? 'content'
              : 'curious'
      );
      if (kind === 'sit') pet().dataset.chairPhase = 'unfold';
      return true;
    }
    function gestureTick() {
      if (!idleGesture) return;
      const elapsed = Date.now() - idleGesture.start;
      if (idleGesture.kind === 'sit') {
        pet().dataset.chairPhase =
          elapsed < 1800
            ? 'unfold'
            : elapsed < 2700
              ? 'settle'
              : elapsed < 12500
                ? 'whistle'
                : 'fold';
      }
      if (idleGesture.kind === 'sleep' && Date.now() >= idleGesture.until - 2500) pose('stretch');
    }
    function startle(x, y, pointerType) {
      const el = pet();
      if (!el || pointerType === 'touch') return;
      const r = el.getBoundingClientRect(),
        size = r.width || parseFloat(el.style.width) || 128,
        left = r.width ? r.left : parseFloat(el.style.left) || 0,
        top = r.height ? r.top : parseFloat(el.style.top) || 0;
      const close =
          Math.hypot(
            (x - left - size * 0.5) / (size * 0.34 + 22),
            (y - top - size * 0.38) / (size * 0.3 + 22)
          ) < 1,
        entering = close && !nearCursor;
      nearCursor = close;
      if (
        !entering ||
        Date.now() < nextStartle ||
        !safe() ||
        !motion() ||
        busy() ||
        perch ||
        ballDrag ||
        $('hubMomoMenu') ||
        !$('hubPetBubble')?.hidden ||
        document.body.matches('.hub-private,.hub-focus,.lab-drag-active') ||
        document.querySelector('dialog[open]') ||
        document.activeElement?.matches(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
        )
      )
        return;
      a.stop();
      reaction = { until: Date.now() + 1800 };
      nextStartle = Date.now() + 20000;
      pose('startled');
      if (!quiet) a.react('busy', 'Oh! You startled me!', 2200);
    }
    function quip(contextual = false) {
      if (!safe() || nap) return;
      endGesture();
      reaction = null;
      cancelTravel();
      a.stop();
      nap = false;
      perch = null;
      let i = Math.floor(Math.random() * QUIPS.length);
      if (i === lastQuip) i = (i + 1) % QUIPS.length;
      lastQuip = i;
      const context = contextual ? a.contextLine?.() : '',
        [act, face, line] = context ? ['wink', 'cheeky', context] : QUIPS[i];
      pose(motion() ? act : 'idle');
      express(face);
      restUntil = Date.now() + 8000;
      nextQuip = Date.now() + 60000 + Math.random() * 60000;
      a.react('happy', line, 7000);
      if (['stumble', 'sneeze'].includes(act)) a.remember?.(act);
    }
    function cancelTravel(resumable = false) {
      if (resumable && journey?.purpose === 'ball' && $('hubMomoBall'))
        ballResumeUntil = Date.now() + 120000;
      if (moving) root.cancelAnimationFrame(moving);
      moving = 0;
      journey = null;
      pet()?.removeAttribute('data-travel-phase');
    }
    function travel(x, y, onDone = () => {}, duration = 1400, purpose = '') {
      if (nap && purpose !== 'home') return false;
      a.stop();
      cancelTravel();
      const el = pet();
      if (!el) return;
      const from = { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
      if (purpose !== 'ball') ballResumeUntil = 0;
      if (Math.abs(x - from.x) > 1) el.dataset.facing = x < from.x ? 'left' : 'right';
      if (!motion()) {
        a.move({ x, y });
        onDone();
        return;
      }
      journey = { from, to: { x, y }, start: root.performance.now(), duration, purpose };
      pose(umbrellaUntil ? 'umbrella-walk' : 'walk');
      function frame(t) {
        if (
          !journey ||
          !safe() ||
          document.querySelector('dialog[open]') ||
          document.activeElement?.matches('input,textarea,select')
        ) {
          cancelTravel(motion() && safe());
          pose(umbrellaUntil ? 'umbrella-rest' : 'idle');
          return;
        }
        const j = journey,
          q = Math.min(1, Math.max(0, (t - j.start) / j.duration)),
          e = root.WorkHubMomoBehaviourEngine.ease((q - 0.08) / 0.84);
        el.dataset.travelPhase = q < 0.08 ? 'turn' : q > 0.92 ? 'settle' : 'walk';
        a.move({ x: j.from.x + (j.to.x - j.from.x) * e, y: j.from.y + (j.to.y - j.from.y) * e });
        layout();
        if (q < 1) moving = root.requestAnimationFrame(frame);
        else {
          cancelTravel();
          pose(umbrellaUntil ? 'umbrella-rest' : 'idle');
          onDone();
        }
      }
      moving = root.requestAnimationFrame(frame);
    }
    function homeAnchor() {
      const v = viewport();
      return {
        x: v.x + 8 + home.x * Math.max(0, v.w - 76),
        y: v.y + 8 + home.y * Math.max(0, v.h - 66),
      };
    }
    function setHomePixel(x, y) {
      const v = viewport();
      home = {
        x: Math.min(1, Math.max(0, (x - v.x - 8) / Math.max(1, v.w - 76))),
        y: Math.min(1, Math.max(0, (y - v.y - 8) / Math.max(1, v.h - 66))),
      };
    }
    function persistHome() {
      try {
        localStorage.setItem('mm-tracker.momo-home.v2', JSON.stringify(home));
      } catch {}
    }
    function homePoint() {
      const v = viewport(),
        p = homeAnchor(),
        size = parseFloat(pet()?.style.width) || (v.w < 600 ? 112 : 144);
      return {
        x: Math.min(v.x + v.w - size - 12, Math.max(v.x + 12, p.x + (56 - size) / 2)),
        y: Math.min(v.y + v.h - size - 12, Math.max(v.y + 12, p.y - size + 20)),
      };
    }

    function goHome() {
      if (nap) return;
      endGesture();
      endUmbrella();
      reaction = null;
      nap = true;
      rememberNap();
      if ($('hubPetBubble')) $('hubPetBubble').hidden = true;
      armed = false;
      sceneState = null;
      ballResumeUntil = 0;
      perch = null;
      const p = homePoint();
      travel(
        p.x,
        p.y,
        () => {
          pose('nap');
        },
        1400,
        'home'
      );
    }
    function wake() {
      endGesture();
      nap = false;
      rememberNap();
      restUntil = Date.now() + 3000;
      reaction = { until: Date.now() + 1500 };
      pose('stretch');
      a.react('happy', 'I’m here. What shall we work on?');
    }
    function rememberNap() {
      if (!owner) return;
      try {
        const key = 'mm-tracker.momo-nap.v1:' + owner;
        if (nap) localStorage.setItem(key, 'sleeping');
        else localStorage.removeItem(key);
      } catch {}
    }
    function layout() {
      const habitat = $('hubMomoHome');
      if (habitat?.querySelector('.experience-habitat')) {
        const preference = a.habitat?.() || 'auto';
        habitat.dataset.habitat = nap
          ? 'sleeping'
          : preference === 'auto'
            ? idleGesture?.kind === 'sit'
              ? 'reading'
              : 'resting'
            : preference;
      }
      const el = pet(),
        v = viewport(),
        p = homeAnchor(),
        homeEl = $('hubMomoHome');
      if (homeEl) {
        homeEl.hidden = !safe();
        Object.assign(homeEl.style, { left: p.x + 'px', top: p.y + 'px' });
      }
      const menu = $('hubMomoMenu');
      if (menu && el) {
        const w = Math.min(280, v.w - 24),
          x = parseFloat(el.style.left) || 0,
          y = parseFloat(el.style.top) || 0;
        Object.assign(menu.style, {
          maxHeight: v.h - 24 + 'px',
          width: w + 'px',
          left:
            Math.max(v.x + 12, Math.min(v.x + v.w - w - 12, x + w > v.x + v.w ? x - w + 80 : x)) +
            'px',
          top:
            Math.max(
              v.y + 12,
              Math.min(
                v.y + v.h - Math.min(v.h - 24, menu.scrollHeight || 450) - 12,
                y > v.y + v.h / 2
                  ? y - Math.min(v.h - 24, menu.scrollHeight || 450) - 10
                  : y + (parseFloat(el.style.height) || 144) + 8
              )
            ) + 'px',
        });
        menu.hidden = !safe();
      }
      const ball = $('hubMomoBall');
      if (ball) ball.hidden = !safe();
    }
    function mount() {
      const next = a.ready() ? a.owner?.() || 'local' : '';
      if (next !== owner) {
        owner = next;
        ballResumeUntil = 0;
        cancelTravel();
        endGesture();
        endUmbrella();
        sceneState = null;
        reaction = null;
        nap = false;
        try {
          nap = !!owner && localStorage.getItem('mm-tracker.momo-nap.v1:' + owner) === 'sleeping';
        } catch {}
        if (nap) {
          a.stop();
          a.move(homePoint());
          pose('nap');
          if ($('hubPetBubble')) $('hubPetBubble').hidden = true;
        }
        perch = null;
        held = null;
        ballDrag = null;
        $('hubMomoBall')?.remove();
      }
      if (!$('hubMomoHome')) {
        const el = document.createElement('button');
        el.id = 'hubMomoHome';
        el.type = 'button';
        el.dataset.momo = 'home';
        el.className = 'hub-private-only';
        el.title = 'Drag to move Momo’s home · tap to send him home · click Momo to wake him';
        el.setAttribute(
          'aria-label',
          'Momo’s home. Drag or use arrow keys to move it. Tap to send him home. Click Momo to wake him.'
        );
        el.innerHTML =
          '<svg viewBox="0 0 64 58" aria-hidden="true"><path d="M10 25L32 7l22 18v28H10z" fill="#fff1d5" stroke="#38566a" stroke-width="2"/><path d="M5 27L32 3l27 24" fill="none" stroke="#b883a5" stroke-width="7" stroke-linecap="round"/><path d="M23 53V35a9 9 0 0118 0v18" fill="#8acac4" stroke="#38566a" stroke-width="2"/><path d="M46 10V3h7v14" fill="#deaa8a" stroke="#38566a" stroke-width="2"/></svg><span class="momo-home-grip" aria-hidden="true">⠿</span>';
        document.body.append(el);
      }
      if (!safe()) {
        endUmbrella();
        cancelHomeDrag();
        cancelTravel();
        $('hubMomoMenu')?.remove();
        $('hubMomoBall')?.remove();
      }
      layout();
    }
    function menu() {
      if (nap) {
        wake();
        return;
      }
      endGesture();
      if (reaction && !nap) pose('idle');
      reaction = null;
      cancelTravel();
      if ($('hubMomoMenu')) {
        $('hubMomoMenu').remove();
        return;
      }
      a.stop();
      restUntil = Date.now() + 15000;
      const el = document.createElement('aside');
      el.id = 'hubMomoMenu';
      el.className = 'hub-private-only';
      el.setAttribute('aria-label', 'Play with Momo');
      el.innerHTML =
        '<div class="flex-title"><strong>A little time with Momo</strong><button type="button" data-momo="close" aria-label="Close Momo controls">×</button></div><p>My eyes follow you. Bring your cursor close for a surprise, or pick me up for a little protest.</p><div class="momo-menu-actions"><button data-momo="pat">Give a little pat</button><button data-momo="ball">' +
        ($('hubMomoBall') ? 'Put ball away' : 'Play ball') +
        '</button><button data-momo="come">Come here…</button><button data-momo="perch">Find a perch</button><button data-momo="gesture">Show me a little move</button><button data-momo="sit">Unfold a chair & whistle</button><button data-momo="sleep">A tiny sleep break</button><button data-momo="home">' +
        'Go home & nap' +
        '</button><button data-momo="pin" aria-pressed="' +
        !!a.pinned?.() +
        '">' +
        (a.pinned?.() ? 'Allow automatic movement' : 'Stay here') +
        '</button><button data-momo="place-home">Put my home here</button><button data-momo="rain">Umbrella moment</button><button data-momo="quip">Tell me something silly</button><button data-momo="theatre">Momo’s tiny theatre</button><button data-momo="discover">Desk discoveries</button><button data-momo="moments-settings">Little moment settings</button><button data-momo="quiet" aria-pressed="' +
        quiet +
        '">' +
        (quiet ? 'Turn on little chats' : 'Quiet time · pause little chats') +
        '</button></div><small>I sometimes nod off, tidy my hair, daydream or lose my balance. Little chats appear about every 1–2 minutes while you’re not typing or focusing. Dragging or arrow-key placement keeps me where you put me. Choose Allow automatic movement to let me move again. Quiet time pauses speech; reduced motion pauses my animations.</small>';
      document.body.append(el);
      layout();
      root.dispatchEvent(new CustomEvent('workhub:momo-menu'));
    }
    function chase() {
      if (nap) return;
      const ball = $('hubMomoBall');
      if (!ball) return;
      nap = false;
      perch = null;
      const x = parseFloat(ball.style.left),
        y = parseFloat(ball.style.top),
        size = parseFloat(pet()?.style.width) || 96;
      travel(
        x - size * 0.5,
        y - size * 0.6,
        () => {
          pose('play');
          restUntil = Date.now() + 8000;
          ball.classList.add('momo-ball-bounce');
          a.react('happy', 'Caught it! Drag the ball to toss it again.');
        },
        1400,
        'ball'
      );
    }
    function ball() {
      const v = viewport();
      let el = $('hubMomoBall');
      if (!el) {
        el = document.createElement('button');
        el.id = 'hubMomoBall';
        el.type = 'button';
        el.dataset.momo = 'ball-toss';
        el.setAttribute(
          'aria-label',
          (a.prefs().mascotName || 'Momo') +
            '’s ball. Drag to toss, or tap to send it somewhere new.'
        );
        el.innerHTML = '<span></span>';
        document.body.append(el);
      }
      Object.assign(el.style, { left: v.x + v.w * 0.28 + 'px', top: v.y + v.h * 0.65 + 'px' });
      chase();
    }
    function findPerch() {
      if (nap) return;
      const v = viewport(),
        cards = [
          ...document.querySelectorAll(
            '#view [data-widget],#view .task-main-card,#view .ticket-queue-card,#view .hub-card'
          ),
        ]
          .map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(x => x.r.width > 120 && x.r.top > v.y + 120 && x.r.top < v.y + v.h - 70);
      if (!cards.length) {
        a.react('busy', 'Open a few cards and I’ll find somewhere to sit.');
        return;
      }
      const target = cards[Math.floor(Math.random() * cards.length)],
        size = parseFloat(pet().style.width) || 96;
      nap = false;
      perch = target.el;
      travel(
        target.r.left + Math.min(target.r.width - size - 12, target.r.width * 0.7),
        target.r.top - size + 8,
        () => {
          pose('perch');
          restUntil = Date.now() + 20000;
          a.react('happy', 'A lovely little perch. I’ll move when you need this card.');
        }
      );
    }
    function endUmbrella() {
      if (!umbrellaUntil && !$('hubMomoUmbrella')) return;
      const el = pet(),
        point = { x: parseFloat(el?.style.left) || 0, y: parseFloat(el?.style.top) || 0 };
      umbrellaUntil = 0;
      $('hubMomoUmbrella')?.remove();
      el?.removeAttribute('data-umbrella');
      if (el) a.move(point);
      if (['umbrella-walk', 'umbrella-rest'].includes(el?.dataset.pose)) pose('idle');
    }
    function umbrella() {
      if (
        nap ||
        !safe() ||
        !pet() ||
        document.body.matches('.hub-private,.hub-focus,.hub-sorting') ||
        document.querySelector('dialog[open]') ||
        document.activeElement?.matches('input,textarea,select,[contenteditable]')
      )
        return false;
      endGesture();
      cancelTravel();
      a.stop();
      let el = $('hubMomoUmbrella');
      const point = { x: parseFloat(pet().style.left) || 0, y: parseFloat(pet().style.top) || 0 };
      if (!el) {
        el = document.createElement('span');
        el.id = 'hubMomoUmbrella';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = root.WorkHubMomoArt.umbrella();
        pet().append(el);
      }
      umbrellaUntil = Date.now() + 11000;
      restUntil = umbrellaUntil;
      pet().dataset.umbrella = 'true';
      a.move(point);
      point.x = parseFloat(pet().style.left) || 0;
      point.y = parseFloat(pet().style.top) || 0;
      pose('umbrella-walk');
      if (a.weather?.() === 'rain') a.remember?.('rain-walk');
      a.react('happy', 'A tiny umbrella. Feet steady, rainy thoughts welcome.', 5000);
      if (motion()) {
        const v = viewport(),
          size = parseFloat(pet().style.width) || 112,
          x = Math.max(
            v.x + 12,
            Math.min(v.x + v.w - size * 1.12 - 12, point.x + (point.x > v.x + v.w / 2 ? -85 : 85))
          ),
          y = Math.max(v.y + size * 0.48 + 12, point.y);
        travel(x, y, () => pose('umbrella-rest'), 3200);
      }
      return true;
    }

    function cancelHomeDrag() {
      if (!homeDrag) return;
      home = { ...homeDrag.original };
      homeDrag = null;
      $('hubMomoHome')?.removeAttribute('data-dragging');
      layout();
    }
    function finishHomeDrag(event) {
      if (!homeDrag || event.pointerId !== homeDrag.id) return;
      const g = homeDrag;
      homeDrag = null;
      $('hubMomoHome')?.removeAttribute('data-dragging');
      if (g.moved) {
        homeSuppress = Date.now() + 700;
        persistHome();
        if (nap) a.move(homePoint());
        else a.react('happy', 'A new little address. Same cosy home.', 2200);
      }
      layout();
    }
    document.addEventListener(
      'pointerdown',
      event => {
        const el = event.target.closest?.('#hubMomoHome');
        if (!el || event.button > 0 || !safe()) return;
        event.preventDefault();
        endGesture();
        a.stop();
        cancelTravel();
        const p = homeAnchor();
        homeDrag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: p.x,
          top: p.y,
          original: { ...home },
          moved: false,
        };
        try {
          el.setPointerCapture?.(event.pointerId);
        } catch {}
      },
      { passive: false }
    );
    document.addEventListener(
      'pointermove',
      event => {
        if (!homeDrag || event.pointerId !== homeDrag.id) return;
        const dx = event.clientX - homeDrag.x,
          dy = event.clientY - homeDrag.y;
        if (!homeDrag.moved && Math.hypot(dx, dy) < 6) return;
        event.preventDefault();
        homeDrag.moved = true;
        $('hubMomoHome').dataset.dragging = 'true';
        setHomePixel(homeDrag.left + dx, homeDrag.top + dy);
        layout();
      },
      { passive: false }
    );
    document.addEventListener('pointerup', finishHomeDrag);
    document.addEventListener('pointercancel', cancelHomeDrag);
    document.addEventListener('lostpointercapture', event => {
      if (homeDrag && event.pointerId === homeDrag.id) cancelHomeDrag();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') cancelHomeDrag();
      if (
        event.target.id !== 'hubMomoHome' ||
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      )
        return;
      event.preventDefault();
      a.stop();
      cancelTravel();
      const p = homeAnchor(),
        step = event.shiftKey ? 36 : 12;
      setHomePixel(
        p.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        p.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)
      );
      persistHome();
      if (nap) a.move(homePoint());
      layout();
    });
    document.addEventListener(
      'pointermove',
      event => {
        pointer = { x: event.clientX, y: event.clientY, type: event.pointerType };
        if (!eyeFrame)
          eyeFrame = root.requestAnimationFrame(() => {
            eyeFrame = 0;
            const el = pet();
            if (!el || !safe() || !motion() || nap || idleGesture?.kind === 'sleep') return;
            const r = el.getBoundingClientRect(),
              size = r.width || parseFloat(el.style.width) || 128,
              cx = (r.width ? r.left : parseFloat(el.style.left)) + size * 0.5,
              cy = (r.height ? r.top : parseFloat(el.style.top)) + size * 0.35;
            el.style.setProperty(
              '--momo-look-x',
              Math.max(-1.45, Math.min(1.45, (pointer.x - cx) / 90)) + 'px'
            );
            el.style.setProperty(
              '--momo-look-y',
              Math.max(-1.15, Math.min(1.15, (pointer.y - cy) / 105)) + 'px'
            );
            startle(pointer.x, pointer.y, pointer.type);
          });
        if (
          held &&
          event.pointerId === held.id &&
          Math.hypot(event.clientX - held.x, event.clientY - held.y) > 6
        ) {
          if (!held.moved) {
            held.moved = true;
            pose('held');
            if (!quiet) a.react('busy', 'Hey! Let me go!', 15000);
          }
        }
        if (ballDrag && event.pointerId === ballDrag.id) {
          event.preventDefault();
          const v = viewport();
          Object.assign($('hubMomoBall').style, {
            left: Math.min(v.x + v.w - 44, Math.max(v.x + 8, event.clientX - 18)) + 'px',
            top: Math.min(v.y + v.h - 44, Math.max(v.y + 8, event.clientY - 18)) + 'px',
          });
          ballDrag.moved = true;
        }
      },
      { passive: false }
    );
    document.addEventListener(
      'pointerdown',
      event => {
        if (event.target.closest?.('#hubPet > button') && event.button <= 0 && safe()) {
          endUmbrella();
          endGesture();
          reaction = null;
          cancelTravel();
          if (nap) wake();
          perch = null;
          held = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
          pose('idle');
        }
        if (event.target.closest?.('#hubMomoBall')) {
          cancelTravel();
          ballDrag = { id: event.pointerId, moved: false };
          try {
            $('hubMomoBall').setPointerCapture?.(event.pointerId);
          } catch {}
        }
        if (perch && perch.contains(event.target)) {
          perch = null;
          pose('idle');
          const v = viewport();
          travel(v.x + v.w - 110, v.y + v.h * 0.55, () => {}, 900);
        }
      },
      { passive: true }
    );
    function release(event) {
      if (held && (!event || event.pointerId === held.id)) {
        const moved = held.moved;
        held = null;
        if (moved) {
          pose('annoyed');
          reaction = { until: Date.now() + 4500 };
          restUntil = Date.now() + 6000;
          nextStartle = Date.now() + 20000;
          if (!quiet) a.react('busy', 'Hmph! My feet would like to stay on the desk.', 4500);
        }
      }
      if (ballDrag && (!event || event.pointerId === ballDrag.id)) {
        if (ballDrag.moved) ballSuppress = Date.now() + 600;
        ballDrag = null;
        chase();
      }
    }
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    document.addEventListener('lostpointercapture', release);
    document.addEventListener('animationend', event => {
      if (
        event.target.closest?.('#hubPet') &&
        !held &&
        !journey &&
        ['momo-oops', 'momo-achoo'].includes(event.animationName) &&
        ['stumble', 'sneeze'].includes(pet()?.dataset.pose)
      )
        pose('shy');
    });
    document.addEventListener(
      'click',
      event => {
        const el = event.target.closest?.('[data-momo]');
        if (el) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const action = el.dataset.momo;
          if (action === 'home' && Date.now() < homeSuppress) return;
          $('hubMomoMenu')?.remove();
          if (action === 'close') return;
          if (action === 'pin') {
            a.pin?.(!a.pinned?.());
            return;
          }
          if (nap) return;
          if (['theatre', 'discover', 'moments-settings'].includes(action)) {
            root.dispatchEvent(new CustomEvent('workhub:momo-extra', { detail: { action } }));
            return;
          }
          if (['gesture', 'sit', 'sleep'].includes(action)) {
            gesture(action === 'gesture' ? '' : action);
            return;
          }
          if (action === 'quip') {
            quip();
            return;
          }
          if (action === 'quiet') {
            quiet = !quiet;
            try {
              localStorage.setItem('mm-tracker.momo-chatter.v1', quiet ? 'quiet' : 'chatty');
            } catch {}
            nextQuip = Date.now() + 60000 + Math.random() * 60000;
            a.react(
              'happy',
              quiet
                ? 'Quiet time it is. I’ll keep you company with my little face.'
                : 'Little chats are back. I’m preparing my best nonsense.'
            );
            return;
          }
          if (action === 'pat') {
            nap = false;
            pose('happy');
            restUntil = Date.now() + 5000;
            a.react('happy', 'That’s the spot. Thank you!');
          }
          if (action === 'home') goHome();
          if (action === 'place-home') {
            setHomePixel(
              (parseFloat(pet().style.left) || 0) +
                ((parseFloat(pet().style.width) || 144) - 56) / 2,
              (parseFloat(pet().style.top) || 0) + (parseFloat(pet().style.height) || 144) - 20
            );
            persistHome();
            layout();
            a.react('happy', 'Home is wherever you put it.');
          }
          if (action === 'ball') {
            if ($('hubMomoBall')) {
              $('hubMomoBall').remove();
              cancelTravel();
              pose('idle');
            } else ball();
          }
          if (action === 'ball-toss') {
            if (Date.now() < ballSuppress) return;
            const v = viewport();
            Object.assign(el.style, {
              left: v.x + 24 + Math.random() * Math.max(1, v.w - 100) + 'px',
              top: v.y + v.h * 0.3 + Math.random() * v.h * 0.45 + 'px',
            });
            chase();
          }
          if (action === 'come') {
            armed = true;
            a.react('busy', 'Tap an empty spot in the workspace and I’ll come over.');
          }
          if (action === 'perch') findPerch();
          if (action === 'rain') umbrella();
          return;
        }
        if (
          armed &&
          safe() &&
          !event.target.closest?.('button,a,input,textarea,select,summary,dialog')
        ) {
          armed = false;
          nap = false;
          event.preventDefault();
          travel(event.clientX - 48, event.clientY - 48, () => {
            restUntil = Date.now() + 6000;
            a.react('happy', 'Right here with you.');
          });
        }
      },
      true
    );
    document.addEventListener('focusin', event => {
      if (event.target.matches?.('input,textarea,select,[contenteditable]')) {
        endGesture();
        cancelTravel(true);
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        armed = false;
        endGesture();
        reaction = null;
        $('hubMomoMenu')?.remove();
        $('hubMomoBall')?.remove();
        cancelTravel();
        ballResumeUntil = 0;
        if (!nap && !held) pose('idle');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        endUmbrella();
        cancelHomeDrag();
        endGesture();
        cancelTravel(true);
        held = null;
        ballDrag = null;
        reaction = null;
        nearCursor = false;
        if (!nap) pose('idle');
        if (eyeFrame) root.cancelAnimationFrame(eyeFrame);
        eyeFrame = 0;
      }
    });
    root.addEventListener(
      'scroll',
      () => {
        if (perch) {
          perch = null;
          restUntil = 0;
          pose('idle');
        }
      },
      { passive: true }
    );
    root.addEventListener('resize', () => {
      cancelHomeDrag();
      layout();
    });
    root.visualViewport?.addEventListener('resize', () => {
      cancelHomeDrag();
      layout();
    });
    function tick() {
      if (
        umbrellaUntil &&
        (Date.now() >= umbrellaUntil ||
          !safe() ||
          document.body.matches('.hub-private,.hub-focus,.hub-sorting') ||
          document.querySelector('dialog[open]') ||
          document.activeElement?.matches('input,textarea,select,[contenteditable]'))
      ) {
        cancelTravel();
        endUmbrella();
      }
      const interrupted =
        !safe() ||
        !motion() ||
        document.body.matches('.hub-private,.hub-focus,.lab-drag-active') ||
        !!document.querySelector('dialog[open]') ||
        document.activeElement?.matches(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
        );
      if (idleGesture) {
        if (interrupted || Date.now() >= idleGesture.until) endGesture();
        else {
          gestureTick();
          layout();
          return;
        }
      }
      if (reaction) {
        if (interrupted || Date.now() >= reaction.until) {
          reaction = null;
          if (!nap && !held && !sceneState) pose('idle');
        } else {
          layout();
          return;
        }
      }
      if (!safe()) {
        cancelTravel();
        layout();
        return;
      }
      if (nap && journey?.purpose !== 'home') {
        cancelTravel();
        a.stop();
        a.move(homePoint());
        pose('nap');
        layout();
        return;
      }
      if (perch && !perch.isConnected) {
        perch = null;
        pose('idle');
      }
      if (sceneState) {
        layout();
        return;
      }
      if (ballResumeUntil && Date.now() > ballResumeUntil) ballResumeUntil = 0;
      if (
        ballResumeUntil &&
        !interrupted &&
        !busy() &&
        $('hubMomoBall') &&
        a.canResume?.() !== false
      ) {
        ballResumeUntil = 0;
        chase();
        return;
      }
      if (!motion()) {
        cancelTravel();
        pet()?.style.setProperty('--momo-look-x', '0px');
        pet()?.style.setProperty('--momo-look-y', '0px');
      }
      const blocked =
        interrupted ||
        busy() ||
        !!ballDrag ||
        !!perch ||
        !!$('hubMomoMenu') ||
        !$('hubPetBubble')?.hidden;
      if (!quiet && motion() && !blocked && Date.now() >= nextQuip) quip(true);
      else if (!blocked && motion() && Date.now() >= nextGesture) {
        gesture();
        return;
      } else if (!journey && !nap && !held && Date.now() >= restUntil)
        pose(document.body.classList.contains('hub-focus') ? 'focus' : 'idle');
      layout();
    }
    return {
      mount,
      menu,
      layout,
      busy,
      tick,
      umbrella,
      endUmbrella,
      gesture,
      gestureState: () => idleGesture?.kind || null,
      travel,
      wake,
      goHome,
      sleeping: () => nap,
      express,
      scene,
      clearForWork() {
        if (nap || held || homeDrag) return false;
        cancelTravel(true);
        endGesture();
        endUmbrella();
        reaction = null;
        sceneState = null;
        nap = false;
        perch = null;
        armed = false;
        restUntil = Date.now() + 12000;
        pose('idle');
        return true;
      },
      manualMove() {
        cancelTravel();
        ballResumeUntil = 0;
        armed = false;
        perch = null;
        sceneState = null;
        endGesture();
        endUmbrella();
        reaction = null;
        restUntil = Date.now() + 6000;
        if (!nap) pose('idle');
      },
      homePosition: () => ({ ...home }),
      sceneAvailable: () =>
        !nap && !homeDrag && !held && !journey && !armed && !idleGesture && !reaction,
    };
  }
  root.WorkHubMomoLife = { install };
})(window);
