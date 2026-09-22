import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type PlanetSnapshot } from '../lib/api.ts';
import { refetchDelay } from '../lib/liveResources.ts';
import { CommandDeck } from './CommandDeck.tsx';
import { Rail } from './Rail.tsx';
import { TopBar } from './TopBar.tsx';

interface GameShellProps {
  initialPlanet: PlanetSnapshot;
  onLogout: () => void;
  loggingOut: boolean;
}

/** The logged-in game shell: rail, top bar and the screen content area. */
export function GameShell({ initialPlanet, onLogout, loggingOut }: GameShellProps) {
  const planetQuery = useQuery({
    queryKey: ['planet'],
    queryFn: () => api.planet(),
    initialData: initialPlanet,
  });
  const planet = planetQuery.data;

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

  return (
    <>
      <Rail onLogout={onLogout} loggingOut={loggingOut} />
      <TopBar planet={planet} />
      <CommandDeck planet={planet} />
      {planetQuery.isError && !dismissed && <ErrorBanner onDismiss={() => setDismissed(true)} />}
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
