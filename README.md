# 🎵 RHYTHM

### Discover Talent. Create Together. Rise Together.

![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg)
![Project Status](https://img.shields.io/badge/Status-Prototype-orange.svg)
![Built with JavaScript](https://img.shields.io/badge/Built%20with-JavaScript-yellow.svg)

**RHYTHM** is a collaborative music creation platform concept designed to bring independent artists together.

## 🌐 Project Links

* **Live Demo:** https://rhythm-music-platform.netlify.app
* **GitHub Repository:** https://github.com/Black-Butterfly-Codes/RHYTHM

## ✨ Features

### 🎤 Artist Profiles

* Create an account and artist profile.
* Select creative domains.
* Showcase your creative identity and work.
* Discover other artists.

### 🎧 Music Community

* Explore creative posts.
* Browse music-related content.
* Discover artists through feeds and filters.
* Interact with posts.

### 🤝 Collaboration

* Discover potential collaborators.
* Explore creators from different musical domains.
* Send and manage collaboration requests.
* Explore opportunities to create music together.

### 🏆 Creator Discovery

* Explore creators and their work.
* Discover talent across creative categories.
* Encourage recognition of independent artists.

### 🔊 Music Preview

* Listen to generated demonstration music previews.
* Control playback and volume.
* Explore different musical styles.

### 🌌 Modern Interface

* Premium dark-themed design.
* Neon purple, magenta, and cyan accents.
* Glassmorphism-inspired components.
* Responsive layouts for different screen sizes.

## 🎼 Creative Domains

RHYTHM is designed around five creative domains:

| Domain          | Description                      |
| --------------- | -------------------------------- |
| Singer          | Vocal artists and performers     |
| Instrumentalist | Musicians who play instruments   |
| Lyricist        | Writers who create lyrics        |
| Composer        | Creators of musical compositions |
| Beatmaker       | Creators of beats and rhythms    |

## 🛠️ Technology Stack

| Technology            | Purpose                            |
| --------------------- | ---------------------------------- |
| HTML5                 | Application structure              |
| CSS3                  | Styling and responsive design      |
| JavaScript            | Application logic and interactions |
| JavaScript ES Modules | Modular code organization          |
| Web Crypto API        | PBKDF2-SHA256 password hashing     |
| Web Audio API         | Generated music previews           |
| LocalStorage          | Browser-based data persistence     |
| Node.js               | Local static server + test runner  |
| Git                   | Version control                    |
| GitHub Actions        | CI (static checks + unit tests)    |
| Netlify               | Website deployment                 |

The runtime has **zero dependencies and no build step**. Node.js is only used
for the local static server and the test/check scripts.

## 🚀 Run Locally

### Prerequisites

* Node.js
* Git
* A modern web browser
* VS Code or another code editor

### 1. Clone the repository

```bash
git clone https://github.com/Black-Butterfly-Codes/RHYTHM.git
```

### 2. Enter the project directory

```bash
cd RHYTHM
```

### 3. Start the local server

```bash
npm start
```

That runs the dependency-free static server in `tools/serve.cjs` on port 4173.
(Any static server works — for example `npx serve .` — but do not open
`index.html` directly from disk: ES modules and `crypto.subtle` need an
HTTP origin.)

### 4. Open the application

Visit:

`http://localhost:4173`

## 🔐 Demo Accounts

Fresh installs include seeded demo users. Every seeded password is `demo`.

| Role  | Email           | Username   | Password |
| ----- | --------------- | ---------- | -------- |
| User  | rahul@demo.in   | rahulmusic | demo     |
| Admin | admin@demo.in   | admin      | demo     |
| User  | aman@demo.in    | amankeys   | demo     |

You can also register a new account.

**Note:** This is demonstration access, not a production authentication
system. Seeded credentials are public by design and must never exist in a
real deployment.

## 📁 Project Structure

```text
RHYTHM/
├── index.html              # App shell, SEO/OG metadata, structured data
├── favicon.svg
├── style.css
├── app.js                  # UI, routing, actions
├── logic.js                # Pure scoring / auction helpers
├── audio.js                # WebAudio demo previews
├── analytics.js            # Optional GA4 hook (disabled by default)
├── seed.js                 # Demo users, posts, auctions
├── store.js                # localStorage DB + PBKDF2 auth
├── assets/
│   ├── og-image.png
│   ├── apple-touch-icon.png
│   └── fonts/              # Self-hosted Inter woff2 (no CDN)
├── test/                   # node:test unit tests
├── tools/
│   ├── serve.cjs           # Zero-dependency static server
│   └── check.cjs           # Static CI checks
├── .github/workflows/ci.yml
├── netlify.toml            # Hosting headers + CSP + SPA fallback
├── robots.txt
├── sitemap.xml
├── package.json
├── README.md
├── AUTH.md
├── CONTACT.md
├── CONTRIBUTING.md
├── DATA_SECURITY.md
├── PRIVACY.md
├── SECURITY.md
├── SECURITY_CHECKLIST.md
├── SEO.md
└── THREAT_MODEL.md
```

### Main Files

| File           | Responsibility                                    |
| -------------- | ------------------------------------------------- |
| `index.html`   | Application entry point and static SEO metadata   |
| `style.css`    | Interface styling, responsive layout, accessibility |
| `app.js`       | UI rendering, routing, and all user actions        |
| `logic.js`     | Pure, testable scoring and auction settlement logic |
| `audio.js`     | Music preview generation                           |
| `analytics.js` | Optional analytics integration (off by default)    |
| `seed.js`      | Initial demonstration data                         |
| `store.js`     | Browser storage, sessions, and password hashing    |

## ✅ Quality Checks

```bash
npm run check   # JS syntax, required files, local asset refs, regression guards
npm test        # node:test unit tests (logic + auth)
npm run ci      # both, exactly what GitHub Actions runs
```

CI runs on every push and pull request via `.github/workflows/ci.yml`.

## 🔎 SEO & Public Pages

The privacy and contact pages are crawlable at `/?page=privacy` and
`/?page=contact`; signed-in app screens send `noindex, nofollow`. Metadata,
canonical URLs, Open Graph/Twitter tags, and JSON-LD live in `index.html` and
are updated at runtime in `applySeo()`. See `SEO.md`.

## 🔒 Security and Privacy

The repository includes supporting security documentation:

* `AUTH.md` — authentication, sessions, and the authorization matrix
* `DATA_SECURITY.md` — data handling, storage, and recovery
* `SECURITY.md` — security policy and responsible disclosure
* `SECURITY_CHECKLIST.md` — per-PR and pre-launch verification list
* `THREAT_MODEL.md` — threat analysis
* `PRIVACY.md` — privacy policy
* `CONTACT.md` — contact-form configuration
* `SEO.md` — metadata, canonical URLs, and indexing rules

Security-relevant properties of the current build:

* Passwords are stored as salted **PBKDF2-SHA256** digests (210,000
  iterations, per-user random salt) via the Web Crypto API. Legacy SHA-256
  digests are accepted once and upgraded on the next successful login.
* Five failed logins trigger a 60-second lockout.
* All rendered user content passes through `esc()`.
* The web font is self-hosted and the app makes **no third-party network
  requests** by default.
* `netlify.toml` sets a Content-Security-Policy and standard security headers.
* Admin checks exist in the client actions, but they are **demo-only** — the
  whole database is client-side.

The current application is a browser-based prototype. Local browser storage is not equivalent to secure server-side authentication or centralized data protection.

**Do not use real passwords, sensitive personal information, or payment information in the demo.**

## ⚠️ Current Project Status

RHYTHM is currently an interactive front-end prototype.

Current limitations:

* User data is stored locally in the browser.
* Data is not synchronized between different users or devices.
* Music previews are generated demonstrations, not uploaded audio tracks.
* A centralized backend and production database are not yet integrated.
* Collaboration and marketplace experiences are prototype functionality.
* Real payments and commercial licensing are not implemented.

## 🔮 Future Development

Planned improvements include:

* Backend integration and a centralized database.
* Secure server-side authentication.
* Real audio uploads and streaming.
* Real-time collaboration.
* Private creator workspaces.
* Messaging and notifications.
* Improved artist discovery.
* Secure licensing and marketplace functionality.
* Advanced recommendation systems.

## 🎯 Our Vision

RHYTHM aims to create an environment where independent artists can discover one another, share their creativity, and build something meaningful together.

We believe great music can come from anywhere, and talented creators deserve opportunities to be discovered.

---

## 👩‍💻 Developer

**Black-Butterfly-Codes**

GitHub: https://github.com/Black-Butterfly-Codes

<p align="center">
  <b>RHYTHM 🎶</b><br>
  Discover Talent. Create Together. Rise Together.
</p>
