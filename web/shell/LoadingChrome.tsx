import { Rail } from './Rail.tsx';
import { ServerBanner } from './ErrorBanner.tsx';

interface LoadingChromeProps {
  failureCount: number;
  failureReason: unknown;
}

/**
 * The stage chrome while a first load is in flight (the session, then the Planet): the rail and
 * a muted "Loading…" line where the screen content goes, plus the retry banner if it fails.
 */
export function LoadingChrome({ failureCount, failureReason }: LoadingChromeProps) {
  return (
    <>
      <Rail active={-1} onNavigate={() => {}} />
      <div style={loadingStyle}>Loading…</div>
      <ServerBanner failureCount={failureCount} failureReason={failureReason} />
    </>
  );
}

// Where the screen content goes: right of the rail, below the top bar.
const loadingStyle = {
  position: 'absolute' as const,
  left: 'calc(var(--rail-w) + 24px)',
  top: 'calc(var(--topbar-h) + 24px)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
};
