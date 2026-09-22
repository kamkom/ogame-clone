import type { PlanetSnapshot } from '../lib/api.ts';
import { formatResource } from '../lib/format.ts';
import { energyBalance, liveResources } from '../lib/liveResources.ts';
import { useServerNow } from '../lib/useServerNow.ts';
import { Icon, RESOURCES } from './icons.tsx';

interface TopBarProps {
  planet: PlanetSnapshot;
}

/** The top bar: planet picker (name + Coordinates) and the four resource chips. */
export function TopBar({ planet }: TopBarProps) {
  const now = useServerNow(planet.serverNow);
  const live = liveResources(planet, now);
  const amounts: Record<string, number> = {
    ALLOY: live.alloy,
    CRYSTAL: live.crystal,
    DEUTERIUM: live.deuterium,
    ENERGY: energyBalance(planet), // never stockpiled: a static balance
  };

  return (
    <header style={headerStyle}>
      <button type="button" style={pickerStyle} title={`${planet.name} ${planet.coordinatesLabel}`}>
        <span style={pickerDotStyle} />
        <span className="disp" style={{ fontSize: 15, fontWeight: 600 }}>
          {planet.name}
        </span>
        <span className="coords" style={{ fontSize: 13 }}>
          {planet.coordinatesLabel}
        </span>
      </button>

      <div style={{ display: 'flex', gap: 12 }}>
        {RESOURCES.map((res) => (
          <div key={res.name} style={chipStyle}>
            <Icon path={res.path} fill={res.fill} size={22} color={`var(${res.cssVar})`} />
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="disp" style={chipLabelStyle}>
                <span>{res.name}</span>
              </div>
              <div
                className="disp"
                style={{ fontSize: 15, fontWeight: 500 }}
                title={Math.floor(amounts[res.name] ?? 0).toLocaleString('en-US')}
              >
                {formatResource(amounts[res.name] ?? 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}

const headerStyle = {
  position: 'absolute' as const,
  left: 'var(--rail-w)',
  right: 0,
  top: 0,
  height: 'var(--topbar-h)',
  boxSizing: 'border-box' as const,
  padding: '0 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--line)',
};

const pickerStyle = {
  height: 44,
  padding: '0 16px',
  borderRadius: 'var(--r-card)',
  border: '1px solid var(--line-control)',
  background: 'var(--panel)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
};

const pickerDotStyle = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%,#f1f6ff,#6c8aa8 70%)',
};

const chipStyle = {
  width: 168,
  boxSizing: 'border-box' as const,
  padding: '8px 12px',
  borderRadius: 'var(--r-card)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const chipLabelStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  letterSpacing: '.08em',
  color: 'var(--text-muted)',
};
