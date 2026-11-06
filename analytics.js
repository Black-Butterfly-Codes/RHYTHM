// RHYTHM analytics (Google Analytics 4) — OFF by default and consent-gated.
//
// SETUP (owner action required):
//   1. Create a GA4 property at https://analytics.google.com
//      (Admin > Data Streams > Web). Copy the Measurement ID (G-XXXXXXXXXX).
//   2. Paste it below as GA4_ID. Rebuild/redeploy.
//   3. Update netlify.toml CSP (script-src / connect-src) and PRIVACY.md.
//
// No analytics request is made unless BOTH a valid GA4_ID exists AND the user
// has chosen "Accept analytics" in the consent banner. Until then every
// function below is a no-op: no script loads, no cookies are set, nothing is
// collected. See SEO.md §7 and PRIVACY.md §5.

export const GA4_ID = ""; // TODO(owner): paste GA4 Measurement ID, e.g. "G-1A2B3C4D5E"

let loaded = false;
let lastTracked = "";
let consentGranted = false;

/** Called by the app whenever the user's consent choice changes. */
export function setAnalyticsConsent(allowed) {
  consentGranted = Boolean(allowed);
  if (!consentGranted) lastTracked = "";
}

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

/** Call once at startup (or after consent). Returns true only when it loads. */
export async function initAnalytics() {
  if (!consentGranted) return false;
  if (!GA4_ID || !/^G-[A-Z0-9]{6,}$/.test(GA4_ID)) return false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const ok = await loadScript();
  if (ok) window.gtag("js", new Date());
  return ok;
}

/** Track an app-screen view. De-duplicated; no-op without consent/configuration. */
export function trackPage(screen) {
  if (!consentGranted || !GA4_ID || !window.gtag || lastTracked === screen) return;
  lastTracked = screen;
  try {
    window.gtag("config", GA4_ID, { page_title: document.title, page_path: "/" + screen, anonymize_ip: true });
  } catch (e) { /* analytics must never break the app */ }
}
