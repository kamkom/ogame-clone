// Unpacks `Space Strategy Game — Planet Overview Variants.html` into this folder.
// Run from the repo root: node design/extract.mjs
//
// The bundle is two levels deep: the root manifest holds 4 page bundles, and
// each page bundle holds its own manifest (dc-runtime, React UMD, 21 woff2
// fonts) plus a template with an <x-dc> component and a `renderVals()` class.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(OUT, '..', 'Space Strategy Game — Planet Overview Variants.html');

const PAGES = {
  '197ca2d6-8274-4d67-975d-399b5f3df006': 'command-deck',
  '67479a9a-5d99-4d38-b1da-5358b3bef8ff': 'structures',
  '841115e6-4530-4589-a189-0fe65474f232': 'research',
  '6e3cdc17-11ba-4828-853f-27938fb3b4a4': 'shipyard',
};
const ACCENT = '#5fe3c0';

function island(html, type) {
  const m = html.match(new RegExp(`<script type="__bundler/${type}">([\\s\\S]*?)</script>`));
  return JSON.parse(m[1]);
}
function decode(entry) {
  const b = Buffer.from(entry.data, 'base64');
  return entry.compressed ? gunzipSync(b) : b;
}
function write(rel, data) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
}
for (const d of ['screens', 'source', 'fonts', 'svg', 'data']) rmSync(join(OUT, d), { recursive: true, force: true });

// ── Template renderer: {{a.b}}, <sc-for list as>, <sc-if value>, sc-camel-* ──
function lookup(scope, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
}
function findClose(src, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(src))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { start: m.index, end: re.lastIndex };
  }
  throw new Error('unclosed ' + tag);
}
function render(src, scope) {
  let out = '';
  const open = /<(sc-for|sc-if)\b([^>]*)>/g;
  let pos = 0, m;
  while ((m = open.exec(src))) {
    out += interp(src.slice(pos, m.index), scope);
    const tag = m[1], attrs = m[2];
    const close = findClose(src, tag, open.lastIndex);
    const inner = src.slice(open.lastIndex, close.start);
    if (tag === 'sc-for') {
      const list = lookup(scope, attrs.match(/list="\{\{([\w.]+)\}\}"/)[1]);
      const as = attrs.match(/as="(\w+)"/)[1];
      for (const item of list) out += render(inner, { ...scope, [as]: item });
    } else if (lookup(scope, attrs.match(/value="\{\{([\w.]+)\}\}"/)[1])) {
      out += render(inner, scope);
    }
    pos = open.lastIndex = close.end;
  }
  return out + interp(src.slice(pos), scope);
}
function interp(s, scope) {
  return s
    .replace(/\{\{([\w.]+)\}\}/g, (_, p) => { const v = lookup(scope, p); if (v === undefined) throw new Error('missing ' + p); return String(v); })
    .replace(/sc-camel-([\w-]+)=/g, (_, a) => a.replace(/-(\w)/g, (__, c) => c.toUpperCase()) + '=');
}
function renderVals(logicSrc) {
  class DCLogic { constructor() { this.props = {}; } }
  const Component = new Function('DCLogic', logicSrc + '\nreturn Component;')(DCLogic);
  return new Component().renderVals();
}

// ── Pass 1: pages, fonts, templates ──
const root = readFileSync(BUNDLE, 'utf8');
const rootManifest = island(root, 'manifest');
const fontFiles = {}; // uuid -> file name (per page; identical bytes across pages)
let fontCss = null;
const icons = {}, ships = {}, structureArt = {}, pageVals = {};

for (const [uuid, name] of Object.entries(PAGES)) {
  const page = decode(rootManifest[uuid]).toString('utf8');
  const manifest = island(page, 'manifest');
  const tpl = island(page, 'template');

  // Fonts: name each woff2 by family/weight/subset from the @font-face that references it.
  const faces = [...tpl.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face \{[^}]*?font-family: '([^']+)';[^}]*?font-weight: (\d+);[^}]*?src: url\("([0-9a-f-]+)"\)/g)];
  for (const [, subset, family, weight, id] of faces) {
    fontFiles[id] = `${family.toLowerCase().replace(/ /g, '-')}-${weight}-${subset}.woff2`;
    write('fonts/' + fontFiles[id], decode(manifest[id]));
  }
  const fontBlock = tpl.match(/<style>(\/\* vietnamese \*\/[\s\S]*?)<\/style>/)[1];
  if (!fontCss) fontCss = fontBlock.replace(/url\("([0-9a-f-]+)"\)/g, (_, id) => `url("./${fontFiles[id]}")`);

  const baseCss = tpl.match(/<style>\n(body\{[\s\S]*?)<\/style>/)[1].trim();
  const markup = tpl.match(/<\/helmet>\n([\s\S]*?)\n<\/x-dc>/)[1];
  const logic = tpl.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1].trim();
  const title = tpl.match(/<title>(.*?)<\/title>/)[1];

  // source/: the original component, verbatim apart from the font block.
  write(`source/${name}.dc.html`,
    `<!-- ${title} — original design-tool component, extracted verbatim (fonts moved to ../fonts/fonts.css).\n` +
    `     Template syntax: {{path}} interpolation, <sc-for list as>, <sc-if value>, sc-camel-* = camelCase SVG attrs.\n` +
    `     The <script type="text/x-dc"> class computes every {{value}} the template reads. -->\n` +
    `<style>\n${baseCss}\n</style>\n${markup}\n<script type="text/x-dc">\n${logic}\n</script>\n`);

  // screens/: static, rendered with the default props (accent #5fe3c0, planet #a9c1dc).
  const vals = renderVals(logic);
  pageVals[name] = vals;
  const html = render(markup, vals).replace(/ hint-[\w-]+="[^"]*"/g, '');
  write(`screens/${name}.html`,
    `<!DOCTYPE html>\n<html lang="en"><head>\n<meta charset="utf-8">\n<title>${title}</title>\n` +
    `<link rel="stylesheet" href="../fonts/fonts.css">\n<style>\n${baseCss}\n</style>\n</head>\n<body>\n${html}\n</body></html>\n`);

  // Collect art from the logic source (the returned vals only hold the subset each page uses).
  const grab = (re) => { const m = logic.match(re); return m ? new Function(`return ${m[1]}`)() : {}; };
  Object.assign(icons, grab(/const ICON = (\{[\s\S]*?\n {4}\});/));
  Object.assign(ships, grab(/const SHIP = (\{[\s\S]*?\n {4}\});/));
  Object.assign(structureArt, grab(/const ART = (\{.*\});/));
}
write('fonts/fonts.css', fontCss.trim() + '\n');

// ── Pass 2: SVG art as files + JSON for the port ──
const svg = (vb, w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" fill="none">\n${body}\n</svg>\n`;

for (const [k, [stroke, fill]] of Object.entries(icons)) {
  write(`svg/icons/${k}.svg`, svg('0 0 24 24', 24, 24,
    `  <path d="${stroke}" stroke="#cfdbe7" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>\n` +
    `  <path d="${fill}" fill="${ACCENT}"/>`));
}
for (const [k, [hull, det, glow]] of Object.entries(ships)) {
  write(`svg/ships/${k.toLowerCase().replace(/ /g, '-')}.svg`, svg('0 0 64 32', 64, 32,
    `  <path d="${hull}" fill="rgba(159,177,197,0.12)" stroke="#a9bacd" stroke-width="1.3" stroke-linejoin="round"/>\n` +
    `  <path d="${det}" stroke="#5d6f84" stroke-width="1"/>\n` +
    `  <path d="${glow}" fill="${ACCENT}"/>`));
}
for (const [k, a] of Object.entries(structureArt)) {
  write(`svg/structures/${k}.svg`, svg('0 0 300 224', 300, 224,
    `  <defs><filter id="bglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>\n` +
    `  <rect width="300" height="224" fill="#0b1119"/>\n` +
    `  <path d="${a.sky}" stroke="#4a5f78" stroke-width="1.3" stroke-linecap="round"/>\n` +
    `  <path d="${a.far}" fill="#0f1823" stroke="#1f2d3c" stroke-width="1"/>\n` +
    `  <path d="${a.main}" fill="#142030" stroke="#566b83" stroke-width="1" stroke-linejoin="round"/>\n` +
    `  <path d="${a.det}" stroke="#40546b" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>\n` +
    `  <path d="${a.glow}" fill="${ACCENT}" filter="url(#bglow)" opacity="0.8"/>\n` +
    `  <path d="${a.glow}" fill="${ACCENT}"/>`));
}
// One-off art that lives inline in the templates.
const cd = readFileSync(join(OUT, 'screens/command-deck.html'), 'utf8');
write('svg/planet-hud.svg', cd.match(/<svg width="560" height="560"[\s\S]*?<\/svg>/)[0]
  .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ style="[^"]*"/, ''));
const sy = readFileSync(join(OUT, 'screens/shipyard.html'), 'utf8');
write('svg/cruiser-blueprint.svg', sy.match(/<svg width="560" height="220"[\s\S]*?<\/svg>/)[0]
  .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
write('svg/logo.svg', svg('0 0 40 40', 40, 40,
  `  <rect x="6" y="6" width="28" height="28" transform="rotate(45 20 20)" stroke="${ACCENT}" stroke-width="1.5"/>\n` +
  `  <rect x="14" y="14" width="12" height="12" transform="rotate(45 20 20)" fill="${ACCENT}"/>`));

// data/: the path strings and the mock values, ready to import into React.
write('data/icons.json', JSON.stringify(Object.fromEntries(Object.entries(icons).map(([k, [stroke, fill]]) => [k, { stroke, fill }])), null, 2) + '\n');
write('data/ships.json', JSON.stringify(Object.fromEntries(Object.entries(ships).map(([k, [hull, detail, glow]]) => [k, { hull, detail, glow }])), null, 2) + '\n');
write('data/structure-art.json', JSON.stringify(structureArt, null, 2) + '\n');
write('data/mock-values.json', JSON.stringify(pageVals, (k, v) => (k === 'stars' ? `[${v.length} generated stars]` : v), 2) + '\n');

console.log(`fonts ${Object.keys(fontFiles).length / 4} · icons ${Object.keys(icons).length} · ships ${Object.keys(ships).length} · structure art ${Object.keys(structureArt).length}`);
