// Particles, skid marks, floating pickup text and screen shake — the juice
// that makes driving and combat feel alive.

export function createEffects() {
  return {
    particles: [],
    skids: [],
    floats: [],
    shake: 0,
    shakeX: 0,
    shakeY: 0,
  };
}

export function spawnParticles(effects, x, y, { count, color, speed, life, size, gravity, spread }) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.9);
    effects.particles.push({
      x, y,
      vx: Math.cos(a) * s + (spread ? spread.x : 0),
      vy: Math.sin(a) * s + (spread ? spread.y : 0),
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color: Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color,
      gravity: gravity || 0,
    });
  }
  if (effects.particles.length > 900) {
    effects.particles.splice(0, effects.particles.length - 900);
  }
}

export function exhaustPuff(effects, x, y, angle) {
  effects.particles.push({
    x, y,
    vx: -Math.cos(angle) * 30 + (Math.random() - 0.5) * 16,
    vy: -Math.sin(angle) * 30 + (Math.random() - 0.5) * 16,
    life: 0.5, maxLife: 0.5, size: 5, color: '#cfd4d8', gravity: -12,
  });
}

export function tireSmoke(effects, x, y) {
  effects.particles.push({
    x, y,
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30 - 8,
    life: 0.7, maxLife: 0.7, size: 7, color: '#e8e8e8', gravity: -6,
  });
}

export function bloodPuff(effects, x, y) {
  spawnParticles(effects, x, y, { count: 8, color: '#b03028', speed: 90, life: 0.45, size: 4, gravity: 60 });
}

export function sparkBurst(effects, x, y) {
  spawnParticles(effects, x, y, { count: 10, color: ['#ffd76a', '#fff3c4', '#ff9a3d'], speed: 160, life: 0.35, size: 3, gravity: 140 });
}

export function explosionBurst(effects, x, y) {
  spawnParticles(effects, x, y, { count: 40, color: ['#ff7a2f', '#ffb03d', '#ff4a2f', '#5a5a5a'], speed: 240, life: 0.9, size: 9, gravity: -30 });
  spawnParticles(effects, x, y, { count: 20, color: '#3a3a3a', speed: 90, life: 1.6, size: 12, gravity: -40 });
}

export function muzzleFlash(effects, x, y, angle) {
  effects.particles.push({
    x: x + Math.cos(angle) * 16, y: y + Math.sin(angle) * 16,
    vx: 0, vy: 0, life: 0.06, maxLife: 0.06, size: 9, color: '#ffe9a3', gravity: 0, flash: true,
  });
}

export function addSkid(effects, x1, y1, x2, y2) {
  effects.skids.push({ x1, y1, x2, y2, life: 9 });
  if (effects.skids.length > 500) effects.skids.splice(0, effects.skids.length - 500);
}

export function addFloat(effects, x, y, text, color) {
  effects.floats.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
}

export function addShake(effects, amount) {
  effects.shake = Math.min(18, effects.shake + amount);
}

export function updateEffects(effects, dt) {
  for (let i = effects.particles.length - 1; i >= 0; i--) {
    const p = effects.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      effects.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
  }
  for (let i = effects.skids.length - 1; i >= 0; i--) {
    effects.skids[i].life -= dt;
    if (effects.skids[i].life <= 0) effects.skids.splice(i, 1);
  }
  for (let i = effects.floats.length - 1; i >= 0; i--) {
    const f = effects.floats[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) effects.floats.splice(i, 1);
  }
  if (effects.shake > 0) {
    effects.shake = Math.max(0, effects.shake - 42 * dt);
    effects.shakeX = (Math.random() - 0.5) * effects.shake;
    effects.shakeY = (Math.random() - 0.5) * effects.shake;
  } else {
    effects.shakeX = 0;
    effects.shakeY = 0;
  }
}

export function drawSkids(ctx, effects, camera) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of effects.skids) {
    if (s.x1 < camera.x - 40 || s.x1 > camera.x + camera.w + 40) continue;
    if (s.y1 < camera.y - 40 || s.y1 > camera.y + camera.h + 40) continue;
    ctx.strokeStyle = `rgba(20, 20, 24, ${Math.min(0.55, s.life * 0.09)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles(ctx, effects, camera) {
  ctx.save();
  for (const p of effects.particles) {
    if (p.x < camera.x - 30 || p.x > camera.x + camera.w + 30) continue;
    if (p.y < camera.y - 30 || p.y > camera.y + camera.h + 30) continue;
    const t = p.life / p.maxLife;
    ctx.globalAlpha = p.flash ? 1 : Math.min(1, t * 1.6);
    ctx.fillStyle = p.color;
    const s = p.flash ? p.size * (0.6 + t) : p.size * (0.5 + t * 0.7);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFloats(ctx, effects) {
  ctx.save();
  ctx.font = 'bold 15px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (const f of effects.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
