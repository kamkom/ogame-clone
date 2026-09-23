# Design assets (direction "D")

Unpacked from `../Space Strategy Game — Planet Overview Variants.html` for [Extract design assets from the HTML bundle](https://github.com/kamkom/ogame-clone/issues/5).
Rebuild everything except `tokens.css`, `README.md` and `screenshots/` with:

```sh
node design/extract.mjs
```

## What the bundle is

The bundle is a gzip+base64 file that unpacks itself, two levels deep:

- **Root.** A board page with 4 iframes (1440×900 each) and a manifest holding 4 page bundles.
- **Each page bundle.** A manifest with 24 assets and one template. The assets are the same in all 4 pages: `dc-runtime` (a 43 KB design-tool runtime), React 18.3.1 and ReactDOM UMD (public builds from jsDelivr), and 21 woff2 files.
- **Each template.** An `<x-dc>` component. It holds plain HTML with **inline styles only** (no classes, no stylesheet) plus `{{path}}` slots, `<sc-for>` and `<sc-if>`. A `class Component extends DCLogic { renderVals() }` script returns the mock data. There are no event handlers or state anywhere, so the design is four static frames.

Neither the runtime nor React is needed for the port, so neither was extracted.

## Layout

| Path | What |
|---|---|
| `screens/*.html` | The 4 screens as **static HTML**, rendered from the template with default props. Open them straight from disk. They are pixel-identical to the original render (checked by diffing headless Chrome screenshots: 0 differing pixels on 3 screens, 32 blur-antialiasing pixels on Structures) |
| `screenshots/*.png` | 1440×900 renders of `screens/`, usable as visual baselines |
| `source/*.dc.html` | The original components verbatim: template, `renderVals()` logic and mock data. Read these to see which values are computed and which states exist (idle/busy/locked/selected) |
| `fonts/` | 21 woff2 files (Barlow 400/500/600, Chakra Petch 400/500/600; latin, latin-ext, vietnamese, thai) + `fonts.css` |
| `svg/icons/` | 33 line icons, 24×24. Two paths each: a stroke (`currentColor` in the design) and a small accent fill |
| `svg/ships/` | 8 ship silhouettes, 64×32 (hull, detail, accent glow) |
| `svg/structures/` | 9 Structure illustrations, 300×224 (sky, far, main, detail, glow + blur filter), with a panel background added so each file stands alone |
| `svg/planet-hud.svg`, `svg/cruiser-blueprint.svg`, `svg/logo.svg` | The one-off art |
| `svg/blueprints/` | 9 ship blueprints, 280×110, in the layers of the Cruiser's (hull, detail, accent module, fixtures, barrels, engine glow, dimension, callout) |
| `data/*.json` | The same path strings as JSON (`icons`, `ships`, `structure-art`, `blueprints`), plus `mock-values.json` with every value each screen renders |
| `drawn-art.json` | Art the bundle doesn't draw ([#31](https://github.com/kamkom/ogame-clone/issues/31)): icons and illustrations for Alloy Depot, Crystal Vault, Deuterium Tank and Terraformer; the Solar Satellite's icon, silhouette and blueprint; the other 7 ships' blueprints. `extract.mjs` merges it in next to the originals. The Cruiser blueprint is transcribed here from the bundle so all 9 share one shape |
| `contact-sheet.svg` | Every icon, silhouette, illustration and blueprint side by side, new ones marked NEW. Rebuild with `node design/contact-sheet.mjs [accent]` |
| `tokens.css` | The palette, type, radii and layout constants as named custom properties |

## Reusable as-is

- **Fonts.** Both families are Google Fonts under the SIL OFL, so they can ship. Only the `latin` and `latin-ext` files matter (12 of 21). Vietnamese and Thai can be dropped. `@fontsource/barlow` + `@fontsource/chakra-petch` from npm would do the same job.
- **All the art is path data.** None of it is a raster image, so it can become one `<Icon>` / `<Ship>` / `<StructureArt>` component each, fed from `data/*.json` and coloured by props. The accent colour flows through `fill`, so the design's four accent options still work.
- **Markup and styles.** Every element is plain HTML with an inline `style`. Converting it to JSX is mechanical: `<sc-for>` becomes `.map`, `<sc-if>` becomes `&&`, style strings become objects, and `sc-camel-view-box` becomes `viewBox`. The layout uses absolute positions on a fixed 1440×900 canvas, which makes a pixel-faithful port easy to check against `screenshots/`.
- **Shared chrome.** The left rail, the top bar (planet picker + 4 resource chips) and the star field are copy-pasted identically into every page. They become one layout component.
- **Tokens.** See `tokens.css`. The accent (`#5fe3c0`) and the planet tint are the only values the design exposes as props.
- **The star field** comes from a seeded PRNG (seed 57, 100 stars, in `source/command-deck.dc.html`), so it can be reproduced exactly.
- **Accessibility hooks** that already exist: `aria-current` on nav, `aria-pressed` on filter buttons, `aria-label` on icon buttons, and a `<label for>` on the quantity input.

## Has to be rebuilt or designed

**Behaviour. None of it exists in the design.**
- Detail panels are hard-coded text, not bound to the selected card. The panels are Deuterium Synthesizer (Structures), Warp Drive (Research) and Cruiser (Shipyard). Selection, the All/Resources/Facilities/Storage filter, the Ships/Defenses tab and the quantity stepper / "Max" all need state.
- Countdowns, progress bars and resource counters are static strings. Live interpolation is a standing decision on the map.
- Nav `href`s point at `CommandDeck.dc.html` etc. and need to become routes.

**States the design never shows.**
- Disabled / "coming soon" for Fleet, Galaxy and Alliance nav, the Defenses tab, the Moon and Defense Grid callouts, and Fleet Dock / DISPATCH / OPEN FLEET DISPATCH. The map says these are shown disabled, but there is no visual for that.
- Other missing states: can't-afford (the design only shows "Available"), queue full, empty queues, hover/pressed/focus (links only have a hover colour), loading, error.
- No **login / register screen** at all.
- No **Planet rename** UI. The planet picker is a button with a chevron and nothing behind it.

**Content missing for catalog items (see [Map design catalog names to OGame entities](https://github.com/kamkom/ogame-clone/issues/3)).**
- *(Now drawn in `drawn-art.json`, see above.)* **Art exists only for the design's own items:** 9 Structures, 16 Technologies (icons only) and 8 ships. Nothing exists for Metal/Crystal Storage + Deuterium Tank (the "Storage" filter has no cards), Terraformer, Solar Satellite, Crawler, or the other OGame ships (Battlecruiser, Bomber, Destroyer, Deathstar, …). Any of those that land in scope need a new icon, a silhouette and, for Structures, an illustration in the same style.
- *(Now drawn.)* **Only the Cruiser has a large blueprint.** The Shipyard detail needs one per ship, or a scaled-up silhouette.
- **Research has no per-Technology art.** Its detail box scales the 24px icon to 90px with a thinner stroke. That works for every Technology as-is.
- *(The rest now live in `shared/catalog.ts`.)* **Only two description texts are written:** Deuterium Synthesizer and Warp Drive.
- **Cost rows are Alloy + Crystal only** on Structures. Deuterium (and Energy for Graviton) need a row. The Shipyard already shows the Deuterium cost pattern, so reuse it.

**Layout limits of the fixed 1440×900 canvas.**
- The Structures grid (3×3, ending at y≈872) and the Shipyard list (8 rows, ending at y≈826) are full. One more Structure row or ship overflows, so those columns need scrolling or a denser layout.
- There is no responsive behaviour. Smaller viewports need either scaling or a decision to require ≥1440 px.

**Porting gotchas.**
- Every Structure illustration declares `<filter id="bglow">`, which gives 10 duplicate ids on one page. Use `useId()` per instance.
- The Overview planet is CSS gradients (`radial-gradient` ×3 + `box-shadow`) under an SVG HUD overlay (`svg/planet-hud.svg`). Copy the gradient from `screens/command-deck.html`. It takes the planet tint as a variable.
- Numbers use a U+2212 minus (`−12°`) and `→` arrows. Keep them for fidelity.
