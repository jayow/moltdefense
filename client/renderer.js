// Canvas Renderer for Moltdefense

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game configuration (can be updated from server via setConfig)
let config = {
  pathLength: 1000,
  canvasWidth: 1000,
  canvasHeight: 280,
  towerPositions: { A: 100, B: 300, C: 500, D: 700, E: 900 }
};

// Game constants (derived from config)
let PATH_LENGTH = config.pathLength;
let TOWER_POSITIONS = config.towerPositions;

// Visual constants
let CANVAS_WIDTH = config.canvasWidth;
let CANVAS_HEIGHT = config.canvasHeight;
let PATH_Y = 140;  // Center of taller canvas
let TOP_LANE_Y = 60;
let BOTTOM_LANE_Y = 220;
const PATH_HEIGHT = 30;

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

  // Update lane positions from server config
  if (serverConfig.map?.lanePositions) {
    TOP_LANE_Y = serverConfig.map.lanePositions.top || 60;
    BOTTOM_LANE_Y = serverConfig.map.lanePositions.bottom || 220;
    // PATH_Y is the midpoint between lanes
    PATH_Y = Math.round((TOP_LANE_Y + BOTTOM_LANE_Y) / 2);
  }

  // Update canvas dimensions if needed
  if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
  }

  console.log('Renderer config updated:', config);
}

// Colors - Zelda HUD Theme (4 rune accents only)
const COLORS = {
  background: '#070A0F',
  path: '#0B1018',
  pathBorder: '#1E2A3A',

  // Tower colors - Zelda rune palette
  tower_basic: '#3AE6FF',     // Cyan rune
  tower_slow: '#3AE6FF',      // Cyan rune
  tower_burst: '#FF4D5E',     // Red rune
  tower_chain: '#FFCC4D',     // Gold rune
  tower_sniper: '#2EE59D',    // Green rune
  tower_support: '#FFCC4D',   // Gold rune
  tower_range: 'rgba(58, 230, 255, 0.08)',

  // Enemy colors - Zelda rune palette
  enemy_runner: '#2EE59D',    // Green rune
  enemy_tank: '#FFCC4D',      // Gold rune
  enemy_swarm_unit: '#3AE6FF', // Cyan rune
  enemy_healer: '#FF4D5E',    // Red rune
  enemy_shieldBearer: '#3AE6FF', // Cyan rune
  enemy_regenerator: '#2EE59D',  // Green rune
  enemy_boss: '#FF4D5E',      // Red rune

  healthBar: '#FF4D5E',       // Red rune
  healthBarBg: '#0B1018',
  healthBarFull: '#2EE59D',   // Green rune

  text: '#EAF0FF',
  textDim: '#5D6A7E',

  startMarker: '#2EE59D',     // Green rune
  endMarker: '#FF4D5E'        // Red rune
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

// Draw all active projectiles with tower-specific visuals
function drawProjectiles() {
  for (const p of projectiles) {
    // Interpolate position
    const x = p.fromX + (p.toX - p.fromX) * p.progress;
    const y = p.fromY + (p.toY - p.fromY) * p.progress;

    // Calculate angle for directional projectiles
    const angle = Math.atan2(p.toY - p.fromY, p.toX - p.fromX);

    ctx.save();

    switch (p.type) {
      case 'slow':
        // Frost shard - ice crystal with sparkle trail
        drawFrostProjectile(x, y, angle, p.progress);
        break;

      case 'burst':
        // Fire bomb - flaming sphere with ember trail
        drawFireProjectile(x, y, angle, p.progress);
        break;

      case 'chain':
        // Lightning bolt - electric arc
        drawLightningProjectile(p.fromX, p.fromY, x, y, p.progress);
        break;

      case 'sniper':
        // Arrow - green energy arrow with trail
        drawArrowProjectile(x, y, angle, p.progress);
        break;

      case 'support':
        // Golden sparkle - buff particle
        drawSupportProjectile(x, y, p.progress);
        break;

      default:
        // Basic - cyan energy orb
        drawBasicProjectile(x, y);
        break;
    }

    ctx.restore();
  }
}

// Basic tower projectile - cyan energy orb
function drawBasicProjectile(x, y) {
  // Outer glow
  ctx.fillStyle = '#3AE6FF44';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();

  // Inner core
  ctx.fillStyle = '#3AE6FF';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Bright center
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

// Slow tower projectile - frost shard
function drawFrostProjectile(x, y, angle, progress) {
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Ice trail particles
  for (let i = 0; i < 3; i++) {
    const trailX = -8 - i * 6;
    const trailY = (Math.sin(progress * 20 + i) * 3);
    ctx.fillStyle = `rgba(58, 230, 255, ${0.3 - i * 0.1})`;
    ctx.fillRect(trailX, trailY - 1, 4, 2);
  }

  // Ice crystal shape (hexagonal shard)
  ctx.fillStyle = '#3AE6FF';
  ctx.shadowColor = '#3AE6FF';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(8, 0);      // Tip
  ctx.lineTo(2, -4);     // Top edge
  ctx.lineTo(-6, -2);    // Back top
  ctx.lineTo(-6, 2);     // Back bottom
  ctx.lineTo(2, 4);      // Bottom edge
  ctx.closePath();
  ctx.fill();

  // Inner highlight
  ctx.fillStyle = '#AFFFFF';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(2, -2);
  ctx.lineTo(-2, 0);
  ctx.lineTo(2, 2);
  ctx.closePath();
  ctx.fill();
}

// Burst tower projectile - fire bomb
function drawFireProjectile(x, y, angle, progress) {
  // Ember trail
  for (let i = 0; i < 4; i++) {
    const trailX = x - Math.cos(angle) * (8 + i * 5);
    const trailY = y - Math.sin(angle) * (8 + i * 5) + Math.sin(progress * 30 + i * 2) * 3;
    ctx.fillStyle = `rgba(255, 77, 94, ${0.5 - i * 0.12})`;
    ctx.beginPath();
    ctx.arc(trailX, trailY, 3 - i * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flame glow
  ctx.shadowColor = '#FF4D5E';
  ctx.shadowBlur = 12;

  // Outer flame
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
  gradient.addColorStop(0, '#FFCC4D');
  gradient.addColorStop(0.4, '#FF8040');
  gradient.addColorStop(0.8, '#FF4D5E');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();

  // Hot core
  ctx.fillStyle = '#FFFFAA';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

// Chain tower projectile - lightning bolt
function drawLightningProjectile(fromX, fromY, x, y, progress) {
  ctx.strokeStyle = '#FFCC4D';
  ctx.shadowColor = '#FFCC4D';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;

  // Jagged lightning path
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);

  const segments = 5;
  const dx = (x - fromX) / segments;
  const dy = (y - fromY) / segments;

  for (let i = 1; i < segments; i++) {
    const jitterX = (Math.random() - 0.5) * 15;
    const jitterY = (Math.random() - 0.5) * 15;
    ctx.lineTo(fromX + dx * i + jitterX, fromY + dy * i + jitterY);
  }
  ctx.lineTo(x, y);
  ctx.stroke();

  // Brighter inner bolt
  ctx.strokeStyle = '#FFFFDD';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Impact spark at end
  ctx.fillStyle = '#FFCC4D';
  ctx.beginPath();
  ctx.arc(x, y, 5 + Math.random() * 3, 0, Math.PI * 2);
  ctx.fill();
}

// Sniper tower projectile - energy arrow
function drawArrowProjectile(x, y, angle, progress) {
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Long energy trail
  const gradient = ctx.createLinearGradient(-30, 0, 0, 0);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.5, '#2EE59D40');
  gradient.addColorStop(1, '#2EE59D');

  ctx.fillStyle = gradient;
  ctx.fillRect(-30, -2, 30, 4);

  // Arrow head
  ctx.shadowColor = '#2EE59D';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#2EE59D';

  ctx.beginPath();
  ctx.moveTo(12, 0);      // Tip
  ctx.lineTo(0, -5);      // Top edge
  ctx.lineTo(2, 0);       // Notch
  ctx.lineTo(0, 5);       // Bottom edge
  ctx.closePath();
  ctx.fill();

  // Bright tip
  ctx.fillStyle = '#AFFFAA';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(4, -2);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.fill();
}

// Support tower projectile - golden sparkle
function drawSupportProjectile(x, y, progress) {
  ctx.shadowColor = '#FFCC4D';
  ctx.shadowBlur = 8;

  // Rotating sparkles
  const sparkleAngle = progress * Math.PI * 4;

  for (let i = 0; i < 4; i++) {
    const angle = sparkleAngle + (i * Math.PI / 2);
    const sparkleX = x + Math.cos(angle) * 6;
    const sparkleY = y + Math.sin(angle) * 6;

    ctx.fillStyle = '#FFCC4D';
    drawStar(sparkleX, sparkleY, 4, 2, 4);
  }

  // Center glow
  ctx.fillStyle = '#FFFFDD';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Helper: draw a star shape
function drawStar(cx, cy, outerRadius, innerRadius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// Clear the canvas with gradient background
function clear() {
  // Dark gradient background (night sky feel)
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#050810');
  gradient.addColorStop(0.3, '#0A0F18');
  gradient.addColorStop(0.7, '#0A0F18');
  gradient.addColorStop(1, '#050810');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw pixel art terrain decoration
function drawTerrain() {
  // Grass texture for tower placement areas (top and bottom)
  // PATH_Y = 140, path height = 30, so path spans 125-155
  drawGrassArea(0, 0, CANVAS_WIDTH, PATH_Y - 20);      // Top area (0-120)
  drawGrassArea(0, PATH_Y + 20, CANVAS_WIDTH, CANVAS_HEIGHT - PATH_Y - 20); // Bottom area (160-280)

  // Scattered decorations
  drawDecorations();
}

// Draw grass-textured area
function drawGrassArea(x, y, width, height) {
  if (height <= 0) return;

  // Base dark grass
  ctx.fillStyle = '#0D1A12';
  ctx.fillRect(x, y, width, height);

  // Grass tufts pattern
  ctx.fillStyle = '#152A1C';
  for (let gx = x; gx < x + width; gx += 16) {
    for (let gy = y + 4; gy < y + height - 4; gy += 12) {
      // Pseudo-random offset based on position
      const offset = ((gx * 7 + gy * 13) % 8) - 4;
      drawGrassTuft(gx + offset, gy);
    }
  }
}

// Draw a single grass tuft (3-blade cluster)
function drawGrassTuft(x, y) {
  ctx.fillStyle = '#1E3A28';
  // Center blade
  ctx.fillRect(x + 2, y, 2, 6);
  // Left blade
  ctx.fillRect(x, y + 2, 2, 4);
  // Right blade
  ctx.fillRect(x + 4, y + 2, 2, 4);

  // Highlight tips
  ctx.fillStyle = '#2EE59D20';
  ctx.fillRect(x + 2, y, 2, 2);
}

// Draw scattered decorative elements
function drawDecorations() {
  // Fixed decoration positions for 1000x280 canvas (PATH_Y = 140)
  const decorations = [
    // Top area rocks (y: 20-90)
    { type: 'rock', x: 100, y: 35 },
    { type: 'rock', x: 280, y: 28 },
    { type: 'rock', x: 480, y: 40 },
    { type: 'rock', x: 680, y: 32 },
    { type: 'rock', x: 880, y: 38 },
    // Top area small plants
    { type: 'plant', x: 180, y: 55 },
    { type: 'plant', x: 380, y: 48 },
    { type: 'plant', x: 580, y: 52 },
    { type: 'plant', x: 780, y: 50 },
    // Bottom area rocks (y: 190-260)
    { type: 'rock', x: 150, y: 195 },
    { type: 'rock', x: 350, y: 200 },
    { type: 'rock', x: 550, y: 192 },
    { type: 'rock', x: 750, y: 198 },
    { type: 'rock', x: 920, y: 195 },
    // Bottom area small plants
    { type: 'plant', x: 230, y: 215 },
    { type: 'plant', x: 450, y: 220 },
    { type: 'plant', x: 650, y: 212 },
    { type: 'plant', x: 850, y: 218 },
    // Torches along path edges
    { type: 'torch', x: 200, y: PATH_Y - 45 },
    { type: 'torch', x: 400, y: PATH_Y + 45 },
    { type: 'torch', x: 600, y: PATH_Y - 45 },
    { type: 'torch', x: 800, y: PATH_Y + 45 },
  ];

  for (const dec of decorations) {
    switch (dec.type) {
      case 'rock':
        drawRock(dec.x, dec.y);
        break;
      case 'plant':
        drawSmallPlant(dec.x, dec.y);
        break;
      case 'torch':
        drawTorch(dec.x, dec.y);
        break;
    }
  }
}

// Draw a small rock
function drawRock(x, y) {
  ctx.fillStyle = '#2A3040';
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x + 12, y + 2);
  ctx.lineTo(x + 14, y + 8);
  ctx.lineTo(x + 8, y + 10);
  ctx.closePath();
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#3A4050';
  ctx.fillRect(x + 4, y + 2, 4, 3);
}

// Draw a small plant
function drawSmallPlant(x, y) {
  ctx.fillStyle = '#1E4A2E';
  ctx.fillRect(x + 2, y, 2, 8);
  ctx.fillRect(x, y + 2, 2, 4);
  ctx.fillRect(x + 4, y + 3, 2, 3);

  // Small flower/berry
  ctx.fillStyle = '#FF4D5E40';
  ctx.fillRect(x + 1, y, 2, 2);
}

// Draw a torch with animated flame
function drawTorch(x, y) {
  // Torch post
  ctx.fillStyle = '#4A3A2A';
  ctx.fillRect(x + 2, y + 4, 4, 12);

  // Torch holder
  ctx.fillStyle = '#5A4A3A';
  ctx.fillRect(x, y + 2, 8, 4);

  // Flame (animated via tick)
  const flameTick = window.SpriteSystem ?
    SpriteSystem.getAnimationFrame(4, 8) : 0;
  const flameHeight = 8 + (flameTick % 2) * 2;

  // Flame glow
  ctx.fillStyle = 'rgba(255, 200, 100, 0.15)';
  ctx.beginPath();
  ctx.arc(x + 4, y - 2, 12, 0, Math.PI * 2);
  ctx.fill();

  // Flame body
  const flameGrad = ctx.createLinearGradient(x + 4, y - flameHeight, x + 4, y + 2);
  flameGrad.addColorStop(0, '#FFCC4D');
  flameGrad.addColorStop(0.5, '#FF8040');
  flameGrad.addColorStop(1, '#FF4D5E');
  ctx.fillStyle = flameGrad;

  ctx.beginPath();
  ctx.moveTo(x + 4, y - flameHeight);
  ctx.quadraticCurveTo(x - 2, y - 4, x + 2, y + 2);
  ctx.lineTo(x + 6, y + 2);
  ctx.quadraticCurveTo(x + 10, y - 4, x + 4, y - flameHeight);
  ctx.fill();
}

// Draw the main path (cobblestone road)
function drawPath() {
  const pathTop = PATH_Y - 15;
  const pathHeight = 30;

  // Path base (dark dirt)
  ctx.fillStyle = '#1A1510';
  ctx.fillRect(0, pathTop, CANVAS_WIDTH, pathHeight);

  // Cobblestone pattern
  ctx.fillStyle = '#2A2520';
  for (let px = 0; px < CANVAS_WIDTH; px += 20) {
    for (let py = pathTop + 2; py < pathTop + pathHeight - 2; py += 10) {
      const offset = ((py - pathTop) % 20 === 0) ? 10 : 0;
      drawCobblestone(px + offset, py);
    }
  }

  // Path borders (worn edges)
  ctx.fillStyle = '#0D0A08';
  ctx.fillRect(0, pathTop, CANVAS_WIDTH, 3);
  ctx.fillRect(0, pathTop + pathHeight - 3, CANVAS_WIDTH, 3);

  // Subtle path glow lines
  ctx.strokeStyle = '#3AE6FF10';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, pathTop + 1);
  ctx.lineTo(CANVAS_WIDTH, pathTop + 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, pathTop + pathHeight - 2);
  ctx.lineTo(CANVAS_WIDTH, pathTop + pathHeight - 2);
  ctx.stroke();

  // Draw spawn portal (left) and fortress (right)
  drawSpawnPortal();
  drawFortressGoal();

  // Direction arrows on path
  drawPathArrows();
}

// Draw individual cobblestone
function drawCobblestone(x, y) {
  const width = 16 + ((x * 3) % 4);
  const height = 7 + ((x * 5) % 2);

  // Stone body
  ctx.fillStyle = '#252018';
  ctx.fillRect(x, y, width, height);

  // Highlight edge
  ctx.fillStyle = '#353028';
  ctx.fillRect(x, y, width, 2);
  ctx.fillRect(x, y, 2, height);

  // Shadow edge
  ctx.fillStyle = '#151210';
  ctx.fillRect(x + width - 1, y, 1, height);
  ctx.fillRect(x, y + height - 1, width, 1);
}

// Draw spawn portal on left side
function drawSpawnPortal() {
  const x = 5;
  const y = PATH_Y;

  // Portal frame (stone arch)
  ctx.fillStyle = '#2A3A4A';
  ctx.fillRect(x, y - 25, 8, 50);
  ctx.fillRect(x, y - 28, 20, 6);
  ctx.fillRect(x, y + 22, 20, 6);

  // Portal inner glow
  ctx.fillStyle = '#2EE59D30';
  ctx.fillRect(x + 8, y - 22, 12, 44);

  // Portal swirl effect
  const portalTick = window.SpriteSystem ?
    SpriteSystem.getAnimationFrame(6, 10) : 0;

  ctx.fillStyle = '#2EE59D';
  ctx.shadowColor = '#2EE59D';
  ctx.shadowBlur = 10;

  // Animated runes
  for (let i = 0; i < 3; i++) {
    const runeY = y - 15 + i * 12 + (portalTick + i) % 3 * 2;
    ctx.fillRect(x + 10, runeY, 6, 3);
  }

  ctx.shadowBlur = 0;

  // "SPAWN" label - prominent with glow and background
  ctx.save();

  // Label background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 2, y - 52, 36, 16);
  ctx.strokeStyle = '#2EE59D';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 2, y - 52, 36, 16);

  // Text with glow
  ctx.shadowColor = '#2EE59D';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#2EE59D';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SPAWN', x + 16, y - 40);

  // Double render for brighter glow
  ctx.fillText('SPAWN', x + 16, y - 40);
  ctx.restore();
}

// Draw fortress/goal on right side
function drawFortressGoal() {
  const x = CANVAS_WIDTH - 30;
  const y = PATH_Y;

  // Fortress wall
  ctx.fillStyle = '#3A2A2A';
  ctx.fillRect(x, y - 30, 30, 60);

  // Battlements
  ctx.fillStyle = '#4A3A3A';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + i * 10, y - 35, 8, 8);
  }

  // Gate (dark opening)
  ctx.fillStyle = '#1A0A0A';
  ctx.fillRect(x + 5, y - 15, 15, 30);

  // Gate glow (danger!)
  const gateTick = window.SpriteSystem ?
    SpriteSystem.getAnimationFrame(4, 15) : 0;
  const glowAlpha = 0.3 + (gateTick % 2) * 0.1;

  ctx.fillStyle = `rgba(255, 77, 94, ${glowAlpha})`;
  ctx.fillRect(x + 7, y - 12, 11, 24);

  // Warning glow
  ctx.shadowColor = '#FF4D5E';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#FF4D5E';
  ctx.fillRect(x + 10, y - 5, 5, 10);
  ctx.shadowBlur = 0;

  // "GOAL" label - prominent with glow and background
  ctx.save();

  // Label background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 2, y - 58, 36, 16);
  ctx.strokeStyle = '#FF4D5E';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 2, y - 58, 36, 16);

  // Text with glow
  ctx.shadowColor = '#FF4D5E';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#FF4D5E';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', x + 16, y - 46);

  // Double render for brighter glow
  ctx.fillText('GOAL', x + 16, y - 46);
  ctx.restore();
}

// Draw direction arrows along path
function drawPathArrows() {
  ctx.strokeStyle = '#3AE6FF20';
  ctx.lineWidth = 2;

  for (let x = 80; x < CANVAS_WIDTH - 80; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, PATH_Y);
    ctx.lineTo(x + 15, PATH_Y);
    ctx.lineTo(x + 10, PATH_Y - 4);
    ctx.moveTo(x + 15, PATH_Y);
    ctx.lineTo(x + 10, PATH_Y + 4);
    ctx.stroke();
  }
}

// Legacy function - no longer draws anything (free tower placement)
function drawTowerSlots() {
  // Removed: Defenders have free placement, no predefined slots
}

// Draw towers using pixel art sprites
function drawTowers(towers) {
  if (!towers || !Array.isArray(towers)) return;

  for (let i = 0; i < towers.length; i++) {
    const tower = towers[i];

    // Support position (live), x (replay), and slot-based (legacy) formats
    // Tower Y positions use module-level TOP_LANE_Y and BOTTOM_LANE_Y

    let x, y;
    if (tower.position !== undefined) {
      // Live match format from getTowerState() - uses 'position' field
      x = gameToCanvasX(tower.position);
      y = tower.lane === 'bottom' ? BOTTOM_LANE_Y : TOP_LANE_Y;
    } else if (tower.x !== undefined) {
      // Replay/build format - uses 'x' field
      x = gameToCanvasX(tower.x);
      y = tower.lane === 'bottom' ? BOTTOM_LANE_Y : TOP_LANE_Y;
    } else if (tower.slot && TOWER_POSITIONS[tower.slot]) {
      // Legacy slot-based format
      x = gameToCanvasX(TOWER_POSITIONS[tower.slot]);
      y = tower.slot.charCodeAt(0) % 2 === 0 ? TOP_LANE_Y : BOTTOM_LANE_Y;
    } else {
      // Fallback for T0, T1, etc format
      x = gameToCanvasX(100 + i * 200);
      y = i % 2 === 0 ? TOP_LANE_Y : BOTTOM_LANE_Y;
    }

    // Tower range indicator (subtle)
    const range = 150;
    const rangeRadius = gameToCanvasX(range) - gameToCanvasX(0);
    ctx.fillStyle = COLORS.tower_range;
    ctx.beginPath();
    ctx.arc(x, y, rangeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw pixel art tower sprite
    const isAttacking = tower.cooldown && tower.cooldown > 0.8; // Recently fired
    if (window.SpriteSystem) {
      SpriteSystem.drawTower(ctx, tower.type || 'basic', x, y, isAttacking);
    } else {
      // Fallback to simple circle if sprite system not loaded
      ctx.fillStyle = COLORS[`tower_${tower.type}`] || COLORS.tower_basic;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tower type label below - readable with background
    const label = tower.type || 'basic';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';

    // Measure text for background
    const textWidth = ctx.measureText(label).width;

    // Label background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x - textWidth / 2 - 4, y + 18, textWidth + 8, 14);

    // Label border matching tower color
    const towerColor = COLORS[`tower_${tower.type}`] || COLORS.tower_basic;
    ctx.strokeStyle = towerColor + '80'; // 50% opacity
    ctx.lineWidth = 1;
    ctx.strokeRect(x - textWidth / 2 - 4, y + 18, textWidth + 8, 14);

    // Text with glow
    ctx.shadowColor = towerColor;
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#EAF0FF';
    ctx.fillText(label, x, y + 28);
    ctx.shadowBlur = 0;
  }
}

// Draw enemies using pixel art sprites
function drawEnemies(enemies) {
  if (!enemies || !Array.isArray(enemies)) return;

  for (const enemy of enemies) {
    const x = gameToCanvasX(enemy.position);
    const y = PATH_Y;

    // Get sprite size from config or use defaults
    let spriteSize = 24;
    if (window.SpriteSystem) {
      spriteSize = SpriteSystem.getSpriteSize(enemy.type, 'enemy');
    } else {
      // Fallback sizes
      if (enemy.type === 'tank') spriteSize = 32;
      if (enemy.type === 'swarm_unit') spriteSize = 12;
      if (enemy.type === 'boss') spriteSize = 48;
      if (enemy.type === 'shieldBearer') spriteSize = 28;
      if (enemy.type === 'regenerator') spriteSize = 28;
    }

    // Draw pixel art enemy sprite
    if (window.SpriteSystem) {
      SpriteSystem.drawEnemy(ctx, enemy.type || 'runner', x, y, enemy.position);
    } else {
      // Fallback to simple circle if sprite system not loaded
      const size = spriteSize / 2;
      ctx.fillStyle = COLORS[`enemy_${enemy.type}`] || COLORS.enemy_runner;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health bar (rendered on top of sprite)
    const hpPercent = (enemy.hp || 1) / (enemy.maxHp || 1);
    const barWidth = spriteSize * 1.2;
    const barHeight = 4;
    const barY = y - spriteSize / 2 - 8;

    // Background
    ctx.fillStyle = COLORS.healthBarBg;
    ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = hpPercent > 0.5 ? COLORS.healthBarFull : COLORS.healthBar;
    ctx.fillRect(x - barWidth / 2, barY, barWidth * hpPercent, barHeight);

    // Slow indicator (frost icon above health bar)
    if (enemy.speedMultiplier && enemy.speedMultiplier < 1) {
      ctx.fillStyle = '#3AE6FF';
      ctx.shadowColor = '#3AE6FF';
      ctx.shadowBlur = 5;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('*', x, barY - 4);
      ctx.shadowBlur = 0;
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

  // Update sprite animation tick
  if (window.SpriteSystem) {
    SpriteSystem.updateTick();
  }

  clear();
  drawTerrain();      // Grass areas and decorations
  drawPath();         // Cobblestone road with portals
  // drawTowerSlots() removed - free placement

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
  get PATH_Y() { return PATH_Y; },
  get CANVAS_WIDTH() { return CANVAS_WIDTH; },
  get CANVAS_HEIGHT() { return CANVAS_HEIGHT; },
  get TOP_LANE_Y() { return TOP_LANE_Y; },
  get BOTTOM_LANE_Y() { return BOTTOM_LANE_Y; }
};
