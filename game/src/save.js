// Saving: the whole run that matters fits in one localStorage entry —
// position, cash, health, story progress and stats. Autosaves after every
// mission and whenever the player saves at the safehouse or from the pause menu.

import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  const p = G.player;
  const data = {
    version: 1,
    savedAt: Date.now(),
    x: Math.round(p.x),
    y: Math.round(p.y),
    health: Math.round(p.health),
    cash: p.cash,
    weapon: p.weapon,
    unlocked: p.unlocked,
    ammo: p.ammo,
    completed: G.story.completed,
    stats: G.stats,
    seed: G.seed,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(G, data) {
  const p = G.player;
  p.x = data.x;
  p.y = data.y;
  p.health = data.health;
  p.cash = data.cash;
  p.weapon = data.weapon;
  p.unlocked = data.unlocked;
  p.ammo = data.ammo;
  G.story.completed = data.completed.slice();
  G.stats = { ...G.stats, ...data.stats };
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
