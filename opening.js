/** 序章：说得明白，像讲故事，不硬装文言 */

const OPENING_BEATS = [
  {
    seal: true,
    title: true,
    paragraphs: [
      { html: "弘治年间一个冬天，宫里摆夜宴，酒香飘出宫墙，烛火却看着发虚。" },
      { html: "皇上睡不好，满脑子就惦记一件事——<span class=\"verse\">长生</span>。" },
    ],
  },
  {
    paragraphs: [
      { html: "第二天一早，密旨出了宫，派锦衣卫百户往西走。" },
      { html: "百户带着人进了大雪山谷，找传说里的<span class=\"verse\">不死药</span>。谷里没鸟兽，雪深过膝。" },
      { html: "岩缝里真有一只玉瓶，凉得很，像还在喘气。" },
    ],
  },
  {
    paragraphs: [
      { html: "百户回京，跪着把药献上去。皇上也不多问，仰头喝干。" },
      { html: "大殿先是静着，随后骨头喀喀响，像皮肉里头自己在重排。" },
      { html: "龙椅上那人张开嘴——牙已经不像人的牙了。" },
    ],
  },
  {
    paragraphs: [
      { html: "他先扑倒近侍，咬住喉咙，又撕开宫女肩背。金砖上血流成线。" },
      { html: "城门没关严，逃出来的车马、商贩、信使，把祸事带出皇城，越传越远。" },
      { html: "外头都说京师闹瘟，哪知道根子就在那道求长生的旨意上。" },
    ],
  },
  {
    paragraphs: [
      { html: "过了几个月。你走在进京的官道上，风雪直往领子里钻。" },
      { html: "村里老人说：京城跟饿鬼窝似的，可还是有人往里闯——寻亲人的，探实情的，也有惦记那瓶药的。" },
      { html: "你握紧刀柄。京城里的行尸不好对付——沿途若能换上更好的兵器与护甲，兴许还能撑得住。" },
      { html: "<span class=\"verse\">闲话少说，且看你如何进京。</span>" },
    ],
  },
];

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
    const b = OPENING_BEATS[i];
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
