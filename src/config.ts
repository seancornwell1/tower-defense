// Every gameplay number lives here. The hidden tuning panel (triple-tap the
// top-left corner in game) edits these values live and saves overrides to
// localStorage on the device.

export type WeaponId =
  | 'saw' | 'shocker' | 'flame' | 'laser' | 'mg' | 'rocket' | 'cryo' | 'boomerang';

export const WEAPON_IDS: WeaponId[] = ['saw', 'shocker', 'flame', 'laser', 'mg', 'rocket', 'cryo', 'boomerang'];

export type EnemyId = 'walker' | 'runner' | 'brute' | 'climber' | 'flyer';

const DEFAULTS = {
  stage: {
    length: 6000,            // px from start to the END flag
    sections: 5,             // checkpoints split the stage into this many sections
    nestPositions: [0.18, 0.44, 0.72],  // spawner nests, as a fraction of stage length
    cratePositions: [0.3, 0.58, 0.86],  // free-block crates
    startGold: 475,
    difficulty: 1.0,         // global multiplier on enemy HP and damage
    hpGrowthPerSection: 0.3, // enemy HP +30% per section reached
    dmgGrowthPerSection: 0.12,
    crateGoldIfFull: 60,     // crate pays gold instead if the tower already has 6 blocks
    checkpointHealPct: 0.1,  // blocks + hero heal this fraction of max HP at each checkpoint
  },
  tower: {
    cartSpeed: 45,           // px/s while the path is clear
    slowSpeedFactor: 0.5,    // speed factor when enemies are close ahead (but not touching)
    slowDistance: 120,
    maxBlocks: 6,
    startBlocks: 1,
    blockWidth: 70,
    blockHeight: 58,
    cartHeight: 30,
    blockHp: 250,
    blockCostBase: 100,      // "+" button: first extra block
    blockCostStep: 50,       // + this per block already on the tower
    blockSellRefund: 0.5,    // trash: fraction of gold spent on block + HP upgrades returned
    hpUpgradeCostBase: 150,
    hpUpgradeCostStep: 100,  // + this per HP level already bought on that block
    hpUpgradePct: 0.4,       // each HP level adds this fraction of base block HP
    dropSpeed: 600,          // px/s blocks fall when one below is destroyed
  },
  weaponLevel: {
    upgradeCostStep: 35,     // level n -> n+1 costs n * this
    damagePerLevel: 0.2,     // +20% base damage per level
    sellRefund: 1.0,         // SELL returns this fraction of gold spent on the weapon
  },
  energy: {
    start: 5,
    max: 30,
    regen: 0.75,             // per second
    regenUpgrade: 0.15,      // added per upgrade
    upgradeCostBase: 30,
    upgradeCostStep: 30,
  },
  grenade: { cost: 2, damage: 70, radius: 95, flightTime: 0.6 },
  hero: {
    hp: 300,
    range: 430,
    fireInterval: 0.6,
    aimFireInterval: 0.45,   // faster fire while you hold to aim
    pellets: 3,
    pelletDamage: 9,
    spreadDeg: 12,
    pelletSpeed: 950,
  },
  weapons: {
    saw:       { price: 100, damage: 4,  interval: 0.1,  range: 46 },
    shocker:   { price: 150, damage: 8,  interval: 0.2,  range: 150, chain: 2, chainRange: 80 },
    flame:     { price: 250, damage: 3,  interval: 0.1,  range: 210, coneDeg: 26 },
    laser:     { price: 300, damage: 30, interval: 1.2,  range: 340, beamWidth: 14 },
    mg:        { price: 300, damage: 7,  interval: 0.12, range: 480, speed: 1100 },
    rocket:    { price: 375, damage: 45, interval: 1.8,  range: 470, speed: 520, splash: 80 },
    cryo:      { price: 350, damage: 12, interval: 0.6,  range: 260, speed: 700, slowPct: 0.5, slowTime: 2, freezeStacks: 3, freezeTime: 1.4 },
    boomerang: { price: 250, damage: 20, interval: 1.4,  range: 340, speed: 560, arc: 50 },
  },
  // Active abilities (energy). Activating one fires it on every weapon of that type.
  abilities: {
    saw:       { cost: 5, duration: 5, damageMult: 3, rangeMult: 2 },
    shocker:   { cost: 8, damage: 60, radius: 380, stun: 1.5 },
    flame:     { cost: 7, duration: 3, damage: 7, interval: 0.08, range: 330, coneDeg: 46 },
    laser:     { cost: 8, duration: 2.5, damage: 14, interval: 0.1, beamWidth: 44 },
    mg:        { cost: 6, duration: 4, rateMult: 4 },
    rocket:    { cost: 8, count: 8, damage: 60, splash: 100 },
    cryo:      { cost: 9, freezeTime: 3, damage: 25, radius: 650 },
    boomerang: { cost: 6, count: 3 },
  },
  enemies: {
    walker:  { hp: 50,  speed: 42, damage: 9,  attackInterval: 1.0, gold: 5,  climbSpeed: 55,  scale: 1 },
    runner:  { hp: 30,  speed: 95, damage: 6,  attackInterval: 0.7, gold: 5,  climbSpeed: 80,  scale: 0.9 },
    brute:   { hp: 260, speed: 26, damage: 26, attackInterval: 1.4, gold: 20, climbSpeed: 0,   scale: 1.5 },
    climber: { hp: 36,  speed: 60, damage: 7,  attackInterval: 0.8, gold: 6,  climbSpeed: 170, scale: 0.85 },
    flyer:   { hp: 34,  speed: 75, damage: 7,  attackInterval: 1.1, gold: 8,  climbSpeed: 0,   scale: 1 },
  },
  physics: {
    fallSpeed: 420,
    crowdOverlap: 0.7,       // how tightly zombies bunch (1 = touching, lower = overlap)
    stepUp: 8,
  },
  nest: {
    hp: 1800,
    spawnInterval: 1.6,
    activationRange: 800,    // starts spawning when the tower is this close
    gold: 150,
    blockGap: 40,            // tower stops this far before an alive nest
    runnerChance: 0.3,
    climberChance: 0.15,
  },
  spawns: {
    startDelay: 2,
    interval: 1.7,           // ambient spawn interval in section 1 (seconds)
    intervalFactorPerSection: 0.84,
    groupMin: 2,
    groupMax: 5,
    runnerChance: 0.2,
    bruteChance: 0.05,
    climberChance: 0.12,
    flyerChance: 0.08,
    flyerAltMin: 200,
    flyerAltMax: 330,
    maxAlive: 70,
  },
};

export type Config = typeof DEFAULTS;

const STORAGE_KEY = 'stackwagon.tuning.v2';

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
