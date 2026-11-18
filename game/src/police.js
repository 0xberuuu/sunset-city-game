// The wanted system: heat from crimes, stars, pursuing police cruisers and
// foot officers, evasion, busted and the clean-up when heat fades.

import { WANTED } from './config.js';
import { nearestRoadPoint } from './city.js';
import { createVehicle, damageVehicle, driveVehicle } from './vehicles.js';
import { turnToward } from './traffic.js';
import { addFloat, addShake } from './effects.js';

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    unseenTimer: 0,
    evading: false,
    bustedTimer: 0,
    lastCrimeAt: 0,
  };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.stars.length; i++) {
    if (heat >= WANTED.stars[i]) stars = i;
  }
  return stars;
}

export function addHeat(G, amount, label) {
  const wanted = G.wanted;
  const before = wanted.stars;
  wanted.heat = Math.min(300, wanted.heat + amount);
  wanted.stars = starsForHeat(wanted.heat);
  wanted.unseenTimer = 0;
  wanted.evading = false;
  if (wanted.stars > before && label) {
    addFloat(G.effects, G.player.x, G.player.y - 30, label, '#ffd76a');
    G.audio.horn();
  }
}

export function updateWanted(G, dt, rng) {
  const wanted = G.wanted;
  if (wanted.stars === 0) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decayRate * dt);
    return;
  }

  // Can any cop see the player?
  const seen = policeCanSee(G);
  if (seen) {
    wanted.unseenTimer = 0;
    wanted.evading = false;
  } else {
    wanted.unseenTimer += dt;
    if (wanted.unseenTimer > WANTED.decayDelay) {
      wanted.evading = true;
      wanted.heat -= WANTED.decayRate * dt;
      const newStars = starsForHeat(wanted.heat);
      if (newStars < wanted.stars) {
        wanted.stars = newStars;
        if (wanted.stars === 0) {
          wanted.heat = 0;
          clearPolice(G);
          addFloat(G.effects, G.player.x, G.player.y - 30, 'YOU LOST THE COPS', '#7ddb8a');
        }
      }
    }
  }

  // Spawn cruisers up to the star budget.
  const cops = G.cars.filter((c) => c.driver === 'police' && !c.dead);
  const budget = WANTED.maxCops[wanted.stars];
  if (cops.length < budget && Math.random() < dt * 0.9) {
    spawnCruiser(G, rng);
  }

  // Foot officers when the player is on foot and wanted.
  if (!G.player.car && wanted.stars >= 1 && G.officers.length < Math.min(3, wanted.stars + 1)) {
    if (Math.random() < dt * 0.7) spawnOfficer(G, rng);
  }

  for (const car of cops) updateCruiser(G, car, dt);
  updateOfficers(G, dt);
}

function policeCanSee(G) {
  const px = G.player.x;
  const py = G.player.y;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    if (Math.hypot(car.x - px, car.y - py) < 520) return true;
  }
  for (const off of G.officers) {
    if (Math.hypot(off.x - px, off.y - py) < 380) return true;
  }
  return false;
}

export function spawnCruiser(G, rng) {
  const angle = rng() * Math.PI * 2;
  const dist = 700 + rng() * 300;
  const spot = nearestRoadPoint(
    G.player.x + Math.cos(angle) * dist,
    G.player.y + Math.sin(angle) * dist,
  );
  const car = createVehicle('cruiser', spot.x, spot.y, Math.atan2(G.player.y - spot.y, G.player.x - spot.x), '#1d2b4f');
  car.driver = 'police';
  car.cruiseSpeed = 400;
  G.cars.push(car);
  return car;
}

function updateCruiser(G, car, dt) {
  const player = G.player;
  const target = player.car || player;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  // Predict where the player is heading.
  const lead = Math.min(0.8, dist / 500);
  const tx = target.x + (target.vx || 0) * lead;
  const ty = target.y + (target.vy || 0) * lead;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.6));

  // Ram speed: full throttle, ease off only when very close and alongside.
  let throttle = 1;
  if (dist < 60) throttle = 0.5;
  if (dist > 900) throttle = 1;
  driveVehicle(G, car, throttle, steer, false, dt);

  // Ramming the player's car damages both and shakes the screen.
  if (player.car && dist < 44) {
    const relSpeed = Math.hypot(car.vx - player.car.vx, car.vy - player.car.vy);
    if (relSpeed > 90 && car.ramCooldown <= 0) {
      car.ramCooldown = 1;
      damageVehicle(G, player.car, 8, 'police');
      damageVehicle(G, car, 4, null);
      G.audio.crash(0.4);
      addShake(G.effects, 7);
    }
  }
  car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);

  // Despawn cruisers that fell far behind once heat is gone.
  if (G.wanted.stars === 0 && dist > 900) {
    car.dead = true;
    car.burning = 0.01;
  }
}

function spawnOfficer(G, rng) {
  const angle = rng() * Math.PI * 2;
  const dist = 320 + rng() * 160;
  G.officers.push({
    x: G.player.x + Math.cos(angle) * dist,
    y: G.player.y + Math.sin(angle) * dist,
    angle: 0,
    speed: 150,
    health: 50,
    touchTimer: 0,
    walkPhase: 0,
  });
}

function updateOfficers(G, dt) {
  const player = G.player;
  for (let i = G.officers.length - 1; i >= 0; i--) {
    const off = G.officers[i];
    if (off.health <= 0) {
      G.officers.splice(i, 1);
      continue;
    }
    if (G.wanted.stars === 0) {
      G.officers.splice(i, 1);
      continue;
    }
    const dx = player.x - off.x;
    const dy = player.y - off.y;
    const dist = Math.hypot(dx, dy);
    off.angle = turnToward(off.angle, Math.atan2(dy, dx), 6 * dt);
    if (dist > 26) {
      const speed = player.car ? off.speed * 1.15 : off.speed;
      off.x += Math.cos(off.angle) * speed * dt;
      off.y += Math.sin(off.angle) * speed * dt;
      off.walkPhase += dt * 9;
      off.touchTimer = 0;
    } else if (!player.car) {
      // An officer holding the player still makes an arrest.
      off.touchTimer += dt;
      if (off.touchTimer > 1.1) {
        G.events.push({ type: 'busted' });
        return;
      }
    }
    // Officers give up the chase if the player drives far away.
    if (player.car && dist > 700) {
      G.officers.splice(i, 1);
    }
  }
}

export function clearPolice(G) {
  for (const car of G.cars) {
    if (car.driver === 'police') {
      car.driver = 'traffic';
      car.route = null;
    }
  }
  G.officers.length = 0;
}

export function drawOfficer(ctx, off) {
  ctx.save();
  ctx.translate(off.x, off.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(off.angle);
  const bob = Math.sin(off.walkPhase) * 1.1;
  ctx.fillStyle = '#232a38';
  ctx.fillRect(-4, -6 + bob, 7, 4);
  ctx.fillRect(-4, 2 - bob, 7, 4);
  ctx.fillStyle = '#2e4a7a';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Cap.
  ctx.fillStyle = '#1d2b4f';
  ctx.beginPath();
  ctx.arc(4, 0, 5.5, -1.2, 1.2);
  ctx.fill();
  ctx.fillStyle = '#e8c93d';
  ctx.fillRect(7, -1.5, 3, 3);
  ctx.restore();
}
