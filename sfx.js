/** 程序生成短音效（Web Audio，无外部音频文件） */

const SFX = (() => {
  let ctx = null;
  let master = null;
  let unlocked = false;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    unlocked = true;
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

  /** 铳响：有冲击感但不过分吵 */
  function playExplosionGunshot(heavy) {
    if (muted || !ensure() || !unlocked) return;
    /* 不抬主音量，峰值压低 */
    noiseBurst(0.05, heavy ? 0.32 : 0.22, 220, "lowpass");
    noiseBurst(0.08, heavy ? 0.22 : 0.14, 1100, "bandpass");
    noiseBurst(0.22, heavy ? 0.28 : 0.18, 120, "lowpass");
    tone(58, 0.2, "square", heavy ? 0.22 : 0.14, 32);
    tone(42, 0.28, "sine", heavy ? 0.26 : 0.16, 26);
    setTimeout(() => {
      noiseBurst(0.1, heavy ? 0.12 : 0.08, 1800, "bandpass");
    }, 30);
    setTimeout(() => {
      noiseBurst(0.14, heavy ? 0.1 : 0.06, 90, "lowpass");
      tone(50, 0.16, "sine", 0.08, 28);
    }, 80);
  }

  function play(name) {
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

  function setMuted(v) {
    muted = !!v;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : 0.22, now(), 0.02);
    }
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  bindUnlock();

  return { play, unlock, setMuted, toggleMute, isMuted: () => muted };
})();
