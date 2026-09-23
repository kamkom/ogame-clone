// Catalog art components fed from the design data (web/lib/art.ts): line icons and Structure
// illustrations. The accent slot is `var(--accent)`, so the design's four accent options recolour
// the new art the same way as the old.

import { useId } from 'react';
import { iconFor, illustrationFor } from '../lib/art.ts';

/** A 24×24 catalog icon: the stroke in `color`, the small fill in the accent. */
export function ArtIcon({
  art,
  size,
  strokeWidth = 1.4,
  color = 'var(--text-icon)',
}: {
  art: string;
  size: number;
  strokeWidth?: number;
  color?: string;
}) {
  const icon = iconFor(art);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d={icon.stroke} />
      <path d={icon.fill} fill="var(--accent)" stroke="none" />
    </svg>
  );
}

/**
 * A Structure's 300×224 scene, filling its (relatively positioned) box from the bottom. Each
 * instance gets its own glow filter id, since a page shows many at once.
 */
export function StructureIllustration({ art, skyWidth = 1.3 }: { art: string; skyWidth?: number }) {
  const a = illustrationFor(art);
  const glowId = useId();
  return (
    <svg
      viewBox="0 0 300 224"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path
        d={a.sky}
        fill="none"
        stroke="var(--art-sky)"
        strokeWidth={skyWidth}
        strokeLinecap="round"
      />
      <path d={a.far} fill="var(--art-far)" stroke="var(--art-far-line)" strokeWidth={1} />
      <path
        d={a.main}
        fill="var(--art-main)"
        stroke="var(--art-main-line)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path
        d={a.det}
        fill="none"
        stroke="var(--art-det)"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={a.glow} fill="var(--accent)" filter={`url(#${glowId})`} opacity={0.8} />
      <path d={a.glow} fill="var(--accent)" />
    </svg>
  );
}
