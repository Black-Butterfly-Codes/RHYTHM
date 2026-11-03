# Contributing to RHYTHM 🎵

Thank you for your interest in contributing to RHYTHM!

RHYTHM is an open-source music collaboration platform concept designed to connect singers, instrumentalists, lyricists, composers, and beatmakers.

We welcome developers, designers, musicians, and creative thinkers who want to help improve the project.

## How to Contribute

1. Fork the RHYTHM repository.
2. Clone your fork to your computer.
3. Create a new branch for your changes.
4. Make your improvements or bug fixes.
5. Run the checks and tests (below).
6. Commit and push your changes.
7. Open a Pull Request describing your contribution.

## Local Setup

RHYTHM has **no runtime dependencies and no build step**. Node.js 20+ is only
needed for the local server and tests.

```bash
npm start       # static dev server on http://localhost:4173
npm run check   # syntax, file, asset-reference, and regression checks
npm test        # unit tests (scoring, settlement, password hashing)
npm run ci      # both, same as GitHub Actions
```

Do not open `index.html` directly from the filesystem: ES modules and
`crypto.subtle` require an HTTP origin.

## Project Layout

| Path | Purpose |
|---|---|
| `index.html`, `style.css` | Shell, styles, static SEO metadata |
| `app.js` | UI, routing, and actions |
| `logic.js` | Pure, testable scoring/settlement helpers |
| `store.js` | localStorage database, sessions, PBKDF2 auth |
| `seed.js` | Demo data |
| `audio.js` | WebAudio previews |
| `analytics.js` | Optional GA4 (disabled by default) |
| `test/` | `node:test` unit tests |
| `tools/` | Dev server and CI checks |
| `assets/fonts/` | Self-hosted Inter woff2 |

## Areas Where You Can Help

* Frontend development and UI/UX improvements.
* Backend and database integration (the current app is client-only).
* Authentication and security hardening (server-side re-implementation).
* Music player and audio functionality.
* Artist discovery and collaboration features.
* Bug fixes and documentation.
* Accessibility and responsive design.

## Contribution Guidelines

* Keep your code readable and organized.
* Follow the existing structure: zero runtime dependencies, no build step,
  vanilla ES modules.
* Escape all user content with `esc()` before rendering it.
* Update the relevant docs when behaviour changes (`AUTH.md`, `PRIVACY.md`,
  `SECURITY.md`, `SEO.md`, …).
* Avoid committing passwords, API keys, or private information.
* Add or update tests for pure logic changes in `logic.js`/`store.js`.
* Explain the purpose of your changes clearly in the PR.

## Pull Request Checklist

- [ ] `npm run ci` passes locally.
- [ ] No new runtime dependency or CDN request was introduced.
- [ ] New user input is validated and escaped on render.
- [ ] Docs and metadata are updated if routes/limits/security behaviour changed.
- [ ] Accessibility was considered (labels, keyboard paths, focus states).

## Questions and Suggestions

You can use GitHub Issues to report bugs, suggest features, or discuss improvements.

Thank you for helping RHYTHM grow!

**Discover Talent. Create Together. Rise Together. 🎶**
