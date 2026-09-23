// The shared Structures catalog: data only, imported by both the server and the web so displayed
// names, costs and requirements can never disagree. Costs and factors come from the rules-reference
// doc (docs/research/ogame-rules-reference.md §3); the design names come from the catalog-mapping
// doc (docs/research/design-catalog-mapping.md). Requirements are stored as data and enforced in a
// later ticket. A missing row means level 0.

/** The 13 v1 Structure keys (stable, kebab-case). */
export type StructureKey =
  | 'alloy-extractor'
  | 'crystal-refinery'
  | 'deuterium-synthesizer'
  | 'solar-array'
  | 'fusion-reactor'
  | 'robotics-works'
  | 'orbital-shipyard'
  | 'research-lab'
  | 'nanite-foundry'
  | 'terraformer'
  | 'alloy-depot'
  | 'crystal-vault'
  | 'deuterium-tank';

/** The filter tab a Structure belongs to (spec story 36: Resources · 5 / Facilities · 5 / Storage · 3). */
export type StructureTab = 'resources' | 'facilities' | 'storage';

export interface StructureCost {
  alloy: number;
  crystal: number;
  deuterium: number;
}

/** A direct requirement on another Structure or Technology level (enforced in a later ticket). */
export interface Requirement {
  key: string;
  level: number;
}

export interface StructureDef {
  key: StructureKey;
  /** The design's display name. */
  name: string;
  /** The OGame entity this maps to, for the record. */
  ogame: string;
  category: string;
  tab: StructureTab;
  /** Base cost of level 1; level L costs `floor(base × factor^(L−1))` per Resource. */
  baseCost: StructureCost;
  factor: number;
  requires: Requirement[];
  /** Art key into design/data/structure-art.json, or null when the art ticket hasn't drawn it. */
  art: string | null;
  /** One-sentence description for the detail panel. */
  description: string;
  /** The Nanite Foundry skips the early-level build-time divisor (rules reference §5). */
  isNaniteFoundry?: boolean;
}

export const STRUCTURES: StructureDef[] = [
  {
    key: 'alloy-extractor',
    name: 'Alloy Extractor',
    ogame: 'Metal Mine',
    category: 'RESOURCES',
    tab: 'resources',
    baseCost: { alloy: 60, crystal: 15, deuterium: 0 },
    factor: 1.5,
    requires: [],
    art: 'extractor',
    description: "Strip-mines raw alloy from the planet's crust.",
  },
  {
    key: 'crystal-refinery',
    name: 'Crystal Refinery',
    ogame: 'Crystal Mine',
    category: 'RESOURCES',
    tab: 'resources',
    baseCost: { alloy: 48, crystal: 24, deuterium: 0 },
    factor: 1.6,
    requires: [],
    art: 'refinery',
    description: 'Cuts and grows crystal lattices from deep seams.',
  },
  {
    key: 'deuterium-synthesizer',
    name: 'Deuterium Synthesizer',
    ogame: 'Deuterium Synthesizer',
    category: 'RESOURCES',
    tab: 'resources',
    baseCost: { alloy: 225, crystal: 75, deuterium: 0 },
    factor: 1.5,
    requires: [],
    art: 'synth',
    description:
      "Filters heavy hydrogen from the planet's cold seas; output falls on warmer worlds.",
  },
  {
    key: 'solar-array',
    name: 'Solar Array',
    ogame: 'Solar Plant',
    category: 'ENERGY',
    tab: 'resources',
    baseCost: { alloy: 75, crystal: 30, deuterium: 0 },
    factor: 1.5,
    requires: [],
    art: 'solar',
    description: 'Fans of panels turn starlight into Energy for the mines.',
  },
  {
    key: 'fusion-reactor',
    name: 'Fusion Reactor',
    ogame: 'Fusion Reactor',
    category: 'ENERGY',
    tab: 'resources',
    baseCost: { alloy: 900, crystal: 360, deuterium: 180 },
    factor: 1.8,
    requires: [
      { key: 'deuterium-synthesizer', level: 5 },
      { key: 'energy-technology', level: 3 },
    ],
    art: 'fusion',
    description: 'Fuses Deuterium into a steady, powerful supply of Energy.',
  },
  {
    key: 'robotics-works',
    name: 'Robotics Works',
    ogame: 'Robotics Factory',
    category: 'FACILITIES',
    tab: 'facilities',
    baseCost: { alloy: 400, crystal: 120, deuterium: 200 },
    factor: 2,
    requires: [],
    art: 'robotics',
    description: 'Automated crews shorten every Structure upgrade.',
  },
  {
    key: 'orbital-shipyard',
    name: 'Orbital Shipyard',
    ogame: 'Shipyard',
    category: 'FACILITIES',
    tab: 'facilities',
    baseCost: { alloy: 400, crystal: 200, deuterium: 100 },
    factor: 2,
    requires: [{ key: 'robotics-works', level: 2 }],
    art: 'shipyard',
    description: 'Docks and gantries where ships are assembled.',
  },
  {
    key: 'research-lab',
    name: 'Research Lab',
    ogame: 'Research Lab',
    category: 'FACILITIES',
    tab: 'facilities',
    baseCost: { alloy: 200, crystal: 400, deuterium: 200 },
    factor: 2,
    requires: [],
    art: 'research',
    description: "Laboratories that drive the Planet's Research.",
  },
  {
    key: 'nanite-foundry',
    name: 'Nanite Foundry',
    ogame: 'Nanite Factory',
    category: 'FACILITIES',
    tab: 'facilities',
    baseCost: { alloy: 1_000_000, crystal: 500_000, deuterium: 100_000 },
    factor: 2,
    requires: [
      { key: 'robotics-works', level: 10 },
      { key: 'computer-technology', level: 10 },
    ],
    art: 'nanite',
    description: 'Self-replicating nanites halve build times with every level.',
    isNaniteFoundry: true,
  },
  {
    key: 'terraformer',
    name: 'Terraformer',
    ogame: 'Terraformer',
    category: 'FACILITIES',
    tab: 'facilities',
    baseCost: { alloy: 0, crystal: 50_000, deuterium: 100_000 },
    factor: 2,
    requires: [
      { key: 'nanite-foundry', level: 1 },
      { key: 'energy-technology', level: 12 },
    ],
    art: null,
    description: 'Reshapes the surface to open new Fields.',
  },
  {
    key: 'alloy-depot',
    name: 'Alloy Depot',
    ogame: 'Metal Storage',
    category: 'STORAGE',
    tab: 'storage',
    baseCost: { alloy: 1000, crystal: 0, deuterium: 0 },
    factor: 2,
    requires: [],
    art: null,
    description: 'Reinforced silos that raise Alloy Storage Capacity.',
  },
  {
    key: 'crystal-vault',
    name: 'Crystal Vault',
    ogame: 'Crystal Storage',
    category: 'STORAGE',
    tab: 'storage',
    baseCost: { alloy: 1000, crystal: 500, deuterium: 0 },
    factor: 2,
    requires: [],
    art: null,
    description: 'Sealed vaults that raise Crystal Storage Capacity.',
  },
  {
    key: 'deuterium-tank',
    name: 'Deuterium Tank',
    ogame: 'Deuterium Tank',
    category: 'STORAGE',
    tab: 'storage',
    baseCost: { alloy: 1000, crystal: 1000, deuterium: 0 },
    factor: 2,
    requires: [],
    art: null,
    description: 'Cryogenic tanks that raise Deuterium Storage Capacity.',
  },
];

const BY_KEY = new Map<string, StructureDef>(STRUCTURES.map((s) => [s.key, s]));

/** The Structure definition for a key, or undefined when the key is not in the catalog. */
export function structureDef(key: string): StructureDef | undefined {
  return BY_KEY.get(key);
}
