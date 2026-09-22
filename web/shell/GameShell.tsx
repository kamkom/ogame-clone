import type { PlanetSnapshot } from '../lib/api.ts';
import { CommandDeck } from './CommandDeck.tsx';
import { Rail } from './Rail.tsx';
import { TopBar } from './TopBar.tsx';

interface GameShellProps {
  planet: PlanetSnapshot;
  onLogout: () => void;
  loggingOut: boolean;
}

/** The logged-in game shell: rail, top bar and the screen content area. */
export function GameShell({ planet, onLogout, loggingOut }: GameShellProps) {
  return (
    <>
      <Rail onLogout={onLogout} loggingOut={loggingOut} />
      <TopBar planet={planet} />
      <CommandDeck planet={planet} />
    </>
  );
}
