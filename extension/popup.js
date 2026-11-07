// ===== Snugz popup: log in, show the saved fit, keep it in chrome.storage for the page script =====
const $ = (s) => document.querySelector(s);
const show = (id) => ["vLogin", "vEmpty", "vFit"].forEach((v) => ($("#" + v).hidden = v !== id));
const get = () => new Promise((r) => chrome.storage.local.get("snugz", (d) => r(d.snugz || {})));
const set = (v) => new Promise((r) => chrome.storage.local.set({ snugz: v }, r));
const fmt = (inch, unit) => unit === "cm" ? `${Math.round(inch * 2.54)} cm` : `${+(+inch).toFixed(1)} in`;

function msg(text) { $("#msg").hidden = !text; $("#msg").textContent = text || ""; }

function renderFit(session, profile) {
  const name = (profile && profile.name) || (session.user.user_metadata && session.user.user_metadata.name) || "there";
  document.querySelectorAll(".nm").forEach((e) => (e.textContent = name));
  if (!profile) return show("vEmpty");
  const u = profile.unit || "in";
  $("#fitPill").textContent = `${profile.top_fit || "Regular"} · ${profile.jeans_fit || "Regular"}`;
  $("#fitGrid").innerHTML = [["Chest", "chest"], ["Shoulder", "shoulder"], ["Sleeve", "sleeve"], ["Waist", "waist"], ["Length", "length"]]
    .map(([l, k]) => `<div><small>${l}</small><b>${profile[k] != null ? fmt(profile[k], u) : "–"}</b></div>`).join("");
  show("vFit");
}

async function sync(session) {
  session = await SnugzAPI.fresh(session);
  const profile = await SnugzAPI.getProfile(session);
  await set({ session, profile });
  renderFit(session, profile);
}

async function init() {
  const { session } = await get();
  if (!session) return show("vLogin");
  try { await sync(session); }
  catch (_) {
    // offline or token revoked: show what we have, or ask to log in again
    const { profile } = await get();
    profile ? renderFit(session, profile) : (await set({}), show("vLogin"));
  }
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  msg("");
  const b = $("#loginBtn"); b.disabled = true; b.textContent = "Logging in…";
  try { await sync(await SnugzAPI.signIn($("#email").value.trim(), $("#pw").value)); }
  catch (err) { msg(err.message); }
  finally { b.disabled = false; b.textContent = "Log in"; }
});

$("#refreshBtn").addEventListener("click", async () => {
  const b = $("#refreshBtn"); b.disabled = true; b.textContent = "Refreshing…";
  try { await sync((await get()).session); } catch (err) { alert(err.message); }
  finally { b.disabled = false; b.textContent = "Refresh"; }
});

document.addEventListener("click", async (e) => {
  const open = e.target.closest("[data-open]");
  if (open) { e.preventDefault(); chrome.tabs.create({ url: `${SNUGZ_CONFIG.WEBSITE_URL}/${open.dataset.open}` }); }
  if (e.target.closest("[data-logout]")) {
    const { session } = await get();
    if (session) await SnugzAPI.signOut(session);
    await set({});
    show("vLogin");
  }
});

init();
