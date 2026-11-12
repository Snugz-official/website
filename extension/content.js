// ===== Snugz content script: runs on Myntra / Flipkart product pages =====
// 1. finds the size chart on the page (as soon as it appears)
// 2. compares it with the saved fit profile
// 3. shows the "Your size here" card and highlights that size button
(function () {
  if (window.__snugzLoaded) return;
  window.__snugzLoaded = true;

  const isProductPage = () =>
    (location.hostname.includes("myntra.com") && /\/buy\b/.test(location.pathname)) ||
    (location.hostname.includes("flipkart.com") && /\/p\//.test(location.pathname)) ||
    document.documentElement.hasAttribute("data-snugz-test");

  const store = {
    get: () => new Promise((res) => {
      if (globalThis.chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get("snugz", (d) => res(d.snugz || {}));
      else res(window.__snugzTest || {});
    }),
  };
  const scriptBase = (document.currentScript && document.currentScript.src) || location.href;
  const iconURL = () => (globalThis.chrome && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("icons/icon-48.png") : new URL("icons/icon-48.png", scriptBase).href;

  /* ---------- what kind of product is this? ---------- */
  function productKind() {
    const text = [document.title, ...[...document.querySelectorAll("h1, h2, nav, [class*='breadcrumb']")].slice(0, 12).map((e) => e.textContent)]
      .join(" ").toLowerCase();
    // the garment word nearest the end decides: "Pepe Jeans Men Polo T-Shirt" is a top
    const BOTTOM = /\b(jeans|trousers?|pants|chinos|joggers|track ?pants|shorts|leggings|jeggings)\b/;
    const TOP = /\b(shirts?|t-?shirts?|tees?|tops?|polos?|kurtas?|kurtis?|sweatshirts?|hoodies?|jackets?|blazers?|sweaters?|tunics?)\b/;
    for (const t of [document.title.toLowerCase(), text]) {
      let last = null;
      for (const m of t.matchAll(new RegExp(`${BOTTOM.source}|${TOP.source}`, "g"))) last = m[0];
      if (last) return BOTTOM.test(last) ? "bottom" : "top";
    }
    return null;
  }

  /* ---------- read size-chart tables from the page ---------- */
  const COLS = [
    ["chest", /\b(chest|bust)\b/],
    ["shoulder", /shoulder/],
    ["sleeve", /sleeve/],
    ["waist", /\bwaist\b/],
    ["length", /inseam|inside ?leg|leg length|^length\b|\blength\b/],
  ];
  const cellText = (c) => c.textContent.replace(/\s+/g, " ").trim();

  function tableRows(el) {
    // <table>, ARIA tables, and div grids that use role="row"
    const rows = el.matches("table") ? [...el.rows] : [...el.querySelectorAll("[role='row']")];
    return rows.map((r) => [...(r.cells || r.querySelectorAll("[role='cell'],[role='columnheader'],[role='gridcell']"))].map(cellText))
      .filter((r) => r.length > 1);
  }

  function readChart(el, kind) {
    const rows = tableRows(el);
    if (rows.length < 2) return null;
    const head = rows[0].map((h) => h.toLowerCase());
    const map = {};
    head.forEach((h, i) => {
      for (const [key, re] of COLS) {
        if (map[key] != null) continue;
        if (key === "length" && kind === "top") continue;         // a shirt's "length" is garment length, not inseam
        if (key === "length" && /front|back|garment|total|outseam/.test(h) && !/inseam|inside/.test(h)) continue;
        if (re.test(h)) { map[key] = i; break; }
      }
    });
    const needed = kind === "bottom" ? ["waist"] : ["chest"];
    if (!needed.some((k) => map[k] != null)) return null;
    const sizeCol = Math.max(0, head.findIndex((h) => /size/.test(h)));
    const tableText = (el.closest("[class*='modal'], [role='dialog']") || el).textContent.toLowerCase();
    const unit = /\bcm\b/.test(head.join(" ")) ? "cm" : /\b(in|inch|inches)\b/.test(head.join(" ")) ? "in" : null;
    const out = rows.slice(1).map((r) => {
      const row = { size: r[sizeCol] };
      for (const k in map) row[k] = r[map[k]];
      return row;
    }).filter((r) => r.size && r.size.length <= 8);
    if (!out.length) return null;
    // unit fallback: chests/waists above ~60 can only be centimetres
    const sample = SnugzMatch.parseRange(out[0].chest || out[0].waist || "");
    const finalUnit = unit || (sample && sample[0] > 60 ? "cm" : "in");
    const type = /garment|product measurement/.test(tableText) && !/body measurement/.test(head.join(" ")) ? "garment" : "body";
    return { kind, unit: finalUnit, type, rows: out };
  }

  function findChart(kind) {
    const candidates = [...document.querySelectorAll("table, [role='table'], [role='grid']")];
    for (const el of candidates) {
      if (el.closest("#snugz-card")) continue;
      const chart = readChart(el, kind);
      if (chart) return chart;
    }
    return null;
  }

  /* ---------- automatic charts: read the store's own size data, no click needed ---------- */
  // Measurement names used by the stores → our keys
  function keyFor(name, kind) {
    const n = name.toLowerCase();
    if (/\b(chest|bust)\b/.test(n)) return "chest";
    if (/shoulder/.test(n)) return "shoulder";
    if (/sleeve/.test(n)) return "sleeve";
    if (/waist/.test(n)) return "waist";
    if (kind === "bottom" && /inseam|inside leg/.test(n)) return "length";
    return null;
  }
  const unitOf = (u) => (/cm|centi/i.test(u || "") ? "cm" : "in");

  // Myntra: every product page carries window.__myx with each size's measurements.
  // Content scripts can't see page variables, so read it from the page's <script> text
  // (or re-download the page if Myntra switched products without reloading).
  async function myntraChart(kind) {
    const id = (location.pathname.match(/\/(\d+)\/buy/) || [])[1];
    if (!id) return null;
    const parse = (text) => {
      const i = text.indexOf("window.__myx");
      if (i < 0) return null;
      const start = text.indexOf("{", i);
      const end = text.indexOf("</script>", start);
      try { return JSON.parse(text.slice(start, end < 0 ? undefined : end).trim().replace(/;\s*$/, "")); } catch (_) { return null; }
    };
    let myx = null;
    for (const s of document.scripts) if (!s.src && s.textContent.includes("window.__myx")) { myx = parse(s.textContent); if (myx) break; }
    if (!myx || !myx.pdpData || String(myx.pdpData.id) !== id) {
      try { myx = parse(await (await fetch(location.href, { credentials: "include" })).text()); } catch (_) { return null; }
    }
    const sizes = myx && myx.pdpData && myx.pdpData.sizes;
    if (!sizes || !sizes.length) return null;
    const types = {};
    let unit = "in";
    const rows = sizes.map((s) => {
      const row = { size: s.label };
      for (const m of s.measurements || []) {
        const k = keyFor(m.name, kind);
        if (!k || row[k] != null) continue;
        row[k] = m.minValue && m.maxValue && m.minValue !== m.maxValue ? `${m.minValue}-${m.maxValue}` : m.value;
        types[k] = /body/i.test(m.type || m.measurementType) ? "body" : "garment";
        unit = unitOf(m.unit);
      }
      return row;
    }).filter((r) => Object.keys(r).length > 1);
    return rows.length >= 2 ? { kind, unit, type: "body", types, rows, source: "auto" } : null;
  }

  // Flipkart: the size chart comes from Flipkart's own size-chart service for this product id.
  async function flipkartChart(kind) {
    const canon = (document.querySelector("link[rel='canonical']") || {}).href || "";
    const pid = new URLSearchParams(location.search).get("pid") || (canon.match(/[?&]pid=([A-Z0-9]+)/) || [])[1];
    if (!pid) return null;
    try {
      const res = await fetch("https://2.rome.api.flipkart.com/3/product/size-chart", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-User-Agent": navigator.userAgent + " FKUA/website/42/website/Desktop" },
        body: JSON.stringify({ pids: [pid] }),
      });
      const info = (((await res.json()).RESPONSE || {}).data || {})[pid];
      const sc = info && info.sizeChartInfo;
      if (!sc || !sc.headers || !sc.rows) return null;
      const byId = {}; let unit = "in"; let sizeId = null;
      for (const h of sc.headers) {
        if (sizeId == null && /^size$/i.test(h.headerName.trim())) sizeId = h.headerId;
        const k = keyFor(h.headerName, kind);
        if (k && !Object.values(byId).includes(k)) { byId[h.headerId] = k; if (h.qualifier) unit = unitOf(h.qualifier); }
      }
      if (sizeId == null) sizeId = sc.headers[0].headerId;
      const rows = sc.rows.map((r) => {
        const row = {};
        for (const c of r.cells) { if (c.headerId === sizeId) row.size = c.value; else if (byId[c.headerId]) row[byId[c.headerId]] = c.value; }
        return row;
      }).filter((r) => r.size && Object.keys(r).length > 1);
      return rows.length >= 2 ? { kind, unit, type: "body", rows, source: "auto" } : null;
    } catch (_) { return null; }
  }

  const autoCache = {};
  async function autoChart(kind) {
    const key = location.pathname + location.search + kind;
    if (!(key in autoCache)) {
      autoCache[key] = location.hostname.includes("myntra.com") ? myntraChart(kind)
        : location.hostname.includes("flipkart.com") ? flipkartChart(kind) : Promise.resolve(null);
    }
    return autoCache[key];
  }

  /* ---------- highlight the matching size button ---------- */
  function highlightSize(size) {
    document.querySelectorAll(".snugz-hit").forEach((e) => e.classList.remove("snugz-hit"));
    const want = size.trim().toUpperCase();
    // Sites scramble class names (Flipkart), so look for small visible elements whose text is exactly the size,
    // preferring ones near a "Select Size" label. Skip the size chart itself and our card.
    const anchor = [...document.querySelectorAll("div, span, p, h2, h3")]
      .find((e) => e.children.length === 0 && /^select size$/i.test(cellText(e)));
    const scope = anchor ? (anchor.closest("div") && anchor.closest("div").parentElement && anchor.closest("div").parentElement.parentElement) || document.body : document.body;
    const pick = (root) => [...root.querySelectorAll("button, a, li, div, span, p")].find((el) => {
      if (el.closest("#snugz-card, table, [role='dialog']")) return false;
      if (cellText(el).toUpperCase() !== want || el.querySelector("*:not(span)")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.width < 140 && r.height > 0 && r.height < 90;
    });
    const el = pick(scope) || pick(document.body);
    if (el) {
      // ring the clickable chip, not just the text inside it
      let chip = el;
      while (chip.parentElement && cellText(chip.parentElement).toUpperCase() === want && chip.parentElement.getBoundingClientRect().width < 140) chip = chip.parentElement;
      chip.classList.add("snugz-hit");
    }
  }

  /* ---------- the card ---------- */
  let card;
  function ensureCard() {
    if (card) return card;
    card = document.createElement("div");
    card.id = "snugz-card";
    card.setAttribute("role", "status");
    document.body.appendChild(card);
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-snugz-close]")) { card.classList.add("snugz-min"); }
      else if (card.classList.contains("snugz-min")) card.classList.remove("snugz-min");
    });
    return card;
  }
  const head = () => `<div class="snugz-hd"><span><img src="${iconURL()}" alt="">Snugz</span><button data-snugz-close aria-label="Minimise">–</button></div>`;

  function render(state, data = {}) {
    const c = ensureCard();
    const site = (globalThis.SNUGZ_CONFIG && SNUGZ_CONFIG.WEBSITE_URL) || "https://snugz.in";
    if (state === "setup") {
      c.innerHTML = head() + `<p class="snugz-msg">Log in to Snugz (click the Snugz icon in your toolbar) to see your size here.</p>`;
    } else if (state === "noprofile") {
      c.innerHTML = head() + `<p class="snugz-msg">Add your measurements once and Snugz will pick your size.</p><a class="snugz-btn" href="${site}/onboarding.html" target="_blank" rel="noopener">Create my fit profile</a>`;
    } else if (state === "waiting") {
      c.innerHTML = head() + `<p class="snugz-msg"><b>Open the size chart</b> on this page and Snugz will match it to your fit.</p>`;
    } else if (state === "nomatch") {
      c.innerHTML = head() + `<p class="snugz-msg">This size chart doesn't have the measurements Snugz needs. Check the brand's chart manually for this one.</p>`;
    } else if (state === "result") {
      const r = data.result;
      c.innerHTML = head() + `
        <div class="snugz-big"><b>${r.size}</b><p>is your size<br>for this ${data.kind === "bottom" ? "pair" : "piece"}</p></div>
        <div class="snugz-rows">${r.parts.map((p) => `<div><span>${p.label}</span><em class="${p.tone}">${p.word}</em></div>`).join("")}</div>
        <div class="snugz-foot">${r.confidence}% match · ${r.pref} fit · from this product's size chart</div>`;
      highlightSize(r.size);
    }
    c.dataset.state = state;
  }

  /* ---------- main ---------- */
  let lastKey = "";
  async function run() {
    if (!isProductPage()) { if (card) card.remove(), card = null; return; }
    const kind = productKind();
    if (!kind) return;                                  // not clothing we can size yet
    const { session, profile } = await store.get();
    if (!session && !profile) return render("setup");
    if (!profile) return render("noprofile");
    // 1) the store's own size data (works the moment the page opens), 2) a size chart table if one is open
    const chart = (await autoChart(kind)) || findChart(kind);
    if (!chart) { if (!card || card.dataset.state !== "result") render("waiting"); return; }
    const key = JSON.stringify(chart.rows) + JSON.stringify(profile);
    if (key === lastKey) return;
    lastKey = key;
    const result = SnugzMatch.bestSize(chart, profile);
    result ? render("result", { result, kind }) : render("nomatch");
  }

  // size charts usually appear in a pop-up after a click, and these sites change pages
  // without reloading, so watch the page and re-check (throttled).
  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(run, 400); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.addListener(() => { lastKey = ""; schedule(); });
  run();
})();
