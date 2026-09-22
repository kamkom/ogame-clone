import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stage } from './stage/Stage.tsx';
import { ApiError, api, type Session } from './lib/api.ts';
import { AuthScreen } from './auth/AuthScreen.tsx';
import { GameShell } from './shell/GameShell.tsx';

const ME_KEY = ['me'] as const;

/**
 * Top-level flow: fetch the current session. A 401 (no or expired session) falls back to the
 * auth screen; otherwise the game shell renders. Everything lives on the scaled Stage.
 */
export function App() {
  const queryClient = useQueryClient();

  const health = useQuery({ queryKey: ['health'], queryFn: () => api.health() });
  const me = useQuery<Session, ApiError>({
    queryKey: ME_KEY,
    queryFn: () => api.me(),
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => queryClient.resetQueries({ queryKey: ME_KEY }),
  });

  const rename = useMutation({
    mutationFn: (name: string) => api.renamePlanet(name),
    onSuccess: (planet) => {
      // The shell renders from the ['planet'] query; keep the session copy in sync too.
      queryClient.setQueryData<Session>(ME_KEY, (prev) => (prev ? { ...prev, planet } : prev));
      queryClient.setQueryData(['planet'], planet);
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
          onRename={(name) => rename.mutateAsync(name)}
          onLogout={() => logout.mutate()}
          loggingOut={logout.isPending}
        />
      );
    }
    // A 401 (and any other error) falls back to the auth screen so the Player is never stuck.
    if (me.isError) {
      return <AuthScreen universeSpeed={universeSpeed} onAuthenticated={onAuthenticated} />;
    }
    return <div style={loadingStyle}>Loading…</div>;
  }
}

const loadingStyle = {
  position: 'absolute' as const,
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-body)',
};
