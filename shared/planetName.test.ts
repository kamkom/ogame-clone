import { describe, expect, it } from 'vitest';
import { validatePlanetName } from './planetName.ts';

describe('validatePlanetName', () => {
  it('accepts a plain name and returns it unchanged', () => {
    expect(validatePlanetName('Homeworld')).toEqual({ name: 'Homeworld' });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validatePlanetName('  New Terra  ')).toEqual({ name: 'New Terra' });
  });

  it('rejects a name shorter than 2 or longer than 20 characters', () => {
    expect(validatePlanetName('a').error).toBe('length');
    expect(validatePlanetName('   ').error).toBe('length');
    expect(validatePlanetName('x'.repeat(21)).error).toBe('length');
  });

  it('accepts a Unicode letter', () => {
    expect(validatePlanetName('Café').error).toBeUndefined();
  });

  it('rejects an emoji and other stray characters', () => {
    expect(validatePlanetName('Home🚀').error).toBe('chars');
    expect(validatePlanetName('Bad!').error).toBe('chars');
  });

  it('rejects runs of spaces', () => {
    expect(validatePlanetName('New  Terra').error).toBe('spaces');
  });

  it('allows single spaces, digits, hyphen and underscore', () => {
    expect(validatePlanetName('Delta-9 base_2').error).toBeUndefined();
  });

  it('rejects a non-string input as a length error', () => {
    expect(validatePlanetName(undefined).error).toBe('length');
    expect(validatePlanetName(42).error).toBe('length');
  });
});
