/**
 * momo-adventures.js
 * Greetings, dialogue, visitors, sprints, umbrella, mischief and soccer surprises.
 * Only an explicit character rename changes saved account preferences. Behaviour toggles stay local.
 * Dialogue arrays and small trick helpers can be edited independently of task/cloud logic.
 * File map: docs/FILE-MAP.md
 */
/* Small, cancellable adventures. Only an explicit rename changes account data. */
(function (root) {
  'use strict';
  const STORE = 'mm-tracker.momo-adventures.v1',
    E = root.WorkHubMomoBehaviourEngine,
    FINALES = ['balloons', 'cranes', 'rainbow', 'trophy', 'flowers', 'moon', 'ducks', 'galaxy'];
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const BALL =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#fffdf2" stroke="#385465" stroke-width="2"/><path d="m32 20 12 9-5 14H25l-5-14ZM12 12l9 3-3 13-14 4m48-20-9 3 3 13 14 4M12 53l3-13 13 7 4 14m20-8-3-13-13 7" fill="#355466"/><path d="m21 15 11 5 11-5M18 28l2 1m24 0 2-1M15 40l10 3m14 0 10-3m-21 7-3-4m11 4 3-4" fill="none" stroke="#829a9d" stroke-width="1.3"/></svg>';
  function install(a) {
    const $ = id => document.getElementById(id),
      pet = () => $('hubPet'),
      random = (lo, hi) => lo + Math.random() * (hi - lo),
      name = () => a.prefs().mascotName || 'Momo',
      person = () => a.prefs().name?.trim() || 'Haidid';
    const defaults = {
      greetings: true,
      antics: true,
      reminders: true,
      chases: true,
      continuity: true,
      friendships: true,
      weatherEffects: true,
      clickReactions: true,
      awareness: true,
    };
    let preferences = { ...defaults },
      owner = null,
      pendingGreeting = true,
      greetAt = Date.now() + 2500,
      nextAntic = Date.now() + random(45000, 95000),
      nextReminder = Date.now() + random(180000, 300000),
      active = null,
      raf = 0,
      pendingVisitor = null,
      lastReminder = '',
      lastAntic = '',
      lastGreeting = -1,
      finaleBag = [],
      lastFinale = '',
      round = 0,
      labelName = '',
      bookmark = null,
      resumeAfter = 0,
      history = [],
      bonds = {},
      hiddenAt = 0,
      lastGreetAt = 0,
      greetingKind = 'fresh',
      resumeInvite = false,
      wetUntil = 0,
      lastFootprint = null,
      effects = [],
      lastWeather = '',
      nextClick = 0,
      lastYield = 0,
      workControl = null;
    try {
      const p = JSON.parse(localStorage.getItem(STORE) || 'null');
      for (const k of Object.keys(defaults)) if (typeof p?.[k] === 'boolean') preferences[k] = p[k];
    } catch {}
    try {
      const p = JSON.parse(localStorage.getItem(STORE + '.finales') || 'null');
      if (
        p &&
        Array.isArray(p.bag) &&
        new Set(p.bag).size === p.bag.length &&
        p.bag.every(k => FINALES.includes(k))
      )
        finaleBag = p.bag;
      if (FINALES.includes(p?.last)) lastFinale = p.last;
    } catch {}
    const viewport = () => {
      const v = root.visualViewport;
      return {
        x: v?.offsetLeft || 0,
        y: v?.offsetTop || 0,
        w: v?.width || root.innerWidth || 375,
        h: v?.height || root.innerHeight || 667,
      };
    };
    const motion = () =>
      a.prefs().motion !== 'off' && !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const quiet = () => {
      try {
        return localStorage.getItem('mm-tracker.momo-chatter.v1') === 'quiet';
      } catch {
        return false;
      }
    };
    const editing = () =>
      !!document.querySelector('dialog[open]') ||
      !!document.activeElement?.matches(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
      );
    function safe(auto = false) {
      return (
        a.ready() &&
        a.prefs().mascot &&
        !document.hidden &&
        !document.body.matches(
          '.hub-private,.hub-present,.hub-focus,.hub-sorting,.lab-drag-active'
        ) &&
        !editing() &&
        !$('hubMomoMenu') &&
        (!auto || !quiet())
      );
    }
    function position() {
      return { x: parseFloat(pet()?.style.left) || 0, y: parseFloat(pet()?.style.top) || 0 };
    }
    function setPose(pose, expression = 'curious') {
      if (pet()) {
        pet().dataset.pose = pose;
        pet().dataset.expression = expression;
      }
    }
    function shuffle(xs) {
      const out = xs.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
    /** Tiny stories stay in memory. A remembered visitor bond stores only a name/kind counter. */
    function remember(kind, detail = '') {
      history.push({ kind, detail, at: Date.now() });
      history = history.slice(-12);
      if (kind === 'rain-walk') wetUntil = Date.now() + 45000;
    }
    function contextLine() {
      const h = history[history.length - 1];
      if (!h || Date.now() - h.at > 120000) return '';
      const lines = {
        sprint: 'That was an excellent lap. My shoes are still telling everyone about it.',
        chase: `I nearly caught ${h.detail || 'our little visitor'}. A rematch has been politely requested.`,
        gift: `${h.detail || 'Our visitor'} brought a present. I am guarding it with my very best serious face.`,
        seat: `${h.detail || 'Our visitor'} borrowed my chair. We have negotiated shared sitting rights.`,
        companion: `That little catch-up with ${h.detail || 'our visitor'} was lovely. We should save them a seat.`,
        window: `I am still thinking about that ${h.detail || 'little view'}. The sky has excellent timing.`,
        pull: 'The corner is safely back where I found it. We shall call that a stretch test.',
        juggle: `Those ${h.detail} kicks deserve a tiny victory lap. After a tiny rest.`,
        stumble: 'About that little stumble… the floor and I have agreed to start again.',
        sneeze: 'The sneeze has left the building. My dignity is catching up.',
        'rain-walk':
          'I think I brought a few raindrops inside. Tiny feet, surprisingly tiny puddles.',
      };
      return lines[h.kind] || '';
    }
    function cleanupEffects() {
      $('momoWeatherEffects')?.remove();
      $('momoWindowFog')?.remove();
      effects = [];
      lastFootprint = null;
      document.querySelectorAll('.momo-weather-leaf').forEach(el => el.remove());
    }
    function finish(restore = false, keepBookmark = false) {
      const was = active;
      active = null;
      if (!keepBookmark) bookmark = null;
      if (raf) root.cancelAnimationFrame(raf);
      raf = 0;
      $('momoElasticCard')?.remove();
      $('momoSoccerStage')?.remove();
      $('momoSoccerBall')?.remove();
      $('momoFriendProp')?.remove();
      $('momoFriendSeat')?.remove();
      $('momoWindowFog')?.remove();
      pet()?.removeAttribute('data-adventure');
      pet()?.removeAttribute('data-facing');
      pet()?.removeAttribute('data-juggle-side');
      pet()?.removeAttribute('data-scene-phase');
      pet()?.removeAttribute('data-kick-phase');
      pet()?.removeAttribute('data-friend-role');
      a.atmosphere()?.visitorMood?.('');
      if (was) {
        a.life()?.scene(null);
        if (restore && was.previous) a.move(was.previous);
      }
    }
    function suspend(reason) {
      const s = active;
      if (
        s &&
        preferences.continuity &&
        ['juggle', 'window', 'chase', 'friend'].includes(s.kind) &&
        !s.finalised
      ) {
        bookmark = {
          kind: s.kind,
          count: s.count,
          elapsed: elapsed(root.performance.now()),
          visitor: s.visitor,
          role: s.role,
          at: Date.now(),
          owner,
          reason,
        };
        resumeAfter = Date.now() + 3500;
        finish(false, true);
      } else finish();
    }
    function begin(kind, pose, duration, extra = {}) {
      if (!safe() || !pet() || !motion() || a.life()?.sceneAvailable?.() === false) return false;
      finish();
      a.moments()?.finish(false);
      a.stop();
      active = {
        kind,
        previous: position(),
        start: root.performance.now(),
        started: Date.now(),
        duration,
        ...extra,
      };
      a.life()?.scene({ pose, expression: 'delighted' });
      pet().dataset.adventure = kind;
      raf = root.requestAnimationFrame(frame);
      return true;
    }
    function elapsed(t) {
      return (active.offset || 0) + Math.max(0, t - active.start, Date.now() - active.started);
    }
    function moveToward(point) {
      const before = position();
      if (Math.abs(point.x - before.x) > 0.4)
        pet().dataset.facing = point.x < before.x ? 'left' : 'right';
      a.move(point);
    }
    function frame(t) {
      raf = 0;
      advance(t);
      if (active) raf = root.requestAnimationFrame(frame);
    }
    function phase(s, value, pose, face = 'curious') {
      if (s.phase === value) return false;
      s.phase = value;
      pet().dataset.scenePhase = value;
      if (pose) setPose(pose, face);
      return true;
    }
    function advance(t) {
      if (!active) return;
      if (!safe() || !motion()) {
        if (
          motion() &&
          a.ready() &&
          !document.body.matches('.hub-private,.hub-present') &&
          a.prefs().mascot
        )
          suspend('work');
        else finish();
        return;
      }
      const s = active,
        ms = elapsed(t),
        q = Math.min(1, ms / s.duration);
      if (s.kind === 'sprint') {
        phase(s, q < 0.1 ? 'launch' : q > 0.86 ? 'slow' : 'run');
        moveToward(E.path(s.points, q));
      }
      if (s.kind === 'chase') {
        const world = a.atmosphere(),
          visitor = world?.snapshot().visitor;
        if (!visitor || visitor.greeted) {
          finish();
          return;
        }
        const f = E.chase(ms),
          lead = E.path(s.points, f.progress),
          tail = E.path(s.points, Math.max(0, f.progress - 0.07)),
          destination = { x: tail.x - s.size * 0.3, y: tail.y - s.size * 0.3 };
        if (
          phase(
            s,
            f.stage,
            ['notice', 'recover'].includes(f.stage) ? 'visitor-watch' : 'run',
            f.stage === 'recover' ? 'shy' : 'delighted'
          )
        ) {
          world.visitorMood?.(s.role || 'rival', f.stage);
          if (!quiet() && f.stage === 'recover')
            a.react(
              'happy',
              `${s.friendName || 'Our little friend'} wins that lap. I demand a very tiny rematch.`,
              4500
            );
        }
        if (f.stage === 'approach')
          moveToward(
            E.mix(
              s.previous,
              { x: s.points[0].x - s.size * 0.3, y: s.points[0].y - s.size * 0.3 },
              f.approach
            )
          );
        if (['chase', 'slow'].includes(f.stage)) {
          world.positionVisitor(lead.x, lead.y);
          moveToward(destination);
        }
      }
      if (s.kind === 'friend') friendFrame(s, ms);
      if (s.kind === 'window') windowFrame(s, ms);
      if (s.kind === 'pull') pullFrame(s, ms);
      if (s.kind === 'juggle') {
        if (!s.finalised) {
          const f = E.soccer(ms, s.count, parseFloat(pet().style.width) || 144);
          s.kicks = f.kicks;
          $('momoJuggleCount').textContent = f.kicks + ' / ' + s.count;
          pet().dataset.juggleSide = f.side;
          pet().dataset.kickPhase = f.contact ? 'contact' : 'flight';
          phase(
            s,
            f.awkward ? 'awkward' : 'balance',
            'juggle',
            f.awkward ? 'surprised' : 'delighted'
          );
          pet().style.setProperty('--momo-kick-lift', f.lift + 'px');
          pet().style.setProperty('--momo-juggle-bob', f.contact ? '1px' : '-2px');
          if (f.awkward && s.awkwardCycle !== Math.floor(ms / 650)) {
            s.awkwardCycle = Math.floor(ms / 650);
            if (!quiet())
              a.react('happy', 'A wobbly one! Still counting. I can rescue this.', 2400);
          }
          const ball = $('momoSoccerBall'),
            shadow = $('momoSoccerShadow');
          ball.style.setProperty('--ball-hop', f.hop + 'px');
          ball.style.setProperty('--ball-roll', f.roll + 'deg');
          ball.style.setProperty('--ball-sway', f.sway + 'px');
          if (shadow) {
            shadow.style.translate = f.sway + 'px 0';
            shadow.style.opacity = String(0.25 + (1 - Math.abs(f.hop) / 76) * 0.45);
          }
          if (f.kicks === s.count) revealFinale();
        }
      }
      if (q >= 1 && active === s) {
        if (s.kind !== 'juggle')
          remember(
            s.kind === 'friend' ? s.role : s.kind,
            s.friendName || (s.kind === 'window' ? s.weather : '')
          );
        const restore = ['window', 'pull'].includes(s.kind) && s.previous;
        finish();
        if (restore && safe() && motion()) a.life()?.travel(restore.x, restore.y, () => {}, 700);
      }
    }
    function greet() {
      if (!safe(true) || !preferences.greetings || a.life()?.busy() || active) return false;
      const fresh = [
        `Hey ${person()}! ${name()} reporting for a little desk adventure.`,
        `Welcome back, ${person()}! I saved you a cosy corner.`,
        `Hi ${person()}! Ready for a small win and a tiny bit of mischief?`,
        `There you are, ${person()}! Your little teammate is here.`,
        `Hello, ${person()}! I have been practising my very best welcome wave.`,
        `Hey ${person()}! Fresh page, fresh possibilities. I brought enthusiasm.`,
      ];
      const lines =
        greetingKind === 'brief-return'
          ? [
              `Back already, ${person()}? I kept our little adventure warm.`,
              `Hey ${person()}, just a little tab hop? I am right where you left me.`,
            ]
          : greetingKind === 'long-return'
            ? [
                `Welcome back, ${person()}! I took care of this corner while you were away.`,
                `There you are, ${person()}! Ready to pick up where we paused?`,
              ]
            : fresh;
      let i = Math.floor(Math.random() * lines.length);
      if (i === lastGreeting) i = (i + 1) % lines.length;
      lastGreeting = i;
      if (motion()) {
        if (!begin('greeting', 'idle-wave', 4300)) return false;
      }
      a.react('happy', lines[i], 6500);
      pendingGreeting = false;
      lastGreetAt = Date.now();
      return true;
    }
    function sprint() {
      if (!safe() || !motion()) return false;
      const v = viewport(),
        size = parseFloat(pet()?.style.width) || 144;
      if (v.w < size + 80) return false;
      const from = position(),
        to = {
          x: from.x > v.x + v.w / 2 ? v.x + 12 : v.x + v.w - size - 12,
          y: Math.max(v.y + 12, Math.min(v.y + v.h - size - 12, from.y)),
        };
      if (
        !begin('sprint', 'run', Math.max(650, Math.min(1550, Math.abs(to.x - from.x) / 0.75)), {
          points: [from, to],
        })
      )
        return false;
      if (!quiet())
        a.react(
          'happy',
          [
            'Zoom! Important tiny business!',
            'Fast feet, absolutely no destination plan.',
            'One lap of the desk. For science!',
            'Catch that pixel!',
          ][Math.floor(Math.random() * 4)],
          3000
        );
      return true;
    }
    function visitorArrived(kind) {
      const friend = E.FRIENDS[kind];
      if (friend && preferences.friendships) {
        if (!resumeInvite) {
          bonds[kind] = Math.min(999, (bonds[kind] || 0) + 1);
          try {
            localStorage.setItem(STORE + '.friends:' + owner, JSON.stringify(bonds));
          } catch {}
        }
        a.atmosphere()?.visitorMood?.(
          friend.role,
          'arrive',
          `${friend.name} the ${kind} · ${bonds[kind] > 1 ? 'a familiar friend' : 'a new little friend'}`
        );
      }
      if (!resumeInvite)
        pendingVisitor = { kind, after: Date.now() + 4000, until: Date.now() + 17000 };
    }
    function visitorEnd() {
      pendingVisitor = null;
      if (['chase', 'friend'].includes(active?.kind)) {
        if (!safe() && motion() && a.ready() && !document.body.matches('.hub-private,.hub-present'))
          suspend('visitor-pause');
        else finish();
      }
    }
    function chaseVisitor() {
      const world = a.atmosphere(),
        visit = world?.snapshot().visitor;
      if (
        !visit ||
        visit.greeted ||
        !preferences.chases ||
        !a.prefs().roaming ||
        a.moments()?.snapshot().preferences.visitors === false ||
        !safe(true) ||
        !motion() ||
        active
      )
        return false;
      const other = a.moments()?.snapshot().active;
      if ((other && other.kind !== 'visitor') || (!other && a.life()?.busy())) return false;
      const v = viewport(),
        size = parseFloat(pet()?.style.width) || 144,
        from = world.visitorPoint();
      if (!from || v.w < 320 || v.h < 340) return false;
      const right = v.x + v.w - 68,
        left = v.x + 20,
        low = v.y + v.h - 78,
        high = v.y + Math.max(85, Math.min(v.h * 0.32, 180)),
        points = [
          from,
          { x: from.x < v.x + v.w / 2 ? right : left, y: low },
          { x: from.x < v.x + v.w / 2 ? left : right, y: high },
          { x: from.x < v.x + v.w / 2 ? right : left, y: low },
        ];
      const friend = E.FRIENDS[visit.kind];
      if (
        !begin('chase', 'run', 11200, {
          points,
          size,
          visitor: visit.kind,
          role: 'rival',
          friendName: preferences.friendships ? friend?.name : '',
        })
      )
        return false;
      a.atmosphere()?.holdVisitor?.(12500);
      pendingVisitor = null;
      if (!quiet())
        a.react(
          'happy',
          preferences.friendships && friend
            ? `${friend.name}! ${bonds[visit.kind] > 1 ? 'Our rematch is on.' : 'First one across the desk wins!'} Wait for me!`
            : `Hey, little ${visit.kind}! Wait for me!`,
          4500
        );
      return true;
    }
    function watchWindow() {
      if (!safe() || !motion()) return false;
      const v = viewport(),
        anchor = [$('hubAtmosphereCard'), $('hubAtmospherePocket')].find(el => {
          const r = el?.getBoundingClientRect();
          return (
            el &&
            !el.hidden &&
            r.width > 30 &&
            r.height > 25 &&
            r.top >= v.y &&
            r.bottom <= v.y + v.h
          );
        });
      if (!anchor) return false;
      const r = anchor.getBoundingClientRect(),
        size = parseFloat(pet()?.style.width) || 144;
      const target = {
        x: r.right + 8 + size < v.x + v.w ? r.right - 10 : r.left - size + 18,
        y: r.top + r.height - size * 0.65,
      };
      if (
        !begin('window', 'window-watch', 9200, {
          anchor,
          target,
          weather: a.atmosphere()?.snapshot().weather,
          weatherAt: Date.now(),
        })
      )
        return false;
      const weather = a.atmosphere()?.snapshot().weather;
      const lines = {
        rain: 'Little raindrops racing down the glass. I am cheering for the wobbly one.',
        snow: 'Snowflakes! Every one of them looks like it has taken the afternoon off.',
        rainbow: 'The sky has brought all its favourite colours.',
        aurora: 'The sky is doing a very slow, very fancy dance.',
        fog: 'The view has wrapped itself in a soft blanket.',
        breeze: 'The leaves are dancing. I should learn that move.',
        cloudy: 'That cloud looks like a biscuit. Most clouds do, if you believe enough.',
        sunny: 'A little sunshine and a very serious window inspection.',
      };
      if (!quiet())
        a.react('happy', lines[weather] || 'Just checking what the sky is up to.', 6000);
      return true;
    }
    function windowFrame(s, ms) {
      if (!s.anchor.isConnected || s.anchor.hidden) {
        finish();
        return;
      }
      const state =
        ms < 1400 ? 'approach' : ms < 2200 ? 'settle' : ms < 8000 ? 'watch' : 'wave-goodbye';
      phase(
        s,
        state,
        state === 'approach' ? 'walk' : state === 'wave-goodbye' ? 'idle-wave' : 'window-watch'
      );
      if (state === 'approach') moveToward(E.mix(s.previous, s.target, E.ease(ms / 1400)));
      else moveToward(s.target);
      const r = s.anchor.getBoundingClientRect(),
        p = position(),
        size = parseFloat(pet().style.width) || 144;
      if (state !== 'approach')
        pet().dataset.facing = r.left + r.width / 2 < p.x + size / 2 ? 'left' : 'right';
      const weather = a.atmosphere()?.snapshot().weather;
      if (weather !== s.weather && Date.now() - s.weatherAt > 2200) {
        s.weather = weather;
        s.weatherAt = Date.now();
        if (!quiet())
          a.react(
            'happy',
            weather === 'rain'
              ? 'Oh! The drops have started a new race.'
              : weather === 'breeze'
                ? 'There go the leaves. The sky has changed its plans.'
                : 'A new little scene outside. I nearly missed that!',
            4300
          );
      }
      if (preferences.weatherEffects && weather === 'fog' && state === 'watch') {
        let glass = $('momoWindowFog');
        if (!glass) {
          glass = document.createElement('div');
          glass.id = 'momoWindowFog';
          glass.setAttribute('aria-hidden', 'true');
          glass.innerHTML =
            '<svg viewBox="0 0 240 132"><defs><mask id="momo-wiped-glass"><rect width="240" height="132" fill="white"/><ellipse class="momo-clear-patch" cx="153" cy="68" rx="50" ry="34" fill="black"/></mask></defs><rect x="6" y="6" width="228" height="116" rx="16" fill="#edf3ef" opacity=".58" mask="url(#momo-wiped-glass)"/></svg>';
          document.body.append(glass);
        }
        Object.assign(glass.style, {
          left: r.left + 'px',
          top: r.top + 'px',
          width: r.width + 'px',
          height: r.height + 'px',
        });
        pet().dataset.scenePhase = 'wipe';
      } else $('momoWindowFog')?.remove();
    }
    function pullSection() {
      if (!safe() || !motion()) return false;
      const v = viewport(),
        size = parseFloat(pet()?.style.width) || 144;
      const choices = [
        ...document.querySelectorAll(
          '#view [data-widget],#view .task-main-card,#view .ticket-card,#view .ticket-queue-card,#view .hub-card,#view .item-card'
        ),
      ]
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(
          ({ el, r }) =>
            !el.contains(document.activeElement) &&
            !el.closest('dialog') &&
            r.width > 150 &&
            r.width < v.w * 0.85 &&
            r.height > 60 &&
            r.height < 400 &&
            r.left >= v.x + 8 &&
            r.right + size * 0.55 < v.x + v.w - 8 &&
            r.top >= v.y + 60 &&
            r.bottom < v.y + v.h - 15
        );
      if (!choices.length) return false;
      const target = choices[Math.floor(Math.random() * choices.length)];
      if (
        !begin('pull', 'mischief-pull', 6100, {
          anchor: target.el,
          target: {
            x: target.r.right - size * 0.3,
            y: target.r.top + Math.min(target.r.height * 0.45, 100) - size * 0.45,
          },
        })
      )
        return false;
      const clone = target.el.cloneNode(true);
      for (const el of [clone, ...clone.querySelectorAll('*')]) {
        for (const attr of [...el.attributes])
          if (
            attr.name === 'id' ||
            attr.name === 'name' ||
            attr.name === 'autofocus' ||
            attr.name === 'for' ||
            attr.name.startsWith('data-') ||
            attr.name.startsWith('on')
          )
            el.removeAttribute(attr.name);
        if (el.matches('button,input,textarea,select')) el.disabled = true;
        if (el.matches('button,input,textarea,select,a,[tabindex]')) el.tabIndex = -1;
      }
      clone.id = 'momoElasticCard';
      clone.classList.add('momo-elastic-card');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      Object.assign(clone.style, {
        position: 'fixed',
        left: target.r.left + 'px',
        top: target.r.top + 'px',
        width: target.r.width + 'px',
        height: target.r.height + 'px',
        margin: '0',
        pointerEvents: 'none',
        zIndex: '84',
      });
      document.body.append(clone);
      clone.dataset.tugPhase = 'check';
      if (!quiet())
        a.react(
          'happy',
          [
            'Just borrowing this corner… boing!',
            'This section has excellent stretch. Purely a scientific observation.',
            'I tried to move the whole card. The card has other ideas.',
            'A tiny tug. A surprisingly stretchy website.',
          ][Math.floor(Math.random() * 4)],
          4300
        );
      return true;
    }
    function pullFrame(s, ms) {
      const clone = $('momoElasticCard');
      if (!s.anchor.isConnected || !clone) {
        finish();
        return;
      }
      const f = E.tug(ms),
        poses = {
          check: 'idle-lookaround',
          reach: 'walk',
          tug: 'mischief-pull',
          recoil: 'startled',
          release: 'shy',
          smile: 'wink',
        };
      if (
        phase(s, f.stage, poses[f.stage], f.stage === 'recoil' ? 'surprised' : 'cheeky') &&
        !quiet()
      ) {
        if (f.stage === 'recoil')
          a.react('happy', 'Boing! The card has noticed my tiny plan.', 2300);
        if (f.stage === 'smile')
          a.react('happy', 'Back in place. We shall pretend that was a stretch break.', 4000);
      }
      if (ms < 1700) moveToward(E.mix(s.previous, s.target, f.approach));
      else if (!s.arrived) {
        moveToward(s.target);
        s.arrived = true;
      }
      clone.dataset.tugPhase = f.stage;
      clone.style.transform = `scaleX(${1 + f.stretch}) skewY(${f.stretch * 22}deg)`;
      clone.style.opacity = ['check', 'smile'].includes(f.stage) ? '0' : '1';
    }
    const GIFT_ART = {
      flower:
        '<svg viewBox="0 0 48 48"><path d="M24 44V23m0 13q-17-16-17-3 5 10 17 3" fill="#a9c6a7" stroke="#62856d" stroke-width="2"/><g fill="#e8b3ca" stroke="#9d748f"><circle cx="16" cy="14" r="8"/><circle cx="30" cy="12" r="8"/><circle cx="35" cy="24" r="8"/><circle cx="21" cy="28" r="8"/><circle cx="11" cy="24" r="8"/></g><circle cx="23" cy="20" r="7" fill="#f1d58d"/></svg>',
      acorn:
        '<svg viewBox="0 0 48 48"><path d="M13 22h23q0 20-12 23-12-6-11-23" fill="#d9ad86" stroke="#8e715e" stroke-width="2"/><path d="M9 23q1-16 15-15 15-1 16 15Z" fill="#aa8d72" stroke="#806c5b" stroke-width="2"/><path d="m24 10 2-8" stroke="#806c5b" stroke-width="4"/></svg>',
      leaf: '<svg viewBox="0 0 48 48"><path d="M8 40Q0 7 41 5q4 30-33 35" fill="#b6c99c" stroke="#75966d" stroke-width="2"/><path d="M5 45 35 12M15 33l-2-12m11 3 10 1" stroke="#75966d" stroke-width="2"/></svg>',
      star: '<svg viewBox="0 0 48 48"><path d="m24 3 6 14 15 2-11 11 3 15-13-8-13 8 3-15L3 19l15-2Z" fill="#f0d89d" stroke="#af9265" stroke-width="2"/></svg>',
    };
    function meetVisitor() {
      const world = a.atmosphere(),
        visit = world?.snapshot().visitor,
        friend = E.FRIENDS[visit?.kind];
      if (!preferences.friendships || !friend || friend.role === 'rival') return chaseVisitor();
      if (
        !visit ||
        visit.greeted ||
        !safe(true) ||
        !motion() ||
        !a.prefs().roaming ||
        active ||
        a.moments()?.snapshot().preferences.visitors === false
      )
        return false;
      const other = a.moments()?.snapshot().active;
      if ((other && other.kind !== 'visitor') || (!other && a.life()?.busy())) return false;
      const from = world.visitorPoint(),
        actor = position(),
        size = parseFloat(pet()?.style.width) || 144;
      if (!from) return false;
      const target = {
        x: Math.max(
          viewport().x + 8,
          Math.min(
            viewport().x + viewport().w - 56,
            actor.x + size * (friend.role === 'seat' ? 0.5 : 0.78)
          )
        ),
        y: actor.y + size * (friend.role === 'seat' ? 0.47 : 0.43),
      };
      if (
        !begin('friend', 'visitor-watch', 10400, {
          visitor: visit.kind,
          friendName: friend.name,
          role: friend.role,
          gift: friend.gift,
          from,
          actor,
          target,
          size,
        })
      )
        return false;
      world.holdVisitor?.(12000);
      world.visitorMood?.(friend.role, 'notice');
      pendingVisitor = null;
      pet().dataset.friendRole = friend.role;
      const prop = document.createElement('div');
      prop.id = friend.role === 'seat' ? 'momoFriendSeat' : 'momoFriendProp';
      prop.setAttribute('aria-hidden', 'true');
      prop.innerHTML =
        friend.role === 'seat'
          ? '<svg viewBox="0 0 60 70"><path d="M9 44V9q0-4 4-4h34q4 0 4 4v35M12 43v24m36-24v24" fill="#c8b1c9" stroke="#776e83" stroke-width="4"/><path d="M5 43h50v8H5Z" fill="#e2cbd8" stroke="#776e83" stroke-width="3"/><path d="M15 15h30m-30 8h30" stroke="#eedfe8" stroke-width="3"/></svg>'
          : GIFT_ART[friend.gift];
      document.body.append(prop);
      if (!quiet())
        a.react(
          'happy',
          friend.role === 'seat'
            ? `${friend.name}! That is my chair. We have discussed this.`
            : friend.role === 'gift'
              ? `${friend.name}${bonds[visit.kind] > 1 ? ' is back' : ' has arrived'} with a little present!`
              : `${friend.name}! Come sit with me for a moment.`,
          5000
        );
      return true;
    }
    function friendFrame(s, ms) {
      const world = a.atmosphere(),
        visit = world?.snapshot().visitor;
      if (!visit || visit.kind !== s.visitor || visit.greeted) {
        finish();
        return;
      }
      const state = E.phase(ms, [
        ['notice', 950],
        ['approach', 2800],
        ['exchange', 5700],
        ['react', 8100],
        ['depart', 10400],
      ]);
      if (
        phase(
          s,
          state,
          state === 'react'
            ? s.role === 'seat'
              ? 'idle-lookaround'
              : 'happy'
            : state === 'depart'
              ? 'idle-wave'
              : 'visitor-watch',
          s.role === 'seat' ? 'shy' : 'delighted'
        )
      ) {
        world.visitorMood?.(s.role, state);
        if (state === 'react' && !quiet())
          a.react(
            'happy',
            s.role === 'seat'
              ? `${s.friendName} says the chair was unoccupied. A technically excellent argument.`
              : s.role === 'gift'
                ? `Thank you, ${s.friendName}. This goes in my very important tiny collection.`
                : `A quiet little catch-up with ${s.friendName}. Excellent company.`,
            4500
          );
      }
      const incoming = E.ease((ms - 950) / 1850),
        outgoing = E.ease((ms - 8100) / 2300),
        v = viewport();
      const departure = { x: s.target.x < v.x + v.w / 2 ? v.x + v.w - 66 : v.x + 18, y: s.from.y };
      const point =
        state === 'depart'
          ? E.mix(s.target, departure, outgoing)
          : E.mix(s.from, s.target, incoming);
      world.positionVisitor(point.x, point.y);
      if (s.role === 'seat') {
        const aside = { x: s.actor.x - Math.min(45, s.size * 0.3), y: s.actor.y };
        moveToward(E.mix(s.actor, aside, state === 'depart' ? 1 - outgoing : incoming));
        const seat = $('momoFriendSeat');
        if (seat)
          Object.assign(seat.style, {
            left: s.target.x - 6 + 'px',
            top: s.actor.y + s.size * 0.53 + 'px',
            width: s.size * 0.43 + 'px',
          });
      } else {
        const prop = $('momoFriendProp');
        const hand = { x: s.actor.x + s.size * 0.56, y: s.actor.y + s.size * 0.65 };
        const gift = E.mix({ x: point.x + 18, y: point.y + 24 }, hand, E.ease((ms - 2800) / 1800));
        if (prop) {
          Object.assign(prop.style, {
            left: gift.x + 'px',
            top: gift.y + 'px',
            opacity: state === 'depart' ? String(1 - outgoing) : '1',
          });
          prop.dataset.phase = state;
        }
      }
    }
    function resume() {
      const saved = bookmark;
      if (
        !saved ||
        !preferences.continuity ||
        saved.owner !== owner ||
        Date.now() - saved.at > 120000
      ) {
        bookmark = null;
        return false;
      }
      const moment = a.moments()?.snapshot().active;
      if (
        Date.now() < resumeAfter ||
        !safe(true) ||
        !motion() ||
        active ||
        (a.life()?.busy() && moment?.kind !== 'visitor') ||
        (moment && (moment.kind !== 'visitor' || !['friend', 'chase'].includes(saved.kind)))
      )
        return false;
      let started = false;
      if (saved.kind === 'juggle') {
        started = juggle(saved.count);
        if (started) active.offset = Math.min(saved.elapsed, saved.count * 650 - 1);
      } else if (saved.kind === 'window') started = watchWindow();
      else {
        let visit = a.atmosphere()?.snapshot().visitor;
        if (visit && (visit.kind !== saved.visitor || visit.greeted)) return false;
        if (!visit) {
          resumeInvite = true;
          const invited = a.atmosphere()?.invite(saved.visitor);
          resumeInvite = false;
          if (!invited) return false;
        }
        started = saved.kind === 'chase' ? chaseVisitor() : meetVisitor();
      }
      if (started) {
        bookmark = null;
        if (!quiet())
          a.react(
            'happy',
            saved.kind === 'juggle'
              ? 'Now, where were my feet? Same count, same little surprise.'
              : saved.kind === 'window'
                ? 'Back to our little window moment.'
                : 'There you are! Shall we finish our little adventure?',
            4200
          );
      }
      return started;
    }
    function moved(before, after) {
      if (!preferences.weatherEffects || !safe() || !motion()) return;
      const weather = a.atmosphere()?.snapshot().weather;
      if (
        (weather === 'rain' || a.atmosphere()?.snapshot().preferences.rain) &&
        (pet()?.dataset.umbrella === 'true' || active?.kind === 'sprint')
      )
        wetUntil = Date.now() + 45000;
      if (Date.now() >= wetUntil || Math.hypot(after.x - before.x, after.y - before.y) > 110)
        return;
      if (!lastFootprint) {
        lastFootprint = after;
        return;
      }
      if (Math.hypot(after.x - lastFootprint.x, after.y - lastFootprint.y) < 28) return;
      let layer = $('momoWeatherEffects');
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'momoWeatherEffects';
        layer.setAttribute('aria-hidden', 'true');
        document.body.append(layer);
      }
      const footprint = document.createElement('i'),
        size = parseFloat(pet()?.style.width) || 144;
      footprint.className = 'momo-wet-footprint';
      Object.assign(footprint.style, {
        left: after.x + size * (effects.length % 2 ? 0.43 : 0.56) + 'px',
        top: after.y + size * 0.94 + 'px',
        rotate: after.x < lastFootprint.x ? '-70deg' : '70deg',
      });
      layer.append(footprint);
      effects.push({ el: footprint, until: Date.now() + 6500 });
      while (effects.length > 10) effects.shift().el.remove();
      lastFootprint = { ...after };
    }
    function weatherTick() {
      effects = effects.filter(e => {
        if (Date.now() >= e.until) {
          e.el.remove();
          return false;
        }
        return true;
      });
      if (!safe() || !motion() || !preferences.weatherEffects) {
        cleanupEffects();
        return;
      }
      const weather = a.atmosphere()?.snapshot().weather;
      if (weather !== lastWeather) {
        if (lastWeather === 'rain') wetUntil = Date.now() + 30000;
        lastWeather = weather;
      }
      const stage = $('momoTheatre');
      if (stage && weather === 'breeze' && !stage.querySelector('.momo-weather-leaf')) {
        for (let i = 0; i < 3; i++) {
          const leaf = document.createElement('span');
          leaf.className = 'momo-weather-leaf';
          leaf.setAttribute('aria-hidden', 'true');
          leaf.innerHTML = GIFT_ART.leaf;
          leaf.style.setProperty('--leaf-index', i);
          stage.append(leaf);
        }
      } else if (weather !== 'breeze')
        document.querySelectorAll('.momo-weather-leaf').forEach(el => el.remove());
    }
    function yieldTo(el, extend = true) {
      if (
        !preferences.awareness ||
        !a.ready() ||
        document.hidden ||
        !a.prefs().mascot ||
        !el?.getBoundingClientRect ||
        el.closest?.('#hubPet,#hubMomoHome,#hubMomoMenu,#hubVisitors,#momoSoccerStage')
      )
        return false;
      const r = el.getBoundingClientRect(),
        p = position(),
        size = parseFloat(pet()?.style.width) || 144;
      const bubble = $('hubPetBubble'),
        b = bubble?.getBoundingClientRect();
      if (
        b?.width &&
        !bubble.hidden &&
        r.width &&
        b.left < r.right &&
        b.right > r.left &&
        b.top < r.bottom &&
        b.bottom > r.top
      )
        bubble.hidden = true;
      if (!r.width || !r.height || !E.overlaps(p, size, r, 18)) return false;
      if (active) suspend('work-area');
      if (a.life()?.clearForWork?.() === false) return false;
      a.stop();
      workControl = el;
      if (extend) lastYield = Date.now();
      const obstacles = [
        ...document.querySelectorAll(
          'button,input,select,textarea,a,summary,[role="button"],#hubTimerBar,#focusPanel'
        ),
      ]
        .filter(
          node => !node.closest('#hubPet,#hubMomoHome,#hubVisitors,#momoSoccerStage,#momoTheatre')
        )
        .map(node => node.getBoundingClientRect())
        .filter(box => box.width && box.height);
      const target = E.clearSpot(p, size, viewport(), obstacles);
      if (target) {
        a.move(target);
        setPose('idle', 'shy');
      }
      pet()?.setAttribute('data-yielding', target ? 'false' : 'true');
      return true;
    }
    function clickReaction(el) {
      if (
        !preferences.clickReactions ||
        !safe(true) ||
        !motion() ||
        active ||
        bookmark ||
        a.life()?.busy() ||
        Date.now() < nextClick ||
        !el?.closest?.('#view,#tabs,#hubTabs,#hubToolbar,#hubSidebar,#hubHeader')
      )
        return false;
      const r = el.getBoundingClientRect(),
        p = position(),
        size = parseFloat(pet()?.style.width) || 144;
      if (
        !r.width ||
        !r.height ||
        Math.hypot(
          p.x + size / 2 - (r.left + r.width / 2),
          p.y + size / 2 - (r.top + r.height / 2)
        ) >
          size * 2.1
      )
        return false;
      const brace = el.matches('summary,[aria-expanded],[role="tab"]') || el.dataset.hub === 'tool';
      if (!begin('click', brace ? 'click-brace' : 'click-lean', 1350)) return false;
      nextClick = Date.now() + 20000;
      pet().style.setProperty('--momo-reaction-x', r.left < p.x ? '-7px' : '7px');
      pet().dataset.scenePhase = brace ? 'brace' : 'lean';
      return true;
    }
    function visitorHello(kind) {
      finish();
      if (!preferences.friendships || !E.FRIENDS[kind]) return '';
      const friend = E.FRIENDS[kind];
      remember(friend.role === 'rival' ? 'chase' : friend.role, friend.name);
      return friend.role === 'seat'
        ? `${friend.name} sends a little hello. Please do not offer them my chair.`
        : friend.role === 'gift'
          ? `${friend.name} says hello! We have excellent friends on this desk.`
          : friend.role === 'rival'
            ? `${friend.name} says hello. Our next race is strictly for fun.`
            : `${friend.name} is happy you stopped to say hello.`;
    }
    function reminderCandidates() {
      const d = a.state(),
        today = a.today(),
        out = [],
        snoozed = (kind, id) => root.WorkHubReminders.isSnoozed(d, kind, id, today),
        projectClosed = id => {
          const p = d.projects.find(p => p.id === id);
          return (
            p &&
            (p.archived ||
              /^(completed|closed|cancelled|canceled)$/i.test(p.status || p.phase || ''))
          );
        };
      for (const kind of ['tasks', 'tickets', 'specs', 'projects'])
        for (const r of d[kind] || []) {
          if (
            r.archived ||
            r.done ||
            /^(done|completed|closed|resolved|cancelled|canceled)$/i.test(
              r.status || r.boardStatus || r.phase || ''
            ) ||
            snoozed(kind, r.id) ||
            (kind !== 'projects' &&
              r.projectId &&
              (snoozed('projects', r.projectId) || projectClosed(r.projectId)))
          )
            continue;
          const projectId = kind === 'tasks' && r.taskType === 'Project' ? r.linkId : r.projectId;
          if (
            kind !== 'projects' &&
            projectId &&
            (snoozed('projects', projectId) || projectClosed(projectId))
          )
            continue;
          const title = r.task || r.description || r.name || r.title || r.ticket;
          if (!title) continue;
          const due = r.dueDate || r.deadline || r.targetDate || '';
          out.push({ kind, id: r.id, title: String(title), due, key: kind + ':' + r.id });
        }
      return out.sort(
        (x, y) =>
          (x.due && x.due <= today ? 0 : 1) - (y.due && y.due <= today ? 0 : 1) ||
          (x.due || '9999').localeCompare(y.due || '9999')
      );
    }
    function nudge(automatic = false) {
      if (!safe(automatic) || (automatic && (!preferences.reminders || active || a.life()?.busy())))
        return false;
      const all = reminderCandidates(),
        pool = all.filter(x => x.key !== lastReminder),
        r = (pool.length ? pool : all)[Math.floor(Math.random() * (pool.length || all.length))];
      nextReminder = Date.now() + random(240000, 420000);
      if (!r) {
        if (!automatic)
          a.react(
            'happy',
            `Hey ${person()}, no open items need a nudge right now. A little breathing room!`,
            5000
          );
        return false;
      }
      lastReminder = r.key;
      const lines = [
        `Hey ${person()}, don’t forget about “${r.title.length > 160 ? r.title.slice(0, 157) + '…' : r.title}”. One little next step?`,
        `A gentle nudge, ${person()}: “${r.title}” is still open.`,
        `${person()}, shall we give “${r.title}” a little attention when you’re ready?`,
        `Psst, ${person()}. I saved you a reminder about “${r.title}”.`,
      ];
      a.react('busy', lines[Math.floor(Math.random() * lines.length)], 11000);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'momo-nudge-open';
      b.dataset.adventure = 'open-record';
      b.dataset.kind = r.kind;
      b.dataset.id = r.id;
      b.textContent =
        'Open ' +
        { tasks: 'task', tickets: 'ticket', specs: 'project item', projects: 'project' }[r.kind];
      $('hubPetBubble')?.append(b);
      return true;
    }
    function nextFinale() {
      if (!finaleBag.length) {
        finaleBag = shuffle(FINALES);
        if (finaleBag[finaleBag.length - 1] === lastFinale)
          [finaleBag[0], finaleBag[finaleBag.length - 1]] = [
            finaleBag[finaleBag.length - 1],
            finaleBag[0],
          ];
      }
      const result = finaleBag.pop();
      lastFinale = result;
      try {
        localStorage.setItem(
          STORE + '.finales',
          JSON.stringify({ bag: finaleBag, last: lastFinale })
        );
      } catch {}
      return result;
    }
    function juggle(count) {
      if (!Number.isInteger(count) || count < 1 || count > 50)
        throw Error('Choose a whole number from 1 to 50.');
      if (!safe() || !motion()) return false;
      const v = viewport(),
        size = parseFloat(pet()?.style.width) || 144,
        w = Math.min(254, v.w - 24),
        h = Math.min(278, v.h - 24);
      if (v.h < 300 || v.w < 270) return false;
      const p = position(),
        x = Math.max(v.x + 12, Math.min(v.x + v.w - w - 12, p.x - w * 0.25)),
        y = Math.max(v.y + 12, Math.min(v.y + v.h - h - 12, p.y - 45));
      if (!begin('juggle', 'juggle', count * 650 + 4700, { count, kicks: 0, finalised: false }))
        return false;
      const stage = document.createElement('aside');
      stage.id = 'momoSoccerStage';
      stage.setAttribute('aria-label', name() + '’s soccer trick');
      stage.innerHTML =
        '<div class="momo-soccer-roof"><span>A LITTLE FOOTBALL MAGIC</span><button type="button" data-adventure="stop" aria-label="Stop soccer trick">×</button></div><div class="momo-soccer-floor" aria-hidden="true"></div><div id="momoSoccerBall">' +
        BALL +
        '</div><span id="momoSoccerShadow" aria-hidden="true"></span><p id="momoJuggleCount" aria-live="off">0 / ' +
        count +
        '</p><div id="momoFinale" aria-hidden="true"></div>';
      Object.assign(stage.style, {
        left: x + 'px',
        top: y + 'px',
        width: w + 'px',
        height: h + 'px',
      });
      document.body.append(stage);
      // A separate foreground layer escapes the stage's lower stacking context.
      // Keep the ball over Momo while leaving the stage backdrop behind him.
      const ball = $('momoSoccerBall');
      Object.assign(ball.style, {
        position: 'fixed',
        left: x + w / 2 - 16 + 'px',
        top: y + h - 77 + 'px',
        bottom: 'auto',
        zIndex: '91',
        pointerEvents: 'none',
      });
      ball.setAttribute('aria-hidden', 'true');
      document.body.append(ball);
      a.move({ x: x + (w - size) / 2, y: y + h - size - 42 });
      a.react(
        'happy',
        `${count} ${count === 1 ? 'kick' : 'kicks'}! Stay for my little surprise.`,
        4000
      );
      return true;
    }
    function revealFinale() {
      if (active?.kind !== 'juggle' || active.finalised) return;
      active.finalised = true;
      remember('juggle', active.count);
      const kind = nextFinale(),
        box = $('momoFinale'),
        seed = ++round,
        hue = Math.floor(Math.random() * 360);
      box.dataset.finale = kind;
      box.style.setProperty('--finale-hue', hue);
      box.className = 'momo-finale is-revealed';
      const symbols = {
        balloons: ['◉', '♡', '◉', '✦'],
        cranes: ['✧', '◇', '✧', '◇'],
        rainbow: ['🌈', '✦', '♡', '✧'],
        trophy: ['🏆', '★', '✦', '★'],
        flowers: ['✿', '❀', '✿', '❁'],
        moon: ['☾', '✦', '★', '✧'],
        ducks: ['🦆', '⚽', '🦆', '★'],
        galaxy: ['◌', '✧', '○', '✦'],
      };
      for (let i = 0; i < 12; i++) {
        const s = document.createElement('span');
        s.textContent = symbols[kind][(i + seed) % 4];
        if (root.WorkHubMomoWorldArt?.finales?.[kind])
          s.innerHTML = root.WorkHubMomoWorldArt.finales[kind];
        s.style.setProperty('--i', i);
        s.style.setProperty('--burst-x', ((i % 4) - 1.5) * 45 + 'px');
        s.style.setProperty('--burst-y', -40 - Math.floor(i / 4) * 45 + 'px');
        box.append(s);
      }
      const captions = {
        balloons: 'A tiny balloon parade! The ball invited everyone.',
        cranes: 'A flock of paper wishes. Make a little one for yourself.',
        rainbow: 'A rainbow goal! The sky is on our team.',
        trophy: 'The miniature World Cup! You are officially my coach.',
        flowers: 'A pocket garden of flower fireworks. For you!',
        moon: 'A moonlit goal! That kick has reached the stars.',
        ducks: 'The duck referees award you ten out of quack.',
        galaxy: 'A bubble galaxy! Every kick made a new little world.',
      };
      setPose('idle-wave', 'delighted');
      a.react(
        'happy',
        `${name()}: ${active.count} ${active.count === 1 ? 'kick' : 'kicks'}! ${captions[kind]}`,
        6500
      );
    }
    function offerTrick() {
      if (!safe(true)) return false;
      a.react(
        'happy',
        `Coach ${person()}, how many kicks should I try? I have a little surprise waiting.`,
        10000
      );
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.adventure = 'trick';
      b.className = 'momo-nudge-open';
      b.textContent = 'Pick my trick';
      $('hubPetBubble')?.append(b);
      return true;
    }
    function trickForm() {
      finish();
      a.moments()?.finish(false);
      if (!a.ready() || !a.prefs().mascot) return;
      a.openModal(
        name() + '’s soccer surprise',
        `<form id="momoJuggleForm"><div class="momo-trick-intro"><div aria-hidden="true">${BALL}</div><span class="hub-kicker">YOU CALL THE TRICK</span><h3>How many times should I juggle?</h3><p>I’ll count every kick, then bring out a little surprise. The finale changes each time.</p></div><label for="momoKickCount">Number of kicks</label><input id="momoKickCount" name="count" type="number" min="1" max="50" step="1" value="5" required inputmode="numeric"><p class="hub-meta">1–50 kicks. Escape or the close button stops the show.</p>${motion() ? '' : '<p class="hub-meta">Turn on animations to play this moving trick.</p>'}<div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary"${motion() ? '' : ' disabled'}>Let’s see your trick!</button></div></form>`
      );
    }
    function renameForm() {
      finish();
      a.openModal(
        'A name for your little teammate',
        `<form id="momoNameForm"><span class="hub-kicker">HELLO, MY NAME IS…</span><h3>What would you like to call me?</h3><label for="momoCustomName">Companion name</label><input id="momoCustomName" name="mascotName" maxlength="32" value="${esc(name())}" required autocomplete="off"><p class="hub-meta">This name follows your account and is included in your backup.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save my name</button></div></form>`
      );
    }
    function settings() {
      if ($('settingsMenu')) $('settingsMenu').open = false;
      finish();
      a.openModal(
        name() + '’s adventures',
        `<form id="momoAdventuresForm"><div class="momo-trick-intro"><span class="hub-kicker">A LITTLE MORE LIFE</span><h3>Company at your pace.</h3><p>These moments wait while you type, use Focus or present your work. Quiet time pauses automatic greetings, chats and nudges.</p></div><div class="momo-behaviour-choices">${[
          ['greetings', 'Wave and greet me when I open the website'],
          ['reminders', 'Gentle nudges about my open tasks, tickets and project items'],
          ['friendships', 'Recurring visitor friendships, presents and cheeky seat sharing'],
          ['antics', 'Occasional sprints, window watching and stretchy-card mischief'],
          ['chases', 'Play chase with tiny visitors'],
          ['weatherEffects', 'Wet footprints, wind-blown theatre leaves and foggy-window wiping'],
          [
            'continuity',
            'Resume a paused ball, visitor or window activity when my workspace is clear',
          ],
          ['clickReactions', 'Small reactions to nearby clicks and opening panels'],
          ['awareness', 'Move clear of controls I am using'],
        ]
          .map(
            ([k, l], i) =>
              `${i % 3 === 0 ? '<fieldset><legend>' + ['Hello & company', 'Little adventures', 'Around your work'][i / 3] + '</legend>' : ''}<label class="check-label"><input type="checkbox" name="${k}"${preferences[k] ? ' checked' : ''}>${l}</label>${i % 3 === 2 ? '</fieldset>' : ''}`
          )
          .join(
            ''
          )}</div><p class="hub-meta">These choices stay on this device. Work nudges appear only while this page is open and skip snoozed or closed work.</p><div class="actions"><button type="button" data-adventure="rename">Change my name</button><button type="button" data-adventure="trick">Try a soccer surprise</button><button type="button" data-adventure="visitor">Invite a visitor friend</button></div><div class="modal-actions"><button type="submit" class="primary">Save adventures</button></div></form>`
      );
    }
    function decorateMenu() {
      const menu = $('hubMomoMenu');
      if (!menu || menu.querySelector('[data-adventure]')) return;
      finish();
      const title = menu.querySelector('strong');
      if (title) title.textContent = 'A little time with ' + name();
      menu.setAttribute('aria-label', 'Play with ' + name());
      const add = document.createElement('div');
      add.className = 'momo-adventure-actions';
      add.innerHTML =
        '<span class="hub-kicker">LET’S MAKE A LITTLE MISCHIEF</span>' +
        [
          ['trick', '⚽ Soccer surprise'],
          ['sprint', '↝ A speedy lap'],
          ['window', '☁ Look out the window'],
          ['pull', '↔ A tiny tug'],
          ['visitor', '✦ Meet a visitor'],
          ['nudge', '◷ A work nudge'],
          ['rename', '✎ Change my name'],
          ['settings', '⚙ Adventure settings'],
        ]
          .map(([k, l]) => '<button type="button" data-adventure="' + k + '">' + l + '</button>')
          .join('');
      menu.insertBefore(add, menu.querySelector('.momo-menu-actions'));
      a.life()?.layout();
      for (const node of menu.querySelectorAll('[data-momo="theatre"],[data-momo="close"]')) {
        if (node.dataset.momo === 'theatre') node.textContent = name() + '’s tiny theatre';
        else node.setAttribute('aria-label', 'Close ' + name() + ' controls');
      }
    }
    function mount() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        finish();
        a.atmosphere()?.clearVisitor();
        pendingVisitor = null;
        owner = next;
        pendingGreeting = !!next;
        greetAt = Date.now() + 2500;
        lastReminder = '';
        nextAntic = Date.now() + random(45000, 95000);
        nextReminder = Date.now() + random(180000, 300000);
        labelName = '';
        bookmark = null;
        history = [];
        bonds = {};
        wetUntil = 0;
        hiddenAt = 0;
        lastGreetAt = 0;
        workControl = null;
        pet()?.removeAttribute('data-yielding');
        cleanupEffects();
        try {
          const saved = JSON.parse(localStorage.getItem(STORE + '.friends:' + owner) || '{}');
          for (const kind of Object.keys(E.FRIENDS))
            if (Number.isInteger(saved?.[kind]) && saved[kind] >= 0 && saved[kind] <= 999)
              bonds[kind] = saved[kind];
        } catch {}
        try {
          const seen = Number(sessionStorage.getItem(STORE + '.last-seen:' + owner));
          greetingKind =
            seen > 0 && Date.now() - seen < 120000
              ? 'brief-return'
              : seen > 0
                ? 'long-return'
                : 'fresh';
        } catch {
          greetingKind = 'fresh';
        }
        const bubble = $('hubPetBubble');
        if (bubble) {
          bubble.hidden = true;
          bubble.replaceChildren();
        }
      }
      if (!a.ready()) {
        finish();
        return;
      }
      if (labelName !== name()) {
        labelName = name();
        pet()
          ?.querySelector(':scope > button')
          ?.setAttribute(
            'aria-label',
            name() +
              ', your floating companion. Drag to pick up, tap for play controls, or use arrow keys.'
          );
        const home = $('hubMomoHome');
        if (home) {
          home.title =
            'Drag to move ' + name() + '’s home · tap to send home · click ' + name() + ' to wake';
          home.setAttribute(
            'aria-label',
            name() +
              '’s home. Drag or use arrow keys to move it. Tap to send home. To wake, click ' +
              name() +
              '.'
          );
        }
      }
      const settingsGroup = $('hubSettingsAppearance');
      if (settingsGroup && !$('momoAdventureSettings')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'momoAdventureSettings';
        b.dataset.adventure = 'settings';
        settingsGroup.append(b);
      }
      if ($('momoAdventureSettings'))
        $('momoAdventureSettings').textContent = name() + ' · name & adventures';
      if (!safe() || !motion()) {
        if (
          motion() &&
          a.ready() &&
          a.prefs().mascot &&
          !document.body.matches('.hub-private,.hub-present')
        ) {
          if (active) suspend('work');
        } else {
          finish();
          cleanupEffects();
        }
      }
    }
    function tick() {
      mount();
      if (!a.ready()) return;
      weatherTick();
      if (workControl && (!workControl.isConnected || Date.now() - lastYield > 12000)) {
        workControl = null;
        pet()?.removeAttribute('data-yielding');
      }
      if (workControl && Date.now() - lastYield < 12000) {
        const r = workControl.getBoundingClientRect(),
          p = position(),
          size = parseFloat(pet()?.style.width) || 144;
        if (r.width && E.overlaps(p, size, r, 18)) yieldTo(workControl, false);
      }
      if (active) {
        advance(root.performance.now());
        return;
      }
      if (!safe(true)) return;
      if (bookmark && resume()) return;
      if (pendingGreeting && preferences.greetings && Date.now() >= greetAt) {
        if (greet()) return;
      }
      if (pendingVisitor) {
        if (Date.now() > pendingVisitor.until) pendingVisitor = null;
        else if (
          Date.now() >= pendingVisitor.after &&
          (preferences.chases || (preferences.friendships && preferences.antics)) &&
          (preferences.friendships ? meetVisitor() : chaseVisitor())
        )
          return;
      }
      if (Date.now() >= nextReminder && preferences.reminders && !a.life()?.busy()) {
        if (nudge(true)) return;
      }
      if (
        !preferences.antics ||
        !motion() ||
        a.life()?.busy() ||
        a.moments()?.snapshot().active ||
        Date.now() < nextAntic ||
        !$('hubPetBubble')?.hidden
      )
        return;
      nextAntic = Date.now() + random(65000, 130000);
      const kinds = [
        ...(a.prefs().roaming
          ? [
              'window',
              'pull',
              'sprint',
              ...(a.atmosphere()?.snapshot().weather === 'rain' ||
              a.atmosphere()?.snapshot().preferences.rain
                ? ['umbrella']
                : []),
            ]
          : []),
        'gesture',
        'offer',
      ];
      let kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind === lastAntic) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
      lastAntic = kind;
      if (kind === 'window') watchWindow();
      if (kind === 'pull') pullSection();
      if (kind === 'sprint') sprint();
      if (kind === 'gesture') a.life()?.gesture();
      if (kind === 'offer') offerTrick();
      if (kind === 'umbrella') a.life()?.umbrella();
    }
    root.addEventListener('workhub:momo-menu', decorateMenu);
    document.addEventListener(
      'click',
      event => {
        const b = event.target.closest?.('[data-adventure]');
        if (!b) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        $('hubMomoMenu')?.remove();
        const k = b.dataset.adventure;
        try {
          if (k === 'stop') finish();
          else if (k === 'rename') renameForm();
          else if (k === 'settings') settings();
          else if (k === 'trick') trickForm();
          else if (k === 'open-record') {
            const r = reminderCandidates().find(
              r => r.kind === b.dataset.kind && r.id === b.dataset.id
            );
            if (r) a.workbench()?.openRecord(r.kind, r.id);
          } else {
            if ($('momoAdventuresForm')) a.closeModal();
            const ok =
              k === 'sprint'
                ? sprint()
                : k === 'window'
                  ? watchWindow()
                  : k === 'pull'
                    ? pullSection()
                    : k === 'visitor'
                      ? a.atmosphere()?.invite('', true)
                      : k === 'nudge'
                        ? nudge()
                        : false;
            if (!ok && k !== 'nudge')
              a.tell('I’ll need a little room, animations on, and a clear workspace for that.');
          }
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    document.addEventListener(
      'submit',
      event => {
        if (!['momoNameForm', 'momoJuggleForm', 'momoAdventuresForm'].includes(event.target.id))
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const form = event.target;
        try {
          if (form.id === 'momoNameForm') {
            const value = form.elements.namedItem('mascotName').value.trim();
            if (!value || value.length > 32 || /[\u0000-\u001f\u007f]/.test(value))
              throw Error('Choose a name with 1–32 characters on one line.');
            if (
              a.mutate(d => {
                d.workhub.preferences.mascotName = value;
              })
            ) {
              a.closeModal();
              labelName = '';
              mount();
              a.react(
                'happy',
                value + '! I like the sound of that. Same little teammate, new name.',
                5500
              );
            }
          } else if (form.id === 'momoAdventuresForm') {
            for (const k of Object.keys(defaults))
              preferences[k] = form.elements.namedItem(k).checked;
            try {
              localStorage.setItem(STORE, JSON.stringify(preferences));
            } catch {}
            a.closeModal();
            a.tell('Adventure choices saved on this device.');
          } else {
            const count = Number(form.elements.namedItem('count').value);
            if (!Number.isInteger(count) || count < 1 || count > 50)
              throw Error('Choose a whole number from 1 to 50.');
            a.closeModal();
            if (!juggle(count))
              a.tell('Give me a clear workspace with animations on, then try again.');
          }
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    document.addEventListener(
      'pointerdown',
      event => {
        if (active && event.target.closest?.('.hub-visitor')) finish();
        else if (active && !event.target.closest?.('#momoSoccerStage')) suspend('pointer');
        const control = event.target.closest?.(
          'button,input,textarea,select,a,summary,[role="button"]'
        );
        if (control) yieldTo(control);
      },
      { capture: true, passive: true }
    );
    document.addEventListener('focusin', event => {
      if (event.target.matches?.('input,textarea,select,[contenteditable]')) {
        if (active) suspend('typing');
        yieldTo(event.target);
      }
    });
    document.addEventListener(
      'pointerover',
      event => {
        if (Date.now() - lastYield < 700) return;
        const control = event.target.closest?.(
          'button,input,textarea,select,a,summary,[role="button"]'
        );
        if (control) yieldTo(control);
      },
      { passive: true }
    );
    document.addEventListener(
      'click',
      event => {
        const control = event.target.closest?.('button,summary,[role="button"],[role="tab"]');
        if (control && !control.closest('#hubPet,#hubMomoMenu,#momoSoccerStage,#hubVisitors'))
          clickReaction(control);
      },
      true
    );
    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' ||
        (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) &&
          event.target.closest?.('#hubPet>button'))
      )
        finish();
    });
    const sync = () => {
      if (!safe() || !motion()) {
        if (
          motion() &&
          a.ready() &&
          a.prefs().mascot &&
          !document.body.matches('.hub-private,.hub-present')
        ) {
          if (active) suspend('work');
        } else finish();
        cleanupEffects();
      }
    };
    new root.MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-motion'],
    });
    if ($('modal'))
      new root.MutationObserver(sync).observe($('modal'), {
        attributes: true,
        attributeFilter: ['open'],
      });
    root.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', sync);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        try {
          sessionStorage.setItem(STORE + '.last-seen:' + owner, String(hiddenAt));
        } catch {}
      } else if (hiddenAt) {
        const away = Date.now() - hiddenAt;
        if (away >= 15000 && Date.now() - lastGreetAt >= 60000) {
          pendingGreeting = true;
          greetingKind = away < 120000 ? 'brief-return' : 'long-return';
          greetAt = Date.now() + 1800;
        }
        resumeAfter = Date.now() + 3500;
        hiddenAt = 0;
      }
      sync();
    });
    root.addEventListener('resize', () => finish(true));
    root.visualViewport?.addEventListener('resize', () => finish(true));
    root.addEventListener('pagehide', () => {
      try {
        sessionStorage.setItem(STORE + '.last-seen:' + owner, String(Date.now()));
      } catch {}
      finish();
      cleanupEffects();
    });
    root.addEventListener(
      'scroll',
      () => {
        if (active?.kind === 'window') suspend('scroll');
        else if (active?.kind === 'pull') finish(true);
      },
      { passive: true }
    );
    return {
      mount,
      tick,
      greet,
      offerTrick,
      sprint,
      chaseVisitor,
      meetVisitor,
      watchWindow,
      pullSection,
      nudge,
      reminderCandidates,
      juggle,
      trickForm,
      renameForm,
      settings,
      finish,
      visitorArrived,
      visitorEnd,
      visitorHello,
      remember,
      contextLine,
      resume,
      moved,
      yieldTo,
      clickReaction,
      snapshot: () => ({
        preferences: { ...preferences },
        name: name(),
        pendingGreeting,
        active: active
          ? {
              kind: active.kind,
              count: active.count,
              kicks: active.kicks,
              finalised: active.finalised,
              duration: active.duration,
              phase: active.phase || '',
              visitor: active.visitor,
              role: active.role,
            }
          : null,
        finale: lastFinale,
        finalesRemaining: finaleBag.length,
        bookmark: bookmark
          ? {
              kind: bookmark.kind,
              count: bookmark.count,
              elapsed: bookmark.elapsed,
              reason: bookmark.reason,
            }
          : null,
        greetingKind,
        bonds: { ...bonds },
        context: history.map(h => ({ ...h })),
        wet: Date.now() < wetUntil,
        footprints: effects.length,
      }),
    };
  }
  root.WorkHubMomoAdventures = { install };
})(window);
