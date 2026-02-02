#!/usr/bin/env node
/**
 * Moltdefense Batch Test Runner
 *
 * Runs multiple matches between attacker and defender agents.
 *
 * Usage:
 *   node runner.js [options]
 *
 * Options:
 *   --matches <n>        Number of matches to run (default: 5)
 *   --attacker <strat>   Attacker strategy (default: random each match)
 *   --defender <strat>   Defender strategy (default: random each match)
 *   --server <url>       Server URL (default: http://localhost:3000)
 *   --delay <ms>         Delay between matches (default: 2000)
 *   --help               Show help
 */

const { spawn } = require('child_process');
const path = require('path');
const {
  generateAttackBuild,
  generateDefenseBuild,
  calculateAttackCost,
  calculateDefenseCost,
  getRandomStrategy,
  ATTACK_STRATEGIES,
  DEFEND_STRATEGIES
} = require('./strategies');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  matches: 5,
  attacker: null, // null = random each match
  defender: null,
  server: 'http://localhost:3000',
  delay: 2000
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--matches':
    case '-m':
      options.matches = parseInt(args[++i], 10);
      break;
    case '--attacker':
    case '-a':
      options.attacker = args[++i];
      break;
    case '--defender':
    case '-d':
      options.defender = args[++i];
      break;
    case '--server':
      options.server = args[++i];
      break;
    case '--delay':
      options.delay = parseInt(args[++i], 10);
      break;
    case '--help':
    case '-h':
      console.log(`
Moltdefense Batch Test Runner

Usage: node runner.js [options]

Options:
  --matches, -m <n>       Number of matches (default: 5)
  --attacker, -a <strat>  Attacker strategy (default: random each match)
  --defender, -d <strat>  Defender strategy (default: random each match)
  --server <url>          Server URL (default: http://localhost:3000)
  --delay <ms>            Delay between matches (default: 2000)
  --help, -h              Show this help

Attacker strategies: ${ATTACK_STRATEGIES.join(', ')}
Defender strategies: ${DEFEND_STRATEGIES.join(', ')}
      `);
      process.exit(0);
  }
}

// Statistics tracking
const stats = {
  total: 0,
  attackerWins: 0,
  defenderWins: 0,
  matchups: {}
};

async function runMatch(matchNum, attackStrategy, defendStrategy) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`MATCH ${matchNum}/${options.matches}`);
  console.log(`Attacker: ${attackStrategy} vs Defender: ${defendStrategy}`);
  console.log('='.repeat(60));

  const attackerName = `attacker_${matchNum}_${Date.now()}`;
  const defenderName = `defender_${matchNum}_${Date.now()}`;

  // Generate builds
  const attackBuild = generateAttackBuild(attackStrategy);
  const defendBuild = generateDefenseBuild(defendStrategy);

  console.log(`\nAttacker build (${attackStrategy}):`);
  attackBuild.waves.forEach((wave, i) => {
    const units = Object.entries(wave).map(([t, c]) => `${c}x ${t}`).join(', ');
    console.log(`  Wave ${i + 1}: ${units}`);
  });
  console.log(`  Cost: ${calculateAttackCost(attackBuild)}/500`);

  console.log(`\nDefender build (${defendStrategy}):`);
  for (const [slot, type] of Object.entries(defendBuild.towers)) {
    if (type) {
      console.log(`  Slot ${slot}: ${type}`);
    }
  }
  console.log(`  Cost: ${calculateDefenseCost(defendBuild)}/500`);

  // Submit both builds
  console.log('\nSubmitting builds...');

  try {
    // Submit attacker first
    const attackResponse = await fetch(`${options.server}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: attackerName,
        side: 'attack',
        build: attackBuild
      })
    });
    const attackData = await attackResponse.json();

    if (attackData.status === 'error') {
      console.error('Attacker error:', attackData.error);
      return null;
    }

    // Submit defender
    const defendResponse = await fetch(`${options.server}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: defenderName,
        side: 'defend',
        build: defendBuild
      })
    });
    const defendData = await defendResponse.json();

    if (defendData.status === 'error') {
      console.error('Defender error:', defendData.error);
      return null;
    }

    if (defendData.status !== 'matched') {
      console.error('Unexpected response:', defendData);
      return null;
    }

    const matchId = defendData.match_id;
    console.log(`Match started: ${matchId}`);

    // Poll for results
    const results = await pollForResults(matchId);
    return {
      matchId,
      attackStrategy,
      defendStrategy,
      results
    };

  } catch (error) {
    console.error('Match error:', error.message);
    return null;
  }
}

async function pollForResults(matchId) {
  const startTime = Date.now();
  const timeout = 120000; // 2 minutes

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${options.server}/results/${matchId}`);
      const data = await response.json();

      if (data.status === 'complete') {
        return data;
      }

      // Wait before polling again
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.error('Timeout waiting for results');
  return null;
}

function recordResult(matchResult) {
  if (!matchResult || !matchResult.results) return;

  const { attackStrategy, defendStrategy, results } = matchResult;
  const winner = results.winner;

  stats.total++;
  if (winner === 'attacker') {
    stats.attackerWins++;
  } else {
    stats.defenderWins++;
  }

  // Track matchup statistics
  const matchupKey = `${attackStrategy} vs ${defendStrategy}`;
  if (!stats.matchups[matchupKey]) {
    stats.matchups[matchupKey] = { total: 0, attackerWins: 0, defenderWins: 0 };
  }
  stats.matchups[matchupKey].total++;
  if (winner === 'attacker') {
    stats.matchups[matchupKey].attackerWins++;
  } else {
    stats.matchups[matchupKey].defenderWins++;
  }

  // Print match result
  console.log(`\nResult: ${winner.toUpperCase()} WINS`);
  console.log(`Duration: ${results.durationSeconds}s`);
  console.log(`Enemies: ${results.attacker.totalEnemies} spawned, ${results.defender.totalKills} killed, ${results.attacker.leaked} leaked`);
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('FINAL STATISTICS');
  console.log('='.repeat(60));
  console.log(`\nTotal matches: ${stats.total}`);
  console.log(`Attacker wins: ${stats.attackerWins} (${((stats.attackerWins / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Defender wins: ${stats.defenderWins} (${((stats.defenderWins / stats.total) * 100).toFixed(1)}%)`);

  if (Object.keys(stats.matchups).length > 0) {
    console.log('\nMatchup breakdown:');
    for (const [matchup, data] of Object.entries(stats.matchups)) {
      const attackWinRate = ((data.attackerWins / data.total) * 100).toFixed(1);
      console.log(`  ${matchup}: ${data.total} games, Attacker ${attackWinRate}%`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('MOLTDEFENSE BATCH TEST RUNNER');
  console.log('='.repeat(60));
  console.log(`Matches to run: ${options.matches}`);
  console.log(`Attacker strategy: ${options.attacker || 'random'}`);
  console.log(`Defender strategy: ${options.defender || 'random'}`);
  console.log(`Server: ${options.server}`);

  // Check server health
  try {
    const health = await fetch(`${options.server}/health`);
    const data = await health.json();
    if (data.status !== 'ok') {
      throw new Error('Server not healthy');
    }
    console.log('Server: OK');
  } catch (error) {
    console.error('\nError: Cannot connect to server at', options.server);
    console.error('Make sure the server is running with: node server/index.js');
    process.exit(1);
  }

  // Run matches
  for (let i = 1; i <= options.matches; i++) {
    const attackStrategy = options.attacker || getRandomStrategy('attack');
    const defendStrategy = options.defender || getRandomStrategy('defend');

    const result = await runMatch(i, attackStrategy, defendStrategy);
    recordResult(result);

    // Delay between matches
    if (i < options.matches) {
      await new Promise(r => setTimeout(r, options.delay));
    }
  }

  // Print final summary
  printSummary();
}

main().catch(error => {
  console.error('Runner error:', error);
  process.exit(1);
});
