// Ship silhouettes (64×32) and blueprints (280×110) from the design data (design/data/ships.json,
// blueprints.json), keyed by `ShipDef.art`. The Solar Satellite and the blueprints beyond the
// Cruiser's are drawn in the same style (design/drawn-art.json).

import type { ShipDef } from '#shared/catalog.ts';
import { blueprintFor, silhouetteFor } from '../lib/art.ts';

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
  const p = silhouetteFor(def.art);
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

/** The detail panel's blueprint, in the layers of the design's Cruiser drawing. */
export function ShipBlueprint({ def }: { def: ShipDef }) {
  const b = blueprintFor(def.art);
  const labelStyle = {
    fill: 'var(--text-muted)',
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: 6,
  };
  return (
    <svg
      width="560"
      height="220"
      viewBox="0 0 280 110"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-label={`${def.name} blueprint`}
    >
      <path
        d={b.hull}
        fill="rgba(159,177,197,0.08)"
        stroke="var(--art-blueprint)"
        strokeWidth={1}
      />
      <path d={b.detail} stroke="var(--art-blueprint-detail)" strokeWidth={0.7} />
      <path
        d={b.module}
        fill="var(--accent)"
        fillOpacity={0.1}
        stroke="var(--accent)"
        strokeWidth={0.8}
      />
      {b.fixtures && <path d={b.fixtures} stroke="var(--art-blueprint)" strokeWidth={0.8} />}
      {b.barrels && <path d={b.barrels} stroke="var(--art-blueprint)" strokeWidth={1.4} />}
      <path d={b.glow} fill="var(--accent)" fillOpacity={0.85} />
      <path d={b.dimension.path} stroke="var(--art-blueprint-detail)" strokeWidth={0.6} />
      <text x={b.dimension.x} y={b.dimension.y} textAnchor="middle" style={labelStyle}>
        {b.dimension.label}
      </text>
      <path d={b.callout.path} stroke="var(--art-blueprint-detail)" strokeWidth={0.6} />
      <text x={b.callout.x} y={b.callout.y} style={labelStyle}>
        {b.callout.label}
      </text>
    </svg>
  );
}
