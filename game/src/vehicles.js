// Vehicles: arcade driving physics, damage and smoke, car-vs-car bumps, and
// the top-down drawing of each body style.

import { CAR_COLORS, VEHICLE_TYPES } from './config.js';
import { circleHitsBuilding, collideCircle } from './city.js';
import { addShake, addSkid, exhaustPuff, explosionBurst, sparkBurst, tireSmoke } from './effects.js';

let nextId = 1;

export function createVehicle(type, x, y, angle, color) {
  const def = VEHICLE_TYPES[type];
  return {
    id: nextId++,
    type,
    def,
    x, y,
    angle,
    vx: 0, vy: 0,
    speed: 0,
    steer: 0,
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    health: def.health,
    dead: false,
    burning: 0,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    brakeLights: false,
    honkTimer: 0,
    smokeTimer: 0,
    route: null,
    routeIndex: 0,
    cruiseSpeed: 0,
    stopped: 0,
  };
}

export function vehicleRadius(car) {
  return Math.max(car.def.w, car.def.h) * 0.5;
}

// Drive a car with throttle (-1..1) and steering (-1..1). dt is fixed 1/60.
export function driveVehicle(G, car, throttle, steerInput, handbrake, dt) {
  const def = car.def;
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;

  // Steering follows speed: no turning while parked, less at top speed.
  const steerAuthority = Math.min(1, Math.abs(forwardSpeed) / 60) * (1 - Math.min(0.45, Math.abs(forwardSpeed) / def.maxSpeed * 0.45));
  car.steer += (steerInput * steerAuthority - car.steer) * Math.min(1, 10 * dt);
  const turnRate = car.steer * def.turn * (forwardSpeed >= 0 ? 1 : -1);
  car.angle += turnRate * Math.min(1, Math.abs(forwardSpeed) / 90 + 0.25) * dt * (handbrake ? 1.5 : 1);

  // Throttle and drag.
  let accel = 0;
  if (throttle > 0) accel = def.accel * throttle;
  if (throttle < 0) {
    accel = forwardSpeed > 20 ? -def.accel * 1.6 : def.accel * 0.55 * throttle;
  }
  const drag = forwardSpeed * (handbrake ? 1.9 : 0.55);
  let newForward = forwardSpeed + (accel - drag) * dt;
  const maxF = throttle < 0 && forwardSpeed < 0 ? -def.reverse : def.maxSpeed;
  newForward = Math.max(-def.reverse, Math.min(maxF, newForward));

  // Lateral grip: kill sideways slide unless handbraking.
  const rightX = -forwardY;
  const rightY = forwardX;
  const lateral = car.vx * rightX + car.vy * rightY;
  const grip = handbrake ? 1.6 : def.grip;
  const newLateral = lateral * Math.max(0, 1 - grip * dt);

  car.vx = forwardX * newForward + rightX * newLateral;
  car.vy = forwardY * newForward + rightY * newLateral;
  car.speed = newForward;

  const oldX = car.x;
  const oldY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Building collision: slide along walls, take damage on hard hits.
  const radius = vehicleRadius(car) * 0.82;
  if (circleHitsBuilding(G.city, car.x, car.y, radius)) {
    const hitSpeed = Math.hypot(car.vx, car.vy);
    const fixed = collideCircle(G.city, car.x, car.y, radius);
    car.x = fixed.x;
    car.y = fixed.y;
    car.vx *= -0.25;
    car.vy *= -0.25;
    car.speed *= -0.25;
    if (hitSpeed > 130) {
      damageVehicle(G, car, (hitSpeed - 130) * 0.06, null);
      sparkBurst(G.effects, car.x, car.y);
      G.audio.crash(Math.min(0.5, hitSpeed / 700));
      if (car.driver === 'player') addShake(G.effects, Math.min(10, hitSpeed / 40));
    }
  }

  // Skid marks and tire smoke when sliding hard.
  const sliding = Math.abs(newLateral) > 70 && Math.abs(newForward) > 90;
  if (sliding || handbrake) {
    const backX = car.x - forwardX * def.w * 0.32;
    const backY = car.y - forwardY * def.w * 0.32;
    const px = rightX * def.h * 0.42;
    const py = rightY * def.h * 0.42;
    if (Math.hypot(car.x - oldX, car.y - oldY) > 2) {
      addSkid(G.effects, oldX + px, oldY + py, backX + px, backY + py);
      addSkid(G.effects, oldX - px, oldY - py, backX - px, backY - py);
      if (Math.random() < 0.5) tireSmoke(G.effects, backX + px, backY + py);
    }
  }

  // Exhaust puffs and damage smoke.
  car.smokeTimer -= dt;
  if (car.smokeTimer <= 0) {
    car.smokeTimer = 0.12;
    if (Math.abs(newForward) > 40) {
      exhaustPuff(G.effects, car.x - forwardX * def.w * 0.52, car.y - forwardY * def.w * 0.52, car.angle);
    }
    if (car.health < car.def.health * 0.4 && !car.dead) {
      tireSmoke(G.effects, car.x + forwardX * def.w * 0.3, car.y + forwardY * def.w * 0.3);
    }
  }

  car.brakeLights = throttle < 0 && forwardSpeed > 20;
}

export function damageVehicle(G, car, amount, attacker) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.burning = 2.2;
    G.audio.explosion();
    explosionBurst(G.effects, car.x, car.y);
    addShake(G.effects, 12);
    if (car.driver === 'player') {
      G.player.health -= 25;
    }
    if (attacker === 'player') G.stats.carsDestroyed++;
  }
}

// Soft circle bumps between cars so traffic never overlaps.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = (vehicleRadius(a) + vehicleRadius(b)) * 0.72;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < -40) {
          const impulse = -rel * 0.4;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
        }
      }
    }
  }
}

export function drawCar(ctx, car, time) {
  const def = car.def;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(3, 4, def.w * 0.54, def.h * 0.58, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);

  const w = def.w;
  const h = def.h;
  const damage = 1 - car.health / def.health;

  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Darker lower trim.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, -w / 2, h / 2 - 5, w, 5, 3);
  ctx.fill();
  // Hood and trunk lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.18, -h / 2 + 2);
  ctx.lineTo(w * 0.18, h / 2 - 2);
  ctx.moveTo(-w * 0.22, -h / 2 + 2);
  ctx.lineTo(-w * 0.22, h / 2 - 2);
  ctx.stroke();
  // Windshield and rear window.
  ctx.fillStyle = '#bfe3ee';
  roundRect(ctx, w * 0.02, -h / 2 + 3, w * 0.16, h - 6, 3);
  ctx.fill();
  ctx.fillStyle = '#9fc6d4';
  roundRect(ctx, -w * 0.2, -h / 2 + 3, w * 0.12, h - 6, 3);
  ctx.fill();
  // Roof.
  ctx.fillStyle = shade(car.color, -18);
  roundRect(ctx, -w * 0.08, -h / 2 + 4, w * 0.1, h - 8, 2);
  ctx.fill();

  if (car.type === 'cruiser') {
    // Police livery: white doors, light bar.
    ctx.fillStyle = '#eef1f4';
    roundRect(ctx, -w * 0.1, -h / 2 + 2, w * 0.24, h - 4, 3);
    ctx.fill();
    ctx.fillStyle = '#1d2b4f';
    ctx.fillRect(-w * 0.06, -h / 2 + 4, w * 0.16, 3);
    ctx.fillRect(-w * 0.06, h / 2 - 7, w * 0.16, 3);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-2, -h / 2 - 1, 5, 4);
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-2, h / 2 - 3, 5, 4);
  }
  if (car.type === 'cab') {
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(-w * 0.08, -4, w * 0.14, 8);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 7px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', w * 0.0, 3);
  }
  if (car.type === 'bison') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, -w / 2 + 3, -h / 2 + 3, w * 0.3, h - 6, 2);
    ctx.fill();
  }

  // Headlights and tail lights.
  ctx.fillStyle = '#fff8d6';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 4);
  ctx.fillRect(w / 2 - 2, h / 2 - 6, 3, 4);
  ctx.fillStyle = car.brakeLights ? '#ff2d20' : '#a33';
  ctx.fillRect(-w / 2 - 1, -h / 2 + 2, 3, 4);
  ctx.fillRect(-w / 2 - 1, h / 2 - 6, 3, 4);

  // Wheels.
  ctx.fillStyle = '#1c1e22';
  const wy = h / 2 - 1;
  const wx = w * 0.3;
  ctx.save();
  ctx.translate(wx, -wy);
  ctx.rotate(car.steer * 0.5);
  ctx.fillRect(-4, -2, 8, 4);
  ctx.restore();
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(car.steer * 0.5);
  ctx.fillRect(-4, -2, 8, 4);
  ctx.restore();
  ctx.fillRect(-wx - 4, -wy - 2, 8, 4);
  ctx.fillRect(-wx - 4, wy - 2, 8, 4);

  // Damage: dents and cracked look.
  if (damage > 0.25) {
    ctx.fillStyle = `rgba(20,20,20,${Math.min(0.4, damage * 0.5)})`;
    ctx.beginPath();
    ctx.arc(w * 0.3, 0, 6 + damage * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.dead) {
    ctx.fillStyle = 'rgba(15,15,15,0.55)';
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}
