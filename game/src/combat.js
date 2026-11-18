// Combat: bullets, enemy gunmen with simple seek-and-shoot AI, melee, and
// the health/ammo pickups scattered around the city.

import { WEAPONS } from './config.js';
import { circleHitsBuilding, collideCircle } from './city.js';
import { addFloat, addShake, bloodPuff, muzzleFlash, sparkBurst } from './effects.js';
import { addHeat } from './police.js';
import { scarePeds, turnToward } from './traffic.js';
import { damageVehicle } from './vehicles.js';

export function createEnemy(x, y, opts = {}) {
  return {
    x, y,
    angle: opts.angle || 0,
    health: opts.health || 60,
    maxHealth: opts.health || 60,
    speed: opts.speed || 105,
    weapon: opts.weapon || 'pistol',
    cooldown: 0.5 + Math.random() * 0.8,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 1 + Math.random() * 2,
    walkPhase: Math.random() * 6,
    shirt: opts.shirt || '#7a3b3b',
    skin: '#d9a06b',
    boss: !!opts.boss,
    dead: false,
    missionId: opts.missionId || null,
  };
}

export function fireWeapon(G, shooter, angle, weaponKey, isPlayer) {
  const weapon = WEAPONS[weaponKey];
  if (weapon.melee) {
    G.audio.punch();
    const reach = weapon.range;
    const hx = shooter.x + Math.cos(angle) * reach;
    const hy = shooter.y + Math.sin(angle) * reach;
    if (isPlayer) {
      for (const e of G.enemies) {
        if (!e.dead && Math.hypot(e.x - hx, e.y - hy) < 30) damageEnemy(G, e, weapon.damage, true);
      }
      for (const off of G.officers) {
        if (Math.hypot(off.x - hx, off.y - hy) < 30) {
          off.health -= weapon.damage;
          if (off.health <= 0) addHeat(G, 40, 'OFFICER DOWN');
        }
      }
    } else if (Math.hypot(G.player.x - hx, G.player.y - hy) < 30) {
      damagePlayer(G, weapon.damage);
    }
    return;
  }
  const spread = (Math.random() - 0.5) * 2 * weapon.spread;
  const a = angle + spread;
  G.bullets.push({
    x: shooter.x + Math.cos(a) * 20,
    y: shooter.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 900,
    vy: Math.sin(a) * 900,
    damage: weapon.damage,
    fromPlayer: isPlayer,
    life: weapon.range / 900,
  });
  muzzleFlash(G.effects, shooter.x, shooter.y, a);
  G.audio.shoot(weaponKey === 'smg');
  if (isPlayer) {
    scarePeds(G, shooter.x, shooter.y, 320);
    if (G.wanted.stars > 0 || Math.random() < 0.6) addHeat(G, 6, null);
  }
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let hit = false;
    if (b.life <= 0) hit = true;
    if (!hit && circleHitsBuilding(G.city, b.x, b.y, 3)) {
      sparkBurst(G.effects, b.x, b.y);
      hit = true;
    }
    if (!hit && b.fromPlayer) {
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 14) {
          damageEnemy(G, e, b.damage, true);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const off of G.officers) {
          if (Math.hypot(off.x - b.x, off.y - b.y) < 14) {
            off.health -= b.damage;
            bloodPuff(G.effects, b.x, b.y);
            if (off.health <= 0) addHeat(G, 40, 'OFFICER DOWN');
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const car of G.cars) {
          if (car.dead) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 22) {
            damageVehicle(G, car, b.damage * 0.6, 'player');
            sparkBurst(G.effects, b.x, b.y);
            hit = true;
            break;
          }
        }
      }
    }
    if (!hit && !b.fromPlayer) {
      const p = G.player;
      const target = p.car || p;
      const radius = p.car ? 24 : 13;
      if (Math.hypot(target.x - b.x, target.y - b.y) < radius) {
        if (p.car) {
          damageVehicle(G, p.car, b.damage * 0.5, null);
        } else {
          damagePlayer(G, b.damage);
        }
        hit = true;
      }
      // Enemy bullets can hit the mission companion too.
      if (!hit && G.companion && !G.companion.dead) {
        if (Math.hypot(G.companion.x - b.x, G.companion.y - b.y) < 13) {
          G.companion.health -= b.damage;
          bloodPuff(G.effects, b.x, b.y);
          if (G.companion.health <= 0) G.companion.dead = true;
          hit = true;
        }
      }
    }
    if (hit) G.bullets.splice(i, 1);
  }
}

export function damageEnemy(G, enemy, amount, byPlayer) {
  if (enemy.dead) return;
  enemy.health -= amount;
  bloodPuff(G.effects, enemy.x, enemy.y);
  if (enemy.health <= 0) {
    enemy.dead = true;
    if (byPlayer) {
      G.stats.kills++;
      G.player.cash += enemy.boss ? 150 : 25;
      addFloat(G.effects, enemy.x, enemy.y - 20, enemy.boss ? '+$150' : '+$25', '#7ddb8a');
    }
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invulnerable > 0 || p.dead) return;
  p.health -= amount;
  p.lastDamageAt = G.time;
  p.invulnerable = 0.15;
  bloodPuff(G.effects, p.x, p.y);
  addShake(G.effects, 4);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.events.push({ type: 'wasted' });
  }
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    e.angle = turnToward(e.angle, want, 7 * dt);
    e.cooldown -= dt;
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = 1 + Math.random() * 2;
      e.strafeDir *= -1;
    }
    // Keep a shooting distance; strafe sideways while engaging.
    let moveX = 0;
    let moveY = 0;
    if (dist > 300) {
      moveX = Math.cos(e.angle);
      moveY = Math.sin(e.angle);
    } else if (dist < 170) {
      moveX = -Math.cos(e.angle) * 0.7;
      moveY = -Math.sin(e.angle) * 0.7;
    } else {
      moveX = Math.cos(e.angle + Math.PI / 2) * e.strafeDir * 0.6;
      moveY = Math.sin(e.angle + Math.PI / 2) * e.strafeDir * 0.6;
    }
    const fixed = collideCircle(G.city, e.x + moveX * e.speed * dt, e.y + moveY * e.speed * dt, 12);
    e.x = fixed.x;
    e.y = fixed.y;
    e.walkPhase += dt * 8;

    if (e.cooldown <= 0 && dist < 420 && hasLineOfSight(G, e.x, e.y, p.x, p.y)) {
      e.cooldown = e.boss ? 0.5 : 0.9 + Math.random() * 0.7;
      const aim = Math.atan2(dy, dx) + (Math.random() - 0.5) * (e.boss ? 0.08 : 0.22);
      fireWeapon(G, e, aim, e.weapon, false);
    }
  }
  G.enemies = G.enemies.filter((e) => !e.dead || G.time - (e.deathAt || 0) < 0.01);
}

export function hasLineOfSight(G, x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 26);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (circleHitsBuilding(G.city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 4)) return false;
  }
  return true;
}

export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(e.angle);
  const bob = Math.sin(e.walkPhase) * 1.1;
  ctx.fillStyle = '#2c2f36';
  ctx.fillRect(-4, -6 + bob, 7, 4);
  ctx.fillRect(-4, 2 - bob, 7, 4);
  ctx.fillStyle = e.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, e.boss ? 10 : 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.skin;
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun.
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -2, 9, 3);
  ctx.restore();
  // Health bar.
  if (e.health < e.maxHealth) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 14, e.y - 22, 28, 5);
    ctx.fillStyle = '#e05a4e';
    ctx.fillRect(e.x - 13, e.y - 21, 26 * Math.max(0, e.health / e.maxHealth), 3);
  }
  if (e.boss) {
    ctx.font = 'bold 11px Verdana';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('KANE', e.x, e.y - 28);
  }
}

export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.strokeStyle = '#fff3c4';
  ctx.lineWidth = 2;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Pickups ----------------------------------------------------------------

export function createPickup(kind, x, y) {
  return { kind, x, y, taken: false, bob: Math.random() * 6 };
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.bob += dt * 3;
    const target = p.car || p;
    if (Math.hypot(pk.x - target.x, pk.y - target.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + 50);
        addFloat(G.effects, pk.x, pk.y - 16, '+50 HEALTH', '#7ddb8a');
      } else if (pk.kind === 'ammo') {
        p.ammo.pistol += 24;
        p.ammo.smg += 60;
        addFloat(G.effects, pk.x, pk.y - 16, '+AMMO', '#ffd76a');
      } else if (pk.kind === 'cash') {
        p.cash += 50;
        addFloat(G.effects, pk.x, pk.y - 16, '+$50', '#7ddb8a');
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, (p.armor || 0) + 50);
        addFloat(G.effects, pk.x, pk.y - 16, '+ARMOR', '#7db8db');
      } else if (pk.kind === 'package') {
        addFloat(G.effects, pk.x, pk.y - 16, 'LEDGER TAKEN', '#ffd76a');
      }
      G.audio.pickup();
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken);
}

export function drawPickup(ctx, pk, time) {
  const y = pk.y + Math.sin(pk.bob) * 3;
  ctx.save();
  ctx.translate(pk.x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (pk.kind === 'health') {
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#d63a2f';
    ctx.fillRect(-3, -7, 6, 14);
    ctx.fillRect(-7, -3, 14, 6);
  } else if (pk.kind === 'ammo') {
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(-9, -7, 18, 14);
    ctx.fillStyle = '#e8c93d';
    ctx.fillRect(-6, -4, 3, 8);
    ctx.fillRect(-1, -4, 3, 8);
    ctx.fillRect(4, -4, 3, 8);
  } else if (pk.kind === 'cash') {
    ctx.fillStyle = '#4f9e6b';
    ctx.fillRect(-10, -6, 20, 12);
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 10px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
  } else if (pk.kind === 'package') {
    ctx.fillStyle = '#6a4a2c';
    ctx.fillRect(-11, -7, 22, 14);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-11, -7, 22, 5);
    ctx.fillStyle = '#e8c93d';
    ctx.fillRect(-2, -3, 4, 4);
  } else {
    ctx.fillStyle = '#3f6fb5';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 10px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('A', 0, 4);
  }
  ctx.restore();
}
