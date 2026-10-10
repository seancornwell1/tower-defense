import Phaser from 'phaser';
import type { EnemyId } from './config';

// All art is drawn in code at boot (original cartoon shapes, no external assets).

export const OL = 0x3a2621; // outline colour

type G = Phaser.GameObjects.Graphics;

function rr(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, line = 3, stroke = OL): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  if (line > 0) {
    g.lineStyle(line, stroke, 1);
    g.strokeRoundedRect(x, y, w, h, r);
  }
}

function circ(g: G, x: number, y: number, r: number, fill: number, line = 3, stroke = OL): void {
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, r);
  if (line > 0) {
    g.lineStyle(line, stroke, 1);
    g.strokeCircle(x, y, r);
  }
}

function poly(g: G, pts: number[], fill: number, line = 3, stroke = OL): void {
  const p: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < pts.length; i += 2) p.push({ x: pts[i], y: pts[i + 1] });
  g.fillStyle(fill, 1);
  g.fillPoints(p, true);
  if (line > 0) {
    g.lineStyle(line, stroke, 1);
    g.strokePoints(p, true);
  }
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function lighten(c: number, amt: number): number {
  return Phaser.Display.Color.ValueToColor(c).lighten(amt).color;
}
function darken(c: number, amt: number): number {
  return Phaser.Display.Color.ValueToColor(c).darken(amt).color;
}

interface ZombieLook {
  skin: number;
  shirt: number;
  pants: number;
  w: number;
  h: number;
  hair?: number;
  hood?: number;
}

const LOOKS: Record<Exclude<EnemyId, 'flyer'>, ZombieLook> = {
  walker: { skin: 0x8cc152, shirt: 0xb5653a, pants: 0x4a4560, w: 40, h: 54, hair: 0x4f6b2a },
  runner: { skin: 0xa5cf5a, shirt: 0xe0e0e0, pants: 0x3b5b8a, w: 38, h: 50, hair: 0xd8d8c0 },
  brute: { skin: 0x6fa548, shirt: 0x7b4fa0, pants: 0x3a3a48, w: 44, h: 54 },
  climber: { skin: 0x9fd07a, shirt: 0x6d7f8c, pants: 0x3f3f3f, w: 36, h: 48, hood: 0x5a6b78 },
};

function drawZombie(g: G, L: ZombieLook, frame: 0 | 1): void {
  const { w, h } = L;
  const cx = w / 2 + 2;
  // legs (walking frame swaps the stride)
  const legY = h - 14;
  const s = frame === 0 ? 3 : -3;
  rr(g, cx - 9 + s, legY, 7, 12, 2, L.pants, 2);
  rr(g, cx + 2 - s, legY, 7, 12, 2, L.pants, 2);
  rr(g, cx - 11 + s, h - 5, 10, 4, 2, 0x2a2a2a, 2);
  rr(g, cx - s, h - 5, 10, 4, 2, 0x2a2a2a, 2);
  // back arm
  rr(g, 3, h - 30 + (frame ? 1 : -1), 18, 6, 3, darken(L.skin, 12), 2);
  // body
  rr(g, cx - 11, h - 30, 22, 18, 5, L.shirt, 3);
  g.fillStyle(darken(L.shirt, 15), 1);
  g.fillRect(cx - 8, h - 22, 6, 5); // torn patch
  // front arm reaching forward (left)
  rr(g, 1, h - 25 + (frame ? -1 : 1), 20, 6, 3, L.skin, 2);
  // head
  const hy = 2;
  const hh = h - 30;
  if (L.hood) rr(g, cx - 15, hy - 1, 30, hh + 2, 10, L.hood, 3);
  rr(g, cx - 13, hy + (L.hood ? 3 : 0), 26, hh - (L.hood ? 3 : 0), 9, L.skin, 3);
  if (L.hair) {
    poly(g, [cx - 8, hy + 2, cx - 4, hy - 4, cx, hy + 2], L.hair, 2);
    poly(g, [cx - 1, hy + 2, cx + 4, hy - 5, cx + 7, hy + 2], L.hair, 2);
  }
  // eyes: one big, one small, looking left
  circ(g, cx - 5, hy + hh * 0.42, 5, 0xffffff, 2);
  circ(g, cx - 7, hy + hh * 0.42, 2.2, 0x111111, 0);
  circ(g, cx + 6, hy + hh * 0.38, 3.5, 0xfff6c8, 2);
  circ(g, cx + 5, hy + hh * 0.38, 1.6, 0x111111, 0);
  // mouth
  g.lineStyle(2, OL, 1);
  g.lineBetween(cx - 9, hy + hh * 0.75, cx + 3, hy + hh * 0.72);
  g.fillStyle(0xffffff, 1);
  g.fillRect(cx - 5, hy + hh * 0.73, 3, 3);
  // cheek stitch
  g.lineStyle(1.5, darken(L.skin, 30), 1);
  g.lineBetween(cx + 6, hy + hh * 0.6, cx + 10, hy + hh * 0.66);
}

function drawFlyer(g: G, up: boolean): void {
  const wing = 0x7a4f9a;
  // wings
  if (up) {
    poly(g, [22, 22, 2, 2, 8, 20, 0, 26], wing, 2);
    poly(g, [32, 22, 52, 2, 46, 20, 54, 26], wing, 2);
  } else {
    poly(g, [22, 24, 2, 38, 10, 30, 2, 26], wing, 2);
    poly(g, [32, 24, 52, 38, 44, 30, 52, 26], wing, 2);
  }
  // round bloated head-body
  circ(g, 27, 24, 14, 0x9ccc65, 3);
  circ(g, 22, 21, 5, 0xffffff, 2);
  circ(g, 20, 21, 2.2, 0x111111, 0);
  circ(g, 31, 20, 3.5, 0xfff6c8, 2);
  circ(g, 30, 20, 1.5, 0x111111, 0);
  g.lineStyle(2, OL, 1);
  g.lineBetween(20, 30, 30, 29);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(22, 30, 25, 30, 23.5, 33);
}

export function buildArt(scene: Phaser.Scene): void {
  // ------------------------------------------------ zombies
  for (const [k, L] of Object.entries(LOOKS)) {
    make(scene, `z_${k}_0`, L.w + 4, L.h + 2, (g) => drawZombie(g, L, 0));
    make(scene, `z_${k}_1`, L.w + 4, L.h + 2, (g) => drawZombie(g, L, 1));
  }
  make(scene, 'z_flyer_0', 56, 44, (g) => drawFlyer(g, true));
  make(scene, 'z_flyer_1', 56, 44, (g) => drawFlyer(g, false));

  // ------------------------------------------------ tower
  make(scene, 'block', 72, 60, (g) => {
    rr(g, 2, 2, 68, 56, 4, 0x8f4a2a, 3);
    rr(g, 8, 8, 56, 44, 2, 0xb8693e, 2, 0x6e3519);
    g.lineStyle(2, 0x8f4a2a, 1);
    g.lineBetween(8, 30, 64, 30);
    g.lineBetween(22, 8, 22, 30);
    g.lineBetween(48, 30, 48, 52);
    circ(g, 36, 30, 7, 0x5b2f1c, 3);
    circ(g, 36, 30, 3, 0xd9a07a, 0);
  });
  make(scene, 'cart', 92, 26, (g) => {
    rr(g, 2, 2, 88, 16, 4, 0x6b3b24, 3);
    g.fillStyle(0x85502f, 1);
    g.fillRect(6, 5, 80, 4);
    rr(g, 82, 8, 8, 8, 2, 0x555555, 2);
  });
  make(scene, 'wheel', 28, 28, (g) => {
    circ(g, 14, 14, 12, 0x3b3b3b, 3);
    circ(g, 14, 14, 6, 0xb0b0b0, 2);
    g.lineStyle(2, 0x777777, 1);
    g.lineBetween(14, 4, 14, 8);
    g.lineBetween(14, 20, 14, 24);
  });
  make(scene, 'hero', 40, 50, (g) => {
    // legs
    rr(g, 12, 38, 7, 10, 2, 0x4b3b2b, 2);
    rr(g, 21, 38, 7, 10, 2, 0x4b3b2b, 2);
    // body jacket
    rr(g, 9, 24, 22, 17, 5, 0xd9532b, 3);
    g.fillStyle(0xf0c040, 1);
    g.fillRect(18, 26, 4, 13);
    // head
    rr(g, 8, 6, 24, 20, 8, 0xf2b98a, 3);
    // scarf
    rr(g, 7, 20, 26, 7, 3, 0x3f8f7a, 2);
    // cap with goggles
    rr(g, 6, 2, 28, 10, 5, 0x6a7d3a, 3);
    rr(g, 26, 8, 10, 4, 2, 0x6a7d3a, 2);
    circ(g, 15, 8, 4, 0x9fe0ff, 2);
    circ(g, 24, 8, 4, 0x9fe0ff, 2);
    // eye
    circ(g, 25, 16, 2, 0x222222, 0);
  });
  make(scene, 'hero_gun', 40, 12, (g) => {
    rr(g, 0, 3, 12, 8, 2, 0x7a4a2a, 2);
    rr(g, 10, 2, 28, 6, 2, 0x5a5f6a, 2);
    rr(g, 12, 7, 14, 4, 1, 0x3a3f4a, 1);
  });
  make(scene, 'canopy', 80, 34, (g) => {
    // striped tarp awning (scalloped edge)
    const cols = [0x2e9c8a, 0xf3e6c4];
    for (let i = 0; i < 6; i++) {
      poly(g, [40, 2, 4 + i * 12, 24, 16 + i * 12, 24], cols[i % 2], 0);
    }
    for (let i = 0; i < 6; i++) circ(g, 10 + i * 12, 25, 6, cols[i % 2], 0);
    g.lineStyle(3, OL, 1);
    g.beginPath();
    g.moveTo(40, 2);
    g.lineTo(3, 24);
    g.lineTo(77, 24);
    g.closePath();
    g.strokePath();
    circ(g, 40, 3, 3, 0xf0c040, 2);
  });

  // ------------------------------------------------ weapons (facing right, mount at left-middle)
  make(scene, 'w_mg', 52, 22, (g) => {
    rr(g, 2, 4, 22, 15, 3, 0x6b6f78, 3);
    rr(g, 22, 4, 28, 4, 1, 0x3a3d44, 2);
    rr(g, 22, 9, 28, 4, 1, 0x3a3d44, 2);
    rr(g, 22, 14, 28, 4, 1, 0x3a3d44, 2);
    rr(g, 6, 14, 10, 7, 2, 0x5c7a3a, 2);
  });
  make(scene, 'w_flame', 54, 24, (g) => {
    rr(g, 2, 4, 20, 16, 7, 0xc8452f, 3);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(6, 7, 12, 3);
    rr(g, 20, 8, 22, 8, 2, 0x8a8f99, 2);
    rr(g, 40, 6, 10, 12, 3, 0x4a4f5a, 2);
    circ(g, 50, 12, 3, 0xffb030, 0);
  });
  make(scene, 'w_rocket', 56, 24, (g) => {
    rr(g, 2, 4, 44, 16, 4, 0x6c7a3c, 3);
    rr(g, 44, 6, 8, 12, 2, 0x3a3f2a, 2);
    poly(g, [46, 8, 54, 12, 46, 16], 0xd84a3a, 2);
    g.fillStyle(0xf0d040, 1);
    g.fillRect(10, 8, 4, 8);
  });
  make(scene, 'w_laser', 52, 22, (g) => {
    rr(g, 2, 3, 30, 16, 6, 0x8e4fc0, 3);
    rr(g, 30, 7, 14, 8, 2, 0x4a3a5a, 2);
    circ(g, 46, 11, 5, 0x6ff0ff, 2);
  });
  make(scene, 'w_cryo', 52, 24, (g) => {
    rr(g, 2, 4, 26, 16, 7, 0x6fc8ec, 3);
    rr(g, 26, 8, 18, 8, 2, 0xd8f4ff, 2);
    poly(g, [44, 5, 50, 12, 44, 19], 0xffffff, 2);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(8, 7, 10, 3);
  });
  make(scene, 'w_shocker', 34, 40, (g) => {
    rr(g, 6, 28, 22, 10, 3, 0x5a5f6a, 3);
    rr(g, 12, 10, 10, 20, 2, 0xc89a3a, 2);
    g.lineStyle(2, 0x8a6a2a, 1);
    for (let y = 13; y < 28; y += 4) g.lineBetween(12, y, 22, y);
    circ(g, 17, 8, 7, 0xf5e04a, 3);
  });
  make(scene, 'w_boomerang', 50, 22, (g) => {
    rr(g, 2, 7, 30, 9, 3, 0x7a4a2a, 3);
    poly(g, [30, 3, 46, 11, 30, 19, 36, 11], 0xf0b030, 3);
  });
  make(scene, 'w_saw', 44, 14, (g) => {
    rr(g, 2, 3, 40, 8, 3, 0x7a7f88, 3);
  });
  make(scene, 'saw_blade', 40, 40, (g) => {
    const pts: number[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 2 === 0 ? 18 : 13;
      pts.push(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
    }
    poly(g, pts, 0xd8dde4, 2);
    circ(g, 20, 20, 6, 0x8a2a2a, 2);
  });

  // ------------------------------------------------ enemies' structure
  make(scene, 'nest', 112, 96, (g) => {
    poly(g, [8, 22, 104, 22, 98, 90, 14, 90], 0x3f86c9, 3);
    g.lineStyle(2, 0x2c6aa5, 1);
    for (let x = 22; x < 98; x += 14) g.lineBetween(x, 28, x - 1, 86);
    poly(g, [4, 12, 108, 12, 104, 26, 8, 26], 0x5a9fd9, 3);
    // hazard sign
    circ(g, 56, 56, 17, 0xf3d23b, 3);
    poly(g, [56, 44, 67, 64, 45, 64], 0x2a2a2a, 0);
    g.fillStyle(0xf3d23b, 1);
    g.fillRect(54.5, 50, 3, 8);
    g.fillCircle(56, 61, 1.8);
    // slime drips
    g.fillStyle(0x9be04a, 1);
    g.fillEllipse(30, 90, 26, 8);
    g.fillEllipse(80, 91, 18, 6);
    g.fillRoundedRect(26, 80, 6, 12, 3);
    g.fillStyle(0x6a3a22, 0.5);
    g.fillEllipse(70, 78, 24, 10);
  });
  make(scene, 'nest_door', 40, 80, (g) => {
    rr(g, 4, 4, 32, 72, 8, 0x2f6fae, 3);
    rr(g, 10, 12, 20, 22, 4, 0x4a8fd0, 2);
    g.fillStyle(0xf0f0f0, 1);
    g.fillRect(14, 44, 10, 12);
  });
  make(scene, 'crate', 40, 40, (g) => {
    rr(g, 2, 2, 36, 36, 4, 0xd49a5a, 3);
    g.lineStyle(2, 0x9a6a38, 1);
    g.lineBetween(4, 4, 36, 36);
    rr(g, 12, 12, 16, 16, 3, 0x5cc35a, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(18.5, 15, 3, 10);
    g.fillRect(15, 18.5, 10, 3);
  });
  make(scene, 'flag', 50, 120, (g) => {
    rr(g, 4, 4, 6, 114, 2, 0x5a5f6a, 2);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      g.fillStyle((i + j) % 2 ? 0x222222 : 0xffffff, 1);
      g.fillRect(10 + i * 9, 8 + j * 9, 9, 9);
    }
    g.lineStyle(2, OL, 1);
    g.strokeRect(10, 8, 36, 27);
  });

  // ------------------------------------------------ projectiles & particles
  make(scene, 'p_bullet', 14, 6, (g) => rr(g, 1, 1, 12, 4, 2, 0xffe27a, 1, 0xb07a20));
  make(scene, 'p_rocket', 26, 12, (g) => {
    rr(g, 2, 2, 18, 8, 3, 0xd84a3a, 2);
    poly(g, [20, 2, 25, 6, 20, 10], 0xeeeeee, 1);
  });
  make(scene, 'p_ice', 20, 12, (g) => poly(g, [1, 6, 8, 1, 19, 6, 8, 11], 0xbff0ff, 2, 0x3a8ab0));
  make(scene, 'p_boom', 28, 28, (g) => poly(g, [4, 4, 14, 10, 24, 4, 16, 16, 24, 24, 14, 18, 4, 24, 10, 14], 0xf0b030, 2));
  make(scene, 'p_grenade', 18, 22, (g) => {
    rr(g, 2, 6, 14, 14, 6, 0x5c8a3a, 2);
    rr(g, 6, 1, 6, 6, 1, 0x8a8f99, 2);
  });
  make(scene, 'puff', 32, 32, (g) => {
    for (let r = 15; r > 0; r -= 3) {
      g.fillStyle(0xffffff, 0.18 + (15 - r) * 0.05);
      g.fillCircle(16, 16, r);
    }
  });
  make(scene, 'spark', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 3);
  });

  // ------------------------------------------------ UI icons
  make(scene, 'coin', 30, 30, (g) => {
    circ(g, 15, 15, 12, 0xf6b72c, 3, 0x7a4a10);
    circ(g, 15, 15, 7, 0xffd45a, 2, 0xd08a1a);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(11, 10, 2);
  });
  make(scene, 'bolt', 36, 48, (g) => poly(g, [22, 2, 4, 28, 16, 28, 10, 46, 32, 16, 20, 16, 28, 2], 0x5ee0ff, 3, 0x1e5a8a));
  make(scene, 'ico_hammer', 40, 40, (g) => {
    rr(g, 17, 14, 7, 24, 2, 0x9a6a3a, 2);
    rr(g, 6, 4, 28, 12, 3, 0x8a8f99, 3);
  });
  make(scene, 'ico_trash', 40, 44, (g) => {
    rr(g, 7, 12, 26, 30, 3, 0x8a8f99, 3);
    rr(g, 3, 6, 34, 7, 2, 0xa0a6b0, 3);
    rr(g, 15, 2, 10, 6, 2, 0xa0a6b0, 2);
    g.lineStyle(2, 0x5a5f6a, 1);
    g.lineBetween(15, 18, 15, 36);
    g.lineBetween(25, 18, 25, 36);
  });
  make(scene, 'ico_plus', 34, 34, (g) => {
    rr(g, 2, 2, 30, 30, 5, 0x6b3b24, 3);
    g.fillStyle(0xffffff, 1);
    g.fillRect(14.5, 8, 5, 18);
    g.fillRect(8, 14.5, 18, 5);
  });
  make(scene, 'ico_heart', 30, 28, (g) => {
    g.fillStyle(0xe8453c, 1);
    g.fillCircle(9, 10, 7);
    g.fillCircle(21, 10, 7);
    g.fillTriangle(3, 13, 27, 13, 15, 26);
  });

  // ------------------------------------------------ backdrop (canvas gradients)
  const sky = scene.textures.createCanvas('sky', 4, 256)!;
  const ctx = sky.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f7c98f');
  grad.addColorStop(0.55, '#f6b48a');
  grad.addColorStop(1, '#f4a38c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  sky.refresh();

  const skyline = (key: string, w: number, h: number, color: string, minH: number, maxH: number, windows: string | null) => {
    const t = scene.textures.createCanvas(key, w, h)!;
    const c = t.getContext();
    c.fillStyle = color;
    let x = 0;
    while (x < w) {
      const bw = 40 + Math.random() * 70;
      const bh = minH + Math.random() * (maxH - minH);
      const right = Math.min(w, x + bw);
      c.fillRect(x, h - bh, right - x, bh);
      if (Math.random() < 0.3) c.fillRect(x + bw * 0.4, h - bh - 30, 6, 30); // antenna
      if (windows) {
        c.fillStyle = windows;
        for (let wy = h - bh + 14; wy < h - 20; wy += 24) {
          for (let wx = x + 8; wx < right - 12; wx += 18) if (Math.random() < 0.6) c.fillRect(wx, wy, 8, 12);
        }
        c.fillStyle = color;
      }
      x = right + 4 + Math.random() * 20;
    }
    t.refresh();
  };
  skyline('skyline_far', 1024, 300, '#f2bc94', 120, 290, null);
  skyline('skyline_near', 1024, 220, '#eda786', 60, 200, '#e79c7c');

  make(scene, 'fence', 64, 40, (g) => {
    g.fillStyle(0xb06e58, 1);
    g.fillRect(0, 6, 64, 5);
    g.fillRect(0, 22, 64, 4);
    rr(g, 4, 2, 8, 38, 2, 0xc27c64, 2, 0x8a5040);
    rr(g, 36, 6, 6, 34, 2, 0xc27c64, 2, 0x8a5040);
  });
  make(scene, 'road', 128, 140, (g) => {
    g.fillStyle(0xd28f72, 1);
    g.fillRect(0, 0, 128, 140);
    g.fillStyle(0xb8765c, 1);
    g.fillRect(0, 0, 128, 6);
    g.fillStyle(0xe2a688, 1);
    g.fillRect(0, 6, 128, 4);
    g.fillStyle(0xc4826a, 1);
    g.fillRect(10, 40, 50, 5);
    g.fillRect(80, 90, 30, 4);
  });
}

export const FONT = '"Lilita One", "Arial Rounded MT Bold", Arial, sans-serif';

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 20, color = '#ffffff', stroke = 5): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#2b2433', strokeThickness: stroke, align: 'center',
  }).setOrigin(0.5);
}

export interface Btn extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): Btn;
  bgColor: number;
}

/** Chunky cartoon button: dark outline, bottom shadow, lighter top band. */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, onTap: () => void): Btn {
  const g = scene.add.graphics();
  const c = scene.add.container(x, y, [g]) as Btn;
  c.bgColor = color;
  const draw = (col: number, pressed: boolean) => {
    g.clear();
    const dy = pressed ? 3 : 0;
    g.fillStyle(OL, 1);
    g.fillRoundedRect(-w / 2 - 2, -h / 2 - 2 + dy, w + 4, h + 6 - dy, 10);
    g.fillStyle(darken(col, 18), 1);
    g.fillRoundedRect(-w / 2, -h / 2 + dy, w, h + 2 - dy, 8);
    g.fillStyle(col, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + dy, w, h - 4, 8);
    g.fillStyle(lighten(col, 12), 1);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 3 + dy, w - 8, Math.min(10, h * 0.25), 5);
  };
  draw(color, false);
  let enabled = true;
  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h + 4), Phaser.Geom.Rectangle.Contains);
  c.on('pointerdown', () => {
    draw(c.bgColor, true);
    c.list.slice(1).forEach((o) => ((o as Phaser.GameObjects.Image).y += 3));
    scene.time.delayedCall(90, () => {
      if (!c.active) return;
      draw(enabled ? c.bgColor : 0x9aa3ad, false);
      c.list.slice(1).forEach((o) => ((o as Phaser.GameObjects.Image).y -= 3));
    });
    onTap();
  });
  c.setEnabled = (on: boolean) => {
    if (on !== enabled) {
      enabled = on;
      draw(on ? c.bgColor : 0x9aa3ad, false);
    }
    return c;
  };
  return c;
}

export function fmt(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.max(0, Math.ceil(n))}`;
}
