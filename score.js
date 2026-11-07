/**
 * 动态配乐：WebAudio 实时合成，跟着局势变
 *
 * 接口和 bgm.js 一样（play / stop / pause / resume / setVolume / getVolume / preloadAll），
 * 游戏里原来调 BGM 的地方不用改；另外多了：
 *   BGM.scene(locId)   当前地点 → 紧张度（越近皇城越压抑）
 *   BGM.danger(0..1)   气血比例 → 低于一半加心跳
 *   BGM.corrupt(0..1)  渴染 → 越深旋律越走调
 *   BGM.sting(name)    关键时刻的短乐句：encounter / boss / kill / victory / flee / death / arrive / ending
 *
 * SOURCE 决定底乐用哪个：
 *   "synth"    全部实时合成（默认：没有版权问题，每次都不一样）
 *   "recorded" 用 assets/music 里录好的两首当底，心跳 / 走调 / 短乐句照样叠在上面
 *
 * 音色全是合成的：古琴（拨弦）、箫（气声 + 颤音）、二胡（锯齿波 + 带通 + 滑音）、
 * 战鼓、梆子、钟磬、风。音阶用 D 羽调五声（D F G A C），渴染深了掺进 E♭ 这个半音。
 */
(() => {
  const SOURCE = "synth";
  const recorded = window.BGM;            // bgm.js 先加载，留着给 "recorded" 模式用

  let ctx = null, master, musicBus, stingBus, reverb, noiseBuf;
  let targetVol = 0.45, mode = null, tension = 0, dangerLv = 0, corruptLv = 0, sceneId = null;
  let timer = null, nextAt = 0, beat = 0, lastPhraseAt = 0, lastXiaoAt = 0, lastBellAt = 0;
  const seenScenes = new Set();
  const layers = {};

  /* 地点 → 紧张度 0..4：从官道一路走进紫禁城，越走越压抑 */
  const TENSION = {
    road_inn: 0, post: 0, village: 1, temple: 1, valley: 1,
    canal: 2, gate: 2, barbican: 3, inner: 3, yamen: 3, palace: 4, throne: 4,
    lugou: 1, barracks: 1, xishan_temple: 2, caishikou: 3, yaoju: 3, gulou: 3, yuyaofang: 4,
  };

  /* 地点 → 大区：每个大区一套行路主题（旋律、乐器、密度各不同） */
  const REGION = {
    road_inn: "out", village: "out", canal: "out", temple: "out", post: "out", lugou: "out", barracks: "out",
    gate: "city", barbican: "city", inner: "city", yamen: "city", caishikou: "city", yaoju: "city", gulou: "city",
    palace: "palace", yuyaofang: "palace", throne: "palace",
    xishan_temple: "west", valley: "west",
  };
  /* 每区的主题句（五声音阶下标），轮着奏，听得出是哪一区 */
  const THEMES = {
    /* 城外：古琴为主，箫偶尔接一句，开阔、凄清 */
    out: { phrases: [[9, 10, 12, 10, 9, 7], [7, 9, 10, 9, 7, 5, 7], [12, 10, 9, 10, 7]], gap: 7, inst: "guqin", step: 0.55, xiao: true },
    /* 京城：低一个八度，二胡拖长音像呻吟，远处打更的梆子 */
    city: { phrases: [[4, 5, 4, 2, 0], [5, 7, 5, 4, 2, 4], [2, 4, 5, 4, 1]], gap: 9, inst: "erhu", step: 0.9, bangzi: true, low: true },
    /* 皇城：编钟慢敲，锣在最低处，和声里夹着小二度 */
    palace: { phrases: [[5, 7, 8, 7], [8, 10, 9, 7, 5], [3, 5, 4, 2]], gap: 11, inst: "bell", step: 1.3, gong: true, drone2: true },
    /* 西山：箫在高处长吹，冰凌一样的高音钟点，风大 */
    west: { phrases: [[12, 14, 15, 14, 12], [10, 12, 14, 12, 10, 9], [14, 15, 17, 15]], gap: 8, inst: "xiao", step: 1.1, ice: true },
  };
  let region = "out", themeAt = 0, themeIdx = 0;
  /* 战斗：normal 寻常、elite 头目（慢而重）、final 丹陛最终战 */
  let fightKind = "normal";

  /* D 羽调五声，下标 0 = D3；渴染深了用 Eb 代替 D/F 之间的音，制造不安 */
  const BASE = 146.83;
  const SCALE = [0, 3, 5, 7, 10];
  const note = (i) => {
    const oct = Math.floor(i / 5), deg = ((i % 5) + 5) % 5;
    let semi = SCALE[deg];
    if (corruptLv > 0.5 && deg === 1 && Math.random() < corruptLv - 0.3) semi = 1;   // Eb：半音的刺
    return BASE * Math.pow(2, (12 * oct + semi) / 12);
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ==================== 底层 ==================== */

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = targetVol;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
    stingBus = ctx.createGain(); stingBus.gain.value = 1.1; stingBus.connect(master);
    // 混响：衰减噪声当冲激响应，给一个空旷山谷 / 大殿的尾音
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    reverb.connect(wet); wet.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  }

  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const out = (node, bus, wet) => { node.connect(bus); if (wet) node.connect(reverb); };

  /* ==================== 乐器 ==================== */

  /** 古琴：拨弦 + 起音时往下"吟"一点，余音长 */
  function guqin(f, t, vol, dur, bus) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o1.type = "triangle"; o2.type = "sine";
    o1.frequency.setValueAtTime(f * 1.012, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    o2.frequency.setValueAtTime(f * 2.004, t);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
    env(g, t, 0.004, vol, dur);
    out(g, bus || musicBus, true);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  /** 箫：正弦 + 气声，慢起，颤音 */
  function xiao(f, t, vol, dur, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f, t);
    vib.frequency.value = 5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.5);
    vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.25); g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    // 气声
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf; bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 3;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vol * 0.25, t + 0.15); ng.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(ng); ng.connect(g);
    out(g, bus || musicBus, true);
    o.start(t); vib.start(t); n.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); n.stop(t + dur + 0.05);
  }

  /** 二胡：锯齿波过带通，起音带滑音，颤音 —— 战斗旋律和惨叫一样的高音 */
  function erhu(f, t, vol, dur, bus, fromF) {
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(fromF || f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + (fromF ? dur * 0.7 : 0.09));
    vib.frequency.value = 6.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.018, t + Math.min(0.4, dur));
    vib.connect(vg); vg.connect(o.frequency);
    bp.type = "bandpass"; bp.frequency.value = Math.min(3000, f * 2.5); bp.Q.value = 1.4;
    lp.type = "lowpass"; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.07); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(bp); bp.connect(lp); lp.connect(g);
    out(g, bus || musicBus, true);
    o.start(t); vib.start(t); o.stop(t + dur + 0.2); vib.stop(t + dur + 0.2);
  }

  /** 战鼓：低频正弦往下掉 + 一点皮面噪声 */
  function drum(t, vol, low, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(low ? 75 : 110, t); o.frequency.exponentialRampToValueAtTime(low ? 38 : 55, t + 0.35);
    env(g, t, 0.003, vol, low ? 0.9 : 0.45);
    o.connect(g); out(g, bus || musicBus, true);
    o.start(t); o.stop(t + 1);
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf; lp.type = "lowpass"; lp.frequency.value = 900;
    env(ng, t, 0.001, vol * 0.5, 0.08);
    n.connect(lp); lp.connect(ng); out(ng, bus || musicBus, false);
    n.start(t); n.stop(t + 0.15);
  }

  /** 梆子：短促清脆的木头声，打更 / 戏曲里那种 */
  function bangzi(t, vol, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    o.type = "square"; o.frequency.value = rnd(1150, 1250);
    bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 8;
    env(g, t, 0.001, vol, 0.06);
    o.connect(bp); bp.connect(g); out(g, bus || musicBus, true);
    o.start(t); o.stop(t + 0.1);
  }

  /** 钟 / 锣：不成整数倍的泛音，长尾 */
  function bell(f, t, vol, dur, bus, gong) {
    const parts = gong ? [[1, 1], [1.48, 0.6], [2.1, 0.4], [2.9, 0.25], [4.2, 0.15]] : [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]];
    parts.forEach(([r, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * r;
      if (gong) { o.frequency.setValueAtTime(f * r * 1.02, t); o.frequency.exponentialRampToValueAtTime(f * r, t + 0.6); }
      env(g, t, gong ? 0.02 : 0.005, vol * a, dur / Math.pow(r, 0.25));
      o.connect(g); out(g, bus || musicBus, true);
      o.start(t); o.stop(t + dur + 0.2);
    });
    if (gong) { const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf; lp.type = "lowpass"; lp.frequency.value = 2000; env(ng, t, 0.005, vol * 0.3, 0.6); n.connect(lp); lp.connect(ng); out(ng, bus || musicBus, true); n.start(t); n.stop(t + 0.8); }
  }

  /** 心跳：咚—咚 */
  function heartbeat(t, vol) {
    [0, 0.17].forEach((d, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(k ? 52 : 60, t + d); o.frequency.exponentialRampToValueAtTime(30, t + d + 0.18);
      env(g, t + d, 0.004, vol * (k ? 0.7 : 1), 0.22);
      o.connect(g); g.connect(musicBus);
      o.start(t + d); o.stop(t + d + 0.3);
    });
  }

  /* ==================== 持续层：持续音 + 风 ==================== */

  function startPads() {
    if (layers.drone) return;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; lp.connect(g);
    const oscs = [[BASE / 2, -6], [BASE / 2, 5], [BASE * 0.75, 0]].map(([f, det]) => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(); return o;
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.06; lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    layers.drone = { g, lp, oscs, lfo };
    // 风：带通噪声，中心频率慢慢游
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0;
    const wl = ctx.createOscillator(), wlg = ctx.createGain(); wl.frequency.value = 0.09; wlg.gain.value = 260; wl.connect(wlg); wlg.connect(bp.frequency); wl.start();
    n.connect(bp); bp.connect(wg); wg.connect(musicBus); n.start();
    layers.wind = { g: wg, n, wl };
  }

  /** 按当前模式 / 紧张度 / 危险，把持续层的音量和音色推过去 */
  function mixPads() {
    if (!layers.drone) return;
    const t = ctx.currentTime;
    const synth = SOURCE === "synth" && mode;
    const battle = mode === "battle";
    const droneVol = !synth ? 0 : battle ? 0.05 : 0.035 + tension * 0.008;
    layers.drone.g.gain.setTargetAtTime(droneVol, t, 1.2);
    layers.drone.lp.frequency.setTargetAtTime(battle ? 420 : 220 + tension * 30, t, 1.5);
    // 渴染越深，持续音越走调（两个音慢慢拉开）
    layers.drone.oscs[0].detune.setTargetAtTime(-6 - corruptLv * 40, t, 3);
    const windVol = !mode ? 0 : battle ? 0.012 : 0.03 + tension * 0.006;
    layers.wind.g.gain.setTargetAtTime(SOURCE === "synth" ? windVol : windVol * 0.4, t, 1.5);
  }

  /* ==================== 编曲：每 0.1 秒往前排 0.4 秒 ==================== */

  /* 战斗二胡音型：八个八分音符一句 */
  const BATTLE_MOTIFS = [
    [7, 7, 8, 7, 5, 5, 4, 5], [7, 9, 8, 7, 9, 10, 9, 7], [10, 9, 7, 8, 10, 12, 10, 9], [5, 7, 8, 10, 9, 7, 8, 5],
  ];
  let motif = BATTLE_MOTIFS[0], boss = false;

  function scheduler() {
    if (!ctx || !mode) return;
    const ahead = ctx.currentTime + 0.4;
    while (nextAt < ahead) {
      if (mode === "battle") scheduleBattleStep(nextAt);
      else scheduleExploreStep(nextAt);
    }
  }

  /** 探索：按大区奏各自的主题句，句与句之间留白；越紧张越低、越稀、越不和谐 */
  function playPhrase(th, t) {
    const ph = th.phrases[themeIdx % th.phrases.length];
    themeIdx++;
    const shift = (th.low ? -5 : 0) - Math.min(2, Math.floor(tension / 2));
    ph.forEach((n, k) => {
      const at = t + k * th.step * rnd(0.9, 1.1);
      const f = note(n + shift);
      const last = k === ph.length - 1;
      if (th.inst === "guqin") guqin(f, at, 0.15, last ? 3.6 : 2.6);
      else if (th.inst === "erhu") erhu(f, at, 0.05, th.step * (last ? 2.2 : 1.4), musicBus, k ? null : f * 0.9);
      else if (th.inst === "bell") bell(f, at, 0.07, last ? 6 : 4);
      else xiao(f, at, 0.07, th.step * (last ? 2.4 : 1.2));
      /* 紧张或渴染深时，偶尔贴一个小二度 */
      if ((tension >= 3 || corruptLv > 0.5) && Math.random() < 0.12) guqin(f * Math.pow(2, 1 / 12), at + 0.04, 0.06, 2);
    });
    return ph.length * th.step;
  }

  function scheduleExploreStep(t) {
    const step = 0.5;
    if (SOURCE === "synth") {
      const th = THEMES[region] || THEMES.out;
      if (t >= themeAt) {
        const len = playPhrase(th, t);
        themeAt = t + len + th.gap * rnd(0.8, 1.3) + tension * 0.8;
      }
      /* 各区的点缀 */
      if (th.xiao && t - lastXiaoAt > rnd(26, 40) && t < themeAt - 4) {
        lastXiaoAt = t;
        let i = 10 + Math.floor(rnd(-1, 2));
        [0, 1.4, 2.6].forEach((d, k) => { xiao(note(i), t + d, 0.06, k === 2 ? 2.4 : 1.3); i += pick([-1, 1, -2]); });
      }
      if (th.bangzi && beat % 24 === 0 && Math.random() < 0.7) { bangzi(t, 0.07); bangzi(t + 0.32, 0.05); }
      if (th.gong && t - lastBellAt > rnd(22, 34)) { lastBellAt = t; bell(note(0) / 4, t, 0.12, 7, musicBus, true); }
      if (th.ice && Math.random() < 0.025) bell(note(20 + Math.floor(rnd(0, 4))), t, 0.025, 2.5);
      if (!th.gong && t - lastBellAt > rnd(30, 52)) { lastBellAt = t; bell(note(5) / 2, t, 0.045 + tension * 0.01, 6); }
      /* 深处：远处的闷鼓，像什么东西在走动 */
      if (tension >= 3 && beat % 8 === 0 && Math.random() < 0.5) { drum(t, 0.12, true); drum(t + 0.55, 0.08, true); }
    }
    if (dangerLv > 0 && beat % Math.max(2, Math.round(4 - dangerLv * 2)) === 0) heartbeat(t, 0.25 + dangerLv * 0.35);
    beat++;
    nextAt = t + step;
  }

  /** 战斗：十六分音符网格，140 拍（首领 156）。太鼓切分 + 小节尾滚奏，梆子打反拍，二胡八分音型两小节一换，四小节一声锣 */
  const BATTLE_KICK = [0, 3, 6, 8, 10, 11, 14];
  /* 头目战：慢而重，每小节一声锣，二胡压低；最终战：最快，太鼓加倍 */
  const ELITE_KICK = [0, 6, 8, 12];
  function scheduleBattleStep(t) {
    if (fightKind === "elite") return scheduleEliteStep(t);
    const bpm = boss ? 156 : 140, step = 60 / bpm / 4;
    const s = beat % 16;
    const bar = Math.floor(beat / 16);
    if (SOURCE === "synth") {
      if (s === 0 && bar % 4 === 0) bell(note(0) / 4, t, boss ? 0.22 : 0.15, 3.5, musicBus, true);
      if (BATTLE_KICK.includes(s)) drum(t, s % 8 === 0 ? 0.46 : 0.3, s % 4 === 0);
      if (s >= 12 && bar % 2 === 1) drum(t, 0.14 + (s - 12) * 0.03, false);   // 小节尾滚奏
      if (boss && s % 4 === 2) drum(t, 0.2, true);
      if (s % 4 === 2) bangzi(t, s === 14 ? 0.13 : 0.08);
      if (s % 2 === 0) {
        const k = (s / 2 + (bar % 2) * 8) % motif.length;
        const i = motif[k] + (boss ? -5 : 0);
        erhu(note(i), t, s % 4 === 0 ? 0.1 : 0.075, step * 1.7, musicBus);
      }
      if (s === 15 && bar % 2 === 1) motif = pick(BATTLE_MOTIFS);
    }
    if (dangerLv > 0 && s % 8 === 0) heartbeat(t, 0.2 + dangerLv * 0.3);
    beat++;
    nextAt = t + step;
  }

  function scheduleEliteStep(t) {
    const step = 60 / 112 / 4;
    const s = beat % 16;
    const bar = Math.floor(beat / 16);
    if (SOURCE === "synth") {
      if (s === 0) bell(note(0) / 4, t, 0.16, 3.2, musicBus, true);
      if (ELITE_KICK.includes(s)) drum(t, s === 0 ? 0.55 : 0.38, true);
      if (s === 14 || s === 15) drum(t, 0.2, false);
      if (s % 8 === 4) bangzi(t, 0.1);
      if (s % 4 === 0) {
        const k = (s / 4 + (bar % 2) * 4) % motif.length;
        erhu(note(motif[k] - 5), t, 0.1, step * 3.6, musicBus);
      }
      if (s === 15 && bar % 2 === 1) motif = pick(BATTLE_MOTIFS);
    }
    if (dangerLv > 0 && s % 8 === 0) heartbeat(t, 0.2 + dangerLv * 0.3);
    beat++;
    nextAt = t + step;
  }

  /* ==================== 短乐句 ==================== */

  const STINGS = {
    encounter(t) { bell(note(0) / 2, t, 0.35, 4, stingBus, true); erhu(note(12), t + 0.05, 0.12, 0.9, stingBus, note(7)); drum(t, 0.5, true, stingBus); },
    boss(t) { [0, 0.45, 0.9].forEach((d) => drum(t + d, 0.55, true, stingBus)); bell(note(0) / 4, t, 0.45, 6, stingBus, true); erhu(note(13), t + 1.0, 0.13, 1.4, stingBus, note(8)); },
    kill(t) { drum(t, 0.5, true, stingBus); guqin(note(5), t + 0.02, 0.18, 1.6, stingBus); guqin(note(7), t + 0.04, 0.15, 1.6, stingBus); },
    victory(t) { bell(note(10), t, 0.16, 4, stingBus); [8, 9, 10, 12].forEach((i, k) => xiao(note(i), t + 0.3 + k * 0.45, 0.09, k === 3 ? 2 : 0.5, stingBus)); },
    flee(t) { [0, 0.18, 0.36].forEach((d, k) => bangzi(t + d, 0.15 - k * 0.03, stingBus)); },
    death(t) { bell(note(0) / 4, t, 0.5, 9, stingBus, true); erhu(note(2), t + 0.3, 0.12, 2.6, stingBus, note(9)); },
    arrive(t) { bell(note(5), t, 0.1, 4, stingBus); [5, 7, 9].forEach((i, k) => guqin(note(i), t + 0.2 + k * 0.18, 0.12, 2.5, stingBus)); },
    ending(t) { [0, 2.2, 4.4].forEach((d) => bell(note(0) / 2, t + d, 0.3, 6, stingBus)); },
  };

  function sting(name) {
    if (!ctx || !STINGS[name]) return;
    STINGS[name](ctx.currentTime + 0.03);
  }

  /* ==================== 对外接口（兼容 bgm.js） ==================== */

  function play(name, opts) {
    if (!init()) return Promise.resolve();
    if (name === mode) return Promise.resolve();
    const prev = mode;
    mode = name;
    startPads();
    if (SOURCE === "recorded" && recorded) recorded.play(name, opts);
    // 换场：保留一点余音，从下一拍重新排
    beat = 0; nextAt = ctx.currentTime + 0.15; lastPhraseAt = ctx.currentTime;
    if (name === "battle") { motif = pick(BATTLE_MOTIFS); }
    if (name === "explore") themeAt = ctx.currentTime + 2.5;
    if (prev === "battle" && name === "explore") lastBellAt = ctx.currentTime;   // 刚打完别马上来钟
    mixPads();
    if (!timer) timer = setInterval(scheduler, 100);
    return Promise.resolve();
  }

  function stop({ fade = 600 } = {}) {
    if (recorded && SOURCE === "recorded") recorded.stop({ fade });
    mode = null;
    if (ctx) mixPads();
    return new Promise((r) => setTimeout(r, fade));
  }
  function pause() { if (ctx) ctx.suspend(); if (recorded && SOURCE === "recorded") recorded.pause(); }
  function resume() { if (ctx) ctx.resume(); if (recorded && SOURCE === "recorded") recorded.resume(); }
  function setVolume(v) {
    targetVol = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.1);
    if (recorded) recorded.setVolume(v);
  }
  function getVolume() { return targetVol; }
  function preloadAll() { return SOURCE === "recorded" && recorded ? recorded.preloadAll() : Promise.resolve(); }

  function scene(id) {
    if (id === sceneId) return;
    sceneId = id;
    /* 换了大区：下一句马上用新主题 */
    const r = REGION[id] || region;
    if (r !== region) { region = r; themeIdx = 0; if (ctx) themeAt = ctx.currentTime + 1.5; }
    const nt = TENSION[id] !== undefined ? TENSION[id] : tension;
    // 第一次到一个新地方：来一句"到了"
    if (ctx && mode === "explore" && !seenScenes.has(id) && seenScenes.size > 0) sting("arrive");
    seenScenes.add(id);
    tension = nt;
    if (ctx) mixPads();
  }
  /** 和游戏里"气血告急"的红框同一个门槛（低于一半）；越低心跳越快越响 */
  function danger(hpFrac) {
    dangerLv = hpFrac <= 0 || hpFrac >= 0.5 ? 0 : Math.min(1, (0.5 - hpFrac) / 0.4 + 0.15);
  }
  function corrupt(frac) {
    corruptLv = Math.max(0, Math.min(1, frac));
    if (ctx) mixPads();
  }
  function setBoss(b) { boss = !!b; if (boss) fightKind = "final"; }
  /** normal / elite / final */
  function setFight(kind) { fightKind = kind || "normal"; boss = kind === "final"; }

  /* 浏览器要求用户手势之后才能出声：第一次点击 / 按键时初始化，并补上当前的底乐 */
  const unlock = () => {
    if (!init()) return;
    document.removeEventListener("pointerdown", unlock, { capture: true });
    document.removeEventListener("keydown", unlock, { capture: true });
    if (ctx.state === "suspended") ctx.resume();
    if (mode) { const m = mode; mode = null; play(m); }
  };
  document.addEventListener("pointerdown", unlock, { capture: true });
  document.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("visibilitychange", () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });

  window.BGM = { play, stop, pause, resume, setVolume, getVolume, preloadAll, scene, danger, corrupt, sting, setBoss, setFight, SOURCE };
})();
