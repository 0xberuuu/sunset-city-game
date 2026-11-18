// Boot and the one loop: the world advances in fixed 1/60 s steps, the
// renderer paints what is there, and the game moves between title, play,
// pause, help and the wasted/busted screens.
//
// ?seed=N fixes the city layout. ?shot=chase|drive|foot|mission stages that
// scene with the real systems, paints it twice and sets window.__shotReady.

import { PLACES, PLAYER, STEP, WORLD_H, WORLD_W } from './config.js';
import { createRandom } from './random.js';
import { createCity, randomRoadPoint } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects, updateEffects, addFloat } from './effects.js';
import { createVehicle, separateCars } from './vehicles.js';
import { spawnTrafficCar, spawnPedestrian, updateTraffic, updatePedestrians } from './traffic.js';
import { createWanted, updateWanted, clearPolice } from './police.js';
import { updateBullets, updateEnemies, updatePickups, createPickup } from './combat.js';
import { createStory, nextMission, startMission, startDialogue, updateDialogue, updateMission, updateCompanion, failMission, currentStep } from './missions.js';
import { createPlayer, updatePlayer, nearestEnterableCar, exitCar } from './player.js';
import { createCamera, updateCamera, renderGround, renderMinimapBase, drawWorld } from './render.js';
import { drawHUD, drawTitleScreen, drawPauseScreen, drawHelpScreen, drawEndScreen, drawStoryDoneScreen } from './hud.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const audio = createAudio();
const rng = createRandom(seed);
const city = createCity(rng);

const G = {
  seed,
  rng,
  city,
  time: 0,
  screen: 'title',
  screenReturn: 'title',
  menuIndex: 0,
  input,
  audio,
  effects: createEffects(),
  camera: createCamera(canvas.width, canvas.height),
  groundCanvas: renderGround(city),
  minimapBase: renderMinimapBase(city),
  player: createPlayer(PLACES.safehouse.x, PLACES.safehouse.y - 60),
  cars: [],
  peds: [],
  officers: [],
  enemies: [],
  bullets: [],
  pickups: [],
  companion: null,
  wanted: createWanted(),
  story: createStory(),
  stats: { carsStolen: 0, carsDestroyed: 0, kills: 0, missionsDone: 0 },
  events: [],
  marker: null,
  banner: null,
  hint: '',
  hintTimer: 0,
  prompt: '',
  pickupRespawn: 0,
};

G.saveGame = function save() {
  if (saveGame(G)) {
    addFloat(G.effects, G.player.x, G.player.y - 34, 'GAME SAVED', '#7ddb8a');
    G.banner = { text: 'GAME SAVED', sub: 'Progress kept on this machine', life: 2.5, color: '#7ddb8a' };
  }
};

G.updateCameraInstant = function updateCameraInstant() {
  G.camera.x = Math.max(0, Math.min(Math.max(0, WORLD_W - G.camera.w), G.player.x - G.camera.w / 2));
  G.camera.y = Math.max(0, Math.min(Math.max(0, WORLD_H - G.camera.h), G.player.y - G.camera.h / 2));
};

function seedWorld() {
  // Parked cars along the roads.
  const types = ['dart', 'marlin', 'bison', 'tortuga', 'cab'];
  for (let i = 0; i < 16; i++) {
    const spot = randomRoadPoint(rng);
    const car = createVehicle(types[i % types.length], spot.x + 22, spot.y + 10, (i % 2 === 0 ? 0 : Math.PI / 2));
    car.driver = null;
    G.cars.push(car);
  }
  for (let i = 0; i < 8; i++) spawnTrafficCar(G, rng, false);
  for (let i = 0; i < 20; i++) spawnPedestrian(G, rng);
  // Pickups at memorable spots.
  const spots = [
    ['health', PLACES.hospital.x + 40, PLACES.hospital.y + 40],
    ['health', PLACES.park.x, PLACES.park.y],
    ['ammo', PLACES.garage.x - 50, PLACES.garage.y + 30],
    ['ammo', PLACES.docks.x - 80, PLACES.docks.y + 60],
    ['cash', PLACES.beachBar.x - 30, PLACES.beachBar.y - 30],
    ['cash', PLACES.marina.x - 60, PLACES.marina.y + 20],
    ['armor', PLACES.policeStation.x + 40, PLACES.policeStation.y - 30],
    ['health', PLACES.warehouse.x - 90, PLACES.warehouse.y + 60],
    ['ammo', 750, 450],
    ['cash', 2250, 1350],
    ['health', 2850, 750],
    ['armor', 450, 1650],
  ];
  for (const [kind, x, y] of spots) G.pickups.push(createPickup(kind, x, y));
}

function mouseWorld() {
  return {
    x: input.mouse.x + G.camera.x,
    y: input.mouse.y + G.camera.y,
  };
}

function computeMarker() {
  const step = currentStep(G);
  if (step) {
    if (step.x !== undefined) {
      G.marker = { x: step.x, y: step.y, radius: step.radius || 60, color: '#ffd76a' };
      return;
    }
    if (step.type === 'kill-all') {
      const alive = G.enemies.find((e) => e.missionId === G.story.active.def.id && !e.dead);
      if (alive) {
        G.marker = { x: alive.x, y: alive.y, radius: 40, color: '#ff6a5a' };
        return;
      }
    }
    if (step.type === 'grab-package') {
      const pk = G.pickups.find((k) => k.kind === 'package' && !k.taken);
      if (pk) {
        G.marker = { x: pk.x, y: pk.y, radius: 40, color: '#ffd76a' };
        return;
      }
    }
    if (step.type === 'steal-car' || step.type === 'deliver-car') {
      const car = G.story.active.data.targetCar;
      if (car && !car.dead) {
        G.marker = { x: car.x, y: car.y, radius: 46, color: '#ffd76a' };
        return;
      }
    }
    if (step.type === 'pickup-companion' && G.companion) {
      G.marker = { x: G.companion.x, y: G.companion.y, radius: 40, color: '#7ddb8a' };
      return;
    }
    G.marker = null;
    return;
  }
  if (!G.story.active && nextMission(G.story)) {
    G.marker = { x: PLACES.garage.x, y: PLACES.garage.y, radius: 60, color: '#7ddb8a' };
    return;
  }
  G.marker = null;
}

function computePrompt() {
  const p = G.player;
  G.prompt = '';
  if (G.story.dialogue) return;
  if (!G.story.active && nextMission(G.story)) {
    if (Math.hypot(p.x - PLACES.garage.x, p.y - PLACES.garage.y) < 90) {
      G.prompt = 'E — Talk to Bea';
      return;
    }
  }
  if (Math.hypot(p.x - PLACES.safehouse.x, p.y - PLACES.safehouse.y) < 80) {
    G.prompt = 'E — Save game at the safehouse';
    return;
  }
  if (!p.car) {
    const car = nearestEnterableCar(G, PLAYER.enterRange + 14);
    if (car) G.prompt = `E — Get in the ${car.def.name}`;
  } else {
    G.prompt = 'E — Get out  •  Space — Handbrake';
  }
}

function handleWorldInteract() {
  const p = G.player;
  if (!input.wasPressed('interact')) return;
  if (!G.story.active && nextMission(G.story)) {
    if (Math.hypot(p.x - PLACES.garage.x, p.y - PLACES.garage.y) < 90) {
      const mission = nextMission(G.story);
      input.consume('interact');
      audio.click();
      startDialogue(G, mission.briefing, () => startMission(G, mission));
      return;
    }
  }
  if (Math.hypot(p.x - PLACES.safehouse.x, p.y - PLACES.safehouse.y) < 80) {
    input.consume('interact');
    G.saveGame();
  }
}

function processEvents() {
  while (G.events.length > 0) {
    const event = G.events.shift();
    if (event.type === 'mission-start') {
      G.banner = { text: event.title.toUpperCase(), sub: 'New mission', life: 3.2, color: '#ffd76a' };
    } else if (event.type === 'mission-complete') {
      G.banner = { text: 'MISSION COMPLETE', sub: `${event.title}  •  +$${event.reward}`, life: 3.5, color: '#7ddb8a' };
    } else if (event.type === 'busted') {
      arrestPlayer();
    } else if (event.type === 'wasted') {
      hospitalizePlayer();
    } else if (event.type === 'story-done') {
      G.screen = 'storydone';
    }
  }
}

function arrestPlayer() {
  const p = G.player;
  const fine = Math.min(p.cash, 150);
  p.cash -= fine;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.x = PLACES.policeStation.x;
  p.y = PLACES.policeStation.y + 60;
  p.health = PLAYER.maxHealth;
  p.dead = false;
  G.wanted = createWanted();
  clearPolice(G);
  if (G.story.active) failMission(G, 'Busted by the MBPD.');
  audio.busted();
  G.updateCameraInstant();
  G.screen = 'busted';
}

function hospitalizePlayer() {
  const p = G.player;
  const bill = Math.min(p.cash, 100);
  p.cash -= bill;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y + 60;
  p.health = PLAYER.maxHealth;
  p.dead = false;
  G.wanted = createWanted();
  clearPolice(G);
  if (G.story.active) failMission(G, 'Rosa was wasted.');
  G.updateCameraInstant();
  G.screen = 'wasted';
}

G.stepWorld = function stepWorld(dt) {
  G.time += dt;
  const mw = mouseWorld();
  updatePlayer(G, dt, input, mw);
  updateTraffic(G, dt, rng);
  updatePedestrians(G, dt, rng);
  updateWanted(G, dt, rng);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateMission(G, dt);
  updateCompanion(G, dt);
  separateCars(G.cars);
  updateEffects(G.effects, dt);
  computeMarker();
  computePrompt();
  processEvents();

  // Pickup respawns keep the city stocked.
  G.pickupRespawn -= dt;
  if (G.pickupRespawn <= 0) {
    G.pickupRespawn = 18;
    if (G.pickups.length < 9) {
      const spot = randomRoadPoint(rng);
      const kinds = ['health', 'ammo', 'cash'];
      G.pickups.push(createPickup(kinds[Math.floor(Math.random() * 3)], spot.x + 40, spot.y + 40));
    }
  }

  if (G.banner) {
    G.banner.life -= dt;
    if (G.banner.life <= 0) G.banner = null;
  }
  if (G.hintTimer > 0) G.hintTimer -= dt;

  // Audio follows the action.
  const p = G.player;
  audio.setEngine(!!p.car, p.car ? Math.min(1, Math.abs(p.car.speed) / p.car.def.maxSpeed) : 0);
  const copsNear = G.cars.some((c) => c.driver === 'police' && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 600);
  audio.setSiren(G.wanted.stars > 0 && copsNear);
  audio.updateMusic(dt, G.screen === 'play');

  // Camera follows with a little lookahead.
  const lookX = p.x + (p.vx || 0) * 0.22 + (p.car ? p.car.vx * 0.22 : 0);
  const lookY = p.y + (p.vy || 0) * 0.22 + (p.car ? p.car.vy * 0.22 : 0);
  updateCamera(G.camera, lookX, lookY, dt);
};

function startNewGame() {
  G.screen = 'play';
  G.hint = 'WASD move  •  E enter car  •  Click shoot  •  Follow the green marker to Bea’s Garage';
  G.hintTimer = 12;
  G.updateCameraInstant();
  audio.unlock();
}

function continueGame() {
  const data = loadSave();
  if (data) applySave(G, data);
  G.screen = 'play';
  G.hint = 'Welcome back to Marisol Bay';
  G.hintTimer = 5;
  G.updateCameraInstant();
  audio.unlock();
}

function menuClick(items, startY, spacing) {
  if (!input.mouse.clicked) return -1;
  for (let i = 0; i < items.length; i++) {
    const y = startY + i * spacing;
    if (
      input.mouse.x > canvas.width / 2 - 150 && input.mouse.x < canvas.width / 2 + 150 &&
      input.mouse.y > y - 28 && input.mouse.y < y + 10
    ) {
      return i;
    }
  }
  return -1;
}

function updateTitle(dt) {
  void dt;
  const items = hasSave() ? ['Continue', 'New Game', 'How to Play'] : ['New Game', 'How to Play'];
  if (input.wasPressed('up')) G.menuIndex = (G.menuIndex + items.length - 1) % items.length;
  if (input.wasPressed('down')) G.menuIndex = (G.menuIndex + 1) % items.length;
  const clicked = menuClick(items, canvas.height * 0.52, 46);
  if (clicked >= 0) G.menuIndex = clicked;
  if (input.wasPressed('confirm') || clicked >= 0) {
    audio.unlock();
    audio.click();
    const choice = items[G.menuIndex];
    if (choice === 'Continue') continueGame();
    else if (choice === 'New Game') startNewGame();
    else {
      G.screenReturn = 'title';
      G.screen = 'help';
    }
  }
}

function updatePaused() {
  const items = ['Resume', 'Save Game', 'How to Play', 'Quit to Title'];
  if (input.wasPressed('up')) G.menuIndex = (G.menuIndex + items.length - 1) % items.length;
  if (input.wasPressed('down')) G.menuIndex = (G.menuIndex + 1) % items.length;
  const clicked = menuClick(items, canvas.height * 0.4, 46);
  if (clicked >= 0) G.menuIndex = clicked;
  if (input.wasPressed('pause')) {
    G.screen = 'play';
    return;
  }
  if (input.wasPressed('confirm') || clicked >= 0) {
    audio.click();
    const choice = items[G.menuIndex];
    if (choice === 'Resume') G.screen = 'play';
    else if (choice === 'Save Game') {
      G.saveGame();
      G.screen = 'play';
    } else if (choice === 'How to Play') {
      G.screenReturn = 'paused';
      G.screen = 'help';
    } else {
      G.screen = 'title';
      G.menuIndex = 0;
    }
  }
}

function render() {
  const w = canvas.width;
  const h = canvas.height;
  G.camera.w = w;
  G.camera.h = h;
  ctx.clearRect(0, 0, w, h);
  if (G.screen === 'title') {
    drawTitleScreen(G, ctx, w, h, G.menuIndex, hasSave());
  } else if (G.screen === 'help') {
    drawHelpScreen(ctx, w, h);
  } else if (G.screen === 'paused') {
    drawWorld(G, ctx, G.groundCanvas);
    drawHUD(G, ctx, w, h);
    drawPauseScreen(G, ctx, w, h, G.menuIndex);
  } else if (G.screen === 'wasted' || G.screen === 'busted') {
    drawWorld(G, ctx, G.groundCanvas);
    drawEndScreen(ctx, w, h, G.screen, G.stats);
  } else if (G.screen === 'storydone') {
    drawWorld(G, ctx, G.groundCanvas);
    drawHUD(G, ctx, w, h);
    drawStoryDoneScreen(ctx, w, h);
  } else {
    drawWorld(G, ctx, G.groundCanvas);
    drawHUD(G, ctx, w, h);
    if (G.prompt) {
      ctx.font = 'bold 14px Verdana';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(G.prompt, w / 2, h - 44);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(G.prompt, w / 2, h - 44);
    }
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;

  if (input.wasPressed('mute')) {
    const muted = audio.toggleMute();
    G.hint = muted ? 'Sound muted' : 'Sound on';
    G.hintTimer = 1.5;
  }

  if (G.screen === 'title') {
    updateTitle(frameDt);
  } else if (G.screen === 'help') {
    if (input.wasPressed('interact') || input.wasPressed('confirm') || input.mouse.clicked || input.wasPressed('pause')) {
      G.screen = G.screenReturn;
    }
  } else if (G.screen === 'paused') {
    updatePaused();
  } else if (G.screen === 'wasted' || G.screen === 'busted') {
    if (input.wasPressed('interact') || input.wasPressed('confirm')) {
      G.screen = 'play';
      G.hintTimer = 0;
    }
  } else if (G.screen === 'storydone') {
    if (input.wasPressed('interact') || input.wasPressed('confirm')) {
      G.screen = 'play';
    }
  } else if (G.screen === 'play') {
    if (input.wasPressed('pause')) {
      G.screen = 'paused';
      G.menuIndex = 0;
    } else if (G.story.dialogue) {
      const advance = input.wasPressed('interact') || input.wasPressed('confirm') || input.mouse.clicked;
      updateDialogue(G, frameDt, advance);
    } else {
      handleWorldInteract();
      accumulator += frameDt;
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        G.stepWorld(STEP);
        accumulator -= STEP;
        steps++;
      }
      if (steps === 5) accumulator = 0;
    }
  }

  render();
  input.endFrame();
}

// First gesture unlocks the audio context.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

seedWorld();
G.updateCameraInstant();

// A handle for debugging and automated smoke tests; the game never needs it.
window.__game = G;

if (shot) {
  G.screen = 'play';
  stageShot(G, shot, rng);
  render();
  render();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
