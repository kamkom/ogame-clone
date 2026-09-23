// Pure production formulas, shared by the server engine and the web live counters.
//
// All rates are per hour. Sources are cited inline against the rules-reference doc
// (docs/research/ogame-rules-reference.md §6); [AG]/[WIKI]/[OGX] are the keys used there.
//
// Universe Speed (`speed`) scales production and Deuterium burn, but never Energy or
// Storage Capacity (rules reference §"Universe Speed rules").

/** Metal/Crystal production bonus by Planet position (rules reference §6.3). */
export const ALLOY_POSITION_BONUS: Record<number, number> = {
  6: 0.17,
  7: 0.23,
  8: 0.35,
  9: 0.23,
  10: 0.17,
};
export const CRYSTAL_POSITION_BONUS: Record<number, number> = {
  1: 0.4,
  2: 0.3,
  3: 0.2,
};

export interface MineParams {
  /** Universe Speed multiplier. */
  speed?: number;
  /** Plasma Technology level. */
  plasma?: number;
  /** Planet position 1–15, for the production bonus. */
  position?: number;
  /** Energy production factor (§6.2), 0–1. */
  factor?: number;
  /** Player production setting, 0–1. */
  pct?: number;
}

/** Alloy (Metal Mine) output per hour: `30·L·1.1^L·S·pct·f·(1+bonus)·(1+0.01·PT)`, floored. */
export function alloyMineOutput(level: number, p: MineParams = {}): number {
  const { speed = 1, plasma = 0, position = 0, factor = 1, pct = 1 } = p;
  const bonus = ALLOY_POSITION_BONUS[position] ?? 0;
  return Math.floor(
    30 * level * 1.1 ** level * speed * pct * factor * (1 + bonus) * (1 + 0.01 * plasma),
  );
}

/** Crystal (Crystal Mine) output per hour: `20·L·1.1^L·S·pct·f·(1+bonus)·(1+0.0066·PT)`, floored. */
export function crystalMineOutput(level: number, p: MineParams = {}): number {
  const { speed = 1, plasma = 0, position = 0, factor = 1, pct = 1 } = p;
  const bonus = CRYSTAL_POSITION_BONUS[position] ?? 0;
  return Math.floor(
    20 * level * 1.1 ** level * speed * pct * factor * (1 + bonus) * (1 + 0.0066 * plasma),
  );
}

/**
 * Deuterium Synthesizer output per hour:
 * `10·L·1.1^L·(1.36−0.004·Tavg)·S·pct·f·(1+0.0033·PT)`, floored. No position bonus.
 */
export function deuteriumSynthOutput(level: number, tavg: number, p: MineParams = {}): number {
  const { speed = 1, plasma = 0, factor = 1, pct = 1 } = p;
  const temp = 1.36 - 0.004 * tavg;
  return Math.floor(
    10 * level * 1.1 ** level * temp * speed * pct * factor * (1 + 0.0033 * plasma),
  );
}

/** Base income per hour, not affected by Energy or Plasma: Alloy `30·S`, Crystal `15·S`, Deut 0. */
export function baseIncome(speed = 1): { alloy: number; crystal: number; deuterium: number } {
  return { alloy: 30 * speed, crystal: 15 * speed, deuterium: 0 };
}

/** Alloy/Crystal mine Energy use per hour: `10·L·1.1^L·pct`, rounded **up**. */
export function alloyMineEnergyUse(level: number, pct = 1): number {
  return Math.ceil(10 * level * 1.1 ** level * pct);
}
export const crystalMineEnergyUse = alloyMineEnergyUse;

/** Deuterium Synthesizer Energy use per hour: `20·L·1.1^L·pct`, rounded **up**. */
export function deuteriumSynthEnergyUse(level: number, pct = 1): number {
  return Math.ceil(20 * level * 1.1 ** level * pct);
}

/** Solar Plant Energy: `20·L·1.1^L·pct`, floored. Not scaled by Universe Speed. */
export function solarPlantEnergy(level: number, pct = 1): number {
  return Math.floor(20 * level * 1.1 ** level * pct);
}

/** Fusion Reactor Energy: `30·L·(1.05+0.01·ET)^L·pct`, rounded. */
export function fusionReactorEnergy(level: number, energyTech: number, pct = 1): number {
  return Math.round(30 * level * (1.05 + 0.01 * energyTech) ** level * pct);
}

/** Fusion Reactor Deuterium burn per hour: `10·L·1.1^L·S·pct`, rounded up (rules reference §6.1). */
export function fusionDeuteriumBurn(level: number, speed = 1, pct = 1): number {
  return Math.ceil(10 * level * 1.1 ** level * speed * pct);
}

/** Solar Satellite Energy, each: `floor((Tavg+160)/6)`, × count × pct. Not scaled by Speed. */
export function solarSatelliteEnergy(count: number, tavg: number, pct = 1): number {
  return Math.floor((tavg + 160) / 6) * count * pct;
}

/**
 * Energy production factor `f` (§6.2): `min(1, floor(produced/consumed · 100)/100)`.
 * `f` scales mine output only. It is 1 when nothing consumes Energy, 0 when nothing produces it.
 */
export function productionFactor(produced: number, consumed: number): number {
  if (consumed === 0) return 1;
  if (produced === 0) return 0;
  return Math.min(1, Math.floor((produced / consumed) * 100) / 100);
}

/** Storage Capacity for one Resource: `5000·floor(2.5·e^(20·L/33))`. L0 = 10 000. Not scaled by Speed. */
export function storageCapacity(level: number): number {
  return 5000 * Math.floor(2.5 * Math.exp((20 * level) / 33));
}

/**
 * Cost of building `level` (1 for the first level): `floor(base·factor^(level−1))` (§2). Applied to
 * each Resource separately. Not scaled by Universe Speed.
 */
export function levelCost(base: number, factor: number, level: number): number {
  return Math.floor(base * factor ** (level - 1));
}

/**
 * The Energy produced that building or researching `level` needs: checked, not spent (§3, §4).
 * Terraformer 1000 and Graviton Lance 300,000 at level 1, scaled like a cost; 0 for the rest.
 */
export function energyRequiredAt(
  def: { energyRequired?: number; factor: number },
  level: number,
): number {
  return def.energyRequired ? levelCost(def.energyRequired, def.factor, level) : 0;
}

/**
 * Structure build time in seconds (§5). The early-level divisor `max(4 − L/2, 1)` speeds up the
 * first five levels and is skipped for the Nanite Foundry. Robotics Works and the Nanite Foundry
 * both shorten the time, and Universe Speed divides it. `alloyCost`/`crystalCost` are the (already
 * computed) cost of the level being built.
 */
export function structureDurationSec(
  alloyCost: number,
  crystalCost: number,
  targetLevel: number,
  robotics: number,
  nanite: number,
  speed = 1,
  isNaniteFoundry = false,
): number {
  const earlyDivisor = isNaniteFoundry ? 1 : Math.max(4 - targetLevel / 2, 1);
  const hours =
    (alloyCost + crystalCost) / (2500 * earlyDivisor * (1 + robotics) * 2 ** nanite * speed);
  return Math.max(1, Math.floor(hours * 3600));
}

/** A home Planet's Fields before the Terraformer bonus (spec: every Planet is 163 Fields). */
export const BASE_FIELDS = 163;

/** Max Fields: 163 plus the Terraformer bonus `5·L + floor(L/2)`. Not scaled by Universe Speed. */
export function maxFields(terraformerLevel: number): number {
  return BASE_FIELDS + 5 * terraformerLevel + Math.floor(terraformerLevel / 2);
}

export interface ResourceAmounts {
  alloy: number;
  crystal: number;
  deuterium: number;
}

/**
 * Seconds until `stock` covers `cost` at the current per-hour `rates`, rounded up; 0 when it
 * already does. Null ("never") when a short Resource has no positive rate or its Storage Capacity
 * is below the cost, since production stops at the cap.
 */
export function secondsUntilAffordable(
  cost: ResourceAmounts,
  stock: ResourceAmounts,
  ratesPerHour: ResourceAmounts,
  capacity: ResourceAmounts,
): number | null {
  let worst = 0;
  for (const key of ['alloy', 'crystal', 'deuterium'] as const) {
    const missing = cost[key] - stock[key];
    if (missing <= 0) continue;
    if (ratesPerHour[key] <= 0 || capacity[key] < cost[key]) return null;
    worst = Math.max(worst, Math.ceil((missing / ratesPerHour[key]) * 3600));
  }
  return worst;
}

/**
 * Research time in seconds (§5): `(M+C) / (1000·(1+Lab)·S)` hours. The Research Lab level is the
 * one at the moment the Research starts; Universe Speed divides it. `alloyCost`/`crystalCost` are
 * the cost of the level being researched.
 */
export function researchDurationSec(
  alloyCost: number,
  crystalCost: number,
  researchLab: number,
  speed = 1,
): number {
  const hours = (alloyCost + crystalCost) / (1000 * (1 + researchLab) * speed);
  return Math.max(1, Math.floor(hours * 3600));
}

/**
 * Ship build time per unit in seconds (§5): `(M+C) / (2500·(1+Shipyard)·2^Nanite·S)` hours. The
 * Orbital Shipyard and Nanite Foundry levels are the ones at the moment the Order becomes head;
 * an Order of n units finishes one unit every this many seconds.
 */
export function shipUnitDurationSec(
  alloyCost: number,
  crystalCost: number,
  shipyard: number,
  nanite: number,
  speed = 1,
): number {
  const hours = (alloyCost + crystalCost) / (2500 * (1 + shipyard) * 2 ** nanite * speed);
  return Math.max(1, Math.floor(hours * 3600));
}
