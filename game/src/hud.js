// The HUD and every screen around the game: minimap, wanted stars, health,
// cash, objective banner, dialogue box, title, pause, help, and the
// wasted/busted overlays.

import { PLACES, WEAPONS, WORLD_H, WORLD_W } from './config.js';
import { currentStep, nextMission } from './missions.js';

export function drawHUD(G, ctx, w, h) {
  const p = G.player;
  drawMinimap(G, ctx, w, h);
  drawWanted(G, ctx, w);
  drawVitals(G, ctx, h);
  drawCash(G, ctx);
  drawObjective(G, ctx, w);
  drawWeaponBox(G, ctx, h);
  drawSpeedo(G, ctx, w, h);
  if (G.hintTimer > 0) drawHint(G, ctx, w, h);
  if (G.banner) drawBanner(G, ctx, w);
  if (G.story.dialogue) drawDialogue(G, ctx, w, h);
  if (G.story.active) drawMissionTimer(G, ctx, w);
  if (p.health < 30) {
    ctx.fillStyle = `rgba(200,30,20,${0.12 + Math.sin(G.time * 5) * 0.05})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12,14,20,${alpha || 0.62})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMinimap(G, ctx, w, h) {
  const size = 178;
  const x = w - size - 14;
  const y = 14;
  const scale = size / 900; // show a 900-unit window around the player
  panel(ctx, x - 5, y - 5, size + 10, size + 10, 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  const base = G.minimapBase;
  const bw = base.width;
  const bh = base.height;
  // Draw the whole-city thumbnail scaled so the player stays centred; the
  // crop is clamped inside the thumbnail near the world edges.
  const worldToMap = bw / WORLD_W;
  const viewWorld = size / scale;
  const srcW = viewWorld * worldToMap;
  const srcX = Math.max(0, Math.min(bw - srcW, G.player.x * worldToMap - srcW / 2));
  const srcY = Math.max(0, Math.min(bh - srcW, G.player.y * worldToMap - srcW / 2));
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(x, y, size, size);
  ctx.drawImage(base, srcX, srcY, srcW, srcW, x, y, size, size);

  const toMap = (wx, wy) => ({
    x: x + ((wx * worldToMap - srcX) / srcW) * size,
    y: y + ((wy * worldToMap - srcY) / srcW) * size,
  });

  // Mission marker.
  if (G.marker) {
    const m = toMap(G.marker.x, G.marker.y);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Mission giver.
  if (!G.story.active && nextMission(G.story)) {
    const g = toMap(PLACES.garage.x, PLACES.garage.y);
    ctx.fillStyle = '#7ddb8a';
    ctx.font = 'bold 13px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('B', g.x, g.y + 5);
  }
  // Police blips.
  const flash = Math.floor(G.time * 4) % 2 === 0;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const c = toMap(car.x, car.y);
    if (c.x < x || c.x > x + size || c.y < y || c.y > y + size) continue;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const pa = toMap(G.player.x, G.player.y);
  ctx.save();
  ctx.translate(pa.x, pa.y);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('N', x + size / 2, y + 14);
  ctx.restore();
}

function drawWanted(G, ctx, w) {
  const stars = G.wanted.stars;
  const x = w - 178 - 14;
  const y = 208;
  panel(ctx, x - 5, y - 5, 188, 34, 0.62);
  ctx.font = 'bold 20px Verdana';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? (G.wanted.evading && Math.floor(G.time * 3) % 2 === 0 ? '#8a8f98' : '#ffd76a') : '#4a4d55';
    ctx.fillText('★', x + 8 + i * 34, y + 20);
  }
  if (G.wanted.evading) {
    ctx.font = 'bold 11px Verdana';
    ctx.fillStyle = '#7ddb8a';
    ctx.textAlign = 'right';
    ctx.fillText('EVADING', x + 178, y + 40);
  }
}

function drawVitals(G, ctx, h) {
  const p = G.player;
  const x = 16;
  const y = h - 58;
  panel(ctx, x - 6, y - 6, 240, 48, 0.62);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, 200, 12);
  const hpFrac = Math.max(0, p.health / 100);
  ctx.fillStyle = hpFrac > 0.3 ? '#7ddb8a' : '#e05a4e';
  ctx.fillRect(x, y, 200 * hpFrac, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText('ROSA', x + 2, y + 27);
  if (p.armor > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + 60, y + 20, 140, 8);
    ctx.fillStyle = '#7db8db';
    ctx.fillRect(x + 60, y + 20, 140 * Math.max(0, p.armor / 100), 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ARMOR', x + 60, y + 40);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.ceil(p.health)}`, x + 228, y + 12);
}

function drawCash(G, ctx) {
  const x = 16;
  const y = 16;
  panel(ctx, x - 6, y - 6, 150, 34, 0.62);
  ctx.fillStyle = '#7ddb8a';
  ctx.font = 'bold 20px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText(`$${G.player.cash.toLocaleString('en-US')}`, x + 6, y + 20);
}

function drawObjective(G, ctx, w) {
  const step = currentStep(G);
  let text = null;
  if (step) {
    text = step.text;
    if (step.x !== undefined) {
      const d = Math.round(Math.hypot(G.player.x - step.x, G.player.y - step.y));
      text += `  •  ${d}m`;
    }
  } else if (!G.story.active && nextMission(G.story)) {
    text = 'Go to Bea’s Garage (green B) for your next job';
  } else if (G.story.storyDone) {
    text = 'Marisol Bay is yours — free roam';
  }
  if (!text) return;
  ctx.font = 'bold 15px Verdana';
  const tw = ctx.measureText(text).width;
  const x = w / 2 - tw / 2 - 14;
  panel(ctx, x, 14, tw + 28, 32, 0.66);
  ctx.fillStyle = '#ffd76a';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, 36);
}

function drawWeaponBox(G, ctx, h) {
  const p = G.player;
  const weapon = WEAPONS[p.weapon];
  const x = 16;
  const y = h - 108;
  panel(ctx, x - 6, y - 6, 150, 34, 0.62);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Verdana';
  ctx.textAlign = 'left';
  const ammo = p.weapon === 'fists' ? '∞' : String(p.ammo[p.weapon]);
  ctx.fillText(`${weapon.name}  ${ammo}`, x + 6, y + 19);
}

function drawSpeedo(G, ctx, w, h) {
  const p = G.player;
  if (!p.car) return;
  const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
  const x = w - 120;
  const y = h - 52;
  panel(ctx, x - 6, y - 6, 110, 44, 0.62);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText(`${kmh}`, x + 48, y + 22);
  ctx.font = '11px Verdana';
  ctx.fillText('km/h', x + 48, y + 36);
  // Car health.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 6, y + 40, 86, 5);
  ctx.fillStyle = '#e8b13e';
  ctx.fillRect(x + 6, y + 40, 86 * Math.max(0, p.car.health / p.car.def.health), 5);
}

function drawHint(G, ctx, w, h) {
  ctx.font = '13px Verdana';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(G.hint, w / 2, h - 18);
}

function drawBanner(G, ctx, w) {
  const b = G.banner;
  const alpha = Math.min(1, b.life * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 34px Verdana';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(b.text, w / 2, 108);
  ctx.fillStyle = b.color || '#ffd76a';
  ctx.fillText(b.text, w / 2, 108);
  if (b.sub) {
    ctx.font = 'bold 16px Verdana';
    ctx.strokeText(b.sub, w / 2, 136);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.sub, w / 2, 136);
  }
  ctx.restore();
}

function drawMissionTimer(G, ctx, w) {
  const step = currentStep(G);
  if (!step || step.type !== 'timed-drive') return;
  const left = Math.max(0, step.seconds - G.story.active.timer);
  ctx.font = 'bold 26px Verdana';
  ctx.textAlign = 'center';
  ctx.fillStyle = left < 20 ? '#ff6a5a' : '#ffffff';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(formatTime(left), w / 2, 78);
  ctx.fillText(formatTime(left), w / 2, 78);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawDialogue(G, ctx, w, h) {
  const d = G.story.dialogue;
  const line = d.lines[d.index];
  const boxW = Math.min(720, w - 80);
  const x = w / 2 - boxW / 2;
  const y = h - 150;
  panel(ctx, x, y, boxW, 96, 0.85);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText(line.speaker, x + 18, y + 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Verdana';
  const shown = line.text.slice(0, Math.floor(d.shown));
  ctx.fillText(shown, x + 18, y + 54, boxW - 36);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px Verdana';
  ctx.textAlign = 'right';
  ctx.fillText('E / click ▸', x + boxW - 14, y + 84);
}

// --- Screens ----------------------------------------------------------------

export function drawTitleScreen(G, ctx, w, h, menuIndex, hasSaveGame) {
  drawTitleBackdrop(ctx, w, h, G.time);
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Verdana';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(20,10,0,0.8)';
  ctx.strokeText('MARISOL BAY', w / 2, h * 0.3);
  const grad = ctx.createLinearGradient(0, h * 0.3 - 50, 0, h * 0.3 + 10);
  grad.addColorStop(0, '#ffe9a3');
  grad.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = grad;
  ctx.fillText('MARISOL BAY', w / 2, h * 0.3);
  ctx.font = 'bold 17px Verdana';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', w / 2, h * 0.3 + 34);
  ctx.font = '14px Verdana';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Rosa Vega is back. The city owes her answers — and Kane owes her brother.', w / 2, h * 0.3 + 60);

  const items = hasSaveGame ? ['Continue', 'New Game', 'How to Play'] : ['New Game', 'How to Play'];
  const startY = h * 0.52;
  items.forEach((label, i) => {
    const y = startY + i * 46;
    const selected = i === menuIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(255,215,106,0.9)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 150, y - 28, 300, 38, 8);
      ctx.fill();
      ctx.fillStyle = '#1c1a14';
    } else {
      ctx.fillStyle = 'rgba(12,14,20,0.6)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 150, y - 28, 300, 38, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
    }
    ctx.font = 'bold 18px Verdana';
    ctx.fillText(label, w / 2, y);
  });
  ctx.font = '12px Verdana';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Keyboard + mouse  •  WASD move / drive  •  E enter car  •  Click shoot  •  M mute', w / 2, h - 24);
  return items;
}

function drawTitleBackdrop(ctx, w, h, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#ff9a5a');
  sky.addColorStop(0.45, '#ffb877');
  sky.addColorStop(0.7, '#ffd9a0');
  sky.addColorStop(1, '#7fae5c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Sun.
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,243,196,0.35)';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, 70, 0, Math.PI * 2);
  ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#4a3a4a';
  let x = 0;
  const rngHeights = [120, 180, 100, 210, 150, 90, 170, 130, 200, 110, 160, 90, 140, 190, 120];
  let i = 0;
  while (x < w) {
    const bw = 60 + (i % 3) * 30;
    const bh = rngHeights[i % rngHeights.length];
    ctx.fillRect(x, h * 0.62 - bh, bw, bh + h * 0.38);
    // Windows.
    ctx.fillStyle = 'rgba(255,233,163,0.5)';
    for (let wy = h * 0.62 - bh + 12; wy < h * 0.62 - 10; wy += 22) {
      for (let wx = x + 10; wx < x + bw - 10; wx += 20) {
        if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 8, 10);
      }
    }
    ctx.fillStyle = '#4a3a4a';
    x += bw + 8;
    i++;
  }
  // Sea strip.
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let s = 0; s < 12; s++) {
    const y = h * 0.88 + s * 8;
    const off = Math.sin(time + s) * 10;
    ctx.beginPath();
    ctx.moveTo(off, y);
    ctx.lineTo(w * 0.3 + off, y);
    ctx.stroke();
  }
  // Palms in front.
  for (const px of [w * 0.08, w * 0.9]) {
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(px, h * 0.88);
    ctx.quadraticCurveTo(px + 8, h * 0.72, px + 20, h * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#2f6e35';
    ctx.lineWidth = 5;
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(px + 20, h * 0.6);
      ctx.quadraticCurveTo(px + 20 + Math.cos(a) * 30, h * 0.6 + Math.sin(a) * 30 - 14, px + 20 + Math.cos(a) * 52, h * 0.6 + Math.sin(a) * 52 + 8);
      ctx.stroke();
    }
  }
}

export function drawPauseScreen(G, ctx, w, h, menuIndex) {
  ctx.fillStyle = 'rgba(10,10,16,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Verdana';
  ctx.fillText('PAUSED', w / 2, h * 0.26);
  const items = ['Resume', 'Save Game', 'How to Play', 'Quit to Title'];
  items.forEach((label, i) => {
    const y = h * 0.4 + i * 46;
    ctx.font = 'bold 18px Verdana';
    if (i === menuIndex) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(`▸ ${label}`, w / 2, y);
    } else {
      ctx.fillStyle = '#cfd4d8';
      ctx.fillText(label, w / 2, y);
    }
  });
  // Stats block.
  ctx.font = '14px Verdana';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const s = G.stats;
  ctx.fillText(`Cash $${G.player.cash}  •  Missions ${G.story.completed.length}/5  •  Cars stolen ${s.carsStolen}  •  Cars wrecked ${s.carsDestroyed}  •  Takedowns ${s.kills}`, w / 2, h * 0.68);
  return items;
}

export function drawHelpScreen(ctx, w, h) {
  ctx.fillStyle = '#141821';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 34px Verdana';
  ctx.fillText('HOW TO PLAY', w / 2, 80);
  const lines = [
    ['WASD / Arrows', 'Move on foot, drive a car'],
    ['Mouse', 'Aim — click to shoot, hold for SMG'],
    ['E', 'Enter / exit a car, talk, advance dialogue'],
    ['Q', 'Switch weapon (Fists / Pistol / SMG)'],
    ['F', 'Punch'],
    ['Shift', 'Sprint on foot'],
    ['Space', 'Handbrake while driving'],
    ['Esc / P', 'Pause'],
    ['M', 'Mute sound'],
    ['', ''],
    ['Steal any car with E. Crimes raise your wanted level.', ''],
    ['Lose the cops by breaking line of sight until the stars fade.', ''],
    ['Visit Bea’s Garage (green B on the map) for story missions.', ''],
    ['Save at the safehouse marker or from the pause menu.', ''],
  ];
  ctx.font = '16px Verdana';
  lines.forEach(([key, desc], i) => {
    const y = 140 + i * 32;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7db8db';
    ctx.fillText(key, w / 2 - 20, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(desc, w / 2 - 10, y);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '14px Verdana';
  ctx.fillText('Press E or click to go back', w / 2, h - 40);
}

export function drawEndScreen(ctx, w, h, kind, stats) {
  ctx.fillStyle = kind === 'wasted' ? 'rgba(120,10,10,0.55)' : 'rgba(10,20,80,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px Verdana';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(kind === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h * 0.42);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h * 0.42);
  ctx.font = '16px Verdana';
  ctx.fillText(kind === 'wasted' ? 'Rosa wakes up at Marisol General, lighter in the pocket.' : 'The MBPD holds Rosa overnight. The fine stings.', w / 2, h * 0.42 + 36);
  ctx.font = 'bold 18px Verdana';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('Press E to continue', w / 2, h * 0.6);
  void stats;
}

export function drawStoryDoneScreen(ctx, w, h) {
  ctx.fillStyle = 'rgba(10,10,16,0.8)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 40px Verdana';
  ctx.fillText('MARISOL BAY IS FREE', w / 2, h * 0.32);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px Verdana';
  ctx.fillText('Kane is finished. The ledger is with the city. Tomas is safe.', w / 2, h * 0.32 + 40);
  ctx.fillText('Rosa keeps driving — the city is hers now.', w / 2, h * 0.32 + 68);
  ctx.font = 'bold 18px Verdana';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('Press E to keep playing in free roam', w / 2, h * 0.6);
}
