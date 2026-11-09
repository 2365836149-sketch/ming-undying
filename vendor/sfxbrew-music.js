/* ============================================================================
   SFX Brew · 东方配乐引擎 v2（主题、和声、段落、人味）
   ----------------------------------------------------------------------------
   ★ makeMusic(sfx) 是一个自包含函数（和 makeSfx 一样），"导出 JS"时原样塞进用户的游戏。
     它不自己发声，而是把每个音符写成一个 SFX Brew 的 patch，交给 sfx.schedule() 在精确时间播放。
   ★ 一首曲子 = 一份 spec（编曲参数）：调式、主音、速度、段落结构、各声部乐器、每段强度、密度、人味。
     四种情绪（calm / battle / mystery / sad）只是四份预设 spec。以后文字描述 → 小模型输出的也是 spec。
   ★ 作曲：先生成 2 小节动机（主题）→ 动机 + 回应 = 4 小节乐句（第一句半终止、第二句落主音）
     → A 段呈示主题、B 段换音区换节奏换和弦做对比、尾声放慢渐弱。和弦用五声音阶上的三音/四度叠置。
   ★ 人味：微小的时值偏差、乐句内的强弱起伏、句末换气、尾声渐慢。
   ★ 永不重复：每循环一遍，A 段保留主题（同一个种子）但伴奏和装饰换新，B 段换新材料。
   ★ 这个函数里不要写中文注释、不要引用外部变量（会被导出给别人用）。
   ==========================================================================*/
function makeMusic(sfx) {
  'use strict';

  /* Chinese pentatonic modes: same five notes, different tonic. Values are semitones above the tonic. */
  var MODES = { gong: [0, 2, 4, 7, 9], shang: [0, 2, 5, 7, 10], jue: [0, 3, 5, 8, 10], zhi: [0, 2, 5, 7, 9], yu: [0, 3, 5, 7, 10],
    /* miyako-bushi (in scale): still five notes, but with two semitones (1-b2, 5-b6) - the sound of East Asian dread */
    miyako: [0, 1, 5, 7, 8] };
  var PRESETS = {
    calm: { mode: 'gong', root: 50, tempo: 66, structure: ['intro', 'A', 'A', 'B', 'A', 'outro'], intensity: [0.25, 0.4, 0.45, 0.6, 0.45, 0.2],
      melody: 'guqin', melodyB: 'flute', accomp: 'guqin', bass: 'cello', strings: 0.6, perc: 'none', sparkle: true, density: 0.45, humanize: 0.7, reverb: 0.55 },
    battle: { mode: 'yu', root: 45, tempo: 112, structure: ['intro', 'A', 'A', 'B', 'A'], intensity: [0.6, 0.75, 0.8, 0.95, 0.85],
      melody: 'pipa', melodyB: 'pipa', accomp: 'pipa', bass: 'cello', strings: 0.55, ostinato: 'spic', perc: 'battle', sparkle: false, density: 0.7, humanize: 0.4, reverb: 0.3 },
    mystery: { mode: 'shang', root: 52, tempo: 56, structure: ['intro', 'A', 'B', 'A', 'outro'], intensity: [0.2, 0.35, 0.45, 0.35, 0.15],
      melody: 'flute', melodyB: 'guqin', accomp: 'none', bass: 'cello', strings: 0.55, perc: 'woodfish', sparkle: true, density: 0.3, humanize: 0.8, reverb: 0.65 },
    sad: { mode: 'yu', root: 45, tempo: 58, structure: ['intro', 'A', 'A', 'B', 'A', 'outro'], intensity: [0.25, 0.4, 0.5, 0.65, 0.5, 0.2],
      melody: 'erhu', melodyB: 'erhu', accomp: 'guqin', bass: 'cello', strings: 0.65, perc: 'none', sparkle: false, density: 0.35, humanize: 0.75, reverb: 0.5 }
  };
  var REGISTER = { guqin: 3, flute: 6, erhu: 4, pipa: 6 };
  /* Erhu multisamples (CC0, tarane468 on Freesound): one recording roughly every minor third from D4 to B5,
     two takes on D4 and G#4 that alternate. Measured pitches; see samples/CREDITS.md. */
  var ERHU = [['erhu-n-d4', 293.9, 'erhu-n-d4b'], ['erhu-n-f4', 349.4], ['erhu-n-gs4', 415.5, 'erhu-n-gs4b'], ['erhu-n-b4', 493.8],
    ['erhu-n-c5', 523.6], ['erhu-n-d5', 588.2], ['erhu-n-e5', 661.5], ['erhu-n-f5', 697.6], ['erhu-n-gs5', 830.6], ['erhu-n-b5', 987.8]];
  var ERHU_LO = 293.7, ERHU_HI = 880;
  /* String section multisamples (CC0, Versilian Studios VSCO 2 Community Edition), one every 3-4 semitones. */
  var STR = {
    vc: [['str-vc-c2', 65.4], ['str-vc-e2', 82.4], ['str-vc-g2', 98], ['str-vc-b2', 123.5], ['str-vc-d3', 146.8], ['str-vc-f3', 174.6], ['str-vc-a3', 220], ['str-vc-c4', 261.6]],
    va: [['str-va-c3', 130.8], ['str-va-e3', 164.8], ['str-va-g3', 196], ['str-va-b3', 246.9], ['str-va-d4', 293.7], ['str-va-f4', 349.2], ['str-va-a4', 440], ['str-va-c5', 523.3]],
    vn: [['str-vn-g3', 196], ['str-vn-b3', 246.9], ['str-vn-d4', 293.7], ['str-vn-fs4', 370], ['str-vn-a4', 440], ['str-vn-c5', 523.3], ['str-vn-e5', 659.3], ['str-vn-b5', 987.8]],
    spic: [['str-vcspic-e2', 82.4], ['str-vcspic-g2', 98], ['str-vcspic-b2', 123.5], ['str-vcspic-d3', 146.8], ['str-vcspic-f3', 174.6], ['str-vcspic-a3', 220], ['str-vcspic-c4', 261.6], ['str-vcspic-e4', 329.6]]
  };
  /* nearest recorded note and the semitone shift to reach f */
  function nearest(table, f) {
    var best = table[0];
    for (var i = 0; i < table.length; i++) if (Math.abs(Math.log(f / table[i][1])) < Math.abs(Math.log(f / best[1]))) best = table[i];
    return { name: best[0], st: 12 * Math.log2(f / best[1]) };
  }
  /* move a frequency by octaves into [lo, hi) */
  function fold(f, lo, hi) { while (f >= hi) f /= 2; while (f < lo) f *= 2; return f; }
  var erhuTake = 0;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function spec(s) {
    var base = PRESETS[(s && s.preset) || 'calm'] || PRESETS.calm, out = {}, k;
    for (k in base) out[k] = base[k];
    if (s) for (k in s) if (s[k] != null) out[k] = s[k];
    out.seed = (out.seed || 1) | 0;
    return out;
  }
  function midi(sp, d) {
    var sc = MODES[sp.mode] || MODES.gong, o = Math.floor(d / 5), i = ((d % 5) + 5) % 5;
    return sp.root + 12 * o + sc[i];
  }

  /* ---------- instruments: each returns a SFX Brew patch ---------- */
  function L(o) {
    var base = { type: 'tone', wave: 'sine', freq: 440, freqEnd: 440, start: 0, attack: 0.005, hold: 0, decay: 0.3, vol: 0.5,
      filter: 'none', cutoff: 4000, cutoffEnd: 4000, q: 1, vib: 0, vibRate: 6, rep: 1, repGap: 0.1, repStep: 0, scale: 'penta' };
    for (var k in o) base[k] = o[k];
    if (o.freq && o.freqEnd == null) base.freqEnd = o.freq;
    return base;
  }
  function P(layers, gain) { return { layers: layers, reverb: 0, echo: 0, echoTime: 0.2, drive: 0, crush: 0, gain: gain == null ? 0.8 : gain }; }
  var I = {
    guqin: function (f, dur, v, slideFrom) {
      /* rounded attack and a dark, closing lowpass: the bare Karplus-Strong click reads as a hard tick */
      return P([L({ type: 'string', freq: slideFrom ? f * slideFrom : f, freqEnd: f, slideTime: 0.18, bright: 0.3, filter: 'lowpass', cutoff: 2400, cutoffEnd: 1000, attack: 0.004, decay: Math.max(1.2, dur * 1.6), vol: 0.55 * v }),
        L({ type: 'tone', freq: f, attack: 0.012, decay: Math.min(dur * 1.2, 1.4), vol: 0.12 * v })]);
    },
    /* accompaniment guqin: thumb-side, muffled, round - sits under the tune instead of ticking on top of it */
    qin: function (f, dur, v) {
      return P([L({ type: 'string', freq: f, bright: 0.12, filter: 'lowpass', cutoff: 1500, cutoffEnd: 650, attack: 0.008, decay: Math.max(1, dur * 1.4), vol: 0.5 * v }),
        L({ type: 'tone', freq: f, attack: 0.015, decay: Math.min(dur, 1.2), vol: 0.14 * v })]);
    },
    harmonic: function (f, v) { return P([L({ type: 'bell', freq: f, partials: [[1, 1, 1], [2, 0.12, 0.5], [3, 0.04, 0.3]], attack: 0.003, decay: 2.4, vol: 0.3 * v })]); },
    pipa: function (f, dur, v, trem) {
      var n = trem ? Math.max(2, Math.round(dur / 0.06)) : 1;
      return P([L({ type: 'string', freq: f, bright: 0.68, filter: 'lowpass', cutoff: 4200, cutoffEnd: 2000, attack: 0.002, decay: trem ? 0.3 : Math.max(0.6, dur), vol: (trem ? 0.32 : 0.45) * v, rep: n, repGap: 0.06 })]);
    },
    strum: function (fs, v) {
      return P(fs.map(function (f, i) { return L({ type: 'string', freq: f, bright: 0.6, start: i * 0.018, attack: 0.002, decay: 0.9, vol: 0.22 * v, filter: 'lowpass', cutoff: 3200, cutoffEnd: 1800 }); }));
    },
    flute: function (f, dur, v) {
      var env = { attack: Math.min(0.15, dur * 0.25), hold: Math.max(0, dur - 0.25), decay: 0.35, vib: 16, vibRate: 5.2 };
      return P([L(Object.assign({ type: 'tone', freq: f, vol: 0.3 * v }, env)),
        L(Object.assign({ type: 'noise', filter: 'bandpass', cutoff: f, cutoffEnd: f, q: 18, vol: 0.2 * v }, env)),
        L(Object.assign({ type: 'tone', wave: 'triangle', freq: f * 2, vol: 0.045 * v }, env))]);
    },
    erhu: function (f, dur, v, slideSemis) {
      /* keep the erhu in its warm middle register: above A5 it turns shrill, so fold high notes down an octave */
      while (f > ERHU_HI) f /= 2;
      while (f < ERHU_LO) f *= 2;
      var best = ERHU[0];
      for (var i = 0; i < ERHU.length; i++) if (Math.abs(Math.log(f / ERHU[i][1])) < Math.abs(Math.log(f / best[1]))) best = ERHU[i];
      var name = best[2] && (erhuTake++ % 2) ? best[2] : best[0];
      var st = 12 * Math.log2(f / best[1]), slide = slideSemis ? (slideSemis > 0 ? 1 : -1) : 0;
      var hold = Math.max(0.12, dur - 0.18);
      return P([L({ type: 'sample', sample: name, pitch: st - slide, pitchEnd: st, slideTime: 0.12, offset: 0.04,
        /* soft bow attack, a slight swell, delayed vibrato, and a lowpass that takes the edge off 3 kHz and up */
        attack: Math.min(0.14, dur * 0.3), hold: hold, decay: 0.35, vol: 0.5 * v,
        vib: dur > 0.5 ? 18 : 0, vibRate: 5.6, vibDelay: Math.min(0.35, dur * 0.35),
        filter: 'lowpass', cutoff: 2600, cutoffEnd: 3200, sweepTime: Math.min(0.6, dur), q: 0.5 })]);
    },
    /* String section pad: lowest chord tone on cellos, middle on violas, top on violins. Slow bow-in, dark lowpass. */
    strings: function (fs, dur, v) {
      var parts = [['vc', 98, 196], ['va', 174.6, 349.2], ['vn', 293.7, 587.3]], layers = [];
      fs.slice(0, 3).forEach(function (f, i) {
        var sec = parts[i], n = nearest(STR[sec[0]], fold(f, sec[1], sec[2]));
        layers.push(L({ type: 'sample', sample: n.name, pitch: n.st, offset: 0.12, attack: Math.min(0.9, dur * 0.3), hold: Math.max(0, dur - 1), decay: 1.1,
          vol: (i === 0 ? 0.32 : 0.26) * v, filter: 'lowpass', cutoff: 3800, cutoffEnd: 3800, q: 0.5 }));
      });
      return P(layers);
    },
    /* a single string-section voice for counter-melodies ('vn' violins or 'va' violas) */
    line: function (f, dur, v, sec) {
      var n = nearest(STR[sec || 'vn'], f);
      return P([L({ type: 'sample', sample: n.name, pitch: n.st, offset: 0.12, attack: Math.min(0.5, dur * 0.25), hold: Math.max(0, dur - 0.7), decay: 0.6,
        vol: 0.3 * v, filter: 'lowpass', cutoff: 4200, cutoffEnd: 4200, q: 0.5 })]);
    },
    cello: function (f, dur, v) {
      var n = nearest(STR.vc, fold(f, 65.4, 196));
      return P([L({ type: 'sample', sample: n.name, pitch: n.st, offset: 0.1, attack: 0.25, hold: Math.max(0, dur - 0.6), decay: 0.9, vol: 0.4 * v, filter: 'lowpass', cutoff: 2400, cutoffEnd: 2400, q: 0.5 })]);
    },
    spic: function (f, v) {
      var n = nearest(STR.spic, fold(f, 82.4, 330));
      return P([L({ type: 'sample', sample: n.name, pitch: n.st, attack: 0.002, hold: 0.12, decay: 0.25, vol: 0.5 * v })]);
    },
    pad: function (fs, dur, v) {
      return P(fs.map(function (f) { return L({ type: 'tone', wave: 'triangle', freq: f, filter: 'lowpass', cutoff: 1800, cutoffEnd: 1800, attack: Math.min(1.2, dur * 0.4), hold: Math.max(0, dur - 1.2), decay: 1.2, vol: 0.05 * v, vib: 4, vibRate: 0.3 }); }));
    },
    drone: function (f, dur, v) {
      return P([L({ type: 'tone', freq: f, attack: 2, hold: Math.max(0, dur - 3), decay: 2.5, vol: 0.12 * v, trem: 0.15, tremRate: 0.15 }),
        L({ type: 'tone', freq: f * 1.5, attack: 2.5, hold: Math.max(0, dur - 3), decay: 2.5, vol: 0.045 * v })]);
    },
    bass: function (f, dur, v) {
      return P([L({ type: 'string', freq: f, bright: 0.25, attack: 0.001, decay: Math.max(1, dur * 1.5), vol: 0.5 * v }),
        L({ type: 'tone', freq: f, attack: 0.01, decay: dur, vol: 0.15 * v })]);
    },
    chime: function (f, v) { return P([L({ type: 'bell', freq: f, partials: [[1, 1, 1], [1.004, 0.5, 1], [2.756, 0.4, 0.6], [5.404, 0.15, 0.35]], attack: 0.002, decay: 2, vol: 0.08 * v })]); },
    bell: function (f, dur, v) { return P([L({ type: 'bell', freq: f, partials: [[1, 1, 1], [1.005, 0.6, 1], [2, 0.5, 0.7], [2.64, 0.35, 0.5], [3.36, 0.2, 0.35]], attack: 0.004, decay: dur, vol: 0.35 * v })]); },
    woodfish: function (v) { return P([L({ type: 'bell', freq: 640, partials: [[1, 1, 1], [1.58, 0.45, 0.6], [2.42, 0.2, 0.4]], attack: 0.0008, decay: 0.12, vol: 0.4 * v })]); },
    drum: function (name, v, pitch) {
      var len = name === 'drum-edge-loud' ? 3.3 : name === 'drum-rim' ? 1.6 : 2.5;
      return P([L({ type: 'sample', sample: name, pitch: pitch == null ? -2 : pitch, attack: 0.001, hold: len, decay: 0.15, vol: 0.7 * v })]);
    },
    gong: function (v, pitch) { return P([L({ type: 'sample', sample: 'gong-1', pitch: pitch == null ? -3 : pitch, attack: 0.001, hold: 4, decay: 2.5, vol: 0.45 * v })]); }
  };

  /* ---------- mix: where each instrument sits ----------
     pan (-1 left .. 1 right, orchestral seating: violins left, violas centre-right, cellos right),
     send (how much of it goes to the hall reverb), hp (low cut in Hz so only the bass instruments own the bottom end). */
  var MIX = {
    guqin: { pan: -0.12, send: 0.42, hp: 70 }, qin: { pan: -0.24, send: 0.4, hp: 70 }, harmonic: { pan: -0.12, send: 0.6, hp: 200 },
    pipa: { pan: -0.22, send: 0.3, hp: 110 }, strum: { pan: 0.28, send: 0.3, hp: 140 },
    flute: { pan: 0.14, send: 0.5, hp: 220 }, erhu: { pan: 0.06, send: 0.42, hp: 160 },
    cello: { pan: 0.32, send: 0.36, hp: 40 }, spic: { pan: 0.22, send: 0.22, hp: 55 },
    pad: { pan: 0, send: 0.65, hp: 120 }, drone: { pan: 0, send: 0.5, hp: 35 }, bass: { pan: 0.05, send: 0.2, hp: 35 },
    chime: { pan: -0.45, send: 0.7, hp: 500 }, bell: { pan: 0, send: 0.6, hp: 60 },
    woodfish: { pan: 0.42, send: 0.35, hp: 300 }, gong: { pan: -0.18, send: 0.5, hp: 40 }, drum: { pan: 0, send: 0.25, hp: 30 }
  };
  var SECTION_MIX = { vc: { pan: 0.32, send: 0.45, hp: 45 }, va: { pan: 0.12, send: 0.5, hp: 110 }, vn: { pan: -0.32, send: 0.52, hp: 160 } };
  function mixed(p, m) { if (m) { p.pan = m.pan; p.send = m.send; p.hp = m.hp; } return p; }
  Object.keys(MIX).forEach(function (name) {
    var fn = I[name];
    I[name] = function () {
      var p = fn.apply(null, arguments);
      if (name === 'drum') { var smp = arguments[0]; return mixed(p, { pan: smp === 'drum-rim' ? -0.12 : smp === 'drum-edge-loud' ? 0.1 : 0, send: 0.25, hp: 30 }); }
      return mixed(p, MIX[name]);
    };
  });
  /* one string section on its own patch, so each section can sit in its own place */
  I.section = function (f, dur, v, sec) {
    var lo = { vc: [98, 196], va: [174.6, 349.2], vn: [293.7, 587.3] }[sec], n = nearest(STR[sec], fold(f, lo[0], lo[1]));
    return mixed(P([L({ type: 'sample', sample: n.name, pitch: n.st, offset: 0.12, attack: Math.min(0.9, dur * 0.3), hold: Math.max(0, dur - 1), decay: 1.1,
      vol: (sec === 'vc' ? 0.32 : 0.26) * v, filter: 'lowpass', cutoff: 3800, cutoffEnd: 3800, q: 0.5 })]), SECTION_MIX[sec]);
  };
  var lineFn = I.line;
  I.line = function (f, dur, v, sec) { var m = SECTION_MIX[sec || 'vn']; return mixed(lineFn(f, dur, v, sec), { pan: m.pan * 1.2, send: m.send + 0.05, hp: m.hp }); };

  /* ---------- harmony ----------
     Default ('diatonic'): the melody stays pentatonic, but the chords underneath are triads of the full
     seven-note scale, the way most Chinese game and film scores do it (pentatonic tune over minor/major
     progressions such as i-VI-III-VII). spec.harmony = 'penta' keeps the old open, fourth-stacked chords.
     Progressions are 4-bar lists of chord roots: pentatonic degrees for 'penta', scale degrees (0 = i) otherwise. */
  var PROG = {
    A1: [[0, 4, 1, 3], [0, 3, 4, 1], [0, 4, 3, 1]],
    A2: [[0, 4, 3, 0], [0, 1, 3, 0], [4, 1, 3, 0]],
    B1: [[4, 3, 1, 3], [3, 4, 1, 4], [1, 4, 3, 4]],
    B2: [[4, 1, 3, 0], [3, 1, 4, 0], [1, 3, 4, 0]]
  };
  var SCALE7 = { gong: [0, 2, 4, 5, 7, 9, 11], zhi: [0, 2, 4, 5, 7, 9, 10], shang: [0, 2, 3, 5, 7, 8, 10], yu: [0, 2, 3, 5, 7, 8, 10], jue: [0, 1, 3, 5, 7, 8, 10], miyako: [0, 1, 3, 5, 7, 8, 10] };
  var PROG7 = {
    minor: {
      A1: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 5, 3, 6]],
      A2: [[5, 3, 6, 0], [5, 6, 4, 0], [3, 5, 6, 0]],
      B1: [[5, 2, 6, 3], [3, 0, 5, 6], [2, 6, 5, 3]],
      B2: [[5, 6, 0, 0], [3, 4, 0, 0], [5, 3, 4, 0]]
    },
    /* phrygian dark: i against bII (the semitone above the tonic), bVI and bVII; never a bright V */
    dark: {
      A1: [[0, 1, 0, 5], [0, 5, 1, 0], [0, 0, 1, 0]],
      A2: [[5, 1, 0, 0], [3, 1, 0, 0], [5, 6, 1, 0]],
      B1: [[5, 1, 5, 6], [3, 5, 1, 6], [1, 0, 5, 1]],
      B2: [[5, 6, 1, 0], [3, 1, 0, 0], [1, 1, 0, 0]]
    },
    major: {
      A1: [[0, 5, 3, 4], [0, 4, 5, 3], [0, 3, 4, 0]],
      A2: [[5, 3, 4, 0], [3, 4, 0, 0], [0, 5, 4, 0]],
      B1: [[5, 3, 0, 4], [3, 0, 5, 4], [5, 2, 3, 4]],
      B2: [[3, 4, 0, 0], [5, 3, 4, 0], [1, 4, 0, 0]]
    }
  };
  /* harmony context of the piece being composed (set at the top of compose) */
  var hx = { diat: false, pent: MODES.gong, s7: SCALE7.gong, jue: false };
  function harmonyFor(sp) {
    var m = MODES[sp.mode] ? sp.mode : 'gong';
    hx = { diat: sp.harmony !== 'penta', dark: sp.harmony === 'dark', pent: MODES[m], s7: SCALE7[m], jue: m === 'jue' || m === 'miyako', major: m === 'gong' || m === 'zhi' };
  }
  function progs() {
    if (!hx.diat) return PROG;
    if (hx.dark) return PROG7.dark;
    var t = PROG7[hx.major ? 'major' : 'minor'], out = {};
    /* phrygian v is diminished: use VII instead */
    for (var k in t) out[k] = t[k].map(function (pr) { return pr.map(function (r) { return hx.jue && r === 4 ? 6 : r; }); });
    return out;
  }
  function pentSemi(d) { var i = ((d % 5) + 5) % 5; return hx.pent[i] + 12 * Math.floor(d / 5); }
  /* chord tones in semitones above the tonic (root position, close voicing) */
  function chordTones(r) {
    if (!hx.diat) return [r, r + 2, r + 3].map(pentSemi);
    return [0, 2, 4].map(function (k) { var i = r + k; return hx.s7[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7); });
  }
  function onChord(d, r) { var pc = ((pentSemi(d) % 12) + 12) % 12; return chordTones(r).some(function (c) { return ((c % 12) + 12) % 12 === pc; }); }
  /* a melody note a semitone away from a chord tone sounds like a wrong note */
  function clashes(d, r) {
    var pc = ((pentSemi(d) % 12) + 12) % 12;
    return chordTones(r).some(function (c) { var x = Math.abs(((c % 12) + 12) % 12 - pc); return x === 1 || x === 11; });
  }
  function nearestChordTone(d, r) { for (var k = 0; k < 4; k++) { if (onChord(d + k, r)) return d + k; if (onChord(d - k, r)) return d - k; } return d; }
  /* how far (in melody steps) to move a motif when the harmony moves from chord a to chord b */
  function degShift(a, b) { return hx.diat ? Math.round((b - a) * 5 / 7) : b - a; }
  /* nearest pentatonic degree to a chord root, for tools that only know pentatonic chords */
  function pentRoot(r) {
    if (!hx.diat) return r;
    var s = chordTones(r)[0], best = 0;
    for (var d = -5; d < 10; d++) if (Math.abs(pentSemi(d) - s) < Math.abs(pentSemi(best) - s)) best = d;
    return best;
  }

  /* ---------- melody: rhythm patterns per bar (beats), chosen by density; one set per metre ---------- */
  var RHYTHMS = {
    sparse: [[4], [3, 1], [2, 2], [2, 1, 1]],
    medium: [[1, 1, 2], [2, 1, 1], [1.5, 0.5, 2], [1, 0.5, 0.5, 2], [2, 2]],
    dense: [[1, 1, 1, 1], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 2]]
  };
  var RHYTHMS3 = {
    sparse: [[3], [2, 1]],
    medium: [[1, 1, 1], [2, 1], [1.5, 0.5, 1], [1, 2]],
    dense: [[0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1]]
  };
  function rhythm(r, density, B) {
    var R = B === 3 ? RHYTHMS3 : RHYTHMS;
    var pool = r() < density ? (r() < density ? R.dense : R.medium) : (r() < 0.5 ? R.medium : R.sparse);
    return pick(r, pool);
  }
  /* A motif: two bars of notes {b: beat offset, d: beats, deg}. B = beats per bar. */
  function makeMotif(r, sp, chords, base, B) {
    var notes = [], d = nearestChordTone(base + Math.floor(r() * 3), chords[0]);
    var ends = B === 3 ? [[1, 2], [2, 1], [3], [1.5, 0.5, 1]] : [[1, 1, 2], [2, 2], [1.5, 0.5, 2], [3, 1]];
    for (var bar = 0; bar < 2; bar++) {
      var rh = bar === 1 && r() < 0.6 ? pick(r, ends) : rhythm(r, sp.density, B), b = 0;
      rh.forEach(function (len, i) {
        if (!(bar === 0 && i === 0)) {
          var step = r() < 0.7 ? (r() < 0.5 ? -1 : 1) : (r() < 0.5 ? -2 : 2);
          if (r() < 0.06) step = 0;
          d = clamp(d + step, base - 2, base + 7);
        }
        if (b % 2 === 0 && r() < (hx.diat ? 0.85 : 0.6)) d = nearestChordTone(d, chords[bar]);
        notes.push({ b: bar * B + b, d: len, deg: d });
        b += len;
      });
    }
    return notes;
  }
  /* Turn a motif into a 4-bar phrase: motif + answer; the answer reuses the rhythm, follows the chords and lands on the cadence. */
  function makePhrase(r, motif, chords, cadenceDeg, B) {
    var out = motif.map(function (n) { return { b: n.b, d: n.d, deg: n.deg }; });
    var shift = degShift(chords[0], chords[2]);
    motif.forEach(function (n, i) {
      var isLast = i === motif.length - 1, deg = n.deg + (r() < 0.6 ? shift : 0);
      if (n.b >= B) deg = nearestChordTone(deg, chords[3]);
      if (isLast) deg = cadenceDeg;
      out.push({ b: n.b + 2 * B, d: n.d, deg: deg });
    });
    if (out.length) { var last = out[out.length - 1]; last.d = Math.max(last.d, 4 * B - last.b); }
    return out;
  }
  /* Cadence target in the melody's register: a full cadence lands on the tonic, a half cadence on the fifth (mode degree 3). */
  function cadence(base, full) {
    var t = full ? Math.ceil((base + 2) / 5) * 5 : Math.floor(base / 5) * 5 + 3;
    if (!full && t < base) t += 5;
    return t;
  }
  /* Variation of a phrase: some long notes split into a note plus a passing step, some short pairs merged. */
  function vary(r, notes, amount) {
    var out = [];
    notes.forEach(function (n, i) {
      var last = i === notes.length - 1;
      if (!last && n.d >= 2 && r() < amount) {
        var h = n.d >= 3 ? 1 : n.d / 2, nx = notes[i + 1], dir = nx && nx.deg < n.deg ? -1 : 1;
        out.push({ b: n.b, d: n.d - h, deg: n.deg }, { b: n.b + n.d - h, d: h, deg: n.deg + dir });
      } else out.push({ b: n.b, d: n.d, deg: n.deg });
    });
    return out;
  }

  /* ---------- forms ----------
     A form is a list of [section, intensity]. Sections:
       free  - unmetred solo opening (or close) over one held chord
       intro - accompaniment alone with a hint of the theme
       A     - the theme;  A2 - the theme varied (other instrument or octave, another accompaniment texture)
       B     - contrast;   C  - development and climax: motif fragments climbing in sequence, everything playing
       brk   - breakdown: a lone line over the strings, the floor drops out before the next build
       outro - augmented theme, slowing down
     spec.form picks one by name (or a list rotated each time the piece comes round); spec.structure still works. */
  var FORMS = {
    ballad: [['free', 0.2], ['A', 0.4], ['A2', 0.5], ['B', 0.62], ['A', 0.46], ['outro', 0.2]],
    arch: [['intro', 0.25], ['A', 0.4], ['B', 0.55], ['C', 0.72], ['A2', 0.5], ['outro', 0.2]],
    journey: [['intro', 0.22], ['A', 0.38], ['A2', 0.48], ['brk', 0.3], ['B', 0.6], ['C', 0.7], ['A', 0.45], ['outro', 0.2]],
    rondo: [['intro', 0.25], ['A', 0.42], ['B', 0.55], ['A2', 0.5], ['C', 0.7], ['A', 0.45], ['outro', 0.2]],
    temple: [['free', 0.15], ['A', 0.32], ['brk', 0.25], ['B', 0.46], ['A2', 0.4], ['free', 0.15]],
    battle: [['intro', 0.6], ['A', 0.75], ['A2', 0.82], ['B', 0.9], ['brk', 0.55], ['C', 1], ['A2', 0.88]],
    siege: [['intro', 0.65], ['A', 0.78], ['B', 0.88], ['C', 0.95], ['brk', 0.6], ['A2', 0.9], ['C', 1]]
  };
  function formOf(sp, input, cycle) {
    var f = sp.form;
    if (input && input.structure && !input.form) f = null;
    if (Array.isArray(f)) f = f.length ? f[cycle % f.length] : null;
    if (f && FORMS[f]) return { names: FORMS[f].map(function (s) { return s[0]; }), lv: FORMS[f].map(function (s) { return s[1]; }) };
    return { names: sp.structure, lv: sp.intensity };
  }

  /* ---------- compose a whole piece ---------- */
  function compose(input, cycle) {
    var sp = spec(input), beat = 60 / sp.tempo, B = sp.meter === 3 ? 3 : 4, barLen = B * beat, PH = 4 * B;
    cycle = cycle || 0;
    var rTheme = rng(sp.seed), rB = rng(sp.seed * 31 + 7 + cycle * 7919), rArr = rng(sp.seed * 17 + 3 + cycle * 104729), rHum = rng(sp.seed * 13 + cycle * 1299709 + 5);
    var events = [], sections = [], melody = [], chordLog = [], bar = 0;
    var form = formOf(sp, input, cycle), structure = form.names, levels = form.lv || [];
    harmonyFor(sp);
    var PR = progs();
    var mBase = sp.register != null ? sp.register : REGISTER[sp.melody] || 4, bBase = sp.registerB != null ? sp.registerB : (REGISTER[sp.melodyB || sp.melody] || 4) + 2;
    var progA1 = pick(rTheme, PR.A1), progA2 = pick(rTheme, PR.A2);
    var motifA = makeMotif(rTheme, sp, progA1, mBase, B);
    var phraseA1 = makePhrase(rTheme, motifA, progA1, cadence(mBase, false), B), phraseA2 = makePhrase(rTheme, motifA, progA2, cadence(mBase, true), B);
    /* A hand-written theme (8 bars, notes {b, d, deg}) replaces the generated A phrases. */
    var userA = Array.isArray(sp.themeA) && sp.themeA.length ? sp.themeA : null, userB = Array.isArray(sp.themeB) && sp.themeB.length ? sp.themeB : null;
    var genA = phraseA1.concat(phraseA2.map(function (n) { return { b: n.b + PH, d: n.d, deg: n.deg }; }));
    if (userA) {
      phraseA1 = userA.filter(function (n) { return n.b < PH; });
      phraseA2 = userA.filter(function (n) { return n.b >= PH; }).map(function (n) { return { b: n.b - PH, d: n.d, deg: n.deg }; });
      var firstBars = userA.filter(function (n) { return n.b < 2 * B; });
      if (firstBars.length) motifA = firstBars;
    }
    var progB1 = pick(rB, PR.B1), progB2 = pick(rB, PR.B2);
    var motifB = makeMotif(rB, sp, progB1, bBase, B);
    var phraseB1 = makePhrase(rB, motifB, progB1, cadence(bBase, false), B), phraseB2 = makePhrase(rB, motifB, progB2, cadence(mBase + 5, true), B);
    var genB = phraseB1.concat(phraseB2.map(function (n) { return { b: n.b + PH, d: n.d, deg: n.deg }; }));
    if (userB) {
      phraseB1 = userB.filter(function (n) { return n.b < PH; });
      phraseB2 = userB.filter(function (n) { return n.b >= PH; }).map(function (n) { return { b: n.b - PH, d: n.d, deg: n.deg }; });
    }
    var h = clamp(sp.humanize == null ? 0.6 : sp.humanize, 0, 1);
    var texture = sp.texture || 'block', texture2 = sp.texture2 || (texture === 'block' ? 'arp' : texture === 'arp' ? 'block' : texture);
    /* second voice for A2: the B instrument if it differs, otherwise the same one an octave up */
    var leadA2 = sp.melodyA2 || (sp.melodyB && sp.melodyB !== sp.melody ? sp.melodyB : sp.melody);
    var octA2 = leadA2 === sp.melody && (REGISTER[sp.melody] || 4) < 5 ? 5 : 0;

    function at(b) { return b * beat; }
    function add(t, p) { events.push({ t: Math.max(0, t), p: p }); }
    function jitter() { return (rHum() - 0.5) * 0.035 * h; }
    function shiftNotes(notes, db, dd) { return notes.map(function (n) { return { b: n.b + db, d: n.d, deg: n.deg + (dd || 0) }; }); }

    /* prog: the 4-bar progression under these notes; notes on strong beats or held long that clash with it move to a chord tone */
    function playMelody(notes, startBar, inst, I0, ornament, sectionName, prog, gain) {
      var n = notes.length;
      notes.forEach(function (nt, i) {
        var pos = nt.b / PH, arch = 0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, pos));
        var v = clamp((0.55 + 0.45 * I0) * arch * (1 + (rHum() - 0.5) * 0.25 * h), 0.2, 1.1) * (gain || 1);
        var deg = nt.deg + (ornament && rArr() < 0.12 && nt.d < 2 ? (rArr() < 0.5 ? 1 : -1) : 0);
        var strong = B === 3 ? nt.b % 3 === 0 : nt.b % 2 === 0;
        if (prog && hx.diat) {
          var ch = prog[Math.floor(nt.b / B) % 4];
          if ((strong || nt.d >= 1.5) && clashes(deg, ch)) deg = nearestChordTone(deg, ch);
        }
        var f = hz(midi(sp, deg)), t = (startBar * B + nt.b) * beat + jitter();
        var next = notes[i + 1], phraseEnd = !next || next.b - nt.b > nt.d || i === n - 1;
        var dur = nt.d * beat * (phraseEnd ? 0.92 : 1);
        melody.push({ bar: startBar + Math.floor(nt.b / B), beat: nt.b % B, beats: nt.d, deg: deg, inst: inst, section: sectionName });
        if (inst === 'guqin') add(t, rArr() < 0.12 && nt.d >= 2 && deg >= mBase + 3 ? I.harmonic(f * 2, v) : I.guqin(f, dur, v, nt.d >= 2 && rArr() < 0.3 ? Math.pow(2, -2 / 12) : 0));
        else if (inst === 'flute') add(t, I.flute(f, dur, v));
        else if (inst === 'erhu') add(t, I.erhu(f, dur, v, sp.dark ? (nt.d >= 1 && rArr() < 0.55 ? -2 : 0) : nt.d >= 1.5 && rArr() < 0.45 ? (rArr() < 0.7 ? 2 : -1) : 0));
        else add(t, I.pipa(f, dur, v, nt.d >= 2 && !sp.dark));
      });
    }

    /* Four layers, each switched per section by `lay` (0 = off, 1 = normal, >1 = pushed):
       bed (string pad + cello bass), rhythm (plucked accompaniment, spiccato ostinato), perc, color (chimes).
       tex: how the plucked accompaniment moves - block (on the beats), arp (gentle broken chord), pulse (low strings), none. */
    function accompany(prog, startBar, bars, I0, last, lay, tex) {
      lay = lay || { bed: 1, rhythm: 1, perc: 1, color: 1 };
      tex = tex || texture;
      var R = sp.root;
      for (var k = 0; k < bars; k++) {
        var r0 = prog[k % 4], tones = chordTones(r0), b0 = startBar + k, t0 = at(b0 * B);
        chordLog[b0] = r0;
        var low = tones.map(function (st) { return hz(R + st - 12); });
        var plk = sp.accomp === 'guqin' || sp.accomp === 'pipa';
        if (lay.rhythm && plk && tex === 'block') {
          if (sp.accomp === 'guqin') {
            var pattern = I0 < 0.35 ? [[0, 0], [2, 1]] : I0 < 0.7 ? [[0, 0], [1, 1], [2, 2], [3, 1]] : [[0, 0], [0.5, 1], [1, 2], [1.5, 1], [2, 0], [2.5, 1], [3, 2], [3.5, 1]];
            pattern.forEach(function (pt) { if (pt[0] < B) add(t0 + at(pt[0]) + jitter(), I.qin(low[pt[1]], beat * 1.5, (0.26 + 0.2 * I0) * lay.rhythm)); });
          } else {
            var hits = I0 < 0.6 ? [0, 2] : [0, 1.5, 2, 3];
            hits.forEach(function (bt, i) { if (bt < B) add(t0 + at(bt) + jitter(), I.strum(tones.map(function (st) { return hz(R + st); }), (i === 0 ? 0.9 : 0.6) * (0.5 + 0.5 * I0) * lay.rhythm)); });
          }
        } else if (lay.rhythm && plk && tex === 'arp') {
          /* broken chord: root, fifth, tenth rising then falling back; eighths when it is busy */
          var up = [low[0], low[2], hz(R + tones[1]), hz(R + tones[2]), hz(R + tones[0] + 12)];
          var step = I0 > 0.6 ? 0.5 : 1, nArp = Math.round(B / step);
          for (var a = 0; a < nArp; a++) {
            var idx = a < 4 ? a : 8 - a, f = up[clamp(idx, 0, up.length - 1)];
            add(t0 + at(a * step) + jitter(), I.qin(f, beat * 2, (a === 0 ? 0.3 : 0.2) * (0.6 + 0.5 * I0) * lay.rhythm));
          }
        } else if (lay.rhythm && tex === 'pulse') {
          /* a low heartbeat on the cellos: long-short on the root */
          var pulse = B === 3 ? [[0, 1], [2, 0.6]] : [[0, 1], [1.5, 0.55], [2.5, 0.7]];
          pulse.forEach(function (x) { add(t0 + at(x[0]) + jitter() * 0.5, I.spic(hz(R + tones[0] - 12), 0.42 * x[1] * (0.6 + 0.5 * I0) * lay.rhythm)); });
        } else if (lay.rhythm && sp.accomp === 'pad') {
          add(t0, I.pad(tones.map(function (st) { return hz(R + st); }), barLen + 0.8, (0.6 + 0.6 * I0) * lay.rhythm));
        }
        if (sp.strings && lay.bed) {
          /* bowed string bed under everything: root low on cellos, third in the middle, fifth up top */
          var lvl = sp.strings === true ? 0.7 : sp.strings;
          var sv = lvl * (0.45 + 0.55 * I0) * lay.bed, tj = jitter();
          add(t0 + tj, I.section(hz(R + tones[0] - 12), barLen + 0.6, sv, 'vc'));
          add(t0 + tj + 0.012, I.section(hz(R + tones[1]), barLen + 0.6, sv, 'va'));
          add(t0 + tj + 0.024, I.section(hz(R + tones[2] + 12), barLen + 0.6, sv, 'vn'));
        }
        var pedal = sp.pedal ? 0 : tones[0];
        if (sp.bass === 'cello' && lay.bed && k % 2 === 0) add(t0, I.cello(hz(R + pedal - 12), Math.min(2, bars - k) * barLen + 0.3, (0.55 + 0.45 * I0) * Math.min(1.2, lay.bed)));
        if (sp.ostinato === 'spic' && lay.rhythm) {
          /* driving low strings: eighth notes on the chord root, jumps to the fifth and octave, accents on the strong beats */
          var pat = B === 3 ? (I0 < 0.6 ? [0, 0, 7, 0, 7, 0] : [0, 0, 7, 0, 12, 7]) : (I0 < 0.6 ? [0, 0, 7, 0, 0, 0, 7, 0] : [0, 0, 7, 0, 0, 7, 12, 7]);
          /* grind: the low strings saw between the tonic and the semitone above it */
          if (sp.ostinatoPat === 'grind') pat = B === 3 ? (I0 < 0.6 ? [0, 0, 1, 0, 0, 1] : [0, 0, 1, 0, 1, -1]) : (I0 < 0.6 ? [0, 0, 1, 0, 0, 0, 1, 0] : [0, 0, 1, 0, 0, 1, 0, -1]);
          pat.forEach(function (st, i) {
            add(t0 + at(i * 0.5) + jitter() * 0.5, I.spic(hz(R + pedal + st - 12), (i % (B === 3 ? 6 : 4) === 0 ? 1 : 0.62) * (0.5 + 0.5 * I0) * lay.rhythm));
          });
        }
        if (sp.bass === 'pulse' && lay.bed) {
          [0, 2].forEach(function (bt) { if (bt < B) add(t0 + at(bt), I.bass(hz(R + tones[0] - 24), beat * 1.8, 0.6 + 0.4 * I0)); });
        }
        if (lay.perc && sp.perc === 'woodfish' && (I0 > 0.3 || k % 2 === 0)) add(t0 + jitter(), I.woodfish((0.5 + 0.4 * I0) * lay.perc));
        if (lay.perc && sp.perc === 'drum') {
          add(t0, I.drum('drum-center-soft', (0.4 + 0.5 * I0) * Math.min(1, lay.perc), -3));
          if (I0 > 0.55) add(t0 + at(2), I.drum('drum-center-soft', (0.3 + 0.4 * I0) * Math.min(1, lay.perc), -3));
        }
        if (lay.perc && sp.perc === 'battle') {
          var fill = last && k === bars - 1, light = lay.perc < 0.6;
          var kit = sp.dark ? (B === 3 ? [[0, 'drum-center-loud', 1], [2, 'drum-center-soft', 0.65]] : [[0, 'drum-center-loud', 1], [1.5, 'drum-center-soft', 0.55], [2.5, 'drum-center-loud', 0.75]])
            : B === 3 ? [[0, 'drum-center-loud', 1], [1, 'drum-center-soft', 0.7], [1.5, 'drum-edge-loud', 0.8], [2, 'drum-center-soft', 0.75], [2.5, 'drum-center-soft', 0.6]]
            : [[0, 'drum-center-loud', 1], [1.5, 'drum-center-soft', 0.7], [2, 'drum-edge-loud', 0.9], [3, 'drum-center-soft', 0.75], [3.5, 'drum-center-soft', 0.6]];
          kit.forEach(function (x) {
            if (fill && x[0] >= B / 2) return;
            if (light && x[0] > 0) return;
            add(t0 + at(x[0]) + jitter() * 0.5, I.drum(x[1], x[2] * (0.55 + 0.45 * I0) * Math.min(1, lay.perc), sp.dark ? -5 : -2));
          });
          if (fill) for (var q = 0; q < B; q++) add(t0 + at(B / 2 + q * 0.5), I.drum('drum-center-loud', 0.5 + q * 0.15, -1));
        }
        if (lay.color && sp.sparkle && rArr() < 0.18 * (1 - I0 * 0.5)) add(t0 + at(Math.floor(rArr() * B)), I.chime(hz(midi(sp, 13 + Math.floor(rArr() * 4))), 1));
      }
    }

    /* Counter-melody: a slow string line (one or two notes a bar) that moves to the nearest chord tone,
       below the tune when the tune sits high (violas), above it when the tune sits low (violins). */
    var cPrev = null;
    function counterLine(prog, startBar, bars, gain) {
      var high = mBase < 5, R = sp.root, lo = high ? R + 12 : R - 2, hi = lo + 12, half = B === 3 ? 2 : 2;
      for (var k = 0; k < bars; k++) {
        var tones = chordTones(prog[k % 4]), t0 = at((startBar + k) * B);
        var cands = [];
        tones.forEach(function (st) { for (var o = -24; o <= 36; o += 12) { var m = R + st + o; if (m >= lo && m < hi) cands.push(m); } });
        if (cPrev == null) cPrev = cands[Math.floor(cands.length / 2)];
        cands.sort(function (a, b) { return Math.abs(a - cPrev) - Math.abs(b - cPrev); });
        var m1 = cands[0] === cPrev && cands.length > 1 && rArr() < 0.5 ? cands[1] : cands[0];
        var split = rArr() < 0.4;
        add(t0 + jitter(), I.line(hz(m1), (split ? half : B) * beat + 0.2, gain, high ? 'vn' : 'va'));
        if (split) { var m2 = cands[Math.min(cands.length - 1, 1 + Math.floor(rArr() * 2))]; add(t0 + at(half) + jitter(), I.line(hz(m2), (B - half) * beat + 0.2, gain * 0.9, high ? 'vn' : 'va')); m1 = m2; }
        cPrev = m1;
      }
    }
    /* one chord held under a whole stretch (free sections) */
    function holdChord(r0, startBar, bars, I0) {
      var R = sp.root, tones = chordTones(r0), t0 = at(startBar * B), d = bars * barLen + 1.5, lvl = (sp.strings === true ? 0.7 : sp.strings || 0.5) * (0.5 + 0.5 * I0);
      for (var k = 0; k < bars; k++) chordLog[startBar + k] = r0;
      add(t0, I.section(hz(R + tones[0] - 12), d, lvl, 'vc'));
      add(t0 + 0.4, I.section(hz(R + tones[2]), d, lvl * 0.8, 'va'));
      if (sp.bass === 'cello') add(t0, I.cello(hz(R + tones[0] - 12), d, 0.6));
    }

    /* a high violin held a tritone above the tonic: the note that never settles */
    function tritone(startBar, bars, gain) {
      add(at(startBar * B) + 0.3, I.line(hz(sp.root + 6 + 12), bars * barLen, gain, 'vn'));
    }

    /* which layers play in each section: build up through the piece, thin out at the ends */
    var battleLike = sp.perc === 'battle';
    var lastA = structure.lastIndexOf('A');
    function layersFor(name, si, aSoFar) {
      if (name === 'intro') return { bed: 0.8, rhythm: battleLike ? 0.6 : 0, perc: battleLike ? 0.6 : 0, color: 1 };
      if (name === 'outro') return { bed: 0.8, rhythm: 0.4, perc: 0, color: 1 };
      if (name === 'B') return { bed: 1.2, rhythm: 1, perc: 1, color: 1 };
      if (name === 'A2') return { bed: 1.1, rhythm: 1, perc: 1, color: 1, counter: 1 };
      if (name === 'C') return { bed: 1.25, rhythm: 1.15, perc: 1.2, color: 0, counter: 1 };
      if (name === 'brk') return { bed: 0.85, rhythm: battleLike ? 0.5 : 0, perc: battleLike ? 0.4 : 0, color: 1, counter: 0.9 };
      if (si === lastA && aSoFar > 0) return { bed: 1.2, rhythm: 1, perc: 1, color: 1, counter: 1 };
      return aSoFar === 0 ? { bed: 1, rhythm: 1, perc: 0.7, color: 1 } : { bed: 1, rhythm: 1, perc: 1, color: 1, counter: 0.8 };
    }
    function counterGain(lay, I0) { return 0.55 * lay.counter * (0.6 + 0.4 * I0); }

    structure.forEach(function (name, si) {
      var I0 = clamp(levels[si] == null ? 0.5 : levels[si], 0, 1), start = bar, bars;
      var isLast = si === structure.length - 1;
      var lay = layersFor(name, si, sections.filter(function (s) { return s.name === 'A'; }).length);
      if (name === 'intro') {
        bars = 4;
        accompany(progA2, bar, bars, I0, false, lay);
        if (sp.bass === 'drone') add(at(bar * B), I.drone(hz(midi(sp, -5)), bars * barLen + 2, 0.9));
        if (rArr() < 0.6) playMelody(shiftNotes(motifA.filter(function (n) { return n.b < B; }), 2 * B), bar, sp.melodyB || sp.melody, I0 * 0.7, false, name, userA ? null : progA2);
      } else if (name === 'free') {
        /* rubato: the motif stretched out, each note held a little longer or shorter, breaths between phrases */
        var src = si === 0 ? motifA : motifB, t = 0, notes = [];
        src.forEach(function (n, i) {
          var d = n.d * 2 * (0.85 + rArr() * 0.5);
          if (i === src.length - 1) d = Math.max(d, 2 * B);
          notes.push({ b: t, d: d, deg: n.deg });
          t += d + (n.d >= 2 && rArr() < 0.5 ? 0.6 : 0);
        });
        bars = Math.max(4, Math.ceil((t + 1) / B));
        holdChord(0, bar, bars, I0);
        add(at(bar * B), I.bell(hz(sp.root - 12), 5, 0.35 + 0.3 * I0));
        playMelody(notes, bar, si === 0 ? (sp.freeLead || sp.melody) : (sp.melodyB || sp.melody), Math.max(0.35, I0), false, name, [0, 0, 0, 0]);
      } else if (name === 'A') {
        bars = 8;
        var orn = !userA && sections.some(function (s) { return s.name === 'A'; });
        playMelody(phraseA1, bar, sp.melody, I0, orn, name, userA ? null : progA1);
        playMelody(phraseA2, bar + 4, sp.melody, I0, orn, name, userA ? null : progA2);
        accompany(progA1, bar, 4, I0, false, lay); accompany(progA2, bar + 4, 4, I0, isLast, lay);
        if (lay.counter && sp.strings) { counterLine(progA1, bar, 4, counterGain(lay, I0)); counterLine(progA2, bar + 4, 4, counterGain(lay, I0)); }
        if (sp.bass === 'drone') add(at(bar * B), I.drone(hz(midi(sp, -5)), bars * barLen + 2, 0.8 + 0.2 * I0));
      } else if (name === 'A2') {
        /* the theme again, told differently: other voice or octave, passing notes, the other accompaniment texture */
        bars = 8;
        var amt = 0.35 + 0.3 * rArr();
        playMelody(shiftNotes(vary(rArr, phraseA1, amt), 0, octA2), bar, leadA2, I0, true, name, userA ? null : progA1);
        playMelody(shiftNotes(vary(rArr, phraseA2, amt), 0, octA2), bar + 4, leadA2, I0, true, name, userA ? null : progA2);
        accompany(progA1, bar, 4, I0, false, lay, texture2); accompany(progA2, bar + 4, 4, I0, isLast, lay, texture2);
        if (sp.strings) { counterLine(progA1, bar, 4, counterGain(lay, I0)); counterLine(progA2, bar + 4, 4, counterGain(lay, I0)); }
        if (sp.bass === 'drone') add(at(bar * B), I.drone(hz(midi(sp, -5)), bars * barLen + 2, 0.9));
      } else if (name === 'B') {
        bars = 8;
        playMelody(phraseB1, bar, sp.melodyB || sp.melody, I0, false, name, userB ? null : progB1);
        playMelody(phraseB2, bar + 4, sp.melodyB || sp.melody, I0, false, name, userB ? null : progB2);
        /* B opens thinner (half rhythm) and fills back in for its second phrase */
        accompany(progB1, bar, 4, I0, false, { bed: lay.bed, rhythm: 0.5, perc: 0.6, color: 1 }); accompany(progB2, bar + 4, 4, I0, isLast, lay);
        if (sp.bass === 'drone') add(at(bar * B), I.drone(hz(midi(sp, -2)), bars * barLen + 2, 0.8));
      } else if (name === 'C') {
        /* development: the head of the theme climbs in sequence, then the head of B comes down to the tonic;
           the lead is doubled an octave below by the second instrument */
        bars = 8;
        var headA = motifA.filter(function (n) { return n.b < B; }), headB = motifB.filter(function (n) { return n.b < B; });
        if (!headA.length) headA = [{ b: 0, d: B, deg: mBase }];
        if (!headB.length) headB = headA;
        var up = [], down = [];
        [0, 1, 2].forEach(function (k) { up = up.concat(shiftNotes(headA, k * B, k)); });
        up.push({ b: 3 * B, d: B, deg: cadence(mBase + 2, false) });
        [0, 1, 2].forEach(function (k) { down = down.concat(shiftNotes(headB, k * B, -k)); });
        down.push({ b: 3 * B, d: B, deg: cadence(mBase, true) });
        playMelody(up, bar, sp.melody, I0, true, name, progB1);
        playMelody(down, bar + 4, sp.melody, I0, true, name, progA2);
        if (sp.melodyB && sp.melodyB !== sp.melody) {
          playMelody(shiftNotes(up, 0, -5), bar, sp.melodyB, I0, false, name, progB1, 0.55);
          playMelody(shiftNotes(down, 0, -5), bar + 4, sp.melodyB, I0, false, name, progA2, 0.55);
        }
        accompany(progB1, bar, 4, I0, false, lay); accompany(progA2, bar + 4, 4, I0, isLast, lay);
        if (sp.dark) tritone(bar, bars, 0.3);
        if (sp.strings) { counterLine(progB1, bar, 4, counterGain(lay, I0)); counterLine(progA2, bar + 4, 4, counterGain(lay, I0)); }
      } else if (name === 'brk') {
        /* breakdown: half the theme's head, slowed, on the second voice over the strings alone */
        bars = 4;
        var slow = motifA.map(function (n) { return { b: n.b * 2, d: n.d * 2, deg: n.deg + 5 }; }).filter(function (n) { return n.b < PH; });
        if (slow.length) slow[slow.length - 1].d = Math.max(slow[slow.length - 1].d, PH - slow[slow.length - 1].b);
        playMelody(slow, bar, sp.melodyB || sp.melody, I0, false, name, progA1);
        accompany(progA1, bar, bars, I0, false, lay, battleLike ? texture : 'none');
        if (sp.dark) tritone(bar, bars, 0.24);
        if (sp.strings) counterLine(progA1, bar, bars, counterGain(lay, I0));
      } else {
        bars = 4;
        var aug = motifA.map(function (n) { return { b: n.b * 2, d: n.d * 2, deg: n.deg }; });
        if (aug.length) {
          aug[aug.length - 1].deg = cadence(mBase, true);
          aug[aug.length - 1].d = Math.max(aug[aug.length - 1].d, PH - aug[aug.length - 1].b);
        }
        playMelody(aug, bar, sp.melody, I0, false, name, userA ? null : progA2);
        accompany(progA2, bar, bars, I0 * 0.7, false, lay);
        if (sp.bass === 'drone') add(at(bar * B), I.drone(hz(midi(sp, -5)), bars * barLen + 3, 0.7));
        if (sp.sparkle) add(at((bar + bars - 1) * B), I.chime(hz(midi(sp, 15)), 1));
      }
      /* gong marks the big arrivals, not every section */
      if (name !== 'outro' && name !== 'free' && name !== 'brk' && (name === 'C' || (!sp.dark && ((battleLike && (si === 0 || name === 'B')) || I0 > 0.85)))) add(at(start * B), I.gong(0.5 + 0.4 * I0, -3));
      sections.push({ name: name, startBar: start, bars: bars, intensity: I0 });
      bar += bars;
    });

    /* ritardando: the last two bars stretch up to 8 % when the piece ends with an outro */
    var totalBeats = bar * B, end = totalBeats * beat;
    if (structure[structure.length - 1] === 'outro') {
      var rStart = (bar - 2) * B * beat;
      events.forEach(function (e) { if (e.t > rStart) { var x = (e.t - rStart) / (end - rStart); e.t = rStart + (e.t - rStart) * (1 + 0.08 * x); } });
      end = rStart + (end - rStart) * 1.08;
    }
    events.sort(function (a, b) { return a.t - b.t; });
    return { spec: sp, events: events, duration: end, bars: bar, meter: B, sections: sections, melody: melody, beat: beat,
      themeA: genA, themeB: genB, registerA: mBase, registerB: bBase, chords: chordLog.map(pentRoot), chords7: hx.diat ? chordLog : null };
  }

  /* ---------- shared bus: one reverb + gentle compressor for every note ---------- */
  /* Synthetic hall impulse response: 20 ms pre-delay, a cluster of early reflections, then a decorrelated
     stereo tail whose highs die away faster than its lows (air absorption), like a real room. */
  function hallIR(c, seconds) {
    var sr = c.sampleRate, len = Math.floor(sr * seconds), ir = c.createBuffer(2, len, sr), pre = Math.floor(sr * 0.02);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch), r = rng(11 + ch * 97), y = 0, i;
      for (var e = 0; e < 10; e++) {
        var at = pre + Math.floor(sr * (0.004 + r() * 0.07)), amp = (0.5 - e * 0.035) * (r() < 0.5 ? -1 : 1);
        if (at < len) d[at] += amp;
      }
      for (i = pre; i < len; i++) {
        var u = (i - pre) / (len - pre), a = 0.85 - 0.75 * Math.pow(u, 0.6);
        y += a * ((r() * 2 - 1) - y);
        d[i] += y * 0.55 * Math.pow(1 - u, 2.2) * Math.min(1, (i - pre) / (sr * 0.03));
      }
    }
    return ir;
  }
  /* The mix bus. Each note enters through in(send): a dry path plus a reverb send at its own level.
     Reverb return is band-limited (no mud below 220 Hz, no fizz above 7 kHz). Master: low cut, a small dip
     at 300 Hz where everything piles up, gentle glue compression, then a limiter. `input` = default send. */
  function bus(c, reverb, volume) {
    var out = c.createGain(), dry = c.createGain(), revIn = c.createGain(), scale = (reverb == null ? 0.45 : reverb) / 0.45;
    /* the glue compressor and limiter add about 4 dB of loudness; take it back so overall level matches older versions */
    out.gain.value = (volume == null ? 0.8 : volume) * 0.63;
    var cv = c.createConvolver(), wet = c.createGain(), wl = c.createBiquadFilter(), wh = c.createBiquadFilter();
    cv.buffer = hallIR(c, 2.8); wet.gain.value = 0.9;
    wl.type = 'highpass'; wl.frequency.value = 220; wh.type = 'lowpass'; wh.frequency.value = 7000;
    revIn.connect(cv); cv.connect(wl); wl.connect(wh); wh.connect(wet);
    var lc = c.createBiquadFilter(), dip = c.createBiquadFilter(), glue = c.createDynamicsCompressor(), lim = c.createDynamicsCompressor();
    lc.type = 'highpass'; lc.frequency.value = 35; lc.Q.value = 0.7;
    dip.type = 'peaking'; dip.frequency.value = 300; dip.Q.value = 0.9; dip.gain.value = -2;
    glue.threshold.value = -16; glue.ratio.value = 2.5; glue.knee.value = 8; glue.attack.value = 0.02; glue.release.value = 0.25;
    lim.threshold.value = -2; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.1;
    dry.connect(lc); wet.connect(lc); lc.connect(dip); dip.connect(glue); glue.connect(lim); lim.connect(out);
    var sends = {};
    function inp(send) {
      var k = Math.round(Math.max(0, send) * 20) / 20;
      if (!sends[k]) {
        var g = c.createGain(), sg = c.createGain();
        sg.gain.value = k * scale;
        g.connect(dry); g.connect(sg); sg.connect(revIn);
        sends[k] = g;
      }
      return sends[k];
    }
    return { input: inp(0.45), in: inp, out: out, inFor: function (p) { return inp(p && p.send != null ? p.send : 0.45); } };
  }
  function samplesOf(events) {
    var names = [];
    events.forEach(function (e) { e.p.layers.forEach(function (l) { if (l.type === 'sample' && names.indexOf(l.sample) < 0) names.push(l.sample); }); });
    return names;
  }
  function preload(c, names) {
    return sfx.load(c, { layers: names.map(function (n) { return { type: 'sample', sample: n }; }) });
  }

  /* ---------- live, never-repeating playback ---------- */
  var live = null;
  function start(input, opts) {
    stop();
    var c = sfx.context();
    if (!c) return Promise.resolve();
    if (c.state === 'suspended') c.resume();
    var sp = spec(typeof input === 'string' ? { preset: input } : input);
    if (opts) for (var k in opts) if (opts[k] != null && k !== 'volume') sp[k] = opts[k];
    var b = bus(c, sp.reverb, opts && opts.volume);
    b.out.connect(c.destination);
    var me = { sp: sp, bus: b, cycle: 0, piece: compose(sp, 0), idx: 0, t0: 0, timer: null };
    live = me;
    var next = compose(sp, 1);
    return preload(c, samplesOf(me.piece.events).concat(samplesOf(next.events))).then(function () {
      if (live !== me) return;
      me.t0 = c.currentTime + 0.1;
      var tick = function () {
        if (live !== me) return;
        var horizon = c.currentTime + 1.2;
        while (true) {
          if (me.idx >= me.piece.events.length) {
            me.t0 += me.piece.duration; me.cycle++; me.piece = compose(sp, me.cycle); me.idx = 0;
          }
          var e = me.piece.events[me.idx];
          if (me.t0 + e.t > horizon) break;
          sfx.schedule(c, b.inFor(e.p), e.p, me.t0 + e.t);
          me.idx++;
        }
      };
      tick();
      me.timer = setInterval(tick, 200);
    });
  }
  /* stop(fade): fade is optional seconds of linear fade-out; default is a quick ~1 s release */
  function stop(fade) {
    if (!live) return;
    var me = live, c = sfx.context();
    live = null;
    clearInterval(me.timer);
    var g = me.bus.out.gain, now = c.currentTime;
    if (fade) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
    } else g.setTargetAtTime(0, now, 0.4);
    setTimeout(function () { try { me.bus.out.disconnect(); } catch (e) { /* already gone */ } }, Math.max(3000, (fade || 0) * 1000 + 1500));
  }

  /* ---------- seamless loop: render one piece + tail, fold the tail onto the start ---------- */
  function renderLoop(input, opts) {
    opts = opts || {};
    var sp = spec(typeof input === 'string' ? { preset: input } : input);
    for (var k in opts) if (opts[k] != null && k !== 'volume' && k !== 'sampleRate') sp[k] = opts[k];
    var piece = compose(sp, 0), tail = 6, sr = opts.sampleRate || 44100;
    var c = sfx.offlineContext(2, Math.ceil((piece.duration + tail) * sr), sr);
    var b = bus(c, sp.reverb, opts.volume == null ? 0.9 : opts.volume);
    b.out.connect(c.destination);
    return preload(c, samplesOf(piece.events)).then(function () {
      piece.events.forEach(function (e) { sfx.schedule(c, b.inFor(e.p), e.p, e.t); });
      return c.startRendering();
    }).then(function (buf) {
      var n = Math.round(piece.duration * sr), chans = [];
      for (var ch = 0; ch < buf.numberOfChannels; ch++) {
        var d = buf.getChannelData(ch), out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = d[i];
        for (var j = n; j < d.length; j++) out[j - n] += d[j];
        chans.push(out);
      }
      return { channels: chans, sampleRate: sr, seconds: piece.duration, bars: piece.bars };
    });
  }

  /* ---------- stingers ---------- */
  var SP0 = { mode: 'gong', root: 50 }, SPY = { mode: 'yu', root: 45 }, SPH = { mode: 'gong', root: 62 };
  var STINGERS = {
    victory: function () {
      var ev = [{ t: 0, p: I.drum('drum-edge-loud', 0.8, -1) }];
      [5, 7, 9, 10, 12].forEach(function (d, i) { ev.push({ t: 0.05 + i * 0.09, p: I.pipa(hz(midi(SP0, d)), 0.3, 0.9, false) }); });
      ev.push({ t: 0.5, p: I.bell(hz(midi(SP0, 15)), 3, 0.8) }, { t: 0.5, p: I.gong(0.5, 3) }, { t: 0.55, p: I.guqin(hz(midi(SP0, 10)), 2, 0.8) });
      return ev;
    },
    defeat: function () {
      var ev = [];
      [9, 7, 5, 3].forEach(function (d, i) { ev.push({ t: i * 0.38, p: I.guqin(hz(midi(SPY, d)), 1.5, 0.7, i === 3 ? Math.pow(2, 2 / 12) : 0) }); });
      ev.push({ t: 1.5, p: I.bell(hz(SPY.root - 12), 5, 0.8) }, { t: 1.2, p: I.erhu(hz(midi(SPY, 5)), 2.4, 0.7, -2) });
      return ev;
    },
    battleStart: function () {
      return [{ t: 0, p: I.drum('drum-center-loud', 0.9, -3) }, { t: 0.55, p: I.drum('drum-center-loud', 0.9, -3) }, { t: 0.95, p: I.drum('drum-edge-loud', 1, -2) }, { t: 1.2, p: I.gong(1, -2) }];
    },
    treasure: function () {
      var ev = [];
      [0, 1, 2, 3, 4, 5, 7].forEach(function (d, i) { ev.push({ t: i * 0.06, p: I.chime(hz(midi(SPH, d + 5)), 1.6) }); });
      ev.push({ t: 0.45, p: I.bell(hz(midi(SPH, 10)), 2.5, 0.7) });
      return ev;
    },
    breakthrough: function () {
      var ev = [{ t: 0, p: I.bell(hz(SP0.root - 12), 5, 0.9) }];
      [0, 2, 4, 5, 7, 9].forEach(function (d, i) { ev.push({ t: 0.3 + i * 0.11, p: I.guqin(hz(midi(SP0, d + 5)), 1.2, 0.7) }); });
      ev.push({ t: 1.05, p: I.flute(hz(midi(SP0, 12)), 2.2, 0.9) });
      return ev;
    }
  };
  function playStinger(name, opts) {
    var c = sfx.context();
    if (!c) return Promise.resolve();
    if (c.state === 'suspended') c.resume();
    var ev = STINGERS[name](), b = bus(c, 0.45, opts && opts.volume);
    b.out.connect(c.destination);
    return preload(c, samplesOf(ev)).then(function () {
      var t0 = c.currentTime + 0.05;
      ev.forEach(function (e) { sfx.schedule(c, b.inFor(e.p), e.p, t0 + e.t); });
    });
  }
  function renderStinger(name, opts) {
    var sr = (opts && opts.sampleRate) || 44100, ev = STINGERS[name]();
    var c = sfx.offlineContext(2, 7 * sr, sr), b = bus(c, 0.45, 0.9);
    b.out.connect(c.destination);
    return preload(c, samplesOf(ev)).then(function () {
      ev.forEach(function (e) { sfx.schedule(c, b.inFor(e.p), e.p, e.t); });
      return c.startRendering();
    }).then(function (buf) {
      var chans = [];
      for (var ch = 0; ch < buf.numberOfChannels; ch++) chans.push(buf.getChannelData(ch));
      return { channels: chans, sampleRate: sr };
    });
  }

  return {
    moods: Object.keys(PRESETS), stingers: Object.keys(STINGERS), modes: Object.keys(MODES),
    preset: function (name) { return spec({ preset: name }); },
    tempo: function (mood) { return (PRESETS[mood] || PRESETS.calm).tempo; },
    compose: compose, instruments: I, midiOf: midi, chordTones: chordTones, modeTable: MODES,
    start: start, stop: stop, playing: function () { return live ? (live.sp.preset || 'custom') : null; },
    volume: function (v) { if (live) live.bus.out.gain.setTargetAtTime(v, sfx.context().currentTime, 0.15); },
    bus: bus,
    renderLoop: renderLoop, playStinger: playStinger, renderStinger: renderStinger
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = makeMusic;
