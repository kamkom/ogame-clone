// PROTOTYPE — throwaway. For "UI states the design doesn't show" (kamkom/ogame-clone#14).
// Patches the static design/screens/*.html into states the design never drew.
// ?s=<scenario>  ?v=A|B|C  — three "state languages", applied to every scenario:
//   A  Quiet     — reuse the design's own locked look: dim, dashed, say why in place
//   B  Explicit  — full-strength UI plus chips, lock icons and ✓/✕ reason lists
//   C  Forward   — tell the Player *when* / *how* it becomes possible, with a shortcut
(() => {
  const params = new URLSearchParams(location.search);
  const V = params.get('v') ?? 'A';
  const S = params.get('s') ?? 'soon';
  const SCREEN = location.pathname.split('/').pop().replace('.html', '');

  // ── helpers ──────────────────────────────────────────────────────────────
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  const byText = (t, sel = '*', r = document) => qa(sel, r).find((e) => own(e) === t);
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const css = (text) => document.head.appendChild(Object.assign(document.createElement('style'), { textContent: text }));
  const pick = (o) => (typeof o === 'object' && o && 'A' in o ? o[V] : o);

  const CP = "font-family:'Chakra Petch',sans-serif;";
  const LABEL = CP + 'font-size:11px;letter-spacing:.12em;color:#6f8196;';
  const ICON = {
    alloy: ['#c3cfdc', 'M3.5 17l3-5.5h11l3 5.5z M7.5 11.5l2-4.5h5l2 4.5'],
    crystal: ['#7fb8ff', 'M12 2.5l5 7-5 12-5-12z M7 9.5h10'],
    deut: ['#5fe3c0', 'M12 3c3.5 4.4 5.5 7.4 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 10.4 8.5 7.4 12 3z'],
  };
  const resIcon = (k, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${ICON[k][0]}" stroke-width="1.8" stroke-linejoin="round"><path d="${ICON[k][1]}"></path></svg>`;
  const LOCK = (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;
  const CLOCK = (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>`;
  const XI = (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
  const CHECK = (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`;
  const chip = (t, tone = 'mute') => {
    const c = { mute: ['#8a9bb0', '#243244'], warn: ['#ffc36b', 'rgba(255,195,107,.35)'], bad: ['#ff8a8a', 'rgba(255,138,138,.35)'], ok: ['#5fe3c0', 'rgba(95,227,192,.35)'] }[tone];
    return `<span class="p-chip" style="${CP}font-size:9.5px;font-weight:600;letter-spacing:.12em;padding:2px 6px;border-radius:4px;border:1px solid ${c[1]};color:${c[0]};white-space:nowrap;line-height:1.3">${t}</span>`;
  };
  const xBtn = (label) => `<button class="p-x" aria-label="Cancel ${label}" title="Cancel · refund 100%" style="width:24px;height:24px;flex-shrink:0;border-radius:6px;border:1px solid #1f2b3a;background:transparent;color:#8a9bb0;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0">${XI(11)}</button>`;
  const cancelBtn = (label) => `<button class="p-x" aria-label="Cancel ${label}" style="height:26px;padding:0 10px;border-radius:6px;border:1px solid #243244;background:transparent;color:#9fb0c2;${CP}font-size:11px;font-weight:600;letter-spacing:.08em;cursor:pointer">CANCEL</button>`;

  // disabled buttons in each language
  const OUT = `height:44px;padding:0 16px;border-radius:8px;${CP}font-weight:600;font-size:13px;letter-spacing:.06em;display:flex;align-items:center;gap:7px;white-space:nowrap;`;
  const disBtn = (label, { a = label, b = label, c = label } = {}) =>
    pick({
      A: `<button disabled aria-disabled="true" style="${OUT}border:1px dashed #243244;background:transparent;color:#d8e1ea;opacity:.4;cursor:not-allowed">${a}</button>`,
      B: `<button disabled aria-disabled="true" style="${OUT}border:1px solid #16202c;background:#111925;color:#6f8196;cursor:not-allowed">${LOCK()}${b}</button>`,
      C: `<button disabled aria-disabled="true" style="${OUT}border:1px solid #243244;background:transparent;color:#9fb0c2;cursor:not-allowed">${CLOCK()}${c}</button>`,
    });
  const BIG = `height:50px;width:100%;border-radius:10px;${CP}font-weight:600;font-size:14px;letter-spacing:.08em;display:flex;align-items:center;justify-content:center;gap:9px;`;
  const bigDis = (a, b, c) =>
    pick({
      A: `<button disabled aria-disabled="true" style="${BIG}border:1px dashed #243244;background:transparent;color:#d8e1ea;opacity:.45;cursor:not-allowed">${a}</button>`,
      B: `<button disabled aria-disabled="true" style="${BIG}border:1px solid #16202c;background:#111925;color:#6f8196;cursor:not-allowed">${LOCK(14)}${b}</button>`,
      C: `<button disabled aria-disabled="true" style="${BIG}border:1px solid #243244;background:transparent;color:#9fb0c2;cursor:not-allowed">${CLOCK(14)}${c}</button>`,
    });
  const bigGo = (t, href = '#') => `<a href="${href}" class="p-go" style="${BIG}box-sizing:border-box;border:0;background:#5fe3c0;color:#04120d;text-decoration:none">${t}</a>`;
  const reasonList = (rows) =>
    `<div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:10px;background:#0e1520;border:1px solid #16202c">${rows
      .map(([ok, t, v = '']) => `<div style="display:flex;align-items:center;gap:10px;font-size:13.5px"><span style="color:${ok ? '#5fe3c0' : '#ff8a8a'};display:flex">${ok ? CHECK() : XI()}</span><span style="flex-grow:1;color:${ok ? '#9fb0c2' : '#d8e1ea'}">${t}</span><span style="${CP}color:${ok ? '#5fe3c0' : '#ff8a8a'}">${v}</span></div>`)
      .join('')}</div>`;
  const nav = (screen) => {
    const p = new URLSearchParams(location.search);
    return `/screens/${screen}.html?${p}`;
  };

  // ── shared chrome ────────────────────────────────────────────────────────
  const setRes = (vals) => {
    const chips = qa('header > div > div');
    ['alloy', 'crystal', 'deut', 'energy'].forEach((k, i) => {
      if (!vals[k]) return;
      const [v, rate, pct] = vals[k];
      const c = chips[i];
      c.querySelector('div[style*="font-size: 15px"]').textContent = v;
      c.querySelector('div > span:nth-child(2)').textContent = rate;
      c.querySelector('div[style*="height: 3px"] > div').style.width = pct + '%';
    });
  };
  const setPlanet = (name) => { q('header > button > span:nth-child(2)').textContent = name; };

  // ── baseline: out-of-scope UI shown disabled (applies in every scenario) ─
  const soonDeck = () => {
    for (const name of ['MOON', 'DEFENSE GRID']) {
      const box = byText(name, 'span').parentElement;
      const [label, value, cap] = box.children;
      if (V === 'A') {
        value.textContent = '—'; value.style.color = '#6f8196';
        cap.textContent = 'Coming soon';
        box.style.opacity = '.7';
      } else if (V === 'B') {
        label.innerHTML = `${name} &nbsp;${chip('SOON')}`;
        value.textContent = name === 'MOON' ? 'No moon' : 'No defenses';
        value.style.color = '#6f8196';
        cap.textContent = name === 'MOON' ? 'Moons come with fleets & combat' : 'Defenses tab is not in this version';
      } else {
        box.style.cssText += ';padding:10px 14px;border:1px dashed #243244;border-radius:10px;opacity:.55';
        label.innerHTML = `<span style="display:flex;align-items:center;gap:6px">${LOCK(10)} ${name}</span>`;
        value.textContent = 'Later'; value.style.cssText += ';font-size:16px;color:#8a9bb0';
        cap.textContent = 'Not in v1';
      }
    }
    const dock = byText('FLEET DOCK', 'h2').closest('section');
    const sub = dock.querySelector('h2 + span');
    sub.innerHTML = '499 ships docked';
    const dispatch = dock.querySelector('a');
    if (V === 'A') dispatch.replaceWith(h(`<span aria-disabled="true" title="Coming soon" style="height:40px;padding:0 18px;border-radius:8px;border:1px dashed #243244;color:#d8e1ea;opacity:.4;display:flex;align-items:center;${CP}font-weight:600;font-size:13px;letter-spacing:.08em;cursor:not-allowed">DISPATCH</span>`));
    if (V === 'B') dispatch.replaceWith(h(`<span aria-disabled="true" style="height:40px;padding:0 14px 0 16px;border-radius:8px;border:1px solid #16202c;background:#111925;color:#6f8196;display:flex;align-items:center;gap:8px;${CP}font-weight:600;font-size:13px;letter-spacing:.08em;cursor:not-allowed">${LOCK()}DISPATCH ${chip('SOON')}</span>`));
    if (V === 'C') dispatch.replaceWith(h(`<span style="font-size:13px;color:#6f8196">Dispatch arrives with fleets — ships stay docked for now</span>`));
  };
  const soonNav = () => {
    const links = ['Fleet', 'Galaxy', 'Alliance'].map((t) => qa('nav a').find((a) => own(a) === t));
    links.forEach((a) => { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.title = 'Coming soon'; a.style.cursor = 'not-allowed'; });
    if (V === 'A') links.forEach((a) => (a.style.opacity = '.35'));
    if (V === 'B') links.forEach((a) => { a.style.height = '70px'; a.style.gap = '4px'; a.insertAdjacentHTML('beforeend', chip('SOON')); a.querySelector('svg').style.opacity = '.5'; });
    if (V === 'C') {
      const navEl = q('nav');
      const spacer = h(`<div style="margin-top:auto;width:56px;display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:4px"><div style="width:40px;border-top:1px solid #16202c"></div><span style="${CP}font-size:9.5px;letter-spacing:.14em;color:#4d5f74">LATER</span></div>`);
      navEl.appendChild(spacer);
      links.forEach((a) => { a.style.opacity = '.4'; a.style.height = '52px'; navEl.appendChild(a); });
    }
  };
  const soonShipyard = () => {
    const tab = byText('Defenses', 'button');
    tab.setAttribute('aria-disabled', 'true'); tab.style.cursor = 'not-allowed';
    if (V === 'A') { tab.style.opacity = '.4'; tab.title = 'Coming soon'; }
    if (V === 'B') tab.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">Defenses ${chip('SOON')}</span>`;
    if (V === 'C') {
      const bar = tab.parentElement;
      bar.replaceWith(h(`<div style="display:flex;justify-content:space-between;align-items:center;height:36px;padding:0 4px;border-bottom:1px solid #16202c;font-size:13px;color:#6f8196"><span style="${LABEL}">SHIPS · 8 TYPES</span><span>Defenses later</span></div>`));
    }
    const open = byText('OPEN FLEET DISPATCH', 'a');
    if (!open) return;
    if (V === 'A') { open.removeAttribute('href'); open.style.cssText += ';border-style:dashed;opacity:.4;cursor:not-allowed'; open.title = 'Coming soon'; }
    if (V === 'B') { open.removeAttribute('href'); open.style.cssText += ';background:#111925;border-color:#16202c;color:#6f8196;gap:8px;cursor:not-allowed'; open.innerHTML = `${LOCK()}OPEN FLEET DISPATCH ${chip('SOON')}`; }
    if (V === 'C') open.replaceWith(h(`<span style="margin-top:4px;font-size:13px;color:#6f8196;text-align:center">Fleet dispatch arrives in a later version</span>`));
  };

  // ── Planet rename (global: the picker opens in every scenario) ───────────
  const renameUI = (open) => {
    const picker = q('header > button');
    const name = () => picker.querySelector('span:nth-child(2)').textContent;
    const close = () => qa('.p-rename').forEach((e) => e.remove()) || (picker.style.display = 'flex');
    const field = (w) => `<input class="p-input" value="${name()}" maxlength="20" style="width:${w};height:40px;box-sizing:border-box;padding:0 12px;border-radius:8px;border:1px solid #5fe3c0;background:#06090e;color:#d8e1ea;${CP}font-size:15px;font-weight:600;outline:none">`;
    const show = () => {
      close();
      if (V === 'A') {
        picker.style.display = 'none';
        const el = h(`<div class="p-rename" style="display:flex;align-items:center;gap:8px;position:relative">
          <span style="width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #f1f6ff, #6c8aa8 70%);margin:0 4px 0 2px"></span>
          ${field('190px')}
          <span style="font-size:13px;color:#6f8196">[4:212:8]</span>
          <button class="p-ok" aria-label="Save name" style="width:36px;height:36px;border-radius:8px;border:0;background:#5fe3c0;color:#04120d;display:flex;align-items:center;justify-content:center;cursor:pointer">${CHECK(14)}</button>
          <button class="p-no" aria-label="Cancel" style="width:36px;height:36px;border-radius:8px;border:1px solid #1f2b3a;background:transparent;color:#9fb0c2;display:flex;align-items:center;justify-content:center;cursor:pointer">${XI(13)}</button>
          <span style="position:absolute;left:30px;top:48px;font-size:12px;color:#6f8196;white-space:nowrap">2–20 characters · Enter to save, Esc to cancel</span>
        </div>`);
        picker.after(el);
      } else if (V === 'B') {
        const r = picker.getBoundingClientRect();
        document.body.firstElementChild.appendChild(h(`<div class="p-rename" style="position:absolute;left:${r.left}px;top:${r.bottom + 8}px;z-index:40;width:320px;box-sizing:border-box;padding:16px;border-radius:12px;background:#0b1119;border:1px solid #1f2b3a;box-shadow:0 18px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;align-items:center;gap:12px"><span style="width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #f1f6ff, #6c8aa8 70%)"></span>
            <div style="display:flex;flex-direction:column;gap:2px"><span style="${CP}font-size:17px;font-weight:600">${name()}</span><span style="font-size:12px;color:#6f8196">[4:212:8] · 163 of 188 Fields · 12,800 km</span></div></div>
          <div style="display:flex;flex-direction:column;gap:6px"><label style="${LABEL}">RENAME PLANET</label><div style="display:flex;gap:8px">${field('100%')}<button class="p-ok" style="height:40px;padding:0 14px;border-radius:8px;border:0;background:#5fe3c0;color:#04120d;${CP}font-weight:600;font-size:12px;letter-spacing:.08em;cursor:pointer">SAVE</button></div></div>
          <div style="padding-top:12px;border-top:1px solid #16202c;display:flex;justify-content:space-between;font-size:12px;color:#6f8196"><span>1 of 1 Planets</span><span>Colonies ${chip('SOON')}</span></div>
        </div>`));
      } else {
        document.body.firstElementChild.appendChild(h(`<div class="p-rename" style="position:absolute;inset:0;z-index:40;background:rgba(4,7,12,.72);display:flex;align-items:center;justify-content:center">
          <div role="dialog" aria-label="Rename planet" style="width:420px;box-sizing:border-box;padding:24px;border-radius:14px;background:#0b1119;border:1px solid #1f2b3a;display:flex;flex-direction:column;gap:18px">
            <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;${CP}font-size:20px;font-weight:600">Rename planet</h2><button class="p-no" aria-label="Close" style="width:32px;height:32px;border-radius:8px;border:1px solid #1f2b3a;background:transparent;color:#9fb0c2;display:flex;align-items:center;justify-content:center;cursor:pointer">${XI(12)}</button></div>
            <div style="display:flex;flex-direction:column;gap:6px"><label style="${LABEL}">NAME</label>${field('100%')}<div style="display:flex;justify-content:space-between;font-size:12px;color:#6f8196"><span>Letters, digits, spaces, - and _</span><span class="p-count">${name().length} / 20</span></div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px"><button class="p-no" style="height:44px;padding:0 18px;border-radius:8px;border:1px solid #243244;background:transparent;color:#d8e1ea;${CP}font-weight:600;font-size:13px;letter-spacing:.06em;cursor:pointer">CANCEL</button><button class="p-ok" style="height:44px;padding:0 20px;border-radius:8px;border:0;background:#5fe3c0;color:#04120d;${CP}font-weight:600;font-size:13px;letter-spacing:.06em;cursor:pointer">SAVE NAME</button></div>
          </div></div>`));
      }
      const input = q('.p-rename .p-input');
      input.focus(); input.select();
      const save = () => { const v = input.value.trim(); if (v.length >= 2) picker.querySelector('span:nth-child(2)').textContent = v; close(); };
      input.addEventListener('input', () => { const c = q('.p-count'); if (c) c.textContent = `${input.value.length} / 20`; });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') close(); e.stopPropagation(); });
      qa('.p-rename .p-ok').forEach((b) => b.addEventListener('click', save));
      qa('.p-rename .p-no').forEach((b) => b.addEventListener('click', close));
      if (V === 'C') q('.p-rename').addEventListener('click', (e) => e.target === e.currentTarget && close());
    };
    picker.addEventListener('click', (e) => { e.stopPropagation(); q('.p-rename') ? close() : show(); });
    if (V === 'B') document.addEventListener('click', (e) => { if (!e.target.closest('.p-rename')) close(); });
    if (open) show();
  };

  // ── interaction states (global CSS per language) ─────────────────────────
  const BTN = 'button:not(:disabled):not([aria-disabled=true]), a[href], .p-go';
  const interactionCSS = {
    A: `
      ${BTN} { transition: border-color .12s, background-color .12s, transform .05s; }
      button[style*="border: 1px solid"]:not(:disabled):hover, a[style*="border: 1px solid"]:hover, .p-hover { border-color: #3b4d63 !important; }
      button[style*="background: #5fe3c0"]:hover, a[style*="background: #5fe3c0"]:hover, .p-go:hover { background: #7ff0d2 !important; }
      :focus-visible, .p-focus { outline: 2px solid #5fe3c0 !important; outline-offset: 2px !important; }
      ${BTN.split(', ').map((s) => s + ':active').join(', ')}, .p-press { transform: translateY(1px); }
      nav a[href]:hover { color: #9fb0c2 !important; }`,
    B: `
      ${BTN} { transition: box-shadow .15s, background-color .15s, filter .1s; }
      button[style*="background: transparent"]:not(:disabled):hover, a[style*="border: 1px solid"]:hover, .p-hover { background-color: #0e1520 !important; box-shadow: 0 0 0 1px rgba(95,227,192,.35) inset; }
      button[style*="background: #5fe3c0"]:hover, a[style*="background: #5fe3c0"]:hover, .p-go:hover { box-shadow: 0 0 18px rgba(95,227,192,.35); }
      :focus-visible, .p-focus { outline: none !important; box-shadow: 0 0 0 3px rgba(95,227,192,.40) !important; }
      ${BTN.split(', ').map((s) => s + ':active').join(', ')}, .p-press { filter: brightness(.8); }
      nav a[href]:hover { background: #0e1520 !important; color: #9fb0c2 !important; }`,
    C: `
      ${BTN} { position: relative; transition: background-color .12s, color .12s, transform .06s; }
      button[style*="background: transparent"]:not(:disabled):hover, a[style*="border: 1px solid"]:hover, .p-hover { background-color: rgba(95,227,192,.07) !important; color: #5fe3c0 !important; }
      button[style*="background: #5fe3c0"]:hover, a[style*="background: #5fe3c0"]:hover, .p-go:hover { background: #b8fff0 !important; }
      :focus-visible, .p-focus { outline: none !important; }
      :is(button, a, input):focus-visible::after, .p-focus::after { content: ''; position: absolute; inset: -5px; pointer-events: none;
        background: linear-gradient(#5fe3c0,#5fe3c0) left top/8px 1.5px, linear-gradient(#5fe3c0,#5fe3c0) left top/1.5px 8px,
                    linear-gradient(#5fe3c0,#5fe3c0) right top/8px 1.5px, linear-gradient(#5fe3c0,#5fe3c0) right top/1.5px 8px,
                    linear-gradient(#5fe3c0,#5fe3c0) left bottom/8px 1.5px, linear-gradient(#5fe3c0,#5fe3c0) left bottom/1.5px 8px,
                    linear-gradient(#5fe3c0,#5fe3c0) right bottom/8px 1.5px, linear-gradient(#5fe3c0,#5fe3c0) right bottom/1.5px 8px; background-repeat: no-repeat; }
      input:focus-visible { box-shadow: 0 0 0 1px #5fe3c0 !important; }
      ${BTN.split(', ').map((s) => s + ':active').join(', ')}, .p-press { transform: scale(.97); }
      nav a[href]:hover { color: #5fe3c0 !important; }`,
  };

  // ── Structures helpers ───────────────────────────────────────────────────
  const sCard = (name) => byText(name, 'span').closest('div[style*="height: 224px"]');
  const sFooter = (card) => card.querySelector('div[style*="padding-top: 12px"]');
  const sLevel = (card) => card.querySelector('span[style*="font-size: 28px"]');
  const costRow = (costs, bad = []) =>
    `<div style="display:flex;gap:12px">${costs.map(([k, v]) => `<span style="display:flex;align-items:center;gap:5px;${bad.includes(k) ? 'color:#ff8a8a' : ''}">${resIcon(k)}${v}</span>`).join('')}</div>`;
  const footer = (costs, time, btn, { bad = [], note = '' } = {}) =>
    h(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:12px;border-top:1px solid #16202c">
      <div style="display:flex;flex-direction:column;gap:6px;${CP}font-size:13px">${costRow(costs, bad)}<span style="font-size:12px;color:${note ? '#ff8a8a' : '#6f8196'}">${note || time}</span></div>${btn}</div>`);
  const upBtn = (name, t = 'UPGRADE') => `<button aria-label="Upgrade ${name}" style="height:44px;padding:0 16px;border-radius:8px;border:1px solid #243244;background:transparent;color:#d8e1ea;${CP}font-weight:600;font-size:13px;letter-spacing:.06em;cursor:pointer">${t}</button>`;
  const lockedFooter = (text) =>
    h(`<div style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px dashed #243244;font-size:13px;color:#8a9bb0">${LOCK(13)}<span>${text}</span></div>`);
  const progressFooter = (name, label, time, pct, refund) => {
    const x = pick({ A: xBtn(name), B: cancelBtn(name), C: xBtn(name) });
    const refundLine = V === 'C' ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#6f8196"><span>Cancel refunds ${refund}</span><span>Field returned</span></div>` : '';
    return h(`<div style="display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid #16202c">
      <div style="display:flex;align-items:center;gap:10px;${CP}font-size:13px"><span style="color:#5fe3c0;flex-grow:1">${label}</span><span>${time}</span>${V === 'B' ? '' : x}</div>
      <div style="display:flex;align-items:center;gap:10px"><div style="flex-grow:1;height:4px;border-radius:4px;background:#16202c"><div style="width:${pct}%;height:4px;border-radius:4px;background:#5fe3c0"></div></div>${V === 'B' ? x : ''}</div>${refundLine}</div>`);
  };
  const sAside = ({ card, head, name, desc, stats, block, bottom }) => {
    const aside = q('aside');
    const art = aside.firstElementChild;
    if (card) {
      art.querySelector('svg').replaceWith(card.querySelector('svg').cloneNode(true));
      art.lastElementChild.innerHTML = card.querySelector('div[style*="width: 52px"]').innerHTML;
    }
    [...aside.children].slice(1).forEach((c) => c.remove());
    aside.insertAdjacentHTML('beforeend', `
      <div style="display:flex;flex-direction:column;gap:6px"><span style="${LABEL}">${head}</span><h2 style="margin:0;${CP}font-weight:600;font-size:22px">${name}</h2><p style="margin:0;font-size:14px;line-height:1.5;color:#9fb0c2">${desc}</p></div>
      <div style="display:flex;flex-direction:column">${stats.map(([k, v], i) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #16202c;${i === stats.length - 1 ? 'border-bottom:1px solid #16202c;' : ''}font-size:14px"><span style="color:#8a9bb0">${k}</span><span style="${CP}">${v}</span></div>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:10px">${block}</div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">${bottom}</div>`);
  };
  const costLines = (rows) =>
    `<span style="${LABEL}">COST</span>` +
    rows.map(([k, amount, status, bad]) => `<div style="display:flex;align-items:center;gap:10px;${CP}font-size:15px">${resIcon(k, 16)}<span style="flex-grow:1">${amount}</span><span style="font-size:12px;color:${bad ? '#ff8a8a' : '#5fe3c0'}">${status}</span></div>`).join('');
  const reqLines = (rows) =>
    `<span style="${LABEL}">REQUIREMENTS</span>` +
    rows.map(([ok, t, v]) => `<div style="display:flex;align-items:center;gap:10px;font-size:14px">${V === 'A' ? '' : `<span style="display:flex;color:${ok ? '#5fe3c0' : '#ff8a8a'}">${ok ? CHECK() : XI()}</span>`}<span style="flex-grow:1">${t}</span><span style="${CP}color:${ok ? '#5fe3c0' : '#ff8a8a'}">${v}</span></div>`).join('');
  const heading = (t) => { q('h1 + span').textContent = t; };

  // disable a normal card's UPGRADE button in the current language
  const disableCard = (name, { a, b, c } = {}) => {
    const btn = sCard(name).querySelector('button[aria-label^="Upgrade"]');
    if (btn) btn.replaceWith(h(disBtn('UPGRADE', { a: a ?? 'UPGRADE', b: b ?? 'UPGRADE', c: c ?? 'UPGRADE' })));
  };

  // ── Command Deck helpers ─────────────────────────────────────────────────
  const deckQueue = () => q('aside > div');
  const deckRows = () => qa('aside div[style*="height: 50px"]');
  const deckRow = (name) => deckRows().find((r) => r.querySelector('span').textContent === name);
  const deckDisable = (name, reason) => {
    const b = deckRow(name).querySelector('button');
    b.disabled = true; b.setAttribute('aria-disabled', 'true'); b.title = reason; b.style.cursor = 'not-allowed';
    if (V === 'A') b.style.opacity = '.3';
    if (V === 'B') { b.style.background = '#111925'; b.style.borderColor = '#16202c'; b.style.color = '#6f8196'; b.innerHTML = LOCK(13); }
    if (V === 'C') { b.style.width = 'auto'; b.style.padding = '0 10px'; b.style.color = '#8a9bb0'; b.style.fontFamily = "'Chakra Petch',sans-serif"; b.style.fontSize = '12px'; b.innerHTML = reason; }
  };

  // ── Research helpers ─────────────────────────────────────────────────────
  const tech = (name) => byText(name, 'span', q('div[style*="top: 196px"]')).closest('button');
  const techSub = (name) => tech(name).querySelector('span:nth-child(2) > span:nth-child(2)');
  const rAside = ({ head, name, desc, stats, block, bottom }) => {
    const aside = q('aside');
    [...aside.children].slice(1).forEach((c) => c.remove());
    aside.insertAdjacentHTML('beforeend', `
      <div style="display:flex;flex-direction:column;gap:6px"><span style="${LABEL}">${head}</span><h2 style="margin:0;${CP}font-weight:600;font-size:22px">${name}</h2><p style="margin:0;font-size:14px;line-height:1.5;color:#9fb0c2">${desc}</p></div>
      <div style="display:flex;flex-direction:column">${stats.map(([k, v], i) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #16202c;${i === stats.length - 1 ? 'border-bottom:1px solid #16202c;' : ''}font-size:14px"><span style="color:#8a9bb0">${k}</span><span style="${CP}">${v}</span></div>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:10px">${block}</div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">${bottom}</div>`);
  };
  const activeBox = () => q('div[style*="width: 380px"]');

  // ── Shipyard helpers ─────────────────────────────────────────────────────
  const qtyPanel = () => q('#qty').closest('div[style*="padding: 16px"]');
  const buildBtn = () => qtyPanel().querySelector(':scope > div:last-child > button');
  const shipRow = (name) => byText(name, 'span').closest('button');
  const prodQueue = () => byText('PRODUCTION QUEUE', 'span').closest('div[style*="padding: 16px"]');
  const qtyCosts = () => qtyPanel().querySelector(':scope > div:last-child > div');

  // ── overlays for "whole screen unavailable" (B) ──────────────────────────
  const emptyOverlay = ({ left, top, width, height, icon, title, text, cta, href }) =>
    document.body.firstElementChild.appendChild(h(`<div style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(6,9,14,.72);backdrop-filter:blur(1.5px);border-radius:12px">
      <div style="width:400px;box-sizing:border-box;padding:28px;border-radius:14px;background:#0b1119;border:1px solid #1f2b3a;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
        <div style="width:56px;height:56px;border-radius:12px;background:#111925;border:1px solid #1a2533;display:flex;align-items:center;justify-content:center;color:#cfdbe7">${icon}</div>
        <h2 style="margin:0;${CP}font-size:20px;font-weight:600">${title}</h2>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#9fb0c2">${text}</p>
        <a class="p-go" href="${href}" style="margin-top:4px;height:44px;padding:0 20px;border-radius:8px;background:#5fe3c0;color:#04120d;display:flex;align-items:center;${CP}font-weight:600;font-size:13px;letter-spacing:.08em;text-decoration:none">${cta}</a>
      </div></div>`));
  const navIcon = (label) => qa('nav a').find((a) => own(a) === label)?.querySelector('svg').outerHTML.replace('width="22" height="22"', 'width="30" height="30"') ?? '';

  // ════════════════════════════════════════════════════════════════════════
  // Scenarios
  // ════════════════════════════════════════════════════════════════════════
  const NEW_RES = { alloy: ['500', '+30', 5], crystal: ['500', '+15', 5], deut: ['0', '+0', 0], energy: ['0', '/ 0', 0] };

  const SCENARIOS = [
    {
      key: 'soon', title: 'Coming soon (out-of-scope UI)', screens: ['command-deck', 'shipyard'],
      note: 'Fleet / Galaxy / Alliance nav, Moon + Defense Grid callouts, Fleet Dock DISPATCH, Defenses tab, Open Fleet Dispatch. This baseline is on in every scenario.',
      run: {},
    },
    {
      key: 'new', title: 'New Player — nothing built', screens: ['command-deck', 'structures', 'research', 'shipyard'],
      note: 'Every level 0, 500 Alloy / 500 Crystal, default name "Homeworld". Empty queues. No Research Lab → no Research; no Orbital Shipyard → no ships.',
      run: {
        'command-deck'() {
          setRes(NEW_RES); setPlanet('Homeworld');
          const surf = byText('SURFACE', 'span').parentElement;
          surf.children[1].innerHTML = '0 <span style="color: #6f8196;">/ 163</span>';
          surf.children[2].firstElementChild.style.width = '0%';
          const box = deckQueue();
          box.style.borderColor = '#16202c';
          box.innerHTML = `<div style="display:flex;justify-content:space-between;${CP}font-size:11px;letter-spacing:.12em"><span style="color:#6f8196">CONSTRUCTION QUEUE</span><span style="color:#6f8196">0 / 2</span></div>` + pick({
            A: `<div style="font-size:15px;color:#9fb0c2">Nothing under construction</div><div style="font-size:12px;color:#6f8196">2 build slots free</div>`,
            B: [1, 2].map((n) => `<div style="display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border-radius:8px;border:1px dashed #243244;font-size:13px;color:#6f8196"><span style="${CP}letter-spacing:.1em;font-size:11px">SLOT ${n}</span><span style="flex-grow:1">Free</span></div>`).join(''),
            C: `<div style="font-size:14px;color:#9fb0c2;line-height:1.45">Nothing building. Alloy pays for almost everything — start with an extractor.</div><a class="p-go" href="${nav('structures')}" style="height:40px;border-radius:8px;background:#5fe3c0;color:#04120d;display:flex;align-items:center;justify-content:center;gap:10px;${CP}font-weight:600;font-size:12.5px;letter-spacing:.08em;text-decoration:none">BUILD ALLOY EXTRACTOR <span style="opacity:.7">60 · 15</span></a>`,
          });
          deckRows().forEach((r) => { const lv = r.querySelectorAll('span')[1]; lv.textContent = '0'; lv.style.color = V === 'A' ? '#6f8196' : '#d8e1ea'; r.querySelector('button').style.color = '#d8e1ea'; });
          deckDisable('Orbital Shipyard', V === 'C' ? 'Robotics 2' : 'Requires Robotics Works 2');
          deckDisable('Robotics Works', V === 'C' ? '+200 Deut' : 'Not enough Deuterium');
          deckDisable('Research Lab', V === 'C' ? '+200 Deut' : 'Not enough Deuterium');
          const dock = byText('FLEET DOCK', 'h2').closest('section');
          dock.querySelector('h2 + span').textContent = 'No ships yet';
          const grid = dock.querySelector('div[style*="grid-template-columns"]');
          if (V === 'A') qa(':scope > div', grid).forEach((t) => { t.style.opacity = '.35'; t.querySelector('span').textContent = '0'; });
          if (V === 'B') grid.replaceWith(h(`<div style="height:92px;border-radius:10px;border:1px dashed #243244;display:flex;align-items:center;justify-content:center;gap:10px;font-size:14px;color:#6f8196">${LOCK(14)} Ships need an Orbital Shipyard</div>`));
          if (V === 'C') qa(':scope > div', grid).forEach((t) => { t.style.opacity = '.5'; t.style.borderStyle = 'dashed'; const n = t.querySelector('span'); n.textContent = '0'; n.style.color = '#6f8196'; t.lastElementChild.textContent = 'Shipyard 1'; });
        },
        structures() {
          setRes(NEW_RES); setPlanet('Homeworld');
          heading('0 of 163 fields developed · 0 of 2 build slots in use');
          const data = {
            'Alloy Extractor': ['+30 Alloy/h', '→ +63', [['alloy', '60'], ['crystal', '15']], '1m 48s'],
            'Crystal Refinery': ['+15 Crystal/h', '→ +31', [['alloy', '48'], ['crystal', '24']], '1m 44s'],
            'Deuterium Synthesizer': ['+0 Deuterium/h', '→ +14', [['alloy', '225'], ['crystal', '75']], '7m 12s'],
            'Solar Array': ['+0 Energy', '→ +22', [['alloy', '75'], ['crystal', '30']], '2m 31s'],
            'Robotics Works': ['Build time −0%', '→ −50%', [['alloy', '400'], ['crystal', '120'], ['deut', '200']], '12m 29s', ['deut']],
            'Research Lab': ['Research speed ×1', '→ unlocks Research', [['alloy', '200'], ['crystal', '400'], ['deut', '200']], '14m 24s', ['deut']],
          };
          const locked = { 'Fusion Reactor': 'Requires Deuterium Synthesizer 5 · Energy Theory 3', 'Orbital Shipyard': 'Requires Robotics Works 2', 'Nanite Foundry': 'Requires Robotics Works 10 · Computation 10' };
          for (const name of [...Object.keys(data), ...Object.keys(locked)]) {
            const card = sCard(name);
            const lv = sLevel(card); lv.textContent = '0'; lv.style.color = '#d8e1ea';
            if (V === 'B') lv.nextElementSibling.textContent = 'NOT BUILT';
            if (V === 'A') card.querySelector('svg').style.opacity = '.35';
            card.style.borderColor = '#16202c';
            const eff = card.querySelector('div[style*="flex-grow: 1;"][style*="font-size: 14px"]');
            if (locked[name]) {
              card.style.opacity = '.55';
              if (data[name] === undefined) eff.innerHTML = eff.innerHTML.replace(/Dreadnought unlocks at 12|\+320 Energy, burns 1.1k Deut\/h/, name === 'Fusion Reactor' ? '+0 Energy' : 'Builds ships');
              sFooter(card).replaceWith(lockedFooter(locked[name]));
              continue;
            }
            const [eNow, eNext, costs, time, bad] = data[name];
            eff.innerHTML = `${eNow} <span style="color: #5fe3c0;">${eNext}</span>`;
            const label = V === 'A' ? 'UPGRADE' : 'BUILD';
            const btn = bad ? disBtn(label, { c: 'IN —' }) : upBtn(name, label);
            sFooter(card).replaceWith(footer(costs, time, btn, { bad: V === 'A' ? [] : bad ?? [], note: bad && V !== 'A' ? (V === 'C' ? 'No Deuterium income yet' : 'Needs 200 Deuterium') : '' }));
          }
          sAside({
            card: sCard('Alloy Extractor'), head: 'RESOURCES · NOT BUILT → LEVEL 1', name: 'Alloy Extractor',
            desc: 'Cuts ore from the crust and smelts it on site. Every Structure and ship starts with Alloy.',
            stats: [['Production', `30 → <span style="color:#5fe3c0">63 /h</span>`], ['Energy use', `0 → <span style="color:#ffc36b">11</span>`], ['Build time', '1m 48s'], ['Fields', '+1']],
            block: costLines([['alloy', '60 Alloy', 'Available'], ['crystal', '15 Crystal', 'Available']]),
            bottom: `${bigGo(V === 'A' ? 'UPGRADE TO LEVEL 1' : 'BUILD LEVEL 1')}<span style="text-align:center;font-size:12px;color:#6f8196">Starts now in build slot 1 of 2</span>`,
          });
        },
        research() {
          setRes(NEW_RES); setPlanet('Homeworld');
          heading('No Research Lab on this Planet');
          const box = activeBox();
          box.style.borderColor = '#16202c';
          box.innerHTML = pick({
            A: `<div style="display:flex;justify-content:space-between;font-size:14px;color:#6f8196"><span>No research running</span><span style="${CP}">—</span></div>`,
            B: `<div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#6f8196">${LOCK(13)}<span style="flex-grow:1">Research Queue</span>${chip('NEEDS LAB')}</div>`,
            C: `<div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:#9fb0c2">Research unlocks with a Research Lab</span><a href="${nav('structures')}" style="font-size:13px">Build →</a></div>`,
          });
          const all = qa('section button');
          all.forEach((b) => {
            const sub = b.querySelector('span:nth-child(2) > span:nth-child(2)');
            b.style.borderColor = '#16202c';
            if (V === 'A') { b.style.opacity = '.5'; b.style.borderStyle = 'dashed'; b.style.background = 'transparent'; sub.textContent = 'Needs Research Lab'; sub.style.color = '#6f8196'; }
            else { sub.textContent = 'Level 0'; sub.style.color = '#8a9bb0'; }
          });
          const lanes = q('section').parentElement;
          if (V === 'B') {
            lanes.style.opacity = '.3'; q('aside').style.opacity = '.3';
            emptyOverlay({ left: 112, top: 180, width: 1304, height: 696, icon: navIcon('Research'), title: 'No Research Lab yet', text: 'Technologies are researched in a Research Lab. Level 1 costs 200 Alloy · 400 Crystal · 200 Deuterium, and you need a Deuterium Synthesizer first.', cta: 'GO TO STRUCTURES', href: nav('structures') });
            return;
          }
          if (V === 'A') {
            rAside({
              head: 'ENERGY & PHYSICS · LEVEL 0 → 1', name: 'Energy Theory', desc: 'The physics every reactor and drive is built on.',
              stats: [['Cost', '800 Crystal · 400 Deut'], ['Research time', '—']],
              block: reqLines([[false, 'Research Lab', '0 / 1']]),
              bottom: `${bigDis('REQUIRES RESEARCH LAB 1')}<span style="text-align:center;font-size:12px;color:#6f8196">Build a Research Lab in Structures</span>`,
            });
          } else {
            rAside({
              head: 'NEXT STEP', name: 'Get a Research Lab running', desc: 'Research needs a Lab, and the Lab needs Deuterium. Two builds away:',
              stats: [['Alloy', '500 / 425'], ['Crystal', '500 / 475'], ['Deuterium', '<span style="color:#ff8a8a">0 / 200</span>']],
              block: `<span style="${LABEL}">PLAN</span>
                <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:#0e1520;border:1px solid rgba(95,227,192,.35)"><span style="${CP}color:#5fe3c0;font-size:18px">1</span><div style="flex-grow:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">Deuterium Synthesizer 1</span><span style="font-size:12px;color:#6f8196">225 Alloy · 75 Crystal · 7m 12s</span></div><a class="p-go" href="${nav('structures')}" style="height:32px;padding:0 12px;border-radius:7px;background:#5fe3c0;color:#04120d;display:flex;align-items:center;${CP}font-weight:600;font-size:11.5px;letter-spacing:.08em;text-decoration:none">BUILD</a></div>
                <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px dashed #243244"><span style="${CP}color:#6f8196;font-size:18px">2</span><div style="flex-grow:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600;color:#9fb0c2">Research Lab 1</span><span style="font-size:12px;color:#6f8196">200 Alloy · 400 Crystal · 200 Deut · 14m 24s</span></div></div>`,
              bottom: `<span style="text-align:center;font-size:12px;color:#6f8196">Deuterium for the Lab arrives in ~14h at level 1</span>`,
            });
          }
        },
        shipyard() {
          setRes(NEW_RES); setPlanet('Homeworld');
          heading('No Orbital Shipyard on this Planet');
          qa('section button[style*="height: 70px"]').forEach((b) => { const n = b.lastElementChild; n.textContent = '0'; n.style.color = '#6f8196'; b.style.borderColor = '#16202c'; b.style.background = '#0b1119'; });
          const sel = shipRow('Cruiser'); sel.style.borderColor = 'rgba(95,227,192,0.35)'; sel.style.background = 'rgba(95,227,192,0.07)';
          byText('LINE SHIP · 32 IN ORBIT', 'span').textContent = 'LINE SHIP · NONE IN ORBIT';
          if (V === 'A') qa('section button[style*="height: 70px"]').forEach((b) => (b.style.opacity = '.5'));
          const pq = prodQueue();
          pq.innerHTML = `<div style="display:flex;justify-content:space-between;${CP}font-size:11px;letter-spacing:.12em"><span style="color:#6f8196">PRODUCTION QUEUE</span><span style="color:#6f8196">0 ORDERS</span></div><div style="font-size:14px;color:#6f8196">${V === 'C' ? 'Orders run one after another, unit by unit.' : 'No orders'}</div>`;
          const fs = byText('FLEET STRENGTH', 'span').parentElement;
          fs.querySelector('span[style*="font-size: 30px"]').textContent = '0';
          qa('div[style*="height: 8px"] > div', fs).forEach((d) => (d.style.background = '#16202c'));
          qa('div[style*="font-size: 13px"] > div > span:last-child', fs).forEach((s) => (s.textContent = '0'));
          if (V === 'B') {
            emptyOverlay({ left: 112, top: 180, width: 948, height: 696, icon: navIcon('Shipyard'), title: 'No Orbital Shipyard yet', text: 'Ships are built in an Orbital Shipyard. It needs Robotics Works 2 first.', cta: 'GO TO STRUCTURES', href: nav('structures') });
            return;
          }
          const p = qtyPanel();
          if (V === 'A') {
            p.style.borderColor = '#16202c';
            q('#qty').disabled = true; q('#qty').value = '0';
            qa('button[aria-label]', p).forEach((b) => { b.disabled = true; b.style.opacity = '.4'; });
            byText('Max 14', 'a').replaceWith(h(`<span style="font-size:13px;color:#6f8196">Max 0</span>`));
            buildBtn().replaceWith(h(disBtn('REQUIRES ORBITAL SHIPYARD 5')));
            qtyCosts().innerHTML = `<span style="font-size:13px;color:#6f8196">20,000 Alloy · 7,000 Crystal · 2,000 Deut each</span>`;
          } else {
            p.style.borderColor = '#16202c';
            p.innerHTML = `<span style="${LABEL}">TO BUILD CRUISERS</span>
              ${[['Orbital Shipyard', '0 / 5', 'structures', 'Build'], ['Impulse Drive', '0 / 4', 'research', 'Research'], ['Ion Lattice', '0 / 2', 'research', 'Research']].map(([t, v, s, verb]) => `<div style="display:flex;align-items:center;gap:10px;font-size:14px"><span style="color:#ff8a8a;display:flex">${XI()}</span><span style="flex-grow:1">${t}</span><span style="${CP}color:#ff8a8a">${v}</span><a href="${nav(s)}" style="font-size:13px;width:80px;text-align:right">${verb} →</a></div>`).join('')}`;
          }
        },
      },
    },
    {
      key: 'afford', title: "Can't afford", screens: ['structures', 'shipyard', 'research'],
      note: 'Low Alloy + Crystal. Structure cards and the detail panel, Shipyard "Max 0", and queuing Research (paid at enqueue).',
      run: {
        structures() {
          setRes({ alloy: ['18,410', '+42.1K', 12], crystal: ['4,212', '+21.9K', 4] });
          const cards = { 'Alloy Extractor': [['60.1k', '15.0k'], ['alloy', 'crystal'], '1h 12m', 'IN 59m'], 'Solar Array': [['44.0k', '17.6k'], ['alloy', 'crystal'], '1h 04m', 'IN 37m'], 'Fusion Reactor': [['14.2k', '5.7k'], ['crystal'], '26m 10s', 'IN 4m'], 'Robotics Works': [['102k', '30.7k'], ['alloy', 'crystal'], '3h 40m', 'IN 2h'], 'Orbital Shipyard': [['409k', '204k'], ['alloy', 'crystal'], '9h 15m', 'IN 9h'], 'Research Lab': [['102k', '205k'], ['alloy', 'crystal'], '7h 02m', 'IN 9h'] };
          for (const [name, [[a, c], bad, time, when]] of Object.entries(cards)) {
            const btn = disBtn('UPGRADE', { b: 'SHORT', c: when });
            sFooter(sCard(name)).replaceWith(footer([['alloy', a], ['crystal', c]], time, btn, { bad }));
          }
          const sel = sCard('Deuterium Synthesizer');
          sFooter(sel).replaceWith(footer([['alloy', '30.2k'], ['crystal', '10.1k']], '48m 20s', V === 'C' ? disBtn('', { c: 'IN 17m' }) : disBtn('UPGRADE', { b: 'SHORT' }), { bad: ['alloy', 'crystal'] }));
          sAside({
            head: 'RESOURCES · LEVEL 12 → 13', name: 'Deuterium Synthesizer', desc: "Filters heavy hydrogen from the planet's cold seas. Output falls on warmer worlds.",
            stats: [['Production', `9,340 → <span style="color:#5fe3c0">10,720 /h</span>`], ['Energy use', `412 → <span style="color:#ffc36b">468</span>`], ['Build time', '48m 20s'], ['Fields', '+1']],
            block: costLines(pick({
              A: [['alloy', '30,240 Alloy', '−11,830', true], ['crystal', '10,080 Crystal', '−5,868', true]],
              B: [['alloy', '30,240 Alloy', 'Missing 11,830', true], ['crystal', '10,080 Crystal', 'Missing 5,868', true]],
              C: [['alloy', '30,240 Alloy', 'in 17m', true], ['crystal', '10,080 Crystal', 'in 16m', true]],
            })) + (V === 'B' ? reasonList([[false, 'Alloy', '18,410 / 30,240'], [false, 'Crystal', '4,212 / 10,080'], [true, 'Build slot free', '1 of 2']]) : ''),
            bottom: `${bigDis('UPGRADE TO LEVEL 13', "CAN'T AFFORD YET", 'AFFORDABLE IN 17m')}<span style="text-align:center;font-size:12px;color:#6f8196">${pick({ A: 'Not enough Alloy and Crystal', B: 'Build slot 2 of 2 is free', C: 'At current production · Alloy +42.1k/h · Crystal +21.9k/h' })}</span>`,
          });
        },
        shipyard() {
          setRes({ alloy: ['18,410', '+42.1K', 12], crystal: ['4,212', '+21.9K', 4] });
          q('#qty').value = '1';
          byText('Max 14', 'a').replaceWith(h(pick({
            A: `<span style="font-size:13px;color:#6f8196">Max 0</span>`,
            B: `<span style="display:flex;align-items:center;gap:6px;font-size:13px;color:#ff8a8a">Max 0</span>`,
            C: `<span style="font-size:13px;color:#8a9bb0">Max 0 · 1 in 8m</span>`,
          })));
          byText('3h 20m', 'span').textContent = '20m';
          qtyCosts().innerHTML = costRow([['alloy', '20k'], ['crystal', '7k'], ['deut', '2k']], V === 'A' || V === 'B' ? ['alloy', 'crystal'] : ['crystal']).replace('gap:12px', 'gap:18px');
          qtyPanel().style.borderColor = '#16202c';
          buildBtn().replaceWith(h(disBtn('BUILD 1 CRUISER', { b: "CAN'T AFFORD", c: 'AFFORDABLE IN 8m' }).replace('height:44px', 'height:48px')));
          if (V === 'B') qtyPanel().insertAdjacentHTML('beforeend', reasonList([[false, 'Alloy', '18,410 / 20,000'], [false, 'Crystal', '4,212 / 7,000'], [true, 'Deuterium', '208,715 / 2,000']]));
        },
        research() {
          setRes({ crystal: ['4,212', '+21.9K', 4] });
          const cost = [...qa('aside div')].find((d) => own(d.firstElementChild ?? d) === 'Cost');
          cost.lastElementChild.innerHTML = V === 'A' ? '<span style="color:#ff8a8a">80k Crystal</span> · 24k Deut' : V === 'B' ? '<span style="color:#ff8a8a">80k Crystal</span> · 24k Deut' : '80k Crystal · 24k Deut';
          const bottom = q('aside > div:last-child');
          bottom.innerHTML = `${bigDis('QUEUE AFTER PHOTON LASERS', "CAN'T AFFORD YET", 'AFFORDABLE IN 3h 28m')}<span style="text-align:center;font-size:12px;color:#6f8196">${pick({ A: 'Not enough Crystal · paid when queued', B: 'Research is paid in full when queued', C: 'Research is paid when queued · Crystal +21.9k/h' })}</span>`;
          if (V === 'B') bottom.insertAdjacentHTML('afterbegin', reasonList([[false, 'Crystal', '4,212 / 80,000'], [true, 'Deuterium', '208,715 / 24,000'], [true, 'Queue space', '1 of 5']]));
        },
      },
    },
    {
      key: 'reqs', title: 'Requirements not met', screens: ['structures', 'shipyard'],
      note: 'Selecting a locked item: Nanite Foundry (Robotics Works 8 of 10), and Cruiser with Impulse Drive 3 of 4. Research already draws this state (Warp Drive panel).',
      run: {
        structures() {
          const card = sCard('Deuterium Synthesizer'); card.style.borderColor = '#16202c'; card.style.background = '#0b1119';
          const nan = sCard('Nanite Foundry');
          nan.style.borderColor = 'rgba(95,227,192,0.35)';
          if (V === 'B') { const lv = sLevel(nan); lv.parentElement.innerHTML = chip('LOCKED'); }
          if (V === 'C') sFooter(nan).replaceWith(h(`<div style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px dashed #243244;font-size:13px;color:#8a9bb0">${LOCK(13)}<span style="flex-grow:1">Robotics Works 8 → 10 · 2 upgrades away</span></div>`));
          const reqs = [[false, 'Robotics Works', '8 / 10'], [true, 'Computation', '10 / 10']];
          sAside({
            card: nan, head: 'FACILITIES · NOT BUILT → LEVEL 1', name: 'Nanite Foundry',
            desc: 'Swarms of assemblers that halve construction and shipyard time with every level.',
            stats: [['Build time', '−50% per level'], ['Fields', '+1']],
            block: pick({
              A: reqLines(reqs),
              B: reqLines(reqs) + `<div style="height:4px"></div>` + costLines([['alloy', '1,000,000 Alloy', 'Available'], ['crystal', '500,000 Crystal', 'Available'], ['deut', '100,000 Deuterium', 'Available']]),
              C: `<span style="${LABEL}">TO UNLOCK</span>
                  <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:#0e1520;border:1px solid #16202c"><span style="color:#ff8a8a;display:flex">${XI()}</span><div style="flex-grow:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">Robotics Works 8 → 10</span><span style="font-size:12px;color:#6f8196">2 upgrades · ~8h 10m in total</span></div><a href="#" style="font-size:13px">Select →</a></div>
                  <div style="display:flex;align-items:center;gap:12px;padding:0 12px;font-size:14px;color:#9fb0c2"><span style="color:#5fe3c0;display:flex">${CHECK()}</span>Computation 10 — met</div>`,
            }),
            bottom: `${bigDis('REQUIRES ROBOTICS WORKS 10', 'LOCKED', 'UPGRADE ROBOTICS WORKS FIRST')}<span style="text-align:center;font-size:12px;color:#6f8196">${pick({ A: 'Requirements use current levels, not ones being built', B: '1 of 2 requirements met', C: 'Counts current levels — a Robotics Works still building doesn’t count' })}</span>`,
          });
        },
        shipyard() {
          const row = shipRow('Cruiser');
          row.lastElementChild.textContent = '0';
          if (V === 'A') { row.querySelector('span > span:nth-child(2)').textContent = 'Requires Impulse Drive 4'; }
          if (V === 'B') row.lastElementChild.outerHTML = chip('LOCKED');
          byText('LINE SHIP · 32 IN ORBIT', 'span').textContent = 'LINE SHIP · NONE IN ORBIT';
          const p = qtyPanel();
          p.style.borderColor = '#16202c';
          if (V === 'A') {
            q('#qty').disabled = true; q('#qty').value = '0';
            qa('button[aria-label]', p).forEach((b) => { b.disabled = true; b.style.opacity = '.4'; });
            byText('Max 14', 'a').replaceWith(h(`<span style="font-size:13px;color:#6f8196">Max 0</span>`));
            buildBtn().replaceWith(h(disBtn('REQUIRES IMPULSE DRIVE 4').replace('height:44px', 'height:48px')));
          } else if (V === 'B') {
            p.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><span style="${LABEL};flex-grow:1">REQUIREMENTS</span>${chip('1 OF 3 MISSING', 'bad')}</div>
              ${reasonList([[true, 'Orbital Shipyard', '10 / 5'], [false, 'Impulse Drive', '3 / 4'], [true, 'Ion Lattice', '5 / 2']])}
              <div style="display:flex;justify-content:flex-end">${disBtn('BUILD CRUISERS', { b: 'LOCKED' }).replace('height:44px', 'height:48px')}</div>`;
          } else {
            p.innerHTML = `<div style="display:flex;align-items:center;gap:16px"><div style="flex-grow:1;display:flex;flex-direction:column;gap:4px"><span style="${LABEL}">NEXT STEP</span><span style="font-size:16px;font-weight:600">Research Impulse Drive 3 → 4</span><span style="font-size:13px;color:#6f8196">1 level · 2h 05m · 4k Alloy · 8k Crystal · 1.2k Deut</span></div><a class="p-go" href="${nav('research')}" style="height:48px;padding:0 20px;border-radius:10px;background:#5fe3c0;color:#04120d;display:flex;align-items:center;${CP}font-weight:600;font-size:14px;letter-spacing:.08em;text-decoration:none">OPEN RESEARCH</a></div>`;
          }
        },
      },
    },
    {
      key: 'full', title: 'Build Slots full + upgrade locks', screens: ['structures', 'command-deck'],
      note: '2 of 2 Build Slots busy (cancel ✕ on each). Research Lab locked while Photon Lasers is active. Orbital Shipyard locked while 2 orders are in production. Every other upgrade is disabled.',
      run: {
        structures() {
          heading('164 of 188 fields developed · 2 of 2 build slots in use');
          const rob = sCard('Robotics Works'); rob.style.borderColor = 'rgba(95,227,192,0.35)';
          const lv = sLevel(rob); lv.style.color = '#5fe3c0';
          sFooter(rob).replaceWith(progressFooter('Robotics Works', 'Building level 9', '02:10:05', 18, '102k · 30.7k'));
          const cr = sCard('Crystal Refinery');
          sFooter(cr).replaceWith(progressFooter('Crystal Refinery', 'Building level 16', '00:42:18', 62, '37.9k · 18.9k'));
          const slot = { b: 'FULL', c: '00:42:18' };
          const costs = { 'Alloy Extractor': ['60.1k', '15.0k', '1h 12m'], 'Deuterium Synthesizer': ['30.2k', '10.1k', '48m 20s'], 'Solar Array': ['44.0k', '17.6k', '1h 04m'], 'Fusion Reactor': ['14.2k', '5.7k', '26m 10s'] };
          for (const [name, [a, c, t]] of Object.entries(costs)) sFooter(sCard(name)).replaceWith(footer([['alloy', a], ['crystal', c]], t, disBtn('UPGRADE', slot)));
          const lab = sCard('Research Lab');
          const labText = pick({ A: 'Locked while Photon Lasers researches', B: 'Lab busy — Photon Lasers is researching', C: 'Free when Photon Lasers finishes · 01:12:40' });
          sFooter(lab).replaceWith(V === 'C' ? footer([['alloy', '102k'], ['crystal', '205k']], '7h 02m', disBtn('', { c: '01:12:40' })) : lockedFooter(labText));
          if (V === 'B') sLevel(lab).nextElementSibling.outerHTML = chip('LAB BUSY', 'warn');
          const yard = sCard('Orbital Shipyard');
          const yardText = pick({ A: 'Locked while 2 Shipyard Orders run', B: 'Shipyard busy — 2 orders in production', C: 'Free when orders finish · 2h 11m' });
          sFooter(yard).replaceWith(V === 'C' ? footer([['alloy', '409k'], ['crystal', '204k']], '9h 15m', disBtn('', { c: '2h 11m' })) : lockedFooter(yardText));
          if (V === 'B') sLevel(yard).nextElementSibling.outerHTML = chip('ORDERS', 'warn');
          const nan = sCard('Nanite Foundry');
          sFooter(nan).replaceWith(lockedFooter('Requires Robotics Works 10 · Computation 10 · no Shipyard Orders'));
          sAside({
            card: sCard('Deuterium Synthesizer'), head: 'RESOURCES · LEVEL 12 → 13', name: 'Deuterium Synthesizer', desc: "Filters heavy hydrogen from the planet's cold seas. Output falls on warmer worlds.",
            stats: [['Production', `9,340 → <span style="color:#5fe3c0">10,720 /h</span>`], ['Energy use', `412 → <span style="color:#ffc36b">468</span>`], ['Build time', '48m 20s'], ['Fields', '+1']],
            block: costLines([['alloy', '30,240 Alloy', 'Available'], ['crystal', '10,080 Crystal', 'Available']]) + (V === 'B' ? reasonList([[true, 'Alloy + Crystal', 'available'], [false, 'Build slot', '2 of 2 busy']]) : ''),
            bottom: `${bigDis('BOTH BUILD SLOTS BUSY', 'BUILD SLOTS FULL', 'SLOT FREES IN 00:42:18')}<span style="text-align:center;font-size:12px;color:#6f8196">${pick({ A: 'Cancel a build or wait for one to finish', B: 'Crystal Refinery 16 finishes first · 00:42:18', C: 'No waiting list — come back when Crystal Refinery finishes' })}</span>`,
          });
        },
        'command-deck'() {
          const box = deckQueue();
          const rows = [['Crystal Refinery', 16, '00:42:18', 62, '37.9k · 18.9k'], ['Robotics Works', 9, '02:10:05', 18, '102k · 30.7k']];
          box.innerHTML = `<div style="display:flex;justify-content:space-between;${CP}font-size:11px;letter-spacing:.12em"><span style="color:#6f8196">CONSTRUCTION QUEUE</span><span style="color:#5fe3c0">2 / 2</span></div>` +
            rows.map(([n, l, t, p, refund], i) => `<div style="display:flex;flex-direction:column;gap:8px;${i ? 'padding-top:12px;border-top:1px solid #16202c;' : ''}">
              <div style="display:flex;align-items:center;gap:10px">${V === 'B' ? `<span style="${CP}font-size:10.5px;letter-spacing:.1em;color:#6f8196">SLOT ${i + 1}</span>` : ''}<span style="font-size:${i && V === 'A' ? 15 : 17}px;font-weight:600;flex-grow:1">${n} → ${l}</span><span style="${CP}font-size:15px;color:#5fe3c0">${t}</span>${V === 'B' ? '' : xBtn(n)}</div>
              <div style="display:flex;align-items:center;gap:10px"><div style="flex-grow:1;height:4px;border-radius:4px;background:#16202c"><div style="width:${p}%;height:4px;border-radius:4px;background:#5fe3c0"></div></div>${V === 'B' ? cancelBtn(n) : ''}</div>
              ${V === 'C' ? `<span style="font-size:12px;color:#6f8196">Cancel refunds ${refund}</span>` : ''}</div>`).join('');
          const lv = deckRow('Robotics Works').querySelectorAll('span')[1]; lv.style.color = '#5fe3c0';
          const rb = deckRow('Robotics Works').querySelector('button'); rb.style.color = '#5fe3c0';
          for (const n of ['Alloy Extractor', 'Deuterium Synthesizer', 'Solar Array']) deckDisable(n, V === 'C' ? '00:42:18' : 'Both build slots busy');
          deckDisable('Crystal Refinery', V === 'C' ? 'building' : 'Already building');
          deckDisable('Robotics Works', V === 'C' ? 'building' : 'Already building');
          deckDisable('Orbital Shipyard', V === 'C' ? 'orders' : 'Locked while Shipyard Orders run');
          deckDisable('Research Lab', V === 'C' ? 'research' : 'Locked while Research is active');
        },
      },
    },
    {
      key: 'rqueue', title: 'Research Queue full, head waiting on Lab', screens: ['research'],
      note: 'Research Lab upgrading 9 → 10, so the queue head (Photon Lasers → 9) waits. 5 of 5 entries, the same Technology twice (Ion Lattice 6, 7). Warp Drive → 5 can’t be queued. ✕ on every row.',
      run: {
        research() {
          const Q = [['Photon Lasers', 9, 'waits for Research Lab 10', '00:42:18'], ['Warp Drive', 4, '5h 40m', '06:22'], ['Ion Lattice', 6, '3h 10m', '09:32'], ['Ion Lattice', 7, '3h 48m', '13:20'], ['Armor Plating', 11, '4h 02m', '17:22']];
          heading('Research Lab 9 → 10 upgrading · Research waits for it');
          // cards: queued badges
          techSub('Photon Lasers').innerHTML = `<span style="color:#ffc36b">Waiting → 9</span>`;
          const ions = techSub('Ion Lattice');
          ions.innerHTML = V === 'B' ? `Level 5 &nbsp;${chip('#3 #4', 'ok')}` : `<span style="color:#5fe3c0">Queued → 6, 7</span>`;
          techSub('Warp Drive').innerHTML = V === 'B' ? `Level 3 &nbsp;${chip('#2', 'ok')}` : `<span style="color:#5fe3c0">Queued → 4</span>`;
          techSub('Armor Plating').innerHTML = V === 'B' ? `Level 10 &nbsp;${chip('#5', 'ok')}` : `<span style="color:#5fe3c0">Queued → 11</span>`;
          tech('Photon Lasers').style.borderColor = 'rgba(255,195,107,.35)';
          const box = activeBox();
          const waitRow = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px"><span style="flex-grow:1">Photon Lasers <span style="color:#6f8196">→ level 9</span></span><span style="${CP}color:#ffc36b;font-size:13px">waits · 00:42:18</span>${xBtn('Photon Lasers')}</div>
            <div style="height:4px;border-radius:4px;background:#16202c;background-image:repeating-linear-gradient(90deg,#2a3a4d 0 6px,transparent 6px 12px)"></div>`;
          const row = ([n, l, d, eta], i) => `<div style="display:flex;align-items:center;gap:10px;height:40px;${i ? 'border-top:1px solid #16202c;' : ''}font-size:14px"><span style="${CP}color:#6f8196;width:14px">${i + 1}</span><span style="flex-grow:1">${n} <span style="color:#6f8196">→ ${l}</span></span><span style="${CP}font-size:12.5px;color:${i ? '#9fb0c2' : '#ffc36b'}">${V === 'C' ? (i ? 'done ' + eta : 'waits 00:42:18') : i ? d : 'waits 00:42:18'}</span>${xBtn(n + ' ' + l)}</div>`;
          if (V === 'A') {
            box.style.borderColor = 'rgba(255,195,107,.35)';
            box.innerHTML = waitRow + `<button class="p-more" style="align-self:flex-start;border:0;background:transparent;padding:0;color:#5fe3c0;font-size:13px;cursor:pointer">+ 4 queued · 5 of 5 ▾</button>`;
            const pop = h(`<div class="p-pop" style="position:absolute;left:680px;top:176px;width:380px;box-sizing:border-box;z-index:6;padding:6px 16px;border-radius:10px;background:#0b1119;border:1px solid #1f2b3a;box-shadow:0 18px 40px rgba(0,0,0,.55)">${Q.slice(1).map((r, i) => row(r, i + 1)).join('')}</div>`);
            document.body.firstElementChild.appendChild(pop);
            q('.p-more').onclick = () => pop.style.display = pop.style.display === 'none' ? '' : 'none';
          }
          if (V === 'B') {
            box.remove();
            document.body.firstElementChild.appendChild(h(`<section style="position:absolute;left:112px;top:752px;width:948px;box-sizing:border-box;padding:14px 16px;border-radius:12px;background:#0b1119;border:1px solid #16202c;display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="${LABEL}">RESEARCH QUEUE</span><span style="display:flex;gap:8px;align-items:center">${chip('LAB UPGRADING', 'warn')}${chip('5 / 5 FULL', 'mute')}</span></div>
              <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px">${Q.map(([n, l, d], i) => `<div style="position:relative;box-sizing:border-box;padding:10px 12px;border-radius:10px;background:#0e1520;border:1px solid ${i ? '#16202c' : 'rgba(255,195,107,.35)'};display:flex;flex-direction:column;gap:4px">
                <span style="${CP}font-size:10.5px;letter-spacing:.1em;color:${i ? '#6f8196' : '#ffc36b'}">${i ? '#' + (i + 1) : 'NEXT · WAITING'}</span><span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:22px">${n} → ${l}</span><span style="${CP}font-size:12px;color:#9fb0c2">${i ? d : '00:42:18'}</span>
                <span style="position:absolute;right:8px;top:8px">${xBtn(n)}</span></div>`).join('')}</div></section>`));
          }
          if (V === 'C') {
            box.style.borderColor = 'rgba(255,195,107,.35)';
            box.innerHTML = waitRow;
          }
          // detail: Warp Drive next level can't be queued
          const aside = q('aside');
          aside.querySelector('span[style*="letter-spacing: 0.12em"]').textContent = 'PROPULSION · LEVEL 4 → 5 (AFTER QUEUE)';
          const bottom = aside.lastElementChild;
          bottom.innerHTML = `${bigDis('QUEUE FULL · 5 OF 5', 'QUEUE FULL', 'QUEUE FREES IN 00:42:18 + 5h 40m')}<span style="text-align:center;font-size:12px;color:#6f8196">${pick({ A: 'Up to 5 Technologies can be queued', B: 'Cancel an entry to make room · refunds 100%', C: 'A place opens when Warp Drive 4 finishes · ~06:22' })}</span>`;
          if (V === 'C') {
            const tabs = h(`<div style="display:flex;gap:6px;padding:4px;border-radius:10px;background:#06090e;border:1px solid #16202c;flex-shrink:0">
              <button class="p-tab" data-t="d" style="flex-grow:1;height:32px;border-radius:7px;border:0;background:transparent;color:#6f8196;font-size:14px;cursor:pointer">Details</button>
              <button class="p-tab" data-t="q" style="flex-grow:1;height:32px;border-radius:7px;border:0;background:#16202c;color:#d8e1ea;font-size:14px;cursor:pointer">Queue · 5 / 5</button></div>`);
            const detail = [...aside.children];
            aside.prepend(tabs);
            const qv = h(`<div style="display:flex;flex-direction:column;gap:10px;flex-grow:1">
              <div style="padding:10px 12px;border-radius:10px;background:rgba(255,195,107,.06);border:1px solid rgba(255,195,107,.25);font-size:13px;line-height:1.45;color:#d8e1ea">Research Lab 10 finishes in <span style="${CP};color:#ffc36b">00:42:18</span>. Photon Lasers starts then, at the faster Lab speed.</div>
              <div style="display:flex;flex-direction:column">${Q.map(row).join('')}</div>
              <div style="margin-top:auto;display:flex;justify-content:space-between;font-size:12px;color:#6f8196;padding-top:10px;border-top:1px solid #16202c"><span>All done</span><span style="${CP}">Thu 17:22</span></div></div>`);
            aside.appendChild(qv);
            const show = (t) => { detail.forEach((d) => (d.style.display = t === 'd' ? '' : 'none')); qv.style.display = t === 'q' ? '' : 'none'; qa('.p-tab').forEach((b) => { const on = b.dataset.t === t; b.style.background = on ? '#16202c' : 'transparent'; b.style.color = on ? '#d8e1ea' : '#6f8196'; }); };
            qa('.p-tab').forEach((b) => (b.onclick = () => show(b.dataset.t)));
            show('q');
          }
        },
      },
    },
    {
      key: 'yardfull', title: 'Shipyard Orders full (10)', screens: ['shipyard'],
      note: '10 of 10 Shipyard Orders queued. New orders are refused. No cancel on Shipyard Orders.',
      run: {
        shipyard() {
          const O = [['Interceptor', '18 of 40', '00:31:05'], ['Hauler', '20', '1h 40m'], ['Cruiser', '10', '3h 20m'], ['Interceptor', '100', '1h 16m'], ['Scout Drone', '25', '6m'], ['Freighter', '12', '2h 12m'], ['Corvette', '30', '2h 36m'], ['Salvager', '8', '1h 04m'], ['Interceptor', '60', '46m'], ['Dreadnought', '2', '3h 10m']];
          const pq = prodQueue();
          const head = `<div style="display:flex;justify-content:space-between;${CP}font-size:11px;letter-spacing:.12em"><span style="color:#6f8196">PRODUCTION QUEUE</span><span style="color:${V === 'B' ? '#ffc36b' : '#5fe3c0'}">10 / 10 ORDERS</span></div>`;
          const first = `<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>Interceptor · 18 of 40</span><span style="${CP}color:#5fe3c0">00:31:05</span></div><div style="height:4px;border-radius:4px;background:#16202c"><div style="width:45%;height:4px;border-radius:4px;background:#5fe3c0"></div></div></div>`;
          const eta = ['', '02:11', '05:31', '06:47', '06:53', '09:05', '11:41', '12:45', '13:31', '16:41'];
          if (V === 'A') pq.innerHTML = head + first + O.slice(1).map(([n, c, t]) => `<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #16202c;font-size:13px;color:#9fb0c2"><span>${n} · ${c}</span><span style="${CP}">${t}</span></div>`).join('');
          if (V === 'B') pq.innerHTML = head + first + `<div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:12px;border-top:1px solid #16202c">${O.slice(1).map(([n, c]) => `<span style="padding:4px 8px;border-radius:6px;background:#0e1520;border:1px solid #16202c;font-size:12px;color:#9fb0c2">${n} ×${c}</span>`).join('')}</div>`;
          if (V === 'C') pq.innerHTML = head + first + O.slice(1).map(([n, c], i) => `<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #16202c;font-size:13px;color:#9fb0c2"><span>${n} · ${c}</span><span style="${CP};color:#6f8196">done ${eta[i + 1]}</span></div>`).join('') + `<div style="font-size:12px;color:#6f8196;padding-top:6px">A new order can be placed when Interceptor ×40 finishes · 00:31:05</div>`;
          qtyPanel().style.borderColor = '#16202c';
          buildBtn().replaceWith(h(disBtn('QUEUE FULL · 10 OF 10', { b: 'QUEUE FULL', c: 'NEXT ORDER IN 00:31:05' }).replace('height:44px', 'height:48px')));
          if (V === 'B') qtyPanel().insertAdjacentHTML('beforeend', `<div style="font-size:13px;color:#8a9bb0">The Shipyard takes up to 10 orders. Orders can't be cancelled.</div>`);
          const fs = byText('FLEET STRENGTH', 'span').parentElement; fs.style.display = 'none';
        },
      },
    },
    {
      key: 'yardlock', title: 'Shipyard upgrading — orders locked', screens: ['shipyard', 'structures'],
      note: 'Orbital Shipyard is upgrading 10 → 11, so no new Shipyard Orders. (The reverse lock — Shipyard/Nanite can’t upgrade while orders exist — is in "Build Slots full".)',
      run: {
        shipyard() {
          heading(pick({ A: 'Orbital Shipyard level 10 · upgrading to 11', B: 'Orbital Shipyard level 10', C: 'Orbital Shipyard level 10 → 11 in 01:30:00' }));
          const pq = prodQueue();
          pq.innerHTML = `<div style="display:flex;justify-content:space-between;${CP}font-size:11px;letter-spacing:.12em"><span style="color:#6f8196">PRODUCTION QUEUE</span><span style="color:#6f8196">0 ORDERS</span></div>` +
            (V === 'C' ? `<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>Orbital Shipyard → 11</span><span style="${CP}color:#ffc36b">01:30:00</span></div><div style="height:4px;border-radius:4px;background:#16202c"><div style="width:30%;height:4px;border-radius:4px;background:#ffc36b"></div></div><span style="font-size:12px;color:#6f8196">Orders open when the upgrade finishes</span></div>` : `<div style="font-size:14px;color:#6f8196">No orders</div>`);
          const p = qtyPanel(); p.style.borderColor = '#16202c';
          if (V === 'B') p.insertAdjacentHTML('afterbegin', `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(255,195,107,.06);border:1px solid rgba(255,195,107,.25);font-size:13px">${chip('UPGRADING', 'warn')}<span style="flex-grow:1">Orbital Shipyard → 11. New orders open in</span><span style="${CP};color:#ffc36b">01:30:00</span></div>`);
          if (V === 'A') { q('#qty').disabled = true; qa('button[aria-label]', p).forEach((b) => { b.disabled = true; b.style.opacity = '.4'; }); }
          buildBtn().replaceWith(h(disBtn('SHIPYARD UPGRADING', { b: 'BUILD 10 CRUISERS', c: 'ORDERS OPEN IN 01:30:00' }).replace('height:44px', 'height:48px')));
        },
        structures() {
          const yard = sCard('Orbital Shipyard'); yard.style.borderColor = 'rgba(95,227,192,0.35)'; sLevel(yard).style.color = '#5fe3c0';
          sFooter(yard).replaceWith(progressFooter('Orbital Shipyard', 'Building level 11', '01:30:00', 30, '409k · 204k'));
                    heading('164 of 188 fields developed · 2 of 2 build slots in use');
        },
      },
    },
    {
      key: 'rename', title: 'Planet rename', screens: ['command-deck', 'structures'],
      note: 'The planet picker opens a rename control. It works in every scenario — click the picker. Enter saves, Esc cancels.',
      run: { 'command-deck'() {}, structures() {} },
      open: true,
    },
    {
      key: 'interact', title: 'Hover / focus / pressed', screens: ['structures', 'command-deck', 'shipyard', 'research'],
      note: 'Live in every scenario: hover, Tab, click. Forced here for the screenshot: UPGRADE on Alloy Extractor = hover, the big button = focus, UPGRADE on Solar Array = pressed, Research nav = focus.',
      run: {
        structures() {
          sCard('Alloy Extractor').querySelector('button').classList.add('p-hover');
          sCard('Solar Array').querySelector('button').classList.add('p-press');
          q('aside button').classList.add('p-focus');
          qa('nav a').find((a) => own(a) === 'Research').classList.add('p-focus');
        },
        'command-deck'() { deckRow('Solar Array').querySelector('button').classList.add('p-hover'); deckRow('Robotics Works').querySelector('button').classList.add('p-focus'); },
        shipyard() { shipRow('Hauler').classList.add('p-hover'); buildBtn().classList.add('p-focus'); },
        research() { tech('Impulse Drive').classList.add('p-hover'); q('aside button').classList.add('p-focus'); },
      },
    },
  ];

  const VARIANTS = { A: 'Quiet — dim & say why', B: 'Explicit — chips & reason lists', C: 'Forward — when & how' };

  // ── apply ────────────────────────────────────────────────────────────────
  css(interactionCSS[V] + `
    [aria-disabled=true], :disabled { cursor: not-allowed !important; }
    .p-x:hover { color: #ff8a8a !important; border-color: rgba(255,138,138,.45) !important; }
    body { padding-bottom: 120px; }`);
  qa('a[href$=".dc.html"]').forEach((a) => {
    const map = { 'CommandDeck.dc.html': 'command-deck', 'Buildings.dc.html': 'structures', 'Research.dc.html': 'research', 'Shipyard.dc.html': 'shipyard' };
    a.href = nav(map[a.getAttribute('href')]);
  });
  const scen = SCENARIOS.find((s) => s.key === S) ?? SCENARIOS[0];
  const safely = (label, fn) => { try { fn(); } catch (e) { console.error('[ui-states]', label, e); document.body.appendChild(h(`<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#c00;color:#fff;font:12px monospace;padding:6px">PROTOTYPE ERROR in ${label}: ${e.message}</div>`)); } };
  safely('soon', () => { soonNav(); if (SCREEN === 'command-deck') soonDeck(); if (SCREEN === 'shipyard') soonShipyard(); });
  safely(S + '/' + SCREEN, () => scen.run[SCREEN]?.());
  safely('rename', () => renameUI(!!scen.open && scen.screens.includes(SCREEN)));

  // ── floating switcher ────────────────────────────────────────────────────
  const go = (s, v, screen) => {
    const p = new URLSearchParams({ s, v });
    const target = SCENARIOS.find((x) => x.key === s);
    const scr = screen ?? (target.screens.includes(SCREEN) ? SCREEN : target.screens[0]);
    location.href = `/screens/${scr}.html?${p}`;
  };
  const keys = Object.keys(VARIANTS);
  const vi = keys.indexOf(V);
  const si = SCENARIOS.indexOf(scen);
  const pill = 'height:30px;padding:0 10px;white-space:nowrap;border-radius:15px;border:0;cursor:pointer;font:600 12px/1 system-ui,sans-serif;';
  const arrow = 'width:30px;height:30px;border-radius:15px;border:0;background:#2a2a2a;color:#fff;cursor:pointer;font:600 14px system-ui;';
  const bar = h(`<div id="p-bar" style="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;font:13px system-ui,sans-serif;color:#111">
    <div style="max-width:900px;padding:8px 14px;border-radius:10px;background:#fffbe6;border:1px solid #e8d67a;box-shadow:0 6px 24px rgba(0,0,0,.4);line-height:1.4"><b>PROTOTYPE · ${scen.title}</b> — ${scen.note}</div>
    <div style="display:flex;gap:10px;align-items:center;padding:6px;border-radius:24px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.5)">
      <button data-a="sprev" title="Previous scenario (↑)" style="${arrow}">↑</button>
      <select data-a="s" style="height:30px;border-radius:15px;border:1px solid #ccc;padding:0 8px;font:600 12px system-ui">${SCENARIOS.map((s) => `<option value="${s.key}" ${s === scen ? 'selected' : ''}>${s.title}</option>`).join('')}</select>
      <button data-a="snext" title="Next scenario (↓)" style="${arrow}">↓</button>
      <span style="width:1px;height:22px;background:#ddd"></span>
      ${scen.screens.map((s) => `<button data-a="screen" data-s="${s}" style="${pill}background:${s === SCREEN ? '#111' : '#eee'};color:${s === SCREEN ? '#fff' : '#333'}">${s.replace('-', ' ')}</button>`).join('')}
      <span style="width:1px;height:22px;background:#ddd"></span>
      <button data-a="vprev" title="Previous variant (←)" style="${arrow}">←</button>
      <span style="min-width:230px;text-align:center;font-weight:700">${V} — ${VARIANTS[V]}</span>
      <button data-a="vnext" title="Next variant (→)" style="${arrow}">→</button>
    </div></div>`);
  document.body.appendChild(bar);
  const vStep = (d) => go(scen.key, keys[(vi + d + keys.length) % keys.length], SCREEN);
  const sStep = (d) => go(SCENARIOS[(si + d + SCENARIOS.length) % SCENARIOS.length].key, V);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    ({ vprev: () => vStep(-1), vnext: () => vStep(1), sprev: () => sStep(-1), snext: () => sStep(1), screen: () => go(scen.key, V, b.dataset.s) })[b.dataset.a]?.();
  });
  bar.querySelector('select').addEventListener('change', (e) => go(e.target.value, V));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') vStep(-1);
    if (e.key === 'ArrowRight') vStep(1);
    if (e.key === 'ArrowUp') { e.preventDefault(); sStep(-1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); sStep(1); }
  });
})();
