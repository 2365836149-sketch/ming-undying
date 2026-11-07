/** 嵌入式战斗层 + 斩影小游戏 + 背包 UI */

function uiFadeShow(node) {
  if (!node) return;
  node.hidden = false;
  node.classList.remove("is-visible");
  void node.offsetWidth;
  requestAnimationFrame(() => node.classList.add("is-visible"));
}

function uiFadeHide(node, ms = 380) {
  return new Promise((resolve) => {
    if (!node || node.hidden) {
      resolve();
      return;
    }
    node.classList.remove("is-visible");
    setTimeout(() => {
      node.hidden = true;
      resolve();
    }, ms);
  });
}

/** 搜打撤式圆形搜索进度 */
const SearchRing = (() => {
  let active = null;

  function ensure() {
    let el = document.getElementById("search-ring");
    if (el) return el;
    el = document.createElement("div");
    el.id = "search-ring";
    el.className = "search-ring";
    el.hidden = true;
    el.innerHTML = `
      <div class="search-ring-panel" role="dialog" aria-modal="true" aria-labelledby="search-ring-label">
        <svg class="search-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="search-ring-track" cx="50" cy="50" r="42" fill="none" />
          <circle class="search-ring-prog" cx="50" cy="50" r="42" fill="none" />
        </svg>
        <p class="search-ring-label" id="search-ring-label">搜索中…</p>
        <p class="search-ring-hint">点击空白或 Esc 取消</p>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  function run(opts = {}) {
    return new Promise((resolve) => {
      if (active && active.cancel) active.cancel();
      const el = ensure();
      const labelEl = el.querySelector(".search-ring-label");
      const prog = el.querySelector(".search-ring-prog");
      const duration = Math.max(80, opts.durationMs || 1400);
      if (labelEl) labelEl.textContent = opts.label || "搜索中…";

      const radius = 42;
      const circ = 2 * Math.PI * radius;
      prog.style.strokeDasharray = String(circ);
      prog.style.strokeDashoffset = String(circ);

      uiFadeShow(el);
      document.body.classList.add("searching");

      /* 只在开始时播放一次搜索音效，不再每步重复播放 */
      if (typeof SFX !== "undefined") SFX.play("search");

      let raf = null;
      let settled = false;
      const t0 = performance.now();

      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (raf) cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey);
        el.removeEventListener("click", onClick);
        document.body.classList.remove("searching");
        active = null;
        uiFadeHide(el, 280).then(() => resolve(result));
      };

      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish("cancel");
        }
      };
      const onClick = (e) => {
        if (e.target === el) finish("cancel");
      };

      document.addEventListener("keydown", onKey);
      el.addEventListener("click", onClick);

      const tick = (now) => {
        if (settled) return;
        const p = Math.min(1, (now - t0) / duration);
        prog.style.strokeDashoffset = String(circ * (1 - p));
        if (p >= 1) {
          finish("done");
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      active = { cancel: () => finish("cancel") };
    });
  }

  return { run };
})();

const CombatUI = (() => {
  let api;
  let selectedUid = null;
  let selectedEvidence = null; /* 证物袋里选中的物品 id */
  let selectedFromStaging = false;
  let hoverCell = null; // { x, y, ok? }
  let bagKeyBound = false;
  let carryBound = false;
  let carry = null; // { uid, id, rot, from: bag|weapon|armor|staging }
  let lastPointer = { x: 0, y: 0 };
  let ignorePlaceUntil = 0;
  /* 空子铳填装：{ uid, step:0|1|2 }，每次只填叠中的一枚 */
  let zichongFill = null;
  let phase = "menu"; // menu | slash | shoot | reload
  let targetIdx = 0;
  let slashState = null;
  let slashTimer = null;
  let slashRaf = null;
  let shootState = null;
  let active = false;
  let bagSession = { fromBattle: false, reason: "manage" };

  function toastBag(msg) {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return;
    uiFadeShow(toastEl);
    toastEl.textContent = msg;
    clearTimeout(toastEl._bagT);
    toastEl._bagT = setTimeout(() => uiFadeHide(toastEl, 280), 2200);
  }

  function stage() {
    return document.getElementById("stage-panel");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function ensureDom() {
    const existing = $("bag-modal");
    if (
      existing &&
      existing.dataset.bagUi === "px8" &&
      $("bag-staging") &&
      $("weapon-grid") &&
      $("armor-grid")
    ) {
      return;
    }
    if (existing) existing.remove();
    const html = `
<div id="bag-modal" class="bag-modal" hidden data-bag-ui="px8">
  <div class="bag-panel px-panel">
    <div class="bag-ground" id="bag-ground" hidden>拖到这里放下 · 合上行囊后留在原地，回来还能捡</div>
    <header class="bag-head">
      <h2 id="bag-title">行囊</h2>
      <p class="bag-meta" id="bag-meta"></p>
      <button type="button" class="px-btn" id="bag-close">合上</button>
    </header>
    <section class="bag-staging-wrap" id="bag-staging-wrap" hidden>
      <div class="bag-section-label">待收 · 拖进行囊，或点「全部收入」</div>
      <div class="bag-staging" id="bag-staging"></div>
      <p class="bag-staging-hint" id="bag-staging-hint" hidden></p>
      <div class="bag-staging-acts" id="bag-staging-acts"></div>
    </section>
    <div class="bag-body">
      <section class="bag-racks" id="bag-racks">
        <div class="bag-col-equip">
          <div class="bag-rack" data-zone="weapon">
            <div class="bag-section-label">兵器架</div>
            <div class="bag-board bag-rack-board" id="weapon-grid">
              <div class="bag-sprites" id="weapon-sprites"></div>
            </div>
          </div>
          <div class="bag-rack" data-zone="armor">
            <div class="bag-section-label">甲胄</div>
            <div class="bag-slots" id="armor-grid"></div>
          </div>
        </div>
        <div class="bag-rack bag-rack-main" data-zone="bag">
          <div class="bag-section-label" id="bag-size-label">行囊</div>
          <div class="bag-board" id="bag-grid">
            <div class="bag-sprites" id="bag-sprites"></div>
          </div>
        </div>
      </section>
      <aside class="bag-side">
        <div class="bag-card" id="bag-card"></div>
        <div class="bag-stats" id="bag-stats"></div>
        <div class="bag-detail" id="bag-detail"></div>
        <div class="bag-actions" id="bag-actions"></div>
        <div class="bag-tubes" id="bag-tubes" hidden></div>
        <div class="bag-evidence" id="bag-evidence"></div>
      </aside>
    </div>
    <p class="bag-tips">兵器架上的兵器战斗中才换得上 · 头盔、身甲各穿一件，拖上去就对调 · R / 右键旋转 · Esc 合上</p>
  </div>
  <button type="button" class="bag-rotate-fab" id="bag-rotate-fab">↻ 旋转</button>
</div>`;
    document.body.insertAdjacentHTML("beforeend", html);
    $("bag-close").onclick = () => closeBag();
    $("bag-rotate-fab").onclick = (e) => { e.stopPropagation(); rotateCarry(); };
    if (!bagKeyBound) {
      bagKeyBound = true;
      document.addEventListener("keydown", (e) => {
        const modal = $("bag-modal");
        if (!modal || modal.hidden) return;
        if (e.key === "r" || e.key === "R") {
          if (carry) {
            e.preventDefault();
            rotateCarry();
            return;
          }
          if (!selectedUid || !api) return;
          const hit = findPieceAnywhere(api.getState(), selectedUid);
          if (selectedFromStaging && api.rotateStagingPiece) {
            api.rotateStagingPiece(selectedUid);
            paintBag();
          } else if (hit && api.rotateZonePiece) {
            api.rotateZonePiece(hit.zone, selectedUid);
            paintBag();
          } else if (api.rotateBagPiece) {
            api.rotateBagPiece(selectedUid);
            paintBag();
          }
        }
        if (e.key === "Escape") {
          if (carry) {
            e.preventDefault();
            cancelCarry();
            return;
          }
          closeBag();
        }
      });
    }
    if (!carryBound) {
      carryBound = true;
      /* 背包开着时改窗口大小：重算格子，免得压到详情面板 */
      let resizeT = 0;
      window.addEventListener("resize", () => {
        clearTimeout(resizeT);
        resizeT = setTimeout(() => {
          const modal = $("bag-modal");
          cellShrink = 0;
          if (modal && !modal.hidden && api) paintBag();
        }, 120);
      });
      /* 拖拽后的那次 click 吞掉，避免又触发"点拿点放" */
      document.addEventListener("click", (e) => {
        if (performance.now() < suppressClickUntil && e.target.closest("#bag-modal")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
      document.addEventListener("pointerdown", onBagPointerDown, true);
      document.addEventListener("pointermove", onBagDragMove);
      document.addEventListener("pointerup", onBagPointerUp);
      document.addEventListener("pointercancel", onBagPointerUp);
      document.addEventListener("contextmenu", (e) => {
        if (!carry || !e.target.closest("#bag-modal")) return;
        e.preventDefault();
        rotateCarry();
      });
      document.addEventListener("pointermove", onBagPointerMove);
      document.addEventListener("click", onBagDocClick, true);
    }
  }

  const opaqueMetaCache = new Map();

  function makeItemVisual(id, rot, className) {
    const src = typeof itemIcon === "function" ? itemIcon(id) : null;
    const it = itemDef(id);
    if (src) {
      const img = document.createElement("img");
      img.src = src + (src.includes("?") ? "&" : "?") + "v=fit76";
      img.alt = it ? it.name : id;
      img.draggable = false;
      if (className) img.className = className;
      const r = ((rot % 4) + 4) % 4;
      img.dataset.rot = String(r);
      return img;
    }
    const span = document.createElement("span");
    span.className = "bag-piece-fallback" + (className ? " " + className : "");
    span.textContent = it ? it.name.slice(0, 1) : "?";
    return span;
  }

  function measureOpaqueMeta(img) {
    const key = img.currentSrc || img.src;
    if (opaqueMetaCache.has(key)) return opaqueMetaCache.get(key);
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return null;

    /* 优先用预计算包围盒（file:// 下 canvas 读不了本地像素） */
    const file = (key.split("/").pop() || "").split("?")[0];
    if (typeof ITEM_ICON_BOUNDS !== "undefined" && ITEM_ICON_BOUNDS[file]) {
      const b = ITEM_ICON_BOUNDS[file];
      const meta = {
        x: b.x | 0,
        y: b.y | 0,
        w: b.w | 0,
        h: b.h | 0,
        nw: b.nw || nw,
        nh: b.nh || nh,
      };
      opaqueMetaCache.set(key, meta);
      return meta;
    }

    let meta = { x: 0, y: 0, w: nw, h: nh, nw, nh };
    try {
      const c = document.createElement("canvas");
      c.width = nw;
      c.height = nh;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, nw, nh).data;
      let minX = nw;
      let minY = nh;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          if (data[(y * nw + x) * 4 + 3] > 24) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= 0) {
        meta = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, nw, nh };
      }
    } catch (_) {
      /* keep full-frame meta */
    }
    opaqueMetaCache.set(key, meta);
    return meta;
  }

  /** 非透明部分顶到格子边，再等比缩小 5% */
  function fitOpaqueIntoBox(img, boxW, boxH) {
    if (!img || !boxW || !boxH) return;
    const apply = () => {
      const meta = measureOpaqueMeta(img);
      if (!meta || meta.w < 1 || meta.h < 1) return;
      const rot = (parseInt(img.dataset.rot || "0", 10) || 0) % 4;
      const contentW = rot % 2 === 1 ? meta.h : meta.w;
      const contentH = rot % 2 === 1 ? meta.w : meta.h;
      const fit = Math.min(boxW / contentW, boxH / contentH) * 0.95;
      const dispW = meta.nw * fit;
      const dispH = meta.nh * fit;
      img.style.width = dispW + "px";
      img.style.height = dispH + "px";
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      img.style.objectFit = "fill";
      img.style.position = "absolute";
      img.style.margin = "0";
      const cx = (meta.x + meta.w / 2) * fit;
      const cy = (meta.y + meta.h / 2) * fit;
      const left = boxW / 2 - cx;
      const top = boxH / 2 - cy;
      img.style.left = left + "px";
      img.style.top = top + "px";
      if (rot) {
        img.style.transform = `rotate(${rot * 90}deg)`;
        img.style.transformOrigin = `${cx}px ${cy}px`;
      } else {
        img.style.transform = "";
        img.style.transformOrigin = "center";
      }
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  /** 格宽：按整块摆放区（兵器/甲胄列 + 行囊）的宽度和视口高度一起算 */
  function sharedCellPx() {
    const gap = 3;
    const racks = $("bag-racks");
    const body = racks && racks.parentElement;
    /* 三种排法：宽屏一横排；中屏格子叠两段、详情在右；窄屏全部竖排、详情在下 */
    const stacked = racks && getComputedStyle(racks).flexDirection === "column";
    const sideBelow = body && getComputedStyle(body).flexDirection === "column";
    /* 可用宽度按"整块背包 - 详情面板"算，不读格子区自己的宽度（它会被上一轮的大格子撑开，越算越大） */
    const side = body && body.querySelector(".bag-side");
    const bodyGap = body ? parseFloat(getComputedStyle(body).columnGap) || 0 : 0;
    const avail = body && body.clientWidth
      ? body.clientWidth - (sideBelow || !side ? 0 : side.offsetWidth + bodyGap)
      : 320;
    const eqW = zoneSize("weapon").w + ARMOR_COLS + 0.4;
    const cols = stacked ? Math.max(WORLD.bagW, eqW) : WORLD.bagW + eqW;
    const fixed = stacked ? 10 : 14 + 10 + 18;
    const byW = (avail - fixed - gap * (cols + 3)) / cols;
    const eqH = Math.max(zoneSize("weapon").h, ARMOR_ROWS + 0.4);
    const twoBands = eqH + 0.6 + WORLD.bagH;
    const byH = !stacked
      ? (window.innerHeight - 260) / Math.max(WORLD.bagH, eqH) - gap
      : sideBelow
        ? (window.innerHeight - 330) / twoBands - gap
        : (window.innerHeight - 150) / twoBands - gap;
    return Math.max(30, Math.min(72, Math.floor(Math.min(byW, byH)) - cellShrink));
  }

  /* 排完发现格子区挤进了详情栏（字体、滚动条等算不到的宽度），就把格子再缩几像素重排 */
  let cellShrink = 0;
  function fitBagBody() {
    const racks = $("bag-racks");
    if (!racks) return;
    for (let i = 0; i < 12 && racks.scrollWidth > racks.clientWidth + 1 && sharedCellPx() > 30; i++) {
      cellShrink += 2;
      ["weapon", "armor", "bag"].forEach((z) => { applyBoardPixelSize(z); paintZoneGrid(api.getState(), z); });
    }
  }

  /* 甲胄栏两个位，以格为单位：上头盔 2×1，下身甲 2×2 */
  const ARMOR_SLOTS = [{ name: "头盔", w: 2, h: 1 }, { name: "身甲", w: 2, h: 2 }];
  const ARMOR_COLS = 2;
  const ARMOR_ROWS = 3;
  const SLOT_NAMES = { armor: ARMOR_SLOTS.map((d) => d.name) };

  function cellMetrics(_zone) {
    const gap = 3;
    const cw = sharedCellPx();
    return { cw, ch: cw, gap };
  }

  function applyBoardPixelSize(zone) {
    const board = gridEl(zone);
    if (!board) return;
    if (isSlotZone(zone)) return;
    const { w, h } = zoneSize(zone);
    const { cw, ch, gap } = cellMetrics(zone);
    board.style.width = `${w * cw + (w - 1) * gap}px`;
    board.style.gridTemplateColumns = `repeat(${w}, ${cw}px)`;
    board.style.gridAutoRows = `${ch}px`;
  }

  function piecePixelSize(id, rot, zone) {
    const { cw, ch, gap } = cellMetrics(zone || "bag");
    const bounds = itemShapeBounds(id, rot);
    return {
      w: bounds.w * cw + (bounds.w - 1) * gap,
      h: bounds.h * ch + (bounds.h - 1) * gap,
      bounds,
      cw,
      ch,
      gap,
    };
  }

  function gridEl(zone) {
    if (zone === "weapon") return $("weapon-grid");
    if (zone === "armor") return $("armor-grid");
    return $("bag-grid");
  }

  function spritesEl(zone) {
    if (zone === "weapon") return $("weapon-sprites");
    if (zone === "armor") return $("armor-sprites");
    return $("bag-sprites");
  }


  /**
   * 放置原点：形状以鼠标为中心。
   * 奇数格 → 鼠标落在正中格；偶数格 → 鼠标落在中间两格夹缝。
   */
  function pointerToBagOrigin(clientX, clientY, zone, id, rot) {
    const grid = gridEl(zone);
    if (!grid) return null;
    if (isSlotZone(zone)) {
      const el = [...grid.querySelectorAll(".bag-slot")].find((d) => {
        const r = d.getBoundingClientRect();
        return clientX >= r.left && clientX < r.right && clientY >= r.top && clientY < r.bottom;
      });
      return el ? { x: +el.dataset.x, y: 0, zone } : null;
    }
    const { cw, ch, gap } = cellMetrics(zone);
    const rect = grid.getBoundingClientRect();
    const stepX = cw + gap;
    const stepY = ch + gap;
    if (stepX <= 0 || stepY <= 0) return null;
    const fx = (clientX - rect.left) / stepX;
    const fy = (clientY - rect.top) / stepY;
    const bounds = itemShapeBounds(id, rot | 0);
    const x = Math.round(fx - bounds.w / 2);
    const y = Math.round(fy - bounds.h / 2);
    return { x, y, zone };
  }

  function zoneUnderPointer(clientX, clientY) {
    /* 从行囊里拖出来的，可以放回待收区（或顶上那条「放下」） */
    if (carry && carry.from !== "staging") {
      for (const id of ["bag-ground", "bag-staging-wrap"]) {
        const el = $(id);
        if (!el || el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX < r.right && clientY >= r.top && clientY < r.bottom) return "staging";
      }
    }
    for (const z of ["weapon", "bag", "armor"]) {
      const grid = gridEl(z);
      if (!grid) continue;
      const r = grid.getBoundingClientRect();
      if (clientX >= r.left && clientX < r.right && clientY >= r.top && clientY < r.bottom) {
        return z;
      }
    }
    return null;
  }

  function updateCarrySnap() {
    if (!carry || !api) return;
    const s = api.getState();
    const over = zoneUnderPointer(lastPointer.x, lastPointer.y);
    if (over === "staging") {
      const it = itemDef(carry.id);
      hoverCell = { zone: "staging", ok: !(it && it.noDrop) };
      paintBagGhostsOnly();
      return;
    }
    if (!over || !zoneAllowsItem(over, carry.id)) {
      if (hoverCell) {
        hoverCell = null;
        paintBagGhostsOnly();
      }
      return;
    }
    const cell = pointerToBagOrigin(
      lastPointer.x,
      lastPointer.y,
      over,
      carry.id,
      carry.rot,
    );
    if (!cell) {
      if (hoverCell) {
        hoverCell = null;
        paintBagGhostsOnly();
      }
      return;
    }
    const ignore = carry.from === "staging" ? null : carry.uid;
    if (isSlotZone(over)) {
      /* 位上有东西：从行囊/另一个位拖来就对调；从待收区拖来要先腾位 */
      const occupant = piecesOf(s, over).find((p) => p.x === cell.x && p.uid !== carry.uid);
      const ok = zoneAllowsItem(over, carry.id) && armorPart(carry.id) === cell.x && (!occupant || carry.from !== "staging");
      hoverCell = { x: cell.x, y: 0, zone: over, ok, swap: !!occupant };
      paintBagGhostsOnly();
      return;
    }
    const target =
      typeof pieceAtCell === "function" ? pieceAtCell(s, over, cell.x, cell.y, ignore) : null;
    let fromPiece = { uid: carry.uid, id: carry.id, qty: 1, fillStep: 0 };
    if (carry.from !== "staging") {
      const hit = findPieceAnywhere(s, carry.uid);
      if (hit) fromPiece = hit.piece;
    }
    const mergeOk =
      !!(target && typeof canStackMerge === "function" && canStackMerge(fromPiece, target));
    let ok = mergeOk;
    if (!ok) {
      if (carry.from !== "staging" && carry.from !== over) {
        ok = zoneCanPlace(s, over, carry.id, cell.x, cell.y, carry.rot, null);
      } else {
        ok = zoneCanPlace(s, over, carry.id, cell.x, cell.y, carry.rot, ignore);
      }
    }
    /* 放不下但只是压着别的东西：可以挤开它们 */
    let displace = false;
    if (!ok && !mergeOk) {
      const { w: W, h: H } = zoneSize(over);
      const inside = itemShape(carry.id, carry.rot).every(([dx, dy]) => {
        const cx = cell.x + dx, cy = cell.y + dy;
        return cx >= 0 && cy >= 0 && cx < W && cy < H;
      });
      if (inside) ok = displace = true;
    }
    hoverCell = { x: cell.x, y: cell.y, zone: over, ok, merge: mergeOk, displace };
    paintBagGhostsOnly();
  }

  function beginCarry(piece, from, clientX, clientY) {
    if (!piece) return;
    const fromKey = from || "bag";
    if (carry && carry.uid === piece.uid && carry.from === fromKey) {
      cancelCarry();
      return;
    }
    if (zichongFill && piece.id === "zichong_empty" && zichongFill.uid === piece.uid) {
      zichongFill = null;
    }
    cancelCarry(true);
    selectedUid = piece.uid;
    selectedFromStaging = fromKey === "staging";
    lastPointer = {
      x: clientX ?? lastPointer.x,
      y: clientY ?? lastPointer.y,
    };
    carry = {
      uid: piece.uid,
      id: piece.id,
      rot: piece.rot | 0,
      from: fromKey,
    };
    document.body.classList.add("bag-carrying");
    ignorePlaceUntil = performance.now() + 80;
    paintBag();
    updateCarrySnap();
    syncCarryGhost();
    if (piece.id === "powder" || piece.id === "wad" || piece.id === "shot") {
      const names = { powder: "火药", wad: "垫片", shot: "弹丸" };
      toastBag(`已选${names[piece.id]} · 再点空子铳装填`);
    }
  }

  function cancelCarry(silent) {
    if (!carry && !document.body.classList.contains("bag-carrying")) {
      if (!silent) paintBagGhostsOnly();
      return;
    }
    document.body.classList.remove("bag-carrying", "bag-dragging");
    carry = null;
    hoverCell = null;
    syncCarryGhost();
    if (!silent) paintBag();
    else paintBagGhostsOnly();
  }



  let drag = null;
  let suppressClickUntil = 0;

  function rotateCarry() {
    if (!carry) return;
    carry.rot = (carry.rot + 1) % 4;
    if (carry.from === "staging" && api && api.rotateStagingPiece) api.rotateStagingPiece(carry.uid);
    hoverCell = null;
    updateCarrySnap();
    paintBagGhostsOnly();
    syncCarryGhost();
  }

  function syncCarryGhost() {
    let g = $("bag-drag-ghost");
    const ground = $("bag-ground");
    if (ground) ground.hidden = !carry || carry.from === "staging";
    if (!carry) {
      if (g) g.remove();
      return;
    }
    if (!g) {
      g = document.createElement("div");
      g.id = "bag-drag-ghost";
      g.className = "bag-drag-ghost";
      document.body.appendChild(g);
    }
    const size = piecePixelSize(carry.id, carry.rot, "bag");
    g.innerHTML = "";
    g.style.width = size.w + "px";
    g.style.height = size.h + "px";
    const v = makeItemVisual(carry.id, carry.rot);
    g.appendChild(v);
    if (v.tagName === "IMG") fitOpaqueIntoBox(v, size.w, size.h);
    moveCarryGhost();
  }

  function moveCarryGhost() {
    const g = $("bag-drag-ghost");
    if (!g) return;
    g.style.left = lastPointer.x + "px";
    g.style.top = lastPointer.y + "px";
  }

  function pieceForDrag(d) {
    const s = api.getState();
    if (d.zone === "staging") return (s.lootStaging || []).find((p) => p.uid === d.uid) || null;
    const hit = findPieceAnywhere(s, d.uid);
    return hit ? hit.piece : null;
  }

  function onBagPointerDown(e) {
    if (e.button !== 0 || !api) return;
    const modal = $("bag-modal");
    if (!modal || modal.hidden) return;
    const el = e.target.closest("#bag-modal .bag-cell.filled, #bag-modal .bag-staging-item, #bag-modal .bag-slot.filled");
    if (!el || !el.dataset.uid) return;
    drag = {
      sx: e.clientX,
      sy: e.clientY,
      uid: el.dataset.uid,
      zone: el.classList.contains("bag-staging-item") ? "staging" : el.dataset.zone,
      active: false,
    };
  }

  function onBagDragMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 7) return;
      const piece = pieceForDrag(drag);
      if (!piece) { drag = null; return; }
      drag.active = true;
      if (!(carry && carry.uid === piece.uid)) beginCarry(piece, drag.zone, e.clientX, e.clientY);
      document.body.classList.add("bag-dragging");
      if (typeof SFX !== "undefined") SFX.play("ui");
    }
    lastPointer = { x: e.clientX, y: e.clientY };
    moveCarryGhost();
  }

  function onBagPointerUp(e) {
    if (!drag) return;
    const was = drag.active;
    drag = null;
    if (!was) return;
    suppressClickUntil = performance.now() + 250;
    document.body.classList.remove("bag-dragging");
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!carry) return;
    if (!zoneUnderPointer(e.clientX, e.clientY)) { cancelCarry(); return; }
    if (!tryPlaceCarry()) cancelCarry();
  }

  /** 把待收区的一件自动塞进去：兵器/护甲先试本栏，再试行囊 */
  function autoStowOne(st) {
    const s = api.getState();
    const home = itemHomeZone(st.id);
    const zones = (home === "weapon" || home === "armor") ? [home, "bag"] : ["bag"];
    for (const z of zones) {
      if (!zoneAllowsItem(z, st.id)) continue;
      const { w: W, h: H } = zoneSize(z);
      for (let r = 0; r < 4; r++) {
        const rot = ((st.rot | 0) + r) % 4;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (!zoneCanPlace(s, z, st.id, x, y, rot, null)) continue;
            const ok = api.placeFromStagingToZone
              ? api.placeFromStagingToZone(st.uid, z, x, y, rot)
              : api.placeFromStaging(st.uid, x, y, rot, z);
            if (ok) return true;
          }
        }
      }
    }
    return false;
  }

  function autoStowAll() {
    cancelCarry(true);
    const s = api.getState();
    const list = [...(s.lootStaging || [])].sort(
      (a, b) => itemShape(b.id, 0).length - itemShape(a.id, 0).length,
    );
    let n = 0;
    list.forEach((st) => { if (autoStowOne(st)) n++; });
    const left = (api.getState().lootStaging || []).length;
    toastBag(left ? `收入 ${n} 件 · 还有 ${left} 件放不下` : `全部收入（${n} 件）`);
    if (n && typeof SFX !== "undefined") SFX.play("bag_place");
    paintBag();
  }

  /** 物品属性一行字 */
  /* 详情卡里的数值条：长短按同类物品里的最大值算 */
  let statMax = null;
  function statMaxOf(key) {
    if (!statMax) {
      statMax = {};
      Object.entries(WORLD.items).forEach(([id, it]) => {
        statRows(id, it).forEach((r) => { statMax[r.key] = Math.max(statMax[r.key] || 0, r.v); });
      });
    }
    return statMax[key] || 1;
  }

  /** 一件东西要画哪几条：{ key, label, v, text, bad } */
  function statRows(id, it) {
    if (!it) return [];
    const rows = [];
    if (it.slot === "weapon") {
      const w = { id, autoGuard: !!it.autoGuard, parryDef: it.parryDef || 10 };
      rows.push({ key: "dmg", label: "伤害", v: it.dmg || 0, text: String(it.dmg || 0) });
      rows.push({ key: "combo", label: "连击", v: (it.combo || 0) + 1, text: `${(it.combo || 0) + 1} 处` });
      rows.push({ key: "block", label: "格挡", v: Math.round(blockRate(w, true) * 100), text: `${Math.round(blockRate(w, true) * 100)}%` });
      if (it.stamina) rows.push({ key: "wstam", label: "耗体", v: it.stamina, text: String(it.stamina), bad: true });
    } else if (it.slot === "armor") {
      rows.push({ key: it.part === "head" ? "hdef" : "def", label: "防护", v: it.def || 0, text: String(it.def || 0) });
      if (it.staminaPenalty) rows.push({ key: "apen", label: "压体力", v: -it.staminaPenalty, text: String(it.staminaPenalty), bad: true });
    } else if (it.food) {
      rows.push({ key: "fill", label: "饱腹", v: it.fill || 0, text: `+${it.fill || 0}` });
      if (it.hp) rows.push({ key: "fhp", label: "气血", v: it.hp, text: `+${it.hp}` });
      if (it.stamina) rows.push({ key: "fst", label: "体力", v: it.stamina, text: `+${it.stamina}` });
    }
    return rows;
  }

  function paintStatBars(id) {
    const box = $("bag-stats");
    if (!box) return;
    box.innerHTML = "";
    statRows(id, itemDef(id)).forEach((r) => {
      const row = document.createElement("div");
      row.className = "stat-row" + (r.bad ? " bad" : "");
      const pct = Math.max(4, Math.round((r.v / statMaxOf(r.key)) * 100));
      row.innerHTML = `<span class="stat-label">${r.label}</span><span class="stat-bar"><i style="width:${pct}%"></i></span><span class="stat-num">${r.text}</span>`;
      box.appendChild(row);
    });
  }

  function itemStatLine(it, piece) {
    if (!it) return "";
    const parts = [];
    if (it.slot === "weapon" && typeof firearmSpec === "function" && firearmSpec(piece.id)) parts.push("火器");
    if (it.slot === "armor") parts.push(it.part === "head" ? "头盔" : "身甲");
    if (isStackable(piece.id)) parts.push(`${pieceQty(piece)} / ${stackMaxOf(piece.id)}`);
    if (it.slot === "key") return "证物 · 不占格、不计重";
    parts.push(`占 ${itemShape(piece.id, 0).length} 格`);
    parts.push(`重 ${itemWeight(piece.id)}`);
    return parts.join(" · ");
  }

  function paintCard(s, selected, where) {
    const card = $("bag-card");
    if (!card) return;
    card.innerHTML = "";
    if (!selected) {
      card.classList.add("empty");
      card.textContent = "点一下物品看详情";
      paintStatBars(null);
      return;
    }
    paintStatBars(selected.id);
    card.classList.remove("empty");
    const it = itemDef(selected.id);
    const pic = document.createElement("div");
    pic.className = "bag-card-pic";
    const v = makeItemVisual(selected.id, 0);
    pic.appendChild(v);
    /* 图框大小随屏幕变（手机上只有 56px），按实际大小摆图，免得露半截 */
    if (v.tagName === "IMG") requestAnimationFrame(() => fitOpaqueIntoBox(v, pic.clientWidth || 88, pic.clientHeight || 88));
    const info = document.createElement("div");
    info.className = "bag-card-info";
    const name = document.createElement("h3");
    name.textContent = it ? it.name : selected.id;
    const tag = document.createElement("p");
    tag.className = "bag-card-where";
    const held = selected.uid && (selected.uid === equippedUid(s, "weapon") || armorPieces(s).some((p) => p.uid === selected.uid));
    tag.textContent = where + (held ? (itemHomeZone(selected.id) === "armor" ? " · 穿着" : " · 拿在手中") : "");
    const stat = document.createElement("p");
    stat.className = "bag-card-stat";
    stat.textContent = itemStatLine(it, selected);
    info.append(name, tag, stat);
    card.append(pic, info);
  }

  function tryPlaceCarry() {
    if (!carry || !api) return false;
    updateCarrySnap();
    const snap = hoverCell;
    if (!snap || !snap.ok) {
      toastBag("此处放不下");
      return false;
    }
    const d = carry;
    let ok = false;
    if (snap.zone === "staging") {
      ok = !!api.putToStaging && api.putToStaging(d.uid, d.from);
      if (!ok) { toastBag("此物不可放下"); return false; }
      finishCarry(null);
      return true;
    }
    if (!zoneAllowsItem(snap.zone, carry.id)) {
      toastBag(snap.zone === "weapon" ? "此处仅放兵器" : snap.zone === "armor" ? "此处仅放护甲" : "放不下");
      return false;
    }
    if (snap.displace) {
      const moved = api.placeDisplacing && api.placeDisplacing(d.uid, d.from, snap.zone, snap.x, snap.y, d.rot);
      if (!moved) { toastBag("此处放不下"); return false; }
      const where = { bag: "行囊", weapon: "兵器架", staging: "待收区" };
      toastBag(moved.map(([n, z]) => `${n}挪到${where[z] || "原处"}`).join(" · "));
      finishCarry(d.uid);
      return true;
    }
    if (isSlotZone(snap.zone)) {
      if (d.from === "staging") {
        ok = !snap.swap && api.placeFromStagingToZone(d.uid, snap.zone, snap.x, 0, 0);
        if (!ok && snap.swap) toastBag("先把这个位上的东西拖进行囊");
      } else {
        ok = !!api.slotPlace && api.slotPlace(d.uid, snap.zone, snap.x);
        if (!ok) toastBag(armorPart(d.id) !== snap.x ? (snap.x === 0 ? "这里只放头盔" : "这里只放身甲") : "行囊放不下换下来的那件");
      }
      if (!ok) return false;
      carry = null;
      hoverCell = null;
      document.body.classList.remove("bag-carrying");
      syncCarryGhost();
      selectedUid = d.uid;
      selectedFromStaging = false;
      if (typeof SFX !== "undefined") SFX.play("bag_place");
      paintBag();
      if (api.onHud) api.onHud();
      return true;
    }
    if (d.from === "staging") {
      ok = !!(api.placeFromStagingToZone || api.placeFromStaging) &&
        (api.placeFromStagingToZone
          ? api.placeFromStagingToZone(d.uid, snap.zone, snap.x, snap.y, d.rot)
          : api.placeFromStaging(d.uid, snap.x, snap.y, d.rot, snap.zone));
    } else if (d.from === snap.zone) {
      if (snap.zone === "weapon") ok = !!api.moveWeaponPiece && api.moveWeaponPiece(d.uid, snap.x, snap.y, d.rot);
      else if (snap.zone === "armor") ok = !!api.moveArmorPiece && api.moveArmorPiece(d.uid, snap.x, snap.y, d.rot);
      else ok = !!api.moveBagPiece && api.moveBagPiece(d.uid, snap.x, snap.y, d.rot);
    } else if (api.transferPiece) {
      ok = !!api.transferPiece(d.uid, d.from, snap.zone, snap.x, snap.y, d.rot);
    }
    if (!ok) {
      toastBag("此处放不下");
      return false;
    }
    carry = null;
    hoverCell = null;
    document.body.classList.remove("bag-carrying");
    syncCarryGhost();
    selectedUid = d.uid;
    selectedFromStaging = false;
    if (typeof SFX !== "undefined") SFX.play("bag_place");
    paintBag();
    return true;
  }

  /** 放下之后收尾：清掉拖着的状态，选中放下的那件 */
  function finishCarry(uid) {
    carry = null;
    hoverCell = null;
    document.body.classList.remove("bag-carrying");
    syncCarryGhost();
    selectedUid = uid;
    selectedFromStaging = false;
    if (typeof SFX !== "undefined") SFX.play("bag_place");
    paintBag();
    if (api.onHud) api.onHud();
  }

  function onBagPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!carry) return;
    moveCarryGhost();
    updateCarrySnap();
  }

  function onBagDocClick(e) {
    if (!carry) return;
    const modal = $("bag-modal");
    if (!modal || modal.hidden) return;
    if (performance.now() < ignorePlaceUntil) return;
    if (e.target.closest(".bag-actions, #bag-close, .bag-tubes, .px-btn")) return;
    if (e.target.closest(".bag-staging-item, .bag-cell.filled")) return;
    if (e.target.closest("#bag-grid, #weapon-grid, #armor-grid, .bag-racks, .bag-staging-wrap, .bag-staging, #bag-ground")) {
      e.preventDefault();
      e.stopPropagation();
      tryPlaceCarry();
    }
  }

  function setMsg(t) {
    const m = $("btl-msg");
    if (m) m.textContent = t || "";
  }

  function paintHp() {
    /* 气血已在侧栏；此处刷新回合显示 */
    const s = api.getState();
    const clock = $("clock");
    if (clock && s.combat) clock.textContent = `第 ${s.combat.round} 合`;
    if (api.onHud) api.onHud();
  }

  function paintFoes(opts = {}) {
    const doPortrait = opts.portrait !== false;
    const c = api.getState().combat;
    const box = $("btl-foes");
    if (!box) return;
    box.innerHTML = "";
    if (targetIdx < 0 || !c.enemies[targetIdx] || c.enemies[targetIdx].hp <= 0) {
      targetIdx = c.enemies.findIndex((e) => e.hp > 0);
    }
    c.enemies.forEach((e, i) => {
      const d = document.createElement("div");
      d.className =
        "foe-line" + (e.hp <= 0 ? " dead" : "") + (i === targetIdx && e.hp > 0 ? " focus" : "");
      d.dataset.idx = String(i);
      const hpPct = Math.max(0, e.hp) / e.maxHp * 100;
      d.innerHTML =
        `<span class="foe-name">${e.name}</span>` +
        `<span class="foe-hp"><i style="width:${hpPct}%"></i></span>` +
        `<span class="foe-num">${Math.max(0, e.hp)}/${e.maxHp}</span>` +
        `<span class="foe-intent"></span>` +
        `<span class="foe-charge"><i></i></span>`;
      if (e.hp > 0) {
        d.onclick = () => {
          if (i === targetIdx || locked()) return;
          swapTarget(i);
        };
      }
      box.appendChild(d);
    });
    if (!doPortrait) return;
    const focus = c.enemies[targetIdx];
    if (focus && focus.hp > 0) paintPortrait(focus);
  }

  /** 每帧刷新蓄力条和意图（不重建 DOM） */
  function updateFoeBars() {
    const c = api.getState().combat;
    const box = $("btl-foes");
    if (!box || !c) return;
    box.querySelectorAll(".foe-line").forEach((d) => {
      const e = c.enemies[+d.dataset.idx];
      if (!e) return;
      const bar = d.querySelector(".foe-charge i");
      const tag = d.querySelector(".foe-intent");
      if (!bar || !tag) return;
      const striking = rt && rt.windup && rt.windup.idx === +d.dataset.idx;
      bar.style.width = (e.hp > 0 ? Math.min(1, e.charge || 0) * 100 : 0) + "%";
      const slow = rt && performance.now() < rt.slowUntil;
      tag.textContent = e.hp <= 0 ? "" : e.stun > 0 ? `发怔 ${e.stun.toFixed(1)}秒` : slow ? `迟缓 · ${intentOf(e).name}` : intentOf(e).name;
      d.classList.toggle("stunned", e.hp > 0 && e.stun > 0);
      d.classList.toggle("slowed", e.hp > 0 && !!slow && !(e.stun > 0));
      d.classList.toggle("warn", e.hp > 0 && (e.charge || 0) > 0.75);
      d.classList.toggle("striking", !!striking);
      d.classList.toggle("heavy", e.hp > 0 && !!intentOf(e).heavy);
    });
  }

  let woundEnemyId = null;
  let artAnimToken = 0;

  /** 获取立绘缩小版的不透明像素坐标列表（用于击影定位）
   *  1. 填内部孔洞（抠图残留镂空）
   *  2. 形态学开运算 + 边缘腐蚀 + 连通区域分析，排除细长武器/帽檐/悬空孤岛
   *  file:// 协议下 canvas 读不到本地像素，优先用预计算的 ENEMY_HIT_POINTS */
  function getOpaquePixels(imgEl) {
    /* 优先用预计算数据（file:// 下 getImageData 会被 CORS 阻止） */
    if (typeof ENEMY_HIT_POINTS !== "undefined" && imgEl) {
      const file = (imgEl.currentSrc || imgEl.src || "").split("/").pop().split("?")[0];
      const pts = ENEMY_HIT_POINTS[file];
      if (pts && pts.length) return pts;
    }
    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) return null;
    try {
      const c = document.createElement("canvas");
      const maxDim = 128;
      const scale = Math.min(1, maxDim / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
      const cw = Math.max(1, Math.round(imgEl.naturalWidth * scale));
      const ch = Math.max(1, Math.round(imgEl.naturalHeight * scale));
      /* 扩展 1px 透明边框，确保 flood fill 能从四面进入（立绘可能贴边） */
      const pw = cw + 2;
      const ph = ch + 2;
      c.width = pw;
      c.height = ph;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(imgEl, 1, 1, cw, ch);
      const { data } = ctx.getImageData(0, 0, pw, ph);
      /* 1. 生成不透明位图（含 1px 透明边框） */
      const opaque = new Uint8Array(pw * ph);
      for (let i = 0; i < pw * ph; i++) {
        opaque[i] = data[i * 4 + 3] > 40 ? 1 : 0;
      }
      /* 2. 填内部孔洞：flood fill 从四边标记外部透明区域，未被标记的透明=内部孔洞，填实 */
      const visited = new Uint8Array(pw * ph);
      const stack = [];
      for (let x = 0; x < pw; x++) {
        if (!opaque[x]) stack.push(x, 0);
        if (!opaque[(ph - 1) * pw + x]) stack.push(x, ph - 1);
      }
      for (let y = 0; y < ph; y++) {
        if (!opaque[y * pw]) stack.push(0, y);
        if (!opaque[y * pw + pw - 1]) stack.push(pw - 1, y);
      }
      while (stack.length) {
        const py = stack.pop();
        const px = stack.pop();
        const idx = py * pw + px;
        if (visited[idx] || opaque[idx]) continue;
        visited[idx] = 1;
        if (px > 0) { const ni = py * pw + px - 1; if (!visited[ni] && !opaque[ni]) stack.push(px - 1, py); }
        if (px < pw - 1) { const ni = py * pw + px + 1; if (!visited[ni] && !opaque[ni]) stack.push(px + 1, py); }
        if (py > 0) { const ni = (py - 1) * pw + px; if (!visited[ni] && !opaque[ni]) stack.push(px, py - 1); }
        if (py < ph - 1) { const ni = (py + 1) * pw + px; if (!visited[ni] && !opaque[ni]) stack.push(px, py + 1); }
      }
      const filled = new Uint8Array(pw * ph);
      for (let i = 0; i < pw * ph; i++) {
        filled[i] = (opaque[i] || !visited[i]) ? 1 : 0;
      }
      /* 3. 形态学开运算：先腐蚀再膨胀（半径6），自动消除比核细的突起（武器/帽檐），
       *    不需要先断开武器与身体的连接 */
      const openR = 6;
      const eroded = new Uint8Array(pw * ph);
      for (let y = openR; y < ph - openR; y++) {
        for (let x = openR; x < pw - openR; x++) {
          let ok = 1;
          for (let dy = -openR; dy <= openR && ok; dy++) {
            for (let dx = -openR; dx <= openR; dx++) {
              if (!filled[(y + dy) * pw + (x + dx)]) { ok = 0; break; }
            }
          }
          eroded[y * pw + x] = ok;
        }
      }
      const opened = new Uint8Array(pw * ph);
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          const idx = y * pw + x;
          if (eroded[idx]) { opened[idx] = 1; continue; }
          /* 膨胀：邻域有任意 eroded 像素则保留 */
          let found = 0;
          for (let dy = -openR; dy <= openR && !found; dy++) {
            for (let dx = -openR; dx <= openR; dx++) {
              const ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < ph && nx >= 0 && nx < pw && eroded[ny * pw + nx]) { found = 1; break; }
            }
          }
          opened[idx] = found;
        }
      }
      /* 4. 轻度边缘腐蚀 2px，保证击影不贴边 */
      const edgeR = 2;
      const edged = new Uint8Array(pw * ph);
      for (let y = edgeR; y < ph - edgeR; y++) {
        for (let x = edgeR; x < pw - edgeR; x++) {
          let ok = 1;
          for (let dy = -edgeR; dy <= edgeR && ok; dy++) {
            for (let dx = -edgeR; dx <= edgeR; dx++) {
              if (!opened[(y + dy) * pw + (x + dx)]) { ok = 0; break; }
            }
          }
          edged[y * pw + x] = ok;
        }
      }
      /* 5. 连通区域分析：只保留最大连通块（身体主体），删除悬空孤岛（武器残余） */
      const labels2 = new Int32Array(pw * ph);
      let nextLab = 1;
      let bestLab = 0;
      let bestSize = 0;
      for (let y = 1; y < ph - 1; y++) {
        for (let x = 1; x < pw - 1; x++) {
          const idx = y * pw + x;
          if (!edged[idx] || labels2[idx]) continue;
          const q2 = [idx];
          labels2[idx] = nextLab;
          let sz = 0;
          while (q2.length) {
            const ci = q2.pop();
            sz++;
            const cx = ci % pw;
            const cy = (ci - cx) / pw;
            if (cx > 0) { const ni = ci - 1; if (edged[ni] && !labels2[ni]) { labels2[ni] = nextLab; q2.push(ni); } }
            if (cx < pw - 1) { const ni = ci + 1; if (edged[ni] && !labels2[ni]) { labels2[ni] = nextLab; q2.push(ni); } }
            if (cy > 0) { const ni = ci - pw; if (edged[ni] && !labels2[ni]) { labels2[ni] = nextLab; q2.push(ni); } }
            if (cy < ph - 1) { const ni = ci + pw; if (edged[ni] && !labels2[ni]) { labels2[ni] = nextLab; q2.push(ni); } }
          }
          if (sz > bestSize) { bestSize = sz; bestLab = nextLab; }
          nextLab++;
        }
      }
      /* 6. 提取有效点（仅保留最大连通块） */
      const pts = [];
      if (bestLab > 0) {
        for (let y = 1; y < ph - 1; y++) {
          for (let x = 1; x < pw - 1; x++) {
            if (labels2[y * pw + x] === bestLab) pts.push([(x - 1) / cw, (y - 1) / ch]);
          }
        }
      }
      return pts.length ? pts : null;
    } catch (_) {
      return null;
    }
  }

  function applyAlphaMaskToSlashLayer() {
    /* 不再对 btl-slash / btl-wounds 施加 alpha mask 裁剪。
     * 击影生成位置已由 getOpaquePixels() 限定在敌人身体主体（形态学开运算 +
     * 连通区域分析），击影中心在身体内部；刀光/伤口向外延伸不应被截断。 */
    const layer = $("btl-slash");
    if (layer) {
      layer.style.maskImage = "";
      layer.style.webkitMaskImage = "";
    }
    const wl = $("btl-wounds");
    if (wl) {
      wl.style.maskImage = "";
      wl.style.webkitMaskImage = "";
    }
  }

  function resetArtAnim() {
    const wrap = $("btl-art-wrap");
    const img = $("btl-art");
    if (wrap) {
      wrap.classList.remove(
        "foe-entering",
        "foe-dying",
        "foe-dead",
        "hit-flash",
        "whiff",
        "kill-flash",
        "slash-nudge",
      );
    }
    if (img) {
      img.style.transform = "";
      img.style.filter = "";
      img.style.opacity = "";
    }
  }

  function whenPortraitReady() {
    const img = $("btl-art");
    if (!img || img.hidden || !img.getAttribute("src")) return Promise.resolve();
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
      setTimeout(done, 500);
    });
  }

  /* ---------- 站位：前排一个大的，后排小的。换人时用一张替身图从原位置平滑挪过去 ---------- */
  const MOVE_MS = 560;
  const backEl = (idx) => document.querySelector(`#foe-back-row .foe-back[data-idx="${idx}"]:not(.fading-out):not(.leaving-anim)`);
  function backRect(idx) {
    const el = backEl(idx);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width ? { r, src: el.currentSrc || el.src, filter: getComputedStyle(el).filter, opacity: +getComputedStyle(el).opacity } : null;
  }
  function hideBack(idx) {
    const el = backEl(idx);
    if (el) el.remove();
  }
  const motionOk = () => !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /** 替身图从 a 飞到 b（都是屏幕坐标矩形），飞完自己消失 */
  function flyClone(src, a, b, fromStyle, toStyle) {
    const g = document.createElement("img");
    g.src = src;
    g.className = "foe-fly";
    g.style.left = a.left + "px";
    g.style.top = a.top + "px";
    g.style.width = a.width + "px";
    g.style.height = a.height + "px";
    document.body.appendChild(g);
    const anim = g.animate([
      { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", ...fromStyle },
      { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px", ...toStyle },
    ], { duration: MOVE_MS, easing: "cubic-bezier(.33,.66,.3,1)", fill: "forwards" });
    return anim.finished.catch(() => {}).then(() => g.remove());
  }

  /** 后排那个走上前：前排立绘先藏着，替身从后排位置放大挪到前排位置 */
  function flyToFront(from) {
    const img = $("btl-art");
    if (!img || !motionOk()) return Promise.resolve();
    resetArtAnim();
    const to = img.getBoundingClientRect();
    if (!to.width) return Promise.resolve();
    img.style.visibility = "hidden";
    return flyClone(from.src, from.r, to,
      { filter: from.filter, opacity: from.opacity },
      { filter: "none", opacity: 1 },
    ).then(() => { img.style.visibility = ""; });
  }

  /** 点了后排的另一个：两个对换位置，同时挪 */
  function swapTarget(newIdx) {
    const c = api.getState().combat;
    const oldIdx = targetIdx;
    const img = $("btl-art");
    const frontRect = img && img.src ? img.getBoundingClientRect() : null;
    const frontSrc = img ? img.currentSrc || img.src : "";
    const from = backRect(newIdx);
    hideBack(newIdx);
    targetIdx = newIdx;
    paintFoes();
    whenPortraitReady().then(() => {
      const moves = [from ? flyToFront(from) : playEnterAnim()];
      /* 原来的前排退到后排它的新位置 */
      const old = c.enemies[oldIdx];
      const dest = old && old.hp > 0 ? backEl(oldIdx) : null;
      if (dest && frontRect && frontRect.width && motionOk()) {
        const st = getComputedStyle(dest);
        const to = dest.getBoundingClientRect();
        dest.style.visibility = "hidden";
        moves.push(flyClone(frontSrc, frontRect, to, { filter: "none", opacity: 1 }, { filter: st.filter, opacity: +st.opacity })
          .then(() => { dest.style.visibility = ""; }));
      }
      return Promise.all(moves);
    });
  }

  function playEnterAnim() {
    const wrap = $("btl-art-wrap");
    const img = $("btl-art");
    if (!wrap || !img || img.hidden) return Promise.resolve();
    const reduce =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 420 : 1320;
    const token = ++artAnimToken;
    resetArtAnim();
    void wrap.offsetWidth;
    wrap.classList.add("foe-entering");
    if (!reduce && typeof SFX !== "undefined") {
      /* 对齐抬脚峰值：12% / 38% / 63% / 88% ≈ 154 / 486 / 806 / 1126 */
      [150, 480, 800, 1120].forEach((t) => {
        setTimeout(() => {
          if (token !== artAnimToken) return;
          SFX.play("footstep");
        }, t);
      });
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        if (token !== artAnimToken) return resolve();
        wrap.classList.remove("foe-entering");
        resolve();
      }, ms);
    });
  }

  function playDeathAnim() {
    const wrap = $("btl-art-wrap");
    const img = $("btl-art");
    if (!wrap || !img || img.hidden) return Promise.resolve();
    const reduce =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 380 : 1080;
    const token = ++artAnimToken;
    wrap.classList.remove(
      "foe-entering",
      "hit-flash",
      "whiff",
      "kill-flash",
      "slash-nudge",
    );
    void wrap.offsetWidth;
    wrap.classList.add("foe-dying");
    if (typeof SFX !== "undefined") SFX.play("roar");
    return new Promise((resolve) => {
      setTimeout(() => {
        if (token !== artAnimToken) return resolve();
        wrap.classList.remove("foe-dying");
        wrap.classList.add("foe-dead");
        resolve();
      }, ms);
    });
  }

  function clearWounds() {
    const layer = $("btl-wounds");
    if (layer) layer.innerHTML = "";
  }

  function clearFx() {
    const fx = $("btl-fx");
    if (fx) fx.innerHTML = "";
  }

  /** 渲染后排（非选中）敌人缩小立绘，2人右后固定，3人+按 index 分左右 */
  function paintBackRow() {
    const box = $("foe-back-row");
    if (!box) return;
    const c = api.getState().combat;
    if (!c) return;
    const alive = c.enemies.map((e, i) => ({ e, i })).filter((x) => x.e.hp > 0);
    const aliveCount = alive.length;
    const existing = new Map();
    box.querySelectorAll(".foe-back").forEach((el) => {
      if (
        !el.classList.contains("fading-out") &&
        !el.classList.contains("leaving-anim") &&
        !el.classList.contains("side-walking-left") &&
        !el.classList.contains("side-walking-right")
      ) {
        existing.set(el.dataset.id, el);
      }
    });
    const seen = new Set();
    alive.forEach(({ e, i }) => {
      if (i === targetIdx) return;
      /* 退场动画 / 侧移踱步中的元素跳过，等动画结束后再统一处理 */
      const leaving = box.querySelector(`.leaving-anim[data-id="${e.id}"]`);
      if (leaving) return;
      const sideWalking = box.querySelector(
        `.side-walking-left[data-id="${e.id}"], .side-walking-right[data-id="${e.id}"]`,
      );
      if (sideWalking) return;
      seen.add(e.id);
      const src = (COMBAT.portraits && COMBAT.portraits[e.id]) || "";
      if (!src) return;
      let el = existing.get(e.id);
      if (!el) {
        el = document.createElement("img");
        el.className = "foe-back";
        el.dataset.id = e.id;
        el.draggable = false;
        el.alt = e.name;
        box.appendChild(el);
      }
      if (!el.src || el.src.indexOf(src.split("?")[0]) === -1) el.src = src;
      el.dataset.idx = String(i);
      el.style.right = "";
      /* 2人：非选中在右后；3人+：idx<target 左(35%)，idx>target 右(65%)
         不退到容器边缘，推到前面敌人身体后方附近 */
      let newLeft;
      if (aliveCount <= 2) {
        newLeft = "65%";
      } else if (i < targetIdx) {
        newLeft = "35%";
      } else {
        newLeft = "65%";
      }
      const oldLeft = el.style.left;
      if (oldLeft && oldLeft !== newLeft) {
        /* 后排位置切换：触发侧移踱步动画，途中上下起伏 */
        const dir = parseFloat(newLeft) > parseFloat(oldLeft) ? "side-walking-right" : "side-walking-left";
        el.classList.add(dir);
        el.addEventListener(
          "animationend",
          () => {
            el.classList.remove("side-walking-left", "side-walking-right");
            el.style.left = newLeft;
            el.style.transform = "";
          },
          { once: true },
        );
      } else {
        el.style.left = newLeft;
      }
    });
    existing.forEach((el, id) => {
      if (!seen.has(id)) {
        el.classList.add("fading-out");
        setTimeout(() => { if (el.parentNode) el.remove(); }, 540);
      }
    });
  }

  function paintPortrait(enemy) {
    const img = $("btl-art");
    if (!img || !enemy) return;
    if (woundEnemyId !== enemy.id) {
      clearWounds();
      clearFx();
      woundEnemyId = enemy.id;
    }
    const src = (COMBAT.portraits && COMBAT.portraits[enemy.id]) || "";
    if (src) {
      img.src = src;
      img.hidden = false;
      img.alt = enemy.name;
      applyAlphaMaskToSlashLayer();
      paintBackRow();
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      const layer = $("btl-slash");
      if (layer) {
        layer.style.maskImage = "";
        layer.style.webkitMaskImage = "";
      }
    }
  }

  function waitFrame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }


  function spawnBlood(xPct, yPct) {
    const fx = $("btl-fx");
    if (!fx) return;
    const n = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const d = document.createElement("span");
      d.className = "blood-dot";
      const ang = -Math.PI * 0.15 + Math.random() * (Math.PI * 1.3);
      const dist = 16 + Math.random() * 48;
      d.style.left = xPct + "%";
      d.style.top = yPct + "%";
      d.style.setProperty("--bx", Math.cos(ang) * dist + "px");
      d.style.setProperty("--by", Math.sin(ang) * dist - 8 + "px");
      d.style.setProperty("--bs", String(0.45 + Math.random() * 1.35));
      d.style.setProperty("--br", String(-40 + Math.random() * 80) + "deg");
      fx.appendChild(d);
      setTimeout(() => {
        if (d.parentNode) d.parentNode.removeChild(d);
      }, 580);
    }
  }

  function addWound(xPct, yPct, rot, dmgType) {
    const layer = $("btl-wounds");
    if (!layer) return;
    const type = dmgType || "slash";
    const w = document.createElement("span");
    w.className = `wound wound-${type}`;
    w.style.left = xPct + "%";
    w.style.top = yPct + "%";
    if (type === "slash") {
      const len = 28 + Math.random() * 22;
      w.style.width = len + "px";
      w.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    } else if (type === "blunt") {
      const size = 10 + Math.random() * 8;
      w.style.width = size + "px";
      w.style.height = size + "px";
      w.style.transform = "translate(-50%, -50%)";
    } else if (type === "pierce") {
      w.style.width = 14 + "px";
      w.style.height = 14 + "px";
      w.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    }
    layer.appendChild(w);
  }


  function hideTimer() {
    const bar = $("slash-timer");
    const fill = $("slash-timer-fill");
    if (bar) bar.hidden = true;
    if (fill) {
      fill.style.transform = "scaleX(1)";
      fill.classList.remove("running");
    }
    if (slashRaf) {
      cancelAnimationFrame(slashRaf);
      slashRaf = null;
    }
  }

  function unbindSlashInput() {
    const wrap = $("btl-art-wrap");
    if (!wrap) return;
    wrap.onpointerdown = wrap.onpointermove = wrap.onpointerup = wrap.onpointercancel = null;
    wrap.classList.remove("slashing");
  }

  function clearSlash() {
    if (slashTimer) {
      clearTimeout(slashTimer);
      slashTimer = null;
    }
    hideTimer();
    unbindSlashInput();
    slashState = null;
    const layer = $("btl-slash");
    if (layer) layer.innerHTML = "";
  }

  function menuButtons(pairs) {
    const menu = $("commands");
    const title = $("cmd-title");
    if (title) title.textContent = "战法";
    if (!menu) return;
    menu.innerHTML = "";
    const row = document.createElement("div");
    row.className = "cmd-row battle-cmds";
    pairs.forEach(([label, fn, sub]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cmd fight";
      b.innerHTML = sub ? `${label}<span class="sub">${sub}</span>` : label;
      b.onclick = fn;
      row.appendChild(b);
    });
    menu.appendChild(row);
  }

  /* ========== 指令：半即时下随时可点；格挡圈、收刀冷却、出手中时变灰 ========== */

  function locked() {
    if (!rt) return true;
    return !!rt.windup || rt.anim || performance.now() < rt.busyUntil || phase === "slash" || phase === "shoot" || phase === "reload" || phase === "switch";
  }

  function showMainMenu() {
    if (!active) return;
    if (phase !== "slash" && phase !== "shoot" && phase !== "reload" && phase !== "switch") phase = "menu";
    paintHp();
    const s = api.getState();
    const c = s.combat;
    if (!c) return;
    const mode = typeof firearmAttackMode === "function" ? firearmAttackMode(s) : "melee";
    const wid = typeof equippedId === "function" ? equippedId(s, "weapon") : null;
    const spec = wid && typeof firearmSpec === "function" ? firearmSpec(wid) : null;
    const busy = rt && performance.now() < rt.busyUntil;
    const pairs = [];
    if (mode === "shoot") {
      pairs.push(["射击", () => beginAttack(), `余弹 ${gunLoadedCount(s, wid)}`]);
    } else if (mode === "empty") {
      pairs.push(["射击", () => toastBag("空膛 · 请装填或换兵器"), "无弹"]);
    } else {
      pairs.push(["攻击", () => beginAttack(), busy ? "收刀中…" : mode === "smash" ? "倒持砸击" : `连划 ${Math.max(1, slashComboOf(s))} 处`]);
    }
    if (spec && spec.combatReload && mode === "empty" && hasReloadKit(s)) {
      pairs.push(["填装", () => doCombatReload(), phase === "reload" ? "装填中…" : "约两秒"]);
    }
    const weapons = typeof allWeaponPieces === "function" ? allWeaponPieces(s) : weaponPieces(s);
    const nextW = nextRackWeapon(s);
    if (nextW) pairs.push(["换武", () => beginSwitchWeapon(), `换${(itemDef(nextW.id) || {}).name || "兵器"} · 约 ${(switchMs(nextW.id) / 1000).toFixed(1)} 秒`]);
    (c.props || []).forEach((p) => {
      if (!c.propsUsed.includes(p.id)) pairs.push([p.name, () => useProp(p), propHint(p)]);
    });
    pairs.push(
      ["物品", () => openBagSession({ fromBattle: true, reason: "manage" }), "翻找时光阴减半"],
      ["逃离", () => tryFlee(), performance.now() < (c.fleeReadyAt || 0)
        ? `缓一缓 · ${Math.ceil(((c.fleeReadyAt || 0) - performance.now()) / 1000)} 秒`
        : `约 ${Math.round(fleeChanceOf(c) * 100)}%`],
    );
    menuButtons(pairs);
    const dis = locked();
    $("commands").querySelectorAll("button").forEach((b) => { b.disabled = dis; });
    const fleeBtn = [...$("commands").querySelectorAll("button")].pop();
    if (fleeBtn && performance.now() < (c.fleeReadyAt || 0)) fleeBtn.disabled = true;
    if (c.counter && rt && performance.now() < c.counterUntil) setMsg("反击良机 · 这一击伤害 ×1.3");
  }

  /** 出手结束：进入冷却，到点自动亮回按钮 */
  function afterAction(ms) {
    if (!active || !rt) return;
    phase = "menu";
    rt.busyUntil = performance.now() + (ms || 0);
    showMainMenu();
    clearTimeout(rt.menuT);
    rt.menuT = setTimeout(() => { if (active && !rt.windup) showMainMenu(); }, (ms || 0) + 30);
  }

  /** 兵器架上按顺序轮到的下一把 */
  function nextRackWeapon(s) {
    const list = allWeaponPieces(s);
    if (list.length < 2) return null;
    const i = list.findIndex((p) => p.uid === equippedUid(s, "weapon"));
    return list[(i + 1) % list.length];
  }

  /** 换兵器要时间：越重越慢，这段时间里敌人照样蓄力 */
  const switchMs = (id) => Math.round(700 + itemWeight(id) * 100);

  function beginSwitchWeapon() {
    const s = api.getState();
    const next = nextRackWeapon(s);
    if (!next) return toastBag("兵器架上没有别的兵器");
    phase = "switch";
    setMsg(`正在换${(itemDef(next.id) || {}).name || "兵器"}…`);
    showMainMenu();
    clearTimeout(rt.switchT);
    rt.switchT = setTimeout(() => {
      if (!active || phase !== "switch") return;
      if (api.switchHeldWeapon) api.switchHeldWeapon(next.uid);
      afterAction(0);
    }, switchMs(next.id));
  }

  function doCombatReload() {
    const s = api.getState();
    const wid = equippedId(s, "weapon");
    const spec = firearmSpec(wid);
    if (!spec || !spec.combatReload || !hasReloadKit(s)) return setMsg("药料不足");
    phase = "reload";
    setMsg("装填中…");
    showMainMenu();
    clearTimeout(rt.reloadT);
    rt.reloadT = setTimeout(() => {
      if (!active || phase !== "reload") return;
      if (consumeReloadKit(s)) {
        const g = ensureGunState(s, wid);
        g.tubes = g.tubes.map(() => 1);
        g.barrel = 0;
        api.log(`你给${itemDef(wid).name}重新装上药弹。`);
        setMsg("装填完毕");
        if (api.onHud) api.onHud();
      }
      afterAction(150);
    }, 2000);
  }

  /** 场景里的一次性道具：唤腰牌、扯铁链、摇铜铃…… */
  /** 画面上方飘一行字，说清楚道具起了什么作用 */
  function showPropBanner(text) {
    const wrap = $("btl-portrait");
    if (!wrap) return;
    const b = document.createElement("div");
    b.className = "prop-banner";
    b.textContent = text;
    wrap.appendChild(b);
    setTimeout(() => b.remove(), 2400);
  }

  function useProp(p) {
    const c = api.getState().combat;
    if (c.propsUsed.includes(p.id)) return;
    c.propsUsed.push(p.id);
    if (p.effect === "stun") {
      const e = c.enemies[targetIdx];
      if (e && e.hp > 0) { e.stun = p.sec; e.charge = Math.max(0, e.charge - 0.3); }
      api.log(`你${p.name}，${e ? e.name : "它"}一时愣住了，这几秒砍它格外吃力。`);
      showPropBanner(`${e ? e.name : "它"}发怔 ${p.sec} 秒 · 伤害 ×${STUN_MULT}`);
    } else if (p.effect === "slow") {
      rt.slowUntil = performance.now() + p.sec * 1000;
      api.log(`你${p.name}，四下的行尸都慢了下来。`);
      showPropBanner(`全场迟缓 ${p.sec} 秒 · 蓄力减半`);
    }
    setMsg(p.desc);
    afterAction(300);
  }

  function beginAttack() {
    if (locked()) return;
    const s = api.getState();
    const c = s.combat;
    if (!alive(c).length) return api.onWin();
    if (!c.enemies[targetIdx] || c.enemies[targetIdx].hp <= 0) targetIdx = c.enemies.findIndex((e) => e.hp > 0);
    const mode = typeof firearmAttackMode === "function" ? firearmAttackMode(s) : "melee";
    if (mode === "shoot") startShoot();
    else if (mode === "smash") startSmash();
    else startSlash();
  }

  function startSmash() {
    /* 倒持砸：走划刀，但结算用砸伤 */
    api.getState()._smashShot = true;
    startSlash();
  }

  function wait(ms) {
    return new Promise((r) => {
      slashTimer = setTimeout(r, ms);
    });
  }

  /* ========== 划刀：按住在敌人身上划过，划过身体算中，划过破绽算暴击 ========== */

  /** 读立绘像素，返回 alpha 查询器和不透明包围盒（图片坐标） */
  function portraitMask(img) {
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    let data = null;
    try {
      const c = document.createElement("canvas");
      c.width = nw;
      c.height = nh;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      data = ctx.getImageData(0, 0, nw, nh).data;
    } catch (_) {
      data = null; /* file:// 读不到像素：整张图都算身体 */
    }
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= nw || y >= nh) return false;
      if (!data) return true;
      return data[((y | 0) * nw + (x | 0)) * 4 + 3] > 40;
    };
    let x0 = nw, y0 = nh, x1 = 0, y1 = 0;
    for (let y = 0; y < nh; y += 3) {
      for (let x = 0; x < nw; x += 3) {
        if (solid(x, y)) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = nw; y1 = nh; }
    return { nw, nh, data, solid, box: { x0, y0, x1, y1 } };
  }

  /** 图片坐标 -> btl-art-wrap 内百分比 */
  function imgToWrapPct(img, x, y) {
    const wrap = $("btl-art-wrap");
    const r = img.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const ox = r.left + (r.width - img.naturalWidth * scale) / 2;
    const oy = r.top + (r.height - img.naturalHeight * scale) / 2;
    return {
      x: ((ox + x * scale - wr.left) / wr.width) * 100,
      y: ((oy + y * scale - wr.top) / wr.height) * 100,
      cx: ox + x * scale,
      cy: oy + y * scale,
      scale,
    };
  }

  function popDamage(xPct, yPct, text, kind) {
    const fx = $("btl-fx");
    if (!fx) return;
    const d = document.createElement("span");
    d.className = `dmg-pop ${kind || ""}`;
    d.textContent = text;
    d.style.left = xPct + "%";
    d.style.top = yPct + "%";
    fx.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  function shakeStage(strength) {
    const st = document.querySelector(".stage-col");
    if (!st) return;
    st.style.setProperty("--shake", (strength || 6) + "px");
    st.classList.remove("px-shake");
    void st.offsetWidth;
    st.classList.add("px-shake");
    clearTimeout(st._shT);
    st._shT = setTimeout(() => st.classList.remove("px-shake"), 260);
  }

  /** 打中瞬间的停顿：立绘定格 + 白闪 */
  function hitStop(ms) {
    const wrap = $("btl-art-wrap");
    if (!wrap) return;
    wrap.classList.add("hitstop");
    setTimeout(() => wrap.classList.remove("hitstop"), ms || 70);
  }

  function ensureTrailCanvas() {
    const wrap = $("btl-art-wrap");
    let cv = $("slash-trail");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.id = "slash-trail";
      cv.className = "slash-trail";
      wrap.appendChild(cv);
    }
    const r = wrap.getBoundingClientRect();
    /* 低分辨率画布 + 像素化放大，刀光自带像素颗粒 */
    cv.width = Math.max(1, Math.round(r.width / 3));
    cv.height = Math.max(1, Math.round(r.height / 3));
    return cv;
  }

  function drawTrail(cv, pts, alpha, color) {
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (pts.length < 2) return;
    const wrap = $("btl-art-wrap");
    const wr = wrap.getBoundingClientRect();
    const sx = cv.width / wr.width;
    const sy = cv.height / wr.height;
    ctx.imageSmoothingEnabled = false;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    const path = () => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = Math.round((p.x - wr.left) * sx);
        const y = Math.round((p.y - wr.top) * sy);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
    };
    ctx.globalAlpha = alpha;
    path();
    ctx.strokeStyle = color || "#9a2b1f";
    ctx.lineWidth = 5;
    ctx.stroke();
    path();
    ctx.strokeStyle = "#f4ecd8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function fadeTrail(cv, pts, color) {
    let a = 1;
    const step = () => {
      a -= 0.12;
      if (a <= 0 || !cv.isConnected) {
        if (cv.isConnected) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
        return;
      }
      drawTrail(cv, pts, a, color);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** 在身体上撒破绽：上半身偏多，彼此拉开距离 */
  /* ========== 划刀：一笔连划，弱点划中一处才亮下一处；墨量（笔画长度）和时限都有限 ========== */

  /** 收刀冷却：兵器越沉越久 */
  function weaponCooldownMs(w) {
    return 450 + Math.min(900, (w.dmg || 15) * 9);
  }

  /** 下一处弱点：在身上，离上一处不远不近，避开已划过的 */
  function nextSpot(mask, prev, used) {
    const { box, solid } = mask;
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const unit = Math.min(bw, bh);
    for (let t = 0; t < 400; t++) {
      const x = box.x0 + bw * (0.15 + Math.random() * 0.7);
      const y = box.y0 + bh * (0.1 + Math.random() * 0.62);
      if (!solid(x, y)) continue;
      if (prev) {
        const d = Math.hypot(x - prev.x, y - prev.y);
        if (d < unit * 0.22 || d > unit * 0.6) continue;
      }
      if (used.some((u) => Math.hypot(u.x - x, u.y - y) < unit * 0.18)) continue;
      return { x, y };
    }
    return { x: (box.x0 + box.x1) / 2, y: box.y0 + bh * 0.4 };
  }

  function showSpot(p) {
    const st = slashState;
    st.cur = p;
    st.spots.push(p);
    const q = imgToWrapPct(st.img, p.x, p.y);
    const d = document.createElement("span");
    d.className = "weak-spot fresh";
    d.dataset.i = String(st.spots.length - 1);
    d.style.left = q.x + "%";
    d.style.top = q.y + "%";
    $("btl-slash").appendChild(d);
  }

  function inkColor(st) {
    const left = st.ink / st.inkMax;
    return left > 0.5 ? "#9a2b1f" : left > 0.2 ? "#6e1f16" : "#3d3830";
  }

  async function startSlash() {
    phase = "slash";
    clearSlash();
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[targetIdx];
    if (!enemy || enemy.hp <= 0) { phase = "menu"; return showMainMenu(); }
    paintPortrait(enemy);
    showMainMenu();
    await whenPortraitReady();
    if (!active || !rt || rt.windup || phase !== "slash") return;
    const img = $("btl-art");
    const wrap = $("btl-art-wrap");
    if (!img || !img.naturalWidth || !wrap) { phase = "menu"; return showMainMenu(); }
    const w = weaponOfFirearmAware ? weaponOfFirearmAware(s) : weaponOf(s);
    const needed = Math.max(1, slashComboOf(s));
    const mask = portraitMask(img);
    const scale = imgToWrapPct(img, 0, 0).scale;
    const unitPx = Math.min(mask.box.x1 - mask.box.x0, mask.box.y1 - mask.box.y0) * scale;
    const M = COMBAT.melee;
    const ink = unitPx * (M.inkPerSpot * needed + M.inkBase);
    slashState = {
      needed, hits: 0, body: 0, enemyIdx: targetIdx, done: false, phase: "input",
      dmgType: w.dmgType || "slash", mask, img, scale, spots: [], cur: null,
      ink, inkMax: ink, pts: null, cut: [],
      spotR: Math.max(16, 26 / scale),
    };
    $("btl-slash").innerHTML = "";
    showSpot(nextSpot(mask, null, []));
    setMsg(needed > 1 ? `一刀连划 ${needed} 处破绽 · 划中一处才亮下一处` : "按住，一刀划过那处破绽");
    const cv = ensureTrailCanvas();
    wrap.classList.add("slashing");
    wrap.onpointerdown = (e) => {
      const st = slashState;
      if (!st || st.done || st.pts) return;
      e.preventDefault();
      if (wrap.setPointerCapture) wrap.setPointerCapture(e.pointerId);
      st.pts = [{ x: e.clientX, y: e.clientY }];
      sampleStroke(st.pts[0], st.pts[0]);
      if (typeof SFX !== "undefined") SFX.play("slash_whoosh");
    };
    wrap.onpointermove = (e) => {
      const st = slashState;
      if (!st || st.done || !st.pts) return;
      const last = st.pts[st.pts.length - 1];
      let d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
      if (d < 3) return;
      /* 墨不够就只走到墨尽处 */
      let p = { x: e.clientX, y: e.clientY };
      if (d > st.ink) {
        const k = st.ink / d;
        p = { x: last.x + (p.x - last.x) * k, y: last.y + (p.y - last.y) * k };
        d = st.ink;
      }
      st.ink -= d;
      sampleStroke(last, p);
      if (!slashState || slashState.done) return;
      st.pts.push(p);
      if (st.pts.length > 90) st.pts.shift();
      drawTrail(cv, st.pts, 1, inkColor(st));
      if (st.ink <= 0.5) endStroke("ink");
    };
    const up = () => { if (slashState && slashState.pts && !slashState.done) endStroke("release"); };
    wrap.onpointerup = up;
    wrap.onpointercancel = up;
    startMeleeTimer(M.baseWindowMs + M.perSpotMs * needed);
  }

  /** 沿笔画采样：碰身体记擦伤，碰到当前弱点就亮下一处 */
  function sampleStroke(a, b) {
    const st = slashState;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    for (let k = 0; k <= n; k++) {
      const x = a.x + (b.x - a.x) * (k / n);
      const y = a.y + (b.y - a.y) * (k / n);
      const m = mapPointerToImage(st.img, x, y);
      if (!m || !st.mask.solid(m.x, m.y)) continue;
      st.body++;
      if (st.body % 4 === 0) st.cut.push({ cx: x, cy: y });
      if (st.cur && Math.hypot(m.x - st.cur.x, m.y - st.cur.y) <= st.spotR) {
        hitSpot(x, y);
        if (!slashState || slashState.done) return;
      }
    }
  }

  function hitSpot(cx, cy) {
    const st = slashState;
    const el = $("btl-slash").querySelector(`.weak-spot[data-i="${st.spots.length - 1}"]`);
    if (el) el.classList.add("broken");
    st.hits++;
    st.cur = null;
    const wr = $("btl-art-wrap").getBoundingClientRect();
    spawnBlood(((cx - wr.left) / wr.width) * 100, ((cy - wr.top) / wr.height) * 100);
    hitStop(45);
    if (typeof SFX !== "undefined") SFX.play("slash_hit");
    if (st.hits >= st.needed) return endStroke("done");
    showSpot(nextSpot(st.mask, st.spots[st.spots.length - 1], st.spots));
  }

  function startMeleeTimer(ms) {
    const bar = $("slash-timer");
    const fill = $("slash-timer-fill");
    if (bar && fill) { bar.hidden = false; fill.style.transform = "scaleX(1)"; }
    const t0 = performance.now();
    const tick = (now) => {
      const st = slashState;
      if (!st || st.done) return;
      const p = Math.max(0, 1 - (now - t0) / ms);
      if (fill) fill.style.transform = `scaleX(${p})`;
      if (p <= 0) return endStroke("time");
      slashRaf = requestAnimationFrame(tick);
    };
    slashRaf = requestAnimationFrame(tick);
  }

  /** 收刀结算：每处弱点一份兵器伤害；一处没中但擦到身体给两成 */
  function endStroke(why) {
    const st = slashState;
    if (!st || st.done) return;
    st.done = true;
    unbindSlashInput();
    hideTimer();
    const cv = $("slash-trail");
    if (cv && st.pts) fadeTrail(cv, st.pts, inkColor(st));
    setTimeout(() => { const l = $("btl-slash"); if (l) l.innerHTML = ""; }, 260);
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[st.enemyIdx];
    const w = weaponOfFirearmAware ? weaponOfFirearmAware(s) : weaponOf(s);
    const smash = !!s._smashShot;
    s._smashShot = false;
    const base = typeof slashHitDamage === "function" ? slashHitDamage(s) : w.dmg || 1;
    let dealt = smash
      ? (st.hits ? Math.round((smashDamage(s) * st.hits) / st.needed) : 0)
      : st.hits * base;
    const graze = !st.hits && st.body >= 4;
    if (graze) dealt = Math.max(1, Math.round(base * COMBAT.melee.grazeRate));
    const mult = counterMult();
    dealt = Math.round(dealt * mult * stunMult(enemy));
    if (w.stamina) s.stamina = Math.max(0, s.stamina - w.stamina * Math.max(1, st.hits));
    slashState = null;

    if (dealt > 0 && enemy && enemy.hp > 0) {
      if (mult > 1) consumeCounter();
      enemy.hp -= dealt;
      pushCharge(st.enemyIdx, st.hits ? 0.18 * st.hits : 0.08);
      const wr = $("btl-art-wrap").getBoundingClientRect();
      const mid = st.cut[Math.floor(st.cut.length / 2)];
      const xPct = mid ? ((mid.cx - wr.left) / wr.width) * 100 : 50;
      const yPct = mid ? ((mid.cy - wr.top) / wr.height) * 100 : 45;
      if (st.pts && st.pts.length > 1) {
        const a = st.pts[0];
        const b = st.pts[st.pts.length - 1];
        addWound(xPct, yPct, (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, st.dmgType);
      }
      const full = st.hits >= st.needed;
      popDamage(xPct, yPct, full && st.needed > 1 ? `尽中 ${dealt}` : String(dealt), full ? "crit" : "");
      pulseArt("hit-flash");
      shakeStage(full ? 10 : 5);
      if (typeof SFX !== "undefined") SFX.play("wound");
      const line = graze
        ? `刀锋擦身而过，${enemy.name}只受了 ${dealt} 点皮肉伤。`
        : full
          ? st.needed > 1
            ? `一刀划过${st.needed}处破绽，${enemy.name}连中${st.needed}刀，受了${dealt}点伤。`
            : `一刀正中破绽，${enemy.name}受了${dealt}点伤。`
          : `划中${st.hits}处，还有${st.needed - st.hits}处没够着，${enemy.name}受了${dealt}点伤。`;
      setMsg(graze ? `擦身 · ${dealt}` : full ? `尽中！${dealt} 伤` : `中 ${st.hits}/${st.needed} · ${dealt} 伤`);
      api.log(mult > 1 ? `趁势反击！${line}` : line);
    } else {
      setMsg(why === "time" ? "迟了，没能出刀" : "砍空了！");
      api.log(why === "time" ? "时机已过，这一刀没能落下。" : `你挥起${w.name}，却砍了个空。`);
      pulseArt("whiff");
      flashSlashLayer("slash-whiff");
      if (typeof SFX !== "undefined") SFX.play("slash_whiff");
    }
    paintHp();
    paintFoes({ portrait: false });
    if (api.onHud) api.onHud();
    if (enemy && enemy.hp <= 0) return onEnemyKilled(st.enemyIdx);
    afterAction(weaponCooldownMs(w));
  }

  function pulseArt(kind) {
    const wrap = $("btl-art-wrap");
    if (!wrap) return;
    wrap.classList.remove("hit-flash", "whiff", "kill-flash");
    void wrap.offsetWidth;
    wrap.classList.add(kind);
    clearTimeout(wrap._fxT);
    wrap._fxT = setTimeout(() => {
      wrap.classList.remove(kind);
    }, 320);
  }

  function flashSlashLayer(kind) {
    const layer = $("btl-slash");
    if (!layer) return;
    layer.classList.remove("slash-whiff", "slash-hit");
    void layer.offsetWidth;
    layer.classList.add(kind);
    clearTimeout(layer._fxT);
    layer._fxT = setTimeout(() => {
      layer.classList.remove(kind);
    }, 280);
  }

  function clearShootFx() {
    stopReticle();
    const wrap = $("btl-art-wrap");
    if (wrap) {
      wrap.classList.remove("shooting");
      wrap.onpointermove = null;
      wrap.onpointerleave = null;
      wrap.onclick = null;
    }
    if (shootState && shootState.timer) {
      clearTimeout(shootState.timer);
      shootState.timer = null;
    }
    hideTimer();
    shootState = null;
  }

  /** 射击点硝烟/火花：挂 body，避免被清射击层立刻抹掉 */
  function spawnGunDischargeFx(clientX, clientY, img) {
    let lx = clientX;
    let ly = clientY;
    if ((lx == null || ly == null) && shootState && shootState.aim && img) {
      const r = img.getBoundingClientRect();
      const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const ox = r.left + (r.width - dw) / 2;
      const oy = r.top + (r.height - dh) / 2;
      lx = ox + shootState.aim.x * scale;
      ly = oy + shootState.aim.y * scale;
    }
    if (lx == null || ly == null) return;

    const burst = document.createElement("div");
    burst.className = "gun-discharge";
    burst.style.left = `${lx}px`;
    burst.style.top = `${ly}px`;

    const flash = document.createElement("span");
    flash.className = "gun-muzzle-flash";
    burst.appendChild(flash);

    const smokeTones = ["smoke-black", "smoke-gray", "smoke-white"];
    for (let i = 0; i < 44; i++) {
      const p = document.createElement("span");
      p.className = "gun-smoke-pixel " + smokeTones[i % 3];
      const dx = (Math.random() - 0.5) * 84;
      const dy = -56 - Math.random() * 128;
      const size = 5 + Math.floor(Math.random() * 9);
      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);
      p.style.setProperty("--delay", `${Math.random() * 0.22}s`);
      p.style.setProperty("--size", `${size}px`);
      p.style.setProperty("--dur", `${1.05 + Math.random() * 0.55}s`);
      burst.appendChild(p);
    }
    for (let i = 0; i < 42; i++) {
      const sp = document.createElement("span");
      sp.className = "gun-spark";
      const ang = Math.random() * Math.PI * 2;
      const dist = 54 + Math.random() * 114;
      sp.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      sp.style.setProperty("--dy", `${Math.sin(ang) * dist - 16}px`);
      sp.style.setProperty("--delay", `${Math.random() * 0.08}s`);
      sp.style.setProperty("--size", `${2 + (i % 4)}px`);
      burst.appendChild(sp);
    }
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 1800);
  }



  function mapPointerToImage(img, clientX, clientY) {
    if (!img || !img.naturalWidth) return null;
    const r = img.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const scale = Math.min(r.width / nw, r.height / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    const ox = r.left + (r.width - dw) / 2;
    const oy = r.top + (r.height - dh) / 2;
    const x = (clientX - ox) / scale;
    const y = (clientY - oy) / scale;
    if (x < 0 || y < 0 || x >= nw || y >= nh) return null;
    return { x, y, nw, nh, scale, dw, dh, ox, oy };
  }





  async function startShoot() {
    phase = "shoot";
    clearSlash();
    clearShootFx();
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[targetIdx];
    if (!enemy || enemy.hp <= 0) return showMainMenu();
    const wid = equippedId(s, "weapon");
    const spec = firearmSpec(wid);
    if (!spec || !gunHasShot(s, wid)) return showMainMenu();
    showMainMenu();
    paintPortrait(enemy);
    await whenPortraitReady();
    if (!active || !rt || rt.windup || phase !== "shoot") return;
    const img = $("btl-art");
    if (!img || img.hidden || !img.naturalWidth) {
      setMsg("看不清目标");
      return showMainMenu();
    }
    shootState = {
      wid,
      spec,
      enemyIdx: targetIdx,
      shotIndex: 0,
      shotsMax: Math.min(spec.shotsPerTurn || 1, gunLoadedCount(s, wid)),
      done: false,
      aiming: true,
      aim: null,
      timer: null,
    };
    await runOneShotSequence();
  }

  /* ========== 火绳枪：准星手抖晃动，扣火后火绳延迟才响 ========== */

  function stopReticle() {
    if (!shootState) return;
    if (shootState.raf) cancelAnimationFrame(shootState.raf);
    shootState.raf = null;
    if (shootState.onKey) document.removeEventListener("keydown", shootState.onKey);
    shootState.onKey = null;
    const r = $("gun-reticle");
    if (r) r.remove();
    const wrap = $("btl-art-wrap");
    if (wrap) {
      wrap.onpointerdown = null;
      wrap.classList.remove("shooting");
    }
  }

  async function runOneShotSequence() {
    if (!shootState || shootState.done) return;
    const s = api.getState();
    const img = $("btl-art");
    const wrap = $("btl-art-wrap");
    if (!img || !wrap) return finishShootTurn();
    const mask = portraitMask(img);
    shootState.pixels = mask.data;
    shootState.nw = mask.nw;
    shootState.nh = mask.nh;
    const { box } = mask;
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const headY = box.y0 + bh * 0.3;
    /* 体力越低手越抖 */
    const stam = Math.max(0, Math.min(1, (s.stamina || 0) / (WORLD.maxStamina || 100)));
    const amp = Math.min(bw, bh) * (0.42 - 0.18 * stam);
    const speed = (shootState.spec.swaySpeed || 1) * (1.15 - 0.3 * stam);
    const cx0 = box.x0 + bw * 0.5;
    const cy0 = box.y0 + bh * 0.34;
    const ph = [Math.random() * 6, Math.random() * 6, Math.random() * 6, Math.random() * 6];
    const t0 = performance.now();
    const at = (now) => {
      const t = ((now - t0) / 1000) * speed;
      return {
        x: cx0 + amp * (0.62 * Math.sin(t * 1.7 + ph[0]) + 0.38 * Math.sin(t * 3.9 + ph[1])),
        y: cy0 + amp * 0.85 * (0.6 * Math.sin(t * 1.3 + ph[2]) + 0.4 * Math.sin(t * 3.1 + ph[3])),
      };
    };
    const bandAt = (p) => {
      if (!mask.solid(p.x, p.y)) return -1;
      return p.y <= headY ? 0 : 1;
    };

    const ret = document.createElement("div");
    ret.id = "gun-reticle";
    ret.className = "gun-reticle";
    wrap.appendChild(ret);
    wrap.classList.add("shooting");
    shootState.aim = at(t0);
    let recoil = 0;
    const frame = (now) => {
      if (!shootState || shootState.done) return;
      const p = at(now);
      p.y -= recoil;
      recoil *= 0.85;
      shootState.aim = p;
      const q = imgToWrapPct(img, p.x, p.y);
      ret.style.left = q.x + "%";
      ret.style.top = q.y + "%";
      const b = bandAt(p);
      ret.dataset.band = String(b);
      shootState.raf = requestAnimationFrame(frame);
    };
    shootState.raf = requestAnimationFrame(frame);

    setMsg(`第 ${shootState.shotIndex + 1}/${shootState.shotsMax} 发 · 准星变红（头）时扣火 · 火绳有延迟`);
    const fill = $("slash-timer-fill");
    const bar = $("slash-timer");
    if (bar) bar.hidden = false;
    if (fill) {
      fill.style.transition = "none";
      fill.style.transform = "scaleX(1)";
      void fill.offsetWidth;
      fill.style.transition = `transform ${FIREARM.shootWindowMs}ms linear`;
      requestAnimationFrame(() => { fill.style.transform = "scaleX(0)"; });
    }

    let pulled = false;
    const pull = () => {
      if (pulled || !shootState || shootState.done) return;
      pulled = true;
      if (shootState.timer) { clearTimeout(shootState.timer); shootState.timer = null; }
      ret.classList.add("lit");
      if (typeof SFX !== "undefined") SFX.play("aim_beep");
      const fuse = shootState.spec.fuseMs != null ? shootState.spec.fuseMs : 220;
      setTimeout(() => {
        if (!shootState || shootState.done) return;
        const p = shootState.aim;
        const band = bandAt(p);
        const q = imgToWrapPct(img, p.x, p.y);
        recoil = amp * 0.5;
        muzzleFlash();
        shakeStage(band === 0 ? 11 : 7);
        if (band >= 0) {
          hitStop(band === 0 ? 120 : 80);
        }
        shootState.forcedBand = band;
        resolveShotClick(q.cx, q.cy, false);
      }, fuse);
    };
    wrap.onpointerdown = (e) => { e.preventDefault(); pull(); };
    shootState.onKey = (e) => {
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); pull(); }
    };
    document.addEventListener("keydown", shootState.onKey);
    shootState.aiming = false;
    shootState.timer = setTimeout(() => resolveShotClick(null, null, true), FIREARM.shootWindowMs);
  }

  function muzzleFlash() {
    const st = document.querySelector(".stage-col");
    if (!st) return;
    const f = document.createElement("div");
    f.className = "muzzle-flash";
    st.appendChild(f);
    setTimeout(() => f.remove(), 220);
    const fx = $("btl-fx");
    if (!fx) return;
    for (let i = 0; i < 7; i++) {
      const p = document.createElement("span");
      p.className = "smoke-puff";
      p.style.left = 46 + Math.random() * 8 + "%";
      p.style.bottom = "0%";
      p.style.setProperty("--sx", (-40 + Math.random() * 80) + "px");
      p.style.setProperty("--sd", (0.5 + Math.random() * 0.5) + "s");
      fx.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }

  function resolveShotClick(cx, cy, timeout) {
    if (!shootState || shootState.done || shootState.aiming) return;
    stopReticle();
    if (shootState.timer) {
      clearTimeout(shootState.timer);
      shootState.timer = null;
    }
    hideTimer();
    const wrap = $("btl-art-wrap");
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[shootState.enemyIdx];
    const img = $("btl-art");
    const wid = shootState.wid;
    const spec = shootState.spec;
    const band = !timeout && shootState.forcedBand != null ? shootState.forcedBand : -1;
    shootState.forcedBand = null;
    const dmg = typeof shootDamage === "function" ? Math.round(shootDamage(s, band) * counterMult() * stunMult(enemy)) : 0;
    const spent = consumeFirearmShot(s, wid);
    if (spent && spec.usesZichong) {
      toastBag(`子铳−1 · 空壳退回 · 余 ${gunLoadedCount(s, wid)}`);
    }
    if (typeof SFX !== "undefined") SFX.play(band >= 0 ? "gunshot" : "gunshot_miss");
    spawnGunDischargeFx(cx, cy, img);
    let killed = false;
    if (band < 0) {
      setMsg(timeout ? "未及开火" : "打偏了");
      api.log(timeout ? "火机响了，却没对准。" : `弹丸擦空。${enemy.name}还在。`);
      pulseArt("whiff");
    } else {
      const pct = Math.round((FIREARM.hitMult[band] || 0) * 100);
      setMsg(band === 0 ? `爆头！ ${dmg} 伤` : `打中身子 · ${dmg} 伤（${pct}%）`);
      api.log(band === 0 ? `铳响，正中头颅。对${enemy.name}造成 ${dmg} 伤。` : `铳响。对${enemy.name}造成 ${dmg} 伤（${pct}%）。`);
      if (dmg > 0 && enemy) {
        /* 在命中点加伤口 + 血溅（用 btl-art-wrap 的坐标系，和 btl-wounds 层一致） */
        const wrap = $("btl-art-wrap");
        if (wrap && cx != null && cy != null) {
          const r = wrap.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const xPct = ((cx - r.left) / r.width) * 100;
            const yPct = ((cy - r.top) / r.height) * 100;
            const rot = -30 + Math.random() * 60;
            addWound(xPct, yPct, rot, "pierce");
            spawnBlood(xPct, yPct);
            popDamage(xPct, yPct, band === 0 ? `爆头 ${dmg}` : String(dmg), band === 0 ? "crit" : "");
          }
        }
        pulseArt("hit-flash");
        if (typeof SFX !== "undefined") SFX.play("enemy_hit");
        enemy.hp -= dmg;
        if (counterMult() > 1) consumeCounter();
        pushCharge(shootState.enemyIdx, band === 0 ? 0.4 : 0.2);
        if (enemy.hp <= 0) killed = true;
      }
    }
    const aim = $("btl-aim");
    if (aim) aim.remove();
    paintHp();
    paintFoes({ portrait: !killed });
    if (api.onHud) api.onHud();

    const killedIdx = shootState.enemyIdx;
    shootState.shotIndex += 1;
    const canMore = !killed && shootState.shotIndex < shootState.shotsMax && gunHasShot(s, wid);
    if (canMore) {
      setTimeout(() => {
        if (!shootState || shootState.done) return;
        runOneShotSequence();
      }, 420);
      return;
    }
    shootState.done = true;
    clearShootFx();
    /* 喷筒这种一次性的：打空就扔，换下一支或改拿架上别的兵器 */
    const tossed = discardSpentConsumable(s, wid);
    if (tossed) {
      const name = (itemDef(wid) || {}).name || "火器";
      const now = equippedId(s, "weapon");
      api.log(tossed === "next"
        ? `${name}打空了，你随手扔掉，又抽出一支。`
        : `${name}打空了，你随手扔掉${now ? `，改拿${(itemDef(now) || {}).name}` : "，手里只剩一双拳头"}。`, "sys");
      if (api.onHud) api.onHud();
    }
    if (killed) {
      setTimeout(() => onEnemyKilled(killedIdx), 260);
      return;
    }
    afterAction(tossed ? 900 : 800);
  }

  function finishShootTurn() {
    clearShootFx();
    afterAction(600);
  }

  /** 负重对战斗的影响：轻装回体快、好跑；沉重回体慢、格挡圈短、难跑 */
  const LOAD_FX = {
    light: { regen: 1.5, ring: 1, flee: (c) => c + 0.1 },
    normal: { regen: 1, ring: 1, flee: (c) => c },
    heavy: { regen: 0.5, ring: 0.7, flee: (c) => c * 0.5 },
  };
  const loadFx = () => LOAD_FX[loadTier(api.getState())] || LOAD_FX.normal;

  /** 反击良机：完美格挡后一小段时间内的伤害倍率（命中一次即用掉） */
  /** 发怔的敌人挨打更疼 */
  const STUN_MULT = 1.3;
  const stunMult = (e) => (e && e.stun > 0 ? STUN_MULT : 1);

  /** 场景互动按钮下面那行字：写清楚效果 */
  function propHint(p) {
    return p.effect === "stun"
      ? `${p.desc} · 眼前这个发怔 ${p.sec} 秒，砍它伤害 ×${STUN_MULT}`
      : `${p.desc} · 全场蓄力减半 ${p.sec} 秒`;
  }

  function counterMult() {
    const c = api.getState().combat;
    return c && c.counter && performance.now() < (c.counterUntil || 0) ? 1.3 : 1;
  }
  function consumeCounter() {
    const c = api.getState().combat;
    if (c) c.counter = false;
  }

  const FLEE_COOLDOWN_MS = 6000;
  const fleeChanceOf = (c) => Math.max(0.05, Math.min(0.95, loadFx().flee((c.fleeChance || 0.3) + (c.fleeBoost || 0)) - 0.1 * (c.fleeFails || 0)));

  function tryFlee() {
    if (locked()) return;
    const c = api.getState().combat;
    if (performance.now() < (c.fleeReadyAt || 0)) return;
    const chance = fleeChanceOf(c);
    if (Math.random() < chance) {
      setMsg("逃脱！");
      api.log("你退进风雪里，身后的啃咬声久久不散。");
      rtStop();
      setTimeout(() => api.onFlee(), 400);
    } else {
      /* 跑不掉：要缓几秒才能再试，每失败一回再难一分 */
      c.fleeFails = (c.fleeFails || 0) + 1;
      c.fleeReadyAt = performance.now() + FLEE_COOLDOWN_MS;
      setMsg("退路被堵！");
      api.log("退路叫它们堵住了，那牙口离你更近了。");
      afterAction(1200);
      clearTimeout(rt.fleeT);
      rt.fleeT = setTimeout(() => { if (active && rt && !locked()) showMainMenu(); }, FLEE_COOLDOWN_MS + 30);
    }
  }

  /* ========== 半即时引擎：敌人各自蓄力 → 预告 → 格挡圈 → 扑击 ========== */
  let rt = null;
  const RT = () => COMBAT.realtime;
  const intentOf = (e) => COMBAT.intents[e.intent] || COMBAT.intents.bite;

  /* 各敌人的路数：weights 改招式比重，howls 是每场能叫几回人（默认一回） */
  function pickIntent(c, e) {
    const weightOf = (k, v) => (e.weights && e.weights[k] != null ? e.weights[k] : v.weight + (k === "heavy" && e.atk >= 40 ? 1 : 0));
    const pool = Object.entries(COMBAT.intents).filter(([k, v]) => {
      if (k === "howl") return (c.howls || 0) < (e.howls || 1) && alive(c).length < 4 && weightOf(k, v) > 0;
      return weightOf(k, v) > 0;
    });
    let sum = pool.reduce((a, [k, v]) => a + weightOf(k, v), 0);
    let r = Math.random() * sum;
    for (const [k, v] of pool) {
      r -= weightOf(k, v);
      if (r <= 0) return k;
    }
    return "bite";
  }

  function rtStart() {
    const c = api.getState().combat;
    c.enemies.forEach((e) => {
      if (e.charge == null) e.charge = Math.random() * 0.35;
      if (!e.intent) e.intent = pickIntent(c, e);
    });
    rtStop();
    rt = { last: performance.now(), windup: null, busyUntil: 0, anim: false, slowUntil: 0, timer: 0 };
    /* 用定时器而不是 rAF 驱动：掉帧时节奏不乱；切到后台浏览器会压慢定时器，战斗也随之放缓 */
    rt.timer = setInterval(() => rtTick(performance.now()), 50);
  }

  function rtStop() {
    if (!rt) return;
    clearInterval(rt.timer);
    clearTimeout(rt.menuT);
    clearTimeout(rt.reloadT);
    removeRing();
    rt = null;
  }

  function rtTick(now) {
    if (!rt || !active) return;
    const s = api.getState();
    const c = s.combat;
    if (!c) return;
    let dt = Math.min(0.25, (now - rt.last) / 1000);
    rt.last = now;
    if (document.body.classList.contains("bag-managing")) dt *= RT().bagScale;
    if (now < rt.slowUntil) dt *= 0.5;
    if (!rt.anim) {
      if (rt.windup) {
        if (now - rt.windup.t0 >= rt.windup.dur) resolveStrike(null);
      } else {
        c.enemies.forEach((e, i) => {
          if (e.hp <= 0) return;
          if (e.stun > 0) { e.stun -= dt; return; }
          const rate = ((i === targetIdx ? 1 : RT().sideRate) * (e.speed || 1)) / (intentOf(e).time * (c.boss ? 0.8 : 1));
          e.charge = Math.min(1, e.charge + dt * rate);
        });
        const i = c.enemies.findIndex((e) => e.hp > 0 && e.charge >= 1);
        if (i >= 0) beginWindup(i);
      }
      s.stamina = Math.min(maxStaminaOf(s), s.stamina + dt * RT().staminaRegen * loadFx().regen * (s.satiety <= WORLD.hunger.hungry ? 0.5 : 1));
    }
    updateFoeBars();
    if (!rt) return;
    if (now - (rt.hudAt || 0) > 400) { rt.hudAt = now; paintHp(); }
  }

  /** 打中敌人：蓄力条往回退；正在蓄重击/嘶吼的退得更多，算打断 */
  function pushCharge(idx, amount) {
    const e = api.getState().combat.enemies[idx];
    if (!e || e.hp <= 0) return;
    const heavy = intentOf(e).heavy;
    const before = e.charge;
    e.charge = Math.max(0, e.charge - amount * (heavy ? 2 : 1));
    if (heavy && before > 0.4 && e.charge < 0.25) api.log(`你打断了${e.name}的${intentOf(e).name}。`, "sys");
  }

  /** 格挡圈一出，正在划的刀、正在瞄的枪、正在装的药都作废（不耗弹药） */
  function cancelPlayerAction() {
    if (slashState && !slashState.done) {
      slashState.done = true;
      unbindSlashInput();
      hideTimer();
      const cv = $("slash-trail");
      if (cv) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
      const layer = $("btl-slash");
      if (layer) layer.innerHTML = "";
      api.getState()._smashShot = false;
      slashState = null;
    }
    if (shootState && !shootState.done) {
      shootState.done = true;
      if (shootState.timer) clearTimeout(shootState.timer);
      stopReticle();
      hideTimer();
      shootState = null;
    }
    if (phase === "reload") clearTimeout(rt.reloadT);
    if (phase === "switch") clearTimeout(rt.switchT);
    phase = "menu";
  }

  function beginWindup(idx) {
    const c = api.getState().combat;
    const e = c.enemies[idx];
    const interrupted = phase === "slash" || phase === "shoot" || phase === "reload" || phase === "switch";
    cancelPlayerAction();
    if (document.body.classList.contains("bag-managing")) closeBag({ force: true });
    rt.windup = { idx, t0: performance.now(), dur: RT().windupMs * loadFx().ring };
    const howl = e.intent === "howl";
    setMsg(howl ? `${e.name}仰起头来——要叫人了！` : `${e.name}要${intentOf(e).name}了！点圈或按空格格挡`);
    if (interrupted) toastBag("被打断了");
    if (!howl) showRing();
    /* 后排的就在自己位置上蓄势，不闪到前面来 */
    const fig = idx === targetIdx ? $("btl-art-wrap") : backEl(idx);
    if (fig) { fig.classList.remove("windup"); void fig.offsetWidth; fig.classList.add("windup"); }
    if (typeof SFX !== "undefined") SFX.play("roar");
    showMainMenu();
  }

  function showRing() {
    removeRing();
    const wrap = $("btl-art-wrap");
    const img = $("btl-art");
    if (!wrap || !img || !img.naturalWidth) return;
    const back = rt.windup && rt.windup.idx !== targetIdx ? backEl(rt.windup.idx) : null;
    let p;
    if (back) {
      /* 格挡圈落在后排那个出手的身上 */
      const br = back.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      p = { x: ((br.left + br.width / 2 - wr.left) / wr.width) * 100, y: ((br.top + br.height * 0.32 - wr.top) / wr.height) * 100 };
    } else {
      const mask = portraitMask(img);
      p = imgToWrapPct(img, (mask.box.x0 + mask.box.x1) / 2, mask.box.y0 + (mask.box.y1 - mask.box.y0) * 0.32);
    }
    const ring = document.createElement("button");
    ring.type = "button";
    ring.id = "parry-ring";
    ring.className = "parry-ring";
    ring.setAttribute("aria-label", "格挡");
    ring.style.left = p.x + "%";
    ring.style.top = p.y + "%";
    ring.style.setProperty("--dur", rt.windup.dur + "ms");
    ring.style.setProperty("--perfect", RT().perfectMs / RT().windupMs);
    ring.innerHTML = "<i></i>";
    ring.onpointerdown = (ev) => { ev.preventDefault(); ev.stopPropagation(); tryParry(); };
    wrap.appendChild(ring);
  }

  function removeRing() {
    const r = $("parry-ring");
    if (r) r.remove();
  }

  function tryParry() {
    if (!rt || !rt.windup || rt.windup.parry) return;
    const c = api.getState().combat;
    if (c.enemies[rt.windup.idx].intent === "howl") return;
    const left = rt.windup.dur - (performance.now() - rt.windup.t0);
    resolveStrike(left <= RT().perfectMs * (rt.windup.dur / RT().windupMs) ? "perfect" : "normal");
  }

  /** 召来一具同伴：照场上最弱的那个，七成血 */
  function summonHelp(c, caller) {
    const src = caller.summon || c.enemies.reduce((a, b) => (b.maxHp < a.maxHp ? b : a), c.enemies[0]);
    const hp = caller.summon ? src.hp : Math.max(20, Math.round(src.maxHp * 0.7));
    c.enemies.push({ id: src.id, name: src.name, hp, maxHp: hp, atk: src.atk, charge: 0, intent: "bite" });
    api.log(caller.callLine ? caller.callLine.replace("{0}", src.name) : `${caller.name}仰头一声长嚎，又有一具${src.name}循声扑了过来。`);
    paintFoes({ portrait: false });
    paintBackRow();
  }

  function resolveStrike(parry) {
    if (!rt || !rt.windup) return;
    const s = api.getState();
    const c = s.combat;
    const { idx } = rt.windup;
    rt.windup = null;
    removeRing();
    const wrap = $("btl-art-wrap");
    if (wrap) wrap.classList.remove("windup");
    const e = c.enemies[idx];
    if (!e || e.hp <= 0) return afterAction(0);
    const it = intentOf(e);
    if (e.intent === "howl") {
      c.howled = true;
      c.howls = (c.howls || 0) + 1;
      summonHelp(c, e);
      if (typeof SFX !== "undefined") SFX.play("roar");
    } else {
      let dmg = Math.round(e.atk * it.mult);
      const w = weaponOf(s);
      let rate = parry === "perfect" ? perfectBlockRate(w) : blockRate(w, !!parry);
      if (rate > 0) {
        const cost = Math.round(blockCost(w, e.atk) * (parry === "perfect" ? 0.5 : 1));
        if (s.stamina >= cost) s.stamina -= cost;
        else { rate *= 0.5; s.stamina = 0; api.log("体力不济，只挡住了一半。", "sys"); }
      }
      const blocked = Math.round(dmg * rate);
      dmg -= blocked;
      /* 护甲、符箓按比例减；只要被扑中，至少掉一点血 */
      if (dmg > 0) dmg = Math.max(1, Math.round(dmg * damageTakenRate(s)));
      playLunge(idx);
      if (parry === "perfect") {
        c.counter = true;
        c.counterUntil = performance.now() + RT().counterMs;
        e.stun = 0.8;
        api.log(`${e.name}${it.act}，你看准时机一格，它身形一歪，正是反击的时候。`);
      } else if (blocked > 0) {
        api.log(`${w.name || "兵器"}挡下了 ${blocked} 点。`, "sys");
      }
      if (dmg <= 0) {
        setMsg(parry === "perfect" ? "完美格挡！" : "你架开了。");
        playParry();
      } else {
        s.hp -= dmg;
        setMsg(parry ? `格挡 · 气血 -${dmg}` : `${e.name}${it.act} · 气血 -${dmg}`);
        api.log(`${e.name}${it.act}，气血 -${dmg}（剩 ${Math.max(0, s.hp)}/${WORLD.maxHp}）`, "sys");
        if (parry) playParry(true);
        playPlayerHurt(dmg);
        /* 患疫的咬中了，那股疫气往身子里钻 */
        if (e.poison) {
          s.corruption = Math.min(100, (s.corruption || 0) + e.poison);
          api.log(`${e.name}的涎沫溅进伤口，喉中那股饥渴又重了几分。`, "sys");
        }
      }
    }
    e.charge = 0;
    e.intent = pickIntent(c, e);
    c.enemies.forEach((o) => { if (o !== e && o.hp > 0) o.charge = Math.min(o.charge, RT().afterStrikeCap); });
    c.round++;
    if (api.onHud) api.onHud();
    paintHp();
    if (api.checkDead()) { rtStop(); return; }
    document.querySelectorAll("#foe-back-row .foe-back.windup").forEach((el) => el.classList.remove("windup"));
    afterAction(0);
  }

  /** 敌人倒下：放死亡动画，换下一个目标；全倒了就收场 */
  function onEnemyKilled(idx) {
    const s = api.getState();
    const c = s.combat;
    const e = c.enemies[idx];
    api.log(`${e.name}倒下。`);
    if (s.hp < WORLD.maxHp && Math.random() < 0.45) {
      s.hp = Math.min(WORLD.maxHp, s.hp + 17);
      api.log("站稳脚步，气血 +17。", "sys");
    }
    const allDown = !alive(c).length;
    if (rt) rt.anim = true;
    setMsg(allDown ? "残影散尽…" : "其影倒下…");
    if (typeof SFX !== "undefined") SFX.play("kill");
    if (typeof BGM !== "undefined" && BGM.sting && !allDown) BGM.sting("kill");
    showMainMenu();
    playDeathAnim().then(() => {
      if (!active) return;
      clearWounds();
      clearFx();
      resetArtAnim();
      if (allDown) { rtStop(); api.onWin(); return; }
      const next = c.enemies.findIndex((x) => x.hp > 0);
      /* 后排那个从它原来站的地方走上来补位 */
      const from = backRect(next);
      hideBack(next);
      targetIdx = next;
      paintFoes();
      whenPortraitReady()
        .then(() => (from ? flyToFront(from) : playEnterAnim()))
        .then(() => {
          if (!active || !rt) return;
          rt.anim = false;
          rt.last = performance.now();
          afterAction(200);
        });
    });
  }

  /* ========== 挨打演出：扑击 → 爪痕 + 闪红 + 重震 + 血条跳字 ========== */

  function playLunge(idx) {
    const wrap = idx == null || idx === targetIdx ? $("btl-art-wrap") : backEl(idx);
    if (!wrap) return;
    wrap.classList.remove("lunge", "windup");
    void wrap.offsetWidth;
    wrap.classList.add("lunge");
    setTimeout(() => wrap.classList.remove("lunge"), 900);
    if (typeof SFX !== "undefined") SFX.play("roar");
  }

  function playPlayerHurt(dmg) {
    const st = document.querySelector(".stage-col");
    if (st) {
      const claw = document.createElement("div");
      claw.className = "claw-marks";
      claw.style.setProperty("--rot", -28 + Math.random() * 20 + "deg");
      claw.innerHTML = "<i></i><i></i><i></i>";
      st.appendChild(claw);
      setTimeout(() => claw.remove(), 700);
    }
    shakeStage(Math.min(18, 8 + dmg / 4));
    if (api.screenHit) api.screenHit();
    const hud = document.querySelector(".hud");
    if (hud) {
      hud.classList.remove("hurt");
      void hud.offsetWidth;
      hud.classList.add("hurt");
      const pop = document.createElement("span");
      pop.className = "hud-dmg";
      pop.textContent = `-${dmg}`;
      hud.appendChild(pop);
      setTimeout(() => { pop.remove(); hud.classList.remove("hurt"); }, 900);
    }
    if (typeof SFX !== "undefined") {
      SFX.play("wound");
      SFX.play("slash_hit");
    }
  }

  function playParry(partial) {
    const fx = $("btl-fx");
    if (fx) {
      const spark = document.createElement("span");
      spark.className = "parry-spark";
      spark.style.left = 46 + Math.random() * 8 + "%";
      spark.style.top = 40 + Math.random() * 10 + "%";
      fx.appendChild(spark);
      setTimeout(() => spark.remove(), 500);
      if (!partial) popDamage(50, 36, "架开", "");
    }
    shakeStage(4);
    if (typeof SFX !== "undefined") SFX.play("slash_whiff");
  }

  function openBag(fromBattle) {
    cellShrink = 0;
    openBagSession({
      fromBattle: !!fromBattle,
      reason: "manage",
      hasLoot: false,
    });
  }

  function openBagSession(opts = {}) {
    ensureDom();
    selectedUid = null;
    selectedFromStaging = false;
    hoverCell = null;
    zichongFill = null;
    cancelCarry(true);
    bagSession = {
      fromBattle: !!opts.fromBattle,
      reason: opts.reason || "manage",
      hasLoot: !!opts.hasLoot,
    };
    const s0 = api ? api.getState() : null;
    if (s0 && typeof bagSanitize === "function") bagSanitize(s0);
    const modal = $("bag-modal");
    modal.dataset.fromBattle = bagSession.fromBattle ? "1" : "0";
    document.body.classList.add("bag-managing");
    uiFadeShow(modal);
    const title = $("bag-title");
    if (title) {
      title.textContent =
        bagSession.reason === "loot"
          ? "战利品"
          : bagSession.reason === "pickup"
            ? "拾取"
            : "行囊";
    }
    const sizeLabel = $("bag-size-label");
    if (sizeLabel) sizeLabel.textContent = "行囊";
    paintBag();
  }

  function stagingCount(s) {
    return (s.lootStaging || []).length;
  }

  const LEAVE_KEY = "ming-leave-noprompt";

  function askLeave(n) {
    const panel = document.querySelector("#bag-modal .bag-panel");
    if (!panel || panel.querySelector(".bag-leave")) return;
    const s = api.getState();
    const place = (WORLD.locs[s.loc] || {}).short || "这里";
    const box = document.createElement("div");
    box.className = "bag-leave";
    box.innerHTML = `
      <div class="bag-leave-card">
        <p>待收区还有 ${n} 件没收进行囊。合上之后，它们会留在${place}，随时回来还能捡。</p>
        <label class="bag-leave-check"><input type="checkbox" id="bag-leave-skip"> 以后不再提示</label>
        <div class="bag-leave-acts">
          <button type="button" class="px-btn" data-act="leave">留下，合上</button>
          <button type="button" class="px-btn" data-act="stay">再看看</button>
        </div>
      </div>`;
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "leave") {
        if (box.querySelector("#bag-leave-skip").checked) {
          try { localStorage.setItem(LEAVE_KEY, "1"); } catch (_) {}
        }
        box.remove();
        api.leaveStaging();
      } else box.remove();
    });
    panel.appendChild(box);
  }

  function closeBag(opts = {}) {
    const modal = $("bag-modal");
    if (!modal || modal.hidden) return;
    const s = api ? api.getState() : null;
    const pending = s ? stagingCount(s) : 0;
    if (pending > 0 && !opts.force) {
      /* 待收区还有东西：问一声，合上就留在当地；勾了「不再提示」就直接留下 */
      let skip = false;
      try { skip = localStorage.getItem(LEAVE_KEY) === "1"; } catch (_) {}
      if (skip) api.leaveStaging();
      else askLeave(pending);
      return;
    }
    cancelCarry(true);
    const fromBattle = modal.dataset.fromBattle === "1";
    selectedUid = null;
    selectedFromStaging = false;
    document.body.classList.remove("bag-managing");
    uiFadeHide(modal, 380).then(() => {
      if (fromBattle && active) showMainMenu();
      else if (api && api.onBagClose) api.onBagClose();
    });
  }

  function findSelected(s) {
    if (!selectedUid) return null;
    if (selectedFromStaging) {
      return (s.lootStaging || []).find((p) => p.uid === selectedUid) || null;
    }
    const hit = findPieceAnywhere(s, selectedUid);
    return hit ? hit.piece : null;
  }

  function zoneCellEls(zone) {
    const grid = gridEl(zone);
    if (!grid) return [];
    return [...grid.querySelectorAll(".bag-cell")];
  }

  function paintBagGhostsOnly() {
    ["bag", "weapon", "armor"].forEach((z) => {
      zoneCellEls(z).forEach((el) => el.classList.remove("ghost-ok", "ghost-bad", "ghost-swap"));
    });
    document.querySelectorAll(".bag-slot").forEach((el) => el.classList.remove("ghost-ok", "ghost-bad"));
    ["bag-ground", "bag-staging-wrap"].forEach((id) => { const el = $(id); if (el) el.classList.remove("ghost-ok", "ghost-bad"); });
    if (!carry || !hoverCell || !hoverCell.zone) return;
    const s = api.getState();
    const zone = hoverCell.zone;
    if (zone === "staging") {
      ["bag-ground", "bag-staging-wrap"].forEach((id) => { const el = $(id); if (el && !el.hidden) el.classList.add(hoverCell.ok ? "ghost-ok" : "ghost-bad"); });
      return;
    }
    if (isSlotZone(zone)) {
      const el = gridEl(zone).querySelector(`.bag-slot[data-x="${hoverCell.x}"]`);
      if (el) el.classList.add(hoverCell.ok ? "ghost-ok" : "ghost-bad");
      return;
    }
    const { w: W, h: H } = zoneSize(zone);
    const cells = zoneCellEls(zone);
    const rot = carry.rot;
    const id = carry.id;
    const ignore = carry.from === "staging" ? null : carry.uid;
    const ok =
      hoverCell.ok && (hoverCell.merge || hoverCell.displace || zoneCanPlace(s, zone, id, hoverCell.x, hoverCell.y, rot, ignore));
    const cls = !ok ? "ghost-bad" : hoverCell.displace ? "ghost-swap" : "ghost-ok";
    itemShape(id, rot).forEach(([dx, dy]) => {
      const cx = hoverCell.x + dx;
      const cy = hoverCell.y + dy;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) return;
      const el = cells[cy * W + cx];
      if (el) el.classList.add(cls);
    });
  }

  function layoutZoneSprites(s, zone) {
    if (isSlotZone(zone)) return;
    const grid = gridEl(zone);
    const layer = spritesEl(zone);
    if (!grid || !layer) return;
    layer.innerHTML = "";
    const { cw, ch, gap } = cellMetrics(zone);
    if (!cw) return;
    const heldW = equippedUid(s, "weapon");
    const heldA = equippedUid(s, "armor");
    const seen = new Set();
    piecesOf(s, zone).forEach((piece) => {
      if (seen.has(piece.uid)) return;
      seen.add(piece.uid);
      const bounds = itemShapeBounds(piece.id, piece.rot);
      const wrap = document.createElement("div");
      wrap.className = "bag-sprite";
      if (carry && carry.uid === piece.uid && carry.from === zone) wrap.classList.add("dim");
      wrap.style.left = piece.x * (cw + gap) + "px";
      wrap.style.top = piece.y * (ch + gap) + "px";
      wrap.style.width = bounds.w * cw + (bounds.w - 1) * gap + "px";
      wrap.style.height = bounds.h * ch + (bounds.h - 1) * gap + "px";
      const visual = makeItemVisual(piece.id, piece.rot);
      wrap.appendChild(visual);
      if (visual.tagName === "IMG") {
        fitOpaqueIntoBox(
          visual,
          bounds.w * cw + (bounds.w - 1) * gap,
          bounds.h * ch + (bounds.h - 1) * gap,
        );
      }
      const nm = document.createElement("span");
      nm.className = "bag-name";
      nm.textContent = (itemDef(piece.id) || {}).name || piece.id;
      wrap.appendChild(nm);
      if (isStackable && isStackable(piece.id) && pieceQty(piece) > 1) {
        const badge = document.createElement("span");
        badge.className = "bag-stack-badge";
        badge.textContent = String(pieceQty(piece));
        wrap.appendChild(badge);
      }
      if (
        (itemHomeZone(piece.id) === "weapon" && piece.uid === heldW) ||
        (itemHomeZone(piece.id) === "armor" && piece.uid === heldA)
      ) {
        const hold = document.createElement("span");
        hold.className = "bag-hold-badge";
        hold.textContent = "持";
        wrap.appendChild(hold);
      }
      layer.appendChild(wrap);
    });
  }

  /** 位：一格一件，不论形状；空位写着「手中」「背上」「身上」 */
  function paintSlots(s, zone) {
    const box = gridEl(zone);
    if (!box) return;
    applyBoardPixelSize(zone);
    box.innerHTML = "";
    const names = SLOT_NAMES[zone];
    const { w: W } = zoneSize(zone);
    const { cw, gap } = cellMetrics(zone);
    for (let x = 0; x < W; x++) {
      const dim = ARMOR_SLOTS[x];
      const bw = dim.w * cw + (dim.w - 1) * gap;
      const bh = dim.h * cw + (dim.h - 1) * gap;
      const slot = document.createElement("div");
      slot.className = "bag-slot";
      slot.style.width = bw + "px";
      slot.style.height = bh + "px";
      slot.dataset.zone = zone;
      slot.dataset.x = String(x);
      const tag = document.createElement("span");
      tag.className = "bag-slot-label";
      tag.textContent = names[x];
      slot.appendChild(tag);
      const piece = piecesOf(s, zone).find((p) => p.x === x);
      if (piece) {
        slot.classList.add("filled");
        slot.dataset.uid = piece.uid;
        if (piece.uid === selectedUid && !selectedFromStaging) slot.classList.add("sel");
        if (carry && carry.uid === piece.uid) slot.classList.add("dim");
        /* 图片放进一个居中的框里再按不透明区域摆正，框外留出上面的位名和下面的物名 */
        const v = makeItemVisual(piece.id, 0);
        const pic = document.createElement("div");
        pic.className = "bag-slot-pic";
        const boxW = bw * 0.86;
        const boxH = bh * (dim.h > 1 ? 0.7 : 0.56);
        pic.style.width = boxW + "px";
        pic.style.height = boxH + "px";
        pic.appendChild(v);
        slot.appendChild(pic);
        if (v.tagName === "IMG") fitOpaqueIntoBox(v, boxW, boxH);
        const nm = document.createElement("span");
        nm.className = "bag-name";
        nm.textContent = (itemDef(piece.id) || {}).name || piece.id;
        slot.appendChild(nm);
      }
      slot.onclick = (e) => {
        e.stopPropagation();
        if (carry) {
          lastPointer = { x: e.clientX, y: e.clientY };
          if (!tryPlaceCarry()) cancelCarry();
          return;
        }
        if (!piece) return;
        selectedUid = piece.uid;
        selectedFromStaging = false;
        selectedEvidence = null;
        if (typeof SFX !== "undefined") SFX.play("ui");
        paintBag();
      };
      box.appendChild(slot);
    }
  }

  function paintZoneGrid(s, zone) {
    if (isSlotZone(zone)) return paintSlots(s, zone);
    const grid = gridEl(zone);
    if (!grid) return;
    applyBoardPixelSize(zone);
    const { w: W, h: H } = zoneSize(zone);
    [...grid.querySelectorAll(".bag-cell")].forEach((el) => el.remove());
    let sprites = spritesEl(zone);
    if (!sprites) {
      sprites = document.createElement("div");
      sprites.className = "bag-sprites";
      sprites.id =
        zone === "weapon" ? "weapon-sprites" : zone === "armor" ? "armor-sprites" : "bag-sprites";
      grid.appendChild(sprites);
    } else {
      sprites.innerHTML = "";
    }
    const occ = gridOccupied(piecesOf(s, zone));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "bag-cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.dataset.zone = zone;
        const uid = occ[`${x},${y}`];
        const piece = uid ? piecesOf(s, zone).find((p) => p.uid === uid) : null;
        if (piece) {
          const it = itemDef(piece.id);
          cell.classList.add("filled");
          cell.dataset.uid = piece.uid;
          if (piece.uid === selectedUid && !selectedFromStaging) cell.classList.add("sel");
          if (zichongFill && piece.uid === zichongFill.uid) cell.classList.add("sel");
          cell.title = it ? it.name : piece.id;
          /* 点一下只选中看详情；要挪动就拖 */
          cell.onclick = (e) => {
            e.stopPropagation();
            if (carry) {
              lastPointer = { x: e.clientX, y: e.clientY };
              if (!tryPlaceCarry()) cancelCarry();
              return;
            }
            selectedUid = piece.uid;
            selectedFromStaging = false;
            selectedEvidence = null;
            if (typeof SFX !== "undefined") SFX.play("ui");
            paintBag();
          };
        } else {
          cell.classList.add("empty");
          cell.onclick = (e) => {
            e.stopPropagation();
            if (carry) tryPlaceCarry();
          };
        }
        grid.appendChild(cell);
      }
    }
    outlineSelected(grid, W, H);
  }

  /** 选中的物品只描外轮廓：同一件的相邻格不画边，格缝用底色补平 */
  function outlineSelected(grid, W, H) {
    const sel = new Set();
    grid.querySelectorAll(".bag-cell.sel").forEach((c) => sel.add(`${c.dataset.x},${c.dataset.y}`));
    if (!sel.size) return;
    const line = "var(--paper)";
    const fill = "#34302a";
    const gap = 3;
    grid.querySelectorAll(".bag-cell.sel").forEach((c) => {
      const x = +c.dataset.x;
      const y = +c.dataset.y;
      const has = (dx, dy) => sel.has(`${x + dx},${y + dy}`);
      const sh = [];
      if (!has(0, -1)) sh.push(`inset 0 2px 0 ${line}`);
      if (!has(1, 0)) sh.push(`inset -2px 0 0 ${line}`);
      else sh.push(`${gap}px 0 0 0 ${fill}`);
      if (!has(0, 1)) sh.push(`inset 0 -2px 0 ${line}`);
      else sh.push(`0 ${gap}px 0 0 ${fill}`);
      if (!has(-1, 0)) sh.push(`inset 2px 0 0 ${line}`);
      if (has(1, 0) && has(0, 1) && has(1, 1)) sh.push(`${gap}px ${gap}px 0 0 ${fill}`);
      c.style.boxShadow = sh.join(", ");
      c.style.background = fill;
    });
  }

  /** 证物袋：剧情物品一排小图标，点开看详情 */
  function paintEvidence(s) {
    const box = $("bag-evidence");
    if (!box) return;
    box.innerHTML = "";
    const list = s.evidence || [];
    if (!list.length) return;
    const label = document.createElement("div");
    label.className = "bag-section-label";
    label.textContent = "证物袋";
    const row = document.createElement("div");
    row.className = "bag-evidence-row";
    list.forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bag-evidence-item" + (selectedEvidence === id ? " sel" : "");
      b.title = (itemDef(id) || {}).name || id;
      const v = makeItemVisual(id, 0);
      b.appendChild(v);
      if (v.tagName === "IMG") fitOpaqueIntoBox(v, 40, 40);
      b.onclick = (e) => {
        e.stopPropagation();
        selectedEvidence = selectedEvidence === id ? null : id;
        selectedUid = null;
        paintBag();
      };
      row.appendChild(b);
    });
    box.append(label, row);
  }

  function paintStaging(s) {
    const box = $("bag-staging");
    const hint = $("bag-staging-hint");
    if (!box) return;
    box.innerHTML = "";
    const list = s.lootStaging || [];
    const wrapEl = $("bag-staging-wrap");
    if (wrapEl) wrapEl.hidden = list.length === 0;
    if (hint) hint.hidden = true;
    const acts = $("bag-staging-acts");
    if (acts) {
      acts.innerHTML = "";
      if (list.length) {
        const all = document.createElement("button");
        all.type = "button";
        all.className = "px-btn";
        all.textContent = "全部收入";
        all.onclick = (e) => { e.stopPropagation(); autoStowAll(); };
        acts.append(all);
      }
    }
    const { cw, ch, gap } = cellMetrics("bag");
    list.forEach((st) => {
      const it = itemDef(st.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bag-staging-item" + (st.uid === selectedUid && selectedFromStaging ? " sel" : "");
      btn.dataset.uid = st.uid;
      if (carry && carry.uid === st.uid && carry.from === "staging") btn.classList.add("dim");
      const bounds = itemShapeBounds(st.id, st.rot);
      btn.style.width = bounds.w * cw + (bounds.w - 1) * gap + "px";
      btn.style.height = bounds.h * ch + (bounds.h - 1) * gap + "px";
      btn.style.position = "relative";
      const visual = makeItemVisual(st.id, st.rot);
      btn.appendChild(visual);
      if (visual.tagName === "IMG") {
        fitOpaqueIntoBox(
          visual,
          bounds.w * cw + (bounds.w - 1) * gap,
          bounds.h * ch + (bounds.h - 1) * gap,
        );
      }
      btn.title = it
        ? `${it.name} · 占${itemShape(st.id, st.rot).length}格 · 点击选中`
        : st.id;
      const nm = document.createElement("span");
      nm.className = "bag-name";
      nm.textContent = it ? it.name : st.id;
      btn.appendChild(nm);
      if (isStackable(st.id) && pieceQty(st) > 1) {
        const badge = document.createElement("span");
        badge.className = "bag-stack-badge";
        badge.textContent = String(pieceQty(st));
        btn.appendChild(badge);
      }
      btn.onclick = (e) => {
        e.stopPropagation();
        if (carry) { cancelCarry(); return; }
        selectedUid = st.uid;
        selectedFromStaging = true;
        paintBag();
      };
      box.appendChild(btn);
    });
  }

  function paintBag() {
    const s = api.getState();
    const bagPanel = document.getElementById("bag-panel") || document.querySelector(".bag-panel");
    const scrollTopBefore = bagPanel ? bagPanel.scrollTop : 0;
    const rootScrollTop = document.documentElement ? document.documentElement.scrollTop : 0;
    if (typeof migrateEquipmentLayout === "function") migrateEquipmentLayout(s);
    const meta = $("bag-meta");
    const detail = $("bag-detail");
    const actions = $("bag-actions");
    if (meta) {
      const tier = loadTier(s);
      meta.textContent = `行囊 ${bagCount(s)} / ${bagCellCapacity()} 格 · 负重 ${carryLoad(s)} / ${WORLD.carryCap} ${{ light: "轻装", normal: "常重", heavy: "沉重" }[tier]}`;
      meta.dataset.tier = tier;
    }
    applyBoardPixelSize("bag");
    paintZoneGrid(s, "weapon");
    paintZoneGrid(s, "bag");
    paintZoneGrid(s, "armor");
    paintStaging(s);
    paintEvidence(s);
    requestAnimationFrame(() => {
      fitBagBody();
      layoutZoneSprites(s, "weapon");
      layoutZoneSprites(s, "bag");
      layoutZoneSprites(s, "armor");
      if (!carry && (s.lootStaging || []).length) paintStaging(s);
    });
    paintBagGhostsOnly();

    const tubesBox = $("bag-tubes");
    const paintTubes = (gunId) => {
      if (!tubesBox) return;
      const spec = firearmSpec(gunId);
      const kits = Math.min(bagCountId(s, "powder"), bagCountId(s, "wad"), bagCountId(s, "shot"));
      const kitLine = `火药 ${bagCountId(s, "powder")} · 垫片 ${bagCountId(s, "wad")} · 弹丸 ${bagCountId(s, "shot")}`;
      if (spec && spec.usesZichong) {
        const empty = bagCountId(s, "zichong_empty");
        const full = bagCountId(s, "zichong");
        tubesBox.hidden = false;
        tubesBox.innerHTML = "";
        const title = document.createElement("div");
        title.className = "bag-section-label";
        title.textContent = `${itemDef(gunId).name} · 子铳 已装 ${full} · 空 ${empty}`;
        const line = document.createElement("p");
        line.className = "bag-kit-line";
        line.textContent = kitLine;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "px-btn";
        b.textContent = empty && kits ? `全部填装（可装 ${Math.min(empty, kits)}）` : empty ? "缺火药/垫片/弹丸" : "子铳都已装好";
        b.disabled = !(empty && kits);
        b.onclick = (e) => {
          e.stopPropagation();
          let n = 0;
          while (loadEmptyZichong(s)) n++;
          toastBag(n ? `填装了 ${n} 枚子铳` : "装不了");
          if (n && typeof SFX !== "undefined") SFX.play("bag_place");
          if (api.onHud) api.onHud();
          paintBag();
        };
        tubesBox.append(title, line, b);
        return;
      }
      if (!spec || !spec.tubes || spec.consumable) {
        tubesBox.hidden = true;
        tubesBox.innerHTML = "";
        return;
      }
      const g = ensureGunState(s, gunId);
      tubesBox.hidden = false;
      tubesBox.innerHTML = "";
      const title = document.createElement("div");
      title.className = "bag-section-label";
      title.textContent = `${itemDef(gunId).name} · 管槽（点空管装填）`;
      tubesBox.appendChild(title);
      const row = document.createElement("div");
      row.className = "bag-tube-row";
      g.tubes.forEach((loaded, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bag-tube" + (loaded ? " loaded" : " empty");
        b.textContent = loaded ? "●" : "○";
        b.title = loaded ? `第 ${idx + 1} 管 · 已装` : `第 ${idx + 1} 管 · 空 · 点此装填`;
        b.onclick = () => {
          if (loaded) return toastBag("此管已装");
          if (!hasReloadKit(s)) return toastBag("需要火药+垫片+弹丸");
          if (loadOneTube(s, gunId, idx)) {
            toastBag(`已装填第 ${idx + 1} 管`);
            if (api.onHud) api.onHud();
            paintBag();
          }
        };
        row.appendChild(b);
      });
      tubesBox.appendChild(row);
      const emptyIdx = g.tubes.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const line = document.createElement("p");
      line.className = "bag-kit-line";
      line.textContent = kitLine;
      const fillAll = document.createElement("button");
      fillAll.type = "button";
      fillAll.className = "px-btn";
      fillAll.textContent = emptyIdx.length && kits ? `一键装满（可装 ${Math.min(emptyIdx.length, kits)}）` : emptyIdx.length ? "缺火药/垫片/弹丸" : "已装满";
      fillAll.disabled = !(emptyIdx.length && kits);
      fillAll.onclick = (e) => {
        e.stopPropagation();
        let n = 0;
        emptyIdx.forEach((i) => { if (loadOneTube(s, gunId, i)) n++; });
        toastBag(n ? `装填了 ${n} 管` : "装不了");
        if (n && typeof SFX !== "undefined") SFX.play("bag_place");
        if (api.onHud) api.onHud();
        paintBag();
      };
      tubesBox.append(line, fillAll);
    };

    actions.innerHTML = "";
    const addAct = (label, fn, cls) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "px-btn" + (cls ? " " + cls : "");
      b.textContent = label;
      b.onclick = fn;
      actions.appendChild(b);
    };

    const pending = stagingCount(s);

    if (selectedEvidence) {
      const it = itemDef(selectedEvidence);
      paintCard(s, { id: selectedEvidence, uid: null, qty: 1 }, "证物袋");
      detail.textContent = it ? it.desc || "" : "";
      if (tubesBox) { tubesBox.hidden = true; tubesBox.innerHTML = ""; }
      return;
    }
    const selected = findSelected(s);
    const restoreScroll = () => {
      if (bagPanel) bagPanel.scrollTop = scrollTopBefore;
      if (document.documentElement) document.documentElement.scrollTop = rootScrollTop;
    };
    if (!selected) {
      paintCard(s, null, "");
      detail.textContent = pending ? "上方有待收的东西：拖进格子，或点「全部收入」。" : "";
      const eq = equippedId(s, "weapon");
      if (eq && isFirearm(eq)) paintTubes(eq);
      else if (tubesBox) {
        tubesBox.hidden = true;
        tubesBox.innerHTML = "";
      }
      requestAnimationFrame(restoreScroll);
      return;
    }
    const it = itemDef(selected.id);
    const hit = selectedFromStaging ? null : findPieceAnywhere(s, selected.uid);
    const where = selectedFromStaging
      ? "待收"
      : hit && isSlotZone(hit.zone)
        ? SLOT_NAMES[hit.zone][hit.piece.x] || "身甲"
        : hit && hit.zone === "weapon"
          ? "兵器架"
          : "行囊";
    const qtyLine =
      isStackable(selected.id) ? `\n叠 ${pieceQty(selected)}/${stackMaxOf(selected.id)}` : "";
    const rotShow = carry && carry.uid === selected.uid ? carry.rot : selected.rot;
    let extra = "";
    if (zichongFill && selected.uid === zichongFill.uid) {
      const need = ["火药", "垫片", "弹丸"][zichongFill.step];
      extra = `\n装填中 · 再点选${need}`;
    } else if (
      carry &&
      (carry.id === "powder" || carry.id === "wad" || carry.id === "shot")
    ) {
      extra = "\n再点空子铳装填";
    }
    paintCard(s, selected, where);
    detail.textContent = it ? `${it.desc || ""}${extra}` : selected.id;

    if (!selectedFromStaging && isFirearm(selected.id)) paintTubes(selected.id);
    else if (equippedId(s, "weapon") && isFirearm(equippedId(s, "weapon"))) {
      paintTubes(equippedId(s, "weapon"));
    } else if (tubesBox) {
      tubesBox.hidden = true;
      tubesBox.innerHTML = "";
    }

    if (!(hit && isSlotZone(hit.zone))) addAct("旋转", () => {
      if (carry) {
        carry.rot = (carry.rot + 1) % 4;
        if (carry.from === "staging" && api.rotateStagingPiece) api.rotateStagingPiece(carry.uid);
        hoverCell = null;
        updateCarrySnap();
        paintBagGhostsOnly();
        return;
      }
      if (selectedFromStaging && api.rotateStagingPiece) api.rotateStagingPiece(selected.uid);
      else if (hit && api.rotateZonePiece) api.rotateZonePiece(hit.zone, selected.uid);
      else if (api.rotateBagPiece) api.rotateBagPiece(selected.uid);
      paintBag();
    });

    const refresh = () => {
      paintBag();
      if (api.onHud) api.onHud();
    };
    if (!selectedFromStaging && hit && itemHomeZone(selected.id) === "weapon") {
      if (hit.zone === "weapon" && equippedUid(s, "weapon") !== selected.uid) {
        addAct("拿在手中", () => {
          if (api.setHeldWeapon(selected.uid)) toastBag("已拿在手中");
          refresh();
        });
      }
      if (hit.zone === "bag") {
        addAct("放上兵器架", () => {
          const place = zoneFindPlace(s, "weapon", selected.id, selected.rot | 0);
          if (place && api.transferPiece(selected.uid, "bag", "weapon", place.x, place.y, place.rot)) toastBag("已放上兵器架");
          else toastBag("兵器架上放不下");
          refresh();
        });
      }
    }
    if (!selectedFromStaging && hit && itemHomeZone(selected.id) === "armor" && hit.zone !== "armor") {
      addAct("穿上", () => {
        if (api.slotPlace(selected.uid, "armor", armorPart(selected.id))) toastBag("已穿上");
        else toastBag("行囊放不下换下来的那件");
        refresh();
      });
    }

    if (!selectedFromStaging && it && it.slot === "consumable") {
      if (it.food || selected.id === "antidote") {
        addAct(it.food ? "吃" : "使用", () => {
          cancelCarry(true);
          api.useItem(selected.id, selected.uid);
          selectedUid = null;
          paintBag();
          paintHp();
        });
      }
    }
    if (!selectedFromStaging && it && it.slot === "charm") {
      addAct("装备", () => {
        cancelCarry(true);
        api.equipItem(selected.id, selected.uid);
        selectedUid = null;
        paintBag();
        if (api.onHud) api.onHud();
      });
    }
    if (!selectedFromStaging && it && !it.noDrop) {
      addAct("丢弃", () => {
        cancelCarry(true);
        api.dropItem(selected.uid);
        selectedUid = null;
        paintBag();
      });
    }
    requestAnimationFrame(restoreScroll);
  }

  let _maskResizeHandler = null;

  function open(fightApi) {
    ensureDom();
    api = fightApi;
    active = true;
    const panel = stage();
    if (panel) panel.classList.add("in-combat");
    targetIdx = 0;
    hideTimer();
    resetArtAnim();
    paintHp();
    paintFoes();
    menuButtons([]);
    setMsg("敌影逼近…");
    if (api.scrollJournal) api.scrollJournal();
    _maskResizeHandler = () => applyAlphaMaskToSlashLayer();
    window.addEventListener("resize", _maskResizeHandler);
    whenPortraitReady()
      .then(() => playEnterAnim())
      .then(() => {
        if (!active) return;
        phase = "menu";
        rtStart();
        showMainMenu();
        if (api.scrollJournal) api.scrollJournal();
      });
    if (!parryKeyBound) {
      parryKeyBound = true;
      document.addEventListener("keydown", (e) => {
        if (!rt || !rt.windup || (e.code !== "Space" && e.key !== " ")) return;
        e.preventDefault();
        tryParry();
      });
    }
  }
  let parryKeyBound = false;

  function bind(fightApi) {
    ensureDom();
    api = fightApi;
  }

  function close() {
    rtStop();
    artAnimToken++;
    clearSlash();
    clearShootFx();
    clearWounds();
    clearFx();
    woundEnemyId = null;
    active = false;
    if (_maskResizeHandler) {
      window.removeEventListener("resize", _maskResizeHandler);
      _maskResizeHandler = null;
    }
    resetArtAnim();
    const panel = stage();
    if (panel) panel.classList.remove("in-combat");
    const backRow = $("foe-back-row");
    if (backRow) backRow.innerHTML = "";
    hideTimer();
    const layer = $("btl-slash");
    if (layer) {
      layer.innerHTML = "";
      layer.style.maskImage = "";
      layer.style.webkitMaskImage = "";
    }
    const wl = $("btl-wounds");
    if (wl) {
      wl.style.maskImage = "";
      wl.style.webkitMaskImage = "";
    }
    setMsg("");
    const modal = $("bag-modal");
    if (modal && !modal.hidden) {
      modal.classList.remove("is-visible");
      modal.hidden = true;
      document.body.classList.remove("bag-managing");
    }
  }

  /* 只在 ?debug 下用：直接打倒眼前那个，看补位 */
  const debugKillFront = () => {
    const c = api && api.getState().combat;
    if (!c || !c.enemies[targetIdx]) return false;
    c.enemies[targetIdx].hp = 0;
    onEnemyKilled(targetIdx);
    return true;
  };

  return { open, close, bind, openBag, openBagSession, closeBag, paintBag, ensureDom, debugKillFront };
})();
