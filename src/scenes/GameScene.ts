import Phaser from 'phaser';
import { CFG, EnemyId, WeaponId, WEAPON_IDS } from '../config';
import { Crate, Nest, Target, Zombie } from '../game/entities';
import { Block, Tower } from '../game/tower';
import {
  drawFx, explode, fireBoomerang, fireHero, fireRocket, Fx, nearestTarget, Particles, Proj, throwGrenade,
  updateProjectiles, updateWeapon, weaponDamage,
} from '../game/combat';
import { WEAPONS } from '../game/meta';
import { button, Btn, fmt, txt } from '../art';

export const GROUND_SCREEN_Y = 440;  // where the road sits on screen at any zoom
const START_X = 300;

export type Mode = 'build' | 'battle' | 'won' | 'lost';

interface RocketJob { block: Block; left: number; timer: number }

export class GameScene extends Phaser.Scene {
  W = 960;
  H = 540;
  groundY = GROUND_SCREEN_Y;

  mode: Mode = 'build';
  started = false;
  offered: WeaponId[] = [];
  tower!: Tower;
  zombies: Zombie[] = [];
  nests: Nest[] = [];
  crates: Crate[] = [];
  projs: Proj[] = [];
  fx: Fx[] = [];
  parts!: Particles;
  abilityTime = {} as Record<WeaponId, number>;
  rocketJobs: RocketJob[] = [];

  heroHp = 0;
  gold = 0;
  energy = 0;
  regenLevel = 0;
  kills = 0;
  section = 0;
  passedCheckpoints = 0;
  spawnTimer = 0;
  speedMult = 1;
  zoom = 1;

  hero!: Phaser.GameObjects.Container;
  heroGun!: Phaser.GameObjects.Image;
  heroBody!: Phaser.GameObjects.Image;
  heroCooldown = 0;
  heroAngle = 0;
  heroFlash = 0;

  aimPointer: Phaser.Input.Pointer | null = null;
  dragBlock: Block | null = null;
  dragPointer: Phaser.Input.Pointer | null = null;
  dragStart = { x: 0, y: 0 };
  dragging = false;
  dragIndex = 0;

  gWorld!: Phaser.GameObjects.Graphics;
  panels: Phaser.GameObjects.GameObject[] = [];
  panelsKey = '';

  constructor() {
    super('game');
  }

  get finishX(): number { return START_X + CFG.stage.length; }
  get regen(): number { return CFG.energy.regen + CFG.energy.regenUpgrade * this.regenLevel; }
  get regenCost(): number { return CFG.energy.upgradeCostBase + CFG.energy.upgradeCostStep * this.regenLevel; }
  get hud(): Phaser.Scene & { toast(s: string): void; flyCoin(x: number, y: number): void; banner(s: string): void; showResult(won: boolean): void } {
    return this.scene.get('hud') as never;
  }

  checkpointX(k: number): number {
    return START_X + (CFG.stage.length * k) / CFG.stage.sections;
  }

  sectionAt(x: number): number {
    return Phaser.Math.Clamp(Math.floor(((x - START_X) / CFG.stage.length) * CFG.stage.sections), 0, CFG.stage.sections - 1);
  }

  hpMult(): number { return CFG.stage.difficulty * (1 + CFG.stage.hpGrowthPerSection * this.section); }
  dmgMult(): number { return CFG.stage.difficulty * (1 + CFG.stage.dmgGrowthPerSection * this.section); }

  targets(): Target[] {
    const out: Target[] = this.zombies.filter((z) => z.alive);
    for (const n of this.nests) if (n.alive) out.push(n);
    return out;
  }

  // ---------------------------------------------------------------- setup

  create(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.resetState();
    this.parts = new Particles(this);
    this.buildWorld();
    this.tower = new Tower(this, START_X, this.groundY);
    for (let i = 0; i < CFG.tower.startBlocks; i++) this.tower.addBlock(0);
    this.tower.blocks.forEach((b) => (b.visY = this.tower.slotY(this.tower.blocks.indexOf(b))));
    this.buildHero();
    for (const f of CFG.stage.nestPositions) {
      const x = START_X + CFG.stage.length * f;
      this.nests.push(new Nest(this, x, CFG.stage.difficulty * (1 + CFG.stage.hpGrowthPerSection * this.sectionAt(x))));
    }
    for (const f of CFG.stage.cratePositions) this.crates.push(new Crate(this, START_X + CFG.stage.length * f));
    this.gWorld = this.add.graphics().setDepth(40);
    this.setupInput();
    this.updateCamera(1);
    this.scene.launch('hud');
    this.scene.bringToTop('hud');
  }

  resetState(): void {
    this.mode = 'build';
    this.started = false;
    this.zombies = [];
    this.nests = [];
    this.crates = [];
    this.projs = [];
    this.fx = [];
    this.rocketJobs = [];
    this.panels = [];
    this.panelsKey = '';
    for (const w of WEAPON_IDS) this.abilityTime[w] = 0;
    this.heroHp = CFG.hero.hp;
    this.gold = CFG.stage.startGold;
    this.energy = CFG.energy.start;
    this.regenLevel = 0;
    this.kills = 0;
    this.section = 0;
    this.passedCheckpoints = 0;
    this.spawnTimer = CFG.spawns.startDelay;
    this.aimPointer = null;
    this.dragBlock = null;
    this.dragging = false;
    this.heroCooldown = 0;
    this.heroAngle = 0;
    this.zoom = 1;
    this.offered = Phaser.Utils.Array.Shuffle([...WEAPON_IDS]).slice(0, 3)
      .sort((a, b) => CFG.weapons[a].price - CFG.weapons[b].price);
  }

  buildWorld(): void {
    const left = -1500;
    const len = CFG.stage.length + 3500;
    this.add.tileSprite(left, this.groundY - 4, len, 40, 'fence').setOrigin(0, 1).setDepth(1);
    this.add.tileSprite(left, this.groundY - 8, len, 260, 'road').setOrigin(0, 0).setDepth(2);
    for (let k = 1; k <= CFG.stage.sections; k++) {
      const x = this.checkpointX(k);
      const end = k === CFG.stage.sections;
      this.add.image(x, this.groundY - 2, 'flag').setOrigin(0.1, 1).setScale(end ? 1 : 0.6).setDepth(3);
      if (!end) txt(this, x + 14, this.groundY - 88, `${k}`, 16).setDepth(3);
    }
  }

  buildHero(): void {
    const pole = this.add.rectangle(-14, -40, 4, 56, 0x5a5f6a).setStrokeStyle(2, 0x3a2621);
    const canopy = this.add.image(-6, -70, 'canopy');
    this.heroBody = this.add.image(0, -24, 'hero');
    this.heroGun = this.add.image(2, -22, 'hero_gun').setOrigin(0.2, 0.5);
    this.hero = this.add.container(this.tower.x, 0, [pole, canopy, this.heroBody, this.heroGun]).setDepth(25);
  }

  // ---------------------------------------------------------------- camera

  updateCamera(lerp: number): void {
    const cam = this.cameras.main;
    const n = Math.max(this.tower.blocks.length, 1);
    const needed = CFG.tower.cartHeight + n * CFG.tower.blockHeight + 90;
    const target = Phaser.Math.Clamp((GROUND_SCREEN_Y - 90) / needed, 0.6, 1);
    this.zoom += (target - this.zoom) * lerp;
    cam.setZoom(this.zoom);
    const anchorX = this.mode === 'build' ? this.W * 0.3 : this.W * 0.26;
    const midX = this.tower.x + (this.W / 2 - anchorX) / this.zoom;
    const midY = this.groundY + (this.H / 2 - GROUND_SCREEN_Y) / this.zoom;
    cam.centerOn(midX, midY);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  // ---------------------------------------------------------------- input

  setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const blockObj = over.find((o) => o.getData && o.getData('block'));
      if (this.mode === 'build') {
        if (blockObj) {
          this.dragBlock = blockObj.getData('block') as Block;
          this.dragPointer = p;
          this.dragStart = { x: p.x, y: p.y };
          this.dragging = false;
        }
        return;
      }
      if (this.mode !== 'battle') return;
      if (blockObj && !this.aimPointer) {
        // tapping the tower opens build mode (game pauses)
        this.enterBuild();
        return;
      }
      if (over.length === 0 && !this.aimPointer) this.aimPointer = p;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p !== this.dragPointer || !this.dragBlock) return;
      if (!this.dragging && Phaser.Math.Distance.Between(p.x, p.y, this.dragStart.x, this.dragStart.y) > 10) {
        this.dragging = true;
        this.dragBlock.container.setDepth(60);
        this.clearPanels();
      }
      if (this.dragging) {
        this.dragIndex = this.dropIndexAt(p.worldY);
        this.dragBlock.visY = p.worldY;
        this.dragBlock.container.setPosition(p.worldX, p.worldY);
      }
    });

    const release = (p: Phaser.Input.Pointer) => {
      if (p === this.aimPointer) this.aimPointer = null;
      if (p !== this.dragPointer || !this.dragBlock) return;
      const b = this.dragBlock;
      if (this.dragging) {
        b.container.setDepth(20);
        if (this.isOverTrash(p)) {
          this.sellBlock(b);
        } else {
          const blocks = this.tower.blocks;
          blocks.splice(blocks.indexOf(b), 1);
          blocks.splice(this.dragIndex, 0, b);
        }
      }
      this.dragBlock = null;
      this.dragPointer = null;
      this.dragging = false;
      this.panelsKey = '';
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  dropIndexAt(worldY: number): number {
    const i = Math.floor((this.groundY - CFG.tower.cartHeight - worldY) / this.tower.bh);
    return Phaser.Math.Clamp(i, 0, this.tower.blocks.length - 1);
  }

  isOverTrash(p: Phaser.Input.Pointer): boolean {
    return p.x < 120 && p.y > 110 && p.y < 230;
  }

  // ---------------------------------------------------------------- modes & economy

  enterBuild(): void {
    if (this.mode !== 'battle') return;
    this.mode = 'build';
    this.aimPointer = null;
    this.panelsKey = '';
  }

  startBattle(): void {
    if (this.mode !== 'build') return;
    if (!this.tower.blocks.some((b) => b.weapon)) {
      this.hud.toast('Buy a weapon first!');
      return;
    }
    this.mode = 'battle';
    this.started = true;
    this.clearPanels();
  }

  spend(cost: number): boolean {
    if (this.gold < cost) {
      this.hud.toast('Not enough gold');
      return false;
    }
    this.gold -= cost;
    this.panelsKey = '';
    return true;
  }

  buyBlock(): void {
    if (this.tower.blocks.length >= CFG.tower.maxBlocks) return this.hud.toast('Tower is full');
    const cost = this.tower.blockCost();
    if (!this.spend(cost)) return;
    this.tower.addBlock(cost);
  }

  buyWeapon(b: Block, w: WeaponId): void {
    const cost = CFG.weapons[w].price;
    if (!this.spend(cost)) return;
    this.tower.setWeapon(b, w, cost);
  }

  weaponUpgradeCost(b: Block): number {
    return CFG.weaponLevel.upgradeCostStep * b.level;
  }

  upgradeWeapon(b: Block): void {
    const cost = this.weaponUpgradeCost(b);
    if (!this.spend(cost)) return;
    b.level++;
    b.weaponSpent += cost;
  }

  sellWeapon(b: Block): void {
    const r = Math.floor(b.weaponSpent * CFG.weaponLevel.sellRefund);
    this.gold += r;
    this.tower.setWeapon(b, null, 0);
    this.panelsKey = '';
  }

  upgradeBlockHp(b: Block): void {
    const cost = this.tower.hpUpgradeCost(b);
    if (!this.spend(cost)) return;
    this.tower.upgradeHp(b, cost);
  }

  upgradeRegen(): void {
    if (!this.spend(this.regenCost)) return;
    this.regenLevel++;
  }

  blockRefund(b: Block): number {
    return Math.floor(b.blockSpent * CFG.tower.blockSellRefund + b.weaponSpent * CFG.weaponLevel.sellRefund);
  }

  sellBlock(b: Block): void {
    if (this.tower.blocks.length <= 1) {
      this.hud.toast('Keep at least one block');
      return;
    }
    this.gold += this.blockRefund(b);
    this.tower.removeBlock(b);
    this.panelsKey = '';
  }

  ownedTypes(): WeaponId[] {
    const set = new Set<WeaponId>();
    for (const b of this.tower.blocks) if (b.weapon) set.add(b.weapon);
    return this.offered.filter((w) => set.has(w));
  }

  useAbility(w: WeaponId): void {
    if (this.mode !== 'battle') return;
    const ab = CFG.abilities[w];
    if (this.energy < ab.cost) return this.hud.toast('Not enough energy');
    const blocks = this.tower.blocks.filter((b) => b.weapon === w);
    if (!blocks.length) return;
    this.energy -= ab.cost;
    const a = CFG.abilities;
    switch (w) {
      case 'saw': this.abilityTime.saw = a.saw.duration; break;
      case 'flame': this.abilityTime.flame = a.flame.duration; break;
      case 'laser': this.abilityTime.laser = a.laser.duration; break;
      case 'mg': this.abilityTime.mg = a.mg.duration; break;
      case 'shocker':
        for (const b of blocks) {
          const m = this.tower.muzzle(b);
          this.fx.push({ kind: 'ring', x1: m.x, y1: m.y, x2: 0, y2: 0, width: 8, color: 0xfff27a, life: 0.4, maxLife: 0.4, radius: a.shocker.radius, grow: true });
          for (const t of this.targets()) {
            if (Math.hypot(t.x - m.x, t.y - m.y) > a.shocker.radius) continue;
            t.hit(weaponDamage(b, a.shocker.damage));
            if (t instanceof Zombie) t.freeze(a.shocker.stun);
            if (Math.random() < 0.5) this.fx.push({ kind: 'bolt', x1: m.x, y1: m.y, x2: t.x, y2: t.y, width: 3, color: 0xfff27a, life: 0.2, maxLife: 0.2 });
          }
        }
        this.cameras.main.flash(120, 255, 250, 180);
        break;
      case 'rocket':
        for (const b of blocks) this.rocketJobs.push({ block: b, left: a.rocket.count, timer: 0 });
        break;
      case 'cryo':
        for (const t of this.targets()) {
          if (Math.abs(t.x - this.tower.x) > a.cryo.radius) continue;
          t.hit(a.cryo.damage);
          if (t instanceof Zombie) t.freeze(a.cryo.freezeTime);
          this.parts.burst(t.x, t.y, 3, 60, 0.4, 0.3, 0.6, [0xffffff, 0x9fe3ff], {});
        }
        this.cameras.main.flash(200, 190, 240, 255);
        break;
      case 'boomerang':
        for (const b of blocks) {
          const m = this.tower.muzzle(b);
          for (let k = 0; k < a.boomerang.count; k++) fireBoomerang(this, b, m.x + 30, m.y, -0.35 + (0.7 * k) / Math.max(1, a.boomerang.count - 1), true);
        }
        break;
    }
  }

  useGrenade(): void {
    if (this.mode !== 'battle') return;
    const c = CFG.grenade;
    if (this.energy < c.cost) return this.hud.toast('Not enough energy');
    const hx = this.hero.x;
    const hy = this.hero.y - 30;
    let tx: number;
    let ty: number;
    if (this.aimPointer) {
      tx = this.aimPointer.worldX;
      ty = Math.min(this.aimPointer.worldY, this.groundY - 10);
    } else {
      // aim at the densest group in range
      let best: Target | null = null;
      let bestN = 0;
      const ts = this.targets();
      for (const t of ts) {
        if (t.x < this.tower.frontX || t.x - hx > 520) continue;
        const n = ts.filter((o) => Math.abs(o.x - t.x) < c.radius && Math.abs(o.y - t.y) < c.radius).length;
        if (n > bestN) { bestN = n; best = t; }
      }
      if (!best) return this.hud.toast('No targets');
      tx = best.x;
      ty = best.y;
    }
    this.energy -= c.cost;
    throwGrenade(this, hx, hy, tx, ty);
  }

  onEnemyKilled(t: Target, gold: number): void {
    this.gold += gold;
    this.kills++;
    const s = this.worldToScreen(t.x, t.y);
    const coins = t instanceof Nest ? 8 : 1;
    for (let i = 0; i < coins; i++) this.time.delayedCall(i * 60, () => this.hud.flyCoin(s.x + (Math.random() - 0.5) * 40, s.y));
    if (t instanceof Nest) {
      explode(this, t.x, t.y, 90, 0);
      this.cameras.main.shake(250, 0.008);
      t.wreck();
      this.hud.banner('Nest destroyed!');
    } else {
      this.parts.burst(t.x, t.y, 6, 140, 0.35, 0.4, 0.9, [0xb6e36a, 0x7fb03a], { grav: 300, up: 80 });
    }
    this.panelsKey = '';
  }

  // ---------------------------------------------------------------- build panels (world-anchored)

  clearPanels(): void {
    this.panels.forEach((o) => o.destroy());
    this.panels = [];
  }

  refreshPanels(): void {
    const key = this.mode === 'build' && !this.dragging
      ? JSON.stringify([Math.floor(this.gold), this.tower.blocks.map((b) => [b.weapon, b.level, b.hpLevel, Math.round(b.visY)])])
      : '';
    if (key === this.panelsKey) return;
    this.panelsKey = key;
    this.clearPanels();
    if (!key) return;
    const t = this.tower;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.panels.push(o);
      return o;
    };
    const coinCost = (c: Phaser.GameObjects.Container, y: number, cost: number | string, x = 0) => {
      c.add(this.add.image(x - 20, y, 'coin').setScale(0.55));
      c.add(txt(this, x + 6, y, `${cost}`, 15, '#ffffff', 4));
    };
    t.blocks.forEach((b) => {
      const y = t.slotY(t.blocks.indexOf(b));
      // HP card (left)
      const hpCost = t.hpUpgradeCost(b);
      const hp = add(button(this, t.x - t.bw / 2 - 44, y, 70, 52, 0x8c97a8, () => this.upgradeBlockHp(b)));
      hp.setDepth(45);
      hp.add(txt(this, -20, -16, `Lv${b.hpLevel}`, 12, '#ffffff', 3).setOrigin(0, 0.5));
      hp.add(txt(this, 0, -2, `HP ${Math.round(b.maxHp)}`, 13, '#ffffff', 3));
      coinCost(hp, 15, hpCost, 2);
      hp.setEnabled(this.gold >= hpCost);
      // weapon side (right)
      const x0 = t.x + t.bw / 2 + 50;
      if (!b.weapon) {
        this.offered.forEach((w, k) => {
          const price = CFG.weapons[w].price;
          const btn = add(button(this, x0 + k * 64, y, 58, 52, 0x4aa3f0, () => this.buyWeapon(b, w)));
          btn.setDepth(45);
          const icon = this.add.image(0, -8, WEAPONS[w].icon);
          icon.setScale(Math.min(42 / icon.width, 26 / icon.height));
          btn.add(icon);
          btn.add(this.add.image(-16, 14, 'coin').setScale(0.45));
          btn.add(txt(this, 6, 14, `${price}`, 14, '#ffffff', 4));
          btn.setEnabled(this.gold >= price);
        });
      } else {
        const cost = this.weaponUpgradeCost(b);
        const lv = add(button(this, x0 + 30, y, 116, 52, 0x4aa3f0, () => this.upgradeWeapon(b)));
        lv.setDepth(45);
        const g = this.add.graphics();
        const pips = 6;
        const filled = ((b.level - 1) % pips) + 1;
        for (let i = 0; i < pips; i++) {
          g.fillStyle(i < filled ? 0x2a5fb0 : 0x9ccaf5, 1);
          g.fillRoundedRect(-50 + i * 17, -23, 14, 6, 2);
        }
        lv.add(g);
        const dmg = (CFG.weapons[b.weapon] as { damage: number }).damage;
        lv.add(txt(this, 0, -7, `Lv${b.level} Damage ${fmt(weaponDamage(b, dmg))}`, 13, '#ffffff', 3));
        const band = this.add.graphics();
        band.fillStyle(0x5cc35a, 1);
        band.fillRoundedRect(-54, 5, 108, 18, 5);
        lv.add(band);
        coinCost(lv, 14, cost);
        lv.setEnabled(this.gold >= cost);
        const sellValue = Math.floor(b.weaponSpent * CFG.weaponLevel.sellRefund);
        const sell = add(button(this, x0 + 134, y, 76, 52, 0x4aa3f0, () => this.sellWeapon(b)));
        sell.setDepth(45);
        sell.add(txt(this, 0, -9, 'SELL', 17, '#ffffff', 4));
        const band2 = this.add.graphics();
        band2.fillStyle(0x5cc35a, 1);
        band2.fillRoundedRect(-34, 5, 68, 18, 5);
        sell.add(band2);
        coinCost(sell, 14, sellValue);
      }
    });
  }

  // ---------------------------------------------------------------- loop

  update(_time: number, deltaMs: number): void {
    const realDt = Math.min(0.05, deltaMs / 1000);
    const dt = realDt * (this.mode === 'battle' ? this.speedMult : 0);
    this.gWorld.clear();
    if (this.mode === 'battle') {
      this.energy = Math.min(CFG.energy.max, this.energy + this.regen * dt);
      for (const w of WEAPON_IDS) this.abilityTime[w] = Math.max(0, this.abilityTime[w] - dt);
      this.updateSpawns(dt);
      this.updateNests(dt);
      const moved = this.updateTowerMovement(dt);
      this.tower.update(dt, moved, null, 0);
      this.updateZombies(dt);
      this.updateHero(dt);
      for (const b of this.tower.blocks) updateWeapon(this, b, dt);
      this.updateRocketJobs(dt);
      updateProjectiles(this, dt, this.groundY);
      this.cleanupDead();
      this.checkProgress();
    } else {
      this.tower.update(realDt, 0, this.dragging ? this.dragBlock : null, this.dragIndex);
    }
    this.parts.update(this.mode === 'battle' ? dt : realDt * 0.0);
    this.positionHero(realDt);
    this.zombies.forEach((z) => z.draw());
    this.nests.forEach((n) => n.draw(dt));
    this.drawOverlays();
    drawFx(this.gWorld, this.fx, dt);
    this.popNumbers(dt);
    this.updateCamera(Math.min(1, realDt * 4));
    this.refreshPanels();
  }

  updateRocketJobs(dt: number): void {
    const a = CFG.abilities.rocket;
    for (const j of this.rocketJobs) {
      j.timer -= dt;
      if (j.timer > 0 || j.left <= 0) continue;
      j.timer = 0.12;
      j.left--;
      if (!this.tower.blocks.includes(j.block)) { j.left = 0; continue; }
      const ts = this.targets().filter((t) => !t.isAir && t.x > this.tower.frontX && t.x - this.tower.x < 700);
      const t = ts.length ? Phaser.Utils.Array.GetRandom(ts) as Target : null;
      const m = this.tower.muzzle(j.block);
      const tx = t ? t.x : this.tower.frontX + 200 + Math.random() * 300;
      fireRocket(this, m.x + 20, m.y - 10, tx, t ? t.y : this.groundY - 20, weaponDamage(j.block, a.damage), a.splash);
    }
    this.rocketJobs = this.rocketJobs.filter((j) => j.left > 0);
  }

  popNumbers(dt: number): void {
    for (const t of this.targets().concat(this.zombies.filter((z) => !z.alive) as Target[])) {
      t.numTimer -= dt;
      if (t.dmgAcc <= 0 || t.numTimer > 0) continue;
      t.numTimer = 0.28;
      const n = Math.max(1, Math.round(t.dmgAcc));
      t.dmgAcc = 0;
      const big = n >= 20;
      const label = txt(this, t.x + (Math.random() - 0.5) * 20, t.y - t.h / 2 - 8, fmt(n), big ? 20 : 15, big ? '#ffd23a' : '#ffffff', 4).setDepth(50);
      this.tweens.add({ targets: label, y: label.y - 26, duration: 500, ease: 'Cubic.out' });
      this.tweens.add({ targets: label, alpha: 0, delay: 350, duration: 250, onComplete: () => label.destroy() });
    }
  }

  updateSpawns(dt: number): void {
    const s = CFG.spawns;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = s.interval * Math.pow(s.intervalFactorPerSection, this.section) * (0.7 + Math.random() * 0.6);
    if (this.zombies.length >= s.maxAlive) return;
    if (this.tower.x > this.finishX - 300) return;
    const n = Phaser.Math.Between(s.groupMin, s.groupMax);
    const baseX = this.cameras.main.worldView.right + 40;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let kind: EnemyId = 'walker';
      if (r < s.flyerChance) kind = 'flyer';
      else if (r < s.flyerChance + s.bruteChance) kind = 'brute';
      else if (r < s.flyerChance + s.bruteChance + s.runnerChance) kind = 'runner';
      else if (r < s.flyerChance + s.bruteChance + s.runnerChance + s.climberChance) kind = 'climber';
      const alt = kind === 'flyer' ? Phaser.Math.Between(s.flyerAltMin, s.flyerAltMax) : 0;
      this.zombies.push(new Zombie(this, kind, baseX + i * 34, alt, this.hpMult(), this.dmgMult()));
    }
  }

  updateNests(dt: number): void {
    const c = CFG.nest;
    for (const n of this.nests) {
      if (!n.alive || n.x - this.tower.frontX > c.activationRange) continue;
      n.spawnTimer -= dt;
      if (n.spawnTimer > 0 || this.zombies.length >= CFG.spawns.maxAlive) continue;
      n.spawnTimer = c.spawnInterval;
      const r = Math.random();
      const kind: EnemyId = r < c.runnerChance ? 'runner' : r < c.runnerChance + c.climberChance ? 'climber' : 'walker';
      const z = new Zombie(this, kind, n.x - 30, 0, this.hpMult(), this.dmgMult());
      this.zombies.push(z);
      n.door.setRotation(-0.5);
      this.time.delayedCall(200, () => n.door.active && n.alive && n.door.setRotation(-0.12));
    }
  }

  updateTowerMovement(dt: number): number {
    const t = this.tower;
    const front = t.frontX;
    const touching = this.zombies.some((z) => !z.isAir && z.attacking && z.alive);
    let limit = Infinity;
    for (const n of this.nests) if (n.alive && n.x > front - 20) limit = Math.min(limit, n.x - n.w / 2 - CFG.nest.blockGap);
    let speed = CFG.tower.cartSpeed;
    if (touching) speed = 0;
    else if (this.zombies.some((z) => !z.isAir && z.alive && z.x - z.w / 2 - front < CFG.tower.slowDistance)) speed *= CFG.tower.slowSpeedFactor;
    const newFront = Math.min(front + speed * dt, Math.max(front, limit));
    const moved = newFront - front;
    t.x += moved;

    for (const c of this.crates) {
      if (c.taken || t.frontX < c.x - 20) continue;
      c.taken = true;
      this.tweens.add({ targets: c.sprite, y: c.sprite.y - 60, alpha: 0, duration: 300, onComplete: () => c.sprite.destroy() });
      if (t.blocks.length < CFG.tower.maxBlocks) {
        t.addBlock(0);
        this.hud.banner('Free block!');
      } else {
        this.gold += CFG.stage.crateGoldIfFull;
        this.hud.banner(`+${CFG.stage.crateGoldIfFull} gold`);
      }
    }
    return moved;
  }

  updateZombies(dt: number): void {
    const t = this.tower;
    const ph = CFG.physics;
    const front = t.frontX;
    const ground = this.zombies.filter((z) => !z.isAir && z.alive).sort((a, b) => a.x - b.x);

    for (const z of ground) {
      z.tickStatus(dt);
      const mult = z.speedMult;
      let nx = z.x - z.speed * mult * dt;
      let blocker: Zombie | null = null;
      z.attacking = false;
      if (nx - z.w / 2 < front) {
        nx = front + z.w / 2;
        z.attacking = true;
      }
      for (const o of ground) {
        if (o === z || o.x >= z.x) continue;
        if (o.top <= z.alt + ph.stepUp) continue;
        if (o.alt >= z.top - ph.stepUp) continue;
        const minX = o.x + ((o.w + z.w) / 2) * ph.crowdOverlap;
        if (nx < minX) {
          nx = Math.max(Math.min(minX, z.x), nx);
          if (!blocker || o.top > blocker.top) blocker = o;
        }
      }
      if (nx < front + z.w / 2) nx = front + z.w / 2;
      z.blocked = z.attacking || !!blocker;
      z.x = nx;

      z.climbing = false;
      if (blocker && blocker.blocked && z.climbSpeed > 0 && mult > 0 && !z.attacking) {
        z.alt = Math.min(blocker.top, z.alt + z.climbSpeed * mult * dt);
        z.climbing = true;
      }
      let floor = 0;
      for (const o of ground) {
        if (o === z) continue;
        if (Math.abs(o.x - z.x) > ((o.w + z.w) / 2) * 0.6) continue;
        if (o.top <= z.alt + ph.stepUp) floor = Math.max(floor, o.top);
      }
      if (!z.climbing) z.alt = z.alt > floor ? Math.max(floor, z.alt - ph.fallSpeed * dt) : floor;

      if (z.attacking && mult > 0) {
        z.attackTimer -= dt * mult;
        if (z.attackTimer <= 0) {
          z.attackTimer = z.attackInterval;
          z.lunge = 0.15;
          this.zombieHitsTower(z, z.alt + z.h * 0.5);
        }
      }
    }

    for (const z of this.zombies) {
      if (!z.isAir || !z.alive) continue;
      z.tickStatus(dt);
      const mult = z.speedMult;
      const tx = t.x + 46;
      const targetAlt = this.groundY - (t.visTopY - 40);
      const dx = tx - z.x;
      const da = targetAlt - z.alt;
      const d = Math.hypot(dx, da) || 1;
      z.attacking = d < 14;
      if (!z.attacking) {
        const step = Math.min(d, z.speed * mult * dt);
        z.x += (dx / d) * step;
        z.alt += (da / d) * step;
      } else if (mult > 0) {
        z.attackTimer -= dt * mult;
        if (z.attackTimer <= 0) {
          z.attackTimer = z.attackInterval;
          z.lunge = 0.15;
          this.damageHero(z.damage);
        }
      }
    }
  }

  zombieHitsTower(z: Zombie, alt: number): void {
    const idx = this.tower.blockIndexAtAlt(alt);
    if (idx < 0) return this.damageHero(z.damage);
    const b = this.tower.blocks[idx];
    b.hp -= z.damage;
    b.flash = 0.1;
    b.hitShow = 2;
    if (b.hp <= 0) {
      this.parts.burst(this.tower.x, b.visY, 14, 220, 0.6, 0.5, 1.2, [0xb8693e, 0x8f4a2a, 0x6a5a55], { grav: 500, up: 100 });
      this.cameras.main.shake(180, 0.006);
      this.tower.removeBlock(b);
      if (this.tower.blocks.length === 0) this.hud.toast('Tower destroyed!');
    }
  }

  damageHero(d: number): void {
    this.heroHp -= d;
    this.heroFlash = 0.1;
    if (this.heroHp <= 0) {
      this.heroHp = 0;
      this.endStage(false);
    }
  }

  updateHero(dt: number): void {
    this.heroCooldown -= dt;
    this.heroFlash = Math.max(0, this.heroFlash - dt);
    const gx = this.hero.x + 4;
    const gy = this.hero.y - 22;
    if (this.aimPointer) {
      this.heroAngle = Math.atan2(this.aimPointer.worldY - gy, this.aimPointer.worldX - gx);
      if (this.heroCooldown <= 0) {
        this.heroCooldown = CFG.hero.aimFireInterval;
        fireHero(this, gx + Math.cos(this.heroAngle) * 30, gy + Math.sin(this.heroAngle) * 30, this.heroAngle);
      }
      return;
    }
    const target = nearestTarget(this, gx, gy, CFG.hero.range, true);
    if (target) {
      const want = Math.atan2(target.y - gy, target.x - gx);
      this.heroAngle = Phaser.Math.Angle.RotateTo(this.heroAngle, want, dt * 10);
      if (this.heroCooldown <= 0) {
        this.heroCooldown = CFG.hero.fireInterval;
        fireHero(this, gx + Math.cos(want) * 30, gy + Math.sin(want) * 30, want);
      }
    } else {
      this.heroCooldown = Math.max(this.heroCooldown, 0);
    }
  }

  positionHero(dt: number): void {
    const targetY = this.tower.visTopY;
    if (this.hero.y === 0) this.hero.y = targetY;
    if (this.hero.y < targetY) this.hero.y = Math.min(targetY, this.hero.y + CFG.tower.dropSpeed * dt);
    else this.hero.y = Math.max(targetY, this.hero.y - CFG.tower.dropSpeed * 2 * dt);
    this.hero.x = this.tower.x - 4;
    this.heroGun.rotation = this.heroAngle;
    this.heroGun.setFlipY(Math.abs(this.heroAngle) > Math.PI / 2);
    if (this.heroFlash > 0) this.heroBody.setTintFill(0xffffff);
    else this.heroBody.clearTint();
  }

  drawOverlays(): void {
    const g = this.gWorld;
    if (this.aimPointer && this.mode === 'battle') {
      const half = Phaser.Math.DegToRad(Math.max(CFG.hero.spreadDeg, 8)) / 2 + 0.04;
      g.fillStyle(0xffffff, 0.16);
      g.slice(this.hero.x + 4, this.hero.y - 22, CFG.hero.range, this.heroAngle - half, this.heroAngle + half, false);
      g.fillPath();
      g.lineStyle(3, 0xffffff, 0.7);
      g.strokeCircle(this.aimPointer.worldX, this.aimPointer.worldY, 16);
    }
    for (const z of this.zombies) {
      if (!z.alive || z.hp >= z.maxHp) continue;
      const w = 30;
      const y = z.y - z.h / 2 - 10;
      g.fillStyle(0x2b2433, 1);
      g.fillRoundedRect(z.x - w / 2 - 2, y - 2, w + 4, 8, 3);
      g.fillStyle(0xf07a2a, 1);
      g.fillRoundedRect(z.x - w / 2, y, w * Math.max(0, z.hp / z.maxHp), 4, 2);
    }
    // block HP: vertical green bar on the left when hurt
    for (const b of this.tower.blocks) {
      if (b.hp >= b.maxHp && b.hitShow <= 0) continue;
      const x = this.tower.x - this.tower.bw / 2 - 12;
      const h = this.tower.bh - 14;
      const y = b.visY - h / 2;
      g.fillStyle(0x2b2433, 1);
      g.fillRoundedRect(x - 4, y - 2, 10, h + 4, 4);
      g.fillStyle(0x3a3a3a, 1);
      g.fillRoundedRect(x - 2, y, 6, h, 3);
      const f = Math.max(0, b.hp / b.maxHp);
      g.fillStyle(f > 0.35 ? 0x6ad44a : 0xe8453c, 1);
      g.fillRoundedRect(x - 2, y + h * (1 - f), 6, h * f, 3);
    }
    // drop slot while dragging
    if (this.dragging && this.dragBlock) {
      g.lineStyle(3, 0xffffff, 0.9);
      g.strokeRoundedRect(this.tower.x - this.tower.bw / 2, this.tower.slotY(this.dragIndex) - this.tower.bh / 2, this.tower.bw, this.tower.bh, 6);
    }
  }

  cleanupDead(): void {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (!z.alive || z.x < this.cameras.main.worldView.x - 300) {
        z.destroy();
        this.zombies.splice(i, 1);
      }
    }
  }

  checkProgress(): void {
    const x = this.tower.frontX;
    this.section = this.sectionAt(this.tower.x);
    while (this.passedCheckpoints < CFG.stage.sections - 1 && x >= this.checkpointX(this.passedCheckpoints + 1)) {
      this.passedCheckpoints++;
      const heal = CFG.stage.checkpointHealPct;
      for (const b of this.tower.blocks) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * heal);
      this.heroHp = Math.min(CFG.hero.hp, this.heroHp + CFG.hero.hp * heal);
      this.hud.banner(`Checkpoint ${this.passedCheckpoints}`);
    }
    if (x >= this.finishX) {
      this.passedCheckpoints = CFG.stage.sections;
      this.endStage(true);
    }
  }

  endStage(won: boolean): void {
    if (this.mode !== 'battle') return;
    this.mode = won ? 'won' : 'lost';
    this.aimPointer = null;
    this.time.delayedCall(won ? 300 : 700, () => this.hud.showResult(won));
  }

  restartStage(): void {
    this.scene.stop('hud');
    this.scene.restart();
  }
}

export type { Btn };
