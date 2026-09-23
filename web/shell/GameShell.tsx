import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PlanetSnapshot, type Session } from '../lib/api.ts';
import { refetchDelay } from '../lib/liveResources.ts';
import { CommandDeck } from './CommandDeck.tsx';
import { Rail } from './Rail.tsx';
import { Structures } from './Structures.tsx';
import { TopBar } from './TopBar.tsx';
import { WelcomeWindow } from './WelcomeWindow.tsx';

interface GameShellProps {
  session: Session;
  universeSpeed: number;
  onRename: (name: string) => Promise<PlanetSnapshot>;
  onLogout: () => void;
  loggingOut: boolean;
}

// NAV indices: 0 Overview, 1 Build (Structures). Research/Shipyard have no screen yet.
type Screen = 'overview' | 'structures';
const SCREEN_BY_NAV: Record<number, Screen> = { 0: 'overview', 1: 'structures' };

/** The logged-in game shell: rail, top bar, screen content, and the one-time welcome window. */
export function GameShell({
  session,
  universeSpeed,
  onRename,
  onLogout,
  loggingOut,
}: GameShellProps) {
  const { player } = session;
  const queryClient = useQueryClient();
  const planetQuery = useQuery({
    queryKey: ['planet'],
    queryFn: () => api.planet(),
    initialData: session.planet,
  });
  const planet = planetQuery.data;

  const [screen, setScreen] = useState<Screen>('overview');

  const upgrade = useMutation({
    mutationFn: (key: string) => api.upgradeStructure(key),
    onSuccess: (snapshot) => queryClient.setQueryData(['planet'], snapshot),
  });

  // Refetch when the next server-side boundary is due (e.g. Deuterium depletion changes the rates).
  useEffect(() => {
    const delay = refetchDelay(planet, planet.serverNow);
    if (delay === null) return;
    const id = setTimeout(() => planetQuery.refetch(), delay);
    return () => clearTimeout(id);
  }, [planet, planetQuery]);

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (planetQuery.isSuccess) setDismissed(false);
  }, [planetQuery.isSuccess, planet.serverNow]);

  // The welcome window trigger is the register response (firstLogin), not a persisted flag. Once
  // either button dismisses it, this stays false for the rest of the session.
  const [showWelcome, setShowWelcome] = useState(session.firstLogin ?? false);

  const activeNav = screen === 'structures' ? 1 : 0;

  return (
    <>
      <Rail
        onLogout={onLogout}
        loggingOut={loggingOut}
        active={activeNav}
        onNavigate={(i) => {
          const next = SCREEN_BY_NAV[i];
          if (next) setScreen(next);
        }}
      />
      <TopBar planet={planet} onRename={onRename} />
      {screen === 'structures' ? (
        <Structures
          planet={planet}
          universeSpeed={universeSpeed}
          onUpgrade={(key) => upgrade.mutate(key)}
          pendingKey={upgrade.isPending ? (upgrade.variables ?? null) : null}
        />
      ) : (
        <CommandDeck planet={planet} />
      )}
      {planetQuery.isError && !dismissed && <ErrorBanner onDismiss={() => setDismissed(true)} />}
      {showWelcome && (
        <WelcomeWindow
          planet={planet}
          username={player.username}
          onRename={onRename}
          onDismiss={() => setShowWelcome(false)}
        />
      )}
    </>
  );
}

/** A dismissible red banner shown when a background refetch fails. */
function ErrorBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="alert" style={bannerStyle}>
      <span>Couldn&rsquo;t reach the server — retrying</span>
      <button type="button" onClick={onDismiss} style={dismissStyle} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

const bannerStyle = {
  position: 'absolute' as const,
  left: '50%',
  top: 12,
  transform: 'translateX(-50%)',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 14px',
  borderRadius: 8,
  background: '#7f1d1d',
  color: '#fee2e2',
  border: '1px solid #b91c1c',
  fontSize: 13,
};

const dismissStyle = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
};
