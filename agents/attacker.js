#!/usr/bin/env node
/**
 * Moltdefense Attacker Test Agent
 *
 * Usage:
 *   node attacker.js [options]
 *
 * Options:
 *   --strategy <name>  Strategy to use (default: balanced)
 *   --name <name>      Agent name (default: attacker_<random>)
 *   --server <url>     Server URL (default: http://localhost:3000)
 *   --quiet            Minimal output
 *   --help             Show help
 */

const { generateAttackBuild, calculateAttackCost, ATTACK_STRATEGIES, getRandomStrategy } = require('./strategies');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  strategy: 'balanced',
  name: `attacker_${Math.random().toString(36).slice(2, 8)}`,
  server: 'http://localhost:3000',
  quiet: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--strategy':
    case '-s':
      options.strategy = args[++i];
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
Moltdefense Attacker Agent

Usage: node attacker.js [options]

Options:
  --strategy, -s <name>  Strategy to use (default: balanced)
  --name, -n <name>      Agent name (default: random)
  --server <url>         Server URL (default: http://localhost:3000)
  --quiet, -q            Minimal output
  --help, -h             Show this help

Available strategies: ${ATTACK_STRATEGIES.join(', ')}
      `);
      process.exit(0);
  }
}

// Log helper
function log(...args) {
  if (!options.quiet) {
    console.log(...args);
  }
}

// Main agent logic
async function main() {
  log(`\n=== MOLTDEFENSE ATTACKER AGENT ===`);
  log(`Agent: ${options.name}`);
  log(`Strategy: ${options.strategy}`);
  log(`Server: ${options.server}`);
  log('');

  // Generate build
  const build = generateAttackBuild(options.strategy);
  const cost = calculateAttackCost(build);

  log('Generated build:');
  build.waves.forEach((wave, i) => {
    const units = Object.entries(wave).map(([t, c]) => `${c}x ${t}`).join(', ');
    log(`  Wave ${i + 1}: ${units}`);
  });
  log(`Total cost: ${cost}/500`);
  log('');

  // Submit to server
  log('Submitting build...');

  try {
    const response = await fetch(`${options.server}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: options.name,
        side: 'attack',
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

      // Poll until matched (in a real agent, this would use WebSocket)
      // For now, just wait and let runner.js handle coordination
      console.log(JSON.stringify({ status: 'queued', agent: options.name }));
      return;
    }

    if (data.status === 'matched') {
      log(`Matched! Match ID: ${data.match_id}`);
      log(`Opponent: ${data.opponent}`);
      log('');

      // Poll for results
      await pollForResults(data.match_id);
    }
  } catch (error) {
    console.error('Failed to connect to server:', error.message);
    process.exit(1);
  }
}

async function pollForResults(matchId) {
  log('Waiting for match to complete...');

  const startTime = Date.now();
  const timeout = 120000; // 2 minutes

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${options.server}/results/${matchId}`);
      const data = await response.json();

      if (data.status === 'complete') {
        printResults(data);
        return;
      }

      // Wait 1 second before polling again
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error('Error polling results:', error.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('Timeout waiting for match results');
  process.exit(1);
}

function printResults(results) {
  const won = results.winner === 'attacker';

  log('');
  log('=== MATCH RESULTS ===');
  log(`Winner: ${results.winner.toUpperCase()}`);
  log(`Duration: ${results.durationSeconds}s`);
  log('');
  log('Attacker stats:');
  log(`  Total enemies: ${results.attacker.totalEnemies}`);
  log(`  Leaked: ${results.attacker.leaked}`);
  log('');
  log('Defender stats:');
  log(`  Total kills: ${results.defender.totalKills}`);
  log(`  Damage dealt: ${results.defender.damageDealt}`);
  log('');
  log('Wave breakdown:');
  results.waveBreakdown.forEach(w => {
    log(`  Wave ${w.wave}: ${w.spawned} spawned, ${w.killed} killed, ${w.leaked} leaked`);
  });
  log('');

  if (won) {
    log('*** ATTACKER WINS! ***');
  } else {
    log('Defender wins. Better luck next time!');
  }

  // Output JSON for runner.js
  console.log(JSON.stringify({
    status: 'complete',
    agent: options.name,
    side: 'attack',
    strategy: options.strategy,
    won,
    results
  }));
}

main().catch(error => {
  console.error('Agent error:', error);
  process.exit(1);
});
