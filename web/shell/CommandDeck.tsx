import type { PlanetSnapshot } from '../lib/api.ts';

interface CommandDeckProps {
  planet: PlanetSnapshot;
}

/**
 * The screen content area. For this slice it is an empty Command Deck: the planet, its name,
 * Coordinates and temperature range. The full Overview (Structures list, queues, docks) is a
 * later slice.
 */
export function CommandDeck({ planet }: CommandDeckProps) {
  return (
    <div style={contentStyle}>
      <div style={planetHudStyle} aria-hidden="true">
        <div style={planetStyle} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label">Planet</div>
        <div className="disp" style={{ fontSize: 30, fontWeight: 600 }}>
          {planet.name}
        </div>
        <div className="coords" style={{ fontSize: 18 }}>
          {planet.coordinatesLabel}
        </div>
        <div style={{ color: 'var(--text-body)', maxWidth: 340, marginTop: 10, lineHeight: 1.5 }}>
          Temperature {planet.temperature.min}°C … {planet.temperature.max}°C · {planet.fields.used}{' '}
          / {planet.fields.max} Fields · {planet.diameterKm.toLocaleString('en-US')} km. The full
          Command Deck lands in a later slice.
        </div>
      </div>
    </div>
  );
}

const contentStyle = {
  position: 'absolute' as const,
  left: 'var(--content-left)',
  top: 'var(--content-top)',
  right: 24,
  bottom: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 48,
};

const planetHudStyle = {
  position: 'relative' as const,
  width: 360,
  height: 360,
  borderRadius: '50%',
  border: '1px solid var(--hud-ring)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const planetStyle = {
  width: 260,
  height: 260,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 78% 76%, rgba(4,7,12,0.96), rgba(4,7,12,0) 64%), radial-gradient(ellipse 40% 10% at 45% 40%, rgba(255,255,255,0.25), rgba(255,255,255,0) 70%), radial-gradient(circle at 34% 30%, #f1f6ff 0%, var(--planet) 32%, #54708e 60%, #1a2736 92%)',
  boxShadow: '0 0 80px rgba(150,190,230,0.18)',
};
