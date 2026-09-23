// Lookups into the design's art data (design/data/*.json): the originals the bundle drew plus the
// items it didn't (design/drawn-art.json, merged in by design/extract.mjs). Every catalog item has a
// key here, so a missing key is a bug and throws rather than falling back to someone else's art.

import blueprints from '../../design/data/blueprints.json' with { type: 'json' };
import icons from '../../design/data/icons.json' with { type: 'json' };
import ships from '../../design/data/ships.json' with { type: 'json' };
import structureArt from '../../design/data/structure-art.json' with { type: 'json' };

/** A 24×24 line icon: a stroked path plus a small accent-filled path. */
export interface IconArt {
  stroke: string;
  fill: string;
}

/** A 64×32 ship silhouette. */
export interface SilhouetteArt {
  hull: string;
  detail: string;
  glow: string;
}

/** A 300×224 Structure scene, back to front; `glow` takes the accent. */
export interface IllustrationArt {
  sky: string;
  far: string;
  main: string;
  det: string;
  glow: string;
}

/** A label on a blueprint: its leader line and where the text sits. */
export interface BlueprintLabel {
  path: string;
  x: number;
  y: number;
  label: string;
}

/** A 280×110 ship blueprint in the Cruiser's layers; `module` and `glow` take the accent. */
export interface BlueprintArt {
  hull: string;
  detail: string;
  module: string;
  fixtures: string;
  barrels: string;
  glow: string;
  dimension: BlueprintLabel;
  callout: BlueprintLabel;
}

function lookup<T>(set: Record<string, T>, kind: string, key: string): T {
  const art = Object.hasOwn(set, key) ? set[key] : undefined;
  if (!art) throw new Error(`No ${kind} art for "${key}"`);
  return art;
}

export const iconFor = (key: string): IconArt => lookup<IconArt>(icons, 'icon', key);
export const illustrationFor = (key: string): IllustrationArt =>
  lookup<IllustrationArt>(structureArt, 'illustration', key);
export const silhouetteFor = (key: string): SilhouetteArt =>
  lookup<SilhouetteArt>(ships, 'silhouette', key);
export const blueprintFor = (key: string): BlueprintArt =>
  lookup<BlueprintArt>(blueprints, 'blueprint', key);
