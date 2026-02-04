// Sprite System for Moltdefense
// Handles sprite loading, animation, and rendering

const SpriteSystem = (function() {
  'use strict';

  // Sprite configuration matching the plan
  const SPRITE_CONFIG = {
    towers: {
      basic:   { frames: 4, attackFrames: 4, size: 32, color: '#3AE6FF', name: 'Sentinel' },
      slow:    { frames: 6, attackFrames: 4, size: 32, color: '#3AE6FF', name: 'Frost Warden' },
      burst:   { frames: 4, attackFrames: 6, size: 32, color: '#FF4D5E', name: 'Inferno Cannon' },
      chain:   { frames: 4, attackFrames: 6, size: 32, color: '#FFCC4D', name: 'Storm Spire' },
      sniper:  { frames: 4, attackFrames: 4, size: 32, color: '#2EE59D', name: 'Emerald Archer' },
      support: { frames: 6, attackFrames: 4, size: 32, color: '#FFCC4D', name: 'Beacon' }
    },
    enemies: {
      runner:       { frames: 6, size: 24, color: '#2EE59D', name: 'Goblin Scout' },
      tank:         { frames: 4, size: 32, color: '#FFCC4D', name: 'Stone Golem' },
      swarm:        { frames: 4, size: 24, color: '#3AE6FF', name: 'Sprite Cluster' },
      swarm_unit:   { frames: 4, size: 12, color: '#3AE6FF', name: 'Sprite' },
      healer:       { frames: 4, size: 24, color: '#FF4D5E', name: 'Shrine Maiden' },
      shieldBearer: { frames: 4, size: 28, color: '#3AE6FF', name: 'Crystal Knight' },
      regenerator:  { frames: 6, size: 28, color: '#2EE59D', name: 'Slime Lord' },
      boss:         { frames: 6, size: 48, color: '#FF4D5E', name: 'Molten King' }
    }
  };

  // Color palette
  const COLORS = {
    cyan: '#3AE6FF',
    red: '#FF4D5E',
    green: '#2EE59D',
    gold: '#FFCC4D',
    dark: '#0B1018',
    mid: '#1E2A3A',
    light: '#EAF0FF'
  };

  // Animation tick counter
  let animationTick = 0;

  // Cache for generated sprites
  const spriteCache = new Map();

  /**
   * Get animation frame based on tick
   */
  function getAnimationFrame(frameCount, speed = 10) {
    return Math.floor(animationTick / speed) % frameCount;
  }

  /**
   * Get walk animation frame based on position (for enemies)
   */
  function getWalkFrame(position, frameCount, speed = 20) {
    return Math.floor(position / speed) % frameCount;
  }

  /**
   * Update animation tick (call once per render)
   */
  function updateTick() {
    animationTick++;
  }

  /**
   * Draw a pixel art tower
   */
  function drawTower(ctx, type, x, y, isAttacking = false) {
    const config = SPRITE_CONFIG.towers[type] || SPRITE_CONFIG.towers.basic;
    const size = config.size;
    const halfSize = size / 2;
    const frame = getAnimationFrame(config.frames);

    // Offset for centering
    const drawX = x - halfSize;
    const drawY = y - halfSize;

    ctx.save();

    // Attack shake effect
    if (isAttacking) {
      ctx.translate(Math.random() * 2 - 1, Math.random() * 2 - 1);
    }

    // Draw based on tower type
    switch (type) {
      case 'basic':
        drawSentinel(ctx, drawX, drawY, size, frame, isAttacking);
        break;
      case 'slow':
        drawFrostWarden(ctx, drawX, drawY, size, frame, isAttacking);
        break;
      case 'burst':
        drawInfernoCannon(ctx, drawX, drawY, size, frame, isAttacking);
        break;
      case 'chain':
        drawStormSpire(ctx, drawX, drawY, size, frame, isAttacking);
        break;
      case 'sniper':
        drawEmeraldArcher(ctx, drawX, drawY, size, frame, isAttacking);
        break;
      case 'support':
        drawBeacon(ctx, drawX, drawY, size, frame, isAttacking);
        break;
      default:
        drawSentinel(ctx, drawX, drawY, size, frame, isAttacking);
    }

    ctx.restore();
  }

  /**
   * Draw a pixel art enemy
   */
  function drawEnemy(ctx, type, x, y, position = 0) {
    const config = SPRITE_CONFIG.enemies[type] || SPRITE_CONFIG.enemies.runner;
    const size = config.size;
    const halfSize = size / 2;
    const frame = getWalkFrame(position, config.frames);

    const drawX = x - halfSize;
    const drawY = y - halfSize;

    ctx.save();

    switch (type) {
      case 'runner':
        drawGoblinScout(ctx, drawX, drawY, size, frame);
        break;
      case 'tank':
        drawStoneGolem(ctx, drawX, drawY, size, frame);
        break;
      case 'swarm':
        drawSpriteCluster(ctx, drawX, drawY, size, frame);
        break;
      case 'swarm_unit':
        drawSprite(ctx, drawX, drawY, size, frame);
        break;
      case 'healer':
        drawShrineMaiden(ctx, drawX, drawY, size, frame);
        break;
      case 'shieldBearer':
        drawCrystalKnight(ctx, drawX, drawY, size, frame);
        break;
      case 'regenerator':
        drawSlimeLord(ctx, drawX, drawY, size, frame);
        break;
      case 'boss':
        drawMoltenKing(ctx, drawX, drawY, size, frame);
        break;
      default:
        drawGoblinScout(ctx, drawX, drawY, size, frame);
    }

    ctx.restore();
  }

  // ============================================
  // TOWER DRAWING FUNCTIONS
  // ============================================

  /**
   * The Sentinel - Basic Tower
   * Stone turret with cyan crystal core
   */
  function drawSentinel(ctx, x, y, size, frame, attacking) {
    const s = size / 32; // Scale factor

    // Stone base (pyramid shape)
    ctx.fillStyle = '#4A5568';
    ctx.fillRect(x + 4*s, y + 22*s, 24*s, 10*s);

    // Stone platform
    ctx.fillStyle = '#5A6A7A';
    ctx.fillRect(x + 8*s, y + 16*s, 16*s, 8*s);

    // Crystal housing
    ctx.fillStyle = '#2D3748';
    ctx.fillRect(x + 10*s, y + 8*s, 12*s, 10*s);

    // Cyan crystal core (pulsing)
    const pulse = Math.sin(frame * Math.PI / 2) * 0.3 + 0.7;
    ctx.fillStyle = attacking ? '#FFFFFF' : COLORS.cyan;
    ctx.globalAlpha = pulse;

    // Crystal shape (diamond)
    ctx.beginPath();
    ctx.moveTo(x + 16*s, y + 6*s);
    ctx.lineTo(x + 20*s, y + 13*s);
    ctx.lineTo(x + 16*s, y + 20*s);
    ctx.lineTo(x + 12*s, y + 13*s);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;

    // Crystal glow
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = attacking ? 15 : 8;
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(x + 16*s, y + 13*s, 3*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Highlight
    ctx.fillStyle = COLORS.light;
    ctx.fillRect(x + 6*s, y + 16*s, 2*s, 2*s);
  }

  /**
   * Frost Warden - Slow Tower
   * Ice crystal spire with orbiting shards
   */
  function drawFrostWarden(ctx, x, y, size, frame, attacking) {
    const s = size / 32;
    const rotation = (frame / 6) * Math.PI * 2;

    // Frost ring base
    ctx.fillStyle = '#1E3A5F';
    ctx.beginPath();
    ctx.ellipse(x + 16*s, y + 28*s, 12*s, 4*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ice crystal spire
    const gradient = ctx.createLinearGradient(x + 16*s, y + 6*s, x + 16*s, y + 26*s);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.5, COLORS.cyan);
    gradient.addColorStop(1, '#1E5A8F');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(x + 16*s, y + 4*s);
    ctx.lineTo(x + 22*s, y + 26*s);
    ctx.lineTo(x + 10*s, y + 26*s);
    ctx.closePath();
    ctx.fill();

    // Inner crystal facets
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x + 16*s, y + 8*s);
    ctx.lineTo(x + 19*s, y + 20*s);
    ctx.lineTo(x + 16*s, y + 18*s);
    ctx.closePath();
    ctx.fill();

    // Orbiting ice shards
    for (let i = 0; i < 3; i++) {
      const angle = rotation + (i * Math.PI * 2 / 3);
      const orbitX = x + 16*s + Math.cos(angle) * 10*s;
      const orbitY = y + 16*s + Math.sin(angle) * 6*s;

      ctx.fillStyle = COLORS.cyan;
      ctx.save();
      ctx.translate(orbitX, orbitY);
      ctx.rotate(angle);
      ctx.fillRect(-2*s, -4*s, 4*s, 8*s);
      ctx.restore();
    }

    // Frost particles
    if (attacking) {
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 5; i++) {
        const px = x + 10*s + Math.random() * 12*s;
        const py = y + 5*s + Math.random() * 15*s;
        ctx.fillRect(px, py, 2*s, 2*s);
      }
    }
  }

  /**
   * Inferno Cannon - Burst Tower
   * Brass cannon with red-hot barrel
   */
  function drawInfernoCannon(ctx, x, y, size, frame, attacking) {
    const s = size / 32;

    // Base machinery
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 4*s, y + 20*s, 24*s, 10*s);

    // Rivets
    ctx.fillStyle = '#5A4A3A';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 8*s + i*8*s, y + 25*s, 2*s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cannon body
    ctx.fillStyle = '#A08060';
    ctx.fillRect(x + 6*s, y + 10*s, 20*s, 12*s);

    // Heat vents
    ctx.fillStyle = '#2D2D2D';
    ctx.fillRect(x + 8*s, y + 12*s, 2*s, 8*s);
    ctx.fillRect(x + 12*s, y + 12*s, 2*s, 8*s);

    // Barrel
    const heatGlow = attacking ? 1 : (Math.sin(frame * Math.PI / 2) * 0.3 + 0.4);
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(x + 20*s, y + 12*s, 10*s, 8*s);

    // Barrel heat glow
    ctx.fillStyle = `rgba(255, 77, 94, ${heatGlow})`;
    ctx.fillRect(x + 22*s, y + 14*s, 6*s, 4*s);

    // Muzzle flash when attacking
    if (attacking) {
      ctx.fillStyle = '#FFFF00';
      ctx.shadowColor = '#FF4D5E';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(x + 30*s, y + 16*s, 6*s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Steam puffs
    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    const steamOffset = frame * 2;
    ctx.beginPath();
    ctx.arc(x + 10*s, y + 8*s - steamOffset, 3*s, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Storm Spire - Chain Tower
   * Tesla coil with lightning between orbs
   */
  function drawStormSpire(ctx, x, y, size, frame, attacking) {
    const s = size / 32;

    // Scorched ground
    ctx.fillStyle = '#2A2A2A';
    ctx.beginPath();
    ctx.ellipse(x + 16*s, y + 30*s, 10*s, 3*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Metal spire base
    ctx.fillStyle = '#5A5A5A';
    ctx.fillRect(x + 12*s, y + 20*s, 8*s, 10*s);

    // Coil wrapping
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2*s;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 11*s, y + 22*s + i*2*s);
      ctx.lineTo(x + 21*s, y + 22*s + i*2*s);
      ctx.stroke();
    }

    // Spire top
    ctx.fillStyle = '#4A4A4A';
    ctx.beginPath();
    ctx.moveTo(x + 16*s, y + 6*s);
    ctx.lineTo(x + 20*s, y + 20*s);
    ctx.lineTo(x + 12*s, y + 20*s);
    ctx.closePath();
    ctx.fill();

    // Floating orbs
    const orbPositions = [
      { x: 6, y: 10 }, { x: 26, y: 10 },
      { x: 6, y: 22 }, { x: 26, y: 22 }
    ];

    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.gold;

    orbPositions.forEach((pos, i) => {
      ctx.beginPath();
      ctx.arc(x + pos.x*s, y + pos.y*s, 3*s, 0, Math.PI * 2);
      ctx.fill();
    });

    // Lightning arcs between orbs
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5*s;
    ctx.shadowBlur = 5;

    // Animate lightning path
    const lightningOffset = frame % 2;

    orbPositions.forEach((pos, i) => {
      if (i < orbPositions.length - 1) {
        const next = orbPositions[(i + 1) % orbPositions.length];
        ctx.beginPath();
        ctx.moveTo(x + pos.x*s, y + pos.y*s);
        // Jagged lightning
        const midX = (pos.x + next.x) / 2 + (lightningOffset ? 3 : -3);
        const midY = (pos.y + next.y) / 2;
        ctx.lineTo(x + midX*s, y + midY*s);
        ctx.lineTo(x + next.x*s, y + next.y*s);
        ctx.stroke();
      }
    });

    ctx.shadowBlur = 0;
  }

  /**
   * Emerald Archer - Sniper Tower
   * Elven tower with ghost archer
   */
  function drawEmeraldArcher(ctx, x, y, size, frame, attacking) {
    const s = size / 32;
    const scanAngle = Math.sin(frame * Math.PI / 2) * 0.3;

    // Wooden base with vines
    ctx.fillStyle = '#5D4E37';
    ctx.fillRect(x + 8*s, y + 22*s, 16*s, 10*s);

    // Vine details
    ctx.strokeStyle = '#2EE59D';
    ctx.lineWidth = 2*s;
    ctx.beginPath();
    ctx.moveTo(x + 6*s, y + 32*s);
    ctx.quadraticCurveTo(x + 10*s, y + 26*s, x + 8*s, y + 20*s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 26*s, y + 32*s);
    ctx.quadraticCurveTo(x + 22*s, y + 26*s, x + 24*s, y + 20*s);
    ctx.stroke();

    // Tower body
    ctx.fillStyle = '#4A3D2A';
    ctx.fillRect(x + 10*s, y + 12*s, 12*s, 12*s);

    // Ghost archer platform
    ctx.fillStyle = '#3D3328';
    ctx.fillRect(x + 8*s, y + 10*s, 16*s, 4*s);

    // Ghost archer (translucent green)
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.translate(x + 16*s, y + 6*s);
    ctx.rotate(scanAngle);

    // Archer body
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.arc(0, 0, 4*s, 0, Math.PI * 2);
    ctx.fill();

    // Bow
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2*s;
    ctx.beginPath();
    ctx.arc(4*s, 0, 6*s, -Math.PI/2, Math.PI/2);
    ctx.stroke();

    // Arrow (drawn back)
    if (attacking) {
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = COLORS.green;
    }
    ctx.fillRect(-2*s, -1*s, 8*s, 2*s);

    ctx.restore();

    // Targeting glow when attacking
    if (attacking) {
      ctx.shadowColor = COLORS.green;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 1*s;
      ctx.beginPath();
      ctx.arc(x + 16*s, y + 6*s, 8*s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  /**
   * The Beacon - Support Tower
   * Golden orb radiating buff auras
   */
  function drawBeacon(ctx, x, y, size, frame, attacking) {
    const s = size / 32;
    const pulseScale = 1 + Math.sin(frame * Math.PI / 3) * 0.1;

    // Buff aura ring on ground
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2*s;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(x + 16*s, y + 30*s, 14*s * pulseScale, 4*s * pulseScale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Ornate pedestal
    ctx.fillStyle = '#5A4A3A';
    ctx.fillRect(x + 10*s, y + 22*s, 12*s, 8*s);
    ctx.fillStyle = '#4A3A2A';
    ctx.fillRect(x + 8*s, y + 26*s, 16*s, 4*s);

    // Golden orb housing
    ctx.fillStyle = '#3A3A3A';
    ctx.beginPath();
    ctx.arc(x + 16*s, y + 14*s, 8*s, 0, Math.PI * 2);
    ctx.fill();

    // Golden orb (glowing)
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 15;
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(x + 16*s, y + 14*s, 6*s, 0, Math.PI * 2);
    ctx.fill();

    // Light rays
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5*s;
    const rayAngle = (frame / 6) * Math.PI;
    for (let i = 0; i < 6; i++) {
      const angle = rayAngle + (i * Math.PI / 3);
      const innerR = 7*s;
      const outerR = 12*s * pulseScale;
      ctx.beginPath();
      ctx.moveTo(
        x + 16*s + Math.cos(angle) * innerR,
        y + 14*s + Math.sin(angle) * innerR
      );
      ctx.lineTo(
        x + 16*s + Math.cos(angle) * outerR,
        y + 14*s + Math.sin(angle) * outerR
      );
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Orbiting runes
    ctx.fillStyle = COLORS.gold;
    ctx.font = `${6*s}px monospace`;
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const runeAngle = -rayAngle + (i * Math.PI * 2 / 3);
      const runeX = x + 16*s + Math.cos(runeAngle) * 10*s;
      const runeY = y + 14*s + Math.sin(runeAngle) * 10*s;
      ctx.fillText('+', runeX, runeY + 2*s);
    }
  }

  // ============================================
  // ENEMY DRAWING FUNCTIONS
  // ============================================

  /**
   * Goblin Scout - Runner
   * Small, fast goblin
   */
  function drawGoblinScout(ctx, x, y, size, frame) {
    const s = size / 24;
    const runBounce = Math.sin(frame * Math.PI / 3) * 2;

    ctx.save();
    ctx.translate(0, runBounce * s);

    // Body (tattered vest)
    ctx.fillStyle = '#4A3D2A';
    ctx.fillRect(x + 8*s, y + 10*s, 8*s, 8*s);

    // Head (green)
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.arc(x + 12*s, y + 8*s, 5*s, 0, Math.PI * 2);
    ctx.fill();

    // Big pointy ears
    ctx.beginPath();
    ctx.moveTo(x + 6*s, y + 6*s);
    ctx.lineTo(x + 4*s, y + 2*s);
    ctx.lineTo(x + 8*s, y + 6*s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 16*s, y + 6*s);
    ctx.lineTo(x + 20*s, y + 2*s);
    ctx.lineTo(x + 18*s, y + 6*s);
    ctx.closePath();
    ctx.fill();

    // Eyes (mischievous)
    ctx.fillStyle = COLORS.light;
    ctx.fillRect(x + 10*s, y + 6*s, 2*s, 2*s);
    ctx.fillRect(x + 13*s, y + 6*s, 2*s, 2*s);
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(x + 11*s, y + 7*s, 1*s, 1*s);
    ctx.fillRect(x + 14*s, y + 7*s, 1*s, 1*s);

    // Sneaky grin
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 1*s;
    ctx.beginPath();
    ctx.arc(x + 12*s, y + 10*s, 2*s, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Loot sack
    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.arc(x + 18*s, y + 14*s, 3*s, 0, Math.PI * 2);
    ctx.fill();

    // Running legs (animated)
    ctx.fillStyle = COLORS.green;
    const legOffset = frame % 2 === 0 ? 2 : -2;
    ctx.fillRect(x + 8*s + legOffset*s, y + 18*s, 3*s, 6*s);
    ctx.fillRect(x + 13*s - legOffset*s, y + 18*s, 3*s, 6*s);

    ctx.restore();
  }

  /**
   * Stone Golem - Tank
   * Massive rock creature
   */
  function drawStoneGolem(ctx, x, y, size, frame) {
    const s = size / 32;
    const stompOffset = frame % 2 === 0 ? 1 : 0;

    ctx.save();
    ctx.translate(0, stompOffset * s);

    // Heavy legs
    ctx.fillStyle = '#5A5A5A';
    ctx.fillRect(x + 6*s, y + 24*s, 8*s, 8*s);
    ctx.fillRect(x + 18*s, y + 24*s, 8*s, 8*s);

    // Body (stone)
    ctx.fillStyle = '#6A6A6A';
    ctx.fillRect(x + 4*s, y + 10*s, 24*s, 16*s);

    // Gold runes
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 5;
    ctx.font = `${8*s}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('++', x + 16*s, y + 20*s);
    ctx.shadowBlur = 0;

    // Cracks showing inner glow
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1*s;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + 8*s, y + 14*s);
    ctx.lineTo(x + 12*s, y + 18*s);
    ctx.lineTo(x + 10*s, y + 24*s);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = '#5A5A5A';
    ctx.fillRect(x + 8*s, y + 2*s, 16*s, 10*s);

    // Glowing eyes
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x + 12*s, y + 7*s, 2*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 20*s, y + 7*s, 2*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Arms (protective posture)
    ctx.fillStyle = '#5A5A5A';
    ctx.fillRect(x + 0*s, y + 12*s, 6*s, 12*s);
    ctx.fillRect(x + 26*s, y + 12*s, 6*s, 12*s);

    ctx.restore();
  }

  /**
   * Sprite Cluster - Swarm (main orb)
   */
  function drawSpriteCluster(ctx, x, y, size, frame) {
    const s = size / 24;
    const pulse = Math.sin(frame * Math.PI / 2) * 0.2 + 0.8;

    // Glow effect
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 10;

    // Main orb
    ctx.fillStyle = COLORS.cyan;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x + 12*s, y + 12*s, 8*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Inner sparkles
    ctx.fillStyle = COLORS.light;
    for (let i = 0; i < 3; i++) {
      const sparkleX = x + 8*s + Math.random() * 8*s;
      const sparkleY = y + 8*s + Math.random() * 8*s;
      ctx.fillRect(sparkleX, sparkleY, 2*s, 2*s);
    }

    // Wings (fairy-like)
    ctx.fillStyle = 'rgba(58, 230, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x + 4*s, y + 10*s, 4*s, 6*s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 20*s, y + 10*s, 4*s, 6*s, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Sparkle trail
    ctx.fillStyle = COLORS.cyan;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - 4*s, y + 10*s + frame*s, 2*s, 2*s);
    ctx.fillRect(x - 8*s, y + 14*s + frame*s, 2*s, 2*s);
    ctx.globalAlpha = 1;
  }

  /**
   * Individual Sprite (swarm unit)
   */
  function drawSprite(ctx, x, y, size, frame) {
    const s = size / 12;
    const flutter = Math.sin(frame * Math.PI) * 1;

    ctx.save();
    ctx.translate(0, flutter * s);

    // Tiny glowing body
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 5;
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(x + 6*s, y + 6*s, 3*s, 0, Math.PI * 2);
    ctx.fill();

    // Tiny wings
    ctx.fillStyle = 'rgba(58, 230, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x + 2*s, y + 5*s, 2*s, 3*s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 10*s, y + 5*s, 2*s, 3*s, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /**
   * Shrine Maiden - Healer
   * Floating spirit in red robes
   */
  function drawShrineMaiden(ctx, x, y, size, frame) {
    const s = size / 24;
    const floatOffset = Math.sin(frame * Math.PI / 2) * 2;

    ctx.save();
    ctx.translate(0, floatOffset * s);

    // Ethereal trail
    ctx.fillStyle = 'rgba(255, 77, 94, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x + 8*s, y + 20*s);
    ctx.quadraticCurveTo(x + 12*s, y + 28*s, x + 16*s, y + 20*s);
    ctx.fill();

    // Flowing robes (red)
    const gradient = ctx.createLinearGradient(x + 12*s, y + 8*s, x + 12*s, y + 22*s);
    gradient.addColorStop(0, COLORS.red);
    gradient.addColorStop(1, '#8B2030');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(x + 12*s, y + 8*s);
    ctx.lineTo(x + 18*s, y + 22*s);
    ctx.lineTo(x + 6*s, y + 22*s);
    ctx.closePath();
    ctx.fill();

    // Robe details
    ctx.strokeStyle = '#FF8090';
    ctx.lineWidth = 1*s;
    ctx.beginPath();
    ctx.moveTo(x + 12*s, y + 10*s);
    ctx.lineTo(x + 12*s, y + 20*s);
    ctx.stroke();

    // Head (serene)
    ctx.fillStyle = '#FFE0D0';
    ctx.beginPath();
    ctx.arc(x + 12*s, y + 6*s, 4*s, 0, Math.PI * 2);
    ctx.fill();

    // Closed eyes (serene)
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 1*s;
    ctx.beginPath();
    ctx.arc(x + 10*s, y + 5*s, 1*s, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 14*s, y + 5*s, 1*s, 0, Math.PI);
    ctx.stroke();

    // Healing symbols orbiting
    ctx.fillStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 5;
    ctx.font = `${6*s}px monospace`;
    ctx.textAlign = 'center';
    const healAngle = (frame / 4) * Math.PI;
    for (let i = 0; i < 3; i++) {
      const angle = healAngle + (i * Math.PI * 2 / 3);
      const hx = x + 12*s + Math.cos(angle) * 10*s;
      const hy = y + 14*s + Math.sin(angle) * 4*s;
      ctx.fillText('+', hx, hy);
    }
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /**
   * Crystal Knight - Shield Bearer
   * Armored warrior with crystal shield
   */
  function drawCrystalKnight(ctx, x, y, size, frame) {
    const s = size / 28;
    const marchBounce = Math.abs(Math.sin(frame * Math.PI / 2)) * 1;

    ctx.save();
    ctx.translate(0, marchBounce * s);

    // Armored legs
    ctx.fillStyle = '#4A5A6A';
    ctx.fillRect(x + 8*s, y + 22*s, 5*s, 6*s);
    ctx.fillRect(x + 15*s, y + 22*s, 5*s, 6*s);

    // Armored body
    ctx.fillStyle = '#5A6A7A';
    ctx.fillRect(x + 10*s, y + 12*s, 12*s, 12*s);

    // Cape
    ctx.fillStyle = '#3A4A5A';
    ctx.beginPath();
    ctx.moveTo(x + 10*s, y + 14*s);
    ctx.lineTo(x + 6*s, y + 24*s);
    ctx.lineTo(x + 10*s, y + 24*s);
    ctx.closePath();
    ctx.fill();

    // Crystal shield (hexagonal, in front)
    ctx.fillStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x + 4*s, y + 14*s);
    ctx.lineTo(x + 8*s, y + 10*s);
    ctx.lineTo(x + 12*s, y + 10*s);
    ctx.lineTo(x + 14*s, y + 14*s);
    ctx.lineTo(x + 12*s, y + 22*s);
    ctx.lineTo(x + 8*s, y + 22*s);
    ctx.closePath();
    ctx.fill();

    // Shield reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + 6*s, y + 14*s);
    ctx.lineTo(x + 9*s, y + 12*s);
    ctx.lineTo(x + 10*s, y + 16*s);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Helmet
    ctx.fillStyle = '#5A6A7A';
    ctx.fillRect(x + 12*s, y + 4*s, 10*s, 10*s);

    // T-visor with glowing eyes
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(x + 14*s, y + 6*s, 6*s, 2*s);
    ctx.fillRect(x + 16*s, y + 6*s, 2*s, 6*s);
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(x + 15*s, y + 7*s, 1*s, 1*s);
    ctx.fillRect(x + 18*s, y + 7*s, 1*s, 1*s);

    ctx.restore();
  }

  /**
   * Slime Lord - Regenerator
   * Magical slime blob
   */
  function drawSlimeLord(ctx, x, y, size, frame) {
    const s = size / 28;
    const squish = Math.sin(frame * Math.PI / 3);
    const widthMod = 1 + squish * 0.15;
    const heightMod = 1 - squish * 0.1;

    // Slime trail
    ctx.fillStyle = 'rgba(46, 229, 157, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 10*s, y + 26*s, 4*s, 2*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main body (squishing)
    ctx.save();
    ctx.translate(x + 14*s, y + 16*s);
    ctx.scale(widthMod, heightMod);

    ctx.fillStyle = COLORS.green;
    ctx.shadowColor = COLORS.green;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10*s, 8*s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Darker green underneath
    ctx.fillStyle = '#1E8A5D';
    ctx.beginPath();
    ctx.ellipse(0, 4*s, 8*s, 4*s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Gold nucleus (visible inside)
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + 14*s, y + 14*s, 4*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bubbles rising
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const bubbleOffset = frame % 4;
    ctx.beginPath();
    ctx.arc(x + 10*s, y + 12*s - bubbleOffset*s, 2*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 18*s, y + 14*s - bubbleOffset*s, 1.5*s, 0, Math.PI * 2);
    ctx.fill();

    // Simple eyes
    ctx.fillStyle = COLORS.dark;
    ctx.beginPath();
    ctx.arc(x + 11*s, y + 12*s, 1.5*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 17*s, y + 12*s, 1.5*s, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Molten King - Boss
   * Massive demon lord with flames
   */
  function drawMoltenKing(ctx, x, y, size, frame) {
    const s = size / 48;
    const flameFlicker = Math.sin(frame * Math.PI / 2) * 2;

    // Ground smoldering
    ctx.fillStyle = 'rgba(255, 77, 94, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 24*s, y + 46*s, 20*s, 4*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Massive legs
    ctx.fillStyle = '#4A2A2A';
    ctx.fillRect(x + 8*s, y + 36*s, 12*s, 12*s);
    ctx.fillRect(x + 28*s, y + 36*s, 12*s, 12*s);

    // Lava cracks on legs
    ctx.strokeStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1*s;
    ctx.beginPath();
    ctx.moveTo(x + 12*s, y + 38*s);
    ctx.lineTo(x + 14*s, y + 44*s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 32*s, y + 38*s);
    ctx.lineTo(x + 34*s, y + 44*s);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Armored torso
    ctx.fillStyle = '#3A2020';
    ctx.fillRect(x + 8*s, y + 16*s, 32*s, 22*s);

    // Lava cracks on torso
    ctx.strokeStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2*s;
    ctx.beginPath();
    ctx.moveTo(x + 16*s, y + 20*s);
    ctx.lineTo(x + 20*s, y + 28*s);
    ctx.lineTo(x + 18*s, y + 36*s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 32*s, y + 20*s);
    ctx.lineTo(x + 28*s, y + 28*s);
    ctx.lineTo(x + 30*s, y + 36*s);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Armor plates
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x + 12*s, y + 18*s, 4*s, 4*s);
    ctx.fillRect(x + 32*s, y + 18*s, 4*s, 4*s);

    // Head
    ctx.fillStyle = '#2A1515';
    ctx.fillRect(x + 14*s, y + 4*s, 20*s, 14*s);

    // Burning eyes
    ctx.fillStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + 20*s, y + 10*s, 3*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 28*s, y + 10*s, 3*s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Crown of flames
    ctx.save();
    ctx.translate(0, flameFlicker * s);

    for (let i = 0; i < 5; i++) {
      const flameX = x + 12*s + i * 6*s;
      const flameHeight = 8 + Math.sin((frame + i) * Math.PI / 2) * 4;

      // Flame gradient
      const flameGrad = ctx.createLinearGradient(flameX, y - flameHeight*s, flameX, y + 4*s);
      flameGrad.addColorStop(0, '#FFFF00');
      flameGrad.addColorStop(0.3, COLORS.gold);
      flameGrad.addColorStop(1, COLORS.red);
      ctx.fillStyle = flameGrad;

      ctx.beginPath();
      ctx.moveTo(flameX, y + 4*s);
      ctx.quadraticCurveTo(flameX - 3*s, y - flameHeight*s/2, flameX, y - flameHeight*s);
      ctx.quadraticCurveTo(flameX + 3*s, y - flameHeight*s/2, flameX, y + 4*s);
      ctx.fill();
    }

    ctx.restore();

    // Tattered wings (optional, behind body)
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#3A2020';
    ctx.beginPath();
    ctx.moveTo(x + 8*s, y + 16*s);
    ctx.quadraticCurveTo(x - 8*s, y + 8*s, x - 4*s, y + 20*s);
    ctx.lineTo(x + 8*s, y + 28*s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 40*s, y + 16*s);
    ctx.quadraticCurveTo(x + 56*s, y + 8*s, x + 52*s, y + 20*s);
    ctx.lineTo(x + 40*s, y + 28*s);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    // Configuration
    SPRITE_CONFIG,
    COLORS,

    // Animation
    updateTick,
    getAnimationFrame,
    getWalkFrame,

    // Drawing
    drawTower,
    drawEnemy,

    // Utilities
    getSpriteSize: (type, category) => {
      const config = category === 'tower'
        ? SPRITE_CONFIG.towers[type]
        : SPRITE_CONFIG.enemies[type];
      return config ? config.size : 24;
    }
  };
})();

// Export for use in renderer
window.SpriteSystem = SpriteSystem;
