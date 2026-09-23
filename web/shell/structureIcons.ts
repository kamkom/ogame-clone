// Structure list icons, ported from the design's Command Deck (design/data/icons.json). Each is a
// stroked path plus a small filled accent path; keys match `StructureDef.art`. A Structure the
// design never drew (art null: Terraformer and the three stores) gets the generic Build icon.

export const STRUCTURE_ICONS: Record<string, { path: string; fill: string }> = {
  extractor: {
    path: 'M3 21h18 M7.5 21l2.5-13h4l2.5 13 M8.7 14.5h6.6 M12 8V3 M9 4.5h6',
    fill: 'M11 17h2v4h-2z',
  },
  refinery: {
    path: 'M3 21h18 M5.5 21l-1.5-6 2.5-4.5L9 15l-1.5 6 M13 21l-2-8.5 4-7 4 7-2 8.5',
    fill: 'M15 5.5l1.3 2.3h-2.6z',
  },
  synth: {
    path: 'M6 5h7v16H6z M13 9h4.5v9.5 M17.5 18.5H21 M6 10.5h7',
    fill: 'M7.3 15h4.4v4.7H7.3z',
  },
  solar: {
    path: 'M2.5 15l5-8.5h14l-5 8.5z M5 10.8h14 M11.5 6.5l-2.6 8.5 M16.5 6.5l-2.6 8.5 M12 15v6 M8 21h8',
    fill: 'M3 2.5h2.5V5H3z',
  },
  fusion: {
    path: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M12 3a9 9 0 0 1 9 9 M12 21a9 9 0 0 1-9-9 M5.6 5.6l2.3 2.3 M18.4 18.4l-2.3-2.3',
    fill: 'M11 11h2v2h-2z',
  },
  robotics: {
    path: 'M3 21h8 M7 21v-4 M7 17l5.5-6.5 M12.5 10.5l5.5 2 M18 12.5l2 3.5 M18 12.5l3-1.5',
    fill: 'M11.5 9.5h2.2v2.2h-2.2z',
  },
  nanite: { path: 'M4 8l4-4h8l4 4v8l-4 4H8l-4-4z M9 9h6v6H9z', fill: 'M11.2 11.2h1.6v1.6h-1.6z' },
  shipyard: {
    path: 'M3 7.5V4h3.5 M21 7.5V4h-3.5 M3 16.5V20h3.5 M21 16.5V20h-3.5 M7.5 12l3.5-3h5l2.5 3-2.5 3h-5z',
    fill: 'M5 11h2.2v2H5z',
  },
  research: {
    path: 'M12 4.5l7.5 13h-15z M1.5 12.5h6.3 M15.6 11.2l6.9-2.7 M16.2 12.8l6.3.9 M16.6 14.4l5.6 3.7',
    fill: 'M12 10.8l1.3 1.9-1.3 1.9-1.3-1.9z',
  },
};

export const GENERIC_STRUCTURE_ICON = {
  path: 'M3 21h18 M5.5 21v-9l3.5-3.5h6l3.5 3.5v9 M10 21v-5h4v5 M12 8.5V3',
  fill: 'M10.8 2h2.4v2.4h-2.4z',
};

export function structureIcon(art: string | null): { path: string; fill: string } {
  return (art && STRUCTURE_ICONS[art]) || GENERIC_STRUCTURE_ICON;
}
