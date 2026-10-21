/**
 * momo-moments.js
 * Small Momo performances and discoveries based on loaded records.
 * Uses character artwork and local motion state; does not create work records.
 * Dialogue/scene content belongs here; timers must stop cleanly when the interface changes.
 * File map: docs/FILE-MAP.md
 */
/* Momo's small performances and discoveries use only local artwork and loaded records. */
(function (root) {
  'use strict';
  const STORE = 'mm-tracker.momo-moments.v1',
    esc = v =>
      String(v ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
  const PROPS = {
    clip: '<svg viewBox="0 0 80 100" aria-hidden="true"><path d="M25 45 8 81l35-10" fill="#c7b4ec" stroke="#756095" stroke-width="2"/><path d="M45 78V23c0-17-25-17-25 0v54c0 27 40 27 40 0V27c0-9-13-9-13 0v49c0 10-14 10-14 0V33" fill="none" stroke="#63899b" stroke-width="7" stroke-linecap="round"/><path d="m51 15 9 10m-33-9-9 9" stroke="#63899b" stroke-width="2"/><circle cx="28" cy="42" r="2.5" fill="#314e60"/><circle cx="49" cy="42" r="2.5" fill="#314e60"/></svg>',
    plant:
      '<svg viewBox="0 0 80 100" aria-hidden="true"><path d="M40 73V20" stroke="#49755b" stroke-width="4"/><path d="M39 49C2 44 11 15 31 29c10 7 10 20 8 20Zm3-11C39 8 70 10 66 28c-3 13-24 10-24 10Z" fill="#98c9a7" stroke="#49755b" stroke-width="2"/><path d="M19 64h43l-7 30H26Z" fill="#e7ad94" stroke="#89604b" stroke-width="2"/><path d="M17 64h47v10H17Z" fill="#f1c9aa" stroke="#89604b" stroke-width="2"/><circle cx="34" cy="82" r="2" fill="#89604b"/><circle cx="46" cy="82" r="2" fill="#89604b"/><path d="M36 87q4 4 8 0" fill="none" stroke="#89604b" stroke-width="2"/></svg>',
    lunch:
      '<svg viewBox="0 0 100 85" aria-hidden="true"><rect x="8" y="35" width="84" height="43" rx="10" fill="#f3d9a6" stroke="#8b6e4a" stroke-width="3"/><g class="moments-lunch-lid"><rect x="7" y="25" width="86" height="18" rx="7" fill="#c0d8cf" stroke="#4f7b70" stroke-width="3"/><path d="M36 25v-9h28v9" fill="none" stroke="#4f7b70" stroke-width="4"/></g><path d="m28 57 4 2m29 7 3-2m-17-9 2 1" stroke="#b7935d" stroke-width="3" stroke-linecap="round"/></svg>',
  };
  const SHOWS = [
    {
      name: 'The paperclip knight',
      prop: 'clip',
      poses: ['curious', 'surprised', 'shy'],
      lines: [
        'Momo challenges a very brave paperclip.',
        'The paperclip refuses to blink.',
        'Momo declares a tactical snack break.',
      ],
    },
    {
      name: 'An interview with a plant',
      prop: 'plant',
      poses: ['curious', 'cheeky', 'delighted'],
      lines: [
        '“Tell me about your greatest achievement.”',
        'The plant: “I grew a leaf.”',
        '“Outstanding. You’re hired.”',
      ],
    },
    {
      name: 'The lunchbox mystery',
      prop: 'lunch',
      poses: ['delighted', 'surprised', 'shy'],
      lines: [
        'Lunch! Momo has been preparing for this.',
        'The lunchbox contains… one heroic crumb.',
        '“An exceptionally small tasting menu.”',
      ],
    },
  ];
  function install(a) {
    const name = () => a.prefs().mascotName || 'Momo',
      named = line => line.replaceAll('Momo', name());
    const $ = id => document.getElementById(id),
      random = (min, max) => min + Math.random() * (max - min),
      motion = () =>
        a.prefs().motion !== 'off' &&
        !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let preferences = { theatre: true, discoveries: true, visitors: true },
      active = null,
      envelope = null,
      lastDiscovery = '',
      lastShow = -1,
      theatreAt = Date.now() + random(100000, 190000),
      discoveryAt = Date.now() + random(130000, 240000),
      owner = '';
    try {
      const p = JSON.parse(localStorage.getItem(STORE) || 'null');
      for (const k of Object.keys(preferences))
        if (typeof p?.[k] === 'boolean') preferences[k] = p[k];
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
    const quiet = () => {
      try {
        return localStorage.getItem('mm-tracker.momo-chatter.v1') === 'quiet';
      } catch {
        return false;
      }
    };
    function safe(auto = false) {
      return (
        a.ready() &&
        a.prefs().mascot &&
        !document.hidden &&
        !document.body.matches('.hub-present,.hub-private,.hub-focus,.hub-sorting') &&
        !document.querySelector('dialog[open]') &&
        !document.activeElement?.matches(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
        ) &&
        !$('hubMomoMenu') &&
        (!auto || !quiet())
      );
    }
    function finish(restore = true) {
      const was = active;
      active = null;
      $('momoTheatre')?.remove();
      $('momoVisitorProp')?.remove();
      if (was) {
        a.life()?.scene(null);
        if (restore && was.previous) a.move(was.previous);
      }
    }
    function clearEnvelope() {
      $('momoDiscoveryAnchor')?.remove();
      envelope = null;
    }
    function layout() {
      const v = viewport(),
        pet = $('hubPet');
      if (!pet) return;
      const x = parseFloat(pet.style.left) || v.x + v.w - 110,
        y = parseFloat(pet.style.top) || v.y + v.h * 0.5;
      const p = $('momoVisitorProp');
      if (p) Object.assign(p.style, { left: x + 34 + 'px', top: y - 21 + 'px' });
    }
    function playTheatre(index, automatic = false) {
      if (!a.ready() || !a.prefs().mascot) return false;
      if (document.querySelector('#momentsSettingsForm')) a.closeModal();
      if (!safe()) return false;
      let n =
        Number.isInteger(index) && SHOWS[index] ? index : Math.floor(Math.random() * SHOWS.length);
      if (index === undefined && n === lastShow) n = (n + 1) % SHOWS.length;
      lastShow = n;
      const show = SHOWS[n];
      if (!motion()) {
        a.openModal(
          named('Momo’s tiny theatre'),
          `<div class="moments-static"><h3>${show.name}</h3><div class="moments-static-prop">${PROPS[show.prop]}</div>${show.lines.map(l => '<p>' + esc(named(l)) + '</p>').join('')}<p class="hub-meta">A still performance for your motion setting.</p></div>`
        );
        return true;
      }
      if (!active && (automatic ? a.life()?.busy() : a.life()?.sceneAvailable?.() === false))
        return false;
      finish();
      clearEnvelope();
      const pet = $('hubPet'),
        v = viewport();
      if (!pet || v.h < 310) return false;
      const w = Math.min(420, v.w - 24),
        h = Math.min(336, v.h - 24),
        petWidth = parseFloat(pet.style.width) || 144,
        petHeight = parseFloat(pet.style.height) || petWidth,
        // Momo and the props share a floor, leaving a separate area for captions.
        floor = Math.max(petHeight + 50, h - 112),
        x = Math.max(
          v.x + 12,
          Math.min(v.x + v.w - w - 12, (parseFloat(pet.style.left) || 0) + petWidth / 2 - w * 0.42)
        ),
        y = Math.max(v.y + 12, Math.min(v.y + v.h - h - 12, (parseFloat(pet.style.top) || 0) - 30));
      active = {
        kind: 'theatre',
        automatic,
        show: n,
        start: Date.now(),
        step: -1,
        previous: { x: parseFloat(pet.style.left) || 0, y: parseFloat(pet.style.top) || 0 },
      };
      a.life()?.scene({ pose: 'theatre', expression: 'curious' });
      a.move({ x: x + w * 0.42 - petWidth / 2, y: y + floor - petHeight + 6 });
      const stage = document.createElement('aside');
      stage.id = 'momoTheatre';
      stage.dataset.scene = show.prop;
      stage.setAttribute('aria-label', named('Momo’s tiny theatre'));
      stage.innerHTML = `<div class="moments-stage-roof" aria-hidden="true">✦</div><button type="button" data-moment="close-show" aria-label="Close Momo’s theatre">×</button><div class="moments-stage-floor" aria-hidden="true"></div><div class="moments-prop" aria-hidden="true">${PROPS[show.prop]}</div><p id="momoTheatreCaption"></p>`;
      Object.assign(stage.style, {
        left: x + 'px',
        top: y + 'px',
        width: w + 'px',
        height: h + 'px',
      });
      stage.style.setProperty('--moments-floor-y', floor + 'px');
      stage.querySelector('button').setAttribute('aria-label', 'Close ' + name() + '’s theatre');
      document.body.append(stage);
      theatreAt = Date.now() + random(360000, 660000);
      tick();
      return true;
    }
    function visitor(kind) {
      if (
        !preferences.visitors ||
        !motion() ||
        !safe() ||
        active ||
        a.life()?.busy() ||
        !$('hubPet') ||
        Math.random() > 0.65
      )
        return null;
      const pet = $('hubPet'),
        v = viewport(),
        x = parseFloat(pet.style.left) || 0,
        y = parseFloat(pet.style.top) || 0,
        size = parseFloat(pet.style.width) || 96,
        point = { x: x + size * 0.4 - 24, y: y - 22 };
      if (
        point.x < v.x + 8 ||
        point.y < v.y + 8 ||
        point.x + 48 > v.x + v.w - 8 ||
        point.y + 48 > v.y + v.h - 8
      )
        return null;
      const blocked = [
        ...document.querySelectorAll(
          '#hubTimerBar,#soundscapeDock,button,input,select,textarea,a,summary,[role="button"]'
        ),
      ]
        .filter(el => !el.closest('#hubPet,#hubVisitors'))
        .some(el => {
          const r = el.getBoundingClientRect();
          return (
            r.width &&
            r.height &&
            point.x < r.right + 4 &&
            point.x + 48 > r.left - 4 &&
            point.y < r.bottom + 4 &&
            point.y + 48 > r.top - 4
          );
        });
      if (blocked) return null;
      active = { kind: 'visitor', visitor: kind, start: Date.now(), step: -1 };
      a.life()?.scene({ pose: 'visitor-watch', expression: 'curious' });
      if (kind === 'firefly') {
        const el = document.createElement('div');
        el.id = 'momoVisitorProp';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML =
          '<svg viewBox="0 0 60 95"><path d="M15 37V24a15 15 0 0 1 30 0v13" fill="none" stroke="#816d46" stroke-width="3"/><path d="M11 37h38l-5 48H16Z" fill="#f8e9b966" stroke="#816d46" stroke-width="3"/><path d="M8 37h44M15 85h30" stroke="#816d46" stroke-width="4"/></svg>';
        document.body.append(el);
        layout();
      }
      return point;
    }
    function visitorEnd() {
      if (active?.kind === 'visitor') finish(false);
    }
    function discoveries() {
      const d = a.state(),
        notes = d.workhub.notes,
        out = [],
        snoozed = (kind, id) => root.WorkHubReminders?.isSnoozed(d, kind, id, a.today());
      for (const t of d.tasks.filter(t => !t.done && !t.archived && !snoozed('tasks', t.id))) {
        const n = notes.find(
          n =>
            (t.taskType === 'Project' && n.projectId === t.linkId) ||
            (t.taskType === 'Ticket' && n.ticketId === t.linkId)
        );
        if (n)
          out.push({
            key: t.id + ':' + n.id,
            title: 'A note for the work in front of you',
            message:
              '“' +
              n.title +
              '” is linked to the same ' +
              (t.taskType === 'Project' ? 'project' : 'ticket') +
              ' as “' +
              t.task +
              '”. It may be a useful reference.',
            links: [
              { kind: 'tasks', id: t.id, label: 'Open task' },
              { kind: 'notes', id: n.id, label: 'Open Knowledge note' },
            ],
          });
      }
      for (const t of d.tickets.filter(
        t => !['Closed', 'Completed'].includes(t.status) && !snoozed('tickets', t.id)
      )) {
        const n = notes.find(n => n.ticketId === t.id);
        if (n)
          out.push({
            key: t.id + ':' + n.id,
            title: 'A familiar clue',
            message:
              'There is a Knowledge note linked to ' +
              t.ticket +
              ': “' +
              n.title +
              '”. Want to keep it nearby while investigating?',
            links: [
              { kind: 'tickets', id: t.id, label: 'Open ticket' },
              { kind: 'notes', id: n.id, label: 'Read the note' },
            ],
          });
      }
      for (const c of d.workhub.lab || []) {
        if (!c.archived && c.status !== 'Solved') {
          const tokens = c.tcodes
              .toLowerCase()
              .split(/[,;\s]+/)
              .filter(x => x.length > 2),
            n = notes.find(n =>
              n.tcodes
                .toLowerCase()
                .split(/[,;\s]+/)
                .some(t => tokens.includes(t))
            );
          if (n)
            out.push({
              key: c.id + ':' + n.id,
              title: 'A matching T-code in your notebook',
              message:
                'This investigation and “' +
                n.title +
                '” mention the same T-code or message ID. This is a record match, not a verified diagnosis.',
              links: [
                { kind: 'lab', id: c.id, label: 'Open case' },
                { kind: 'notes', id: n.id, label: 'Read the note' },
              ],
            });
        }
      }
      if (!out.length) {
        const t = d.tasks.find(
          t => !t.done && !t.archived && t.boardStatus === 'blocked' && !snoozed('tasks', t.id)
        );
        if (t)
          out.push({
            key: 'blocked:' + t.id,
            title: 'A small loose end',
            message:
              '“' +
              t.task +
              '” is still marked Blocked. A short note about what you are waiting for could make returning easier.',
            links: [{ kind: 'tasks', id: t.id, label: 'Open task' }],
          });
      }
      return out;
    }
    function openDiscovery(value) {
      const choice =
        value || envelope || discoveries().find(x => x.key !== lastDiscovery) || discoveries()[0];
      clearEnvelope();
      if (!choice) {
        a.openModal(
          named('Momo’s desk discoveries'),
          '<div class="moments-discovery-empty"><span aria-hidden="true">✉</span><h3>No clue to deliver just yet.</h3><p>Link a Knowledge note to a task’s project or ticket, or record a T-code in the troubleshooting lab. Your companion can then find matching references among your own records.</p></div>'
        );
        return false;
      }
      lastDiscovery = choice.key;
      a.openModal(
        named('Momo’s desk discovery'),
        `<div class="moments-letter"><span class="moments-letter-stamp" aria-hidden="true">✦</span><span class="hub-kicker">A LITTLE NOTE FROM YOUR DESK</span><h3>${esc(choice.title)}</h3><p>${esc(choice.message)}</p><div class="actions">${choice.links.map(l => `<button type="button" data-moment="open-record" data-kind="${l.kind}" data-id="${esc(l.id)}">${esc(l.label)}</button>`).join('')}</div><p class="hub-meta">Found from links and matching IDs in your loaded records. Nothing was changed.</p></div>`
      );
      return true;
    }
    function deliver() {
      if (
        !preferences.discoveries ||
        !motion() ||
        !safe(true) ||
        active ||
        envelope ||
        a.life()?.busy()
      )
        return false;
      const choices = discoveries().filter(x => x.key !== lastDiscovery);
      if (!choices.length) {
        discoveryAt = Date.now() + 300000;
        return false;
      }
      envelope = choices[Math.floor(Math.random() * choices.length)];
      const el = document.createElement('button');
      el.id = 'momoDiscovery';
      el.type = 'button';
      el.dataset.moment = 'discovery';
      el.title = name() + ' found a little desk discovery';
      el.setAttribute('aria-label', named('Open Momo’s desk discovery'));
      el.innerHTML =
        '<svg viewBox="0 0 64 55" aria-hidden="true"><rect x="3" y="8" width="58" height="42" rx="7" fill="#fff0cb" stroke="#96764f" stroke-width="2"/><path d="m5 11 27 22 27-22M5 48l18-18m36 18L41 30" fill="none" stroke="#c9a16c" stroke-width="2"/><path d="m32 24 3 5 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="#bd8fa9" stroke="#916783"/></svg>';
      // Keep the delivery button separate from Momo's direct-child pickup button.
      const anchor = document.createElement('span');
      anchor.id = 'momoDiscoveryAnchor';
      anchor.append(el);
      $('hubPet').append(anchor);
      layout();
      discoveryAt = Date.now() + random(360000, 600000);
      return true;
    }
    function settings() {
      if ($('settingsMenu')) $('settingsMenu').open = false;
      a.openModal(
        named('Momo’s little moments'),
        `<form id="momentsSettingsForm"><div class="moments-letter"><span class="hub-kicker">A LITTLE LIFE AROUND YOUR WORK</span><h3>Small surprises, when you want them.</h3><p>Automatic moments wait until you are not typing, focusing, presenting or watching a video.</p></div>${[
          ['theatre', 'Occasional tiny theatre performances'],
          ['discoveries', 'Little envelopes with useful record discoveries'],
          ['visitors', 'Let ' + name() + ' meet the tiny visitors'],
        ]
          .map(
            ([k, l]) =>
              `<label class="check-label"><input type="checkbox" name="${k}"${preferences[k] ? ' checked' : ''}>${esc(l)}</label>`
          )
          .join(
            ''
          )}<p class="hub-meta">Quiet time pauses automatic performances and discoveries. Motion settings are respected. These choices stay on this device.</p><label for="momentsShow">Try a performance</label><select id="momentsShow">${SHOWS.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}</select><div class="actions"><button type="button" data-moment="show-selected">Watch this show</button><button type="button" data-moment="discover-now">Open a desk discovery</button></div><div class="modal-actions"><button type="submit" class="primary">Save moments</button></div></form>`
      );
    }
    function mount() {
      const nextOwner = a.owner();
      if (nextOwner !== owner) {
        owner = nextOwner;
        finish(false);
        clearEnvelope();
        lastDiscovery = '';
      }
      if (!a.ready()) {
        finish(false);
        clearEnvelope();
        return;
      }
      const host = $('hubSettingsAppearance');
      if (host && !$('momentsSettings')) {
        const b = document.createElement('button');
        b.id = 'momentsSettings';
        b.type = 'button';
        b.dataset.moment = 'settings';
        b.textContent = named('Momo’s little moments');
        host.append(b);
      }
      if ($('momentsSettings')) $('momentsSettings').textContent = name() + '’s little moments';
      layout();
    }
    function tick() {
      if (!safe()) {
        finish();
        clearEnvelope();
        return;
      }
      if (!motion()) {
        finish();
        clearEnvelope();
        return;
      }
      if (quiet()) {
        clearEnvelope();
        if (active?.automatic) {
          finish();
          return;
        }
      }
      if (active) {
        const elapsed = Date.now() - active.start;
        if (active.kind === 'theatre') {
          if (elapsed >= 12000) {
            finish();
            return;
          }
          const step = Math.min(2, Math.floor(elapsed / 4000));
          if (step !== active.step) {
            active.step = step;
            const show = SHOWS[active.show];
            $('momoTheatre').dataset.step = String(step);
            $('momoTheatreCaption').textContent = named(show.lines[step]);
            a.life()?.scene({ pose: 'theatre-' + show.prop, expression: show.poses[step] });
          }
        } else if (active.kind === 'visitor') {
          if (elapsed >= 19000) {
            finish(false);
            return;
          }
          const step = elapsed < 4500 ? 0 : elapsed < 9500 ? 1 : 2;
          if (step !== active.step) {
            active.step = step;
            const kind = active.visitor;
            if (step === 1) {
              if (!quiet())
                a.react(
                  'happy',
                  kind === 'butterfly'
                    ? 'Achoo! Your wings tickle my nose.'
                    : kind === 'bird'
                      ? 'A new hat? Oh. A very chirpy hat.'
                      : kind === 'firefly'
                        ? 'A tiny lantern. A very bright friend.'
                        : 'A ' + kind + '! Our desk has excellent company.',
                  4000
                );
              a.life()?.scene({
                pose: kind === 'butterfly' ? 'sneeze' : 'visitor-watch',
                expression: kind === 'butterfly' ? 'surprised' : 'delighted',
              });
            } else
              a.life()?.scene({
                pose: 'visitor-watch',
                expression: step === 0 ? 'curious' : 'shy',
              });
          }
        }
        layout();
        return;
      }
      if (a.life()?.busy() || !safe(true)) return;
      if (preferences.discoveries && Date.now() >= discoveryAt) {
        deliver();
        return;
      }
      if (preferences.theatre && Date.now() >= theatreAt) playTheatre(undefined, true);
      layout();
    }
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-moment]');
      if (!b) return;
      const action = b.dataset.moment;
      if (action === 'close-show') finish();
      if (action === 'discovery') openDiscovery();
      if (action === 'settings') settings();
      if (action === 'show-selected') {
        const index = Number($('momentsShow').value);
        a.closeModal();
        playTheatre(index);
      }
      if (action === 'discover-now') openDiscovery();
      if (action === 'open-record') a.workbench().openRecord(b.dataset.kind, b.dataset.id);
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'momentsSettingsForm') return;
      event.preventDefault();
      for (const k of Object.keys(preferences))
        preferences[k] = event.target.elements.namedItem(k).checked;
      try {
        localStorage.setItem(STORE, JSON.stringify(preferences));
      } catch {}
      if (!preferences.theatre && active?.kind === 'theatre') finish();
      if (!preferences.visitors && active?.kind === 'visitor') finish(false);
      if (!preferences.discoveries) clearEnvelope();
      a.closeModal();
      a.tell(named('Momo’s moments saved on this device.'));
    });
    root.addEventListener('workhub:momo-extra', event => {
      if (event.detail?.action === 'theatre') playTheatre();
      else if (event.detail?.action === 'discover') openDiscovery();
      else settings();
    });
    document.addEventListener(
      'pointerdown',
      event => {
        if (active?.kind === 'theatre' && !event.target.closest?.('#momoTheatre'))
          finish(!event.target.closest?.('#hubPet'));
      },
      { passive: true }
    );
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        finish();
        clearEnvelope();
      }
    });
    const sync = () => {
      if (!safe() || !motion()) {
        finish();
        clearEnvelope();
      }
    };
    new root.MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-motion'],
    });
    new root.MutationObserver(sync).observe($('modal'), {
      attributes: true,
      attributeFilter: ['open'],
    });
    document.addEventListener('visibilitychange', sync);
    root.addEventListener('resize', () => {
      finish();
      clearEnvelope();
    });
    root.visualViewport?.addEventListener('resize', () => {
      finish();
      clearEnvelope();
    });
    root.addEventListener('pagehide', () => {
      finish(false);
      clearEnvelope();
    });
    return {
      mount,
      tick,
      settings,
      playTheatre,
      finish,
      visitor,
      visitorEnd,
      discoveries,
      deliver,
      openDiscovery,
      snapshot: () => ({
        preferences: { ...preferences },
        active: active
          ? { kind: active.kind, show: active.show, visitor: active.visitor, step: active.step }
          : null,
        envelope: envelope?.key || null,
      }),
    };
  }
  root.WorkHubMomoMoments = { install };
})(window);
