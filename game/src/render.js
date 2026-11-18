// Rendering: the ground is pre-rendered once to an offscreen canvas, then
// each frame paints buildings with sun-side shading, props, the sea shimmer,
// entities sorted by depth, markers, and a warm afternoon light.

import {
  AVENUES, BEACH_TOP, COLORS, ROAD_WIDTH, SEA_TOP, STREETS, WORLD_H, WORLD_W,
} from './config.js';
import { isParkBlock } from './config.js';
import { drawSkids, drawParticles, drawFloats } from './effects.js';
import { drawCar } from './vehicles.js';
import { drawPedestrian } from './traffic.js';
import { drawOfficer } from './police.js';
import { drawBullets, drawEnemy, drawPickup } from './combat.js';
import { drawCompanion } from './missions.js';
import { drawPlayer } from './player.js';

export function createCamera(viewW, viewH) {
  return { x: 0, y: 0, w: viewW, h: viewH, zoom: 1 };
}

export function updateCamera(camera, targetX, targetY, dt) {
  const tx = targetX - camera.w / 2;
  const ty = targetY - camera.h / 2;
  camera.x += (tx - camera.x) * Math.min(1, 5 * dt);
  camera.y += (ty - camera.y) * Math.min(1, 5 * dt);
  camera.x = Math.max(0, Math.min(Math.max(0, WORLD_W - camera.w), camera.x));
  camera.y = Math.max(0, Math.min(Math.max(0, WORLD_H - camera.h), camera.y));
}

export function renderGround(city) {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  const ctx = canvas.getContext('2d');

  // Grass base with a subtle checker of mowing tones.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let y = 0; y < WORLD_H; y += 120) {
    for (let x = 0; x < WORLD_W; x += 120) {
      if (((x + y) / 120) % 2 === 0) {
        ctx.fillStyle = COLORS.grassDark;
        ctx.fillRect(x, y, 120, 120);
      }
    }
  }

  // Park blocks: richer grass and winding paths.
  for (let col = 0; col < AVENUES.length - 1; col++) {
    for (let row = 0; row < STREETS.length - 1; row++) {
      if (!isParkBlock(col, row)) continue;
      const x = AVENUES[col] + ROAD_WIDTH / 2;
      const y = STREETS[row] + ROAD_WIDTH / 2;
      ctx.fillStyle = COLORS.parkGrass;
      ctx.fillRect(x, y, 300 - ROAD_WIDTH, 300 - ROAD_WIDTH);
      ctx.strokeStyle = '#d8c9a3';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(x, y + 90);
      ctx.quadraticCurveTo(x + 110, y + 130, x + 228, y + 80);
      ctx.moveTo(x + 80, y);
      ctx.quadraticCurveTo(x + 120, y + 110, x + 90, y + 228);
      ctx.stroke();
    }
  }

  // Sidewalks: a pale ring inside every block.
  for (let col = 0; col < AVENUES.length - 1; col++) {
    for (let row = 0; row < STREETS.length - 1; row++) {
      if (isParkBlock(col, row)) continue;
      const x = AVENUES[col] + ROAD_WIDTH / 2;
      const y = STREETS[row] + ROAD_WIDTH / 2;
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(x, y, 300 - ROAD_WIDTH, 300 - ROAD_WIDTH);
      ctx.strokeStyle = COLORS.sidewalkEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, y + 1, 300 - ROAD_WIDTH - 2, 300 - ROAD_WIDTH - 2);
    }
  }

  // Harbor concrete apron, under the roads so the streets stay visible.
  ctx.fillStyle = '#a8a094';
  ctx.fillRect(2920, 1200, 640, 1120);
  ctx.fillStyle = '#98907f';
  for (let y = 1220; y < 2300; y += 60) ctx.fillRect(2920, y, 640, 3);

  // Asphalt: avenues and streets.
  ctx.fillStyle = COLORS.asphalt;
  for (const x of AVENUES) ctx.fillRect(x - ROAD_WIDTH / 2, 0, ROAD_WIDTH, BEACH_TOP);
  for (const y of STREETS) ctx.fillRect(0, y - ROAD_WIDTH / 2, WORLD_W, ROAD_WIDTH);

  // Lane dashes.
  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const x of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BEACH_TOP);
    ctx.stroke();
  }
  for (const y of STREETS) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(232,228,218,0.75)';
  for (const x of AVENUES) {
    for (const y of STREETS) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x - ROAD_WIDTH / 2 + 4, y + i * 13 - 3, 12, 6);
        ctx.fillRect(x + ROAD_WIDTH / 2 - 16, y + i * 13 - 3, 12, 6);
        ctx.fillRect(x + i * 13 - 3, y - ROAD_WIDTH / 2 + 4, 6, 12);
        ctx.fillRect(x + i * 13 - 3, y + ROAD_WIDTH / 2 - 16, 6, 12);
      }
    }
  }

  // Beach and sea.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, BEACH_TOP, WORLD_W, SEA_TOP - BEACH_TOP);
  const seaGrad = ctx.createLinearGradient(0, SEA_TOP, 0, WORLD_H);
  seaGrad.addColorStop(0, COLORS.sea);
  seaGrad.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, SEA_TOP, WORLD_W, WORLD_H - SEA_TOP);
  // Wet sand line.
  ctx.fillStyle = '#dcc78e';
  ctx.fillRect(0, SEA_TOP - 8, WORLD_W, 8);

  return canvas;
}

export function renderMinimapBase(city) {
  const scale = 0.1;
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W * scale;
  canvas.height = WORLD_H * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3c4048';
  for (const x of AVENUES) ctx.fillRect(x * scale - 3, 0, 6, BEACH_TOP * scale);
  for (const y of STREETS) ctx.fillRect(0, y * scale - 3, canvas.width, 6);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(0, BEACH_TOP * scale, canvas.width, (SEA_TOP - BEACH_TOP) * scale);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, SEA_TOP * scale, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const b of city.buildings) {
    ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
  }
  return canvas;
}

export function drawWorld(G, ctx, groundCanvas) {
  const { camera, effects } = G;
  const camX = camera.x + effects.shakeX;
  const camY = camera.y + effects.shakeY;

  ctx.save();
  ctx.translate(-camX, -camY);

  ctx.drawImage(groundCanvas, 0, 0);

  // Animated sea shimmer.
  drawSeaShimmer(ctx, G.time, camX, camY, camera);

  drawSkids(ctx, effects, { x: camX, y: camY, w: camera.w, h: camera.h });

  // Mission marker beacon under everything else.
  drawMarkerBeacon(G, ctx);

  // Depth-sorted draw: buildings and props by their south edge, then actors.
  const drawables = [];
  for (const b of G.city.buildings) {
    if (b.x > camX + camera.w + 60 || b.x + b.w < camX - 60) continue;
    if (b.y > camY + camera.h + 60 || b.y + b.h < camY - 60) continue;
    drawables.push({ y: b.y + b.h, kind: 'building', item: b });
  }
  for (const prop of G.city.props) {
    if (prop.x < camX - 60 || prop.x > camX + camera.w + 60) continue;
    if (prop.y < camY - 60 || prop.y > camY + camera.h + 60) continue;
    drawables.push({ y: prop.y + 10, kind: 'prop', item: prop });
  }
  for (const car of G.cars) {
    if (car.x < camX - 80 || car.x > camX + camera.w + 80) continue;
    if (car.y < camY - 80 || car.y > camY + camera.h + 80) continue;
    drawables.push({ y: car.y + 12, kind: 'car', item: car });
  }
  for (const ped of G.peds) drawables.push({ y: ped.y + 8, kind: 'ped', item: ped });
  for (const off of G.officers) drawables.push({ y: off.y + 8, kind: 'officer', item: off });
  for (const e of G.enemies) {
    if (!e.dead) drawables.push({ y: e.y + 8, kind: 'enemy', item: e });
  }
  for (const pk of G.pickups) drawables.push({ y: pk.y + 6, kind: 'pickup', item: pk });
  if (G.companion && !G.companion.inCar && !G.companion.dead) {
    drawables.push({ y: G.companion.y + 8, kind: 'companion', item: G.companion });
  }
  drawables.push({ y: G.player.y + 9, kind: 'player', item: G.player });

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    if (d.kind === 'building') drawBuilding(ctx, d.item);
    else if (d.kind === 'prop') drawProp(ctx, d.item, G.time);
    else if (d.kind === 'car') drawCar(ctx, d.item, G.time);
    else if (d.kind === 'ped') drawPedestrian(ctx, d.item);
    else if (d.kind === 'officer') drawOfficer(ctx, d.item);
    else if (d.kind === 'enemy') drawEnemy(ctx, d.item);
    else if (d.kind === 'pickup') drawPickup(ctx, d.item, G.time);
    else if (d.kind === 'companion') drawCompanion(ctx, d.item);
    else if (d.kind === 'player') drawPlayer(ctx, d.item, G.time);
  }

  drawBullets(ctx, G.bullets);
  drawParticles(ctx, effects, { x: camX, y: camY, w: camera.w, h: camera.h });
  drawFloats(ctx, effects);

  ctx.restore();

  // Warm afternoon light and a soft vignette.
  ctx.save();
  ctx.fillStyle = 'rgba(255, 214, 130, 0.07)';
  ctx.fillRect(0, 0, camera.w, camera.h);
  const vig = ctx.createRadialGradient(
    camera.w / 2, camera.h / 2, Math.min(camera.w, camera.h) * 0.42,
    camera.w / 2, camera.h / 2, Math.max(camera.w, camera.h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(20,10,0,0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, camera.w, camera.h);
  ctx.restore();
}

function drawSeaShimmer(ctx, time, camX, camY, camera) {
  if (camY + camera.h < SEA_TOP) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = SEA_TOP + 8 + ((i * 37) % 70);
    const x = ((i * 173 + time * 22) % (WORLD_W + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 34 + Math.sin(time * 2 + i) * 8, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBuilding(ctx, b) {
  const h = b.height;
  const ox = h * 0.35;
  const oy = h * 0.35;
  // Ground shadow, offset south-east by the sun.
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
  // South and east faces.
  ctx.fillStyle = shadeColor(b.color, -34);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
  ctx.lineTo(b.x + ox, b.y + b.h + oy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shadeColor(b.color, -22);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w + ox, b.y + oy);
  ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  // Roof.
  ctx.fillStyle = shadeColor(b.color, 14);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w + ox, b.y + oy);
  ctx.lineTo(b.x + ox, b.y + oy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Roof details: vents and, on tall towers, a helipad ring.
  const roofX = b.x + ox / 2;
  const roofY = b.y + oy / 2;
  if (b.w > 60 && b.h > 50) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(roofX + b.w * 0.2, roofY + b.h * 0.25, 14, 10);
    ctx.fillRect(roofX + b.w * 0.6, roofY + b.h * 0.55, 12, 9);
  }
  if (h > 34 && b.w > 90) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(roofX + b.w / 2, roofY + b.h / 2, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 14px Verdana';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('H', roofX + b.w / 2, roofY + b.h / 2 + 5);
  }
}

function drawProp(ctx, prop, time) {
  if (prop.kind === 'tree' || prop.kind === 'palm') {
    const s = prop.s || 1;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(prop.x + 4, prop.y + 4, 12 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (prop.kind === 'palm') {
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.quadraticCurveTo(prop.x + 3 * s, prop.y - 12 * s, prop.x + 6 * s, prop.y - 20 * s);
      ctx.stroke();
      ctx.strokeStyle = '#3f8f4f';
      ctx.lineWidth = 3 * s;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.sin(time + prop.x) * 0.05;
        ctx.beginPath();
        ctx.moveTo(prop.x + 6 * s, prop.y - 20 * s);
        ctx.quadraticCurveTo(
          prop.x + 6 * s + Math.cos(a) * 12 * s, prop.y - 20 * s + Math.sin(a) * 12 * s - 4,
          prop.x + 6 * s + Math.cos(a) * 20 * s, prop.y - 20 * s + Math.sin(a) * 20 * s + 4,
        );
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#6a4a2c';
      ctx.fillRect(prop.x - 2 * s, prop.y - 6 * s, 4 * s, 8 * s);
      ctx.fillStyle = '#4d8a3f';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 12 * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5da34b';
      ctx.beginPath();
      ctx.arc(prop.x - 4 * s, prop.y - 15 * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (prop.kind === 'lamp') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(prop.x - 1, prop.y - 1, 4, 4);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(prop.x - 2, prop.y - 14, 4, 14);
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.arc(prop.x, prop.y - 15, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'bench') {
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.rotate(prop.a);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-12, -4, 24, 8);
    ctx.fillStyle = '#6a4a2c';
    ctx.fillRect(-12, -6, 24, 3);
    ctx.restore();
  } else if (prop.kind === 'pond') {
    ctx.fillStyle = '#3f8fb5';
    ctx.beginPath();
    ctx.ellipse(prop.x, prop.y, prop.r, prop.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(prop.x, prop.y, prop.r * 0.6, prop.r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (prop.kind === 'crate') {
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.rotate(prop.a);
    ctx.fillStyle = prop.c;
    ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
    ctx.beginPath();
    ctx.moveTo(-prop.w / 2, 0);
    ctx.lineTo(prop.w / 2, 0);
    ctx.stroke();
    ctx.restore();
  } else if (prop.kind === 'umbrella') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(prop.x + 3, prop.y + 3, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = prop.c;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 13, -0.6, 0.6);
    ctx.lineTo(prop.x, prop.y);
    ctx.fill();
  } else if (prop.kind === 'pier') {
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(prop.x - prop.w / 2, prop.y - prop.h / 2 + i * 14);
      ctx.lineTo(prop.x + prop.w / 2, prop.y - prop.h / 2 + i * 14);
      ctx.stroke();
    }
  }
}

function drawMarkerBeacon(G, ctx) {
  const marker = G.marker;
  if (!marker) return;
  const pulse = 0.6 + Math.sin(G.time * 4) * 0.4;
  const { x, y, radius, color } = marker;
  ctx.save();
  // Ground ring.
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.16 + pulse * 0.1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  // Light pillar.
  const grad = ctx.createLinearGradient(x, y - 170, x, y);
  grad.addColorStop(0, 'rgba(255,215,106,0)');
  grad.addColorStop(1, `rgba(255,215,106,${0.35 + pulse * 0.2})`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(x - 9, y - 170, 18, 170);
  // Bouncing arrow.
  const bob = Math.sin(G.time * 3) * 7;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 150 + bob);
  ctx.lineTo(x - 12, y - 172 + bob);
  ctx.lineTo(x + 12, y - 172 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function shadeColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}
