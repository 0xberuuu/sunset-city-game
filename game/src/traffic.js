// Ambient life: traffic cars that follow the road grid, and pedestrians who
// stroll the sidewalks and flee when trouble starts.

import { AVENUES, ROAD_WIDTH, STREETS } from './config.js';
import { collideCircle, nearestRoadPoint, pointOnRoad, randomRoadPoint, routeAlongRoads } from './city.js';
import { createVehicle, driveVehicle, vehicleRadius } from './vehicles.js';
import { chance, pick, range } from './random.js';

const PED_SHIRTS = ['#e05a4e', '#3f6fb5', '#e0b13e', '#4f9e6b', '#8a5fa8', '#d97b2f', '#5fb3b3', '#e8e4da', '#c96a8a'];
const PED_SKINS = ['#f2c89b', '#d9a06b', '#a06a3b', '#7a4a26', '#e8b58a'];

export function spawnTrafficCar(G, rng, nearPlayer) {
  const types = ['dart', 'dart', 'marlin', 'bison', 'tortuga', 'cab'];
  const type = pick(rng, types);
  let spot;
  if (nearPlayer) {
    // Spawn on a road just off-screen from the player.
    for (let tries = 0; tries < 20; tries++) {
      const angle = rng() * Math.PI * 2;
      const dist = range(rng, 620, 900);
      const x = G.player.x + Math.cos(angle) * dist;
      const y = G.player.y + Math.sin(angle) * dist;
      const p = nearestRoadPoint(x, y);
      if (Math.hypot(p.x - G.player.x, p.y - G.player.y) > 520) {
        spot = p;
        break;
      }
    }
  }
  if (!spot) spot = randomRoadPoint(rng);
  const onAvenue = AVENUES.includes(spot.x);
  const angle = onAvenue ? (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(rng, 0.5) ? 0 : Math.PI);
  const car = createVehicle(type, spot.x, spot.y, angle);
  car.driver = 'traffic';
  car.cruiseSpeed = range(rng, 85, 125);
  car.route = routeAlongRoads(spot, randomRoadPoint(rng), rng);
  car.routeIndex = 0;
  G.cars.push(car);
  return car;
}

export function updateTraffic(G, dt, rng) {
  // Keep the streets busy near the player.
  const trafficCount = G.cars.filter((c) => c.driver === 'traffic').length;
  if (trafficCount < 10 && Math.random() < dt * 1.5) spawnTrafficCar(G, rng, true);

  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.driver !== 'traffic') continue;
    if (car.dead) {
      car.burning -= dt;
      if (car.burning <= 0) G.cars.splice(i, 1);
      continue;
    }
    // Despawn far-away traffic.
    if (Math.hypot(car.x - G.player.x, car.y - G.player.y) > 1300) {
      G.cars.splice(i, 1);
      continue;
    }
    updateTrafficCar(G, car, dt, rng);
  }
}

function updateTrafficCar(G, car, dt, rng) {
  if (!car.route || car.routeIndex >= car.route.length) {
    car.route = routeAlongRoads(car, randomRoadPoint(rng), rng);
    car.routeIndex = 0;
  }
  const target = car.route[car.routeIndex];
  // Right-hand lane offset.
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.routeIndex++;
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));

  // Slow for the car ahead.
  let throttle = 1;
  const ahead = carAhead(G, car);
  if (ahead !== null) {
    throttle = ahead < 70 ? 0 : 0.45;
    if (ahead < 46) {
      car.honkTimer -= dt;
      if (car.honkTimer <= 0) {
        car.honkTimer = 3;
        if (Math.hypot(car.x - G.player.x, car.y - G.player.y) < 500) G.audio.horn();
      }
    }
  }
  // Ease into the cruise speed.
  const speed = Math.hypot(car.vx, car.vy);
  if (speed > car.cruiseSpeed) throttle = Math.min(throttle, 0.15);
  driveVehicle(G, car, throttle, steer, false, dt);
}

function carAhead(G, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > 120) continue;
    const side = Math.abs(dx * -fy + dy * fx);
    if (side > 26) continue;
    if (best === null || along < best) best = along;
  }
  return best;
}

// --- Pedestrians -----------------------------------------------------------

export function spawnPedestrian(G, rng, x, y) {
  const ped = {
    x: x ?? 0,
    y: y ?? 0,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 34, 55),
    shirt: pick(rng, PED_SHIRTS),
    skin: pick(rng, PED_SKINS),
    walkPhase: rng() * Math.PI * 2,
    target: null,
    flee: 0,
    fleeFrom: null,
    idle: range(rng, 0, 4),
    dead: false,
  };
  if (x === undefined) {
    const spot = randomSidewalkSpot(G, rng);
    ped.x = spot.x;
    ped.y = spot.y;
  }
  G.peds.push(ped);
  return ped;
}

function randomSidewalkSpot(G, rng) {
  for (let tries = 0; tries < 30; tries++) {
    const angle = rng() * Math.PI * 2;
    const dist = range(rng, 120, 900);
    const x = G.player.x + Math.cos(angle) * dist;
    const y = G.player.y + Math.sin(angle) * dist;
    if (x < 40 || y < 40 || x > 3560 || y > 2480) continue;
    if (pointOnRoad(x, y)) continue;
    return { x, y };
  }
  return { x: G.player.x + 120, y: G.player.y + 120 };
}

export function updatePedestrians(G, dt, rng) {
  if (G.peds.length < 26 && Math.random() < dt * 2) spawnPedestrian(G, rng);

  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (ped.dead) {
      G.peds.splice(i, 1);
      continue;
    }
    const distToPlayer = Math.hypot(ped.x - G.player.x, ped.y - G.player.y);
    if (distToPlayer > 1200) {
      G.peds.splice(i, 1);
      continue;
    }

    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
      ped.angle = away;
      stepPed(G, ped, ped.speed * 3.1, dt);
      continue;
    }

    if (ped.idle > 0) {
      ped.idle -= dt;
      continue;
    }
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 18) {
      if (chance(rng, 0.25)) {
        ped.idle = range(rng, 1, 5);
        continue;
      }
      ped.target = randomSidewalkSpot(G, rng);
    }
    const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = turnToward(ped.angle, want, 5 * dt);
    stepPed(G, ped, ped.speed, dt);
  }
}

function stepPed(G, ped, speed, dt) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const fixed = collideCircle(G.city, nx, ny, 11);
  ped.x = fixed.x;
  ped.y = fixed.y;
  ped.walkPhase += dt * (speed / 22);
}

export function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return angle + Math.sign(diff) * maxStep;
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.flee = 3 + Math.random() * 2;
      ped.fleeFrom = { x, y };
      ped.target = null;
    }
  }
}

export function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  const bob = Math.sin(ped.walkPhase) * 1.2;
  // Legs.
  ctx.fillStyle = '#2c2f36';
  ctx.fillRect(-4, -6 + bob, 7, 4);
  ctx.fillRect(-4, 2 - bob, 7, 4);
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Arms swing.
  ctx.fillStyle = ped.shirt;
  ctx.fillRect(0, -9 + bob * 0.5, 5, 3);
  ctx.fillRect(0, 6 - bob * 0.5, 5, 3);
  ctx.restore();
}
