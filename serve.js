#!/usr/bin/env node
/**
 * Tiny zero-dependency static server for MarginDesk.
 *
 * MarginDesk is a static app: you can also just double-click `index.html`.
 * This server exists for people who prefer a real http:// origin (and it is
 * handy when testing on a phone on the same network).
 *
 *   node serve.js            → http://127.0.0.1:5173
 *   node serve.js 8080       → http://127.0.0.1:8080
 *   node serve.js 8080 0.0.0.0   → also reachable from your phone
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 5173;
const HOST = process.argv[3] || process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(ROOT, `.${pathname}`);

  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden');
    return;
  }

  fs.stat(file, (error, stat) => {
    const target = !error && stat.isDirectory() ? path.join(file, 'index.html') : file;
    fs.readFile(target, (readError, data) => {
      if (readError) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(data);
    });
  });
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  process.stdout.write(
    `\n  MarginDesk running at http://${shown}:${PORT}\n` +
      `  Serving ${ROOT}\n\n  Press Ctrl+C to stop.\n\n`,
  );
});
