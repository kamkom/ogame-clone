import { describe, expect, it } from 'vitest';
import { ApiError, api } from './api.ts';

/** A fake fetch returning a canned status + JSON body, recording the request. */
function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(
      new Response(body === undefined ? '' : JSON.stringify(body), { status }),
    );
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('api wrapper', () => {
  it('returns the parsed body on success', async () => {
    const { impl } = fakeFetch(200, { player: { id: 1, username: 'Vega' } });
    const session = await api.me(impl);
    expect(session.player.username).toBe('Vega');
  });

  it('throws an ApiError flagged unauthorized on 401', async () => {
    const { impl } = fakeFetch(401, { error: 'unauthenticated' });
    await expect(api.planet(impl)).rejects.toMatchObject({ status: 401 });
    try {
      await api.planet(impl);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).unauthorized).toBe(true);
    }
  });

  it('surfaces field errors from a 400', async () => {
    const { impl } = fakeFetch(400, { error: 'validation', fields: { username: 'taken' } });
    try {
      await api.register('Vega', 'password1', impl);
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as ApiError).body?.fields?.username).toBe('taken');
    }
  });

  it('POSTs JSON with a content-type header', async () => {
    const { impl, calls } = fakeFetch(200, { player: { id: 1, username: 'Vega' } });
    await api.login('Vega', 'password1', impl);
    const { init } = calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'Vega', password: 'password1' });
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });
});
