// Draws every icon, silhouette, illustration and blueprint from data/*.json on one sheet, old and
// new side by side (new art is marked NEW), for the by-eye check in #16 / #31.
// Run from the repo root: node design/contact-sheet.mjs [accent]  →  design/contact-sheet.svg
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const data = (f) => JSON.parse(readFileSync(join(DIR, 'data', f), 'utf8'));
const drawn = JSON.parse(readFileSync(join(DIR, 'drawn-art.json'), 'utf8'));
const accent = process.argv[2] ?? '#5fe3c0';

const icons = data('icons.json');
const ships = data('ships.json');
const structureArt = data('structure-art.json');
const blueprints = data('blueprints.json');
const isNew = (group, k) => k in drawn[group] && !(group === 'blueprints' && k === 'Cruiser');

const W = 1800;
let y = 0;
const out = [];
const label = (x, yy, text, fresh) =>
  `<text x="${x}" y="${yy}" fill="${fresh ? accent : '#6f8196'}" font-family="Chakra Petch, sans-serif" font-size="12">${text}${fresh ? ' · NEW' : ''}</text>`;
const heading = (text) => {
  y += 40;
  out.push(`<text x="24" y="${y}" fill="#d8e1ea" font-family="Chakra Petch, sans-serif" font-size="20">${text}</text>`);
  y += 20;
};

heading('ICONS · 24×24 (shown ×2)');
Object.entries(icons).forEach(([k, i], n) => {
  const x = 24 + (n % 14) * 126;
  const yy = y + Math.floor(n / 14) * 90;
  out.push(
    `<g transform="translate(${x} ${yy}) scale(2)"><rect width="24" height="24" fill="#111925"/>` +
      `<path d="${i.stroke}" fill="none" stroke="#cfdbe7" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${i.fill}" fill="${accent}"/></g>`,
    label(x, yy + 66, k, isNew('icons', k)),
  );
});
y += Math.ceil(Object.keys(icons).length / 14) * 90;

heading('SHIP SILHOUETTES · 64×32 (shown ×2)');
Object.entries(ships).forEach(([k, s], n) => {
  const x = 24 + n * 190;
  out.push(
    `<g transform="translate(${x} ${y}) scale(2)" stroke-linejoin="round">` +
      `<path d="${s.hull}" fill="rgba(159,177,197,0.12)" stroke="#a9bacd" stroke-width="1.3"/>` +
      `<path d="${s.detail}" fill="none" stroke="#5d6f84" stroke-width="1"/>` +
      `<path d="${s.glow}" fill="${accent}"/></g>`,
    label(x, y + 84, k, isNew('ships', k)),
  );
});
y += 100;

heading('STRUCTURE ILLUSTRATIONS · 300×224');
Object.entries(structureArt).forEach(([k, a], n) => {
  const x = 24 + (n % 5) * 350;
  const yy = y + Math.floor(n / 5) * 260;
  out.push(
    `<g transform="translate(${x} ${yy})"><rect width="300" height="224" fill="#0b1119"/>` +
      `<path d="${a.sky}" fill="none" stroke="#4a5f78" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="${a.far}" fill="#0f1823" stroke="#1f2d3c" stroke-width="1"/>` +
      `<path d="${a.main}" fill="#142030" stroke="#566b83" stroke-width="1" stroke-linejoin="round"/>` +
      `<path d="${a.det}" fill="none" stroke="#40546b" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${a.glow}" fill="${accent}" filter="url(#bglow)" opacity="0.8"/>` +
      `<path d="${a.glow}" fill="${accent}"/></g>`,
    label(x, yy + 242, k, isNew('structureArt', k)),
  );
});
y += Math.ceil(Object.keys(structureArt).length / 5) * 260;

heading('BLUEPRINTS · 280×110 (shown ×2)');
Object.entries(blueprints).forEach(([k, b], n) => {
  const x = 24 + (n % 3) * 590;
  const yy = y + Math.floor(n / 3) * 260;
  const text = (t, anchor) =>
    `<text x="${t.x}" y="${t.y}" text-anchor="${anchor}" fill="#6f8196" font-family="Chakra Petch, sans-serif" font-size="6">${t.label}</text>`;
  out.push(
    `<g transform="translate(${x} ${yy}) scale(2)" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
      `<rect width="280" height="110" fill="#0b1119"/>` +
      `<path d="${b.hull}" fill="rgba(159,177,197,0.08)" stroke="#b7c6d6" stroke-width="1"/>` +
      `<path d="${b.detail}" stroke="#4d5f74" stroke-width="0.7"/>` +
      `<path d="${b.module}" fill="${accent}" fill-opacity="0.1" stroke="${accent}" stroke-width="0.8"/>` +
      `<path d="${b.fixtures}" stroke="#b7c6d6" stroke-width="0.8"/>` +
      `<path d="${b.barrels}" stroke="#b7c6d6" stroke-width="1.4"/>` +
      `<path d="${b.glow}" fill="${accent}" fill-opacity="0.85"/>` +
      `<path d="${b.dimension.path}" stroke="#4d5f74" stroke-width="0.6"/>` +
      text(b.dimension, 'middle') +
      `<path d="${b.callout.path}" stroke="#4d5f74" stroke-width="0.6"/>` +
      text(b.callout, 'start') +
      `</g>`,
    label(x, yy + 238, k, isNew('blueprints', k)),
  );
});
y += Math.ceil(Object.keys(blueprints).length / 3) * 260;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}">\n` +
  `<defs><filter id="bglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>\n` +
  `<rect width="${W}" height="${y}" fill="#070b11"/>\n${out.join('\n')}\n</svg>\n`;
writeFileSync(join(DIR, 'contact-sheet.svg'), svg);
console.log(`contact-sheet.svg · ${W}×${y} · accent ${accent}`);
