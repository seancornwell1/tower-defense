import Phaser from 'phaser';
import { CFG, WeaponId } from '../config';
import type { Target, Zombie } from './entities';
import type { Block, Tower } from './tower';
import { WEAPONS } from './meta';

export type ProjKind = 'pellet' | 'bullet' | 'rocket' | 'ice' | 'boomerang' | 'grenade';

export interface Proj {
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  hitsAir: boolean;
  life: number;
  radius: number;
  img: Phaser.GameObjects.Image;
  splash?: number;
  tx?: number;
  ty?: number;
  // boomerang / grenade path
  block?: Block;
  extra?: boolean;
  t?: number;
  dur?: number;
  leg?: 0 | 1;
  sx?: number;
  sy?: number;
  ex?: number;
  ey?: number;
  hitSet?: Set<Target>;
}

/** Short-lived line effects drawn each frame with one Graphics. */
export interface Fx {
  kind: 'line' | 'bolt' | 'ring';
  x1: number; y1: number; x2: number; y2: number;
  width: number;
  color: number;
  life: number;
  maxLife: number;
  radius?: number;
  grow?: boolean;
}

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
  tints: number[];
  grav: number;
  drag: number;
}

export class Particles {
  private live: Particle[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  constructor(private scene: Phaser.Scene) {}

  spawn(x: number, y: number, vx: number, vy: number, life: number, s0: number, s1: number, tints: number[], opts: { add?: boolean; a0?: number; grav?: number; drag?: number; tex?: string; depth?: number } = {}): void {
    if (this.live.length > 500) return;
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, 'puff');
    img.setTexture(opts.tex ?? 'puff').setVisible(true).setPosition(x, y).setScale(s0).setAlpha(opts.a0 ?? 1)
      .setDepth(opts.depth ?? 35).setBlendMode(opts.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setTint(tints[0]);
    this.live.push({ img, vx, vy, life, max: life, s0, s1, a0: opts.a0 ?? 1, tints, grav: opts.grav ?? 0, drag: opts.drag ?? 0 });
  }

  burst(x: number, y: number, n: number, speed: number, life: number, s0: number, s1: number, tints: number[], opts: { add?: boolean; grav?: number; up?: number } = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v - (opts.up ?? 0), life * (0.7 + Math.random() * 0.5), s0, s1, tints, { add: opts.add, grav: opts.grav, drag: 2 });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        this.pool.push(p.img);
        this.live.splice(i, 1);
        continue;
      }
      const f = 1 - p.life / p.max;
      p.vx *= 1 - Math.min(1, p.drag * dt);
      p.vy = p.vy * (1 - Math.min(1, p.drag * dt)) + p.grav * dt;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.img.setScale(p.s0 + (p.s1 - p.s0) * f);
      p.img.setAlpha(p.a0 * (1 - f * f));
      p.img.setTint(p.tints[Math.min(p.tints.length - 1, Math.floor(f * p.tints.length))]);
    }
  }
}

export interface CombatHost {
  tower: Tower;
  zombies: Zombie[];
  targets(): Target[];
  projs: Proj[];
  fx: Fx[];
  parts: Particles;
  abilityTime: Record<WeaponId, number>;
  add: Phaser.GameObjects.GameObjectFactory;
  cameras: Phaser.Cameras.Scene2D.CameraManager;
}

const FIRE = [0xfff4b0, 0xffc040, 0xff8020, 0xd8401a];

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function edgeDist(t: Target, x: number, y: number): number {
  const dx = Math.max(0, Math.abs(t.x - x) - t.w / 2);
  const dy = Math.max(0, Math.abs(t.y - y) - t.h / 2);
  return Math.hypot(dx, dy);
}

export function nearestTarget(host: CombatHost, x: number, y: number, range: number, hitsAir: boolean): Target | null {
  let best: Target | null = null;
  let bestD = Infinity;
  for (const t of host.targets()) {
    if (!t.alive || (t.isAir && !hitsAir) || t.x < x - 40) continue;
    const d = edgeDist(t, x, y);
    if (d <= range && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

export function weaponDamage(b: Block, base: number): number {
  return base * (1 + CFG.weaponLevel.damagePerLevel * (b.level - 1));
}

function spawnProj(host: CombatHost, p: Omit<Proj, 'img'>, tex: string): Proj {
  const img = host.add.image(p.x, p.y, tex).setDepth(30);
  img.rotation = Math.atan2(p.vy, p.vx);
  const proj = { ...p, img } as Proj;
  host.projs.push(proj);
  return proj;
}

function muzzleFlash(host: CombatHost, x: number, y: number, ang: number, color = 0xffe08a): void {
  host.parts.spawn(x + Math.cos(ang) * 8, y + Math.sin(ang) * 8, Math.cos(ang) * 60, Math.sin(ang) * 60, 0.08, 0.35, 0.6, [0xffffff, color], { add: true });
}

export function fireHero(host: CombatHost, x: number, y: number, angle: number): void {
  const c = CFG.hero;
  const spread = Phaser.Math.DegToRad(c.spreadDeg);
  for (let i = 0; i < c.pellets; i++) {
    const a = angle + (c.pellets === 1 ? 0 : -spread / 2 + (spread * i) / (c.pellets - 1)) + (Math.random() - 0.5) * 0.04;
    spawnProj(host, {
      kind: 'pellet', x, y, vx: Math.cos(a) * c.pelletSpeed, vy: Math.sin(a) * c.pelletSpeed,
      dmg: c.pelletDamage, hitsAir: true, life: c.range / c.pelletSpeed, radius: 5,
    }, 'p_bullet');
  }
  muzzleFlash(host, x, y, angle);
}

export function throwGrenade(host: CombatHost, x: number, y: number, tx: number, ty: number): void {
  const c = CFG.grenade;
  spawnProj(host, {
    kind: 'grenade', x, y, vx: 0, vy: 0, dmg: c.damage, hitsAir: false, life: 99, radius: 0,
    sx: x, sy: y, ex: tx, ey: ty, t: 0, dur: c.flightTime, splash: c.radius,
  }, 'p_grenade');
}

function flameTick(host: CombatHost, mx: number, my: number, ang: number, range: number, coneDeg: number, damage: number, big: boolean): void {
  const half = Phaser.Math.DegToRad(coneDeg) / 2;
  for (const t of host.targets()) {
    if (!t.alive) continue;
    if (edgeDist(t, mx, my) > range) continue;
    const a = Math.atan2(t.y - my, t.x - mx);
    if (Math.abs(Phaser.Math.Angle.Wrap(a - ang)) > half + 0.2) continue;
    t.hit(damage);
  }
  const n = big ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * half * 1.4;
    const life = 0.35 + Math.random() * 0.15;
    const v = (range / life) * (0.8 + Math.random() * 0.3);
    host.parts.spawn(mx, my, Math.cos(a) * v, Math.sin(a) * v, life, big ? 0.9 : 0.6, big ? 3.2 : 2.3, FIRE, { add: true, drag: 1.2, grav: -90 });
  }
}

function laserTick(host: CombatHost, mx: number, my: number, ang: number, range: number, width: number, damage: number, life: number): void {
  const ex = mx + Math.cos(ang) * range;
  const ey = my + Math.sin(ang) * range;
  const line = new Phaser.Geom.Line(mx, my, ex, ey);
  const pt = new Phaser.Geom.Point();
  for (const t of host.targets()) {
    if (!t.alive) continue;
    Phaser.Geom.Line.GetNearestPoint(line, new Phaser.Geom.Point(t.x, t.y), pt);
    const along = (pt.x - mx) * Math.cos(ang) + (pt.y - my) * Math.sin(ang);
    if (along < -10 || along > range + 10) continue;
    if (dist(pt.x, pt.y, t.x, t.y) <= width / 2 + Math.min(t.w, t.h) / 2) t.hit(damage);
  }
  host.fx.push({ kind: 'line', x1: mx, y1: my, x2: ex, y2: ey, width, color: 0xd070ff, life, maxLife: life });
}

/** Update one tower block's weapon. */
export function updateWeapon(host: CombatHost, b: Block, dt: number): void {
  const w = b.weapon;
  if (!w) return;
  const tower = host.tower;
  const meta = WEAPONS[w];
  const pos = tower.muzzle(b);
  const active = host.abilityTime[w] > 0;
  b.cooldown -= dt;

  if (w === 'saw') {
    const c = CFG.weapons.saw;
    const ab = CFG.abilities.saw;
    if (b.blade) b.blade.rotation += dt * (active ? 30 : 0);
    if (b.cooldown > 0) return;
    b.cooldown += c.interval;
    const range = c.range * (active ? ab.rangeMult : 1);
    const top = b.visY - tower.bh / 2 - 8;
    const bottom = b.visY + tower.bh / 2 + 8;
    let hitAny = false;
    for (const t of host.targets()) {
      if (!t.alive || t.isAir) continue;
      if (t.x - t.w / 2 > tower.frontX + range || t.x + t.w / 2 < tower.frontX - 10) continue;
      if (t.y + t.h / 2 < top || t.y - t.h / 2 > bottom) continue;
      t.hit(weaponDamage(b, c.damage) * (active ? ab.damageMult : 1));
      hitAny = true;
    }
    if (hitAny && Math.random() < 0.5) host.parts.spawn(tower.frontX + 30, b.visY + 6, 40 + Math.random() * 80, -60 - Math.random() * 80, 0.25, 0.15, 0.05, [0xffffaa, 0xffaa30], { tex: 'spark', add: true, grav: 400 });
    return;
  }

  const range = (CFG.weapons[w] as { range: number }).range * (w === 'flame' && active ? CFG.abilities.flame.range / CFG.weapons.flame.range : 1);
  const target = nearestTarget(host, pos.x, pos.y, range, meta.hitsAir);
  if (target) {
    const want = Math.atan2(target.y - pos.y, target.x - pos.x);
    b.aim = Phaser.Math.Angle.RotateTo(b.aim, want, dt * 10);
  }
  if (b.gun && w !== 'shocker') b.gun.rotation = Phaser.Math.Clamp(b.aim, -1.2, 1.2);
  if (b.cooldown > 0) return;
  if (!target) {
    b.cooldown = 0;
    return;
  }
  const ang = Math.atan2(target.y - pos.y, target.x - pos.x);
  const mx = pos.x + Math.cos(ang) * 34;
  const my = pos.y + Math.sin(ang) * 34;

  switch (w) {
    case 'shocker': {
      const c = CFG.weapons.shocker;
      b.cooldown += c.interval;
      const sx = tower.x + tower.bw / 2 - 12;
      const sy = b.visY - 14;
      const hit = new Set<Target>([target]);
      target.hit(weaponDamage(b, c.damage));
      host.fx.push({ kind: 'bolt', x1: sx, y1: sy, x2: target.x, y2: target.y, width: 3, color: 0xfff27a, life: 0.09, maxLife: 0.09 });
      let from = target;
      for (let k = 0; k < c.chain; k++) {
        let next: Target | null = null;
        let nd = c.chainRange;
        for (const t of host.targets()) {
          if (!t.alive || hit.has(t)) continue;
          const d = dist(t.x, t.y, from.x, from.y);
          if (d < nd) { nd = d; next = t; }
        }
        if (!next) break;
        hit.add(next);
        next.hit(weaponDamage(b, c.damage) * 0.7);
        host.fx.push({ kind: 'bolt', x1: from.x, y1: from.y, x2: next.x, y2: next.y, width: 2, color: 0xfff27a, life: 0.09, maxLife: 0.09 });
        from = next;
      }
      break;
    }
    case 'flame': {
      if (active) {
        const a = CFG.abilities.flame;
        b.cooldown += a.interval;
        flameTick(host, mx, my, ang, a.range, a.coneDeg, weaponDamage(b, a.damage), true);
      } else {
        const c = CFG.weapons.flame;
        b.cooldown += c.interval;
        flameTick(host, mx, my, ang, c.range, c.coneDeg, weaponDamage(b, c.damage), false);
      }
      break;
    }
    case 'laser': {
      if (active) {
        const a = CFG.abilities.laser;
        b.cooldown += a.interval;
        laserTick(host, mx, my, ang, CFG.weapons.laser.range * 1.3, a.beamWidth, weaponDamage(b, a.damage), a.interval * 1.5);
      } else {
        const c = CFG.weapons.laser;
        b.cooldown += c.interval;
        laserTick(host, mx, my, ang, c.range, c.beamWidth, weaponDamage(b, c.damage), 0.25);
      }
      break;
    }
    case 'mg': {
      const c = CFG.weapons.mg;
      b.cooldown += c.interval / (active ? CFG.abilities.mg.rateMult : 1);
      const a = ang + (Math.random() - 0.5) * (active ? 0.15 : 0.06);
      spawnProj(host, { kind: 'bullet', x: mx, y: my, vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed, dmg: weaponDamage(b, c.damage), hitsAir: true, life: (c.range + 60) / c.speed, radius: 4 }, 'p_bullet');
      muzzleFlash(host, mx, my, a);
      break;
    }
    case 'rocket': {
      const c = CFG.weapons.rocket;
      b.cooldown += c.interval;
      fireRocket(host, mx, my, target.x, target.y, weaponDamage(b, c.damage), c.splash);
      break;
    }
    case 'cryo': {
      const c = CFG.weapons.cryo;
      b.cooldown += c.interval;
      spawnProj(host, { kind: 'ice', x: mx, y: my, vx: Math.cos(ang) * c.speed, vy: Math.sin(ang) * c.speed, dmg: weaponDamage(b, c.damage), hitsAir: true, life: (c.range + 60) / c.speed, radius: 7 }, 'p_ice');
      muzzleFlash(host, mx, my, ang, 0x9fe3ff);
      break;
    }
    case 'boomerang': {
      if (b.boomerangOut) { b.cooldown = 0; return; }
      b.cooldown += CFG.weapons.boomerang.interval;
      b.boomerangOut = true;
      fireBoomerang(host, b, mx, my, ang, false);
      break;
    }
  }
}

export function fireRocket(host: CombatHost, x: number, y: number, tx: number, ty: number, dmg: number, splash: number): void {
  const c = CFG.weapons.rocket;
  const ang = Math.atan2(ty - y, tx - x);
  spawnProj(host, { kind: 'rocket', x, y, vx: Math.cos(ang) * c.speed, vy: Math.sin(ang) * c.speed, dmg, hitsAir: false, life: 3, radius: 6, tx, ty, splash }, 'p_rocket');
  muzzleFlash(host, x, y, ang, 0xffa040);
}

export function fireBoomerang(host: CombatHost, b: Block, x: number, y: number, ang: number, extra: boolean): void {
  const c = CFG.weapons.boomerang;
  spawnProj(host, {
    kind: 'boomerang', x, y, vx: 0, vy: 0, dmg: weaponDamage(b, c.damage), hitsAir: false, life: 99, radius: 14,
    block: b, extra, t: 0, leg: 0, sx: x, sy: y, ex: x + Math.cos(ang) * c.range, ey: y + Math.sin(ang) * c.range, hitSet: new Set(),
  }, 'p_boom');
}

export function explode(host: CombatHost, x: number, y: number, radius: number, dmg: number, hitsAir = false): void {
  for (const t of host.targets()) {
    if (!t.alive || (t.isAir && !hitsAir)) continue;
    if (edgeDist(t, x, y) <= radius) t.hit(dmg);
  }
  host.parts.burst(x, y, 10, radius * 2.2, 0.35, 0.6, 1.8, FIRE, { add: true });
  host.parts.burst(x, y - 10, 5, radius * 1.2, 0.6, 0.8, 1.6, [0x8a7a70, 0x5a4a44], { up: 40 });
  host.fx.push({ kind: 'ring', x1: x, y1: y, x2: 0, y2: 0, width: 4, color: 0xfff0b0, life: 0.2, maxLife: 0.2, radius, grow: true });
  host.cameras.main.shake(80, 0.003);
}

export function updateProjectiles(host: CombatHost, dt: number, groundY: number): void {
  const tower = host.tower;
  for (const p of host.projs) {
    if (p.kind === 'grenade') {
      p.t! += dt / p.dur!;
      const t = Math.min(1, p.t!);
      p.x = p.sx! + (p.ex! - p.sx!) * t;
      p.y = p.sy! + (p.ey! - p.sy!) * t - 160 * 4 * t * (1 - t);
      p.img.setPosition(p.x, p.y);
      p.img.rotation += dt * 12;
      if (t >= 1) {
        explode(host, p.x, p.y, p.splash!, p.dmg, true);
        p.life = 0;
      }
      continue;
    }
    if (p.kind === 'boomerang') {
      const c = CFG.weapons.boomerang;
      const b = p.block!;
      const blockAlive = tower.blocks.includes(b);
      if (p.leg === 1 && blockAlive) {
        const m = tower.muzzle(b);
        p.ex = m.x;
        p.ey = m.y;
      }
      const len = Math.max(40, dist(p.sx!, p.sy!, p.ex!, p.ey!));
      p.t! += (c.speed / len) * dt;
      const t = Math.min(1, p.t!);
      const dx = p.ex! - p.sx!;
      const dy = p.ey! - p.sy!;
      const arc = Math.sin(Math.PI * t) * c.arc * (p.leg === 0 ? -1 : 1);
      p.x = p.sx! + dx * t + (-dy / len) * arc;
      p.y = p.sy! + dy * t + (dx / len) * arc;
      p.img.rotation += dt * 18;
      for (const tg of host.targets()) {
        if (!tg.alive || tg.isAir || p.hitSet!.has(tg)) continue;
        if (edgeDist(tg, p.x, p.y) <= p.radius) {
          p.hitSet!.add(tg);
          tg.hit(p.dmg);
        }
      }
      if (t >= 1) {
        if (p.leg === 0) {
          p.leg = 1;
          p.t = 0;
          p.sx = p.x;
          p.sy = p.y;
          p.hitSet = new Set();
        } else {
          p.life = 0;
        }
      }
      p.img.setPosition(p.x, p.y);
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.img.setPosition(p.x, p.y);
    if (p.kind === 'rocket' && Math.random() < 0.6) host.parts.spawn(p.x - p.vx * 0.03, p.y - p.vy * 0.03, 0, -20, 0.4, 0.3, 0.8, [0xffd080, 0x9a8a80, 0x6a5a55], {});
    if (p.y > groundY) {
      if (p.kind === 'rocket') explode(host, p.x, groundY - 10, p.splash!, p.dmg);
      p.life = 0;
      continue;
    }
    if (p.kind === 'rocket' && p.tx !== undefined && dist(p.x, p.y, p.tx, p.ty!) < 14) {
      explode(host, p.x, p.y, p.splash!, p.dmg);
      p.life = 0;
      continue;
    }
    for (const t of host.targets()) {
      if (!t.alive || (t.isAir && !p.hitsAir)) continue;
      if (edgeDist(t, p.x, p.y) > p.radius) continue;
      if (p.kind === 'rocket') {
        explode(host, p.x, p.y, p.splash!, p.dmg);
      } else {
        t.hit(p.dmg);
        host.parts.spawn(p.x, p.y, -40, -30, 0.12, 0.25, 0.5, [0xffffff, 0xffe08a], { add: true });
        if (p.kind === 'ice') {
          const c = CFG.weapons.cryo;
          const z = t as Zombie;
          if (typeof z.chillHit === 'function') z.chillHit(c.slowPct, c.slowTime, c.freezeStacks, c.freezeTime);
          host.parts.burst(p.x, p.y, 4, 80, 0.3, 0.2, 0.4, [0xffffff, 0x9fe3ff], {});
        }
      }
      p.life = 0;
      break;
    }
  }
  for (let i = host.projs.length - 1; i >= 0; i--) {
    const p = host.projs[i];
    if (p.life <= 0) {
      if (p.kind === 'boomerang' && p.block && !p.extra) p.block.boomerangOut = false;
      p.img.destroy();
      host.projs.splice(i, 1);
    }
  }
}

export function drawFx(g: Phaser.GameObjects.Graphics, fx: Fx[], dt: number): void {
  for (const f of fx) {
    const a = Math.max(0, f.life / f.maxLife);
    switch (f.kind) {
      case 'line':
        g.lineStyle(f.width * a, f.color, 0.8);
        g.lineBetween(f.x1, f.y1, f.x2, f.y2);
        g.lineStyle(Math.max(2, f.width * a * 0.35), 0xffffff, 0.95);
        g.lineBetween(f.x1, f.y1, f.x2, f.y2);
        break;
      case 'bolt': {
        g.lineStyle(f.width + 3, f.color, 0.35 * a);
        const pts: number[] = [f.x1, f.y1];
        for (let i = 1; i < 5; i++) {
          const t = i / 5;
          pts.push(f.x1 + (f.x2 - f.x1) * t + (Math.random() - 0.5) * 18, f.y1 + (f.y2 - f.y1) * t + (Math.random() - 0.5) * 18);
        }
        pts.push(f.x2, f.y2);
        for (const [w, col, al] of [[f.width + 4, f.color, 0.35], [f.width, 0xffffff, 1]] as [number, number, number][]) {
          g.lineStyle(w, col, al * a);
          g.beginPath();
          g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.strokePath();
        }
        break;
      }
      case 'ring': {
        const r = f.grow ? f.radius! * (1 - a * 0.7) : f.radius!;
        g.lineStyle(f.width * (0.5 + a), f.color, a);
        g.strokeCircle(f.x1, f.y1, r);
        break;
      }
    }
    f.life -= dt;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
}
