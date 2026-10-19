/**
 * lofi-engine.js
 * Original looping keyboard, bass and drum synthesis.
 * Used by soundscape.js. No downloads, record mutations or Supabase calls.
 * Notes, tempo and instrument envelopes are musical parameters; stop/dispose releases audio nodes.
 * File map: docs/FILE-MAP.md
 */
/* Original looping keys, bass and soft drums. Generated locally after Play. */
(function (root) {
  'use strict';
  const TRACKS = {
    lantern: {
      name: 'Paper lanterns',
      bpm: 72,
      chords: [
        [52, 55, 59, 66],
        [48, 52, 55, 62],
        [43, 50, 54, 57],
        [50, 54, 57, 64],
      ],
      bass: [40, 36, 31, 38],
    },
    bluehour: {
      name: 'Blue hour',
      bpm: 66,
      chords: [
        [50, 53, 57, 64],
        [46, 50, 53, 60],
        [53, 57, 60, 67],
        [48, 52, 55, 62],
      ],
      bass: [38, 34, 41, 36],
    },
  };
  function createBuffer(context, track = 'lantern') {
    const sin = Math.sin,
      exp = Math.exp,
      random = Math.random,
      tanh = Math.tanh,
      song = TRACKS[track] || TRACKS.lantern,
      rate = Math.min(24000, context.sampleRate),
      beat = 60 / song.bpm,
      seconds = beat * 32,
      length = Math.round(rate * seconds),
      buffer = context.createBuffer(2, length, rate),
      left = buffer.getChannelData(0),
      right = buffer.getChannelData(1),
      tau = Math.PI * 2;
    function add(start, duration, sample, volume = 1, pan = 0) {
      const first = Math.round(start * rate),
        count = Math.round(duration * rate),
        lg = (1 - pan) * 0.5,
        rg = (1 + pan) * 0.5;
      for (let j = 0; j < count; j++) {
        const t = j / rate,
          k = (first + j) % length,
          v = sample(t, j) * volume;
        left[k] += v * lg;
        right[k] += v * rg;
      }
    }
    function key(midi, start, volume, pan) {
      const f = 440 * 2 ** ((midi - 69) / 12);
      add(
        start,
        2.35,
        t => {
          const env = (1 - exp(-t * 95)) * exp(-t * 2.1),
            wobble = 1 + 0.0017 * sin(t * 3.1);
          return (
            (sin(tau * f * t * wobble) +
              0.23 * sin(tau * f * 2.003 * t) +
              0.08 * sin(tau * f * 3 * t)) *
            env
          );
        },
        volume,
        pan
      );
      add(
        start + 0.19,
        1.6,
        t => sin(tau * f * t) * (1 - exp(-t * 80)) * exp(-t * 3),
        volume * 0.12,
        -pan
      );
    }
    for (let bar = 0; bar < 8; bar++) {
      const chord = song.chords[Math.floor(bar / 2)],
        start = bar * 4 * beat;
      for (const [hit, strength] of [
        [0, 0.105],
        [2.55, 0.065],
      ])
        chord.forEach((n, i) => key(n, start + hit * beat + i * 0.012, strength, (i - 1.5) * 0.13));
      for (const hit of [0, 2.5]) {
        const f = 440 * 2 ** ((song.bass[Math.floor(bar / 2)] - 69) / 12);
        add(
          start + hit * beat,
          beat * 1.25,
          t => sin(tau * f * t) * (1 - exp(-t * 85)) * exp(-t * 3.7),
          0.25
        );
      }
      for (const hit of [0, 2])
        add(
          start + hit * beat,
          0.25,
          t => sin(tau * (46 * t + 5.8 * (1 - exp(-t * 23)))) * exp(-t * 22),
          0.28
        );
      for (const hit of [1, 3])
        add(
          start + hit * beat,
          0.15,
          t => (random() * 2 - 1) * exp(-t * 36) + 0.2 * sin(tau * 165 * t) * exp(-t * 29),
          0.075,
          0.08
        );
      for (let h = 0; h < 8; h++) {
        const swing = h % 2 ? 0.075 : 0;
        add(
          start + (h * 0.5 + swing) * beat,
          0.055,
          t => (random() * 2 - 1) * exp(-t * 90),
          h % 2 ? 0.022 : 0.035,
          h % 2 ? 0.25 : -0.25
        );
      }
    }
    let previous = 0,
      energy = 0;
    for (let i = Math.max(0, length - 500); i < length; i++)
      previous = previous * 0.72 + left[i] * 0.28;
    for (let i = 0; i < length; i++) {
      const dust = (random() * 2 - 1) * 0.0013;
      previous = previous * 0.72 + left[i] * 0.28;
      left[i] = tanh((previous + dust) * 1.15) * 0.82;
      right[i] = tanh((right[i] + dust) * 1.05) * 0.82;
      energy += left[i] ** 2 + right[i] ** 2;
    }
    // Match both tracks' perceived level, then round off transient peaks gently.
    // This raises the music itself, without turning up rain or other ambience.
    const rms = Math.sqrt(energy / (length * 2)),
      boost = rms ? Math.min(12, 0.2 / rms) : 1;
    for (let i = 0; i < length; i++) {
      left[i] = 0.78 * tanh((left[i] * boost) / 0.78);
      right[i] = 0.78 * tanh((right[i] * boost) / 0.78);
    }
    return buffer;
  }
  root.WorkHubLofi = { TRACKS, createBuffer };
})(window);
