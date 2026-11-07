/** 火器：弹药、叠堆、管槽、射击结算（v1） */

const FIREARM = {
  aimFlashMs: 220, /* 扣火后火绳嘶嘶声的长度（sfx aim_beep） */
  aimFlashCount: 2,
  shootWindowMs: 5000,
  hitMult: [1, 0.75], /* [打头, 打身子] 伤害倍率 */
};

const FIREARM_SPEC = {
  sanyan: {
    tubes: 3,
    canMelee: true,
    combatReload: false,
    shotsPerTurn: 1,
    usesZichong: false,
    smashDmg: 33,
  },
  siyan: {
    tubes: 4,
    canMelee: true,
    combatReload: false,
    shotsPerTurn: 1,
    usesZichong: false,
    smashDmg: 33,
  },
  xunlei: {
    tubes: 8,
    canMelee: false,
    combatReload: false,
    shotsPerTurn: 1,
    usesZichong: false,
  },
  niaochong: {
    tubes: 1,
    canMelee: false,
    combatReload: true,
    shotsPerTurn: 1,
    usesZichong: false,
  },
  chedian: {
    tubes: 0,
    canMelee: false,
    combatReload: false,
    shotsPerTurn: 2,
    usesZichong: true,
  },
  pentong: {
    tubes: 1,
    canMelee: false,
    combatReload: false,
    shotsPerTurn: 1,
    usesZichong: false,
    consumable: true,
  },
  kuaqiang: {
    tubes: 1,
    canMelee: false,
    canSlash: true,
    combatReload: false,
    shotsPerTurn: 1,
    usesZichong: false,
  },
};

function firearmSpec(id) {
  return FIREARM_SPEC[id] || null;
}

function isFirearm(id) {
  return !!firearmSpec(id);
}

function isStackable(id) {
  const it = itemDef(id);
  return !!(it && it.stackMax);
}

function stackMaxOf(id) {
  const it = itemDef(id);
  return (it && it.stackMax) || 1;
}

function pieceQty(p) {
  if (!p) return 0;
  if (!isStackable(p.id)) return 1;
  return Math.max(1, p.qty | 0 || 1);
}

/** 格子上的棋子（忽略 ignoreUid） */
function pieceAtCell(state, zone, x, y, ignoreUid) {
  const list = piecesOf(state, zone);
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (ignoreUid && p.uid === ignoreUid) continue;
    const cells = itemShape(p.id, p.rot | 0);
    for (let j = 0; j < cells.length; j++) {
      if (p.x + cells[j][0] === x && p.y + cells[j][1] === y) return p;
    }
  }
  return null;
}

function canStackMerge(fromPiece, intoPiece) {
  if (!fromPiece || !intoPiece || fromPiece.uid === intoPiece.uid) return false;
  if (fromPiece.id !== intoPiece.id) return false;
  if (!isStackable(fromPiece.id)) return false;
  if ((fromPiece.fillStep | 0) > 0 || (intoPiece.fillStep | 0) > 0) return false;
  return pieceQty(intoPiece) < stackMaxOf(intoPiece.id);
}

/** 把 from 叠进 into；若 from 耗尽则从区里移除。返回是否完全合并 */
function mergePieceInto(state, zone, fromPiece, intoPiece) {
  if (!canStackMerge(fromPiece, intoPiece)) return false;
  const max = stackMaxOf(intoPiece.id);
  const room = max - pieceQty(intoPiece);
  const move = Math.min(room, pieceQty(fromPiece));
  intoPiece.qty = pieceQty(intoPiece) + move;
  const left = pieceQty(fromPiece) - move;
  if (left <= 0) {
    zoneRemoveUid(state, zone, fromPiece.uid);
    return true;
  }
  fromPiece.qty = left;
  return false;
}

function bagCountId(state, id) {
  let n = 0;
  bagPieces(state).forEach((p) => {
    if (p.id === id) n += pieceQty(p);
  });
  return n;
}

function ensureGunState(state, id) {
  if (!state.gunLoad) state.gunLoad = {};
  const spec = firearmSpec(id);
  if (!spec || spec.usesZichong) return null;
  if (!state.gunLoad[id]) {
    state.gunLoad[id] = { tubes: Array(spec.tubes).fill(1), barrel: 0 };
  }
  const g = state.gunLoad[id];
  if (!Array.isArray(g.tubes) || g.tubes.length !== spec.tubes) {
    g.tubes = Array(spec.tubes).fill(1);
  }
  if (g.barrel == null) g.barrel = 0;
  return g;
}

function gunLoadedCount(state, id) {
  const spec = firearmSpec(id);
  if (!spec) return 0;
  if (spec.usesZichong) return bagCountId(state, "zichong");
  const g = ensureGunState(state, id);
  return g.tubes.reduce((a, b) => a + (b ? 1 : 0), 0);
}

function gunHasShot(state, id) {
  return gunLoadedCount(state, id) > 0;
}

function hasReloadKit(state) {
  return (
    bagCountId(state, "powder") > 0 &&
    bagCountId(state, "wad") > 0 &&
    bagCountId(state, "shot") > 0
  );
}

/** 可砸火器空膛即可倒持抡砸（战斗中不能再装的铳，绝不能因包里有药料把抡砸锁死） */
function canFirearmMelee(state, id) {
  const spec = firearmSpec(id);
  if (!spec || !spec.canMelee) return false;
  if (gunHasShot(state, id)) return false;
  return true;
}

function bagTakeId(state, id, n = 1) {
  let need = n;
  const list = bagPieces(state);
  for (let i = list.length - 1; i >= 0 && need > 0; i--) {
    const p = list[i];
    if (p.id !== id) continue;
    if (isStackable(id)) {
      const q = pieceQty(p);
      if (q <= need) {
        need -= q;
        list.splice(i, 1);
      } else {
        p.qty = q - need;
        need = 0;
      }
    } else {
      list.splice(i, 1);
      need -= 1;
    }
  }
  return need === 0;
}

function bagAddStack(state, id, n = 1) {
  if (!isStackable(id)) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = bagAddPiece(state, id);
      if (p) out.push(p);
    }
    return out;
  }
  const max = stackMaxOf(id);
  let left = n;
  bagPieces(state).forEach((p) => {
    if (p.id !== id || left <= 0) return;
    const q = pieceQty(p);
    const room = max - q;
    if (room <= 0) return;
    const add = Math.min(room, left);
    p.qty = q + add;
    left -= add;
  });
  while (left > 0) {
    const place = bagFindPlace(state, id, 0);
    if (!place) break;
    const add = Math.min(max, left);
    const piece = {
      uid: nextBagUid(),
      id,
      x: place.x,
      y: place.y,
      rot: place.rot,
      qty: add,
    };
    if (!state.bagPieces) state.bagPieces = [];
    state.bagPieces.push(piece);
    left -= add;
  }
  return left === 0;
}

function consumeReloadKit(state) {
  if (!hasReloadKit(state)) return false;
  return (
    bagTakeId(state, "powder", 1) &&
    bagTakeId(state, "wad", 1) &&
    bagTakeId(state, "shot", 1)
  );
}

function loadOneTube(state, id, tubeIdx) {
  const g = ensureGunState(state, id);
  const spec = firearmSpec(id);
  if (!g || !spec || spec.usesZichong || spec.consumable) return false;
  if (tubeIdx < 0 || tubeIdx >= g.tubes.length) return false;
  if (g.tubes[tubeIdx]) return false;
  if (!consumeReloadKit(state)) return false;
  g.tubes[tubeIdx] = 1;
  return true;
}

function loadEmptyZichong(state) {
  if (bagCountId(state, "zichong_empty") <= 0) return false;
  if (!hasReloadKit(state)) return false;
  if (!bagTakeId(state, "zichong_empty", 1)) return false;
  if (!consumeReloadKit(state)) {
    bagAddStack(state, "zichong_empty", 1);
    return false;
  }
  return bagAddStack(state, "zichong", 1);
}


function consumeFirearmShot(state, id) {
  const spec = firearmSpec(id);
  if (!spec) return false;
  if (spec.usesZichong) {
    if (!bagTakeId(state, "zichong", 1)) return false;
    if (!bagAddStack(state, "zichong_empty", 1)) {
      if (!state.lootStaging) state.lootStaging = [];
      state.lootStaging.push({
        uid: nextBagUid(),
        id: "zichong_empty",
        rot: 0,
        qty: 1,
      });
    }
    return true;
  }
  const g = ensureGunState(state, id);
  const n = g.tubes.length;
  for (let k = 0; k < n; k++) {
    const i = (g.barrel + k) % n;
    if (g.tubes[i]) {
      g.tubes[i] = 0;
      g.barrel = (i + 1) % n;
      return true;
    }
  }
  return false;
}

function firearmAttackMode(state) {
  const id = equippedId(state, "weapon");
  if (!isFirearm(id)) return "melee";
  const spec = firearmSpec(id);
  if (gunHasShot(state, id)) return "shoot";
  if (spec && spec.canSlash) return "slash";
  if (canFirearmMelee(state, id)) return "smash";
  return "empty";
}

function shootDamage(state, band) {
  /* band: 0 full, 1 mid, 2 far, -1 miss */
  if (band < 0) return 0;
  const w = weaponOf(state);
  const c = charmOf(state);
  const base = (w.dmg || 1) + (c.atkBonus || 0);
  const mult = (FIREARM.hitMult[band] || 0) * staminaDamageMultiplier(state);
  return Math.max(band === 0 ? 1 : 0, Math.round(base * mult));
}

function smashDamage(state) {
  const id = equippedId(state, "weapon");
  const spec = firearmSpec(id);
  const c = charmOf(state);
  const base = (spec && spec.smashDmg ? spec.smashDmg : 1) + (c.atkBonus || 0);
  return Math.max(1, Math.round(base * staminaDamageMultiplier(state)));
}

function weaponOfFirearmAware(state) {
  const w = weaponOf(state);
  if (!isFirearm(w.id)) return w;
  const left = gunLoadedCount(state, w.id);
  const mode = firearmAttackMode(state);
  const dmgType = mode === "smash" ? "blunt" : w.dmgType;
  return { ...w, ammo: left, mode, firearm: true, dmgType };
}

/**
 * 一次性火器（喷筒）打空了：扔掉手里这一支。叠着的还有就换上一支新的（装满），
 * 没有了就从兵器架上拿下，改拿架上别的。返回 "next" / "gone" / null（不是一次性的或还有弹）。
 */
function discardSpentConsumable(state, id) {
  const spec = firearmSpec(id);
  if (!spec || !spec.consumable || gunHasShot(state, id)) return null;
  const uid = equippedUid(state, "weapon");
  const hit = uid && findPieceAnywhere(state, uid);
  if (!hit) return null;
  delete state.gunLoad[id];
  if (pieceQty(hit.piece) > 1) {
    hit.piece.qty = pieceQty(hit.piece) - 1;
    ensureGunState(state, id);
    return "next";
  }
  bagRemoveUid(state, uid);
  return "gone";
}
