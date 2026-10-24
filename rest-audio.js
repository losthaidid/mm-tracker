/** Original rest-only pads, bells and rain. Local Web Audio; no downloads or record writes. */
(function (root) {
  'use strict';
  const TRACKS = {
    garden: {
      name: 'Cloud garden',
      detail: 'Soft pads & floating bells',
      chords: [
        [50, 57, 62, 66],
        [55, 59, 62, 69],
        [47, 54, 57, 62],
        [45, 52, 55, 59],
      ],
      bells: [74, 78, 81, 83, 81, 78, 76, 74],
    },
    tide: {
      name: 'Moonlit tide',
      detail: 'Slow, warm tones',
      chords: [
        [45, 52, 60, 64],
        [41, 48, 57, 60],
        [48, 55, 59, 64],
        [43, 50, 57, 62],
      ],
      bells: [76, 72, 69, 71, 74, 71, 67, 69],
    },
    leaves: {
      name: 'Rain on leaves',
      detail: 'Gentle rain & quiet chords',
      chords: [
        [48, 55, 60, 64],
        [53, 57, 60, 67],
        [50, 57, 60, 65],
        [43, 50, 59, 62],
      ],
      bells: [72, 76, 79, 76, 74, 72, 67, 72],
      rain: true,
    },
  };
  const STORE = 'mm-tracker.rest-sound.v1',
    seconds = 24;
  function createBuffer(context, key = 'garden') {
    const song = TRACKS[key] || TRACKS.garden,
      rate = Math.min(22050, context.sampleRate),
      length = Math.round(seconds * rate),
      buffer = context.createBuffer(2, length, rate),
      left = buffer.getChannelData(0),
      right = buffer.getChannelData(1),
      tau = Math.PI * 2;
    const hz = n => 440 * 2 ** ((n - 69) / 12);
    function add(start, duration, n, volume, pan, bell = false) {
      const count = Math.round(duration * rate),
        first = Math.round(start * rate),
        f = hz(n);
      for (let i = 0; i < count; i++) {
        const t = i / rate,
          k = (first + i) % length,
          envelope = bell
            ? (1 - Math.exp(-t * 35)) * Math.exp(-t * 1.1)
            : Math.sin((Math.PI * t) / duration) ** 2,
          wave =
            (Math.sin(tau * f * t) +
              0.16 * Math.sin(tau * f * 2.001 * t) +
              (!bell ? 0.08 * Math.sin(tau * f * 0.999 * t) : 0)) *
            envelope *
            volume;
        left[k] += wave * (0.5 - pan * 0.3);
        right[k] += wave * (0.5 + pan * 0.3);
      }
    }
    song.chords.forEach((chord, i) =>
      chord.forEach((n, j) => add(i * 6, 8, n, 0.075, (j - 1.5) / 2))
    );
    song.bells.forEach((n, i) => add(i * 3 + 1, 5, n, 0.07, Math.sin(i * 1.7), true));
    let seed = 2137,
      brown = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate,
        fade = Math.min(1, t / 1.2, (seconds - t) / 1.2);
      seed = (seed * 16807) % 2147483647;
      const white = seed / 1073741824 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      const bed = song.rain ? brown * 0.13 + white * 0.012 : brown * 0.025;
      left[i] = Math.tanh(left[i] + bed) * fade * 0.7;
      right[i] = Math.tanh(right[i] + bed) * fade * 0.7;
    }
    return buffer;
  }
  // A real looping source keeps ringing between ticks, including in a background tab.
  // Its gain is independent of rest music, so muting a song cannot mute the alarm.
  function createAlarmBuffer(context) {
    const rate = Math.min(22050, context.sampleRate),
      length = Math.round(rate * 3.2),
      buffer = context.createBuffer(1, length, rate),
      samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const time = i / rate,
        beat = Math.floor(time / 0.4),
        t = time % 0.4,
        frequency = [880, 1108.73, 1318.51, 1108.73][beat % 4],
        envelope = Math.min(1, t / 0.015) * Math.max(0, 1 - t / 0.37);
      samples[i] =
        (Math.sin(2 * Math.PI * frequency * t) + 0.22 * Math.sin(4 * Math.PI * frequency * t)) *
        envelope *
        0.32;
    }
    return buffer;
  }
  function install(a) {
    let prefs = { track: 'garden', volume: 45, music: true, alarm: true },
      context = null,
      music = null,
      musicGain = null,
      master = null,
      nodes = [],
      alarmNodes = [],
      generation = 0,
      active = false,
      paused = false,
      alerting = false,
      error = '',
      starting = false;
    try {
      const p = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (p) {
        if (TRACKS[p.track]) prefs.track = p.track;
        if (Number.isFinite(p.volume))
          prefs.volume = Math.max(0, Math.min(100, Math.round(p.volume)));
        if (typeof p.music === 'boolean') prefs.music = p.music;
      }
    } catch {}
    const snapshot = () => ({
      ...prefs,
      active,
      paused,
      alerting,
      playing: active && !paused && prefs.music && context?.state === 'running',
      error,
      starting,
    });
    function emit() {
      a.change?.(snapshot());
    }
    function persist() {
      try {
        localStorage.setItem(STORE, JSON.stringify(prefs));
      } catch {}
    }
    function dispose(xs) {
      for (const n of xs) {
        try {
          n.stop?.();
          n.disconnect?.();
        } catch {}
      }
    }
    function apply() {
      if (master)
        master.gain.setTargetAtTime((prefs.volume / 100) * 0.8, context.currentTime, 0.12);
      if (musicGain)
        musicGain.gain.setTargetAtTime(
          active && !paused && prefs.music ? 3 : 0,
          context.currentTime,
          0.2
        );
      emit();
    }
    function stopMusic() {
      dispose(music ? [music] : []);
      music = null;
    }
    function loadTrack() {
      if (!context || !active) return;
      stopMusic();
      if (!prefs.music) return;
      const source = context.createBufferSource();
      source.buffer = createBuffer(context, prefs.track);
      source.loop = true;
      source.connect(musicGain);
      source.start();
      music = source;
    }
    function stop() {
      generation++;
      starting = false;
      active = false;
      paused = false;
      alerting = false;
      stopMusic();
      dispose(alarmNodes);
      alarmNodes = [];
      dispose(nodes);
      nodes = [];
      const old = context;
      context = null;
      master = musicGain = null;
      if (old) {
        old.onstatechange = null;
        try {
          void Promise.resolve(old.close()).catch(() => {});
        } catch {}
      }
      emit();
    }
    async function start() {
      if (!a.ready()) return;
      const token = ++generation;
      active = true;
      paused = false;
      alerting = false;
      error = '';
      starting = true;
      try {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) throw Error('Rest audio is unavailable in this browser.');
        if (!context || context.state === 'closed') {
          context = new AC();
          master = context.createGain();
          musicGain = context.createGain();
          master.gain.value = 0;
          musicGain.gain.value = 0;
          musicGain.connect(master);
          master.connect(context.destination);
          nodes.push(master, musicGain);
        }
        const current = context;
        // Called directly by a break/sound button so browser audio is unlocked by that gesture.
        await current.resume();
        if (token !== generation || current !== context || !a.ready()) return;
        loadTrack();
        apply();
        if (alerting) {
          chime();
        }
      } catch (e) {
        if (token !== generation) return;
        error = e.message || 'Rest sound could not start.';
        stop();
      } finally {
        if (token === generation) {
          starting = false;
          emit();
        }
      }
    }
    function chime() {
      if (!context || context.state !== 'running' || !alerting || alarmNodes.length) return;
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = createAlarmBuffer(context);
      source.loop = true;
      gain.gain.value = 0.75;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
      alarmNodes = [source, gain];
    }
    function finish() {
      active = false;
      paused = false;
      alerting = true;
      stopMusic();
      if (musicGain) musicGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
      chime();
      emit();
    }
    function tick() {
      if (alerting) chime();
    }
    function change(key, value) {
      if (key === 'track' && TRACKS[value]) {
        prefs.track = value;
        if (active) loadTrack();
      }
      if (key === 'volume' && Number.isFinite(+value))
        prefs.volume = Math.max(0, Math.min(100, Math.round(+value)));
      if (key === 'music') {
        prefs.music = !!value;
        if (active && prefs.music && !music) loadTrack();
      }
      persist();
      apply();
    }
    root.addEventListener('pagehide', stop);
    return {
      start,
      stop,
      finish,
      tick,
      change,
      snapshot,
      pause: value => {
        paused = !!value;
        apply();
      },
    };
  }
  root.WorkHubRestAudio = { TRACKS, createBuffer, createAlarmBuffer, install };
})(window);
