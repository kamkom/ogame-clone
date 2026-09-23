// Duration and countdown formatting for the Structures screen (spec story 41, 88). Pure logic so it
// can be unit-tested without a browser.

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * A build duration in the design's compact form: "1h 12m" with hours, "48m 20s" under an hour, and
 * "30s" under a minute. Minutes and seconds are zero-padded when they follow a larger unit.
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
}

/** A live countdown "HH:MM:SS" from a remaining number of milliseconds (spec: "00:42:18"). */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
