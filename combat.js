/** 战斗数据、装备结算、斩影规则 */

const COMBAT = {
  slashWindowMs: 5000,
  portraits: {
    player: "assets/portraits/player.png?v=hole1",
    g1: "assets/portraits/ghoul_warrior.png?v=ragged1",
    it1: "assets/portraits/ghoul_villager.png?v=fierce1",
    v1: "assets/portraits/ghoul_villager.png?v=fierce1",
    v2: "assets/portraits/ghoul_villager.png?v=fierce1",
    c1: "assets/portraits/jinyi_guard.png?v=g2",
    k1: "assets/portraits/gate_warden.png?v=ming1",
    s1: "assets/portraits/street_corpse.png?v=hole1",
    s2: "assets/portraits/street_corpse.png?v=hole1",
    s3: "assets/portraits/sedan_corpse.png?v=px1",
    t1: "assets/portraits/immortal_lord.png?v=hole1",
    vv1: "assets/portraits/valley_corpse.png?v=ming2",
    vv2: "assets/portraits/valley_corpse.png?v=ming2",
    tp1: "assets/portraits/taoist_priest.png?v=hole1",
    bs1: "assets/portraits/barrack_soldier.png?v=px1",
    bs2: "assets/portraits/barrack_soldier.png?v=px1",
    bs3: "assets/portraits/barrack_captain.png?v=hole1",
    cr1: "assets/portraits/cavalry_deserter.png?v=hole1",
    cr2: "assets/portraits/cavalry_deserter.png?v=hole1",
    ex1: "assets/portraits/executioner_corpse.png?v=hole1",
    pd1: "assets/portraits/plague_doctor.png?v=hole1",
    wm1: "assets/portraits/watchman_corpse.png?v=nw1",
    bk1: "assets/portraits/barrack_soldier.png?v=px1",
    bk2: "assets/portraits/barrack_soldier.png?v=px1",
    pt1: "assets/portraits/ghoul_villager.png?v=fierce1",
    sx1: "assets/portraits/street_corpse.png?v=hole1",
    mk1: "assets/portraits/taoist_priest.png?v=hole1",
    mk2: "assets/portraits/valley_corpse.png?v=ming2",
    yy1: "assets/portraits/taoist_priest.png?v=hole1",
    yy2: "assets/portraits/street_corpse.png?v=hole1",
  },
  /* 每个立绘的可击区域（归一化矩形 x,y,w,h），不声明则用全图腐蚀后的不透明区域 */
  hitRects: {
    // g1: [0.25, 0.15, 0.5, 0.6],
  },
  /* 半即时战斗：敌人各自蓄力，满了先亮格挡圈再扑 */
  realtime: {
    windupMs: 1150, /* 格挡圈从出现到落下 */
    perfectMs: 300, /* 圈缩到核心的最后这段算完美格挡 */
    bagScale: 0.5, /* 翻行囊时时间流速 */
    staminaRegen: 4, /* 战斗中每秒回体 */
    counterMs: 4000, /* 完美格挡后反击良机持续 */
    sideRate: 0.7, /* 没被你盯着的敌人蓄力慢一些 */
    afterStrikeCap: 0.6, /* 一个扑完，其余的蓄力最多留到六成，免得连环挨咬 */
  },
  /* 敌人意图：time 蓄满秒数，mult 伤害倍率；heavy 的被打中会退得更多（打断） */
  intents: {
    bite: { name: "扑咬", act: "扑上来就咬", time: 4.6, mult: 1, weight: 5 },
    claw: { name: "撕扯", act: "一爪撕来", time: 3.2, mult: 0.6, weight: 3 },
    heavy: { name: "蓄力", act: "攒足了劲猛扑过来", time: 6.6, mult: 1.8, weight: 2, heavy: true },
    howl: { name: "嘶吼", act: "仰头长嚎", time: 5.6, mult: 0, weight: 1, heavy: true },
  },
  /* 划刀：一笔的墨量（相对立绘短边）、时限 */
  melee: { inkPerSpot: 0.9, inkBase: 0.45, baseWindowMs: 1800, perSpotMs: 900, grazeRate: 0.2 },
  templates: {
    /* 开局教学战：只扑咬、血少、打不死你，带分步提示（combat-ui.js tut*） */
    intro_ghoul: {
      title: "雪店门口",
      intro: "你刚要推门，门里扑出一个店伙计打扮的，脖子上缺了一块肉，冲着你张开了嘴。来不及摘鸟铳，你拔出了短刀。",
      hue: 30,
      enemies: [{ id: "it1", name: "变异村民", hp: 48, atk: 10, weights: { bite: 1, claw: 0, heavy: 0, howl: 0 } }],
      fleeChance: 0,
      tutorial: true,
    },
    road_ghoul: {
      title: "官道上",
      intro: "雪窝里爬出一个穿破甲的，胸前补子上还认得出「勇」字，冲着你咧开嘴，满口牙都发了青。",
      hue: 120,
      enemies: [{ id: "g1", name: "变异勇士", hp: 55, atk: 18 }],
      fleeChance: 0.5,
    },
    village_pack: {
      title: "村里",
      intro: "柴门后头挤出两个来，下巴都掉了，还一个劲地嚼，嘴里含含糊糊喊着要吃。",
      hue: 40,
      enemies: [
        { id: "v1", name: "变异村民", hp: 45, atk: 18 },
        { id: "v2", name: "变异村民", hp: 55, atk: 18 },
      ],
      fleeChance: 0.4,
    },
    canal_guard: {
      title: "纤道上",
      intro: "一身锦衣破得在风里乱飘，腰牌撞着骨头叮当作响。这人当初奉旨去寻药，如今一口牙倒比谁都尖。",
      hue: 200,
      enemies: [{ id: "c1", name: "锦衣行尸", hp: 90, atk: 25 }],
      fleeChance: 0.35,
      onWinFlags: ["jade_hint", "canal_guard_slain"],
      props: [{ id: "badge", name: "唤腰牌", desc: "它愣在原地", effect: "stun", sec: 4 }],
    },
    gate_chain: {
      title: "城门",
      intro: "铁链猛地绷直，门轴上拴着的守兵被你惊动，整个人扑将过来，链子在石上拖出一溜火星。",
      hue: 0,
      enemies: [{ id: "k1", name: "城门尸卫", hp: 120, atk: 30 }],
      fleeChance: 0.25,
      onWinFlags: ["gate_open"],
      props: [{ id: "chain", name: "扯铁链", desc: "把它拽个趔趄", effect: "stun", sec: 4 }],
    },
    street_horde: {
      title: "长街",
      intro: "鼓楼上铜铃乱响，满街行尸朝你涌了过来，须得先砍近处的，免得叫它们围死。",
      hue: 280,
      enemies: [
        { id: "s1", name: "街尸", hp: 70, atk: 25 },
        { id: "s2", name: "街尸", hp: 70, atk: 25 },
        { id: "s3", name: "轿中尸", hp: 90, atk: 28 },
      ],
      fleeChance: 0.45,
      props: [{ id: "bell", name: "摇铜铃", desc: "满街行尸慢下来", effect: "slow", sec: 6 }],
    },
    throne_bite: {
      title: "丹陛前",
      intro: "「长生」两个字还没说完，龙椅上那人影已到了台阶口，扑面一股腥臭的牙口气。",
      hue: 350,
      enemies: [{ id: "t1", name: "长生祸首", hp: 260, atk: 45 }],
      fleeChance: 0.2,
      boss: true,
    },
    valley_pack: {
      title: "药谷",
      intro: "岩缝里爬出两具行尸，浑身裹着谷中寒气，像是被药气养着，怎么也不肯倒。",
      hue: 180,
      enemies: [
        { id: "vv1", name: "谷中行尸", hp: 100, atk: 35 },
        { id: "vv2", name: "谷中行尸", hp: 120, atk: 38 },
      ],
      fleeChance: 0.35,
      onWinFlags: ["valley_cleared"],
    },
    temple_priest: {
      title: "废弃道观",
      intro: "偏殿里那穿道袍的转过身来，半边脸还像个人，另半边却露出牙床，手里攥着一张早已发黑的符。",
      hue: 160,
      enemies: [{ id: "tp1", name: "道士行尸", hp: 90, atk: 25 }],
      fleeChance: 0.3,
      onWinFlags: ["temple_cleared"],
      props: [{ id: "fire", name: "扬炉灰", desc: "迷了它的眼", effect: "stun", sec: 4 }],
    },
    barbican_soldiers: {
      title: "瓮城",
      intro: "墙根下三具溃兵行尸见了活人便站起身来，其中一个胸口还插着一支箭。",
      hue: 30,
      enemies: [
        { id: "bs1", name: "溃兵行尸", hp: 75, atk: 26 },
        { id: "bs2", name: "溃兵行尸", hp: 75, atk: 26 },
        { id: "bs3", name: "溃兵头目", hp: 110, atk: 32 },
      ],
      fleeChance: 0.35,
      onWinFlags: ["barbican_cleared"],
      props: [{ id: "shout", name: "喝军令", desc: "溃兵一时发怔", effect: "slow", sec: 6 }],
    },
    /* ---- 新地点 ----
       敌人可带：speed 蓄力快慢倍率；weights 改招式比重；howls 每场叫几回人；summon 叫来的是谁；poison 咬中涨渴染 */
    lugou_riders: {
      title: "卢沟桥",
      intro: "桥那头马蹄乱响，两个溃兵骑在死马背上冲了过来。马早断了气，人也不是活人，冲势却一点不减。",
      hue: 210,
      enemies: [
        { id: "cr1", name: "溃兵骑手", hp: 60, atk: 22, speed: 1.5, weights: { heavy: 0, howl: 0 } },
        { id: "cr2", name: "溃兵骑手", hp: 55, atk: 22, speed: 1.5, weights: { heavy: 0, howl: 0 } },
      ],
      fleeChance: 0.25,
      onWinFlags: ["lugou_cleared"],
      props: [{ id: "cart", name: "推翻大车", desc: "挡住冲势", effect: "slow", sec: 6 }],
    },
    barracks_guard: {
      title: "营盘",
      intro: "营房里拥出两个披甲的兵，后头还跟着一个骑手，手里一杆镋钯，见了你便催着死马冲来。",
      hue: 30,
      enemies: [
        { id: "bk1", name: "溃兵行尸", hp: 55, atk: 20 },
        { id: "bk2", name: "溃兵行尸", hp: 55, atk: 20 },
        { id: "cr1", name: "溃兵骑手", hp: 70, atk: 25, speed: 1.5, weights: { heavy: 0, howl: 0 } },
      ],
      fleeChance: 0.35,
      onWinFlags: ["barracks_cleared"],
      props: [{ id: "rack", name: "掀兵器架", desc: "砸它一个趔趄", effect: "stun", sec: 4 }],
    },
    caishikou_exec: {
      title: "菜市口",
      intro: "刑台上那个光膀子的大汉转过身来，肩上扛着一柄开山大斧，一步一步走下台阶，斧刃在雪上拖出一道沟。",
      hue: 0,
      enemies: [
        { id: "ex1", name: "刽子手行尸", hp: 160, atk: 40, speed: 0.75, weights: { heavy: 5, bite: 2, claw: 0, howl: 0 } },
        { id: "sx1", name: "街尸", hp: 70, atk: 25 },
      ],
      fleeChance: 0.4,
      onWinFlags: ["caishikou_cleared"],
      props: [{ id: "lime", name: "扬石灰", desc: "迷了它的眼", effect: "stun", sec: 4 }],
    },
    yaoju_doctor: {
      title: "惠民药局",
      intro: "里屋的帘子一掀，一个背药箱的郎中扶着门框走了出来，满脸脓疮，咳一声便喷出一口黑沫，身后还跟着个病人。",
      hue: 90,
      enemies: [
        { id: "pd1", name: "患疫郎中", hp: 100, atk: 28, poison: 4 },
        { id: "pt1", name: "变异村民", hp: 70, atk: 25 },
      ],
      fleeChance: 0.45,
      onWinFlags: ["yaoju_cleared"],
      props: [{ id: "brew", name: "泼药汤", desc: "烫得它们直往后缩", effect: "slow", sec: 6 }],
    },
    gulou_watch: {
      title: "鼓楼",
      intro: "楼梯口站着一个打更的，一手提锣一手握槌，见了你歪着脖子咧嘴一笑，抡槌便敲。",
      hue: 250,
      enemies: [
        {
          id: "wm1", name: "更夫行尸", hp: 90, atk: 25, howls: 3,
          weights: { howl: 4, heavy: 1 },
          summon: { id: "s1", name: "街尸", hp: 60, atk: 25 },
          callLine: "更夫行尸哐哐敲起铜锣，长街上又有一具{0}循着锣声扑来。",
        },
      ],
      fleeChance: 0.4,
      onWinFlags: ["gulou_cleared"],
      props: [{ id: "drum", name: "擂大鼓", desc: "鼓声盖过锣声", effect: "stun", sec: 4 }],
    },
    xishan_monks: {
      title: "西山古寺",
      intro: "殿后转出两个来，一个穿道袍，一个披着采药人的蓑衣，都是从药谷那边下来的。",
      hue: 160,
      enemies: [
        { id: "mk1", name: "道士行尸", hp: 130, atk: 38 },
        { id: "mk2", name: "谷中行尸", hp: 110, atk: 35 },
      ],
      fleeChance: 0.4,
      onWinFlags: ["xishan_cleared"],
      props: [{ id: "lamp", name: "掷油灯", desc: "火光逼退它们", effect: "slow", sec: 6 }],
    },
    yyf_guard: {
      title: "御药房",
      intro: "丹炉后头爬起一个炼丹的道士，嘴里含着一片金箔，门外又晃进来一个，衣裳是内廷的样式。",
      hue: 45,
      enemies: [
        { id: "yy1", name: "道士行尸", hp: 140, atk: 40 },
        { id: "yy2", name: "街尸", hp: 110, atk: 35 },
      ],
      fleeChance: 0.3,
      onWinFlags: ["yyf_cleared"],
      props: [{ id: "ash", name: "扬炉灰", desc: "迷了它们的眼", effect: "stun", sec: 4 }],
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

/** 甲胄栏是两个「位」：x=0 头盔、x=1 身甲，各放一件 */
function isSlotZone(zone) {
  return zone === "armor";
}

/** 头盔还是身甲 */
function armorPart(id) {
  const it = itemDef(id);
  return it && it.part === "head" ? 0 : 1;
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
  if (isSlotZone(zone)) {
    if (!zoneAllowsItem(zone, id) || x < 0 || x >= W || (x | 0) !== x || armorPart(id) !== x) return false;
    return !piecesOf(state, zone).some((p) => p.uid !== ignoreUid && p.x === x);
  }
  return gridCanPlace(piecesOf(state, zone), W, H, id, x, y, rot, ignoreUid);
}

function zoneFindPlace(state, zone, id, rot = 0) {
  const { w: W, h: H } = zoneSize(zone);
  if (isSlotZone(zone)) {
    for (let x = 0; x < W; x++) if (zoneCanPlace(state, zone, id, x, 0, 0)) return { x, y: 0, rot: 0 };
    return null;
  }
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
  if (!state.evidence) state.evidence = [];
  zones.forEach((zone) => {
    let list = piecesOf(state, zone).slice();
    ensurePiecesArr(state, zone).length = 0;
    /* 位区：原来持有/穿戴的排最前，其余按原位置 */
    if (isSlotZone(zone)) {
      const held = state.equipped && state.equipped.armorUid;
      list.sort((a, b) => (b.uid === held) - (a.uid === held) || a.x - b.x || a.y - b.y);
    }
    list.forEach((p) => {
      if (isKeyItem(p.id)) {
        if (!state.evidence.includes(p.id)) state.evidence.push(p.id);
        return;
      }
      if (!zoneAllowsItem(zone, p.id)) {
        misplaced.push(p);
        return;
      }
      if (isSlotZone(zone)) {
        const place = zoneFindPlace(state, zone, p.id);
        if (place) ensurePiecesArr(state, zone).push({ ...p, x: place.x, y: 0, rot: 0 });
        else misplaced.push(p);
        return;
      }
      if (zoneCanPlace(state, zone, p.id, p.x, p.y, p.rot | 0)) {
        ensurePiecesArr(state, zone).push(p);
        return;
      }
      const place = zoneFindPlace(state, zone, p.id, p.rot | 0);
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
  /* 手中那把不在兵器架上了：改拿架上第一把 */
  if (state.equipped && !weaponPieces(state).some((p) => p.uid === state.equipped.weaponUid)) {
    const w = weaponPieces(state)[0];
    state.equipped.weaponUid = w ? w.uid : null;
  }
  state.overflow = [];
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
    /* 哪儿都放不下：交给 game.js 留在当地 */
    state.overflow.push({ id: p.id, qty: p.qty });
  });
  return state;
}

function bagSanitize(state) {
  return sanitizeAllGrids(state);
}

/** 剧情物品（密旨、玉片、札记…）进证物袋，不占格、不计重 */
function isKeyItem(id) {
  const it = itemDef(id);
  return !!(it && it.slot === "key");
}

/** 持有 = 兵器架上拿在手里的那把；穿戴 = 身甲位上的甲（头盔另算，见 armorOf） */
function equippedUid(state, slot) {
  if (slot === "weapon") {
    const uid = state.equipped && state.equipped.weaponUid;
    return uid && weaponPieces(state).some((p) => p.uid === uid) ? uid : null;
  }
  if (slot === "armor") {
    const p = armorPieces(state).find((x) => x.x === 1) || armorPieces(state)[0];
    return p ? p.uid : null;
  }
  return null;
}

function equippedId(state, slot) {
  if (slot === "weapon" || slot === "armor") {
    const uid = equippedUid(state, slot);
    const hit = uid ? findPieceAnywhere(state, uid) : null;
    return hit ? hit.piece.id : null;
  }
  return (state.equipped && state.equipped.charm) || null;
}

/** 把一件放进位里；位上原来的那件换到它原处（行囊放得下才换） */
function moveIntoSlot(state, zone, uid, slotX) {
  const hit = findPieceAnywhere(state, uid);
  if (!hit || !zoneAllowsItem(zone, hit.piece.id)) return false;
  const piece = hit.piece;
  const occupant = piecesOf(state, zone).find((p) => p.x === slotX && p.uid !== uid);
  if (hit.zone === zone) {
    return piece.x === slotX;
  }
  if (occupant) {
    /* 位上那件退回行囊：先试被换下那件的原位，再找空处 */
    const spot = zoneCanPlace(state, hit.zone, occupant.id, piece.x, piece.y, occupant.rot | 0, piece.uid)
      ? { x: piece.x, y: piece.y, rot: occupant.rot | 0 }
      : (() => {
        zoneRemoveUid(state, hit.zone, piece.uid);
        const f = zoneFindPlace(state, hit.zone, occupant.id, occupant.rot | 0);
        ensurePiecesArr(state, hit.zone).push(piece);
        return f;
      })();
    if (!spot) return false;
    zoneRemoveUid(state, zone, occupant.uid);
    zoneRemoveUid(state, hit.zone, piece.uid);
    ensurePiecesArr(state, hit.zone).push({ ...occupant, x: spot.x, y: spot.y, rot: spot.rot });
  } else {
    zoneRemoveUid(state, hit.zone, piece.uid);
  }
  ensurePiecesArr(state, zone).push({ ...piece, x: slotX, y: 0, rot: 0 });
  return true;
}

/** 只能拿兵器架上的；行囊里的要先拖上架 */
function setHeldWeapon(state, uid) {
  const hit = findPieceAnywhere(state, uid);
  if (!hit || hit.zone !== "weapon") return false;
  if (!state.equipped) state.equipped = {};
  state.equipped.weaponUid = uid;
  if (typeof ensureGunState === "function" && isFirearm && isFirearm(hit.piece.id)) ensureGunState(state, hit.piece.id);
  return true;
}

function setHeldArmor(state, uid) {
  const hit = findPieceAnywhere(state, uid);
  if (!hit || itemHomeZone(hit.piece.id) !== "armor") return false;
  return moveIntoSlot(state, "armor", uid, armorPart(hit.piece.id));
}

/** 战斗中能换的只有兵器架上的 */
function allWeaponPieces(state) {
  return weaponPieces(state).slice().sort((a, b) => a.y - b.y || a.x - b.x);
}

/* ---------- 负重 ---------- */
function itemWeight(id) {
  const it = itemDef(id);
  if (!it || it.slot === "key") return 0;
  if (it.wt != null) return it.wt;
  const cells = itemShape(id, 0).length;
  if (it.slot === "weapon") return Math.round((cells * 1.2 + (typeof isFirearm === "function" && isFirearm(id) ? 1.5 : 0) + (it.autoGuard ? 1 : 0)) * 10) / 10;
  if (it.slot === "armor") return Math.round((1 + (it.def || 0) * 0.3) * 10) / 10;
  if (it.slot === "ammo") return id === "zichong" || id === "zichong_empty" ? 0.4 : 0.1;
  if (it.slot === "charm") return 0.1;
  return 0.5;
}

function carryLoad(state) {
  let w = 0;
  ["bag", "weapon", "armor"].forEach((z) => piecesOf(state, z).forEach((p) => {
    w += itemWeight(p.id) * (typeof pieceQty === "function" ? pieceQty(p) : p.qty || 1);
  }));
  return Math.round(w * 10) / 10;
}

/** light 轻装 / normal 常重 / heavy 沉重 */
function loadTier(state) {
  const w = carryLoad(state);
  if (w > WORLD.carryCap) return "heavy";
  if (w <= WORLD.carryCap * WORLD.lightRatio) return "light";
  return "normal";
}

function weaponOf(state) {
  const id = equippedId(state, "weapon");
  const it = id ? itemDef(id) : null;
  if (it) {
    return {
      id,
      name: it.name,
      dmg: it.dmg || 1,
      dmgType: it.dmgType || "slash",
      combo: it.combo == null ? 0 : it.combo | 0,
      stamina: it.stamina || 0,
      guardStaminaBase: it.guardStaminaBase || 10,
      parryDef: it.parryDef == null ? 10 : it.parryDef,
      autoGuard: !!it.autoGuard,
      meleeStamina: it.meleeStamina || 0,
    };
  }
  return { id: null, name: "徒手", dmg: 17, dmgType: "blunt", combo: 0, stamina: 5, guardStaminaBase: 10, parryDef: 10, autoGuard: false, meleeStamina: 0 };
}

/** 头盔和身甲都算：减伤、体力惩罚相加 */
function armorOf(state) {
  const worn = armorPieces(state).slice().sort((a, b) => a.x - b.x).map((p) => itemDef(p.id)).filter(Boolean);
  if (!worn.length) return { id: null, name: "无", def: 0, staminaPenalty: 0 };
  return {
    id: equippedId(state, "armor"),
    name: worn.map((it) => it.name).join("、"),
    def: worn.reduce((n, it) => n + (it.def || 0), 0),
    staminaPenalty: worn.reduce((n, it) => n + (it.staminaPenalty || 0), 0),
  };
}

/** 体力上限 = 基础 + 护甲惩罚 */
function maxStaminaOf(state) {
  const armor = armorOf(state);
  return Math.max(1, WORLD.maxStamina + (armor.staminaPenalty || 0));
}

/** 体力对伤害的倍率：>20% 为 1.0；20%→5% 线性降到 0.4；<5% 固定 0.4 */
function staminaDamageMultiplier(state) {
  const max = maxStaminaOf(state);
  if (max <= 0) return 1;
  const r = state.stamina / max;
  if (r > 0.2) return 1;
  if (r < 0.05) return 0.4;
  const t = (r - 0.05) / 0.15; /* 0..1 */
  return 0.4 + t * 0.6;
}

/**
 * 格挡：只有主动格挡才卸力。寻常兵器三到四成半，招架好的（parryDef 高）多一点，
 * 带盾的五成；火器只能拿铳身硬挡。完美格挡再多卸三成，最多八成，总要挨上一点。
 */
function blockRate(w, active) {
  if (!active) return 0;
  if (w.autoGuard) return 0.5;
  if (typeof firearmSpec === "function" && w.id && firearmSpec(w.id)) return 0.25;
  return Math.max(0.3, Math.min(0.45, 0.35 + ((w.parryDef || 10) - 10) * 0.02));
}

function perfectBlockRate(w) {
  return Math.min(0.8, blockRate(w, true) + 0.3);
}

/** 护甲按比例减伤：头盔、身甲的防加起来，越堆越不划算，最多四成；符箓、铁皮再各添一点，总共不过六成 */
function damageTakenRate(state) {
  const def = armorOf(state).def || 0;
  let cut = Math.min(0.4, def / (def + 40));
  if (charmOf(state).defBonus) cut += 0.1;
  if (state.powers && state.powers.has && state.powers.has("iron_skin")) cut += 0.15;
  return 1 - Math.min(0.6, cut);
}

function blockCost(w, atk) {
  return Math.round((w.guardStaminaBase || 10) + atk * 0.1);
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
  const typeLabel = { slash: "斩", blunt: "砸", pierce: "刺" }[w.dmgType] || "斩";
  if (w.firearm) {
    const mode =
      w.mode === "shoot" ? "可射" : w.mode === "slash" ? "可刺" : w.mode === "smash" ? "可砸" : "空膛";
    lines.push(`兵器  ${w.name}（${typeLabel} · 伤 ${w.dmg} · 弹 ${w.ammo|0} · ${mode}）`);
  } else {
    lines.push(`兵器  ${w.name}（${typeLabel} · 每${typeLabel} ${slashHitDamage(state)} · ${typeLabel}影 ${w.combo + 1} · 耗体 ${w.stamina}）`);
  }
  if (armorPieces(state).length) {
    const a = armorOf(state);
    lines.push([`护甲  ${a.name}`, a.def ? `减伤 ${a.def}` : "", a.staminaPenalty ? `体力 ${a.staminaPenalty}` : ""].filter(Boolean).join(" · "));
  }
  if (equippedId(state, "charm")) {
    const c = charmOf(state);
    lines.push(
      [`符箓  ${c.name}`, c.atkBonus || c.defBonus ? `攻+${c.atkBonus}/防+${c.defBonus}` : ""].filter(Boolean).join(" · "),
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



function bagFindPlace(state, id, rot = 0) {
  return zoneFindPlace(state, "bag", id, rot);
}

function bagCount(state) {
  return bagPieces(state).reduce((n, p) => n + itemShape(p.id, p.rot).length, 0);
}

function bagCellCapacity() {
  return WORLD.bagW * WORLD.bagH;
}


function bagHas(state, id) {
  if ((state.evidence || []).includes(id)) return true;
  if (bagPieces(state).some((p) => p.id === id)) return true;
  if (weaponPieces(state).some((p) => p.id === id)) return true;
  if (armorPieces(state).some((p) => p.id === id)) return true;
  if (equippedId(state, "charm") === id) return true;
  return false;
}

function bagAddPiece(state, id, place) {
  if (isKeyItem(id)) {
    if (!state.evidence) state.evidence = [];
    if (!state.evidence.includes(id)) state.evidence.push(id);
    return { uid: null, id };
  }
  const home = itemHomeZone(id);
  if ((home === "weapon" || home === "armor") && zoneFindPlace(state, home, id)) {
    const piece = zoneAddPiece(state, home, id);
    if (piece && home === "weapon" && !equippedUid(state, "weapon")) setHeldWeapon(state, piece.uid);
    return piece;
  }
  return zoneAddPiece(state, "bag", id, place);
}

function bagRemoveUid(state, uid) {
  const found = findPieceAnywhere(state, uid);
  if (!found) return null;
  const removed = zoneRemoveUid(state, found.zone, uid);
  if (removed && found.zone === "weapon" && state.equipped && state.equipped.weaponUid === uid) {
    const next = weaponPieces(state)[0];
    state.equipped.weaponUid = next ? next.uid : null;
  }
  return removed;
}

function bagRemoveOneId(state, id) {
  const found = findPieceByIdAnywhere(state, id);
  if (!found) return null;
  return bagRemoveUid(state, found.piece.uid);
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
  /* 上一版兵器是「手中/背上」两个位：x=0 是手中那把 */
  if (!state.equipped.weaponUid) {
    const w = weaponPieces(state).find((p) => p.x === 0 && p.y === 0) || weaponPieces(state)[0];
    if (w) state.equipped.weaponUid = w.uid;
  }
  sanitizeAllGrids(state);
  delete state.equipped.armorUid;
  return state;
}

function slashComboOf(state) {
  /* combo 0 → 只斩 1 次；更高 combo 增加需连点段数 */
  return Math.max(1, (weaponOf(state).combo | 0) + 1);
}


/** 斩影每击伤害 = 武器面板 + 符箓加成（受体力影响） */
/* ---------- 渴染：双刃剑。平 / 躁 / 狂 三档 ---------- */
const CORR_TIERS = [
  { name: "平", dmg: 1, killHeal: 0, food: 1, hunger: 1 },
  { name: "躁", dmg: 1.1, killHeal: 5, food: 0.7, hunger: 1.2 },
  { name: "狂", dmg: 1.25, killHeal: 10, food: 0.4, hunger: 1.5 },
];
function corrTier(state) {
  const c = (state && state.corruption) || 0;
  return c >= 67 ? 2 : c >= 33 ? 1 : 0;
}
const corrFx = (state) => CORR_TIERS[corrTier(state)];

/* ---------- 兵器相克：斩克肉身，砸克披甲，刺克疾行，火器破甲 ---------- */
const ENEMY_KIND = {
  变异勇士: "flesh", 变异村民: "flesh", 街尸: "flesh", 轿中尸: "flesh", 谷中行尸: "flesh",
  道士行尸: "flesh", 患疫郎中: "flesh", 更夫行尸: "flesh", 刽子手行尸: "flesh",
  锦衣行尸: "armor", 城门尸卫: "armor", 溃兵行尸: "armor", 溃兵头目: "armor", 长生祸首: "armor",
  溃兵骑手: "swift",
};
const KIND_INFO = {
  flesh: { name: "肉身", weak: "怕斩" },
  armor: { name: "披甲", weak: "怕砸、火器" },
  swift: { name: "疾行", weak: "怕刺" },
};
const MATCHUP = {
  slash: { flesh: 1.25, armor: 0.6, swift: 1 },
  blunt: { flesh: 0.9, armor: 1.3, swift: 1 },
  pierce: { flesh: 1, armor: 0.9, swift: 1.4 },
  fire: { flesh: 1, armor: 1.2, swift: 1 },
};
const enemyKind = (e) => (e && (e.kind || ENEMY_KIND[e.name])) || "flesh";
function matchupMult(dmgType, e) {
  const row = MATCHUP[dmgType] || MATCHUP.slash;
  return row[enemyKind(e)] || 1;
}
/** 对这个敌人实际打出的倍率：相克 × 渴染 */
function hitMultVs(state, dmgType, e) {
  return matchupMult(dmgType, e) * corrFx(state).dmg;
}

function slashHitDamage(state) {
  const w = weaponOf(state);
  const c = charmOf(state);
  const base = Math.max(1, (w.dmg || 1) + (c.atkBonus || 0));
  return Math.max(1, Math.round(base * staminaDamageMultiplier(state)));
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
    enemies: t.enemies.map((e) => ({ ...e, maxHp: e.hp })),
    fleeChance: t.fleeChance,
    onWinFlags: t.onWinFlags || [],
    boss: !!t.boss,
    tutorial: !!t.tutorial,
    props: t.props || [],
    propsUsed: [],
    howled: false,
    counter: false,
    fleeBoost: 0,
  };
}

function alive(c) {
  return c.enemies.filter((e) => e.hp > 0);
}

function bars(hp, max) {
  const scale = 25;
  const full = Math.max(1, Math.round((hp / max) * scale));
  let s = "";
  for (let i = 0; i < scale; i++) s += i < full ? "█" : "░";
  return s;
}
