import type { EnemyId, WeaponId } from '../config';

// Display info and fixed behaviour flags (not tuning numbers).
export interface WeaponMeta {
  name: string;
  short: string;
  color: number;
  hitsAir: boolean;
  reach: 'Short' | 'Mid' | 'Long';
  desc: string;
}

export const WEAPONS: Record<WeaponId, WeaponMeta> = {
  saw:       { name: 'Saw',          short: 'SAW', color: 0xa0a0a0, hitsAir: false, reach: 'Short', desc: 'Constant contact damage. Put it low.' },
  shocker:   { name: 'Shocker',      short: 'ZAP', color: 0xe8d44d, hitsAir: true, reach: 'Short', desc: 'Rapid zaps that chain between zombies.' },
  flame:     { name: 'Flamethrower', short: 'FLM', color: 0xe8843a, hitsAir: true,  reach: 'Mid',   desc: 'Cone splash. Hits ground and air.' },
  laser:     { name: 'Laser',        short: 'LSR', color: 0xd04de8, hitsAir: true,  reach: 'Mid',   desc: 'Beam pierces everything in a line.' },
  mg:        { name: 'Machine Gun',  short: 'MG',  color: 0x6f8fb0, hitsAir: true,  reach: 'Long',  desc: 'High single-target damage, any floor.' },
  rocket:    { name: 'Rocket',       short: 'RKT', color: 0xc84b4b, hitsAir: false, reach: 'Long',  desc: 'Slow explosive splash on the ground.' },
  cryo:      { name: 'Cryo Gun',     short: 'ICE', color: 0x7fd6f0, hitsAir: true,  reach: 'Mid',   desc: 'Slows, then freezes solid.' },
  boomerang: { name: 'Boomerang',    short: 'BMR', color: 0x8fc46a, hitsAir: false, reach: 'Mid',   desc: 'Arcs out and back, hitting both ways.' },
};

export const ENEMY_COLORS: Record<EnemyId, number> = {
  walker: 0x6f8f5f,
  runner: 0x9bb860,
  brute: 0x4f6446,
  climber: 0x6f9d8c,
  flyer: 0x8d6aa0,
};

export const UI = {
  bg: 0x2b2f38,
  panel: 0x1d2027,
  panelLight: 0x3a3f4b,
  text: '#f2f2f2',
  dim: '#9aa0aa',
  gold: '#ffd166',
  good: 0x4caf6a,
  bad: 0xd9534f,
  font: '-apple-system, "Helvetica Neue", Arial, sans-serif',
};
