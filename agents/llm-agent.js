#!/usr/bin/env node
/**
 * LLM Agent for Moltdefense
 * Uses AI to generate strategic builds and play the game
 *
 * Usage:
 *   LLM_PROVIDER=ollama LLM_MODEL=llama3 node agents/llm-agent.js --side attack
 *   LLM_PROVIDER=openai LLM_MODEL=gpt-4o-mini node agents/llm-agent.js --side defend
 */

const fs = require('fs');
const path = require('path');
const { chat, checkProvider } = require('./llm-providers');

// Game constants for validation
const BUDGET = 500;
const ENEMY_COSTS = { runner: 50, tank: 100, swarm: 75 };
const TOWER_COSTS = { basic: 100, slow: 100, burst: 150 };
const TOWER_SLOTS = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_WAVES = 5;

// Configuration
const GAME_SERVER = process.env.GAME_SERVER_URL || 'http://localhost:3000';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    side: null,
    agentId: `llm_${Date.now()}`
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--side' && args[i + 1]) {
      options.side = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--id' && args[i + 1]) {
      options.agentId = args[i + 1];
      i++;
    }
  }

  if (!options.side || !['attack', 'defend'].includes(options.side)) {
    console.error('Usage: node llm-agent.js --side <attack|defend> [--id <agent_id>]');
    console.error('');
    console.error('Environment variables:');
    console.error('  LLM_PROVIDER=openai|anthropic|ollama (default: ollama)');
    console.error('  LLM_MODEL=<model_name> (default: llama3 for ollama)');
    console.error('  OPENAI_API_KEY=... (for OpenAI)');
    console.error('  ANTHROPIC_API_KEY=... (for Anthropic)');
    console.error('  OLLAMA_HOST=http://localhost:11434 (for Ollama)');
    console.error('  GAME_SERVER_URL=http://localhost:3000');
    process.exit(1);
  }

  return options;
}

/**
 * Load game rules from SKILL.md
 */
function loadGameRules() {
  const skillPath = path.join(__dirname, '../skill/SKILL.md');
  try {
    return fs.readFileSync(skillPath, 'utf8');
  } catch (error) {
    console.error('Error loading SKILL.md:', error.message);
    process.exit(1);
  }
}

/**
 * Build the system prompt for the LLM
 */
function buildSystemPrompt(gameRules, side) {
  return `You are an AI agent playing Moltdefense, a competitive tower defense game.

GAME RULES:
${gameRules}

YOUR ROLE: ${side === 'attack' ? 'ATTACKER' : 'DEFENDER'}

${side === 'attack' ? `
As the ATTACKER, you must design 5 waves of enemies to break through the defense.
- Budget: 500 points total across all 5 waves
- Enemy types: runner (50), tank (100), swarm (75)
- You MUST have exactly 5 waves
- Each wave must have at least 1 enemy

Respond with ONLY a valid JSON object in this exact format:
{"waves": [{"runner": 2}, {"tank": 1}, {"swarm": 1}, {"runner": 2}, {"tank": 1}]}
` : `
As the DEFENDER, you must place towers along the path to stop all enemies.
- Budget: 500 points total
- Tower types: basic (100), slow (100), burst (150)
- Slots: A, B, C, D, E (positions 100, 300, 500, 700, 900)
- You don't have to fill every slot

Respond with ONLY a valid JSON object in this exact format:
{"towers": {"A": "slow", "B": "basic", "C": "burst", "D": "basic"}}
`}

Think strategically! Consider:
- Unit/tower combinations that work well together
- Budget efficiency
- Positioning and timing

Respond with ONLY the JSON object, no explanation or markdown.`;
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJSON(response) {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

/**
 * Validate an attack build
 */
function validateAttackBuild(build) {
  if (!build.waves || !Array.isArray(build.waves)) {
    return { valid: false, error: 'Build must have waves array' };
  }

  if (build.waves.length !== TOTAL_WAVES) {
    return { valid: false, error: `Must have exactly ${TOTAL_WAVES} waves, got ${build.waves.length}` };
  }

  let totalCost = 0;
  for (let i = 0; i < build.waves.length; i++) {
    const wave = build.waves[i];
    if (!wave || typeof wave !== 'object') {
      return { valid: false, error: `Wave ${i + 1} is invalid` };
    }

    let waveHasEnemy = false;
    for (const [type, count] of Object.entries(wave)) {
      if (!ENEMY_COSTS[type]) {
        return { valid: false, error: `Invalid enemy type: ${type}` };
      }
      if (typeof count !== 'number' || count < 0) {
        return { valid: false, error: `Invalid count for ${type}: ${count}` };
      }
      if (count > 0) {
        waveHasEnemy = true;
        totalCost += ENEMY_COSTS[type] * count;
      }
    }

    if (!waveHasEnemy) {
      return { valid: false, error: `Wave ${i + 1} has no enemies` };
    }
  }

  if (totalCost > BUDGET) {
    return { valid: false, error: `Over budget: ${totalCost} > ${BUDGET}` };
  }

  return { valid: true, cost: totalCost };
}

/**
 * Validate a defense build
 */
function validateDefenseBuild(build) {
  if (!build.towers || typeof build.towers !== 'object') {
    return { valid: false, error: 'Build must have towers object' };
  }

  let totalCost = 0;
  for (const [slot, type] of Object.entries(build.towers)) {
    if (!TOWER_SLOTS.includes(slot)) {
      return { valid: false, error: `Invalid slot: ${slot}` };
    }
    if (!TOWER_COSTS[type]) {
      return { valid: false, error: `Invalid tower type: ${type}` };
    }
    totalCost += TOWER_COSTS[type];
  }

  if (totalCost > BUDGET) {
    return { valid: false, error: `Over budget: ${totalCost} > ${BUDGET}` };
  }

  if (Object.keys(build.towers).length === 0) {
    return { valid: false, error: 'Must have at least one tower' };
  }

  return { valid: true, cost: totalCost };
}

/**
 * Generate a build using the LLM
 */
async function generateBuild(side, maxRetries = 3) {
  const gameRules = loadGameRules();
  const systemPrompt = buildSystemPrompt(gameRules, side);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\nAttempt ${attempt}/${maxRetries}: Generating ${side} build...`);

    try {
      const response = await chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ${side === 'attack' ? 'strong attack' : 'solid defense'} build. Remember to stay within the 500 point budget.` }
      ]);

      console.log('LLM response:', response.substring(0, 200) + (response.length > 200 ? '...' : ''));

      const build = parseJSON(response);
      console.log('Parsed build:', JSON.stringify(build, null, 2));

      // Validate
      const validation = side === 'attack'
        ? validateAttackBuild(build)
        : validateDefenseBuild(build);

      if (!validation.valid) {
        console.error('Validation failed:', validation.error);
        if (attempt < maxRetries) {
          console.log('Retrying...');
          continue;
        }
        throw new Error(`Build validation failed: ${validation.error}`);
      }

      console.log(`Build valid! Cost: ${validation.cost}/${BUDGET}`);
      return build;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt >= maxRetries) {
        throw error;
      }
    }
  }
}

/**
 * Submit build to game server
 */
async function submitBuild(agentId, side, build) {
  console.log(`\nSubmitting ${side} build to ${GAME_SERVER}...`);

  const response = await fetch(`${GAME_SERVER}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      side: side,
      build: build
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Submit failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Poll for match results
 */
async function waitForResults(matchId, timeout = 180000) {
  console.log(`\nWaiting for match ${matchId} to complete...`);

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${GAME_SERVER}/results/${matchId}`);
      const data = await response.json();

      if (data.status === 'complete') {
        return data;
      }

      // Show progress
      if (data.currentWave) {
        process.stdout.write(`\rWave ${data.currentWave}/${data.totalWaves}...`);
      }
    } catch (error) {
      // Server might not have results yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Timeout waiting for match results');
}

/**
 * Display match results
 */
function displayResults(results, ourSide) {
  console.log('\n');
  console.log('═'.repeat(50));
  console.log('                 MATCH RESULTS');
  console.log('═'.repeat(50));
  console.log(`Match ID: ${results.matchId}`);
  console.log(`Duration: ${results.durationSeconds} seconds`);
  console.log(`Waves: ${results.wavesCompleted}/${results.wavesCompleted}`);
  console.log('');

  const weWon = results.winner === (ourSide === 'attack' ? 'attacker' : 'defender');
  console.log(`Winner: ${results.winner.toUpperCase()}`);
  console.log(weWon ? '*** YOU WON! ***' : '*** YOU LOST ***');
  console.log('');

  console.log('Attacker Stats:');
  console.log(`  Agent: ${results.attacker.agentId}`);
  console.log(`  Total Enemies: ${results.attacker.totalEnemies}`);
  console.log(`  Leaked: ${results.attacker.leaked}`);
  console.log('');

  console.log('Defender Stats:');
  console.log(`  Agent: ${results.defender.agentId}`);
  console.log(`  Total Kills: ${results.defender.totalKills}`);
  console.log(`  Damage Dealt: ${results.defender.damageDealt}`);
  console.log('═'.repeat(50));
}

/**
 * Main entry point
 */
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║          MOLTDEFENSE LLM AGENT                 ║');
  console.log('╚════════════════════════════════════════════════╝');

  // Parse arguments
  const options = parseArgs();
  console.log(`\nAgent ID: ${options.agentId}`);
  console.log(`Side: ${options.side}`);

  // Check LLM provider
  console.log('\nChecking LLM provider...');
  const providerOk = await checkProvider();
  if (!providerOk) {
    console.error('LLM provider not available. Check your configuration.');
    process.exit(1);
  }

  try {
    // Generate build using LLM
    const build = await generateBuild(options.side);

    // Submit to game server
    const submitResult = await submitBuild(options.agentId, options.side, build);
    console.log('Submit result:', submitResult);

    if (submitResult.status === 'matched') {
      // Match started immediately
      console.log(`\nMatched with opponent! Match ID: ${submitResult.match_id}`);
      console.log(`Watch at: ${GAME_SERVER}`);

      // Wait for results
      const results = await waitForResults(submitResult.match_id);
      displayResults(results, options.side);

    } else if (submitResult.status === 'queued') {
      // Waiting for opponent
      console.log(`\nQueued at position ${submitResult.position}. Waiting for opponent...`);
      console.log('Run another agent with the opposite side to start a match.');
      console.log('');
      console.log('Example:');
      console.log(`  node agents/llm-agent.js --side ${options.side === 'attack' ? 'defend' : 'attack'}`);

    } else {
      console.log('Unexpected response:', submitResult);
    }

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

// Run
main();
