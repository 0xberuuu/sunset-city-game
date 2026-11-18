// Story missions: five jobs for Rosa Vega, each a small step machine with
// markers, dialogue, a companion in the first job, and a cash reward.

import { PLACES } from './config.js';
import { createEnemy } from './combat.js';
import { createPickup } from './combat.js';
import { createVehicle } from './vehicles.js';
import { addHeat } from './police.js';
import { addFloat } from './effects.js';

export const MISSIONS = [
  {
    id: 'welcome-back',
    title: 'Welcome Back',
    reward: 150,
    briefing: [
      { speaker: 'BEA', text: 'Rosa! Back in Marisol Bay at last. Your brother is in trouble again.' },
      { speaker: 'BEA', text: 'Tomas is drinking at the Rusty Pelican. Go get him and bring him here. Drive, walk, your call.' },
      { speaker: 'ROSA', text: 'Same Tomas, same trouble. I am on my way.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.beachBar.x, y: PLACES.beachBar.y, radius: 70, text: 'Go to the Rusty Pelican' },
      { type: 'pickup-companion', text: 'Pick up Tomas' },
      { type: 'deliver-companion', x: PLACES.garage.x, y: PLACES.garage.y, radius: 80, text: 'Bring Tomas to the garage' },
    ],
  },
  {
    id: 'hot-property',
    title: 'Hot Property',
    reward: 250,
    briefing: [
      { speaker: 'BEA', text: 'A client wants a Marlin GT, gold paint, sitting at the marina. No questions asked.' },
      { speaker: 'BEA', text: 'Take it and bring it to the garage. If the owner yells, drive faster.' },
      { speaker: 'ROSA', text: 'A gold Marlin. Consider it borrowed forever.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, radius: 90, text: 'Go to the marina parking' },
      { type: 'steal-car', text: 'Steal the gold Marlin GT' },
      { type: 'deliver-car', x: PLACES.garage.x, y: PLACES.garage.y, radius: 80, text: 'Deliver the Marlin to the garage' },
    ],
  },
  {
    id: 'dockside-trouble',
    title: 'Dockside Trouble',
    reward: 400,
    briefing: [
      { speaker: 'BEA', text: 'Marcus Kane has his goons shaking down the dock workers. His ledger is in a crate by the docks.' },
      { speaker: 'BEA', text: 'Clear them out, grab the ledger, bring it to me. Take the pistol from the shelf first.' },
      { speaker: 'ROSA', text: 'Kane wants a war over paperwork. He will get one.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, radius: 110, text: 'Go to the docks' },
      { type: 'kill-all', text: 'Deal with Kane’s goons', spawn: 'docks-goons' },
      { type: 'grab-package', text: 'Take the ledger' },
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, radius: 80, text: 'Bring the ledger to Bea' },
    ],
  },
  {
    id: 'long-way-home',
    title: 'The Long Way Home',
    reward: 500,
    briefing: [
      { speaker: 'BEA', text: 'A package has to reach the east warehouse in 90 seconds. The cops are already watching the docks.' },
      { speaker: 'BEA', text: 'Drive like the whole city is on fire. Because it might be.' },
      { speaker: 'ROSA', text: 'Ninety seconds. I have done worse for less.' },
    ],
    steps: [
      { type: 'timed-drive', x: PLACES.warehouse.x, y: PLACES.warehouse.y, radius: 90, seconds: 90, text: 'Deliver the package in time' },
    ],
  },
  {
    id: 'kanes-fall',
    title: "Kane's Fall",
    reward: 1000,
    briefing: [
      { speaker: 'BEA', text: 'The ledger names every bribe Kane ever paid. Tonight he finds out we have it.' },
      { speaker: 'BEA', text: 'His warehouse, east side. End this, Rosa. Marisol Bay deserves better.' },
      { speaker: 'ROSA', text: 'For Tomas. For the docks. For everyone he squeezed.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.warehouse.x, y: PLACES.warehouse.y, radius: 130, text: 'Go to Kane’s warehouse' },
      { type: 'kill-all', text: 'Clear the warehouse yard', spawn: 'warehouse-wave-1' },
      { type: 'kill-all', text: 'Take down Marcus Kane', spawn: 'warehouse-wave-2' },
    ],
  },
];

export function createStory() {
  return {
    completed: [],
    active: null,
    briefing: null,
    dialogue: null,
    failed: null,
    storyDone: false,
  };
}

export function nextMission(story) {
  return MISSIONS.find((m) => !story.completed.includes(m.id)) || null;
}

export function startMission(G, mission) {
  G.story.active = {
    def: mission,
    stepIndex: 0,
    timer: 0,
    data: {},
    startedAt: G.time,
  };
  G.story.briefing = { lines: mission.briefing, index: 0, shown: 0 };
  G.events.push({ type: 'mission-start', title: mission.title });
}

export function failMission(G, reason) {
  const active = G.story.active;
  if (!active) return;
  G.story.failed = { title: active.def.title, reason };
  G.story.active = null;
  G.companion = null;
  G.enemies = G.enemies.filter((e) => !e.missionId);
  G.audio.missionFail();
}

export function completeMission(G) {
  const active = G.story.active;
  if (!active) return;
  G.story.completed.push(active.def.id);
  G.player.cash += active.def.reward;
  G.stats.missionsDone++;
  G.story.active = null;
  G.companion = null;
  G.audio.missionDone();
  G.audio.cash();
  addFloat(G.effects, G.player.x, G.player.y - 40, `MISSION COMPLETE  +$${active.def.reward}`, '#ffd76a');
  if (G.story.completed.length >= MISSIONS.length) {
    G.story.storyDone = true;
    G.events.push({ type: 'story-done' });
  }
  G.events.push({ type: 'mission-complete', title: active.def.title, reward: active.def.reward });
  if (active.def.id === 'hot-property') {
    G.player.unlocked.smg = true;
    addFloat(G.effects, G.player.x, G.player.y - 64, 'SMG UNLOCKED — press Q', '#7db8db');
  }
  if (typeof G.saveGame === 'function') G.saveGame();
}

export function currentStep(G) {
  const active = G.story.active;
  if (!active) return null;
  return active.def.steps[active.stepIndex] || null;
}

export function advanceStep(G) {
  const active = G.story.active;
  active.stepIndex++;
  active.timer = 0;
  if (active.stepIndex >= active.def.steps.length) {
    completeMission(G);
  }
}

export function updateMission(G, dt) {
  const active = G.story.active;
  if (!active) return;
  const step = currentStep(G);
  if (!step) return;
  const p = G.player;
  active.timer += dt;

  switch (step.type) {
    case 'goto': {
      if (Math.hypot(p.x - step.x, p.y - step.y) < step.radius) advanceStep(G);
      break;
    }
    case 'pickup-companion': {
      if (!G.companion) {
        G.companion = {
          x: PLACES.beachBar.x + 30, y: PLACES.beachBar.y + 40,
          health: 100, dead: false, inCar: false, walkPhase: 0, angle: 0,
        };
      }
      if (Math.hypot(p.x - G.companion.x, p.y - G.companion.y) < 60) advanceStep(G);
      break;
    }
    case 'deliver-companion': {
      if (G.companion && G.companion.dead) {
        failMission(G, 'Tomas did not make it.');
        break;
      }
      const withPlayer = G.companion && (G.companion.inCar || Math.hypot(p.x - G.companion.x, p.y - G.companion.y) < 110);
      if (withPlayer && Math.hypot(p.x - step.x, p.y - step.y) < step.radius) advanceStep(G);
      break;
    }
    case 'steal-car': {
      if (!active.data.targetCar) {
        const car = createVehicle('marlin', PLACES.marina.x + 40, PLACES.marina.y - 60, Math.PI / 2, '#d4af37');
        car.driver = null;
        car.missionTarget = true;
        G.cars.push(car);
        active.data.targetCar = car;
      }
      const car = active.data.targetCar;
      if (car.dead) {
        failMission(G, 'The Marlin was destroyed.');
        break;
      }
      if (p.car === car) advanceStep(G);
      break;
    }
    case 'deliver-car': {
      const car = active.data.targetCar;
      if (!car || car.dead) {
        failMission(G, 'The Marlin was destroyed.');
        break;
      }
      if (p.car === car && Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        car.missionTarget = false;
        advanceStep(G);
      }
      break;
    }
    case 'kill-all': {
      if (!active.data.spawned) {
        active.data.spawned = true;
        spawnSquad(G, step.spawn, active.def.id);
      }
      const remaining = G.enemies.filter((e) => e.missionId === active.def.id && !e.dead).length;
      if (remaining === 0) {
        if (step.spawn === 'docks-goons' && !active.data.packageSpawned) {
          active.data.packageSpawned = true;
          G.pickups.push(createPickup('package', PLACES.docks.x + 60, PLACES.docks.y - 40));
        }
        advanceStep(G);
      }
      break;
    }
    case 'grab-package': {
      const pk = G.pickups.find((k) => k.kind === 'package' && !k.taken);
      if (!pk) advanceStep(G);
      break;
    }
    case 'timed-drive': {
      if (!active.data.kicked) {
        active.data.kicked = true;
        active.timer = 0;
        addHeat(G, 40, 'THE COPS ARE ONTO YOU');
      }
      if (Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        advanceStep(G);
        break;
      }
      if (active.timer > step.seconds) {
        failMission(G, 'Out of time.');
      }
      break;
    }
    default:
      break;
  }
}

function spawnSquad(G, spawnKey, missionId) {
  const squads = {
    'docks-goons': [
      { x: PLACES.docks.x + 40, y: PLACES.docks.y - 60 },
      { x: PLACES.docks.x - 50, y: PLACES.docks.y - 30 },
      { x: PLACES.docks.x + 90, y: PLACES.docks.y + 30 },
      { x: PLACES.docks.x - 20, y: PLACES.docks.y + 70 },
    ],
    'warehouse-wave-1': [
      { x: PLACES.warehouse.x - 60, y: PLACES.warehouse.y - 60 },
      { x: PLACES.warehouse.x + 40, y: PLACES.warehouse.y - 80 },
      { x: PLACES.warehouse.x - 40, y: PLACES.warehouse.y + 50 },
      { x: PLACES.warehouse.x + 70, y: PLACES.warehouse.y + 40 },
    ],
    'warehouse-wave-2': [
      { x: PLACES.warehouse.x - 30, y: PLACES.warehouse.y - 40, boss: true, health: 260, weapon: 'smg' },
      { x: PLACES.warehouse.x + 60, y: PLACES.warehouse.y - 60 },
      { x: PLACES.warehouse.x - 70, y: PLACES.warehouse.y + 30 },
    ],
  };
  for (const spot of squads[spawnKey] || []) {
    const enemy = createEnemy(spot.x, spot.y, {
      missionId,
      boss: spot.boss,
      health: spot.health,
      weapon: spot.weapon || 'pistol',
      shirt: spot.boss ? '#3a3a3a' : '#7a3b3b',
    });
    G.enemies.push(enemy);
  }
}

export function updateCompanion(G, dt) {
  const c = G.companion;
  if (!c || c.dead) return;
  const p = G.player;
  if (p.car) {
    if (!c.inCar && Math.hypot(c.x - p.x, c.y - p.y) < 55) {
      c.inCar = true;
      G.audio.door();
    }
    if (c.inCar) {
      c.x = p.x;
      c.y = p.y;
      return;
    }
  } else if (c.inCar) {
    c.inCar = false;
    c.x = p.x + 24;
    c.y = p.y + 24;
  }
  const dist = Math.hypot(p.x - c.x, p.y - c.y);
  if (dist > 56) {
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    c.angle = a;
    const speed = dist > 260 ? 320 : 190;
    c.x += Math.cos(a) * speed * dt;
    c.y += Math.sin(a) * speed * dt;
    c.walkPhase += dt * 9;
  }
}

export function drawCompanion(ctx, c) {
  if (c.inCar) return;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(c.angle);
  const bob = Math.sin(c.walkPhase) * 1.1;
  ctx.fillStyle = '#2c2f36';
  ctx.fillRect(-4, -6 + bob, 7, 4);
  ctx.fillRect(-4, 2 - bob, 7, 4);
  ctx.fillStyle = '#e8b13e';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.font = 'bold 11px Verdana';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('TOMAS', c.x, c.y - 20);
}

// --- Dialogue ----------------------------------------------------------------

export function startDialogue(G, lines, onDone) {
  G.story.dialogue = { lines, index: 0, shown: 0, timer: 0, onDone };
}

export function updateDialogue(G, dt, advancePressed) {
  const d = G.story.dialogue;
  if (!d) return;
  const line = d.lines[d.index];
  d.timer += dt;
  if (d.shown < line.text.length) {
    d.shown = Math.min(line.text.length, d.shown + dt * 42);
    if (advancePressed) d.shown = line.text.length;
  } else if (advancePressed || d.timer > 6) {
    d.index++;
    d.shown = 0;
    d.timer = 0;
    if (d.index >= d.lines.length) {
      const onDone = d.onDone;
      G.story.dialogue = null;
      if (onDone) onDone();
    }
  }
}
