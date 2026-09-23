// A Structure's effect now and at the next level (spec story 38; the design's card line
// "+42.1k Alloy/h → +46.9k"). Every figure comes from the shared production formulas, so the
// screen can't disagree with what the server produces. Mine output is shown at full Energy, as
// OGame shows it; the live rates in the top bar carry the Production Factor.

import {
  alloyMineEnergyUse,
  alloyMineOutput,
  crystalMineEnergyUse,
  crystalMineOutput,
  deuteriumSynthEnergyUse,
  deuteriumSynthOutput,
  fusionDeuteriumBurn,
  fusionReactorEnergy,
  maxFields,
  type MineParams,
  solarPlantEnergy,
  storageCapacity,
} from '#shared/economy.ts';
import type { PlanetSnapshot } from './api.ts';
import { formatCompact } from './affordability.ts';
import { formatResource } from './format.ts';
import { averageTemperature } from './shipyard.ts';

export interface StructureEffect {
  label: string;
  /** At the current level. */
  current: string;
  /** At the level an upgrade would reach. */
  next: string;
}

/** The effect lines for `key`, headline first; empty for a key outside the catalog. */
export function structureEffects(
  key: string,
  planet: PlanetSnapshot,
  speed: number,
): StructureEffect[] {
  const level = planet.structures[key] ?? 0;
  const line = (label: string, at: (l: number) => string): StructureEffect => ({
    label,
    current: at(level),
    next: at(level + 1),
  });
  const plus = (n: number) => `+${formatCompact(n)}`;
  const cut = (divisor: number) => `−${Math.round((1 - 1 / divisor) * 100)}%`;
  const mine: MineParams = {
    speed,
    plasma: planet.technologies['plasma-containment'] ?? 0,
    position: planet.planet.coordinates.position,
  };

  switch (key) {
    case 'alloy-extractor':
      return [
        line('Alloy/h', (l) => plus(alloyMineOutput(l, mine))),
        line('Energy use', (l) => formatCompact(alloyMineEnergyUse(l))),
      ];
    case 'crystal-refinery':
      return [
        line('Crystal/h', (l) => plus(crystalMineOutput(l, mine))),
        line('Energy use', (l) => formatCompact(crystalMineEnergyUse(l))),
      ];
    case 'deuterium-synthesizer': {
      const tavg = averageTemperature(planet);
      return [
        line('Deuterium/h', (l) => plus(deuteriumSynthOutput(l, tavg, mine))),
        line('Energy use', (l) => formatCompact(deuteriumSynthEnergyUse(l))),
      ];
    }
    case 'solar-array':
      return [line('Energy', (l) => plus(solarPlantEnergy(l)))];
    case 'fusion-reactor': {
      const energyTech = planet.technologies['energy-theory'] ?? 0;
      return [
        line('Energy', (l) => plus(fusionReactorEnergy(l, energyTech))),
        line('Deuterium burn/h', (l) => formatCompact(fusionDeuteriumBurn(l, speed))),
      ];
    }
    case 'robotics-works':
      return [line('Structure build time', (l) => cut(1 + l))];
    case 'orbital-shipyard':
      return [line('Ship build time', (l) => cut(1 + l))];
    case 'research-lab':
      return [line('Research speed', (l) => `×${1 + l}`)];
    case 'nanite-foundry':
      return [line('Build and ship times', (l) => `÷${formatResource(2 ** l)}`)];
    case 'terraformer':
      return [line('Max Fields', (l) => formatResource(maxFields(l)))];
    case 'alloy-depot':
      return [line('Alloy capacity', (l) => formatResource(storageCapacity(l)))];
    case 'crystal-vault':
      return [line('Crystal capacity', (l) => formatResource(storageCapacity(l)))];
    case 'deuterium-tank':
      return [line('Deuterium capacity', (l) => formatResource(storageCapacity(l)))];
    default:
      return [];
  }
}
