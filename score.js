/**
 * 动态配乐：用 SFX Brew 的东方配乐引擎（vendor/sfxbrew-music.js）实时作曲，跟着局势变。
 *
 * 乐器全是 SFX Brew 的：古琴（拨弦模型）、琵琶、竹笛、木鱼、钟是合成的；二胡、弦乐组（大中小提琴，铺底和跳弓）、大鼓、锣是录音多采样。
 * 每一段都是按五声调式现场作曲，循环一遍换一遍伴奏，不会原样重复。
 *
 * 接口和原来一样，游戏里调 BGM 的地方不用改：
 *   BGM.play("explore" | "battle")      底乐
 *   BGM.scene(locId)                    地点 → 大区主题（城外 / 京城 / 皇城 / 西山）
 *   BGM.setFight("normal"|"elite"|"final")  战斗分三档
 *   BGM.danger(0..1)  气血比例 → 低于一半加心跳鼓
 *   BGM.corrupt(0..1) 心火 → 深了换更阴的调式
 *   BGM.sting(name)   短乐句：encounter / boss / kill / victory / flee / death / arrive / ending
 * 旧的手写合成版备份在 art/backup/pre-onboard/score.js。
 */
/** 编曲和短乐句：游戏（下面）和导出试听的 tools/render-music.js 共用同一份 */
function scoreData(music) {
  const I = music.instruments;
  /* 地点 → 大区 */
  const REGION = {
    road_inn: "out", village: "out", canal: "out", temple: "out", post: "out", lugou: "out", barracks: "out",
    gate: "city", barbican: "city", inner: "city", yamen: "city", caishikou: "city", yaoju: "city", gulou: "city",
    palace: "palace", yuyaofang: "palace", throne: "palace",
    xishan_temple: "west", valley: "west",
  };

  /* 每个场合一份编曲：调式、主音（MIDI）、速度、乐器、密度。种子固定，同一区的主题每次来都认得出 */
  const SPECS = {
    /* 每首单独定性格：曲式、拍子、主奏、伴奏织体都不同，免得几首听起来一个样。
       form 是 SFX Brew 的曲式模板（journey 行旅 / ballad 叙事 / arch 拱形 / temple 散板开合 / battle / siege），
       数组表示每循环一遍换一个；meter 3 是三拍子；texture 是弹拨伴奏的走法（arp 分解和弦 / block 拍点 / pulse 低音心跳 / none） */
    /* 城外：竹笛领奏、古琴轻轻分解和弦，二段换二胡；行旅曲式，中段落到只剩弦乐再重新起来 */
    out: { preset: "calm", form: ["journey", "rondo"], mode: "yu", root: 50, tempo: 66, melody: "flute", melodyB: "erhu", accomp: "guqin", texture: "arp", texture2: "none", bass: "cello", strings: 0.55, perc: "none", sparkle: true, density: 0.4, reverb: 0.55, seed: 11 },
    /* 京城：三拍子的二胡叙事，开头散板，木鱼像远处打更 */
    city: { preset: "sad", form: "ballad", meter: 3, mode: "yu", root: 45, tempo: 72, melody: "erhu", melodyB: "flute", freeLead: "erhu", accomp: "guqin", texture: "arp", texture2: "pulse", bass: "cello", strings: 0.65, perc: "woodfish", density: 0.35, reverb: 0.5, seed: 23 },
    /* 皇城：古琴慢弹，底下大提琴低低地跳，像心跳；拱形曲式，中间推到最高 */
    palace: { preset: "mystery", form: "arch", mode: "shang", root: 48, tempo: 52, melody: "guqin", melodyB: "erhu", accomp: "none", texture: "pulse", texture2: "pulse", bass: "cello", strings: 0.5, perc: "woodfish", sparkle: false, density: 0.3, reverb: 0.65, seed: 37 },
    /* 西山：竹笛散板起、散板收，五声和声，几乎没有节拍感 */
    west: { preset: "mystery", form: "temple", harmony: "penta", mode: "shang", root: 52, tempo: 58, melody: "flute", melodyB: "guqin", freeLead: "flute", accomp: "none", texture: "none", bass: "cello", strings: 0.5, perc: "woodfish", density: 0.28, reverb: 0.7, seed: 41 },
    /* 战斗：都节调旋律（1 ♭2 4 5 ♭6）配弗里几亚和声（i 和 ♭II 来回磨），大提琴低音死压主音；
       二胡在中低音区往下坠，琵琶只在低音区闷弹不轮指，大鼓疏而沉，锣只在高潮砸，高处一根三全音的小提琴长音 */
    normal: { preset: "battle", form: "battle", mode: "miyako", harmony: "dark", dark: true, pedal: true, root: 45, tempo: 106,
      melody: "erhu", melodyB: "pipa", registerB: 3, accomp: "none", ostinato: "spic", ostinatoPat: "grind", strings: 0.65, density: 0.5, reverb: 0.4, seed: 5 },
    /* 头目：三拍子，更慢更沉，低一个全音 */
    elite: { preset: "battle", form: "siege", meter: 3, mode: "miyako", harmony: "dark", dark: true, pedal: true, root: 43, tempo: 88,
      melody: "erhu", melodyB: "erhu", accomp: "none", ostinato: "spic", ostinatoPat: "grind", strings: 0.7, density: 0.42, reverb: 0.45, seed: 9 },
    /* 丹陛最终战：最急，二胡和低音琵琶在高潮里叠起来 */
    final: { preset: "battle", form: ["siege", "battle"], mode: "miyako", harmony: "dark", dark: true, pedal: true, root: 44, tempo: 120,
      melody: "erhu", melodyB: "pipa", registerB: 3, accomp: "none", ostinato: "spic", ostinatoPat: "grind", strings: 0.7, density: 0.62, reverb: 0.4, seed: 13 },
  };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const D = { mode: "yu", root: 50 };
  const deg = (d) => hz(music.midiOf(D, d));
  const STINGS = {
    encounter: () => [{ t: 0, p: I.drum("drum-center-loud", 0.9, -3) }, { t: 0.05, p: I.erhu(deg(7), 0.9, 0.8, -3) }],
    boss: () => [{ t: 0, p: I.drum("drum-center-loud", 1, -4) }, { t: 0.45, p: I.drum("drum-center-loud", 1, -4) }, { t: 0.9, p: I.drum("drum-edge-loud", 1, -3) }, { t: 1.0, p: I.gong(0.9, -4) }],
    kill: () => [{ t: 0, p: I.drum("drum-rim", 0.6, -1) }, { t: 0.02, p: I.pipa(deg(5), 0.3, 0.6) }, { t: 0.1, p: I.pipa(deg(7), 0.4, 0.6) }],
    victory: () => [{ t: 0, p: I.drum("drum-edge-loud", 0.7, -2) }, ...[5, 7, 8, 10].map((d, i) => ({ t: 0.15 + i * 0.16, p: I.guqin(deg(d), 1.2, 0.8) })), { t: 0.85, p: I.bell(deg(5) / 2, 3, 0.5) }],
    flee: () => [0, 0.16, 0.32].map((t, i) => ({ t, p: I.woodfish(0.8 - i * 0.2) })),
    death: () => [{ t: 0, p: I.gong(0.9, -6) }, ...[9, 7, 5, 3].map((d, i) => ({ t: 0.3 + i * 0.42, p: I.guqin(deg(d), 1.6, 0.7) })), { t: 1.4, p: I.erhu(deg(2), 2.4, 0.7, -2) }],
    arrive: () => [{ t: 0, p: I.bell(deg(10), 3, 0.35) }, ...[5, 7, 8].map((d, i) => ({ t: 0.25 + i * 0.2, p: I.guqin(deg(d), 1.4, 0.55) }))],
    ending: () => [0, 2.2, 4.4].map((t) => ({ t, p: I.bell(deg(0) / 2, 5, 0.7) })),
  };
  return { REGION, SPECS, STINGS };
}

typeof document !== "undefined" && (() => {
  /* makeSfx 的参数会被当成 window 用，所以不传参，素材目录另外设 */
  const sfx = makeSfx();
  sfx.setSampleBase("assets/sfxbrew/");
  const music = makeMusic(sfx);
  const I = music.instruments;
  const { REGION, SPECS, STINGS } = scoreData(music);

  let targetVol = 0.45, mode = null, sceneId = null, region = "out", fightKind = "normal";
  let dangerLv = 0, corruptLv = 0, unlocked = false, current = null, beatTimer = null;
  const seenScenes = new Set();


  function specFor(name) {
    const key = name === "battle" ? fightKind : region;
    const sp = Object.assign({}, SPECS[key] || SPECS.out);
    /* 心火到了「狂」：行路的曲子换成角调，听着走了样 */
    const corr = name !== "battle" && corruptLv >= 0.67;
    if (corr) { sp.mode = "jue"; sp.humanize = 0.95; }
    return { key: name + ":" + key + (corr ? ":corr" : ""), sp };
  }

  let startTimer = null;
  function restart() {
    if (!unlocked || !mode) return;
    const { key, sp } = specFor(mode);
    if (current === key) return;
    const fromBattle = current && current.startsWith("battle:") && mode === "explore";
    current = key;
    clearTimeout(startTimer);
    if (fromBattle) {
      /* 打完了：战斗曲慢慢淡下去，静一会儿再起行路的曲子 */
      music.stop(4);
      startTimer = setTimeout(() => { if (current === key) music.start(sp, { volume: targetVol * 1.4 }); }, 2600);
      return;
    }
    music.start(sp, { volume: targetVol * 1.4 });
  }

  /* ---------- 短乐句和心跳走同一条总线 ---------- */
  let sBus = null;
  function stingBus() {
    const c = sfx.context();
    if (!sBus || sBus.ctx !== c) {
      sBus = music.bus(c, 0.4, targetVol * 1.6);
      sBus.out.connect(c.destination);
      sBus.ctx = c;
    }
    return sBus;
  }

  /* 心跳：气血低于一半时叠一层闷鼓，越低越快 */
  function heartbeat() {
    clearTimeout(beatTimer);
    if (!unlocked || dangerLv <= 0) return;
    const c = sfx.context();
    if (c && c.state === "running") {
      const b = stingBus();
      const t = c.currentTime + 0.02;
      const v = 0.35 + dangerLv * 0.5;
      sfx.schedule(c, b.in(0.25), I.drum("drum-center-soft", v, -9), t);
      sfx.schedule(c, b.in(0.25), I.drum("drum-center-soft", v * 0.7, -10), t + 0.24);
    }
    beatTimer = setTimeout(heartbeat, 1100 - dangerLv * 450);
  }

  function sting(name) {
    if (!unlocked || !STINGS[name]) return;
    const c = sfx.context();
    if (!c) return;
    const ev = STINGS[name]();
    const b = stingBus();
    const names = [];
    ev.forEach((e) => e.p.layers.forEach((l) => { if (l.type === "sample" && !names.includes(l.sample)) names.push(l.sample); }));
    sfx.load(c, { layers: names.map((n) => ({ type: "sample", sample: n })) }).then(() => {
      const t0 = c.currentTime + 0.03;
      ev.forEach((e) => sfx.schedule(c, b.inFor(e.p), e.p, t0 + e.t));
    });
  }

  /* ---------- 对外接口 ---------- */
  function play(name) {
    mode = name;
    restart();
    return Promise.resolve();
  }
  function stop({ fade = 600 } = {}) {
    mode = null; current = null;
    clearTimeout(startTimer);
    music.stop(fade / 1000);
    return new Promise((r) => setTimeout(r, fade));
  }
  function pause() { const c = sfx.context(); if (c) c.suspend(); }
  function resume() { const c = sfx.context(); if (c && unlocked) c.resume(); }
  function setVolume(v) {
    targetVol = Math.max(0, Math.min(1, v));
    music.volume(targetVol * 1.4);
    if (sBus) sBus.out.gain.setTargetAtTime(targetVol * 1.6, sBus.ctx.currentTime, 0.1);
  }
  function getVolume() { return targetVol; }
  /* 录音素材很小，解锁后一起拉下来，免得第一次开战鼓声晚到 */
  function preloadAll() {
    if (!unlocked) return Promise.resolve();
    const c = sfx.context();
    if (!c) return Promise.resolve();
    const names = ["drum-center-loud", "drum-center-soft", "drum-edge-loud", "drum-rim", "erhu-d3", "erhu-f5", "gong-1"];
    return sfx.load(c, { layers: names.map((n) => ({ type: "sample", sample: n })) }).catch(() => {});
  }
  function scene(id) {
    if (id === sceneId) return;
    sceneId = id;
    const r = REGION[id] || region;
    if (unlocked && mode === "explore" && !seenScenes.has(id) && seenScenes.size > 0) sting("arrive");
    seenScenes.add(id);
    if (r !== region) { region = r; if (mode === "explore") restart(); }
  }
  function danger(hpFrac) {
    const was = dangerLv;
    dangerLv = hpFrac <= 0 || hpFrac >= 0.5 ? 0 : Math.min(1, (0.5 - hpFrac) / 0.4 + 0.15);
    if (dangerLv > 0 && was === 0) heartbeat();
  }
  function corrupt(frac) {
    corruptLv = Math.max(0, Math.min(1, frac));
    if (mode === "explore") restart();
  }
  function setFight(kind) { fightKind = kind || "normal"; if (mode === "battle") restart(); }
  function setBoss(b) { if (b) setFight("final"); }

  /* 浏览器要求用户手势之后才能出声：第一次点击 / 按键时解锁，补上当前的底乐 */
  const unlock = () => {
    const c = sfx.context();
    if (!c) return;
    document.removeEventListener("pointerdown", unlock, { capture: true });
    document.removeEventListener("keydown", unlock, { capture: true });
    unlocked = true;
    if (c.state === "suspended") c.resume();
    preloadAll();
    current = null;
    restart();
    if (dangerLv > 0) heartbeat();
  };
  document.addEventListener("pointerdown", unlock, { capture: true });
  document.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("visibilitychange", () => { document.hidden ? pause() : resume(); });

  window.BGM = { play, stop, pause, resume, setVolume, getVolume, preloadAll, scene, danger, corrupt, sting, setBoss, setFight, SOURCE: "sfxbrew", region: () => region };
})();
if (typeof module !== "undefined" && module.exports) module.exports = scoreData;
