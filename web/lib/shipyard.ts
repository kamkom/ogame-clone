// Shipyard screen logic (spec stories 66–76). Pure, so it can be unit-tested without a browser.
// Costs, Max N, per-unit times and requirement checks come from the shared rules, so what the
// screen offers matches what the server accepts.

import { SHIPS, type ShipDef, shipDef } from '#shared/catalog.ts';
import {
  type ResourceAmounts,
  secondsUntilAffordable,
  shipUnitDurationSec,
  solarSatelliteEnergy,
} from '#shared/economy.ts';
import type { RequirementStatus } from '#shared/research.ts';
import {
  maxAffordableUnits,
  orderCost,
  SHIP_ORDER_MAX_UNITS,
  SHIPYARD_LOCK_STRUCTURES,
  SHIPYARD_ORDERS_MAX,
  shipRequirementStatus,
} from '#shared/shipyard.ts';
import { affordableInLabel, formatAffordableIn } from './affordability.ts';
import type { BuildSlotView, PlanetSnapshot, ShipyardOrderView } from './api.ts';
import { formatCountdown } from './duration.ts';
import type { LiveResources } from './liveResources.ts';

export interface ShipView {
  def: ShipDef;
  /** Units docked on the Planet. */
  count: number;
  requirements: RequirementStatus[];
  unlocked: boolean;
  /** The largest quantity the live stock pays for (capped at 99,999). */
  maxN: number;
  /** Per unit at the current levels; the real time is fixed when the Order becomes head. */
  unitSec: number;
}

/** The per-unit time of `def` at the Planet's current Orbital Shipyard and Nanite Foundry. */
function unitSecNow(def: ShipDef, planet: PlanetSnapshot, speed: number): number {
  return shipUnitDurationSec(
    def.cost.alloy,
    def.cost.crystal,
    planet.structures['orbital-shipyard'] ?? 0,
    planet.structures['nanite-foundry'] ?? 0,
    speed,
  );
}

export function shipView(
  def: ShipDef,
  planet: PlanetSnapshot,
  speed: number,
  live: LiveResources,
): ShipView {
  const requirements = shipRequirementStatus(def, {
    structures: planet.structures,
    technologies: planet.technologies,
  });
  return {
    def,
    count: planet.ships[def.key] ?? 0,
    requirements,
    unlocked: requirements.every((r) => r.met),
    maxN: maxAffordableUnits(def.cost, live),
    unitSec: unitSecNow(def, planet, speed),
  };
}

/** The quantity field's value as a whole number of units within 1–99,999. */
export function clampQuantity(input: string): number {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, SHIP_ORDER_MAX_UNITS);
}

/** The order button, e.g. "BUILD 10 CRUISERS". */
export function buildLabel(def: ShipDef, quantity: number): string {
  const name = def.name.toUpperCase();
  return `BUILD ${quantity} ${quantity === 1 ? name : `${name}S`}`;
}

/** How long until `stock` pays for `quantity` × `def` at current production; null when never. */
function affordableInSec(
  def: ShipDef,
  quantity: number,
  planet: PlanetSnapshot,
  stock: ResourceAmounts,
): number | null {
  return secondsUntilAffordable(
    orderCost(def, quantity),
    stock,
    planet.ratesPerHour,
    planet.storageCapacity,
  );
}

/** "Max 14", or at Max 0 when one unit will be affordable: "Max 0 · 1 in 8m" (#14 pick B+C). */
export function maxLabel(view: ShipView, planet: PlanetSnapshot, stock: ResourceAmounts): string {
  const max = `Max ${view.maxN.toLocaleString('en-US')}`;
  if (view.maxN > 0) return max;
  const sec = affordableInSec(view.def, 1, planet, stock);
  return sec === null ? max : `${max} · 1 in ${formatAffordableIn(sec)}`;
}

/**
 * The Orbital Shipyard or Nanite Foundry upgrade holding new Orders back (spec story 73); when both
 * upgrade, the one that ends last. Null when neither is upgrading.
 */
export function shipyardUpgrade(planet: PlanetSnapshot): BuildSlotView | null {
  let last: BuildSlotView | null = null;
  for (const s of planet.buildSlots) {
    if (s && SHIPYARD_LOCK_STRUCTURES.includes(s.structure) && (!last || s.endsAt > last.endsAt)) {
      last = s;
    }
  }
  return last;
}

/**
 * When every Shipyard Order has finished, so the Orbital Shipyard and Nanite Foundry may upgrade
 * again (spec story 49). Waiting Orders run at the current levels, which can't change while Orders
 * exist, so the time is exact. Null with no Orders.
 */
export function ordersEndAt(planet: PlanetSnapshot, speed: number): number | null {
  const [head, ...rest] = planet.shipyardOrders;
  if (!head || head.endsAt === null) return null;
  return rest.reduce((t, o) => t + waitingOrderSec(o, planet, speed) * 1000, head.endsAt);
}

export type OrderActionKind = 'upgrading' | 'full' | 'locked' | 'short' | 'ready';

/** The detail panel's button: which state it is in, what it says and whether it can be pressed. */
export function orderAction(
  planet: PlanetSnapshot,
  view: ShipView,
  quantity: number,
  stock: ResourceAmounts,
  now: number,
): { kind: OrderActionKind; label: string; enabled: boolean } {
  const upgrade = shipyardUpgrade(planet);
  if (upgrade) {
    const label = `ORDERS OPEN IN ${formatCountdown(upgrade.endsAt - now)}`;
    return { kind: 'upgrading', label, enabled: false };
  }
  const orders = planet.shipyardOrders.length;
  if (orders >= SHIPYARD_ORDERS_MAX) {
    const label = `QUEUE FULL · ${orders} OF ${SHIPYARD_ORDERS_MAX}`;
    return { kind: 'full', label, enabled: false };
  }
  if (!view.unlocked) return { kind: 'locked', label: 'LOCKED', enabled: false };
  if (quantity > view.maxN) {
    const label = affordableInLabel(affordableInSec(view.def, quantity, planet, stock));
    return { kind: 'short', label, enabled: false };
  }
  return { kind: 'ready', label: buildLabel(view.def, quantity), enabled: true };
}

export interface OrderProgress {
  /** Units finished by `now`, interpolated between fetches. */
  completed: number;
  /** Until the next unit rolls out; null while the Order waits. */
  nextUnitInMs: number | null;
  /** How far the whole Order is, 0–1. */
  fraction: number;
}

/** A running Order's live progress at `now`. */
export function orderProgress(order: ShipyardOrderView, now: number): OrderProgress {
  const { startedAt, unitDurationMs: unit, quantity } = order;
  if (startedAt === null || unit === null) {
    return { completed: order.completed, nextUnitInMs: null, fraction: 0 };
  }
  const elapsed = Math.max(0, now - startedAt);
  const completed = Math.max(order.completed, Math.min(quantity, Math.floor(elapsed / unit)));
  const nextUnitInMs = completed >= quantity ? 0 : startedAt + (completed + 1) * unit - now;
  return { completed, nextUnitInMs, fraction: Math.min(1, elapsed / (unit * quantity)) };
}

/** A waiting Order's whole build time in seconds at the Planet's current levels. */
export function waitingOrderSec(
  order: ShipyardOrderView,
  planet: PlanetSnapshot,
  speed: number,
): number {
  const def = shipDef(order.ship);
  return def ? order.quantity * unitSecNow(def, planet, speed) : 0;
}

export interface FleetStrength {
  total: number;
  combat: number;
  cargo: number;
  support: number;
}

/** Docked ships by the design's Combat / Cargo / Support split; Solar Satellites don't count. */
export function fleetStrength(ships: Record<string, number>): FleetStrength {
  const out: FleetStrength = { total: 0, combat: 0, cargo: 0, support: 0 };
  for (const def of SHIPS) {
    if (def.shipClass === 'energy') continue;
    const n = ships[def.key] ?? 0;
    out[def.shipClass] += n;
    out.total += n;
  }
  return out;
}

/** The Production Queue header, e.g. "2 ORDERS". */
export function ordersLabel(count: number): string {
  return `${count} ${count === 1 ? 'ORDER' : 'ORDERS'}`;
}

/** The Planet's average temperature: `Tavg = Tmax − 20` on every OGame Planet (§6.1). */
export function averageTemperature(planet: PlanetSnapshot): number {
  return planet.temperature.max - 20;
}

/** Energy each Solar Satellite gives at this Planet's temperature. */
export function satelliteEnergyEach(planet: PlanetSnapshot): number {
  return solarSatelliteEnergy(1, averageTemperature(planet));
}
