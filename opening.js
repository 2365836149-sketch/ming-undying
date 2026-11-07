/** 序章：说书口吻，平铺直叙，不装腔也不碎嘴 */

const V = (t) => `<span class="verse">${t}</span>`;

const OPENING_BEATS = [
  {
    seal: true,
    title: true,
    paragraphs: [
      { html: "话说大明弘治年间，天下承平日久，京师九门内外，一到腊月便家家张灯，处处酒香。" },
      { html: `那一年冬天，宫里一连摆了七夜的宴。外头只道圣上龙体康泰、与民同乐，却不知乾清宫的烛火彻夜不熄，皇帝独坐榻上，翻来覆去只念着两个字：${V("长生")}。` },
    ],
  },
  {
    paragraphs: [
      { html: "原来入冬以来，圣上常觉心悸气短，太医院的方子换了一剂又一剂，总不见好。京西有座道观，观里一个道士进言，说西山雪岭深处有一道极寒药谷，谷中藏着前朝真人炼成的" + V("不死药") + "，服下便能返老还童，与天同寿。" },
      { html: "皇帝听了大喜，当夜写下一道密旨，交与锦衣卫百户张某，命他点二十名校尉星夜西行，此事不得外泄，药不到手，人也不必回来。" },
    ],
  },
  {
    paragraphs: [
      { html: "张百户一行进了西山，正赶上大雪封岭。谷中不见鸟兽，积雪没过膝盖，二十个人一路冻死的、坠崖的，去了大半。" },
      { html: "到第四十日上，才在一处冰崖石缝里寻着一只白玉瓶。那瓶子入手冰凉，凑到耳边去听，竟像里头有什么东西在慢慢喘气。" },
      { html: "回京路上，又有两个校尉夜里发了狂，咬伤同伴，被张百户亲手斩了，只对众人说是冻坏了脑子。剩下的人心里有数，谁也不敢多问。" },
    ],
  },
  {
    paragraphs: [
      { html: "腊月二十三，玉瓶进了宫。皇帝屏退左右，只留两个贴身内侍，拔了瓶塞，仰头一饮而尽。" },
      { html: "起初并无动静，殿里静得听得见更漏。约莫过了一炷香，龙椅上骨节喀喀作响，好似有人把一副骨头拆开了，又一根一根装回去。内侍上前搀扶，手腕被一把扣住，那只手冷得像冰，力气却大得出奇。" },
      { html: "等禁军听见惨叫撞进门来，殿中已是满地血污。皇帝端坐在龙椅上，嘴角挂着血，两眼漆黑，见了活人，只是笑。" },
    ],
  },
  {
    paragraphs: [
      { html: "宫门当夜便封了，却封不住消息，也封不住那些被咬伤后逃出来的人。不出半月，内城里便有人白日发狂、夜里吃人。官府贴出告示，只说京师闹了时疫，叫百姓闭门不出。" },
      { html: "又过两个月，九门紧闭，城外的村镇也一处处空了。往来的客商都说，京城如今是一座死城，城头上站岗的守军，早已不是活人。" },
    ],
  },
  {
    paragraphs: [
      { html: "偏偏还有人往京城去：有去寻爹娘妻小的，有去探个究竟的，也有听说那玉瓶里还剩几滴、想去碰碰运气的。" },
      { html: "你便是其中一个。这一日你背着一杆鸟铳，腰里别着一把短刀，冒着风雪走到京西官道上一家野店门前，天色已经黑透了。" },
      { html: V("正是：一道求仙旨，换得满城尸。此去吉凶如何，且看下文分解。") },
    ],
  },
];

/* 英文版序章：段落与中文一一对应，标红词放在英文语序里合适的位置 */
const OPENING_BEATS_EN = [
  {
    paragraphs: [
      { html: "In the years of Hongzhi of the Great Ming, the realm had long known peace. Every twelfth month, within and without the nine gates of the capital, lanterns hung at every door and the smell of wine was everywhere." },
      { html: `That winter the palace held a banquet seven nights running. Outside, they said His Majesty was in fine health and sharing his joy with the people. No one knew the candles in the Hall of Heavenly Purity never went out, or that the Emperor sat alone on his couch, turning over and over a single word: ${V("undying")}.` },
    ],
  },
  {
    paragraphs: [
      { html: `Since the onset of winter His Majesty had suffered palpitations and shortness of breath, and prescription after prescription from the Imperial Academy of Medicine did nothing. A Taoist from a temple west of the capital came forward and said that deep in the snowy ridges of the Western Hills lay a frozen Medicine Valley, and in it an ${V("elixir of undying")} refined by a sage of a former dynasty, which, once swallowed, would restore youth and grant a life as long as Heaven's.` },
      { html: "The Emperor was overjoyed. That very night he wrote a secret edict and gave it to Zhang, a centurion of the Jinyiwei, ordering him to take twenty men west under cover of night. None were to know of it; and if they did not bring back the elixir, they need not come back at all." },
    ],
  },
  {
    paragraphs: [
      { html: "Centurion Zhang's party entered the Western Hills just as the snow closed the ridges. There were no birds or beasts in the valleys, the drifts came over their knees, and of the twenty, more than half froze or fell from the cliffs along the way." },
      { html: "On the fortieth day, in a crack of an ice cliff, they finally found a white jade vial. It was cold to the touch, and when held to the ear, something inside seemed to be breathing slowly." },
      { html: "On the road back, two more of his men went mad in the night and bit their comrades. Centurion Zhang beheaded them himself and told the others the cold had addled their brains. The rest understood, and no one dared ask." },
    ],
  },
  {
    paragraphs: [
      { html: "On the twenty-third day of the twelfth month, the jade vial entered the palace. The Emperor dismissed his attendants, keeping only two personal eunuchs. He pulled the stopper, threw back his head and drained it." },
      { html: "At first nothing happened; the hall was so quiet you could hear the water clock. After about the time it takes an incense stick to burn, the bones on the dragon throne began to crack and pop, as if someone were taking a skeleton apart and putting it back together piece by piece. An attendant stepped forward to steady him, and his wrist was seized — by a hand cold as ice, and impossibly strong." },
      { html: "By the time the guards heard the screams and broke in, the hall was awash in blood. The Emperor sat upright on the dragon throne, blood at the corners of his mouth, his eyes pitch black. When he saw the living, he only smiled." },
    ],
  },
  {
    paragraphs: [
      { html: "The palace gates were sealed that very night, but they could not seal in the news, nor those who had been bitten and escaped. Within half a month, people in the inner city were going mad by day and eating men by night. The authorities posted notices saying only that a plague had struck the capital and the people should stay behind closed doors." },
      { html: "Two more months passed. All nine gates were sealed, and one by one the towns outside fell empty. Merchants on the road said the capital was a dead city now, and the soldiers on its walls were no longer living men." },
    ],
  },
  {
    paragraphs: [
      { html: "And yet some still went toward the capital: some to find parents, wives and children, some to learn the truth, and some who had heard a few drops remained in the jade vial and wanted to try their luck." },
      { html: "You are one of them. On this day, a fowling gun on your back and a short knife at your belt, you trudge through the snow to the door of a wayside inn on the road west of the capital. Night has already fallen." },
      { html: V("Thus it was: one edict seeking immortality, and a city full of corpses. What fortune awaits on this road? Read on.") },
    ],
  },
];

function openingBeats() {
  return typeof I18N !== "undefined" && I18N.lang === "en" ? OPENING_BEATS_EN : OPENING_BEATS;
}

function runOpening({ onDone }) {
  const root = document.getElementById("opening");
  const textEl = document.getElementById("op-text");
  const nextBtn = document.getElementById("op-next");
  const skipBtn = document.getElementById("op-skip");
  const progress = document.getElementById("op-progress");
  const seal = document.getElementById("op-seal");
  const title = document.getElementById("op-title");
  const sub = document.getElementById("op-sub");
  const actions = document.querySelector(".op-actions");

  let beat = 0;
  let busy = false;

  function finish() {
    root.classList.add("outro");
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove("outro", "is-visible");
      window.scrollTo(0, 0);
      onDone();
    }, 850);
  }

  function showBeat(i) {
    busy = true;
    actions.classList.remove("show");
    const b = openingBeats()[i];
    progress.textContent = `第 ${i + 1} / ${OPENING_BEATS.length} 回`;

    if (i === 0) {
      seal.classList.add("show");
      title.classList.add("show");
      sub.classList.add("show");
    }

    textEl.innerHTML = "";
    b.paragraphs.forEach((p, idx) => {
      const el = document.createElement("p");
      el.innerHTML = p.html;
      textEl.appendChild(el);
      setTimeout(() => el.classList.add("show"), 280 + idx * 420);
    });

    const wait = 280 + b.paragraphs.length * 420 + 200;
    setTimeout(() => {
      nextBtn.textContent = i >= OPENING_BEATS.length - 1 ? "启程" : "继续";
      actions.classList.add("show");
      busy = false;
    }, wait);
  }

  nextBtn.onclick = () => {
    if (busy) return;
    if (beat >= OPENING_BEATS.length - 1) {
      finish();
      return;
    }
    beat += 1;
    showBeat(beat);
  };
  skipBtn.onclick = () => {
    finish();
  };

  showBeat(0);
  requestAnimationFrame(() => root.classList.add("is-visible"));

  return {
    replay() {
      root.hidden = false;
      root.classList.remove("outro");
      root.classList.remove("is-visible");
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.add("is-visible"));
      beat = 0;
      seal.classList.remove("show");
      title.classList.remove("show");
      sub.classList.remove("show");
      void seal.offsetWidth;
      showBeat(0);
    },
  };
}
