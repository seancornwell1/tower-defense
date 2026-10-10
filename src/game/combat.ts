import Phaser from 'phaser';
import { CFG } from '../config';
import type { Target, Zombie } from './entities';
import type { Block, Tower } from './tower';
import { WEAPONS } from './meta';

export type ProjKind = 'pellet' | 'bullet' | 'rocket' | 'ice' | 'boomerang';

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
  obj: Phaser.GameObjects.Shape;
  // rocket destination
  tx?: number;
  ty?: number;
  // boomerang
  block?: Block;
  t?: number;
  leg?: 0 | 1;
  sx?: number;
  sy?: number;
  ex?: number;
  ey?: number;
  hitSet?: Set<Target>;
}

/** Short-lived line/cone effects drawn each frame. */
export interface Fx {
  kind: 'line' | 'bolt' | 'cone' | 'ring';
  x1: number; y1: number; x2: number; y2: number;
  width: number;
  color: number;
  life: number;
  maxLife: number;
  angle?: number;
  spread?: number;
  radius?: number;
}

export interface CombatHost {
  tower: Tower;
  zombies: Zombie[];
  targets(): Target[];
  projs: Proj[];
  fx: Fx[];
  add: Phaser.GameObjects.GameObjectFactory;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function radiusOf(t: Target): number {
  return Math.min(t.w, t.h) / 2;
}

export function nearestTarget(host: CombatHost, x: number, y: number, range: number, hitsAir: boolean): Target | null {
  let best: Target | null = null;
  let bestD = Infinity;
  for (const t of host.targets()) {
    if (!t.alive || (t.isAir && !hitsAir) || t.x < x - 40) continue;
    // distance to the target's nearest edge, so big targets (nests) are reachable
    const dx = Math.max(0, Math.abs(t.x - x) - t.w / 2);
    const dy = Math.max(0, Math.abs(t.y - y) - t.h / 2);
    const d = Math.hypot(dx, dy);
    if (d <= range && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

function circleHits(t: Target, x: number, y: number, r: number): boolean {
  const dx = Math.max(0, Math.abs(t.x - x) - t.w / 2);
  const dy = Math.max(0, Math.abs(t.y - y) - t.h / 2);
  return dx * dx + dy * dy <= r * r;
}

function spawnProj(host: CombatHost, p: Omit<Proj, 'obj'>, w: number, h: number, color: number): Proj {
  const obj = host.add.rectangle(p.x, p.y, w, h, color).setDepth(30);
  obj.rotation = Math.atan2(p.vy, p.vx);
  const proj = { ...p, obj } as Proj;
  host.projs.push(proj);
  return proj;
}

export function fireHero(host: CombatHost, x: number, y: number, angle: number): void {
  const c = CFG.hero;
  const spread = Phaser.Math.DegToRad(c.spreadDeg);
  for (let i = 0; i < c.pellets; i++) {
    const a = angle + (c.pellets === 1 ? 0 : -spread / 2 + (spread * i) / (c.pellets - 1)) + (Math.random() - 0.5) * 0.05;
    spawnProj(host, {
      kind: 'pellet', x, y, vx: Math.cos(a) * c.pelletSpeed, vy: Math.sin(a) * c.pelletSpeed,
      dmg: c.pelletDamage, hitsAir: true, life: c.range / c.pelletSpeed, radius: 4,
    }, 9, 4, 0xfff2a8);
  }
  host.fx.push({ kind: 'ring', x1: x + Math.cos(angle) * 22, y1: y + Math.sin(angle) * 22, x2: 0, y2: 0, width: 2, color: 0xffe08a, life: 0.06, maxLife: 0.06, radius: 10 });
}

/** Update one tower block's weapon. */
export function updateWeapon(host: CombatHost, b: Block, dt: number): void {
  const tower = host.tower;
  const meta = WEAPONS[b.weapon];
  const pos = tower.turretPos(b);
  b.cooldown -= dt;

  if (b.weapon === 'saw') {
    const c = CFG.weapons.saw;
    if (b.cooldown > 0) return;
    b.cooldown += c.interval;
    const top = b.visY - tower.bh / 2 - 6;
    const bottom = b.visY + tower.bh / 2 + 6;
    for (const t of host.targets()) {
      if (!t.alive || t.isAir) continue;
      const left = t.x - t.w / 2;
      if (left > tower.frontX + c.range || t.x + t.w / 2 < tower.frontX - 10) continue;
      if (t.y + t.h / 2 < top || t.y - t.h / 2 > bottom) continue;
      t.hit(c.damage);
    }
    return;
  }

  const range = (CFG.weapons[b.weapon] as { range: number }).range;
  const target = nearestTarget(host, pos.x, pos.y, range, meta.hitsAir);
  if (target) b.barrel.rotation = Phaser.Math.Angle.RotateTo(b.barrel.rotation, Math.atan2(target.y - pos.y, target.x - pos.x), dt * 12);
  if (b.cooldown > 0) return;
  if (!target) {
    b.cooldown = 0;
    return;
  }
  const ang = Math.atan2(target.y - pos.y, target.x - pos.x);
  const muzzle = { x: pos.x + Math.cos(ang) * 30, y: pos.y + Math.sin(ang) * 30 };

  switch (b.weapon) {
    case 'shocker': {
      const c = CFG.weapons.shocker;
      b.cooldown += c.interval;
      const hit = new Set<Target>([target]);
      target.hit(c.damage);
      host.fx.push({ kind: 'bolt', x1: muzzle.x, y1: muzzle.y, x2: target.x, y2: target.y, width: 3, color: meta.color, life: 0.08, maxLife: 0.08 });
      let from = target;
      for (let k = 0; k < c.chain; k++) {
        let next: Target | null = null;
        let nd = c.chainRange;
        for (const t of host.targets()) {
          if (!t.alive || hit.has(t) || (t.isAir && !meta.hitsAir)) continue;
          const d = dist(t.x, t.y, from.x, from.y);
          if (d < nd) { nd = d; next = t; }
        }
        if (!next) break;
        hit.add(next);
        next.hit(c.damage * 0.7);
        host.fx.push({ kind: 'bolt', x1: from.x, y1: from.y, x2: next.x, y2: next.y, width: 2, color: meta.color, life: 0.08, maxLife: 0.08 });
        from = next;
      }
      break;
    }
    case 'flame': {
      const c = CFG.weapons.flame;
      b.cooldown += c.interval;
      const half = Phaser.Math.DegToRad(c.coneDeg) / 2;
      for (const t of host.targets()) {
        if (!t.alive) continue;
        if (!circleHits(t, pos.x, pos.y, c.range)) continue;
        const a = Math.atan2(t.y - pos.y, t.x - pos.x);
        if (Math.abs(Phaser.Math.Angle.Wrap(a - ang)) > half + 0.15) continue;
        t.hit(c.damage);
      }
      host.fx.push({ kind: 'cone', x1: muzzle.x, y1: muzzle.y, x2: 0, y2: 0, width: 0, color: meta.color, life: 0.12, maxLife: 0.12, angle: ang, spread: half * 2, radius: c.range });
      break;
    }
    case 'laser': {
      const c = CFG.weapons.laser;
      b.cooldown += c.interval;
      const ex = pos.x + Math.cos(ang) * c.range;
      const ey = pos.y + Math.sin(ang) * c.range;
      const line = new Phaser.Geom.Line(pos.x, pos.y, ex, ey);
      const pt = new Phaser.Geom.Point();
      for (const t of host.targets()) {
        if (!t.alive) continue;
        Phaser.Geom.Line.GetNearestPoint(line, new Phaser.Geom.Point(t.x, t.y), pt);
        // clamp to segment
        const along = (pt.x - pos.x) * Math.cos(ang) + (pt.y - pos.y) * Math.sin(ang);
        if (along < -10 || along > c.range + 10) continue;
        if (dist(pt.x, pt.y, t.x, t.y) <= c.beamWidth / 2 + radiusOf(t)) t.hit(c.damage);
      }
      host.fx.push({ kind: 'line', x1: muzzle.x, y1: muzzle.y, x2: ex, y2: ey, width: c.beamWidth, color: meta.color, life: 0.22, maxLife: 0.22 });
      break;
    }
    case 'mg': {
      const c = CFG.weapons.mg;
      b.cooldown += c.interval;
      const a = ang + (Math.random() - 0.5) * 0.06;
      spawnProj(host, { kind: 'bullet', x: muzzle.x, y: muzzle.y, vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed, dmg: c.damage, hitsAir: true, life: (c.range + 60) / c.speed, radius: 4 }, 12, 4, 0xffe9a0);
      break;
    }
    case 'rocket': {
      const c = CFG.weapons.rocket;
      b.cooldown += c.interval;
      const tx = target.x;
      const ty = target.y;
      spawnProj(host, { kind: 'rocket', x: muzzle.x, y: muzzle.y, vx: Math.cos(ang) * c.speed, vy: Math.sin(ang) * c.speed, dmg: c.damage, hitsAir: false, life: 3, radius: 6, tx, ty }, 18, 8, meta.color);
      break;
    }
    case 'cryo': {
      const c = CFG.weapons.cryo;
      b.cooldown += c.interval;
      spawnProj(host, { kind: 'ice', x: muzzle.x, y: muzzle.y, vx: Math.cos(ang) * c.speed, vy: Math.sin(ang) * c.speed, dmg: c.damage, hitsAir: true, life: (c.range + 60) / c.speed, radius: 7 }, 14, 10, meta.color);
      break;
    }
    case 'boomerang': {
      if (b.boomerangOut) { b.cooldown = 0; return; }
      const c = CFG.weapons.boomerang;
      b.cooldown += c.interval;
      b.boomerangOut = true;
      spawnProj(host, {
        kind: 'boomerang', x: muzzle.x, y: muzzle.y, vx: 0, vy: 0, dmg: c.damage, hitsAir: false, life: 99, radius: 12,
        block: b, t: 0, leg: 0, sx: muzzle.x, sy: muzzle.y,
        ex: muzzle.x + Math.cos(ang) * c.range, ey: muzzle.y + Math.sin(ang) * c.range, hitSet: new Set(),
      }, 22, 8, meta.color);
      break;
    }
  }
}

function explode(host: CombatHost, x: number, y: number): void {
  const c = CFG.weapons.rocket;
  for (const t of host.targets()) {
    if (!t.alive || t.isAir) continue;
    if (circleHits(t, x, y, c.splash)) t.hit(c.damage);
  }
  host.fx.push({ kind: 'ring', x1: x, y1: y, x2: 0, y2: 0, width: 4, color: 0xffa040, life: 0.25, maxLife: 0.25, radius: c.splash });
}

export function updateProjectiles(host: CombatHost, dt: number, groundY: number): void {
  const tower = host.tower;
  for (const p of host.projs) {
    if (p.kind === 'boomerang') {
      const c = CFG.weapons.boomerang;
      const b = p.block!;
      const blockAlive = tower.blocks.includes(b);
      if (p.leg === 1) {
        // home back to the (possibly moved) turret
        if (blockAlive) {
          const tp = tower.turretPos(b);
          p.ex = tp.x;
          p.ey = tp.y;
        }
      }
      const len = Math.max(40, dist(p.sx!, p.sy!, p.ex!, p.ey!));
      p.t! += (c.speed / len) * dt;
      const t = Math.min(1, p.t!);
      const dx = p.ex! - p.sx!;
      const dy = p.ey! - p.sy!;
      const nx = -dy / len;
      const ny = dx / len;
      const arc = Math.sin(Math.PI * t) * c.arc * (p.leg === 0 ? -1 : 1);
      p.x = p.sx! + dx * t + nx * arc;
      p.y = p.sy! + dy * t + ny * arc;
      p.obj.rotation += dt * 18;
      for (const tg of host.targets()) {
        if (!tg.alive || tg.isAir || p.hitSet!.has(tg)) continue;
        if (circleHits(tg, p.x, p.y, p.radius)) {
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
          b.boomerangOut = false;
        }
      }
      if (!blockAlive && p.leg === 1 && t >= 1) p.life = 0;
      p.obj.setPosition(p.x, p.y);
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.obj.setPosition(p.x, p.y);
    if (p.y > groundY) {
      if (p.kind === 'rocket') explode(host, p.x, groundY - 10);
      p.life = 0;
      continue;
    }
    if (p.kind === 'rocket' && p.tx !== undefined && dist(p.x, p.y, p.tx, p.ty!) < 14) {
      explode(host, p.x, p.y);
      p.life = 0;
      continue;
    }
    for (const t of host.targets()) {
      if (!t.alive || (t.isAir && !p.hitsAir)) continue;
      if (!circleHits(t, p.x, p.y, p.radius)) continue;
      if (p.kind === 'rocket') {
        explode(host, p.x, p.y);
      } else {
        t.hit(p.dmg);
        if (p.kind === 'ice') {
          const c = CFG.weapons.cryo;
          const z = t as Zombie;
          if (typeof z.chillHit === 'function') z.chillHit(c.slowPct, c.slowTime, c.freezeStacks, c.freezeTime);
        }
      }
      p.life = 0;
      break;
    }
  }
  for (let i = host.projs.length - 1; i >= 0; i--) {
    const p = host.projs[i];
    if (p.life <= 0) {
      if (p.kind === 'boomerang' && p.block) p.block.boomerangOut = false;
      p.obj.destroy();
      host.projs.splice(i, 1);
    }
  }
}

export function drawFx(g: Phaser.GameObjects.Graphics, fx: Fx[], dt: number): void {
  for (const f of fx) {
    const a = Math.max(0, f.life / f.maxLife);
    switch (f.kind) {
      case 'line':
        g.lineStyle(f.width * a, f.color, 0.85);
        g.lineBetween(f.x1, f.y1, f.x2, f.y2);
        g.lineStyle(Math.max(1, f.width * a * 0.3), 0xffffff, 0.9);
        g.lineBetween(f.x1, f.y1, f.x2, f.y2);
        break;
      case 'bolt': {
        g.lineStyle(f.width, f.color, a);
        g.beginPath();
        g.moveTo(f.x1, f.y1);
        const n = 5;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          g.lineTo(f.x1 + (f.x2 - f.x1) * t + (Math.random() - 0.5) * 16, f.y1 + (f.y2 - f.y1) * t + (Math.random() - 0.5) * 16);
        }
        g.lineTo(f.x2, f.y2);
        g.strokePath();
        break;
      }
      case 'cone': {
        g.fillStyle(f.color, 0.35 * a + 0.1);
        g.slice(f.x1, f.y1, f.radius!, f.angle! - f.spread! / 2, f.angle! + f.spread! / 2, false);
        g.fillPath();
        break;
      }
      case 'ring':
        g.lineStyle(f.width, f.color, a);
        g.strokeCircle(f.x1, f.y1, f.radius! * (1.2 - a * 0.4));
        break;
    }
    f.life -= dt;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
}
