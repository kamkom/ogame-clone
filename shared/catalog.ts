// The shared Structures and Technologies catalog: data only, imported by both the server and the
// web so displayed names, costs and requirements can never disagree. Costs and factors come from the
// rules-reference doc (docs/research/ogame-rules-reference.md §3, §4); the design names come from
// the catalog-mapping doc (docs/research/design-catalog-mapping.md). Requirements are checked against
// current levels only (spec story 43). A missing row means level 0.

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

/** A direct requirement on another Structure or Technology level. */
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
      { key: 'energy-theory', level: 3 },
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
      { key: 'computation', level: 10 },
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
      { key: 'energy-theory', level: 12 },
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

/** The 16 v1 Technology keys (stable, kebab-case, from the design names). */
export type TechnologyKey =
  | 'energy-theory'
  | 'photon-lasers'
  | 'ion-lattice'
  | 'plasma-containment'
  | 'combustion-drive'
  | 'impulse-drive'
  | 'warp-drive'
  | 'fold-drive'
  | 'weapons-systems'
  | 'shield-harmonics'
  | 'armor-plating'
  | 'graviton-lance'
  | 'signal-intelligence'
  | 'computation'
  | 'astrophysics'
  | 'stellar-network';

/** The design's four Research lanes (spec story 52). */
export type TechLane = 'energy' | 'propulsion' | 'military' | 'science';

export const TECH_LANES: { key: TechLane; title: string }[] = [
  { key: 'energy', title: 'ENERGY & PHYSICS' },
  { key: 'propulsion', title: 'PROPULSION' },
  { key: 'military', title: 'MILITARY' },
  { key: 'science', title: 'SCIENCE & EXPANSION' },
];

export interface TechnologyDef {
  key: TechnologyKey;
  /** The design's display name. */
  name: string;
  /** The OGame entity this maps to, for the record. */
  ogame: string;
  lane: TechLane;
  /** Base cost of level 1; level L costs `floor(base × factor^(L−1))` per Resource. */
  baseCost: StructureCost;
  factor: number;
  /** Astrophysics costs are rounded to the nearest 100 in-game (rules reference §2). */
  roundCostTo?: number;
  /** Energy capacity needed (checked, not spent) at level 1, scaled by `factor` (Graviton Lance). */
  energyRequired?: number;
  /** Direct requirements only (rules reference §4). */
  requires: Requirement[];
  /** Icon key into design/data/icons.json. */
  icon: string;
  /** One-sentence description for the detail panel. */
  description: string;
}

// Listed lane by lane in the design's left-to-right order.
export const TECHNOLOGIES: TechnologyDef[] = [
  {
    key: 'energy-theory',
    name: 'Energy Theory',
    ogame: 'Energy Technology',
    lane: 'energy',
    baseCost: { alloy: 0, crystal: 800, deuterium: 400 },
    factor: 2,
    requires: [{ key: 'research-lab', level: 1 }],
    icon: 'energy',
    description: 'Tames high-density power flows; each level boosts Fusion Reactor output.',
  },
  {
    key: 'photon-lasers',
    name: 'Photon Lasers',
    ogame: 'Laser Technology',
    lane: 'energy',
    baseCost: { alloy: 200, crystal: 100, deuterium: 0 },
    factor: 2,
    requires: [{ key: 'energy-theory', level: 2 }],
    icon: 'laser',
    description: 'Focused light at weapon strength, the root of later beam and ion work.',
  },
  {
    key: 'ion-lattice',
    name: 'Ion Lattice',
    ogame: 'Ion Technology',
    lane: 'energy',
    baseCost: { alloy: 1000, crystal: 300, deuterium: 100 },
    factor: 2,
    requires: [
      { key: 'research-lab', level: 4 },
      { key: 'energy-theory', level: 4 },
      { key: 'photon-lasers', level: 5 },
    ],
    icon: 'ion',
    description: 'Charged-particle lattices that lead the way to plasma containment.',
  },
  {
    key: 'plasma-containment',
    name: 'Plasma Containment',
    ogame: 'Plasma Technology',
    lane: 'energy',
    baseCost: { alloy: 2000, crystal: 4000, deuterium: 1000 },
    factor: 2,
    requires: [
      { key: 'energy-theory', level: 8 },
      { key: 'photon-lasers', level: 10 },
      { key: 'ion-lattice', level: 5 },
    ],
    icon: 'plasma',
    description: 'Bottled plasma drives the mines harder: +1% Alloy, +0.66% Crystal per level.',
  },
  {
    key: 'combustion-drive',
    name: 'Combustion Drive',
    ogame: 'Combustion Drive',
    lane: 'propulsion',
    baseCost: { alloy: 400, crystal: 0, deuterium: 600 },
    factor: 2,
    requires: [{ key: 'energy-theory', level: 1 }],
    icon: 'combustion',
    description: 'Reliable chemical thrust; each level makes ships that use it 10% faster.',
  },
  {
    key: 'impulse-drive',
    name: 'Impulse Drive',
    ogame: 'Impulse Drive',
    lane: 'propulsion',
    baseCost: { alloy: 2000, crystal: 4000, deuterium: 600 },
    factor: 2,
    requires: [
      { key: 'research-lab', level: 2 },
      { key: 'energy-theory', level: 1 },
    ],
    icon: 'impulse',
    description: 'Reaction mass hurled at speed; each level makes ships that use it 20% faster.',
  },
  {
    key: 'warp-drive',
    name: 'Warp Drive',
    ogame: 'Hyperspace Drive',
    lane: 'propulsion',
    baseCost: { alloy: 10_000, crystal: 20_000, deuterium: 6000 },
    factor: 2,
    requires: [{ key: 'fold-drive', level: 3 }],
    icon: 'warp',
    description:
      'Folds space just ahead of the hull. Each level makes ships that use it 30% faster.',
  },
  {
    key: 'fold-drive',
    name: 'Fold Drive',
    ogame: 'Hyperspace Technology',
    lane: 'propulsion',
    baseCost: { alloy: 0, crystal: 4000, deuterium: 2000 },
    factor: 2,
    requires: [
      { key: 'research-lab', level: 7 },
      { key: 'energy-theory', level: 5 },
      { key: 'shield-harmonics', level: 5 },
    ],
    icon: 'fold',
    description: 'The theory of folded space behind the Warp Drive; +5% cargo room per level.',
  },
  {
    key: 'weapons-systems',
    name: 'Weapons Systems',
    ogame: 'Weapons Technology',
    lane: 'military',
    baseCost: { alloy: 800, crystal: 200, deuterium: 0 },
    factor: 2,
    requires: [{ key: 'research-lab', level: 4 }],
    icon: 'weapons',
    description: 'Sharper targeting and hotter guns: +10% weapon strength per level.',
  },
  {
    key: 'shield-harmonics',
    name: 'Shield Harmonics',
    ogame: 'Shielding Technology',
    lane: 'military',
    baseCost: { alloy: 200, crystal: 600, deuterium: 0 },
    factor: 2,
    requires: [
      { key: 'research-lab', level: 6 },
      { key: 'energy-theory', level: 3 },
    ],
    icon: 'shield',
    description: 'Tuned deflector fields: +10% shield strength per level.',
  },
  {
    key: 'armor-plating',
    name: 'Armor Plating',
    ogame: 'Armour Technology',
    lane: 'military',
    baseCost: { alloy: 1000, crystal: 0, deuterium: 0 },
    factor: 2,
    requires: [{ key: 'research-lab', level: 2 }],
    icon: 'armor',
    description: 'Layered alloys harden every hull: +10% structural integrity per level.',
  },
  {
    key: 'graviton-lance',
    name: 'Graviton Lance',
    ogame: 'Graviton Technology',
    lane: 'military',
    baseCost: { alloy: 0, crystal: 0, deuterium: 0 },
    factor: 3,
    energyRequired: 300_000,
    requires: [{ key: 'research-lab', level: 12 }],
    icon: 'graviton',
    description: 'Bends gravity itself; needs 300,000 Energy capacity and has no effect in v1 yet.',
  },
  {
    key: 'signal-intelligence',
    name: 'Signal Intelligence',
    ogame: 'Espionage Technology',
    lane: 'science',
    baseCost: { alloy: 200, crystal: 1000, deuterium: 200 },
    factor: 2,
    requires: [{ key: 'research-lab', level: 3 }],
    icon: 'signal',
    description: 'Listening posts and decoders; espionage is not in v1, so no effect yet.',
  },
  {
    key: 'computation',
    name: 'Computation',
    ogame: 'Computer Technology',
    lane: 'science',
    baseCost: { alloy: 0, crystal: 400, deuterium: 600 },
    factor: 2,
    requires: [{ key: 'research-lab', level: 1 }],
    icon: 'compute',
    description: 'Faster fleet and factory computers; level 10 unlocks the Nanite Foundry.',
  },
  {
    key: 'astrophysics',
    name: 'Astrophysics',
    ogame: 'Astrophysics',
    lane: 'science',
    baseCost: { alloy: 4000, crystal: 8000, deuterium: 4000 },
    factor: 1.75,
    roundCostTo: 100,
    requires: [
      { key: 'signal-intelligence', level: 4 },
      { key: 'impulse-drive', level: 3 },
    ],
    icon: 'astro',
    description: 'Charts distant stars for colonies and expeditions; no effect with one Planet.',
  },
  {
    key: 'stellar-network',
    name: 'Stellar Network',
    ogame: 'Intergalactic Research Network',
    lane: 'science',
    baseCost: { alloy: 240_000, crystal: 400_000, deuterium: 160_000 },
    factor: 2,
    requires: [
      { key: 'research-lab', level: 10 },
      { key: 'computation', level: 8 },
      { key: 'fold-drive', level: 8 },
    ],
    icon: 'network',
    description: 'Links Research Labs across Planets; no effect with one Planet.',
  },
];

const TECH_BY_KEY = new Map<string, TechnologyDef>(TECHNOLOGIES.map((t) => [t.key, t]));

/** The Technology definition for a key, or undefined when the key is not in the catalog. */
export function technologyDef(key: string): TechnologyDef | undefined {
  return TECH_BY_KEY.get(key);
}

/** The 9 v1 ship keys: the design's 8 plus the Solar Satellite. */
export type ShipKey =
  | 'interceptor'
  | 'corvette'
  | 'cruiser'
  | 'dreadnought'
  | 'hauler'
  | 'freighter'
  | 'scout-drone'
  | 'salvager'
  | 'solar-satellite';

/**
 * Where a ship counts in Fleet Strength (the design's Combat 338 / Cargo 121 / Support 40).
 * Solar Satellites are an Energy source, left out of fleet numbers (spec story 75).
 */
export type ShipClass = 'combat' | 'cargo' | 'support' | 'energy';

/** Base combat and flight stats (rules reference §10.1; upgrades by Technology are not applied). */
export interface ShipStats {
  attack: number;
  shields: number;
  /** Structural integrity. */
  hull: number;
  speed: number;
  cargo: number;
  fuel: number;
}

export interface ShipDef {
  key: ShipKey;
  /** The design's display name. */
  name: string;
  /** The OGame entity this maps to, for the record. */
  ogame: string;
  /** The role subtitle under the name. */
  role: string;
  shipClass: ShipClass;
  /** Unit price; an Order costs this × quantity (rules reference §2). */
  cost: StructureCost;
  stats: ShipStats;
  /** Direct requirements (rules reference §10.1, [AG] + [WIKI]). */
  requires: Requirement[];
  /** Silhouette key into design/data/ships.json, or null when the art ticket hasn't drawn it. */
  art: string | null;
}

// The design's list order, then the Solar Satellite last (spec story 66).
export const SHIPS: ShipDef[] = [
  {
    key: 'interceptor',
    name: 'Interceptor',
    ogame: 'Light Fighter',
    role: 'Light fighter',
    shipClass: 'combat',
    cost: { alloy: 3000, crystal: 1000, deuterium: 0 },
    stats: { attack: 50, shields: 10, hull: 4000, speed: 12_500, cargo: 50, fuel: 20 },
    requires: [
      { key: 'orbital-shipyard', level: 1 },
      { key: 'combustion-drive', level: 1 },
    ],
    art: 'Interceptor',
  },
  {
    key: 'corvette',
    name: 'Corvette',
    ogame: 'Heavy Fighter',
    role: 'Escort',
    shipClass: 'combat',
    cost: { alloy: 6000, crystal: 4000, deuterium: 0 },
    stats: { attack: 150, shields: 25, hull: 10_000, speed: 10_000, cargo: 100, fuel: 75 },
    requires: [
      { key: 'orbital-shipyard', level: 3 },
      { key: 'armor-plating', level: 2 },
      { key: 'impulse-drive', level: 2 },
    ],
    art: 'Corvette',
  },
  {
    key: 'cruiser',
    name: 'Cruiser',
    ogame: 'Cruiser',
    role: 'Line ship',
    shipClass: 'combat',
    cost: { alloy: 20_000, crystal: 7000, deuterium: 2000 },
    stats: { attack: 400, shields: 50, hull: 27_000, speed: 15_000, cargo: 800, fuel: 300 },
    requires: [
      { key: 'orbital-shipyard', level: 5 },
      { key: 'impulse-drive', level: 4 },
      { key: 'ion-lattice', level: 2 },
    ],
    art: 'Cruiser',
  },
  {
    key: 'dreadnought',
    name: 'Dreadnought',
    ogame: 'Battleship',
    role: 'Capital ship',
    shipClass: 'combat',
    cost: { alloy: 45_000, crystal: 15_000, deuterium: 0 },
    stats: { attack: 1000, shields: 200, hull: 60_000, speed: 10_000, cargo: 1500, fuel: 500 },
    requires: [
      { key: 'orbital-shipyard', level: 7 },
      { key: 'warp-drive', level: 4 },
    ],
    art: 'Dreadnought',
  },
  {
    key: 'hauler',
    name: 'Hauler',
    ogame: 'Small Cargo',
    role: 'Small cargo',
    shipClass: 'cargo',
    cost: { alloy: 2000, crystal: 2000, deuterium: 0 },
    stats: { attack: 5, shields: 10, hull: 4000, speed: 5000, cargo: 5000, fuel: 10 },
    requires: [
      { key: 'orbital-shipyard', level: 2 },
      { key: 'combustion-drive', level: 2 },
    ],
    art: 'Hauler',
  },
  {
    key: 'freighter',
    name: 'Freighter',
    ogame: 'Large Cargo',
    role: 'Large cargo',
    shipClass: 'cargo',
    cost: { alloy: 6000, crystal: 6000, deuterium: 0 },
    stats: { attack: 5, shields: 25, hull: 12_000, speed: 7500, cargo: 25_000, fuel: 50 },
    requires: [
      { key: 'orbital-shipyard', level: 4 },
      { key: 'combustion-drive', level: 6 },
    ],
    art: 'Freighter',
  },
  {
    key: 'scout-drone',
    name: 'Scout Drone',
    ogame: 'Espionage Probe',
    role: 'Espionage',
    shipClass: 'support',
    cost: { alloy: 0, crystal: 1000, deuterium: 0 },
    stats: { attack: 0, shields: 0, hull: 1000, speed: 100_000_000, cargo: 0, fuel: 1 },
    requires: [
      { key: 'orbital-shipyard', level: 3 },
      { key: 'combustion-drive', level: 3 },
      { key: 'signal-intelligence', level: 2 },
    ],
    art: 'Scout Drone',
  },
  {
    key: 'salvager',
    name: 'Salvager',
    ogame: 'Recycler',
    role: 'Debris recovery',
    shipClass: 'cargo',
    cost: { alloy: 10_000, crystal: 6000, deuterium: 2000 },
    stats: { attack: 1, shields: 10, hull: 16_000, speed: 2000, cargo: 20_000, fuel: 300 },
    requires: [
      { key: 'orbital-shipyard', level: 4 },
      { key: 'combustion-drive', level: 6 },
      { key: 'shield-harmonics', level: 2 },
    ],
    art: 'Salvager',
  },
  {
    key: 'solar-satellite',
    name: 'Solar Satellite',
    ogame: 'Solar Satellite',
    role: 'Energy',
    shipClass: 'energy',
    cost: { alloy: 0, crystal: 2000, deuterium: 500 },
    stats: { attack: 1, shields: 1, hull: 2000, speed: 0, cargo: 0, fuel: 0 },
    requires: [{ key: 'orbital-shipyard', level: 1 }],
    art: null,
  },
];

const SHIP_BY_KEY = new Map<string, ShipDef>(SHIPS.map((s) => [s.key, s]));

/** The ship definition for a key, or undefined when the key is not in the catalog. */
export function shipDef(key: string): ShipDef | undefined {
  return SHIP_BY_KEY.get(key);
}

/** The display name of any catalog Structure, Technology or ship key (the key itself when unknown). */
export function catalogName(key: string): string {
  return structureDef(key)?.name ?? technologyDef(key)?.name ?? shipDef(key)?.name ?? key;
}

export interface RequirementStatus {
  key: string;
  name: string;
  required: number;
  current: number;
  met: boolean;
}

/**
 * Each direct requirement of `def` against `levelOf` (a Structure or Technology key's current,
 * finished level — never one still being built).
 */
export function requirementStatus(
  def: { requires: Requirement[] },
  levelOf: (key: string) => number,
): RequirementStatus[] {
  return def.requires.map((r) => {
    const current = levelOf(r.key);
    return {
      key: r.key,
      name: catalogName(r.key),
      required: r.level,
      current,
      met: current >= r.level,
    };
  });
}
