# Design catalog → OGame entity mapping

Resolves [#3](https://github.com/kamkom/ogame-clone/issues/3) (part of map #1).

**Question:** How does each item in the design (direction "D") map to an OGame entity, and which ones have no clean match?

**Answer in one line:** 32 of the design's 33 catalog items map to OGame entities. Fold Drive is the one real gap. Its slot stands in for OGame's Hyperspace Technology, the only one of OGame's 16 Technologies missing from the design. Dreadnought is Battleship (not Destroyer or Deathstar), Corvette is Heavy Fighter, and Graviton Lance is Graviton Technology.

## Sources

- **Design:** `Space Strategy Game — Planet Overview Variants.html` at the repo root. It is a bundler file. The four "D" pages sit gzip+base64-encoded in its `__bundler/manifest`. Each page's `__bundler/template` holds an `<x-dc>` component whose `renderVals()` contains the mock data quoted below. The pages are:
  - `D · Command Deck — Planet overview` (CommandDeck.dc.html)
  - `D · Structures` (Buildings.dc.html)
  - `D · Research` (Research.dc.html)
  - `D · Shipyard` (Shipyard.dc.html)
- **OGame catalog:** the OGame Fandom wiki, read as raw wikitext through `https://ogame.fandom.com/api.php?action=parse&page=<Page>&prop=wikitext`. The pages used are listed next to each claim. Short form: `[F:Page]` = `https://ogame.fandom.com/wiki/Page`.
  - Caveat: some Fandom ship infoboxes are wrong. The Cruiser infobox says speed 800 and cargo 15,000. So ship stats come from the performance table on [F:Ships], which matches the design exactly.

## How to read the evidence

The design's numbers are **mock data**. They are useful as identity evidence, not as formulas:

- **Base costs and cost ratios** mostly match OGame, some of them exactly. This is the strongest identity signal.
- **Production, energy, time and bonus values** mostly don't match OGame formulas at any single Universe Speed. Examples: Alloy Extractor 18 shows +42.1k/h, while OGame's Metal Mine 18 gives 3,002/h at x1. Robotics Works 8 shows "Build time −53%", while OGame's `1/(1+8)` would give −89%.
- The rules therefore come from OGame (a standing decision on #1), not from the design's numbers.

Cost formula used for the checks: `cost(L) = base × factor^(L−1)`. The factor is 1.5 for Metal Mine, Deuterium Synthesizer and Solar Plant, 1.6 for Crystal Mine, 1.8 for Fusion Reactor, and 2 for other facilities and all research ([F:Buildings]).

## Resources

| Design | OGame | Evidence |
|---|---|---|
| Alloy | Metal | Glossary (`CONTEXT.md`). Top bar shows 1,248,390, +42.1K |
| Crystal | Crystal | 612,044, +21.9K |
| Deuterium | Deuterium | 208,715, +9.3K |
| Energy | Energy | Top bar shows "1,420 / 1,860" (balance / capacity) |

## Structures

The design shows 9 Structures. Its "All · 9" filter shows no storage cards, even though a "Storage" filter button exists.

| Design (category) | OGame | Design mock (level; next-level cost; effect) | OGame check | Match |
|---|---|---|---|---|
| Alloy Extractor (RESOURCES) | Metal Mine | L18; 60.1k Alloy / 15.0k Crystal; 1h 12m; +42.1k Alloy/h → +46.9k | Base 60 M / 15 C, ×1.5 [F:Metal_Mine]. The 4:1 ratio matches. The L18 cost (59.1k) is close to the shown amount. The next level (L19) would be 88.7k | Clean |
| Crystal Refinery (RESOURCES) | Crystal Mine | L15, upgrading to 16 (00:42:18 in the queue); +21.9k Crystal/h → +24.6k | Base 48 M / 24 C, ×1.6 [F:Crystal_Mine] | Clean |
| Deuterium Synthesizer (RESOURCES) | Deuterium Synthesizer | L12→13; 30,240 Alloy / 10,080 Crystal; 48m 20s; 9,340 → 10,720/h; energy use 412 → 468; Fields +1. Text: "Output falls on warmer worlds" | Base 225 M / 75 C, ×1.5. L13 = 29,192 / 9,730, and the 3:1 ratio matches. Production depends on temperature `(1.36 − 0.004·T)` [F:Deuterium_Synthesizer] | Clean, same name |
| Solar Array (ENERGY) | Solar Plant | L20; 44.0k / 17.6k; 1h 04m; +1,860 Energy → +2,090 | Base 75 M / 30 C, and the 2.5:1 ratio matches. The amounts are mock (OGame L21 = 249k / 99.8k). OGame L20 energy = 2,690 [F:Solar_Plant] | Clean |
| Fusion Reactor (ENERGY) | Fusion Reactor | L4; 14.2k / 5.7k; 26m 10s; "+320 Energy, burns 1.1k Deut/h" | Base 900 M / 360 C / 180 D, ×1.8, and the 2.5:1 ratio matches. It burns Deuterium [F:Fusion_Reactor]. The design's cost card has no Deuterium line, while OGame costs Deuterium | Clean |
| Robotics Works (FACILITIES) | Robotics Factory | L8; 102k / 30.7k; 3h 40m; "Build time −53%" → −56% | Base 400 M / 120 C / 200 D, ×2. L9 = 102,400 / 30,720, an **exact** match [F:Robotics_Factory]. The effect is mock (OGame divides by 1+level) | Clean |
| Orbital Shipyard (FACILITIES) | Shipyard | L10; 409k / 204k; 9h 15m; "Dreadnought unlocks at 12" | Base 400 / 200 / 100, ×2. L11 = 409,600 / 204,800, **exact** [F:Shipyard]. Shipyard 12 unlocks the Deathstar in OGame, not the Battleship. See Dreadnought | Clean |
| Research Lab (FACILITIES) | Research Lab | L9; 102k / 205k; 7h 02m; "Research speed ×1.9" → ×2.0 | Base 200 / 400 / 200, ×2. L10 = 102,400 / 204,800, **exact** [F:Research_Lab]. The effect is mock (OGame divides by 1+level, so ×10) | Clean |
| Nanite Foundry (FACILITIES, locked) | Nanite Factory | "Requires Robotics Works 10 · Computation 10"; "Halves build time per level" | Requires Robotics Factory 10 and Computer Technology 10, and halves build time per level [F:Nanite_Factory]. **Exact** | Clean |

The Structures heading reads "163 of 188 fields developed · 1 of 2 build slots in use". The design has the concept of Fields, but none of its Structures maps to Terraformer, the OGame Structure that adds Fields.

## Technologies

The design has 16 Technology nodes in 4 lanes. OGame has 16 Technologies ([F:Research]).

| Design lane → node (mock state) | OGame | Evidence / reasoning | Match |
|---|---|---|---|
| Energy & Physics → Energy Theory (L12) | Energy Technology | First node of the energy lane. Warp Drive needs "Energy Theory 12 / 5", and OGame's Hyperspace Drive needs Energy Tech 5 [F:Hyperspace_Drive] | Clean |
| Energy & Physics → Photon Lasers (L8, researching → 9, 01:12:40) | Laser Technology | Laser icon. Sits after Energy, the same order as OGame's Energy→Laser→Ion→Plasma chain [F:Research] | Clean |
| Energy & Physics → Ion Lattice (L5) | Ion Technology | Ion slot in the chain | Clean |
| Energy & Physics → Plasma Containment (L2) | Plasma Technology | Plasma slot in the chain | Clean |
| Propulsion → Combustion Drive (L10) | Combustion Drive | Same name | Clean |
| Propulsion → Impulse Drive (L7) | Impulse Drive | Same name | Clean |
| Propulsion → Warp Drive (L3, selected) | Hyperspace Drive | Detail text: "Each level makes ships that use it 30% faster". OGame's Hyperspace Drive gives +30% base speed per level [F:Hyperspace_Drive]. "Dreadnought speed 19,000" at L3 = Battleship base 10,000 × (1 + 0.3·3) **exactly**. The shown next value, 21,000, is a mock slip; OGame gives 22,000. Design requirements "Research Lab 9/7, Energy Theory 12/5, Shield Harmonics 9/5" = Hyperspace Drive's Lab 7, Energy 5, Shielding 5 **exactly**. OGame's 4th requirement, Hyperspace Technology 3, is replaced in the design by "Ion Lattice (for Fold Drive) 5/7". Cost "80k Crystal · 24k Deut" is mock (OGame L4 = 80k M / 160k C / 48k D). Research time 5h 40m | Clean |
| Propulsion → **Fold Drive** (locked, L0) | *none* (best candidate: Hyperspace Technology) | See Gaps | **Gap** |
| Military → Weapons Systems (L11) | Weapon Technology | Same role | Clean |
| Military → Shield Harmonics (L9) | Shielding Technology | Used as the Shielding 5 requirement of Warp Drive = Hyperspace Drive | Clean |
| Military → Armor Plating (L10) | Armour Technology | Same role | Clean |
| Military → **Graviton Lance** (locked, L0) | Graviton Technology (best candidate) | The name reads like a weapon, but OGame's only graviton item is Graviton Technology. It costs 300,000 Energy only, needs Research Lab 12, and exists to unlock the Deathstar [F:Graviton_Technology]. "Locked" at Lab 9 is consistent | Uncertain, see Gaps |
| Science & Expansion → Signal Intelligence (L8) | Espionage Technology | "Intelligence" fits espionage. Pairs with the Scout Drone (role "Espionage"). OGame has no other intel tech | Clean (by elimination) |
| Science & Expansion → Computation (L10) | Computer Technology | Nanite requirement "Computation 10" = Computer Technology 10 [F:Nanite_Factory] | Clean |
| Science & Expansion → Astrophysics (L6) | Astrophysics | Same name. In OGame its effect is extra colony slots and expeditions [F:Astrophysics], both out of scope | Clean (effect out of scope) |
| Science & Expansion → Stellar Network (locked, L0) | Intergalactic Research Network | The Research header reads "Research Lab 9 · 3 labs networked across your colonies", which is IRN's effect [F:Intergalactic_Research_Network]. IRN requires Research Lab 10, so "locked" at Lab 9 is consistent | Clean (effect needs colonies) |

## Ships

Shipyard list with the design's roles and quantities. Fleet-strength totals (Combat 338 = 240+60+32+6, Cargo 121 = 85+24+12, Support 40, total 499) check out against those quantities.

| Design (role, qty) | OGame | Evidence | Match |
|---|---|---|---|
| Interceptor ("Light fighter", 240) | Light Fighter | The role string names it. The Cruiser shows "Rapid fire vs Interceptor ×6", and OGame's Cruiser has RF 6 vs Light Fighter [F:Cruiser] | Clean |
| Corvette ("Escort", 60) | Heavy Fighter (best candidate) | No stats are shown. It sits between Interceptor and Cruiser in the list and counts as Combat. OGame's only combat ship between those two is the Heavy Fighter [F:Ships] | Probable |
| Cruiser ("Line ship", 32) | Cruiser | Attack 400, Shields 50, Hull 27,000, Speed 15,000, Cargo 800, Fuel 300 = OGame Cruiser **exactly** [F:Ships table]. 10 cost 200k / 70k / 20k = 10 × (20k M / 7k C / 2k D) **exactly**. The build time (3h 20m for 10) and "Max 14" are mock | Clean |
| Dreadnought ("Capital ship", 6) | Battleship (best candidate) | Warp Drive shows "Dreadnought speed 19,000" at L3 = Battleship base speed 10,000 on Hyperspace Drive, +30%/level, **exact** [F:Ships, F:Hyperspace_Drive]. Against this, the Structures page says "Dreadnought unlocks at [Shipyard] 12". Shipyard 12 is the **Deathstar's** requirement [F:Deathstar], while Battleship needs Shipyard 7 + Hyperspace Drive 4 [F:Battleship]. The player also already has 6 Dreadnoughts at Shipyard 10 and Warp Drive 3, which contradicts both. Speed is the numerically exact clue, so Battleship is the pick | Uncertain |
| Hauler ("Small cargo", 85) | Small Cargo | Role string. In production queue ("Hauler · 20") | Clean |
| Freighter ("Large cargo", 24) | Large Cargo | Role string | Clean |
| Scout Drone ("Espionage", 40) | Espionage Probe | Role string. Counts as "Support" | Clean |
| Salvager ("Debris recovery", 12) | Recycler | Role string. Counts as "Cargo". Debris fields only come from combat, which is out of scope | Clean (purpose out of scope) |

## Gaps: design items with no clean OGame counterpart

1. **Fold Drive** (Technology, Propulsion lane, locked). OGame has exactly three drives: Combustion, Impulse and Hyperspace ([F:Research]). No OGame item needs Ion Technology 7, yet the design shows "Ion Lattice (for Fold Drive) 5/7". **Best candidate:** Hyperspace Technology. It is the only OGame Technology missing from the design (16 ↔ 16 with Fold Drive as the odd one out), and in OGame it is the prerequisite (level 3) of Hyperspace Drive, exactly where Warp Drive's requirement list shows a Fold-Drive-related 4th row. Options:
   - (a) Fold Drive *is* Hyperspace Technology, renamed. It keeps OGame's effects (+5% cargo per level, prerequisite for Hyperspace Drive 3 / IRN 8 / Deathstar 6) but sits after Warp Drive in the lane, so its visual order is inverted.
   - (b) Rename Fold Drive to a Hyperspace-Tech-like name and move it into the Energy & Physics lane.
   - (c) Keep Fold Drive as an invented Technology with its own rules, which departs from "OGame rules one-to-one".
2. **Graviton Lance** (Technology, Military lane). The name suggests a weapon, but its closest match, Graviton Technology, is a one-off Energy-gated unlock for the Deathstar, and the design has no Deathstar. Options:
   - Map it to Graviton Technology even though it unlocks nothing in scope.
   - Treat it as unlocking a Deathstar-equivalent.
   - Show it but keep it permanently locked, like "coming soon".
3. **Dreadnought's identity conflict.** The speed evidence says Battleship, and "unlocks at Shipyard 12" says Deathstar. The Battleship is the natural pick, but the unlock text must then change to Shipyard 7 + Warp Drive 4.
4. **"3 labs networked across your colonies"** (Research header) and Stellar Network (IRN). Both assume multiple Planets, which conflicts with the one-Planet scope. IRN has no effect with a single Planet.

## Omissions: OGame items in scope that the design doesn't show

Scope per map #1 is one Planet, with Structures, Research and Shipyard. Items tied to Moons, Defenses, Alliances or colonization are marked out of scope.

**Structures**
- **Metal Storage, Crystal Storage, Deuterium Tank.** Base cost 1,000 M (Metal Storage) etc., ×2 [F:Metal_Storage, F:Storage]. They cap resource production. The design has a "Storage" filter button but no cards. **In scope, and a decision is needed:** they could be added as cards, or storage caps could be dropped.
- **Terraformer.** Adds Fields. Requires Nanite Factory 1 and Energy Technology 12 [F:Terraformer]. The design shows Fields ("163 of 188"). In scope if Fields are enforced.
- **Space Dock.** Recovers wreckage from lost ships. It needs combat, so out of scope.
- **Alliance Depot** (alliances) and **Missile Silo** (defense/missiles). Out of scope.
- **Moon Structures** (Lunar Base, Sensor Phalanx, Jump Gate). Out of scope. The Overview shows a Moon "Selis" with "Jump gate offline" and a "Defense Grid · 142 emplacements", but these are already on the disabled/"coming soon" list.

**Technologies**
- **Hyperspace Technology.** Missing, and probably what Fold Drive's slot is. Requires Research Lab 7, Energy 5, Shielding 5. Base cost 0 M / 4,000 C / 2,000 D [F:Hyperspace_Technology]. It is required for Hyperspace Drive (Warp Drive) 3, so **Warp Drive can't follow OGame rules without it or a stand-in.**
- All 15 other OGame Technologies are present.

**Ships**
- **Solar Satellite.** An energy source built in the Shipyard. Requires Shipyard 1. Costs 2,000 C / 500 D [F:Solar_Satellite]. Planet economy, so **in scope.** Not shown.
- **Crawler.** A mine-production booster. Requires Shipyard 5, Combustion 4, Armour 4, Laser 4 [F:Crawler]. Planet economy, **in scope** if class and newer mechanics are included. It's an optional modern-OGame item.
- **Colony Ship.** Colonization is out of scope, so omitting it is fine unless it should be shown disabled.
- **Battlecruiser, Bomber, Destroyer, Deathstar, Reaper, Pathfinder.** These are combat or expedition ships [F:Ships]. Combat is out of scope, but building them is part of the Shipyard in OGame. The design's 8-ship roster simply leaves them out. A decision is needed on whether the v1 ship catalog is exactly the design's 8.
- **Defenses** (Rocket Launcher … Plasma Turret, shields, missiles). The design has a "Defenses" tab, but it is out of scope and shown disabled.

## Other mock-data inconsistencies worth knowing

- The Energy top bar shows "1,420 / 1,860". But Solar Array alone gives +1,860 and Fusion Reactor +320, so the capacity would be 2,180.
- The Fusion Reactor cost card shows only Alloy and Crystal. OGame charges Deuterium too, so the cost UI needs a third line for some Structures, as Robotics, Shipyard and Lab also do (OGame charges them Deuterium).
- Cruiser "Max 14". The resources on hand allow 62 (Alloy-bound). This is mock.
