import { useState, type FormEvent } from 'react';
import { validatePlanetName } from '#shared/planetName.ts';
import type { PlanetSnapshot } from '../lib/api.ts';
import { formatResource } from '../lib/format.ts';
import { DEFAULT_PLANET_NAME } from './constants.ts';
import { planetNameMessage, renameErrorMessage } from './planetName.ts';

interface WelcomeWindowProps {
  planet: PlanetSnapshot;
  username: string;
  onRename: (name: string) => Promise<PlanetSnapshot>;
  onDismiss: () => void;
}

/**
 * The one-time welcome window (spec #22), shown over the dimmed, blurred Command Deck right after
 * registering. TAKE COMMAND saves the typed name; KEEP "HOMEWORLD" skips. Either button dismisses
 * it for good — the trigger is the register response, not a persisted flag.
 */
export function WelcomeWindow({ planet, username, onRename, onDismiss }: WelcomeWindowProps) {
  const [name, setName] = useState(planet.name);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function takeCommand(event: FormEvent) {
    event.preventDefault();
    const result = validatePlanetName(name);
    if (result.error) {
      setError(planetNameMessage(result.error));
      return;
    }
    // Renaming to the default is a no-op the Player can skip via KEEP; still accept it.
    setSaving(true);
    setError(undefined);
    try {
      if (result.name !== planet.name) await onRename(result.name);
      onDismiss();
    } catch (err) {
      setError(renameErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={takeCommand} noValidate style={cardStyle}>
        <div style={artColumnStyle} aria-hidden="true">
          <div style={hudStyle}>
            <div style={planetStyle} />
          </div>
          <div className="coords" style={{ fontSize: 16 }}>
            {planet.coordinatesLabel}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 320 }}>
          <div className="disp" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '.06em' }}>
            HOMEWORLD ESTABLISHED
          </div>
          <div style={{ color: 'var(--text-body)', lineHeight: 1.5 }}>
            Welcome, {username}.
            <br />
            Your Planet sits at <span className="coords">{planet.coordinatesLabel}</span> with{' '}
            {formatResource(planet.resources.alloy)} Alloy and{' '}
            {formatResource(planet.resources.crystal)} Crystal to start. You can rename it any time
            from the planet picker.
          </div>

          <div className="field">
            <label className="label" htmlFor="welcome-name">
              Planet name
            </label>
            <input
              id="welcome-name"
              className={`input${error ? ' bad' : ''}`}
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
            />
            {error && <div className="err">{error}</div>}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn fill" type="submit" disabled={saving} style={{ flex: 1 }}>
              Take command
            </button>
            <button className="btn" type="button" onClick={onDismiss} disabled={saving}>
              Keep “{DEFAULT_PLANET_NAME}”
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const overlayStyle = {
  position: 'absolute' as const,
  left: 'var(--rail-w)',
  right: 0,
  top: 'var(--topbar-h)',
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(6,9,14,.6)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 10,
};

const cardStyle = {
  display: 'flex',
  gap: 36,
  padding: 36,
  boxSizing: 'border-box' as const,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-panel)',
  boxShadow: '0 30px 80px rgba(0,0,0,.5)',
};

const artColumnStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 16,
};

const hudStyle = {
  position: 'relative' as const,
  width: 200,
  height: 200,
  borderRadius: '50%',
  border: '1px solid var(--hud-ring)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const planetStyle = {
  width: 150,
  height: 150,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 78% 76%, rgba(4,7,12,0.96), rgba(4,7,12,0) 64%), radial-gradient(ellipse 40% 10% at 45% 40%, rgba(255,255,255,0.25), rgba(255,255,255,0) 70%), radial-gradient(circle at 34% 30%, #f1f6ff 0%, var(--planet) 32%, #54708e 60%, #1a2736 92%)',
  boxShadow: '0 0 60px rgba(150,190,230,0.18)',
};
