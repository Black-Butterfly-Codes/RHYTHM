#!/usr/bin/env node
// Static sanity checks that run in CI without a browser.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
let failures = 0;

function fail(msg) {
  failures++;
  console.error("✖ " + msg);
}
function ok(msg) {
  console.log("✔ " + msg);
}
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);

// 1. JavaScript syntax
for (const file of files.filter((f) => /\.(js|cjs|mjs)$/.test(f))) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (e) {
    fail(`syntax error in ${path.relative(ROOT, file)}\n${e.stderr?.toString() || e.message}`);
  }
}
ok("JavaScript syntax checked");

// 2. Required files
const required = [
  "index.html", "app.js", "store.js", "logic.js", "seed.js", "audio.js", "analytics.js", "style.css",
  "favicon.svg", "assets/og-image.png", "assets/apple-touch-icon.png",
  "assets/fonts/inter-latin.woff2", "assets/fonts/inter-latin-ext.woff2",
  "robots.txt", "sitemap.xml", "netlify.toml", "README.md", "PRIVACY.md", "SECURITY.md",
];
for (const rel of required) {
  if (!fs.existsSync(path.join(ROOT, rel))) fail(`missing required file: ${rel}`);
}
ok("required files present");

// 3. Local asset references in index.html exist
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)].map((m) => m[1]);
for (const ref of new Set(refs)) {
  if (!fs.existsSync(path.join(ROOT, ref))) fail(`index.html references missing file: ${ref}`);
}
ok("index.html local references resolve");

// 4. No third-party runtime requests from CSS
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
if (/@import\s+url\(\s*['"]?https?:/i.test(css)) fail("style.css still imports a remote stylesheet");
for (const m of css.matchAll(/url\(\s*['"]?(https?:[^)'"]+)/gi)) fail(`style.css remote url(): ${m[1]}`);
ok("style.css has no remote font/style requests");

// 5. Regression guards
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
if (app.includes("perchance.org")) fail("app.js still uses the old perchance share URL");
if (/from\s+"\.\/store\.js"[^\n]*\bsha256\b/.test(app)) fail("app.js still imports the legacy sha256 helper");
if (!app.includes('metaTag("property", "og:image"')) fail("app.js does not set a dynamic og:image");
ok("regression guards passed");

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll static checks passed.");
