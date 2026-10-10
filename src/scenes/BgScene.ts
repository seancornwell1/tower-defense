import Phaser from 'phaser';
import { GROUND_SCREEN_Y } from './GameScene';

/** Screen-space sunset sky + parallax skyline, driven by the world camera. */
export class BgScene extends Phaser.Scene {
  far!: Phaser.GameObjects.TileSprite;
  near!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('bg');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(W, H);
    // soft sun glow
    const sun = this.add.graphics();
    for (let r = 160; r > 0; r -= 20) {
      sun.fillStyle(0xfff0c0, 0.06);
      sun.fillCircle(W * 0.62, GROUND_SCREEN_Y - 170, r);
    }
    this.far = this.add.tileSprite(0, GROUND_SCREEN_Y + 10, W, 300, 'skyline_far').setOrigin(0, 1).setAlpha(0.9);
    this.near = this.add.tileSprite(0, GROUND_SCREEN_Y + 10, W, 220, 'skyline_near').setOrigin(0, 1);
    // haze over the skyline
    const haze = this.add.graphics();
    haze.fillGradientStyle(0xf6b48a, 0xf6b48a, 0xf6b48a, 0xf6b48a, 0, 0, 0.55, 0.55);
    haze.fillRect(0, GROUND_SCREEN_Y - 160, W, 170);
  }

  update(): void {
    const game = this.scene.get('game');
    if (!game || !game.sys.isActive()) return;
    const x = game.cameras.main.worldView.x;
    this.far.tilePositionX = x * 0.15;
    this.near.tilePositionX = x * 0.35;
  }
}
