/**
 * 资源预加载器：在进入游戏前预加载所有图片、音效、音乐
 * 显示加载进度，全部完成后才显示"开始"按钮
 */
(() => {
  /** 收集所有需要预加载的图片 URL */
  function collectImageUrls() {
    const urls = new Set();
    /* 立绘 */
    if (typeof COMBAT !== "undefined" && COMBAT.portraits) {
      Object.values(COMBAT.portraits).forEach((u) => u && urls.add(u));
    }
    /* 物品图标 */
    if (typeof ITEMS !== "undefined") {
      ITEMS.forEach((it) => {
        if (it.icon) urls.add(it.icon);
      });
    }
    /* 英雄立绘 */
    const hero = document.getElementById("hero-art");
    if (hero && hero.src) urls.add(hero.src);
    /* 地点背景图 */
    if (typeof WORLD !== "undefined" && WORLD.locs) {
      Object.keys(WORLD.locs).forEach((id) => {
        urls.add(`assets/locations/${id}.jpg`);
      });
    }
    return Array.from(urls);
  }

  /** 预加载单个图片，返回 Promise */
  function preloadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, url });
      img.onerror = () => resolve({ ok: false, url }); /* 失败也 resolve，不阻塞 */
      img.src = url;
    });
  }


  /** 开头用得上的：主角、起点场景、开局那只变异村民。只等这几张 */
  function criticalImageUrls() {
    const urls = new Set();
    const hero = document.getElementById("hero-art");
    if (hero && hero.src) urls.add(hero.src);
    if (typeof WORLD !== "undefined" && WORLD.startLoc) urls.add(`assets/locations/${WORLD.startLoc}.jpg`);
    if (typeof COMBAT !== "undefined" && COMBAT.portraits && COMBAT.portraits.it1) urls.add(COMBAT.portraits.it1);
    return Array.from(urls);
  }

  /** 其余资源后台慢慢拉：同时最多 4 个，免得和眼前要用的抢带宽 */
  function backgroundLoad(urls) {
    const queue = urls.slice();
    const worker = () => {
      const u = queue.shift();
      if (!u) return Promise.resolve();
      return preloadImage(u).then(worker);
    };
    for (let i = 0; i < 4; i++) worker();
  }

  /** 主预加载入口：只等开头那几张图（最多等 maxWait 毫秒），其余图片、音效进游戏后后台加载。
      以前要等全部 8MB 下完，国内连 GitHub Pages 慢，会一直卡在加载页 */
  async function preloadAll(onProgress, maxWait = 10000) {
    const critical = criticalImageUrls();
    const rest = collectImageUrls().filter((u) => !critical.includes(u));
    const total = critical.length;
    let done = 0;
    const crit = Promise.all(critical.map((u) =>
      preloadImage(u).then((r) => {
        done += 1;
        if (onProgress) onProgress(done, total, "img:" + r.url);
      }),
    ));
    await Promise.race([crit, new Promise((r) => setTimeout(r, maxWait))]);
    backgroundLoad(rest);
    if (typeof SFX !== "undefined" && SFX.preloadAll) SFX.preloadAll().catch(() => {});
    if (typeof BGM !== "undefined" && BGM.preloadAll) BGM.preloadAll();
  }

  window.AssetLoader = { preloadAll, collectImageUrls };
})();
