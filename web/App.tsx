import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stage } from './stage/Stage.tsx';
import { ApiError, api, type Session } from './lib/api.ts';
import { AuthScreen } from './auth/AuthScreen.tsx';
import { GameShell } from './shell/GameShell.tsx';
import { Rail } from './shell/Rail.tsx';
import { ServerBanner } from './shell/ErrorBanner.tsx';
import { ME_KEY, PLANET_KEY, signOut } from './lib/queryClient.ts';
import { retryPolicy } from './lib/queryErrors.ts';

/**
 * Top-level flow: fetch the current session. A 401 (no or expired session) falls back to the
 * auth screen; otherwise the game shell renders. An unreachable server keeps the loading chrome
 * up with the retry banner. Everything lives on the scaled Stage.
 */
export function App() {
  const queryClient = useQueryClient();

  const health = useQuery({ queryKey: ['health'], queryFn: () => api.health() });
  const me = useQuery<Session, ApiError>({
    queryKey: ME_KEY,
    queryFn: () => api.me(),
    // A 4xx (401) answers at once; a network failure or 5xx retries until the server is back.
    retry: retryPolicy(Infinity),
  });

  const logout = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => signOut(queryClient),
  });

  const rename = useMutation({
    mutationFn: (name: string) => api.renamePlanet(name),
    onSuccess: (planet) => {
      // The shell renders from the ['planet'] query; keep the session copy in sync too.
      queryClient.setQueryData<Session>(ME_KEY, (prev) => (prev ? { ...prev, planet } : prev));
      queryClient.setQueryData(PLANET_KEY, planet);
    },
  });

  const universeSpeed = health.data?.universeSpeed ?? 1;

  function onAuthenticated(session: Session) {
    queryClient.setQueryData(ME_KEY, session);
  }

  return <Stage>{renderContent()}</Stage>;

  function renderContent() {
    if (me.isSuccess) {
      return (
        <GameShell
          session={me.data}
          universeSpeed={universeSpeed}
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
    return (
      <>
        <Rail active={-1} onNavigate={() => {}} />
        <div style={loadingStyle}>Loading…</div>
        <ServerBanner failureCount={me.failureCount} failureReason={me.failureReason} />
      </>
    );
  }
}

// Where the screen content goes: right of the rail, below the top bar.
const loadingStyle = {
  position: 'absolute' as const,
  left: 'calc(var(--rail-w) + 24px)',
  top: 'calc(var(--topbar-h) + 24px)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
};
