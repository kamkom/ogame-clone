import { describe, expect, it } from 'vitest';
import {
  catalogName,
  requirementStatus,
  structureDef,
  STRUCTURES,
  technologyDef,
  TECHNOLOGIES,
} from './catalog.ts';

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

describe('descriptions', () => {
  const items = [...STRUCTURES, ...TECHNOLOGIES];
  // The design wrote these two as a flavour sentence plus an effect sentence; they stay as written.
  const designTexts = ['deuterium-synthesizer', 'warp-drive'];

  it.each(items.map((d) => [d.name, d.key, d.description]))(
    '%s has about 80 characters',
    (_name, key, text) => {
      expect(text.length).toBeGreaterThanOrEqual(60);
      expect(text.length).toBeLessThanOrEqual(100);
      expect(text).toMatch(/^[A-Z].*\.$/);
      if (!designTexts.includes(key)) expect(text).not.toMatch(/\. /);
    },
  );

  it('never repeats a text', () => {
    expect(new Set(items.map((d) => d.description)).size).toBe(items.length);
  });

  it("states Graviton Lance's Energy capacity need", () => {
    expect(technologyDef('graviton-lance')!.description).toContain('300,000 Energy capacity');
  });

  it('keeps the two texts the design wrote', () => {
    expect(structureDef('deuterium-synthesizer')!.description).toBe(
      "Filters heavy hydrogen from the planet's cold seas. Output falls on warmer worlds.",
    );
    expect(technologyDef('warp-drive')!.description).toBe(
      'Folds space just ahead of the hull. Each level makes ships that use it 30% faster.',
    );
  });
});
