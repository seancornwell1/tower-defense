import type { WeaponId } from '../config';

// Display info and fixed behaviour flags (not tuning numbers).
export interface WeaponMeta {
  name: string;
  icon: string;          // texture key
  hitsAir: boolean;
  reach: 'Short' | 'Mid' | 'Long';
  ability: string;
  mountX: number;        // texture origin x (0..1) where it attaches to the block
}

export const WEAPONS: Record<WeaponId, WeaponMeta> = {
  saw:       { name: 'Saw',          icon: 'w_saw',       hitsAir: false, reach: 'Short', ability: 'Overdrive',     mountX: 0.05 },
  shocker:   { name: 'Shocker',      icon: 'w_shocker',   hitsAir: true,  reach: 'Short', ability: 'Shock Wave',    mountX: 0.5 },
  flame:     { name: 'Flamethrower', icon: 'w_flame',     hitsAir: true,  reach: 'Mid',   ability: 'Inferno',       mountX: 0.1 },
  laser:     { name: 'Laser',        icon: 'w_laser',     hitsAir: true,  reach: 'Mid',   ability: 'Mega Beam',     mountX: 0.1 },
  mg:        { name: 'Machine Gun',  icon: 'w_mg',        hitsAir: true,  reach: 'Long',  ability: 'Bullet Storm',  mountX: 0.1 },
  rocket:    { name: 'Rocket',       icon: 'w_rocket',    hitsAir: false, reach: 'Long',  ability: 'Barrage',       mountX: 0.1 },
  cryo:      { name: 'Cryo Gun',     icon: 'w_cryo',      hitsAir: true,  reach: 'Mid',   ability: 'Deep Freeze',   mountX: 0.1 },
  boomerang: { name: 'Boomerang',    icon: 'w_boomerang', hitsAir: false, reach: 'Mid',   ability: 'Triple Throw',  mountX: 0.1 },
};
