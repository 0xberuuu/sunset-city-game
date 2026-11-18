// The city of Marisol Bay: a seeded grid of blocks, buildings, palms, crates
// and lamps, plus the collision and road queries every moving thing uses.

import {
  AVENUES, BEACH_TOP, COLORS, DISTRICTS, ROAD_PITCH, ROAD_WIDTH,
  SEA_TOP, STREETS, WORLD_H, WORLD_W, districtAt, isParkBlock,
} from './config.js';
import { chance, pick, range, rangeInt } from './random.js';

const BLOCK = ROAD_PITCH - ROAD_WIDTH; // 228: walkable block interior

function blockRect(col, row) {
  const x0 = AVENUES[col] + ROAD_WIDTH / 2;
  const y0 = STREETS[row] + ROAD_WIDTH / 2;
  return { x: x0, y: y0, w: BLOCK, h: BLOCK };
}

export function createCity(rng) {
  const buildings = [];
  const props = [];
  const colliders = [];
  const cols = AVENUES.length - 1;
  const rows = STREETS.length - 1;

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const rect = blockRect(col, row);
      if (isParkBlock(col, row)) {
        buildPark(rng, rect, props);
        continue;
      }
      const district = districtAt(col, row);
      const spec = DISTRICTS[district];
      buildBlock(rng, rect, spec, district, buildings, props, colliders);
    }
  }

  buildBeach(rng, props);
  buildHarborProps(rng, props, colliders);
  buildStreetProps(rng, props);

  return { buildings, props, colliders, cols, rows };
}

function buildBlock(rng, rect, spec, district, buildings, props, colliders) {
  const inset = 12;
  const inner = { x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 };
  const count = district === 'homes' ? rangeInt(rng, 2, 4) : rangeInt(rng, 2, 3);
  const cells = splitCells(rng, inner, count);
  for (const cell of cells) {
    const pad = district === 'homes' ? 8 : 4;
    const b = {
      x: cell.x + pad,
      y: cell.y + pad,
      w: cell.w - pad * 2,
      h: cell.h - pad * 2,
      height: range(rng, spec.heights[0], spec.heights[1]),
      color: pick(rng, spec.palette),
      district,
      roof: rng(),
    };
    buildings.push(b);
    colliders.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  }
  // A few trees or planters on the sidewalk corners of the block.
  const corners = 2;
  for (let i = 0; i < corners; i++) {
    props.push({
      kind: 'tree',
      x: rect.x + (i === 0 ? 12 : rect.w - 12),
      y: rect.y + (chance(rng, 0.5) ? 12 : rect.h - 12),
      s: range(rng, 0.8, 1.2),
    });
  }
}

function splitCells(rng, rect, count) {
  if (count <= 1) return [rect];
  const vertical = count === 2 ? chance(rng, 0.5) : true;
  const cells = [];
  if (count === 2) {
    const t = range(rng, 0.38, 0.62);
    if (vertical) {
      cells.push({ x: rect.x, y: rect.y, w: rect.w * t, h: rect.h });
      cells.push({ x: rect.x + rect.w * t, y: rect.y, w: rect.w * (1 - t), h: rect.h });
    } else {
      cells.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h * t });
      cells.push({ x: rect.x, y: rect.y + rect.h * t, w: rect.w, h: rect.h * (1 - t) });
    }
    return cells;
  }
  // 2x2 for homes.
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      cells.push({ x: rect.x + i * hw, y: rect.y + j * hh, w: hw, h: hh });
    }
  }
  return cells.slice(0, count);
}

function buildPark(rng, rect, props) {
  const trees = rangeInt(rng, 9, 13);
  for (let i = 0; i < trees; i++) {
    props.push({
      kind: 'tree',
      x: range(rng, rect.x + 16, rect.x + rect.w - 16),
      y: range(rng, rect.y + 16, rect.y + rect.h - 16),
      s: range(rng, 0.9, 1.5),
    });
  }
  for (let i = 0; i < 3; i++) {
    props.push({
      kind: 'bench',
      x: range(rng, rect.x + 30, rect.x + rect.w - 30),
      y: range(rng, rect.y + 30, rect.y + rect.h - 30),
      a: rng() * Math.PI,
    });
  }
  if (chance(rng, 0.6)) {
    props.push({ kind: 'pond', x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, r: range(rng, 26, 40) });
  }
}

function buildBeach(rng, props) {
  for (let x = 60; x < WORLD_W; x += rangeInt(rng, 90, 170)) {
    props.push({ kind: 'palm', x, y: range(rng, BEACH_TOP + 14, BEACH_TOP + 60), s: range(rng, 0.9, 1.3) });
  }
  for (let i = 0; i < 14; i++) {
    props.push({ kind: 'umbrella', x: range(rng, 80, WORLD_W - 80), y: range(rng, BEACH_TOP + 20, SEA_TOP - 24), c: pick(rng, ['#e05a4e', '#e8b13e', '#3f8fb5', '#e8e4da']) });
  }
}

function buildHarborProps(rng, props, colliders) {
  const palette = ['#b5523c', '#3e6e8f', '#c99a3a', '#5d7a4a'];
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 2950, 3520);
    const y = range(rng, 1250, 2320);
    const w = rangeInt(rng, 34, 58);
    const h = rangeInt(rng, 20, 26);
    const a = chance(rng, 0.5) ? 0 : Math.PI / 2;
    props.push({ kind: 'crate', x, y, w, h, a, c: pick(rng, palette) });
    colliders.push({ x: x - w / 2, y: y - h / 2, w, h, rot: a });
  }
  // Dock piers jutting into the sea at the south-east corner.
  for (let i = 0; i < 3; i++) {
    const x = 3050 + i * 170;
    props.push({ kind: 'pier', x, y: SEA_TOP + 30, w: 60, h: 70 });
  }
}

function buildStreetProps(rng, props) {
  for (const x of AVENUES) {
    for (const y of STREETS) {
      if (chance(rng, 0.7)) {
        props.push({ kind: 'lamp', x: x + ROAD_WIDTH / 2 + 6, y: y + ROAD_WIDTH / 2 + 6 });
      }
    }
  }
  for (let x = 200; x < WORLD_W; x += 300) {
    props.push({ kind: 'palm', x: x + 40, y: 2250 + ROAD_WIDTH / 2 + 10, s: 1 });
  }
}

// --- Queries ---------------------------------------------------------------

export function pointOnRoad(x, y) {
  for (const ax of AVENUES) {
    if (Math.abs(x - ax) <= ROAD_WIDTH / 2 && y >= 0 && y <= BEACH_TOP) return true;
  }
  for (const sy of STREETS) {
    if (Math.abs(y - sy) <= ROAD_WIDTH / 2 && x >= 0 && x <= WORLD_W) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y: Math.min(Math.max(y, 0), BEACH_TOP) }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x: Math.min(Math.max(x, 0), WORLD_W), y: sy }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return { x: pick(rng, AVENUES), y: range(rng, 60, BEACH_TOP - 60) };
  }
  return { x: range(rng, 60, WORLD_W - 60), y: pick(rng, STREETS) };
}

// Axis-aligned circle-vs-box resolution. Returns the corrected position.
export function collideCircle(city, x, y, radius) {
  let nx = x;
  let ny = y;
  for (const c of city.colliders) {
    const cx = Math.max(c.x, Math.min(nx, c.x + c.w));
    const cy = Math.max(c.y, Math.min(ny, c.y + c.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) {
        ny = c.y - radius;
        continue;
      }
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    }
  }
  nx = Math.max(radius, Math.min(WORLD_W - radius, nx));
  ny = Math.max(radius, Math.min(WORLD_H - radius, ny));
  // The sea is not walkable or drivable.
  if (ny + radius > SEA_TOP) ny = SEA_TOP - radius;
  return { x: nx, y: ny };
}

export function circleHitsBuilding(city, x, y, radius) {
  for (const c of city.colliders) {
    const cx = Math.max(c.x, Math.min(x, c.x + c.w));
    const cy = Math.max(c.y, Math.min(y, c.y + c.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

// Grid route: Manhattan path along avenues and streets, as waypoints.
export function routeAlongRoads(from, to, rng) {
  const start = nearestRoadPoint(from.x, from.y);
  const end = nearestRoadPoint(to.x, to.y);
  const waypoints = [start];
  const goVerticalFirst = chance(rng, 0.5);
  if (goVerticalFirst) {
    waypoints.push({ x: start.x, y: end.y });
  } else {
    waypoints.push({ x: end.x, y: start.y });
  }
  waypoints.push(end);
  return waypoints;
}

export function groundColorAt(x, y) {
  if (y >= SEA_TOP) return COLORS.sea;
  if (y >= BEACH_TOP) return COLORS.sand;
  return COLORS.grass;
}
