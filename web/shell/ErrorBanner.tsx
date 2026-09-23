import { useEffect, useState } from 'react';
import { showsServerBanner } from '../lib/queryErrors.ts';

/**
 * Shows the error banner while a query is failing to reach the server (TanStack is retrying),
 * until the Player dismisses it. A success (failureCount back to 0) re-arms it.
 */
export function ServerBanner({
  failureCount,
  failureReason,
}: {
  failureCount: number;
  failureReason: unknown;
}) {
  const [dismissed, setDismissed] = useState(false);
  const failing = failureCount > 0 && showsServerBanner(failureReason);
  useEffect(() => {
    if (!failing) setDismissed(false);
  }, [failing]);
  if (!failing || dismissed) return null;
  return <ErrorBanner onDismiss={() => setDismissed(true)} />;
}

/**
 * The dismissible red banner at the top of the stage, shown while requests to an unreachable
 * server are retried. It uses the auth screen's `.banner` look on the stage background.
 */
export function ErrorBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="alert" className="banner" style={bannerStyle}>
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
  alignItems: 'center',
  gap: 12,
  padding: '8px 14px',
  background: 'var(--bg)',
  boxShadow: 'inset 0 0 0 999px rgba(255, 138, 138, 0.07)',
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
