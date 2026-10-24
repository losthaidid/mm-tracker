/**
 * soundscape.js
 * Ambient sound mixer and floating controls.
 * Uses local Web Audio synthesis and lofi-engine.js; settings stay on this device.
 * NAMES and PRESETS describe mixer choices. Audio starts after an explicit user interaction.
 * File map: docs/FILE-MAP.md
 */
/* Original, synthesized ambient audio. No media downloads or cloud records. */
(function (root) {
  'use strict';
  const STORE = 'mm-tracker.soundscape.v1',
    NAMES = {
      rain: 'Gentle rain',
      cafe: 'Café murmur',
      forest: 'Forest breeze',
      fireplace: 'Fireplace',
      lofi: 'Lo-fi focus music',
    };
  const PRESETS = {
    rain: { rain: 55, cafe: 0, forest: 10, fireplace: 0, lofi: 0 },
    cafe: { rain: 20, cafe: 50, forest: 0, fireplace: 0, lofi: 0 },
    forest: { rain: 0, cafe: 0, forest: 65, fireplace: 0, lofi: 0 },
    fireplace: { rain: 15, cafe: 0, forest: 0, fireplace: 60, lofi: 0 },
    lofi: { rain: 12, cafe: 0, forest: 0, fireplace: 0, lofi: 85 },
  };
  const level = (n, f = 0) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : f);
  function install(a) {
    const $ = id => document.getElementById(id);
    let mix = { rain: 45, cafe: 0, forest: 0, fireplace: 0, lofi: 0 },
      master = 45,
      muted = false,
      context = null,
      output = null,
      channels = {},
      nodes = [],
      playing = false,
      birdAt = 0,
      crackleAt = 0,
      starting = null,
      generation = 0,
      error = '',
      track = 'lantern',
      musicVoice = null,
      renderedTrack = '';
    try {
      const p = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (p) {
        mix = Object.fromEntries(
          Object.keys(NAMES).map(k => [k, level(p.mix?.[k], k === 'rain' ? 45 : 0)])
        );
        master = level(p.master, 45);
        muted = p.muted === true;
        if (Object.hasOwn(root.WorkHubLofi.TRACKS, p.track)) track = p.track;
      }
    } catch {}
    function persist() {
      try {
        localStorage.setItem(STORE, JSON.stringify({ mix, master, muted, track }));
      } catch {}
    }
    function gain(node, value) {
      if (!node || !context) return;
      node.gain.cancelScheduledValues?.(context.currentTime);
      node.gain.setTargetAtTime(value, context.currentTime, 0.08);
    }
    function apply() {
      ensureMusic();
      gain(output, muted ? 0 : (master / 100) * 0.6);
      for (const k of Object.keys(NAMES))
        gain(
          channels[k],
          (mix[k] / 100) * (k === 'lofi' ? 2.8 : k === 'cafe' ? 0.16 : k === 'forest' ? 0.2 : 0.36)
        );
      persist();
      paint();
    }
    function noise(seconds = 5, crackle = false) {
      const buffer = context.createBuffer(
          1,
          Math.ceil(context.sampleRate * seconds),
          context.sampleRate
        ),
        data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.025 * white) / 1.025;
        data[i] = crackle ? (Math.random() < 0.015 ? white * 0.8 : 0) : brown * 3 + white * 0.22;
      }
      return buffer;
    }
    function bed(key, buffer, type, frequency, rate) {
      const source = context.createBufferSource(),
        filter = context.createBiquadFilter(),
        g = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = rate;
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = 0.6;
      g.gain.value = 0;
      source.connect(filter);
      filter.connect(g);
      g.connect(output);
      source.start();
      nodes.push(source, filter, g);
      channels[key] = g;
      return { source, filter, g };
    }
    function ensureMusic() {
      if (!context || !mix.lofi) return;
      if (musicVoice && renderedTrack === track) return;
      if (musicVoice) {
        for (const n of Object.values(musicVoice)) {
          try {
            n.stop?.();
            n.disconnect?.();
          } catch {}
          nodes = nodes.filter(x => x !== n);
        }
      }
      const buffer = root.WorkHubLofi.createBuffer(context, track);
      musicVoice = bed('lofi', buffer, 'lowpass', 3200, 1);
      renderedTrack = track;
    }
    function start() {
      if (starting) return starting;
      if (!a.ready()) return Promise.resolve();
      const token = ++generation;
      const task = (async () => {
        try {
          error = '';
          const AC = root.AudioContext || root.webkitAudioContext;
          if (!AC) throw Error('Ambient audio is unavailable in this browser.');
          if (!context || context.state === 'closed') {
            context = new AC();
            output = context.createGain();
            output.gain.value = 0;
            nodes.push(output);
            if (context.createDynamicsCompressor) {
              const cushion = context.createDynamicsCompressor();
              cushion.threshold.value = -6;
              cushion.knee.value = 6;
              cushion.ratio.value = 8;
              cushion.attack.value = 0.008;
              cushion.release.value = 0.18;
              output.connect(cushion);
              cushion.connect(context.destination);
              nodes.push(cushion);
            } else output.connect(context.destination);
            const buffer = noise();
            bed('rain', buffer, 'highpass', 850, 1);
            bed('cafe', buffer, 'bandpass', 520, 0.66);
            bed('forest', buffer, 'lowpass', 780, 0.45);
            bed('fireplace', noise(5, true), 'lowpass', 2100, 0.75);
          }
          const current = context;
          await current.resume();
          if (token !== generation || context !== current) return;
          if (!a.ready()) {
            stop();
            return;
          }
          playing = current.state === 'running';
          current.onstatechange = () => {
            if (context === current) {
              playing = current.state === 'running';
              paint();
            }
          };
          apply();
          birdAt = Date.now() + 2000;
          crackleAt = Date.now() + 1000;
        } catch (e) {
          if (token !== generation) return;
          error = e.message || 'The soundscape could not start.';
          stop();
          a.tell(error, true);
          paint();
        }
      })();
      starting = task;
      void task.finally(() => {
        if (starting === task) starting = null;
      });
      return task;
    }
    function stop() {
      generation++;
      starting = null;
      playing = false;
      const old = context;
      context = null;
      output = null;
      for (const n of nodes) {
        try {
          n.stop?.();
          n.disconnect?.();
        } catch {}
      }
      nodes = [];
      channels = {};
      musicVoice = null;
      renderedTrack = '';
      if (old) {
        old.onstatechange = null;
        try {
          void Promise.resolve(old.close()).catch(() => {});
        } catch {}
      }
      paint();
    }
    function tone() {
      if (!context || !channels.forest) return;
      for (let i = 0; i < 2; i++) {
        const osc = context.createOscillator(),
          g = context.createGain(),
          t = context.currentTime + i * 0.16;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400 + i * 220, t);
        osc.frequency.exponentialRampToValueAtTime(2300 + i * 100, t + 0.09);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.connect(g);
        g.connect(channels.forest);
        osc.start(t);
        osc.stop(t + 0.2);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
        };
      }
    }
    function tick() {
      if (!a.ready()) {
        if (context) stop();
        return;
      }
      if (!playing || muted || !context) return;
      if (mix.forest && Date.now() >= birdAt) {
        tone();
        birdAt = Date.now() + 5000 + Math.random() * 11000;
      }
      if (mix.fireplace && Date.now() >= crackleAt) {
        const source = context.createBufferSource(),
          g = context.createGain();
        source.buffer = noise(0.08, true);
        g.gain.value = 0.7;
        source.connect(g);
        g.connect(channels.fireplace);
        source.start();
        source.onended = () => {
          source.disconnect();
          g.disconnect();
        };
        crackleAt = Date.now() + 700 + Math.random() * 1500;
      }
    }
    function open() {
      if (!a.ready()) return;
      if ($('settingsMenu')) $('settingsMenu').open = false;
      a.openModal(
        'Your soundscape',
        `<div class="soundscape-room"><div class="soundscape-hero"><span class="soundscape-window" aria-hidden="true">☂</span><div><span class="hub-kicker">MAKE A LITTLE ROOM FOR CALM</span><h3>A place that sounds like you.</h3><p>Soft keys, a gentle beat, or a little rain. Make room for one good thing.</p></div></div><div class="soundscape-presets" role="group" aria-label="Soundscape presets">${[
          ['rain', 'Rainy desk'],
          ['cafe', 'Café corner'],
          ['forest', 'Forest walk'],
          ['fireplace', 'By the fire'],
          ['lofi', '♫ Lo-fi study'],
        ]
          .map(
            ([k, l]) => `<button type="button" data-sound="preset" data-preset="${k}">${l}</button>`
          )
          .join('')}</div><div class="soundscape-channels">${Object.entries(NAMES)
          .map(
            ([k, l]) =>
              `<label><span>${l}</span><input type="range" min="0" max="100" step="1" value="${mix[k]}" data-sound-level="${k}" aria-label="${l} volume"><output id="sound-${k}">${mix[k]}%</output></label>`
          )
          .join(
            ''
          )}</div><section class="soundscape-music"><div class="soundscape-record" aria-hidden="true"><i></i></div><div><label for="soundscapeTrack">Your lo-fi loop</label><select id="soundscapeTrack">${Object.entries(
          root.WorkHubLofi.TRACKS
        )
          .map(
            ([id, s]) =>
              `<option value="${id}"${track === id ? ' selected' : ''}>${s.name} · ${s.bpm} BPM</option>`
          )
          .join(
            ''
          )}</select><p class="hub-meta">Fuller mellow keys, warm bass and a steady beat. Lo-fi study brings the music forward. Blend in a little ambience, then set Overall volume to your liking.</p></div></section><label class="soundscape-master"><span>Overall volume</span><input type="range" min="0" max="100" step="1" value="${master}" data-sound-master aria-label="Overall soundscape volume"><output id="sound-master">${master}%</output></label><div class="actions"><button type="button" class="primary" data-sound="play" id="soundscapePlay">Play soundscape</button><button type="button" data-sound="mute" id="soundscapeMute" aria-pressed="${muted}">${muted ? 'Unmute' : 'Mute'}</button></div><p id="soundscapeStatus" class="hub-meta" role="status"></p><p class="hub-meta">Your mix stays on this device. Playback starts only when you press Play. The music and ambience are generated in your browser. No API key, music subscription, downloads or cloud uploads are needed.</p></div>`
      );
      paint();
    }
    function paint() {
      const status =
        error ||
        (!playing
          ? 'Ready when you are.'
          : muted
            ? 'Soundscape is muted.'
            : 'Your soundscape is playing.');
      if ($('soundscapeStatus')) $('soundscapeStatus').textContent = status;
      if ($('soundscapePlay'))
        $('soundscapePlay').textContent = playing ? 'Pause soundscape' : 'Play soundscape';
      if ($('soundscapeMute')) {
        $('soundscapeMute').textContent = muted ? 'Unmute' : 'Mute';
        $('soundscapeMute').setAttribute('aria-pressed', String(muted));
      }
      for (const k of Object.keys(NAMES)) {
        const el = document.querySelector(`[data-sound-level="${k}"]`);
        if (el) el.value = mix[k];
        if ($('sound-' + k)) $('sound-' + k).textContent = mix[k] + '%';
      }
      if ($('sound-master')) $('sound-master').textContent = master + '%';
      let dock = $('soundscapeDock');
      if (playing && a.ready()) {
        if (!dock) {
          dock = document.createElement('aside');
          dock.id = 'soundscapeDock';
          dock.setAttribute('aria-label', 'Ambient sound controls');
          dock.innerHTML =
            '<button type="button" data-sound="open"><span class="soundscape-wave" aria-hidden="true"><i></i><i></i><i></i></span>Soundscape</button><button type="button" data-sound="play" aria-label="Pause all ambient sound">⏸</button>';
          document.body.append(dock);
        }
        dock.dataset.muted = String(muted);
        layout();
      } else dock?.remove();
    }
    function layout() {
      const el = $('soundscapeDock');
      if (!el) return;
      const v = root.visualViewport,
        w = v?.width || root.innerWidth,
        h = v?.height || root.innerHeight,
        x = v?.offsetLeft || 0,
        y = v?.offsetTop || 0;
      let top = y + h - 62,
        left = x + 12;
      const obstacles = [
        ...document.querySelectorAll('#hubTimerBar,#hubPet,#focusPanel:not([hidden])'),
      ]
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width && r.height);
      for (let i = 0; i < 4; i++) {
        if (
          !obstacles.some(
            r => left < r.right && left + 194 > r.left && top < r.bottom && top + 48 > r.top
          )
        )
          break;
        top = Math.max(y + 12, top - 60);
      }
      Object.assign(el.style, {
        left: left + 'px',
        top: Math.min(top, y + h - 58) + 'px',
        maxWidth: Math.max(180, w - 24) + 'px',
      });
    }
    function mount() {
      const host = $('hubSettingsAppearance');
      if (host && !$('soundscapeSettings')) {
        const b = document.createElement('button');
        b.id = 'soundscapeSettings';
        b.type = 'button';
        b.dataset.sound = 'open';
        b.textContent = 'Your soundscape';
        host.append(b);
      }
      if (!a.ready() && context) stop();
      paint();
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-sound]');
      if (!el) return;
      const action = el.dataset.sound;
      if (action === 'open') open();
      if (action === 'play') {
        if (playing) stop();
        else void start();
      }
      if (action === 'mute') {
        muted = !muted;
        apply();
      }
      if (action === 'preset' && PRESETS[el.dataset.preset]) {
        mix = { ...PRESETS[el.dataset.preset] };
        apply();
      }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (el.dataset.soundLevel && Object.hasOwn(NAMES, el.dataset.soundLevel)) {
        mix[el.dataset.soundLevel] = level(Number(el.value));
        apply();
      } else if (el.hasAttribute?.('data-sound-master')) {
        master = level(Number(el.value));
        apply();
      }
    });
    document.addEventListener('change', event => {
      if (event.target.id !== 'soundscapeTrack') return;
      if (Object.hasOwn(root.WorkHubLofi.TRACKS, event.target.value)) {
        track = event.target.value;
        apply();
      }
    });
    root.addEventListener('pagehide', stop);
    root.addEventListener('resize', layout);
    root.visualViewport?.addEventListener('resize', layout);
    root.visualViewport?.addEventListener('scroll', layout);
    return {
      mount,
      open,
      start,
      stop,
      tick,
      preset: key => {
        if (PRESETS[key]) {
          mix = { ...PRESETS[key] };
          apply();
        }
      },
      setMaster: value => {
        master = level(value, master);
        apply();
      },
      setMuted: value => {
        muted = !!value;
        apply();
      },
      snapshot: () => ({
        mix: { ...mix },
        master,
        muted,
        playing,
        error,
        track,
        musicRunning: !!musicVoice,
        starting: !!starting,
      }),
    };
  }
  root.WorkHubSoundscape = { install };
})(window);
