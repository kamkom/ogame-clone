import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isUnauthorized, retryPolicy } from './queryErrors.ts';

export const ME_KEY = ['me'] as const;
export const PLANET_KEY = ['planet'] as const;

/**
 * Forget the signed-in Player: `me` refetches (and 401s, so the auth screen shows) and the
 * cached Planet goes, so the next Player never sees it. Used on logout and on any 401.
 */
export function signOut(client: QueryClient): void {
  void client.resetQueries({ queryKey: ME_KEY });
  client.removeQueries({ queryKey: PLANET_KEY });
}

/**
 * The app's QueryClient. Queries retry network failures and 5xx three times but never a 4xx.
 * A 401 from any game request (story 15) falls back to the login screen. Every other failed
 * mutation refetches the Planet: a 409 means the snapshot was stale, and a network failure puts
 * the Planet query into retry, which shows the "Couldn't reach the server" banner.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: retryPolicy(3) } },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // `me` itself 401s when signed out; that is how the auth screen is reached.
        if (isUnauthorized(error) && query.queryKey[0] !== ME_KEY[0]) signOut(client);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        // A failed login is also a 401; only a signed-in Player (a cached `me`) is signed out.
        if (!client.getQueryData(ME_KEY)) return;
        if (isUnauthorized(error)) signOut(client);
        else void client.invalidateQueries({ queryKey: PLANET_KEY });
      },
    }),
  });
  return client;
}
