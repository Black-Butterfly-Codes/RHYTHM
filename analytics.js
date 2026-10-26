// RHYTHM analytics (Google Analytics 4) — OFF by default.
//
// SETUP (owner action required):
//   1. Create a GA4 property at https://analytics.google.com
//      (Admin > Data Streams > Web). Copy the Measurement ID (G-XXXXXXXXXX).
//   2. Paste it below as GA4_ID. Rebuild/redeploy.
// Until then every function below is a documented no-op: no requests leave
// the browser, no cookies are set, nothing is collected. See src/SEO.md §17.

export const GA4_ID = ""; // TODO(owner): paste GA4 Measurement ID, e.g. "G-1A2B3C4D5E"

let loaded = false;
let lastTracked = "";

function loadScript() {
  return new Promise((resolve) => {
    if (loaded) return resolve(true);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
    s.onload = () => { loaded = true; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

/** Call once at startup. Returns true only when a real ID is configured. */
export async function initAnalytics() {
  if (!GA4_ID || !/^G-[A-Z0-9]{6,}$/.test(GA4_ID)) return false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const ok = await loadScript();
  if (ok) window.gtag("js", new Date());
  return ok;
}

/** Track an app-screen view. De-duplicated; no-op when GA4 is not configured. */
export function trackPage(screen) {
  if (!GA4_ID || !window.gtag || lastTracked === screen) return;
  lastTracked = screen;
  try {
    window.gtag("config", GA4_ID, { page_title: document.title, page_path: "/" + screen, anonymize_ip: true });
  } catch (e) { /* analytics must never break the app */ }
}
