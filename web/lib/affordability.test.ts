import { describe, expect, it } from 'vitest';
import {
  affordableInLabel,
  costChecks,
  formatAffordableIn,
  formatCompact,
  formatCostCompact,
  shortLabel,
} from './affordability.ts';

describe('formatAffordableIn', () => {
  it('shows seconds under a minute', () => {
    expect(formatAffordableIn(1)).toBe('1s');
    expect(formatAffordableIn(45)).toBe('45s');
  });

  it('rounds up to whole minutes under an hour', () => {
    expect(formatAffordableIn(60)).toBe('1m');
    expect(formatAffordableIn(16 * 60 + 1)).toBe('17m');
    expect(formatAffordableIn(17 * 60)).toBe('17m');
  });

  it('shows hours and zero-padded minutes under a day', () => {
    expect(formatAffordableIn(59 * 60 + 30)).toBe('1h 00m');
    expect(formatAffordableIn(3 * 3600 + 28 * 60)).toBe('3h 28m');
    expect(formatAffordableIn(2 * 3600 + 4 * 60 + 1)).toBe('2h 05m');
  });

  it('shows days and zero-padded hours from a day up', () => {
    expect(formatAffordableIn(24 * 3600)).toBe('1d 00h');
    expect(formatAffordableIn(3 * 86_400 + 4 * 3600)).toBe('3d 04h');
  });
});

describe('affordableInLabel', () => {
  it('names the wait at current production', () => {
    expect(affordableInLabel(17 * 60)).toBe('AFFORDABLE IN 17m');
  });

  it('says it cannot be afforded when it never will be at current production', () => {
    expect(affordableInLabel(null)).toBe("CAN'T AFFORD YET");
  });
});

describe('costChecks', () => {
  it('lists each Resource the cost needs, with what the Planet has', () => {
    const checks = costChecks(
      { alloy: 30_240, crystal: 10_080, deuterium: 0 },
      { alloy: 18_410.9, crystal: 12_000, deuterium: 5 },
    );
    expect(checks).toEqual([
      { resource: 'alloy', label: 'Alloy', have: 18_410, need: 30_240, met: false },
      { resource: 'crystal', label: 'Crystal', have: 12_000, need: 10_080, met: true },
    ]);
  });
});

describe('shortLabel', () => {
  it('names the short Resources', () => {
    const checks = costChecks(
      { alloy: 100, crystal: 100, deuterium: 100 },
      { alloy: 0, crystal: 200, deuterium: 0 },
    );
    expect(shortLabel(checks)).toBe('SHORT: ALLOY · DEUT');
  });
});

describe('formatCompact', () => {
  it('keeps small numbers whole', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(999)).toBe('999');
  });

  it('uses one decimal of k and M above that', () => {
    expect(formatCompact(1_000)).toBe('1.0k');
    expect(formatCompact(60_150)).toBe('60.1k');
    expect(formatCompact(1_500_000)).toBe('1.5M');
  });

  it('drops the decimal from 100k and 100M up', () => {
    expect(formatCompact(102_400)).toBe('102k');
    expect(formatCompact(409_600)).toBe('409k');
  });
});

describe('formatCostCompact', () => {
  it('joins the non-zero figures of a cost, e.g. for "Cancel refunds 102k · 30.7k"', () => {
    expect(formatCostCompact({ alloy: 102_400, crystal: 30_720, deuterium: 0 })).toBe(
      '102k · 30.7k',
    );
    expect(formatCostCompact({ alloy: 400, crystal: 120, deuterium: 200 })).toBe('400 · 120 · 200');
    expect(formatCostCompact({ alloy: 0, crystal: 50_000, deuterium: 100_000 })).toBe(
      '50.0k · 100k',
    );
  });
});
