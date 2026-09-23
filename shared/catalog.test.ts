import { describe, expect, it } from 'vitest';
import { catalogName, requirementStatus, structureDef } from './catalog.ts';

describe('requirement status', () => {
  it('lists each direct requirement with the current and required level', () => {
    const levels: Record<string, number> = { 'robotics-works': 8, computation: 10 };
    const status = requirementStatus(structureDef('nanite-foundry')!, (k) => levels[k] ?? 0);
    expect(status).toEqual([
      { key: 'robotics-works', name: 'Robotics Works', required: 10, current: 8, met: false },
      { key: 'computation', name: 'Computation', required: 10, current: 10, met: true },
    ]);
  });

  it('is empty for a Structure with no requirements', () => {
    expect(requirementStatus(structureDef('alloy-extractor')!, () => 0)).toEqual([]);
  });
});

describe('requirement names', () => {
  it('uses the design names for Structures and Technologies', () => {
    expect(catalogName('deuterium-synthesizer')).toBe('Deuterium Synthesizer');
    expect(catalogName('energy-theory')).toBe('Energy Theory');
  });
});
