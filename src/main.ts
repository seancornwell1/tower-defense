import Phaser from 'phaser';
import '@fontsource/lilita-one/400.css';
import { buildArt } from './art';
import { BgScene } from './scenes/BgScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';

// Landscape game: fixed 540px logical height; width follows the phone's aspect
// ratio so the whole screen is used without letterboxing.
class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create(): void {
    buildArt(this);
    this.scene.launch('bg');
    this.scene.start('game');
  }
}

function start(): void {
  const parent = document.getElementById('game')!;
  const H = 540;
  const w = Math.max(parent.clientWidth, parent.clientHeight);
  const h = Math.min(parent.clientWidth, parent.clientHeight);
  const W = Math.round(Phaser.Math.Clamp((H * w) / Math.max(1, h), 860, 1240));
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#f6b48a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    scene: [BootScene, BgScene, GameScene, HudScene],
  });
  (window as unknown as { game: Phaser.Game }).game = game;
}

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Wait for the cartoon font so canvas text renders with it.
Promise.race([
  document.fonts.load('20px "Lilita One"'),
  new Promise((r) => setTimeout(r, 1500)),
]).finally(start);
