// Research screen logic (spec stories 52–57, 64). Pure, so it can be unit-tested without a browser.
// Costs, durations and requirement checks come from the shared rules, so what the screen offers
// matches what the server accepts.

import { catalogName, type TechnologyDef } from '#shared/catalog.ts';
import { researchDurationSec } from '#shared/economy.ts';
import {
  RESEARCH_QUEUE_MAX,
  type RequirementStatus,
  requirementStatus,
  researchTargetLevel,
  technologyCost,
} from '#shared/research.ts';
import type { PlanetSnapshot, ResearchEntryView } from './api.ts';
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
  affordable: boolean;
  /** The running queue entry, when it is this Technology. */
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
  const head = planet.researchQueue[0];
  return {
    def,
    level,
    targetLevel,
    cost,
    durationSec: researchDurationSec(cost.alloy, cost.crystal, lab, speed),
    requirements,
    unlocked: requirements.every((r) => r.met),
    affordable:
      Math.floor(live.alloy) >= cost.alloy &&
      Math.floor(live.crystal) >= cost.crystal &&
      Math.floor(live.deuterium) >= cost.deuterium,
    active: head && head.technology === def.key ? head : null,
    queuedLevels: planet.researchQueue
      .filter((e) => e.technology === def.key)
      .map((e) => e.targetLevel),
  };
}

export type NodeTone = 'busy' | 'locked' | 'idle';

/** A lane node's status line, as in the design: "Researching → 9", "Locked" or "Level 3". */
export function nodeStatus(view: TechView): { text: string; tone: NodeTone } {
  if (view.active) return { text: `Researching → ${view.active.targetLevel}`, tone: 'busy' };
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

/** The detail panel's button: what it says and whether it can be pressed. */
export function queueAction(
  planet: PlanetSnapshot,
  view: TechView,
): { label: string; enabled: boolean } {
  const queue = planet.researchQueue;
  if (queue.length >= RESEARCH_QUEUE_MAX) {
    return { label: `QUEUE FULL · ${queue.length} OF ${RESEARCH_QUEUE_MAX}`, enabled: false };
  }
  if (!view.unlocked) return { label: 'LOCKED', enabled: false };
  if (!view.affordable) return { label: 'NOT ENOUGH RESOURCES', enabled: false };
  const last = queue[queue.length - 1];
  if (!last) return { label: 'START RESEARCH', enabled: true };
  return { label: `QUEUE AFTER ${catalogName(last.technology).toUpperCase()}`, enabled: true };
}
