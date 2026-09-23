// The Planet snapshot: the payload every game route returns (spec #18, API). Server and web both
// import these types, so the wire shape can't drift between them.

export interface ResourceAmounts {
  alloy: number;
  crystal: number;
  deuterium: number;
}

/** One occupied Build Slot, or null in `buildSlots` for a free slot. */
export interface BuildSlotSnapshot {
  slot: number;
  structure: string;
  targetLevel: number;
  cost: ResourceAmounts;
  startedAt: number;
  endsAt: number;
}

/** One Research Queue entry; the times are null while it waits. */
export interface ResearchEntrySnapshot {
  id: number;
  technology: string;
  targetLevel: number;
  cost: ResourceAmounts;
  startedAt: number | null;
  endsAt: number | null;
  /** True when the head waits for a Research Lab upgrade to finish (queue rule 14). */
  waitingOnLab: boolean;
}

/** One Shipyard Order; the times are null while it waits behind another. */
export interface ShipyardOrderSnapshot {
  id: number;
  ship: string;
  quantity: number;
  completed: number;
  /** The total paid for the whole Order. */
  cost: ResourceAmounts;
  unitDurationMs: number | null;
  startedAt: number | null;
  nextUnitAt: number | null;
  endsAt: number | null;
}

/** The Planet's own facts: identity, place and size. */
export interface PlanetInfo {
  id: number;
  name: string;
  coordinates: { galaxy: number; system: number; position: number };
  /** `[g:s:p]`, formatted once on the server. */
  coordinatesLabel: string;
  tmin: number;
  tmax: number;
  fields: { used: number; inProgress: number; max: number };
  diameterKm: number;
}

// Resources are the exact stock at `lastUpdatedAt`; the client interpolates forward from there
// using `ratesPerHour`, capped at `storageCapacity`.
export interface PlanetSnapshot {
  serverNow: number;
  lastUpdatedAt: number;
  universeSpeed: number;
  planet: PlanetInfo;
  resources: ResourceAmounts;
  ratesPerHour: ResourceAmounts;
  storageCapacity: ResourceAmounts;
  energy: { produced: number; consumed: number; productionFactor: number };
  /** Every catalog Structure's current level (0 when not built). */
  structures: Record<string, number>;
  /** The two Build Slots, index 0 = slot 1; null for a free slot. */
  buildSlots: (BuildSlotSnapshot | null)[];
  /** Every catalog Technology's current level (0 when not researched). */
  technologies: Record<string, number>;
  /** The Research Queue in order, head first. */
  researchQueue: ResearchEntrySnapshot[];
  /** Every catalog ship's docked count (Solar Satellites included). */
  ships: Record<string, number>;
  /** The Shipyard Orders in order, head first. */
  shipyardOrders: ShipyardOrderSnapshot[];
  nextEventAt: number | null;
}

export interface Player {
  id: number;
  username: string;
}
