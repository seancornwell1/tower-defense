import Phaser from 'phaser';
import { CFG, EnemyId } from '../config';
import { fmt, txt } from '../art';

export interface Target {
  x: number;
  readonly y: number;     // centre
  w: number;
  h: number;
  isAir: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  dmgAcc: number;         // damage accumulated for the floating number
  numTimer: number;
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
  dmgAcc = 0;
  numTimer = 0;
  anim = Math.random() * 10;
  sprite: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene & HitHost, kind: EnemyId, x: number, alt: number, hpMult: number, dmgMult: number) {
    const c = CFG.enemies[kind];
    this.kind = kind;
    this.x = x;
    this.alt = alt;
    this.hp = this.maxHp = c.hp * hpMult;
    this.speed = c.speed * (0.88 + Math.random() * 0.24);
    this.damage = c.damage * dmgMult;
    this.attackInterval = c.attackInterval;
    this.attackTimer = Math.random() * c.attackInterval;
    this.climbSpeed = c.climbSpeed;
    this.gold = c.gold;
    this.isAir = kind === 'flyer';
    this.sprite = scene.add.image(x, 0, `z_${kind}_0`).setOrigin(0.5, 1).setScale(c.scale).setDepth(10 + Math.random());
    this.w = this.sprite.displayWidth * (this.isAir ? 0.7 : 0.62);
    this.h = this.sprite.displayHeight * 0.95;
  }

  get y(): number {
    return this.scene.groundY - this.alt - this.h / 2;
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
    this.dmgAcc += dmg;
    this.flash = 0.06;
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

  freeze(t: number): void {
    this.frozenTimer = Math.max(this.frozenTimer, t);
  }

  tickStatus(dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer === 0) { this.slowPct = 0; this.chill = 0; }
    this.frozenTimer = Math.max(0, this.frozenTimer - dt);
    this.lunge = Math.max(0, this.lunge - dt);
    const moving = this.frozenTimer === 0 && (!this.blocked || this.climbing || this.isAir);
    if (moving) this.anim += dt * (this.speed / 10) * this.speedMult;
  }

  draw(): void {
    const s = this.sprite;
    const frame = Math.floor(this.anim) % 2;
    s.setTexture(`z_${this.kind}_${frame}`);
    const bob = this.isAir ? Math.sin(this.anim * 0.8) * 5 : (frame ? -1.5 : 0);
    const lungeX = this.lunge > 0 ? -6 : 0;
    s.setPosition(this.x + lungeX, this.scene.groundY - this.alt + bob - (this.isAir ? this.h / 2 : 0));
    if (this.isAir) s.setOrigin(0.5, 0.5);
    s.rotation = this.attacking && this.lunge > 0 ? -0.15 : this.climbing ? 0.25 : Math.sin(this.anim * Math.PI) * 0.05;
    if (this.flash > 0) s.setTintFill(0xffffff);
    else if (this.frozenTimer > 0) s.setTint(0x9fe3ff);
    else if (this.slowTimer > 0) s.setTint(0xcdeeff);
    else s.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
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
  spawnTimer = 0.5;
  flash = 0;
  dmgAcc = 0;
  numTimer = 0;
  body: Phaser.GameObjects.Image;
  door: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene & HitHost, x: number, hpMult: number) {
    this.x = x;
    this.hp = this.maxHp = CFG.nest.hp * hpMult;
    this.door = scene.add.image(x - 52, scene.groundY + 2, 'nest_door').setOrigin(0.5, 1).setRotation(-0.12).setDepth(5);
    this.body = scene.add.image(x, scene.groundY + 4, 'nest').setOrigin(0.5, 1).setDepth(6);
    this.w = 100;
    this.h = 84;
    this.label = txt(scene, x, scene.groundY - 128, fmt(this.hp), 20).setDepth(30);
    this.bar = scene.add.graphics().setDepth(30);
  }

  get y(): number {
    return this.scene.groundY - this.h / 2;
  }

  hit(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    this.dmgAcc += dmg;
    this.flash = 0.06;
    if (this.hp <= 0) {
      this.alive = false;
      this.scene.onEnemyKilled(this, CFG.nest.gold);
    }
  }

  draw(dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    if (this.flash > 0) this.body.setTintFill(0xffffff);
    else this.body.clearTint();
    this.label.setText(fmt(this.hp));
    const g = this.bar;
    g.clear();
    const bw = 44;
    const by = this.scene.groundY - 110;
    g.fillStyle(0x2b2433, 1);
    g.fillRoundedRect(this.x - bw / 2 - 2, by - 2, bw + 4, 10, 4);
    g.fillStyle(0xf07a2a, 1);
    g.fillRoundedRect(this.x - bw / 2, by, bw * Math.max(0, this.hp / this.maxHp), 6, 3);
  }

  wreck(): void {
    this.body.setTint(0x555566).setAlpha(0.6);
    this.door.setRotation(-1.2).setAlpha(0.6);
    this.label.destroy();
    this.bar.destroy();
  }
}

export class Crate {
  taken = false;
  sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene & HitHost, public x: number) {
    this.sprite = scene.add.image(x, scene.groundY + 2, 'crate').setOrigin(0.5, 1).setDepth(7);
    scene.tweens.add({ targets: this.sprite, y: scene.groundY - 6, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
  }
}
