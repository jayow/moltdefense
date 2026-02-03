#!/usr/bin/env node
/**
 * Moltdefense Named Agents
 *
 * 4 distinct agents with persistent identities for ELO tracking:
 * - BlitzRunner (attacker) - Fast rush strategy
 * - IronWall (attacker) - Tank sustain strategy
 * - Spectre (attacker) - Stealth/regen strategy
 * - Sentinel (defender) - Balanced defense
 *
 * Usage:
 *   node named-agents.js --agent BlitzRunner
 *   node named-agents.js --agent Sentinel
 */

const AGENTS = {
  // === ATTACKERS ===

  BlitzRunner: {
    side: 'attack',
    description: 'Fast rush - runners with speedBoost',
    build: {
      waves: [
        { runner: 2 },              // 100pts
        { runner: 2 },              // 100pts
        { runner: 1, swarm: 1 },    // 125pts
        { runner: 2 },              // 100pts
        { runner: 1 }               // 50pts
      ],
      waveTimings: [
        { rush: false },
        { rush: true },
        { rush: true },
        { rush: true },
        { rush: true }
      ],
      powerUps: [
        { type: 'speedBoost', wave: 5 }
      ]
    }
    // Total: 475 + 25 = 500pts
  },

  IronWall: {
    side: 'attack',
    description: 'Tank sustain - tanks with healPulse',
    build: {
      waves: [
        { tank: 1 },                // 100pts
        { tank: 1 },                // 100pts
        { healer: 1 },              // 80pts
        { regenerator: 1 },         // 85pts
        { tank: 1 }                 // 100pts
      ],
      waveTimings: [
        { rush: false },
        { rush: false },
        { rush: false },
        { rush: false },
        { rush: false }
      ],
      powerUps: [
        { type: 'healPulse', wave: 5 }
      ]
    }
    // Total: 465 + 35 = 500pts
  },

  Spectre: {
    side: 'attack',
    description: 'Stealth regen - invisibility and shields',
    build: {
      waves: [
        { shieldBearer: 1 },        // 90pts
        { runner: 2 },              // 100pts
        { healer: 1 },              // 80pts
        { regenerator: 1 },         // 85pts
        { runner: 1 }               // 50pts
      ],
      waveTimings: [
        { rush: false },
        { rush: true },
        { rush: false },
        { rush: false },
        { rush: true }
      ],
      powerUps: [
        { type: 'shield', wave: 4 },
        { type: 'invisibility', wave: 5 }
      ]
    }
    // Total: 405 + 90 = 495pts
  },

  // === DEFENDERS ===

  Sentinel: {
    side: 'defend',
    description: 'Balanced defense - sniper, chain, slow',
    build: {
      towers: [
        { x: 150, type: 'sniper', lane: 'top' },    // 175pts
        { x: 400, type: 'chain', lane: 'bottom' },  // 125pts
        { x: 600, type: 'slow', lane: 'top' },      // 100pts
        { x: 800, type: 'basic', lane: 'bottom' }   // 100pts
      ],
      powerUps: []
    }
    // Total: 500pts
  },

  Fortress: {
    side: 'defend',
    description: 'Slow wall - maximize enemy time in range',
    build: {
      towers: [
        { x: 100, type: 'slow', lane: 'top' },      // 100pts
        { x: 300, type: 'slow', lane: 'bottom' },   // 100pts
        { x: 500, type: 'support', lane: 'top' },   // 80pts
        { x: 600, type: 'basic', lane: 'bottom' },  // 100pts
        { x: 800, type: 'slow', lane: 'top' }       // 100pts
      ],
      powerUps: []
    }
    // Total: 480pts
  },

  Striker: {
    side: 'defend',
    description: 'Burst damage - front-loaded burst towers',
    build: {
      towers: [
        { x: 100, type: 'burst', lane: 'top' },     // 150pts
        { x: 250, type: 'burst', lane: 'bottom' },  // 150pts
        { x: 450, type: 'basic', lane: 'top' },     // 100pts
        { x: 650, type: 'basic', lane: 'bottom' }   // 100pts
      ],
      powerUps: []
    }
    // Total: 500pts
  },

  Guardian: {
    side: 'defend',
    description: 'Support focused - buffed damage output',
    build: {
      towers: [
        { x: 200, type: 'support', lane: 'top' },   // 80pts
        { x: 280, type: 'burst', lane: 'bottom' },  // 150pts
        { x: 500, type: 'chain', lane: 'top' },     // 125pts
        { x: 700, type: 'slow', lane: 'bottom' }    // 100pts
      ],
      powerUps: [
        { type: 'damageBoost', wave: 4 }
      ]
    }
    // Total: 455 + 30 = 485pts
  }
};

// Parse arguments
const args = process.argv.slice(2);
const options = {
  agent: null,
  server: 'http://localhost:3000',
  quiet: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--agent':
    case '-a':
      options.agent = args[++i];
      break;
    case '--server':
      options.server = args[++i];
      break;
    case '--quiet':
    case '-q':
      options.quiet = true;
      break;
    case '--list':
    case '-l':
      console.log('\nAvailable agents:');
      console.log('-----------------');
      for (const [name, config] of Object.entries(AGENTS)) {
        console.log(`  ${name.padEnd(12)} [${config.side}] - ${config.description}`);
      }
      console.log('\nUsage: node named-agents.js --agent <name>');
      process.exit(0);
    case '--help':
    case '-h':
      console.log(`
Moltdefense Named Agents

Usage: node named-agents.js --agent <name>

Options:
  --agent, -a <name>   Agent to run (required)
  --server <url>       Server URL (default: http://localhost:3000)
  --quiet, -q          Minimal output
  --list, -l           List available agents
  --help, -h           Show this help

Attackers: BlitzRunner, IronWall, Spectre
Defenders: Sentinel, Fortress, Striker, Guardian
      `);
      process.exit(0);
  }
}

function log(...args) {
  if (!options.quiet) console.log(...args);
}

async function main() {
  if (!options.agent) {
    console.error('Error: --agent is required. Use --list to see available agents.');
    process.exit(1);
  }

  const config = AGENTS[options.agent];
  if (!config) {
    console.error(`Error: Unknown agent "${options.agent}". Use --list to see available agents.`);
    process.exit(1);
  }

  log(`\n=== ${options.agent.toUpperCase()} ===`);
  log(`Side: ${config.side.toUpperCase()}`);
  log(`Strategy: ${config.description}`);
  log('');

  // Submit build
  try {
    const response = await fetch(`${options.server}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: options.agent,  // Use agent name as ID for persistent ELO
        side: config.side === 'attack' ? 'attack' : 'defend',
        build: config.build
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
      // Wait for match to start and complete
      await waitForMatchAndResults();
      return;
    }

    if (data.status === 'matched') {
      log(`Matched! Match ID: ${data.match_id}`);
      log(`Opponent: ${data.opponent}`);
      await pollForResults(data.match_id);
    }
  } catch (error) {
    console.error('Failed to connect:', error.message);
    process.exit(1);
  }
}

async function waitForMatchAndResults() {
  // Poll status until we get a match, then poll results
  const timeout = 180000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      // Check if we're still queued or got matched
      const statusRes = await fetch(`${options.server}/status`);
      const status = await statusRes.json();

      // Check history for our agent
      const historyRes = await fetch(`${options.server}/history?limit=5`);
      const history = await historyRes.json();

      // Look for a match with our agent
      const ourMatch = history.matches?.find(m =>
        m.attacker?.agentId === options.agent || m.defender?.agentId === options.agent
      );

      if (ourMatch) {
        const config = AGENTS[options.agent];
        const won = (config.side === 'attack' && ourMatch.winner === 'attacker') ||
                    (config.side === 'defend' && ourMatch.winner === 'defender');

        log('');
        log(`Result: ${ourMatch.winner?.toUpperCase()} WINS`);
        log(`Duration: ${ourMatch.duration}s`);

        if (won) {
          log(`*** ${options.agent} WINS! ***`);
        } else {
          log(`${options.agent} lost this round.`);
        }

        console.log(JSON.stringify({
          status: 'complete',
          agent: options.agent,
          won,
          winner: ourMatch.winner
        }));
        return;
      }

      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('Timeout waiting for match');
  process.exit(1);
}

async function pollForResults(matchId) {
  log('Waiting for match...');
  const timeout = 180000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${options.server}/results/${matchId}`);
      const data = await res.json();

      if (data.status === 'complete') {
        const config = AGENTS[options.agent];
        const won = (config.side === 'attack' && data.winner === 'attacker') ||
                    (config.side === 'defend' && data.winner === 'defender');

        log('');
        log(`Result: ${data.winner.toUpperCase()} WINS`);
        log(`Duration: ${data.durationSeconds}s`);

        if (won) {
          log(`*** ${options.agent} WINS! ***`);
        } else {
          log(`${options.agent} lost this round.`);
        }

        console.log(JSON.stringify({
          status: 'complete',
          agent: options.agent,
          won,
          winner: data.winner
        }));
        return;
      }

      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('Timeout');
  process.exit(1);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
