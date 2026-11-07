/** 像素版外壳：赴京图抽屉、底栏菜单的开合（地图本身仍由 game.js renderMap 绘制） */
(function () {
  const drawer = document.getElementById("map-drawer");
  const openBtn = document.getElementById("btn-map");
  const closeBtn = document.getElementById("map-close");
  const minimap = document.getElementById("minimap");
  if (!drawer || !openBtn) return;

  function open() {
    drawer.hidden = false;
    if (typeof SFX !== "undefined") SFX.play("page");
    requestAnimationFrame(() => {
      drawer.classList.add("is-visible");
      /* 手机上图可横向滑动：把当前地点滚到中间 */
      const wrap = minimap && minimap.parentElement;
      const here = minimap && minimap.querySelector(".map-node.here");
      if (wrap && here && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = here.offsetLeft - wrap.clientWidth / 2;
    });
  }
  function close() {
    drawer.classList.remove("is-visible");
    drawer.hidden = true;
    const tip = document.getElementById("map-tip");
    if (tip) tip.hidden = true;
  }

  openBtn.addEventListener("click", () => (drawer.hidden ? open() : close()));
  closeBtn.addEventListener("click", close);
  drawer.addEventListener("click", (e) => { if (e.target === drawer) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) close();
    if ((e.key === "m" || e.key === "M") && !e.target.closest("input, textarea")) {
      drawer.hidden ? open() : close();
    }
  });
  /* 点了能去的地点：game.js 会启程，抽屉随之合上 */
  minimap.addEventListener("click", (e) => {
    if (e.target.closest(".map-node.reachable")) setTimeout(close, 120);
  }, true);

  /* 底栏菜单：存档/读档/设置等收在一起，点任意一项或点别处就收起 */
  const menuBtn = document.getElementById("btn-menu");
  const menu = document.getElementById("dock-menu");
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
    };
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setMenu(menu.hidden);
    });
    menu.addEventListener("click", () => setTimeout(() => setMenu(false), 0));
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !e.target.closest(".dock-menu-wrap")) setMenu(false);
    });
  }

  /* 中英切换：首次按浏览器语言，之后记住选择 */
  const langBtn = document.getElementById("btn-lang");
  if (typeof I18N !== "undefined") {
    const label = () => { if (langBtn) langBtn.textContent = I18N.lang === "en" ? "中文" : "English"; };
    if (langBtn) langBtn.addEventListener("click", () => { I18N.setLang(I18N.lang === "en" ? "zh" : "en"); label(); });
    label();
    I18N.start();
  }
})();

/* ---------- 字号：自动（手机小、电脑中）/ 小 / 中 / 大，记在本机 ---------- */
(() => {
  const KEY = "ming-fs";
  const seg = document.getElementById("fs-seg");
  const pick = () => { try { return localStorage.getItem(KEY) || "auto"; } catch (_) { return "auto"; } };
  function apply() {
    const want = pick();
    const size = want === "auto" ? (Math.min(window.innerWidth, window.innerHeight) <= 560 ? "s" : "m") : want;
    document.documentElement.dataset.fs = size;
    if (seg) seg.querySelectorAll("[data-fs]").forEach((b) => b.classList.toggle("on", b.dataset.fs === want));
  }
  if (seg) {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fs]");
      if (!b) return;
      try { localStorage.setItem(KEY, b.dataset.fs); } catch (_) {}
      if (typeof SFX !== "undefined") SFX.play("ui_toggle");
      apply();
      window.dispatchEvent(new Event("resize"));
    });
  }
  window.addEventListener("resize", () => { if (pick() === "auto") apply(); });
  apply();
})();
