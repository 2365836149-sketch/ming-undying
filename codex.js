/**
 * 图鉴：捡到过的兵器甲胄杂物、打倒过的敌人、走到过的结局。
 * 记在 localStorage 里，跨存档保留；新游戏、读档都不清。
 */
const Codex = (() => {
  const KEY = "ming-codex-v1";
  let book = { item: {}, enemy: {}, ending: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw) book = { item: raw.item || {}, enemy: raw.enemy || {}, ending: raw.ending || {} };
  } catch (_) { /* 读不到就从空的开始 */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(book)); } catch (_) {}
  }

  /** 记一笔；结局顺带记下当时的结语 */
  function see(kind, id, text) {
    if (!book[kind] || !id) return;
    if (book[kind][id] && !(kind === "ending" && text)) return;
    book[kind][id] = kind === "ending" ? text || book[kind][id] || 1 : 1;
    save();
  }

  /** 身上有的都算见过 */
  function seeOwned(S) {
    let changed = false;
    const mark = (id) => {
      if (id && WORLD.items[id] && !book.item[id]) { book.item[id] = 1; changed = true; }
    };
    ["bagPieces", "weaponPieces", "armorPieces"].forEach((k) => (S[k] || []).forEach((p) => mark(p.id)));
    (S.evidence || []).forEach(mark);
    if (S.equipped) mark(S.equipped.charm);
    if (changed) save();
  }

  /* 敌人：按名字算一种，立绘取第一次出场的那张 */
  const ENEMY_LORE = {
    变异勇士: "勇字营的兵，补子还穿在身上。官道上最常撞见的就是这种。",
    变异村民: "村里没逃出去的人，饿极了先吃了自家的鸡犬，后来就吃人。",
    锦衣行尸: "奉旨西去寻药的锦衣卫，药没送到，人先变了。腰里还挂着牙牌。",
    城门尸卫: "守门的兵丁，叫铁链拴在门轴上，拴住了身子，拴不住那张嘴。",
    街尸: "内城的百姓，三五成群，听见铃声就往一处涌。",
    轿中尸: "坐轿的老爷，轿夫跑了，他还端坐在里头，一出来就要人抬。",
    道士行尸: "当初在御前进药的道士，自己也服了一丸，如今守在观里不肯走。",
    溃兵行尸: "从城头败下来的兵，挤在瓮城里出不去，就这么烂在了一处。",
    溃兵头目: "独臂的老兵头，一只手提刀，喊的还是当年的军令。",
    谷中行尸: "药谷里采药的人，日日闻那药气，最先变的就是他们。",
    长生祸首: "服丹求长生的那位。长生是长生了，只是再也不算是人。",
    溃兵骑手: "从边上败回来的骑兵，马死了也不肯下来，冲起来比活人还快。",
    刽子手行尸: "菜市口砍了一辈子头的刽子手，如今还守着那座刑台，出刀慢，落下来却要人命。",
    患疫郎中: "惠民药局的郎中，给病人看了一个月的病，自己也成了病。咬一口，疫气便跟着进来。",
    更夫行尸: "打更的老头，死了还记着时辰，锣一响，满街的行尸都循声过来。",
  };

  function enemyList() {
    const out = [];
    const seenName = new Set();
    Object.values(COMBAT.templates).forEach((t) => {
      (t.enemies || []).forEach((e) => {
        if (seenName.has(e.name)) return;
        seenName.add(e.name);
        out.push({ id: e.name, name: e.name, hp: e.hp, atk: e.atk, pic: COMBAT.portraits[e.id], lore: ENEMY_LORE[e.name] || "" });
      });
    });
    return out;
  }

  const TABS = [
    { id: "weapon", name: "兵器", list: () => itemsOf((it) => it.slot === "weapon") },
    { id: "armor", name: "甲胄", list: () => itemsOf((it) => it.slot === "armor") },
    { id: "misc", name: "杂物", list: () => itemsOf((it) => it.slot !== "weapon" && it.slot !== "armor") },
    { id: "enemy", name: "敌人", list: () => enemyList() },
    { id: "ending", name: "结局", list: () => Object.keys(WORLD.endings).map((id) => ({ id, name: WORLD.endings[id].replace(/^结局 · /, "") })) },
  ];

  function itemsOf(pred) {
    return Object.entries(WORLD.items).filter(([, it]) => pred(it)).map(([id, it]) => ({ id, name: it.name, pic: it.icon, it }));
  }

  function known(tab, e) {
    if (tab === "enemy") return !!book.enemy[e.id];
    if (tab === "ending") return !!book.ending[e.id];
    return !!book.item[e.id];
  }

  function statLine(it) {
    const p = [];
    if (it.slot === "weapon") {
      if (it.dmg != null) p.push(`伤 ${it.dmg}`);
      if (it.combo) p.push(`连击 ${it.combo + 1}`);
      if (typeof firearmSpec === "function" && firearmSpec(it.id || "")) p.push("火器");
    } else if (it.slot === "armor") {
      p.push(it.part === "head" ? "头盔" : "身甲");
      if (it.def) p.push(`防 ${it.def}`);
      if (it.staminaPenalty) p.push(`体力上限 ${it.staminaPenalty}`);
    } else if (it.food) {
      p.push(`饱腹 +${it.fill}`);
      if (it.hp) p.push(`气血 +${it.hp}`);
      if (it.stamina) p.push(`体力 +${it.stamina}`);
    } else if (it.slot === "key") p.push("证物");
    else if (it.slot === "charm") p.push("符箓");
    else if (it.slot === "ammo") p.push("弹药");
    return p.join(" · ");
  }

  /* ---------- 界面 ---------- */
  let tab = "weapon";
  let pick = null;

  function ensureDom() {
    if (document.getElementById("codex-modal")) return;
    document.body.insertAdjacentHTML("beforeend", `
<div id="codex-modal" class="codex-modal" hidden>
  <div class="codex-panel px-frame">
    <header class="codex-head">
      <h2>图鉴</h2>
      <p class="codex-count" id="codex-count"></p>
      <button type="button" class="px-btn" id="codex-close">合上</button>
    </header>
    <nav class="codex-tabs" id="codex-tabs"></nav>
    <div class="codex-body">
      <div class="codex-grid" id="codex-grid"></div>
      <aside class="codex-detail" id="codex-detail"></aside>
    </div>
  </div>
</div>`);
    document.getElementById("codex-close").onclick = close;
    document.getElementById("codex-modal").addEventListener("click", (e) => {
      if (e.target.id === "codex-modal") close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.getElementById("codex-modal").hidden) close();
    });
  }

  function paint() {
    const T = TABS.find((t) => t.id === tab);
    const list = T.list();
    const total = TABS.reduce((n, t) => n + t.list().length, 0);
    const got = TABS.reduce((n, t) => n + t.list().filter((e) => known(t.id, e)).length, 0);
    document.getElementById("codex-count").textContent = `已录 ${got} / ${total}`;

    const tabs = document.getElementById("codex-tabs");
    tabs.innerHTML = "";
    TABS.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "codex-tab" + (t.id === tab ? " on" : "");
      const n = t.list().filter((e) => known(t.id, e)).length;
      /* 名字和计数分开放，各自翻译，免得撞上别的模板 */
      b.innerHTML = `<span>${t.name}</span> <span>${n}/${t.list().length}</span>`;
      b.onclick = () => { tab = t.id; pick = null; paint(); };
      tabs.appendChild(b);
    });

    const grid = document.getElementById("codex-grid");
    grid.innerHTML = "";
    grid.classList.toggle("codex-grid-text", tab === "ending");
    list.forEach((e) => {
      const k = known(tab, e);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "codex-cell" + (k ? "" : " unknown") + (pick === e.id ? " sel" : "");
      if (tab === "ending") {
        b.textContent = k ? e.name : "？？？";
      } else {
        if (e.pic) {
          const img = document.createElement("img");
          img.src = e.pic;
          img.alt = "";
          b.appendChild(img);
        }
        const nm = document.createElement("span");
        nm.className = "codex-name";
        nm.textContent = k ? e.name : "？？？";
        b.appendChild(nm);
      }
      b.onclick = () => { pick = e.id; paint(); };
      grid.appendChild(b);
    });

    const d = document.getElementById("codex-detail");
    d.innerHTML = "";
    const e = list.find((x) => x.id === pick);
    if (!e) {
      d.innerHTML = `<p class="codex-hint">捡到、打倒、走到过的，都会记在这里。死了重来也不会忘。</p>`;
      return;
    }
    const k = known(tab, e);
    const h = document.createElement("h3");
    h.textContent = k ? e.name : "？？？";
    d.appendChild(h);
    if (e.pic && tab !== "ending") {
      const box = document.createElement("div");
      box.className = "codex-pic" + (k ? "" : " unknown");
      const img = document.createElement("img");
      img.src = e.pic;
      img.alt = "";
      box.appendChild(img);
      d.appendChild(box);
    }
    const p = document.createElement("p");
    p.className = "codex-text";
    if (!k) {
      p.textContent = tab === "enemy" ? "还没打倒过。" : tab === "ending" ? "还没走到这一步。" : "还没见过。";
    } else if (tab === "enemy") {
      p.textContent = `气血 ${e.hp} · 出手 ${e.atk}\n${e.lore}`;
    } else if (tab === "ending") {
      p.textContent = typeof book.ending[e.id] === "string" ? book.ending[e.id] : "";
    } else {
      const line = statLine({ ...e.it, id: e.id });
      p.textContent = (line ? line + "\n" : "") + (e.it.desc || "");
    }
    d.appendChild(p);
  }

  function open() {
    ensureDom();
    pick = null;
    paint();
    const m = document.getElementById("codex-modal");
    m.hidden = false;
  }

  function close() {
    const m = document.getElementById("codex-modal");
    if (m) m.hidden = true;
  }

  return { see, seeOwned, open, close, get book() { return book; } };
})();
