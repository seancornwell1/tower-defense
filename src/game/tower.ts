import Phaser from 'phaser';
import { CFG, WeaponId } from '../config';
import { WEAPONS } from './meta';

export interface Block {
  weapon: WeaponId;
  hp: number;
  maxHp: number;
  hpLevel: number;
  spent: number;          // gold paid in total (block + HP upgrades), for refunds
  visY: number;           // current displayed centre y (falls toward its slot)
  cooldown: number;
  spin: number;           // saw blade angle / misc animation
  flash: number;
  boomerangOut: boolean;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  turret: Phaser.GameObjects.Rectangle;
  barrel: Phaser.GameObjects.Rectangle;
  blade?: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class Tower {
  x: number;
  blocks: Block[] = [];
  cart: Phaser.GameObjects.Rectangle;
  wheels: Phaser.GameObjects.Arc[] = [];
  wheelSpin = 0;

  constructor(private scene: Phaser.Scene, x: number, private groundY: number) {
    this.x = x;
    const ch = CFG.tower.cartHeight;
    this.cart = scene.add.rectangle(x, groundY - ch / 2 - 6, CFG.tower.blockWidth + 16, ch - 10, 0x6b5a48)
      .setStrokeStyle(3, 0x2a221a).setDepth(20);
    for (const dx of [-36, 0, 36]) {
      this.wheels.push(scene.add.circle(x + dx, groundY - 10, 10, 0x2a2a2a).setStrokeStyle(3, 0x777777).setDepth(21));
    }
  }

  get bw(): number { return CFG.tower.blockWidth; }
  get bh(): number { return CFG.tower.blockHeight; }
  get frontX(): number { return this.x + this.bw / 2; }

  /** Altitude (above ground) of the top of the stack. */
  get topAlt(): number {
    return CFG.tower.cartHeight + this.bh * this.blocks.length;
  }

  slotY(i: number): number {
    return this.groundY - CFG.tower.cartHeight - this.bh * i - this.bh / 2;
  }

  /** Visual top of the stack (where the hero stands), in world y. */
  get visTopY(): number {
    const top = this.blocks[this.blocks.length - 1];
    return top ? top.visY - this.bh / 2 : this.groundY - CFG.tower.cartHeight;
  }

  turretPos(b: Block): { x: number; y: number } {
    return { x: this.x + this.bw / 2 - 14, y: b.visY - 6 };
  }

  addBlock(weapon: WeaponId, spent: number): Block {
    const meta = WEAPONS[weapon];
    const i = this.blocks.length;
    const y = this.slotY(i);
    const bw = this.bw;
    const bh = this.bh;
    const body = this.scene.add.rectangle(0, 0, bw - 4, bh - 4, 0x8a8f99).setStrokeStyle(3, 0x3a3d44);
    const stripe = this.scene.add.rectangle(-bw / 2 + 10, 0, 10, bh - 10, meta.color);
    const turret = this.scene.add.rectangle(bw / 2 - 18, -6, 26, 22, meta.color).setStrokeStyle(2, 0x222222);
    const barrel = this.scene.add.rectangle(bw / 2 - 18, -6, 34, 7, 0x2e2e2e).setOrigin(0, 0.5);
    const label = this.scene.add.text(-10, 12, meta.short, { fontSize: '14px', color: '#1d1f24', fontStyle: 'bold' }).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [body, stripe, barrel, turret, label];
    let blade: Phaser.GameObjects.Rectangle | undefined;
    if (weapon === 'saw') {
      barrel.setVisible(false);
      blade = this.scene.add.rectangle(bw / 2 + 8, 8, 30, 30, 0xcfcfcf).setStrokeStyle(2, 0x444444);
      parts.push(blade);
    }
    const container = this.scene.add.container(this.x, y, parts).setDepth(20);
    body.setInteractive({ useHandCursor: true });
    const block: Block = {
      weapon, hp: CFG.tower.blockHp, maxHp: CFG.tower.blockHp, hpLevel: 0, spent,
      visY: i === 0 ? y : Math.min(y, this.visTopY - bh / 2), cooldown: Math.random() * 0.3, spin: 0, flash: 0,
      boomerangOut: false, container, body, turret, barrel, blade, label,
    };
    body.setData('block', block);
    this.blocks.push(block);
    return block;
  }

  removeBlock(b: Block): void {
    const i = this.blocks.indexOf(b);
    if (i >= 0) this.blocks.splice(i, 1);
    b.container.destroy();
  }

  blockCost(): number {
    return CFG.tower.blockCostBase + CFG.tower.blockCostStep * this.blocks.length;
  }

  hpUpgradeCost(b: Block): number {
    return CFG.tower.hpUpgradeCostBase + CFG.tower.hpUpgradeCostStep * b.hpLevel;
  }

  upgradeHp(b: Block, cost: number): void {
    const add = CFG.tower.blockHp * CFG.tower.hpUpgradePct;
    b.maxHp += add;
    b.hp += add;
    b.hpLevel++;
    b.spent += cost;
  }

  /** Index of the block a zombie at this altitude band would hit (-1 = hero). */
  blockIndexAtAlt(alt: number): number {
    const n = this.blocks.length;
    if (n === 0) return -1;
    const i = Math.floor((alt - CFG.tower.cartHeight) / this.bh);
    if (i >= n) return -1;
    return Math.max(0, i);
  }

  update(dt: number, moving: number, dragged: Block | null, dragIndex: number): void {
    this.cart.x = this.x;
    this.wheelSpin += moving * dt * 0.1;
    this.wheels.forEach((w, k) => {
      w.x = this.x + (k - 1) * 36;
      w.rotation = this.wheelSpin;
    });
    // Order used for layout: while dragging, the dragged block is shown at its prospective slot.
    const order = this.blocks.filter((b) => b !== dragged);
    if (dragged) order.splice(dragIndex, 0, dragged);
    order.forEach((b, i) => {
      const target = this.slotY(i);
      if (b === dragged) return;
      if (b.visY < target) b.visY = Math.min(target, b.visY + CFG.tower.dropSpeed * dt);
      else b.visY = Math.max(target, b.visY - CFG.tower.dropSpeed * 2 * dt);
      b.flash = Math.max(0, b.flash - dt);
      b.container.setPosition(this.x, b.visY);
      b.body.setFillStyle(b.flash > 0 ? 0xffb0a0 : 0x8a8f99);
      if (b.blade) {
        b.spin += dt * 14;
        b.blade.rotation = b.spin;
      }
    });
  }
}
