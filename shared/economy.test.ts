import { describe, expect, it } from 'vitest';
import {
  alloyMineEnergyUse,
  alloyMineOutput,
  crystalMineOutput,
  deuteriumSynthEnergyUse,
  deuteriumSynthOutput,
  fusionDeuteriumBurn,
  fusionReactorEnergy,
  productionFactor,
  solarPlantEnergy,
  solarSatelliteEnergy,
  storageCapacity,
} from './economy.ts';

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

  it('Fusion burns Deuterium at 10·L·1.1^L·S', () => {
    expect(fusionDeuteriumBurn(4)).toBe(58);
    expect(fusionDeuteriumBurn(4, 5)).toBe(Math.floor(10 * 4 * 1.1 ** 4 * 5));
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
