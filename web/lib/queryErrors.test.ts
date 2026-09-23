import { describe, expect, it } from 'vitest';
import { ApiError } from './api.ts';
import { isUnauthorized, retryPolicy, showsServerBanner } from './queryErrors.ts';

const network = new TypeError('Failed to fetch');

describe('showsServerBanner', () => {
  it('shows for network failures and server errors', () => {
    expect(showsServerBanner(network)).toBe(true);
    expect(showsServerBanner(new ApiError(500, null))).toBe(true);
    expect(showsServerBanner(new ApiError(503, { error: 'x' }))).toBe(true);
  });

  it('stays hidden for 401s, 409 rule rejections and other client errors', () => {
    expect(showsServerBanner(new ApiError(401, { error: 'unauthenticated' }))).toBe(false);
    expect(showsServerBanner(new ApiError(409, { error: 'slots_full' }))).toBe(false);
    expect(showsServerBanner(new ApiError(400, { error: 'validation' }))).toBe(false);
  });

  it('stays hidden when there is no error', () => {
    expect(showsServerBanner(null)).toBe(false);
  });
});

describe('retryPolicy', () => {
  const retry = retryPolicy(3);

  it('retries network failures and server errors up to the limit', () => {
    expect(retry(0, network)).toBe(true);
    expect(retry(2, new ApiError(502, null))).toBe(true);
    expect(retry(3, network)).toBe(false);
  });

  it('never retries a client error, since the answer will not change', () => {
    expect(retry(0, new ApiError(401, null))).toBe(false);
    expect(retry(0, new ApiError(409, { error: 'cannot_afford' }))).toBe(false);
  });

  it('retries forever when the limit is Infinity', () => {
    expect(retryPolicy(Infinity)(1000, network)).toBe(true);
  });
});

describe('isUnauthorized', () => {
  it('is true only for a 401 ApiError', () => {
    expect(isUnauthorized(new ApiError(401, null))).toBe(true);
    expect(isUnauthorized(new ApiError(403, null))).toBe(false);
    expect(isUnauthorized(network)).toBe(false);
  });
});
