// Small controls shared by the Structures and Research screens for the #14 UI states: the lock /
// clock / ✕ / ✓ glyphs, the ✕ Cancel button, ✓/✕ check rows and the disabled big button.

import type { ReactNode } from 'react';

function Glyph({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Glyph>
  );
}
export function ClockIcon({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Glyph>
  );
}
export function XIcon({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Glyph>
  );
}
export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Glyph>
  );
}

/** One ✓/✕ row: a requirement or a Resource, with its current / required figures. */
export function CheckRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  const tone = ok ? 'var(--accent)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <span style={{ display: 'flex', color: tone }}>{ok ? <CheckIcon /> : <XIcon />}</span>
      <span style={{ flexGrow: 1, color: ok ? 'var(--text-body)' : 'var(--text)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', color: tone }}>{value}</span>
    </div>
  );
}

/** The ✕ on an in-progress row: Cancel with a 100% refund. */
export function CancelX({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Cancel ${label}`}
      title="Cancel · refund 100%"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={cancelXStyle}
    >
      <XIcon size={11} />
    </button>
  );
}

export const disabledBigButtonStyle = {
  height: 50,
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--icon-well)',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: '0.08em',
  cursor: 'not-allowed',
};

const cancelXStyle = {
  width: 24,
  height: 24,
  flexShrink: 0,
  padding: 0,
  borderRadius: 6,
  border: '1px solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text-label)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

export const reasonListStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
  padding: '12px 14px',
  borderRadius: 10,
  background: 'var(--panel-raised)',
  border: '1px solid var(--line)',
};
