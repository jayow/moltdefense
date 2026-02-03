#!/usr/bin/env node
/**
 * Moltdefense Experimental Agent
 *
 * Playstyle:
 * - Attack: New enemy types (boss, shieldBearer), special combos
 * - Defense: Sniper + chain focus, optimal free-flow placement
 *
 * Uses all the Phase 17 expanded mechanics
 *
 * Usage:
 *   node experimental-agent.js --side attack|defend
 */

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  side: 'attack',
  name: `experimental_${Math.random().toString(36).slice(2, 8)}`,
  server: 'http://localhost:3000',
  quiet: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--side':
    case '-s':
      options.side = args[++i];
      break;
    case '--name':
    case '-n':
      options.name = args[++i];
      break;
    case '--server':
      options.server = args[++i];
      break;
    case '--quiet':
    case '-q':
      options.quiet = true;
      break;
    case '--help':
    case '-h':
      console.log(`
Moltdefense Experimental Agent

Uses all Phase 17 expanded game mechanics:
  Attack: Boss, shieldBearer, aura combos, invisibility
  Defense: Sniper (armor pierce), chain, optimal placement

Usage: node experimental-agent.js [options]

Options:
  --side, -s <side>    Side to play (attack or defend)
  --name, -n <name>    Agent name (default: random)
  --server <url>       Server URL (default: http://localhost:3000)
  --quiet, -q          Minimal output
  --help, -h           Show this help
      `);
      process.exit(0);
  }
}

function log(...args) {
  if (!options.quiet) {
    console.log(...args);
  }
}

/**
 * Generate experimental attack build
 * - ShieldBearers for armor aura
 * - Healer for sustain
 * - Regenerator for self-heal
 * Budget: shieldBearer=90, runner=50, healer=80, regenerator=85, shield=40, invisibility=50
 */
function generateExperimentalAttack() {
  return {
    waves: [
      { shieldBearer: 1 },               // Wave 1: 90pts - armor aura
      { runner: 2 },                     // Wave 2: 100pts - fast units
      { healer: 1 },                     // Wave 3: 80pts - sustain
      { regenerator: 1 },                // Wave 4: 85pts - self-heal
      { runner: 1 }                      // Wave 5: 50pts
    ],
    waveTimings: [
      { rush: false },
      { rush: true },
      { rush: false },
      { rush: false },
      { rush: true }
    ],
    powerUps: [
      { type: 'shield', wave: 4 },       // Shield the regen
      { type: 'invisibility', wave: 5 }  // Stealth final wave
    ]
  };
  // Total: 405pts + 90pts = 495pts
}

/**
 * Generate experimental defense build
 * - Sniper for armor pierce
 * - Chain for group clear
 * - Slow and basic for coverage
 * Budget: sniper=175, chain=125, slow=100, basic=100
 */
function generateExperimentalDefense() {
  return {
    towers: [
      { x: 150, type: 'sniper', lane: 'top' },   // 175pts - armor pierce
      { x: 400, type: 'chain', lane: 'bottom' }, // 125pts - group damage
      { x: 600, type: 'slow', lane: 'top' },     // 100pts - slow down
      { x: 800, type: 'basic', lane: 'bottom' }  // 100pts - cleanup
    ],
    powerUps: []
  };
  // Total: 500pts exactly
}

// Main agent logic
async function main() {
  log(`\n=== EXPERIMENTAL AGENT ===`);
  log(`Agent: ${options.name}`);
  log(`Side: ${options.side.toUpperCase()}`);
  log(`Server: ${options.server}`);
  log('Mechanics: Boss, ShieldBearer, Sniper, Chain, Invisibility');
  log('');

  // Generate build based on side
  const build = options.side === 'attack'
    ? generateExperimentalAttack()
    : generateExperimentalDefense();

  log('Generated build:');
  if (options.side === 'attack') {
    build.waves.forEach((wave, i) => {
      const units = Object.entries(wave).map(([t, c]) => `${c}x ${t}`).join(', ');
      const timing = build.waveTimings[i]?.rush ? ' [RUSH]' : '';
      log(`  Wave ${i + 1}: ${units}${timing}`);
    });
    if (build.powerUps?.length) {
      log(`  Power-ups: ${build.powerUps.map(p => `${p.type} (wave ${p.wave})`).join(', ')}`);
    }
  } else {
    build.towers.forEach((t, i) => {
      log(`  Tower ${i + 1}: ${t.type} at x=${t.x} (${t.lane})`);
    });
    if (build.powerUps?.length) {
      log(`  Power-ups: ${build.powerUps.map(p => `${p.type} (wave ${p.wave})`).join(', ')}`);
    }
  }
  log('');

  // Submit to server
  log('Submitting build...');

  try {
    const response = await fetch(`${options.server}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: options.name,
        side: options.side === 'attack' ? 'attack' : 'defend',
        build
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      console.error('Error:', data.error);
      process.exit(1);
    }

    if (data.status === 'queued') {
      log(`Queued at position ${data.queue_position}`);
      log('Waiting for opponent...');
      console.log(JSON.stringify({ status: 'queued', agent: options.name }));
      return;
    }

    if (data.status === 'matched') {
      log(`Matched! Match ID: ${data.match_id}`);
      log(`Opponent: ${data.opponent}`);
      await pollForResults(data.match_id);
    }
  } catch (error) {
    console.error('Failed to connect to server:', error.message);
    process.exit(1);
  }
}

async function pollForResults(matchId) {
  log('Waiting for match to complete...');
  const timeout = 120000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${options.server}/results/${matchId}`);
      const data = await response.json();

      if (data.status === 'complete') {
        printResults(data);
        return;
      }

      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('Timeout waiting for match results');
  process.exit(1);
}

function printResults(results) {
  const won = (options.side === 'attack' && results.winner === 'attacker') ||
              (options.side === 'defend' && results.winner === 'defender');

  log('');
  log('=== MATCH RESULTS ===');
  log(`Winner: ${results.winner.toUpperCase()}`);
  log(`Duration: ${results.durationSeconds}s`);
  log(`Waves completed: ${results.wavesCompleted}`);
  log('');

  if (options.side === 'attack') {
    log(`Enemies leaked: ${results.attacker.leaked}`);
  } else {
    log(`Kills: ${results.defender.totalKills}`);
    log(`Damage dealt: ${results.defender.damageDealt}`);
  }
  log('');

  if (won) {
    log('*** EXPERIMENTAL AGENT WINS! ***');
    log('New mechanics proved effective!');
  } else {
    log('Experimental strategy needs refinement.');
  }

  console.log(JSON.stringify({
    status: 'complete',
    agent: options.name,
    side: options.side,
    strategy: 'experimental',
    won,
    results
  }));
}

main().catch(error => {
  console.error('Agent error:', error);
  process.exit(1);
});
