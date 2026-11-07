/**
 * 中英切换。游戏文字照旧用中文写进页面，这里在显示时替换：
 *   1. 整句查字典（I18N.add）
 *   2. 带变量的句子按模板匹配（I18N.addPatterns，{0}{1} 是变量，变量里的中文也会再翻）
 *   3. 都查不到就按换行、「 · 」拆开逐段翻
 * 用 MutationObserver 盯着页面，新写进来的文字自动翻；切回中文时还原原文。
 * 切换时整页（含日志栏里已有的文字）一起换。
 */
const I18N = (() => {
  const KEY = "ming-lang";
  const CJK = /[一-鿿]/;
  const exact = new Map();
  const patterns = [];
  const original = new WeakMap(); /* 文本节点 -> 中文原文 */
  const lastSet = new WeakMap(); /* 文本节点 -> 我们最后写进去的内容（防止自己触发自己） */
  const missing = new Set();
  let lang = "zh";
  try {
    lang = localStorage.getItem(KEY) || (/^zh/i.test(navigator.language || "") ? "zh" : "en");
  } catch (_) { /* 无痕模式读不到也照常 */ }

  function add(dict) {
    Object.entries(dict).forEach(([zh, en]) => { if (en) exact.set(zh, en); });
  }

  /** [[中文模板, 英文模板], ...]，模板里用 {0} {1} 标变量 */
  function addPatterns(list) {
    list.forEach(([zh, en]) => {
      if (!en) return;
      const order = [];
      const src = zh.split(/(\{\d+\})/).map((part) => {
        const m = /^\{(\d+)\}$/.exec(part);
        if (m) { order.push(+m[1]); return "([\\s\\S]*?)"; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("");
      patterns.push({ re: new RegExp("^" + src + "$"), order, en });
    });
    /* 长的模板先试，免得被短的抢先 */
    patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  }

  function tr(text) {
    if (lang !== "en" || !text || !CJK.test(text)) return text;
    const lead = /^\s*/.exec(text)[0];
    const tail = /\s*$/.exec(text)[0];
    const core = text.slice(lead.length, text.length - tail.length);
    return lead + trCore(core) + tail;
  }

  function trCore(s) {
    if (!CJK.test(s)) return s;
    if (exact.has(s)) return exact.get(s);
    if (s.includes("\n")) return s.split("\n").map((l) => (l.trim() ? tr(l) : l)).join("\n");
    for (const p of patterns) {
      const m = p.re.exec(s);
      if (!m) continue;
      return p.en.replace(/\{(\d+)\}/g, (_, i) => {
        const v = m[p.order.indexOf(+i) + 1];
        return v == null ? "" : trCore(v);
      });
    }
    for (const sep of [" · ", "  · ", "；", "　"]) {
      if (s.includes(sep)) {
        const parts = s.split(sep).map((x) => trCore(x.trim()));
        return parts.join(sep.trim() === "·" ? " · " : sep === "；" ? "; " : " ");
      }
    }
    /* 两句直接拼在一起（正文 + 渴染变体）：按句末标点拆开逐句翻 */
    const sentences = s.match(/[^。！？]+[。！？」』]*/g);
    if (sentences && sentences.length > 1) {
      /* 从当前句起尽量多句连着查字典，查不到再缩短 */
      const out = [];
      for (let i = 0; i < sentences.length;) {
        let j = sentences.length;
        for (; j > i + 1; j--) if (exact.has(sentences.slice(i, j).join("").trim())) break;
        out.push(trCore(sentences.slice(i, j).join("").trim()));
        i = j;
      }
      if (out.every((x) => !CJK.test(x))) return out.join(" ");
    }
    /* 【地名】这种包了括号的 */
    const br = /^([【「『（(])(.*)([】」』）)])([。.]?)$/.exec(s);
    if (br && CJK.test(br[2])) {
      const inner = trCore(br[2]);
      if (inner !== br[2]) return (br[1] === "【" ? "[" : br[1] === "（" ? "(" : "“") + inner + (br[3] === "】" ? "]" : br[3] === "）" ? ")" : "”") + (br[4] ? "." : "");
    }
    missing.add(s);
    return s;
  }

  /* ---------- 页面文字 ---------- */
  const SKIP = "script, style, [data-no-i18n]";
  let observer = null;

  function setNode(node) {
    const cur = node.data;
    if (lastSet.get(node) === cur) return;
    /* 被游戏改写过：记下新的原文 */
    original.set(node, cur);
    const out = tr(cur);
    if (out !== cur) {
      lastSet.set(node, out);
      node.data = out;
    } else {
      lastSet.set(node, cur);
    }
  }

  function walk(root) {
    if (root.nodeType === 3) {
      const p = root.parentElement;
      if (p && !p.closest(SKIP)) setNode(root);
      return;
    }
    if (root.nodeType !== 1 || root.matches(SKIP)) return;
    ["title", "aria-label", "alt", "placeholder"].forEach((a) => {
      const v = root.getAttribute(a);
      if (!v || !CJK.test(v) && !root.dataset["i18nOrig" + a.replace("-", "")]) return;
      const k = "i18nOrig" + a.replace("-", "");
      const orig = root.dataset[k] || v;
      if (CJK.test(v)) root.dataset[k] = v;
      root.setAttribute(a, lang === "en" ? tr(orig) : orig);
    });
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) walk(n);
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver((list) => {
      list.forEach((m) => {
        if (m.type === "characterData") walk(m.target);
        else m.addedNodes.forEach((n) => walk(n));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    walk(document.body);
    applyDocument();
  }

  function applyDocument() {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.body.classList.toggle("lang-en", lang === "en");
    if (!document.documentElement.dataset.titleZh) document.documentElement.dataset.titleZh = document.title;
    document.title = lang === "en" ? tr(document.documentElement.dataset.titleZh) : document.documentElement.dataset.titleZh;
  }

  /** 切语言：整页立即换，日志也一起换 */
  function setLang(next) {
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (_) {}
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) continue;
      const orig = original.has(n) ? original.get(n) : n.data;
      original.set(n, orig);
      const out = tr(orig);
      lastSet.set(n, out);
      n.data = out;
    }
    walk(document.body);
    applyDocument();
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  return {
    add, addPatterns, tr, start, setLang,
    get lang() { return lang; },
    missing: () => [...missing],
  };
})();
