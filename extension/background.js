// ===== Snugz background worker =====
// Network requests run here, not in the page, so a store's page security rules
// (CSP / CORS) can never block Snugz from reading a size chart.

const FLIPKART_API = "https://2.rome.api.flipkart.com/3/product/size-chart";

async function flipkartSizeChart(pid, attempt = 1) {
  try {
    const res = await fetch(FLIPKART_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Agent": `${navigator.userAgent} FKUA/website/42/website/Desktop`,
      },
      body: JSON.stringify({ pids: [pid] }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return ((data.RESPONSE || {}).data || {})[pid] || null;
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return flipkartSizeChart(pid, attempt + 1);
    }
    return { error: String(err) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === "flipkart-size-chart" && /^[A-Z0-9]{8,20}$/.test(msg.pid || "")) {
    flipkartSizeChart(msg.pid).then(reply);
    return true; // keep the channel open for the async reply
  }
  return false;
});
