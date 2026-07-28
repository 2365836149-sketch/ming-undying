/** 世界与异能 —— 明清白话叙述；含地图坐标与昼夜 */

const WORLD = {
  saveKey: "ming-undying-v3",
  startLoc: "road_inn",
  maxHp: 6,
  maxEssence: 12,
  bagW: 5,
  bagH: 4,
  bagSlots: 20, /* 兼容旧提示：格容量上界 */
  weaponRack: { w: 2, h: 4 },
  armorRack: { w: 2, h: 4 },
  mapView: { w: 220, h: 300 },

  powers: {
    night_eye: {
      id: "night_eye",
      name: "鬼瞳",
      cost: 2,
      desc: "暗处也能看清，搜查时可多得一件。",
    },
    iron_skin: {
      id: "iron_skin",
      name: "金鳞",
      cost: 3,
      desc: "皮肉更硬，挨打少受一点伤。",
    },
    blood_step: {
      id: "blood_step",
      name: "血步",
      cost: 3,
      desc: "可蓄势一击，下一刀更重。",
    },
    soul_drain: {
      id: "soul_drain",
      name: "吸魂",
      cost: 4,
      desc: "砍倒一个，能从身上夺回一点力气。",
    },
    decree_fear: {
      id: "decree_fear",
      name: "敕令余威",
      cost: 5,
      desc: "一交手，弱敌会愣上一轮。",
    },
  },

  items: {
    knife: {
      name: "短刀",
      slot: "weapon",
      dmg: 1,
      combo: 0,
      shape: [[0, 0], [0, 1]],
      icon: "assets/items/knife.png",
      desc: "寻常短刀，勉强能用。",
    },
    blade: {
      name: "绣春刀",
      slot: "weapon",
      dmg: 2,
      combo: 1,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/xiuchun.png",
      desc: "锦衣旧物，刃口冰凉，砍行尸更利。",
    },
    palace_blade: {
      name: "御前残刃",
      slot: "weapon",
      dmg: 3,
      combo: 2,
      shape: [[0, 0], [0, 1], [0, 2], [1, 2]],
      icon: "assets/items/palace_blade.png",
      desc: "宫门内拣到的断刃，仍有余锋。",
    },
    sanyan: {
      name: "三眼铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 3,
      combo: 0,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/sanyan.png",
      desc: "三管品字长柄。放完只能换刀，或倒持当锤砸。",
    },
    siyan: {
      name: "四眼铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 3,
      combo: 0,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/siyan.png",
      desc: "四管并列。弹尽可砸，有药料时不可偷懒砸。",
    },
    niaochong: {
      name: "鸟铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 4,
      combo: 0,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/niaochong.png",
      desc: "一发一装。战斗里可花一回合再装填，或换兵器。",
    },
    xunlei: {
      name: "迅雷铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 2,
      combo: 0,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
      icon: "assets/items/xunlei.png",
      desc: "多管轮转。打空只能换武器，战斗中不能再装。",
    },
    chedian: {
      name: "掣电铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 3,
      combo: 0,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/chedian.png",
      desc: "换子铳开火。一回合最多两发，空壳退回行囊。",
    },
    powder: {
      name: "火药",
      slot: "ammo",
      stackMax: 16,
      shape: [[0, 0]],
      icon: "assets/items/powder.png",
      desc: "装铳用。与垫片、弹丸配成一发。",
    },
    wad: {
      name: "垫片",
      slot: "ammo",
      stackMax: 16,
      shape: [[0, 0]],
      icon: "assets/items/wad.png",
      desc: "隔火药与弹丸的毡纸垫。",
    },
    shot: {
      name: "弹丸",
      slot: "ammo",
      stackMax: 16,
      shape: [[0, 0]],
      icon: "assets/items/shot.png",
      desc: "铅丸。一发一颗。",
    },
    zichong: {
      name: "填装子铳",
      slot: "ammo",
      stackMax: 5,
      shape: [[0, 0]],
      icon: "assets/items/zichong.png",
      desc: "掣电铳用的现成子铳，打出后退空壳。",
    },
    zichong_empty: {
      name: "空子铳",
      slot: "ammo",
      stackMax: 5,
      shape: [[0, 0]],
      icon: "assets/items/zichong_empty.png",
      desc: "空壳。可再填火药、垫片、弹丸。",
    },
    armor_light: {
      name: "棉甲残片",
      slot: "armor",
      def: 1,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/cotton_scrap.png",
      desc: "驿卒留下的薄甲，能挡一下撕扯。",
    },
    armor_scale: {
      name: "锦衣残甲",
      slot: "armor",
      def: 2,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/jinyi_armor.png",
      desc: "城门守军身上剥下的甲叶，沉重，却管用。",
    },
    talisman: {
      name: "镇尸符",
      slot: "charm",
      atkBonus: 1,
      defBonus: 1,
      shape: [[0, 0]],
      icon: "assets/items/zhenshi_fu.png",
      desc: "黄纸画的符。对行尸：出手多一点伤，挨咬少一点伤。",
    },
    ration: {
      name: "干粮",
      slot: "consumable",
      shape: [[0, 0]],
      icon: "assets/items/ration.png",
      desc: "硬，能充饥。",
    },
    antidote: {
      name: "解毒散",
      slot: "consumable",
      shape: [[0, 0]],
      icon: "assets/items/antidote_soup.png",
      desc: "大夫留下的。能把渴染压低两点，路上就这一份。",
    },
    jade_chip: {
      name: "玉瓶残片",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/jade_chip.png",
      desc: "跟谷里那瓶子一样凉，能当证据。",
    },
    edict: {
      name: "密旨抄件",
      slot: "key",
      noDrop: true,
      shape: [[0, 0], [1, 0]],
      icon: "assets/items/edict.png",
      desc: "着寻长生之药，不得外泄。旁注西行极寒药谷——源头在彼。须持此件，循衙署图往。",
    },
  },

  endings: {
    truth: "结局 · 真相",
    corrupted: "结局 · 染渴",
    flee: "结局 · 退走",
    martyr: "结局 · 焚谷",
    witness: "结局 · 携证",
    overrun: "结局 · 倒下",
  },

  locs: {
    road_inn: {
      name: "官道雪店",
      short: "雪店",
      icon: "assets/map/road_inn.svg",
      x: 48,
      y: 268,
      links: [
        { to: "village", min: 3, label: "村落" },
        { to: "canal", min: 4, label: "运河纤道", risky: true },
      ],
    },
    village: {
      name: "荒村",
      short: "荒村",
      icon: "assets/map/village.svg",
      x: 118,
      y: 220,
      links: [
        { to: "road_inn", min: 3, label: "回雪店" },
        { to: "post", min: 4, label: "驿站废墟", risky: true },
        { to: "canal", min: 3, label: "运河" },
      ],
    },
    canal: {
      name: "运河纤道",
      short: "运河",
      icon: "assets/map/canal.svg",
      x: 42,
      y: 175,
      links: [
        { to: "road_inn", min: 4, label: "回雪店" },
        { to: "village", min: 3, label: "荒村" },
        { to: "gate", min: 5, label: "外城门方向", risky: true },
      ],
    },
    post: {
      name: "驿站废墟",
      short: "驿站",
      icon: "assets/map/post.svg",
      x: 175,
      y: 185,
      links: [
        { to: "village", min: 4, label: "回村" },
        { to: "gate", min: 4, label: "外城", risky: true },
      ],
    },
    gate: {
      name: "京师外城门",
      short: "城门",
      icon: "assets/map/gate.svg",
      x: 118,
      y: 130,
      links: [
        { to: "canal", min: 5, label: "退回运河" },
        { to: "inner", min: 3, label: "入城", risky: true, need: ["gate_open"] },
        { to: "post", min: 4, label: "驿站" },
      ],
    },
    inner: {
      name: "内城长街",
      short: "长街",
      icon: "assets/map/inner.svg",
      x: 118,
      y: 85,
      links: [
        { to: "gate", min: 3, label: "外城门" },
        { to: "palace", min: 4, label: "皇城方向", risky: true },
        { to: "yamen", min: 2, label: "衙署废厅" },
      ],
    },
    yamen: {
      name: "衙署废厅",
      short: "衙署",
      icon: "assets/map/yamen.svg",
      x: 48,
      y: 78,
      links: [
        { to: "inner", min: 2, label: "长街" },
        { to: "valley", min: 6, label: "循图往药谷", risky: true, need: ["valley_map"] },
      ],
    },
    valley: {
      name: "极寒药谷",
      short: "药谷",
      icon: "assets/map/valley.svg",
      x: 28,
      y: 28,
      links: [{ to: "yamen", min: 6, label: "回衙署", risky: true }],
    },
    palace: {
      name: "皇城外垣",
      short: "皇城",
      icon: "assets/map/palace.svg",
      x: 178,
      y: 55,
      links: [
        { to: "inner", min: 4, label: "退回长街" },
        { to: "throne", min: 3, label: "逼近丹陛", risky: true, need: ["palace_key"] },
      ],
    },
    throne: {
      name: "丹陛之前",
      short: "丹陛",
      icon: "assets/map/throne.svg",
      x: 195,
      y: 18,
      links: [{ to: "palace", min: 3, label: "退至外垣" }],
    },
  },
};

function clockHour(elapsed) {
  return (5 + Math.floor(elapsed / 60)) % 24;
}

function isNight(elapsed) {
  const h = clockHour(elapsed);
  return h < 6 || h >= 18;
}

function ambushChance(elapsed) {
  return isNight(elapsed) ? 0.55 : 0.35;
}

function phaseLabel(elapsed) {
  return isNight(elapsed) ? "夜" : "昼";
}

function formatWatch(elapsed) {
  const h = clockHour(elapsed);
  const m = elapsed % 60;
  return `出程 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · ${phaseLabel(elapsed)}`;
}

function needHint(need) {
  const map = {
    gate_open: "须先斩断门链",
    palace_key: "尚未取得入宫门径",
    valley_map: "须先在衙署取得药谷图（并持有密旨抄件）",
  };
  return (need || []).map((n) => map[n] || n).join("；");
}

function locText(id, s) {
  const nightEye = s.powers.has("night_eye");
  const night = isNight(s.elapsed);
  const revisit = (s.visits[id] || 0) >= 2;
  const t = {
    road_inn: () => {
      if (revisit) {
        return night
          ? "店还是冷的。夜里门框响得像有人拿牙啃。"
          : "店还是冷的。账上那行字你看得熟了。";
      }
      return [
        "雪店只剩半扇门，灶早灭了。墙上有驱瘟符，底下叫人撕掉一截。",
        "账本摊着，末一笔写：京里来的客，钱没给，人变了。",
        nightEye
          ? "灶灰底下埋着半块玉片，凉得刺手，跟传说里那药瓶一个样。"
          : night
            ? "外头夜风刮门，像有人在啃木头。"
            : "外头风雪刮门，像有人在啃木头。",
      ].join("\n\n");
    },
    village: () => {
      if (revisit) {
        if (s.flags.has("saved_child")) return "柴房里那孩子见你，又朝北边指了指。";
        if (s.flags.has("left_child")) return "哭声早没了。雪盖住脚印。";
        return "巷口红布还在晃。远处有点声响，分不清是风还是人。";
      }
      return [
        "村口石敢当歪了。巷子里挂着干透的红布，颜色发黑。",
        "有户人家门敞着，桌上饭还在，筷子插在碗里——人是跑出去的。",
        s.flags.has("saved_child")
          ? "你救下的孩子缩在柴房，指北边说：官爷往京城去了，怀里揣着瓶子。"
          : "远处隐隐有孩子哭。",
      ].join("\n\n");
    },
    canal: () => {
      const lines = [
        "河上结了薄冰。纤道脚印乱，有的只有脚尖，像撵人似的。",
        "一条货船搁了浅，舱盖从里头顶开了。",
      ];
      if (s.flags.has("jade_hint")) {
        lines.push("残卫倒下那儿，脚印一直朝北，跟回京、寻药是一条道。");
      } else if (nightEye) {
        lines.push("船舱里有锦衣碎片，腰牌还能认：寻药百户。");
      } else {
        lines.push("风里又臭又香，像宫里的味，也像坟地。");
      }
      if (night) lines.push("夜里河面更黑，纤道看着发紧。");
      if (revisit) lines.push("你又走上一回，脚印叠着脚印。");
      return lines.join("\n\n");
    },
    post: () => {
      const lines = [
        "驿站旗杆断了。马厩空着，槽里还剩点草料。",
        "公文匣叫人撬开，纸页散着：着寻长生之药，不得外泄。",
        "你心里明白了：这祸不是天降的，是旨意请来的。",
      ];
      if (s.flags.has("jade_hint")) {
        lines.push("残卫腰牌上的字，跟这儿抄件是一回事——寻药、回京，一趟差。");
      }
      if (revisit) lines.push("还是这副残局。墨香淡了些。");
      return lines.join("\n\n");
    },
    gate: () =>
      [
        "城门半开着。守兵盔甲还在，人却不成样子，铁链拴在门轴上，见活物就扑。",
        "门额「永定」俩字叫爪子挠烂了。",
        s.flags.has("gate_open")
          ? "链子断了。进城的路算是给你开了。"
          : "要进城，先得把门轴上那东西解决掉。",
        night ? "夜里门口喘息声更近。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    inner: () => {
      if (revisit) {
        return night
          ? "长街还是那条。夜里铃自己晃，没有更夫。"
          : "长街还是那条。新雪盖住一层跪印。";
      }
      return [
        "招牌还挂着，漆掉了不少。雪上跪印又齐又乱——有人临死还朝北磕头。",
        "鼓楼那边铜铃乱响，人早没了，铃倒自己晃。",
        "身上那点邪力发烫：越挨近皇城，越不安生。",
        night ? "夜里两侧黑影起落，像潮水。" : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    },
    yamen: () =>
      [
        "公案翻在地上。墙上隔离告示叫血涂花了。",
        "抽屉里有腰牌和一张草图：药谷在哪，回宫怎么走。",
        "知县不见人影，大印还盖在「封锁京师」的空文上。",
        s.flags.has("valley_map") ? "药谷图你记下了。西边极寒那儿，就是源头。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    valley: () =>
      [
        "大雪山谷。雪深过膝，岩缝里还冒着跟玉瓶一样的凉气。",
        "谷底有烧过的痕迹，像有人想放火，没烧成。",
        s.flags.has("valley_cleared")
          ? "行尸清干净了。要放火，现在行。"
          : "岩缝旁守着几具行尸，像守着一口不该打开的井。",
        night ? "夜里更冷，牙口的声音贴着石壁。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    palace: () =>
      [
        "红墙金瓦熏黑了，护城河里漂着官服。",
        "宫门铜钉冰凉。里头影影绰绰，龙椅还在，椅上坐着个不肯倒的影子。",
        s.flags.has("palace_key")
          ? "路通了。再往前，答案有，饥渴也有。"
          : "没腰牌、没碎片，硬闯就是给里头送食。",
        night ? "夜里宫墙看着像一排牙。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    throne: () =>
      [
        "台阶前烛泪堆成小山。坐着的——从前是皇上——胸口还起伏，眼白全黑了。",
        "玉瓶碎在阶下。他抬起头，喉咙里挤出俩字：长生。",
        "你一路查来的事，根子都在这儿：药、旨意、这座城，还有那止不住的馋。",
        s.flags.has("saved_child") ? "你想起村里孩子指的北边——真有瓶子，真有官爷。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
  };
  return (t[id] || (() => "大雪封路，前不着村后不着店。"))();
}
