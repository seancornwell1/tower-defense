import Phaser from 'phaser';
import { CFG, EnemyId, WeaponId, WEAPON_IDS } from '../config';
import { Crate, Nest, Target, Zombie } from '../game/entities';
import { Block, Tower } from '../game/tower';
import { drawFx, fireHero, Fx, nearestTarget, Proj, updateProjectiles, updateWeapon } from '../game/combat';
import { UI, WEAPONS } from '../game/meta';
import { openTuning } from '../tuning';

declare const __BUILD_TIME__: string;

const START_X = 220;
const TRIPLE_TAP_ZONE = { w: 80, h: 64 };

type Phase = 'intro' | 'play' | 'won' | 'lost';

interface ShopCard {
  weapon: WeaponId;
  bg: Phaser.GameObjects.Rectangle;
  cost: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  W = 540;
  H = 960;
  groundY = 700;

  phase: Phase = 'intro';
  offered: WeaponId[] = [];
  tower!: Tower;
  zombies: Zombie[] = [];
  nests: Nest[] = [];
  crates: Crate[] = [];
  projs: Proj[] = [];
  fx: Fx[] = [];
  heroHp = 0;
  gold = 0;
  kills = 0;
  section = 0;
  passedCheckpoints = 0;
  spawnTimer = 0;
  speedMult = 1;
  elapsed = 0;

  hero!: Phaser.GameObjects.Container;
  heroGun!: Phaser.GameObjects.Rectangle;
  heroCooldown = 0;
  heroAngle = 0;
  heroFlash = 0;

  aimPointer: Phaser.Input.Pointer | null = null;
  dragBlock: Block | null = null;
  dragPointer: Phaser.Input.Pointer | null = null;
  dragStart = { x: 0, y: 0 };
  dragging = false;
  dragIndex = 0;
  selected: Block | null = null;
  tapTimes: number[] = [];

  gWorld!: Phaser.GameObjects.Graphics;
  gHud!: Phaser.GameObjects.Graphics;
  goldText!: Phaser.GameObjects.Text;
  hpText!: Phaser.GameObjects.Text;
  blocksText!: Phaser.GameObjects.Text;
  trash!: Phaser.GameObjects.Rectangle;
  trashLabel!: Phaser.GameObjects.Text;
  speedBtn!: Phaser.GameObjects.Text;
  shopCards: ShopCard[] = [];
  selPanel: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];
  selText!: Phaser.GameObjects.Text;
  selBtn!: Phaser.GameObjects.Rectangle;
  selBtnText!: Phaser.GameObjects.Text;
  hintText!: Phaser.GameObjects.Text;
  overlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('game');
  }

  get finishX(): number {
    return START_X + CFG.stage.length;
  }

  checkpointX(k: number): number {
    return START_X + (CFG.stage.length * k) / CFG.stage.sections;
  }

  hpMult(): number {
    return CFG.stage.difficulty * (1 + CFG.stage.hpGrowthPerSection * this.section);
  }

  dmgMult(): number {
    return CFG.stage.difficulty * (1 + CFG.stage.dmgGrowthPerSection * this.section);
  }

  targets(): Target[] {
    return [...this.zombies, ...this.nests];
  }

  create(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.groundY = this.H - 250;
    this.resetState();

    this.cameras.main.setBackgroundColor(0xaab4c0);
    this.buildBackground();
    this.tower = new Tower(this, START_X, this.groundY);
    this.buildHero();
    this.spawnLevelObjects();
    this.gWorld = this.add.graphics().setDepth(40);
    this.buildHud();
    this.setupInput();
    this.showIntro();
    this.cameras.main.scrollX = this.tower.x - 150;
  }

  resetState(): void {
    this.phase = 'intro';
    this.zombies = [];
    this.nests = [];
    this.crates = [];
    this.projs = [];
    this.fx = [];
    this.shopCards = [];
    this.heroHp = CFG.hero.hp;
    this.gold = CFG.stage.startGold;
    this.kills = 0;
    this.section = 0;
    this.passedCheckpoints = 0;
    this.spawnTimer = CFG.spawns.startDelay;
    this.elapsed = 0;
    this.aimPointer = null;
    this.dragBlock = null;
    this.dragging = false;
    this.selected = null;
    this.overlay = null;
    this.heroCooldown = 0;
    this.heroAngle = 0;
    const pool = Phaser.Utils.Array.Shuffle([...WEAPON_IDS]);
    this.offered = pool.slice(0, 3);
  }

  // ---------------------------------------------------------------- world

  buildBackground(): void {
    const len = CFG.stage.length + 1200;
    // far skyline (parallax)
    const far = this.add.graphics().setScrollFactor(0.35).setDepth(0);
    far.fillStyle(0x8e98a6);
    let x = -100;
    while (x < len * 0.35 + this.W + 200) {
      const w = 50 + Math.random() * 70;
      const h = 120 + Math.random() * 220;
      far.fillRect(x, this.groundY - h, w, h);
      x += w + 10 + Math.random() * 30;
    }
    const near = this.add.graphics().setScrollFactor(0.7).setDepth(1);
    near.fillStyle(0x76808e);
    x = -100;
    while (x < len * 0.7 + this.W + 200) {
      const w = 60 + Math.random() * 90;
      const h = 60 + Math.random() * 160;
      near.fillRect(x, this.groundY - h, w, h);
      // broken windows
      near.fillStyle(0x5c6572);
      for (let wy = this.groundY - h + 12; wy < this.groundY - 20; wy += 26) {
        for (let wx = x + 8; wx < x + w - 14; wx += 20) if (Math.random() < 0.7) near.fillRect(wx, wy, 10, 12);
      }
      near.fillStyle(0x76808e);
      x += w + 20 + Math.random() * 60;
    }
    // ground
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x5d5348);
    g.fillRect(-400, this.groundY, len + 800, this.H - this.groundY);
    g.fillStyle(0x4a4239);
    g.fillRect(-400, this.groundY, len + 800, 8);
    for (let gx = -400; gx < len + 400; gx += 90) g.fillRect(gx, this.groundY + 22, 40, 5);
    // checkpoints + finish
    for (let k = 1; k <= CFG.stage.sections; k++) {
      const cx = this.checkpointX(k);
      const isFinish = k === CFG.stage.sections;
      g.fillStyle(isFinish ? 0x222222 : 0x3b6ea5);
      g.fillRect(cx - 3, this.groundY - 190, 6, 190);
      g.fillStyle(isFinish ? 0xffffff : 0x6aa6e8);
      g.fillRect(cx + 3, this.groundY - 190, 46, 30);
      this.add.text(cx + 26, this.groundY - 175, isFinish ? 'END' : `CP${k}`, { fontSize: '14px', color: '#111', fontStyle: 'bold' })
        .setOrigin(0.5).setDepth(3);
    }
  }

  spawnLevelObjects(): void {
    for (const f of CFG.stage.nestPositions) {
      const x = START_X + CFG.stage.length * f;
      this.nests.push(new Nest(this, x, CFG.stage.difficulty * (1 + CFG.stage.hpGrowthPerSection * this.sectionAt(x))));
    }
    for (const f of CFG.stage.cratePositions) this.crates.push(new Crate(this, START_X + CFG.stage.length * f));
  }

  sectionAt(x: number): number {
    return Phaser.Math.Clamp(Math.floor(((x - START_X) / CFG.stage.length) * CFG.stage.sections), 0, CFG.stage.sections - 1);
  }

  buildHero(): void {
    const body = this.add.rectangle(0, 6, 26, 32, 0x3f6fb5).setStrokeStyle(2, 0x1a2a44);
    const head = this.add.rectangle(0, -18, 22, 20, 0xf0c8a0).setStrokeStyle(2, 0x5a4030);
    const band = this.add.rectangle(0, -26, 24, 6, 0xd04040);
    this.heroGun = this.add.rectangle(4, 0, 34, 8, 0x2a2a2a).setOrigin(0.1, 0.5);
    this.hero = this.add.container(this.tower.x, 0, [body, head, band, this.heroGun]).setDepth(25);
  }

  // ---------------------------------------------------------------- HUD

  text(x: number, y: number, s: string, size = 16, color = UI.text): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, { fontFamily: UI.font, fontSize: `${size}px`, color, fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(110);
  }

  buildHud(): void {
    this.gHud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.goldText = this.text(this.W - 14, 46, '', 22, UI.gold).setOrigin(1, 0);
    this.hpText = this.text(96, 50, '', 13).setOrigin(0.5, 0);
    this.blocksText = this.text(this.W - 14, 74, '', 13, UI.dim).setOrigin(1, 0);
    this.speedBtn = this.text(this.W - 14, 96, 'x1', 18).setOrigin(1, 0).setPadding(10, 4, 10, 4)
      .setBackgroundColor('#3a3f4b').setInteractive();
    this.speedBtn.on('pointerdown', () => {
      this.speedMult = this.speedMult === 1 ? 2 : 1;
      this.speedBtn.setText(`x${this.speedMult}`);
    });

    // trash can (top-left)
    this.trash = this.add.rectangle(46, 128, 64, 64, 0x3a3f4b).setStrokeStyle(3, 0x22252b).setScrollFactor(0).setDepth(105);
    this.trashLabel = this.text(46, 128, 'TRASH\nsell', 12, UI.dim).setOrigin(0.5).setAlign('center');

    // bottom shop
    const cardsTop = this.groundY + 118;
    const cardH = this.H - cardsTop - 12;
    const cardW = (this.W - 16 * 4) / 3;
    this.add.rectangle(this.W / 2, this.groundY + 42 + (this.H - this.groundY - 42) / 2, this.W, this.H - this.groundY - 42, UI.panel)
      .setScrollFactor(0).setDepth(100);
    this.offered.forEach((w, i) => {
      const meta = WEAPONS[w];
      const cx = 16 + cardW / 2 + i * (cardW + 16);
      const cy = cardsTop + cardH / 2;
      const bg = this.add.rectangle(cx, cy, cardW, cardH, UI.panelLight).setStrokeStyle(3, meta.color)
        .setScrollFactor(0).setDepth(105).setInteractive();
      this.add.rectangle(cx, cardsTop + 18, cardW - 16, 10, meta.color).setScrollFactor(0).setDepth(106);
      this.text(cx, cardsTop + 32, meta.name, 15).setOrigin(0.5, 0);
      this.text(cx, cardsTop + 54, `${meta.reach} range${meta.hitsAir ? ' · air' : ''}`, 12, UI.dim).setOrigin(0.5, 0);
      const cost = this.text(cx, cardsTop + cardH - 34, '', 18, UI.gold).setOrigin(0.5, 0);
      bg.on('pointerdown', () => this.buyBlock(w));
      this.shopCards.push({ weapon: w, bg, cost });
    });

    // selected block panel
    const py = this.groundY + 78;
    const selBg = this.add.rectangle(this.W / 2, py, this.W - 24, 54, 0x2b2f38).setStrokeStyle(2, 0x4a505c);
    this.selText = this.add.text(26, py, '', { fontFamily: UI.font, fontSize: '14px', color: UI.text, fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.selBtn = this.add.rectangle(this.W - 100, py, 150, 40, 0x2f7d4f).setStrokeStyle(2, 0x1d4a30).setInteractive();
    this.selBtnText = this.add.text(this.W - 100, py, '', { fontFamily: UI.font, fontSize: '14px', color: '#fff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    this.selBtn.on('pointerdown', () => this.upgradeSelected());
    this.selPanel = [selBg, this.selText, this.selBtn, this.selBtnText];
    this.selPanel.forEach((o) => o.setScrollFactor(0).setDepth(108).setVisible(false));
    this.hintText = this.text(this.W / 2, py, 'Buy a weapon block below · tap a block to upgrade · drag to reorder', 13, UI.dim)
      .setOrigin(0.5).setWordWrapWidth(this.W - 40).setAlign('center');

    this.text(this.W - 6, this.H - 6, `build ${__BUILD_TIME__}`, 9, '#6a707a').setOrigin(1, 1);
  }

  drawHud(): void {
    const g = this.gHud;
    g.clear();
    // progress bar
    const x0 = 96;
    const x1 = this.W - 20;
    const y = 18;
    g.fillStyle(0x1d2027, 0.85);
    g.fillRoundedRect(x0 - 8, y - 12, x1 - x0 + 16, 24, 8);
    g.fillStyle(0x3a3f4b);
    g.fillRect(x0, y - 4, x1 - x0, 8);
    const prog = Phaser.Math.Clamp((this.tower.x - START_X) / CFG.stage.length, 0, 1);
    g.fillStyle(0x6aa6e8);
    g.fillRect(x0, y - 4, (x1 - x0) * prog, 8);
    for (let k = 1; k <= CFG.stage.sections; k++) {
      const cx = x0 + ((x1 - x0) * k) / CFG.stage.sections;
      const done = k <= this.passedCheckpoints;
      g.fillStyle(k === CFG.stage.sections ? 0xffffff : done ? 0x6aa6e8 : 0x8a909a);
      g.fillCircle(cx, y, 7);
    }
    for (const n of this.nests) {
      const nx = x0 + ((x1 - x0) * (n.x - START_X)) / CFG.stage.length;
      g.fillStyle(n.alive ? 0xb05a3a : 0x555555);
      g.fillRect(nx - 4, y - 10, 8, 6);
    }
    g.fillStyle(0xffd166);
    g.fillTriangle(x0 + (x1 - x0) * prog - 7, y + 14, x0 + (x1 - x0) * prog + 7, y + 14, x0 + (x1 - x0) * prog, y + 5);

    // hero HP bar
    const hx = 30;
    const hy = 46;
    g.fillStyle(0x1d2027, 0.85);
    g.fillRoundedRect(hx - 6, hy - 4, 144, 26, 6);
    g.fillStyle(0x552222);
    g.fillRect(hx, hy + 2, 132, 14);
    g.fillStyle(0xd9534f);
    g.fillRect(hx, hy + 2, 132 * Math.max(0, this.heroHp / CFG.hero.hp), 14);
    this.hpText.setText(`HERO ${Math.ceil(Math.max(0, this.heroHp))}`);
    this.goldText.setText(`${Math.floor(this.gold)} g`);
    this.blocksText.setText(`blocks ${this.tower.blocks.length}/${CFG.tower.maxBlocks}`);

    // trash state
    const overTrash = this.dragging && this.dragPointer && this.isOverTrash(this.dragPointer);
    this.trash.setFillStyle(overTrash ? 0xb04040 : this.dragging ? 0x6a3a3a : 0x3a3f4b);
    if (this.dragging && this.dragBlock) this.trashLabel.setText(`SELL\n+${this.refund(this.dragBlock)}g`);
    else this.trashLabel.setText('TRASH\nsell');

    // shop
    const cost = this.tower.blockCost();
    const full = this.tower.blocks.length >= CFG.tower.maxBlocks;
    for (const c of this.shopCards) {
      const ok = !full && this.gold >= cost && this.phase === 'play';
      c.bg.setAlpha(ok ? 1 : 0.5);
      c.cost.setText(full ? 'FULL' : `${cost} g`);
      c.cost.setColor(ok ? UI.gold : '#a06060');
    }

    // selection
    if (this.selected && !this.tower.blocks.includes(this.selected)) this.selected = null;
    const s = this.selected;
    this.selPanel.forEach((o) => o.setVisible(!!s && !this.dragging));
    this.hintText.setVisible(!s || this.dragging);
    if (this.dragging && this.dragBlock) this.hintText.setText(`Drop on a floor to move · drop on TRASH to sell for ${this.refund(this.dragBlock)}g`);
    else this.hintText.setText(this.tower.blocks.length ? 'Tap a block to upgrade · drag blocks to reorder' : 'Buy a weapon block below to start building');
    if (s) {
      const idx = this.tower.blocks.indexOf(s) + 1;
      this.selText.setText(`Floor ${idx} · ${WEAPONS[s.weapon].name}\nHP ${Math.ceil(s.hp)}/${Math.round(s.maxHp)}  (HP lv ${s.hpLevel})`);
      const uc = this.tower.hpUpgradeCost(s);
      this.selBtnText.setText(`+HP  ${uc} g`);
      this.selBtn.setFillStyle(this.gold >= uc ? 0x2f7d4f : 0x4a4f5a);
    }
  }

  // ---------------------------------------------------------------- input

  setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // hidden tuning panel: triple-tap top-left corner
      if (p.x < TRIPLE_TAP_ZONE.w && p.y < TRIPLE_TAP_ZONE.h) {
        const now = this.time.now;
        this.tapTimes = this.tapTimes.filter((t) => now - t < 700);
        this.tapTimes.push(now);
        if (this.tapTimes.length >= 3) {
          this.tapTimes = [];
          this.openTuningPanel();
          return;
        }
      }
      if (this.phase !== 'play') return;
      const blockObj = over.find((o) => o.getData && o.getData('block'));
      if (blockObj) {
        this.dragBlock = blockObj.getData('block') as Block;
        this.dragPointer = p;
        this.dragStart = { x: p.x, y: p.y };
        this.dragging = false;
        return;
      }
      if (over.length > 0) return; // HUD button
      if (p.y < this.groundY + 40 && !this.aimPointer) this.aimPointer = p;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p !== this.dragPointer || !this.dragBlock) return;
      if (!this.dragging && Phaser.Math.Distance.Between(p.x, p.y, this.dragStart.x, this.dragStart.y) > 12) {
        this.dragging = true;
        this.selected = null;
        this.dragBlock.container.setDepth(60);
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
          b.visY = Math.min(b.visY, this.tower.slotY(this.dragIndex));
        }
      } else if (this.phase === 'play') {
        this.selected = this.selected === b ? null : b;
      }
      this.dragBlock = null;
      this.dragPointer = null;
      this.dragging = false;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  dropIndexAt(worldY: number): number {
    const n = this.tower.blocks.length;
    const i = Math.floor((this.groundY - CFG.tower.cartHeight - worldY) / this.tower.bh);
    return Phaser.Math.Clamp(i, 0, n - 1);
  }

  isOverTrash(p: Phaser.Input.Pointer): boolean {
    return Math.abs(p.x - this.trash.x) < 52 && Math.abs(p.y - this.trash.y) < 52;
  }

  openTuningPanel(): void {
    this.scene.pause();
    this.aimPointer = null;
    openTuning(
      () => { this.scene.resume(); this.scene.restart(); },
      () => this.scene.resume(),
    );
  }

  // ---------------------------------------------------------------- economy

  refund(b: Block): number {
    return Math.floor(b.spent * CFG.tower.sellRefund);
  }

  buyBlock(w: WeaponId): void {
    if (this.phase !== 'play') return;
    const cost = this.tower.blockCost();
    if (this.tower.blocks.length >= CFG.tower.maxBlocks) return this.toast('Tower is full (6 blocks)');
    if (this.gold < cost) return this.toast('Not enough gold');
    this.gold -= cost;
    this.tower.addBlock(w, cost);
  }

  sellBlock(b: Block): void {
    const r = this.refund(b);
    this.gold += r;
    this.floatText(this.trash.x + this.cameras.main.scrollX, this.trash.y + 40, `+${r}g`, UI.gold);
    if (this.selected === b) this.selected = null;
    this.tower.removeBlock(b);
  }

  upgradeSelected(): void {
    const s = this.selected;
    if (!s || this.phase !== 'play') return;
    const cost = this.tower.hpUpgradeCost(s);
    if (this.gold < cost) return this.toast('Not enough gold');
    this.gold -= cost;
    this.tower.upgradeHp(s, cost);
  }

  onEnemyKilled(t: Target, gold: number): void {
    this.gold += gold;
    this.kills++;
    this.floatText(t.x, t.y - t.h / 2 - 10, `+${gold}`, UI.gold);
    if (t instanceof Nest) {
      this.cameras.main.shake(200, 0.006);
      this.banner('Nest destroyed!');
    }
  }

  // ---------------------------------------------------------------- feedback

  floatText(x: number, y: number, s: string, color: string): void {
    const t = this.add.text(x, y, s, { fontFamily: UI.font, fontSize: '16px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  toast(s: string): void {
    const t = this.text(this.W / 2, this.groundY + 20, s, 16, '#ffdddd').setOrigin(0.5).setDepth(120)
      .setBackgroundColor('#00000099').setPadding(10, 6, 10, 6);
    this.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 400, onComplete: () => t.destroy() });
  }

  banner(s: string): void {
    const t = this.text(this.W / 2, this.H * 0.22, s, 30, '#ffffff').setOrigin(0.5).setDepth(120)
      .setStroke('#000', 6);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 900, duration: 600, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- overlays

  makeOverlay(): Phaser.GameObjects.Container {
    this.overlay?.destroy();
    const shade = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.7).setInteractive();
    const c = this.add.container(0, 0, [shade]).setScrollFactor(0, 0, true).setDepth(1000);
    this.overlay = c;
    return c;
  }

  overlayText(c: Phaser.GameObjects.Container, x: number, y: number, s: string, size: number, color = UI.text): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, { fontFamily: UI.font, fontSize: `${size}px`, color, fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0);
    c.add(t);
    return t;
  }

  overlayButton(c: Phaser.GameObjects.Container, y: number, label: string, onTap: () => void): void {
    const b = this.add.rectangle(this.W / 2, y, 260, 64, 0x2f7d4f).setStrokeStyle(3, 0x1d4a30).setScrollFactor(0).setInteractive();
    b.on('pointerdown', onTap);
    c.add(b);
    this.overlayText(c, this.W / 2, y, label, 24);
  }

  showIntro(): void {
    const c = this.makeOverlay();
    const top = this.H * 0.16;
    this.overlayText(c, this.W / 2, top, 'STACKWAGON', 40, '#ffd166');
    this.overlayText(c, this.W / 2, top + 44, 'Stage 1 · Ruined City', 20, UI.dim);
    this.overlayText(c, this.W / 2, top + 100, 'Weapons for this stage', 18);
    this.offered.forEach((w, i) => {
      const m = WEAPONS[w];
      const y = top + 150 + i * 92;
      const r = this.add.rectangle(this.W / 2, y + 18, this.W - 60, 82, UI.panelLight).setStrokeStyle(3, m.color).setScrollFactor(0);
      c.add(r);
      this.overlayText(c, this.W / 2, y, `${m.name}  ·  ${m.reach} range${m.hitsAir ? '  ·  hits air' : ''}`, 18);
      this.overlayText(c, this.W / 2, y + 30, m.desc, 14, UI.dim);
    });
    const tips = [
      'Your wagon rolls right on its own. Reach END to win.',
      'Short range low, long range high. Destroy nests to pass.',
      'Hold anywhere above the ground to aim the hero\'s shotgun.',
    ];
    this.overlayText(c, this.W / 2, top + 440, tips.join('\n'), 14, UI.text).setLineSpacing(6);
    this.overlayButton(c, Math.min(this.H - 90, top + 540), 'START', () => {
      this.overlay?.destroy();
      this.overlay = null;
      this.phase = 'play';
    });
  }

  endStage(won: boolean): void {
    if (this.phase !== 'play') return;
    this.phase = won ? 'won' : 'lost';
    this.aimPointer = null;
    this.dragBlock = null;
    this.dragging = false;
    this.time.delayedCall(won ? 400 : 900, () => {
      const c = this.makeOverlay();
      const top = this.H * 0.3;
      this.overlayText(c, this.W / 2, top, won ? 'STAGE CLEAR!' : 'WAGON DOWN', 42, won ? '#9be89b' : '#ff8080');
      const prog = Math.round(Phaser.Math.Clamp((this.tower.x - START_X) / CFG.stage.length, 0, 1) * 100);
      this.overlayText(c, this.W / 2, top + 140,
        `Progress ${prog}%\nZombies defeated ${this.kills}\nNests destroyed ${this.nests.filter((n) => !n.alive).length}/${this.nests.length}\nGold left ${Math.floor(this.gold)}`,
        18, UI.text).setLineSpacing(8);
      this.overlayButton(c, top + 290, won ? 'PLAY AGAIN' : 'RETRY', () => this.scene.restart());
    });
  }

  // ---------------------------------------------------------------- loop

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000) * (this.phase === 'play' ? this.speedMult : 1);
    this.gWorld.clear();
    if (this.phase === 'play') {
      this.elapsed += dt;
      this.updateSpawns(dt);
      this.updateNests(dt);
      this.updateTowerMovement(dt);
      this.updateZombies(dt);
      this.updateHero(dt);
      for (const b of this.tower.blocks) {
        if (b === this.dragBlock && this.dragging) continue;
        updateWeapon(this, b, dt);
      }
      updateProjectiles(this, dt, this.groundY);
      this.cleanupDead();
      this.checkProgress();
    }
    this.tower.update(dt, this.phase === 'play' ? 1 : 0, this.dragging ? this.dragBlock : null, this.dragIndex);
    this.positionHero(dt);
    this.zombies.forEach((z) => z.draw());
    this.nests.forEach((n) => n.draw(dt));
    this.drawWorldOverlays();
    drawFx(this.gWorld, this.fx, dt);
    this.cameras.main.scrollX = this.tower.x - 150;
    this.drawHud();
  }

  updateSpawns(dt: number): void {
    const s = CFG.spawns;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = s.interval * Math.pow(s.intervalFactorPerSection, this.section) * (0.7 + Math.random() * 0.6);
    if (this.zombies.length >= s.maxAlive) return;
    const n = Phaser.Math.Between(s.groupMin, s.groupMax);
    const baseX = this.cameras.main.scrollX + this.W + 40;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let kind: EnemyId = 'walker';
      if (r < s.flyerChance) kind = 'flyer';
      else if (r < s.flyerChance + s.bruteChance) kind = 'brute';
      else if (r < s.flyerChance + s.bruteChance + s.runnerChance) kind = 'runner';
      else if (r < s.flyerChance + s.bruteChance + s.runnerChance + s.climberChance) kind = 'climber';
      const alt = kind === 'flyer' ? Phaser.Math.Between(s.flyerAltMin, s.flyerAltMax) : 0;
      this.zombies.push(new Zombie(this, kind, baseX + i * 36, alt, this.hpMult(), this.dmgMult()));
    }
  }

  updateNests(dt: number): void {
    const c = CFG.nest;
    for (const n of this.nests) {
      if (!n.alive) continue;
      if (n.x - this.tower.frontX > c.activationRange) continue;
      n.spawnTimer -= dt;
      if (n.spawnTimer > 0 || this.zombies.length >= CFG.spawns.maxAlive) continue;
      n.spawnTimer = c.spawnInterval;
      const r = Math.random();
      const kind: EnemyId = r < c.runnerChance ? 'runner' : r < c.runnerChance + c.climberChance ? 'climber' : 'walker';
      this.zombies.push(new Zombie(this, kind, n.x - n.w / 2 - 14, 0, this.hpMult(), this.dmgMult()));
    }
  }

  updateTowerMovement(dt: number): void {
    const t = this.tower;
    const front = t.frontX;
    const touching = this.zombies.some((z) => !z.isAir && z.attacking);
    let limit = Infinity;
    for (const n of this.nests) if (n.alive && n.x > front - 20) limit = Math.min(limit, n.x - n.w / 2 - CFG.nest.blockGap);
    let speed = CFG.tower.cartSpeed;
    if (touching) speed = 0;
    else if (this.zombies.some((z) => !z.isAir && z.x - z.w / 2 - front < CFG.tower.slowDistance)) speed *= CFG.tower.slowSpeedFactor;
    const newFront = Math.min(front + speed * dt, Math.max(front, limit));
    t.x += newFront - front;

    for (const c of this.crates) {
      if (c.taken || t.frontX < c.x - 22) continue;
      c.taken = true;
      c.destroy();
      if (t.blocks.length < CFG.tower.maxBlocks) {
        const w = Phaser.Utils.Array.GetRandom(this.offered) as WeaponId;
        t.addBlock(w, 0);
        this.banner(`Free ${WEAPONS[w].name} block!`);
      } else {
        this.gold += CFG.stage.crateGoldIfFull;
        this.banner(`Crate: +${CFG.stage.crateGoldIfFull} gold`);
      }
    }
  }

  updateZombies(dt: number): void {
    const t = this.tower;
    const ph = CFG.physics;
    const front = t.frontX;
    const ground = this.zombies.filter((z) => !z.isAir).sort((a, b) => a.x - b.x);

    for (const z of ground) {
      z.tickStatus(dt);
      const mult = z.speedMult;
      let nx = z.x - z.speed * mult * dt;
      let blocker: Zombie | null = null;
      z.attacking = false;

      // the tower face
      if (nx - z.w / 2 < front) {
        nx = front + z.w / 2;
        z.attacking = true;
      }
      // zombies ahead at the same height block the way
      for (const o of ground) {
        if (o === z || o.x >= z.x) continue;
        if (o.top <= z.alt + ph.stepUp) continue; // below our feet: it's floor
        if (o.alt >= z.top - ph.stepUp) continue; // above our head
        const minX = o.x + ((o.w + z.w) / 2) * ph.crowdOverlap;
        if (nx < minX) {
          nx = Math.max(Math.min(minX, z.x), nx);
          if (!blocker || o.top > blocker.top) blocker = o;
        }
      }
      if (nx < front + z.w / 2) nx = front + z.w / 2;
      z.blocked = z.attacking || !!blocker;
      z.x = nx;

      // climbing over a stuck zombie
      z.climbing = false;
      if (blocker && blocker.blocked && z.climbSpeed > 0 && mult > 0 && !z.attacking) {
        z.alt = Math.min(blocker.top, z.alt + z.climbSpeed * mult * dt);
        z.climbing = true;
      }
      // standing on others / falling
      let floor = 0;
      for (const o of ground) {
        if (o === z) continue;
        if (Math.abs(o.x - z.x) > ((o.w + z.w) / 2) * 0.6) continue;
        if (o.top <= z.alt + ph.stepUp) floor = Math.max(floor, o.top);
      }
      if (!z.climbing) {
        if (z.alt > floor) z.alt = Math.max(floor, z.alt - ph.fallSpeed * dt);
        else z.alt = floor;
      }

      // attack
      if (z.attacking && mult > 0) {
        z.attackTimer -= dt * mult;
        if (z.attackTimer <= 0) {
          z.attackTimer = z.attackInterval;
          z.lunge = 0.12;
          this.zombieHitsTower(z, z.alt + z.h * 0.5);
        }
      }
    }

    // flyers go for the hero
    for (const z of this.zombies) {
      if (!z.isAir) continue;
      z.tickStatus(dt);
      const mult = z.speedMult;
      const tx = t.x + 50;
      const targetAlt = this.groundY - (t.visTopY - 30) - z.h / 2;
      const dx = tx - z.x;
      const da = targetAlt - z.alt;
      const d = Math.hypot(dx, da);
      z.attacking = d < 16;
      if (!z.attacking) {
        const step = Math.min(d, z.speed * mult * dt);
        z.x += (dx / d) * step;
        z.alt += (da / d) * step;
      } else if (mult > 0) {
        z.attackTimer -= dt * mult;
        if (z.attackTimer <= 0) {
          z.attackTimer = z.attackInterval;
          z.lunge = 0.12;
          this.damageHero(z.damage);
        }
      }
    }
  }

  zombieHitsTower(z: Zombie, alt: number): void {
    const idx = this.tower.blockIndexAtAlt(alt);
    if (idx < 0) {
      this.damageHero(z.damage);
      return;
    }
    const b = this.tower.blocks[idx];
    b.hp -= z.damage;
    b.flash = 0.1;
    if (b.hp <= 0) {
      this.fx.push({ kind: 'ring', x1: this.tower.x, y1: b.visY, x2: 0, y2: 0, width: 6, color: 0xff7040, life: 0.35, maxLife: 0.35, radius: 60 });
      this.cameras.main.shake(150, 0.005);
      if (this.selected === b) this.selected = null;
      if (this.dragBlock === b) { this.dragBlock = null; this.dragging = false; }
      this.tower.removeBlock(b);
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
    const gx = this.hero.x;
    const gy = this.hero.y - 2;
    if (this.aimPointer) {
      this.heroAngle = Math.atan2(this.aimPointer.worldY - gy, this.aimPointer.worldX - gx);
      if (this.heroCooldown <= 0) {
        this.heroCooldown = CFG.hero.aimFireInterval;
        fireHero(this, gx, gy, this.heroAngle);
      }
      return;
    }
    const target = nearestTarget(this, gx, gy, CFG.hero.range, true);
    if (target) {
      this.heroAngle = Phaser.Math.Angle.RotateTo(this.heroAngle, Math.atan2(target.y - gy, target.x - gx), dt * 10);
      if (this.heroCooldown <= 0) {
        this.heroCooldown = CFG.hero.fireInterval;
        fireHero(this, gx, gy, Math.atan2(target.y - gy, target.x - gx));
      }
    } else {
      this.heroCooldown = Math.max(this.heroCooldown, 0);
    }
  }

  positionHero(dt: number): void {
    const targetY = this.tower.visTopY - 26;
    if (this.hero.y === 0) this.hero.y = targetY;
    if (this.hero.y < targetY) this.hero.y = Math.min(targetY, this.hero.y + CFG.tower.dropSpeed * dt);
    else this.hero.y = Math.max(targetY, this.hero.y - CFG.tower.dropSpeed * 2 * dt);
    this.hero.x = this.tower.x - 6;
    this.heroGun.rotation = this.heroAngle;
    (this.hero.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(this.heroFlash > 0 ? 0xffffff : 0x3f6fb5);
  }

  drawWorldOverlays(): void {
    const g = this.gWorld;
    // aim cone
    if (this.aimPointer && this.phase === 'play') {
      const half = Phaser.Math.DegToRad(CFG.hero.spreadDeg) / 2;
      g.fillStyle(0xffe08a, 0.18);
      g.slice(this.hero.x, this.hero.y - 2, CFG.hero.range, this.heroAngle - half, this.heroAngle + half, false);
      g.fillPath();
      g.lineStyle(2, 0xffe08a, 0.6);
      g.strokeCircle(this.aimPointer.worldX, this.aimPointer.worldY, 18);
    }
    // health bars
    for (const z of this.zombies) {
      if (z.hp >= z.maxHp) continue;
      this.hpBar(z.x, z.y - z.h / 2 - 8, z.w, z.hp / z.maxHp, 0xd9534f);
    }
    for (const n of this.nests) {
      if (!n.alive) continue;
      this.hpBar(n.x, n.y - n.h / 2 - 32, n.w, n.hp / n.maxHp, 0xd98a3f, 8);
    }
    for (const b of this.tower.blocks) {
      this.hpBar(this.tower.x - 6, b.visY - this.tower.bh / 2 + 7, this.tower.bw - 26, b.hp / b.maxHp, 0x4caf6a, 5);
    }
    // selected block outline
    if (this.selected) {
      g.lineStyle(4, 0xffd166, 1);
      g.strokeRect(this.tower.x - this.tower.bw / 2, this.selected.visY - this.tower.bh / 2, this.tower.bw, this.tower.bh);
    }
    // drop target marker while dragging
    if (this.dragging && this.dragBlock) {
      g.lineStyle(3, 0xffffff, 0.8);
      g.strokeRect(this.tower.x - this.tower.bw / 2, this.tower.slotY(this.dragIndex) - this.tower.bh / 2, this.tower.bw, this.tower.bh);
    }
  }

  hpBar(cx: number, y: number, w: number, frac: number, color: number, h = 5): void {
    const g = this.gWorld;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
    g.fillStyle(color);
    g.fillRect(cx - w / 2, y, w * Phaser.Math.Clamp(frac, 0, 1), h);
  }

  cleanupDead(): void {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      // also cull zombies left far behind
      if (!z.alive || z.x < this.cameras.main.scrollX - 300) {
        z.destroy();
        this.zombies.splice(i, 1);
      }
    }
    for (let i = this.nests.length - 1; i >= 0; i--) {
      const n = this.nests[i];
      if (!n.alive && n.rect.active) {
        n.rect.setFillStyle(0x3a3a3a).setAlpha(0.5);
        n.rect.setActive(false);
        n.label.setText('X');
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
      this.banner(`Checkpoint ${this.passedCheckpoints}!`);
    }
    if (x >= this.finishX) {
      this.passedCheckpoints = CFG.stage.sections;
      this.endStage(true);
    }
  }
}
