import { useState } from 'react';
import type { PlanetSnapshot, Session } from '../lib/api.ts';
import { CommandDeck } from './CommandDeck.tsx';
import { Rail } from './Rail.tsx';
import { TopBar } from './TopBar.tsx';
import { WelcomeWindow } from './WelcomeWindow.tsx';

interface GameShellProps {
  session: Session;
  onRename: (name: string) => Promise<PlanetSnapshot>;
  onLogout: () => void;
  loggingOut: boolean;
}

/** The logged-in game shell: rail, top bar, screen content, and the one-time welcome window. */
export function GameShell({ session, onRename, onLogout, loggingOut }: GameShellProps) {
  const { planet, player } = session;
  // The welcome window trigger is the register response (firstLogin), not a persisted flag. Once
  // either button dismisses it, this stays false for the rest of the session.
  const [showWelcome, setShowWelcome] = useState(session.firstLogin ?? false);

  return (
    <>
      <Rail onLogout={onLogout} loggingOut={loggingOut} />
      <TopBar planet={planet} onRename={onRename} />
      <CommandDeck planet={planet} />
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
