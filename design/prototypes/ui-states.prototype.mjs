// PROTOTYPE — throwaway. For "UI states the design doesn't show" (kamkom/ogame-clone#14).
// Serves design/ and injects ui-states.prototype.js into the four static screens.
//   node design/prototypes/ui-states.prototype.mjs   →   http://localhost:4714/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 4714);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/screens/command-deck.html?s=soon&v=A' }).end();
    return;
  }
  const path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    let body = await readFile(path);
    if (path.includes('/screens/') && path.endsWith('.html')) {
      body = body.toString().replace('</body>', '<script src="/prototypes/ui-states.prototype.js"></script>\n</body>');
    }
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`UI states prototype → http://localhost:${port}/`));
