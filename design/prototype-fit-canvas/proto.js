// PROTOTYPE — throwaway. Question: how do 13 Structures and 9 ships fit on the fixed
// 1440×900 canvas, and does scale-to-fit hold up? (wayfinder ticket #17, checking #15)
// Variants per screen, switched with ?variant= and the bottom bar (← → keys too).
(() => {
  const page = location.pathname.includes('shipyard') ? 'shipyard' : 'structures';
  const VARIANTS = {
    structures: {
      A: '#15 — 3 columns, grid scrolls inside',
      B: 'Dense — 4 columns, shorter cards, no scroll',
      C: 'Filter-first — no "All" tab, each filter fits',
    },
    shipyard: {
      A: '#15 — rows 70 → 66 px, no scroll',
      B: 'Rows stay 70 px, list scrolls inside',
    },
  }[page];
  const keys = Object.keys(VARIANTS);
  const params = new URLSearchParams(location.search);
  const variant = keys.includes(params.get('variant')) ? params.get('variant') : 'A';

  const stage = document.body.firstElementChild;
  const byText = (sel, text) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
  const tag = (el) => {
    const t = document.createElement('span');
    t.textContent = 'NEW · art TBD';
    t.style.cssText = "position:absolute;top:4px;left:8px;z-index:2;font:600 10px 'Chakra Petch',sans-serif;letter-spacing:.1em;color:#06090e;background:#ffb454;padding:2px 6px;border-radius:4px";
    el.style.position = 'relative';
    el.appendChild(t);
  };

  // ---------- Structures ----------
  if (page === 'structures') {
    const grid = stage.querySelector('div[style*="grid-template-columns"]');
    const cards = [...grid.children];
    const cardByName = (n) => cards.find((c) => c.textContent.includes(n));
    const setCard = (card, name, cat) => {
      const spans = [...card.querySelectorAll('span')];
      spans.find((s) => s.style.fontSize === '16px' && s.style.fontWeight === '600').textContent = name;
      spans.find((s) => s.style.letterSpacing === '0.1em').textContent = cat;
      const lvl = spans.find((s) => s.style.fontSize === '28px');
      if (lvl) lvl.textContent = '0';
      const btn = card.querySelector('button[aria-label^="Upgrade"]');
      if (btn) { btn.textContent = 'BUILD'; btn.setAttribute('aria-label', 'Build ' + name); }
      card.querySelectorAll('filter[id]').forEach((f, i) => { f.id = 'bglow-' + name.replace(/\W/g, '') + i; });
      card.querySelectorAll('[filter]').forEach((p) => p.setAttribute('filter', `url(#bglow-${name.replace(/\W/g, '')}0)`));
      tag(card);
    };
    [
      ['Terraformer', 'FACILITIES', 'Robotics Works'],
      ['Alloy Depot', 'STORAGE', 'Alloy Extractor'],
      ['Crystal Vault', 'STORAGE', 'Alloy Extractor'], // Crystal Refinery is mid-build in the mock
      ['Deuterium Tank', 'STORAGE', 'Deuterium Synthesizer'],
    ].forEach(([name, cat, from]) => {
      const c = cardByName(from).cloneNode(true);
      // cloned cards carry the source's "busy/selected" border; normalise it
      c.style.border = '1px solid #16202c';
      setCard(c, name, cat);
      grid.appendChild(c);
    });

    const all = [...grid.children];
    const catOf = (c) => [...c.querySelectorAll('span')].find((s) => s.style.letterSpacing === '0.1em').textContent;
    // Energy producers live under "Resources" — the design has no Energy tab.
    const FILTERS = { All: () => true, Resources: (c) => ['RESOURCES', 'ENERGY'].includes(catOf(c)), Facilities: (c) => catOf(c) === 'FACILITIES', Storage: (c) => catOf(c) === 'STORAGE' };
    const buttons = [...document.querySelectorAll('button[aria-pressed]')];
    const apply = (name) => {
      buttons.forEach((b) => {
        const f = b.dataset.f;
        const on = f === name;
        b.setAttribute('aria-pressed', on);
        b.style.background = on ? '#16202c' : 'transparent';
        b.style.color = on ? '#d8e1ea' : '#6f8196';
      });
      all.forEach((c) => { c.style.display = FILTERS[name](c) ? '' : 'none'; });
      region.scrollTop = 0;
      state.filter = name + ' · ' + all.filter(FILTERS[name]).length;
      render();
    };
    buttons.forEach((b) => {
      const f = b.textContent.split('·')[0].trim();
      b.dataset.f = f;
      b.textContent = `${f} · ${all.filter(FILTERS[f]).length}`;
      b.onclick = () => apply(f);
    });

    // Scroll region y 176 → 876, as decided in #15
    const region = document.createElement('div');
    region.className = 'proto-scroll';
    region.style.cssText = 'position:absolute;left:112px;top:176px;width:948px;height:700px;overflow-y:auto;overflow-x:hidden;';
    grid.parentNode.insertBefore(region, grid);
    region.appendChild(grid);
    grid.style.position = 'static';
    grid.style.width = '948px';

    if (variant === 'B') {
      grid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
      grid.style.gap = '10px';
      // 4 rows in 700px → (700 − 3·10) / 4 ≈ 167px
      all.forEach((c) => { c.style.height = '167px'; });
      all.forEach((c) => c.querySelectorAll('div[style*="padding: 16px"]').forEach((d) => { d.style.padding = '12px'; d.style.gap = '8px'; }));
    }
    if (variant === 'C') {
      const allBtn = buttons.find((b) => b.dataset.f === 'All');
      allBtn.style.display = 'none';
    }

    var state = { filter: '' };
    var render = () => {
      const over = region.scrollHeight > region.clientHeight;
      hud(`filter: ${state.filter} · grid ${region.scrollHeight}px in 700px region · ${over ? 'SCROLLS' : 'fits'}`);
    };
    requestAnimationFrame(() => apply(variant === 'C' ? 'Resources' : 'All'));
    region.addEventListener('scroll', () => render());
  }

  // ---------- Shipyard ----------
  if (page === 'shipyard') {
    const list = byText('span', 'Interceptor').closest('button').parentNode;
    const src = list.children[0];
    const sat = src.cloneNode(true);
    sat.style.border = '1px solid #16202c';
    sat.style.background = '#0b1119';
    const spans = sat.querySelectorAll('span span');
    spans[0].textContent = 'Solar Satellite';
    spans[1].textContent = 'Energy';
    sat.lastElementChild.textContent = '0';
    // placeholder silhouette: a panel + body, art is decided in #16
    sat.querySelector('svg').innerHTML = '<path d="M26 12 h12 v8 h-12 Z M6 10 h16 v12 h-16 Z M42 10 h16 v12 h-16 Z M22 16 h4 M38 16 h4" fill="rgba(159,177,197,0.12)" stroke="#a9bacd" stroke-width="1.3"/>';
    tag(sat);
    list.appendChild(sat);

    const rows = [...list.children];
    const section = list.parentNode;
    if (variant === 'A') {
      rows.forEach((r) => { r.style.height = '66px'; });
    } else {
      // list scrolls inside, ending where #15's 66px list would (y≈866)
      const top = list.getBoundingClientRect().top - stage.getBoundingClientRect().top; // before scaling
      list.style.height = 866 - top + 'px';
      list.style.overflowY = 'auto';
      list.classList.add('proto-scroll');
      rows.forEach((r) => { r.style.flexShrink = '0'; });
    }
    requestAnimationFrame(() => {
      const s = scale();
      const bottom = Math.round((rows.at(-1).getBoundingClientRect().bottom - stage.getBoundingClientRect().top) / s);
      const over = list.scrollHeight > list.clientHeight + 1;
      hud(`9 ships · row ${rows[0].style.height} · last row ends y=${bottom} (canvas 900) · ${over ? 'SCROLLS' : 'fits'}`);
    });
  }

  // ---------- Scale-to-fit stage (#15): min(vw/1440, vh/900), floor 0.75 ----------
  let currentScale = 1;
  function scale() { return currentScale; }
  const holder = document.createElement('div');
  document.body.insertBefore(holder, stage);
  holder.appendChild(stage);
  document.body.style.cssText += ';min-height:100vh;overflow:auto';
  stage.style.transformOrigin = '0 0';
  const fit = () => {
    const raw = Math.min(innerWidth / 1440, innerHeight / 900);
    currentScale = Math.max(0.75, raw);
    const w = 1440 * currentScale, h = 900 * currentScale;
    holder.style.cssText = `width:${w}px;height:${h}px;margin:${Math.max(0, (innerHeight - h) / 2)}px auto 0;`;
    stage.style.transform = `scale(${currentScale})`;
    document.getElementById('proto-scale').textContent =
      `viewport ${innerWidth}×${innerHeight} · scale ${currentScale.toFixed(3)}${raw < 0.75 ? ' (floored → page scrolls)' : ''}`;
  };

  // ---------- Scrollbar style (#15: thin 6px, --line thumb, on hover) ----------
  const css = document.createElement('style');
  css.textContent = `
    .proto-scroll{scrollbar-width:thin;scrollbar-color:transparent transparent}
    .proto-scroll:hover{scrollbar-color:#243244 transparent}
    .proto-scroll::-webkit-scrollbar{width:6px}
    .proto-scroll::-webkit-scrollbar-thumb{background:transparent;border-radius:3px}
    .proto-scroll:hover::-webkit-scrollbar-thumb{background:#243244}
    #proto-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:10px;
      background:#fff;color:#111;font:13px/1.3 system-ui,sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,.5)}
    #proto-bar button{border:0;background:#eee;border-radius:999px;width:28px;height:28px;cursor:pointer;font-size:14px}
    #proto-bar a{color:#06c}
    #proto-hud{position:fixed;left:10px;top:10px;z-index:9999;background:rgba(255,255,255,.92);color:#111;font:12px/1.4 ui-monospace,monospace;padding:6px 8px;border-radius:6px;max-width:520px}`;
  document.head.appendChild(css);

  // ---------- Switcher + state HUD ----------
  const bar = document.createElement('div');
  bar.id = 'proto-bar';
  const go = (d) => {
    const i = (keys.indexOf(variant) + d + keys.length) % keys.length;
    params.set('variant', keys[i]);
    location.search = params.toString();
  };
  const other = page === 'structures' ? 'shipyard' : 'structures';
  bar.innerHTML = `<button aria-label="Previous variant">←</button><strong>${page}</strong> <span>${variant} — ${VARIANTS[variant]}</span><button aria-label="Next variant">→</button><a href="${other}.html">${other} ↗</a>`;
  bar.querySelectorAll('button')[0].onclick = () => go(-1);
  bar.querySelectorAll('button')[1].onclick = () => go(1);
  document.body.appendChild(bar);
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,[contenteditable]')) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  const hudEl = document.createElement('div');
  hudEl.id = 'proto-hud';
  hudEl.innerHTML = '<div id="proto-scale"></div><div id="proto-state"></div>';
  document.body.appendChild(hudEl);
  function hud(text) { document.getElementById('proto-state').textContent = text; }

  fit();
  addEventListener('resize', fit);
})();
