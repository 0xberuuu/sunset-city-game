// Rosa Vega: on-foot movement and aiming, stealing and driving cars, weapon
// handling, health, and the top-down drawing of the player.

import { PLAYER, WEAPONS } from './config.js';
import { collideCircle } from './city.js';
import { damageVehicle, driveVehicle } from './vehicles.js';
import { fireWeapon } from './combat.js';
import { addHeat } from './police.js';
import { scarePeds } from './traffic.js';
import { addFloat, bloodPuff } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    aimAngle: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: 120,
    car: null,
    weapon: 'pistol',
    unlocked: { fists: true, pistol: true, smg: false },
    ammo: { pistol: WEAPONS.pistol.ammo, smg: 0 },
    fireCooldown: 0,
    invulnerable: 0,
    lastDamageAt: -99,
    dead: false,
    walkPhase: 0,
    moving: false,
    sprinting: false,
  };
}

export function nearestEnterableCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // Carjacking: the driver bails and runs.
    scarePeds(G, car.x, car.y, 60);
    addHeat(G, 12, 'CAR STOLEN');
    G.stats.carsStolen++;
    G.audio.horn();
  }
  if (car.driver === 'police') {
    addHeat(G, 30, 'POLICE CAR STOLEN');
    G.stats.carsStolen++;
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  G.audio.door();
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  const fixed = collideCircle(G.city, p.x, p.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.car = null;
  G.audio.door();
}

export function updatePlayer(G, dt, input, mouseWorld) {
  const p = G.player;
  if (p.dead) return;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  // Slow health recovery after a few calm seconds.
  if (G.time - p.lastDamageAt > 6 && p.health < PLAYER.maxHealth) {
    p.health = Math.min(PLAYER.maxHealth, p.health + 4 * dt);
  }

  if (p.car) {
    updateDriving(G, dt, input);
    return;
  }

  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y);
  p.sprinting = input.isHeld('sprint') && len > 0;
  const speed = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = len > 0;
  if (len > 0) {
    const nx = axis.x / len;
    const ny = axis.y / len;
    p.vx = nx * speed;
    p.vy = ny * speed;
    p.walkPhase += dt * (p.sprinting ? 13 : 9);
  } else {
    p.vx = 0;
    p.vy = 0;
  }
  const fixed = collideCircle(G.city, p.x + p.vx * dt, p.y + p.vy * dt, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;

  // Aim at the mouse; the body follows the aim while shooting.
  p.aimAngle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  if (input.mouse.down || len === 0) {
    p.angle = p.aimAngle;
  } else {
    p.angle = Math.atan2(p.vy, p.vx);
  }

  // Enter a car.
  if (input.wasPressed('interact')) {
    const car = nearestEnterableCar(G, PLAYER.enterRange + 14);
    if (car) enterCar(G, car);
  }

  // Fire the current weapon.
  const weapon = WEAPONS[p.weapon];
  const wantFire = weapon.auto ? input.mouse.down : input.mouse.clicked;
  if (wantFire && p.fireCooldown <= 0) {
    if (p.weapon === 'fists' || p.ammo[p.weapon] > 0) {
      if (p.weapon !== 'fists') p.ammo[p.weapon]--;
      p.fireCooldown = weapon.rate;
      fireWeapon(G, p, p.aimAngle, p.weapon, true);
    } else {
      p.fireCooldown = 0.3;
      G.audio.click();
      addFloat(G.effects, p.x, p.y - 26, 'NO AMMO', '#ff8a7a');
    }
  }

  // Punch with F even while holding a gun.
  if (input.wasPressed('punch') && p.fireCooldown <= 0) {
    p.fireCooldown = WEAPONS.fists.rate;
    fireWeapon(G, p, p.aimAngle, 'fists', true);
  }

  // Cycle weapons with Q.
  if (input.wasPressed('weapon')) {
    const order = ['fists', 'pistol', 'smg'];
    const current = order.indexOf(p.weapon);
    for (let i = 1; i <= order.length; i++) {
      const next = order[(current + i) % order.length];
      if (p.unlocked[next]) {
        p.weapon = next;
        G.audio.click();
        break;
      }
    }
  }
}

function updateDriving(G, dt, input) {
  const p = G.player;
  const car = p.car;
  if (car.dead) {
    // The car blew up under Rosa: she climbs out, hurt.
    exitCar(G);
    p.health = Math.max(1, p.health - 10);
    return;
  }
  const axis = input.axis();
  const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0;
  const steer = axis.x;
  const handbrake = input.isHeld('brake');
  driveVehicle(G, car, throttle, steer, handbrake, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.aimAngle = car.angle;

  // Running over a pedestrian is a crime the city notices.
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      addHeat(G, 18, 'PEDESTRIAN HIT');
      scarePeds(G, car.x, car.y, 260);
      bloodPuff(G.effects, ped.x, ped.y);
      G.audio.crash(0.3);
    }
  }

  if (input.wasPressed('interact')) exitCar(G);
  if (input.wasPressed('weapon')) {
    G.audio.horn();
  }
}

export function drawPlayer(ctx, p, time) {
  if (p.car) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  const bob = p.moving ? Math.sin(p.walkPhase) * 1.4 : 0;
  // Legs.
  ctx.fillStyle = '#2b3a55';
  ctx.fillRect(-4, -6 + bob, 8, 4);
  ctx.fillRect(-4, 2 - bob, 8, 4);
  // Jacket: Rosa's teal jacket.
  ctx.fillStyle = '#2f8f83';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#26756b';
  ctx.fillRect(-6, -3, 12, 6);
  // Head with dark hair.
  ctx.fillStyle = '#3a2a1e';
  ctx.beginPath();
  ctx.arc(3, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b58a';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Weapon in hand.
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222';
    ctx.fillRect(7, -2, p.weapon === 'smg' ? 12 : 9, 3);
  }
  ctx.restore();
  // Aim line, subtle.
  if (!p.car) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 60, p.y + Math.sin(p.aimAngle) * 60);
    ctx.stroke();
    ctx.restore();
  }
}
