/**
 * lofi-engine.js
 * Original mellow and upbeat instrumental loops.
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
      mood: 'mellow',
      detail: 'Warm electric keys and a soft, swinging backbeat.',
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
      mood: 'mellow',
      detail: 'Slow minor-key chords, rounded bass and brushed drums.',
      chords: [
        [50, 53, 57, 64],
        [46, 50, 53, 60],
        [53, 57, 60, 67],
        [48, 52, 55, 62],
      ],
      bass: [38, 34, 41, 36],
    },
    sunrise: {
      name: 'Sunrise shuffle',
      bpm: 96,
      mood: 'upbeat',
      detail: 'Bright electric keys, a walking bass and swung drums.',
      chords: [
        [57, 60, 64, 67],
        [53, 60, 64, 69],
        [58, 62, 65, 69],
        [58, 62, 64, 69],
      ],
      bass: [41, 38, 43, 36],
      groove: {
        keys: [
          [0, 0.09],
          [1.58, 0.07],
          [2.75, 0.082],
        ],
        bass: [
          [0, 0, 0.8],
          [1, 12, 0.52],
          [1.8, 7, 0.42],
          [2.5, 0, 0.67],
          [3.58, 7, 0.36],
        ],
        lead: [
          [0.75, 2],
          [2.25, 1],
          [3.5, 3],
        ],
        kick: [
          [0, 0.34],
          [2, 0.28],
          [2.75, 0.17],
        ],
        swing: 0.09,
      },
    },
    city: {
      name: 'City groove',
      bpm: 108,
      mood: 'upbeat',
      detail: 'Funk-inspired bass, syncopated chord stabs and a crisp backbeat.',
      chords: [
        [55, 59, 60, 64],
        [57, 60, 64, 67],
        [53, 60, 64, 69],
        [56, 59, 62, 65],
      ],
      bass: [33, 41, 38, 40],
      groove: {
        keys: [
          [0.5, 0.11],
          [1.75, 0.072],
          [2.5, 0.09],
          [3.5, 0.065],
        ],
        bass: [
          [0, 0, 0.52],
          [0.75, 12, 0.35],
          [1.5, 0, 0.67],
          [2.5, 7, 0.39],
          [3.25, 12, 0.34],
          [3.75, 0, 0.24],
        ],
        lead: [
          [0, 1],
          [1.25, 3],
          [2.75, 2],
          [3.75, 0],
        ],
        kick: [
          [0, 0.33],
          [1.5, 0.22],
          [2.5, 0.27],
          [3.25, 0.18],
        ],
        swing: 0.025,
      },
    },
    neon: {
      name: 'Neon run',
      bpm: 124,
      mood: 'upbeat',
      detail: 'A four-on-the-floor beat with bright synth arpeggios.',
      chords: [
        [54, 57, 59, 62],
        [55, 59, 62, 66],
        [54, 57, 62, 64],
        [57, 59, 61, 64],
      ],
      bass: [35, 43, 38, 45],
      groove: {
        keys: [
          [0.5, 0.07],
          [1.5, 0.05],
          [2.5, 0.075],
          [3.5, 0.05],
        ],
        bass: [
          [0.5, 0, 0.46],
          [1.5, 12, 0.46],
          [2.5, 0, 0.46],
          [3.5, 7, 0.46],
        ],
        lead: [
          [0, 0],
          [0.5, 2],
          [1, 1],
          [1.5, 3],
          [2, 1],
          [2.5, 2],
          [3, 0],
          [3.5, 3],
        ],
        kick: [
          [0, 0.34],
          [1, 0.31],
          [2, 0.33],
          [3, 0.31],
        ],
        swing: 0,
      },
    },
  };
  const STUDY = {
    keys: [
      [0, 0.105],
      [2.55, 0.065],
    ],
    bass: [
      [0, 0, 1.25],
      [2.5, 0, 1.25],
    ],
    kick: [
      [0, 0.28],
      [2, 0.28],
    ],
    swing: 0.075,
  };
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  function createBuffer(context, track = 'lantern') {
    const sin = Math.sin,
      exp = Math.exp,
      random = Math.random,
      tanh = Math.tanh,
      song = Object.hasOwn(TRACKS, track) ? TRACKS[track] : TRACKS.lantern,
      groove = song.groove || STUDY,
      upbeat = song.mood === 'upbeat',
      bars = upbeat ? 12 : 8,
      rate = Math.min(24000, context.sampleRate),
      beat = 60 / song.bpm,
      seconds = beat * 4 * bars,
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
    const keyLength = upbeat ? beat * 1.6 : 2.35,
      keyDecay = upbeat ? 5.2 : 2.1,
      keyOvertone = upbeat ? 0.34 : 0.23,
      echoDelay = upbeat ? beat * 0.75 : 0.19;
    function key(midi, start, volume, pan, duration = keyLength) {
      const f = frequency(midi);
      add(
        start,
        duration,
        t => {
          const env = (1 - exp(-t * 95)) * exp(-t * keyDecay) * Math.min(1, (duration - t) / 0.045),
            wobble = 1 + 0.0017 * sin(t * 3.1);
          return (
            (sin(tau * f * t * wobble) +
              keyOvertone * sin(tau * f * 2.003 * t) +
              0.08 * sin(tau * f * 3 * t)) *
            env
          );
        },
        volume,
        pan
      );
      add(
        start + echoDelay,
        Math.min(1.6, duration),
        t => sin(tau * f * t) * (1 - exp(-t * 80)) * exp(-t * 3),
        volume * 0.12,
        -pan
      );
    }
    for (let bar = 0; bar < bars; bar++) {
      const harmony = (upbeat ? bar : Math.floor(bar / 2)) % song.chords.length,
        chord = song.chords[harmony],
        start = bar * 4 * beat;
      for (const [hit, strength] of groove.keys)
        chord.forEach((n, i) => key(n, start + hit * beat + i * 0.012, strength, (i - 1.5) * 0.13));
      if (groove.lead) {
        // Play the lead more softly on the middle pass through the progression.
        const leadLevel = bar >= 4 && bar < 8 ? 0.038 : 0.07;
        for (const [hit, note] of groove.lead)
          key(chord[note] + 12, start + hit * beat, leadLevel, 0.36, beat * 0.8);
      }
      for (const [hit, interval, beats] of groove.bass) {
        const f = frequency(song.bass[harmony] + interval),
          duration = beat * beats;
        add(
          start + hit * beat,
          duration,
          t =>
            sin(tau * f * t) *
            (1 - exp(-t * 85)) *
            exp(-t * 3.7) *
            Math.min(1, (duration - t) / 0.04),
          0.25
        );
      }
      for (const [hit, strength] of groove.kick)
        add(
          start + hit * beat,
          0.25,
          t => sin(tau * (46 * t + 5.8 * (1 - exp(-t * 23)))) * exp(-t * 22),
          strength
        );
      for (const hit of [1, 3])
        add(
          start + hit * beat,
          0.15,
          t => (random() * 2 - 1) * exp(-t * 36) + 0.2 * sin(tau * 165 * t) * exp(-t * 29),
          upbeat ? 0.11 : 0.075,
          0.08
        );
      for (let h = 0; h < 8; h++) {
        const swing = h % 2 ? groove.swing : 0;
        add(
          start + (h * 0.5 + swing) * beat,
          0.055,
          t => (random() * 2 - 1) * exp(-t * 90),
          h % 2 ? (upbeat ? 0.038 : 0.022) : 0.035,
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
    // Match the tracks' level, then round off transient peaks gently.
    // This raises the music itself, without turning up rain or other ambience.
    const rms = Math.sqrt(energy / (length * 2)),
      boost = rms ? Math.min(12, 0.2 / rms) : 1;
    for (let i = 0; i < length; i++) {
      left[i] = 0.78 * tanh((left[i] * boost) / 0.78);
      right[i] = 0.78 * tanh((right[i] * boost) / 0.78);
    }
    // Taper the final two milliseconds into the first sample to avoid a click at wraparound.
    const join = Math.max(1, Math.round(rate * 0.002));
    for (const samples of [left, right]) {
      for (let i = 0; i < join; i++) {
        const index = length - 1 - i;
        samples[index] = samples[0] + (samples[index] - samples[0]) * (i / join);
      }
    }
    return buffer;
  }
  root.WorkHubLofi = { TRACKS, createBuffer };
})(window);
