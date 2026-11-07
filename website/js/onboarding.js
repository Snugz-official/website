// ===== Snugz onboarding =====
// Steps: 0 account · 1 style · 2–6 measurements · 7 done
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- dummy model: men / women figure + animated measuring tape ---------- */
const BODY = {
  men: "M52 44 L68 44 L90 50 Q96 52 97 60 L104 118 Q105 124 99 124 L94 124 L86 70 L84 108 L86 192 L66 192 L60 122 L54 192 L34 192 L36 108 L34 70 L26 124 L21 124 Q15 124 16 118 L23 60 Q24 52 30 50 Z",
  women: "M53 44 L67 44 L86 50 Q92 52 93 60 L100 116 Q101 122 95 122 L90 122 L82 70 Q78 86 80 96 Q88 108 86 118 L84 192 L65 192 L60 124 L55 192 L36 192 L34 118 Q32 108 40 96 Q42 86 38 70 L30 122 L25 122 Q19 122 20 116 L27 60 Q28 52 34 50 Z",
};
// tape path (front), optional back path (wrap-around measures) and the two end points
const TAPE = {
  men: {
    chest:    { d: "M33 66 Q60 75 87 66", back: "M33 66 Q60 58 87 66", a: [33, 66], b: [87, 66] },
    shoulder: { d: "M30 51 Q60 43 90 51", a: [30, 51], b: [90, 51] },
    sleeve:   { d: "M91 52 L101 121", a: [91, 52], b: [101, 121] },
    waist:    { d: "M36 100 Q60 107 84 100", back: "M36 100 Q60 94 84 100", a: [36, 100], b: [84, 100] },
    length:   { d: "M61 125 L66 189", a: [61, 125], b: [66, 189] },
  },
  women: {
    chest:    { d: "M35 68 Q60 77 85 68", back: "M35 68 Q60 60 85 68", a: [35, 68], b: [85, 68] },
    shoulder: { d: "M34 51 Q60 44 86 51", a: [34, 51], b: [86, 51] },
    sleeve:   { d: "M87 52 L97 119", a: [87, 52], b: [97, 119] },
    waist:    { d: "M41 89 Q60 96 79 89", back: "M41 89 Q60 83 79 89", a: [41, 89], b: [79, 89] },
    length:   { d: "M61 127 L65 189", a: [61, 127], b: [65, 189] },
  },
};
function figure(key) {
  const g = profile.gender === "women" ? "women" : "men";
  const t = TAPE[g][key];
  return `<svg viewBox="0 0 120 200" fill="none" role="img" aria-label="How to measure your ${key}">
    <circle cx="60" cy="22" r="14" fill="#fff" stroke="#0A0033" stroke-width="3"/>
    <path d="${BODY[g]}" fill="#fff" stroke="#0A0033" stroke-width="3" stroke-linejoin="round"/>
    ${t.back ? `<path class="tape-back" d="${t.back}"/>` : ""}
    <mask id="tapeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200">
      <path class="tape-reveal" d="${t.d}" pathLength="1"/>
    </mask>
    <g mask="url(#tapeMask)">
      <path class="tape-edge" d="${t.d}"/>
      <path class="tape" d="${t.d}"/>
      <path class="tick-minor" d="${t.d}"/>
      <path class="tick-major" d="${t.d}"/>
    </g>
    <circle class="pin pin-a" cx="${t.a[0]}" cy="${t.a[1]}" r="4.5"/>
    <circle class="pin pin-b" cx="${t.b[0]}" cy="${t.b[1]}" r="4.5"/>
  </svg>`;
}

const M = [
  { key: "chest", group: "Shirt", label: "Chest", t: "What's your chest?", h: "Wrap the tape around the fullest part of your chest, under your arms. Snug, not tight.", v: 40, min: 28, max: 56, step: 0.5 },
  { key: "shoulder", group: "Shirt", label: "Shoulder", t: "Shoulder width?", h: "Across your back, from one shoulder tip to the other. Easier with a friend.", v: 17.5, min: 12, max: 24, step: 0.5 },
  { key: "sleeve", group: "Shirt", label: "Sleeve", t: "Sleeve length?", h: "From your shoulder tip down to your wrist bone, arm relaxed.", v: 25, min: 18, max: 32, step: 0.5 },
  { key: "waist", group: "Jeans", label: "Waist", t: "Jeans waist?", h: "Around the spot where your jeans usually sit, at or just below the belly button.", v: 32, min: 22, max: 50, step: 1 },
  { key: "length", group: "Jeans", label: "Length", t: "Jeans length?", h: "Inside leg, from the crotch down to your ankle bone.", v: 31, min: 24, max: 38, step: 1 },
];

const profile = { name: "", gender: "men", topFit: "Regular", jeansFit: "Regular", unit: "in", m: {} };
let step = 0;
const LAST = 7;

// carry over answers from the homepage "Try it now" builder
const draft = JSON.parse(sessionStorage.getItem("snugzDraft") || "null");
if (draft) M.forEach((x) => { if (draft[x.key] != null) { x.v = draft[x.key]; profile.m[x.key] = x.v; } });

// login mode
const isLogin = new URLSearchParams(location.search).get("mode") === "login";
if (isLogin) {
  $("#accEyebrow").textContent = "Welcome back";
  $("#accTitle").textContent = "Log in to Snugz.";
  $("#accSub").textContent = "Your fit profile syncs to the extension automatically.";
  $("#nameField").remove();
  $(".row2").style.gridTemplateColumns = "1fr";
  $("#pw").setAttribute("autocomplete", "current-password");
  $("#accBtn").innerHTML = `Log in <svg class="arrow"><use href="#i-arrow"/></svg>`;
  $("#obProgress").style.visibility = "hidden";
}

const fmt = (inch, u = profile.unit) => u === "in" ? `${+(+inch).toFixed(1)} in` : `${Math.round(inch * 2.54)} cm`;
const valHTML = (v) => profile.unit === "in" ? `${+(+v).toFixed(1)}<small>in</small>` : `${Math.round(v * 2.54)}<small>cm</small>`;

/* ---------- navigation ---------- */
function paneFor(s) { return s === 0 ? $('[data-pane="0"]') : s === 1 ? $('[data-pane="1"]') : s === LAST ? $('[data-pane="7"]') : $("#mPane"); }
function show(s) {
  const goingBack = s < step;
  step = s;
  $$(".pane").forEach((p) => p.classList.remove("active", "back"));
  if (s >= 2 && s <= 6) renderMeasure(M[s - 2]);
  const p = paneFor(s);
  if (goingBack) p.classList.add("back");
  void p.offsetWidth; p.classList.add("active");

  // endowed progress: starts at 10% so the finish line already feels close
  const pct = Math.round(10 + (s / LAST) * 90);
  $("#obBar").style.width = pct + "%";
  $("#obBarWrap").setAttribute("aria-valuenow", pct);
  scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" });
}
const next = () => show(Math.min(step + 1, LAST));
const back = () => show(Math.max(step - 1, 0));
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-next]")) { if (step === 6) { finish(); return; } next(); }
  if (e.target.closest("[data-back]")) back();
});

/* ---------- account: real sign-up / log-in with Supabase ---------- */
const SESSION_KEY = "snugzSession";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
const saveSession = (s) => { session = s; s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); };
function accMsg(text, ok = false) {
  const el = $("#accMsg");
  el.hidden = !text; el.textContent = text || ""; el.classList.toggle("ok", ok);
}
function busy(on) {
  const b = $("#accBtn");
  b.disabled = on; b.style.opacity = on ? .6 : 1;
  if (on) b.dataset.label = b.innerHTML, b.textContent = isLogin ? "Logging in…" : "Creating account…";
  else if (b.dataset.label) b.innerHTML = b.dataset.label;
}
$("#accForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  accMsg("");
  captureName();
  const email = $("#email").value.trim(), pw = $("#pw").value;
  busy(true);
  try {
    if (isLogin) {
      saveSession(await SnugzAPI.signIn(email, pw));
      const saved = await SnugzAPI.getProfile(session);
      if (saved) { loadSaved(saved); finish(false); return; }   // already has a fit → straight to the fit card
      next();
    } else {
      const r = await SnugzAPI.signUp(email, pw, profile.name);
      if (r.needsConfirm) { accMsg("Almost there! We sent you a confirmation email. Click the link, then log in.", true); return; }
      saveSession(r.session);
      next();
    }
  } catch (err) {
    accMsg(err.message);
  } finally { busy(false); }
});
$("#googleBtn").addEventListener("click", () => accMsg("Google sign-in is coming soon. Please use email for now."));

// map between the database row and this page's profile object
function toRow() {
  return {
    name: profile.name || null, gender: profile.gender,
    chest: profile.m.chest, shoulder: profile.m.shoulder, sleeve: profile.m.sleeve,
    waist: profile.m.waist, length: profile.m.length,
    top_fit: profile.topFit, jeans_fit: profile.jeansFit, unit: profile.unit,
  };
}
function loadSaved(row) {
  Object.assign(profile, { name: row.name || profile.name, gender: row.gender || "men", topFit: row.top_fit || "Regular", jeansFit: row.jeans_fit || "Regular", unit: row.unit || "in" });
  M.forEach((x) => { if (row[x.key] != null) { profile.m[x.key] = +row[x.key]; x.v = +row[x.key]; } });
}
function captureName() {
  const n = $("#name");
  profile.name = n && n.value.trim() ? n.value.trim().split(/\s+/)[0] : "";
  $("#hiName").textContent = profile.name || "there";
}

/* ---------- style options ---------- */
$$(".opts").forEach((group) => $$(".opt", group).forEach((b) => b.addEventListener("click", () => {
  $$(".opt", group).forEach((x) => x.classList.toggle("on", x === b));
  profile[group.dataset.key] = b.dataset.v;
})));

/* ---------- measurement pane ---------- */
function renderMeasure(x) {
  const i = M.indexOf(x);
  const val = profile.m[x.key] ?? x.v;
  const pct = ((val - x.min) / (x.max - x.min)) * 100;
  const inGroup = i < 3 ? `${i + 1} of 3` : `${i - 2} of 2`;
  $("#mPane").innerHTML = `
    <span class="eyebrow">${x.group} · ${inGroup}</span>
    <h1>${x.t}</h1>
    ${draft && i === 0 ? `<span class="sticker mint kept" style="transform:none">We kept your answers from the homepage ✓</span>` : ""}
    <div class="m-grid">
      <div class="fig">${figure(x.key)}<span class="fig-tag">How to measure</span></div>
      <p class="m-tip">${x.h}</p>
      <div class="picker">
        <button type="button" class="picker-btn" data-d="-1" aria-label="Decrease"><svg><use href="#i-minus"/></svg></button>
        <output id="mVal" aria-live="polite">${valHTML(val)}</output>
        <button type="button" class="picker-btn" data-d="1" aria-label="Increase"><svg><use href="#i-plus"/></svg></button>
      </div>
      <div class="m-range">
        <input class="range" id="mRange" type="range" min="${x.min}" max="${x.max}" step="${x.step}" value="${val}" style="--p:${pct}%" aria-label="${x.label}" />
        <div class="range-scale"><span>${fmt(x.min)}</span><span>${fmt(x.max)}</span></div>
      </div>
    </div>
    <div class="ob-nav">
      <button class="link-btn" data-back>Back</button>
      <div class="unit" role="group" aria-label="Units"><button class="${profile.unit === "in" ? "on" : ""}" data-u="in">in</button><button class="${profile.unit === "cm" ? "on" : ""}" data-u="cm">cm</button></div>
      <button class="btn btn-violet" data-next>${i === M.length - 1 ? "Save my fit" : "Next"} <svg class="arrow"><use href="#i-arrow"/></svg></button>
    </div>`;
  profile.m[x.key] = val;

  const range = $("#mRange");
  const set = (v, dir = 0) => {
    v = Math.min(x.max, Math.max(x.min, Math.round(v * 10) / 10));
    profile.m[x.key] = v;
    range.value = v;
    range.style.setProperty("--p", ((v - x.min) / (x.max - x.min)) * 100 + "%");
    const out = $("#mVal");
    out.innerHTML = valHTML(v);
    if (dir && !RM) out.animate([{ transform: `translateY(${dir * -6}px)` }, { transform: "none" }], { duration: 180, easing: "ease-out" });
  };
  $$(".picker-btn", $("#mPane")).forEach((b) => b.addEventListener("click", () => set(profile.m[x.key] + +b.dataset.d * x.step, +b.dataset.d)));
  range.addEventListener("input", () => set(+range.value));
  $$(".unit button", $("#mPane")).forEach((b) => b.addEventListener("click", () => { profile.unit = b.dataset.u; renderMeasure(x); }));
}

/* ---------- finish ---------- */
// save = true: write the fit to Supabase first (normal flow). false: just show an already-saved fit.
async function finish(save = true) {
  if (save) {
    const btn = $("#mPane [data-next]");
    try {
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
      if (!session) throw new Error("Your session ended. Please log in again.");
      session = await SnugzAPI.fresh(session); saveSession(session);
      await SnugzAPI.saveProfile(session, toRow());
    } catch (err) {
      if (btn) { btn.disabled = false; btn.innerHTML = `Try again <svg class="arrow"><use href="#i-arrow"/></svg>`; }
      toast(err.message);
      return;
    }
  }
  localStorage.setItem("snugzProfile", JSON.stringify(profile));
  sessionStorage.removeItem("snugzDraft");
  $("#doneName").textContent = profile.name ? `${profile.name}'s fit` : "Your fit";
  $("#doneGrid").innerHTML = M.map((x) => `<div><small>${x.label}</small><b>${fmt(profile.m[x.key])}</b></div>`).join("");
  $("#doneFit").textContent = `${profile.topFit} tops · ${profile.jeansFit} jeans`;
  show(LAST);
  setTimeout(confetti, 250);
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "sticker white";
  t.style.cssText = "position:fixed;left:50%;bottom:24px;z-index:300;transform:translateX(-50%);height:auto;padding:12px 18px;max-width:90vw;";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
$("#chromeBtn").addEventListener("click", (e) => { e.preventDefault(); alert("Wireframe: this opens the Snugz listing on the Chrome Web Store once published."); });

/* ---------- confetti in brand colours ---------- */
function confetti() {
  if (RM) return;
  const c = $("#confetti"), ctx = c.getContext("2d");
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  const colors = ["#7301FD", "#FE8501", "#FF3929", "#E5D2FD", "#FFFFFF", "#C8FFE3"];
  const P = Array.from({ length: 160 }, () => ({
    x: innerWidth * (0.3 + Math.random() * 0.4), y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 16 - 5,
    w: 8 + Math.random() * 8, h: 5 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, c: colors[(Math.random() * colors.length) | 0],
  }));
  let t = 0;
  (function f() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach((p) => {
      p.vy += 0.5; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.strokeStyle = "#0A0033"; ctx.lineWidth = 1.5;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (++t < 170) requestAnimationFrame(f); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ---------- page wipe ---------- */
const wipe = $("#wipe");
requestAnimationFrame(() => requestAnimationFrame(() => wipe.classList.remove("on")));
setTimeout(() => wipe.classList.remove("on"), 120); // fallback if frames are delayed
$$("a.go").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  if (RM) { location.href = a.href; return; }
  wipe.classList.remove("out"); wipe.classList.add("on");
  setTimeout(() => (location.href = a.href), 480);
}));
addEventListener("pageshow", (e) => { if (e.persisted) wipe.classList.remove("on"); });

show(0);
