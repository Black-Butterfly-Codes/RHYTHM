# SEO.md — Metadata, Crawling & Analytics (RHYTHM)

## 1. What is indexable

| Route | Indexable | Notes |
|---|---|---|
| `/` (signed out) | ✅ | Static shell in `index.html` has the canonical metadata |
| `/?page=privacy` | ✅ | Stable, fragment-free URL listed in `sitemap.xml` |
| `/?page=terms` | ✅ | Terms of Service |
| `/?page=refund` | ✅ | Refund & Cancellation Policy |
| `/?page=disclaimer` | ✅ | Disclaimer |
| `/?page=copyright` | ✅ | Copyright & DMCA |
| `/?page=contact` | ✅ | Stable, fragment-free URL listed in `sitemap.xml` |
| Signed-in app screens (`#/dash`, `#/home`, …) | ❌ | `applySeo()` sets `noindex, nofollow` |

The app is a single-page application, so the underlying document is always
`index.html`. The `?page=` parameter gives crawlers real URLs for the public
pages; everything else is per-user state and should not be indexed.
`PUBLIC_PAGES` in `app.js` is the single list of these routes.

## 2. Static head (`index.html`)

`index.html` contains the default metadata for the landing/auth experience:

- `<title>` and `<meta name="description">`
- `<link rel="canonical">` → `https://rhythm-music-platform.netlify.app/`
- Open Graph: `og:type`, `og:site_name`, `og:locale`, `og:title`,
  `og:description`, `og:url`, `og:image` (+ width/height/alt)
- Twitter/X: `summary_large_image`, title, description, image, alt
- JSON-LD `@graph` with `Organization` and `WebSite`
- Favicon (`favicon.svg`), Apple touch icon, and a font preload
- A `<noscript>` block with a readable description and links to the privacy
  policy, contact page, and source repository

## 3. Runtime metadata (`applySeo()`)

Every navigation calls `applySeo()` in `app.js`, which:

1. Picks a `[title, description]` pair from `SEO_META` (auth, dash, home,
   creators, explore, boards, collabs, auctions, msgs, notifs, profile, admin,
   privacy, terms, refund, disclaimer, copyright, contact).
2. Updates the document title, description, Open Graph, and Twitter tags.
3. Sets an **absolute** `og:image`/`twitter:image` URL
   (`assets/og-image.png`, 1200×630).
4. Sets a **fragment-free** canonical URL. Public pages use
   `?page=privacy|terms|refund|disclaimer|copyright|contact`; everything else
   uses the origin + pathname.
5. Adds `robots: noindex, nofollow` for app screens and removes it for public
   pages.
6. Calls `trackPage(key)` (a no-op unless analytics is configured **and** the
   user has consented).

## 4. Sitemap & robots

- `sitemap.xml` lists `/`, `/?page=privacy`, `/?page=terms`,
  `/?page=refund`, `/?page=disclaimer`, `/?page=copyright` and
  `/?page=contact`.
- `robots.txt` allows crawling, disallows the font directory, and points at
  the sitemap.
- Update `lastmod` in `sitemap.xml` when public page content changes.

If the production domain changes, update all of:

- `index.html` canonical / OG / JSON-LD URLs
- `sitemap.xml`
- `robots.txt`
- the Netlify domain

## 5. Social preview image

`assets/og-image.png` is 1200×630 and contains the RHYTHM wordmark, the
tagline, the five creative domains, and the site URL. `assets/apple-touch-icon.png`
is 180×180. Both are generated raster assets committed to the repo; regenerate
them only if branding changes.

## 6. Accessibility and Lighthouse

The UI is built with landmarks (`<main>`), labelled form controls, real
`<button>` elements for actions, `aria-label`s on icon-only controls,
`role="dialog"` modals with `aria-modal` and labelled titles, focus trapping,
and Escape-to-close. These also help Lighthouse's Accessibility and SEO
categories.

Baseline audit at the time of writing (local build):

| Category | Public page | Signed-in dashboard |
|---|---|---|
| Accessibility | 1.00 | 1.00 |
| Best Practices | 1.00 | 1.00 |
| SEO | 1.00 | 1.00 |

Re-run Lighthouse after changing markup or metadata.

## 7. Analytics (optional, off by default)

`analytics.js` exposes `initAnalytics()`, `trackPage(key)` and
`setAnalyticsConsent(allowed)`.

- `GA4_ID` is empty by default, so the module is a documented no-op: no
  script is loaded, no cookies are set, and no request leaves the browser.
- **Consent is required.** The app calls `setAnalyticsConsent()` from the
  consent banner (`rhythm_consent_v1`) and only then may `initAnalytics()`
  load Google Tag Manager. Rejecting optional analytics keeps the app fully
  usable and makes no request.
- Setting `GA4_ID` to a real `G-XXXXXXXXXX` loads Google Tag Manager once and
  sends screen-view events only.
- Enabling it introduces a third-party request and cookies, so update
  `PRIVACY.md`, the in-app privacy text, and the CSP (`script-src` /
  `connect-src`) at the same time. The current `netlify.toml` CSP blocks the
  GA domains.

## 8. SEO checklist for changes

- [ ] Public pages keep stable, fragment-free canonical URLs.
- [ ] App screens remain `noindex, nofollow`.
- [ ] `og:image` resolves to an absolute URL and the file exists.
- [ ] New routes get a title and description in `SEO_META`.
- [ ] `sitemap.xml` / `robots.txt` updated if public routes change.
- [ ] Analytics stays consent-gated.
- [ ] Lighthouse Accessibility/SEO stay at 1.00.
