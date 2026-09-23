// Command Deck logic (spec stories 79–82). Pure, so it can be unit-tested without a browser.

import { SHIPS, type ShipDef } from '#shared/catalog.ts';
import type { BuildSlotView, PlanetSnapshot } from './api.ts';
import { affordableInLabel } from './affordability.ts';
import { liveResources } from './liveResources.ts';
import {
  firstFreeSlot,
  type StructureAction,
  structureAction,
  structureViews,
  type StructureView,
} from './structures.ts';

export interface DockTile {
  def: ShipDef;
  count: number;
}

/** The Fleet Dock: the 8 ships in design order. Solar Satellites aren't fleet, so they're left out. */
export function fleetDock(ships: Record<string, number>): { tiles: DockTile[]; docked: number } {
  const tiles = SHIPS.filter((d) => d.shipClass !== 'energy').map((def) => ({
    def,
    count: ships[def.key] ?? 0,
  }));
  return { tiles, docked: tiles.reduce((n, t) => n + t.count, 0) };
}

/** The Fleet Dock subtitle, e.g. "499 ships docked" (no returning fleets in v1). */
export function dockSubtitle(docked: number): string {
  return `${docked.toLocaleString('en-US')} ${docked === 1 ? 'ship' : 'ships'} docked`;
}

/** Both Build Slots in order, each busy with an upgrade or free. */
export function slotRows(planet: PlanetSnapshot): { slot: number; busy: BuildSlotView | null }[] {
  return planet.buildSlots.map((busy, i) => ({ slot: i + 1, busy }));
}

/** How far a Build Slot's upgrade has run, 0–1. */
export function slotProgress(slot: BuildSlotView, now: number): number {
  const total = slot.endsAt - slot.startedAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - slot.startedAt) / total));
}

export interface DeckStructureRow extends StructureView {
  action: StructureAction;
  /** The full reason for a disabled button, for its tooltip. */
  reason: string;
}

/**
 * The Structures panel: all 13 Structures in design order, each with its list button. The panel is
 * narrow, so a short row's button just reads "SHORT"; what is short and when it's affordable go
 * into the reason.
 */
export function deckStructureRows(
  planet: PlanetSnapshot,
  speed: number,
  now: number,
): DeckStructureRow[] {
  const nextFreeAt = firstFreeSlot(planet)?.endsAt ?? null;
  return structureViews(planet, speed, liveResources(planet, now)).map((v) => {
    const action = structureAction(v, now, nextFreeAt);
    if (v.state !== 'short') return { ...v, action, reason: action.label };
    return {
      ...v,
      action: { ...action, label: 'SHORT' },
      reason: `${action.label} · ${affordableInLabel(v.affordableInSec)}`,
    };
  });
}
