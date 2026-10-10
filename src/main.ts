import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

// Portrait game, fixed 540px logical width; height follows the phone's aspect
// ratio so the whole screen is used without letterboxing.
const parent = document.getElementById('game')!;
const W = 540;
const aspect = parent.clientHeight / Math.max(1, parent.clientWidth);
const H = Math.round(Phaser.Math.Clamp(W * aspect, 900, 1240));

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: W,
  height: H,
  backgroundColor: '#1d2027',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  render: { antialias: true },
  scene: [GameScene],
});

(window as unknown as { game: Phaser.Game }).game = game;
