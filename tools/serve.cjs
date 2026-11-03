#!/usr/bin/env node
// Minimal static file server for local development. Zero dependencies.
// Usage: npm start   (or: node tools/serve.cjs [port])
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  // Resolve inside ROOT only (no path traversal).
  const target = path.resolve(ROOT, "." + pathname);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(target, (err, stat) => {
    let file = target;
    if (!err && stat.isDirectory()) file = path.join(target, "index.html");
    fs.readFile(file, (readErr, buf) => {
      if (readErr) {
        // SPA fallback: unknown extension-less routes serve the app shell.
        if (!path.extname(pathname)) {
          fs.readFile(path.join(ROOT, "index.html"), (e2, shell) => {
            if (e2) { res.writeHead(404).end("Not found"); return; }
            res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" }).end(shell);
          });
          return;
        }
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      }).end(buf);
    });
  });
});

server.listen(PORT, () => {
  console.log(`RHYTHM dev server: http://localhost:${PORT}`);
});
