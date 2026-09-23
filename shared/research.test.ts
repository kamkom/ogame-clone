import { describe, expect, it } from 'vitest';
import { TECH_LANES, TECHNOLOGIES, technologyDef } from './catalog.ts';
import { requirementStatus, researchTargetLevel, technologyCost } from './research.ts';

// Golden values cite the rules-reference doc (docs/research/ogame-rules-reference.md §2, §4) and
// the design-catalog-mapping doc (Technologies, Gaps).

describe('Technology catalog', () => {
  it('has the 16 Technologies in the four design lanes of four', () => {
    expect(TECHNOLOGIES).toHaveLength(16);
    expect(TECH_LANES.map((l) => l.title)).toEqual([
      'ENERGY & PHYSICS',
      'PROPULSION',
      'MILITARY',
      'SCIENCE & EXPANSION',
    ]);
    for (const lane of TECH_LANES) {
      expect(TECHNOLOGIES.filter((t) => t.lane === lane.key)).toHaveLength(4);
    }
  });

  it('keeps Fold Drive (= Hyperspace Technology) in its Propulsion slot', () => {
    const fold = technologyDef('fold-drive')!;
    expect(fold.ogame).toBe('Hyperspace Technology');
    expect(fold.lane).toBe('propulsion');
    const propulsion = TECHNOLOGIES.filter((t) => t.lane === 'propulsion').map((t) => t.name);
    expect(propulsion).toEqual(['Combustion Drive', 'Impulse Drive', 'Warp Drive', 'Fold Drive']);
  });

  it("reads Warp Drive's requirement as Fold Drive 3", () => {
    expect(technologyDef('warp-drive')!.requires).toEqual([{ key: 'fold-drive', level: 3 }]);
  });

  it('uses the rules-reference direct requirements', () => {
    expect(technologyDef('energy-theory')!.requires).toEqual([{ key: 'research-lab', level: 1 }]);
    expect(technologyDef('fold-drive')!.requires).toEqual([
      { key: 'research-lab', level: 7 },
      { key: 'energy-theory', level: 5 },
      { key: 'shield-harmonics', level: 5 },
    ]);
    expect(technologyDef('plasma-containment')!.requires).toEqual([
      { key: 'energy-theory', level: 8 },
      { key: 'photon-lasers', level: 10 },
      { key: 'ion-lattice', level: 5 },
    ]);
  });

  it('only references catalog keys in requirements', () => {
    for (const t of TECHNOLOGIES) {
      for (const r of t.requires) {
        const known = technologyDef(r.key) !== undefined || r.key === 'research-lab';
        expect(known, `${t.key} requires ${r.key}`).toBe(true);
      }
    }
  });
});

describe('Technology cost (§2, §4)', () => {
  it('is floor(base·2^(L−1)) per Resource for the ×2 Technologies', () => {
    const energy = technologyDef('energy-theory')!; // 0 / 800 / 400
    expect(technologyCost(energy, 1)).toEqual({ alloy: 0, crystal: 800, deuterium: 400 });
    expect(technologyCost(energy, 2)).toEqual({ alloy: 0, crystal: 1600, deuterium: 800 });
    expect(technologyCost(energy, 12)).toEqual({
      alloy: 0,
      crystal: 1_638_400,
      deuterium: 819_200,
    });
    const plasma = technologyDef('plasma-containment')!; // 2000 / 4000 / 1000
    expect(technologyCost(plasma, 1)).toEqual({ alloy: 2000, crystal: 4000, deuterium: 1000 });
    // design-catalog-mapping: "OGame L4 = 80k M / 160k C / 48k D" for Hyperspace Drive.
    const warp = technologyDef('warp-drive')!;
    expect(technologyCost(warp, 4)).toEqual({ alloy: 80_000, crystal: 160_000, deuterium: 48_000 });
  });

  it('scales Astrophysics by 1.75 and rounds to the nearest 100', () => {
    const astro = technologyDef('astrophysics')!; // 4000 / 8000 / 4000
    expect(technologyCost(astro, 1)).toEqual({ alloy: 4000, crystal: 8000, deuterium: 4000 });
    expect(technologyCost(astro, 2)).toEqual({ alloy: 7000, crystal: 14_000, deuterium: 7000 });
    // 12,250 / 24,500 / 12,250 → nearest 100.
    expect(technologyCost(astro, 3)).toEqual({ alloy: 12_300, crystal: 24_500, deuterium: 12_300 });
  });

  it('charges Graviton Lance no Resources; it needs Energy capacity (×3 per level)', () => {
    const graviton = technologyDef('graviton-lance')!;
    expect(technologyCost(graviton, 1)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(graviton.energyRequired).toBe(300_000);
    expect(graviton.factor).toBe(3);
  });
});

describe('researchTargetLevel', () => {
  it('is the next level when nothing of that Technology is queued', () => {
    expect(researchTargetLevel('energy-theory', 3, [])).toBe(4);
  });

  it('follows queued entries of the same Technology with consecutive levels', () => {
    const queue = [
      { technology: 'energy-theory', targetLevel: 4 },
      { technology: 'photon-lasers', targetLevel: 1 },
      { technology: 'energy-theory', targetLevel: 5 },
    ];
    expect(researchTargetLevel('energy-theory', 3, queue)).toBe(6);
    expect(researchTargetLevel('photon-lasers', 0, queue)).toBe(2);
  });
});

describe('requirementStatus', () => {
  const levels = {
    structures: { 'research-lab': 1 },
    technologies: { 'energy-theory': 1 },
  };

  it('checks each requirement against current levels', () => {
    const status = requirementStatus(technologyDef('photon-lasers')!.requires, levels, []);
    expect(status).toEqual([
      { key: 'energy-theory', name: 'Energy Theory', have: 1, need: 2, met: false },
    ]);
  });

  it('lets an earlier queue entry satisfy a Technology requirement', () => {
    const queue = [{ technology: 'energy-theory', targetLevel: 2 }];
    const status = requirementStatus(technologyDef('photon-lasers')!.requires, levels, queue);
    expect(status[0]).toMatchObject({ have: 2, need: 2, met: true });
  });

  it('only counts a Structure requirement once it is built', () => {
    const noLab = { structures: {}, technologies: {} };
    const status = requirementStatus(technologyDef('energy-theory')!.requires, noLab, []);
    expect(status).toEqual([
      { key: 'research-lab', name: 'Research Lab', have: 0, need: 1, met: false },
    ]);
  });
});
