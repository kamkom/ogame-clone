// The catch-up engine (ADR 0001). `advance(state, now, speed)` is pure over an in-memory Player
// state: it walks the boundaries its event sources report (Build Slots, Research, Shipyard, Deuterium
// depletion) in time order and integrates each Resource in closed form between them, capped at
// Storage Capacity. It never reads the wall clock.

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
  productionFactor,
  researchDurationSec,
  shipUnitDurationSec,
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
  /** With the Nanite Foundry, fixes each Shipyard Order's per-unit time when it becomes head. */
  orbitalShipyard: number;
  naniteFoundry: number;
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
 * head (or, if the Research Lab is upgrading then, when the Lab finishes), from the Research Lab
 * level at that moment; waiting entries carry nulls. `field` is the
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

/**
 * One Shipyard Order. Orders run one after another; only the head builds. Its `startedAt` and
 * `unitDurationMs` are fixed when it becomes head, from the Orbital Shipyard and Nanite Foundry
 * levels at that moment, and unit k (1-based) finishes at `startedAt + k·unitDurationMs`.
 */
export interface ShipyardOrder {
  id: number;
  shipKey: string;
  /** Solar Satellites add Energy as each unit finishes; other ships don't touch the economy. */
  solarSatellite: boolean;
  quantity: number;
  completed: number;
  /** The unit's Alloy and Crystal, which set the per-unit time. */
  unitCost: { alloy: number; crystal: number };
  unitDurationMs: number | null;
  startedAt: number | null;
}

/** When the Order's next unit finishes, or null while it waits. */
export function orderNextUnitAt(order: ShipyardOrder): number | null {
  if (order.startedAt === null || order.unitDurationMs === null) return null;
  return order.startedAt + (order.completed + 1) * order.unitDurationMs;
}

/** When the Order's last unit finishes, or null while it waits. */
export function orderEndsAt(order: ShipyardOrder): number | null {
  if (order.startedAt === null || order.unitDurationMs === null) return null;
  return order.startedAt + order.quantity * order.unitDurationMs;
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
  /** The Planet's Shipyard Orders in order, head first. Absent or empty when none is placed. */
  shipyardOrders?: ShipyardOrder[];
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
  const deutIncomeFull = deuteriumSynthOutput(s.deuteriumSynth, state.tavg, {
    speed,
    plasma: state.plasmaTech,
    factor: f1,
  });
  const theta = fusionThrottle(deuteriumAvailable, deutIncomeFull, burnFull);
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

/** Whether a Research Lab upgrade is running in a Build Slot, which holds the Research head. */
export function labUpgrading(buildSlots: BuildSlot[] | undefined): boolean {
  return (buildSlots ?? []).some((bs) => bs.field === 'researchLab');
}

/**
 * A source of catch-up boundaries (ADR 0001). `advance` knows nothing about Build Slots, Research
 * or the Shipyard: it asks every source for its next boundary, integrates up to the soonest one,
 * then lets every source settle. A later source (fleet arrivals, say) plugs in the same way.
 */
export interface EventSource {
  /** The next integration boundary strictly after `from` (epoch ms), given the live profile, or null. */
  next(state: EconomyState, profile: ProductionProfile, from: number): number | null;
  /**
   * Apply what this source finished in `(state.lastUpdatedAt, t]` and start whatever now waits,
   * returning a new state. Also called once at the start of `advance` with `t = lastUpdatedAt`.
   */
  settle?(state: EconomyState, t: number, speed: number): EconomyState;
  /**
   * When the client should refetch for this source, if not at every `next` boundary (the Shipyard
   * reports every unit so docked counts rise one by one, though only some units split the integral).
   */
  refetchAt?(state: EconomyState, from: number): number | null;
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

/** Build Slots: a finished upgrade raises its level, so production is recomputed from its endsAt. */
export const buildSlotSource: EventSource = {
  next(state, _profile, from) {
    let soonest: number | null = null;
    for (const bs of state.buildSlots ?? []) {
      if (bs.endsAt > from && (soonest === null || bs.endsAt < soonest)) soonest = bs.endsAt;
    }
    return soonest;
  },
  settle(state, t) {
    let structures = state.structures;
    const remaining: BuildSlot[] = [];
    for (const bs of state.buildSlots ?? []) {
      if (bs.endsAt <= t + EPSILON) {
        if (bs.field !== null) structures = { ...structures, [bs.field]: bs.targetLevel };
      } else {
        remaining.push(bs);
      }
    }
    return { ...state, structures, buildSlots: remaining };
  },
};

/**
 * The Research Queue: the head's end is a boundary (a production Technology changes the rates from
 * then on). Settling finishes the head, then starts the next one with the Lab level as it now
 * stands, so it must run after the Build Slots (a Lab finishing at `t` already counts). While the
 * Lab upgrades the head keeps waiting and starts at the Lab's boundary (queue rule 14).
 */
export const researchSource: EventSource = {
  next(state, _profile, from) {
    const headEnd = state.researchQueue?.[0]?.endsAt ?? null;
    return headEnd !== null && headEnd > from ? headEnd : null;
  },
  settle(state, t, speed) {
    const queue = [...(state.researchQueue ?? [])];
    const techs = { energyTech: state.energyTech, plasmaTech: state.plasmaTech };
    const head = queue[0];
    if (head && head.endsAt !== null && head.endsAt <= t + EPSILON) {
      if (head.field !== null) techs[head.field] = head.targetLevel;
      queue.shift();
    }
    const next = queue[0];
    if (next && next.startedAt === null && !labUpgrading(state.buildSlots)) {
      const lab = state.structures.researchLab;
      const durationMs = researchDurationSec(next.cost.alloy, next.cost.crystal, lab, speed) * 1000;
      queue[0] = { ...next, startedAt: t, endsAt: t + durationMs };
    }
    return { ...state, ...techs, researchQueue: queue };
  },
};

/** Start the head Order at `at` if it is waiting, fixing its unit time from the current levels. */
function startOrder(
  orders: ShipyardOrder[],
  at: number,
  structures: Structures,
  speed: number,
): void {
  const head = orders[0];
  if (!head || head.startedAt !== null) return;
  const unitSec = shipUnitDurationSec(
    head.unitCost.alloy,
    head.unitCost.crystal,
    structures.orbitalShipyard,
    structures.naniteFoundry,
    speed,
  );
  orders[0] = { ...head, startedAt: at, unitDurationMs: unitSec * 1000 };
}

/**
 * The Shipyard. Each Solar Satellite unit changes Energy, so each is a boundary; other ships don't
 * affect production, so their units are counted exactly at whatever boundary comes next and only
 * the Order's end (where the next Order starts) splits the integral. The client still refetches at
 * every unit.
 */
export const shipyardSource: EventSource = {
  next(state) {
    const head = state.shipyardOrders?.[0];
    if (!head) return null;
    return head.solarSatellite ? orderNextUnitAt(head) : orderEndsAt(head);
  },
  refetchAt(state) {
    const head = state.shipyardOrders?.[0];
    return head ? orderNextUnitAt(head) : null;
  },
  // Count the head's units finished by `t`; when it is done, start the next Order at the moment
  // its last unit finished. A Solar Satellite adds Energy from its own boundary on.
  settle(state, t, speed) {
    const orders = [...(state.shipyardOrders ?? [])];
    startOrder(orders, t, state.structures, speed);
    let satellites = 0;
    for (let head = orders[0]; head?.startedAt != null && head.unitDurationMs != null;) {
      const done = Math.min(
        head.quantity,
        Math.floor((t - head.startedAt + EPSILON) / head.unitDurationMs),
      );
      if (head.solarSatellite) satellites += done - head.completed;
      if (done < head.quantity) {
        orders[0] = { ...head, completed: done };
        break;
      }
      const endsAt = orderEndsAt(head)!;
      orders.shift();
      startOrder(orders, endsAt, state.structures, speed);
      head = orders[0];
    }
    return {
      ...state,
      shipyardOrders: orders,
      solarSatellites: state.solarSatellites + satellites,
    };
  },
};

/**
 * The v1 sources, in settle order: Build Slots before Research (the Lab level at a boundary counts
 * for the next head) and before the Shipyard (so do the Shipyard levels for the next Order).
 */
export const V1_SOURCES: readonly EventSource[] = [
  buildSlotSource,
  researchSource,
  shipyardSource,
  deuteriumDepletion,
];

/**
 * Advance `state` to `now` in closed form. Returns a new state; the input is not mutated.
 * A `now` at or before `lastUpdatedAt` is a no-op — time only ever moves forward here.
 */
export function advance(
  state: EconomyState,
  now: number,
  speed: number,
  sources: readonly EventSource[] = V1_SOURCES,
): EconomyState {
  let t = state.lastUpdatedAt;
  let cursor = settleAll(state, sources, t, speed);

  while (t < now - EPSILON) {
    const profile = computeProfile(cursor, speed, deuteriumAvailable(cursor));

    let segEnd = now;
    for (const source of sources) {
      const boundary = source.next(cursor, profile, t);
      if (boundary !== null && boundary > t && boundary < segEnd) segEnd = boundary;
    }
    if (segEnd <= t) segEnd = now; // guard against a degenerate zero-length segment

    const dtHours = (segEnd - t) / MS_PER_HOUR;
    const { rates, storage } = profile;
    const r = cursor.resources;
    const resources = {
      alloy: accrue(r.alloy, rates.alloy, dtHours, storage.alloy),
      crystal: accrue(r.crystal, rates.crystal, dtHours, storage.crystal),
      deuterium: accrue(r.deuterium, rates.deuterium, dtHours, storage.deuterium),
    };
    cursor = settleAll({ ...cursor, resources }, sources, segEnd, speed);
    t = segEnd;
  }

  return { ...cursor, lastUpdatedAt: Math.max(now, state.lastUpdatedAt) };
}

/** Let every source settle at boundary `t`, in order; the state then stands at `t`. */
function settleAll(
  state: EconomyState,
  sources: readonly EventSource[],
  t: number,
  speed: number,
): EconomyState {
  let settled = state;
  for (const source of sources) settled = source.settle?.(settled, t, speed) ?? settled;
  return { ...settled, lastUpdatedAt: t };
}

/** The live profile at the current stock, for building a snapshot. */
export function liveProfile(state: EconomyState, speed: number): ProductionProfile {
  return computeProfile(state, speed, deuteriumAvailable(state));
}

/** When the client should next refetch (epoch ms, after `from`), or null when nothing is scheduled. */
export function nextEventAt(
  state: EconomyState,
  speed: number,
  from: number,
  sources: readonly EventSource[] = V1_SOURCES,
): number | null {
  const profile = liveProfile(state, speed);
  let soonest: number | null = null;
  for (const source of sources) {
    const boundary = source.refetchAt
      ? source.refetchAt(state, from)
      : source.next(state, profile, from);
    if (boundary !== null && boundary > from && (soonest === null || boundary < soonest)) {
      soonest = boundary;
    }
  }
  return soonest;
}
