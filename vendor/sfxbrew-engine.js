/* ============================================================================
   SFX Brew · 合成引擎
   ----------------------------------------------------------------------------
   ★ 整个引擎就是一个函数 makeSfx()，不依赖任何外部变量。
     "导出 JS 代码"时直接用 makeSfx.toString() 原样塞进用户的游戏里，
     所以页面里听到的、WAV 里导出的、代码里播放的，是同一份合成逻辑。
   ★ 噪声和混响冲激响应都用固定种子的随机数生成，每次渲染结果完全一样。
   ★ 这个函数里面不要写中文注释、不要引用外部变量（会被导出给别人用）。
   ==========================================================================*/
function makeSfx(env) {
  'use strict';
  var W = env || (typeof window !== 'undefined' ? window : {});
  var sampleBase = (env && env.sampleBase) || W.SFXBREW_SAMPLE_BASE || 'https://sfxbrew.com/samples/';
  var loadSample = env && env.loadSample;
  var samples = {}, pending = {};
  var PENTA = [0, 2, 4, 7, 9];
  var ctx = null;
  var cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function assets(c) {
    var a = cache && cache.get(c);
    if (a) return a;
    var r = rng(7), sr = c.sampleRate, i, ch;
    var nb = c.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
    for (i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    var len = Math.floor(sr * 2.5), ir = c.createBuffer(2, len, sr);
    for (ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    var pb = c.createBuffer(1, sr * 2, sr), pd0 = pb.getChannelData(0), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, w;
    for (i = 0; i < pd0.length; i++) {
      w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      pd0[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    var bb = c.createBuffer(1, sr * 2, sr), bd = bb.getChannelData(0), last = 0;
    for (i = 0; i < bd.length; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    a = { noise: nb, pink: pb, brown: bb, ir: ir };
    if (cache) cache.set(c, a);
    return a;
  }

  /* Recorded samples (CC0, see sfxbrew.com/samples/CREDITS.md) are fetched once and shared. */
  function sampleNames(p) {
    var out = [], i, L;
    for (i = 0; i < p.layers.length; i++) {
      L = p.layers[i];
      if (L.type === 'sample' && L.sample && out.indexOf(L.sample) < 0) out.push(L.sample);
    }
    return out;
  }
  function fetchSample(c, name) {
    if (samples[name]) return Promise.resolve(samples[name]);
    if (!pending[name]) {
      var get = loadSample ? Promise.resolve(loadSample(name)) : fetch(sampleBase + name + '.mp3').then(function (r) {
        if (!r.ok) throw new Error('sample ' + name + ': HTTP ' + r.status);
        return r.arrayBuffer();
      });
      pending[name] = get.then(function (ab) { return c.decodeAudioData(ab); }).then(function (b) {
        /* keep raw PCM, not the AudioBuffer: each context gets its own buffer copy (see bufferFor) */
        var data = [], ch;
        for (ch = 0; ch < b.numberOfChannels; ch++) data.push(new Float32Array(b.getChannelData(ch)));
        samples[name] = { sr: b.sampleRate, data: data }; return samples[name];
      }, function (e) { delete pending[name]; throw e; });
    }
    return pending[name];
  }
  var perCtx = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function bufferFor(c, name) {
    var raw = samples[name];
    if (!raw) return null;
    var m = perCtx && perCtx.get(c);
    if (!m) { m = {}; if (perCtx) perCtx.set(c, m); }
    if (!m[name]) {
      var buf = c.createBuffer(raw.data.length, raw.data[0].length, raw.sr), ch;
      for (ch = 0; ch < raw.data.length; ch++) buf.getChannelData(ch).set(raw.data[ch]);
      m[name] = buf;
    }
    return m[name];
  }
  function ensure(c, p) {
    return Promise.all(sampleNames(p).map(function (n) { return fetchSample(c, n); }));
  }

  function stepSemis(L, k) {
    var deg = (L.repStep || 0) * k;
    if (L.scale !== 'penta') return deg;
    var oct = Math.floor(deg / 5), idx = ((deg % 5) + 5) % 5;
    return 12 * oct + PENTA[idx];
  }

  /* Event times for a layer's repeats. Without jitter they are evenly spaced and identical;
     with jitter the gaps become random (Poisson-like at 1) and loudness varies, so crackles,
     bubbles and debris stop sounding mechanical. pitchJitter (semitones) varies pitch and cutoff. */
  function events(p, L, li) {
    var n = Math.max(1, L.rep || 1), out = [], t = L.start || 0, k;
    var jit = Math.max(0, Math.min(1, L.jitter || 0)), pj = L.pitchJitter || 0;
    var r = (jit || pj) ? rng(((p.seed || 1) * 977 + li * 7919 + 13) | 0) : null;
    for (k = 0; k < n; k++) {
      var amp = 1, ratio = 1;
      if (r) {
        if (jit) amp = (1 - jit) + jit * Math.pow(r(), 2);
        if (pj) ratio = Math.pow(2, (r() * 2 - 1) * pj / 12);
      }
      if (L.repGain > 0 && L.repGain !== 1) amp *= Math.pow(L.repGain, L.repGain > 1 ? k - (n - 1) : k);
      out.push({ t: t, amp: amp, ratio: ratio });
      var gap = (L.repGap || 0) * (L.repAccel > 0 ? Math.pow(L.repAccel, k) : 1);
      if (jit) gap *= (1 - jit) + jit * Math.min(4, -Math.log(1 - r() * 0.999));
      t += gap;
    }
    return out;
  }

  function layerEnd(p, L, li) {
    var ev = events(p, L, li);
    return ev[ev.length - 1].t + L.attack + (L.hold || 0) + L.decay;
  }

  function duration(p) {
    var end = 0, i;
    for (i = 0; i < p.layers.length; i++) end = Math.max(end, layerEnd(p, p.layers[i], i));
    var tail = 0;
    if (p.reverb > 0) tail = 0.6 + 1.9 * Math.min(1, p.reverb * 2);
    if (p.echo > 0) tail = Math.max(tail, p.echoTime * Math.log(0.001) / Math.log(Math.min(0.95, p.echo)));
    return Math.min(12, end + tail + 0.05);
  }

  function curve(fn) {
    var n = 4096, c = new Float32Array(n), i;
    for (i = 0; i < n; i++) c[i] = fn(i * 2 / (n - 1) - 1);
    return c;
  }

  /* Plucked-string buffers are expensive to compute; cache them (bounded) so busy multi-track music stays smooth. */
  var strCaches = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function stringBuffer(c, f, L, k) {
    var cc = strCaches && strCaches.get(c);
    if (!cc) { cc = { map: {}, keys: [] }; if (strCaches) strCaches.set(c, cc); }
    var key = f.toFixed(2) + '|' + (L.attack + (L.hold || 0) + L.decay).toFixed(2) + '|' + (L.bright == null ? 0.5 : L.bright).toFixed(2) + '|' + (k % 2);
    var hit = cc.map[key];
    if (hit) return hit;
    var b = stringBufferRaw(c, f, L, k);
    cc.map[key] = b; cc.keys.push(key);
    if (cc.keys.length > 400) delete cc.map[cc.keys.shift()];
    return b;
  }
  function stringBufferRaw(c, f, L, k) {
    var sr = c.sampleRate, len = Math.ceil(sr * (L.attack + (L.hold || 0) + L.decay + 0.05));
    var bright = L.bright == null ? 0.5 : Math.max(0, Math.min(1, L.bright));
    var blend = 0.5 * (1 - bright), w = 2 * Math.PI * f / sr;
    var pd = function (b) { return Math.atan2(b * Math.sin(w), (1 - b) + b * Math.cos(w)) / w; };
    var target = Math.max(2, sr / f - pd(blend)), Ni = Math.floor(target), lo = 0, hi = 1, fr = 0.5, it;
    for (it = 0; it < 30; it++) { fr = (lo + hi) / 2; if (pd(fr) < target - Ni) lo = fr; else hi = fr; }
    var buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
    var r = rng(Math.floor(f * 100) + k * 7919 + 1), lp = 0, a = 0.15 + 0.85 * bright, i;
    for (i = 0; i <= Ni + 1 && i < len; i++) { lp += a * ((r() * 2 - 1) - lp); d[i] = lp * 1.6; }
    var loss = Math.pow(0.001, 1 / (Math.max(0.05, L.decay * 1.5) * f));
    for (i = Ni + 2; i < len; i++) {
      var x0 = d[i - Ni] * (1 - fr) + d[i - Ni - 1] * fr;
      var x1 = d[i - Ni - 1] * (1 - fr) + d[i - Ni - 2] * fr;
      d[i] = loss * ((1 - blend) * x0 + blend * x1);
    }
    return buf;
  }

  function voice(c, A, out, L, t, k, ev) {
    var vj = ev ? ev.ratio : 1, va = ev ? ev.amp : 1;
    var ratio = Math.pow(2, stepSemis(L, k) / 12) * vj;
    var f0 = Math.max(1, L.freq * ratio), f1 = Math.max(1, (L.freqEnd || L.freq) * ratio);
    var hold = Math.max(0, L.hold || 0), tEnd = t + L.attack + hold + L.decay, stopAt = tEnd + 0.05;
    var tSlide = L.slideTime > 0 ? Math.min(tEnd, t + L.slideTime) : tEnd;
    var tSweep = L.sweepTime > 0 ? Math.min(tEnd, t + L.sweepTime) : tEnd;
    var g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, L.vol * va), t + L.attack);
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, L.vol * va), t + L.attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    g.connect(out);
    var dst = g, amp = g;
    if (L.trem > 0) {
      var tg = c.createGain(), tl = c.createOscillator(), td = c.createGain(), depth = Math.min(1, L.trem);
      tg.gain.value = 1 - depth / 2; td.gain.value = depth / 2;
      tl.frequency.value = L.tremRate || 6;
      tl.connect(td); td.connect(tg.gain); tg.connect(g);
      tl.start(t); tl.stop(stopAt);
      dst = amp = tg;
    }
    if (L.filter && L.filter !== 'none') {
      var f = c.createBiquadFilter();
      f.type = L.filter;
      f.Q.value = L.q || 1;
      var cf = function (x) { return Math.min(20000, Math.max(20, x * vj)); };
      f.frequency.setValueAtTime(cf(L.cutoff), t);
      if (L.cutoffPeak > 0) {
        f.frequency.exponentialRampToValueAtTime(cf(L.cutoffPeak), t + Math.max(0.002, L.attack));
        f.frequency.exponentialRampToValueAtTime(cf(L.cutoffEnd || L.cutoff), tEnd);
      } else if (L.cutoffEnd && L.cutoffEnd !== L.cutoff) f.frequency.exponentialRampToValueAtTime(cf(L.cutoffEnd), tSweep);
      f.connect(amp);
      dst = f;
    }
    var lfoGain = null;
    if (L.vib > 0) {
      var lfo = c.createOscillator();
      lfo.frequency.value = L.vibRate || 6;
      lfoGain = c.createGain();
      lfoGain.gain.value = L.vib;
      if (L.vibDelay > 0) {
        /* delayed vibrato: hold the pitch steady first, then ease the wobble in, like a bowed or blown note */
        lfoGain.gain.setValueAtTime(0, t);
        lfoGain.gain.setValueAtTime(0, t + L.vibDelay);
        lfoGain.gain.linearRampToValueAtTime(L.vib, t + L.vibDelay + 0.35);
      }
      lfo.connect(lfoGain);
      lfo.start(t); lfo.stop(stopAt);
    }
    if (L.type === 'noise') {
      var s = c.createBufferSource();
      s.buffer = L.color === 'pink' ? A.pink : L.color === 'brown' ? A.brown : A.noise; s.loop = true;
      if (lfoGain && s.detune) lfoGain.connect(s.detune);
      s.connect(dst);
      s.start(t, (k * 0.37) % 1.5); s.stop(stopAt);
      return;
    }
    if (L.type === 'sample') {
      var sb = bufferFor(c, L.sample);
      if (!sb) return;
      var sp = c.createBufferSource(), semi = stepSemis(L, k);
      var p0 = L.pitch || 0, p1 = L.pitchEnd == null ? p0 : L.pitchEnd;
      var r0 = Math.pow(2, (p0 + semi) / 12) * vj, r1 = Math.pow(2, (p1 + semi) / 12) * vj;
      sp.buffer = sb;
      sp.playbackRate.setValueAtTime(r0, t);
      if (r1 !== r0) sp.playbackRate.exponentialRampToValueAtTime(r1, tSlide);
      if (lfoGain && sp.detune) lfoGain.connect(sp.detune);
      sp.connect(dst);
      sp.start(t, Math.max(0, L.offset || 0)); sp.stop(stopAt);
      return;
    }
    if (L.type === 'string') {
      var ss = c.createBufferSource();
      ss.buffer = stringBuffer(c, f0, L, k);
      ss.playbackRate.setValueAtTime(1, t);
      if (f1 !== f0) ss.playbackRate.exponentialRampToValueAtTime(f1 / f0, tSlide);
      if (lfoGain && ss.detune) lfoGain.connect(ss.detune);
      ss.connect(dst);
      ss.start(t); ss.stop(stopAt);
      return;
    }
    var parts = L.type === 'bell' ? (L.partials && L.partials.length ? L.partials : [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]])
      : L.type === 'pluck' ? [[1, 1], [2.01, 0.3]] : [[1, 1]];
    var uni = Math.max(1, Math.min(5, Math.round(L.unison || 1))), spread = L.detune || 0;
    for (var i = 0; i < parts.length; i++) {
      var pg = c.createGain(), r = parts[i][0], nv = i === 0 ? uni : 1;
      pg.gain.setValueAtTime(parts[i][1] / Math.sqrt(nv), t);
      if (L.type === 'bell' && (i > 0 || parts[i][2] != null)) {
        var dm = parts[i][2] != null ? Math.min(1, parts[i][2]) : 1 / Math.pow(r, 0.5);
        pg.gain.exponentialRampToValueAtTime(0.0001, t + L.attack + hold + Math.max(0.01, L.decay * dm));
      }
      pg.connect(dst);
      for (var u = 0; u < nv; u++) {
        var o = c.createOscillator();
        o.type = (L.type === 'bell' || i > 0) ? 'sine' : (L.wave || 'sine');
        o.frequency.setValueAtTime(f0 * r, t);
        if (L.freqPeak > 0) {
          o.frequency.exponentialRampToValueAtTime(L.freqPeak * ratio * r, t + Math.max(0.002, L.attack));
          o.frequency.exponentialRampToValueAtTime(f1 * r, tEnd);
        } else if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1 * r, tSlide);
        if (nv > 1) o.detune.value = spread * (u / (nv - 1) - 0.5) * 2;
        if (lfoGain) lfoGain.connect(o.detune);
        if (L.type === 'fm' && L.fmIndex > 0) {
          var m = c.createOscillator(), mg = c.createGain(), ratio2 = L.fmRatio || 2;
          m.frequency.setValueAtTime(f0 * ratio2, t);
          if (f1 !== f0) m.frequency.exponentialRampToValueAtTime(f1 * ratio2, tSlide);
          mg.gain.setValueAtTime(L.fmIndex * f0, t);
          mg.gain.exponentialRampToValueAtTime(Math.max(0.01, L.fmIndex * f0 * 0.03), Math.min(tEnd, t + (L.fmDecay || L.decay * 0.5)));
          m.connect(mg); mg.connect(o.frequency);
          m.start(t); m.stop(stopAt);
        }
        o.connect(pg);
        o.start(t); o.stop(stopAt);
      }
    }
  }

  function build(c, dest, p, t0) {
    var A = assets(c), i, k;
    var pre = c.createGain(); pre.gain.value = p.gain == null ? 0.8 : p.gain;
    var node = pre;
    /* optional low cut (p.hp, Hz): clears rumble and mud from instruments that don't need the bottom end */
    if (p.hp > 0) {
      var hpf = c.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = p.hp; hpf.Q.value = 0.6;
      node.connect(hpf); node = hpf;
    }
    if (p.drive > 0) {
      var kd = 1 + p.drive * 10, th = Math.tanh(kd);
      var ws = c.createWaveShaper();
      ws.curve = curve(function (x) { return Math.tanh(kd * x) / th; });
      node.connect(ws); node = ws;
    }
    if (p.crush > 0) {
      var steps = Math.pow(2, p.crush - 1);
      var cs = c.createWaveShaper();
      cs.curve = curve(function (x) { return Math.round(x * steps) / steps; });
      node.connect(cs); node = cs;
    }
    var comp = c.createWaveShaper();
    comp.curve = curve(function (x) {
      var a = Math.abs(x), s = x < 0 ? -1 : 1;
      return a < 0.7 ? x : s * (0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3));
    });
    /* optional stereo position (p.pan, -1 left .. 1 right) */
    var outNode = dest;
    if (p.pan && c.createStereoPanner) {
      var pn = c.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, p.pan));
      pn.connect(dest); outNode = pn;
    }
    comp.connect(outNode);
    node.connect(comp);
    if (p.reverb > 0) {
      var cv = c.createConvolver(), wet = c.createGain();
      cv.buffer = A.ir; wet.gain.value = p.reverb;
      node.connect(cv); cv.connect(wet); wet.connect(comp);
    }
    if (p.echo > 0) {
      var dl = c.createDelay(2), fb = c.createGain(), eg = c.createGain();
      dl.delayTime.value = p.echoTime; fb.gain.value = Math.min(0.9, p.echo); eg.gain.value = 0.6;
      node.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(eg); eg.connect(comp);
    }
    for (i = 0; i < p.layers.length; i++) {
      var L = p.layers[i], n = Math.max(1, L.rep || 1);
      var ev = events(p, L, i);
      for (k = 0; k < n; k++) voice(c, A, pre, L, t0 + ev[k].t, k, ev[k]);
    }
    return t0 + duration(p);
  }

  return {
    duration: duration,
    play: function (p) {
      if (!ctx) {
        var AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      var go = function () { build(ctx, ctx.destination, p, ctx.currentTime + 0.02); };
      var names = sampleNames(p), ready = true, i;
      for (i = 0; i < names.length; i++) if (!samples[names[i]]) ready = false;
      if (ready) { go(); return Promise.resolve(); }
      return ensure(ctx, p).then(go);
    },
    preload: function (p) {
      if (!ctx) {
        var AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) return Promise.resolve();
        ctx = new AC();
      }
      return ensure(ctx, p);
    },
    setSampleBase: function (url) { sampleBase = url; },
    /* For the music engine: schedule a patch on any context at an exact time, load its samples, share the live context. */
    schedule: function (c, dest, p, when) { return build(c, dest, p, when); },
    load: function (c, p) { return ensure(c, p); },
    context: function () {
      if (!ctx) {
        var AC = W.AudioContext || W.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      return ctx;
    },
    offlineContext: function (channels, length, sr) {
      var OC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
      return new OC(channels, length, sr);
    },
    sampleNames: sampleNames,
    render: function (p, sampleRate) {
      var sr = sampleRate || 44100;
      var OC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
      var oc = new OC(1, Math.ceil(sr * duration(p)), sr);
      return ensure(oc, p).then(function () {
        build(oc, oc.destination, p, 0);
        return oc.startRendering();
      });
    }
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = makeSfx;
