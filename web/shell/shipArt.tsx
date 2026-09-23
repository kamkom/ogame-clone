// Ship silhouettes (64×32), ported from the design's Shipyard page (design/data/ships.json), keyed
// by `ShipDef.art`, plus the Cruiser's large blueprint. The Solar Satellite has no design art yet,
// so it gets a stand-in silhouette until the art ticket (#31) draws one.

import type { ShipDef } from '#shared/catalog.ts';

interface ShipPaths {
  hull: string;
  detail: string;
  glow: string;
}

const SHIP_ART: Record<string, ShipPaths> = {
  Interceptor: {
    hull: 'M8 16 L22 12.5 L40 13.5 L58 16 L40 18.5 L22 19.5 Z M22 12.5 L17 4 H25 L33 13 M22 19.5 L17 28 H25 L33 19',
    detail: 'M44 16 H52 M28 16 H38',
    glow: 'M3 14.5h5v3H3z',
  },
  Corvette: {
    hull: 'M5 12 H14 L20 9 H42 L60 16 L42 23 H20 L14 20 H5 Z',
    detail: 'M20 9 V23 M28 12.5 H44 M28 19.5 H44',
    glow: 'M1 12.5h4v2.5H1z M1 17h4v2.5H1z',
  },
  Cruiser: {
    hull: 'M5 10 L13 7 H44 L62 16 L44 25 H13 L5 22 Z',
    detail: 'M13 7 V25 M22 11 H40 M22 21 H40 M46 16 H54',
    glow: 'M1 11h4v3H1z M1 18h4v3H1z',
  },
  Dreadnought: {
    hull: 'M3 9 L11 4 H48 L62 12 V20 L48 28 H11 L3 23 Z',
    detail: 'M11 4 V28 M22 4 V28 M32 9 H50 M32 23 H50 M26 16 H56',
    glow: 'M0 8.5h3v3.5H0z M0 14.2h3v3.6H0z M0 20h3v3.5H0z',
  },
  Hauler: {
    hull: 'M7 9 H44 L56 12 V20 L44 23 H7 Z',
    detail: 'M17 9 V23 M27 9 V23 M37 9 V23',
    glow: 'M3 12h4v8H3z',
  },
  Freighter: {
    hull: 'M5 6 H42 L50 10 L60 16 L50 22 L42 26 H5 Z',
    detail: 'M5 16 H50 M15 6 V26 M29 6 V26',
    glow: 'M1 8.5h4v4H1z M1 19.5h4v4H1z',
  },
  'Scout Drone': {
    hull: 'M22 16 A10 6 0 1 0 42 16 A10 6 0 1 0 22 16 Z',
    detail: 'M32 10 V4 M32 22 V28 M42 16 H56 M28 16 H36',
    glow: 'M18 15h4v2h-4z',
  },
  Salvager: {
    hull: 'M7 11 H38 L46 14 V18 L38 21 H7 Z',
    detail: 'M46 16 L54 8 L60 10 M46 16 L54 24 L60 22 M18 11 V21',
    glow: 'M3 13h4v6H3z',
  },
};

// Stand-in until #31: two panel wings on a small core.
const PLACEHOLDER: ShipPaths = {
  hull: 'M4 9 H22 V23 H4 Z M42 9 H60 V23 H42 Z M26 12 H38 V20 H26 Z',
  detail: 'M22 16 H26 M38 16 H42 M10 9 V23 M16 9 V23 M48 9 V23 M54 9 V23',
  glow: 'M30 14.5h4v3h-4z',
};

function pathsFor(def: ShipDef): ShipPaths {
  return (def.art && SHIP_ART[def.art]) || PLACEHOLDER;
}

/** A ship's 64×32 silhouette; `dim` is the design's muted style for waiting queue rows. */
export function ShipSilhouette({
  def,
  width = 64,
  height = 32,
  dim = false,
}: {
  def: ShipDef;
  width?: number;
  height?: number;
  dim?: boolean;
}) {
  const p = pathsFor(def);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 32"
      fill="none"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d={p.hull}
        fill={dim ? 'rgba(159,177,197,0.08)' : 'var(--art-hull-fill)'}
        stroke={dim ? 'var(--text-muted)' : 'var(--art-hull)'}
        strokeWidth={1.3}
      />
      <path d={p.detail} stroke={dim ? '#3d4d60' : 'var(--art-detail)'} strokeWidth={1} />
      {!dim && <path d={p.glow} fill="var(--accent)" />}
    </svg>
  );
}

/**
 * The detail panel's blueprint: the design's Cruiser drawing, or for any other ship its silhouette
 * scaled up until the art ticket draws each one.
 */
export function ShipBlueprint({ def }: { def: ShipDef }) {
  if (def.key !== 'cruiser') {
    const p = pathsFor(def);
    return (
      <svg
        width="448"
        height="224"
        viewBox="0 0 64 32"
        fill="none"
        strokeLinejoin="round"
        aria-label={`${def.name} blueprint`}
      >
        <path
          d={p.hull}
          fill="rgba(159,177,197,0.08)"
          stroke="var(--art-blueprint)"
          strokeWidth={0.3}
        />
        <path d={p.detail} stroke="var(--art-blueprint-detail)" strokeWidth={0.22} />
        <path d={p.glow} fill="var(--accent)" fillOpacity={0.85} />
      </svg>
    );
  }
  return (
    <svg
      width="560"
      height="220"
      viewBox="0 0 280 110"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-label="Cruiser blueprint"
    >
      <path
        d="M14 38 L52 24 H198 L268 55 L198 86 H52 L14 72 Z"
        fill="rgba(159,177,197,0.08)"
        stroke="var(--art-blueprint)"
        strokeWidth={1}
      />
      <path
        d="M52 24 V86 M198 24 L208 55 L198 86 M62 36 H186 M62 74 H186 M24 50 H44 M24 60 H44"
        stroke="var(--art-blueprint-detail)"
        strokeWidth={0.7}
      />
      <path
        d="M148 47 H180 L188 55 L180 63 H148 Z"
        fill="rgba(95,227,192,0.10)"
        stroke="var(--accent)"
        strokeWidth={0.8}
      />
      <path
        d="M86 36 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M116 36 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M86 74 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M116 74 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0"
        stroke="var(--art-blueprint)"
        strokeWidth={0.8}
      />
      <path
        d="M91 36 H103 M121 36 H133 M91 74 H103 M121 74 H133"
        stroke="var(--art-blueprint)"
        strokeWidth={1.4}
      />
      <path d="M4 32 h10 v12 H4 z M4 66 h10 v12 H4 z" fill="var(--accent)" fillOpacity={0.85} />
      <path
        d="M52 100 H198 M52 97 V103 M198 97 V103"
        stroke="var(--art-blueprint-detail)"
        strokeWidth={0.6}
      />
      <text
        x="125"
        y="98"
        textAnchor="middle"
        fill="var(--text-muted)"
        fontFamily="Chakra Petch, sans-serif"
        fontSize="6"
      >
        184 M
      </text>
      <path d="M208 55 L236 14 H262" stroke="var(--art-blueprint-detail)" strokeWidth={0.6} />
      <text
        x="238"
        y="11"
        fill="var(--text-muted)"
        fontFamily="Chakra Petch, sans-serif"
        fontSize="6"
      >
        BRIDGE
      </text>
    </svg>
  );
}
