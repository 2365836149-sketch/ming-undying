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


  /** 主预加载入口：图片 + 音效。音乐不阻塞，进游戏后后台加载 */
  async function preloadAll(onProgress) {
    const images = collectImageUrls();
    let total = images.length;
    let done = 0;

    /* 并行加载图片 */
    const imgPromises = images.map((u) =>
      preloadImage(u).then((r) => {
        done += 1;
        if (onProgress) onProgress(done, total, "img:" + r.url);
      }),
    );

    /* 音效预加载（SFX.preloadAll 已存在） */
    let sfxPromise = Promise.resolve();
    if (typeof SFX !== "undefined" && SFX.preloadAll) {
      total += 1;
      sfxPromise = SFX.preloadAll().then(() => {
        done += 1;
        if (onProgress) onProgress(done, total, "sfx");
      });
    }

    /* 音乐预加载：不阻塞进度条，后台触发缓存，进游戏后自然可用 */
    if (typeof BGM !== "undefined" && BGM.preloadAll) {
      BGM.preloadAll();
    }

    await Promise.all([...imgPromises, sfxPromise]);
  }

  window.AssetLoader = { preloadAll, collectImageUrls };
})();
