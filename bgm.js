/**
 * BGM 播放系统：探索 / 战斗 切换，交叉淡入淡出（crossfade），循环播放
 * 支持任意格式（mp4/mp3/ogg/wav），浏览器原生解析音频轨道
 */
(() => {
  let cur = null;          // 当前播放的 <audio>
  let curName = null;      // "explore" | "battle"
  let targetVol = 0.45;    // 目标音量
  let fadeRaf = null;      // 交叉淡入淡出 raf

  const FILES = {
    explore: "assets/music/explore.m4a",
    battle: "assets/music/battle.m4a",
  };

  function ensureAudio(name) {
    const src = FILES[name];
    if (!src) return null;
    const a = new Audio(src);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    return a;
  }

  /** 交叉淡入淡出：旧曲淡出的同时新曲淡入，两者重叠不断档 */
  function play(name, { fade = 1200 } = {}) {
    if (curName === name) return Promise.resolve();

    const old = cur;
    const oldVol = old ? old.volume : 0;
    const next = ensureAudio(name);
    if (!next) return Promise.resolve();

    cur = next;
    curName = name;
    next.volume = 0;

    /* 尝试播放新曲，被浏览器阻止则等首次交互 */
    next.play().catch(() => {
      const resume = () => {
        document.removeEventListener("click", resume);
        document.removeEventListener("keydown", resume);
        next.play().catch(() => {});
      };
      document.addEventListener("click", resume, { once: true });
      document.addEventListener("keydown", resume, { once: true });
    });

    cancelAnimationFrame(fadeRaf);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / fade);
      /* 新曲淡入 */
      next.volume = targetVol * p;
      /* 旧曲同步淡出 */
      if (old) {
        old.volume = oldVol * (1 - p);
        if (p >= 1) {
          old.pause();
          old.currentTime = 0;
        }
      }
      if (p < 1) {
        fadeRaf = requestAnimationFrame(tick);
      } else {
        fadeRaf = null;
      }
    };
    fadeRaf = requestAnimationFrame(tick);
    return Promise.resolve();
  }

  function stop({ fade = 600 } = {}) {
    return new Promise((resolve) => {
      if (!cur) { resolve(); return; }
      const start = cur.volume;
      const t0 = performance.now();
      cancelAnimationFrame(fadeRaf);
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / fade);
        cur.volume = start * (1 - p);
        if (p >= 1) {
          cur.pause();
          cur.currentTime = 0;
          cur = null;
          curName = null;
          fadeRaf = null;
          resolve();
          return;
        }
        fadeRaf = requestAnimationFrame(tick);
      };
      fadeRaf = requestAnimationFrame(tick);
    });
  }

  function pause() {
    if (cur) cur.pause();
  }

  function resume() {
    if (cur) cur.play().catch(() => {});
  }

  function setVolume(v) {
    targetVol = Math.max(0, Math.min(1, v));
    if (cur && !fadeRaf) cur.volume = targetVol;
  }

  function getVolume() {
    return targetVol;
  }

  /** 预加载所有音乐文件（不播放，仅缓存），返回 Promise */
  function preloadAll() {
    const names = Object.keys(FILES);
    return Promise.all(
      names.map(
        (name) =>
          new Promise((resolve) => {
            const a = ensureAudio(name);
            if (!a) { resolve(); return; }
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            a.addEventListener("canplaythrough", finish, { once: true });
            a.addEventListener("loadeddata", finish, { once: true });
            a.addEventListener("error", finish, { once: true });
            /* 超时兜底：15s 后无论如何 resolve，不阻塞进游戏 */
            setTimeout(finish, 15000);
          }),
      ),
    );
  }

  /* 页面失焦时暂停音乐，聚焦时恢复 */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (cur && !cur.paused) cur.pause();
    } else {
      if (cur && cur.paused && curName) cur.play().catch(() => {});
    }
  });

  window.BGM = { play, pause, resume, setVolume, getVolume, stop, preloadAll };
})();
