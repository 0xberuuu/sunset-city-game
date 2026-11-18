// Screenshot staging: ?shot=chase|drive|foot|mission puts the real game in
// a lively state — the same systems, the same code — then paints it twice
// and sets window.__shotReady so a headless browser can capture it.

import { PLACES } from './config.js';
import { createVehicle } from './vehicles.js';
import { spawnTrafficCar, spawnPedestrian } from './traffic.js';
import { addHeat } from './police.js';
import { createEnemy } from './combat.js';
import { MISSIONS, startMission } from './missions.js';
import { enterCar } from './player.js';

export function stageShot(G, name, rng) {
  const p = G.player;
  if (name === 'chase') {
    // A police chase mid-flight: 3 stars, cruisers closing in, a timed
    // mission objective and the minimap all on the HUD at once.
    p.x = 1650;
    p.y = 1050;
    const car = createVehicle('marlin', 1650, 1050, -Math.PI / 2, '#c94f43');
    car.driver = null;
    G.cars.push(car);
    enterCar(G, car);
    car.vx = 0;
    car.vy = -220;
    addHeat(G, 115, null);
    // Cruisers right on Rosa's tail, in her lane, already in pursuit.
    const tails = [
      { x: 1650, y: 1330 },
      { x: 1638, y: 1480 },
      { x: 1662, y: 1620 },
    ];
    for (const t of tails) {
      const cruiser = createVehicle('cruiser', t.x, t.y, -Math.PI / 2, '#1d2b4f');
      cruiser.driver = 'police';
      cruiser.vx = 0;
      cruiser.vy = -300;
      G.cars.push(cruiser);
    }
    for (let i = 0; i < 4; i++) spawnTrafficCar(G, rng, true);
    for (let i = 0; i < 6; i++) spawnPedestrian(G, rng);
    startMission(G, MISSIONS[3]);
    G.story.dialogue = null;
    G.story.active.data.kicked = true;
    G.story.active.timer = 34;
    G.hint = '';
    G.hintTimer = 0;
  } else if (name === 'drive') {
    // City driving: golden avenue, traffic, pedestrians, palms.
    p.x = 1050;
    p.y = 1950;
    const car = createVehicle('marlin', 1050, 1950, 0, '#3f6fb5');
    car.driver = null;
    G.cars.push(car);
    enterCar(G, car);
    car.vx = 240;
    for (let i = 0; i < 6; i++) spawnTrafficCar(G, rng, true);
    for (let i = 0; i < 8; i++) spawnPedestrian(G, rng);
    startMission(G, MISSIONS[0]);
    G.story.dialogue = null;
    G.hint = '';
    G.hintTimer = 0;
  } else if (name === 'foot') {
    // On foot by the beach promenade, aiming, pedestrians around.
    p.x = 750;
    p.y = 2300;
    p.angle = 0.4;
    p.aimAngle = 0.4;
    p.health = 82;
    p.cash = 1240;
    for (let i = 0; i < 10; i++) spawnPedestrian(G, rng);
    const parked = createVehicle('dart', 700, 2260, 0, '#e0b13e');
    parked.driver = null;
    G.cars.push(parked);
    const parked2 = createVehicle('bison', 830, 2330, Math.PI, '#4f9e6b');
    parked2.driver = null;
    G.cars.push(parked2);
    G.hint = 'WASD move  •  E enter car  •  Click shoot';
    G.hintTimer = 30;
  } else if (name === 'mission') {
    // A mission firefight at the docks: goons, objective, health bars.
    p.x = PLACES.docks.x - 170;
    p.y = PLACES.docks.y + 20;
    p.angle = 0;
    p.aimAngle = 0;
    p.weapon = 'pistol';
    const spots = [
      { x: PLACES.docks.x + 40, y: PLACES.docks.y - 60 },
      { x: PLACES.docks.x - 50, y: PLACES.docks.y - 30 },
      { x: PLACES.docks.x + 90, y: PLACES.docks.y + 30 },
      { x: PLACES.docks.x - 20, y: PLACES.docks.y + 70 },
    ];
    for (const s of spots) {
      G.enemies.push(createEnemy(s.x, s.y, { missionId: 'dockside-trouble', shirt: '#7a3b3b' }));
    }
    startMission(G, MISSIONS[2]);
    G.story.dialogue = null;
    G.story.active.stepIndex = 1;
    G.story.active.data.spawned = true;
    G.hint = '';
    G.hintTimer = 0;
  }
  // Let the world settle: traffic rolls, cruisers close in, goons advance.
  for (let i = 0; i < 120; i++) {
    G.stepWorld(1 / 60);
  }
  // The mission banner would cover the action; the HUD tells the story.
  G.banner = null;
  // Keep the player's car at speed for the capture.
  if (G.player.car) {
    const car = G.player.car;
    car.vx = Math.cos(car.angle) * 320;
    car.vy = Math.sin(car.angle) * 320;
    car.speed = 320;
  }
  G.updateCameraInstant();
}
