// ===== Snugz landing page =====
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- nav: always solid and always visible ---------- */
const nav = $("#nav");

/* ---------- mobile menu ---------- */
const menuBtn = $("#menuBtn");
menuBtn.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  menuBtn.setAttribute("aria-expanded", open);
});
$$("#mobileMenu a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
$$(".rv, .rv-pop").forEach((el) => io.observe(el));

// wordmark (S → N → U → G → Z) and pop-in words replay each time they scroll into view
const replay = new IntersectionObserver((entries) => {
  entries.forEach((e) => e.target.classList.toggle("in", e.isIntersecting));
}, { threshold: 0.4 });
$$(".wordmark, .final").forEach((el) => replay.observe(el));

/* ---------- hero demo: scan → chips ping → L picked → verdict ---------- */
const card = $("#pcard"), chips = $$("#chips .chip"), verdict = $("#verdict");
function demo() {
  card.classList.remove("scanning"); void card.offsetWidth; card.classList.add("scanning");
  chips.forEach((c) => c.classList.remove("hit", "ping"));
  verdict.classList.remove("show");
  chips.forEach((c, i) => setTimeout(() => { c.classList.add("ping"); setTimeout(() => c.classList.remove("ping"), 240); }, 900 + i * 160));
  setTimeout(() => { chips[2].classList.add("hit"); verdict.classList.add("show"); }, 900 + chips.length * 160 + 200);
}
setTimeout(demo, 500);
if (!RM) setInterval(demo, 6500);

/* ---------- fit builder: one question at a time ---------- */
const SHIRT = `<path d="M42 14 L18 26 L4 54 L22 62 L30 48 L30 108 L90 108 L90 48 L98 62 L116 54 L102 26 L78 14 Q60 28 42 14Z" stroke="#0A0033" stroke-width="5" stroke-linejoin="round" fill="#F4ECFF"/>`;
const JEANS = `<path d="M30 10 H90 L97 110 H67 L60 52 L53 110 H23 Z" stroke="#0A0033" stroke-width="5" stroke-linejoin="round" fill="#F4ECFF"/><path d="M30 20 H90" stroke="#0A0033" stroke-width="3"/>`;
const line = (d) => `<path d="${d}" stroke="#FE8501" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 10"/>`;
const Q = [
  { cat: "Shirts", t: "What's your chest?", h: "Wrap the tape around the fullest part of your chest, under your arms.", v: 40, min: 28, max: 56, step: 0.5, svg: SHIRT + line("M32 58 H88") },
  { cat: "Shirts", t: "Shoulder width?", h: "Across your back, from one shoulder tip to the other.", v: 17.5, min: 12, max: 24, step: 0.5, svg: SHIRT + line("M20 24 H100") },
  { cat: "Shirts", t: "Sleeve length?", h: "From your shoulder tip down to your wrist, arm relaxed.", v: 25, min: 18, max: 32, step: 0.5, svg: SHIRT + line("M103 30 L114 52") },
  { cat: "Jeans", t: "Jeans waist?", h: "Around the spot where your jeans usually sit.", v: 32, min: 22, max: 50, step: 1, svg: JEANS + line("M32 14 H88") },
  { cat: "Jeans", t: "Jeans length?", h: "Inside leg, from the crotch down to your ankle.", v: 31, min: 24, max: 38, step: 1, svg: JEANS + line("M62 56 L66 104") },
];
let qi = 0, unit = "in";
const fmt = (inch) => unit === "in" ? `${+inch.toFixed(1)}<small>in</small>` : `${Math.round(inch * 2.54)}<small>cm</small>`;
function drawQ(animate = true) {
  const q = Q[qi];
  $("#qCount").textContent = qi < Q.length ? `Question ${qi + 1} of ${Q.length}` : "Done";
  $$("#qBars i").forEach((b, k) => b.classList.toggle("on", k <= qi));
  $("#qBody").innerHTML = `<div class="${animate ? "q-anim" : ""}">
    <span class="q-cat">${q.cat}</span>
    <div class="q-title">${q.t}</div>
    <div class="q-help"><svg viewBox="0 0 120 120" fill="none">${q.svg}</svg><span>${q.h}</span></div>
  </div>`;
  $("#qVal").innerHTML = fmt(q.v);
  $("#qBack").disabled = qi === 0;
  $("#qNext").innerHTML = qi === Q.length - 1 ? "Save my fit" : `Next <svg class="arrow"><use href="#i-arrow"/></svg>`;
}
function bump(dir) {
  const q = Q[qi];
  q.v = Math.min(q.max, Math.max(q.min, Math.round((q.v + dir * q.step) * 10) / 10));
  const out = $("#qVal");
  out.innerHTML = fmt(q.v);
  if (!RM) out.animate([{ transform: `translateY(${dir * -6}px)` }, { transform: "none" }], { duration: 180, easing: "ease-out" });
}
$("#qPlus").addEventListener("click", () => bump(1));
$("#qMinus").addEventListener("click", () => bump(-1));
$("#qBack").addEventListener("click", () => { if (qi > 0) { qi--; drawQ(); } });
$("#qNext").addEventListener("click", () => {
  if (qi < Q.length - 1) { qi++; drawQ(); return; }
  // last question: hand the answers to the real sign-up flow
  sessionStorage.setItem("snugzDraft", JSON.stringify(Object.fromEntries(Q.map((q, i) => [["chest", "shoulder", "sleeve", "waist", "length"][i], q.v]))));
  go("onboarding.html?from=try");
});
$$(".unit button").forEach((b) => b.addEventListener("click", () => {
  unit = b.dataset.u;
  $$(".unit button").forEach((x) => x.classList.toggle("on", x === b));
  $("#qVal").innerHTML = fmt(Q[qi].v);
}));
drawQ(false);

/* ---------- FAQ: one open at a time, smooth height ---------- */
$$(".faq-item").forEach((item) => {
  const btn = $(".faq-q", item);
  btn.addEventListener("click", () => {
    const open = !item.classList.contains("open");
    $$(".faq-item.open").forEach((o) => { o.classList.remove("open"); $(".faq-q", o).setAttribute("aria-expanded", "false"); });
    item.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open);
  });
});

/* ---------- placeholders until backend / store listing exist ---------- */
$$(".chrome").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  toast("The Chrome Web Store link goes here once the extension is published.");
}));
$("#news").addEventListener("submit", (e) => {
  e.preventDefault();
  e.target.innerHTML = `<span class="sticker mint" style="transform:none">You're on the list ✓</span>`;
});

function toast(msg) {
  const t = document.createElement("div");
  t.className = "sticker white";
  t.style.cssText = "position:fixed;left:50%;bottom:28px;z-index:300;transform:translateX(-50%);height:auto;padding:12px 18px;max-width:90vw;";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ---------- page wipe between pages ---------- */
const wipe = $("#wipe");
function go(href) {
  if (RM) { location.href = href; return; }
  wipe.classList.remove("out"); wipe.classList.add("on");
  setTimeout(() => (location.href = href), 480);
}
$$("a.go").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.getAttribute("href")); }));
addEventListener("pageshow", () => { wipe.classList.remove("on"); });
