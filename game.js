(() => {
  const SAVE = WORLD.saveKey;

  function fresh() {
    const state = {
      loc: WORLD.startLoc,
      elapsed: 0,
      hp: WORLD.maxHp,
      essence: 0,
      corruption: 0,
      bagPieces: [],
      weaponPieces: [],
      armorPieces: [],
      lootStaging: [],
      equipped: { weaponUid: null, armorUid: null, charm: null },
      powers: new Set(),
      flags: new Set(),
      visits: { [WORLD.startLoc]: 1 },
      look: {},
      mode: "explore",
      combat: null,
      ending: null,
      seen: new Set(),
      journal: [],
      pendingMove: null,
      nightHungerSaid: false,
      autoReload: true,
      gunLoad: {},
    };
    bagAddPiece(state, "ration");
    /* 试玩：武器栏三眼+掣电（可换武）；短刀若还有空位再放 */
    bagAddPiece(state, "sanyan");
    if (typeof ensureGunState === "function") ensureGunState(state, "sanyan");
    bagAddPiece(state, "chedian");
    bagAddPiece(state, "knife");
    if (typeof bagAddStack === "function") {
      bagAddStack(state, "powder", 8);
      bagAddStack(state, "wad", 8);
      bagAddStack(state, "shot", 8);
      bagAddStack(state, "zichong", 2);
      bagAddStack(state, "zichong_empty", 1);
    }
    if (state.weaponPieces && state.weaponPieces.length) {
      const prefer =
        state.weaponPieces.find((p) => p.id === "sanyan") ||
        state.weaponPieces.find((p) => p.id === "chedian") ||
        state.weaponPieces[0];
      setHeldWeapon(state, prefer.uid);
    }
    return state;
  }

  let S = fresh();
  let openingApi = null;

  const el = {
    game: document.getElementById("game"),
    status: document.getElementById("st-status"),
    gear: document.getElementById("st-gear"),
    inv: document.getElementById("st-inv"),
    mode: document.getElementById("mode-label"),
    loc: document.getElementById("loc-title"),
    clock: document.getElementById("clock"),
    journal: document.getElementById("journal"),
    cmdTitle: document.getElementById("cmd-title"),
    commands: document.getElementById("commands"),
    toast: document.getElementById("toast"),
    minimap: document.getElementById("minimap"),
    mapTip: document.getElementById("map-tip"),
  };

  let toastT;
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

  function toast(m) {
    if (!m) return;
    uiFadeShow(el.toast);
    el.toast.textContent = m;
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      uiFadeHide(el.toast, 320);
    }, 2600);
  }

  const deathEl = document.getElementById("death-screen");
  const deathTextEl = document.getElementById("death-text");

  function showDeathScreen(text) {
    if (deathTextEl) deathTextEl.textContent = text || "";
    document.body.classList.add("death-open");
    syncVitalFx();
    uiFadeShow(deathEl);
  }

  function hideDeathScreen() {
    return uiFadeHide(deathEl, 520).then(() => {
      document.body.classList.remove("death-open");
    });
  }

  function revealGame({ forceFade = false } = {}) {
    if (forceFade || el.game.hidden || !el.game.classList.contains("is-visible")) {
      uiFadeShow(el.game);
    } else {
      el.game.hidden = false;
      el.game.classList.add("is-visible");
    }
  }

  function tryLoadSave({ fromDeath = false } = {}) {
    const raw = localStorage.getItem(SAVE);
    if (!raw) {
      toast("无存档");
      return false;
    }
    try {
      restore(JSON.parse(raw));
      CombatUI.close();
      document.getElementById("opening").hidden = true;
      hideDeathScreen().then(() => {
        revealGame({ forceFade: fromDeath });
        toast(fromDeath ? "自存档归来" : "已读档");
        render();
      });
      if (typeof SFX !== "undefined") SFX.play("ui");
      return true;
    } catch {
      toast("存档损毁");
      return false;
    }
  }

  function restartRun() {
    const seen = S.seen;
    S = fresh();
    S.seen = seen;
    hideDeathScreen().then(() => {
      revealGame({ forceFade: true });
      log("雪又下起来。官道还是那条官道。");
      describe(true);
      render();
      if (typeof SFX !== "undefined") SFX.play("ui");
    });
  }

  let journalPainted = 0;

  function log(text, kind = "entry") {
    if (!text) return;
    S.journal.push({ kind, text });
    let trimmed = false;
    while (S.journal.length > 90) {
      S.journal.shift();
      trimmed = true;
    }
    paintJournal({ force: trimmed });
  }

  function tick(min) {
    const wasNight = isNight(S.elapsed);
    S.elapsed += min;
    const nowNight = isNight(S.elapsed);
    if (!wasNight && nowNight && S.corruption >= 3 && !S.nightHungerSaid) {
      S.nightHungerSaid = true;
      log("入夜了。喉咙里那点饥渴又抬了抬头，你压下去。", "sys");
    }
  }

  function applyPhase() {
    el.game.classList.toggle("phase-night", isNight(S.elapsed));
    el.game.classList.toggle("phase-day", !isNight(S.elapsed));
  }

  function snap() {
    return {
      ...S,
      bagPieces: (S.bagPieces || []).map((p) => ({ ...p })),
      weaponPieces: (S.weaponPieces || []).map((p) => ({ ...p })),
      armorPieces: (S.armorPieces || []).map((p) => ({ ...p })),
      lootStaging: (S.lootStaging || []).map((p) => ({ ...p })),
      equipped: { ...(S.equipped || {}) },
      powers: [...S.powers],
      flags: [...S.flags],
      seen: [...S.seen],
      visits: { ...S.visits },
      look: { ...S.look },
      combat: S.combat
        ? { ...S.combat, enemies: S.combat.enemies.map((e) => ({ ...e })) }
        : null,
      journal: S.journal.slice(-50),
      autoReload: S.autoReload !== false,
      gunLoad: S.gunLoad ? JSON.parse(JSON.stringify(S.gunLoad)) : {},
    };
  }

  function migrateToPieces(d) {
    const state = {
      bagPieces: [],
      weaponPieces: [],
      armorPieces: [],
      equipped: {
        weaponUid: null,
        armorUid: null,
        charm: (d.equipped && d.equipped.charm) || null,
        weapon: d.equipped && d.equipped.weapon,
        armor: d.equipped && d.equipped.armor,
      },
    };
    if (Array.isArray(d.weaponPieces)) {
      state.weaponPieces = d.weaponPieces.map((p) => ({
        uid: p.uid || nextBagUid(),
        id: p.id,
        x: p.x | 0,
        y: p.y | 0,
        rot: p.rot | 0,
        qty: p.qty,
      }));
    }
    if (Array.isArray(d.armorPieces)) {
      state.armorPieces = d.armorPieces.map((p) => ({
        uid: p.uid || nextBagUid(),
        id: p.id,
        x: p.x | 0,
        y: p.y | 0,
        rot: p.rot | 0,
        qty: p.qty,
      }));
    }
    if (d.equipped && d.equipped.weaponUid) state.equipped.weaponUid = d.equipped.weaponUid;
    if (d.equipped && d.equipped.armorUid) state.equipped.armorUid = d.equipped.armorUid;

    if (Array.isArray(d.bagPieces) && d.bagPieces.length) {
      state.bagPieces = d.bagPieces.map((p) => ({
        uid: p.uid || nextBagUid(),
        id: p.id,
        x: p.x | 0,
        y: p.y | 0,
        rot: p.rot | 0,
        qty: p.qty,
      }));
    } else {
      const ids = [];
      if (Array.isArray(d.bag)) d.bag.forEach((id) => id && ids.push(id));
      else if (Array.isArray(d.items)) {
        d.items.forEach((id) => {
          if (!id) return;
          ids.push(id);
        });
      }
      ids.forEach((id) => bagAddPiece(state, id));
    }
    migrateEquipmentLayout(state);
    if (!equippedId(state, "weapon")) {
      const k = bagAddPiece(state, "knife");
      if (k) setHeldWeapon(state, k.uid);
    }
    return {
      bagPieces: state.bagPieces,
      weaponPieces: state.weaponPieces,
      armorPieces: state.armorPieces,
      equipped: {
        weaponUid: state.equipped.weaponUid || null,
        armorUid: state.equipped.armorUid || null,
        charm: state.equipped.charm || null,
      },
    };
  }

  function restore(d) {
    const mig = migrateToPieces(d);
    S = {
      ...fresh(),
      ...d,
      bagPieces: mig.bagPieces,
      weaponPieces: mig.weaponPieces,
      armorPieces: mig.armorPieces,
      lootStaging: Array.isArray(d.lootStaging)
        ? d.lootStaging.map((p) => ({
            uid: p.uid || nextBagUid(),
            id: p.id,
            rot: p.rot | 0,
          }))
        : [],
      equipped: mig.equipped,
      powers: new Set(d.powers || []),
      flags: new Set(d.flags || []),
      seen: new Set(d.seen || []),
      visits: d.visits || {},
      look: d.look || {},
      journal: d.journal || [],
      combat: d.combat || null,
      nightHungerSaid: !!d.nightHungerSaid,
      autoReload: d.autoReload !== false,
      gunLoad: d.gunLoad || {},
    };
    delete S.items;
    delete S.bag;
    migrateEquipmentLayout(S);
    journalPainted = 0;
  }

  function stagingList() {
    if (!S.lootStaging) S.lootStaging = [];
    return S.lootStaging;
  }

  async function beginLootSession(ids, opts = {}) {
    const reason = opts.reason || "pickup";
    const incoming = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    const staging = stagingList();
    const before = staging.length;
    incoming.forEach((id) => {
      if (bagHas(S, id) && (WORLD.items[id] || {}).slot === "key") return;
      if (staging.some((p) => p.id === id) && (WORLD.items[id] || {}).slot === "key") return;
      staging.push({ uid: nextBagUid(), id, rot: 0 });
    });
    if (!staging.length && opts.skipIfEmpty) {
      return { ok: false, reason: "empty" };
    }
    const added = staging.length - before;
    const shouldSearch =
      !opts.skipSearch &&
      (reason === "loot" || reason === "pickup") &&
      added > 0;
    if (shouldSearch) {
      const reduced =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      const night = S.powers.has("night_eye");
      const base = reason === "loot" ? 1700 : 1400;
      const durationMs = reduced ? 180 : Math.max(900, base - (night ? 320 : 0));
      const label = reason === "loot" ? "搜查战利品…" : "搜索物资…";
      const ring = await SearchRing.run({ label, durationMs });
      if (ring === "cancel") {
        staging.splice(before);
        toast("已取消搜索");
        if (typeof SFX !== "undefined") SFX.play("search_cancel");
        return { ok: false, reason: "cancel" };
      }
      if (typeof SFX !== "undefined") SFX.play("search_done");
    }
    if (typeof SFX !== "undefined") SFX.play(reason === "loot" || reason === "pickup" ? "loot" : "bag_open");
    CombatUI.bind(bindCombatApi());
    CombatUI.openBagSession({
      fromBattle: !!opts.fromBattle || S.mode === "combat",
      reason,
      hasLoot: staging.length > 0,
    });
    return { ok: true, count: staging.length };
  }

  function placeFromStaging(uid, x, y, rot, zone) {
    const staging = stagingList();
    const i = staging.findIndex((p) => p.uid === uid);
    if (i < 0) return false;
    const st = staging[i];
    const home = itemHomeZone(st.id);
    const z = zone || home;
    return placeFromStagingToZone(uid, z, x, y, rot);
  }

  function rotateStagingPiece(uid) {
    const st = stagingList().find((p) => p.uid === uid);
    if (!st) return false;
    st.rot = (st.rot + 1) % 4;
    return true;
  }

  function abandonStaging() {
    const staging = stagingList();
    const n = staging.length;
    const names = staging.map((p) => (WORLD.items[p.id] || {}).name || p.id);
    S.lootStaging = [];
    if (n) {
      log(`放弃未收之物：${names.join("、")}。`, "sys");
      toast(n > 1 ? `已放弃 ${n} 件` : "已放弃剩余");
    }
    CombatUI.closeBag({ force: true });
    panels();
  }

  /** 打开行囊管理；有 ids 则进入待收流程 */
  function tryAddItem(id, opts = {}) {
    if (bagHas(S, id) && (WORLD.items[id] || {}).slot === "key") {
      return { ok: false, reason: "already" };
    }
    return beginLootSession([id], {
      reason: opts.reason || "pickup",
      fromBattle: opts.fromBattle,
      toast: opts.toast,
    });
  }

  function removeBagId(id) {
    return bagRemoveOneId(S, id);
  }

  function equipItem(id, uid) {
    const it = WORLD.items[id];
    if (!it) return;
    /* 武器/护甲：在栏内设为持有 */
    if (it.slot === "weapon") {
      const hit = uid
        ? findPieceAnywhere(S, uid)
        : findPieceByIdAnywhere(S, id);
      if (!hit || hit.piece.id !== id || itemHomeZone(hit.piece.id) !== "weapon") {
        toast("未找到该兵器");
        return;
      }
      setHeldWeapon(S, hit.piece.uid);
      if (S.autoReload !== false && typeof autoReloadFirearms === "function") autoReloadFirearms(S);
      log(`持有${it.name}。`, "sys");
      toast(`持有${it.name}`);
      panels();
      return;
    }
    if (it.slot === "armor") {
      const hit = uid
        ? findPieceAnywhere(S, uid)
        : findPieceByIdAnywhere(S, id);
      if (!hit || hit.piece.id !== id || itemHomeZone(hit.piece.id) !== "armor") {
        toast("未找到该护甲");
        return;
      }
      setHeldArmor(S, hit.piece.uid);
      log(`穿上${it.name}。`, "sys");
      toast(`穿上${it.name}`);
      panels();
      return;
    }
    if (it.slot !== "charm") return;
    const piece = uid
      ? bagPieces(S).find((p) => p.uid === uid)
      : bagPieces(S).find((p) => p.id === id);
    if (!piece || piece.id !== id) return;
    const prev = S.equipped.charm;
    bagRemoveUid(S, piece.uid);
    if (prev) {
      if (!bagAddPiece(S, prev)) {
        bagAddPiece(S, id, { x: piece.x, y: piece.y, rot: piece.rot });
        toast("行囊摆不下旧符，无法更换");
        return;
      }
    }
    S.equipped.charm = id;
    log(`装备了${it.name}。`, "sys");
    toast(`已装备${it.name}`);
    panels();
  }

  function useItem(id, uid) {
    const piece = uid
      ? bagPieces(S).find((p) => p.uid === uid)
      : bagPieces(S).find((p) => p.id === id);
    if (!piece || piece.id !== id) return;
    if (id === "ration") {
      bagRemoveUid(S, piece.uid);
      S.hp = Math.min(WORLD.maxHp, S.hp + 1);
      log("你咬一口干粮，压住战栗。");
      toast("气血 +1");
    } else if (id === "antidote") {
      bagRemoveUid(S, piece.uid);
      S.corruption = Math.max(0, S.corruption - 2);
      log("苦药下肚。饥渴退了一点——也就一点。");
      toast("渴染 -2");
    }
    panels();
  }

  function dropItem(uid) {
    const hit = findPieceAnywhere(S, uid);
    if (!hit) return;
    const piece = hit.piece;
    const it = WORLD.items[piece.id];
    if (it && it.noDrop) {
      toast("此物不可丢弃");
      return;
    }
    if (hit.zone === "weapon" && (S.weaponPieces || []).length <= 1) {
      toast("至少留一件兵器");
      return;
    }
    bagRemoveUid(S, uid);
    log(`丢弃了${it ? it.name : piece.id}。`, "sys");
    panels();
  }

  function moveZonePiece(zone, uid, x, y, rot) {
    const list = piecesOf(S, zone);
    const piece = list.find((p) => p.uid === uid);
    if (!piece) return false;
    if (!zoneCanPlace(S, zone, piece.id, x, y, rot, uid)) return false;
    piece.x = x;
    piece.y = y;
    piece.rot = rot;
    return true;
  }

  function moveBagPiece(uid, x, y, rot) {
    return moveZonePiece("bag", uid, x, y, rot);
  }

  function moveWeaponPiece(uid, x, y, rot) {
    return moveZonePiece("weapon", uid, x, y, rot);
  }

  function moveArmorPiece(uid, x, y, rot) {
    return moveZonePiece("armor", uid, x, y, rot);
  }

  function rotateZonePiece(zone, uid) {
    const list = piecesOf(S, zone);
    const piece = list.find((p) => p.uid === uid);
    if (!piece) return false;
    const next = (piece.rot + 1) % 4;
    if (zoneCanPlace(S, zone, piece.id, piece.x, piece.y, next, uid)) {
      piece.rot = next;
      return true;
    }
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (zoneCanPlace(S, zone, piece.id, piece.x + dx, piece.y + dy, next, uid)) {
          piece.x += dx;
          piece.y += dy;
          piece.rot = next;
          return true;
        }
      }
    }
    toast("转不过去");
    return false;
  }

  function rotateBagPiece(uid) {
    return rotateZonePiece("bag", uid);
  }

  function switchHeldWeapon(uid) {
    if (!S.combat) {
      if (!setHeldWeapon(S, uid)) return false;
      panels();
      return true;
    }
    if (S.combat.switchedWeapon) {
      toast("本回合已换过兵器");
      return false;
    }
    if (equippedUid(S, "weapon") === uid) return false;
    if (!setHeldWeapon(S, uid)) return false;
    S.combat.switchedWeapon = true;
    const it = WORLD.items[equippedId(S, "weapon")];
    const name = it ? it.name : "兵器";
    log(`切换到${name}。`, "sys");
    toast(`切换到${name}`);
    if (S.autoReload !== false && typeof autoReloadFirearms === "function") autoReloadFirearms(S);
    panels();
    return true;
  }

  function placeFromStagingToZone(uid, zone, x, y, rot) {
    const staging = stagingList();
    const i = staging.findIndex((p) => p.uid === uid);
    if (i < 0) return false;
    const st = staging[i];
    if (!zoneAllowsItem(zone, st.id)) return false;
    const r = rot == null ? st.rot | 0 : rot | 0;
    if (!zoneCanPlace(S, zone, st.id, x, y, r)) return false;
    staging.splice(i, 1);
    ensurePiecesArr(S, zone).push({ uid: st.uid, id: st.id, x, y, rot: r, qty: st.qty });
    if (itemHomeZone(st.id) === "weapon" && !equippedUid(S, "weapon")) setHeldWeapon(S, st.uid);
    if (itemHomeZone(st.id) === "armor" && !equippedUid(S, "armor")) setHeldArmor(S, st.uid);
    if (typeof ensureGunState === "function" && isFirearm(st.id)) ensureGunState(S, st.id);
    const it = WORLD.items[st.id];
    if (it) toast(`收入${it.name}`);
    if (typeof SFX !== "undefined") SFX.play("bag_place");
    panels();
    return true;
  }

  /** 跨区挪放（武器↔行囊、护甲↔行囊等） */
  function transferPiece(uid, fromZone, toZone, x, y, rot) {
    if (fromZone === toZone) {
      return moveZonePiece(toZone, uid, x, y, rot);
    }
    const list = piecesOf(S, fromZone);
    const piece = list.find((p) => p.uid === uid);
    if (!piece) return false;
    if (!zoneAllowsItem(toZone, piece.id)) return false;
    if (!zoneCanPlace(S, toZone, piece.id, x, y, rot)) return false;
    zoneRemoveUid(S, fromZone, uid);
    piece.x = x;
    piece.y = y;
    piece.rot = rot;
    ensurePiecesArr(S, toZone).push(piece);
    if (toZone !== "weapon" && S.equipped && S.equipped.weaponUid === uid) {
      /* 持有可留在行囊 */
    }
    panels();
    return true;
  }

  function syncVitalFx() {
    const fx = document.getElementById("screen-fx");
    if (!fx) return;
    const critical = S.hp > 0 && S.hp < 3 && S.mode !== "ending";
    fx.classList.toggle("critical", critical);
    document.body.classList.toggle("hp-critical", critical);
  }

  function screenHitFx() {
    const fx = document.getElementById("screen-fx");
    const shell = document.getElementById("game");
    if (fx) {
      fx.classList.remove("hit");
      void fx.offsetWidth;
      fx.classList.add("hit");
      clearTimeout(fx._hitT);
      fx._hitT = setTimeout(() => fx.classList.remove("hit"), 420);
    }
    /* 用 WAAPI 震动，避免覆盖 #game 的入场 animation 造成整页闪白重载 */
    if (shell && typeof shell.animate === "function") {
      if (shell._shakeAnim) {
        try {
          shell._shakeAnim.cancel();
        } catch (_) {}
      }
      shell._shakeAnim = shell.animate(
        [
          { transform: "translate(0, 0)" },
          { transform: "translate(-6px, 3px)" },
          { transform: "translate(7px, -3px)" },
          { transform: "translate(-4px, -2px)" },
          { transform: "translate(4px, 2px)" },
          { transform: "translate(0, 0)" },
        ],
        { duration: 380, easing: "ease-out" },
      );
    }
    syncVitalFx();
  }

  function panels() {
    applyPhase();
    el.status.textContent = [
      `${formatWatch(S.elapsed)}`,
      `气血  ${bars(S.hp, WORLD.maxHp)}  ${S.hp}/${WORLD.maxHp}`,
      `渴染  ${S.corruption}${S.corruption >= 5 ? "  · 已深" : S.corruption >= 3 ? "  · 渐起" : ""}`,
    ].join("\n");

    if (el.gear) el.gear.textContent = gearSummary(S);

    const used = bagCount(S);
    const cap = bagCellCapacity();
    el.inv.textContent = `${used}/${cap}`;
    syncVitalFx();
  }

  function bindCombatApi() {
    return {
      getState: () => S,
      log,
      onWin: () => finishFight("win"),
      onFlee: () => finishFight("flee"),
      checkDead: () => {
        if (checkEnd()) {
          CombatUI.close();
          return true;
        }
        return false;
      },
      useItem,
      equipItem,
      dropItem,
      moveBagPiece,
      moveWeaponPiece,
      moveArmorPiece,
      rotateBagPiece,
      rotateZonePiece,
      placeFromStaging,
      placeFromStagingToZone,
      transferPiece,
      switchHeldWeapon,
      setHeldWeapon: (uid) => {
        const ok = setHeldWeapon(S, uid);
        if (ok) panels();
        return ok;
      },
      setHeldArmor: (uid) => {
        const ok = setHeldArmor(S, uid);
        if (ok) panels();
        return ok;
      },
      rotateStagingPiece,
      abandonStaging,
      onHud: () => panels(),
      screenHit: () => screenHitFx(),
      onBagClose: () => {
        panels();
        if (S.mode === "explore") render();
      },
    };
  }

  function linkFromHere(toId) {
    const loc = WORLD.locs[S.loc];
    return (loc.links || []).find((l) => l.to === toId) || null;
  }

  function mapTipFor(toId) {
    if (!mapNodeVisible(toId)) return "尚未探明。";
    if (toId === S.loc) return "当前所在。";
    const link = linkFromHere(toId);
    if (!link) return "不相邻，须逐程而行。";
    const dest = WORLD.locs[toId];
    const locked = link.need && !link.need.every((f) => S.flags.has(f));
    const lines = [`${dest.name}`, `${link.min} 刻`];
    if (locked) lines.push(needHint(link.need));
    else if (link.risky) lines.push(isNight(S.elapsed) ? "夜间易遇袭" : "途中或遇袭");
    else lines.push("路尚平稳");
    return lines.join(" · ");
  }

  /** 未探索不看全图：仅当前、已访、以及从当前出发的下一步；药谷须先有密旨抄件 */
  function mapNodeVisible(id) {
    if (id === "valley" && !bagHas(S, "edict")) return false;
    if (id === S.loc) return true;
    if (S.visits[id]) return true;
    return !!linkFromHere(id);
  }

  function renderMap() {
    if (!el.minimap) return;
    const vw = WORLD.mapView.w;
    const vh = WORLD.mapView.h;
    const canMove = S.mode === "explore";
    el.minimap.classList.toggle("disabled", !canMove);
    el.minimap.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "map-lines");
    svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    svg.setAttribute("preserveAspectRatio", "none");

    const drawn = new Set();
    Object.keys(WORLD.locs).forEach((fromId) => {
      if (!mapNodeVisible(fromId)) return;
      const from = WORLD.locs[fromId];
      (from.links || []).forEach((link) => {
        if (!mapNodeVisible(link.to)) return;
        const key = [fromId, link.to].sort().join("|");
        if (drawn.has(key)) return;
        drawn.add(key);
        const to = WORLD.locs[link.to];
        if (!to) return;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", from.x);
        line.setAttribute("y1", from.y);
        line.setAttribute("x2", to.x);
        line.setAttribute("y2", to.y);
        line.setAttribute("stroke", "#4a4034");
        line.setAttribute("stroke-width", "1.2");
        line.setAttribute("stroke-dasharray", link.risky ? "3 3" : "0");
        svg.appendChild(line);
      });
    });
    el.minimap.appendChild(svg);

    Object.entries(WORLD.locs).forEach(([id, loc]) => {
      if (!mapNodeVisible(id)) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-node";
      btn.style.left = `${(loc.x / vw) * 100}%`;
      btn.style.top = `${(loc.y / vh) * 100}%`;

      const img = document.createElement("img");
      img.src = loc.icon;
      img.alt = loc.short || loc.name;
      img.draggable = false;
      btn.appendChild(img);

      const name = document.createElement("span");
      name.className = "map-name";
      name.textContent = loc.short || loc.name;
      btn.appendChild(name);

      const link = linkFromHere(id);
      const isHere = id === S.loc;
      const locked = link && link.need && !link.need.every((f) => S.flags.has(f));
      const reachable = !!(link && !locked && canMove);

      if (isHere) btn.classList.add("here");
      else if (reachable) btn.classList.add("reachable");
      else if (link && locked) btn.classList.add("locked");
      else btn.classList.add("dim");

      btn.addEventListener("mouseenter", () => {
        el.mapTip.hidden = false;
        el.mapTip.textContent = mapTipFor(id);
      });
      btn.addEventListener("mouseleave", () => {
        el.mapTip.hidden = true;
      });
      btn.addEventListener("click", () => {
        if (!reachable) {
          el.mapTip.hidden = false;
          el.mapTip.textContent = mapTipFor(id);
          return;
        }
        moveTo(link);
      });

      el.minimap.appendChild(btn);
    });
  }

  function appendJournalNodes(e, animate) {
    const nodes = [];
    if (e.kind === "sys") {
      const d = document.createElement("div");
      d.className = "sys";
      d.textContent = e.text;
      nodes.push(d);
    } else if (e.kind === "banner") {
      const d = document.createElement("div");
      d.className = "banner";
      d.textContent = e.text;
      nodes.push(d);
    } else if (e.kind === "ending") {
      const tag = document.createElement("div");
      tag.className = "ending-tag";
      tag.textContent = e.tag;
      nodes.push(tag);
      String(e.text)
        .split(/\n\n+/)
        .forEach((para) => {
          const p = document.createElement("div");
          p.className = "entry";
          p.textContent = para;
          nodes.push(p);
        });
    } else {
      String(e.text)
        .split(/\n\n+/)
        .forEach((para) => {
          const p = document.createElement("div");
          p.className = "entry";
          p.textContent = para;
          nodes.push(p);
        });
    }
    nodes.forEach((node, i) => {
      if (animate) {
        node.classList.add("journal-fade");
        if (i > 0) node.style.animationDelay = `${i * 0.08}s`;
      }
      el.journal.appendChild(node);
    });
  }

  function paintJournal(opts = {}) {
    const force = !!opts.force;
    const silent = !!opts.silent;
    if (force || journalPainted > S.journal.length) {
      el.journal.innerHTML = "";
      journalPainted = 0;
      S.journal.forEach((e, idx) => {
        const animate = !silent && idx === S.journal.length - 1;
        appendJournalNodes(e, animate);
      });
      journalPainted = S.journal.length;
    } else {
      for (let i = journalPainted; i < S.journal.length; i++) {
        const isLast = i === S.journal.length - 1;
        appendJournalNodes(S.journal[i], !silent && isLast);
      }
      journalPainted = S.journal.length;
    }
    el.journal.scrollTop = el.journal.scrollHeight;
  }

  function btn(label, sub, fn, cls = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cmd " + cls;
    b.innerHTML = label + (sub ? `<span class="sub">${sub}</span>` : "");
    b.addEventListener("click", fn);
    return b;
  }

  function group(title, buttons) {
    if (!buttons.length) return;
    const g = document.createElement("div");
    g.className = "cmd-group";
    g.textContent = title;
    el.commands.appendChild(g);
    const row = document.createElement("div");
    row.className = "cmd-row";
    buttons.forEach((b) => row.appendChild(b));
    el.commands.appendChild(row);
  }

  function childCoda(kind) {
    if (kind === "good" && S.flags.has("saved_child")) {
      return "\n\n出城时，你好像听见村里那孩子说：瓶子没有了。谢谢。";
    }
    if (kind === "bad" && S.flags.has("left_child")) {
      return "\n\n雪夜里那声没人应的哭，又贴上耳边。";
    }
    return "";
  }

  function endAs(id, text) {
    CombatUI.close();
    S.mode = "ending";
    S.combat = null;
    S.ending = id;
    S.seen.add(id);
    S.journal.push({ kind: "ending", tag: WORLD.endings[id] || id, text });
    if (id === "overrun") {
      paintJournal();
      panels();
      showDeathScreen(text);
      return;
    }
    render();
  }

  function checkEnd() {
    if (S.hp <= 0) {
      log("气血没了。雪盖上来。", "sys");
      endAs(
        "overrun",
        "你倒在路上。行尸不问你来干嘛，只问你身子还热不热。" + childCoda("bad"),
      );
      return true;
    }
    if (S.corruption >= 8 && S.flags.has("saw_throne")) {
      endAs(
        "corrupted",
        "秘密你看清了，自己喉咙里的饥渴也看清了。瓶子碎了，药钉在牙缝里。出宫时旁人躲你的眼睛。" +
          childCoda("bad"),
      );
      return true;
    }
    return false;
  }

  function startFight(id, note) {
    if (
      id === "canal_guard" &&
      (S.flags.has("canal_guard_slain") || S.flags.has("jade_hint"))
    ) {
      toast("锦衣行尸已被斩落，再无第二具。");
      return;
    }
    const c = cloneFight(id);
    if (!c) return;
    S.mode = "combat";
    S.combat = c;
    if (S.powers.has("decree_fear") && !c.boss) {
      c.enemies.forEach((e) => {
        if (e.hp <= 3) e.stunned = 1;
      });
      log("官威一震，弱者愣住。", "sys");
    }
    log(`—— ${c.title} ——`, "banner");
    log(c.intro);
    if (note) log(note, "sys");
    panels();
    renderMap();
    paintJournal();
    el.mode.textContent = "斩杀";
    el.cmdTitle.textContent = "战法";
    el.loc.textContent = c.title;
    el.clock.textContent = `第 ${c.round} 合`;
    CombatUI.open(bindCombatApi());
  }

  function finishFight(result) {
    const c = S.combat;
    const t = COMBAT.templates[c.id];
    CombatUI.close();
    S.mode = "explore";
    S.combat = null;
    if (result === "win") {
      let ess = 0;
      t.enemies.forEach((e) => {
        ess += e.essence || 1;
      });
      S.essence = Math.min(WORLD.maxEssence, S.essence + ess);
      (t.onWinFlags || []).forEach((f) => S.flags.add(f));
      if (S.powers.has("soul_drain")) {
        S.hp = Math.min(WORLD.maxHp, S.hp + 1);
        log("吸魂：你夺回一口气。", "sys");
      }
      const corruptBefore = S.corruption;
      if (ess >= 3 && c.id !== "throne_bite") {
        S.corruption += 1;
      }
      tick(2);
      log(`敌已倒下。`);
      const lootIds = [];
      if (c.id === "canal_guard") {
        if (!bagHas(S, "blade") && !bagHas(S, "palace_blade")) {
          lootIds.push("blade");
          log("自锦衣行尸腰间取下绣春刀。", "sys");
        }
        if (!bagHas(S, "edict")) {
          lootIds.push("edict");
          log("怀中搜出密旨抄件。", "sys");
        }
        lootIds.push("jade_chip");
      }
      if (c.id === "gate_chain") {
        if (!bagHas(S, "armor_scale")) {
          lootIds.push("armor_scale");
          log("自城门守军身上剥下锦衣残甲。", "sys");
        } else toast("城门可入");
      }
      if (c.id === "valley_pack") toast("药谷已清");
      if (c.id === "throne_bite") {
        S.flags.add("saw_throne");
        log("龙椅空了。瓶子碎在阶下。事已查清——还做人，还是变成那般东西，只在一念。");
        if (corruptBefore >= 5) {
          endAs(
            "corrupted",
            "你砍断了那股饥渴，它却迁到你舌根。出宫时，守门的尸向你跪下——同类之礼。" +
              childCoda("bad"),
          );
          return;
        }
        endAs(
          "truth",
          "你把密旨抄件和玉片放在台阶上，记下：旨意、山谷、药、那一口咬。长生不是福，是祸。你出京去，雪落在刀上。" +
            childCoda("good"),
        );
        return;
      }
      if (S.pendingMove && result === "win") {
        const link = S.pendingMove;
        S.pendingMove = null;
        S.loc = link.to;
        S.visits[S.loc] = (S.visits[S.loc] || 0) + 1;
        log(`抵达【${WORLD.locs[link.to].name}】。`);
        describe(true);
      }
      if (!checkEnd()) {
        render();
        if (lootIds.length) {
          beginLootSession(lootIds, { reason: "loot" });
          const names = lootIds
            .map((id) => (WORLD.items[id] || {}).name || id)
            .join("、");
          toast(`战利品：${names}`);
        }
      }
      return;
    } else if (result === "flee") {
      tick(1);
      log("你撤进雪幕。身后啃咬声不散。");
      S.pendingMove = null;
    }
    if (!checkEnd()) render();
  }

  function describe(enter) {
    const loc = WORLD.locs[S.loc];
    if (enter) log(`【${loc.name}】`);
    log(locText(S.loc, S));
  }

  async function lookAround() {
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const night = S.powers.has("night_eye");
    const durationMs = reduced ? 160 : Math.max(900, 1500 - (night ? 350 : 0));
    const ring = await SearchRing.run({ label: "搜索中…", durationMs });
    if (ring === "cancel") {
      toast("已取消搜索");
      if (typeof SFX !== "undefined") SFX.play("search_cancel");
      return;
    }
    if (typeof SFX !== "undefined") SFX.play("search_done");
    tick(3);
    S.look[S.loc] = (S.look[S.loc] || 0) + 1;
    const n = S.look[S.loc];
    const table = {
      road_inn: [
        () => {
          if (!bagHas(S, "talisman")) {
            beginLootSession(["talisman"], { reason: "pickup" });
            return "柜底摸到一张镇尸符，朱砂还潮着。";
          }
          return "店里没别的了，只剩风声。";
        },
        () => {
          if (S.powers.has("night_eye") && !bagHas(S, "jade_chip")) {
            beginLootSession(["jade_chip"], { reason: "pickup" });
            return "鬼瞳一开，灶灰底下露出玉瓶碎片。";
          }
          if (!bagHas(S, "armor_light") && !bagHas(S, "armor_scale")) {
            beginLootSession(["armor_light"], { reason: "pickup" });
            return "床下拖出一块棉甲残片，尚可护身。";
          }
          return "灶灰翻了个遍，没别的。";
        },
      ],
      village: [
        () => "循着哭声到了柴房。里头孩童饿极。救也可，弃也可。",
        () => "井水赤黑。井壁刻着：药过，人变。",
      ],
      canal: [
        () => "舱盖下全是刮痕。像有人想出来，也像有东西想进去。",
        () => {
          if (S.flags.has("jade_hint") || S.flags.has("canal_guard_slain")) {
            return "纤道上只剩风雪。那具锦衣行尸，已不在了。";
          }
          S.flags.add("know_guard");
          return "你认准锦衣破服的方向——寻药百户回京的路。";
        },
        () => {
          if (S.flags.has("jade_hint") || S.flags.has("canal_guard_slain")) {
            return "脚印断在雪里。西边极寒药谷——密旨所向。";
          }
          return "纤道上只剩风雪。";
        },
      ],
      post: [
        () => {
          if (bagHas(S, "edict")) {
            return "驿柜空了。案上撕痕，正对得上你腰间那份密旨抄件。";
          }
          return "案上墨迹未干，抄件却被撕走了——像是锦衣卫回京路上带走的。";
        },
        () => {
          S.flags.add("palace_key");
          if (!bagHas(S, "armor_light") && !bagHas(S, "armor_scale")) {
            beginLootSession(["armor_light"], { reason: "pickup" });
            return "简图标着入宫偏门。柜角还有驿卒留下的棉甲残片。";
          }
          return "草图上画着入宫偏门。你记下了。";
        },
      ],
      gate: [
        () => "铁链从里面锁死，又被活物扯松。斩断它，城门才能开。",
        () => "门砖缝里嵌着半枚牙齿，釉色光亮——宫中才有。",
      ],
      inner: [
        () => "鼓楼铃舌断了，铃倒还自己晃。",
        () => "捡到一只宫女绣鞋，鞋尖朝皇城。",
        () => {
          if (isNight(S.elapsed) && !S.flags.has("night_street")) {
            S.flags.add("night_street");
            return "夜里两侧黑影更多，起起落落。";
          }
          return "雪又盖住一层跪印。";
        },
      ],
      yamen: [
        () => {
          S.flags.add("palace_key");
          S.flags.add("valley_map");
          if (!bagHas(S, "antidote")) {
            beginLootSession(["antidote"], { reason: "pickup" });
          }
          return "印匣底下压着解毒散、腰牌拓样，还有药谷方位图。西边极寒那儿，你记下了。";
        },
        () => "公案空着。封锁京师的空文还盖着大印，可笑。",
      ],
      valley: [
        () => "岩缝凉气往袖口里钻。深处像有碎玉反光。",
        () => {
          if (S.flags.has("valley_cleared")) {
            return "守尸没了。残火旁还有干柴，够再燃一场。";
          }
          return "行尸守着岩缝。不先清干净，火点不稳。";
        },
      ],
      palace: [
        () => "护城河里捞起半卷黄绫：长生宴的谱子，没奏完。",
        () => {
          if (!bagHas(S, "palace_blade")) {
            beginLootSession(["palace_blade"], { reason: "pickup" });
            return "铜门缝里卡着一柄御前残刃，仍有余锋。你抽了出来。";
          }
          return "铜门后头有气息。不是风。";
        },
      ],
      throne: [() => "烛泪里凝着指纹。皇上喝药前，手在抖。"],
    };
    const arr = table[S.loc] || [() => "雪地茫茫，没话说。"];
    const fn = arr[Math.min(n - 1, arr.length - 1)];
    log(fn());
    if (S.loc === "village" && n === 1) S.flags.add("hear_child");
    render();
  }

  function moveTo(link) {
    const chance = ambushChance(S.elapsed);
    const riskyFight =
      link.risky &&
      (Math.random() < chance ||
        (S.loc === "gate" && !S.flags.has("gate_open") && link.to === "inner"));

    if (S.loc === "gate" && link.to === "inner" && !S.flags.has("gate_open")) {
      S.pendingMove = link;
      startFight("gate_chain", "要进城，先把门轴上那饿鬼收拾了。");
      return;
    }

    tick(link.min);
    if (riskyFight && link.to !== "inner") {
      S.pendingMove = link;
      const map = {
        canal: S.flags.has("canal_guard_slain") || S.flags.has("jade_hint")
          ? "road_ghoul"
          : "canal_guard",
        village: "village_pack",
        post: "road_ghoul",
        gate: "gate_chain",
        inner: "street_horde",
        palace: "street_horde",
        valley: "valley_pack",
      };
      const fightId =
        link.to === "valley" || S.loc === "valley"
          ? "valley_pack"
          : map[S.loc] || "road_ghoul";
      startFight(
        fightId,
        `前往【${WORLD.locs[link.to].name}】途中——${isNight(S.elapsed) ? "夜间更险。" : ""}`,
      );
      return;
    }

    S.loc = link.to;
    S.visits[S.loc] = (S.visits[S.loc] || 0) + 1;
    log(`行路 ${link.min} 刻，抵达【${WORLD.locs[link.to].name}】`, "sys");
    describe(true);
    render();
  }

  function buildExploreCmds() {
    const loc = WORLD.locs[S.loc];
    el.mode.textContent = "行路";
    el.cmdTitle.textContent = "行事";
    el.loc.textContent = loc.name;
    el.clock.textContent = formatWatch(S.elapsed);

    const acts = [
      btn("察看四周", "耗时，或有所得", () => {
        lookAround();
      }),
      btn("稍事休息", "回复 1 气血", () => {
        tick(8);
        S.hp = Math.min(WORLD.maxHp, S.hp + 1);
        log(isNight(S.elapsed) ? "你靠着残墙，听夜。气血稍复。" : "你靠着残墙，听雪。气血稍复。");
        render();
      }),
    ];

    if (S.loc === "road_inn" || S.loc === "village") {
      acts.push(
        btn(
          "寻敌练刀",
          "主动战斗",
          () => {
            startFight(S.loc === "village" ? "village_pack" : "road_ghoul");
          },
          "fight",
        ),
      );
    }
    if (
      S.loc === "canal" &&
      S.flags.has("know_guard") &&
      !S.flags.has("canal_guard_slain") &&
      !S.flags.has("jade_hint")
    ) {
      acts.push(
        btn("追踪锦衣行尸", "强敌 · 唯一", () => startFight("canal_guard"), "fight"),
      );
    }
    if (S.loc === "gate" && !S.flags.has("gate_open")) {
      acts.push(btn("斩断门链", "战后可入城", () => startFight("gate_chain"), "fight"));
    }
    if (S.loc === "inner") {
      acts.push(btn("清扫长街", "多敌", () => startFight("street_horde"), "fight"));
    }
    if (S.loc === "valley") {
      if (!S.flags.has("valley_cleared")) {
        acts.push(
          btn("清除谷中行尸", "战后放火更稳妥", () => startFight("valley_pack"), "fight"),
        );
      }
      acts.push(
        btn("火焚药谷", "绝源 · 结局", () => {
          endAs(
            "martyr",
            "你点燃干柴。寒谷里火光冲天，岩缝中的药气被烤散。京师依旧残破，蔓延却少了一处源头。你没有踏上丹陛，却烧掉了长生的根子。" +
              childCoda("good"),
          );
        }),
      );
    }
    if (S.loc === "throne") {
      acts.push(
        btn("逼近丹陛", "最终之战", () => startFight("throne_bite"), "fight"),
        btn("不敢近前，退出京师", "结局", () => {
          endAs(
            "flee",
            "丹陛的影子你看见了，脚步却没有踏上去。出城时雪更大。秘密仍锁在城里。你活着退走——或许也算清醒。" +
              childCoda("bad"),
          );
        }),
      );
    }
    if (
      S.flags.has("hear_child") &&
      S.loc === "village" &&
      !S.flags.has("saved_child") &&
      !S.flags.has("left_child")
    ) {
      acts.push(
        btn("救出孩童", "", () => {
          S.flags.add("saved_child");
          log("你把干粮塞给他。他指着北边：瓶子，官爷，京城。");
          removeBagId("ration");
          render();
        }),
        btn("不加理会", "", () => {
          S.flags.add("left_child");
          S.corruption += 1;
          log("哭声被雪捂住。脚步轻了，心里却沉了下去。");
          render();
        }),
      );
    }
    if (bagHas(S, "jade_chip") && bagHas(S, "edict") && S.loc === "palace") {
      acts.push(
        btn("以残片与密旨开偏门", "通往丹陛", () => {
          S.flags.add("palace_key");
          log("寒玉贴门，朱砂字烫手。偏门缝开一线，宫内气味扑面——香、血，还有长生。");
          toast("可近丹陛");
          render();
        }),
      );
    }
    if (
      !S.flags.has("saw_throne") &&
      bagHas(S, "jade_chip") &&
      bagHas(S, "edict") &&
      S.corruption <= 2 &&
      (S.loc === "post" || S.loc === "yamen")
    ) {
      acts.push(
        btn("携证出京", "结局", () => {
          endAs(
            "witness",
            "你没有上丹陛，却把密旨抄件和玉瓶残片带出京城。外头或许有人肯听：长生不是福，是祸。雪落在肩上。" +
              childCoda("good"),
          );
        }),
      );
    }

    group("行动", acts);

    // 异能炼化暂隐：中期再逐步开放
    // essence / powers unlock UI omitted

    group("行囊", [
      btn(
        "打开行囊",
        `${bagCount(S)}/${bagCellCapacity()}`,
        () => openExploreBag(),
        "bag-open-cmd",
      ),
    ]);
  }

  function openExploreBag() {
    beginLootSession([], { reason: "manage", skipIfEmpty: false });
  }

  function render() {
    panels();
    renderMap();
    paintJournal();
    if (S.mode === "ending") {
      el.commands.innerHTML = "";
      el.mode.textContent = "终卷";
      el.cmdTitle.textContent = "此后";
      el.clock.textContent = formatWatch(S.elapsed);
      CombatUI.close();
      if (S.ending === "overrun") {
        if (deathEl && deathEl.hidden) showDeathScreen(
          (S.journal.find((e) => e.kind === "ending") || {}).text || "",
        );
        return;
      }
      group("收场", [
        btn("再走一遭", "重开，见过的结局还记着", () => restartRun()),
        btn("读取存档", "回到上次记下的路", () => tryLoadSave()),
      ]);
      return;
    }
    if (S.mode === "combat") {
      el.mode.textContent = "斩杀";
      el.cmdTitle.textContent = "战法";
      if (S.combat) {
        el.loc.textContent = S.combat.title;
        el.clock.textContent = `第 ${S.combat.round} 合`;
      }
      return;
    }
    el.commands.innerHTML = "";
    buildExploreCmds();
  }

  function startGame() {
    revealGame({ forceFade: true });
    window.scrollTo(0, 0);
    if (!S.journal.length) {
      log("你打雪店启程。蓑衣未干，短刀在手。左侧赴京图可点选前路。");
      describe(true);
    }
    render();
  }

  document.getElementById("btn-save").onclick = () => {
    localStorage.setItem(SAVE, JSON.stringify(snap()));
    toast("已存档");
    if (typeof SFX !== "undefined") SFX.play("ui");
  };
  document.getElementById("btn-load").onclick = () => {
    tryLoadSave();
  };
  const btnSfx = document.getElementById("btn-sfx");
  if (btnSfx && typeof SFX !== "undefined") {
    btnSfx.onclick = () => {
      const off = SFX.toggleMute();
      btnSfx.textContent = off ? "音效关" : "音效开";
      if (!off) SFX.play("ui");
    };
  }
  document.getElementById("btn-opening").onclick = () => {
    el.game.classList.remove("is-visible");
    el.game.hidden = true;
    CombatUI.close();
    hideDeathScreen();
    openingApi.replay();
  };
  const btnBag = document.getElementById("btn-bag");
  if (btnBag) {
    btnBag.onclick = () => {
      if (S.mode === "ending") return;
      beginLootSession([], {
        reason: "manage",
        fromBattle: S.mode === "combat",
      });
    };
  }

  const deathRetry = document.getElementById("death-retry");
  const deathLoad = document.getElementById("death-load");
  if (deathRetry) deathRetry.onclick = () => restartRun();
  if (deathLoad) deathLoad.onclick = () => tryLoadSave({ fromDeath: true });

  openingApi = runOpening({
    onDone: () => startGame(),
  });
})();
