/** 世界与异能 —— 明清白话叙述；含地图坐标与昼夜 */

const WORLD = {
  saveKey: "ming-undying-v3",
  startLoc: "road_inn",
  maxHp: 100,
  maxStamina: 100,
  bagW: 5,
  bagH: 4,
  bagSlots: 20, /* 兼容旧提示：格容量上界 */
  /* 兵器架 2×4 格，架上的才能在战斗中换着用；甲胄栏两个位：头盔、身甲 */
  weaponRack: { w: 2, h: 4 },
  armorRack: { w: 2, h: 1 },
  /* 饱腹：赶路、搜索、打架、歇脚都会饿；饿了回体慢，饿极了掉血 */
  maxSatiety: 100,
  hunger: { start: 70, perMin: 2, search: 1, rest: 4, fight: 5, hungry: 30, starving: 10, starveHp: 4 },
  /* 负重上限；不超过六成算轻装，超过上限算沉重 */
  carryCap: 20,
  lightRatio: 0.6,
  mapView: { w: 640, h: 440 },
  /* 赴京图分区：地点按区排开，互不遮挡（坐标同 mapView） */
  mapRegions: [
    { name: "西山", x: 5, y: 8, w: 85, h: 205 },
    { name: "皇城", x: 290, y: 8, w: 345, h: 72 },
    { name: "内城", x: 95, y: 88, w: 540, h: 140 },
    { name: "外城", x: 290, y: 232, w: 345, h: 60 },
    { name: "京西城外", x: 5, y: 300, w: 630, h: 135 },
  ],

  powers: {
    night_eye: {
      id: "night_eye",
      name: "鬼瞳",
      cost: 2,
      desc: "黑处也看得清，搜查时能多得一件东西。",
    },
    iron_skin: {
      id: "iron_skin",
      name: "金鳞",
      cost: 3,
      desc: "皮肉变硬，挨打时少受些伤。",
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
      desc: "每砍倒一个，便能从它身上夺回些力气。",
    },
    decree_fear: {
      id: "decree_fear",
      name: "敕令余威",
      cost: 5,
      desc: "一交手，弱些的敌人会愣上一回合。",
    },
  },

  items: {
    knife: {
      name: "短刀",
      slot: "weapon",
      dmg: 12,
      dmgType: "slash",
      combo: 0,
      stamina: 5,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1]],
      icon: "assets/items/knife.png",
      desc: "寻常一把短刀，凑合能用。",
    },
    blade: {
      name: "绣春刀",
      slot: "weapon",
      dmg: 20,
      dmgType: "slash",
      combo: 1,
      stamina: 10,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/xiuchun.png",
      desc: "锦衣旧物，刃口冰凉，砍行尸更利。",
    },
    palace_blade: {
      name: "御前残刃",
      slot: "weapon",
      dmg: 30,
      dmgType: "slash",
      combo: 1,
      stamina: 15,
      guardStaminaBase: 10,
      parryDef: 15,
      shape: [[0, 0], [0, 1], [0, 2], [1, 2]],
      icon: "assets/items/palace_blade.png",
      desc: "宫门内拣到的断刃，仍有余锋。",
    },
    hand_axe: {
      name: "手斧",
      slot: "weapon",
      dmg: 18,
      dmgType: "slash",
      combo: 0,
      stamina: 8,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1]],
      icon: "assets/items/hand_axe.png",
      desc: "短柄小斧，劈砍有力。",
    },
    pudi_dao: {
      name: "朴刀",
      slot: "weapon",
      dmg: 24,
      dmgType: "slash",
      combo: 0,
      stamina: 15,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/pudi_dao.png",
      desc: "步卒朴刀，刀身宽厚。",
    },
    shield_dao: {
      name: "牌刀",
      slot: "weapon",
      dmg: 18,
      dmgType: "slash",
      combo: 0,
      stamina: 10,
      guardStaminaBase: 15,
      parryDef: -1,
      autoGuard: true,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/shield_dao.png",
      desc: "一手牌一手刀，盾压刀砍。格挡时藤牌能卸去五成，挡得正是时候能卸去八成。",
    },
    qimei_staff: {
      name: "齐眉棍",
      slot: "weapon",
      dmg: 16,
      dmgType: "blunt",
      combo: 1,
      stamina: 20,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/qimei_staff.png",
      desc: "齐眉长棍，扫打连绵。",
    },
    tangpa: {
      name: "镋钯",
      slot: "weapon",
      dmg: 26,
      dmgType: "pierce",
      combo: 0,
      stamina: 12,
      guardStaminaBase: 10,
      parryDef: 12,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/tangpa.png",
      desc: "镋钯带枝，可架可刺。",
    },
    twin_whip: {
      name: "双鞭",
      slot: "weapon",
      dmg: 14,
      dmgType: "blunt",
      combo: 1,
      stamina: 12,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/twin_whip.png",
      desc: "双鞭齐下，雨点般落。",
    },
    long_spear: {
      name: "长枪",
      slot: "weapon",
      dmg: 30,
      dmgType: "pierce",
      combo: 0,
      stamina: 15,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/long_spear.png",
      desc: "一寸长一寸强，枪出如龙。",
    },
    long_dao: {
      name: "长刀",
      slot: "weapon",
      dmg: 38,
      dmgType: "slash",
      combo: 0,
      stamina: 20,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/long_dao.png",
      desc: "长柄大刀，势大力沉。",
    },
    bazhan: {
      name: "八斩刀",
      slot: "weapon",
      dmg: 12,
      dmgType: "slash",
      combo: 2,
      stamina: 8,
      guardStaminaBase: 10,
      parryDef: 8,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/bazhan.png",
      desc: "宽刃带钩，八斩连环。",
    },
    iron_whip: {
      name: "铁鞭",
      slot: "weapon",
      dmg: 32,
      dmgType: "blunt",
      combo: 0,
      stamina: 20,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/iron_whip.png?v=cn1",
      desc: "铁骨竹节，一击碎骨。",
    },
    sanyan: {
      name: "三眼铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 55,
      combo: 0,
      meleeStamina: 25,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/sanyan.png",
      desc: "三管品字长柄。放完只能换刀，或倒持当锤砸。",
    },
    siyan: {
      name: "四眼铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 50,
      combo: 0,
      meleeStamina: 25,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/siyan.png",
      desc: "四管并列。弹尽之后，可倒持当锤砸。",
    },
    niaochong: {
      name: "鸟铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 85,
      combo: 0,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/niaochong.png",
      desc: "一发一装。战斗里可花一回合再装填，或换兵器。",
    },
    xunlei: {
      name: "迅雷铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 45,
      combo: 0,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
      icon: "assets/items/xunlei.png",
      desc: "多管轮转。打空只能换武器，战斗中不能再装。",
    },
    chedian: {
      name: "掣电铳",
      slot: "weapon",
      kind: "firearm",
      dmg: 60,
      combo: 0,
      shape: [[0, 0], [0, 1], [0, 2]],
      icon: "assets/items/chedian.png",
      desc: "换子铳开火。一回合最多两发，空壳退回行囊。",
    },
    pentong: {
      name: "喷筒",
      slot: "weapon",
      kind: "firearm",
      dmg: 60,
      combo: 0,
      stackMax: 2,
      consumable: true,
      shape: [[0, 0]],
      icon: "assets/items/pentong.png",
      desc: "短管喷火，近距散射。竹制的简易火器，一支只能放一回，打完就扔，装填不得。",
    },
    kuaqiang: {
      name: "快枪",
      slot: "weapon",
      kind: "firearm",
      dmg: 45,
      dmgType: "pierce",
      combo: 0,
      stamina: 15,
      guardStaminaBase: 10,
      parryDef: 10,
      shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
      icon: "assets/items/kuaqiang.png",
      desc: "枪头下藏铳管，可刺可射。",
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
      def: 2,
      staminaPenalty: 0,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/cotton_scrap.png",
      desc: "驿卒留下的薄甲，能挡一下撕扯。",
    },
    armor_scale: {
      name: "锦衣残甲",
      slot: "armor",
      def: 5,
      staminaPenalty: -5,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/jinyi_armor.png",
      desc: "城门守军身上剥下的甲叶，沉重，却管用。",
    },
    cotton_armor: {
      name: "棉甲",
      slot: "armor",
      def: 8,
      staminaPenalty: -10,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/cotton_armor.png",
      desc: "厚棉压实，轻便但防护有限。",
    },
    soft_armor: {
      name: "软甲",
      slot: "armor",
      def: 12,
      staminaPenalty: -12,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/soft_armor.png",
      desc: "软甲内衬，贴身轻便。",
    },
    rattan_armor: {
      name: "藤甲",
      slot: "armor",
      def: 10,
      staminaPenalty: -15,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/rattan_armor.png",
      desc: "藤条编就，油浸后坚韧，畏火。",
    },
    fishscale: {
      name: "鱼鳞甲",
      slot: "armor",
      def: 15,
      staminaPenalty: -20,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/fishscale.png",
      desc: "甲片叠如鱼鳞，兼顾灵活与防护。",
    },
    shanwen: {
      name: "山文甲",
      slot: "armor",
      def: 20,
      staminaPenalty: -30,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/shanwen.png",
      desc: "山字形甲片相扣，厚重严密。",
    },
    iron_armor: {
      name: "铁甲",
      slot: "armor",
      def: 30,
      staminaPenalty: -40,
      shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
      icon: "assets/items/iron_armor.png",
      desc: "整片铁锻，刀枪难入，沉重异常。",
    },
    cloth_helm: {
      name: "布盔",
      slot: "armor",
      part: "head",
      def: 1,
      staminaPenalty: 0,
      shape: [[0, 0]],
      icon: "assets/items/cloth_helm.png",
      desc: "几层粗布缠成的头巾，挡不住刀，好歹能让牙口滑开。",
    },
    rattan_helm: {
      name: "藤盔",
      slot: "armor",
      part: "head",
      def: 3,
      staminaPenalty: -3,
      shape: [[0, 0]],
      icon: "assets/items/rattan_helm.png",
      desc: "桐油浸过的藤条编成，轻巧结实。",
    },
    iron_helm: {
      name: "铁盔",
      slot: "armor",
      part: "head",
      def: 6,
      staminaPenalty: -8,
      shape: [[0, 0]],
      icon: "assets/items/iron_helm.png",
      desc: "边军戴的铁盔，护得住头脸，压得脖子发酸。",
    },
    talisman: {
      name: "镇尸符",
      slot: "charm",
      atkBonus: 17,
      defBonus: 17,
      shape: [[0, 0]],
      icon: "assets/items/zhenshi_fu.png",
      desc: "黄纸朱砂画的符。对付行尸，出手稍重，挨咬稍轻。",
    },
    ration: {
      name: "干粮",
      slot: "consumable",
      food: true,
      fill: 25,
      hp: 8,
      shape: [[0, 0]],
      icon: "assets/items/ration.png",
      desc: "硬，能充饥。",
    },
    mantou: {
      name: "馒首",
      slot: "consumable",
      food: true,
      fill: 20,
      hp: 6,
      shape: [[0, 0]],
      icon: "assets/items/mantou.png",
      desc: "冻得像块石头，揣在怀里焐软了才咬得动。",
    },
    hubing: {
      name: "胡饼",
      slot: "consumable",
      food: true,
      fill: 22,
      hp: 6,
      shape: [[0, 0]],
      icon: "assets/items/hubing.png",
      desc: "撒了芝麻的烧饼，放了些日子，还香。",
    },
    rice: {
      name: "粳米饭",
      slot: "consumable",
      food: true,
      fill: 30,
      hp: 10,
      shape: [[0, 0]],
      icon: "assets/items/rice.png",
      desc: "一团冷饭，用荷叶包着，难得。",
    },
    millet_porridge: {
      name: "黍粥",
      slot: "consumable",
      food: true,
      fill: 18,
      hp: 8,
      stamina: 10,
      shape: [[0, 0]],
      icon: "assets/items/millet_porridge.png",
      desc: "一罐黍米粥，热一热，暖到心口。",
    },
    tofu: {
      name: "豆腐",
      slot: "consumable",
      food: true,
      fill: 12,
      hp: 4,
      shape: [[0, 0]],
      icon: "assets/items/tofu.png",
      desc: "冻豆腐，满是窟窿眼。",
    },
    sauce_meat: {
      name: "酱肉",
      slot: "consumable",
      food: true,
      fill: 28,
      hp: 12,
      shape: [[0, 0]],
      icon: "assets/items/sauce_meat.png",
      desc: "酱色发黑，咸得齁人，顶饿。",
    },
    cured_meat: {
      name: "腊肉",
      slot: "consumable",
      food: true,
      fill: 30,
      hp: 10,
      shape: [[0, 0]],
      icon: "assets/items/cured_meat.png",
      desc: "挂在梁上熏过的腊肉，硬得能当棍子使。",
    },
    dried_fish: {
      name: "鱼干",
      slot: "consumable",
      food: true,
      fill: 18,
      hp: 6,
      shape: [[0, 0]],
      icon: "assets/items/dried_fish.png",
      desc: "运河边晒的鱼干，腥味冲鼻。",
    },
    jerky: {
      name: "肉脯",
      slot: "consumable",
      food: true,
      fill: 22,
      hp: 8,
      shape: [[0, 0]],
      icon: "assets/items/jerky.png",
      desc: "军中的肉脯，一条能嚼半天。",
    },
    pickled_mustard: {
      name: "腌芥",
      slot: "consumable",
      food: true,
      fill: 6,
      hp: 2,
      shape: [[0, 0]],
      icon: "assets/items/pickled_mustard.png",
      desc: "一小坛腌芥菜，就饭吃的。",
    },
    dried_radish: {
      name: "萝卜干",
      slot: "consumable",
      food: true,
      fill: 6,
      hp: 2,
      shape: [[0, 0]],
      icon: "assets/items/dried_radish.png",
      desc: "咸萝卜干，嚼着嘎吱响。",
    },
    pickled_melon: {
      name: "酱瓜",
      slot: "consumable",
      food: true,
      fill: 6,
      hp: 2,
      shape: [[0, 0]],
      icon: "assets/items/pickled_melon.png",
      desc: "酱园里的酱瓜，甜咸参半。",
    },
    dried_meicai: {
      name: "梅干菜",
      slot: "consumable",
      food: true,
      fill: 8,
      hp: 2,
      shape: [[0, 0]],
      icon: "assets/items/dried_meicai.png",
      desc: "一把梅干菜，干嚼也能垫垫肚子。",
    },
    jujube: {
      name: "红枣",
      slot: "consumable",
      food: true,
      fill: 8,
      hp: 4,
      stamina: 5,
      shape: [[0, 0]],
      icon: "assets/items/jujube.png",
      desc: "一把干红枣，甜。",
    },
    chestnut: {
      name: "板栗",
      slot: "consumable",
      food: true,
      fill: 10,
      hp: 3,
      shape: [[0, 0]],
      icon: "assets/items/chestnut.png",
      desc: "生板栗，剥开来能吃。",
    },
    dried_persimmon: {
      name: "柿饼",
      slot: "consumable",
      food: true,
      fill: 12,
      hp: 4,
      stamina: 5,
      shape: [[0, 0]],
      icon: "assets/items/dried_persimmon.png",
      desc: "柿饼上一层白霜，甜得发黏。",
    },
    malt_candy: {
      name: "饴饧",
      slot: "consumable",
      food: true,
      fill: 10,
      hp: 2,
      stamina: 20,
      shape: [[0, 0]],
      icon: "assets/items/malt_candy.png",
      desc: "麦芽熬的糖，含一块，脚下有劲。",
    },
    honey: {
      name: "蜂蜜",
      slot: "consumable",
      food: true,
      fill: 10,
      hp: 12,
      stamina: 10,
      shape: [[0, 0]],
      icon: "assets/items/honey.png",
      desc: "小半罐蜂蜜，冻成了块。",
    },
    water: {
      name: "清水",
      slot: "consumable",
      food: true,
      fill: 4,
      hp: 2,
      stamina: 20,
      shape: [[0, 0]],
      icon: "assets/items/water.png",
      desc: "一囊雪水，冰得牙疼。",
    },
    huangjiu: {
      name: "黄酒",
      slot: "consumable",
      food: true,
      fill: 8,
      hp: 6,
      stamina: 15,
      shape: [[0, 0]],
      icon: "assets/items/huangjiu.png",
      desc: "一壶黄酒，喝下去身上暖了，脚下却有些飘。",
    },
    nuerhong: {
      name: "女儿红",
      slot: "consumable",
      food: true,
      fill: 10,
      hp: 15,
      stamina: 15,
      shape: [[0, 0]],
      icon: "assets/items/nuerhong.png",
      desc: "埋在地下的陈酿，泥封还没开过。",
    },
    antidote: {
      name: "解毒散",
      slot: "consumable",
      shape: [[0, 0]],
      icon: "assets/items/antidote_soup.png",
      desc: "郎中留下的汤药，喝下能压住喉中那股饥渴。",
    },
    zhang_diary: {
      name: "张百户手记",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/zhang_diary.png?v=cn2",
      desc: "张百户的手记，字越写越乱：「玉瓶在怀，夜夜听它喘气。校尉又疯两个，我亲手斩了。圣上要的是长生，我送去的是什么？」末页只剩一句：「我也饿了。」",
    },
    elixir_record: {
      name: "进药丹方",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/elixir_record.png?v=cn2",
      desc: "那年进献长生药的丹方，方后朱批一个「准」字。另夹着太医院一纸谏言，叫人揉皱了，上头写着：「此药来历不明，不可服。」",
    },
    doctor_recipe: {
      name: "郎中药方",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/doctor_recipe.png?v=cn2",
      desc: "郎中临死前写下的方子：「蜂蜜一罐、黄酒一壶、红枣一把，同熬一个时辰，可压疫气。」底下又注了一句：「我自己没熬成。」",
    },
    military_order: {
      name: "千总令箭",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/military_order.png?v=cn1",
      desc: "千总给的令箭，箭杆上刻着卫所的番号。他说溃兵里有认得这支令的，见了兴许会让路。",
    },
    temple_note: {
      name: "道观残稿",
      slot: "key",
      noDrop: true,
      shape: [[0, 0], [1, 0]],
      icon: "assets/items/temple_note.png?v=cn2",
      desc: "「药非丹，乃蛊也。服者不死，亦不复为人。惟火可断其根。」——一名道士的绝笔。",
    },
    refugee_letter: {
      name: "难民札记",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/refugee_letter.png?v=cn2",
      desc: "「初七日，城门闭。初九，兵变。十一，街上已无人行。闻宫中夜夜有咀嚼声。」",
    },
    alchemy_notes: {
      name: "炼丹手记",
      slot: "key",
      noDrop: true,
      shape: [[0, 0], [0, 1]],
      icon: "assets/items/alchemy_notes.png?v=cn2",
      desc: "「取寒谷玉液，合朱砂、雄黄、铅霜。若减朱砂半钱，丹色转青——服之无觉，然三日后目赤，嗜生肉。」",
    },
    palace_crest: {
      name: "残破腰牌",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/palace_crest.png?v=cn2",
      desc: "锦衣卫腰牌，断成两截。正面「寻药」，背面「百户张」。",
    },
    jade_chip: {
      name: "玉瓶残片",
      slot: "key",
      noDrop: true,
      shape: [[0, 0]],
      icon: "assets/items/jade_chip.png",
      desc: "和药谷那只玉瓶一般冰凉，可作凭证。",
    },
    edict: {
      name: "密旨抄件",
      slot: "key",
      noDrop: true,
      shape: [[0, 0], [1, 0]],
      icon: "assets/items/edict.png",
      desc: "着寻长生之药，不得外泄。旁注西行极寒药谷——源头在彼。",
    },
  },

  /* 装备掉落：关键几件固定放，其余按前中后期随机；拿过的不会再掉（flags 记 loot_物品id） */
  loot: {
    pools: {
      early: ["pudi_dao", "twin_whip", "pentong", "cotton_armor", "rattan_armor", "cloth_helm", "rattan_helm"],
      mid: ["long_dao", "iron_whip", "siyan", "soft_armor", "iron_helm"],
      late: ["shanwen", "iron_armor", "iron_helm"],
    },
    locTier: {
      road_inn: "early", village: "early", canal: "early", post: "early",
      temple: "mid", gate: "mid", barbican: "mid", inner: "mid",
      yamen: "late", palace: "late", valley: "late",
      lugou: "early", barracks: "early", caishikou: "mid", yaoju: "mid", gulou: "mid",
      xishan_temple: "late", yuyaofang: "late",
    },
    fightTier: {
      road_ghoul: "early", village_pack: "early", canal_guard: "early",
      gate_chain: "mid", street_horde: "mid", temple_priest: "mid", barbican_soldiers: "mid",
      valley_pack: "late",
      lugou_riders: "early", barracks_guard: "mid", caishikou_exec: "mid", yaoju_doctor: "mid",
      gulou_watch: "mid", xishan_monks: "late", yyf_guard: "late",
    },
    fightFixed: {
      temple_priest: { id: "qimei_staff", line: "道士倒下时，手里那根齐眉棍滚到了你脚边。" },
      barbican_soldiers: { id: "long_spear", line: "溃兵头目身下压着一杆长枪，枪缨还是红的。" },
      street_horde: { id: "shield_dao", line: "轿中尸怀里死死抱着一面藤牌和一口短刀，你掰开它的手取了过来。" },
      valley_pack: { id: "fishscale", line: "谷中行尸身上竟套着一领鱼鳞甲，甲片间还卡着药渣。" },
      barracks_guard: { id: "tangpa", line: "骑手手里那杆镋钯落在雪里，钯齿上还挂着碎布。" },
      caishikou_exec: { id: "bazhan", line: "刽子手倒下了，腰里别着的一对八斩刀还擦得锃亮。" },
    },
    searchFixed: {
      village: { id: "hand_axe", line: "柴房门后挂着一把劈柴的手斧，斧刃还算利。" },
      yamen: { id: "sanyan", line: "衙役的兵器架上剩一杆三眼铳，三根管子都还通。" },
    },
    /* 新地点里要先打赢才能搜到的固定物件（game.js lookAround 里用） */
    clearedFind: {
      lugou: { need: "lugou_cleared", id: "chedian", line: "官车里有只锦衣卫的箱子，锁已叫人砸开，里头一杆掣电铳用油布裹着，还没人动过。" },
      barracks: { need: "barracks_cleared", id: "kuaqiang", line: "军械库的门叫你撬开了，架上还剩一杆快枪。" },
      gulou: { need: "gulou_cleared", id: "xunlei", line: "城防的火器库就在鼓楼底下，库门半开，架上挂着一杆迅雷铳。" },
      xishan_temple: { need: "xishan_cleared", id: "zhang_diary", line: "供桌底下有个包袱，绣着锦衣卫的海东青，里头是一本手记，封皮写着「百户张」。" },
      yaoju: { need: "yaoju_cleared", id: "doctor_recipe", line: "郎中的尸身旁散着一张方子，墨迹还新。" },
      yuyaofang: { need: "yyf_cleared", id: "elixir_record", line: "案上压着一卷丹方，正是那年进献的方子，末尾朱笔批着一个「准」字。" },
    },
    fightChance: 0.5,
    searchChance: 0.3,
    /* 吃食：搜索、打完架都有几成能翻到，地方越往后越好 */
    food: {
      early: ["ration", "mantou", "hubing", "dried_radish", "pickled_mustard", "water", "chestnut", "jujube", "dried_fish"],
      mid: ["ration", "jerky", "cured_meat", "millet_porridge", "tofu", "pickled_melon", "dried_meicai", "huangjiu", "water", "dried_persimmon", "malt_candy"],
      late: ["jerky", "sauce_meat", "rice", "honey", "nuerhong", "huangjiu", "malt_candy"],
    },
    searchFoodChance: 0.3,
    fightFoodChance: 0.25,
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
      x: 150,
      y: 400,
      links: [
        { to: "village", min: 3, label: "村落" },
        { to: "lugou", min: 3, label: "卢沟桥", risky: true },
      ],
    },
    village: {
      name: "荒村",
      short: "荒村",
      icon: "assets/map/village.svg",
      x: 290,
      y: 400,
      links: [
        { to: "road_inn", min: 3, label: "回雪店" },
        { to: "temple", min: 3, label: "废弃道观", risky: true },
        { to: "post", min: 4, label: "驿站废墟", risky: true },
        { to: "canal", min: 3, label: "运河" },
      ],
    },
    canal: {
      name: "运河纤道",
      short: "运河",
      icon: "assets/map/canal.svg",
      x: 130,
      y: 330,
      links: [
        { to: "lugou", min: 3, label: "卢沟桥" },
        { to: "village", min: 3, label: "荒村" },
        { to: "gate", min: 5, label: "外城门方向", risky: true },
      ],
    },
    temple: {
      name: "废弃道观",
      short: "道观",
      icon: "assets/map/temple.svg",
      x: 330,
      y: 330,
      links: [
        { to: "village", min: 3, label: "回荒村" },
        { to: "post", min: 3, label: "驿站废墟", risky: true },
      ],
    },
    barbican: {
      name: "瓮城废墟",
      short: "瓮城",
      icon: "assets/map/barbican.svg",
      x: 480,
      y: 262,
      links: [
        { to: "gate", min: 2, label: "回外城门" },
        { to: "inner", min: 2, label: "内城长街", risky: true },
      ],
    },
    post: {
      name: "驿站废墟",
      short: "驿站",
      icon: "assets/map/post.svg",
      x: 450,
      y: 330,
      links: [
        { to: "village", min: 4, label: "回村" },
        { to: "temple", min: 3, label: "废弃道观" },
        { to: "gate", min: 4, label: "外城", risky: true },
        { to: "barracks", min: 3, label: "卫所营盘", risky: true },
      ],
    },
    gate: {
      name: "京师外城门",
      short: "城门",
      icon: "assets/map/gate.svg",
      x: 345,
      y: 262,
      links: [
        { to: "canal", min: 5, label: "退回运河" },
        { to: "barbican", min: 2, label: "瓮城", risky: true },
        { to: "inner", min: 3, label: "入城", risky: true, need: ["gate_open"] },
        { to: "post", min: 4, label: "驿站" },
      ],
    },
    inner: {
      name: "内城长街",
      short: "长街",
      icon: "assets/map/inner.svg",
      x: 345,
      y: 125,
      links: [
        { to: "barbican", min: 2, label: "回瓮城" },
        { to: "gate", min: 3, label: "外城门" },
        { to: "palace", min: 4, label: "皇城方向", risky: true },
        { to: "yamen", min: 2, label: "衙署废厅" },
        { to: "caishikou", min: 2, label: "菜市口", risky: true },
        { to: "yaoju", min: 2, label: "惠民药局", risky: true },
        { to: "gulou", min: 2, label: "鼓楼", risky: true },
      ],
    },
    yamen: {
      name: "衙署废厅",
      short: "衙署",
      icon: "assets/map/yamen.svg",
      x: 150,
      y: 125,
      links: [
        { to: "inner", min: 2, label: "长街" },
        { to: "xishan_temple", min: 4, label: "西山古寺", risky: true, need: ["valley_map"] },
      ],
    },
    valley: {
      name: "极寒药谷",
      short: "药谷",
      icon: "assets/map/valley.svg",
      x: 45,
      y: 45,
      links: [{ to: "xishan_temple", min: 3, label: "回古寺", risky: true }],
    },
    palace: {
      name: "皇城外垣",
      short: "皇城",
      icon: "assets/map/palace.svg",
      x: 345,
      y: 44,
      links: [
        { to: "inner", min: 4, label: "退回长街" },
        { to: "yuyaofang", min: 2, label: "御药房", risky: true, need: ["palace_key"] },
      ],
    },
    lugou: {
      name: "卢沟桥",
      short: "卢沟桥",
      icon: "assets/map/lugou.svg",
      x: 40,
      y: 400,
      links: [
        { to: "road_inn", min: 3, label: "回雪店" },
        { to: "canal", min: 3, label: "运河纤道", risky: true },
      ],
    },
    barracks: {
      name: "卫所营盘",
      short: "营盘",
      icon: "assets/map/barracks.svg",
      x: 575,
      y: 330,
      links: [{ to: "post", min: 3, label: "回驿站" }],
    },
    xishan_temple: {
      name: "西山古寺",
      short: "古寺",
      icon: "assets/map/xishan_temple.svg",
      x: 45,
      y: 165,
      links: [
        { to: "yamen", min: 4, label: "回衙署" },
        { to: "valley", min: 3, label: "极寒药谷", risky: true },
      ],
    },
    caishikou: {
      name: "菜市口",
      short: "菜市口",
      icon: "assets/map/caishikou.svg",
      x: 250,
      y: 195,
      links: [{ to: "inner", min: 2, label: "回长街" }],
    },
    yaoju: {
      name: "惠民药局",
      short: "药局",
      icon: "assets/map/yaoju.svg",
      x: 450,
      y: 195,
      links: [{ to: "inner", min: 2, label: "回长街" }],
    },
    gulou: {
      name: "鼓楼",
      short: "鼓楼",
      icon: "assets/map/gulou.svg",
      x: 520,
      y: 125,
      links: [{ to: "inner", min: 2, label: "回长街" }],
    },
    yuyaofang: {
      name: "御药房",
      short: "御药房",
      icon: "assets/map/yuyaofang.svg",
      x: 460,
      y: 44,
      links: [
        { to: "palace", min: 2, label: "回皇城外垣" },
        { to: "throne", min: 3, label: "丹陛", risky: true },
      ],
    },
    throne: {
      name: "丹陛之前",
      short: "丹陛",
      icon: "assets/map/throne.svg",
      x: 575,
      y: 44,
      links: [{ to: "yuyaofang", min: 3, label: "退回御药房" }],
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
    valley_map: "须先取得密旨抄件以判明药谷方位",
    temple_cleared: "道观中仍有邪物盘踞",
    barbican_cleared: "瓮城中仍有溃兵行尸未清",
  };
  return (need || []).map((n) => map[n] || n).join("；");
}

/** 渴染渐深时各地多出的一句：[中, 深]。丹陛、道观、瓮城在 locText 里自带 */
const CORR_LINES = {
  road_inn: ["灶膛里明明没火，你却闻到一股烤肉的香气。", "你盯着账上「人却变了」那几个字，竟觉得说的是你自己。"],
  village: ["井边倒着一条死狗，你只看了一眼，喉咙便有些发紧。", "远处那点人声听在你耳里，倒像有人在招呼你回去吃饭。"],
  canal: ["冰下那些翻白的东西，你看着竟不觉得恶心了。", "风里那股又香又臭的气味，你越闻越觉得香。"],
  post: ["马槽里的草料结着霜，你想起的却是马肉的滋味。", "公文上「长生」两个字你多看了几眼，嘴里泛起一股甜味。"],
  gate: ["那守兵喉咙里咕噜作响，你竟听出了几分意思。", "门轴上那东西朝你嗅了嗅，没有扑上来，反倒往后缩了缩。"],
  inner: ["两旁黑影里有几双眼睛跟着你，你却不怎么怕了。", "雪上的跪印都朝着皇城，你的脚也不由自主地往那边去。"],
  yamen: ["墙上的血污在你眼里浓淡分明，倒像一幅画。", "大印上那片黑渍，你凑近闻了闻，竟舍不得挪开。"],
  valley: ["岩缝里的寒气扑到脸上，你只觉得通体舒坦。", "你忽然很想把手伸进那道岩缝里去。"],
  palace: ["宫墙那一排牙，看得久了，倒也顺眼。", "门缝里那个人影动了动，像是在等你进去。"],
  lugou: ["石狮子的眼珠子像在跟着你转，你倒想凑上去舔一舔那层霜。", "车底下那摊冻住的血，你看着只觉得可惜。"],
  barracks: ["营房里一股陈年的汗馊味，你闻着竟有些饿。", "地窖板缝里那丝热气，你知道是活人呼出来的，喉咙一阵发紧。"],
  xishan_temple: ["殿里那尊佛像低眉看你，你却觉得它在笑。", "松针上的雪落在脖子里，你一点也不觉得冷了。"],
  caishikou: ["肉案上那几道刀痕，你看着竟想起了切肉的声响。", "刑台上的黑冰你多看了几眼，舌尖上泛起一股腥甜。"],
  yaoju: ["满地药材的苦味里，夹着一缕你说不上来的香。", "里屋的咳嗽声在你耳里，倒像是在叫你的名字。"],
  gulou: ["那锣声一下一下，你的心也跟着一下一下地跳。", "楼上望下去，满街行尸像在等你发号施令。"],
  yuyaofang: ["炉灰里那股丹药味，你闻着只觉得亲切。", "你拈起一片金箔放在舌上，等回过神来，已经咽下去了。"],
};

function locText(id, s) {
  const nightEye = s.powers.has("night_eye");
  const night = isNight(s.elapsed);
  const revisit = (s.visits[id] || 0) >= 2;
  const highCorr = (s.corruption || 0) >= 67;
  const midCorr = (s.corruption || 0) >= 33 && (s.corruption || 0) < 67;
  const t = {
    road_inn: () => {
      if (revisit) {
        return night
          ? "野店里依旧冷冰冰的，夜风一阵紧似一阵，把门框刮得吱呀作响。"
          : "野店还是老样子，柜上那本账你已看过，末一行字也记得清楚。";
      }
      return [
        "这野店只剩半扇门板，灶膛早已冷透。墙上贴过一张驱瘟符，下半截叫人撕了去。",
        "柜上摊着一本账，最后一笔写道：京里来的客官，房钱未付，人却变了。",
        nightEye
          ? "你借着鬼瞳去看，灶灰底下埋着半块玉片，摸上去凉得刺手。"
          : "门外风雪不住拍打门板，听着倒像有人在外头啃木头。",
      ].join("\n\n");
    },
    village: () => {
      if (revisit) {
        if (s.flags.has("saved_child")) return "柴房里那孩子见你回来，又抬手朝北边指了一指。";
        if (s.flags.has("left_child")) return "那哭声早已没了，雪把巷子里的脚印盖得干干净净。";
        return "巷口那条红布还在风里晃，远处隐约有些响动，分不清是风声还是人声。";
      }
      return [
        "村口的石敢当歪在一边，巷子里挂着几条红布，早已冻得发黑。",
        "有一户人家门户大开，桌上饭菜还在，筷子插在碗里，主人分明是丢下饭碗跑出去的。",
        s.flags.has("saved_child")
          ? "你救下的那个孩子缩在柴房里，指着北边说：有个官爷往京城去了，怀里揣着一只瓶子。"
          : "远处隐隐传来孩子的哭声。",
      ].join("\n\n");
    },
    canal: () => {
      const lines = [
        "运河上结了一层薄冰，纤道上的脚印杂乱，有些只踩下脚尖，像是一路追着人跑的。",
        "一条货船搁在浅处，舱盖从里头被顶开了。",
      ];
      if (s.flags.has("jade_hint")) {
        lines.push("那锦衣残卫倒下的地方，脚印一路朝北，正是回京的方向。");
      } else if (nightEye) {
        lines.push("船舱里散着几片锦衣碎布，有块腰牌还认得出字：寻药百户。");
      } else {
        lines.push("风里飘来一股又香又臭的气味，像宫里熏的香，又像坟地里的土腥。");
      }
      if (night) lines.push("入夜之后河面一片漆黑，纤道窄得叫人心慌。");
      if (revisit) lines.push("你又走了一遭，新脚印叠着旧脚印。");
      return lines.join("\n\n");
    },
    post: () => {
      const lines = [
        "驿站的旗杆折了，马厩空空荡荡，槽里还剩些草料。",
        "公文匣子被人撬开，里头的纸页散了一地，有一张写着：着寻长生之药，不得外泄。",
      ];
      if (s.flags.has("jade_hint")) {
        lines.push("残卫腰牌上的字和这张抄件对得上，原是同一趟差事。");
      }
      if (revisit) lines.push("驿站还是那副残局，纸上的墨香又淡了几分。");
      return lines.join("\n\n");
    },
    gate: () =>
      [
        "京师外城的大门半开半掩。守门的兵丁盔甲还穿在身上，人却早已不成人形，被一条铁链拴在门轴上，见了活物便扑。",
        "门额上「永定」两个大字，叫爪子挠得稀烂。",
        s.flags.has("gate_open")
          ? "铁链已经斩断，进城的路算是通了。"
          : "要想进城，须先料理了门轴上拴着的那个东西。",
        night ? "夜里城门洞中的喘息声听得格外真切。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    inner: () => {
      if (revisit) {
        return night
          ? "长街还是那条长街，夜里不见更夫，鼓楼的铜铃却自己晃个不停。"
          : "长街还是那条长街，一层新雪盖住了地上的跪印。";
      }
      return [
        "两旁店铺的招牌还挂着，漆皮剥落了大半。雪地上满是跪印，有齐有乱，都朝着北边，想是有人临死还在朝皇城磕头。",
        "鼓楼那边铜铃乱响，楼上早已没有人了。",
        "你身上那股邪气隐隐发烫，越往皇城走，越是不得安生。",
        night ? "夜色里两旁黑影起起落落，像潮水一般。" : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    },
    yamen: () =>
      [
        "衙门大堂里公案翻倒在地，墙上的隔离告示被血污涂得看不清字。",
        "抽屉里压着一块腰牌，还有一张回宫的路图。",
        "知县不知去向，大印却端端正正盖在一张「封锁京师」的空文上。",
        s.flags.has("valley_map") || bagHas(s, "edict")
          ? "照密旨所写，那祸根就在京西的极寒药谷。"
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    valley: () =>
      [
        "这便是西山雪岭里的药谷。积雪没膝，岩缝里冒出丝丝寒气，和那玉瓶一般冰凉。",
        "谷底有一片焦黑，像是有人放过火，却没能烧起来。",
        !s.flags.has("valley_cleared")
          ? "几具行尸守在岩缝两旁，好似守着一口不该打开的井。"
          : s.flags.has("valley_wood")
            ? "干柴已经备齐，纵有风雪也点得着。"
            : "谷中行尸已除，四下找找，或许还有用得上的东西。",
        night ? "夜里愈发寒冷，石壁那头传来一阵阵磨牙的声音。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    palace: () =>
      [
        "皇城的红墙金瓦都被烟火熏黑了，护城河里漂着几件官服。",
        "宫门上的铜钉冰凉。门缝里影影绰绰，远远望得见龙椅，椅上坐着一个不肯倒下的人影。",
        s.flags.has("palace_key")
          ? "进宫的门路已经有了，再往里走，便是一切的根由。"
          : "手里没有腰牌，也没有玉瓶碎片，硬闯进去不过是给里头添一口吃食。",
        night ? "夜里望去，宫墙一溜排开，活像一排牙齿。" : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    throne: () => {
      const lines = [
        "丹陛前烛泪堆得像座小山。龙椅上坐着的，便是当今天子，胸口还在起伏，眼白却已全黑。",
        "玉瓶碎在台阶下。他慢慢抬起头，喉咙里挤出两个字：长生。",
        s.flags.has("saved_child") ? "你想起荒村那孩子说的话，果然有个官爷，果然有一只瓶子。" : "",
      ];
      if (highCorr) lines.push("他看你的眼神变了，像是认出了你，把你当成了自家人。");
      else if (midCorr) lines.push("你忽然发觉，自己竟跟着他点了点头。");
      return lines.filter(Boolean).join("\n\n");
    },
    temple: () => {
      const lines = [
        "道观的山门倒了，匾额上「三清」二字被人用泥糊住。",
        "院中一口丹炉翻倒在地，炉灰里掺着碎骨。",
        "正殿神像被推倒了，供桌上留着几页写满字的纸。",
      ];
      if (s.flags.has("temple_cleared")) {
        lines.push("那道士把自己锁在厢房里，手里攥着一张没写完的方子。");
      } else {
        lines.push("偏殿里有个人影来回踱步，穿着道袍，牙却已经变了。");
      }
      if (highCorr) lines.push("倒在地上的神像，眼睛像在看着你。");
      if (night) lines.push("夜里观中静得出奇，你听得见自己的心跳，还有另一颗心在跳。");
      return lines.filter(Boolean).join("\n\n");
    },
    barbican: () => {
      const lines = [
        "瓮城夹在两道城墙中间，地上满是铺盖、碗罐和踩烂的包袱。",
        "墙上用血写着许多名字，密密麻麻，最后一个底下写着：全没了。",
        "角落里蹲着几具溃兵变成的行尸。",
      ];
      if (s.flags.has("barbican_cleared")) {
        lines.push("你在溃兵的行囊里翻出一封没寄出去的家书，上写：母亲大人安好，儿在京师一切如常。");
      }
      if (highCorr) lines.push("你看着墙上那些名字，竟在里头看见了自己的姓。");
      return lines.filter(Boolean).join("\n\n");
    },
    lugou: () => {
      if (revisit) {
        return s.flags.has("lugou_cleared")
          ? "桥上的大车还横七竖八地堵着，冰面底下时不时咔的一响。"
          : night
            ? "夜里桥上黑魆魆的，石狮子的影子比白天大了一圈，桥那头有马蹄声来回踱着。"
            : "桥那头的马蹄声还在，时远时近，像是在巡桥。";
      }
      return [
        "永定河冻得严严实实，卢沟桥横在冰上，桥栏上的石狮子顶着雪，一个个望着京城的方向。",
        "桥面上塞满了逃难的大车，箱笼包袱撒了一地，牲口早不知去向。桥心歪着一辆蒙油布的官车，车辕上还插着一面锦衣卫的小旗。",
        "桥头的石碑上「卢沟晓月」四个字，叫人用刀刮花了。",
      ].join("\n\n");
    },
    barracks: () => {
      if (revisit) {
        if (s.flags.has("officer_saved")) return "地窖的板子掀在一旁，那千总已经走了，雪上留着一行往西去的脚印。";
        return s.flags.has("barracks_cleared")
          ? "营盘里静了下来，只有营旗的碎布条还在旗杆上啪啪作响。"
          : "营房里还有东西在走动，铁甲叶子磕得叮当响。";
      }
      return [
        "这是京西一处卫所的营盘，辕门倒在雪里，营房塌了大半。兵器架东倒西歪，营旗撕成了布条，在旗杆上啪啪作响。",
        "营房后头有一块木板盖着的地窖口，板缝里透出一丝热气。",
      ].join("\n\n");
    },
    xishan_temple: () => {
      if (revisit) {
        return s.flags.has("xishan_cleared")
          ? "古寺里那盏油灯叫你添了些油，火苗不大，好歹是个亮处。"
          : "殿后头的脚步声又响起来了，拖着走，不止一个。";
      }
      return [
        "出了西直门一路往西，山道越走越窄，半山腰上有座古寺，山门塌了一半。殿前一棵老松叫雪压弯了腰，香炉倒在台阶下，炉灰冻成了一块。",
        "殿里供桌上摆着一盏还没烧尽的油灯，像是不久前有人在这里歇过脚。",
        night ? "夜里山风从殿门灌进来，那盏灯晃了几晃，竟没有灭。" : "",
      ].filter(Boolean).join("\n\n");
    },
    caishikou: () => {
      if (revisit) {
        return s.flags.has("caishikou_cleared")
          ? "刑台下冷冷清清，街角肉铺的门缝里还透着那一点灯光。"
          : "刑台上那个高大的影子还在，扛着斧，来回地走。";
      }
      return [
        "菜市口的刑台还立在街心，台上的木桩结了一层黑冰。台下原是集市，菜筐、肉案、秤杆翻了一地，雪底下埋着冻硬的白菜帮子。",
        "街角一家肉铺的门板没卸，门缝里透出一点昏黄的灯光。",
      ].join("\n\n");
    },
    yaoju: () => {
      if (revisit) {
        return s.flags.has("yaoju_cleared")
          ? "里屋的咳嗽声停了，屋角那口熬药的大锅还在，生了火便能用。"
          : "里屋的咳嗽声一声紧过一声，听得人嗓子发痒。";
      }
      return [
        "惠民药局的牌匾斜挂在门上。药柜上百十个抽屉全叫人拉开了，药材撒了一地，混着雪水冻在一处。柜台上的戥子秤还摆着，屋角那口熬药的大锅早冷透了。",
        "里屋传出一阵阵咳嗽，咳得撕心裂肺。",
      ].join("\n\n");
    },
    gulou: () => {
      if (revisit) {
        return s.flags.has("gulou_cleared")
          ? "鼓楼上没了锣声，长街那头的行尸也散了些。"
          : "楼上的锣声还在一下一下地响，长街那头有东西循声挪了过来。";
      }
      return [
        "鼓楼高高立在长街北头，楼上那面大鼓叫人捅了个窟窿。券门洞开，台阶上积着雪，墙根堆着几口破火器箱，一尊铜炮歪在雪里。",
        "楼上隐隐传来一下一下的锣声，不紧不慢，像是有人还在打更。",
      ].join("\n\n");
    },
    yuyaofang: () => {
      if (revisit) {
        return s.flags.has("yyf_cleared")
          ? "御药房里满地炉灰，你的脚印从门口一直走到案前。"
          : "炉后头窸窸窣窣，有东西在翻那些丹方。";
      }
      return [
        "御药房在皇城一角，雕花窗子碎了一地。丹炉倒在当中，炉灰撒得满屋都是，案上摊着几张丹方，金箔散了一桌，药柜上的黄封一张张都揭开了。",
        "丹陛就在前头，隔着一道宫墙，你听得见那边有东西在嚼。",
      ].join("\n\n");
    },
  };
  const base = (t[id] || (() => "大雪封了路，前不着村，后不着店。"))();
  const extra = highCorr ? (CORR_LINES[id] || [])[1] : midCorr ? (CORR_LINES[id] || [])[0] : "";
  return extra ? `${base}\n\n${extra}` : base;
}
