// Display logic for the "can't afford" state (spec story 44, #14 pick B+C). The time itself comes
// from the shared `secondsUntilAffordable` formula; this module only words and formats it. Pure so
// it can be unit-tested without a browser.

import type { ResourceAmounts } from '#shared/economy.ts';

type Resource = keyof ResourceAmounts;

const RESOURCES = ['alloy', 'crystal', 'deuterium'] as const;

const LABELS: Record<Resource, string> = {
  alloy: 'Alloy',
  crystal: 'Crystal',
  deuterium: 'Deuterium',
};
// Short names for the cramped card button.
const SHORT_NAMES: Record<Resource, string> = {
  alloy: 'ALLOY',
  crystal: 'CRYSTAL',
  deuterium: 'DEUT',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * A wait until affordable, coarse enough to read at a glance: "45s", then whole minutes rounded
 * up ("17m"), then "3h 28m", then "3d 04h".
 */
export function formatAffordableIn(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  const minutes = Math.ceil(s / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${pad(minutes % 60)}m`;
  return `${Math.floor(hours / 24)}d ${pad(hours % 24)}h`;
}

/** The detail button when the cost isn't covered: when it will be, or that it won't at this rate. */
export function affordableInLabel(seconds: number | null): string {
  if (seconds === null) return "CAN'T AFFORD YET";
  return `AFFORDABLE IN ${formatAffordableIn(seconds)}`;
}

export interface CostCheck {
  resource: Resource;
  label: string;
  have: number;
  need: number;
  met: boolean;
}

/** One ✓/✕ row per Resource the cost needs (`18,410 / 30,240` Alloy). */
export function costChecks(cost: ResourceAmounts, stock: ResourceAmounts): CostCheck[] {
  return RESOURCES.filter((r) => cost[r] > 0).map((r) => {
    const have = Math.floor(stock[r]);
    return { resource: r, label: LABELS[r], have, need: cost[r], met: have >= cost[r] };
  });
}

/** The card button naming what's short, e.g. "SHORT: ALLOY · DEUT". */
export function shortLabel(checks: CostCheck[]): string {
  const short = checks.filter((c) => !c.met).map((c) => SHORT_NAMES[c.resource]);
  return `SHORT: ${short.join(' · ')}`;
}

/** A compact cost figure for the cards: "999", "60.1k", "409k", "1.5M". */
export function formatCompact(value: number): string {
  const n = Math.floor(value);
  if (n < 1_000) return `${n}`;
  const [div, unit] = n < 1_000_000 ? [1_000, 'k'] : [1_000_000, 'M'];
  const scaled = n / div;
  if (scaled >= 100) return `${Math.floor(scaled)}${unit}`;
  return `${(Math.floor(scaled * 10) / 10).toFixed(1)}${unit}`;
}

/** A cost's non-zero figures in compact form, e.g. "102k · 30.7k" for a Cancel refund line. */
export function formatCostCompact(cost: ResourceAmounts): string {
  return RESOURCES.filter((r) => cost[r] > 0)
    .map((r) => formatCompact(cost[r]))
    .join(' · ');
}
