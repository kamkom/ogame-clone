import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PlanetSnapshot, type Session } from '../lib/api.ts';
import { refetchDelay } from '../lib/liveResources.ts';
import { CommandDeck } from './CommandDeck.tsx';
import { Rail } from './Rail.tsx';
import { Research } from './Research.tsx';
import { Shipyard } from './Shipyard.tsx';
import { Structures } from './Structures.tsx';
import { TopBar } from './TopBar.tsx';
import { WelcomeWindow } from './WelcomeWindow.tsx';
import { ServerBanner } from './ErrorBanner.tsx';

interface GameShellProps {
  session: Session;
  universeSpeed: number;
  onRename: (name: string) => Promise<PlanetSnapshot>;
  onLogout: () => void;
  loggingOut: boolean;
}

// NAV indices: 0 Overview, 1 Build (Structures), 2 Research, 3 Shipyard.
type Screen = 'overview' | 'structures' | 'research' | 'shipyard';
const SCREEN_BY_NAV: Record<number, Screen> = {
  0: 'overview',
  1: 'structures',
  2: 'research',
  3: 'shipyard',
};
const NAV_BY_SCREEN: Record<Screen, number> = {
  overview: 0,
  structures: 1,
  research: 2,
  shipyard: 3,
};

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
  const cancel = useMutation({
    mutationFn: (slot: number) => api.cancelBuildSlot(slot),
    onSuccess: (snapshot) => queryClient.setQueryData(['planet'], snapshot),
  });
  const enqueue = useMutation({
    mutationFn: (technology: string) => api.enqueueResearch(technology),
    onSuccess: (snapshot) => queryClient.setQueryData(['planet'], snapshot),
  });
  const placeOrder = useMutation({
    mutationFn: ({ ship, quantity }: { ship: string; quantity: number }) =>
      api.placeShipyardOrder(ship, quantity),
    onSuccess: (snapshot) => queryClient.setQueryData(['planet'], snapshot),
  });
  const cancelResearch = useMutation({
    mutationFn: (entryId: number) => api.cancelResearch(entryId),
    onSuccess: (snapshot) => queryClient.setQueryData(['planet'], snapshot),
  });

  // Refetch when the next server-side boundary is due (e.g. Deuterium depletion changes the rates).
  useEffect(() => {
    const delay = refetchDelay(planet, planet.serverNow);
    if (delay === null) return;
    const id = setTimeout(() => planetQuery.refetch(), delay);
    return () => clearTimeout(id);
  }, [planet, planetQuery]);

  // The welcome window trigger is the register response (firstLogin), not a persisted flag. Once
  // either button dismisses it, this stays false for the rest of the session.
  const [showWelcome, setShowWelcome] = useState(session.firstLogin ?? false);

  const activeNav = NAV_BY_SCREEN[screen];

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
      {screen === 'structures' && (
        <Structures
          planet={planet}
          universeSpeed={universeSpeed}
          onUpgrade={(key) => upgrade.mutate(key)}
          onCancel={(slot) => cancel.mutate(slot)}
          pendingKey={upgrade.isPending ? (upgrade.variables ?? null) : null}
        />
      )}
      {screen === 'research' && (
        <Research
          planet={planet}
          universeSpeed={universeSpeed}
          onEnqueue={(technology) => enqueue.mutate(technology)}
          onCancel={(entryId) => cancelResearch.mutate(entryId)}
          pendingKey={enqueue.isPending ? (enqueue.variables ?? null) : null}
          onGoToStructures={() => setScreen('structures')}
        />
      )}
      {screen === 'shipyard' && (
        <Shipyard
          planet={planet}
          universeSpeed={universeSpeed}
          onOrder={(ship, quantity) => placeOrder.mutate({ ship, quantity })}
          pendingKey={placeOrder.isPending ? (placeOrder.variables?.ship ?? null) : null}
          onGoToStructures={() => setScreen('structures')}
        />
      )}
      {screen === 'overview' && (
        <CommandDeck
          planet={planet}
          universeSpeed={universeSpeed}
          onUpgrade={(key) => upgrade.mutate(key)}
          onCancel={(slot) => cancel.mutate(slot)}
          onManage={() => setScreen('structures')}
          pendingKey={upgrade.isPending ? (upgrade.variables ?? null) : null}
        />
      )}
      <ServerBanner
        failureCount={planetQuery.failureCount}
        failureReason={planetQuery.failureReason}
      />
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
