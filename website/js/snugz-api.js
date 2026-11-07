// ===== Snugz API: tiny Supabase client (auth + fit profile) =====
// Plain fetch, no libraries, so the exact same file works on the website
// and inside the Chrome extension (extensions can't load remote scripts).
// Shared copy: keep website/js/snugz-api.js and extension/snugz-api.js identical.
(function (root) {
  const cfg = () => (root.SNUGZ_CONFIG || {});
  const base = () => cfg().SUPABASE_URL;
  const key = () => cfg().SUPABASE_KEY;

  async function call(path, { method = "GET", body, token, headers = {} } = {}) {
    const h = { apikey: key(), "Content-Type": "application/json", ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(base() + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `Request failed (${res.status})`;
      throw new Error(friendly(msg));
    }
    return data;
  }

  function friendly(msg) {
    const m = String(msg).toLowerCase();
    if (m.includes("invalid login")) return "That email and password don't match. Try again.";
    if (m.includes("already registered")) return "This email already has an account. Log in instead.";
    if (m.includes("email not confirmed")) return "Please confirm your email first (check your inbox).";
    if (m.includes("password should be")) return "Password needs at least 8 characters.";
    if (m.includes("rate limit")) return "Too many tries. Please wait a minute.";
    return msg;
  }

  // session = { access_token, refresh_token, expires_at (seconds), user }
  function normalize(s) {
    if (!s || !s.access_token) return null;
    return {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: s.user,
    };
  }

  const API = {
    // Returns { session } if logged in straight away, or { needsConfirm: true } if
    // Supabase is set to require email confirmation.
    async signUp(email, password, name) {
      const d = await call("/auth/v1/signup", { method: "POST", body: { email, password, data: { name } } });
      const session = normalize(d);
      return session ? { session } : { needsConfirm: true };
    },
    async signIn(email, password) {
      return normalize(await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } }));
    },
    async refresh(session) {
      return normalize(await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token } }));
    },
    // refresh the token if it expires within 60 seconds
    async fresh(session) {
      if (!session) return null;
      if (session.expires_at - 60 > Date.now() / 1000) return session;
      return API.refresh(session);
    },
    async signOut(session) {
      try { await call("/auth/v1/logout", { method: "POST", token: session.access_token }); } catch (_) { /* already gone */ }
    },
    // ---- Google sign-in (Supabase OAuth, tokens come back in the URL #hash) ----
    googleURL(redirectTo) {
      return `${base()}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
    },
    // read tokens from a URL like ...#access_token=...&refresh_token=...; returns a session or null
    async sessionFromURL(url) {
      const hash = new URL(url).hash.replace(/^#/, "");
      const p = new URLSearchParams(hash);
      if (p.get("error_description")) throw new Error(p.get("error_description").replace(/\+/g, " "));
      if (!p.get("access_token")) return null;
      const user = await call("/auth/v1/user", { token: p.get("access_token") });
      return normalize({
        access_token: p.get("access_token"), refresh_token: p.get("refresh_token"),
        expires_in: +p.get("expires_in") || 3600, user,
      });
    },
    async getProfile(session) {
      const rows = await call(`/rest/v1/fit_profiles?select=*&user_id=eq.${session.user.id}`, { token: session.access_token });
      return rows && rows[0] ? rows[0] : null;
    },
    async saveProfile(session, profile) {
      const rows = await call("/rest/v1/fit_profiles?on_conflict=user_id", {
        method: "POST", token: session.access_token,
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: { ...profile, user_id: session.user.id },
      });
      return rows && rows[0];
    },
  };
  root.SnugzAPI = API;
})(typeof window !== "undefined" ? window : globalThis);
