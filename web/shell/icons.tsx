import type { CSSProperties } from 'react';

// Nav rail and resource-chip iconography, ported from the design (D screens / auth prototype).
// Each icon is a stroked path plus an optional filled accent path.

export interface NavItem {
  label: string;
  path: string;
  fill: string;
  /** v1 nav lands on Overview; Fleet/Galaxy/Alliance are SOON. */
  soon: boolean;
}

export const NAV: NavItem[] = [
  {
    label: 'Overview',
    soon: false,
    path: 'M17.5 12a5.5 5.5 0 1 1-11 0a5.5 5.5 0 1 1 11 0z M3.6 15.8c-1.4-1.9 2.6-5 8.2-6.8s10-1.8 8.6.2',
    fill: 'M17.4 4.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z',
  },
  {
    label: 'Build',
    soon: false,
    path: 'M3 21h18 M5.5 21v-9l3.5-3.5h6l3.5 3.5v9 M10 21v-5h4v5 M12 8.5V3',
    fill: 'M10.8 2h2.4v2.4h-2.4z',
  },
  {
    label: 'Research',
    soon: false,
    path: 'M12 4.5l7.5 13h-15z M1.5 12.5h6.3 M15.6 11.2l6.9-2.7 M16.2 12.8l6.3.9 M16.6 14.4l5.6 3.7',
    fill: 'M12 10.8l1.3 1.9-1.3 1.9-1.3-1.9z',
  },
  {
    label: 'Shipyard',
    soon: false,
    path: 'M3 7.5V4h3.5 M21 7.5V4h-3.5 M3 16.5V20h3.5 M21 16.5V20h-3.5 M7.5 12l3.5-3h5l2.5 3-2.5 3h-5z',
    fill: 'M5 11h2.2v2H5z',
  },
  {
    label: 'Fleet',
    soon: true,
    path: 'M5.5 13.5l2.8 6H2.7z M18.5 13.5l2.8 6h-5.6z',
    fill: 'M12 3l3.6 7.2H8.4z',
  },
  {
    label: 'Galaxy',
    soon: true,
    path: 'M12 12c0-3.2 3.1-5.4 6.5-4.3 M12 12c0 3.2-3.1 5.4-6.5 4.3 M12 12c3.2 0 5.4 3.1 4.3 6.5 M12 12c-3.2 0-5.4-3.1-4.3-6.5',
    fill: 'M12 10.3l1.7 1.7-1.7 1.7-1.7-1.7z',
  },
  {
    label: 'Alliance',
    soon: true,
    path: 'M8.5 3.5l5.5 2.2V11c0 4.3-2.6 7-5.5 8.6C5.6 18 3 15.3 3 11V5.7z M16 7.2l5 2V13c0 3.3-2 5.4-4.6 6.8',
    fill: 'M7.5 9.5h2v2h-2z',
  },
];

export interface ResourceMeta {
  name: string;
  cssVar: string;
  path: string;
  fill: string;
}

export const RESOURCES: ResourceMeta[] = [
  {
    name: 'ALLOY',
    cssVar: '--alloy',
    path: 'M3.5 17l3-5.5h11l3 5.5z M7.5 11.5l2-4.5h5l2 4.5',
    fill: 'M10.5 13.5h3v1.5h-3z',
  },
  {
    name: 'CRYSTAL',
    cssVar: '--crystal',
    path: 'M12 2.5l5 7-5 12-5-12z M7 9.5h10',
    fill: 'M12 2.5l2.4 3.4H9.6z',
  },
  {
    name: 'DEUTERIUM',
    cssVar: '--deuterium',
    path: 'M12 3c3.5 4.4 5.5 7.4 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 10.4 8.5 7.4 12 3z',
    fill: 'M10.2 14a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0z',
  },
  {
    name: 'ENERGY',
    cssVar: '--energy',
    path: 'M12 2.5l8.3 4.8v9.4L12 21.5l-8.3-4.8V7.3z',
    fill: 'M13 6.5l-4 6.5h3l-1 4.5 4-6.5h-3z',
  },
];

interface IconProps {
  path: string;
  fill: string;
  size?: number;
  color?: string;
}

/** A two-path glyph: a stroked outline and an optional filled accent. */
export function Icon({ path, fill, size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
      {fill && <path d={fill} fill={color} stroke="none" />}
    </svg>
  );
}

/** The diamond app logo. */
export function Logo({ size = 40 }: { size?: number }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    border: '1.5px solid var(--accent)',
    transform: 'rotate(45deg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  return (
    <div style={style}>
      <div style={{ width: size * 0.3, height: size * 0.3, background: 'var(--accent)' }} />
    </div>
  );
}
