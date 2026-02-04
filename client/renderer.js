// Canvas Renderer for Moltdefense

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game configuration (can be updated from server via setConfig)
let config = {
  pathLength: 1000,
  canvasWidth: 800,
  canvasHeight: 200,
  towerPositions: { A: 100, B: 300, C: 500, D: 700, E: 900 }
};

// Game constants (derived from config)
let PATH_LENGTH = config.pathLength;
let TOWER_POSITIONS = config.towerPositions;

// Visual constants
let CANVAS_WIDTH = config.canvasWidth;
let CANVAS_HEIGHT = config.canvasHeight;
const PATH_Y = 100;
const PATH_HEIGHT = 20;

// Set configuration from server (called by socket.js)
function setConfig(serverConfig) {
  if (!serverConfig) return;

  // Update config
  if (serverConfig.map) {
    config.pathLength = serverConfig.map.pathLength || 1000;
    config.canvasWidth = serverConfig.map.canvasWidth || 800;
    config.canvasHeight = serverConfig.map.canvasHeight || 200;

    // Update tower positions from tower zones
    if (serverConfig.map.towerZones) {
      config.towerPositions = {};
      serverConfig.map.towerZones.forEach(zone => {
        config.towerPositions[zone.id] = zone.x;
      });
    }
  }

  // Update derived constants
  PATH_LENGTH = config.pathLength;
  TOWER_POSITIONS = config.towerPositions;
  CANVAS_WIDTH = config.canvasWidth;
  CANVAS_HEIGHT = config.canvasHeight;

  // Update canvas dimensions if needed
  if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
  }

  console.log('Renderer config updated:', config);
}

// Colors
const COLORS = {
  background: '#0a0a12',
  path: '#1a2a3a',
  pathBorder: '#2d4059',

  // Tower colors
  tower_basic: '#3498db',
  tower_slow: '#9b59b6',
  tower_burst: '#e74c3c',
  tower_chain: '#e67e22',
  tower_sniper: '#1abc9c',
  tower_support: '#f1c40f',
  tower_range: 'rgba(255, 255, 255, 0.05)',

  // Enemy colors
  enemy_runner: '#2ecc71',
  enemy_tank: '#f39c12',
  enemy_swarm_unit: '#1abc9c',
  enemy_healer: '#e91e63',
  enemy_shieldBearer: '#00bcd4',
  enemy_regenerator: '#8bc34a',
  enemy_boss: '#ff5722',

  healthBar: '#e74c3c',
  healthBarBg: '#333',
  healthBarFull: '#2ecc71',

  text: '#ffffff',
  textDim: '#666666',

  startMarker: '#2ecc71',
  endMarker: '#e74c3c'
};

// Convert game position (0-1000) to canvas X coordinate
function gameToCanvasX(position) {
  return (position / PATH_LENGTH) * CANVAS_WIDTH;
}

// Projectile system
let projectiles = [];
let lastProjectileUpdate = performance.now();

// Create a new projectile animation
function createProjectile(fromX, fromY, toX, toY, towerType) {
  projectiles.push({
    fromX, fromY, toX, toY,
    progress: 0,
    type: towerType,
    createdAt: performance.now()
  });
}

// Update projectile positions
function updateProjectiles(deltaTime) {
  // Filter out completed projectiles and update active ones
  projectiles = projectiles.filter(p => {
    p.progress += (deltaTime / 1000) * 8; // ~125ms travel time
    return p.progress < 1;
  });
}

// Draw all active projectiles
function drawProjectiles() {
  for (const p of projectiles) {
    // Interpolate position
    const x = p.fromX + (p.toX - p.fromX) * p.progress;
    const y = p.fromY + (p.toY - p.fromY) * p.progress;

    // Draw projectile with tower color
    const color = COLORS[`tower_${p.type}`] || '#fff';

    // Outer glow
    ctx.fillStyle = color + '44'; // Semi-transparent
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Inner core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bright center
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Clear the canvas
function clear() {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw the path
function drawPath() {
  const pathTop = PATH_Y - PATH_HEIGHT / 2;

  // Path background
  ctx.fillStyle = COLORS.path;
  ctx.fillRect(0, pathTop, CANVAS_WIDTH, PATH_HEIGHT);

  // Path border
  ctx.strokeStyle = COLORS.pathBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, pathTop, CANVAS_WIDTH, PATH_HEIGHT);

  // Start marker
  ctx.fillStyle = COLORS.startMarker;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('START', 10, pathTop - 8);

  // End marker
  ctx.fillStyle = COLORS.endMarker;
  ctx.textAlign = 'right';
  ctx.fillText('END', CANVAS_WIDTH - 10, pathTop - 8);

  // Draw arrow indicating direction
  ctx.strokeStyle = COLORS.textDim;
  ctx.lineWidth = 1;
  for (let x = 100; x < CANVAS_WIDTH - 50; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, PATH_Y);
    ctx.lineTo(x + 20, PATH_Y);
    ctx.lineTo(x + 15, PATH_Y - 5);
    ctx.moveTo(x + 20, PATH_Y);
    ctx.lineTo(x + 15, PATH_Y + 5);
    ctx.stroke();
  }
}

// Draw tower slots
function drawTowerSlots() {
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textDim;

  for (const [slot, position] of Object.entries(TOWER_POSITIONS)) {
    const x = gameToCanvasX(position);
    const y = slot.charCodeAt(0) % 2 === 0 ? 50 : 150; // A,C,E above; B,D below

    // Draw slot indicator
    ctx.strokeStyle = COLORS.textDim;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw slot label
    ctx.fillText(slot, x, y + 4);
  }
}

// Draw towers
function drawTowers(towers) {
  if (!towers || !Array.isArray(towers)) return;

  for (let i = 0; i < towers.length; i++) {
    const tower = towers[i];

    // Support position (live), x (replay), and slot-based (legacy) formats
    let x, y;
    if (tower.position !== undefined) {
      // Live match format from getTowerState() - uses 'position' field
      x = gameToCanvasX(tower.position);
      y = tower.lane === 'bottom' ? 150 : 50;
    } else if (tower.x !== undefined) {
      // Replay/build format - uses 'x' field
      x = gameToCanvasX(tower.x);
      y = tower.lane === 'bottom' ? 150 : 50;
    } else if (tower.slot && TOWER_POSITIONS[tower.slot]) {
      // Legacy slot-based format
      x = gameToCanvasX(TOWER_POSITIONS[tower.slot]);
      y = tower.slot.charCodeAt(0) % 2 === 0 ? 50 : 150;
    } else {
      // Fallback for T0, T1, etc format
      x = gameToCanvasX(100 + i * 200);
      y = i % 2 === 0 ? 50 : 150;
    }

    // Tower range indicator
    const range = 150;
    const rangeRadius = gameToCanvasX(range) - gameToCanvasX(0);
    ctx.fillStyle = COLORS.tower_range;
    ctx.beginPath();
    ctx.arc(x, y, rangeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tower body
    ctx.fillStyle = COLORS[`tower_${tower.type}`] || COLORS.tower_basic;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();

    // Tower border (shows cooldown)
    const cooldownPercent = tower.cooldown || 0;
    ctx.strokeStyle = cooldownPercent > 0 ? '#555' : '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Tower label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    const label = tower.slot || `T${i}`;
    ctx.fillText(label, x, y + 4);

    // Tower type label below
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '8px monospace';
    ctx.fillText(tower.type, x, y + 28);
  }
}

// Draw enemies
function drawEnemies(enemies) {
  if (!enemies || !Array.isArray(enemies)) return;

  for (const enemy of enemies) {
    const x = gameToCanvasX(enemy.position);
    const y = PATH_Y;

    // Enemy size based on type
    let size = 8;
    if (enemy.type === 'tank') size = 12;
    if (enemy.type === 'swarm_unit') size = 6;
    if (enemy.type === 'healer') size = 9;
    if (enemy.type === 'shieldBearer') size = 10;
    if (enemy.type === 'regenerator') size = 11;
    if (enemy.type === 'boss') size = 16;

    // Enemy body
    ctx.fillStyle = COLORS[`enemy_${enemy.type}`] || COLORS.enemy_runner;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Enemy border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    // Health bar
    const hpPercent = (enemy.hp || 1) / (enemy.maxHp || 1);
    const barWidth = size * 2.5;
    const barHeight = 4;
    const barY = y - size - 8;

    // Background
    ctx.fillStyle = COLORS.healthBarBg;
    ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = hpPercent > 0.5 ? COLORS.healthBarFull : COLORS.healthBar;
    ctx.fillRect(x - barWidth / 2, barY, barWidth * hpPercent, barHeight);

    // Slow indicator
    if (enemy.speedMultiplier && enemy.speedMultiplier < 1) {
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.arc(x, y - size - 15, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Type indicator for special enemies
    if (enemy.type === 'healer' || enemy.type === 'shieldBearer') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.type === 'healer' ? '+' : '▣', x, y + 3);
    }
  }
}

// Draw recent damage events as particles
function drawDamageEffects(events) {
  if (!events || !Array.isArray(events)) return;

  const recentDamage = events.filter(e => e.type === 'damage').slice(-5);
  // Could add particle effects here
}

// Main render function
function render(state) {
  // Calculate delta time for projectile animation
  const now = performance.now();
  const deltaTime = now - lastProjectileUpdate;
  lastProjectileUpdate = now;

  // Update projectile positions
  updateProjectiles(deltaTime);

  clear();
  drawPath();
  drawTowerSlots();

  if (state) {
    drawTowers(state.towers);
    drawEnemies(state.enemies);
    drawDamageEffects(state.events);
  }

  // Draw projectiles on top of everything
  drawProjectiles();
}

// Update UI elements
function updateUI(state) {
  if (!state) return;

  document.getElementById('match-id').textContent = state.matchId || 'No Match';
  document.getElementById('wave-info').textContent = `Wave ${state.currentWave || 0}/${state.totalWaves || 5}`;

  const statusEl = document.getElementById('match-status');
  statusEl.textContent = state.status === 'in_progress' ? 'In Progress' :
                         state.status === 'complete' ? `Complete - ${state.winner} wins!` :
                         'Waiting...';
  statusEl.className = 'match-status ' + (state.status || '');

  if (state.attacker) {
    document.getElementById('attacker-name').textContent = state.attacker.agentId || '---';
    document.getElementById('attacker-leaked').textContent = `Leaked: ${state.attacker.leaked || 0}`;
  }

  if (state.defender) {
    document.getElementById('defender-name').textContent = state.defender.agentId || '---';
    document.getElementById('defender-kills').textContent = `Kills: ${state.defender.kills || 0}`;
  }
}

// Add event to events panel
function addEvent(event) {
  const eventsList = document.getElementById('events-list');
  const eventEl = document.createElement('div');
  eventEl.className = `event ${event.type}`;

  let text = '';
  if (event.type === 'damage') {
    text = `Tower ${event.tower} hit ${event.enemy} for ${event.amount} damage`;
  } else if (event.type === 'kill') {
    text = `Tower ${event.tower} killed ${event.enemy}!`;
  } else if (event.type === 'leak') {
    text = `Enemy ${event.enemy} reached the end!`;
  } else if (event.type === 'wave') {
    text = `═══ WAVE ${event.wave} START ═══ (${event.totalEnemies} enemies)`;
  } else if (event.type === 'spawn') {
    text = `Spawned: ${event.enemyType} (HP: ${event.health}, Speed: ${event.speed})`;
  }

  eventEl.textContent = `[${event.tick || '?'}] ${text}`;
  eventsList.insertBefore(eventEl, eventsList.firstChild);

  // Limit to 20 events
  while (eventsList.children.length > 20) {
    eventsList.removeChild(eventsList.lastChild);
  }
}

// Clear events panel
function clearEvents() {
  document.getElementById('events-list').innerHTML = '';
}

// Initial render
render(null);

// Export for socket.js
window.renderer = {
  render,
  updateUI,
  addEvent,
  clearEvents,
  // Projectile system
  createProjectile,
  gameToCanvasX,
  // Configuration
  setConfig,
  // Constants for external use
  PATH_Y,
  CANVAS_WIDTH
};
