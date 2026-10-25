/** Account settings, rule inbox, sync evidence, lighting and companion moments. */
(function (root) {
  'use strict';
  const E = root.WorkHubExperienceEngine,
    A = root.WorkHubExperienceArt;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function paintSound(s) {
    const host = document.querySelector('.soundscape-room');
    if (!host) return;
    let art = host.querySelector('.experience-sound-art');
    if (!art) {
      art = document.createElement('section');
      art.className = 'experience-sound-art';
      art.setAttribute('aria-label', 'Soundscape artwork');
      host.prepend(art);
    }
    const kind = Object.entries(s.mix).sort((a, b) => b[1] - a[1])[0]?.[0] || 'lofi';
    if (art.dataset.kind !== kind) {
      art.dataset.kind = kind;
      art.innerHTML =
        A.sound(kind) +
        '<div><span>YOUR FOCUS SOUNDSCAPE</span><strong></strong><small></small></div>';
    }
    art.dataset.state = !s.playing ? 'paused' : s.muted ? 'muted' : 'playing';
    art.querySelector('strong').textContent = {
      rain: 'A rainy window',
      cafe: 'A quiet café',
      forest: 'Among the leaves',
      fireplace: 'Beside the fire',
      lofi: 'A rhythm for focus',
    }[kind];
    art.querySelector('small').textContent = !s.playing
      ? 'Paused · ready when you are'
      : s.muted
        ? 'Muted'
        : 'Playing';
  }
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      wasResting = false,
      cached = null,
      found = [],
      nextCheck = 0,
      greetingAfter = Date.now() + 6000,
      away = 0,
      greetingPending = true,
      lastGreeting = 0,
      momentTimer = 0,
      celebrations = 0,
      localSeen = new Set();
    const settings = () => a.state().workhub.experience,
      ready = () => a.ready() && a.owner() === owner && !!owner;
    function quiet() {
      return (
        document.hidden ||
        document.body.matches(
          '.hub-private,.hub-present,.hub-focus,.rest-room-open,.presentation-break-open'
        ) ||
        !!document.querySelector('dialog[open]') ||
        document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
      );
    }
    function clearMoment() {
      clearTimeout(momentTimer);
      momentTimer = 0;
      const p = $('hubPet');
      if (p) delete p.dataset.experienceReaction;
    }
    function syncOwner() {
      const next = a.ready() ? a.owner() : '';
      if (next === owner) return;
      owner = next;
      cached = null;
      found = [];
      nextCheck = 0;
      localSeen.clear();
      greetingPending = true;
      greetingAfter = Date.now() + 6000;
      lastGreeting = 0;
      clearMoment();
      $('experienceCelebration')?.remove();
      if (
        document.querySelector('[data-experience-owner]')?.dataset.experienceOwner !== owner &&
        document.querySelector('[data-experience-owner]')
      )
        a.closeModal();
      try {
        lastGreeting = Number(localStorage.getItem('mm-tracker.greeting.v1:' + owner)) || 0;
      } catch {}
    }
    function health() {
      const c = a.cloud(),
        cache = a.syncHealth?.()?.cacheAvailable ?? !!c.lastCache;
      return {
        ...E.syncHealth(c, cache, navigator.onLine !== false),
        cacheAvailable: cache,
        revision: c.revision,
        status: c.status,
      };
    }
    function openHealth() {
      syncOwner();
      if (!owner) return;
      const h = health();
      a.openModal(
        'Sync health centre',
        `<section class="experience-health" data-experience-owner="${esc(owner)}"><span class="ex-kicker">YOUR SAVING STATUS</span><h3 data-health-title></h3><p data-health-message></p><dl><dt>Cloud revision</dt><dd data-health-revision></dd><dt>Browser recovery copy</dt><dd data-health-cache></dd><dt>Changes waiting</dt><dd data-health-pending></dd></dl><p>Keep this page open while changes are waiting. A cloud save is confirmed only after the existing save flow acknowledges it.</p><div class="actions"><button type="button" data-experience="retry">Retry / refresh sync</button><button type="button" data-experience="review">Open existing recovery controls</button></div><p data-health-action role="status"></p></section>`
      );
      paintHealth();
    }
    function paintHealth() {
      if (!$('modal')?.open || !document.querySelector('.experience-health')) return;
      const h = health();
      for (const [key, v] of Object.entries({
        title: h.title,
        message: h.status,
        revision: h.revision,
        cache: h.cacheAvailable
          ? 'Available on this device'
          : 'Unavailable — keep waiting changes open',
        pending: h.pending ? 'Yes' : 'No',
      })) {
        const n = document.querySelector('[data-health-' + key + ']');
        if (n) n.textContent = String(v ?? '');
      }
      document.querySelector('.experience-health').dataset.state = h.state;
    }
    function save(fn) {
      if (!ready()) throw Error('Sign in and reopen these settings.');
      return a.mutate(d => {
        E.upgrade(d);
        fn(d.workhub.experience);
        E.validate(d);
      });
    }
    function openSettings() {
      syncOwner();
      if (!owner) return;
      const p = settings().appearance;
      a.openModal(
        'Workspace atmosphere & companion',
        `<form id="experienceSettingsForm" data-experience-owner="${esc(owner)}"><span class="ex-kicker">A LITTLE MORE YOU</span><h3>Light, moments & a home for your companion</h3><label>Workspace lighting<select name="lighting">${[
          ['auto', 'Follow local time · gradual lighting'],
          ['morning', 'Morning'],
          ['afternoon', 'Afternoon'],
          ['evening', 'Evening'],
          ['night', 'Night'],
          ['off', 'Use my saved theme'],
        ]
          .map(
            ([k, l]) => `<option value="${k}"${p.lighting === k ? ' selected' : ''}>${l}</option>`
          )
          .join('')}</select></label><label>Companion habitat<select name="habitat">${[
          ['auto', 'Follow his activity'],
          ['reading', 'Reading nook'],
          ['resting', 'Resting corner'],
        ]
          .map(
            ([k, l]) => `<option value="${k}"${p.habitat === k ? ' selected' : ''}>${l}</option>`
          )
          .join('')}</select></label>${[
          ['celebrations', 'Brief varied completion moments'],
          ['expressions', 'Companion reactions to completed work and returning from breaks'],
          ['greetings', 'Occasional arrival and return greetings'],
        ]
          .map(
            ([k, l]) =>
              `<label class="check-label"><input type="checkbox" name="${k}"${p[k] ? ' checked' : ''}>${l}</label>`
          )
          .join(
            ''
          )}<p>After Go home and nap, only clicking your companion wakes him. Quiet/focus/presentation, typing and reduced-motion preferences take precedence. These preferences follow your account.</p><div class="actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save experience settings</button></div></form>`
      );
    }
    function openRules() {
      syncOwner();
      if (!owner) return;
      check(true);
      a.openModal(
        'Personal reminder rules',
        `<section class="experience-rules" data-experience-owner="${esc(owner)}"><span class="ex-kicker">NUDGES YOU MAINTAIN</span><h3>My reminder rules</h3><p>Evaluated while the website is open. Rules do not send notifications when the website is closed or change your records.</p>${
          settings()
            .rules.map(
              r =>
                `<article><div><strong>${esc(r.name)}</strong><small>${esc(E.KINDS[r.kind])} · threshold ${r.threshold}${r.kind === 'activity-soon' ? ' minutes' : ' days'} · ${r.enabled ? 'Enabled' : 'Paused'}</small></div><div class="actions"><button type="button" data-experience="rule-edit" data-id="${esc(r.id)}">Edit</button><button type="button" data-experience="rule-toggle" data-id="${esc(r.id)}">${r.enabled ? 'Pause' : 'Enable'}</button><button type="button" data-experience="rule-delete" data-id="${esc(r.id)}">Remove</button></div></article>`
            )
            .join('') || '<p>No rules yet. Add one to choose your first nudge.</p>'
        }<div class="actions"><button type="button" data-experience="rule-edit">＋ Add rule</button><button type="button" data-experience="inbox">Review matches (${found.length})</button></div></section>`
      );
    }
    function editRule(id) {
      const r = settings().rules.find(r => r.id === id) || {
        id: '',
        name: '',
        kind: 'stale-ticket',
        threshold: 3,
        enabled: true,
      };
      a.openModal(
        'Maintain reminder rule',
        `<form id="experienceRuleForm" data-experience-owner="${esc(owner)}" data-id="${esc(r.id)}" data-updated="${esc(r.updatedAt || '')}"><label>Rule name<input name="name" required maxlength="160" value="${esc(r.name)}"></label><label>When<select name="kind">${Object.entries(
          E.KINDS
        )
          .map(([k, l]) => `<option value="${k}"${r.kind === k ? ' selected' : ''}>${l}</option>`)
          .join(
            ''
          )}</select></label><label>Threshold<input type="number" name="threshold" min="0" max="3650" step="1" required value="${r.threshold}"></label><p>Days for stale tickets and overdue tasks; minutes for activities; remaining days for leave balances. A zero-day task threshold checks overdue tasks. Undated ticket updates are not guessed.</p><label class="check-label"><input type="checkbox" name="enabled"${r.enabled ? ' checked' : ''}>Enabled</label><div class="actions"><button type="button" data-experience="rules">Back</button><button type="submit" class="primary">Save rule</button></div></form>`
      );
    }
    function inbox() {
      syncOwner();
      if (!owner) return;
      check(true);
      a.openModal(
        'Rule reminder inbox',
        `<section class="experience-inbox" data-experience-owner="${esc(owner)}"><span class="ex-kicker">YOUR RULES · CURRENT MATCHES</span><h3>${found.length} item(s) to review</h3>${found.map((r, i) => `<article><h4 class="hub-sensitive">${esc(r.title)}</h4><p>${esc(r.reason)}</p><div class="actions"><button type="button" data-experience="result-open" data-index="${i}" data-key="${esc(r.key)}">Open</button><button type="button" data-experience="result-snooze" data-index="${i}" data-key="${esc(r.key)}">Snooze 1 hour</button><button type="button" data-experience="result-dismiss" data-index="${i}" data-key="${esc(r.key)}">Dismiss this issue</button></div></article>`).join('') || '<p>No current matches. Dismissed issues stay quiet until the record or rule changes.</p>'}<button type="button" data-experience="rules">Maintain rules</button></section>`
      );
    }
    function check(force = false) {
      if (!ready()) return;
      if (!force && cached === a.state() && Date.now() < nextCheck) return;
      cached = a.state();
      nextCheck = Date.now() + 60000;
      found = E.results(a.state(), Date.now(), root.WorkHubLeaveBalancesEngine);
      const b = $('experienceRuleInbox');
      if (b) b.textContent = 'Rule reminders · ' + found.length;
    }
    function reaction(kind) {
      const p = $('hubPet'),
        life = a.life();
      if (
        !ready() ||
        !settings().appearance.expressions ||
        quiet() ||
        !p ||
        life?.sleeping() ||
        !life?.sceneAvailable()
      )
        return false;
      clearMoment();
      p.dataset.experienceReaction = kind;
      life.express(kind === 'return' ? 'sleepy' : 'delighted');
      a.react(
        'happy',
        kind === 'return'
          ? 'A calmer rhythm. Ready for one small step?'
          : 'A little progress worth a little smile.',
        2600
      );
      momentTimer = setTimeout(clearMoment, 3000);
      return true;
    }
    function greet() {
      if (Date.now() < greetingAfter) return;
      try {
        if (
          JSON.parse(localStorage.getItem('mm-tracker.momo-adventures.v1') || '{}').greetings ===
          false
        )
          return;
      } catch {}
      if (
        !greetingPending ||
        !ready() ||
        !settings().appearance.greetings ||
        quiet() ||
        !a.prefs().mascot ||
        a.life()?.sleeping() ||
        !a.life()?.sceneAvailable() ||
        Date.now() - lastGreeting < 1800000
      )
        return;
      try {
        if (localStorage.getItem('mm-tracker.momo-chatter.v1') === 'quiet') return;
      } catch {}
      greetingPending = false;
      lastGreeting = Date.now();
      try {
        localStorage.setItem('mm-tracker.greeting.v1:' + owner, String(lastGreeting));
      } catch {}
      const p = $('hubPet');
      if (p) p.dataset.experienceReaction = 'greeting';
      a.life()?.express('delighted');
      a.react('happy', 'Welcome back. Your little corner is ready.', 2800);
      momentTimer = setTimeout(clearMoment, 3000);
    }
    function celebrate() {
      if (!ready()) return false;
      if (!settings().appearance.celebrations) return true;
      if (
        document.hidden ||
        document.body.matches('.hub-private,.hub-present,.hub-focus') ||
        a.prefs().motion === 'off' ||
        root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      )
        return true;
      const styles = ['bloom', 'lantern', 'star'],
        style = styles[celebrations++ % styles.length];
      $('experienceCelebration')?.remove();
      const box = document.createElement('div');
      box.id = 'experienceCelebration';
      box.className = 'experience-celebration';
      box.dataset.style = style;
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = Array.from(
        { length: root.innerWidth < 600 ? 5 : 9 },
        (_, i) =>
          `<i style="--i:${i}">${style === 'bloom' ? '✿' : style === 'lantern' ? '▥' : '✦'}</i>`
      ).join('');
      document.body.append(box);
      setTimeout(() => box.remove(), 2400);
      reaction('complete');
      return true;
    }
    function mount() {
      syncOwner();
      document.body.dataset.experiencePaused = String(document.hidden);
      const host = $('hubSettingsAppearance');
      if (host && !$('experienceSettingsButton')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'experienceSettingsButton';
        b.dataset.experience = 'settings';
        b.textContent = 'Light, companion & completion moments';
        host.append(b);
      }
      const toolbar = $('hubToolbar');
      if (toolbar && owner && !$('experienceRuleInbox')) {
        for (const [id, action, label] of [
          ['experienceRuleInbox', 'inbox', 'Rule reminders'],
          ['experienceSyncButton', 'sync', 'Sync health'],
        ]) {
          const b = document.createElement('button');
          b.type = 'button';
          b.id = id;
          b.dataset.experience = action;
          b.className = 'hub-private-only';
          b.textContent = label;
          toolbar.append(b);
        }
      }
      if (!owner) {
        document.body.removeAttribute('data-experience-phase');
        $('experienceRuleInbox')?.remove();
        $('experienceSyncButton')?.remove();
        return;
      }
      check();
      const p = settings().appearance,
        l = E.lighting(p.lighting);
      document.body.dataset.experiencePhase = l.phase;
      document.body.style.setProperty('--experience-warmth', l.warmth);
      document.body.style.setProperty('--experience-night', l.night);
      const home = $('hubMomoHome');
      if (home) {
        if (!home.querySelector('.experience-habitat')) home.innerHTML = A.habitat();
        home.dataset.habitat = a.life()?.sleeping()
          ? 'sleeping'
          : p.habitat === 'auto'
            ? a.life()?.gestureState() === 'sit'
              ? 'reading'
              : 'resting'
            : p.habitat;
      }
      const resting = document.body.classList.contains('rest-room-open');
      if (wasResting && !resting) reaction('return');
      wasResting = resting;
      paintHealth();
      greet();
    }
    function tick() {
      syncOwner();
      if (!ready()) return;
      paintHealth();
      const resting = document.body.classList.contains('rest-room-open');
      if (wasResting && !resting) reaction('return');
      wasResting = resting;
      if (!document.hidden) {
        check();
        greet();
      }
    }
    document.addEventListener('submit', event => {
      const f = event.target;
      if (!['experienceSettingsForm', 'experienceRuleForm'].includes(f.id)) return;
      event.preventDefault();
      try {
        if (!ready() || f.dataset.experienceOwner !== owner)
          throw Error('Reopen these settings for your current account.');
        if (f.id === 'experienceSettingsForm') {
          const p = {
            lighting: f.elements.lighting.value,
            habitat: f.elements.habitat.value,
            ...Object.fromEntries(
              ['celebrations', 'expressions', 'greetings'].map(k => [
                k,
                f.elements.namedItem(k).checked,
              ])
            ),
          };
          if (save(e => (e.appearance = p))) {
            a.closeModal();
            mount();
          }
        } else {
          const id = f.dataset.id,
            r = {
              id: id || root.crypto?.randomUUID?.() || 'rule-' + Date.now(),
              name: f.elements.name.value.trim(),
              kind: f.elements.kind.value,
              threshold: Number(f.elements.threshold.value),
              enabled: f.elements.enabled.checked,
              updatedAt: new Date().toISOString(),
            };
          const kept = save(e => {
            const old = e.rules.find(x => x.id === id);
            if (id && (!old || old.updatedAt !== f.dataset.updated))
              throw Error('This rule changed. Reopen it before saving.');
            if (old) e.rules[e.rules.indexOf(old)] = r;
            else e.rules.push(r);
          });
          if (kept) openRules();
        }
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-experience]');
      if (!b) return;
      try {
        syncOwner();
        if (!ready()) return;
        const action = b.dataset.experience,
          id = b.dataset.id;
        if (action === 'settings') openSettings();
        else if (action === 'sync') openHealth();
        else if (action === 'rules') openRules();
        else if (action === 'inbox') inbox();
        else if (action === 'rule-edit') editRule(id);
        else if (action === 'retry') {
          $('cloudRetry')?.click();
          paintHealth();
        } else if (action === 'review') {
          a.closeModal();
          $('settingsMenu').open = true;
          $('settingsTab-data')?.click();
          $('cloudReload')?.focus();
        } else if (action === 'rule-toggle' || action === 'rule-delete') {
          save(e => {
            const r = e.rules.find(x => x.id === id);
            if (!r) return;
            if (action === 'rule-toggle') {
              r.enabled = !r.enabled;
              r.updatedAt = new Date().toISOString();
            } else {
              e.rules = e.rules.filter(x => x.id !== id);
              e.acknowledged = e.acknowledged.filter(x => !x.key.startsWith(id + '|'));
            }
          });
          openRules();
        } else if (action.startsWith('result-')) {
          check(true);
          const r = found.find(r => r.key === b.dataset.key);
          if (!r) return;
          if (action === 'result-open') {
            a.closeModal();
            if (r.kind === 'tickets') a.ticket(r.id);
            else if (r.kind === 'tasks') a.hubAction({ dataset: { hub: 'task-detail', id: r.id } });
            else if (r.kind === 'schedule') a.navigate('schedule');
            else a.navigate('schedule');
          } else {
            save(e => {
              e.acknowledged = e.acknowledged.filter(x => x.key !== r.key);
              e.acknowledged.push({
                key: r.key,
                until: action === 'result-snooze' ? Date.now() + 3600000 : 0,
              });
              e.acknowledged = e.acknowledged.slice(-1000);
            });
            inbox();
          }
        }
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('visibilitychange', () => {
      document.body.dataset.experiencePaused = String(document.hidden);
      if (document.hidden) {
        away = Date.now();
        clearMoment();
      } else {
        if (away && Date.now() - away >= 300000) greetingPending = true;
        mount();
      }
    });
    document.addEventListener('click', event => {
      if (event.target.closest?.('#hubPet'))
        setTimeout(() => {
          if (ready()) greet();
        }, 0);
    });
    root.addEventListener('pagehide', () => {
      clearMoment();
      $('experienceCelebration')?.remove();
    });
    const timer = setInterval(() => {
      syncOwner();
      if (ready() && !document.hidden) mount();
    }, 60000);
    root.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    return {
      mount,
      tick,
      openSettings,
      openRules,
      inbox,
      openHealth,
      celebrate,
      reaction,
      check,
      results: () => found,
      snapshot: () => ({ owner, health: health(), matches: found.length }),
    };
  }
  root.WorkHubExperience = { install, paintSound };
})(window);
