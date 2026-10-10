import Phaser from 'phaser';
import { CFG, EnemyId } from '../config';
import { ENEMY_COLORS } from './meta';

export interface Target {
  x: number;
  readonly y: number;
  w: number;
  h: number;
  isAir: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  hit(dmg: number): void;
}

export interface HitHost {
  groundY: number;
  onEnemyKilled(t: Target, gold: number): void;
}

export class Zombie implements Target {
  kind: EnemyId;
  x: number;
  alt: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  attackTimer: number;
  climbSpeed: number;
  gold: number;
  isAir: boolean;
  alive = true;
  blocked = false;
  attacking = false;
  climbing = false;
  slowTimer = 0;
  slowPct = 0;
  chill = 0;
  frozenTimer = 0;
  flash = 0;
  lunge = 0;
  bobPhase = Math.random() * Math.PI * 2;
  body: Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene & HitHost, kind: EnemyId, x: number, alt: number, hpMult: number, dmgMult: number) {
    const c = CFG.enemies[kind];
    this.kind = kind;
    this.x = x;
    this.alt = alt;
    this.w = c.w;
    this.h = c.h;
    this.hp = this.maxHp = c.hp * hpMult;
    this.speed = c.speed * (0.9 + Math.random() * 0.2);
    this.damage = c.damage * dmgMult;
    this.attackInterval = c.attackInterval;
    this.attackTimer = Math.random() * c.attackInterval;
    this.climbSpeed = c.climbSpeed;
    this.gold = c.gold;
    this.isAir = kind === 'flyer';
    const color = ENEMY_COLORS[kind];
    this.body = scene.add.rectangle(x, this.y, this.w, this.h, color).setStrokeStyle(2, 0x1a1a1a).setDepth(10);
    const headH = this.isAir ? this.h * 0.6 : Math.min(18, this.h * 0.35);
    this.head = scene.add.rectangle(x, this.y, this.w * 0.7, headH, Phaser.Display.Color.ValueToColor(color).darken(18).color)
      .setStrokeStyle(1, 0x1a1a1a).setDepth(11);
  }

  get y(): number {
    const bob = this.isAir ? Math.sin(this.bobPhase) * 6 : 0;
    return this.scene.groundY - this.alt - this.h / 2 + bob;
  }

  get top(): number {
    return this.alt + this.h;
  }

  get speedMult(): number {
    if (this.frozenTimer > 0) return 0;
    return this.slowTimer > 0 ? 1 - this.slowPct : 1;
  }

  hit(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.alive = false;
      this.scene.onEnemyKilled(this, this.gold);
    }
  }

  chillHit(slowPct: number, slowTime: number, stacks: number, freezeTime: number): void {
    this.slowPct = Math.max(this.slowPct, slowPct);
    this.slowTimer = Math.max(this.slowTimer, slowTime);
    if (this.frozenTimer > 0) return;
    this.chill++;
    if (this.chill >= stacks) {
      this.chill = 0;
      this.frozenTimer = freezeTime;
    }
  }

  tickStatus(dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer === 0) { this.slowPct = 0; this.chill = 0; }
    this.frozenTimer = Math.max(0, this.frozenTimer - dt);
    this.lunge = Math.max(0, this.lunge - dt);
    if (this.isAir && this.frozenTimer === 0) this.bobPhase += dt * 5;
  }

  draw(): void {
    const lungeX = this.lunge > 0 ? -5 : 0;
    const y = this.y;
    this.body.setPosition(this.x + lungeX, y);
    const headY = this.isAir ? y : y - this.h / 2 + this.head.height / 2 + 2;
    this.head.setPosition(this.x + lungeX - (this.isAir ? 0 : 3), headY);
    const base = ENEMY_COLORS[this.kind];
    let fill = base;
    if (this.flash > 0) fill = 0xffffff;
    else if (this.frozenTimer > 0) fill = 0xc8ecff;
    else if (this.slowTimer > 0) fill = 0x8fb8c8;
    this.body.setFillStyle(fill);
  }

  destroy(): void {
    this.body.destroy();
    this.head.destroy();
  }
}

export class Nest implements Target {
  x: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  isAir = false;
  alive = true;
  spawnTimer = 1;
  flash = 0;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  spikes: Phaser.GameObjects.Rectangle[] = [];

  constructor(private scene: Phaser.Scene & HitHost, x: number, hpMult: number) {
    this.x = x;
    this.w = CFG.nest.width;
    this.h = CFG.nest.height;
    this.hp = this.maxHp = CFG.nest.hp * hpMult;
    this.rect = scene.add.rectangle(x, this.y, this.w, this.h, 0x5a4a3f).setStrokeStyle(3, 0x221a15).setDepth(5);
    for (let i = 0; i < 3; i++) {
      this.spikes.push(scene.add.rectangle(x - this.w / 3 + (i * this.w) / 3, this.y - this.h / 2 - 12, 14, 24, 0x3f342c).setDepth(5));
    }
    this.label = scene.add.text(x, this.y, 'NEST', { fontSize: '18px', color: '#e6d2c0', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(6);
  }

  get y(): number {
    return this.scene.groundY - this.h / 2;
  }

  hit(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.06;
    if (this.hp <= 0) {
      this.alive = false;
      this.scene.onEnemyKilled(this, CFG.nest.gold);
    }
  }

  draw(dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    this.rect.setFillStyle(this.flash > 0 ? 0xffffff : 0x5a4a3f);
  }

  destroy(): void {
    this.rect.destroy();
    this.label.destroy();
    this.spikes.forEach((s) => s.destroy());
  }
}

export class Crate {
  taken = false;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene & HitHost, public x: number) {
    const y = scene.groundY - 22;
    this.rect = scene.add.rectangle(x, y, 44, 44, 0xb08850).setStrokeStyle(3, 0x5a4020).setDepth(6);
    this.label = scene.add.text(x, y, '+1\nBLOCK', { fontSize: '11px', color: '#2a1a08', align: 'center', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(7);
  }

  destroy(): void {
    this.rect.destroy();
    this.label.destroy();
  }
}
