# OGame rules reference: formulas, requirements, stats

Research for issue #2 (part of map #1). This covers OGame's own rules for the parts in scope: Structures, Research, Shipyard, production, Planet attributes, starting state and queues. It uses **OGame's names** (Metal, Metal Mine, Light Fighter, ...). Mapping them to the design's names (Alloy, Interceptor, ...) is a separate ticket.

It is written for a TypeScript implementation. Formulas are given as expressions, catalogs as tables, and each section cites its source. **⚠ Discrepancy** marks places where the sources disagree, with a recommendation.

Researched 2026-09-22.

## Sources and how much to trust them

| Key | Source | Kind | Trust |
|---|---|---|---|
| **[AG]** | `alaingilbert/ogame` (Go client library for the live game), `pkg/ogame/*.go`, commit `325667f` — https://github.com/alaingilbert/ogame | Formulas and catalog data used by a bot against real servers. Its unit tests check values against real servers. | High for formulas, costs, requirements and ship stats |
| **[OGX]** | `lanedirt/OGameX` (open-source OGame server clone in PHP/Laravel), commit `7c420ba` — https://github.com/lanedirt/OGameX | A full server re-implementation: queues, planet generation, production pipeline | High for server behaviour (queues, pipeline order). It has **several catalog errors** (listed below). |
| **[WIKI]** | OGame Fandom wiki (ogame.fandom.com), read through Wayback Machine snapshots because the live site is behind Cloudflare | Community wiki | Medium. Formulas are good, but some infoboxes are wrong (Bomber and Deathstar speed/cargo). |
| **[GF]** | Official Gameforge OGame wiki, `wiki.ogame.org` `Tutorial:Buildings` (oldid 4069) and `Tutorial:Research` (oldid 4189), via Wayback | First-party tutorials | High for rules in prose (locks, cancel refunds). Lower for requirement lists, which mix direct and transitive requirements and contain typos. |

No official machine-readable data source (for example a Gameforge API with formulas) is publicly available. The live game's `serverData.xml` API exposes universe settings (speeds, bonus fields) but no formulas.

---

## 1. Universe Speed

OGame servers have separate speed knobs: **economy speed** (production and build times), **research speed** (research times) and **fleet speed**. The design has a single **Universe Speed**, so apply it as follows ([AG], [OGX] `SettingsService`, [WIKI] Metal Mine / Buildings):

| Quantity | Effect of Universe Speed `S` |
|---|---|
| Base income (Metal 30/h, Crystal 15/h) | × S |
| Mine output (Metal, Crystal, Deuterium) | × S |
| Fusion Reactor Deuterium burn | × S |
| Energy produced (Solar Plant, Fusion Reactor, Solar Satellite) | **not** scaled |
| Energy consumed by mines | **not** scaled |
| Structure build time | ÷ S |
| Ship build time | ÷ S |
| Research time | ÷ S (OGame uses research speed; [OGX] uses economy × research) |
| Costs, storage capacity, fields | **not** scaled |

---

## 2. Cost of a level

Source: [AG] `baseLevelable.go`, [WIKI] Buildings.

```ts
// level = the level being built (1 for the first level)
const levelCost = (base: number, factor: number, level: number) =>
  Math.floor(base * factor ** (level - 1));   // applied to Metal, Crystal, Deuterium and Energy separately
```

A ship costs its fixed unit price × quantity.

Astrophysics costs are rounded to the nearest 100 in-game ([OGX] `roundNearest100`). This is irrelevant unless Astrophysics is kept in the catalog.

---

## 3. Structures catalog

Sources: [AG] `metalMine.go` … `spaceDock.go`, cross-checked with [OGX] `BuildingObjects.php` / `StationObjects.php` and [GF] Tutorial:Buildings. All three agree on every row below.

| Structure | Base Metal | Base Crystal | Base Deut | Base Energy | Factor | Requires |
|---|---:|---:|---:|---:|---:|---|
| Metal Mine | 60 | 15 | 0 | 0 | 1.5 | — |
| Crystal Mine | 48 | 24 | 0 | 0 | 1.6 | — |
| Deuterium Synthesizer | 225 | 75 | 0 | 0 | 1.5 | — |
| Solar Plant | 75 | 30 | 0 | 0 | 1.5 | — |
| Fusion Reactor | 900 | 360 | 180 | 0 | 1.8 | Deuterium Synthesizer 5, Energy Technology 3 |
| Metal Storage | 1000 | 0 | 0 | 0 | 2 | — |
| Crystal Storage | 1000 | 500 | 0 | 0 | 2 | — |
| Deuterium Tank | 1000 | 1000 | 0 | 0 | 2 | — |
| Robotics Factory | 400 | 120 | 200 | 0 | 2 | — |
| Shipyard | 400 | 200 | 100 | 0 | 2 | Robotics Factory 2 |
| Research Lab | 200 | 400 | 200 | 0 | 2 | — |
| Alliance Depot | 20000 | 40000 | 0 | 0 | 2 | — |
| Missile Silo | 20000 | 20000 | 1000 | 0 | 2 | Shipyard 1 |
| Nanite Factory | 1000000 | 500000 | 100000 | 0 | 2 | Robotics Factory 10, Computer Technology 10 |
| Terraformer | 0 | 50000 | 100000 | 1000 | 2 | Nanite Factory 1, Energy Technology 12 |
| Space Dock | 200 | 0 | 50 | 50 | 5 | Shipyard 2 |

Notes:
- The Energy "cost" of Terraformer (and of Graviton Technology below) is a **requirement on available Energy**. It is not a stockpile that gets spent.
- ⚠ **Space Dock's Energy factor:** [WIKI] Buildings says Energy scales ×2.5 per level while Metal and Deuterium scale ×5. [AG] uses ×5 for all. It hardly matters, since Space Dock is fleet-related (probably out of scope).
- Alliance Depot, Missile Silo, Terraformer and Space Dock serve out-of-scope features (alliances, missiles, fleets). Include them only if the UI shows them.
- Moon-only structures (Lunar Base, Sensor Phalanx, Jump Gate) are omitted because Moons are out of scope.

---

## 4. Technologies catalog

Sources: [AG] `*Technology.go`, `*Drive.go`, `astrophysics.go`, `intergalacticResearchNetwork.go`. Cross-checked with [OGX] `ResearchObjects.php` and [GF] Tutorial:Research. "Requires" lists **direct** requirements only. [OGX] and [GF] also list transitive ones, such as Research Lab levels already implied by another requirement.

| Technology | Metal | Crystal | Deut | Energy | Factor | Requires | Effect relevant here |
|---|---:|---:|---:|---:|---:|---|---|
| Energy Technology | 0 | 800 | 400 | 0 | 2 | Research Lab 1 | Fusion Reactor output |
| Laser Technology | 200 | 100 | 0 | 0 | 2 | Energy Technology 2 | prerequisite |
| Ion Technology | 1000 | 300 | 100 | 0 | 2 | Research Lab 4, Energy Technology 4, Laser Technology 5 | −4 % deconstruction cost/level |
| Hyperspace Technology | 0 | 4000 | 2000 | 0 | 2 | Research Lab 7, Energy Technology 5, Shielding Technology 5 | +5 % cargo/level |
| Plasma Technology | 2000 | 4000 | 1000 | 0 | 2 | Energy Technology 8, Laser Technology 10, Ion Technology 5 | mine output +1 % / +0.66 % / +0.33 % per level |
| Combustion Drive | 400 | 0 | 600 | 0 | 2 | Energy Technology 1 | +10 % base speed/level |
| Impulse Drive | 2000 | 4000 | 600 | 0 | 2 | Research Lab 2, Energy Technology 1 | +20 % base speed/level |
| Hyperspace Drive | 10000 | 20000 | 6000 | 0 | 2 | Hyperspace Technology 3 | +30 % base speed/level |
| Espionage Technology | 200 | 1000 | 200 | 0 | 2 | Research Lab 3 | (espionage, out of scope) |
| Computer Technology | 0 | 400 | 600 | 0 | 2 | Research Lab 1 | fleet slots (out of scope); Nanite prerequisite |
| Astrophysics | 4000 | 8000 | 4000 | 0 | **1.75** | Espionage Technology 4, Impulse Drive 3 | colonies/expeditions (out of scope) |
| Intergalactic Research Network | 240000 | 400000 | 160000 | 0 | 2 | Research Lab 10, Computer Technology 8, Hyperspace Technology 8 | links Labs across Planets. **No effect with one Planet.** |
| Graviton Technology | 0 | 0 | 0 | 300000 | **3** | Research Lab 12 | Deathstar prerequisite. Needs 300 000 Energy available. |
| Weapons Technology | 800 | 200 | 0 | 0 | 2 | Research Lab 4 | +10 % weapon/level |
| Shielding Technology | 200 | 600 | 0 | 0 | 2 | Research Lab 6, Energy Technology 3 | +10 % shield/level |
| Armour Technology | 1000 | 0 | 0 | 0 | 2 | Research Lab 2 | +10 % structural integrity/level |

⚠ **Requirement discrepancies (low impact):**
- **Ion Technology:** [AG] and [OGX] say Energy Technology 4. [GF] tutorial says Energy Technology 2. *Use 4* (two code sources agree).
- **Hyperspace Technology:** [AG] and [OGX] say Energy 5 + Shielding 5 + Lab 7. [GF] says "Laser Technology 5" instead of Energy 5, which is likely a typo. *Use [AG].*
- **Hyperspace Drive:** [GF] lists Lab 7, Energy 5, Hyperspace Technology 3, **Shielding 6**. [AG] and [OGX] say Hyperspace Technology 3 (+ Lab 7). Shielding 6 isn't implied by anything, so [GF] is probably wrong. *Use [AG].*

Only one Research can run at a time, across the whole account (see §9).

---

## 5. Build and research times

Sources: [AG] `baseBuilding.go`, `baseTechnology.go`, `baseDefender.go`. [OGX] `PlanetService::getBuildingConstructionTime` / `getUnitConstructionTime` / `getTechnologyResearchTime`. [WIKI] Buildings / Nanite Factory / Shipyard / Formulas. [AG] and [OGX] match exactly.

```ts
// All results in seconds. Costs are the (Metal, Crystal) of the level/unit being built.
// S = Universe Speed.

function structureTimeSec(metal: number, crystal: number, targetLevel: number,
                          robotics: number, nanite: number, S: number, isNaniteFactory: boolean): number {
  // Early-level speed-up used by current ("redesigned") universes; not applied to Nanite Factory.
  const earlyLevelDivisor = isNaniteFactory ? 1 : Math.max(4 - targetLevel / 2, 1);
  const hours = (metal + crystal) / (2500 * earlyLevelDivisor * (1 + robotics) * 2 ** nanite * S);
  return Math.max(1, Math.floor(hours * 3600));
}

function researchTimeSec(metal: number, crystal: number, researchLab: number, S: number): number {
  const hours = (metal + crystal) / (1000 * (1 + researchLab) * S);
  return Math.max(1, Math.floor(hours * 3600));
}

// Per unit. An order of n units takes n × this (units finish one by one).
function shipTimeSec(metal: number, crystal: number, shipyard: number, nanite: number, S: number): number {
  const hours = (metal + crystal) / (2500 * (1 + shipyard) * 2 ** nanite * S); // metal + crystal == structural integrity
  return Math.max(1, Math.floor(hours * 3600));
}
```

- `max(4 − L/2, 1)` is the same as [AG]'s `2 / (7 − (L − 1))` for L ≤ 5. It speeds up levels 1–5 (L1 ÷3.5, L2 ÷3, L3 ÷2.5, L4 ÷2, L5 ÷1.5). ⚠ [WIKI] marks this factor as "seems to apply, can someone confirm". Both code sources implement it, so *use it*.
- Robotics Factory speeds up Structures only. Shipyard + Nanite Factory speed up ships. Research Lab speeds up Research. Nanite Factory halves both Structure and ship times per level.
- **Deconstruction** (probably out of scope) costs `floor(levelCost) × (1 − 0.04 × IonTechnology)` ([AG] `DeconstructionPrice`).
- ⚠ [WIKI] Formulas page writes research as `1000 × (1 + Lab × Speed)`. That is a typo: both code sources use `(1 + Lab) × Speed`.

---

## 6. Production and Energy

### 6.1 Per-hour formulas

Sources: [AG] `metalMine.go`, `crystalMine.go`, `deuteriumSynthesizer.go`, `solarPlant.go`, `fusionReactor.go`, `solarSatellite.go`. [WIKI] Metal Mine, Crystal Mine, Deuterium Synthesizer, Solar Plant, Fusion Reactor, Solar Satellite, Formulas. [OGX] `GameObjectProduction`.

`L` = level, `S` = Universe Speed, `PT` = Plasma Technology level, `ET` = Energy Technology level, `Tmin`/`Tmax` = Planet temperatures, `Tavg = round((Tmin + Tmax) / 2)`, `pct` = the Player's production setting for that building (0–1 in 10 % steps, default 1), `f` = Energy production factor (§6.2).

| Item | Formula (per hour) | Rounding |
|---|---|---|
| Base income | Metal `30 × S`, Crystal `15 × S`, Deuterium 0 | — (not affected by `f` or Plasma) |
| Metal Mine output | `30 × L × 1.1^L × S × pct × f × (1 + 0.01 × PT)` | floor |
| Crystal Mine output | `20 × L × 1.1^L × S × pct × f × (1 + 0.0066 × PT)` | floor |
| Deuterium Synthesizer output | `10 × L × 1.1^L × (1.36 − 0.004 × Tavg) × S × pct × f × (1 + 0.0033 × PT)` | floor ([AG] rounds) |
| Metal Mine Energy use | `10 × L × 1.1^L × pct` | **ceil** |
| Crystal Mine Energy use | `10 × L × 1.1^L × pct` | **ceil** |
| Deuterium Synthesizer Energy use | `20 × L × 1.1^L × pct` | **ceil** |
| Solar Plant Energy | `20 × L × 1.1^L × pct` | floor |
| Fusion Reactor Energy | `30 × L × (1.05 + 0.01 × ET)^L × pct` | round ([AG]) |
| Fusion Reactor Deuterium burn | `10 × L × 1.1^L × S × pct` | floor of the negative, so effectively ceil of the burn ([WIKI]) |
| Solar Satellite Energy (each) | `floor((Tavg + 160) / 6)` = `floor((Tmax + 140) / 6)` when `Tmax − Tmin = 40` | floor, × count × pct |

Rounding: the wiki's Metal Mine table (L2 uses 25 Energy, from 24.2) shows mine Energy use is rounded **up**. Keep fractional Resource amounts internally and floor only for display and spending checks. Both [OGX] and the live game accrue fractional amounts.

⚠ **Deuterium temperature term.** There are three forms:
- `1.36 − 0.004 × Tavg`: [AG], [WIKI] Deuterium Synthesizer.
- `1.44 − 0.004 × Tmax`: [WIKI] Formulas, forum posts.
- `1.44 − 0.004 × Tavg`: [OGX].

The first two are **identical**, because OGame Planets always have `Tmax = Tavg + 20`. The [OGX] form mixes them and overstates output by 0.08 × base. That is a bug in [OGX]. *Use `1.36 − 0.004 × Tavg`.*

### 6.2 Energy balance and production factor

Sources: [OGX] `PlanetService::getResourceProductionFactor`, `updateResourceProductionStatsInner`. [WIKI] Deuterium Synthesizer / Formulas.

```ts
const energyProduced = solar + fusion + satellites;          // Energy has no stockpile
const energyConsumed = metalMineUse + crystalMineUse + deutSynthUse;
const f = energyConsumed === 0 ? 1
        : energyProduced === 0 ? 0
        : Math.min(1, Math.floor(energyProduced / energyConsumed * 100) / 100); // OGX floors to whole percent
// The Planet's "Energy" shown in the UI = energyProduced − energyConsumed (can be negative).
```

- `f` scales **mine output only**: not base income, and not Fusion's own Deuterium burn.
- Fusion burns Deuterium at its `pct` whatever `f` is. [OGX] drops Fusion's Energy to 0 when Deuterium stock is 0 and net Deuterium production can't cover the burn.
- ⚠ Whether `f` is floored to whole percent in the live game isn't confirmed by a primary source. [OGX] does, [AG] leaves it to the caller. It changes output by less than 1 %.

### 6.3 Planet-position production bonus (OGame 7.4+)

Sources: [WIKI] Colonization (citing the 7.4.0-pl2 release notes), [OGX] `getProductionForPositionBonuses`.

| Position | Metal bonus | Crystal bonus |
|---|---:|---:|
| 1 | — | +40 % |
| 2 | — | +30 % |
| 3 | — | +20 % |
| 6 | +17 % | — |
| 7 | +23 % | — |
| 8 | +35 % | — |
| 9 | +23 % | — |
| 10 | +17 % | — |

[OGX] applies it as `mineOutput × (1 + bonus)`, then adds Plasma on top of (mine + slot bonus).

⚠ [OGX] **also** multiplies base income by the slot bonus. No primary source confirms that. *Recommend: apply to mine output only* (open question, see end).

### 6.4 Storage capacity

Sources: [AG] `storageBuilding.go`, [OGX] `BuildingObjects.php`, [WIKI] Metal Storage, [GF] Tutorial:Buildings ("only 10,000 units can be stored" without storage).

```ts
const storageCapacity = (level: number) => 5000 * Math.floor(2.5 * Math.exp((20 * level) / 33));
// L0 = 10 000, L1 = 20 000, L2 = 40 000, L3 = 75 000, L4 = 140 000, L5 = 255 000 …
```

Each Resource (Metal, Crystal, Deuterium) has its own Structure and capacity. When stock ≥ capacity, **production of that Resource stops** ([WIKI] Metal Storage, [GF]). Stock can still exceed capacity through other means, such as refunds. The accrual rule is `stock = min(capacity, stock + rate × dt)`, applied only while `stock < capacity`, and never reducing stock that is already over the cap.

---

## 7. Planet attributes

Sources: [WIKI] Colonization / Colonizing in Redesigned Universes (table sourced from the official Gameforge wiki), [WIKI] Fields, Formulas, [OGX] `PlanetServiceFactory`, and web sources for the home planet.

**Fields.** Every Structure level uses one Field. Space Dock doesn't use one ([OGX] `consumesPlanetField = false`). A Structure upgrade can't start if `usedFields >= maxFields`. Terraformer adds `5 × L + floor(L / 2)` Fields ([GF], [OGX]). Universes may add a flat "bonus fields" setting to every Planet.

**Home planet** (the only Planet a Player has here): **163 Fields**, whatever its position. It is described as hard-coded (ogame.fandom Home Planet/Planet Size pages via search; [WIKI] Fields says home planets are "150–190"). Its diameter is **12 800 km**, consistent with the classic relation `fields = floor((diameter / 1000)^2)` (12.8² = 163.84 → 163).

⚠ [OGX] ignores the 163-Field rule for home planets (a bug: the position table always wins). It also uses a linear fit `diameter = 36.14 × fields + 5697`, which gives 11 588 km for 163 Fields. *Use 163 Fields / 12 800 km.*

**Temperature by position.** `Tmax` is random within the range below, and `Tmin = Tmax − 40` ([WIKI] note 2, [OGX]).

| Pos | Fields min / avg / max | `Tmax` range (°C) |
|---:|---|---|
| 1 | 96 / 134 / 172 | 220 … 260 |
| 2 | 104 / 140 / 176 | 170 … 210 |
| 3 | 112 / 147 / 182 | 120 … 160 |
| 4 | 118 / 163 / 208 | 70 … 110 |
| 5 | 133 / 182 / 232 | 60 … 100 |
| 6 | 146 / 194 / 242 | 50 … 90 |
| 7 | 152 / 200 / 248 | 40 … 80 |
| 8 | 156 / 204 / 252 | 30 … 70 |
| 9 | 150 / 198 / 246 | 20 … 60 |
| 10 | 142 / 187 / 232 | 10 … 50 |
| 11 | 136 / 173 / 210 | 0 … 40 |
| 12 | 125 / 156 / 186 | −10 … 30 |
| 13 | 114 / 143 / 172 | −50 … −10 |
| 14 | 100 / 134 / 168 | −90 … −50 |
| 15 | 90 / 127 / 164 | −130 … −90 |

(The Fields columns apply to colonies. The home planet is fixed at 163.)

**Temperature affects** Deuterium Synthesizer output (colder is better) and Solar Satellite Energy (hotter is better). **Position affects** the Metal/Crystal bonus (§6.3) and the Planet image type ([WIKI] Position; [OGX] `getPlanetBiomeType`: odd/even system × position → desert/dry/normal/jungle/water/ice/gas).

**Coordinates**: `[galaxy:system:position]` with position 1–15. The galaxy and system counts are universe settings (commonly 9 galaxies × 499 systems).

---

## 8. New-account starting state

Sources: [OGX] `PlanetServiceFactory::setupPlanetProperties`, [GF] Tutorial:Buildings (base income), home-planet sources above. It matches the map's standing decision.

| Item | Value |
|---|---|
| Structures, Technologies, ships | all 0 |
| Metal / Crystal / Deuterium | 500 / 500 / 0 |
| Storage caps | 10 000 each (level 0) |
| Production | base income only: 30 × S Metal/h, 15 × S Crystal/h |
| Energy | 0 / 0 |
| Production settings (`pct`) | 100 % for every producer |
| Fields | 0 / 163 |
| Diameter | 12 800 km |
| Temperature | random `Tmax` in the position's range, `Tmin = Tmax − 40` |
| Planet name | a default name, renamable (live game: "Homeworld") |

The live game also has tutorial rewards and a Character Class choice (Collector/General/Discoverer). Both are out of scope, and no class bonuses are included anywhere in this doc.

---

## 9. Queue behaviour

Sources: [GF] Tutorial:Buildings and Tutorial:Research (first-party prose), [WIKI] Buildings / Research Lab / Shipyard / Nanite Factory, [OGX] `BuildingQueueService`, `ResearchQueueService`, `UnitQueueService`, `QueueListViewModel`.

**Structures (per Planet)**
- Live OGame builds **one** Structure at a time per Planet. The Commander officer (premium) adds a waiting list, for a total of **5** entries (1 active + 4 waiting; [OGX] `maxItemsInQueue = 5`).
- ⚠ The design's **2 parallel build slots** have no OGame equivalent. The map already decided this, so it is a deliberate deviation. Timing rules still apply per slot. Open question: can both slots hold the same Structure (consecutive levels)?
- Waiting entries **pay when they start**, not when queued. If the Resources or requirements aren't there at start time, the entry is dropped ([OGX]). The level and cost of a waiting entry are computed at start time.
- **Cancel** refunds **100 %** of what was paid ([WIKI] Buildings: "the resources that had been subtracted from the planet are given back"). Cancelling also drops waiting entries that depended on it, such as later levels of the same Structure or things it unlocks ([OGX] `cancelItemMissingRequirements`).
- A Structure level uses its Field when it is queued or started, so the check is `used + inProgress < max`.

**Research (per Player)**
- **One** Research at a time across the account ([GF]: "you can only do one research at a time"). With Commander, up to 5 waiting ([OGX]). The design's Research Queue (one active, the rest wait in order) matches the Commander behaviour.
- **Cancel** refunds 100 % ([GF]: "they can be cancelled, by which you get your resources back").
- **Research Lab lock:** the Research Lab can't be upgraded while Research is running, and Research can't start while the Lab is upgrading ([GF]: "while researching, you are not able to improve the Lab, and while improving the Lab, you are not able to research").

**Shipyard (per Planet)**
- Orders run **one after another**, and each unit finishes individually at `perUnitTime` intervals ([WIKI] Formulas, [OGX]). An order of `n` units is paid in full when placed.
- Orders **can't be cancelled** ([WIKI] Shipyard: "It is not yet possible to cancel production or reschedule/change the production queue", [OGX]: "unit queue objects cannot be canceled").
- Maximum **99 999 units per order** (OGame forum suggestion thread citing the limit). ⚠ There is no primary source for a cap on the *number of orders*, and [OGX] has no cap. *Pick a limit in the spec.*
- **Shipyard/Nanite lock:** the Shipyard or Nanite Factory can't be upgraded while ships are in production on that Planet, and no ships can be ordered while either is upgrading ([GF]: "To build/upgrade the shipyard, you need … no ships or defense in the respective construction queue"; "If the Nanite Factory is under construction, no ships, defensive structures, or buildings can be built on the respective planet and vice versa").

---

## 10. Ships

### 10.1 Stats and requirements

Source: [AG] `smallCargo.go` … `crawler.go`, cross-checked with [WIKI] ship pages. [OGX] agrees on costs; its requirement and rapid-fire discrepancies are listed below.
- "Structural Integrity" is the stat shown in-game and equals Metal + Crystal. In combat, hull points = Structural Integrity / 10.
- Base values are listed. Upgrades: Armour Technology adds +10 % structural integrity per level, Shielding Technology +10 % shields per level, Weapons Technology +10 % weapons per level, Hyperspace Technology +5 % cargo per level, and each drive adds speed per level (§10.2).

| Ship | Metal | Crystal | Deut | Struct. integrity | Shield | Weapon | Base speed | Cargo | Fuel | Requires |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Light Fighter | 3000 | 1000 | 0 | 4000 | 10 | 50 | 12500 | 50 | 20 | Shipyard 1, Combustion Drive 1 |
| Heavy Fighter | 6000 | 4000 | 0 | 10000 | 25 | 150 | 10000 | 100 | 75 | Shipyard 3, Armour Technology 2, Impulse Drive 2 |
| Cruiser | 20000 | 7000 | 2000 | 27000 | 50 | 400 | 15000 | 800 | 300 | Shipyard 5, Impulse Drive 4, Ion Technology 2 |
| Battleship | 45000 | 15000 | 0 | 60000 | 200 | 1000 | 10000 | 1500 | 500 | Shipyard 7, Hyperspace Drive 4 |
| Battlecruiser | 30000 | 40000 | 15000 | 70000 | 400 | 700 | 10000 | 750 | 250 | Shipyard 8, Hyperspace Technology 5, Hyperspace Drive 5, Laser Technology 12 |
| Bomber | 50000 | 25000 | 15000 | 75000 | 500 | 1000 | 4000 | 500 | 700 | Shipyard 8, Impulse Drive 6, Plasma Technology 5 |
| Destroyer | 60000 | 50000 | 15000 | 110000 | 500 | 2000 | 5000 | 2000 | 1000 | Shipyard 9, Hyperspace Drive 6, Hyperspace Technology 5 |
| Deathstar | 5000000 | 4000000 | 1000000 | 9000000 | 50000 | 200000 | 100 | 1000000 | 1 | Shipyard 12, Hyperspace Drive 7, Hyperspace Technology 6, Graviton Technology 1 |
| Reaper | 85000 | 55000 | 20000 | 140000 | 700 | 2800 | 7000 | 10000 | 1100 | Shipyard 10, Hyperspace Technology 6, Hyperspace Drive 7, Shielding Technology 6 |
| Pathfinder | 8000 | 15000 | 8000 | 23000 | 100 | 200 | 12000 | 10000 | 300 | Shipyard 5, Hyperspace Drive 2 (wiki also lists Shielding Technology 4, already implied) |
| Small Cargo | 2000 | 2000 | 0 | 4000 | 10 | 5 | 5000 | 5000 | 10 | Shipyard 2, Combustion Drive 2 |
| Large Cargo | 6000 | 6000 | 0 | 12000 | 25 | 5 | 7500 | 25000 | 50 | Shipyard 4, Combustion Drive 6 |
| Colony Ship | 10000 | 20000 | 10000 | 30000 | 100 | 50 | 2500 | 7500 | 1000 | Shipyard 4, Impulse Drive 3 |
| Recycler | 10000 | 6000 | 2000 | 16000 | 10 | 1 | 2000 | 20000 | 300 | Shipyard 4, Combustion Drive 6, Shielding Technology 2 |
| Espionage Probe | 0 | 1000 | 0 | 1000 | 0 (0.01) | 0 (0.01) | 100000000 | 0 (5 only with probe raids) | 1 | Shipyard 3, Combustion Drive 3, Espionage Technology 2 |
| Solar Satellite | 0 | 2000 | 500 | 2000 | 1 | 1 | 0 | 0 | 0 | Shipyard 1 |
| Crawler | 2000 | 2000 | 1000 | 4000 | 1 | 1 | 0 | 0 | 0 | Shipyard 5, Combustion Drive 4, Armour Technology 4, Laser Technology 4 |

Notes:
- Solar Satellite and Crawler can't fly. Solar Satellite produces Energy (§6.1).
- Crawler adds `0.02 %` production per Crawler, capped at `8 × (Metal Mine + Crystal Mine + Deuterium Synthesizer levels)` Crawlers, and uses Energy ([WIKI] Crawler). It is a class-era mechanic. Recommend leaving it out or showing it disabled.
- Reaper can only be built by General-class players ([WIKI] Reaper). With no classes here, decide whether to keep it. Pathfinder is similarly Discoverer-flavoured in the live game.
- ⚠ [WIKI] infoboxes for Bomber (speed 500, cargo 4000) and Deathstar (speed 1 000 000, cargo 100) are wrong or swapped. *Use [AG]* (Bomber 4000 / 500, Deathstar 100 / 1 000 000).
- ⚠ **Requirements where [OGX] disagrees with [AG] + [WIKI]:** Pathfinder ([OGX]: Shipyard 5, Combustion 6, Shielding 4, Hyperspace Technology 2), Reaper ([OGX]: Shipyard 6, Impulse 6, Hyperspace Drive 4, Weapons 8, Shielding 6), Crawler ([OGX]: Shipyard 4). *Use [AG] + [WIKI]* (they agree).

### 10.2 Drive per ship (speed only matters if fleets come later)

`speed = round(baseSpeed × (1 + k × driveLevel))`, where k = 0.1 for Combustion, 0.2 for Impulse and 0.3 for Hyperspace ([AG] `baseShip.go`, [GF] Tutorial:Research).

| Drive | Ships |
|---|---|
| Combustion | Light Fighter, Small Cargo, Large Cargo, Recycler, Espionage Probe |
| Impulse | Heavy Fighter, Cruiser, Bomber, Colony Ship. Small Cargo switches at Impulse 5 (base speed 10000, fuel 20). Recycler switches at Impulse 17 (speed ×2, fuel ×2). |
| Hyperspace | Battleship, Battlecruiser, Destroyer, Deathstar, Reaper, Pathfinder. Bomber switches at Hyperspace Drive 8 (base 5000). Recycler switches at Hyperspace Drive 15 (speed ×3, fuel ×3). |

### 10.3 Rapid fire ("X fires again against Y with chance 1 − 1/n")

Source: [AG]. Discrepancies are flagged under the table. Rocket Launcher, Light Laser, Heavy Laser, Ion Cannon, Gauss Cannon and Plasma Turret are Defense units, out of scope but listed for completeness.

| Shooter | Rapid fire against |
|---|---|
| Light Fighter | Espionage Probe 5, Solar Satellite 5, Crawler 5 |
| Heavy Fighter | Espionage Probe 5, Solar Satellite 5, Crawler 5, Small Cargo 3 |
| Cruiser | Espionage Probe 5, Solar Satellite 5, Crawler 5, Light Fighter 6, Rocket Launcher 10 |
| Battleship | Espionage Probe 5, Solar Satellite 5, Crawler 5, Pathfinder 5 |
| Battlecruiser | Espionage Probe 5, Solar Satellite 5, Crawler 5, Small Cargo 3, Large Cargo 3, Heavy Fighter 4, Cruiser 4, Battleship 7 |
| Bomber | Espionage Probe 5, Solar Satellite 5, Crawler 5, Rocket Launcher 20, Light Laser 20, Heavy Laser 10, Ion Cannon 10, **Gauss Cannon 5, Plasma Turret 5** |
| Destroyer | Espionage Probe 5, Solar Satellite 5, Crawler 5, Light Laser 10, Battlecruiser 2 |
| Deathstar | Espionage Probe 1250, Solar Satellite 1250, Crawler 1250, Small Cargo 250, Large Cargo 250, Colony Ship 250, Recycler 250, Light Fighter 200, Heavy Fighter 100, Cruiser 33, Battleship 30, Bomber 25, Destroyer 5, Battlecruiser 15, Pathfinder 30, Reaper 10, Rocket Launcher 200, Light Laser 200, Heavy Laser 100, Ion Cannon 100, Gauss Cannon 50 |
| Reaper | Espionage Probe 5, Solar Satellite 5, Crawler 5, Battleship 7, Battlecruiser 7, Bomber 4, Destroyer 3 |
| Pathfinder | Espionage Probe 5, Solar Satellite 5, Crawler 5, Cruiser 3, Light Fighter 3, Heavy Fighter 2 |
| Small Cargo, Large Cargo, Colony Ship, Recycler | Espionage Probe 5, Solar Satellite 5, Crawler 5 |
| Espionage Probe, Solar Satellite, Crawler | — |
| (Defense) Ion Cannon | Reaper 2 |

⚠ Rapid-fire discrepancies:
- **Bomber vs Gauss Cannon / Plasma Turret 5:** in [WIKI] and [OGX], missing in [AG]. *Include them.*
- **Reaper vs Battlecruiser 7:** in [AG], not in [WIKI]. Unresolved, and only matters if combat is ever built.
- **Deathstar vs Probe/Satellite/Crawler:** 1250 in [AG] + [WIKI], 250 in [OGX]. *Use 1250.*
- **Reaper and Pathfinder:** [OGX]'s lists are wrong compared with [AG] + [WIKI].

Combat is out of scope, so rapid fire is display-only for now.

---

## Summary of discrepancies and recommendations

| # | Topic | Sources | Recommendation |
|---|---|---|---|
| 1 | Deuterium temperature term | [AG]/[WIKI] `1.36 − 0.004·Tavg` ≡ `1.44 − 0.004·Tmax`; [OGX] `1.44 − 0.004·Tavg` | `1.36 − 0.004·Tavg` |
| 2 | Early-level build-time divisor `max(4 − L/2, 1)` | In [AG] + [OGX]; [WIKI] unsure | Use it (not for Nanite Factory) |
| 3 | Position bonus on base income | [OGX] applies it; no primary source | Apply to mine output only |
| 4 | Energy factor floored to whole % | [OGX] floors; others silent | Floor to whole % (matches in-game %) |
| 5 | Home planet size | Live game 163 Fields / 12 800 km; [OGX] ignores it | 163 / 12 800 km |
| 6 | Ion / Hyperspace Tech / Hyperspace Drive requirements | [GF] tutorial differs from [AG] + [OGX] | [AG] |
| 7 | Pathfinder / Reaper / Crawler requirements; several rapid-fire lists | [OGX] differs from [AG] + [WIKI] | [AG] + [WIKI] |
| 8 | Bomber rapid fire vs Gauss/Plasma | [AG] lacks it | Include (5 each) |
| 9 | Space Dock Energy cost factor | [WIKI] 2.5 vs [AG] 5 | Moot if Space Dock is out of scope |
| 10 | Bomber / Deathstar speed and cargo | [WIKI] infobox wrong | [AG] |
| 11 | Shipyard order-count cap | No primary source | Decide in spec |

## Open questions for the spec (not answerable from sources)

1. **2 parallel Structure slots** (design decision) vs OGame's single slot. Can both slots upgrade the same Structure to consecutive levels? Does each slot use the Robotics/Nanite level current at its own start time? Do the Shipyard/Nanite and Research Lab locks apply per slot?
2. **Which catalog items are in v1.** Class-era ships (Reaper, Pathfinder, Crawler), fleet-only Structures (Alliance Depot, Missile Silo, Space Dock, Terraformer) and Technologies with no effect in a one-Planet, no-fleet game (Astrophysics, Intergalactic Research Network, Computer Technology's fleet-slot effect, Espionage). Some are still prerequisites, such as Computer Technology for the Nanite Factory and Espionage for the Probe.
3. **Shipyard order limits:** the number of simultaneous orders, and whether to keep the 99 999-per-order cap.
4. **Home planet position:** OGame puts new Players in middle slots. Pick an allowed position range for random Coordinates, since it sets temperature and the Metal/Crystal bonus.
5. **Waiting Research/Structure entries:** pay at start (OGame/[OGX]) or at enqueue? The design's UI may imply one or the other.
