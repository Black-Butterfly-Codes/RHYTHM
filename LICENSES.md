# LICENSES.md — Asset & Third-Party Licences (RHYTHM)

RHYTHM's own source code is released under the **MIT License** (see
`LICENSE` / `package.json`). This file records the licence of every third-party
asset shipped in the repository and what still needs an owner decision before
commercial launch.

## 1. Fonts

| Asset | Upstream | Licence | Notes |
|---|---|---|---|
| `assets/fonts/inter-latin.woff2` | [Inter](https://github.com/rsms/inter) by Rasmus Andersson | **SIL Open Font License 1.1 (OFL-1.1)** | Self-hosted; no CDN request. Redistribution is allowed under OFL-1.1. |
| `assets/fonts/inter-latin-ext.woff2` | Same as above | **OFL-1.1** | Latin Extended subset. |

OFL-1.1 requires that the font is not sold on its own and that any modified
version is not distributed under the reserved font name. RHYTHM ships the
unmodified WOFF2 builds, so the licence notice below is sufficient. The full
OFL-1.1 text is available at
<https://openfontlicense.org/open-font-license-official-text/> and should be
kept alongside the fonts in a production repository.

## 2. Images and icons

| Asset | Source | Licence |
|---|---|---|
| `assets/og-image.png` | Generated for RHYTHM (wordmark + tagline) | Project-owned / MIT |
| `assets/apple-touch-icon.png` | Generated for RHYTHM | Project-owned / MIT |
| `favicon.svg` | Generated for RHYTHM (♪ mark) | Project-owned / MIT |
| Emoji used in the UI (🎵 🔨 ⚑ …) | System emoji font | Rendered by the OS; not bundled |

No stock photographs, icon-font packages, or third-party illustration sets are
bundled. If any are added, record the source URL, author, licence and proof of
purchase/attribution here **before** merging.

## 3. Code

| Component | Licence | Notes |
|---|---|---|
| RHYTHM source (`app.js`, `logic.js`, `store.js`, `seed.js`, `audio.js`, `analytics.js`, `style.css`, tooling) | **MIT** | Zero runtime dependencies. |
| Node.js built-ins (`node:test`, `node:fs`, …) | Node.js licence | Used only for local tooling and CI. |
| Google Analytics 4 (`analytics.js`, optional) | Google Terms of Service | Disabled by default (`GA4_ID` empty), consent-gated, and needs a CSP + privacy update before enabling. |

## 4. Audio

All music previews are synthesised at runtime with the Web Audio API in
`audio.js`. No recorded samples, loops, stems or third-party audio files are
shipped, so no sample clearance is required for the demo. **Production:** any
uploaded audio is user content; the uploader must own or license it, and the
Terms require that confirmation.

## 5. User content

Users retain ownership of their posts and uploads and grant RHYTHM a limited
licence to operate the service (see `TERMS.md` §3). RHYTHM does not acquire
ownership of user work. Copyright complaints follow `COPYRIGHT.md`.

## 6. Owner actions before launch

- [x] Keep the full **OFL-1.1** text in `assets/fonts/OFL.txt`.
- [ ] Confirm the project's own `LICENSE` file matches the intended licence.
- [ ] Record the source/licence of any image, icon, sample or font added later.
- [ ] If analytics is enabled, add Google's terms link and update the CSP.
- [ ] Have a lawyer review the content-licence wording in `TERMS.md` §3.
