// Structure upgrade states (#14 picks), shared by the Structures screen and the Command Deck list.
// Pure, so it can be unit-tested without a browser; 409s from the server only catch races.

import {
  type RequirementStatus,
  requirementStatus,
  STRUCTURES,
  type StructureDef,
} from '#shared/catalog.ts';
import { levelCost, secondsUntilAffordable, structureDurationSec } from '#shared/economy.ts';
import type { BuildSlotView, PlanetSnapshot } from './api.ts';
import { type CostCheck, costChecks, shortLabel } from './affordability.ts';
import { formatCountdown } from './duration.ts';
import type { LiveResources } from './liveResources.ts';
import { labLockEndsAt } from './research.ts';

/**
 * Why a Structure can or can't start an upgrade right now, in the order the UI explains it (#14
 * picks): already building, requirements not met (B), the Research Lab while Research runs (C),
 * both Build Slots busy (C), no free Field, can't afford (B+C), or ready.
 */
export type UpgradeState =
  'building' | 'locked' | 'research_active' | 'slots_full' | 'fields_full' | 'short' | 'ready';

export interface StructureView {
  def: StructureDef;
  level: number;
  targetLevel: number;
  cost: { alloy: number; crystal: number; deuterium: number };
  durationSec: number;
  slot: BuildSlotView | null;
  requirements: RequirementStatus[];
  checks: CostCheck[];
  /** Seconds until the cost is covered at current production; null when it never will be. */
  affordableInSec: number | null;
  state: UpgradeState;
  /** For the Research Lab under the Research lock: when the lock lifts. */
  lockEndsAt: number | null;
}

function viewFor(
  def: StructureDef,
  planet: PlanetSnapshot,
  speed: number,
  live: LiveResources,
  labLock: number | null,
): StructureView {
  const level = planet.structures[def.key] ?? 0;
  const targetLevel = level + 1;
  const cost = {
    alloy: levelCost(def.baseCost.alloy, def.factor, targetLevel),
    crystal: levelCost(def.baseCost.crystal, def.factor, targetLevel),
    deuterium: levelCost(def.baseCost.deuterium, def.factor, targetLevel),
  };
  const robotics = planet.structures['robotics-works'] ?? 0;
  const nanite = planet.structures['nanite-foundry'] ?? 0;
  const durationSec = structureDurationSec(
    cost.alloy,
    cost.crystal,
    targetLevel,
    robotics,
    nanite,
    speed,
    def.isNaniteFoundry ?? false,
  );
  const slot = planet.buildSlots.find((s) => s?.structure === def.key) ?? null;
  // Current (finished) levels only: a level still in a Build Slot doesn't count.
  const requirements = requirementStatus(
    def,
    (k) => planet.structures[k] ?? planet.technologies[k] ?? 0,
  );
  const checks = costChecks(cost, live);
  const affordableInSec = secondsUntilAffordable(
    cost,
    live,
    planet.ratesPerHour,
    planet.storageCapacity,
  );
  const slotsFull = planet.buildSlots.every((s) => s !== null);
  const { used, inProgress, max } = planet.fields;

  let state: UpgradeState = 'ready';
  if (slot) state = 'building';
  else if (requirements.some((r) => !r.met)) state = 'locked';
  else if (def.key === 'research-lab' && labLock !== null) state = 'research_active';
  else if (slotsFull) state = 'slots_full';
  else if (used + inProgress >= max) state = 'fields_full';
  else if (checks.some((c) => !c.met)) state = 'short';

  return {
    def,
    level,
    targetLevel,
    cost,
    durationSec,
    slot,
    requirements,
    checks,
    affordableInSec,
    state,
    lockEndsAt: state === 'research_active' ? labLock : null,
  };
}

/** Every catalog Structure's view, in design order. */
export function structureViews(
  planet: PlanetSnapshot,
  speed: number,
  live: LiveResources,
): StructureView[] {
  const labLock = labLockEndsAt(planet, speed);
  return STRUCTURES.map((def) => viewFor(def, planet, speed, live, labLock));
}

/** The busy Build Slot that frees first, or null while a slot is still free. */
export function firstFreeSlot(planet: PlanetSnapshot): BuildSlotView | null {
  const busy = planet.buildSlots.filter((s): s is BuildSlotView => s !== null);
  if (busy.length < planet.buildSlots.length) return null;
  return busy.reduce((a, b) => (b.endsAt < a.endsAt ? b : a), busy[0]!);
}

export interface StructureAction {
  enabled: boolean;
  /** BUILD / UPGRADE when enabled; otherwise the reason or a countdown. */
  label: string;
  icon: 'lock' | 'clock' | null;
}

/** A small list/card button for a Structure: BUILD or UPGRADE, or disabled with its reason. */
export function structureAction(
  view: StructureView,
  now: number,
  nextFreeAt: number | null,
): StructureAction {
  const clock = (at: number): StructureAction => ({
    enabled: false,
    label: formatCountdown(at - now),
    icon: 'clock',
  });
  const lock = (label: string): StructureAction => ({ enabled: false, label, icon: 'lock' });
  switch (view.state) {
    case 'ready':
      return { enabled: true, label: view.level === 0 ? 'BUILD' : 'UPGRADE', icon: null };
    case 'building':
      return clock(view.slot!.endsAt);
    case 'locked':
      return lock('LOCKED');
    case 'research_active':
      return clock(view.lockEndsAt ?? now);
    case 'slots_full':
      return nextFreeAt === null
        ? { enabled: false, label: 'SLOTS FULL', icon: 'clock' }
        : clock(nextFreeAt);
    case 'fields_full':
      return lock('NO FIELDS');
    case 'short':
      return lock(shortLabel(view.checks));
  }
}
