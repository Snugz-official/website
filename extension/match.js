// ===== Snugz size matching (pure logic, no DOM) =====
// Reads a parsed size chart and a fit profile (inches) and picks the best size.
(function (root) {
  // How much room each fit preference wants, in inches.
  // Body charts list body sizes, so we only nudge a little.
  // Garment charts list the clothing itself, so we add wearing ease on top.
  const EASE = {
    body:    { Snug: -0.5, Regular: 0,   Relaxed: 1,   Slim: -0.5, Loose: 1 },
    garment: { Snug: 1,    Regular: 2.5, Relaxed: 4,   Slim: 0.5,  Loose: 2.5 },
  };
  // which measurements matter for each kind of product, and how much
  const WEIGHTS = {
    top:    { chest: 1, shoulder: 0.7, sleeve: 0.3 },
    bottom: { waist: 1, length: 0.5 },
  };
  const LABEL = { chest: "Chest", shoulder: "Shoulder", sleeve: "Sleeve", waist: "Waist", length: "Length" };

  // "38", "38.5", "38-40", "38 – 40", "96.5 cm" → [lo, hi] in the chart's unit
  function parseRange(text) {
    const nums = String(text).replace(/,/g, ".").match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    const v = nums.slice(0, 2).map(Number);
    return v.length === 2 ? [Math.min(...v), Math.max(...v)] : [v[0], v[0]];
  }

  // distance from target to the chart value (0 if inside a range), signed: + means garment is bigger
  function diff(range, target) {
    if (target < range[0]) return range[0] - target;
    if (target > range[1]) return range[1] - target;
    return 0;
  }

  function verdict(key, d) {
    const tol = key === "length" || key === "sleeve" ? 1 : 0.75;
    if (Math.abs(d) <= tol) return { word: "Perfect", tone: "good" };
    const longKey = key === "length" || key === "sleeve";
    if (d > 0) return { word: longKey ? `${d.toFixed(1)} in long` : "A bit loose", tone: "warn" };
    return { word: longKey ? `${Math.abs(d).toFixed(1)} in short` : "A bit tight", tone: "warn" };
  }

  /**
   * chart = { kind: "top"|"bottom", unit: "in"|"cm", type: "body"|"garment",
   *           types: { waist: "body", length: "garment" }   (optional, per measurement)
   *           rows: [{ size: "L", chest: "40-42", shoulder: "17.5", ... }] }
   * profile = { chest, shoulder, sleeve, waist, length, top_fit, jeans_fit } in inches
   */
  function bestSize(chart, profile) {
    const w = WEIGHTS[chart.kind];
    const pref = chart.kind === "top" ? profile.top_fit || "Regular" : profile.jeans_fit || "Regular";
    const toIn = chart.unit === "cm" ? 1 / 2.54 : 1;

    const scored = chart.rows.map((row) => {
      let score = 0, used = 0;
      const parts = [];
      for (const key of Object.keys(w)) {
        if (row[key] == null || profile[key] == null) continue;
        const r = parseRange(row[key]);
        if (!r) continue;
        const range = [r[0] * toIn, r[1] * toIn];
        // a short sleeve (under ~15 in) is the sleeve itself, not arm length: don't compare it
        if (key === "sleeve" && range[1] < 15) continue;
        // only circumference measurements get fit ease; lengths are matched as they are
        const type = (chart.types && chart.types[key]) || chart.type || "body";
        const ease = (EASE[type] || EASE.body)[pref] || 0;
        const target = +profile[key] + (key === "chest" || key === "waist" ? ease : 0);
        const d = diff(range, target);
        // too tight is worse than a little loose, so tight gaps cost 15% more (breaks ties toward the bigger size)
        score += Math.abs(d) * w[key] * (d < 0 ? 1.15 : 1); used += w[key];
        parts.push({ key, label: LABEL[key], diff: d, ...verdict(key, d) });
      }
      return { size: row.size, score: used ? score / used : Infinity, parts };
    }).filter((s) => s.score !== Infinity);

    if (!scored.length) return null;
    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];
    const confidence = Math.max(40, Math.min(98, Math.round(98 - best.score * 14)));
    return { ...best, confidence, pref };
  }

  root.SnugzMatch = { bestSize, parseRange };
})(typeof window !== "undefined" ? window : globalThis);
