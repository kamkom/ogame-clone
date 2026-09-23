// Technology icons, ported from the design's Research page (design/data/icons.json). Each is a
// stroked path plus a small filled accent path; keys match `TechnologyDef.icon`.

export const TECH_ICONS: Record<string, { path: string; fill: string }> = {
  energy: {
    path: 'M12 2.5l8.3 4.8v9.4L12 21.5l-8.3-4.8V7.3z',
    fill: 'M13 6.5l-4 6.5h3l-1 4.5 4-6.5h-3z',
  },
  laser: { path: 'M3 12h10 M13 8.5l7 3.5-7 3.5z M3 8h4 M3 16h4', fill: 'M19.5 11h2v2h-2z' },
  ion: { path: 'M5 5h14v14H5z M5 12h14 M12 5v14', fill: 'M11 11h2v2h-2z' },
  plasma: {
    path: 'M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0z M4 12c4-3.2 12-3.2 16 0 M4 12c4 3.2 12 3.2 16 0',
    fill: 'M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0z',
  },
  combustion: {
    path: 'M9 8h8v8H9z M17 10l4-2v8l-4-2 M3 10h6 M5 14h4',
    fill: 'M1.5 11.2h2.2v1.6H1.5z',
  },
  impulse: { path: 'M4 12h6 M10 7l8 5-8 5z M3 8l3 4-3 4', fill: 'M19 11h2v2h-2z' },
  warp: { path: 'M4 6l6 6-6 6 M10 6l6 6-6 6', fill: 'M17.5 10.5l1.5 1.5-1.5 1.5-1.5-1.5z' },
  fold: { path: 'M4 12h5 M15 12h5 M9 7v10 M15 7v10 M9 7l6 10', fill: 'M11.3 11.3h1.4v1.4h-1.4z' },
  weapons: {
    path: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
    fill: 'M11 11h2v2h-2z',
  },
  shield: {
    path: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M8 11.5c2.5-2 5.5-2 8 0',
    fill: 'M11 14h2v2h-2z',
  },
  armor: { path: 'M4 7l8-4 8 4 M4 12l8-4 8 4 M4 17l8-4 8 4', fill: 'M11 19.5h2V21h-2z' },
  graviton: { path: 'M12 3v18 M6 7l6-4 6 4 M6 17l6 4 6-4', fill: 'M10.5 10.5h3v3h-3z' },
  signal: {
    path: 'M12 21V11 M8 21h8 M8.2 7.2a5.4 5.4 0 0 1 7.6 0 M5.5 4.5a9.2 9.2 0 0 1 13 0',
    fill: 'M11 9.8h2v2h-2z',
  },
  compute: {
    path: 'M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4',
    fill: 'M10 10h4v4h-4z',
  },
  astro: {
    path: 'M4 18l9-7.5 M13 10.5l3-3 3.5 3.5-3 3z M9 14.5l2 6 M7 16l-2.5 5',
    fill: 'M19 2.5l.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2z',
  },
  network: {
    path: 'M6 6l6 6 M18 6l-6 6 M12 12v6 M3.5 3.5h5v5h-5z M15.5 3.5h5v5h-5z M9.5 17.5h5v5h-5z',
    fill: 'M11 11h2v2h-2z',
  },
};
