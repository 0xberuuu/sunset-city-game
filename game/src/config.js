// Marisol Bay — world constants, tuning and palettes. Everything that shapes the
// city lives here so the other modules stay small and single-purpose.

export const WORLD_W = 3600;
export const WORLD_H = 2600;

// Road grid: avenues run north-south, streets run east-west, 300 apart.
export const ROAD_PITCH = 300;
export const ROAD_WIDTH = 72;
export const AVENUES = [150, 450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150, 3450];
export const STREETS = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];

export const BEACH_TOP = 2400; // sand starts here
export const SEA_TOP = 2520; // water starts here

export const SAVE_KEY = 'marisol-bay-save-v1';
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sprintSpeed: 250,
  maxHealth: 100,
  enterRange: 46,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.32, range: 34, spread: 0, auto: false, melee: true, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 26, rate: 0.26, range: 520, spread: 0.035, auto: false, ammo: 48 },
  smg: { name: 'SMG', damage: 15, rate: 0.085, range: 470, spread: 0.09, auto: true, ammo: 120 },
};

export const VEHICLE_TYPES = {
  dart: { name: 'Dart', kind: 'sedan', w: 46, h: 22, accel: 210, maxSpeed: 330, reverse: 120, turn: 2.5, grip: 6.5, health: 100, seats: 1 },
  marlin: { name: 'Marlin GT', kind: 'coupe', w: 47, h: 21, accel: 300, maxSpeed: 430, reverse: 140, turn: 2.9, grip: 7.5, health: 90, seats: 1 },
  bison: { name: 'Bison', kind: 'pickup', w: 50, h: 23, accel: 190, maxSpeed: 310, reverse: 110, turn: 2.2, grip: 6.0, health: 150, seats: 1 },
  tortuga: { name: 'Tortuga', kind: 'van', w: 52, h: 24, accel: 160, maxSpeed: 280, reverse: 100, turn: 2.0, grip: 5.5, health: 170, seats: 1 },
  cab: { name: 'Cab', kind: 'taxi', w: 46, h: 22, accel: 210, maxSpeed: 320, reverse: 120, turn: 2.5, grip: 6.5, health: 100, seats: 1 },
  cruiser: { name: 'Interceptor', kind: 'police', w: 48, h: 22, accel: 290, maxSpeed: 420, reverse: 140, turn: 2.8, grip: 7.2, health: 160, seats: 1 },
};

export const CAR_COLORS = [
  '#c94f43', '#3f6fb5', '#e0b13e', '#4f9e6b', '#e8e4da', '#3a3f4a',
  '#8a5fa8', '#d97b2f', '#5fb3b3', '#b8bfc7', '#7a4a2f', '#2f7a5a',
];

export const WANTED = {
  // Heat thresholds for each star level.
  stars: [0, 25, 60, 110, 175, 260],
  decayDelay: 6, // seconds unseen before heat decays
  decayRate: 9, // heat per second while unseen
  maxCops: [0, 2, 3, 4, 6, 8],
};

export const DISTRICTS = {
  downtown: { cols: [4, 5, 6, 7], rows: [0, 1, 2, 3], heights: [26, 46], palette: ['#d9c9a8', '#c8b18a', '#b7a58c', '#e2d7bd', '#9fb3c8'] },
  harbor: { cols: [10, 11], rows: [4, 5, 6, 7], heights: [10, 18], palette: ['#b09a7d', '#8f8578', '#a89a86', '#7d8a99'] },
  homes: { cols: [0, 1, 2, 3], rows: [0, 1, 2, 3], heights: [8, 14], palette: ['#e8d3ac', '#e0bfa0', '#d4c9b4', '#c9d6c0', '#e6c9c0'] },
  midtown: { cols: [4, 5, 6, 7, 8, 9], rows: [4, 5, 6, 7], heights: [12, 24], palette: ['#dcc7a0', '#cbb392', '#d8cdb8', '#b8c4c0'] },
  eastside: { cols: [8, 9], rows: [0, 1, 2, 3], heights: [12, 22], palette: ['#d9c2a3', '#c4a98e', '#cfc0a8', '#a9b8a4'] },
};

// Named places. x/y sit on a road so missions are always reachable by car.
export const PLACES = {
  garage: { name: "Bea's Garage", x: 1650, y: 1650 },
  safehouse: { name: 'Rosa’s Apartment', x: 1650, y: 1950 },
  beachBar: { name: 'The Rusty Pelican', x: 450, y: 2250 },
  marina: { name: 'Marina Parking', x: 2850, y: 2250 },
  warehouse: { name: 'Kane Warehouse', x: 3450, y: 1650 },
  policeStation: { name: 'MBPD Station', x: 1950, y: 450 },
  hospital: { name: 'Marisol General', x: 1050, y: 750 },
  park: { name: 'Palmetto Park', x: 750, y: 1350 },
  docks: { name: 'The Docks', x: 3150, y: 1950 },
};

export const COLORS = {
  grass: '#7fae5c',
  grassDark: '#74a153',
  sidewalk: '#cbbfa5',
  sidewalkEdge: '#b3a68c',
  asphalt: '#4a4d55',
  asphaltDark: '#42454d',
  lane: '#e8d97a',
  sand: '#ecd9a0',
  sea: '#2e7fa8',
  seaDeep: '#256b8f',
  parkGrass: '#6fae52',
  roofEdge: '#00000022',
};

export function districtAt(col, row) {
  for (const [name, d] of Object.entries(DISTRICTS)) {
    if (col >= d.cols[0] && col <= d.cols[1] && row >= d.rows[0] && row <= d.rows[1]) return name;
  }
  return 'midtown';
}

export function isParkBlock(col, row) {
  return col >= 2 && col <= 3 && row >= 4 && row <= 5;
}
