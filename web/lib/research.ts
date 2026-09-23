// Research screen logic (spec stories 52–62, 64). Pure, so it can be unit-tested without a browser.
// Costs, durations and requirement checks come from the shared rules, so what the screen offers
// matches what the server accepts.

import { catalogName, type TechnologyDef } from '#shared/catalog.ts';
import { researchDurationSec, secondsUntilAffordable } from '#shared/economy.ts';
import {
  RESEARCH_QUEUE_MAX,
  type RequirementStatus,
  requirementStatus,
  researchTargetLevel,
  technologyCost,
  technologyEnergyRequired,
} from '#shared/research.ts';
import { affordableInLabel, type CostCheck, costChecks } from './affordability.ts';
import type { PlanetSnapshot, ResearchEntryView } from './api.ts';
import { formatResource } from './format.ts';
import type { LiveResources } from './liveResources.ts';

export interface TechView {
  def: TechnologyDef;
  level: number;
  /** The level a new queue entry would research (past any queued ones). */
  targetLevel: number;
  cost: { alloy: number; crystal: number; deuterium: number };
  /** At the current Lab level; the real duration is fixed when the entry starts. */
  durationSec: number;
  requirements: RequirementStatus[];
  unlocked: boolean;
  /** One ✓/✕ row per Resource the cost needs. */
  checks: CostCheck[];
  affordable: boolean;
  /** Seconds until the cost is covered at current production; null when it never will be. */
  affordableInSec: number | null;
  /** Energy capacity the next level needs, checked not spent (Graviton Lance); 0 for the rest. */
  energyRequired: number;
  energyMet: boolean;
  /** The queue head, when it is this Technology (running, or waiting on the Lab). */
  active: ResearchEntryView | null;
  /** Target levels of every queue entry for this Technology. */
  queuedLevels: number[];
}

function queueOf(planet: PlanetSnapshot) {
  return planet.researchQueue.map((e) => ({
    technology: e.technology,
    targetLevel: e.targetLevel,
  }));
}

export function techView(
  def: TechnologyDef,
  planet: PlanetSnapshot,
  speed: number,
  live: LiveResources,
): TechView {
  const queue = queueOf(planet);
  const level = planet.technologies[def.key] ?? 0;
  const targetLevel = researchTargetLevel(def.key, level, queue);
  const cost = technologyCost(def, targetLevel);
  const lab = planet.structures['research-lab'] ?? 0;
  const requirements = requirementStatus(
    def.requires,
    { structures: planet.structures, technologies: planet.technologies },
    queue,
  );
  const checks = costChecks(cost, live);
  const energyRequired = technologyEnergyRequired(def, targetLevel);
  const head = planet.researchQueue[0];
  return {
    def,
    level,
    targetLevel,
    cost,
    durationSec: researchDurationSec(cost.alloy, cost.crystal, lab, speed),
    requirements,
    unlocked: requirements.every((r) => r.met),
    checks,
    affordable: checks.every((c) => c.met),
    affordableInSec: secondsUntilAffordable(
      cost,
      live,
      planet.ratesPerHour,
      planet.storageCapacity,
    ),
    energyRequired,
    energyMet: planet.energy.produced >= energyRequired,
    active: head && head.technology === def.key ? head : null,
    queuedLevels: planet.researchQueue
      .filter((e) => e.technology === def.key)
      .map((e) => e.targetLevel),
  };
}

export type NodeTone = 'busy' | 'waiting' | 'queued' | 'locked' | 'idle';

/**
 * A lane node's status line (#14 pick A): "Researching → 9", "Waiting → 9" while the head waits on
 * the Lab, "Queued → 6, 7" for levels behind the head, "Locked" or "Level 3".
 */
export function nodeStatus(view: TechView): { text: string; tone: NodeTone } {
  const { active } = view;
  if (active?.waitingOnLab) return { text: `Waiting → ${active.targetLevel}`, tone: 'waiting' };
  if (active) return { text: `Researching → ${active.targetLevel}`, tone: 'busy' };
  if (view.queuedLevels.length > 0) {
    return { text: `Queued → ${view.queuedLevels.join(', ')}`, tone: 'queued' };
  }
  if (view.level === 0 && !view.unlocked) return { text: 'Locked', tone: 'locked' };
  return { text: `Level ${view.level}`, tone: 'idle' };
}

/** How far the running entry is, 0–1 (0 while it waits). */
export function researchProgress(entry: ResearchEntryView, now: number): number {
  if (entry.startedAt === null || entry.endsAt === null) return 0;
  const span = entry.endsAt - entry.startedAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - entry.startedAt) / span));
}

/** The header chip that opens the queue dropdown: "+ 4 queued · 5 of 5". */
export function queueToggleLabel(queue: ResearchEntryView[]): string {
  return `+ ${queue.length - 1} queued · ${queue.length} of ${RESEARCH_QUEUE_MAX}`;
}

/** The running Research Lab upgrade, if any. */
function labUpgrade(planet: PlanetSnapshot) {
  return planet.buildSlots.find((s) => s?.structure === 'research-lab') ?? null;
}

/** When a head waiting on the Lab starts: the Lab upgrade's endsAt. Null when nothing waits. */
export function waitingHeadStartsAt(planet: PlanetSnapshot): number | null {
  if (!planet.researchQueue[0]?.waitingOnLab) return null;
  return labUpgrade(planet)?.endsAt ?? null;
}

/**
 * An entry's duration at the Lab level it will start with: the new level while the Lab upgrades
 * (the waiting head starts only once it finishes), otherwise the current one.
 */
export function entryDurationSec(
  entry: ResearchEntryView,
  planet: PlanetSnapshot,
  speed: number,
): number {
  const lab = labUpgrade(planet)?.targetLevel ?? planet.structures['research-lab'] ?? 0;
  return researchDurationSec(entry.cost.alloy, entry.cost.crystal, lab, speed);
}

/**
 * When the Research Lab lock lifts: the running head's end plus every waiting entry after it, since
 * each starts at the previous one's boundary. The Lab can't change meanwhile, so the waiting
 * entries' durations are exact. Null when no Research is running.
 */
export function labLockEndsAt(planet: PlanetSnapshot, speed: number): number | null {
  const [head, ...rest] = planet.researchQueue;
  if (!head || head.endsAt === null) return null;
  return rest.reduce((t, e) => t + entryDurationSec(e, planet, speed) * 1000, head.endsAt);
}

export type QueueActionKind = 'full' | 'locked' | 'energy' | 'short' | 'ready';

/** The detail panel's button: which state it is in, what it says and whether it can be pressed. */
export function queueAction(
  planet: PlanetSnapshot,
  view: TechView,
): { kind: QueueActionKind; label: string; enabled: boolean } {
  const queue = planet.researchQueue;
  if (queue.length >= RESEARCH_QUEUE_MAX) {
    return {
      kind: 'full',
      label: `QUEUE FULL · ${queue.length} OF ${RESEARCH_QUEUE_MAX}`,
      enabled: false,
    };
  }
  if (!view.unlocked) return { kind: 'locked', label: 'LOCKED', enabled: false };
  if (!view.energyMet) {
    return {
      kind: 'energy',
      label: `NEEDS ${formatResource(view.energyRequired)} ENERGY`,
      enabled: false,
    };
  }
  if (!view.affordable) {
    return { kind: 'short', label: affordableInLabel(view.affordableInSec), enabled: false };
  }
  const last = queue[queue.length - 1];
  if (!last) return { kind: 'ready', label: 'START RESEARCH', enabled: true };
  return {
    kind: 'ready',
    label: `QUEUE AFTER ${catalogName(last.technology).toUpperCase()}`,
    enabled: true,
  };
}
