/** 战斗数据、装备结算、斩影规则 */

const COMBAT = {
  slashPreviewMs: 480,
  slashShowEachMs: 420,
  slashShowGapMs: 120,
  slashWindowMs: 5000,
  portraits: {
    player: "assets/portraits/player.png?v=wanderer",
    g1: "assets/portraits/ghoul_warrior.png?v=ragged1",
    v1: "assets/portraits/ghoul_villager.png?v=fierce1",
    v2: "assets/portraits/ghoul_villager.png?v=fierce1",
    c1: "assets/portraits/jinyi_guard.png?v=bw1",
    k1: "assets/portraits/gate_warden.png?v=ming1",
    s1: "assets/portraits/street_corpse.png?v=bw1",
    s2: "assets/portraits/street_corpse.png?v=bw1",
    s3: "assets/portraits/sedan_corpse.png?v=mingcivil1",
    t1: "assets/portraits/immortal_lord.png?v=mingrobe1",
    vv1: "assets/portraits/valley_corpse.png?v=ming2",
    vv2: "assets/portraits/valley_corpse.png?v=ming2",
  },
  templates: {
    road_ghoul: {
      title: "官道上",
      intro: "雪窝里爬出一个穿破甲的，胸前补子还能认出「勇士」。他冲你咧嘴，牙发青。",
      hue: 120,
      enemies: [{ id: "g1", name: "变异勇士", hp: 3, atk: 1, essence: 1 }],
      fleeChance: 0.5,
      acts: [
        { id: "stare", name: "盯视", desc: "打量它的破绽", effect: "weaken" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
    village_pack: {
      title: "村里",
      intro: "柴门后挤出两个，下巴掉了还一个劲嚼，嘴里含糊喊着要吃的。",
      hue: 40,
      enemies: [
        { id: "v1", name: "变异村民", hp: 2, atk: 1, essence: 1 },
        { id: "v2", name: "变异村民", hp: 3, atk: 1, essence: 1 },
      ],
      fleeChance: 0.4,
      acts: [
        { id: "shout", name: "喝止", desc: "提高逃离几率", effect: "fleeBoost" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
    canal_guard: {
      title: "纤道上",
      intro: "锦衣破布在风里响，腰牌撞骨头叮当响。这人从前去寻药，这会儿牙倒比人尖。",
      hue: 200,
      enemies: [{ id: "c1", name: "锦衣行尸", hp: 5, atk: 2, essence: 2 }],
      fleeChance: 0.35,
      onWinFlags: ["jade_hint", "canal_guard_slain"],
      acts: [
        { id: "badge", name: "唤腰牌", desc: "它愣了一愣", effect: "weaken" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
    gate_chain: {
      title: "城门",
      intro: "铁链绷直了。门轴上的守兵叫你惊着，整个人扑过来，链子拖出火星。",
      hue: 0,
      enemies: [{ id: "k1", name: "城门尸卫", hp: 6, atk: 2, essence: 2 }],
      fleeChance: 0.25,
      onWinFlags: ["gate_open"],
      acts: [
        { id: "chain", name: "扯链", desc: "打乱它扑势", effect: "weaken" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
    street_horde: {
      title: "长街",
      intro: "鼓楼铃乱响。街上的行尸往你这儿涌。先砍近的，别叫围死。",
      hue: 280,
      enemies: [
        { id: "s1", name: "街尸", hp: 3, atk: 1, essence: 1 },
        { id: "s2", name: "街尸", hp: 3, atk: 1, essence: 1 },
        { id: "s3", name: "轿中尸", hp: 4, atk: 1, essence: 2 },
      ],
      fleeChance: 0.45,
      acts: [
        { id: "bell", name: "摇铃扰乱", desc: "提高逃离几率", effect: "fleeBoost" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
    throne_bite: {
      title: "丹陛前",
      intro: "「长生」俩字还没说完，椅上那影已经到了台阶口。风里全是牙口气。",
      hue: 350,
      enemies: [{ id: "t1", name: "长生祸首", hp: 8, atk: 2, essence: 5 }],
      fleeChance: 0.2,
      boss: true,
      acts: [
        { id: "name", name: "唤旧名", desc: "它攻势稍缓", effect: "weaken" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
    valley_pack: {
      title: "药谷",
      intro: "岩缝里爬出两具行尸，身上带着谷里的寒气，像被药气养着，不肯散。",
      hue: 180,
      enemies: [
        { id: "vv1", name: "谷中行尸", hp: 3, atk: 1, essence: 1 },
        { id: "vv2", name: "谷中行尸", hp: 4, atk: 1, essence: 2 },
      ],
      fleeChance: 0.35,
      onWinFlags: ["valley_cleared"],
      acts: [
        { id: "fire", name: "扬火", desc: "吓退半步", effect: "weaken" },
        { id: "guard", name: "横刀", desc: "下轮少挨一下", effect: "defend" },
      ],
    },
  },
};

function itemDef(id) {
  return WORLD.items[id] || null;
}

function itemIcon(id) {
  const it = itemDef(id);
  return (it && it.icon) || null;
}

function itemShapeBounds(id, rot = 0) {
  const cells = itemShape(id, rot);
  let maxX = 0;
  let maxY = 0;
  cells.forEach(([dx, dy]) => {
    if (dx > maxX) maxX = dx;
    if (dy > maxY) maxY = dy;
  });
  return { w: maxX + 1, h: maxY + 1 };
}

function itemHomeZone(id) {
  const it = itemDef(id);
  if (!it) return "bag";
  if (it.slot === "weapon") return "weapon";
  if (it.slot === "armor") return "armor";
  return "bag";
}

/** 武器/护甲可进行囊；武器栏仅兵器，护甲栏仅护甲 */
function zoneAllowsItem(zone, id) {
  const home = itemHomeZone(id);
  if (zone === "bag") return true;
  if (zone === "weapon") return home === "weapon";
  if (zone === "armor") return home === "armor";
  return false;
}

function zoneSize(zone) {
  if (zone === "weapon") return WORLD.weaponRack || { w: 2, h: 4 };
  if (zone === "armor") return WORLD.armorRack || { w: 2, h: 4 };
  return { w: WORLD.bagW, h: WORLD.bagH };
}

function piecesOf(state, zone) {
  if (zone === "weapon") return state.weaponPieces || [];
  if (zone === "armor") return state.armorPieces || [];
  return state.bagPieces || [];
}

function ensurePiecesArr(state, zone) {
  if (zone === "weapon") {
    if (!state.weaponPieces) state.weaponPieces = [];
    return state.weaponPieces;
  }
  if (zone === "armor") {
    if (!state.armorPieces) state.armorPieces = [];
    return state.armorPieces;
  }
  if (!state.bagPieces) state.bagPieces = [];
  return state.bagPieces;
}

function gridOccupied(pieces, ignoreUid) {
  const map = {};
  (pieces || []).forEach((p) => {
    if (ignoreUid && p.uid === ignoreUid) return;
    itemShape(p.id, p.rot).forEach(([dx, dy]) => {
      map[`${p.x + dx},${p.y + dy}`] = p.uid;
    });
  });
  return map;
}

function gridCanPlace(pieces, W, H, id, x, y, rot, ignoreUid) {
  const cells = itemShape(id, rot);
  const occ = gridOccupied(pieces, ignoreUid);
  for (const [dx, dy] of cells) {
    const cx = x + dx;
    const cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return false;
    if (occ[`${cx},${cy}`]) return false;
  }
  return true;
}

function gridFindPlace(pieces, W, H, id, rot = 0) {
  for (let r = 0; r < 4; r++) {
    const rr = (rot + r) % 4;
    const bounds = itemShapeBounds(id, rr);
    for (let y = 0; y <= H - bounds.h; y++) {
      for (let x = 0; x <= W - bounds.w; x++) {
        if (gridCanPlace(pieces, W, H, id, x, y, rr)) return { x, y, rot: rr };
      }
    }
  }
  return null;
}

function zoneCanPlace(state, zone, id, x, y, rot, ignoreUid) {
  const { w: W, h: H } = zoneSize(zone);
  return gridCanPlace(piecesOf(state, zone), W, H, id, x, y, rot, ignoreUid);
}

function zoneFindPlace(state, zone, id, rot = 0) {
  const { w: W, h: H } = zoneSize(zone);
  return gridFindPlace(piecesOf(state, zone), W, H, id, rot);
}

function zoneAddPiece(state, zone, id, place) {
  if (!place) place = zoneFindPlace(state, zone, id, 0);
  if (!place) return null;
  const piece = { uid: nextBagUid(), id, x: place.x, y: place.y, rot: place.rot };
  if (isStackable && isStackable(id)) piece.qty = 1;
  ensurePiecesArr(state, zone).push(piece);
  if (typeof ensureGunState === "function" && isFirearm && isFirearm(id)) {
    ensureGunState(state, id);
  }
  return piece;
}

function zoneRemoveUid(state, zone, uid) {
  const list = ensurePiecesArr(state, zone);
  const i = list.findIndex((p) => p.uid === uid);
  if (i < 0) return null;
  return list.splice(i, 1)[0];
}

function findPieceAnywhere(state, uid) {
  for (const zone of ["bag", "weapon", "armor"]) {
    const p = piecesOf(state, zone).find((x) => x.uid === uid);
    if (p) return { piece: p, zone };
  }
  return null;
}

function findPieceByIdAnywhere(state, id) {
  for (const zone of ["bag", "weapon", "armor"]) {
    const p = piecesOf(state, zone).find((x) => x.id === id);
    if (p) return { piece: p, zone };
  }
  return null;
}

/** 网格消毒：越界/重叠重摆；栏内不允许的类型挪走（可行囊） */
function sanitizeAllGrids(state) {
  const zones = ["bag", "weapon", "armor"];
  const misplaced = [];
  zones.forEach((zone) => {
    const list = piecesOf(state, zone).slice();
    ensurePiecesArr(state, zone).length = 0;
    const { w: W, h: H } = zoneSize(zone);
    list.forEach((p) => {
      if (!zoneAllowsItem(zone, p.id)) {
        misplaced.push(p);
        return;
      }
      if (gridCanPlace(piecesOf(state, zone), W, H, p.id, p.x, p.y, p.rot | 0)) {
        ensurePiecesArr(state, zone).push(p);
        return;
      }
      const place = gridFindPlace(piecesOf(state, zone), W, H, p.id, p.rot | 0);
      if (place) {
        ensurePiecesArr(state, zone).push({
          uid: p.uid,
          id: p.id,
          x: place.x,
          y: place.y,
          rot: place.rot,
          qty: p.qty,
        });
      } else {
        misplaced.push(p);
      }
    });
  });
  misplaced.forEach((p) => {
    const home = itemHomeZone(p.id);
    const order = home === "bag" ? ["bag"] : [home, "bag"];
    for (const zone of order) {
      const place = zoneFindPlace(state, zone, p.id, p.rot | 0);
      if (place) {
        ensurePiecesArr(state, zone).push({
          uid: p.uid || nextBagUid(),
          id: p.id,
          x: place.x,
          y: place.y,
          rot: place.rot,
          qty: p.qty,
        });
        return;
      }
    }
  });
  return state;
}

function bagSanitize(state) {
  return sanitizeAllGrids(state);
}

function equippedUid(state, slot) {
  if (!state.equipped) return null;
  if (slot === "weapon") return state.equipped.weaponUid || null;
  if (slot === "armor") return state.equipped.armorUid || null;
  return null;
}

function equippedId(state, slot) {
  if (!state.equipped) return null;
  if (slot === "weapon") {
    const uid = state.equipped.weaponUid;
    if (uid) {
      const hit = findPieceAnywhere(state, uid);
      if (hit) return hit.piece.id;
    }
    if (state.equipped.weapon && typeof state.equipped.weapon === "string") {
      return state.equipped.weapon;
    }
    return null;
  }
  if (slot === "armor") {
    const uid = state.equipped.armorUid;
    if (uid) {
      const hit = findPieceAnywhere(state, uid);
      if (hit) return hit.piece.id;
    }
    if (state.equipped.armor && typeof state.equipped.armor === "string") {
      return state.equipped.armor;
    }
    return null;
  }
  return state.equipped.charm || null;
}

function setHeldWeapon(state, uid) {
  if (!state.equipped) state.equipped = {};
  const hit = findPieceAnywhere(state, uid);
  if (!hit || itemHomeZone(hit.piece.id) !== "weapon") return false;
  state.equipped.weaponUid = uid;
  delete state.equipped.weapon;
  if (typeof ensureGunState === "function" && isFirearm && isFirearm(hit.piece.id)) {
    ensureGunState(state, hit.piece.id);
  }
  return true;
}

function setHeldArmor(state, uid) {
  if (!state.equipped) state.equipped = {};
  const hit = findPieceAnywhere(state, uid);
  if (!hit || itemHomeZone(hit.piece.id) !== "armor") return false;
  state.equipped.armorUid = uid;
  delete state.equipped.armor;
  return true;
}

function allWeaponPieces(state) {
  const list = [];
  weaponPieces(state).forEach((p) => list.push(p));
  bagPieces(state).forEach((p) => {
    if (itemHomeZone(p.id) === "weapon") list.push(p);
  });
  return list;
}

function weaponOf(state) {
  const id = equippedId(state, "weapon");
  const it = id ? itemDef(id) : null;
  if (it) {
    return {
      id,
      name: it.name,
      dmg: it.dmg || 1,
      combo: it.combo == null ? 0 : it.combo | 0,
    };
  }
  return { id: null, name: "徒手", dmg: 1, combo: 0 };
}

function armorOf(state) {
  const id = equippedId(state, "armor");
  const it = id ? itemDef(id) : null;
  if (it) return { id, name: it.name, def: it.def || 0 };
  return { id: null, name: "无", def: 0 };
}

function charmOf(state) {
  const id = equippedId(state, "charm");
  const it = id ? itemDef(id) : null;
  if (it) {
    return {
      id,
      name: it.name,
      atkBonus: it.atkBonus || 0,
      defBonus: it.defBonus || 0,
    };
  }
  return { id: null, name: "无", atkBonus: 0, defBonus: 0 };
}

function gearSummary(state) {
  const lines = [];
  const w = typeof weaponOfFirearmAware === "function" ? weaponOfFirearmAware(state) : weaponOf(state);
  if (w.firearm) {
    const mode =
      w.mode === "shoot" ? "可射" : w.mode === "smash" ? "可砸" : "空膛";
    lines.push(`兵器  ${w.name}（伤 ${w.dmg} · 弹 ${w.ammo|0} · ${mode}）`);
  } else {
    lines.push(`兵器  ${w.name}（每斩 1 · 斩影 ${w.combo + 1}）`);
  }
  if (equippedId(state, "armor")) {
    const a = armorOf(state);
    lines.push(`护甲  ${a.name}${a.def ? `（减 ${a.def}）` : ""}`);
  }
  if (equippedId(state, "charm")) {
    const c = charmOf(state);
    lines.push(
      `符箓  ${c.name}${c.atkBonus || c.defBonus ? `（攻+${c.atkBonus}/防+${c.defBonus}）` : ""}`,
    );
  }
  return lines.join("\n");
}

let _bagUid = 1;
function nextBagUid() {
  return "b" + _bagUid++;
}

function itemShape(id, rot = 0) {
  const it = itemDef(id);
  let cells = (it && it.shape) || [[0, 0]];
  const r = ((rot % 4) + 4) % 4;
  for (let i = 0; i < r; i++) {
    cells = cells.map(([x, y]) => [-y, x]);
  }
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function bagPieces(state) {
  return state.bagPieces || [];
}

function weaponPieces(state) {
  return state.weaponPieces || [];
}

function armorPieces(state) {
  return state.armorPieces || [];
}

function bagOccupied(state, ignoreUid) {
  return gridOccupied(bagPieces(state), ignoreUid);
}

function bagCanPlace(state, id, x, y, rot, ignoreUid) {
  return zoneCanPlace(state, "bag", id, x, y, rot, ignoreUid);
}

function bagFindPlace(state, id, rot = 0) {
  return zoneFindPlace(state, "bag", id, rot);
}

function bagCount(state) {
  return bagPieces(state).reduce((n, p) => n + itemShape(p.id, p.rot).length, 0);
}

function bagCellCapacity() {
  return WORLD.bagW * WORLD.bagH;
}

function bagHasRoom(state, id) {
  const zone = itemHomeZone(id);
  return !!zoneFindPlace(state, zone === "weapon" || zone === "armor" ? zone : "bag", id, 0);
}

function bagHas(state, id) {
  if (bagPieces(state).some((p) => p.id === id)) return true;
  if (weaponPieces(state).some((p) => p.id === id)) return true;
  if (armorPieces(state).some((p) => p.id === id)) return true;
  if (equippedId(state, "charm") === id) return true;
  return false;
}

function bagAddPiece(state, id, place) {
  const home = itemHomeZone(id);
  if (home === "weapon" || home === "armor") {
    const piece = zoneAddPiece(state, home, id, place);
    if (piece && home === "weapon" && !equippedUid(state, "weapon")) setHeldWeapon(state, piece.uid);
    if (piece && home === "armor" && !equippedUid(state, "armor")) setHeldArmor(state, piece.uid);
    return piece;
  }
  return zoneAddPiece(state, "bag", id, place);
}

function bagRemoveUid(state, uid) {
  const found = findPieceAnywhere(state, uid);
  if (!found) return null;
  const removed = zoneRemoveUid(state, found.zone, uid);
  if (removed) {
    if (state.equipped && state.equipped.weaponUid === uid) {
      const next = (state.weaponPieces || [])[0];
      state.equipped.weaponUid = next ? next.uid : null;
    }
    if (state.equipped && state.equipped.armorUid === uid) {
      const next = (state.armorPieces || [])[0];
      state.equipped.armorUid = next ? next.uid : null;
    }
  }
  return removed;
}

function bagRemoveOneId(state, id) {
  const found = findPieceByIdAnywhere(state, id);
  if (!found) return null;
  return bagRemoveUid(state, found.piece.uid);
}

function bagPieceAt(state, x, y) {
  const occ = bagOccupied(state);
  const uid = occ[`${x},${y}`];
  if (!uid) return null;
  return bagPieces(state).find((p) => p.uid === uid) || null;
}

/** 旧档兼容：补齐持有 uid；不强制把兵器从行囊迁出 */
function migrateEquipmentLayout(state) {
  if (!state.equipped) state.equipped = {};
  if (!state.weaponPieces) state.weaponPieces = [];
  if (!state.armorPieces) state.armorPieces = [];
  if (!state.bagPieces) state.bagPieces = [];

  if (!state.equipped.weaponUid && state.equipped.weapon) {
    const id = state.equipped.weapon;
    let found = findPieceByIdAnywhere(state, id);
    if (!found) {
      const p = zoneAddPiece(state, "weapon", id);
      if (p) found = { piece: p, zone: "weapon" };
    }
    if (found) state.equipped.weaponUid = found.piece.uid;
    delete state.equipped.weapon;
  }
  if (!state.equipped.armorUid && state.equipped.armor) {
    const id = state.equipped.armor;
    let found = findPieceByIdAnywhere(state, id);
    if (!found) {
      const p = zoneAddPiece(state, "armor", id);
      if (p) found = { piece: p, zone: "armor" };
    }
    if (found) state.equipped.armorUid = found.piece.uid;
    delete state.equipped.armor;
  }
  if (!state.equipped.weaponUid) {
    const w = allWeaponPieces(state)[0];
    if (w) state.equipped.weaponUid = w.uid;
  }
  sanitizeAllGrids(state);
  return state;
}

function slashComboOf(state) {
  /* combo 0 → 只斩 1 次；更高 combo 增加需连点段数 */
  return Math.max(1, (weaponOf(state).combo | 0) + 1);
}

function slashGhostTotal(_state) {
  return 9;
}

/** 连击每斩 1 伤（实际在 UI 中逐段结算）；保留函数供兼容 */
function slashDamage(_state, hits, _needed, whiff) {
  if (whiff) return 0;
  return Math.max(0, hits | 0);
}

function cloneFight(id) {
  const t = COMBAT.templates[id];
  if (!t) return null;
  return {
    id,
    title: t.title,
    intro: t.intro,
    hue: t.hue || 0,
    round: 1,
    enemies: t.enemies.map((e) => ({ ...e, maxHp: e.hp, weakened: 0 })),
    fleeChance: t.fleeChance,
    onWinFlags: t.onWinFlags || [],
    boss: !!t.boss,
    defend: false,
    fleeBoost: 0,
    acts: t.acts || [],
  };
}

function alive(c) {
  return c.enemies.filter((e) => e.hp > 0);
}

function bars(hp, max) {
  let s = "";
  for (let i = 0; i < max; i++) s += i < hp ? "█" : "░";
  return s;
}
