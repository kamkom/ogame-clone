import { describe, expect, it } from 'vitest';
import { planetNameMessage } from './planetName.ts';

describe('planetNameMessage', () => {
  it('returns undefined when there is no error', () => {
    expect(planetNameMessage(undefined)).toBeUndefined();
  });

  it('maps each validation code to human text', () => {
    expect(planetNameMessage('length')).toMatch(/2.*20/);
    expect(planetNameMessage('chars')).toMatch(/letters/i);
    expect(planetNameMessage('spaces')).toMatch(/spaces/i);
  });

  it('falls back to a generic message for an unknown code', () => {
    expect(planetNameMessage('mystery' as never)).toBe('That name isn’t allowed.');
  });
});
