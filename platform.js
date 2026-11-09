/**
 * 平台层：只在 CrazyGames 包里才有事做。
 *   网页版（GitHub Pages）没有 SDK，这里全是空操作，游戏照常跑。
 *   CrazyGames 包由 tools/build-crazygames.mjs 打出：先插 SDK，等 PLATFORM.init() 完了再跑游戏脚本。
 *
 * 管的事：
 *   存档同步   —— 游戏照旧读写 localStorage，这里把自家的几个键镜像到 SDK 的 data 模块（跟着账号走）
 *   语言       —— 没选过语言时，按 SDK 给的 locale 定中英
 *   游玩上报   —— 开场卷轴、菜单、设置、图鉴、赴京图、死亡结局画面算「歇着」，其余算「在玩」
 *   静音       —— 平台的静音开关优先于游戏里的音量
 *   段间广告   —— 死后再走一遭、新开一局、走进新的城区；频率由 SDK 自己管（至少隔 3 分钟）
 */
const PLATFORM = (() => {
  const P = { name: "web", muted: false };
  let sdk = null;

  /* 游戏自己用到的 localStorage 键 */
  const KEYS = ["ming-undying-v3", "ming-codex-v1", "ming-lang", "ming-fs", "ming-leave-noprompt", "vol-bgm", "vol-sfx"];

  P.init = async function () {
    const cg = window.CrazyGames && window.CrazyGames.SDK;
    if (!cg) return P.name;
    try {
      await cg.init();
      if (cg.environment !== "disabled") { sdk = cg; P.name = "crazygames"; }
    } catch (_) { sdk = null; }
    if (!sdk) return P.name;
    syncStorage();
    pickLocale();
    const settings = sdk.game && sdk.game.settings;
    P.muted = !!(settings && settings.muteAudio);
    if (sdk.game && sdk.game.addSettingsChangeListener) {
      sdk.game.addSettingsChangeListener((s) => { P.muted = !!s.muteAudio; applyMute(); });
    }
    return P.name;
  };

  /* ---------- 存档 ---------- */
  function syncStorage() {
    const data = sdk.data;
    if (!data) return;
    /* 账号里有的覆盖本地；本地有、账号里没有的补上去 */
    KEYS.forEach((k) => {
      try {
        const remote = data.getItem(k);
        if (remote != null) localStorage.setItem(k, remote);
        else {
          const local = localStorage.getItem(k);
          if (local != null) data.setItem(k, local);
        }
      } catch (_) {}
    });
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) {
      set.call(this, k, v);
      if (this === window.localStorage && KEYS.includes(k)) try { data.setItem(k, String(v)); } catch (_) {}
    };
    Storage.prototype.removeItem = function (k) {
      remove.call(this, k);
      if (this === window.localStorage && KEYS.includes(k)) try { data.removeItem(k); } catch (_) {}
    };
  }

  function pickLocale() {
    try {
      if (localStorage.getItem("ming-lang")) return;
      const loc = (sdk.user && sdk.user.systemInfo && sdk.user.systemInfo.locale) || "";
      localStorage.setItem("ming-lang", /^zh/i.test(loc) ? "zh" : "en");
    } catch (_) {}
  }

  /* ---------- 加载 ---------- */
  const call = (fn, ...a) => { try { if (sdk) sdk.game[fn](...a); } catch (_) {} };
  P.loadingStart = () => call("loadingStart");
  P.loadingStop = () => call("loadingStop");

  /* ---------- 游玩上报：每半秒看一眼有没有盖着的界面 ---------- */
  const PAUSE_SEL = ["#asset-loader", "#opening", "#death-screen", "#settings-modal", "#codex-modal", "#dock-menu", "#map-drawer"];
  let playing = false;
  let inAd = false;
  function isBreak() {
    return PAUSE_SEL.some((sel) => {
      const el = document.querySelector(sel);
      return el && !el.hidden;
    });
  }
  /* SDK 两次上报至少隔 1 秒，否则后一次被吞掉；所以状态稳住半秒再报，广告前后立刻报 */
  let wantSince = 0, lastCall = 0;
  function syncPlay(now) {
    const want = !inAd && !isBreak();
    const t = performance.now();
    if (want === playing) { wantSince = t; return; }
    if (!now && (t - wantSince < 500 || t - lastCall < 1100)) return;
    playing = want;
    lastCall = t;
    call(want ? "gameplayStart" : "gameplayStop");
  }

  /* ---------- 静音：平台开关压过游戏里的音量 ---------- */
  let sfxWasOff = null;
  function savedBgm() {
    const v = parseInt(localStorage.getItem("vol-bgm"), 10);
    return isNaN(v) ? 0.45 : v / 100;
  }
  function applyMute() {
    const quiet = P.muted || inAd;
    if (typeof SFX === "undefined" || typeof BGM === "undefined") return;
    if (quiet) {
      if (sfxWasOff == null) sfxWasOff = SFX.isMuted();
      if (!SFX.isMuted()) SFX.setMuted(true);
      BGM.setVolume(0);
    } else if (sfxWasOff != null) {
      SFX.setMuted(sfxWasOff);
      sfxWasOff = null;
      BGM.setVolume(savedBgm());
    }
  }

  /* ---------- 段间广告 ---------- */
  P.midgame = function () {
    return new Promise((resolve) => {
      if (!sdk || !sdk.ad || inAd) return resolve(false);
      const done = (ok) => { inAd = false; applyMute(); resolve(ok); };
      try {
        sdk.ad.requestAd("midgame", {
          adStarted: () => { inAd = true; applyMute(); syncPlay(true); },
          adFinished: () => done(true),
          adError: () => done(false),
        });
      } catch (_) { done(false); }
    });
  };

  /* 死后再走一遭、菜单里新开一局：先放广告，SDK 自己挡频率 */
  function hookBreaks() {
    ["death-retry", "btn-restart"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => P.midgame(), true);
    });
  }

  /* 走进新的城区（外城 → 内城 → 皇城 …）也算一关打完 */
  let lastRegion = null;
  function watchRegion() {
    if (typeof BGM === "undefined" || !BGM.region) return;
    const r = BGM.region();
    if (lastRegion && r !== lastRegion && !isBreak()) P.midgame();
    lastRegion = r;
  }

  /** 游戏脚本都跑完了以后调一次 */
  P.start = function () {
    if (!sdk) return;
    hookBreaks();
    applyMute();
    syncPlay();
    setInterval(() => { syncPlay(); watchRegion(); if (P.muted) applyMute(); }, 250);
  };

  return P;
})();
