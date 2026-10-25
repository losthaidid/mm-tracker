/** Audience-only breaks. Messages and countdowns stay in memory; no record or timer writes. */
(function (root) {
  'use strict';
  const SCENES = { coast: 'Coastal dawn', mountains: 'Mountain dusk', stars: 'Night sky' };
  const clock = seconds =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const scenery = () =>
    '<div class="pb-scenery" aria-hidden="true"><i class="pb-sun"></i><i class="pb-cloud"></i><i class="pb-ridge back"></i><i class="pb-ridge front"></i><i class="pb-water"></i><i class="pb-stars"></i></div>';
  function install(a) {
    let owner = '',
      settings = null,
      audience = null,
      trigger = null,
      session = null,
      screenDetails = null,
      chosenScreen = null,
      generation = 0,
      draft = { message: '', complete: 'Ready to continue', minutes: 5, scene: 'coast' };
    const text = (element, value) => {
      if (element && element.textContent !== value) element.textContent = value;
    };
    function closeSettings() {
      if (!settings) return;
      settings.close();
      settings.remove();
      settings = null;
    }
    function end(restore = true) {
      generation++;
      session = null;
      if (audience) {
        if (document.fullscreenElement && audience.contains(document.fullscreenElement))
          void document.exitFullscreen?.().catch(() => {});
        audience.close();
        audience.remove();
        audience = null;
      }
      document.body.classList.remove('presentation-break-open');
      if (restore && trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        end(false);
        closeSettings();
        owner = next;
        draft = { message: '', complete: 'Ready to continue', minutes: 5, scene: 'coast' };
        chosenScreen = screenDetails = null;
      }
      if (!audience || !session) return;
      const seconds = Math.max(
        0,
        Math.ceil((session.end - (session.pausedAt ?? Date.now())) / 1000)
      );
      if (seconds === 0) session.complete = true;
      audience.dataset.motion =
        document.hidden || document.body.dataset.motion === 'off' ? 'still' : 'flow';
      audience.dataset.phase = session.complete
        ? 'complete'
        : session.pausedAt != null
          ? 'paused'
          : 'running';
      text(audience.querySelector('[data-pb-clock]'), clock(seconds));
      text(
        audience.querySelector('[data-pb-status]'),
        session.complete
          ? session.completeMessage
          : session.pausedAt != null
            ? 'Countdown paused'
            : 'Until we resume'
      );
      const pause = audience.querySelector('[data-pb="pause"]');
      pause.hidden = session.complete;
      const pauseLabel = session.pausedAt != null ? 'Resume countdown' : 'Pause countdown';
      pause.setAttribute('aria-label', pauseLabel);
      pause.title = pauseLabel;
      text(pause, session.pausedAt != null ? '▶' : 'Ⅱ');
    }
    async function fullscreen() {
      if (!audience) return;
      const stage = audience.querySelector('.pb-stage'),
        current = generation;
      try {
        if (!stage.requestFullscreen) throw Error('Fullscreen is unavailable');
        if (chosenScreen && !screenDetails?.screens.includes(chosenScreen))
          throw Error('The chosen screen disconnected');
        await stage.requestFullscreen(
          chosenScreen ? { screen: chosenScreen, navigationUI: 'hide' } : { navigationUI: 'hide' }
        );
        if (current !== generation || !audience) {
          if (document.fullscreenElement === stage)
            void document.exitFullscreen?.().catch(() => {});
          return;
        }
        if (document.fullscreenElement !== stage) throw Error('Fullscreen was not entered');
        text(audience.querySelector('[data-pb-notice]'), '');
      } catch {
        if (current !== generation || !audience) return;
        text(
          audience.querySelector('[data-pb-notice]'),
          'Automatic fullscreen was unavailable. Use Full screen to retry, or keep this window on your shared screen.'
        );
      }
    }
    function start(form) {
      sync();
      if (!owner || form !== settings?.querySelector('form')) return;
      const message = form.elements.namedItem('message').value.trim(),
        completion = form.elements.namedItem('complete').value.trim(),
        minutes = Number(form.elements.namedItem('minutes').value),
        scene = form.elements.namedItem('scene').value;
      if (
        !message ||
        message.length > 240 ||
        completion.length > 120 ||
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 180 ||
        !Object.hasOwn(SCENES, scene)
      ) {
        text(
          settings.querySelector('[data-pb-error]'),
          'Enter a message, a whole number from 1–180 minutes, and a scenery choice.'
        );
        return;
      }
      const selection = form.elements.namedItem('screen').value;
      chosenScreen =
        selection === 'current' ? null : screenDetails?.screens[Number(selection)] || null;
      draft = { message, complete: completion, minutes, scene };
      closeSettings();
      session = {
        end: Date.now() + minutes * 60000,
        completeMessage: completion || '00:00',
        complete: false,
      };
      audience = document.createElement('dialog');
      audience.id = 'presentationBreak';
      audience.className = 'pb-audience';
      audience.dataset.scene = scene;
      audience.dataset.messageSize = message.length > 120 ? 'long' : 'short';
      audience.setAttribute('aria-labelledby', 'pbMessage');
      audience.innerHTML = `<section class="pb-stage">${scenery()}<div class="pb-copy"><p class="pb-eyebrow">A MOMENT TO RESET</p><h1 id="pbMessage"></h1><output data-pb-clock role="timer" aria-label="Presentation countdown" aria-live="off"></output><p data-pb-status role="status"></p></div><div class="pb-controls" role="group" aria-label="Presentation break controls"><button type="button" data-pb="pause" aria-label="Pause countdown" title="Pause countdown">Ⅱ</button><button type="button" data-pb="fullscreen" aria-label="Full screen" title="Full screen">⛶</button><button type="button" data-pb="end" aria-label="Back to presentation" title="Back to presentation">↩</button></div><p class="pb-notice" data-pb-notice role="status"></p></section>`;
      text(audience.querySelector('#pbMessage'), message);
      audience.addEventListener('cancel', event => {
        event.preventDefault();
        end();
      });
      document.body.append(audience);
      audience.showModal();
      document.body.classList.add('presentation-break-open');
      sync();
      // Request from this submit gesture. Only audience content enters fullscreen.
      void fullscreen();
    }
    function open() {
      sync();
      if (!owner) return;
      if (
        !document.dispatchEvent(
          new root.CustomEvent('workhub-presentation-launch', {
            cancelable: true,
            detail: { kind: 'presentation-break' },
          })
        )
      )
        return;
      if (audience) {
        audience.querySelector('[data-pb="end"]').focus();
        return;
      }
      if (settings) return;
      trigger = document.activeElement;
      settings = document.createElement('dialog');
      settings.className = 'pb-settings';
      settings.id = 'presentationBreakSettings';
      settings.setAttribute('aria-labelledby', 'pbSettingsTitle');
      settings.innerHTML = `<form><p class="pb-eyebrow">YOUR AUDIENCE SCREEN</p><h2 id="pbSettingsTitle">Presentation break</h2><p>Choose what your audience sees. This silent countdown leaves your personal break and work timers alone.</p><label>Your message<textarea name="message" maxlength="240" rows="3" required placeholder="Type your message for the people watching…"></textarea></label><div class="pb-fields"><label>Countdown (minutes)<input name="minutes" type="number" min="1" max="180" step="1" required></label><label>Scenery<select name="scene">${Object.entries(
        SCENES
      )
        .map(([key, value]) => `<option value="${key}">${value}</option>`)
        .join(
          ''
        )}</select></label></div><label>When the countdown finishes<input name="complete" maxlength="120"></label><div class="pb-preview" data-scene="coast">${scenery()}<span>YOUR MESSAGE + COUNTDOWN</span></div><fieldset><legend>Presentation screen</legend><select name="screen" aria-label="Presentation screen"><option value="current">Current screen</option></select><button type="button" data-pb="screens">Choose another screen</button><p data-pb-screen-note>The website cannot detect which screen your meeting app is sharing. Choose the same screen here.</p></fieldset><p data-pb-error role="alert"></p><div class="pb-actions"><button type="button" data-pb="cancel">Cancel</button><button type="submit" class="primary">Start presentation break</button></div></form>`;
      const form = settings.querySelector('form');
      for (const [key, value] of Object.entries(draft)) form.elements.namedItem(key).value = value;
      settings.querySelector('.pb-preview').dataset.scene = draft.scene;
      settings.addEventListener('cancel', event => {
        event.preventDefault();
        closeSettings();
        trigger?.focus();
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        start(form);
      });
      form.addEventListener('change', event => {
        if (event.target.name === 'scene')
          settings.querySelector('.pb-preview').dataset.scene = event.target.value;
        if (event.target.name === 'screen')
          chosenScreen =
            event.target.value === 'current'
              ? null
              : screenDetails?.screens[Number(event.target.value)] || null;
      });
      if (!root.getScreenDetails) {
        settings.querySelector('[data-pb="screens"]').hidden = true;
        text(
          settings.querySelector('[data-pb-screen-note]'),
          'Screen selection is unavailable in this browser. Put this window on the shared screen before starting.'
        );
      }
      // Screen objects are live and permissions can change; each setup starts on this screen.
      chosenScreen = null;
      document.body.append(settings);
      settings.showModal();
      form.elements.namedItem('message').focus();
    }
    async function screens() {
      const dialog = settings,
        account = owner,
        current = generation;
      if (!dialog || !root.getScreenDetails) return;
      try {
        const details = await root.getScreenDetails();
        if (current !== generation || !a.ready() || a.owner() !== account || settings !== dialog)
          return;
        screenDetails = details;
        const select = dialog.querySelector('[name="screen"]');
        select.replaceChildren(new Option('Current screen', 'current'));
        details.screens.forEach((screen, index) =>
          select.add(
            new Option(
              screen.label || `Screen ${index + 1}${screen.isPrimary ? ' (primary)' : ''}`,
              String(index)
            )
          )
        );
        text(
          dialog.querySelector('[data-pb-screen-note]'),
          'Select the monitor your meeting app is sharing. Fullscreen placement depends on browser support and permission.'
        );
      } catch {
        if (settings === dialog)
          text(
            dialog.querySelector('[data-pb-screen-note]'),
            'Screen permission was unavailable. Current-screen presentation still works.'
          );
      }
    }
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-pb]');
      if (!button) return;
      const action = button.dataset.pb;
      if (action === 'open') open();
      else if (action === 'screens') void screens();
      else if (action === 'cancel') {
        closeSettings();
        trigger?.focus();
      } else if (action === 'end') end();
      else if (action === 'fullscreen') void fullscreen();
      else if (action === 'pause' && session && !session.complete) {
        if (session.pausedAt != null) {
          session.end += Date.now() - session.pausedAt;
          delete session.pausedAt;
        } else session.pausedAt = Date.now();
        sync();
      }
    });
    document.addEventListener('workhub-presentation-launch', event => {
      if (['process', 'rest'].includes(event.detail?.kind)) {
        end(false);
        closeSettings();
      }
    });
    document.addEventListener('visibilitychange', sync);
    document.addEventListener(
      'keydown',
      event => {
        if (audience?.open && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
    root.addEventListener('pagehide', () => {
      end(false);
      closeSettings();
    });
    return { sync };
  }
  root.WorkHubPresentationBreak = { install };
})(window);
