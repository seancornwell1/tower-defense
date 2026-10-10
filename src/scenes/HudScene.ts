import Phaser from 'phaser';
import { CFG, WeaponId } from '../config';
import { button, Btn, OL, txt } from '../art';
import { WEAPONS } from '../game/meta';
import type { GameScene } from './GameScene';
import { openTuning } from '../tuning';

declare const __BUILD_TIME__: string;

interface AbilityBtn { id: WeaponId | 'grenade'; btn: Btn; cost: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Graphics }

export class HudScene extends Phaser.Scene {
  W = 960;
  H = 540;
  gs!: GameScene;
  g!: Phaser.GameObjects.Graphics;
  goldText!: Phaser.GameObjects.Text;
  goldIcon!: Phaser.GameObjects.Image;
  energyText!: Phaser.GameObjects.Text;
  heroText!: Phaser.GameObjects.Text;
  buildBtn!: Btn;
  speedBtn!: Btn;
  speedText!: Phaser.GameObjects.Text;
  buildUi: Phaser.GameObjects.GameObject[] = [];
  battleUi: Phaser.GameObjects.GameObject[] = [];
  abilityBtns: AbilityBtn[] = [];
  abilityKey = '';
  regenText!: Phaser.GameObjects.Text;
  regenCost!: Phaser.GameObjects.Text;
  regenBtn!: Btn;
  plusBtn!: Btn;
  plusCost!: Phaser.GameObjects.Text;
  startBtn!: Btn;
  startText!: Phaser.GameObjects.Text;
  trash!: Phaser.GameObjects.Image;
  trashText!: Phaser.GameObjects.Text;
  hint!: Phaser.GameObjects.Text;
  tapTimes: number[] = [];
  result: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('hud');
  }

  create(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.gs = this.scene.get('game') as GameScene;
    this.buildUi = [];
    this.battleUi = [];
    this.abilityBtns = [];
    this.abilityKey = '';
    this.result = null;
    const W = this.W;
    this.g = this.add.graphics();

    // gold (top centre, under the progress bar)
    this.goldIcon = this.add.image(W / 2 - 34, 62, 'coin');
    this.goldText = txt(this, W / 2 - 14, 62, '0', 30).setOrigin(0, 0.5);

    // top-right energy panel
    const ep = this.add.graphics();
    ep.fillStyle(OL, 1);
    ep.fillRoundedRect(W - 132, -10, 116, 82, 12);
    ep.fillStyle(0x6c6fa8, 1);
    ep.fillRoundedRect(W - 129, -8, 110, 76, 10);
    ep.fillStyle(0x8a8dd0, 1);
    ep.fillRoundedRect(W - 125, -6, 54, 70, 8);
    this.add.image(W - 98, 30, 'bolt');
    this.energyText = txt(this, W - 44, 30, '0', 30);

    // hero HP (top-left)
    this.add.image(132, 34, 'ico_heart').setScale(0.8);
    this.heroText = txt(this, 150, 34, '', 16).setOrigin(0, 0.5);

    // build (pause) button, top-left
    this.buildBtn = button(this, 60, 82, 64, 56, 0x4cc13a, () => this.gs.enterBuild());
    this.buildBtn.add(this.add.image(0, -2, 'ico_hammer'));
    this.speedBtn = button(this, 60, 150, 54, 40, 0x6c6fa8, () => {
      this.gs.speedMult = this.gs.speedMult === 1 ? 2 : 1;
      this.speedText.setText(`x${this.gs.speedMult}`);
    });
    this.speedText = txt(this, 0, -2, `x${this.gs.speedMult}`, 18);
    this.speedBtn.add(this.speedText);
    this.battleUi.push(this.buildBtn, this.speedBtn);

    // ---- build-mode column (right)
    this.regenBtn = button(this, W - 120, 125, 196, 80, 0x4aa3f0, () => this.gs.upgradeRegen());
    this.regenBtn.add(this.add.image(-74, -2, 'bolt').setScale(0.9));
    this.regenText = txt(this, 14, -18, '', 19);
    this.regenBtn.add(this.regenText);
    const band = this.add.graphics();
    band.fillStyle(0x5cc35a, 1);
    band.fillRoundedRect(-44, 2, 120, 26, 7);
    this.regenBtn.add(band);
    this.regenBtn.add(this.add.image(-26, 15, 'coin').setScale(0.65));
    this.regenCost = txt(this, 18, 15, '', 20);
    this.regenBtn.add(this.regenCost);

    this.plusBtn = button(this, W - 72, 232, 100, 84, 0x4aa3f0, () => this.gs.buyBlock());
    this.plusBtn.add(this.add.image(0, -16, 'ico_plus'));
    this.plusBtn.add(this.add.image(-24, 20, 'coin').setScale(0.6));
    this.plusCost = txt(this, 12, 20, '', 20);
    this.plusBtn.add(this.plusCost);

    this.startBtn = button(this, W - 118, 338, 200, 76, 0xffa21f, () => this.gs.startBattle());
    this.startText = txt(this, 0, -2, 'START', 38, '#ffffff', 7);
    this.startBtn.add(this.startText);

    this.trash = this.add.image(60, 170, 'ico_trash');
    this.trashText = txt(this, 60, 212, 'drag here\nto sell', 12, '#ffffff', 3);
    this.hint = txt(this, W * 0.42, this.H - 26, 'Buy weapons for each block, then tap START  ·  drag blocks to reorder', 15, '#ffffff', 4);
    this.buildUi.push(this.regenBtn, this.plusBtn, this.startBtn, this.trash, this.trashText, this.hint);

    this.add.text(W - 6, this.H - 4, `build ${__BUILD_TIME__}`, { fontFamily: 'Arial', fontSize: '10px', color: '#7a4a3a' }).setOrigin(1, 1);

    // hidden tuning panel: triple-tap the top-left corner
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x > 56 || p.y > 44) return;
      const now = performance.now();
      this.tapTimes = this.tapTimes.filter((t) => now - t < 1000);
      this.tapTimes.push(now);
      if (this.tapTimes.length >= 3) {
        this.tapTimes = [];
        this.openTuningPanel();
      }
    });
  }

  openTuningPanel(): void {
    this.scene.pause('game');
    this.scene.pause();
    openTuning(
      () => { this.scene.resume('game'); this.scene.resume(); this.gs.restartStage(); },
      () => { this.scene.resume('game'); this.scene.resume(); },
    );
  }

  rebuildAbilities(): void {
    const owned = this.gs.ownedTypes();
    const key = owned.join(',');
    if (key === this.abilityKey) return;
    this.abilityKey = key;
    this.abilityBtns.forEach((a) => { a.btn.destroy(); a.cost.destroy(); a.glow.destroy(); });
    this.abilityBtns = [];
    const ids: (WeaponId | 'grenade')[] = [...owned, 'grenade'];
    const x = this.W - 52;
    let y = Math.max(190, this.H / 2 + 20 - ((ids.length - 1) * 86) / 2);
    for (const id of ids) {
      const glow = this.add.graphics();
      const btn = button(this, x, y, 66, 66, 0x4aa3f0, () => (id === 'grenade' ? this.gs.useGrenade() : this.gs.useAbility(id)));
      const icon = this.add.image(0, -2, id === 'grenade' ? 'p_grenade' : WEAPONS[id].icon);
      icon.setScale(id === 'grenade' ? 2 : Math.min(52 / icon.width, 40 / icon.height));
      btn.add(icon);
      const c = id === 'grenade' ? CFG.grenade.cost : CFG.abilities[id].cost;
      const cost = txt(this, x - 14, y + 30, `⚡${c}`, 17, '#bff4ff', 4);
      this.abilityBtns.push({ id, btn, cost, glow });
      y += 86;
    }
  }

  toast(s: string): void {
    const t = txt(this, this.W * 0.42, this.H * 0.56, s, 22, '#ffe0e0', 5).setDepth(50);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 600, duration: 400, onComplete: () => t.destroy() });
  }

  banner(s: string): void {
    const t = txt(this, this.W * 0.42, this.H * 0.3, s, 38, '#ffffff', 8).setDepth(50).setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1000, duration: 400, onComplete: () => t.destroy() });
  }

  flyCoin(x: number, y: number): void {
    const c = this.add.image(x, y, 'coin').setScale(0.7).setDepth(40);
    const tx = this.goldIcon.x;
    const ty = this.goldIcon.y;
    const midX = x + (Math.random() - 0.5) * 80;
    const midY = Math.min(y, ty) - 40 - Math.random() * 60;
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(midX, midY), new Phaser.Math.Vector2(tx, ty));
    const o = { t: 0 };
    this.tweens.add({
      targets: o, t: 1, duration: 550 + Math.random() * 200, ease: 'Sine.in',
      onUpdate: () => { const p = curve.getPoint(o.t); c.setPosition(p.x, p.y); },
      onComplete: () => {
        c.destroy();
        this.goldIcon.setScale(1.2);
        this.tweens.add({ targets: this.goldIcon, scale: 1, duration: 120 });
      },
    });
  }

  showResult(won: boolean): void {
    if (this.result) return;
    const W = this.W;
    const H = this.H;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x1a1020, 0.6).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(OL, 1);
    panel.fillRoundedRect(W / 2 - 214, H / 2 - 164, 428, 336, 22);
    panel.fillStyle(0xfff3dc, 1);
    panel.fillRoundedRect(W / 2 - 208, H / 2 - 158, 416, 324, 18);
    panel.fillStyle(won ? 0x5cc35a : 0xe8553c, 1);
    panel.fillRoundedRect(W / 2 - 208, H / 2 - 158, 416, 70, { tl: 18, tr: 18, bl: 0, br: 0 });
    const title = txt(this, W / 2, H / 2 - 123, won ? 'STAGE CLEAR!' : 'DEFEATED', 40, '#ffffff', 7);
    const gs = this.gs;
    const prog = Math.round(Phaser.Math.Clamp((gs.tower.x - 300) / CFG.stage.length, 0, 1) * 100);
    const stats = txt(this, W / 2, H / 2 - 10,
      `Progress  ${prog}%\nZombies  ${gs.kills}\nNests  ${gs.nests.filter((n) => !n.alive).length} / ${gs.nests.length}\nGold  ${Math.floor(gs.gold)}`,
      24, '#5a3a2a', 0).setLineSpacing(6);
    const again = button(this, W / 2, H / 2 + 116, 220, 64, 0xffa21f, () => gs.restartStage());
    again.add(txt(this, 0, -2, won ? 'PLAY AGAIN' : 'RETRY', 30, '#ffffff', 6));
    this.result = this.add.container(0, 0, [shade, panel, title, stats, again]).setDepth(100);
    this.result.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: this.result, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
    this.result.setPosition(W / 2 * 0.2, H / 2 * 0.2);
    this.tweens.add({ targets: this.result, x: 0, y: 0, duration: 250, ease: 'Back.out' });
  }

  update(): void {
    const gs = this.gs;
    if (!gs.tower) return;
    const build = gs.mode === 'build';
    const battle = gs.mode === 'battle';
    const g = this.g;
    g.clear();

    // progress bar with checkpoint nodes
    const x0 = this.W / 2 - 170;
    const x1 = this.W / 2 + 170;
    const y = 24;
    if (gs.started) {
      g.fillStyle(OL, 1);
      g.fillRoundedRect(x0 - 6, y - 8, x1 - x0 + 12, 16, 8);
      g.fillStyle(0x3a4f86, 1);
      g.fillRoundedRect(x0 - 3, y - 5, x1 - x0 + 6, 10, 5);
      const prog = Phaser.Math.Clamp((gs.tower.x - 300) / CFG.stage.length, 0, 1);
      g.fillStyle(0x7ec8ff, 1);
      g.fillRoundedRect(x0 - 3, y - 5, Math.max(10, (x1 - x0 + 6) * prog), 10, 5);
      for (let k = 1; k <= CFG.stage.sections; k++) {
        const cx = x0 + ((x1 - x0) * k) / CFG.stage.sections;
        g.fillStyle(OL, 1);
        g.fillCircle(cx, y, 12);
        g.fillStyle(k <= gs.passedCheckpoints ? 0x7ec8ff : 0x3a4f86, 1);
        g.fillCircle(cx, y, 9);
      }
      for (const n of gs.nests) {
        const nx = x0 + ((x1 - x0) * (n.x - 300)) / CFG.stage.length;
        g.fillStyle(n.alive ? 0x3f86c9 : 0x777777, 1);
        g.fillRect(nx - 4, y + 9, 8, 7);
      }
      const px = x0 + (x1 - x0) * prog;
      g.fillStyle(0xffd23a, 1);
      g.lineStyle(2, OL, 1);
      g.fillTriangle(px - 7, y - 16, px + 7, y - 16, px, y - 6);
      g.strokeTriangle(px - 7, y - 16, px + 7, y - 16, px, y - 6);
    }
    // hero hp bar
    const hx = 150;
    g.fillStyle(OL, 1);
    g.fillRoundedRect(hx - 4, 44, 128, 14, 6);
    g.fillStyle(0x5a2a2a, 1);
    g.fillRoundedRect(hx - 2, 46, 124, 10, 5);
    g.fillStyle(0xe8453c, 1);
    g.fillRoundedRect(hx - 2, 46, 124 * Math.max(0, gs.heroHp / CFG.hero.hp), 10, 5);
    this.heroText.setText(`${Math.ceil(gs.heroHp)}`);

    this.goldText.setText(`${Math.floor(gs.gold)}`);
    this.energyText.setText(`${Math.floor(gs.energy)}`);

    // mode-dependent UI
    this.buildUi.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(build));
    this.battleUi.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(battle));
    if (build) {
      this.startText.setText(gs.started ? 'GO!' : 'START');
      this.regenText.setText(`Energy ${gs.regen.toFixed(2)}/s`);
      this.regenCost.setText(`${gs.regenCost}`);
      this.regenBtn.setEnabled(gs.gold >= gs.regenCost);
      const full = gs.tower.blocks.length >= CFG.tower.maxBlocks;
      const bc = gs.tower.blockCost();
      this.plusCost.setText(full ? 'MAX' : `${bc}`);
      this.plusBtn.setEnabled(!full && gs.gold >= bc);
      const dragging = gs.dragging && gs.dragBlock;
      this.trash.setTint(dragging ? 0xff8080 : 0xffffff).setScale(dragging ? 1.2 : 1);
      this.trashText.setText(dragging ? `sell +${gs.blockRefund(gs.dragBlock!)}` : 'drag here\nto sell');
    }
    if (battle) this.rebuildAbilities();
    for (const a of this.abilityBtns) {
      a.btn.setVisible(battle);
      a.cost.setVisible(battle);
      a.glow.clear();
      if (!battle) continue;
      const cost = a.id === 'grenade' ? CFG.grenade.cost : CFG.abilities[a.id].cost;
      a.btn.setEnabled(gs.energy >= cost);
      const active = a.id !== 'grenade' && gs.abilityTime[a.id] > 0;
      if (active || gs.energy >= cost) {
        a.glow.lineStyle(4, active ? 0xffffff : 0xffd23a, active ? 0.6 + 0.4 * Math.sin(this.time.now / 80) : 1);
        a.glow.strokeRoundedRect(a.btn.x - 38, a.btn.y - 38, 76, 80, 12);
      }
    }
  }
}
