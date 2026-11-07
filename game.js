(() => {
  const SAVE = WORLD.saveKey;

  function fresh() {
    const state = {
      loc: WORLD.startLoc,
      elapsed: 0,
      hp: WORLD.maxHp,
      stamina: WORLD.maxStamina,
      corruption: 0,
      bagPieces: [],
      weaponPieces: [],
      armorPieces: [],
      lootStaging: [],
      evidence: [], /* 剧情物品：不占格、不计重 */
      stash: {}, /* 各地弃物：{ 地点: [{ id, qty }] }，回来能捡 */
      equipped: { charm: null },
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
      gunLoad: {},
      wander: null, /* { fightId } 或 null，表示当前地点是否有游荡敌人 */
      satiety: WORLD.hunger.start,
    };
    bagAddPiece(state, "ration");
    /* 开局：兵器架上鸟铳、短刀，手里拿鸟铳 */
    bagAddPiece(state, "niaochong");
    bagAddPiece(state, "knife");
    if (typeof bagAddStack === "function") {
      bagAddStack(state, "powder", 8);
      bagAddStack(state, "wad", 8);
      bagAddStack(state, "shot", 8);
    }
    if (state.weaponPieces && state.weaponPieces.length) {
      const prefer =
        state.weaponPieces.find((p) => p.id === "niaochong") ||
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
    hpFill: document.getElementById("hp-fill"),
    hpText: document.getElementById("hp-text"),
    staminaFill: document.getElementById("stamina-fill"),
    satietyFill: document.getElementById("satiety-fill"),
    satietyText: document.getElementById("satiety-text"),
    staminaText: document.getElementById("stamina-text"),
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
    locBackdrop: document.getElementById("loc-backdrop"),
    locBackdropIcon: document.getElementById("loc-backdrop-icon"),
    locBackdropName: document.getElementById("loc-backdrop-name"),
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
  const deathTitleEl = document.getElementById("death-title");

  function endingTitleOf(id) {
    if (id === "overrun") return "雪盖上来";
    const raw = (WORLD.endings && WORLD.endings[id]) || id;
    return String(raw).replace(/^结局\s*[·・.\-—]\s*/, "");
  }

  function showEndingScreen(id, text) {
    if (typeof BGM !== "undefined" && BGM.sting) {
      BGM.sting(id === "overrun" ? "death" : "ending");
      BGM.stop({ fade: 1500 });
    }
    if (deathTitleEl) deathTitleEl.textContent = endingTitleOf(id);
    if (deathTextEl) deathTextEl.textContent = text || "";
    if (deathEl) deathEl.dataset.ending = id || "";
    document.body.classList.add("death-open");
    syncVitalFx();
    uiFadeShow(deathEl);
  }

  function hideEndingScreen() {
    return uiFadeHide(deathEl, 520).then(() => {
      document.body.classList.remove("death-open");
    });
  }

  function hideDeathScreen() {
    return hideEndingScreen();
  }

  function revealGame({ forceFade = false } = {}) {
    if (forceFade || el.game.hidden || !el.game.classList.contains("is-visible")) {
      uiFadeShow(el.game);
    } else {
      el.game.hidden = false;
      el.game.classList.add("is-visible");
    }
    if (typeof BGM !== "undefined") BGM.play("explore");
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
      log("雪又下了起来，官道还是那条官道。");
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
    if (!wasNight && nowNight && S.corruption >= 50 && !S.nightHungerSaid) {
      S.nightHungerSaid = true;
      log("天黑了，喉咙里那股饥渴又翻了上来，你咬牙压了下去。", "sys");
    }
  }

  /** 饿一点；饿极了每次再掉些气血。返回掉了多少血 */
  function hunger(n) {
    const H = WORLD.hunger;
    const before = S.satiety;
    /* 渴染深了饿得快：那股饥渴压不住 */
    n = n * corrFx(S).hunger;
    S.satiety = Math.max(0, S.satiety - n);
    if (before > H.hungry && S.satiety <= H.hungry) {
      log("肚里空了，脚下发虚，力气回得慢。", "sys");
      if (typeof SFX !== "undefined") SFX.play("stomach");
    }
    if (before > H.starving && S.satiety <= H.starving) log("饿得眼前发黑，再不吃东西，人就要撑不住了。", "sys");
    if (S.satiety <= H.starving && n > 0) {
      S.hp = Math.max(1, S.hp - H.starveHp);
      return H.starveHp;
    }
    return 0;
  }

  /** 吃一样东西 */
  /* 喝的（清水、黄酒、女儿红）咕咚一声，其余嚼的声音 */
  const DRINKS = ["water", "huangjiu", "nuerhong"];
  function eat(id) {
    const it = WORLD.items[id];
    if (typeof SFX !== "undefined") SFX.play(DRINKS.includes(id) ? "drink" : "eat");
    S.satiety = Math.min(WORLD.maxSatiety, S.satiety + (it.fill || 0));
    /* 渴染深了，吃下去的东西不怎么养人 */
    S.hp = Math.min(WORLD.maxHp, S.hp + Math.round((it.hp || 0) * corrFx(S).food));
    if (it.stamina) S.stamina = Math.min(maxStaminaOf(S), S.stamina + it.stamina);
    if (typeof Codex !== "undefined") Codex.see("item", id);
  }

  /** 歇脚时吃哪样：不太饿就先吃零碎的，饿了就挑最顶饿的 */
  function cheapestFood() {
    const foods = bagPieces(S).filter((p) => (WORLD.items[p.id] || {}).food);
    const dir = S.satiety <= WORLD.hunger.hungry ? -1 : 1;
    foods.sort((a, b) => dir * (WORLD.items[a.id].fill - WORLD.items[b.id].fill));
    return foods[0] || null;
  }

  function rollFood(tier) {
    const pool = WORLD.loot.food[tier] || [];
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
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
      evidence: (S.evidence || []).slice(),
      stash: JSON.parse(JSON.stringify(S.stash || {})),
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
            qty: p.qty,
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
      gunLoad: d.gunLoad || {},
      wander: d.wander || null,
      evidence: Array.isArray(d.evidence) ? d.evidence.slice() : [],
      stash: d.stash || {},
      stamina: d.stamina != null ? d.stamina : WORLD.maxStamina,
      satiety: d.satiety != null ? d.satiety : WORLD.hunger.start,
    };
    delete S.items;
    delete S.bag;
    /* 旧版允许交战中存档：读回来时退到交战前，免得停在没有按钮的战斗画面 */
    if (S.mode === "combat") {
      S.mode = "explore";
      S.combat = null;
      S.pendingMove = null;
    }
    migrateEquipmentLayout(S);
    stashOverflow();
    journalPainted = 0;
  }

  /** 整理背包时哪儿都放不下的（比如旧档里多出来的兵器、甲），留在当地 */
  function stashOverflow() {
    const extra = S.overflow || [];
    if (!extra.length) return;
    extra.forEach((p) => stashPut(S.loc, p.id, p.qty));
    S.overflow = [];
  }

  function stashPut(loc, id, qty) {
    if (!S.stash) S.stash = {};
    (S.stash[loc] = S.stash[loc] || []).push({ id, qty: qty || 1 });
  }

  function stagingList() {
    if (!S.lootStaging) S.lootStaging = [];
    return S.lootStaging;
  }

  /** 从某一档随机池里抽一件还没拿过的；抽中即记下，不会重复 */
  function rollLoot(tier) {
    const pool = (WORLD.loot.pools[tier] || []).filter((id) => !S.flags.has("loot_" + id));
    if (!pool.length) return null;
    const id = pool[Math.floor(Math.random() * pool.length)];
    S.flags.add("loot_" + id);
    return id;
  }

  /** 固定掉落：给过一次就不再给 */
  function takeFixedLoot(entry) {
    if (!entry || S.flags.has("loot_" + entry.id)) return null;
    S.flags.add("loot_" + entry.id);
    return entry;
  }

  /* 正在转"搜索物资…"时又有东西进来（比如一次搜索连给两样），并进同一轮，别互相取消 */
  let lootSearch = null; // { uids: [] }

  async function beginLootSession(ids, opts = {}) {
    const reason = opts.reason || "pickup";
    const incoming = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    const staging = stagingList();
    const before = staging.length;
    const mine = [];
    incoming.forEach((id) => {
      if (isKeyItem(id)) {
        if (bagHas(S, id)) return;
        S.evidence.push(id);
        toast(`收入证物袋：${(WORLD.items[id] || {}).name || id}`);
        if (typeof SFX !== "undefined") SFX.play("evidence");
        if (id === "edict") unlockValleyFromEdict();
        return;
      }
      const uid = nextBagUid();
      staging.push({ uid, id, rot: 0 });
      mine.push(uid);
      /* 掣电铳打的是子铳，捡到时一并带上几枚 */
      if (id === "chedian") {
        [["zichong", 2], ["zichong_empty", 1]].forEach(([zid, qty]) => {
          const zu = nextBagUid();
          staging.push({ uid: zu, id: zid, rot: 0, qty });
          mine.push(zu);
        });
      }
    });
    (opts.stacks || []).forEach(([sid, qty]) => {
      const su = nextBagUid();
      staging.push({ uid: su, id: sid, rot: 0, qty });
      mine.push(su);
    });
    if (lootSearch) {
      lootSearch.uids.push(...mine);
      return { ok: true, merged: true };
    }
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
      lootSearch = { uids: mine };
      const ring = await SearchRing.run({ label, durationMs });
      const ours = lootSearch.uids;
      lootSearch = null;
      if (ring === "cancel") {
        S.lootStaging = stagingList().filter((p) => !ours.includes(p.uid));
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
    /* 放下的东西留在当地，回来还能捡 */
    staging.forEach((p) => stashPut(S.loc, p.id, p.qty));
    if (n) {
      log(`把${names.join("、")}留在了${WORLD.locs[S.loc].short || WORLD.locs[S.loc].name}，回来还能捡。`, "sys");
      toast(n > 1 ? `留下 ${n} 件` : "已留下");
    }
    CombatUI.closeBag({ force: true });
    panels();
  }


  /** 手里那把不在兵器架上了：改拿架上剩下的 */
  function fixHeldWeapon() {
    if (!weaponPieces(S).some((p) => p.uid === S.equipped.weaponUid)) {
      const w = weaponPieces(S)[0];
      S.equipped.weaponUid = w ? w.uid : null;
    }
  }

  /** 从行囊、兵器架拖回待收区（放到地上）；合上行囊时会留在当地 */
  function putToStaging(uid, from) {
    const piece = piecesOf(S, from).find((p) => p.uid === uid);
    const it = piece && WORLD.items[piece.id];
    if (!piece || (it && it.noDrop)) return false;
    zoneRemoveUid(S, from, uid);
    stagingList().push({ uid, id: piece.id, rot: piece.rot | 0, qty: piece.qty });
    fixHeldWeapon();
    panels();
    return true;
  }

  /**
   * 放到别的东西上：把压住的那几件挤开。挤开的先往行囊空处放（各种朝向都试），
   * 放不下再试被拖那件腾出来的原位，还不行就放到待收区。返回 [[名字, 去处], ...]；放不了返回 null。
   */
  function placeDisplacing(uid, from, zone, x, y, rot) {
    const fromStaging = from === "staging";
    const src = fromStaging ? stagingList() : piecesOf(S, from);
    const piece = src.find((p) => p.uid === uid);
    if (!piece || !zoneAllowsItem(zone, piece.id) || isSlotZone(zone)) return null;
    const { w: W, h: H } = zoneSize(zone);
    const cells = itemShape(piece.id, rot).map(([dx, dy]) => [x + dx, y + dy]);
    if (cells.some(([cx, cy]) => cx < 0 || cy < 0 || cx >= W || cy >= H)) return null;
    const occ = gridOccupied(piecesOf(S, zone), uid);
    const hit = [...new Set(cells.map(([cx, cy]) => occ[`${cx},${cy}`]).filter(Boolean))];
    if (!hit.length) return null;
    if (hit.some((u) => (WORLD.items[(piecesOf(S, zone).find((p) => p.uid === u) || {}).id] || {}).noDrop)) return null;
    const old = { x: piece.x, y: piece.y };
    const displaced = hit.map((u) => zoneRemoveUid(S, zone, u)).filter(Boolean);
    if (fromStaging) src.splice(src.indexOf(piece), 1);
    else zoneRemoveUid(S, from, uid);
    const placed = { ...piece, x, y, rot };
    delete placed.qty;
    if (piece.qty != null) placed.qty = piece.qty;
    ensurePiecesArr(S, zone).push(placed);
    const moved = [];
    displaced.forEach((d) => {
      const name = (WORLD.items[d.id] || {}).name || d.id;
      const spot = zoneFindPlace(S, "bag", d.id, d.rot | 0);
      if (spot) {
        ensurePiecesArr(S, "bag").push({ ...d, ...spot });
        moved.push([name, "bag"]);
      } else if (!fromStaging && zoneAllowsItem(from, d.id) && zoneCanPlace(S, from, d.id, old.x, old.y, d.rot | 0)) {
        ensurePiecesArr(S, from).push({ ...d, x: old.x, y: old.y });
        moved.push([name, from]);
      } else {
        stagingList().push({ uid: d.uid, id: d.id, rot: d.rot | 0, qty: d.qty });
        moved.push([name, "staging"]);
      }
    });
    if (zone === "weapon" && !equippedUid(S, "weapon")) setHeldWeapon(S, uid);
    fixHeldWeapon();
    panels();
    return moved;
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
    const it = WORLD.items[id] || {};
    if (it.food) {
      bagRemoveUid(S, piece.uid);
      eat(id);
      log(`你吃了${it.name}。`);
      toast(`饱腹 +${it.fill}${it.hp ? ` · 气血 +${it.hp}` : ""}`);
    } else if (id === "antidote") {
      bagRemoveUid(S, piece.uid);
      S.corruption = Math.max(0, S.corruption - 33);
      log("一碗苦药下肚，那股饥渴略略退了些。");
      toast("喉中那股饥渴退了些");
    }
    panels();
  }

  function dropItem(uid) {
    const hit = findPieceAnywhere(S, uid);
    if (!hit) return;
    if (typeof SFX !== "undefined") SFX.play("drop_item");
    const piece = hit.piece;
    const it = WORLD.items[piece.id];
    if (it && it.noDrop) {
      toast("此物不可丢弃");
      return;
    }
    const removed = zoneRemoveUid(S, hit.zone, uid);
    if (removed) {
      if (S.equipped && S.equipped.weaponUid === uid) {
        const next = (S.weaponPieces || [])[0];
        S.equipped.weaponUid = next ? next.uid : null;
      }
      if (S.equipped && S.equipped.armorUid === uid) {
        const next = (S.armorPieces || [])[0];
        S.equipped.armorUid = next ? next.uid : null;
      }
      if (!S.lootStaging) S.lootStaging = [];
      S.lootStaging.push({
        uid: piece.uid,
        id: piece.id,
        rot: piece.rot | 0,
        qty: piece.qty,
      });
      log(`丢弃了${it ? it.name : piece.id}，进入待收区。`, "sys");
    }
    panels();
  }

  function moveZonePiece(zone, uid, x, y, rot) {
    const list = piecesOf(S, zone);
    const piece = list.find((p) => p.uid === uid);
    if (!piece) return false;
    const target = typeof pieceAtCell === "function" ? pieceAtCell(S, zone, x, y, uid) : null;
    if (target && typeof canStackMerge === "function" && canStackMerge(piece, target)) {
      mergePieceInto(S, zone, piece, target);
      panels();
      return true;
    }
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
    /* 半即时战斗里换武靠冷却限制（combat-ui afterAction），不再一回合一次 */
    if (equippedUid(S, "weapon") === uid) return false;
    if (!setHeldWeapon(S, uid)) return false;
    const it = WORLD.items[equippedId(S, "weapon")];
    const name = it ? it.name : "兵器";
    log(`切换到${name}。`, "sys");
    toast(`切换到${name}`);
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
    const target = typeof pieceAtCell === "function" ? pieceAtCell(S, zone, x, y, null) : null;
    if (
      target &&
      typeof canStackMerge === "function" &&
      canStackMerge({ uid: st.uid, id: st.id, qty: st.qty || 1, fillStep: 0 }, target)
    ) {
      const max = stackMaxOf(st.id);
      const room = max - pieceQty(target);
      const bring = Math.max(1, st.qty | 0 || 1);
      const add = Math.min(room, bring);
      target.qty = pieceQty(target) + add;
      staging.splice(i, 1);
      if (st.id === "edict") unlockValleyFromEdict();
      else toast(`叠入${(WORLD.items[st.id] || {}).name || st.id}`);
      if (typeof SFX !== "undefined") SFX.play("bag_place");
      panels();
      return true;
    }
    if (!zoneCanPlace(S, zone, st.id, x, y, r)) return false;
    staging.splice(i, 1);
    ensurePiecesArr(S, zone).push({
      uid: st.uid,
      id: st.id,
      x,
      y,
      rot: r,
      qty: isStackable(st.id) ? Math.max(1, st.qty | 0 || 1) : st.qty,
    });
    if (itemHomeZone(st.id) === "weapon" && zone === "weapon") setHeldWeapon(S, st.uid);
    else if (itemHomeZone(st.id) === "weapon" && !equippedUid(S, "weapon")) setHeldWeapon(S, st.uid);
    if (itemHomeZone(st.id) === "armor" && zone === "armor") setHeldArmor(S, st.uid);
    else if (itemHomeZone(st.id) === "armor" && !equippedUid(S, "armor")) setHeldArmor(S, st.uid);
    if (typeof ensureGunState === "function" && isFirearm(st.id)) ensureGunState(S, st.id);
    const it = WORLD.items[st.id];
    if (st.id === "edict") {
      unlockValleyFromEdict();
    } else if (it) {
      toast(`收入${it.name}`);
    }
    if (typeof SFX !== "undefined") SFX.play("bag_place");
    panels();
    return true;
  }

  /** 密旨入囊：获知药谷方位并解锁地图 */
  function unlockValleyFromEdict() {
    S.flags.add("valley_map");
    toast("你已获知药谷方位");
    log("抄件旁边注着：西行极寒药谷。药谷在哪儿，这下清楚了。", "sys");
    renderMap();
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
    const target = typeof pieceAtCell === "function" ? pieceAtCell(S, toZone, x, y, null) : null;
    if (target && typeof canStackMerge === "function" && canStackMerge(piece, target)) {
      zoneRemoveUid(S, fromZone, uid);
      const max = stackMaxOf(target.id);
      const room = max - pieceQty(target);
      const move = Math.min(room, pieceQty(piece));
      target.qty = pieceQty(target) + move;
      const left = pieceQty(piece) - move;
      if (left > 0) {
        piece.qty = left;
        ensurePiecesArr(S, fromZone).push(piece);
      }
      panels();
      return true;
    }
    if (!zoneCanPlace(S, toZone, piece.id, x, y, rot)) return false;
    zoneRemoveUid(S, fromZone, uid);
    piece.x = x;
    piece.y = y;
    piece.rot = rot;
    ensurePiecesArr(S, toZone).push(piece);
    /* 手里那把下了架：改拿架上剩下的；架上原本空着就拿新上架的 */
    if (fromZone === "weapon" && S.equipped.weaponUid === uid) {
      const next = weaponPieces(S)[0];
      S.equipped.weaponUid = next ? next.uid : null;
    }
    if (toZone === "weapon" && !equippedUid(S, "weapon")) setHeldWeapon(S, uid);
    if (toZone === "weapon" || toZone === "armor") {
      const it = WORLD.items[piece.id];
      if (it) toast(toZone === "armor" ? `穿上${it.name}` : `${it.name}上了兵器架`);
    }
    panels();
    return true;
  }

  /* 各地的环境声：城外风雪、京城低鸣夹着远处的呻吟、皇城死寂的低音、西山大风；打仗时压低 */
  const AMBIENCE = {
    road_inn: "amb_blizzard", village: "amb_blizzard", lugou: "amb_blizzard", post: "amb_blizzard", barracks: "amb_blizzard",
    canal: "amb_blizzard", temple: "amb_blizzard", xishan_temple: "amb_blizzard", valley: "amb_blizzard",
    gate: "amb_drone", barbican: "amb_drone", inner: "amb_drone", yamen: "amb_drone", caishikou: "amb_drone", yaoju: "amb_drone", gulou: "amb_drone",
    palace: "amb_drone", yuyaofang: "amb_drone", throne: "amb_drone",
  };
  /* 偶尔冒一声的点缀：乌鸦、冰裂、钟、呻吟 */
  const AMB_SPOT = {
    road_inn: "amb_crows", village: "amb_crows", lugou: "ice_crack", canal: "ice_crack", temple: "temple_bell", xishan_temple: "temple_bell",
    inner: "moan", caishikou: "moan", barbican: "moan", gate: "moan",
  };
  let ambSpotT = 0;
  function syncAmbience() {
    if (typeof SFX === "undefined" || !SFX.setAmbience) return;
    if (S.mode === "ending") return SFX.setAmbience(null);
    SFX.setAmbience(AMBIENCE[S.loc] || "amb_blizzard", S.mode === "combat" ? 0.35 : 1);
    if (!ambSpotT) {
      const tickSpot = () => {
        ambSpotT = setTimeout(tickSpot, 14000 + Math.random() * 22000);
        const n = AMB_SPOT[S.loc];
        if (n && S.mode === "explore" && !document.hidden) SFX.play(n, { gain: n === "amb_crows" ? 0.35 : 0.5 });
      };
      ambSpotT = setTimeout(tickSpot, 9000);
    }
  }

  function syncVitalFx() {
    const fx = document.getElementById("screen-fx");
    if (!fx) return;
    const critical = S.hp > 0 && S.hp < 50 && S.mode !== "ending";
    if (typeof BGM !== "undefined" && BGM.danger) {
      BGM.danger(S.mode === "ending" ? 1 : S.hp / WORLD.maxHp);
      BGM.corrupt(S.corruption / 100);
      if (S.loc) BGM.scene(S.loc);
    }
    fx.classList.toggle("critical", critical);
    document.body.classList.toggle("hp-critical", critical);
    /* 渴染不显示数值：画面四周泛暗红（躁 33 起、狂 67 起），标题栏写一个字的档位 */
    const tier = corrTier(S);
    /* 心火升了一档：心口咚的一下 */
    if (S.corrTierSaid != null && tier > S.corrTierSaid && typeof SFX !== "undefined") SFX.play("heartbeat");
    S.corrTierSaid = tier;
    syncAmbience();
    document.body.classList.remove("corr-1", "corr-2", "corr-3");
    if (tier && S.mode !== "ending") document.body.classList.add("corr-" + tier);
    const tag = document.getElementById("corr-tag");
    if (tag) {
      tag.textContent = `心火 ${CORR_TIERS[tier].name}`;
      tag.dataset.tier = String(tier);
      tag.title = ["心里还清明", "喉中发痒：出手更狠，吃东西不大养人", "饥渴压不住：出手狠、杀一个回一口气，活人都躲着你"][tier];
    }
    /* 血越少，暗角越浓、血滴越多 */
    const hurt = critical ? Math.min(1, Math.max(0.25, (50 - S.hp) / 40)) : 0;
    fx.style.setProperty("--hurt", hurt.toFixed(2));
    syncBloodDrips(critical ? 2 + Math.round(hurt * 4) : 0);
  }

  /** 顶部两侧的像素血滴，避开画面中间 */
  function syncBloodDrips(n) {
    const box = document.getElementById("sfx-drips");
    if (!box) return;
    while (box.children.length > n) box.lastChild.remove();
    while (box.children.length < n) {
      const i = box.children.length;
      const d = document.createElement("span");
      d.className = "sfx-drip";
      const side = i % 2 === 0 ? 2 + Math.random() * 16 : 82 + Math.random() * 16;
      d.style.left = side + "%";
      d.style.setProperty("--w", 3 * (3 + Math.floor(Math.random() * 3)) + "px");
      d.style.setProperty("--len", 40 + Math.random() * 120 + "px");
      d.style.animationDelay = -(Math.random() * 6).toFixed(2) + "s";
      d.style.animationDuration = (5 + Math.random() * 4).toFixed(2) + "s";
      box.appendChild(d);
    }
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
    Codex.seeOwned(S);
    const maxStam = maxStaminaOf(S);
    syncVitalBar(el.hpFill, el.hpText, S.hp, WORLD.maxHp);
    syncVitalBar(el.staminaFill, el.staminaText, S.stamina, maxStam, {
      low: S.stamina <= maxStam * 0.2,
    });
    syncVitalBar(el.satietyFill, el.satietyText, Math.round(S.satiety), WORLD.maxSatiety, {
      low: S.satiety <= WORLD.hunger.hungry,
    });
    el.status.textContent = formatWatch(S.elapsed);

    if (el.gear) el.gear.textContent = gearSummary(S);

    const used = bagCount(S);
    const load = carryLoad(S);
    const tier = loadTier(S);
    el.inv.textContent = `${load}/${WORLD.carryCap} ${{ light: "轻装", normal: "常重", heavy: "沉重" }[tier]}`;
    if (S.loadTierSaid && S.loadTierSaid !== tier) {
      log(
        tier === "heavy"
          ? "身上的东西太沉了，每走一步都吃力。"
          : tier === "light"
            ? "卸下些东西，脚下轻快了不少。"
            : "身上的分量还背得动。",
        "sys",
      );
    }
    S.loadTierSaid = tier;
    syncVitalFx();
    paintLocBackdrop();
  }

  /* 常驻画框：非战斗时显示当前地点背景（生图 + 名称） */
  let _backdropLoc = null;
  function paintLocBackdrop() {
    const loc = WORLD.locs[S.loc];
    if (!loc) return;
    if (el.locBackdrop) el.locBackdrop.dataset.loc = S.loc;
    if (el.locBackdropName) el.locBackdropName.textContent = loc.name;
    if (_backdropLoc === S.loc) return;
    _backdropLoc = S.loc;
    /* 豆包 Seedream 生成的地点背景图 */
    if (el.locBackdrop) {
      el.locBackdrop.style.backgroundImage = `url("assets/locations/${S.loc}.jpg?v=px3")`;
      el.locBackdrop.style.backgroundSize = "cover";
      el.locBackdrop.style.backgroundPosition = "center";
    }
  }

  function syncVitalBar(fillEl, textEl, val, max, opts = {}) {
    if (!fillEl || !textEl) return;
    const ratio = Math.max(0, Math.min(1, max > 0 ? val / max : 0));
    fillEl.style.width = (ratio * 100).toFixed(1) + "%";
    textEl.textContent = `${Math.max(0, Math.round(val))}/${max}`;
    fillEl.classList.toggle("low", !!opts.low);
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
      placeDisplacing,
      putToStaging,
      /** 合上行囊时待收区还有东西：留在当地 */
      leaveStaging: () => abandonStaging(),
      switchHeldWeapon,
      setHeldWeapon: (uid) => {
        const ok = setHeldWeapon(S, uid);
        if (ok) panels();
        return ok;
      },
      /** 拖进某个位：位上原有的那件换回行囊（放得下才换） */
      slotPlace: (uid, zone, x) => {
        const ok = moveIntoSlot(S, zone, uid, x);
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
      scrollJournal: () => scrollJournalToEnd(),
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

  /** 把气泡定位到图标右侧（或左侧，若右侧不够空间） */
  function positionMapTip(btn) {
    const tip = el.mapTip;
    if (!tip) return;
    const wrap = btn.closest(".minimap-wrap");
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const btnCenterY = br.top - wr.top + br.height / 2;
    const btnRight = br.right - wr.left;
    const btnLeft = br.left - wr.left;
    /* 先设内容测宽度 */
    tip.style.visibility = "hidden";
    tip.hidden = false;
    const tipW = tip.offsetWidth || 120;
    tip.hidden = true;
    tip.style.visibility = "";
    /* 右侧够放？不够就翻左 */
    const flipLeft = btnRight + 12 + tipW > wr.width;
    tip.classList.toggle("flip-left", flipLeft);
    tip.style.top = `${btnCenterY}px`;
    if (flipLeft) {
      tip.style.right = `${wr.width - btnLeft + 12}px`;
      tip.style.left = "";
    } else {
      tip.style.left = `${btnRight + 12}px`;
      tip.style.right = "";
    }
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
    if ((id === "valley" || id === "xishan_temple") && !bagHas(S, "edict")) return false;
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
    (WORLD.mapRegions || []).forEach((r) => {
      const box = document.createElement("div");
      box.className = "map-region";
      box.style.left = `${(r.x / vw) * 100}%`;
      box.style.top = `${(r.y / vh) * 100}%`;
      box.style.width = `${(r.w / vw) * 100}%`;
      box.style.height = `${(r.h / vh) * 100}%`;
      box.innerHTML = `<span class="map-region-name">${r.name}</span>`;
      el.minimap.appendChild(box);
    });

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
        positionMapTip(btn);
        el.mapTip.hidden = false;
        el.mapTip.textContent = mapTipFor(id);
      });
      btn.addEventListener("mouseleave", () => {
        el.mapTip.hidden = true;
      });
      btn.addEventListener("click", () => {
        if (!reachable) {
          positionMapTip(btn);
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
    /* 行路时一句一句地浮出来；打仗时要快，直接全上；点一下日志栏全部现出 */
    if (animate && S.mode !== "combat" && !reducedMotion()) {
      nodes.forEach((node) => revealQueue.push(node));
      pumpReveal();
      return;
    }
    nodes.forEach((node) => el.journal.appendChild(node));
  }

  const revealQueue = [];
  let revealTimer = 0;
  const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pumpReveal() {
    if (revealTimer || !revealQueue.length) return;
    const node = revealQueue.shift();
    node.classList.add("journal-fade");
    el.journal.appendChild(node);
    scrollJournalToEnd();
    /* 长段多停一会儿，系统提示一闪而过 */
    const len = (node.textContent || "").length;
    const wait = node.classList.contains("sys") ? 220 : Math.min(1100, 320 + len * 12);
    revealTimer = setTimeout(() => { revealTimer = 0; pumpReveal(); }, wait);
  }

  function flushReveal() {
    clearTimeout(revealTimer);
    revealTimer = 0;
    while (revealQueue.length) el.journal.appendChild(revealQueue.shift());
    scrollJournalToEnd();
  }

  function paintJournal(opts = {}) {
    const force = !!opts.force;
    const silent = !!opts.silent;
    if (force || journalPainted > S.journal.length) {
      flushReveal();
      el.journal.innerHTML = "";
      journalPainted = 0;
      S.journal.forEach((e, idx) => {
        const animate = !silent && idx === S.journal.length - 1;
        appendJournalNodes(e, animate);
      });
      journalPainted = S.journal.length;
    } else {
      for (let i = journalPainted; i < S.journal.length; i++) {
        appendJournalNodes(S.journal[i], !silent);
      }
      journalPainted = S.journal.length;
    }
    scrollJournalToEnd();
  }

  /** 战斗切换布局后高度会变，需延后滚到底，否则停在旧位置 */
  function scrollJournalToEnd() {
    const j = el.journal;
    if (!j) return;
    const go = () => {
      j.scrollTop = j.scrollHeight;
    };
    go();
    requestAnimationFrame(() => {
      go();
      requestAnimationFrame(go);
    });
    clearTimeout(scrollJournalToEnd._t1);
    clearTimeout(scrollJournalToEnd._t2);
    scrollJournalToEnd._t1 = setTimeout(go, 60);
    scrollJournalToEnd._t2 = setTimeout(go, 360);
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
    if (title) {
      const g = document.createElement("div");
      g.className = "cmd-group";
      g.textContent = title;
      el.commands.appendChild(g);
    }
    const row = document.createElement("div");
    row.className = "cmd-row";
    buttons.forEach((b) => row.appendChild(b));
    el.commands.appendChild(row);
  }

  function childCoda(kind) {
    if (kind === "good" && S.flags.has("saved_child")) {
      return "\n\n出城的时候，你恍惚听见荒村那孩子在说：瓶子没了，多谢你。";
    }
    if (kind === "bad" && S.flags.has("left_child")) {
      return "\n\n雪夜里那一声没人应的哭，又在你耳边响了起来。";
    }
    return "";
  }

  function endAs(id, text) {
    CombatUI.close();
    S.mode = "ending";
    S.combat = null;
    S.ending = id;
    S.seen.add(id);
    Codex.see("ending", id, text);
    S.journal.push({ kind: "ending", tag: WORLD.endings[id] || id, text });
    paintJournal();
    panels();
    showEndingScreen(id, text);
  }

  function checkEnd() {
    if (S.hp <= 0) {
      log("气血没了。雪盖上来。", "sys");
      endAs(
        "overrun",
        "你倒在了半路上。行尸不管你为何而来，只认你身上还有没有热气。" + childCoda("bad"),
      );
      return true;
    }
    if (S.corruption >= 133 && S.flags.has("saw_throne")) {
      endAs(
        "corrupted",
        "真相你是看清了，自己喉咙里那股饥渴也看清了。瓶子已碎，药味却留在你的牙缝里，出宫时连行尸都躲着你的眼睛。" +
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
      toast("那锦衣行尸已经斩了，再没有第二个。");
      return;
    }
    const c = cloneFight(id);
    if (!c) return;
    S.mode = "combat";
    S.combat = c;
    if (typeof BGM !== "undefined") {
      /* 头目战换一套慢而重的节奏，丹陛最终战最急 */
      const ELITE = ["canal_guard", "gate_chain", "temple_priest", "barbican_soldiers", "caishikou_exec", "yaoju_doctor", "gulou_watch", "xishan_monks", "yyf_guard", "valley_pack"];
      if (BGM.setFight) BGM.setFight(c.boss ? "final" : ELITE.includes(id) ? "elite" : "normal");
      else if (BGM.setBoss) BGM.setBoss(c.boss);
      BGM.play("battle");
      if (BGM.sting) BGM.sting(c.boss ? "boss" : "encounter");
    }
    if (S.powers.has("decree_fear") && !c.boss) {
      c.enemies.forEach((e) => {
        if (e.hp <= 60) e.stunned = 1;
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
    /* 进入战斗后侧栏高度变了，再滚一次日志到底 */
    scrollJournalToEnd();
  }

  function finishFight(result) {
    const c = S.combat;
    const t = COMBAT.templates[c.id];
    CombatUI.close();
    S.mode = "explore";
    S.combat = null;
    if (typeof BGM !== "undefined") {
      BGM.play("explore");
      if (BGM.sting) BGM.sting(result === "win" ? "victory" : "flee");
    }
    if (result === "win") {
      c.enemies.forEach((e) => Codex.see("enemy", e.name));
      (t.onWinFlags || []).forEach((f) => S.flags.add(f));
      if (S.powers.has("soul_drain")) {
        S.hp = Math.min(WORLD.maxHp, S.hp + 17);
        log("吸魂：你夺回一口气。", "sys");
      }
      const corruptBefore = S.corruption;
      tick(2);
      hunger(WORLD.hunger.fight);
      log(`敌已倒下。`);
      const lootIds = [];
      if (c.id === "canal_guard") {
        if (!bagHas(S, "blade") && !bagHas(S, "palace_blade")) {
          lootIds.push("blade");
          log("你从锦衣行尸腰间解下一口绣春刀。", "sys");
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
          log("你从守门兵丁身上剥下一副残甲。", "sys");
        } else toast("铁链断了");
      }
      /* 新地点：守着那件东西的打倒了，当场就能翻到 */
      const cf = WORLD.loot.clearedFind[S.loc];
      if (cf && (t.onWinFlags || []).includes(cf.need) && !S.flags.has("loot_" + cf.id) && !bagHas(S, cf.id)) {
        S.flags.add("loot_" + cf.id);
        lootIds.push(cf.id);
        log(cf.line, "sys");
      }
      const fixedDrop = takeFixedLoot(WORLD.loot.fightFixed[c.id]);
      if (fixedDrop) {
        lootIds.push(fixedDrop.id);
        log(fixedDrop.line, "sys");
      } else if (WORLD.loot.fightTier[c.id] && Math.random() < WORLD.loot.fightChance) {
        const id = rollLoot(WORLD.loot.fightTier[c.id]);
        if (id) {
          lootIds.push(id);
          log(`你在尸身上翻出一件${WORLD.items[id].name}。`, "sys");
        }
      }
      if (WORLD.loot.fightTier[c.id] && Math.random() < WORLD.loot.fightFoodChance) {
        const fid = rollFood(WORLD.loot.fightTier[c.id]);
        if (fid) {
          lootIds.push(fid);
          log(`尸身上还揣着${WORLD.items[fid].name}。`, "sys");
        }
      }
      if (c.id === "valley_pack") {
        toast("谷中已清");
        log("行尸都倒下了，谷中安静下来，四下还没来得及细看。", "sys");
      }
      if (c.id === "throne_bite") {
        S.flags.add("saw_throne");
        log("龙椅空了，玉瓶碎在阶下。来龙去脉都已查明，往后是做人还是做那东西，只在你一念之间。");
        if (corruptBefore >= 67) {
          endAs(
            "corrupted",
            "你斩了那东西，那股饥渴却钻进了你的舌根。出宫时，守门的行尸朝你跪了下来，像是在拜同类。" +
              childCoda("bad"),
          );
          return;
        }
        endAs(
          "truth",
          "你把密旨抄件和玉片放在台阶上，将旨意、药谷、玉瓶和那一口咬，一桩桩记在心里。" +
            (bagHas(S, "zhang_diary") && bagHas(S, "elixir_record")
              ? "又把张百户的手记和那卷丹方放在一处，从下旨、寻药、进药到服药，一环扣一环，再没有说不清的地方。"
              : "") +
            "长生原来不是福，是祸。你出了京城，雪落在刀上。" +
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
        }
      }
      return;
    } else if (result === "flee") {
      tick(1);
      log("你退进风雪里，身后的啃咬声久久不散。");
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
    hunger(WORLD.hunger.search);
    S.look[S.loc] = (S.look[S.loc] || 0) + 1;
    const n = S.look[S.loc];
    const highCorr = S.corruption >= 67;
    const midCorr = S.corruption >= 33 && S.corruption < 67;
    const table = {
      road_inn: [
        () => {
          if (!bagHas(S, "talisman")) {
            beginLootSession(["talisman"], { reason: "pickup" });
            return "你在柜底摸到一张镇尸符，朱砂还是潮的。" + (highCorr ? "符上的朱砂看着像血，你连忙别过眼去。" : "");
          }
          return "店里没别的了，只剩风声。" + (highCorr ? "风声里夹着别的声响，像是远处有人在嚼东西。" : "");
        },
        () => {
          if (S.powers.has("night_eye") && !bagHas(S, "jade_chip")) {
            beginLootSession(["jade_chip"], { reason: "pickup" });
            return "鬼瞳一开，灶灰底下露出一片玉瓶碎片。" + (highCorr ? "碎片上映出你的脸，你这才发觉自己正咧着嘴。" : "");
          }
          if (!bagHas(S, "armor_light") && !bagHas(S, "armor_scale")) {
            beginLootSession(["armor_light"], { reason: "pickup" });
            return "床底下拖出一块棉甲，虽然残破，还能护身。";
          }
          return highCorr
            ? "灶灰翻了个遍，灰里留着一个手印，正是你自己的，你却不记得何时按上去的。"
            : "灶灰翻了个遍，没别的。";
        },
        () => {
          if (highCorr) {
            return "墙上那张驱瘟符在你眼里扭动起来，笔画像一条条虫子。你一把扯下，掌心火辣辣地发烫。";
          }
          return "墙根刻着一行浅浅的小字：『药出西谷，祸入东门，回头是岸。』";
        },
      ],
      village: [
        () => "你循着哭声寻到柴房，里头缩着一个饿得发昏的孩子。",
        () => "井水红中带黑，井壁上刻着四个字：药过人变。" + (highCorr ? "你低头往井里看，水中的倒影嘴唇在动，你却并没有开口。" : ""),
        () => {
          if (S.flags.has("saved_child")) return "柴房门半掩着，那孩子睡着了，手里还攥着半块饼。";
          if (S.flags.has("left_child")) return "柴房空了，地上留着一串小小的手印，朝门外去了。";
          return "村里静得出奇，连鸡犬之声都听不见。";
        },
        () => "村尾的土地庙里供桌翻倒，神像被扭过去面朝着墙，墙上有人用炭写了一行字：『长生者，大灾也。』落款是一个道家的符记。",
      ],
      canal: [
        () => "舱盖底下满是刮痕，不知是里头的人想出来，还是外头的东西想进去。" + (highCorr ? "那些刮痕在你眼里渐渐成了字，一个个都是『饿』。" : ""),
        () => {
          if (S.flags.has("jade_hint") || S.flags.has("canal_guard_slain")) {
            return "纤道上只剩风雪。" + (highCorr ? "你站在他倒下的地方，地上那摊黑渍看着倒像个人形。" : "");
          }
          S.flags.add("know_guard");
          return "你认准了锦衣碎布飘去的方向，那正是寻药百户回京的路。" + (midCorr ? "风吹起破布，你恍惚看见有人在招手，定睛一看，不过是几根布条。" : "");
        },
        () => {
          if (S.flags.has("jade_hint") || S.flags.has("canal_guard_slain")) {
            return "脚印在雪里断了。密旨上说的极寒药谷，就在西边。" + (highCorr ? "你盯着那些脚印看得久了，竟觉得它们在朝你走过来。" : "");
          }
          return "纤道上只剩风雪。" + (midCorr ? "一片雪落在舌头上，你尝出一丝铁锈味。" : "");
        },
        () => {
          if (!bagHas(S, "jade_chip") && highCorr) {
            beginLootSession(["jade_chip"], { reason: "pickup" });
            return "河水退了些，露出一截玉色。你捞起来一看，是一块玉片，摸着和那药瓶一般冰凉。";
          }
          return "河面结了一层新冰，冰下有什么东西翻着白肚，看不真切。";
        },
      ],
      post: [
        () => {
          if (bagHas(S, "edict")) {
            return "驿柜已经空了。案上留着撕过的痕迹，正和你身上那份密旨抄件对得上。" + (highCorr ? "你拿出抄件对照，纸上的字浮起来又沉了下去。" : "");
          }
          return "案上墨迹未干，抄件却叫人撕走了，想是锦衣卫回京路上带走的。" + (midCorr ? "你凑近闻了闻，纸上有股甜香，和宫里熏的香是一个味道。" : "");
        },
        () => {
          S.flags.add("palace_key");
          if (!bagHas(S, "armor_light") && !bagHas(S, "armor_scale")) {
            beginLootSession(["armor_light"], { reason: "pickup" });
            return "简图上标着一处入宫的偏门，柜角还丢着驿卒留下的一块棉甲。" + (highCorr ? "你把甲穿上，只觉那甲片在往肉里钻。" : "");
          }
          return "草图上画着入宫的偏门，你暗暗记下了。" + (midCorr ? "合上图时，你才发觉自己已在纸上画了好几个圈，都圈在皇城的位置。" : "");
        },
        () => {
          if (!S.flags.has("post_horse")) {
            S.flags.add("post_horse");
            return "马厩最里头那匹马倒在地上，肚子胀得滚圆。你掰开它的嘴，牙也变了模样。";
          }
          return "马厩空了，槽里剩下的草料结了一层霜，霜底下有牙印。";
        },
      ],
      gate: [
        () => (S.flags.has("gate_open")
          ? "断了的铁链垂在门轴上，断口叫你砍得齐齐整整，城门已经开了。"
          : "铁链从里头锁死，又被什么东西扯松了。斩断了它，城门才开得了。") + (highCorr ? "铁链上有舌头舔过的痕迹，又冰又滑。" : ""),
        () => "门砖缝里嵌着半颗牙，镶着亮釉，只有宫里的人才这样讲究。" + (midCorr ? "你把它揣进怀里，又扔了出去，如此几回，到头来它还攥在你手里。" : ""),
        () => {
          if (!S.flags.has("gate_open")) return "门缝里夹着一只手，手指还在抽动。你迟疑片刻，一刀砍了下去，那手指仍在抽。";
          return "门轴断了，城门歪歪地敞着，地上一道拖痕一路通往内城。";
        },
      ],
      inner: [
        () => "鼓楼上的铃舌已经断了，铜铃却还自己晃着。" + (highCorr ? "铃声一响，你竟觉得它在说话，而且你听得懂。" : ""),
        () => "你捡到一只宫女的绣鞋，鞋尖朝着皇城。" + (midCorr ? "鞋里还是温的，像是刚脱下不久，可这条街上早没有活人了。" : ""),
        () => {
          if (isNight(S.elapsed) && !S.flags.has("night_street")) {
            S.flags.add("night_street");
            return "入夜后两旁的黑影更多了，起起落落。" + (highCorr ? "黑影落地时你才看清，它们是没有脚的。" : "");
          }
          return "雪又盖住一层跪印。" + (highCorr ? "你跪下去试了试，正好合得上，吓得你赶紧站了起来。" : "");
        },
        () => "路边一家铺子门没关严。灶上还有半锅冻住的粥，桌上摆着两副碗筷，两只碗里都盛着粥，像是有人在等谁回来吃饭。",
      ],
      yamen: [
        () => {
          S.flags.add("palace_key");
          if (!bagHas(S, "antidote")) beginLootSession(["antidote"], { reason: "pickup" });
          return "印匣底下压着一包解毒散和一张腰牌拓样，入宫的门路，你记下了。" + (highCorr ? "你打开解毒散闻了闻，心里竟不想解了。塞回瓶塞时，你的手在抖。" : "");
        },
        () => "公案空着，那张封锁京师的空文上还端端正正盖着大印。" + (midCorr ? "大印上沾着干透的黑渍，却不是墨。" : ""),
        () => {
          if (highCorr) return "后院的囚牢门开着，里头没人。墙上满是抓痕，有些高得够不着，想是人被吊起来时抓的。你看了许久，才认出那些抓痕拼成的是一个『放』字。";
          return "后院的囚牢锁已锈死，门缝里伸出几根指骨，扣在地上，至死还想爬出来。";
        },
      ],
      valley: [
        () => {
          if (!S.flags.has("valley_cleared")) {
            return "几具行尸守着岩缝，不先料理干净，这把火是点不成的。" + (highCorr ? "你闻见它们身上的药味，甜丝丝的，忍不住咽了口唾沫。" : "");
          }
          if (!S.flags.has("valley_wood")) {
            S.flags.add("valley_wood");
            toast("发现干柴");
            return "守尸已除，谷底堆着干柴，雪下的柴还是干的，一点就着。" + (midCorr ? "你蹲下摸了摸柴火，心想烧了未免可惜，随即被自己这念头吓了一跳。" : "");
          }
          return highCorr ? "干柴还在。你坐在柴堆旁，竟觉得谷里暖和起来，可这冰天雪地本不该暖和。" : "干柴还堆在那儿，一点就着。";
        },
        () => "岩缝里的凉气直往袖口里钻，深处像有碎玉在反光。" + (highCorr ? "那凉气其实并不凉。你凑近吸了一口，牙关打颤，也分不清是冷的还是馋的。" : ""),
        () => {
          if (highCorr) return "谷底深处有一小片药渣混在雪里。你跪下翻找，手指冻得发僵，捡起一粒放进嘴里，是甜的。你连忙吐了，那股甜味却留在喉咙里，久久不散。";
          return "岩缝底下嵌着一块旧木牌，上写：『弘治十四年春，取药一瓶，献于上。侍从十人，还者三。』";
        },
      ],
      palace: [
        () => "你从护城河里捞起半卷黄绫，是长生宴上的曲谱，只奏了一半。" + (midCorr ? "谱子后半段被人扯掉了。" : ""),
        () => {
          if (!bagHas(S, "palace_blade")) {
            beginLootSession(["palace_blade"], { reason: "pickup" });
            return "铜门缝里卡着一柄御前侍卫的断刀，刃口还利，你把它抽了出来。" + (highCorr ? "刀面上映出你的脸，你看见自己在笑。" : "");
          }
          return "铜门后头有气息。不是风。" + (highCorr ? "气息里有话：『进来。』" : "");
        },
        () => {
          if (highCorr) return "宫墙上有人用血写了一行字，笔迹和驿站那份抄件一模一样：『臣不负圣恩，药已至。』底下另有人添了一行：『你不该回来。』";
          return "宫墙根下叠着几件官服，整整齐齐，像是人自己脱好了躺下的。最上面那件压着一张纸：『臣等已无用，请自便。』";
        },
      ],
      throne: [
        () => "烛泪里凝着几枚指印，皇上喝药之前，手是抖的。" + (highCorr ? "你低头看看自己的手，也在抖，抖得一模一样。" : ""),
        () => {
          if (S.flags.has("saw_throne")) return "你已到过阶前，那两个字还在耳边：长生。你反复嚼着这两个字，嚼得牙根发酸。";
          return "丹陛的石缝里嵌着碎片，你蹲下拼了拼，正是那只玉瓶。药早已渗进石缝，除了这座空城，什么也没留下。";
        },
      ],
      temple: [
        () => {
          if (!S.flags.has("temple_cleared")) return "偏殿那道士行尸还在来回踱步，香案上摆着他没画完的符。";
          return "丹炉已冷，你拨开炉灰，底下有一块没化开的丹砂，红得像血。";
        },
        () => {
          if (!bagHas(S, "temple_note")) {
            beginLootSession(["temple_note"], { reason: "pickup" });
            return "供桌上那几页残稿，把那药的底细写得明明白白。道士在末尾写道：『吾亦服之，以验其性。今吾将变，后人勿效。』";
          }
          return "供桌已经空了，纸上的字却还印在你脑子里。";
        },
        () => {
          if (!bagHas(S, "alchemy_notes") && S.flags.has("temple_cleared")) {
            beginLootSession(["alchemy_notes"], { reason: "pickup" });
            return "厢房的蒲团底下压着一本炼丹手记，前头记着配方，后头翻来覆去只写一句：『不该减那半钱。』";
          }
          return "厢房门开着，风穿堂而过，吹得纸页哗哗作响。";
        },
      ],
      barbican: [
        () => {
          if (!S.flags.has("barbican_cleared")) return "那几具溃兵行尸还窝在墙根下，须得先料理了。";
          return "墙上的血名你从头看了一遍，最多的一家，死了十一口。";
        },
        () => {
          if (!bagHas(S, "refugee_letter")) {
            beginLootSession(["refugee_letter"], { reason: "pickup" });
            return "一个包袱里翻出一本难民的札记，最后几行字写得发抖：『昨夜墙外有人敲门，我们没开。今早门外无人，门缝里塞进来一只人手。』";
          }
          return "散落的包袱都被人翻过了，剩下的没几样有用。";
        },
        () => {
          if (!bagHas(S, "palace_crest") && S.flags.has("barbican_cleared")) {
            beginLootSession(["palace_crest"], { reason: "pickup" });
            return "溃兵堆里有一具穿着锦衣卫的衣裳，怀里揣着半块腰牌，和驿站那份密旨对得上，原来是寻药的张百户手下。";
          }
          return "瓮城里风大，两面城墙夹着，风在当中打转，像有什么东西在学人叹气。";
        },
      ],
    };
    const ammo = (n) => beginLootSession([], { reason: "pickup", stacks: [["powder", n], ["wad", n], ["shot", n]] });
    Object.assign(table, {
      lugou: [
        () => {
          if (!S.flags.has("lugou_cleared")) {
            S.flags.add("lugou_riders_seen");
            return "你刚凑近那辆官车，桥那头便响起一阵马蹄声，两个溃兵骑在马上来回地巡，马早死了，人还骑在上头。";
          }
          return "官车四周的箱笼都叫人翻过了，只剩些破衣裳。";
        },
        () => "冰面上冻着一排车辙，一直通到对岸，又在雾里断了。" + (highCorr ? "你盯着那车辙看了许久，觉得它像一道没合拢的伤口。" : ""),
        () => "一只包袱里裹着个泥娃娃，脸叫人摩挲得发亮。",
      ],
      barracks: [
        () => {
          S.flags.add("officer_heard");
          ammo(6);
          return "你在倒塌的兵器架底下翻出一捆火药、垫片和弹丸，油纸包得严实，还没受潮。这时地窖里有人哑着嗓子喊：外头是活人么？";
        },
        () => (S.flags.has("barracks_cleared") ? "伙房的米缸见了底，缸壁上还刮得下几粒米。" : "营房里有东西在走动，铁甲叶子磕得叮当响，先料理干净再细搜。"),
        () => "营门柱子上刻着一道道划痕，数一数，正好是城门关上的日子。",
      ],
      xishan_temple: [
        () => (S.flags.has("xishan_cleared") ? "供桌上那盏油灯旁边，压着半截写了字的黄纸。" : "殿后头有脚步声，拖着走，不止一个。先别急着翻。"),
        () => "厢房里的僧人早跑空了，墙上用炭写着：药谷有火，切莫近前。",
        () => "寺后有条小路往山里去，雪地上一溜脚印，都朝着药谷。" + (midCorr || highCorr ? "你不由得也往那边多走了两步。" : ""),
      ],
      caishikou: [
        () => {
          S.flags.add("butcher_known");
          return "肉铺的门从里头闩死了，门缝里那点灯光，你一走近就灭了。";
        },
        () => "翻倒的菜筐底下，几样能吃的东西冻在冰里，你用刀撬了出来。",
        () => "刑台的木桩上刻满了名字，最近的几个，墨还没干就叫雪盖住了。",
      ],
      yaoju: [
        () => (S.flags.has("yaoju_cleared") ? "药柜上的抽屉一个个都拉开着，里头的药大半叫人拿走了。" : "里屋那咳嗽声一声紧过一声，你不敢久留。"),
        () => "墙上贴着时疫告示：闭门不出，勿近病者。底下有人用炭笔添了一句：病者不是病。",
        () => "柜台底下压着一本账，最后几页记的都是同一味药：雄黄，雄黄，雄黄。",
      ],
      gulou: [
        () => {
          ammo(4);
          return "墙根的火器箱里还剩些火药和弹丸。";
        },
        () => (S.flags.has("gulou_cleared") ? "楼上望出去，皇城的宫墙黑沉沉的，墙头上站着的人影一动不动。" : "楼上锣声一响，长街那头就有东西往这边挪。先上楼把那更夫料理了。"),
        () => "鼓面上的窟窿边缘，留着一圈牙印。",
      ],
      yuyaofang: [
        () => (S.flags.has("yyf_cleared") ? "药柜里还剩一小罐蜂蜜，封口是御用的黄绫。" : "炉后头有东西窸窸窣窣，先别碰那些丹方。"),
        () => "地上的金箔沾着黑血，一片一片，一直拖到门外，朝丹陛去了。",
        () => "炉膛里扒出半截没烧完的谏书，只看得清「臣冒死」三个字。",
      ],
    });
    const arr = table[S.loc] || [() => "雪地茫茫，没话说。"];
    const fn = arr[Math.min(n - 1, arr.length - 1)];
    log(fn());
    /* 装备：头一回搜给固定的那件；本地的话说尽之后，再搜有几成机会翻出别的 */
    const fixedFind = n === 1 ? takeFixedLoot(WORLD.loot.searchFixed[S.loc]) : null;
    if (fixedFind) {
      log(fixedFind.line);
      beginLootSession([fixedFind.id], { reason: "pickup" });
    } else if (n > arr.length && WORLD.loot.locTier[S.loc] && Math.random() < WORLD.loot.searchChance) {
      const id = rollLoot(WORLD.loot.locTier[S.loc]);
      if (id) {
        log(`你在角落里翻出一件${WORLD.items[id].name}。`);
        beginLootSession([id], { reason: "pickup" });
      }
    }
    /* 新地点：打赢之后再搜，能翻出那里固定的东西 */
    const cf = WORLD.loot.clearedFind[S.loc];
    if (cf && S.flags.has(cf.need) && !S.flags.has("loot_" + cf.id) && !bagHas(S, cf.id)) {
      S.flags.add("loot_" + cf.id);
      log(cf.line);
      beginLootSession([cf.id], { reason: "pickup" });
    }
    if (S.loc === "caishikou" && n === 2) beginLootSession([rollFood("mid"), rollFood("mid")], { reason: "pickup" });
    if (S.loc === "yuyaofang" && n === 1 && S.flags.has("yyf_cleared")) beginLootSession(["honey"], { reason: "pickup" });
    /* 吃的：话说尽之后也还能翻到，只是要碰运气 */
    if (WORLD.loot.locTier[S.loc] && Math.random() < WORLD.loot.searchFoodChance * (n > arr.length ? 0.6 : 1)) {
      const fid = rollFood(WORLD.loot.locTier[S.loc]);
      if (fid) {
        log(`还翻出些${WORLD.items[fid].name}。`);
        beginLootSession([fid], { reason: "pickup" });
      }
    }
    if (S.loc === "village" && n === 1) S.flags.add("hear_child");
    render();
  }

  /* --- 游荡敌人系统 ---
     每次进入地点时按概率出现游荡敌人，日志警告玩家。
     游荡敌人存在时：搜索/休息有概率触发战斗，玩家可主动戒备。 */
  const WANDER_TABLE = {
    road_inn:  { chance: 0.15, fight: "road_ghoul" },
    village:   { chance: 0.30, fight: "village_pack" },
    canal:     { chance: 0.25, fight: "road_ghoul" },
    temple:    { chance: 0.25, fight: "road_ghoul" },
    barbican:  { chance: 0.30, fight: "street_horde" },
    post:      { chance: 0.25, fight: "road_ghoul" },
    gate:      { chance: 0.35, fight: "street_horde" },
    inner:     { chance: 0.40, fight: "street_horde" },
    yamen:     { chance: 0.25, fight: "road_ghoul" },
    valley:    { chance: 0.35, fight: "valley_pack" },
    palace:    { chance: 0.35, fight: "street_horde" },
    throne:    { chance: 0, fight: null },
    lugou:     { chance: 0.25, fight: "road_ghoul" },
    barracks:  { chance: 0.30, fight: "road_ghoul" },
    xishan_temple: { chance: 0.30, fight: "valley_pack" },
    caishikou: { chance: 0.35, fight: "street_horde" },
    yaoju:     { chance: 0.30, fight: "street_horde" },
    gulou:     { chance: 0.35, fight: "street_horde" },
    yuyaofang: { chance: 0.30, fight: "street_horde" },
  };

  const WANDER_WARN = [
    "远处似有拖沓的脚步声，在雪地里时断时续。",
    "风里夹着一股腐臭，近处只怕不太干净。",
    "你听见一阵低沉的喉音，像是有什么东西在嚼。",
    "残墙后头有个影子晃了一晃，看不清是什么。",
    "一阵瓦片碎裂的声响，有什么东西动了。",
  ];

  function rollWander(locId) {
    const cfg = WANDER_TABLE[locId];
    if (!cfg || !cfg.fight) return null;
    const night = isNight(S.elapsed);
    const chance = cfg.chance + (night ? 0.15 : 0);
    if (Math.random() < chance) {
      return { fightId: cfg.fight };
    }
    return null;
  }

  /** 赶路耗体力：轻装 7、常重 10、沉重 15 */
  function travelCost() {
    return { light: 7, normal: 10, heavy: 15 }[loadTier(S)];
  }

  /* 路上见闻：赶路时幕布上浮一句 */
  const ROAD_LINES = {
    day: [
      "雪越下越大，脚印转眼就被盖住了。",
      "官道两旁的枯树上挂着冰凌，风一吹，叮叮当当地响。",
      "路边倒着一辆空车，车辕上的缰绳还系着，牲口却不见了。",
      "远处有乌鸦落在雪地里，你走近了，它们也不飞。",
      "你踩着前人的车辙走，车辙到半路就断了。",
      "一块界碑歪在雪里，字叫冰糊住了，看不清是哪里。",
    ],
    night: [
      "夜路难走，你只认得脚下那一点雪光。",
      "风里有脚步声跟着你，你停，它也停。",
      "远处一点灯火亮了一下，又灭了。",
      "你把刀攥在手里走了一路，手指冻得伸不直。",
    ],
    corrupt: [
      "风里那股甜腥味，你闻了一路，竟不觉得难受。",
      "你走得比往常快，肚里却空得发慌，像少了一样什么。",
    ],
  };

  let travelling = false;

  function moveTo(link) {
    if (travelling) return;
    if (reducedMotion()) return doMove(link);
    const panel = document.getElementById("stage-panel");
    const pool = (S.corruption >= 50 && Math.random() < 0.4) ? ROAD_LINES.corrupt : isNight(S.elapsed) ? ROAD_LINES.night : ROAD_LINES.day;
    const line = pool[Math.floor(Math.random() * pool.length)];
    let veil = document.getElementById("travel-veil");
    if (!veil && panel) {
      veil = document.createElement("div");
      veil.id = "travel-veil";
      veil.className = "travel-veil";
      veil.innerHTML = `<p class="travel-to"></p><p class="travel-line"></p>`;
      panel.appendChild(veil);
    }
    travelling = true;
    /* 路上踩雪的几步 */
    [0, 480, 960].forEach((ms) => setTimeout(() => { if (typeof SFX !== "undefined") SFX.play("step"); }, ms));
    document.body.classList.add("travelling");
    if (veil) {
      veil.querySelector(".travel-to").textContent = `往${WORLD.locs[link.to].name}去`;
      veil.querySelector(".travel-line").textContent = line;
      veil.classList.remove("out");
      void veil.offsetWidth;
      veil.classList.add("in");
    }
    setTimeout(() => {
      travelling = false;
      document.body.classList.remove("travelling");
      doMove(link);
      if (veil) {
        veil.classList.remove("in");
        veil.classList.add("out");
      }
    }, 1700);
  }

  function doMove(link) {
    S.npcFlash = null;
    const chance = ambushChance(S.elapsed);
    const riskyFight =
      link.risky &&
      (Math.random() < chance ||
        (S.loc === "gate" && !S.flags.has("gate_open") && link.to === "inner"));

    if (S.loc === "gate" && link.to === "inner" && !S.flags.has("gate_open")) {
      S.pendingMove = link;
      startFight("gate_chain", "要想进城，须先收拾了门轴上那饿鬼。");
      return;
    }

    /* 入药谷：必先遭遇谷中行尸 */
    if (link.to === "valley" && !S.flags.has("valley_cleared")) {
      tick(link.min);
      S.stamina = Math.max(0, S.stamina - travelCost());
      hunger(link.min * WORLD.hunger.perMin);
      S.pendingMove = link;
      startFight("valley_pack", "你刚踏进谷口，岩缝里便爬出几具行尸来。");
      return;
    }

    /* 入道观：遭遇道士行尸 */
    if (link.to === "temple" && !S.flags.has("temple_cleared")) {
      tick(link.min);
      S.stamina = Math.max(0, S.stamina - travelCost());
      hunger(link.min * WORLD.hunger.perMin);
      S.pendingMove = link;
      startFight("temple_priest", "山门半掩，里头传来脚步声，走得不快，却一步也没停过。");
      return;
    }
    /* 入瓮城：遭遇溃兵行尸 */
    if (link.to === "barbican" && !S.flags.has("barbican_cleared")) {
      tick(link.min);
      S.stamina = Math.max(0, S.stamina - travelCost());
      hunger(link.min * WORLD.hunger.perMin);
      S.pendingMove = link;
      startFight("barbican_soldiers", "瓮城的门从里头堵死了，须得先清出一条路来。");
      return;
    }

    tick(link.min);
    S.stamina = Math.max(0, S.stamina - travelCost());

    hunger(link.min * WORLD.hunger.perMin);
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
      };
      const fightId = map[S.loc] || "road_ghoul";
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
    /* 抵达后 roll 游荡敌人 */
    S.wander = rollWander(S.loc);
    if (S.wander) {
      const warn = WANDER_WARN[Math.floor(Math.random() * WANDER_WARN.length)];
      log(warn, "sys");
    }
    render();
  }

  function buildExploreCmds() {
    const loc = WORLD.locs[S.loc];
    el.mode.textContent = "行路";
    el.cmdTitle.textContent = "行事";
    el.loc.textContent = loc.name;
    el.clock.textContent = formatWatch(S.elapsed);

    const acts = [
      btn("察看四周", "耗时", () => {
        /* 游荡敌人在附近时，搜索有概率触发战斗 */
        if (S.wander && Math.random() < 0.5) {
          const fid = S.wander.fightId;
          S.wander = null;
          log("搜索时惊动了游荡的行尸！", "sys");
          startFight(fid);
          return;
        }
        lookAround();
      }),
      btn("稍事休息", cheapestFood() ? `吃掉${WORLD.items[cheapestFood().id].name} · 回复气血与体力` : "没有吃的 · 只回一点", () => {
        /* 游荡敌人在附近时，休息可能被打断 */
        if (S.wander && Math.random() < 0.4) {
          const fid = S.wander.fightId;
          S.wander = null;
          log("刚合上眼，行尸就扑了过来！", "sys");
          startFight(fid);
          return;
        }
        tick(8);
        if (typeof SFX !== "undefined") SFX.play("campfire");
        const food = cheapestFood();
        if (food) {
          const it = WORLD.items[food.id];
          bagRemoveUid(S, food.uid);
          eat(food.id);
          hunger(WORLD.hunger.rest);
          S.hp = Math.min(WORLD.maxHp, S.hp + Math.round(17 * corrFx(S).food));
          S.stamina = Math.min(maxStaminaOf(S), S.stamina + 50);
          log(`你靠着残墙坐下，就着${isNight(S.elapsed) ? "夜色" : "雪光"}吃了${it.name}，气血稍复。`);
        } else {
          hunger(WORLD.hunger.rest);
          S.hp = Math.min(WORLD.maxHp, S.hp + 4);
          S.stamina = Math.min(maxStaminaOf(S), S.stamina + 25);
          log("身上没有吃的，你空着肚子靠墙眯了一会儿，饿得睡不踏实。");
        }
        /* 休息时游荡敌人可能靠近 */
        if (S.wander && Math.random() < 0.3) {
          log("休息时听到脚步声更近了。", "sys");
        }
        render();
      }),
    ];

    /* 游荡敌人在附近时，可主动戒备（迎战） */
    if (S.wander) {
      acts.push(
        btn("戒备迎敌", "主动出击", () => {
          const fid = S.wander.fightId;
          S.wander = null;
          log("你握紧兵器，朝着声响处迎了上去。", "sys");
          startFight(fid);
        }, "fight"),
      );
    }

    if (S.loc === "road_inn" || S.loc === "village") {
      acts.push(
        btn("寻敌练刀", "", () => {
          startFight(S.loc === "village" ? "village_pack" : "road_ghoul");
        }, "fight"),
      );
    }
    if (
      S.loc === "canal" &&
      S.flags.has("know_guard") &&
      !S.flags.has("canal_guard_slain") &&
      !S.flags.has("jade_hint")
    ) {
      acts.push(btn("追踪锦衣行尸", "", () => startFight("canal_guard"), "fight"));
    }
    if (S.loc === "gate" && !S.flags.has("gate_open")) {
      acts.push(btn("斩断门链", "", () => startFight("gate_chain"), "fight"));
    }
    if (S.loc === "inner") {
      acts.push(btn("清扫长街", "", () => startFight("street_horde"), "fight"));
    }
    if (S.loc === "valley") {
      if (S.flags.has("valley_cleared") && S.flags.has("valley_wood")) {
        acts.push(
          btn("火焚药谷", "", () => {
            endAs(
              "martyr",
              "你点着了干柴，寒谷里霎时火光冲天，岩缝中的药气被烤得干干净净。京师依旧残破，祸根却少了一处。你没有踏上丹陛，却烧掉了长生的根子。" +
                childCoda("good"),
            );
          }),
        );
      }
    }
    if (S.loc === "temple" && !S.flags.has("temple_cleared")) {
      acts.push(btn("清剿道观", "", () => startFight("temple_priest"), "fight"));
    }
    if (S.loc === "barbican" && !S.flags.has("barbican_cleared")) {
      acts.push(btn("肃清瓮城", "", () => startFight("barbican_soldiers"), "fight"));
      if (bagHas(S, "military_order")) {
        acts.push(
          btn("亮出令箭", "溃兵认得这支令", () => {
            S.flags.add("barbican_cleared");
            log("你把千总的令箭高高举起。那独臂的头目盯着看了半晌，喉咙里咕哝一声，竟带着手下退到了墙根，蹲下不动了。");
            render();
          }),
        );
      }
    }
    const NEW_FIGHTS = {
      lugou: ["截住溃兵骑手", "lugou_riders", "lugou_cleared", "lugou_riders_seen"],
      barracks: ["肃清营盘", "barracks_guard", "barracks_cleared"],
      xishan_temple: ["清剿古寺", "xishan_monks", "xishan_cleared"],
      caishikou: ["走上刑台", "caishikou_exec", "caishikou_cleared"],
      yaoju: ["掀帘进里屋", "yaoju_doctor", "yaoju_cleared"],
      gulou: ["上楼寻那锣声", "gulou_watch", "gulou_cleared"],
      yuyaofang: ["清剿御药房", "yyf_guard", "yyf_cleared"],
    };
    const nf = NEW_FIGHTS[S.loc];
    if (nf && !S.flags.has(nf[2]) && (!nf[3] || S.flags.has(nf[3]))) {
      acts.push(btn(nf[0], "", () => startFight(nf[1]), "fight"));
    }
    sideQuestActs(acts);
    if (S.loc === "throne") {
      acts.push(
        btn("逼近丹陛", "", () => startFight("throne_bite"), "fight"),
        btn("不敢近前，退出京师", "", () => {
          endAs(
            "flee",
            "丹陛你远远望见了，终究没有踏上去。出城时雪下得更大，那桩秘密仍旧锁在城里。你活着走了出来，也算是一种明白。" +
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
          const food = cheapestFood();
          if (food) bagRemoveUid(S, food.uid);
          log(food
            ? `你把${WORLD.items[food.id].name}塞给他。他吃了几口，抬手指着北边说：官爷，瓶子，往京城去了。`
            : "你身上没有吃的，只把他裹进怀里焐了一阵。他缓过气来，抬手指着北边说：官爷，瓶子，往京城去了。");
          render();
        }),
        btn("不加理会", "", () => {
          S.flags.add("left_child");
          S.corruption += 17;
          log("哭声渐渐被风雪捂住了。你脚下轻快了，心里却沉了下去。");
          render();
        }),
      );
    }
    if (
      !S.flags.has("saw_throne") &&
      bagHas(S, "jade_chip") &&
      bagHas(S, "edict") &&
      S.corruption <= 33 &&
      (S.loc === "post" || S.loc === "yamen")
    ) {
      acts.push(
        btn("携证出京", "", () => {
          endAs(
            "witness",
            "你没有上丹陛，却把密旨抄件和玉瓶残片带出了京城。外头总该有人肯听：长生不是福，是祸。" +
              childCoda("good"),
          );
        }),
      );
    }

    const left = (S.stash && S.stash[S.loc]) || [];
    if (left.length) {
      acts.push(
        btn("翻捡弃物", `此处留着 ${left.length} 件`, () => {
          const items = S.stash[S.loc];
          delete S.stash[S.loc];
          const staging = stagingList();
          items.forEach((p) => staging.push({ uid: nextBagUid(), id: p.id, rot: 0, qty: p.qty }));
          beginLootSession([], { reason: "pickup", skipSearch: true });
        }),
      );
    }
    group("", acts);
  }


  /* ---------- 鼓楼老兵：拿吃的换火药三件套 ---------- */
  const TRADE_STOCK = 15;
  /** 一样吃的能换几套：越顶饿换得越多 */
  const kitsFor = (id) => {
    const fill = (WORLD.items[id] || {}).fill || 0;
    return fill >= 20 ? 3 : fill >= 10 ? 2 : 1;
  };

  /** 渴染到了「狂」：活人一看你的眼睛就躲 */
  function shunned(text) {
    if (corrTier(S) < 2) return false;
    log(text);
    render();
    return true;
  }

  function openTrade() {
    if (shunned("老兵抬头看了你一眼，手里的火绳枪对准了你：别过来。你眼珠子红成那样，我没东西换给你。")) return;
    let box = document.getElementById("trade-modal");
    if (!box) {
      document.body.insertAdjacentHTML("beforeend", `
<div id="trade-modal" class="trade-modal" hidden>
  <div class="trade-panel">
    <header class="codex-head"><h2>守库的老兵</h2><p class="codex-count" id="trade-left"></p><button type="button" class="px-btn" id="trade-close">走了</button></header>
    <div class="trade-who"><img class="trade-face" src="assets/portraits/npc_veteran.png" alt="" draggable="false" /><p class="trade-say" id="trade-say"></p></div>
    <div class="trade-list" id="trade-list"></div>
  </div>
</div>`);
      box = document.getElementById("trade-modal");
      document.getElementById("trade-close").onclick = () => { box.hidden = true; render(); };
      box.addEventListener("click", (e) => { if (e.target === box) { box.hidden = true; render(); } });
    }
    paintTrade("你有吃的么？我在这库里守了半个月，火药有的是，就是没东西下肚。一样吃的换几套，顶饿的多给。");
    box.hidden = false;
  }

  function paintTrade(say) {
    const left = TRADE_STOCK - (S.veteranSold || 0);
    document.getElementById("trade-left").textContent = `他还剩 ${left} 套 · 你有火药 ${bagCountId(S, "powder")} 垫片 ${bagCountId(S, "wad")} 弹丸 ${bagCountId(S, "shot")}`;
    if (say) document.getElementById("trade-say").textContent = say;
    const list = document.getElementById("trade-list");
    list.innerHTML = "";
    const foods = bagPieces(S).filter((p) => (WORLD.items[p.id] || {}).food);
    if (!foods.length) {
      list.innerHTML = `<p class="trade-empty">你身上没有吃的。</p>`;
      return;
    }
    foods.forEach((p) => {
      const it = WORLD.items[p.id];
      const n = Math.min(kitsFor(p.id), left);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "trade-item";
      b.disabled = n <= 0;
      b.innerHTML = `<img src="${it.icon}" alt=""><span class="trade-name">${it.name}</span><span class="trade-get">换 ${n} 套</span>`;
      b.onclick = () => trade(p.uid, n);
      list.appendChild(b);
    });
  }

  function trade(uid, n) {
    const piece = bagPieces(S).find((p) => p.uid === uid);
    if (!piece || n <= 0) return;
    const name = WORLD.items[piece.id].name;
    bagRemoveUid(S, uid);
    S.veteranSold = (S.veteranSold || 0) + n;
    /* 行囊里能叠的先叠上，叠不下的放待收区 */
    const spill = [];
    ["powder", "wad", "shot"].forEach((id) => {
      const before = bagCountId(S, id);
      bagAddStack(S, id, n);
      const got = bagCountId(S, id) - before;
      if (got < n) spill.push([id, n - got]);
    });
    if (spill.length) {
      spill.forEach(([id, q]) => stagingList().push({ uid: nextBagUid(), id, rot: 0, qty: q }));
      toast("行囊放不下的，先放在待收区");
    } else toast(`换得火药、垫片、弹丸各 ${n}`);
    log(`你把${name}递给老兵，他接过去就啃，从库里拎出火药、垫片、弹丸各${n}份给你。`);
    if (typeof SFX !== "undefined") SFX.play("trade");
    if (typeof SFX !== "undefined") SFX.play("bag_place");
    panels();
    const left = TRADE_STOCK - S.veteranSold;
    paintTrade(left > 0 ? "好，好。还有么？" : "库里能拿的都给你了。往后的路，你自个儿当心。");
  }

  /** 支线：营盘千总、菜市口肉铺、药局熬药 */
  function sideQuestActs(acts) {
    if (S.loc === "barracks" && S.flags.has("officer_heard") && !S.flags.has("officer_done")) {
      if (!S.flags.has("officer_saved")) {
        acts.push(
          btn("掀开地窖", "里头的人要吃的", () => {
            if (typeof SFX !== "undefined") SFX.play("creak");
            if (shunned("地窖里那汉子刚抬起头，看清你的脸，便尖叫一声缩进最深处，再怎么叫也不肯出来。")) return;
            const food = cheapestFood();
            if (!food) {
              log("地窖里蜷着个穿千总号衣的汉子，饿得只剩一把骨头，张着嘴要吃的。你身上没有吃的，只得把板子又盖了回去。");
              render();
              return;
            }
            bagRemoveUid(S, food.uid);
            S.flags.add("officer_saved");
            log(`地窖里蜷着个穿千总号衣的汉子，饿得只剩一把骨头。你把${WORLD.items[food.id].name}递给他，他狼吞虎咽吃了，喘匀了气，说：我身上这领铁甲，还有一支令箭，你挑一样拿去。`);
            render();
          }),
          btn("不去管他", "", () => {
            S.flags.add("officer_done");
            S.corruption += 8;
            log("你没去掀那块板子。走出营门老远，那喊声还跟在你身后。");
            render();
          }),
        );
      } else {
        acts.push(
          btn("要他的铁甲", "刀枪难入，也沉得很", () => {
            S.flags.add("officer_done");
            log("千总把铁甲一片片解下来交给你：我留着也走不动了。");
            beginLootSession(["iron_armor"], { reason: "pickup" });
            render();
          }),
          btn("要他的令箭", "瓮城的溃兵认得", () => {
            S.flags.add("officer_done");
            log("千总把令箭塞进你手里：瓮城里那帮人原是我带的兵，见了这个，兴许还认得。");
            beginLootSession(["military_order"], { reason: "pickup" });
            render();
          }),
        );
      }
    }
    /* 菜市口：刽子手打倒了，肉铺老汉开门谢你一包肉 */
    if (S.loc === "caishikou" && S.flags.has("caishikou_cleared") && !S.flags.has("butcher_thanked")) {
      acts.push(
        btn("敲肉铺的门", "", () => {
          if (typeof SFX !== "undefined") SFX.play("door_open");
          if (shunned("门缝里那张老脸只看了你一眼，「砰」地把门板顶死了，里头传来搬东西抵门的声响。")) return;
          S.flags.add("butcher_thanked");
          S.npcFlash = { id: "butcher", loc: S.loc };
          const fid = Math.random() < 0.5 ? "sauce_meat" : "cured_meat";
          log(`门缝里探出一张老脸，朝刑台那边望了望，长出一口气：那东西叫你砍了？我守着这铺子，夜夜怕它来撬门。说着塞出一包${WORLD.items[fid].name}，又把门闩上了。`);
          beginLootSession([fid], { reason: "pickup" });
          render();
        }),
      );
    }
    /* 鼓楼：守火器库的老兵饿着肚子，拿吃的换火药、垫片、弹丸 */
    if (S.loc === "gulou" && S.flags.has("gulou_cleared")) {
      const left = TRADE_STOCK - (S.veteranSold || 0);
      acts.push(btn("找守库的老兵", left > 0 ? `拿吃的换火药 · 他还剩 ${left} 套` : "他手里的火药换完了", () => openTrade(), left > 0 ? "" : ""));
    }
    if (S.loc === "yaoju" && bagHas(S, "doctor_recipe")) {
      const need = ["honey", "huangjiu", "jujube"];
      const missing = need.filter((id) => !bagHas(S, id));
      acts.push(
        btn("照方熬药", missing.length ? `还缺${missing.map((id) => WORLD.items[id].name).join("、")}` : "蜂蜜、黄酒、红枣各一", () => {
          if (need.some((id) => !bagHas(S, id))) return;
          need.forEach((id) => removeBagId(id));
          if (typeof SFX !== "undefined") SFX.play("brew");
          tick(4);
          log("你在屋角那口锅底下生了火，照方子把蜂蜜、黄酒、红枣一并熬了。熬到汤色发黑，屋里一股苦甜的气味，你把药汤灌进一只瓷瓶里。");
          beginLootSession(["antidote"], { reason: "pickup" });
          render();
        }),
      );
      if (missing.length) acts[acts.length - 1].disabled = true;
    }
  }

  /* ---------- NPC 立绘：人在场时站进场景窗 ---------- */
  const NPCS = {
    child: { name: "荒村孩童", img: "assets/portraits/npc_child.png" },
    officer: { name: "地窖里的千总", img: "assets/portraits/npc_officer.png" },
    butcher: { name: "肉铺老汉", img: "assets/portraits/npc_butcher.png" },
    veteran: { name: "守库的老兵", img: "assets/portraits/npc_veteran.png" },
  };
  /** 此刻这里有谁：孩童、千总要先找着；肉铺老汉只在开门那一下露面；老兵在清完鼓楼后一直守着 */
  function npcHere() {
    if (S.mode !== "explore") return null;
    if (S.npcFlash && S.npcFlash.loc === S.loc) return S.npcFlash.id;
    if (S.loc === "village" && S.flags.has("hear_child") && !S.flags.has("left_child")) return "child";
    if (S.loc === "barracks" && S.flags.has("officer_saved") && !S.flags.has("officer_done")) return "officer";
    if (S.loc === "gulou" && S.flags.has("gulou_cleared")) return "veteran";
    return null;
  }
  function syncNpc() {
    const box = document.getElementById("npc-stage");
    if (!box) return;
    const id = npcHere();
    const n = id && NPCS[id];
    if (!n) { box.hidden = true; box.dataset.id = ""; return; }
    if (box.dataset.id !== id) {
      document.getElementById("npc-art").src = n.img;
      document.getElementById("npc-name").textContent = n.name;
      box.dataset.id = id;
      box.classList.remove("enter"); void box.offsetWidth; box.classList.add("enter");
    }
    box.hidden = false;
  }

  function render() {
    panels();
    syncNpc();
    renderMap();
    paintJournal();
    if (S.mode === "ending") {
      const d = document.documentElement, b = document.body;
      const x = d ? d.scrollLeft : 0, y = d ? d.scrollTop : b.scrollTop;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      el.commands.innerHTML = "";
      el.mode.textContent = "终卷";
      el.cmdTitle.textContent = "此后";
      el.clock.textContent = formatWatch(S.elapsed);
      CombatUI.close();
      if (deathEl && deathEl.hidden) {
        const endingEntry = S.journal.find((e) => e.kind === "ending");
        showEndingScreen(S.ending, (endingEntry && endingEntry.text) || "");
      }
      if (d) { d.scrollLeft = x; d.scrollTop = y; }
      else if (b) { b.scrollLeft = x; b.scrollTop = y; }
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
    const d = document.documentElement, b = document.body;
    const x = d ? d.scrollLeft : 0, y = d ? d.scrollTop : b.scrollTop;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    el.commands.innerHTML = "";
    buildExploreCmds();
    if (d) { d.scrollLeft = x; d.scrollTop = y; }
    else if (b) { b.scrollLeft = x; b.scrollTop = y; }
  }

  function startGame() {
    revealGame({ forceFade: true });
    window.scrollTo(0, 0);
    if (!S.journal.length) {
      log("你在野店门口跺了跺脚上的雪。进京的路有好几条，点下方「赴京图」择路而行。");
      describe(true);
    }
    render();
  }

  document.getElementById("btn-save").onclick = () => {
    if (S.mode === "combat") {
      toast("交战之中，无暇落笔存档");
      return;
    }
    localStorage.setItem(SAVE, JSON.stringify(snap()));
    toast("已存档");
    if (typeof SFX !== "undefined") SFX.play("ui");
  };
  document.getElementById("btn-load").onclick = () => {
    tryLoadSave();
  };
  document.getElementById("btn-restart").onclick = () => {
    const ask = "确定要重新开始游戏吗？当前进度将丢失。";
    if (confirm(typeof I18N !== "undefined" ? I18N.tr(ask) : ask)) {
      localStorage.removeItem(SAVE);
      location.reload();
    }
  };
  const btnSfx = document.getElementById("btn-sfx");
  if (btnSfx && typeof SFX !== "undefined") {
    btnSfx.onclick = () => {
      const off = SFX.toggleMute();
      btnSfx.textContent = off ? "音效关" : "音效开";
      if (!off) SFX.play("ui");
    };
  }

  /* 设置面板：音乐/音效音量调节，localStorage 持久化 */
  const settingsModal = document.getElementById("settings-modal");
  const btnSettings = document.getElementById("btn-settings");
  const settingsClose = document.getElementById("settings-close");
  const volBgm = document.getElementById("vol-bgm");
  const volBgmVal = document.getElementById("vol-bgm-val");
  const volSfx = document.getElementById("vol-sfx");
  const volSfxVal = document.getElementById("vol-sfx-val");

  /* 从 localStorage 恢复音量设置 */
  const savedBgm = parseInt(localStorage.getItem("vol-bgm"), 10);
  const savedSfx = parseInt(localStorage.getItem("vol-sfx"), 10);
  if (!isNaN(savedBgm) && volBgm) {
    volBgm.value = String(savedBgm);
    if (volBgmVal) volBgmVal.textContent = String(savedBgm);
    if (typeof BGM !== "undefined") BGM.setVolume(savedBgm / 100);
  }
  if (!isNaN(savedSfx) && volSfx) {
    volSfx.value = String(savedSfx);
    if (volSfxVal) volSfxVal.textContent = String(savedSfx);
    if (typeof SFX !== "undefined") SFX.setVolume(savedSfx / 100);
  }

  function openSettings() {
    if (!settingsModal) return;
    settingsModal.hidden = false;
    requestAnimationFrame(() => settingsModal.classList.add("is-visible"));
  }
  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove("is-visible");
    setTimeout(() => { settingsModal.hidden = true; }, 280);
  }
  if (btnSettings) btnSettings.onclick = openSettings;
  if (settingsClose) settingsClose.onclick = closeSettings;
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) closeSettings();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && settingsModal && !settingsModal.hidden) closeSettings();
    });
  }
  if (volBgm) {
    volBgm.oninput = () => {
      const v = parseInt(volBgm.value, 10);
      if (volBgmVal) volBgmVal.textContent = String(v);
      if (typeof BGM !== "undefined") BGM.setVolume(v / 100);
      localStorage.setItem("vol-bgm", String(v));
    };
  }
  if (volSfx) {
    volSfx.oninput = () => {
      const v = parseInt(volSfx.value, 10);
      if (volSfxVal) volSfxVal.textContent = String(v);
      if (typeof SFX !== "undefined") SFX.setVolume(v / 100);
      localStorage.setItem("vol-sfx", String(v));
    };
  }
  document.getElementById("btn-codex").onclick = () => Codex.open();
  /* 日志正在一句句浮现时，点一下全部现出 */
  el.journal.addEventListener("click", () => flushReveal());
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

  /* 资源预加载：等所有图片/音效/音乐加载完再显示序章 */
  const loaderEl = document.getElementById("asset-loader");
  const alBar = document.getElementById("al-bar");
  const alStatus = document.getElementById("al-status");
  const alCount = document.getElementById("al-count");

  function showOpening() {
    if (loaderEl) {
      loaderEl.classList.add("hide");
      setTimeout(() => { loaderEl.hidden = true; }, 500);
    }
    const op = document.getElementById("opening");
    if (op) op.hidden = false;
    openingApi = runOpening({
      onDone: () => startGame(),
    });
  }

  if (typeof AssetLoader !== "undefined" && loaderEl) {
    if (alStatus) alStatus.textContent = "正在备办行装…";
    AssetLoader.preloadAll((done, total, label) => {
      if (alBar) alBar.style.width = `${Math.round((done / total) * 100)}%`;
      if (alCount) alCount.textContent = `${done} / ${total}`;
    })
      .then(() => {
        if (alStatus) alStatus.textContent = "就绪。";
        if (alBar) alBar.style.width = "100%";
        /* 短暂停顿让玩家看到 100% */
        setTimeout(showOpening, 400);
      })
      .catch(() => {
        /* 出错也继续进游戏，不要卡死 */
        if (alStatus) alStatus.textContent = "部分资源未就绪，仍可开始。";
        setTimeout(showOpening, 800);
      });
  } else {
    /* 没有加载器（老环境），直接进序章 */
    showOpening();
  }

  /* 测试接口：只有网址带 ?debug 才挂上，供脚本走完整流程（正式游玩不受影响） */
  if (/[?&]debug\b/.test(location.search)) {
    window.__ming = {
      get S() { return S; },
      links: () => (WORLD.locs[S.loc].links || []).map((l) => ({ ...l, ok: !(l.need && !l.need.every((f) => S.flags.has(f))) })),
      go: (to) => {
        const link = linkFromHere(to);
        if (!link) return false;
        doMove(link);
        return true;
      },
      look: () => lookAround(),
      cmds: () => [...el.commands.querySelectorAll("button")].map((b) => b.childNodes[0].textContent.trim()),
      press: (label) => {
        const b = [...el.commands.querySelectorAll("button")].find((x) => x.childNodes[0].textContent.trim() === label);
        if (b) b.click();
        return !!b;
      },
      /** 当场打赢眼前这一仗（跳过手上操作，结算照常走） */
      winFight: () => {
        if (S.mode !== "combat" || !S.combat) return false;
        S.combat.enemies.forEach((e) => { e.hp = 0; });
        CombatUI.close();
        finishFight("win");
        return true;
      },
      closeBag: () => CombatUI.closeBag({ force: true }),
    };
  }

  /* 检测 style.css 是否真正生效（手机常因 file:// 或缺文件导致裸页+血丝） */
  requestAnimationFrame(() => {
    const ok = getComputedStyle(document.documentElement).getPropertyValue("--ming-css-ok").trim();
    const banner = document.getElementById("css-fail-banner");
    if (!ok && banner) banner.style.display = "block";
  });
})();
