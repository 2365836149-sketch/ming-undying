/** 程序生成短音效（Web Audio，无外部音频文件） */

const SFX = (() => {
  let ctx = null;
  let master = null;
  let unlocked = false;
  let muted = false;
  let sfxVolume = 0.22; /* SFX 主音量，可由设置面板调节 */
  let reverb = null;
  let reverbWet = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : sfxVolume;
    /* 总线压缩：把多 osc 叠加后的瞬态压平，避免削顶，整体更"贴" */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 24;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  /** 程序生成衰减噪声 impulse response，模拟房间/室外混响尾巴 */
  function makeReverbIR(c, duration = 1.5, decay = 2.6, lowpass = 3200) {
    const rate = c.sampleRate;
    const len = Math.max(1, Math.floor(rate * duration));
    const ir = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      /* 一阶低通状态变量（高频先衰减、低频拖尾长） */
      let lp = 0;
      const k = 1 - Math.exp(-1 / (rate / lowpass));
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        const white = Math.random() * 2 - 1;
        lp += (white - lp) * k;
        data[i] = lp * env;
      }
    }
    return ir;
  }

  /** 懒加载混响总线，wet 信号回 master */
  function ensureReverb() {
    if (reverb) return reverb;
    const c = ensure();
    if (!c) return null;
    reverb = c.createConvolver();
    reverb.buffer = makeReverbIR(c, 1.6, 2.8, 3000);
    reverbWet = c.createGain();
    reverbWet.gain.value = 0.34;
    reverb.connect(reverbWet);
    reverbWet.connect(master);
    return reverb;
  }

  /** 把某节点按 amount（0~1）送一份到混响总线 */
  function sendToReverb(node, amount = 0.6) {
    const r = ensureReverb();
    if (!r) return;
    const send = ctx.createGain();
    send.gain.value = amount;
    node.connect(send);
    send.connect(r);
  }

  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    if (!unlocked) {
      unlocked = true;
      /* 首次解锁后异步预加载所有采样，不阻塞交互 */
      preloadAll().catch(() => {});
    }
  }

  function bindUnlock() {
    const once = () => {
      unlock();
      document.removeEventListener("pointerdown", once, true);
      document.removeEventListener("keydown", once, true);
    };
    document.addEventListener("pointerdown", once, true);
    document.addEventListener("keydown", once, true);
  }

  function now() {
    return (ensure() && ctx.currentTime) || 0;
  }

  function envGain(t0, a, d, s, r, peak = 1) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * s), t0 + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
    return g;
  }

  function tone(freq, dur, type, peak, slideTo) {
    if (muted || !ensure() || !unlocked) return;
    const t0 = now();
    const o = ctx.createOscillator();
    const g = envGain(t0, 0.01, dur * 0.35, 0.35, dur * 0.55, peak);
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, peak, hpFreq, type) {
    if (muted || !ensure() || !unlocked) return;
    const t0 = now();
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type || "bandpass";
    filter.frequency.value = hpFreq || 1200;
    filter.Q.value = type === "lowpass" ? 0.5 : 0.7;
    const g = envGain(t0, 0.003, dur * 0.18, 0.28, dur * 0.72, peak);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /**
   * 写实模拟合成器风格枪声（detune 叠加 + FM 共振 + 滤波包络扫频 + sub bass + 程序混响）
   * 分层：① 低频冲击（sub bass detune）② 火药爆燃（宽频噪声扫低通）
   *       ③ 高频 crack（极短高通脆裂）④ 枪管共振（FM 合成金属感）
   *       ⑤ 远场尾巴（衰减带通噪声，大量送混响）
   */
  function playExplosionGunshot(heavy) {
    if (muted || !ensure() || !unlocked) return;
    const c = ctx;
    const t0 = now();

    /* ① sub bass：两个 detune sine 叠加，软 attack，厚实低频冲击 */
    const subFreq = heavy ? 48 : 58;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(subFreq, t0);
      o.frequency.exponentialRampToValueAtTime(subFreq * 0.55, t0 + 0.18);
      o.detune.value = i === 0 ? -8 : 7; /* ±detune，模拟合成器厚音色 */
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(heavy ? 0.42 : 0.32, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g);
      g.connect(master);
      sendToReverb(g, 0.5);
      o.start(t0);
      o.stop(t0 + 0.28);
    }

    /* ② 火药爆燃：白噪声经低通，cutoff 从亮扫到暗（火药从喷射到熄灭） */
    const len1 = Math.floor(c.sampleRate * 0.15);
    const buf1 = c.createBuffer(1, len1, c.sampleRate);
    const d1 = buf1.getChannelData(0);
    for (let i = 0; i < len1; i++) d1[i] = Math.random() * 2 - 1;
    const src1 = c.createBufferSource();
    src1.buffer = buf1;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2800, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 0.14);
    lp.Q.value = 0.6;
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime(heavy ? 0.38 : 0.28, t0 + 0.003);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    src1.connect(lp);
    lp.connect(g1);
    g1.connect(master);
    sendToReverb(g1, 0.7);
    src1.start(t0);
    src1.stop(t0 + 0.18);

    /* ③ 高频 crack：极短高通噪声脆响，火帽击发瞬间 */
    const len2 = Math.floor(c.sampleRate * 0.05);
    const buf2 = c.createBuffer(1, len2, c.sampleRate);
    const d2 = buf2.getChannelData(0);
    for (let i = 0; i < len2; i++) d2[i] = Math.random() * 2 - 1;
    const src2 = c.createBufferSource();
    src2.buffer = buf2;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2400;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(heavy ? 0.22 : 0.16, t0 + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    src2.connect(hp);
    hp.connect(g2);
    g2.connect(master);
    src2.start(t0);
    src2.stop(t0 + 0.06);

    /* ④ 枪管共振：FM 合成（carrier 被 modulator 调频），金属管共鸣 */
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    car.type = "sine";
    mod.type = "sine";
    car.frequency.setValueAtTime(380, t0);
    car.frequency.exponentialRampToValueAtTime(140, t0 + 0.12);
    mod.frequency.setValueAtTime(620, t0);
    modGain.gain.setValueAtTime(heavy ? 380 : 280, t0);
    modGain.gain.exponentialRampToValueAtTime(40, t0 + 0.1);
    mod.connect(modGain);
    modGain.connect(car.frequency);
    const gCar = c.createGain();
    gCar.gain.setValueAtTime(0.0001, t0);
    gCar.gain.exponentialRampToValueAtTime(heavy ? 0.18 : 0.13, t0 + 0.005);
    gCar.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    car.connect(gCar);
    gCar.connect(master);
    sendToReverb(gCar, 0.6);
    car.start(t0);
    mod.start(t0);
    car.stop(t0 + 0.2);
    mod.stop(t0 + 0.2);

    /* ⑤ 远场尾巴：衰减带通噪声，几乎全送混响，形成回响 */
    const len3 = Math.floor(c.sampleRate * 0.3);
    const buf3 = c.createBuffer(1, len3, c.sampleRate);
    const d3 = buf3.getChannelData(0);
    for (let i = 0; i < len3; i++) {
      const env = Math.pow(1 - i / len3, 2.5);
      d3[i] = (Math.random() * 2 - 1) * env;
    }
    const src3 = c.createBufferSource();
    src3.buffer = buf3;
    const bp3 = c.createBiquadFilter();
    bp3.type = "bandpass";
    bp3.frequency.value = 700;
    bp3.Q.value = 0.5;
    const g3 = c.createGain();
    g3.gain.value = heavy ? 0.12 : 0.08;
    src3.connect(bp3);
    bp3.connect(g3);
    g3.connect(master);
    sendToReverb(g3, 1.0);
    src3.start(t0 + 0.02);
    src3.stop(t0 + 0.32);
  }

  function synthPlay(name) {
    if (muted) return;
    unlock();
    switch (name) {
      case "ui":
        tone(520, 0.06, "triangle", 0.18, 380);
        break;
      case "search":
        tone(220, 0.08, "sine", 0.1, 260);
        noiseBurst(0.05, 0.06, 800);
        break;
      case "search_done":
        tone(340, 0.1, "triangle", 0.2, 480);
        setTimeout(() => tone(520, 0.12, "sine", 0.16, 620), 70);
        break;
      case "search_cancel":
        tone(280, 0.1, "sine", 0.12, 160);
        break;
      case "slash_whoosh":
        noiseBurst(0.14, 0.2, 1800);
        tone(180, 0.12, "sawtooth", 0.08, 90);
        break;
      case "slash_hit":
        noiseBurst(0.09, 0.28, 900);
        tone(140, 0.1, "square", 0.14, 70);
        tone(90, 0.16, "sine", 0.18, 55);
        break;
      case "slash_whiff":
        noiseBurst(0.1, 0.1, 2400);
        tone(320, 0.08, "triangle", 0.08, 180);
        break;
      case "wound":
        tone(110, 0.08, "sawtooth", 0.1, 70);
        noiseBurst(0.07, 0.12, 600);
        break;
      case "enemy_hit":
        noiseBurst(0.11, 0.22, 700);
        tone(95, 0.14, "square", 0.12, 50);
        break;
      case "kill":
        tone(160, 0.12, "sine", 0.16, 90);
        setTimeout(() => tone(90, 0.2, "triangle", 0.14, 50), 90);
        noiseBurst(0.16, 0.18, 500);
        break;
      case "footstep": {
        const t0 = now();
        if (muted || !ensure() || !unlocked) break;
        noiseBurst(0.035, 0.09, 160);
        tone(62 + Math.random() * 12, 0.055, "sine", 0.1, 36);
        /* 轻点地：极短低频 */
        const o = ctx.createOscillator();
        const g = envGain(t0, 0.002, 0.02, 0.2, 0.05, 0.07);
        o.type = "triangle";
        o.frequency.setValueAtTime(48, t0);
        o.frequency.exponentialRampToValueAtTime(28, t0 + 0.06);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + 0.08);
        break;
      }
      case "roar": {
        if (muted || !ensure() || !unlocked) break;
        const t0 = now();
        /* 嘶吼：噪声带 + 锯齿下滑 */
        noiseBurst(0.42, 0.26, 780);
        setTimeout(() => noiseBurst(0.22, 0.16, 420), 120);
        tone(380, 0.38, "sawtooth", 0.2, 85);
        tone(210, 0.45, "square", 0.11, 48);
        const o = ctx.createOscillator();
        const g = envGain(t0, 0.02, 0.12, 0.45, 0.32, 0.16);
        o.type = "sawtooth";
        o.frequency.setValueAtTime(520, t0);
        o.frequency.exponentialRampToValueAtTime(70, t0 + 0.48);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + 0.55);
        break;
      }
      case "bag_open":
        tone(240, 0.07, "triangle", 0.12, 300);
        tone(360, 0.09, "sine", 0.1, 420);
        break;
      case "bag_place":
        tone(400, 0.05, "triangle", 0.12, 280);
        noiseBurst(0.04, 0.08, 1400);
        break;
      case "aim_beep": {
        /* 0.8s 内四声轻滴，对准星闪烁 */
        if (muted || !ensure() || !unlocked) break;
        const t0 = now();
        const n = (typeof FIREARM !== "undefined" && FIREARM.aimFlashCount) || 4;
        const span = ((typeof FIREARM !== "undefined" && FIREARM.aimFlashMs) || 800) / 1000;
        const step = span / n;
        for (let i = 0; i < n; i++) {
          const t = t0 + i * step;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(1040, t);
          o.frequency.exponentialRampToValueAtTime(880, t + 0.045);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.075, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          o.connect(g);
          g.connect(master);
          o.start(t);
          o.stop(t + 0.07);
        }
        break;
      }
      case "gunshot":
        playExplosionGunshot(true);
        break;
      case "gunshot_miss":
        playExplosionGunshot(false);
        break;
      case "loot":
        tone(480, 0.08, "sine", 0.14, 620);
        setTimeout(() => tone(720, 0.1, "triangle", 0.12, 880), 60);
        break;
      default:
        break;
    }
  }

  /* ========== 采样回放系统（真实音频文件，优先于合成） ========== */
  const sampleCache = new Map(); /* name -> AudioBuffer */
  const sampleLoading = new Map(); /* name -> Promise<AudioBuffer> */
  const SAMPLE_BASE = "assets/sfx/";

  /* sfx 名称 -> 文件名。把对应文件放到 assets/sfx/ 下即可生效。
     找不到时自动降级到 synthPlay 合成 fallback。
     footstep 用多变体随机播放（footstep_1..4），避免单一声音呆板。
     aim_beep 不放采样，保留旧合成版（电子滴声更贴合 UI 闪烁）。 */
  const SAMPLE_FILES = {
    gunshot: "gunshot.mp3", /* 重枪，命中 */
    gunshot_miss: "gunshot_miss.mp3", /* 轻枪，打偏 */
    slash_whoosh: "slash_whoosh.mp3", /* 刀风（斩击出手） */
    slash_hit: "slash_hit.mp3", /* 砍中 */
    slash_whiff: "slash_whiff.mp3", /* 砍空 */
    wound: "wound.mp3", /* 玩家受伤 */
    enemy_hit: "enemy_hit.mp3", /* 敌人被击 */
    kill: "kill.mp3", /* 击杀 */
    roar: "roar.mp3", /* 嘶吼（1.5s 短版） */
    ui: "ui.mp3", /* UI 点击 */
    search: "search.mp3", /* 搜索中滴答 */
    search_done: "search_done.mp3", /* 搜索完成 */
    search_cancel: "search_cancel.mp3", /* 搜索取消 */
    bag_open: "bag_open.mp3", /* 开背包 */
    bag_place: "bag_place.mp3", /* 放物品 */
    loot: "loot.mp3", /* 拾取 */
    /* 以下取自 Kenney RPG Audio / Interface Sounds（CC0，见 CREDITS.md） */
    pick_up: "pick_up.mp3", /* 拿起物品 */
    drop_item: "drop_item.mp3", /* 放到地上 / 丢弃 */
    rotate: "rotate.mp3", /* 旋转 */
    shove: "shove.mp3", /* 挤开别的东西 */
    armor_cloth: "armor_cloth.mp3", /* 穿布甲 */
    armor_metal: "armor_metal.mp3", /* 穿铁甲、戴铁盔 */
    rack: "rack.mp3", /* 兵器上架 */
    reload_click: "reload_click.mp3", /* 装填完毕 */
    gun_empty: "gun_empty.mp3", /* 空膛 */
    evidence: "evidence.mp3", /* 证物入袋 */
    book_open: "book_open.mp3", /* 翻开图鉴 */
    book_close: "book_close.mp3",
    trade: "trade.mp3", /* 交易递东西 */
    brew: "brew.mp3", /* 熬药 */
    creak: "creak.mp3", /* 掀地窖板 */
    door_open: "door_open.mp3",
    door_close: "door_close.mp3",
    ui_confirm: "ui_confirm.mp3",
    ui_error: "ui_error.mp3", /* 放不下 / 不能做 */
    ui_toggle: "ui_toggle.mp3",
    ui_open: "ui_open.mp3",
    ui_close: "ui_close.mp3",
    belt: "belt.mp3", /* 收拾行囊 */
    /* 以下取自 Freesound（CC0，见 CREDITS.md） */
    eat: "eat.mp3", drink: "drink.mp3", campfire: "campfire.mp3", stomach: "stomach.mp3", heartbeat: "heartbeat.mp3",
    claw: "claw.mp3", charge_roar: "charge_roar.mp3", lunge: "lunge.mp3", bodyfall: "bodyfall.mp3",
    blunt_hit: "blunt_hit.mp3", stab: "stab.mp3", armor_hit: "armor_hit.mp3",
    cart_crash: "cart_crash.mp3", weapon_clatter: "weapon_clatter.mp3", splash: "splash.mp3", sizzle: "sizzle.mp3",
    big_drum: "big_drum.mp3", puff: "puff.mp3", glass_break: "glass_break.mp3", fire_burst: "fire_burst.mp3",
    shout: "shout.mp3", chain: "chain.mp3", keys: "keys.mp3", hand_bell: "hand_bell.mp3", gong: "gong.mp3",
    run: "run.mp3", moan: "moan.mp3", temple_bell: "temple_bell.mp3", ice_crack: "ice_crack.mp3", amb_crows: "amb_crows.mp3",
  };
  /* 多个变体的：每次随机挑一个，免得听腻 */
  const SAMPLE_VARIANTS = {
    draw: ["draw_1.mp3", "draw_2.mp3", "draw_3.mp3"], /* 换兵器拔刀 */
    page: ["page_1.mp3", "page_2.mp3", "page_3.mp3"], /* 翻页 */
    step: ["snow_step.mp3"], /* 赶路踩雪（播放时随机变速） */
    growl: ["growl.mp3", "growl2.mp3"], /* 扑咬前低吼 */
    parry: ["parry.mp3", "parry2.mp3"], /* 格挡金铁声 */
  };
  /* 各音效的默认音量（采样本身响度不一） */
  const SAMPLE_GAIN = { ui_toggle: 0.6, ui_open: 0.6, ui_close: 0.6, ui_confirm: 0.7, ui_error: 0.6, page: 0.7, step: 0.6, rotate: 0.5, campfire: 0.6, heartbeat: 0.9, moan: 0.5, temple_bell: 0.5, ice_crack: 0.6, gong: 0.8, lunge: 0.7, growl: 0.8 };
  const variantCache = new Map(); /* name -> AudioBuffer[] */
  const variantLoading = new Map();
  function loadVariants(name) {
    if (variantCache.has(name)) return Promise.resolve(variantCache.get(name));
    if (variantLoading.has(name)) return variantLoading.get(name);
    if (location.protocol === "file:") return Promise.resolve(null);
    const p = (async () => {
      const c = ensure();
      if (!c) return null;
      const bufs = [];
      for (const f of SAMPLE_VARIANTS[name]) {
        try {
          const r = await fetch(SAMPLE_BASE + f);
          if (r.ok) bufs.push(await c.decodeAudioData(await r.arrayBuffer()));
        } catch (e) { /* 少一个变体不要紧 */ }
      }
      if (bufs.length) variantCache.set(name, bufs);
      return bufs;
    })().finally(() => variantLoading.delete(name));
    variantLoading.set(name, p);
    return p;
  }
  function playBuffer(buf, opts, name) {
    const c = ensure();
    if (!c || !unlocked || !buf) return false;
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts && opts.rate) || 0.94 + Math.random() * 0.12;
    const g = c.createGain();
    g.gain.setValueAtTime(opts && opts.gain != null ? opts.gain : SAMPLE_GAIN[name] != null ? SAMPLE_GAIN[name] : 1, t0);
    src.connect(g);
    g.connect(master);
    src.start(t0);
    return true;
  }

  /* footstep 变体：每次随机选一个，避免单一声音呆板。
     文件不存在时自动降级到合成。 */
  const FOOTSTEP_VARIANTS = ["footstep_1.mp3", "footstep_2.mp3", "footstep_3.mp3", "footstep_4.mp3"];
  const footstepCache = []; /* AudioBuffer[] */
  let footstepLoaded = false;

  async function loadFootsteps() {
    if (footstepLoaded) return;
    footstepLoaded = true;
    const c = ensure();
    if (!c || location.protocol === "file:") return;
    for (const file of FOOTSTEP_VARIANTS) {
      try {
        const resp = await fetch(SAMPLE_BASE + file);
        if (!resp.ok) continue;
        const arr = await resp.arrayBuffer();
        const buf = await c.decodeAudioData(arr);
        footstepCache.push(buf);
      } catch (e) {
        /* 单个变体加载失败忽略 */
      }
    }
  }

  /** 加载单个采样文件到缓存，返回 Promise<AudioBuffer>。
   *  优先用 SAMPLE_FILES 指定的文件名；若 404，自动尝试 .ogg/.wav 兜底。
   *  file:// 协议下 fetch 会被 CORS 拦截，直接返回 null 走合成 fallback。 */
  function loadSample(name) {
    if (sampleCache.has(name)) return Promise.resolve(sampleCache.get(name));
    if (sampleLoading.has(name)) return sampleLoading.get(name);
    /* file:// 协议下浏览器禁止 fetch 本地文件（CORS），
       直接放弃采样加载，走合成 fallback，避免控制台一堆错误 */
    if (location.protocol === "file:") {
      return Promise.resolve(null);
    }
    const primary = SAMPLE_FILES[name];
    if (!primary) return Promise.resolve(null);
    /* 候选列表：主文件名 + 同 stem 的其他常见扩展名 */
    const stem = primary.replace(/\.[^.]+$/, "");
    const candidates = [primary];
    for (const ext of [".ogg", ".wav", ".m4a", ".mp3"]) {
      const f = stem + ext;
      if (!candidates.includes(f)) candidates.push(f);
    }
    const p = (async () => {
      for (const file of candidates) {
        try {
          const resp = await fetch(SAMPLE_BASE + file);
          if (!resp.ok) continue;
          const arr = await resp.arrayBuffer();
          const c = ensure();
          if (!c) return null;
          const buf = await c.decodeAudioData(arr);
          sampleCache.set(name, buf);
          if (file !== primary) console.log(`[sfx] ${name} 使用兜底文件 ${file}`);
          return buf;
        } catch (e) {
          /* 继续尝试下一个候选 */
        }
      }
      /* 所有候选都失败：静默返回 null，play() 会降级到合成 */
      return null;
    })().finally(() => sampleLoading.delete(name));
    sampleLoading.set(name, p);
    return p;
  }

  /** 预加载所有采样（启动后调用，避免首次播放时延迟） */
  async function preloadAll() {
    const names = Object.keys(SAMPLE_FILES);
    await Promise.all(names.map((n) => loadSample(n)));
    await Promise.all(Object.keys(SAMPLE_VARIANTS).map((n) => loadVariants(n)));
    await loadFootsteps();
  }

  /** 回放采样。返回 true 表示成功，false 表示缓存未就绪 */
  function playSample(name, opts = {}) {
    const buf = sampleCache.get(name);
    if (!buf) return false;
    const c = ensure();
    if (!c || !unlocked) return false;
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(opts.gain != null ? opts.gain : SAMPLE_GAIN[name] != null ? SAMPLE_GAIN[name] : 1, t0);
    src.connect(g);
    g.connect(master);
    if (opts.reverbSend) sendToReverb(g, opts.reverbSend);
    src.start(t0);
    return true;
  }

  /** 主播放入口：优先采样回放，未加载则等加载（最多 200ms），仍失败再降级合成。
   *  footstep 特殊处理：从多变体中随机选一个，避免单一声音呆板。 */
  async function play(name, opts) {
    if (muted) return;
    unlock();

    /* 多变体：随机挑一个 */
    if (SAMPLE_VARIANTS[name]) {
      let bufs = variantCache.get(name);
      if (!bufs) bufs = await Promise.race([loadVariants(name), new Promise((r) => setTimeout(() => r(null), 200))]);
      if (bufs && bufs.length) playBuffer(bufs[Math.floor(Math.random() * bufs.length)], opts, name);
      return;
    }

    /* footstep 特殊处理：随机变体播放 */
    if (name === "footstep") {
      if (!footstepLoaded) loadFootsteps();
      if (footstepCache.length > 0) {
        const buf = footstepCache[Math.floor(Math.random() * footstepCache.length)];
        const c = ensure();
        if (c && unlocked) {
          const t0 = c.currentTime;
          const src = c.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = 0.95 + Math.random() * 0.1; /* 轻微变速增加变化 */
          const g = c.createGain();
          g.gain.setValueAtTime((opts && opts.gain != null) ? opts.gain : 0.85, t0);
          src.connect(g);
          g.connect(master);
          src.start(t0);
          return;
        }
      }
      synthPlay(name);
      return;
    }

    /* 缓存命中：直接回放 */
    if (sampleCache.has(name)) {
      if (playSample(name, opts)) return;
    }
    /* 有文件映射但未加载：异步拉取并短暂等待，避免立即降级合成 */
    if (SAMPLE_FILES[name] && !sampleCache.has(name)) {
      const p = loadSample(name);
      /* 等 200ms，超时就降级合成（玩家不会察觉太大延迟） */
      await Promise.race([
        p,
        new Promise((r) => setTimeout(r, 200)),
      ]);
      if (sampleCache.has(name)) {
        if (playSample(name, opts)) return;
      }
    }
    /* 降级到合成 */
    synthPlay(name);
  }

  /* ---------- 环境声：每个地方一条低音量的循环底（风雪、殿里的低鸣），换地方时交叉淡化 ---------- */
  let amb = null; /* { name, src, g } */
  let ambLevel = 1; /* 战斗中压低 */
  async function setAmbience(name, level) {
    if (level != null) ambLevel = level;
    const c = ensure();
    if (!c) return;
    if (amb && amb.name === name) {
      amb.g.gain.setTargetAtTime(0.32 * ambLevel, c.currentTime, 0.6);
      return;
    }
    const old = amb;
    amb = null;
    if (old) {
      old.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.8);
      setTimeout(() => { try { old.src.stop(); } catch (_) {} }, 3000);
    }
    if (!name || location.protocol === "file:") return;
    try {
      const r = await fetch(SAMPLE_BASE + name + ".mp3");
      if (!r.ok) return;
      const buf = await c.decodeAudioData(await r.arrayBuffer());
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.setTargetAtTime(0.32 * ambLevel, c.currentTime, 1.2);
      src.connect(g); g.connect(master);
      src.start();
      amb = { name, src, g };
    } catch (_) { /* 环境声缺了不要紧 */ }
  }

  function setMuted(v) {
    muted = !!v;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : sfxVolume, now(), 0.02);
    }
  }

  function setVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (master && ctx && !muted) {
      master.gain.setTargetAtTime(sfxVolume, now(), 0.02);
    }
  }

  function getVolume() {
    return sfxVolume;
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  bindUnlock();

  return { play, unlock, setMuted, setVolume, getVolume, toggleMute, isMuted: () => muted, preloadAll, loadSample, setAmbience };
})();
