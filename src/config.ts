// Every gameplay number lives here. The hidden tuning panel (triple-tap the
// top-left corner in game) edits these values live and saves overrides to
// localStorage on the device.

export type WeaponId =
  | 'saw' | 'shocker' | 'flame' | 'laser' | 'mg' | 'rocket' | 'cryo' | 'boomerang';

export const WEAPON_IDS: WeaponId[] = ['saw', 'shocker', 'flame', 'laser', 'mg', 'rocket', 'cryo', 'boomerang'];

export type EnemyId = 'walker' | 'runner' | 'brute' | 'climber' | 'flyer';

const DEFAULTS = {
  stage: {
    length: 7200,            // px from start to finish line
    sections: 5,             // checkpoints split the stage into this many sections
    nestPositions: [0.26, 0.52, 0.8],   // spawner nests, as fraction of stage length
    cratePositions: [0.12, 0.4, 0.66],  // free-block crates, as fraction of stage length
    startGold: 120,
    difficulty: 1.0,         // global multiplier on enemy HP and damage
    hpGrowthPerSection: 0.3, // enemy HP +30% per section reached
    dmgGrowthPerSection: 0.12,
    crateGoldIfFull: 40,     // crate pays gold instead if tower already has 6 blocks
    checkpointHealPct: 0.15, // blocks + hero heal this fraction of max HP at each checkpoint
  },
  tower: {
    cartSpeed: 40,           // px/s while the path is clear
    slowSpeedFactor: 0.5,    // speed factor when enemies are close ahead (but not touching)
    slowDistance: 140,       // "close ahead" distance from the tower front
    maxBlocks: 6,
    blockWidth: 96,
    blockHeight: 60,
    cartHeight: 34,
    blockHp: 140,
    blockCostBase: 40,       // first block
    blockCostStep: 30,       // + this per block already on the tower
    sellRefund: 0.5,         // fraction of gold spent on the block (incl. upgrades) returned
    hpUpgradeCostBase: 30,
    hpUpgradeCostStep: 25,   // + this per HP level already bought on that block
    hpUpgradePct: 0.4,       // each HP level adds this fraction of base block HP
    dropSpeed: 600,          // px/s blocks fall when one below is destroyed
  },
  hero: {
    hp: 160,
    range: 400,
    fireInterval: 0.7,
    pellets: 5,
    pelletDamage: 6,
    spreadDeg: 24,
    pelletSpeed: 950,
    aimFireInterval: 0.55,   // faster fire while you hold to aim
  },
  weapons: {
    saw:       { damage: 5,  interval: 0.1,  range: 64 },
    shocker:   { damage: 8,  interval: 0.18, range: 150, chain: 2, chainRange: 80 },
    flame:     { damage: 2.6, interval: 0.1, range: 220, coneDeg: 34 },
    laser:     { damage: 26, interval: 1.1,  range: 320, beamWidth: 16 },
    mg:        { damage: 5,  interval: 0.12, range: 500, speed: 1200 },
    rocket:    { damage: 30, interval: 1.8,  range: 460, speed: 520, splash: 80 },
    cryo:      { damage: 11, interval: 0.55, range: 240, speed: 700, slowPct: 0.5, slowTime: 2.0, freezeStacks: 3, freezeTime: 1.4 },
    boomerang: { damage: 15, interval: 1.4,  range: 340, speed: 560, arc: 55 },
  },
  enemies: {
    walker:  { hp: 45,  speed: 44,  damage: 7,  attackInterval: 1.0, w: 30, h: 46, gold: 2,  climbSpeed: 55 },
    runner:  { hp: 28,  speed: 100,  damage: 5,  attackInterval: 0.7, w: 26, h: 40, gold: 2,  climbSpeed: 80 },
    brute:   { hp: 260, speed: 28,  damage: 22, attackInterval: 1.4, w: 52, h: 70, gold: 10, climbSpeed: 0 },
    climber: { hp: 34,  speed: 62,  damage: 6,  attackInterval: 0.8, w: 26, h: 38, gold: 3,  climbSpeed: 170 },
    flyer:   { hp: 30,  speed: 75,  damage: 6,  attackInterval: 1.1, w: 34, h: 24, gold: 4,  climbSpeed: 0 },
  },
  physics: {
    fallSpeed: 420,
    crowdOverlap: 0.75,      // how tightly zombies bunch (1 = touching, lower = overlap)
    stepUp: 8,
  },
  nest: {
    hp: 900,
    spawnInterval: 1.5,
    activationRange: 900,    // starts spawning when the tower is this close
    gold: 60,
    width: 110,
    height: 150,
    blockGap: 50,            // tower stops this far before an alive nest
    runnerChance: 0.3,
    climberChance: 0.15,
  },
  spawns: {
    startDelay: 3,
    interval: 1.5,           // ambient spawn interval in section 1 (seconds)
    intervalFactorPerSection: 0.82,
    groupMin: 2,
    groupMax: 5,
    runnerChance: 0.22,
    bruteChance: 0.06,
    climberChance: 0.12,
    flyerChance: 0.09,
    flyerAltMin: 260,
    flyerAltMax: 460,
    maxAlive: 80,
  },
};

export type Config = typeof DEFAULTS;

const STORAGE_KEY = 'stackrunner.tuning.v1';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export const CFG: Config = clone(DEFAULTS);

type Leaf = number | number[];

export function getPath(obj: unknown, path: string): Leaf {
  return path.split('.').reduce<any>((o, k) => o[k], obj);
}

function setPath(obj: unknown, path: string, value: Leaf): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<any>((o, k) => o[k], obj);
  parent[last] = value;
}

export function listPaths(obj: unknown = DEFAULTS, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number' || Array.isArray(v)) out.push(p);
    else if (v && typeof v === 'object') out.push(...listPaths(v, p));
  }
  return out;
}

export function defaultValue(path: string): Leaf {
  return getPath(DEFAULTS, path);
}

function loadOverrides(): Record<string, Leaf> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function overrides(): Record<string, Leaf> {
  const out: Record<string, Leaf> = {};
  for (const p of listPaths()) {
    const v = getPath(CFG, p);
    if (JSON.stringify(v) !== JSON.stringify(defaultValue(p))) out[p] = v;
  }
  return out;
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides()));
  } catch {
    /* storage unavailable: values still apply for this session */
  }
}

export function setValue(path: string, value: Leaf): void {
  setPath(CFG, path, value);
  save();
}

export function resetAll(): void {
  for (const p of listPaths()) setPath(CFG, p, clone(defaultValue(p)));
  save();
}

export function importOverrides(json: string): void {
  const data = JSON.parse(json) as Record<string, Leaf>;
  const valid = new Set(listPaths());
  for (const [p, v] of Object.entries(data)) if (valid.has(p)) setPath(CFG, p, v);
  save();
}

// Apply saved overrides at startup (ignore paths that no longer exist).
{
  const valid = new Set(listPaths());
  for (const [p, v] of Object.entries(loadOverrides())) if (valid.has(p)) setPath(CFG, p, v);
}
