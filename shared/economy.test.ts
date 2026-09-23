import { describe, expect, it } from 'vitest';
import {
  alloyMineEnergyUse,
  alloyMineOutput,
  crystalMineOutput,
  deuteriumSynthEnergyUse,
  deuteriumSynthOutput,
  fusionDeuteriumBurn,
  fusionReactorEnergy,
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
import { structureDef } from './catalog.ts';

// Golden values cite the rules-reference doc (docs/research/ogame-rules-reference.md) and the
// design-catalog-mapping doc. Where the doc gives only the formula, the expected integer is
// computed straight from it.

describe('mine output per hour', () => {
  it('Alloy matches OGame Metal Mine values at x1', () => {
    // design-catalog-mapping: "OGame's Metal Mine 18 gives 3,002/h at x1".
    expect(alloyMineOutput(18)).toBe(3002);
    expect(alloyMineOutput(1)).toBe(33); // 30·1.1
    expect(alloyMineOutput(0)).toBe(0);
  });

  it('Crystal uses the 20·L·1.1^L base (§6.1)', () => {
    expect(crystalMineOutput(16)).toBe(1470);
    expect(crystalMineOutput(1)).toBe(22);
  });

  it('scales with Universe Speed', () => {
    expect(alloyMineOutput(18, { speed: 5 })).toBe(Math.floor(30 * 18 * 1.1 ** 18 * 5));
  });

  it('applies the position bonus to mine output only (§6.3)', () => {
    // Position 8 → +35% Alloy.
    expect(alloyMineOutput(18, { position: 8 })).toBe(4053);
    // Position 1 → +40% Crystal.
    expect(crystalMineOutput(16, { position: 1 })).toBe(2058);
    // A position with no listed bonus leaves output unchanged.
    expect(alloyMineOutput(18, { position: 4 })).toBe(3002);
  });

  it('applies the Plasma bonus (§6.1)', () => {
    // +1% Alloy per Plasma level.
    expect(alloyMineOutput(18, { plasma: 10 })).toBe(Math.floor(3002 * 1.1));
  });

  it('scales Deuterium output by the temperature term 1.36−0.004·Tavg (§6.1)', () => {
    expect(deuteriumSynthOutput(12, 60)).toBe(421);
    // Colder is better: a lower Tavg gives more.
    expect(deuteriumSynthOutput(12, 0)).toBeGreaterThan(deuteriumSynthOutput(12, 60));
  });

  it('scales output by the Energy production factor', () => {
    expect(alloyMineOutput(18, { factor: 0.5 })).toBe(Math.floor(3002 * 0.5));
  });
});

describe('Energy produced', () => {
  it('Solar Plant matches OGame values, ignoring Universe Speed', () => {
    // design-catalog-mapping: "OGame L20 energy = 2,690".
    expect(solarPlantEnergy(20)).toBe(2690);
  });

  it('Fusion Reactor uses (1.05+0.01·ET)^L', () => {
    expect(fusionReactorEnergy(4, 0)).toBe(146);
    expect(fusionReactorEnergy(4, 3)).toBeGreaterThan(fusionReactorEnergy(4, 0));
  });

  // §6.1: "floor of the negative, so effectively ceil of the burn". Golden values from the
  // OGame wiki's Fusion Reactor table (levels 1–5 burn 11, 25, 40, 59, 81 Deuterium/h at x1).
  it('Fusion burns ceil(10·L·1.1^L·S) Deuterium', () => {
    expect([1, 2, 3, 4, 5].map((l) => fusionDeuteriumBurn(l))).toEqual([11, 25, 40, 59, 81]);
    expect(fusionDeuteriumBurn(4, 5)).toBe(293); // 58.564 × 5 = 292.82
  });

  it('Solar Satellite Energy is floor((Tavg+160)/6) each', () => {
    expect(solarSatelliteEnergy(1, 20)).toBe(30);
    expect(solarSatelliteEnergy(4, 20)).toBe(120);
  });
});

describe('mine Energy use (ceil)', () => {
  it('rounds up: Metal Mine 2 uses 25 (from 24.2) (§6.1)', () => {
    expect(alloyMineEnergyUse(2)).toBe(25);
  });

  it('Deuterium Synthesizer uses 20·L·1.1^L, ceiled', () => {
    expect(deuteriumSynthEnergyUse(1)).toBe(Math.ceil(20 * 1.1));
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

  it('is min(1, produced/consumed) floored to whole percent (§6.2)', () => {
    expect(productionFactor(50, 100)).toBe(0.5);
    expect(productionFactor(200, 100)).toBe(1);
    expect(productionFactor(999, 1000)).toBe(0.99); // 0.999 floored to 0.99
  });
});

describe('storage capacity', () => {
  it('matches the doc table (§6.4); L0 = 10 000', () => {
    expect(storageCapacity(0)).toBe(10000);
    expect(storageCapacity(1)).toBe(20000);
    expect(storageCapacity(2)).toBe(40000);
    expect(storageCapacity(3)).toBe(75000);
    expect(storageCapacity(4)).toBe(140000);
    expect(storageCapacity(5)).toBe(255000);
  });
});

describe('level cost (§2)', () => {
  it('is floor(base·factor^(L−1)) per Resource', () => {
    const ext = structureDef('alloy-extractor')!;
    // L1 is the base cost.
    expect(levelCost(ext.baseCost.alloy, ext.factor, 1)).toBe(60);
    expect(levelCost(ext.baseCost.crystal, ext.factor, 1)).toBe(15);
    // L2 scales by 1.5, floored.
    expect(levelCost(ext.baseCost.alloy, ext.factor, 2)).toBe(90);
    expect(levelCost(ext.baseCost.crystal, ext.factor, 2)).toBe(22);
    // design-catalog-mapping: Metal Mine L18 ≈ 59.1k Alloy.
    expect(levelCost(ext.baseCost.alloy, ext.factor, 18)).toBe(59115);
    expect(levelCost(ext.baseCost.crystal, ext.factor, 18)).toBe(14778);
  });

  it('matches the exact facility values cited in the mapping doc', () => {
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

describe('structure build time (§5)', () => {
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

describe('research time (§5)', () => {
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

describe('ship build time per unit (§5 shipTimeSec)', () => {
  it('matches OGame per-unit times at x1', () => {
    // Light Fighter (3000 / 1000) at Shipyard 1: 4000 / 5000 h = 0.8 h = 48 min (wiki Shipyard).
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
