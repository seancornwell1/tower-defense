import Phaser from 'phaser';
import { CFG, WeaponId } from '../config';
import { WEAPONS } from './meta';

export interface Block {
  weapon: WeaponId | null;
  level: number;          // weapon level (1+)
  weaponSpent: number;    // gold spent on the weapon + its levels
  blockSpent: number;     // gold spent on the block + HP levels
  hp: number;
  maxHp: number;
  hpLevel: number;
  visY: number;           // displayed centre y (falls toward its slot)
  cooldown: number;
  flash: number;
  hitShow: number;        // seconds left to show the HP bar after a hit
  boomerangOut: boolean;
  aim: number;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  gun: Phaser.GameObjects.Image | null;
  blade: Phaser.GameObjects.Image | null;
}

export class Tower {
  x: number;
  blocks: Block[] = [];
  cart: Phaser.GameObjects.Image;
  wheels: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, x: number, private groundY: number) {
    this.x = x;
    this.cart = scene.add.image(x, groundY - 14, 'cart').setDepth(21);
    for (const dx of [-26, 26]) this.wheels.push(scene.add.image(x + dx, groundY - 12, 'wheel').setDepth(22));
  }

  get bw(): number { return CFG.tower.blockWidth; }
  get bh(): number { return CFG.tower.blockHeight; }
  get frontX(): number { return this.x + this.bw / 2 + 8; }

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

  muzzle(b: Block): { x: number; y: number } {
    return { x: this.x + this.bw / 2 + 4, y: b.visY + 6 };
  }

  addBlock(spent: number): Block {
    const i = this.blocks.length;
    const y = this.slotY(i);
    const body = this.scene.add.image(0, 0, 'block').setDisplaySize(this.bw + 2, this.bh + 2);
    const container = this.scene.add.container(this.x, y, [body]).setDepth(20);
    body.setInteractive();
    const block: Block = {
      weapon: null, level: 0, weaponSpent: 0, blockSpent: spent,
      hp: CFG.tower.blockHp, maxHp: CFG.tower.blockHp, hpLevel: 1,
      visY: i === 0 ? y : y - 40, cooldown: 0, flash: 0, hitShow: 0, boomerangOut: false, aim: 0,
      container, body, gun: null, blade: null,
    };
    body.setData('block', block);
    this.blocks.push(block);
    return block;
  }

  setWeapon(b: Block, w: WeaponId | null, spent: number): void {
    b.gun?.destroy();
    b.blade?.destroy();
    b.gun = null;
    b.blade = null;
    b.weapon = w;
    b.level = w ? 1 : 0;
    b.weaponSpent = w ? spent : 0;
    b.cooldown = 0.2;
    if (!w) return;
    const m = WEAPONS[w];
    const gx = this.bw / 2 - 12;
    const gy = 6;
    if (w === 'shocker') {
      b.gun = this.scene.add.image(gx, gy + 6, m.icon).setOrigin(0.5, 1);
    } else {
      b.gun = this.scene.add.image(gx, gy, m.icon).setOrigin(m.mountX, 0.5);
    }
    b.container.add(b.gun);
    if (w === 'saw') {
      b.blade = this.scene.add.image(gx + 40, gy, 'saw_blade');
      b.container.add(b.blade);
    }
  }

  removeBlock(b: Block): void {
    const i = this.blocks.indexOf(b);
    if (i >= 0) this.blocks.splice(i, 1);
    b.container.destroy();
  }

  blockCost(): number {
    return CFG.tower.blockCostBase + CFG.tower.blockCostStep * Math.max(0, this.blocks.length - CFG.tower.startBlocks);
  }

  hpUpgradeCost(b: Block): number {
    return CFG.tower.hpUpgradeCostBase + CFG.tower.hpUpgradeCostStep * (b.hpLevel - 1);
  }

  upgradeHp(b: Block, cost: number): void {
    const add = CFG.tower.blockHp * CFG.tower.hpUpgradePct;
    b.maxHp += add;
    b.hp += add;
    b.hpLevel++;
    b.blockSpent += cost;
  }

  /** Index of the block a zombie at this altitude would hit (-1 = hero). */
  blockIndexAtAlt(alt: number): number {
    const n = this.blocks.length;
    if (n === 0) return -1;
    const i = Math.floor((alt - CFG.tower.cartHeight) / this.bh);
    if (i >= n) return -1;
    return Math.max(0, i);
  }

  update(dt: number, moved: number, dragged: Block | null, dragIndex: number): void {
    this.cart.x = this.x;
    this.wheels.forEach((w, k) => {
      w.x = this.x + (k ? 26 : -26);
      w.rotation += moved / 12;
    });
    const order = this.blocks.filter((b) => b !== dragged);
    if (dragged) order.splice(dragIndex, 0, dragged);
    order.forEach((b, i) => {
      b.flash = Math.max(0, b.flash - dt);
      b.hitShow = Math.max(0, b.hitShow - dt);
      if (b.flash > 0) b.body.setTint(0xff9a8a);
      else b.body.clearTint();
      if (b.blade) b.blade.rotation += dt * 16;
      if (b === dragged) return;
      const target = this.slotY(i);
      if (b.visY < target) b.visY = Math.min(target, b.visY + CFG.tower.dropSpeed * dt);
      else b.visY = Math.max(target, b.visY - CFG.tower.dropSpeed * 2 * dt);
      b.container.setPosition(this.x, b.visY);
    });
  }
}
