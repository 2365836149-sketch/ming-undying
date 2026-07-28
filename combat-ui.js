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

      let raf = null;
      let settled = false;
      let lastTick = -1;
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
        const step = Math.floor(p * 8);
        if (typeof SFX !== "undefined" && step !== lastTick && step < 8) {
          lastTick = step;
          SFX.play("search");
        }
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
  let selectedFromStaging = false;
  let hoverCell = null; // { x, y, ok? }
  let bagKeyBound = false;
  let carryBound = false;
  let carry = null; // { uid, id, rot, from: bag|weapon|armor|staging }
  let lastPointer = { x: 0, y: 0 };
  let ignorePlaceUntil = 0;
  /* 空子铳填装进度：uid → 0|1|2（已装火药/垫片步数）；点选药料再点空壳 */
  let phase = "menu"; // menu | pick | slash | preview | act | bag | enemy | shoot
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
      existing.dataset.bagUi === "rack3b" &&
      $("bag-staging") &&
      $("weapon-grid") &&
      $("armor-grid") &&
      $("bag-autoreload")
    ) {
      return;
    }
    if (existing) existing.remove();
    const html = `
<div id="bag-modal" class="bag-modal" hidden data-bag-ui="rack3b">
  <div class="bag-panel px-panel">
    <header class="bag-head">
      <h2 id="bag-title">行囊</h2>
      <button type="button" class="px-btn" id="bag-close">关闭</button>
    </header>
    <section class="bag-staging-wrap">
      <div class="bag-section-label">待收区</div>
      <div class="bag-staging" id="bag-staging"></div>
      <p class="bag-staging-hint" id="bag-staging-hint">暂无待收之物</p>
    </section>
    <section class="bag-racks" id="bag-racks">
      <div class="bag-rack" data-zone="weapon">
        <div class="bag-section-label">武器栏</div>
        <div class="bag-board bag-rack-board" id="weapon-grid">
          <div class="bag-sprites" id="weapon-sprites"></div>
        </div>
      </div>
      <div class="bag-rack bag-rack-main" data-zone="bag">
        <div class="bag-section-label" id="bag-size-label">行囊</div>
        <p class="bag-meta" id="bag-meta"></p>
        <div class="bag-board" id="bag-grid">
          <div class="bag-sprites" id="bag-sprites"></div>
        </div>
      </div>
      <div class="bag-rack" data-zone="armor">
        <div class="bag-section-label">护甲栏</div>
        <div class="bag-board bag-rack-board" id="armor-grid">
          <div class="bag-sprites" id="armor-sprites"></div>
        </div>
      </div>
    </section>
    <div class="bag-detail" id="bag-detail">点选物品 · 悬停浅绿可放 · R键旋转</div>
    <div class="bag-actions" id="bag-actions"></div>
    <div class="bag-tubes" id="bag-tubes" hidden></div>
    <label class="bag-autoreload" id="bag-autoreload-wrap">
      <input type="checkbox" id="bag-autoreload" checked />
      保持默认填装（有药自动填空管；空子铳需选手动填）
    </label>
  </div>
</div>`;
    document.body.insertAdjacentHTML("beforeend", html);
    $("bag-close").onclick = () => closeBag();
    const ar = $("bag-autoreload");
    if (ar) {
      ar.onchange = () => {
        if (!api) return;
        const s = api.getState();
        s.autoReload = !!ar.checked;
        if (s.autoReload && typeof autoReloadFirearms === "function") {
          const r = autoReloadFirearms(s);
          if (r.tubes) {
            toastBag(`自动填装 管${r.tubes}`);
            paintBag();
            if (api.onHud) api.onHud();
          }
        }
      };
    }
    if (!bagKeyBound) {
      bagKeyBound = true;
      document.addEventListener("keydown", (e) => {
        const modal = $("bag-modal");
        if (!modal || modal.hidden) return;
        if (e.key === "r" || e.key === "R") {
          if (carry) {
            e.preventDefault();
            carry.rot = (carry.rot + 1) % 4;
            if (carry.from === "staging" && api && api.rotateStagingPiece) {
              api.rotateStagingPiece(carry.uid);
            }
            hoverCell = null;
            updateCarrySnap();
            paintBagGhostsOnly();
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
      img.src = src + (src.includes("?") ? "&" : "?") + "v=fit75";
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
    const meta =
      maxX < 0
        ? { x: 0, y: 0, w: nw, h: nh, nw, nh }
        : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, nw, nh };
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

  function sharedCellPx() {
    const gap = 3;
    const main = $("bag-grid");
    const wrap = main && main.parentElement;
    const avail = wrap && wrap.clientWidth ? wrap.clientWidth : main && main.clientWidth ? main.clientWidth : 280;
    const cw = (avail - (WORLD.bagW - 1) * gap) / WORLD.bagW;
    return Math.max(32, Math.floor(cw));
  }

  function cellMetrics(_zone) {
    const gap = 3;
    const cw = sharedCellPx();
    return { cw, ch: cw, gap };
  }

  function applyBoardPixelSize(zone) {
    const board = gridEl(zone);
    if (!board) return;
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

  /** 指针下的格子（整数格，用于点击命中） */
  function pointerToCell(clientX, clientY, zone) {
    const grid = gridEl(zone);
    if (!grid) return null;
    const { cw, ch, gap } = cellMetrics(zone);
    const rect = grid.getBoundingClientRect();
    const stepX = cw + gap;
    const stepY = ch + gap;
    if (stepX <= 0 || stepY <= 0) return null;
    const x = Math.floor((clientX - rect.left) / stepX);
    const y = Math.floor((clientY - rect.top) / stepY);
    const { w: W, h: H } = zoneSize(zone);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return { x, y, zone };
  }

  /**
   * 放置原点：形状以鼠标为中心。
   * 奇数格 → 鼠标落在正中格；偶数格 → 鼠标落在中间两格夹缝。
   */
  function pointerToBagOrigin(clientX, clientY, zone, id, rot) {
    const grid = gridEl(zone);
    if (!grid) return null;
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
    let ok;
    if (carry.from !== "staging" && carry.from !== over) {
      ok = zoneCanPlace(s, over, carry.id, cell.x, cell.y, carry.rot, null);
    } else {
      ok = zoneCanPlace(s, over, carry.id, cell.x, cell.y, carry.rot, ignore);
    }
    hoverCell = { x: cell.x, y: cell.y, zone: over, ok };
    paintBagGhostsOnly();
  }

  function beginCarry(piece, from, clientX, clientY) {
    if (!piece) return;
    const fromKey = from || "bag";
    if (carry && carry.uid === piece.uid && carry.from === fromKey) {
      cancelCarry();
      return;
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
    if (!silent) paintBag();
    else paintBagGhostsOnly();
  }

  function takeOneFromCarry() {
    if (!carry || !api) return false;
    const s = api.getState();
    const hit = findPieceAnywhere(s, carry.uid);
    if (!hit || hit.piece.id !== carry.id) return false;
    const list = piecesOf(s, hit.zone);
    const idx = list.findIndex((p) => p.uid === carry.uid);
    if (idx < 0) return false;
    if (isStackable(carry.id)) {
      const q = pieceQty(hit.piece);
      if (q <= 1) list.splice(idx, 1);
      else hit.piece.qty = q - 1;
    } else {
      list.splice(idx, 1);
    }
    return true;
  }

  /** 点选火药/垫片/弹丸后，再点空子铳依次装填 */
  function tryApplyAmmoToEmpty(emptyUid) {
    if (!carry || !api) return false;
    if (carry.id !== "powder" && carry.id !== "wad" && carry.id !== "shot") return false;
    const s = api.getState();
    const empty = findPieceAnywhere(s, emptyUid);
    if (!empty || empty.piece.id !== "zichong_empty") return false;
    const step = empty.piece.fillStep | 0;
    const need = ["powder", "wad", "shot"][step];
    const names = { powder: "火药", wad: "垫片", shot: "弹丸" };
    if (carry.id !== need) {
      toastBag(`先装${names[need]}`);
      return true;
    }
    if (!takeOneFromCarry()) {
      toastBag("数量不足");
      return true;
    }
    empty.piece.fillStep = step + 1;
    if (empty.piece.fillStep >= 3) {
      empty.piece.id = "zichong";
      empty.piece.qty = 1;
      delete empty.piece.fillStep;
      toastBag("子铳填装完成");
      selectedUid = empty.piece.uid;
      cancelCarry(true);
    } else {
      const next = ["火药", "垫片", "弹丸"][empty.piece.fillStep];
      toastBag(`已装${names[need]} · 再点选${next}`);
      const still = findPieceAnywhere(api.getState(), carry.uid);
      if (!still) cancelCarry(true);
    }
    if (api.onHud) api.onHud();
    paintBag();
    return true;
  }

  function tryPlaceCarry() {
    if (!carry || !api) return false;
    updateCarrySnap();
    const snap = hoverCell;
    if (!snap || !snap.ok) {
      toastBag("此处放不下");
      return false;
    }
    if (!zoneAllowsItem(snap.zone, carry.id)) {
      toastBag(snap.zone === "weapon" ? "此处仅放兵器" : snap.zone === "armor" ? "此处仅放护甲" : "放不下");
      return false;
    }
    const d = carry;
    let ok = false;
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
    selectedUid = d.uid;
    selectedFromStaging = false;
    if (typeof SFX !== "undefined") SFX.play("bag_place");
    paintBag();
    return true;
  }

  function onBagPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!carry) return;
    updateCarrySnap();
  }

  function onBagDocClick(e) {
    if (!carry) return;
    const modal = $("bag-modal");
    if (!modal || modal.hidden) return;
    if (performance.now() < ignorePlaceUntil) return;
    if (e.target.closest(".bag-actions, #bag-close, .bag-autoreload, .bag-tubes, .px-btn")) return;
    if (e.target.closest(".bag-staging-item, .bag-cell.filled")) return;
    if (e.target.closest("#bag-grid, #weapon-grid, #armor-grid, .bag-racks, .bag-staging-wrap, .bag-staging")) {
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
      d.textContent =
        `${e.name} ${bars(Math.max(0, e.hp), e.maxHp)} ${Math.max(0, e.hp)}/${e.maxHp}` +
        (e.weakened ? " ↓" : "");
      if (e.hp > 0) {
        d.onclick = () => {
          targetIdx = i;
          paintFoes();
        };
      }
      box.appendChild(d);
    });
    if (!doPortrait) return;
    const focus = c.enemies[targetIdx];
    if (focus && focus.hp > 0) paintPortrait(focus);
  }

  let woundEnemyId = null;
  let artAnimToken = 0;

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
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }

  function waitFrame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  /** 在立绘躯干区域内随机散布斩影点（相对 slash-layer 的百分比） */
  function bodySlashPositions(count) {
    const layer = $("btl-slash");
    const img = $("btl-art");
    const positions = [];
    if (!layer) return positions;

    const lr = layer.getBoundingClientRect();
    let ir = img && !img.hidden ? img.getBoundingClientRect() : null;
    if (!ir || ir.width < 8 || ir.height < 8 || lr.width < 8) {
      for (let i = 0; i < count; i++) {
        positions.push({
          i,
          x: 28 + Math.random() * 44,
          y: 22 + Math.random() * 48,
          rot: -75 + Math.random() * 150,
        });
      }
      return positions;
    }

    const used = [];
    const minDist = 0.11;
    for (let i = 0; i < count; i++) {
      let u = 0.5;
      let v = 0.4;
      let ok = false;
      for (let tryN = 0; tryN < 28; tryN++) {
        /* 半身立绘：偏胸口/肩腹，避开脚底与头顶空白 */
        u = 0.22 + Math.random() * 0.56;
        v = 0.14 + Math.random() * 0.52;
        ok = used.every((p) => {
          const du = p.u - u;
          const dv = p.v - v;
          return du * du + dv * dv > minDist * minDist;
        });
        if (ok) break;
      }
      used.push({ u, v });
      const px = ir.left - lr.left + ir.width * u;
      const py = ir.top - lr.top + ir.height * v;
      positions.push({
        i,
        x: Math.max(4, Math.min(96, (px / lr.width) * 100)),
        y: Math.max(6, Math.min(92, (py / lr.height) * 100)),
        rot: -80 + Math.random() * 160,
        u,
        v,
      });
    }
    return positions;
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

  function addWound(xPct, yPct, rot) {
    const layer = $("btl-wounds");
    if (!layer) return;
    const w = document.createElement("span");
    w.className = "slash-wound";
    w.style.left = xPct + "%";
    w.style.top = yPct + "%";
    const len = 28 + Math.random() * 22;
    w.style.width = len + "px";
    w.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    layer.appendChild(w);
  }

  function hitAtGhost(el) {
    if (!el) return;
    const x = parseFloat(el.style.left) || 50;
    const y = parseFloat(el.style.top) || 40;
    const rotMatch = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(el.style.transform || "");
    const rot = rotMatch ? parseFloat(rotMatch[1]) : -30 + Math.random() * 60;
    spawnBlood(x, y);
    addWound(x, y, rot + (-8 + Math.random() * 16));
    pulseArt("hit-flash");
    if (typeof SFX !== "undefined") {
      SFX.play("slash_whoosh");
      SFX.play("slash_hit");
      SFX.play("wound");
    }
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

  function startTimer(ms) {
    const bar = $("slash-timer");
    const fill = $("slash-timer-fill");
    if (!bar || !fill) return;
    bar.hidden = false;
    fill.style.transform = "scaleX(1)";
    fill.classList.add("running");
    const t0 = performance.now();
    const tick = (now) => {
      if (!slashState || slashState.done || slashState.phase !== "input") return;
      const p = Math.max(0, 1 - (now - t0) / ms);
      fill.style.transform = `scaleX(${p})`;
      if (p <= 0) {
        finishSlash(false);
        return;
      }
      slashRaf = requestAnimationFrame(tick);
    };
    slashRaf = requestAnimationFrame(tick);
  }

  function clearSlash() {
    if (slashTimer) {
      clearTimeout(slashTimer);
      slashTimer = null;
    }
    hideTimer();
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

  function showMainMenu() {
    phase = "menu";
    clearSlash();
    clearShootFx();
    paintHp();
    paintFoes();
    const s = api.getState();
    const c = s.combat;
    setMsg("\u00a0");
    const mode = typeof firearmAttackMode === "function" ? firearmAttackMode(s) : "melee";
    const wid = typeof equippedId === "function" ? equippedId(s, "weapon") : null;
    const spec = wid && typeof firearmSpec === "function" ? firearmSpec(wid) : null;
    const pairs = [];
    if (mode === "shoot") {
      const left = gunLoadedCount(s, wid);
      pairs.push(["射击", () => beginAttack(), `余弹 ${left}`]);
    } else if (mode === "smash") {
      pairs.push(["攻击", () => beginAttack(), "倒持砸击"]);
    } else if (mode === "empty") {
      pairs.push(["射击", () => toastBag("空膛 · 请换武器"), "无弹"]);
    } else {
      pairs.push(["攻击", () => beginAttack(), "斩影连击"]);
    }
    if (spec && spec.combatReload && mode === "empty" && hasReloadKit(s)) {
      pairs.push(["填装", () => doCombatReload(), "花费本回合"]);
    }
    const weapons = typeof allWeaponPieces === "function" ? allWeaponPieces(s) : weaponPieces(s);
    if (weapons.length >= 2) {
      const used = !!(c && c.switchedWeapon);
      pairs.push([
        "换武",
        () => beginSwitchWeapon(),
        used ? "本回合已换" : "切换到副手武器",
      ]);
    }
    pairs.push(
      ["行动", () => beginAct(), "察势 · 横刀"],
      ["物品", () => openBagSession({ fromBattle: true, reason: "manage" }), "行囊"],
      ["逃离", () => tryFlee(), "概率撤退"],
    );
    menuButtons(pairs);
    if (c && c.introOnce !== false) {
      /* intro already logged */
    }
  }

  function beginSwitchWeapon() {
    const s = api.getState();
    const c = s.combat;
    if (!c) return;
    if (c.switchedWeapon) {
      toastBag("本回合已换过兵器");
      return;
    }
    const list = typeof allWeaponPieces === "function" ? allWeaponPieces(s) : weaponPieces(s);
    if (list.length < 2) {
      toastBag("可用兵器不足两件");
      return;
    }
    const held = equippedUid(s, "weapon");
    const other = list.find((p) => p.uid !== held);
    if (!other) {
      toastBag("没有可切换的兵器");
      return;
    }
    if (api.switchHeldWeapon) api.switchHeldWeapon(other.uid);
    showMainMenu();
  }

  function doCombatReload() {
    const s = api.getState();
    const wid = equippedId(s, "weapon");
    const spec = firearmSpec(wid);
    if (!spec || !spec.combatReload) return;
    if (!hasReloadKit(s)) {
      setMsg("药料不足");
      return;
    }
    menuButtons([]);
    if (consumeReloadKit(s)) {
      const g = ensureGunState(s, wid);
      g.tubes = g.tubes.map(() => 1);
      g.barrel = 0;
      api.log(`你给${itemDef(wid).name}重新装上药弹。`);
      setMsg("装填完毕");
      if (api.onHud) api.onHud();
    }
    setTimeout(() => enemyPhase(), 500);
  }

  function beginAttack() {
    const c = api.getState().combat;
    const s = api.getState();
    const living = c.enemies.map((e, i) => ({ e, i })).filter((x) => x.e.hp > 0);
    if (!living.length) return api.onWin();
    const mode = typeof firearmAttackMode === "function" ? firearmAttackMode(s) : "melee";
    const start = () => {
      if (mode === "shoot") startShoot();
      else if (mode === "smash") startSmash();
      else startSlash();
    };
    if (living.length === 1) {
      targetIdx = living[0].i;
      start();
      return;
    }
    phase = "pick";
    setMsg("选择目标");
    const menu = $("commands");
    menu.innerHTML = "";
    const row = document.createElement("div");
    row.className = "cmd-row";
    living.forEach(({ e, i }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cmd fight";
      b.textContent = e.name;
      b.onclick = () => {
        targetIdx = i;
        start();
      };
      row.appendChild(b);
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "cmd";
    back.textContent = "返回";
    back.onclick = () => showMainMenu();
    row.appendChild(back);
    menu.appendChild(row);
  }

  function startSmash() {
    /* 倒持砸：走斩影，但结算用砸伤 */
    const s = api.getState();
    s._smashShot = true;
    startSlash();
  }

  function wait(ms) {
    return new Promise((r) => {
      slashTimer = setTimeout(r, ms);
    });
  }

  async function startSlash() {
    phase = "slash";
    clearSlash();
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[targetIdx];
    if (!enemy || enemy.hp <= 0) return showMainMenu();
    paintPortrait(enemy);
    await waitFrame();
    const needed = slashComboOf(s);
    const totalGhosts = slashGhostTotal(s);
    /* 每回合重新随机散布在敌人身上 */
    const positions = bodySlashPositions(totalGhosts);
    const pool = positions.map((p) => p.i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const sequence = pool.slice(0, needed);
    slashState = {
      sequence,
      step: 0,
      hits: 0,
      dealt: 0,
      needed,
      enemyIdx: targetIdx,
      done: false,
      phase: "preview",
    };
    const layer = $("btl-slash");
    layer.innerHTML = "";
    positions.forEach((p) => {
      const g = document.createElement("button");
      g.type = "button";
      g.className = "slash-ghost";
      g.style.left = p.x + "%";
      g.style.top = p.y + "%";
      g.style.transform = `translate(-50%,-50%) rotate(${p.rot}deg)`;
      g.dataset.idx = String(p.i);
      g.setAttribute("aria-label", "斩影");
      g.onclick = () => onGhostClick(p.i);
      layer.appendChild(g);
    });
    menuButtons([]);
    setMsg("斩影预览…");
    api.log(
      needed <= 1 ? "斩影：点中刀光一斩。" : `斩影：需连点 ${needed} 段。`,
      "sys",
    );

    const ghosts = [...layer.querySelectorAll(".slash-ghost")];
    /* 全体预览：柔和错峰点亮 / 熄灭 */
    await Promise.all(
      ghosts.map((el) =>
        wait(40 + Math.random() * 220).then(() => {
          if (!slashState || slashState.done) return;
          el.classList.add("lit");
        }),
      ),
    );
    if (!slashState || slashState.done) return;
    await wait(COMBAT.slashPreviewMs);
    if (!slashState || slashState.done) return;
    await Promise.all(
      ghosts.map((el) =>
        wait(40 + Math.random() * 220).then(() => {
          if (!slashState || slashState.done) return;
          el.classList.remove("lit");
        }),
      ),
    );
    await wait(280);
    if (!slashState || slashState.done) return;

    if (needed > 1) {
      setMsg("记住顺序…");
      for (const id of sequence) {
        if (!slashState || slashState.done) return;
        const el = layer.querySelector(`[data-idx="${id}"]`);
        if (el) el.classList.add("lit");
        await wait(COMBAT.slashShowEachMs);
        if (!slashState || slashState.done) return;
        if (el) el.classList.remove("lit");
        await wait(COMBAT.slashShowGapMs);
      }
      if (!slashState || slashState.done) return;
      setMsg(`按顺序点击 · ${needed} 连`);
    } else {
      const id = sequence[0];
      const el = layer.querySelector(`[data-idx="${id}"]`);
      if (el) {
        el.classList.add("lit");
        await wait(Math.min(320, COMBAT.slashShowEachMs));
        if (!slashState || slashState.done) return;
        el.classList.remove("lit");
      }
      setMsg("点中刀光");
    }
    slashState.phase = "input";
    startTimer(COMBAT.slashWindowMs);
  }

  function onGhostClick(idx) {
    if (!slashState || slashState.done || slashState.phase !== "input") return;
    const expect = slashState.sequence[slashState.step];
    if (idx !== expect) {
      /* 空挥：立即结束连击 */
      finishSlash(true);
      return;
    }
    slashState.hits += 1;
    slashState.step += 1;
    const layer = $("btl-slash");
    const el = layer && layer.querySelector(`[data-idx="${idx}"]`);
    if (el) {
      el.classList.remove("lit");
      el.classList.add("done", "struck");
      hitAtGhost(el);
      setTimeout(() => el.classList.remove("struck"), 200);
    }
    const s = api.getState();
    const smash = !!s._smashShot;
    /* 连击兵器：每斩立刻造成 1 点伤害 */
    if (!smash) {
      if (applyComboHitDamage()) return;
    }
    if (slashState.step >= slashState.needed) {
      finishSlash(false);
    }
  }

  /** @returns {boolean} 是否已因击杀结束连击 */
  function applyComboHitDamage() {
    if (!slashState || slashState.done) return true;
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[slashState.enemyIdx];
    if (!enemy || enemy.hp <= 0) {
      finishSlash(false, { killedNow: true });
      return true;
    }
    const dealt = 1;
    enemy.hp -= dealt;
    slashState.dealt = (slashState.dealt || 0) + dealt;
    setMsg(`连斩 ${slashState.hits}/${slashState.needed} · +${dealt}`);
    api.log(`斩影命中。对${enemy.name}造成 ${dealt} 伤。`);
    paintHp();
    paintFoes({ portrait: true });
    if (api.onHud) api.onHud();
    if (enemy.hp <= 0) {
      api.log(`${enemy.name}倒下。`);
      if (s.hp < WORLD.maxHp && Math.random() < 0.45) {
        s.hp += 1;
        api.log("站稳脚步，气血 +1。", "sys");
      }
      finishSlash(false, { killedNow: true });
      return true;
    }
    return false;
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

  function finishSlash(whiff, opts = {}) {
    if (!slashState || slashState.done) return;
    slashState.done = true;
    if (slashTimer) {
      clearTimeout(slashTimer);
      slashTimer = null;
    }
    hideTimer();
    const s = api.getState();
    const c = s.combat;
    const hits = slashState.hits;
    const needed = slashState.needed;
    const enemy = c.enemies[slashState.enemyIdx];
    const w = weaponOf(s);
    const smash = !!s._smashShot;
    s._smashShot = false;
    let dealt = slashState.dealt || 0;
    let killed = !!opts.killedNow;

    if (smash) {
      dealt = 0;
      if (!whiff && hits > 0 && typeof smashDamage === "function") {
        dealt = smashDamage(s);
        if (hits < needed) dealt = Math.max(1, Math.ceil(dealt * 0.6));
      }
      if (whiff) {
        setMsg("挥空了！");
        api.log(`你挥起${w.name}，却砸空了。`);
        pulseArt("whiff");
        flashSlashLayer("slash-whiff");
        if (typeof SFX !== "undefined") SFX.play("slash_whiff");
      } else if (hits >= needed) {
        setMsg(`砸中！ ${dealt} 伤`);
        api.log(`倒持砸中。对${enemy.name}造成 ${dealt} 伤。`);
      } else if (hits > 0) {
        setMsg(`砸击中断。 ${dealt} 伤`);
        api.log(`倒持未稳。对${enemy.name}造成 ${dealt} 伤。`);
      } else {
        setMsg("未及出刀。");
        api.log(`时机已过，锤未落下。`);
      }
      if (dealt > 0 && enemy && enemy.hp > 0) {
        pulseArt("hit-flash");
        flashSlashLayer("slash-hit");
        enemy.hp -= dealt;
        if (enemy.hp <= 0) {
          killed = true;
          api.log(`${enemy.name}倒下。`);
          if (s.hp < WORLD.maxHp && Math.random() < 0.45) {
            s.hp += 1;
            api.log("站稳脚步，气血 +1。", "sys");
          }
        }
      }
    } else if (whiff) {
      setMsg(dealt > 0 ? `挥空了！连击中断（已造成 ${dealt} 伤）` : "挥空了！");
      api.log(
        dealt > 0
          ? `你挥空一刀，连击中断。此轮共对${enemy.name}造成 ${dealt} 伤。`
          : `你挥起${w.name}，却砍空了。`,
      );
      pulseArt("whiff");
      flashSlashLayer("slash-whiff");
      if (typeof SFX !== "undefined") SFX.play("slash_whiff");
    } else if (hits >= needed) {
      setMsg(needed <= 1 ? `斩中！ ${dealt} 伤` : `连斩完成！ ${dealt} 伤`);
      if (dealt > 0) flashSlashLayer("slash-hit");
    } else if (hits > 0) {
      setMsg(`连击中断。 ${dealt} 伤`);
      if (dealt > 0) flashSlashLayer("slash-hit");
    } else {
      setMsg("未及出刀。");
      api.log(`时机已过，刀未落下。`);
    }

    if (!killed && enemy && enemy.hp <= 0) killed = true;

    const layer = $("btl-slash");
    if (layer) {
      setTimeout(() => {
        if (layer) layer.innerHTML = "";
      }, whiff ? 160 : 80);
    }
    slashState = null;
    paintHp();
    paintFoes({ portrait: !killed });

    if (killed) {
      const allDown = !alive(c).length;
      menuButtons([]);
      setMsg(allDown ? "残影散尽…" : "其影倒下…");
      playDeathAnim().then(() => {
        if (!active) return;
        clearWounds();
        clearFx();
        resetArtAnim();
        paintFoes();
        if (allDown) {
          api.onWin();
          return;
        }
        whenPortraitReady()
          .then(() => playEnterAnim())
          .then(() => {
            if (!active) return;
            setTimeout(() => enemyPhase(), 220);
          });
      });
      return;
    }

    setTimeout(() => enemyPhase(), whiff ? 380 : 520);
  }

  function clearShootFx() {
    const aim = $("btl-aim");
    if (aim) aim.remove();
    const cur = $("gun-cursor");
    if (cur) cur.remove();
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

  /** 击杀后多留一会，等硝烟播完再结算 */
  function afterGunKillSettle(fn) {
    playDeathAnim()
      .then(() => new Promise((r) => setTimeout(r, 780)))
      .then(() => {
        if (!active) return;
        fn();
      });
  }

  function ensureGunCursor(spec) {
    let el = $("gun-cursor");
    if (!el) {
      el = document.createElement("div");
      el.id = "gun-cursor";
      el.className = "gun-cursor";
      document.body.appendChild(el);
    }
    const n = (spec && spec.cursorN) || 1;
    el.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const c = document.createElement("span");
      c.className = "gun-muzzle" + (n > 1 ? " multi" : "");
      el.appendChild(c);
    }
    el.style.setProperty("--gun-rot", `${shootState ? shootState.cursorRot : 0}deg`);
    return el;
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

  function opaqueAlphaAt(img, x, y) {
    if (!shootState || !shootState.pixels) return true;
    const { pixels, nw } = shootState;
    const ix = Math.max(0, Math.min(nw - 1, x | 0));
    const iy = Math.max(0, Math.min(shootState.nh - 1, y | 0));
    return pixels[(iy * nw + ix) * 4 + 3] > 40;
  }

  function pickAimOnPortrait(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data, width: nw, height: nh } = ctx.getImageData(0, 0, c.width, c.height);
    const pts = [];
    for (let y = 2; y < nh - 2; y += 2) {
      for (let x = 2; x < nw - 2; x += 2) {
        if (data[(y * nw + x) * 4 + 3] > 40) pts.push([x, y]);
      }
    }
    if (!pts.length) return { x: nw * 0.5, y: nh * 0.4, pixels: data, nw, nh };
    const [x, y] = pts[Math.floor(Math.random() * pts.length)];
    return { x, y, pixels: data, nw, nh };
  }

  function placeAimMarker(img, aim) {
    const wrap = $("btl-art-wrap");
    if (!wrap || !img) return;
    let mark = $("btl-aim");
    if (!mark) {
      mark = document.createElement("div");
      mark.id = "btl-aim";
      mark.className = "btl-aim";
      wrap.appendChild(mark);
    }
    const r = img.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const ox = r.left - wr.left + (r.width - dw) / 2;
    const oy = r.top - wr.top + (r.height - dh) / 2;
    mark.style.left = ox + aim.x * scale + "px";
    mark.style.top = oy + aim.y * scale + "px";
    mark.classList.remove("flash");
    void mark.offsetWidth;
    mark.style.animationDuration = `${(FIREARM.aimFlashMs || 800) / 1000}s`;
    mark.classList.add("flash");
    if (typeof SFX !== "undefined" && SFX.play) SFX.play("aim_beep");
  }

  function hitBand(img, aim, clientX, clientY) {
    const m = mapPointerToImage(img, clientX, clientY);
    if (!m) return -1;
    if (!opaqueAlphaAt(img, m.x, m.y)) return -1;
    const dist = Math.hypot(m.x - aim.x, m.y - aim.y);
    const unit = Math.min(m.nw, m.nh);
    const radii = FIREARM.hitRadii;
    for (let i = 0; i < radii.length; i++) {
      if (dist <= radii[i] * unit) return i;
    }
    return -1; /* 在实体上但太远也算打偏未中准星——按未中处理 */
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
    paintPortrait(enemy);
    await waitFrame();
    const img = $("btl-art");
    if (!img || img.hidden || !img.naturalWidth) {
      setMsg("看不清目标");
      return showMainMenu();
    }
    menuButtons([]);
    const shotsMax = Math.min(spec.shotsPerTurn || 1, gunLoadedCount(s, wid));
    shootState = {
      wid,
      spec,
      enemyIdx: targetIdx,
      shotIndex: 0,
      shotsMax,
      cursorRot: 0,
      done: false,
      aiming: true,
      pixels: null,
      nw: 0,
      nh: 0,
      aim: null,
      timer: null,
    };
    setMsg("标定弱点…");
    await runOneShotSequence();
  }

  async function runOneShotSequence() {
    if (!shootState || shootState.done) return;
    const s = api.getState();
    const img = $("btl-art");
    if (!img) return finishShootTurn();
    const aimPick = pickAimOnPortrait(img);
    shootState.pixels = aimPick.pixels;
    shootState.nw = aimPick.nw;
    shootState.nh = aimPick.nh;
    shootState.aim = { x: aimPick.x, y: aimPick.y };
    placeAimMarker(img, shootState.aim);
    shootState.aiming = true;
    setMsg(`准星闪示 · 第 ${shootState.shotIndex + 1}/${shootState.shotsMax} 发`);
    await wait(FIREARM.aimFlashMs);
    if (!shootState || shootState.done) return;
    shootState.aiming = false;
    setMsg("开火！点向准星");
    const fill = $("slash-timer-fill");
    const bar = $("slash-timer");
    if (bar) bar.hidden = false;
    if (fill) {
      fill.classList.remove("running");
      void fill.offsetWidth;
      fill.style.transform = "scaleX(1)";
      fill.classList.add("running");
      fill.style.transition = `transform ${FIREARM.shootWindowMs}ms linear`;
      requestAnimationFrame(() => {
        fill.style.transform = "scaleX(0)";
      });
    }
    const wrap = $("btl-art-wrap");
    wrap.classList.add("shooting");
    const cursor = ensureGunCursor(shootState.spec);
    wrap.onpointermove = (e) => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
      cursor.classList.add("on");
    };
    wrap.onpointerleave = () => cursor.classList.remove("on");
    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      resolveShotClick(e.clientX, e.clientY);
    };
    wrap.onclick = onClick;
    shootState.timer = setTimeout(() => resolveShotClick(null, null, true), FIREARM.shootWindowMs);
  }

  function resolveShotClick(cx, cy, timeout) {
    if (!shootState || shootState.done || shootState.aiming) return;
    if (shootState.timer) {
      clearTimeout(shootState.timer);
      shootState.timer = null;
    }
    hideTimer();
    const wrap = $("btl-art-wrap");
    if (wrap) {
      wrap.onclick = null;
      wrap.onpointermove = null;
      wrap.onpointerleave = null;
      wrap.classList.remove("shooting");
    }
    const cur = $("gun-cursor");
    if (cur) cur.classList.remove("on");
    const s = api.getState();
    const c = s.combat;
    const enemy = c.enemies[shootState.enemyIdx];
    const img = $("btl-art");
    const wid = shootState.wid;
    const spec = shootState.spec;
    let band = -1;
    if (!timeout && img && cx != null) band = hitBand(img, shootState.aim, cx, cy);
    const dmg = typeof shootDamage === "function" ? shootDamage(s, band) : 0;
    const spent = consumeFirearmShot(s, wid);
    if (spent && spec.usesZichong) {
      toastBag(`子铳−1 · 空壳退回 · 余 ${gunLoadedCount(s, wid)}`);
    }
    if (spec.rotateDeg) {
      shootState.cursorRot = (shootState.cursorRot + spec.rotateDeg) % 360;
      const cursor = ensureGunCursor(spec);
      cursor.style.setProperty("--gun-rot", `${shootState.cursorRot}deg`);
      cursor.classList.add("spin");
      setTimeout(() => cursor.classList.remove("spin"), 280);
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
      setMsg(`命中 ${pct}% · ${dmg} 伤`);
      api.log(`铳响。对${enemy.name}造成 ${dmg} 伤（${pct}%）。`);
      if (dmg > 0 && enemy) {
        pulseArt("hit-flash");
        enemy.hp -= dmg;
        if (enemy.hp <= 0) {
          killed = true;
          api.log(`${enemy.name}倒下。`);
        }
      }
    }
    const aim = $("btl-aim");
    if (aim) aim.remove();
    paintHp();
    paintFoes({ portrait: !killed });
    if (api.onHud) api.onHud();

    if (!alive(c).length) {
      shootState.done = true;
      afterGunKillSettle(() => {
        clearWounds();
        clearFx();
        resetArtAnim();
        clearShootFx();
        api.onWin();
      });
      return;
    }
    shootState.shotIndex += 1;
    const canMore =
      shootState.shotIndex < shootState.shotsMax && gunHasShot(s, wid) && !killed;
    if (canMore) {
      setTimeout(() => {
        if (!shootState || shootState.done) return;
        runOneShotSequence();
      }, 420);
      return;
    }
    shootState.done = true;
    if (killed) {
      afterGunKillSettle(() => {
        clearWounds();
        clearFx();
        resetArtAnim();
        clearShootFx();
        paintFoes();
        setTimeout(() => enemyPhase(), 280);
      });
    } else {
      clearShootFx();
      setTimeout(() => enemyPhase(), 550);
    }
  }

  function finishShootTurn() {
    clearShootFx();
    setTimeout(() => enemyPhase(), 400);
  }

  function beginAct() {
    phase = "act";
    const c = api.getState().combat;
    setMsg("行动");
    const menu = $("commands");
    menu.innerHTML = "";
    const row = document.createElement("div");
    row.className = "cmd-row";
    (c.acts || []).forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cmd";
      b.innerHTML = `${a.name}<span class="sub">${a.desc || ""}</span>`;
      b.onclick = () => doAct(a);
      row.appendChild(b);
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "cmd";
    back.textContent = "返回";
    back.onclick = () => showMainMenu();
    row.appendChild(back);
    menu.appendChild(row);
  }

  function doAct(a) {
    const c = api.getState().combat;
    if (a.effect === "defend") {
      c.defend = true;
      api.log("你横刀护住身子。");
      setMsg("下轮减伤");
    } else if (a.effect === "fleeBoost") {
      c.fleeBoost = (c.fleeBoost || 0) + 0.2;
      api.log(`你使出「${a.name}」。退路稍宽。`);
      setMsg("逃离更易");
    } else if (a.effect === "weaken") {
      alive(c).forEach((e) => {
        e.weakened = 1;
      });
      api.log(`你使出「${a.name}」。敌势一滞。`);
      setMsg("敌攻削弱");
    }
    menuButtons([]);
    setTimeout(() => enemyPhase(), 500);
  }

  function tryFlee() {
    const c = api.getState().combat;
    const chance = Math.min(0.95, (c.fleeChance || 0.3) + (c.fleeBoost || 0));
    menuButtons([]);
    if (Math.random() < chance) {
      setMsg("逃脱！");
      api.log("你撤进雪幕。身后啃咬声不散。");
      setTimeout(() => api.onFlee(), 400);
    } else {
      setMsg("退路被堵！");
      api.log("退路被堵。牙口更近了。");
      setTimeout(() => enemyPhase(), 500);
    }
  }

  function enemyPhase() {
    phase = "enemy";
    clearSlash();
    const s = api.getState();
    const c = s.combat;
    menuButtons([]);
    const foes = alive(c).filter((e) => !e.stunned);
    alive(c).forEach((e) => {
      if (e.stunned) e.stunned = 0;
    });
    if (!foes.length) {
      setMsg("无人扑上。");
      c.round++;
      c.switchedWeapon = false;
      setTimeout(() => showMainMenu(), 500);
      return;
    }
    foes.sort((a, b) => b.atk - a.atk || b.hp - a.hp);
    const striker = foes[0];
    let dmg = striker.atk;
    if (striker.weakened) {
      dmg = Math.max(1, dmg - 1);
      striker.weakened = 0;
    }
    if (foes.length > 1 && Math.random() < 0.35) dmg += 1;
    if (c.defend) dmg = Math.max(0, dmg - 1);
    const armor = armorOf(s);
    const charm = charmOf(s);
    if (armor.def) dmg = Math.max(0, dmg - armor.def);
    if (charm.defBonus) dmg = Math.max(0, dmg - charm.defBonus);
    if (s.powers.has("iron_skin")) dmg = Math.max(0, dmg - 1);
    c.defend = false;
    setMsg(`${striker.name}扑来！`);
    api.log(`${striker.name}扑过来。`);
    paintPortrait(striker);
    setTimeout(() => {
      if (dmg <= 0) {
        setMsg("你架开了。");
        api.log("你架开了。", "sys");
        pulseArt("whiff");
        if (typeof SFX !== "undefined") SFX.play("slash_whiff");
      } else {
        s.hp -= dmg;
        setMsg(`气血 -${dmg}`);
        api.log(`气血 -${dmg}（剩 ${s.hp}/${WORLD.maxHp}）`, "sys");
        pulseArt("hit-flash");
        if (typeof SFX !== "undefined") SFX.play("enemy_hit");
        if (api.screenHit) api.screenHit();
      }
      paintHp();
      c.round++;
      c.switchedWeapon = false;
      if (api.checkDead()) return;
      setTimeout(() => showMainMenu(), 550);
    }, 700);
  }

  function openBag(fromBattle) {
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
    cancelCarry(true);
    bagSession = {
      fromBattle: !!opts.fromBattle,
      reason: opts.reason || "manage",
      hasLoot: !!opts.hasLoot,
    };
    const s0 = api ? api.getState() : null;
    if (s0 && typeof bagSanitize === "function") bagSanitize(s0);
    if (s0 && s0.autoReload !== false && typeof autoReloadFirearms === "function") {
      autoReloadFirearms(s0);
    }
    const modal = $("bag-modal");
    modal.dataset.fromBattle = bagSession.fromBattle ? "1" : "0";
    document.body.classList.add("bag-managing");
    uiFadeShow(modal);
    const ar = $("bag-autoreload");
    if (ar && s0) ar.checked = s0.autoReload !== false;
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

  function closeBag(opts = {}) {
    const modal = $("bag-modal");
    if (!modal || modal.hidden) return;
    const s = api ? api.getState() : null;
    const pending = s ? stagingCount(s) : 0;
    if (pending > 0 && !opts.force) {
      const toastEl = document.getElementById("toast");
      if (toastEl) {
        uiFadeShow(toastEl);
        toastEl.textContent = "待收区仍有物件 · 收入或点「放弃剩余」";
        clearTimeout(toastEl._bagT);
        toastEl._bagT = setTimeout(() => {
          uiFadeHide(toastEl, 280);
        }, 2200);
      }
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
      zoneCellEls(z).forEach((el) => el.classList.remove("ghost-ok", "ghost-bad"));
    });
    if (!carry || !hoverCell || !hoverCell.zone) return;
    const s = api.getState();
    const zone = hoverCell.zone;
    const { w: W, h: H } = zoneSize(zone);
    const cells = zoneCellEls(zone);
    const rot = carry.rot;
    const id = carry.id;
    const ignore = carry.from === "staging" ? null : carry.uid;
    const ok =
      hoverCell.ok && zoneCanPlace(s, zone, id, hoverCell.x, hoverCell.y, rot, ignore);
    itemShape(id, rot).forEach(([dx, dy]) => {
      const cx = hoverCell.x + dx;
      const cy = hoverCell.y + dy;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) return;
      const el = cells[cy * W + cx];
      if (el) el.classList.add(ok ? "ghost-ok" : "ghost-bad");
    });
  }

  function layoutZoneSprites(s, zone) {
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
      if (piece.uid === selectedUid && !selectedFromStaging) wrap.classList.add("sel-ring");
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

  function paintZoneGrid(s, zone) {
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
          if (piece.uid === selectedUid && !selectedFromStaging) cell.classList.add("sel");
          if (piece.id === "zichong_empty" && (piece.fillStep | 0) > 0) cell.classList.add("sel");
          cell.title = it ? it.name : piece.id;
          cell.onclick = (e) => {
            e.stopPropagation();
            if (piece.id === "zichong_empty" && tryApplyAmmoToEmpty(piece.uid)) return;
            if (carry) {
              if (carry.uid === piece.uid && carry.from === zone) {
                cancelCarry();
                return;
              }
              if (tryPlaceCarry()) return;
            }
            beginCarry(piece, zone, e.clientX, e.clientY);
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
  }

  function paintStaging(s) {
    const box = $("bag-staging");
    const hint = $("bag-staging-hint");
    if (!box) return;
    box.innerHTML = "";
    const list = s.lootStaging || [];
    if (hint) {
      hint.hidden = list.length > 0;
      hint.textContent = "暂无待收之物";
    }
    const { cw, ch, gap } = cellMetrics("bag");
    list.forEach((st) => {
      const it = itemDef(st.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bag-staging-item" + (st.uid === selectedUid && selectedFromStaging ? " sel" : "");
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
      btn.onclick = (e) => {
        e.stopPropagation();
        if (carry && !(carry.uid === st.uid && carry.from === "staging")) {
          if (tryPlaceCarry()) return;
        }
        beginCarry(st, "staging", e.clientX, e.clientY);
      };
      box.appendChild(btn);
    });
  }

  function paintBag() {
    const s = api.getState();
    if (typeof migrateEquipmentLayout === "function") migrateEquipmentLayout(s);
    const meta = $("bag-meta");
    const detail = $("bag-detail");
    const actions = $("bag-actions");
    if (meta) {
      meta.textContent = `${bagCount(s)} / ${bagCellCapacity()} · 点选物品 / R键旋转`;
    }
    applyBoardPixelSize("bag");
    paintZoneGrid(s, "weapon");
    paintZoneGrid(s, "bag");
    paintZoneGrid(s, "armor");
    paintStaging(s);
    requestAnimationFrame(() => {
      layoutZoneSprites(s, "weapon");
      layoutZoneSprites(s, "bag");
      layoutZoneSprites(s, "armor");
      if (!carry && (s.lootStaging || []).length) paintStaging(s);
    });
    paintBagGhostsOnly();

    const ar = $("bag-autoreload");
    if (ar) ar.checked = s.autoReload !== false;

    const tubesBox = $("bag-tubes");
    const paintTubes = (gunId) => {
      if (!tubesBox) return;
      const spec = firearmSpec(gunId);
      if (!spec || spec.usesZichong || !spec.tubes) {
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
    if (pending > 0) {
      addAct("放弃剩余", () => {
        if (api.abandonStaging) api.abandonStaging();
      }, "danger");
    } else {
      addAct("确认收下", () => closeBag({ force: true }));
    }

    const selected = findSelected(s);
    if (!selected) {
      detail.textContent = pending
        ? "点选物品 · 悬停浅绿可放 · R键旋转 · Esc 取消"
        : "点选物品 · 悬停浅绿可放 · R键旋转 · Esc 取消";
      const eq = equippedId(s, "weapon");
      if (eq && isFirearm(eq)) paintTubes(eq);
      else if (tubesBox) {
        tubesBox.hidden = true;
        tubesBox.innerHTML = "";
      }
      return;
    }
    const it = itemDef(selected.id);
    const hit = selectedFromStaging ? null : findPieceAnywhere(s, selected.uid);
    const where = selectedFromStaging
      ? "待收"
      : hit
        ? hit.zone === "weapon"
          ? "武器栏"
          : hit.zone === "armor"
            ? "护甲栏"
            : "行囊"
        : "行囊";
    const qtyLine =
      isStackable(selected.id) ? `\n叠 ${pieceQty(selected)}/${stackMaxOf(selected.id)}` : "";
    const rotShow = carry && carry.uid === selected.uid ? carry.rot : selected.rot;
    let extra = "";
    if (selected.id === "zichong_empty" && (selected.fillStep | 0) > 0) {
      const need = ["火药", "垫片", "弹丸"][selected.fillStep | 0];
      extra = `\n装填中 · 再点选${need}`;
    } else if (
      carry &&
      (carry.id === "powder" || carry.id === "wad" || carry.id === "shot")
    ) {
      extra = "\n再点空子铳装填";
    }
    detail.textContent = it
      ? `【${where}】${it.name}\n${it.desc || "（无描述）"}\n占格 ${itemShape(selected.id, rotShow).length}${qtyLine}${extra}`
      : selected.id;

    if (!selectedFromStaging && isFirearm(selected.id)) paintTubes(selected.id);
    else if (equippedId(s, "weapon") && isFirearm(equippedId(s, "weapon"))) {
      paintTubes(equippedId(s, "weapon"));
    } else if (tubesBox) {
      tubesBox.hidden = true;
      tubesBox.innerHTML = "";
    }

    addAct("R键旋转", () => {
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

    if (!selectedFromStaging && hit && itemHomeZone(selected.id) === "weapon") {
      if (equippedUid(s, "weapon") !== selected.uid) {
        addAct("设为持有", () => {
          if (api.setHeldWeapon) api.setHeldWeapon(selected.uid);
          toastBag("已持有");
          paintBag();
          if (api.onHud) api.onHud();
        });
      }
    }
    if (!selectedFromStaging && hit && itemHomeZone(selected.id) === "armor") {
      if (equippedUid(s, "armor") !== selected.uid) {
        addAct("设为穿戴", () => {
          if (api.setHeldArmor) api.setHeldArmor(selected.uid);
          toastBag("已穿戴");
          paintBag();
          if (api.onHud) api.onHud();
        });
      }
    }

    if (!selectedFromStaging && it && it.slot === "consumable") {
      if (selected.id === "ration" || selected.id === "antidote") {
        addAct("使用", () => {
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
  }

  function open(fightApi) {
    ensureDom();
    api = fightApi;
    active = true;
    const panel = stage();
    const portrait = $("btl-portrait");
    if (panel) panel.classList.add("in-combat");
    if (portrait) portrait.hidden = false;
    targetIdx = 0;
    hideTimer();
    resetArtAnim();
    paintHp();
    paintFoes();
    menuButtons([]);
    setMsg("敌影逼近…");
    whenPortraitReady()
      .then(() => playEnterAnim())
      .then(() => {
        if (!active) return;
        showMainMenu();
      });
  }

  function bind(fightApi) {
    ensureDom();
    api = fightApi;
  }

  function close() {
    artAnimToken++;
    clearSlash();
    clearShootFx();
    clearWounds();
    clearFx();
    woundEnemyId = null;
    active = false;
    resetArtAnim();
    const panel = stage();
    const portrait = $("btl-portrait");
    if (panel) panel.classList.remove("in-combat");
    if (portrait) portrait.hidden = true;
    hideTimer();
    const layer = $("btl-slash");
    if (layer) layer.innerHTML = "";
    setMsg("");
    const modal = $("bag-modal");
    if (modal && !modal.hidden) {
      modal.classList.remove("is-visible");
      modal.hidden = true;
      document.body.classList.remove("bag-managing");
    }
  }

  return { open, close, bind, openBag, openBagSession, closeBag, paintBag, ensureDom };
})();
