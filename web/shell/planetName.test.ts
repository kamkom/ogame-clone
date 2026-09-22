import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api.ts';
import { planetNameMessage, renameErrorMessage } from './planetName.ts';

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
    expect(planetNameMessage('mystery')).toBe('That name isn’t allowed.');
  });
});

describe('renameErrorMessage', () => {
  it('surfaces the validation code from an ApiError body', () => {
    expect(renameErrorMessage(new ApiError(400, { error: 'validation', code: 'length' }))).toMatch(
      /2.*20/,
    );
  });

  it('falls back to a generic message for a non-validation failure', () => {
    expect(renameErrorMessage(new Error('network'))).toBe('Couldn’t save that name. Try again.');
    expect(renameErrorMessage(new ApiError(500, null))).toBe('Couldn’t save that name. Try again.');
  });
});
