import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stage } from './stage/Stage.tsx';
import { ApiError, api, type PlanetSnapshot, type Player, type Session } from './lib/api.ts';
import { AuthScreen } from './auth/AuthScreen.tsx';
import { GameShell } from './shell/GameShell.tsx';
import { LoadingChrome } from './shell/LoadingChrome.tsx';
import { ME_KEY, PLANET_KEY, signOut } from './lib/queryClient.ts';
import { retryPolicy } from './lib/queryErrors.ts';

/**
 * Top-level flow: fetch the current session. A 401 (no or expired session) falls back to the
 * auth screen; otherwise the game shell renders. An unreachable server keeps the loading chrome
 * up with the retry banner. Everything lives on the scaled Stage.
 */
export function App() {
  const queryClient = useQueryClient();

  const me = useQuery<Session, ApiError>({
    queryKey: ME_KEY,
    queryFn: () => api.me(),
    // A 4xx (401) answers at once; a network failure or 5xx retries until the server is back.
    retry: retryPolicy(Infinity),
  });

  // Set by register only: the one-time welcome window shows over the new Planet (story 19).
  const [firstLogin, setFirstLogin] = useState(false);

  const logout = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      setFirstLogin(false);
      signOut(queryClient);
    },
  });

  const rename = useMutation({
    mutationFn: (name: string) => api.renamePlanet(name),
    onSuccess: (snapshot) => queryClient.setQueryData(PLANET_KEY, snapshot),
  });

  // Only the auth screen needs this, and the me 401 carries it; once signed in, the snapshot does.
  const universeSpeed = me.error?.body?.universeSpeed ?? 1;

  function onAuthenticated(player: Player, snapshot?: PlanetSnapshot) {
    // Seed the Planet first, so a new Player's shell renders without a second request.
    if (snapshot) queryClient.setQueryData(PLANET_KEY, snapshot);
    setFirstLogin(snapshot !== undefined);
    queryClient.setQueryData<Session>(ME_KEY, { player });
  }

  return <Stage>{renderContent()}</Stage>;

  function renderContent() {
    if (me.isSuccess) {
      return (
        <GameShell
          player={me.data.player}
          firstLogin={firstLogin}
          onRename={(name) => rename.mutateAsync(name)}
          onLogout={() => logout.mutate()}
          loggingOut={logout.isPending}
        />
      );
    }
    // A 401 (and any other client error) falls back to the auth screen so the Player is never
    // stuck. Network failures and 5xx keep retrying instead, so they never land here.
    if (me.isError) {
      return <AuthScreen universeSpeed={universeSpeed} onAuthenticated={onAuthenticated} />;
    }
    return <LoadingChrome failureCount={me.failureCount} failureReason={me.failureReason} />;
  }
}
