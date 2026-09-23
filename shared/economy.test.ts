import { describe, expect, it } from 'vitest';
import {
  alloyMineEnergyUse,
  alloyMineOutput,
  baseIncome,
  crystalMineEnergyUse,
  crystalMineOutput,
  deuteriumSynthEnergyUse,
  deuteriumSynthOutput,
  fusionDeuteriumBurn,
  fusionReactorEnergy,
  fusionThrottle,
  levelCost,
  maxFields,
  productionFactor,
  researchDurationSec,
  solarPlantEnergy,
  solarSatelliteEnergy,
  storageCapacity,
  structureDurationSec,
  secondsUntilAffordable,
  shipUnitDurationSec,
} from './economy.ts';
import { shipDef, structureDef, technologyDef } from './catalog.ts';

/** Alloy/Crystal/Deuterium cost of a Structure level, straight from the catalog. */
function costOf(key: string, level: number): [number, number, number] {
  const { baseCost, factor } = structureDef(key)!;
  return [
    levelCost(baseCost.alloy, factor, level),
    levelCost(baseCost.crystal, factor, level),
    levelCost(baseCost.deuterium, factor, level),
  ];
}

// Golden values cite their primary source. The rules-reference doc
// (docs/research/ogame-rules-reference.md) only picks between them.
//   [AG]   alaingilbert/ogame @325667f, pkg/ogame/<name>_test.go. The library's own tests, whose
//          values are checked against live servers. The Go `Production`/`ConstructionTime` args are
//          noted next to each row.
//   [OGX]  lanedirt/OGameX @7c420ba, app/Services/PlanetService.php.
//   [WIKI] ogame.fandom.com tables, read through the Wayback Machine:
//          Metal_Mine web.archive.org/web/20230414123744, Crystal_Mine 20250714125123,
//          Solar_Plant 20250313014253, Fusion_Reactor 20250714124308, Metal_Storage 20250209192105.
// Rows marked "formula" have no published value; the expected integer is worked out by hand.

describe('mine output per hour', () => {
  // [WIKI] Metal_Mine "Resource Stat Table", Metal Production per hour (the mine's share).
  it.each([
    [0, 0],
    [1, 33],
    [2, 72],
    [5, 241],
    [10, 778],
    [16, 2205],
    [18, 3002],
  ])('Alloy Extractor %i gives %i/h at x1, as OGame Metal Mine', (level, expected) => {
    expect(alloyMineOutput(level)).toBe(expected);
  });

  it('Crystal matches OGame Crystal Mine values at x1', () => {
    expect(crystalMineOutput(16)).toBe(1470); // [WIKI] Crystal_Mine level table
    expect(crystalMineOutput(1)).toBe(22); // formula: 20·1.1
  });

  it('matches the live-server values in alaingilbert/ogame (base income added back)', () => {
    // [AG] metalMine_test: Production(speed 1, …, plasma 0, level 1) = 63 and speed 4 → 252.
    expect(alloyMineOutput(1) + baseIncome(1).alloy).toBe(63);
    expect(alloyMineOutput(1, { speed: 4 }) + baseIncome(4).alloy).toBe(252);
    // [AG] metalMine_test: Production(7, 1, 1, plasma 7, level 29) = 96606 + 6762 + 210.
    expect(alloyMineOutput(29, { speed: 7, plasma: 7 }) + baseIncome(7).alloy).toBe(
      96606 + 6762 + 210,
    );
    // [AG] crystalMine_test: Production(7, 1, 1, plasma 7, level 25) = 37921 + 1752 + 105.
    expect(crystalMineOutput(25, { speed: 7, plasma: 7 }) + baseIncome(7).crystal).toBe(
      37921 + 1752 + 105,
    );
    // [AG] deuteriumSynthesizer_test: Production(7, Tavg (−23+17)/2 = −3, 1, 1, plasma 15, level 28).
    expect(deuteriumSynthOutput(28, -3, { speed: 7, plasma: 15 })).toBe(40699);
  });

  it('scales with Universe Speed', () => {
    expect(alloyMineOutput(18, { speed: 5 })).toBe(Math.floor(30 * 18 * 1.1 ** 18 * 5));
  });

  it('applies the position bonus to mine output only ([OGX] getProductionForPositionBonuses)', () => {
    // Position 8 → +35% Alloy.
    expect(alloyMineOutput(18, { position: 8 })).toBe(4053);
    // Position 1 → +40% Crystal.
    expect(crystalMineOutput(16, { position: 1 })).toBe(2058);
    // A position with no listed bonus leaves output unchanged.
    expect(alloyMineOutput(18, { position: 4 })).toBe(3002);
  });

  it('applies the Plasma bonus ([AG] metalMine.go: 1 + PT/100)', () => {
    // +1% Alloy per Plasma level.
    expect(alloyMineOutput(18, { plasma: 10 })).toBe(Math.floor(3002 * 1.1));
  });

  it('scales Deuterium output by the temperature term 1.36−0.004·Tavg ([AG])', () => {
    expect(deuteriumSynthOutput(12, 60)).toBe(421); // formula
    // Colder is better: a lower Tavg gives more.
    expect(deuteriumSynthOutput(12, 0)).toBeGreaterThan(deuteriumSynthOutput(12, 60));
  });

  it('scales output by the Energy production factor', () => {
    expect(alloyMineOutput(18, { factor: 0.5 })).toBe(Math.floor(3002 * 0.5));
  });
});

describe('Energy produced', () => {
  it('Solar Plant matches OGame values, ignoring Universe Speed', () => {
    expect(solarPlantEnergy(16)).toBe(1470); // [WIKI] Solar_Plant level table
    expect(solarPlantEnergy(20)).toBe(2690); // [WIKI] Solar_Plant level table
    expect(solarPlantEnergy(29)).toBe(9200); // [AG] solarPlant_test: Production(29)
  });

  it('Fusion Reactor uses (1.05+0.01·ET)^L', () => {
    // [WIKI] Fusion_Reactor level table, Energy by Energy Technology level.
    expect(fusionReactorEnergy(1, 3)).toBe(32);
    expect(fusionReactorEnergy(4, 3)).toBe(163);
    // The wiki table floors (L10 at ET10: 1,213); [AG] rounds, so we give 1,214 (1213.67).
    expect(fusionReactorEnergy(10, 10)).toBe(1214);
    // [AG] fusionReactor_test: Production(energyTechnology 12, level 13); also in the wiki table.
    expect(fusionReactorEnergy(13, 12)).toBe(3002);
    expect(fusionReactorEnergy(4, 0)).toBe(146); // formula: 120·1.05^4 = 145.86, rounded
  });

  // [WIKI] Fusion_Reactor table: levels 1–5 burn 11, 25, 40, 59, 81 Deuterium/h at x1. [AG] takes
  // the floor of the negative, so the burn is effectively rounded up.
  it('Fusion burns ceil(10·L·1.1^L·S) Deuterium', () => {
    expect([1, 2, 3, 4, 5].map((l) => fusionDeuteriumBurn(l))).toEqual([11, 25, 40, 59, 81]);
    expect([10, 14].map((l) => fusionDeuteriumBurn(l))).toEqual([260, 532]); // [WIKI]
    // [AG] fusionReactor_test: GetFuelConsumption(speed 7, ratio 1.0 / 0.7, level 9).
    expect(fusionDeuteriumBurn(9, 7)).toBe(1486);
    expect(fusionDeuteriumBurn(9, 7, 0.7)).toBe(1040);
    expect(fusionDeuteriumBurn(4, 5)).toBe(293); // formula: 58.564 × 5 = 292.82
  });

  it('Solar Satellite Energy is floor((Tavg+160)/6) each', () => {
    // [AG] solarSatellite_test: Production(Temperature{−23, 17}, 51) and ({54, 94}, 2).
    expect(solarSatelliteEnergy(51, -3)).toBe(1326);
    expect(solarSatelliteEnergy(2, 74)).toBe(78);
    expect(solarSatelliteEnergy(1, 20)).toBe(30); // formula
    expect(solarSatelliteEnergy(4, 20)).toBe(120); // formula
  });
});

describe('mine Energy use (ceil)', () => {
  it('rounds up: Metal Mine 2 uses 25, from 24.2 ([WIKI] Metal_Mine table)', () => {
    expect(alloyMineEnergyUse(2)).toBe(25);
    expect(alloyMineEnergyUse(18)).toBe(1001); // [WIKI] Metal_Mine table
    expect(alloyMineEnergyUse(29)).toBe(4601); // [AG] metalMine_test: EnergyConsumption(29)
    expect(crystalMineEnergyUse(16)).toBe(736); // [AG] crystalMine_test: EnergyConsumption(16)
  });

  it('Deuterium Synthesizer uses 20·L·1.1^L, ceiled', () => {
    expect(deuteriumSynthEnergyUse(1)).toBe(Math.ceil(20 * 1.1)); // formula
    // [AG] deuteriumSynthesizer_test: EnergyConsumption(26).
    expect(deuteriumSynthEnergyUse(26)).toBe(6198);
  });
});

describe('production factor', () => {
  it('is 1 when nothing consumes Energy', () => {
    expect(productionFactor(0, 0)).toBe(1);
    expect(productionFactor(100, 0)).toBe(1);
  });

  it('is 0 when nothing produces Energy but something consumes it', () => {
    expect(productionFactor(0, 100)).toBe(0);
  });

  // [OGX] PlanetService::getResourceProductionFactor floors to whole percent.
  it('is min(1, produced/consumed) floored to whole percent', () => {
    expect(productionFactor(50, 100)).toBe(0.5);
    expect(productionFactor(200, 100)).toBe(1);
    expect(productionFactor(999, 1000)).toBe(0.99); // 0.999 floored to 0.99
  });
});

describe('Fusion throttle (story 30)', () => {
  it('runs at full power while Deuterium is in stock', () => {
    expect(fusionThrottle(true, 0, 81)).toBe(1);
  });

  it('with Deuterium out, runs at the fraction its incoming Deuterium can feed', () => {
    // A Fusion Reactor 5 burns 81/h ([WIKI]); 40.5/h incoming feeds exactly half of it.
    expect(fusionThrottle(false, 40.5, 81)).toBe(0.5);
    expect(fusionThrottle(false, 0, 81)).toBe(0);
  });

  it('never runs above full power, and a reactor that burns nothing is never throttled', () => {
    expect(fusionThrottle(false, 200, 81)).toBe(1);
    expect(fusionThrottle(false, 0, 0)).toBe(1);
  });
});

describe('storage capacity', () => {
  // [WIKI] Metal_Storage "Costs & Capacity (Redesign Universe)" table; L0 = 10,000.
  it.each([
    [0, 10_000],
    [1, 20_000],
    [2, 40_000],
    [3, 75_000],
    [4, 140_000],
    [5, 255_000],
    [6, 470_000],
    [7, 865_000],
    [8, 1_590_000],
  ])('level %i holds %i', (level, expected) => {
    expect(storageCapacity(level)).toBe(expected);
  });
});

describe('level cost ([AG] baseLevelable.go)', () => {
  it('is floor(base·factor^(L−1)) per Resource', () => {
    const ext = structureDef('alloy-extractor')!;
    // L1 is the base cost.
    expect(levelCost(ext.baseCost.alloy, ext.factor, 1)).toBe(60);
    expect(levelCost(ext.baseCost.crystal, ext.factor, 1)).toBe(15);
    // L2 scales by 1.5, floored.
    expect(levelCost(ext.baseCost.alloy, ext.factor, 2)).toBe(90);
    expect(levelCost(ext.baseCost.crystal, ext.factor, 2)).toBe(22);
    // [WIKI] Metal_Mine table: L18 costs 59,115 / 14,778.
    expect(levelCost(ext.baseCost.alloy, ext.factor, 18)).toBe(59115);
    expect(levelCost(ext.baseCost.crystal, ext.factor, 18)).toBe(14778);
  });

  // [AG] deuteriumSynthesizer_test / researchLab_test / shipyard_test / terraformer_test: GetPrice.
  it.each([
    ['deuterium-synthesizer', 1, [225, 75, 0]],
    ['deuterium-synthesizer', 2, [337, 112, 0]],
    ['deuterium-synthesizer', 3, [506, 168, 0]],
    ['deuterium-synthesizer', 4, [759, 253, 0]],
    ['deuterium-synthesizer', 5, [1139, 379, 0]],
    ['deuterium-synthesizer', 11, [12_974, 4324, 0]],
    ['research-lab', 4, [1600, 3200, 1600]],
    ['research-lab', 6, [6400, 12_800, 6400]],
    ['orbital-shipyard', 4, [3200, 1600, 800]],
    ['terraformer', 1, [0, 50_000, 100_000]],
    ['terraformer', 2, [0, 100_000, 200_000]],
    ['terraformer', 3, [0, 200_000, 400_000]],
  ])('%s %i costs %j, as in alaingilbert/ogame', (key, level, expected) => {
    expect(costOf(key, level)).toEqual(expected);
  });

  it('matches the facility values in the design-catalog mapping (formula)', () => {
    const robotics = structureDef('robotics-works')!; // 400/120 ×2 → L9 = 102,400 / 30,720
    expect(levelCost(robotics.baseCost.alloy, robotics.factor, 9)).toBe(102400);
    expect(levelCost(robotics.baseCost.crystal, robotics.factor, 9)).toBe(30720);
    const shipyard = structureDef('orbital-shipyard')!; // 400/200 ×2 → L11 = 409,600 / 204,800
    expect(levelCost(shipyard.baseCost.alloy, shipyard.factor, 11)).toBe(409600);
    expect(levelCost(shipyard.baseCost.crystal, shipyard.factor, 11)).toBe(204800);
    const lab = structureDef('research-lab')!; // 200/400 ×2 → L10 = 102,400 / 204,800
    expect(levelCost(lab.baseCost.alloy, lab.factor, 10)).toBe(102400);
    expect(levelCost(lab.baseCost.crystal, lab.factor, 10)).toBe(204800);
  });

  it('charges Deuterium where OGame does (Fusion Reactor)', () => {
    const fusion = structureDef('fusion-reactor')!; // 900/360/180 ×1.8
    expect(levelCost(fusion.baseCost.deuterium, fusion.factor, 1)).toBe(180);
    expect(levelCost(fusion.baseCost.deuterium, fusion.factor, 2)).toBe(324);
  });
});

describe('structure build time ([AG] baseBuilding.go)', () => {
  // [AG] <structure>_test: ConstructionTime(level, speed, Facilities{Robotics, Nanite}).
  it.each([
    ['alloy-extractor', 20, 3, 0, 7, 8550],
    ['alloy-extractor', 4, 0, 0, 6, 30],
    ['crystal-refinery', 5, 0, 0, 6, 75],
    ['deuterium-synthesizer', 9, 0, 0, 6, 1845],
    ['fusion-reactor', 2, 3, 0, 7, 38],
    ['solar-array', 1, 10, 7, 6, 1],
    ['nanite-foundry', 1, 10, 0, 5, 39_272],
    ['nanite-foundry', 2, 10, 1, 7, 28_051],
    ['nanite-foundry', 3, 10, 2, 7, 28_051],
    ['nanite-foundry', 6, 13, 5, 7, 22_040],
  ])(
    '%s %i at Robotics %i, Nanite %i, x%i takes %i s, as in alaingilbert/ogame',
    (key, level, robotics, nanite, speed, expected) => {
      const [alloy, crystal] = costOf(key, level);
      const isNanite = key === 'nanite-foundry';
      expect(structureDurationSec(alloy, crystal, level, robotics, nanite, speed, isNanite)).toBe(
        expected,
      );
    },
  );

  it('applies the early-level divisor to the first levels', () => {
    // L1 Alloy Extractor: (60+15)/(2500·3.5) h = 30 s.
    expect(structureDurationSec(60, 15, 1, 0, 0, 1, false)).toBe(30);
  });

  it('speeds up with Robotics Works, Nanite Foundry and Universe Speed, to the second', () => {
    // L6 Alloy Extractor costs 455/113; divisor is 1 from level 6 on.
    expect(structureDurationSec(455, 113, 6, 0, 0, 1, false)).toBe(817);
    expect(structureDurationSec(455, 113, 6, 5, 0, 1, false)).toBe(136); // ÷(1+5)
    expect(structureDurationSec(455, 113, 6, 0, 1, 1, false)).toBe(408); // ÷2^1
    expect(structureDurationSec(455, 113, 6, 0, 0, 2, false)).toBe(408); // ÷speed 2
    expect(structureDurationSec(455, 113, 6, 5, 1, 2, false)).toBe(34); // combined
  });

  it('skips the early-level divisor for the Nanite Foundry', () => {
    // (1_000_000+500_000)/2500 h = 600 h = 2,160,000 s, with no ÷3.5 speed-up at level 1.
    expect(structureDurationSec(1_000_000, 500_000, 1, 0, 0, 1, true)).toBe(2_160_000);
  });

  it('never returns less than one second', () => {
    expect(structureDurationSec(1, 1, 1, 0, 0, 1, false)).toBe(1);
  });
});

describe('max Fields (163 + Terraformer bonus 5·L + floor(L/2))', () => {
  it.each([
    [0, 163],
    [1, 168],
    [2, 174],
    [3, 179],
    [10, 218],
  ])('Terraformer %i → %i Fields', (level, expected) => {
    expect(maxFields(level)).toBe(expected);
  });
});

describe('seconds until affordable', () => {
  const caps = { alloy: 10_000, crystal: 10_000, deuterium: 10_000 };
  const rates = { alloy: 3600, crystal: 1800, deuterium: 0 };

  it('is 0 when the cost is already covered', () => {
    const stock = { alloy: 100, crystal: 100, deuterium: 0 };
    expect(
      secondsUntilAffordable({ alloy: 100, crystal: 50, deuterium: 0 }, stock, rates, caps),
    ).toBe(0);
  });

  it('waits for the slowest short Resource, rounded up to a whole second', () => {
    const stock = { alloy: 0, crystal: 0, deuterium: 0 };
    // Alloy needs 60 at 1/s = 60s; Crystal needs 45 at 0.5/s = 90s.
    expect(
      secondsUntilAffordable({ alloy: 60, crystal: 45, deuterium: 0 }, stock, rates, caps),
    ).toBe(90);
    expect(
      secondsUntilAffordable({ alloy: 60.5, crystal: 0, deuterium: 0 }, stock, rates, caps),
    ).toBe(61);
  });

  it('is null ("never") when a short Resource has no production', () => {
    const stock = { alloy: 0, crystal: 0, deuterium: 0 };
    expect(
      secondsUntilAffordable({ alloy: 0, crystal: 0, deuterium: 1 }, stock, rates, caps),
    ).toBeNull();
  });

  it('is null when a negative rate drains a short Resource', () => {
    const stock = { alloy: 0, crystal: 0, deuterium: 0 };
    const draining = { ...rates, deuterium: -100 };
    expect(
      secondsUntilAffordable({ alloy: 0, crystal: 0, deuterium: 1 }, stock, draining, caps),
    ).toBeNull();
  });

  it('is null when the Storage Capacity is below the cost', () => {
    const stock = { alloy: 0, crystal: 0, deuterium: 0 };
    expect(
      secondsUntilAffordable({ alloy: 10_001, crystal: 0, deuterium: 0 }, stock, rates, caps),
    ).toBeNull();
  });

  it('ignores a zero rate on a Resource that is not short', () => {
    const stock = { alloy: 0, crystal: 0, deuterium: 5 };
    expect(
      secondsUntilAffordable({ alloy: 60, crystal: 0, deuterium: 5 }, stock, rates, caps),
    ).toBe(60);
  });
});

describe('research time ([AG] baseTechnology.go)', () => {
  // [AG] energyTechnology_test: ConstructionTime(level, speed, Facilities{ResearchLab}).
  it.each([
    [5, 3, 7, 1645],
    [5, 3, 14, 822],
    [1, 0, 6, 480],
    [1, 10, 1, 261],
  ])(
    'Energy Theory %i at Lab %i, x%i takes %i s, as in alaingilbert/ogame',
    (level, lab, speed, expected) => {
      const def = technologyDef('energy-theory')!;
      const alloy = levelCost(def.baseCost.alloy, def.factor, level);
      const crystal = levelCost(def.baseCost.crystal, def.factor, level);
      expect(researchDurationSec(alloy, crystal, lab, speed)).toBe(expected);
    },
  );

  // researchTimeSec = floor((M+C) / (1000·(1+Lab)·S) h · 3600), at least 1 s.
  it('is (M+C) / (1000·(1+Lab)·S), to the second', () => {
    // Energy Theory L1 (0 / 800) at Lab 1: 800 / 2000 h = 0.4 h.
    expect(researchDurationSec(0, 800, 1, 1)).toBe(1440);
    // Photon Lasers L1 (200 / 100) at Lab 1: 300 / 2000 h = 0.15 h.
    expect(researchDurationSec(200, 100, 1, 1)).toBe(540);
    // Energy Theory L2 (0 / 1600) at Lab 1.
    expect(researchDurationSec(0, 1600, 1, 1)).toBe(2880);
    // Warp Drive L4 (80,000 / 160,000) at Lab 7: 240,000 / 8,000 h = 30 h.
    expect(researchDurationSec(80_000, 160_000, 7, 1)).toBe(108_000);
  });

  it('speeds up with the Research Lab and Universe Speed, not with Lab × Speed', () => {
    expect(researchDurationSec(0, 800, 3, 1)).toBe(720); // ÷(1+3)
    expect(researchDurationSec(0, 800, 1, 5)).toBe(288); // ÷5
    // The wiki's `1000·(1 + Lab·S)` typo would give 800/6000 h = 480 s here; the code sources give 288.
  });

  it('never returns less than one second (Graviton Lance costs no Resources)', () => {
    expect(researchDurationSec(0, 0, 12, 1)).toBe(1);
  });
});

describe('ship build time per unit ([AG] baseDefender.go)', () => {
  // [AG] smallCargo_test / solarSatellite_test: ConstructionTime(1, speed, Facilities{Shipyard,
  // Nanite}). The Hauler is OGame's Small Cargo.
  it.each([
    ['hauler', 4, 0, 7, 164],
    ['solar-satellite', 3, 0, 7, 102],
    ['solar-satellite', 1, 5, 7, 6],
    ['solar-satellite', 12, 6, 7, 1],
  ])(
    '%s at Shipyard %i, Nanite %i, x%i takes %i s, as in alaingilbert/ogame',
    (key, shipyard, nanite, speed, expected) => {
      const { alloy, crystal } = shipDef(key)!.cost;
      expect(shipUnitDurationSec(alloy, crystal, shipyard, nanite, speed)).toBe(expected);
    },
  );

  it('matches OGame per-unit times at x1', () => {
    // Formula. Light Fighter (3000 / 1000) at Shipyard 1: 4000 / 5000 h = 0.8 h = 48 min.
    expect(shipUnitDurationSec(3000, 1000, 1, 0)).toBe(2880);
    // Solar Satellite (0 / 2000) at Shipyard 1: 2000 / 5000 h = 0.4 h.
    expect(shipUnitDurationSec(0, 2000, 1, 0)).toBe(1440);
    // Cruiser (20,000 / 7,000) at Shipyard 5: 27,000 / 15,000 h = 1.8 h.
    expect(shipUnitDurationSec(20_000, 7000, 5, 0)).toBe(6480);
    // Battleship (45,000 / 15,000) at Shipyard 7: 60,000 / 20,000 h = 3 h.
    expect(shipUnitDurationSec(45_000, 15_000, 7, 0)).toBe(10_800);
    // Small Cargo (2000 / 2000) at Shipyard 2: 4000 / 7500 h = 1920 s.
    expect(shipUnitDurationSec(2000, 2000, 2, 0)).toBe(1920);
  });

  it('halves with each Nanite Foundry level and divides by Universe Speed', () => {
    expect(shipUnitDurationSec(3000, 1000, 1, 1)).toBe(1440);
    expect(shipUnitDurationSec(3000, 1000, 1, 2)).toBe(720);
    expect(shipUnitDurationSec(3000, 1000, 1, 0, 4)).toBe(720);
  });

  it('floors to whole seconds and never drops below 1 s', () => {
    // Espionage Probe (0 / 1000) at Shipyard 2: 1000 / 7500 h = 480 s.
    expect(shipUnitDurationSec(0, 1000, 2, 0)).toBe(480);
    // 1000 / (2500·13·2^5·8) h = 0.43 s → 1 s.
    expect(shipUnitDurationSec(0, 1000, 12, 5, 8)).toBe(1);
  });
});
