import { Icon, Logo, NAV } from './icons.tsx';

interface RailProps {
  onLogout: () => void;
  loggingOut: boolean;
  /** Index into NAV of the active screen. */
  active: number;
  /** Navigate to the NAV item at `index` (ignored for SOON items). */
  onNavigate: (index: number) => void;
}

/** The left nav rail: the active screen is highlighted; Fleet/Galaxy/Alliance are SOON; logout. */
export function Rail({ onLogout, loggingOut, active: activeIndex, onNavigate }: RailProps) {
  return (
    <nav style={railStyle}>
      <div style={{ marginBottom: 18 }}>
        <Logo />
      </div>
      {NAV.map((item, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={item.label}
            role="button"
            tabIndex={item.soon ? -1 : 0}
            onClick={() => !item.soon && onNavigate(i)}
            aria-disabled={item.soon}
            aria-current={active ? 'page' : undefined}
            title={item.soon ? `${item.label} — SOON` : item.label}
            style={{
              width: 72,
              height: 62,
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              position: 'relative',
              background: active ? 'var(--accent-wash)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              letterSpacing: '.06em',
              opacity: item.soon ? 0.4 : 1,
              cursor: item.soon ? 'not-allowed' : 'pointer',
            }}
          >
            <Icon path={item.path} fill={item.fill} />
            {item.label}
            {item.soon && (
              <span style={soonChipStyle} aria-label="Coming soon">
                SOON
              </span>
            )}
          </div>
        );
      })}
      <button type="button" onClick={onLogout} disabled={loggingOut} style={logoutStyle}>
        LOG OUT
      </button>
    </nav>
  );
}

const railStyle = {
  position: 'absolute' as const,
  left: 0,
  top: 0,
  bottom: 0,
  width: 'var(--rail-w)',
  boxSizing: 'border-box' as const,
  padding: '20px 0',
  background: 'var(--rail)',
  borderRight: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 6,
};

const soonChipStyle = {
  position: 'absolute' as const,
  top: 4,
  right: 6,
  fontSize: 7,
  letterSpacing: '.08em',
  color: 'var(--text-muted)',
  border: '1px solid var(--line-strong)',
  borderRadius: 3,
  padding: '0 2px',
};

const logoutStyle = {
  marginTop: 'auto',
  background: 'transparent',
  border: 0,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: '.06em',
  cursor: 'pointer',
};
