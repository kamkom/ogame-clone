// The catch-up engine (ADR 0001). `advance(state, now, speed)` is pure over an in-memory Player
// state: it walks event boundaries in time order and integrates each Resource in closed form
// between them, capped at Storage Capacity. It never reads the wall clock.

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
  productionFactor,
  researchDurationSec,
  solarPlantEnergy,
  solarSatelliteEnergy,
  storageCapacity,
} from './economy.ts';

export interface Resources {
  alloy: number;
  crystal: number;
  deuterium: number;
}

export interface Structures {
  alloyMine: number;
  crystalMine: number;
  deuteriumSynth: number;
  solarPlant: number;
  fusionReactor: number;
  alloyStorage: number;
  crystalStorage: number;
  deuteriumStorage: number;
  /** Not a production Structure, but its level fixes each Research duration when it starts. */
  researchLab: number;
}

/**
 * An upgrade running in a Build Slot. `field` is the production Structure it raises (or null for a
 * Structure that doesn't affect the economy, e.g. Robotics Works); `slot` and `structureKey` are
 * carried through for the caller's bookkeeping and ignored by the integrator.
 */
export interface BuildSlot {
  slot: number;
  structureKey: string;
  field: keyof Structures | null;
  targetLevel: number;
  /** Epoch-ms the upgrade finishes and the level takes effect. */
  endsAt: number;
}

/** The Technologies that change production (rules reference §6.1); the rest have no economy effect. */
export type TechField = 'energyTech' | 'plasmaTech';

/**
 * One Research Queue entry. Only the head runs: its `startedAt`/`endsAt` are fixed when it becomes
 * head, from the Research Lab level at that moment; waiting entries carry nulls. `field` is the
 * production Technology it raises, or null for one with no economy effect.
 */
export interface ResearchEntry {
  id: number;
  technologyKey: string;
  field: TechField | null;
  targetLevel: number;
  /** The Alloy and Crystal paid at enqueue, which set the duration. */
  cost: { alloy: number; crystal: number };
  startedAt: number | null;
  endsAt: number | null;
}

export interface EconomyState {
  /** Current Resource stock (fractional; only floored for display and spending). */
  resources: Resources;
  /** Epoch-ms of the last catch-up. */
  lastUpdatedAt: number;
  structures: Structures;
  solarSatellites: number;
  energyTech: number;
  plasmaTech: number;
  position: number;
  /** Average temperature, `round((Tmin+Tmax)/2)` = `Tmax − 20`. */
  tavg: number;
  /** Upgrades running in the 2 Build Slots. Absent or empty when nothing is building. */
  buildSlots?: BuildSlot[];
  /** The Player's Research Queue in order, head first. Absent or empty when nothing is queued. */
  researchQueue?: ResearchEntry[];
}

/** The instantaneous production picture used to integrate one boundary-free segment. */
export interface ProductionProfile {
  /** Net per-hour rate per Resource (base income + mine output, minus Fusion burn). */
  rates: Resources;
  /** Storage Capacity per Resource. */
  storage: Resources;
  energy: { produced: number; consumed: number; productionFactor: number };
}

const MS_PER_HOUR = 3_600_000;
const EPSILON = 1e-9;

/**
 * Compute the production profile. When Deuterium is depleted, the Fusion Reactor is throttled to
 * the fraction its incoming Deuterium can fuel, so net Deuterium holds at 0 with no toggling.
 */
export function computeProfile(
  state: EconomyState,
  speed: number,
  deuteriumAvailable: boolean,
): ProductionProfile {
  const s = state.structures;
  const consumed =
    alloyMineEnergyUse(s.alloyMine) +
    crystalMineEnergyUse(s.crystalMine) +
    deuteriumSynthEnergyUse(s.deuteriumSynth);
  const solar =
    solarPlantEnergy(s.solarPlant) + solarSatelliteEnergy(state.solarSatellites, state.tavg);
  const fusionFull = fusionReactorEnergy(s.fusionReactor, state.energyTech);
  const burnFull = fusionDeuteriumBurn(s.fusionReactor, speed);

  // Resolve the Fusion throttle / production-factor coupling in a single pass: assume full Fusion,
  // derive the Deuterium it could be fed, then re-derive the factor at that throttle.
  const f1 = productionFactor(solar + fusionFull, consumed);
  let theta = 1;
  if (!deuteriumAvailable && burnFull > 0) {
    const deutProdFull = deuteriumSynthOutput(s.deuteriumSynth, state.tavg, {
      speed,
      plasma: state.plasmaTech,
      factor: f1,
    });
    theta = Math.min(1, deutProdFull / burnFull);
  }
  const produced = solar + fusionFull * theta;
  const factor = productionFactor(produced, consumed);

  const mine = { speed, plasma: state.plasmaTech, position: state.position, factor };
  const base = baseIncome(speed);
  const deutBurn = burnFull * theta;

  return {
    rates: {
      alloy: base.alloy + alloyMineOutput(s.alloyMine, mine),
      crystal: base.crystal + crystalMineOutput(s.crystalMine, mine),
      deuterium:
        deuteriumSynthOutput(s.deuteriumSynth, state.tavg, {
          speed,
          plasma: state.plasmaTech,
          factor,
        }) - deutBurn,
    },
    storage: {
      alloy: storageCapacity(s.alloyStorage),
      crystal: storageCapacity(s.crystalStorage),
      deuterium: storageCapacity(s.deuteriumStorage),
    },
    energy: { produced, consumed, productionFactor: factor },
  };
}

/**
 * A source of catch-up boundaries. The only built-in source is Deuterium depletion; fleet
 * arrivals and the like can be added later without changing the integrator (ADR 0001).
 */
export interface EventSource {
  /** The next boundary strictly after `from` (epoch ms), given the live profile, or null. */
  next(state: EconomyState, profile: ProductionProfile, from: number): number | null;
}

/** The moment the Deuterium stock would reach 0 while it is draining. */
export const deuteriumDepletion: EventSource = {
  next(state, profile, from) {
    const rate = profile.rates.deuterium;
    const stock = state.resources.deuterium;
    if (rate >= 0 || stock <= 0) return null;
    return from + (stock / -rate) * MS_PER_HOUR;
  },
};

/** Accrue one Resource over `dtHours` at `rate`, honouring the Storage Capacity rule (§6.4). */
function accrue(stock: number, rate: number, dtHours: number, cap: number): number {
  if (rate < 0) return Math.max(0, stock + rate * dtHours);
  if (stock >= cap) return stock; // already at/over the cap: kept, but does not grow
  return Math.min(cap, stock + rate * dtHours);
}

/** Whether the profile should be computed in the Deuterium-available mode at this stock. */
function deuteriumAvailable(state: EconomyState): boolean {
  return state.resources.deuterium > EPSILON;
}

/** Start the head of `queue` at `at` if it is waiting, fixing its duration from `lab`. */
function startHead(queue: ResearchEntry[], at: number, lab: number, speed: number): void {
  const head = queue[0];
  if (!head || head.startedAt !== null) return;
  const durationMs = researchDurationSec(head.cost.alloy, head.cost.crystal, lab, speed) * 1000;
  queue[0] = { ...head, startedAt: at, endsAt: at + durationMs };
}

/**
 * Advance `state` to `now` in closed form. Returns a new state; the input is not mutated.
 * A `now` at or before `lastUpdatedAt` is a no-op — time only ever moves forward here.
 */
export function advance(
  state: EconomyState,
  now: number,
  speed: number,
  sources: EventSource[] = [deuteriumDepletion],
): EconomyState {
  const resources = { ...state.resources };
  let structures = { ...state.structures };
  let buildSlots = (state.buildSlots ?? []).map((s) => ({ ...s }));
  const researchQueue = (state.researchQueue ?? []).map((e) => ({ ...e }));
  const techs = { energyTech: state.energyTech, plasmaTech: state.plasmaTech };
  let t = state.lastUpdatedAt;
  startHead(researchQueue, t, structures.researchLab, speed);

  while (t < now - EPSILON) {
    const cursor: EconomyState = { ...state, ...techs, resources, structures, buildSlots };
    const profile = computeProfile(cursor, speed, deuteriumAvailable(cursor));

    let segEnd = now;
    for (const source of sources) {
      const boundary = source.next(cursor, profile, t);
      if (boundary !== null && boundary > t && boundary < segEnd) segEnd = boundary;
    }
    // A finished upgrade is a boundary: production is recomputed from its endsAt on (§Build Slots).
    for (const bs of buildSlots) {
      if (bs.endsAt > t && bs.endsAt < segEnd) segEnd = bs.endsAt;
    }
    // So is the running Research: a production Technology changes the rates from its endsAt on.
    const headEnd = researchQueue[0]?.endsAt ?? null;
    if (headEnd !== null && headEnd > t && headEnd < segEnd) segEnd = headEnd;
    if (segEnd <= t) segEnd = now; // guard against a degenerate zero-length segment

    const dtHours = (segEnd - t) / MS_PER_HOUR;
    resources.alloy = accrue(resources.alloy, profile.rates.alloy, dtHours, profile.storage.alloy);
    resources.crystal = accrue(
      resources.crystal,
      profile.rates.crystal,
      dtHours,
      profile.storage.crystal,
    );
    resources.deuterium = accrue(
      resources.deuterium,
      profile.rates.deuterium,
      dtHours,
      profile.storage.deuterium,
    );
    t = segEnd;

    // Apply any upgrades that finish exactly at `t`: raise the level and free the slot.
    const remaining: BuildSlot[] = [];
    for (const bs of buildSlots) {
      if (bs.endsAt <= t + EPSILON) {
        if (bs.field !== null) structures = { ...structures, [bs.field]: bs.targetLevel };
      } else {
        remaining.push(bs);
      }
    }
    buildSlots = remaining;

    // Then finish the Research head if it ends at `t`, and start the next one at this boundary
    // with the Lab level as it now stands (a Lab finishing at `t` already counts).
    const head = researchQueue[0];
    if (head && head.endsAt !== null && head.endsAt <= t + EPSILON) {
      if (head.field !== null) techs[head.field] = head.targetLevel;
      researchQueue.shift();
      startHead(researchQueue, t, structures.researchLab, speed);
    }
  }

  return {
    ...state,
    ...techs,
    resources,
    structures,
    buildSlots,
    researchQueue,
    lastUpdatedAt: Math.max(now, state.lastUpdatedAt),
  };
}

/** The live profile at the current stock, for building a snapshot. */
export function liveProfile(state: EconomyState, speed: number): ProductionProfile {
  return computeProfile(state, speed, deuteriumAvailable(state));
}

/** The next boundary (epoch ms) at or after `from`, or null when nothing is scheduled. */
export function nextEventAt(
  state: EconomyState,
  speed: number,
  from: number,
  sources: EventSource[] = [deuteriumDepletion],
): number | null {
  const profile = liveProfile(state, speed);
  let soonest: number | null = null;
  for (const source of sources) {
    const boundary = source.next(state, profile, from);
    if (boundary !== null && (soonest === null || boundary < soonest)) soonest = boundary;
  }
  // A finishing upgrade is a boundary too, so the client refetches when a Build Slot frees.
  for (const bs of state.buildSlots ?? []) {
    if (bs.endsAt > from && (soonest === null || bs.endsAt < soonest)) soonest = bs.endsAt;
  }
  // And so is the running Research, so the client refetches when it finishes.
  const headEnd = state.researchQueue?.[0]?.endsAt ?? null;
  if (headEnd !== null && headEnd > from && (soonest === null || headEnd < soonest)) {
    soonest = headEnd;
  }
  return soonest;
}
