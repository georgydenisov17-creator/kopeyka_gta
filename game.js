// ══════════════════════════════════════════════════════════════
// СИМУЛЯТОР КОПЕЙКИ — Top-Down Edition
// ══════════════════════════════════════════════════════════════

// ─── КОНФИГ ───────────────────────────────────────────────────
const CELL = 600, ROAD = 100, BLOCK = 500, GRID = 10, SIDEWALK = 28;
const WORLD_SIZE = GRID * CELL + ROAD;
const INTRO_DURATION = 10;

const UPGRADES = {
  engine:   { name: 'Двигатель',     max: 5, cost: [100, 250, 500, 1000, 2000], effect: [300, 360, 420, 490, 570, 660] },
  handling: { name: 'Управляемость', max: 5, cost: [80, 200, 450, 900, 1800],  effect: [3.2, 3.7, 4.2, 4.7, 5.2, 5.8] },
  brakes:   { name: 'Тормоза',       max: 5, cost: [60, 150, 350, 700, 1500],  effect: [400, 480, 560, 660, 780, 920] },
};

// ─── СОСТОЯНИЕ ────────────────────────────────────────────────
const state = {
  score: 0,
  upgrades: { engine: 0, handling: 0, brakes: 0 },
  settings: { volume: 50 },
  screen: 'menu',
  introTimer: 0,
  introShown: false,
  nitro: 100,
};

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('kopeika_topdown') || '{}');
    if (s.upgrades) {
      for (const k of Object.keys(UPGRADES)) {
        if (typeof s.upgrades[k] === 'number') {
          state.upgrades[k] = Math.max(0, Math.min(UPGRADES[k].max, s.upgrades[k]));
        }
      }
    }
    if (s.settings && typeof s.settings.volume === 'number') {
      state.settings.volume = Math.max(0, Math.min(100, s.settings.volume));
    }
    if (typeof s.score === 'number' && Number.isFinite(s.score)) {
      state.score = Math.max(0, s.score);
    }
  } catch (e) {}
}
function saveProgress() {
  try {
    localStorage.setItem('kopeika_topdown', JSON.stringify({
      upgrades: state.upgrades,
      settings: state.settings,
      score: Math.floor(state.score),
    }));
  } catch (e) {}
}
loadSave();

// ─── CANVAS ───────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let viewW, viewH, dpr;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

// ─── ВВОД ─────────────────────────────────────────────────────
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Escape') {
    if (state.screen === 'game') showScreen('menu');
    else if (state.screen !== 'menu') showScreen('menu');
    e.preventDefault();
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
});

// ─── RNG ──────────────────────────────────────────────────────
let seed = 20240101;
function resetSeed(s = 20240101) { seed = s >>> 0; }
function rng() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function rngR(a, b) { return a + rng() * (b - a); }
function rngI(a, b) { return Math.floor(rngR(a, b + 1)); }
function rngP(arr) { return arr[Math.floor(rng() * arr.length)]; }

// ─── МИР ──────────────────────────────────────────────────────
const world = {
  blocks: [], buildings: [], trees: [], props: [], parkedCars: [],
  cracks: [], oilStains: [], patches: [], manholes: [], arrows: [],
  crosswalks: [], puddles: [], leaves: [], bushes: [], lamps: [],
  benches: [], trashCans: [], kiosks: [], hydrants: [], mailboxes: [],
  fences: [], trashPiles: [], grassPatches: [], drains: [],
};

function clearWorld() {
  for (const key of Object.keys(world)) {
    world[key].length = 0;
  }
}

// ─── ГЕНЕРАЦИЯ ────────────────────────────────────────────────
function generateWorld() {
  clearWorld();
  resetSeed(20240101);

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      world.blocks.push({ x: i * CELL + ROAD, y: j * CELL + ROAD, w: BLOCK, h: BLOCK, i, j });
    }
  }
  generateRoadDetails();
  generateCrosswalks();
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      generateBlock(i * CELL + ROAD, j * CELL + ROAD, i, j);
    }
  }
  for (let i = 0; i < 200; i++) {
    world.leaves.push({
      x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE,
      a: rng() * Math.PI, c: rngP(['#8a5a2a', '#6a3a1a', '#a86a30', '#7a4a20']),
    });
  }
}

function generateRoadDetails() {
  for (let n = 0; n < 80; n++) {
    const x = rng() * WORLD_SIZE, y = rng() * WORLD_SIZE;
    const pts = [{ x, y }];
    let cx = x, cy = y;
    for (let k = 0; k < 6; k++) {
      cx += rngR(-40, 40);
      cy += rngR(-40, 40);
      pts.push({ x: cx, y: cy });
    }
    world.cracks.push(pts);
  }
  for (let n = 0; n < 120; n++) {
    world.oilStains.push({ x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE, r: rngR(8, 26), a: rng() * 0.6 + 0.4 });
  }
  for (let n = 0; n < 60; n++) {
    world.patches.push({
      x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE,
      w: rngR(20, 90), h: rngR(15, 60), a: rng() * Math.PI,
      c: rngP(['#303034', '#2a2a2e', '#424246']),
    });
  }
  for (let n = 0; n < 40; n++) {
    world.manholes.push({ x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE });
  }
  for (let n = 0; n < 100; n++) {
    world.puddles.push({
      x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE,
      rx: rngR(6, 22), ry: rngR(4, 14), a: rng() * Math.PI,
    });
  }
  for (let n = 0; n < 50; n++) {
    world.arrows.push({
      x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE,
      dir: rngP(['straight', 'left', 'right']), angle: rngP([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    });
  }
  for (let n = 0; n < 80; n++) {
    world.drains.push({ x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE });
  }
}

function generateCrosswalks() {
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const cx = i * CELL + ROAD / 2;
      const cy = j * CELL + ROAD / 2;
      if (i > 0) {
        world.crosswalks.push({ x: cx - ROAD / 2 + 4, y: cy - ROAD / 2 - 18, w: ROAD - 8, h: 14, dir: 'h' });
        world.crosswalks.push({ x: cx - ROAD / 2 + 4, y: cy + ROAD / 2 + 4, w: ROAD - 8, h: 14, dir: 'h' });
      }
      if (j > 0) {
        world.crosswalks.push({ x: cx - ROAD / 2 - 18, y: cy - ROAD / 2 + 4, w: 14, h: ROAD - 8, dir: 'v' });
        world.crosswalks.push({ x: cx + ROAD / 2 + 4, y: cy - ROAD / 2 + 4, w: 14, h: ROAD - 8, dir: 'v' });
      }
    }
  }
}

function generateBlock(bx, by, bi, bj) {
  const innerX = bx + SIDEWALK;
  const innerY = by + SIDEWALK;
  const innerW = BLOCK - SIDEWALK * 2;
  const innerH = BLOCK - SIDEWALK * 2;

  const t = rng();
  if (t < 0.08) generatePark(innerX, innerY, innerW, innerH);
  else if (t < 0.18) generateParkingLot(innerX, innerY, innerW, innerH);
  else if (t < 0.24) generateIndustrial(innerX, innerY, innerW, innerH);
  else generateResidential(innerX, innerY, innerW, innerH);

  generateSidewalkDetails(bx, by, bi, bj);
}

function generateSidewalkDetails(bx, by, bi, bj) {
  const step = 60;
  for (let x = bx + 10; x < bx + BLOCK - 10; x += step + rngR(-20, 20)) {
    if (rng() < 0.35) world.trees.push({
      x: x + rngR(-4, 4), y: by + SIDEWALK * 0.5, r: rngR(14, 26),
      type: rngP(['round', 'round', 'sprawl', 'bare']), c: rngP(['#2a4a1a', '#3a5a20', '#1a3a10', '#4a3520']),
    });
    if (rng() < 0.35) world.trees.push({
      x: x + rngR(-4, 4), y: by + BLOCK - SIDEWALK * 0.5, r: rngR(14, 26),
      type: rngP(['round', 'sprawl', 'bare']), c: rngP(['#2a4a1a', '#3a5a20', '#1a3a10']),
    });
  }
  for (let y = by + 10; y < by + BLOCK - 10; y += step + rngR(-20, 20)) {
    if (rng() < 0.35) world.trees.push({
      x: bx + SIDEWALK * 0.5, y: y + rngR(-4, 4), r: rngR(14, 24),
      type: rngP(['round', 'sprawl', 'bare']), c: rngP(['#2a4a1a', '#3a5a20', '#1a3a10']),
    });
    if (rng() < 0.35) world.trees.push({
      x: bx + BLOCK - SIDEWALK * 0.5, y: y + rngR(-4, 4), r: rngR(14, 24),
      type: rngP(['round', 'sprawl', 'bare']), c: rngP(['#2a4a1a', '#3a5a20', '#1a3a10']),
    });
  }
  const lps = [
    { x: bx + 15, y: by + 15 }, { x: bx + BLOCK - 15, y: by + 15 },
    { x: bx + 15, y: by + BLOCK - 15 }, { x: bx + BLOCK - 15, y: by + BLOCK - 15 },
  ];
  for (const p of lps) if (rng() < 0.6) world.lamps.push({ x: p.x, y: p.y });

  for (let k = 0; k < rngI(1, 3); k++) {
    const side = rngI(0, 3);
    let x, y;
    if (side === 0) { x = bx + rngR(20, BLOCK - 20); y = by + SIDEWALK * 0.6; }
    else if (side === 1) { x = bx + rngR(20, BLOCK - 20); y = by + BLOCK - SIDEWALK * 0.6; }
    else if (side === 2) { x = bx + SIDEWALK * 0.6; y = by + rngR(20, BLOCK - 20); }
    else { x = bx + BLOCK - SIDEWALK * 0.6; y = by + rngR(20, BLOCK - 20); }
    world.trashCans.push({ x, y });
  }
  for (let k = 0; k < rngI(0, 2); k++) {
    const side = rngI(0, 3);
    let x, y, a;
    if (side === 0) { x = bx + rngR(40, BLOCK - 40); y = by + SIDEWALK * 0.7; a = 0; }
    else if (side === 1) { x = bx + rngR(40, BLOCK - 40); y = by + BLOCK - SIDEWALK * 0.7; a = Math.PI; }
    else if (side === 2) { x = bx + SIDEWALK * 0.7; y = by + rngR(40, BLOCK - 40); a = Math.PI / 2; }
    else { x = bx + BLOCK - SIDEWALK * 0.7; y = by + rngR(40, BLOCK - 40); a = -Math.PI / 2; }
    world.benches.push({ x, y, a });
  }
  const parkSlots = rngI(1, 3);
  for (let k = 0; k < parkSlots; k++) {
    const side = rngI(0, 3);
    let x, y, a;
    if (side === 0) { x = bx + rngR(80, BLOCK - 80); y = by - ROAD / 2 - 20; a = Math.PI; }
    else if (side === 1) { x = bx + rngR(80, BLOCK - 80); y = by + BLOCK + ROAD / 2 + 20; a = 0; }
    else if (side === 2) { x = bx - ROAD / 2 - 20; y = by + rngR(80, BLOCK - 80); a = Math.PI / 2; }
    else { x = bx + BLOCK + ROAD / 2 + 20; y = by + rngR(80, BLOCK - 80); a = -Math.PI / 2; }
    const colors = ['#c0c0c0', '#802020', '#203080', '#305030', '#802050', '#404040', '#a0a090', '#d0c090'];
    const rusty = rng() < 0.25;
    const rustSpots = [];
    if (rusty) {
      for (let r = 0; r < 4; r++) {
        rustSpots.push({
          rx: rngR(-15, 15),
          ry: rngR(-32, 32),
          rad: 2 + rng() * 3,
        });
      }
    }
    world.parkedCars.push({
      x, y, a,
      color: rusty ? rngP(['#6a5a40', '#7a6040', '#5a4020']) : rngP(colors),
      rusty,
      rustSpots,
    });
  }
  if (rng() < 0.3) world.hydrants.push({ x: bx + SIDEWALK * 0.5 + rngR(-4, 4), y: by + rngR(60, BLOCK - 60) });
  if (rng() < 0.2) world.mailboxes.push({ x: bx + rngR(30, BLOCK - 30), y: by + SIDEWALK * 0.6 });
  for (let k = 0; k < rngI(0, 4); k++) {
    world.bushes.push({
      x: bx + rngR(20, BLOCK - 20), y: by + rngR(20, BLOCK - 20),
      r: rngR(6, 12), c: rngP(['#1a3a10', '#2a4a1a', '#3a4a20']),
    });
  }
  if (rng() < 0.15) {
    world.kiosks.push({
      x: bx + rngR(50, BLOCK - 80), y: by + SIDEWALK * 0.4,
      w: 60, h: 40, label: rngP(['ПРОДУКТЫ', '24 ЧАСА', 'ТАБАК']),
    });
  }
}

function addBuilding(x, y, w, h, type) {
  const shade = rngR(0.5, 0.75);
  const base = rngP(['#8a8a82', '#7a7a72', '#6a6a62', '#9a9a92', '#858580']);
  world.buildings.push({
    x, y, w, h, type,
    color: base, shade,
    roof: rngP(['#5a5a52', '#4a4a44', '#6a6a62']),
    windows: rngI(3, 8),
    hasAntenna: rng() < 0.6,
    hasAC: rng() < 0.5,
    hasDish: rng() < 0.3,
    hasVent: rng() < 0.4,
  });
}

function generateResidential(x, y, w, h) {
  const layout = rngP(['grid2', 'grid3', 'single', 'L']);
  if (layout === 'single') {
    addBuilding(x + 10, y + 10, w - 20, h - 20, 'residential');
  } else if (layout === 'grid2') {
    const hw = (w - 20) / 2;
    addBuilding(x + 8, y + 8, hw - 6, h - 16, 'residential');
    addBuilding(x + hw + 8, y + 8, hw - 6, h - 16, 'residential');
  } else if (layout === 'grid3') {
    const th = (h - 20) / 3;
    for (let i = 0; i < 3; i++) addBuilding(x + 8, y + 8 + i * th + 3, w - 16, th - 6, 'residential');
  } else {
    addBuilding(x + 8, y + 8, w * 0.55, h * 0.55, 'residential');
    addBuilding(x + w * 0.55 + 12, y + 8, w * 0.42, h * 0.55, 'residential');
    addBuilding(x + 8, y + h * 0.55 + 12, w - 16, h * 0.4, 'residential');
  }
  for (let k = 0; k < rngI(2, 5); k++) {
    world.props.push({
      x: x + rng() * w, y: y + rng() * h,
      type: rngP(['crate', 'barrel', 'trash', 'tire']),
    });
  }
}

function generatePark(x, y, w, h) {
  const blades = [];
  for (let i = 0; i < 40; i++) {
    blades.push({ gx: x + rng() * w, gy: y + rng() * h });
  }
  world.grassPatches.push({ x, y, w, h, blades });
  for (let k = 0; k < 12; k++) world.trees.push({
    x: x + 20 + rng() * (w - 40), y: y + 20 + rng() * (h - 40),
    r: rngR(18, 32), type: rngP(['round', 'sprawl', 'round']),
    c: rngP(['#2a4a1a', '#3a5a20', '#1a3a10']),
  });
  for (let k = 0; k < 4; k++) world.benches.push({
    x: x + 30 + rng() * (w - 60), y: y + 30 + rng() * (h - 60),
    a: rng() * Math.PI * 2,
  });
  for (let k = 0; k < 5; k++) world.trashCans.push({
    x: x + 20 + rng() * (w - 40), y: y + 20 + rng() * (h - 40),
  });
  for (let k = 0; k < 8; k++) world.bushes.push({
    x: x + 20 + rng() * (w - 40), y: y + 20 + rng() * (h - 40),
    r: rngR(8, 16), c: rngP(['#1a3a10', '#2a4a1a', '#3a4a20']),
  });
}

function generateParkingLot(x, y, w, h) {
  const cols = Math.floor(w / 50);
  const rows = Math.floor(h / 60);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.4) {
        const px = x + 20 + c * 50 + 25;
        const py = y + 20 + r * 60 + 30;
        if (px + 20 < x + w - 10 && py + 30 < y + h - 10) {
          const colors = ['#c0c0c0', '#802020', '#203080', '#305030', '#802050', '#404040', '#a0a090', '#d0c090'];
          const rusty = rng() < 0.3;
          const rustSpots = [];
          if (rusty) {
            for (let k = 0; k < 4; k++) {
              rustSpots.push({ rx: rngR(-15, 15), ry: rngR(-32, 32), rad: 2 + rng() * 3 });
            }
          }
          world.parkedCars.push({
            x: px, y: py, a: 0,
            color: rusty ? rngP(['#6a5a40', '#7a6040', '#5a4020']) : rngP(colors),
            rusty,
            rustSpots,
          });
        }
      }
    }
  }
  for (let k = 0; k < 3; k++) world.trashCans.push({
    x: x + rng() * w, y: y + rng() * h,
  });
}

function generateIndustrial(x, y, w, h) {
  const hw = (w - 20) / 2;
  addBuilding(x + 8, y + 8, hw - 6, h - 16, 'industrial');
  addBuilding(x + hw + 8, y + 8, hw - 6, h - 16, 'industrial');
  for (let k = 0; k < 6; k++) world.props.push({
    x: x + rng() * w, y: y + rng() * h,
    type: rngP(['barrel', 'crate', 'pile']),
  });
  world.fences.push({ x: x + 5, y: y + 5, w: w - 10, h: h - 10 });
}

// ─── МАШИНА ───────────────────────────────────────────────────
const car = {
  x: WORLD_SIZE / 2 + ROAD / 2,
  y: WORLD_SIZE / 2 + ROAD / 2,
  angle: 0,
  vx: 0, vy: 0,
  vFwd: 0, vRight: 0,
  wheelSpin: 0,
  driftPhase: 0,
  w: 42, h: 82,
};

const getMaxSpeed   = () => UPGRADES.engine.effect[state.upgrades.engine];
const getSteerRate  = () => UPGRADES.handling.effect[state.upgrades.handling];
const getBrakeForce = () => UPGRADES.brakes.effect[state.upgrades.brakes];

function updateCar(dt) {
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
  let vFwd = car.vx * cos + car.vy * sin;
  let vRight = -car.vx * sin + car.vy * cos;

  const accelIn = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const steerIn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  const handbrake = !!keys.Space;
  const nitroKey = !!(keys.ShiftLeft || keys.ShiftRight);
  const canNitro = nitroKey && state.nitro > 0 && vFwd > 0;

  if (accelIn > 0 && !handbrake) vFwd += 400 * (canNitro ? 1.6 : 1) * dt;
  else if (accelIn < 0) {
    if (vFwd > 20) vFwd -= getBrakeForce() * dt;
    else vFwd -= 200 * dt;
  }

  vFwd *= Math.pow(0.985, dt * 60);
  if (Math.abs(vFwd) < 3 && accelIn === 0) vFwd = 0;
  vRight *= Math.pow(handbrake ? 0.94 : 0.75, dt * 60);

  if (Math.abs(vFwd) > 20) {
    const sf = Math.min(Math.abs(vFwd) / 100, 1);
    car.angle += steerIn * getSteerRate() * sf * Math.sign(vFwd) * dt;
  }

  if (canNitro) {
    state.nitro = Math.max(0, state.nitro - 30 * dt);
    vFwd = Math.min(vFwd, getMaxSpeed() * 1.35);
  } else {
    state.nitro = Math.min(100, state.nitro + 8 * dt);
  }

  const maxSpd = getMaxSpeed() * (canNitro ? 1.35 : 1);
  if (Math.abs(vFwd) > maxSpd) vFwd = Math.sign(vFwd) * maxSpd;

  const ncos = Math.cos(car.angle), nsin = Math.sin(car.angle);
  car.vx = vFwd * ncos - vRight * nsin;
  car.vy = vFwd * nsin + vRight * ncos;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  car.x = Math.max(20, Math.min(WORLD_SIZE - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD_SIZE - 20, car.y));

  for (const b of world.buildings) {
    const closestX = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - closestX;
    const dy = car.y - closestY;
    const distSq = dx * dx + dy * dy;
    const radius = 22;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = radius - dist;
      car.x += nx * overlap;
      car.y += ny * overlap;
      const vn = car.vx * nx + car.vy * ny;
      if (vn < 0) {
        car.vx -= 1.3 * vn * nx;
        car.vy -= 1.3 * vn * ny;
      }
    }
  }

  if (Math.abs(vRight) > 30 && Math.abs(vFwd) > 60) {
    state.score += 10 * dt;
    car.driftPhase += dt * 20;
    spawnDriftParticles();
  } else {
    car.driftPhase *= 0.9;
  }

  car.wheelSpin += vFwd * dt * 0.1;
  car.vFwd = vFwd;
  car.vRight = vRight;

  for (const npc of npcs) {
    if (!npc.alive) continue;
    const dx = npc.x - car.x, dy = npc.y - car.y;
    if (dx * dx + dy * dy < 900 && Math.hypot(car.vx, car.vy) > 100) {
      npc.alive = false;
      npc.respawnTimer = 10;
      npc.fallProgress = 0;
      npc.fallAngle = Math.atan2(car.vy, car.vx);
      state.score += 50;
      popScore();
      playHitSound();
      spawnBloodParticles(npc.x, npc.y);
    }
  }
}

// ─── NPC ──────────────────────────────────────────────────────
const npcs = [];
const npcColors = ['#553333', '#334455', '#443355', '#555533', '#663333', '#445544'];
const npcScarf = ['#aa3333', '#bb4444', '#883333', '#cc5555', '#774444'];

function spawnNPCs() {
  npcs.length = 0;
  for (let i = 0; i < 40; i++) {
    npcs.push(createNPC());
  }
}

function createNPC() {
  const side = rngI(0, 3);
  let x, y;
  if (side === 0) { x = rng() * WORLD_SIZE; y = rng() * 100; }
  else if (side === 1) { x = rng() * WORLD_SIZE; y = WORLD_SIZE - rng() * 100; }
  else if (side === 2) { x = rng() * 100; y = rng() * WORLD_SIZE; }
  else { x = WORLD_SIZE - rng() * 100; y = rng() * WORLD_SIZE; }
  return {
    x, y, angle: rng() * Math.PI * 2,
    targetX: rng() * WORLD_SIZE, targetY: rng() * WORLD_SIZE,
    speed: 30 + rng() * 25,
    alive: true, respawnTimer: 0,
    bob: rng() * Math.PI * 2,
    fallAngle: 0, fallProgress: 0,
    dressColor: rngP(npcColors),
    scarfColor: rngP(npcScarf),
    skin: '#dcb090',
  };
}

function updateNPCs(dt) {
  for (const npc of npcs) {
    if (!npc.alive) {
      npc.respawnTimer -= dt;
      npc.fallProgress = Math.min(1, npc.fallProgress + dt * 3);
      if (npc.respawnTimer <= 0) {
        Object.assign(npc, createNPC());
      }
      continue;
    }
    const dx = npc.targetX - npc.x, dy = npc.targetY - npc.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) {
      npc.targetX = rng() * WORLD_SIZE;
      npc.targetY = rng() * WORLD_SIZE;
    } else {
      npc.x += (dx / d) * npc.speed * dt;
      npc.y += (dy / d) * npc.speed * dt;
      npc.angle = Math.atan2(dy, dx);
      npc.bob += dt * 8;
    }
  }
}

// ─── ПАРТИКЛЫ ─────────────────────────────────────────────────
const particles = [];
function spawnDriftParticles() {
  if (particles.length > 200) return;
  particles.push({
    x: car.x + (Math.random() - 0.5) * 30,
    y: car.y + (Math.random() - 0.5) * 30,
    vx: (Math.random() - 0.5) * 40 - car.vx * 0.1,
    vy: (Math.random() - 0.5) * 40 - car.vy * 0.1,
    life: 0.6 + Math.random() * 0.4,
    maxLife: 1,
    color: 'rgba(200,200,200,',
    size: 3 + Math.random() * 4,
  });
}
function spawnBloodParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      color: 'rgba(140,20,20,',
      size: 3 + Math.random() * 3,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ─── КАМЕРА ───────────────────────────────────────────────────
const camera = { x: 0, y: 0 };

function updateCamera(dt) {
  const lookAheadX = car.vx * 0.3;
  const lookAheadY = car.vy * 0.3;
  const targetX = car.x + lookAheadX;
  const targetY = car.y + lookAheadY;
  camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
  camera.y += (targetY - camera.y) * Math.min(1, dt * 6);
}

// ─── РЕНДЕР ───────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#2a2a28';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.translate(viewW / 2 - camera.x, viewH / 2 - camera.y);

  drawGround();
  drawRoadDetails();
  drawCrosswalks();
  drawBlocks();
  drawGrassPatches();
  drawParkedCars();
  drawSidewalkObjects();
  drawParticles();
  drawNPCs();
  drawCar();
  drawFences();

  ctx.restore();

  drawMinimap();
  drawTutorialArrows();
}

function drawGround() {
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  for (const b of world.blocks) {
    ctx.fillStyle = '#4a4a48';
    ctx.fillRect(b.x - ROAD / 2, b.y - ROAD / 2, b.w + ROAD, b.h + ROAD);
    ctx.fillStyle = '#858580';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
}

function drawRoadDetails() {
  for (const p of world.patches) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  for (const o of world.oilStains) {
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    g.addColorStop(0, 'rgba(10,10,10,0.7)');
    g.addColorStop(1, 'rgba(10,10,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#d0b040';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 20]);
  for (let i = 0; i <= GRID; i++) {
    const p = i * CELL;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, WORLD_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(WORLD_SIZE, p);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(15,15,15,0.7)';
  ctx.lineWidth = 1.5;
  for (const c of world.cracks) {
    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < c.length; i++) ctx.lineTo(c[i].x, c[i].y);
    ctx.stroke();
  }
  for (const p of world.puddles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = 'rgba(50,70,90,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,180,200,0.25)';
    ctx.beginPath();
    ctx.ellipse(-p.rx * 0.3, -p.ry * 0.3, p.rx * 0.4, p.ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const m of world.manholes) {
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = '#3a3a3a';
    for (let k = -8; k <= 8; k += 4) {
      ctx.beginPath();
      ctx.moveTo(m.x - 10, m.y + k);
      ctx.lineTo(m.x + 10, m.y + k);
      ctx.stroke();
    }
  }
  for (const d of world.drains) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(d.x - 10, d.y - 4, 20, 8);
  }
  for (const a of world.arrows) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.fillStyle = '#d0b040';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-8, 4);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const l of world.leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.a);
    ctx.fillStyle = l.c;
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
}

function drawCrosswalks() {
  ctx.fillStyle = '#ddd';
  for (const c of world.crosswalks) {
    if (c.dir === 'h') {
      for (let x = c.x; x < c.x + c.w; x += 12) {
        ctx.fillRect(x, c.y, 6, c.h);
      }
    } else {
      for (let y = c.y; y < c.y + c.h; y += 12) {
        ctx.fillRect(c.x, y, c.w, 6);
      }
    }
  }
}

function drawBlocks() {
  for (const b of world.blocks) {
    ctx.fillStyle = '#858580';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(50,50,50,0.15)';
    ctx.lineWidth = 1;
    for (let x = b.x; x < b.x + b.w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x, b.y + b.h);
      ctx.stroke();
    }
    for (let y = b.y; y < b.y + b.h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.lineTo(b.x + b.w, y);
      ctx.stroke();
    }
  }
  for (const b of world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 3; k++) {
      const wx = b.x + 15 + k * (b.w - 30) / 3;
      ctx.fillRect(wx, b.y + b.h * 0.3, 10, 10);
    }
    if (b.hasAntenna) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.7, b.y + b.h * 0.5);
      ctx.lineTo(b.x + b.w * 0.7, b.y - 15);
      ctx.stroke();
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.7, b.y - 15, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.hasDish) {
      ctx.fillStyle = '#c0c0c0';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (b.hasVent) {
      ctx.fillStyle = '#555';
      ctx.fillRect(b.x + b.w * 0.5, b.y + b.h * 0.7, 14, 14);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function drawGrassPatches() {
  for (const g of world.grassPatches) {
    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = 'rgba(20,40,15,0.5)';
    ctx.lineWidth = 1;
    for (const bl of g.blades) {
      ctx.beginPath();
      ctx.moveTo(bl.gx, bl.gy);
      ctx.lineTo(bl.gx + 2, bl.gy - 4);
      ctx.stroke();
    }
  }
}

function drawTree(t) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(t.x + 4, t.y + 4, t.r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3520';
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  if (t.type === 'bare') {
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = t.c;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBush(b) {
  ctx.fillStyle = b.c;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLamp(l) {
  ctx.fillStyle = '#2a2a28';
  ctx.beginPath();
  ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 40);
  g.addColorStop(0, 'rgba(255,200,100,0.15)');
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(l.x, l.y, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffeeaa';
  ctx.beginPath();
  ctx.arc(l.x, l.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrashCan(t) {
  ctx.fillStyle = '#4a4a44';
  ctx.beginPath();
  ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a34';
  ctx.beginPath();
  ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2a24';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBench(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.a);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(-18, -5, 36, 10);
  ctx.fillStyle = '#4a3520';
  ctx.fillRect(-16, -3, 32, 2);
  ctx.fillRect(-16, 1, 32, 2);
  ctx.restore();
}

function drawHydrant(h) {
  ctx.fillStyle = '#c03020';
  ctx.beginPath();
  ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a02010';
  ctx.beginPath();
  ctx.arc(h.x, h.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawMailbox(m) {
  ctx.fillStyle = '#204a80';
  ctx.fillRect(m.x - 6, m.y - 8, 12, 16);
  ctx.fillStyle = '#103060';
  ctx.fillRect(m.x - 4, m.y - 5, 8, 10);
}

function drawKiosk(k) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(k.x + 4, k.y + 4, k.w, k.h);
  ctx.fillStyle = '#7a5a30';
  ctx.fillRect(k.x, k.y, k.w, k.h);
  ctx.fillStyle = '#a08050';
  ctx.fillRect(k.x + 3, k.y + 3, k.w - 6, k.h * 0.6);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(k.x + 8, k.y + 8, k.w - 16, k.h * 0.4);
  ctx.fillStyle = '#d88b4a';
  ctx.fillRect(k.x + 4, k.y + k.h - 12, k.w - 8, 8);
}

function drawProp(p) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 2, 10, 0, Math.PI * 2);
  ctx.fill();
  if (p.type === 'crate') {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    ctx.strokeStyle = '#4a3020';
    ctx.strokeRect(p.x - 8, p.y - 8, 16, 16);
  } else if (p.type === 'barrel') {
    ctx.fillStyle = '#7a3a2a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a2a1a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'trash') {
    ctx.fillStyle = '#4a4a44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'tire') {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5a5a55';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParkedCar(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.a);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-18, -36, 36, 72);
  ctx.fillStyle = c.color;
  roundRect(-18, -36, 36, 72, 4);
  ctx.fill();
  ctx.fillStyle = c.rusty ? '#222' : '#2a4050';
  ctx.fillRect(-14, -20, 28, 12);
  ctx.fillRect(-14, 8, 28, 12);
  if (c.rusty && c.rustSpots) {
    ctx.fillStyle = 'rgba(90,40,20,0.6)';
    for (const sp of c.rustSpots) {
      ctx.beginPath();
      ctx.arc(sp.rx, sp.ry, sp.rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-20, -28, 4, 12);
  ctx.fillRect(-20, 16, 4, 12);
  ctx.fillRect(16, -28, 4, 12);
  ctx.fillRect(16, 16, 4, 12);
  ctx.restore();
}

function drawSidewalkObjects() {
  for (const b of world.bushes) drawBush(b);
  for (const t of world.trees) drawTree(t);
  for (const l of world.lamps) drawLamp(l);
  for (const t of world.trashCans) drawTrashCan(t);
  for (const b of world.benches) drawBench(b);
  for (const h of world.hydrants) drawHydrant(h);
  for (const m of world.mailboxes) drawMailbox(m);
  for (const k of world.kiosks) drawKiosk(k);
  for (const p of world.props) drawProp(p);
}

function drawParkedCars() {
  for (const c of world.parkedCars) drawParkedCar(c);
}

function drawFences() {
  for (const f of world.fences) {
    ctx.strokeStyle = '#3a3a38';
    ctx.lineWidth = 3;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
  }
}

function drawNPCs() {
  for (const npc of npcs) {
    if (!npc.alive) {
      ctx.save();
      ctx.translate(npc.x, npc.y);
      ctx.rotate(npc.fallAngle);
      ctx.globalAlpha = 1 - npc.fallProgress * 0.5;
      ctx.fillStyle = npc.dressColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = npc.scarfColor;
      ctx.beginPath();
      ctx.arc(12, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.rotate(npc.angle + Math.PI / 2);

    const bob = Math.sin(npc.bob) * 0.1;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = npc.dressColor;
    ctx.beginPath();
    ctx.ellipse(0, 2 + bob, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = npc.scarfColor;
    ctx.beginPath();
    ctx.arc(0, -4 + bob, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = npc.skin;
    ctx.beginPath();
    ctx.arc(0, -4 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, 0 + bob);
    ctx.lineTo(9, 14 + bob);
    ctx.stroke();

    ctx.fillStyle = '#ddcc88';
    ctx.beginPath();
    ctx.arc(-9, 4 + bob, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle + Math.PI / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(-26, -46, 52, 92, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(-23, -43, 46, 86, 8);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-24, -30, 6, 14);
  ctx.fillRect(-24, 16, 6, 14);
  ctx.fillRect(18, -30, 6, 14);
  ctx.fillRect(18, 16, 6, 14);

  ctx.fillStyle = '#6a9ed0';
  roundRect(-21, -42, 42, 84, 6);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(-21, 0, 21, 0);
  bodyGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  bodyGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = bodyGrad;
  roundRect(-21, -42, 42, 84, 6);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  roundRect(-21, -42, 42, 84, 6);
  ctx.clip();
  ctx.fillStyle = '#f0f0f0';
  ctx.save();
  ctx.translate(0, -28);
  ctx.rotate(-Math.PI / 6);
  ctx.fillRect(-30, -6, 60, 12);
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = '#1a2830';
  ctx.beginPath();
  ctx.moveTo(-16, -14);
  ctx.lineTo(16, -14);
  ctx.lineTo(18, -2);
  ctx.lineTo(-18, -2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-16, 16);
  ctx.lineTo(16, 16);
  ctx.lineTo(14, 26);
  ctx.lineTo(-14, 26);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#253040';
  ctx.fillRect(-19, -2, 5, 20);
  ctx.fillRect(14, -2, 5, 20);

  ctx.fillStyle = '#5a8ec0';
  roundRect(-15, -4, 30, 22, 2);
  ctx.fill();

  ctx.fillStyle = '#ffeeaa';
  ctx.beginPath();
  ctx.arc(-12, -38, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(12, -38, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(-10, -40, 20, 4);
  ctx.fillStyle = '#888';
  for (let x = -8; x < 10; x += 3) ctx.fillRect(x, -39, 1, 2);

  ctx.fillStyle = '#cc2222';
  ctx.fillRect(-15, 38, 6, 4);
  ctx.fillRect(9, 38, 6, 4);

  ctx.fillStyle = '#fff';
  ctx.fillRect(-8, 36, 16, 5);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 4px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('А 001 АА', 0, 40);

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color + (alpha * 0.8) + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMinimap() {
  const size = 140, pad = 15;
  const mx = viewW - size - pad, my = pad;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = '#d88b4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, size, size);
  const sc = size / WORLD_SIZE;
  ctx.fillStyle = '#4a4a48';
  for (const b of world.blocks) {
    ctx.fillRect(mx + b.x * sc, my + b.y * sc, b.w * sc, b.h * sc);
  }
  ctx.fillStyle = '#aa3333';
  for (const n of npcs) {
    if (n.alive) ctx.fillRect(mx + n.x * sc - 1, my + n.y * sc - 1, 2, 2);
  }
  ctx.fillStyle = '#4a90d9';
  ctx.beginPath();
  ctx.arc(mx + car.x * sc, my + car.y * sc, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTutorialArrows() {
  // Не рисуем — оставлено на будущее
}

// ─── UI ───────────────────────────────────────────────────────
const ui = {
  menu: document.getElementById('menu'),
  upgradeScreen: document.getElementById('upgradeScreen'),
  settingsScreen: document.getElementById('settingsScreen'),
  hud: document.getElementById('hud'),
  scoreVal: document.getElementById('scoreVal'),
  speedVal: document.getElementById('speedVal'),
  upgScore: document.getElementById('upgScore'),
  upgradeList: document.getElementById('upgradeList'),
  scoreEl: document.getElementById('score'),
  nitroFill: document.getElementById('nitroFill'),
  introOverlay: document.getElementById('introOverlay'),
  volumeInput: document.getElementById('volumeInput') || document.getElementById('volumeSlider') || document.querySelector('input[type="range"]'),
};

function showScreen(name) {
  if (ui.menu) ui.menu.classList.add('hidden');
  if (ui.upgradeScreen) ui.upgradeScreen.classList.add('hidden');
  if (ui.settingsScreen) ui.settingsScreen.classList.add('hidden');
  if (ui.hud) ui.hud.style.display = 'none';

  if (name === 'menu' && ui.menu) ui.menu.classList.remove('hidden');
  else if (name === 'upgrade' && ui.upgradeScreen) {
    ui.upgradeScreen.classList.remove('hidden');
    renderUpgrades();
  } else if (name === 'settings' && ui.settingsScreen) {
    ui.settingsScreen.classList.remove('hidden');
    if (ui.volumeInput) ui.volumeInput.value = state.settings.volume;
  } else if (name === 'game' && ui.hud) {
    ui.hud.style.display = 'block';
  }
  state.screen = name;
  if (name !== 'game' && engineGain && audioCtx) {
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  }
}

function updateHUD() {
  if (ui.scoreVal) ui.scoreVal.textContent = Math.floor(state.score);
  if (ui.speedVal) ui.speedVal.textContent = Math.round(Math.hypot(car.vx, car.vy) / 2.5);
  if (ui.nitroFill) ui.nitroFill.style.width = state.nitro + '%';
}

function popScore() {
  if (!ui.scoreEl) return;
  ui.scoreEl.classList.add('pop');
  setTimeout(() => ui.scoreEl.classList.remove('pop'), 150);
}

function renderUpgrades() {
  if (!ui.upgradeList) return;
  if (ui.upgScore) ui.upgScore.textContent = Math.floor(state.score);
  ui.upgradeList.innerHTML = '';
  for (const key of Object.keys(UPGRADES)) {
    const up = UPGRADES[key], lvl = state.upgrades[key];
    const row = document.createElement('div');
    row.className = 'upgrade-row';
    let btn;
    if (lvl >= up.max) btn = `<button disabled>MAX</button>`;
    else {
      const cost = up.cost[lvl];
      btn = `<button data-key="${key}" ${state.score >= cost ? '' : 'disabled'}>Купить (${cost})</button>`;
    }
    row.innerHTML = `<div><b>${up.name}</b><br><small>Ур. ${lvl}/${up.max} · ${up.effect[lvl]}</small></div>${btn}`;
    ui.upgradeList.appendChild(row);
  }
  ui.upgradeList.querySelectorAll('button[data-key]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key, up = UPGRADES[key], lvl = state.upgrades[key];
      if (lvl >= up.max || state.score < up.cost[lvl]) return;
      state.score -= up.cost[lvl];
      state.upgrades[key] = lvl + 1;
      saveProgress();
      renderUpgrades();
      updateHUD();
    };
  });
}

if (ui.volumeInput) {
  ui.volumeInput.value = state.settings.volume;
  ui.volumeInput.addEventListener('input', () => {
    state.settings.volume = Math.max(0, Math.min(100, Number(ui.volumeInput.value) || 0));
    saveProgress();
  });
}

const bindClick = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
};

bindClick('btn-play', () => {
  initAudio();
  if (!state.introShown && ui.introOverlay) {
    ui.introOverlay.style.display = 'flex';
    requestAnimationFrame(() => ui.introOverlay.classList.add('visible'));
    state.introTimer = INTRO_DURATION;
    state.introShown = true;
  }
  showScreen('game');
});
bindClick('btn-upgrade', () => showScreen('upgrade'));
bindClick('btn-settings', () => showScreen('settings'));
bindClick('btn-upgrade-back', () => showScreen('menu'));
bindClick('btn-settings-back', () => showScreen('menu'));

// ─── ЗВУК ─────────────────────────────────────────────────────
let audioCtx = null, engineOsc = null, engineGain = null;

function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = audioCtx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = audioCtx.createGain();
      engineGain.gain.value = 0;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      engineOsc.connect(filter).connect(engineGain).connect(audioCtx.destination);
      engineOsc.start();
    } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function updateAudio(speed) {
  if (!audioCtx || !engineOsc || !engineGain) return;
  const vol = state.settings.volume / 100;
  engineOsc.frequency.setTargetAtTime(45 + Math.abs(speed) * 0.3, audioCtx.currentTime, 0.1);
  engineGain.gain.setTargetAtTime(Math.min(Math.abs(speed) / 400, 0.08) * vol, audioCtx.currentTime, 0.1);
}

function playHitSound() {
  if (!audioCtx) return;
  const vol = state.settings.volume / 100;
  if (vol <= 0) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'square';
  o.frequency.value = 400;
  o.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.15);
  g.gain.value = 0.15 * vol;
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.21);
}

// ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────
generateWorld();
spawnNPCs();
camera.x = car.x;
camera.y = car.y;
updateHUD();

// ─── ИГРОВОЙ ЦИКЛ ─────────────────────────────────────────────
let lastTime = performance.now();
let hudTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (state.introTimer > 0 && ui.introOverlay) {
    state.introTimer -= dt;
    if (state.introTimer <= 0) {
      ui.introOverlay.classList.remove('visible');
      setTimeout(() => { ui.introOverlay.style.display = 'none'; }, 400);
    }
  }

  if (state.screen === 'game') {
    updateCar(dt);
    updateNPCs(dt);
    updateParticles(dt);
    updateCamera(dt);
    updateAudio(Math.hypot(car.vx, car.vy));

    hudTimer += dt;
    if (hudTimer > 0.15) { updateHUD(); hudTimer = 0; }
  } else if (state.screen === 'menu') {
    camera.x += Math.cos(now * 0.0003) * 0.5;
    camera.y += Math.sin(now * 0.0003) * 0.5;
  }

  render();
}

requestAnimationFrame(animate);

console.log('%c🚗 Симулятор Копейки — Top-Down Edition', 'color:#6a9ed0;font-size:16px;font-weight:bold');
