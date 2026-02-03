/**
 * Adaptive Learning Simulation Test
 * Runs 100 matches and tracks how agents adapt their strategies
 */

const path = require('path');
const { addToQueue, getActiveMatches } = require('./server/matchmaker');
const { loadMatchHistory } = require('./server/persistence');
const { generateAdaptiveBuild } = require('./agents/learning/adaptive-agent');
const { getMetaAnalysis } = require('./agents/learning/effectiveness-tracker');

// Named agents
const ATTACKERS = ['BlitzRunner', 'IronWall', 'Spectre'];
const DEFENDERS = ['Sentinel', 'Fortress', 'Striker', 'Guardian'];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Track build composition changes
function getBuildSignature(build, side) {
  if (side === 'attack') {
    const types = {};
    (build.waves || []).forEach(wave => {
      Object.keys(wave).forEach(type => {
        types[type] = (types[type] || 0) + 1;
      });
    });
    return Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 3)
      .join('+');
  } else {
    const towers = build.towers || [];
    const towerList = Array.isArray(towers) ? towers : Object.values(towers);
    const types = {};
    towerList.forEach(t => {
      const type = typeof t === 'string' ? t : t.type;
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 3)
      .join('+');
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForMatchToComplete(matchId, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const history = loadMatchHistory();
    const match = history.find(m => m.matchId === matchId);
    if (match) {
      return match;
    }
    await sleep(100);
  }
  return null;
}

async function runSimulation() {
  console.log('='.repeat(70));
  console.log('ADAPTIVE LEARNING SIMULATION - 100 MATCHES');
  console.log('='.repeat(70));

  // Get initial state
  const initialHistory = loadMatchHistory();
  const initialMeta = getMetaAnalysis(initialHistory);

  console.log('\n--- INITIAL STATE ---');
  console.log(`Total matches in history: ${initialHistory.length}`);
  console.log(`Attacker win rate: ${initialMeta.attackerWinRate}%`);
  console.log(`Best enemy types: ${(initialMeta.bestEnemyTypes || []).map(t => t.type).join(', ')}`);
  console.log(`Best tower types: ${(initialMeta.bestTowerTypes || []).map(t => t.type).join(', ')}`);

  // Track statistics during simulation
  const buildHistory = {
    attack: [],
    defend: []
  };

  let attackerWins = 0;
  let defenderWins = 0;

  console.log('\n--- RUNNING SIMULATION ---');
  console.log('Running 100 adaptive matches...\n');

  const TOTAL_MATCHES = 100;
  const BATCH_SIZE = 10;

  for (let batch = 0; batch < TOTAL_MATCHES / BATCH_SIZE; batch++) {
    const batchStart = batch * BATCH_SIZE + 1;
    const batchEnd = Math.min((batch + 1) * BATCH_SIZE, TOTAL_MATCHES);

    console.log(`Batch ${batch + 1}: Matches ${batchStart}-${batchEnd}`);

    // Run batch of matches
    const matchPromises = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const attackerName = pickRandom(ATTACKERS);
      const defenderName = pickRandom(DEFENDERS);

      // Generate adaptive builds
      const attackBuild = generateAdaptiveBuild(attackerName, 'attack', defenderName);
      const defendBuild = generateAdaptiveBuild(defenderName, 'defend', attackerName);

      // Track build signatures
      buildHistory.attack.push({
        match: batchStart + i,
        agent: attackerName,
        signature: getBuildSignature(attackBuild, 'attack')
      });
      buildHistory.defend.push({
        match: batchStart + i,
        agent: defenderName,
        signature: getBuildSignature(defendBuild, 'defend')
      });

      // Create agents
      const attackerAgent = {
        agentId: attackerName,
        side: 'attack',
        build: attackBuild,
        submittedAt: Date.now() + i
      };

      const defenderAgent = {
        agentId: defenderName,
        side: 'defend',
        build: defendBuild,
        submittedAt: Date.now() + i
      };

      // Queue the match
      addToQueue(attackerAgent);
      const result = addToQueue(defenderAgent);

      if (result.matched) {
        matchPromises.push(waitForMatchToComplete(result.matchId));
      }
    }

    // Wait for batch to complete
    const results = await Promise.all(matchPromises);

    results.forEach(match => {
      if (match) {
        if (match.winner === 'attacker') attackerWins++;
        else defenderWins++;
      }
    });

    // Show batch summary
    const batchAttackerWins = results.filter(m => m?.winner === 'attacker').length;
    console.log(`  Results: Attackers ${batchAttackerWins}/${BATCH_SIZE}, Running total: A:${attackerWins} D:${defenderWins}`);

    // Show current meta every 20 matches
    if ((batch + 1) % 2 === 0) {
      const currentHistory = loadMatchHistory();
      const currentMeta = getMetaAnalysis(currentHistory);
      console.log(`  Meta update - Best enemies: ${(currentMeta.bestEnemyTypes || []).slice(0,2).map(t => `${t.type}(${t.winRate}%)`).join(', ')}`);
    }
  }

  // Final analysis
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(70));

  const finalHistory = loadMatchHistory();
  const finalMeta = getMetaAnalysis(finalHistory);

  console.log('\n--- FINAL STATE ---');
  console.log(`Total matches in history: ${finalHistory.length}`);
  console.log(`New matches added: ${finalHistory.length - initialHistory.length}`);
  console.log(`\nSimulation Results:`);
  console.log(`  Attacker wins: ${attackerWins} (${Math.round(attackerWins / TOTAL_MATCHES * 100)}%)`);
  console.log(`  Defender wins: ${defenderWins} (${Math.round(defenderWins / TOTAL_MATCHES * 100)}%)`);

  console.log('\n--- META COMPARISON ---');
  console.log('Before simulation:');
  console.log(`  Attacker win rate: ${initialMeta.attackerWinRate}%`);
  console.log(`  Best enemies: ${(initialMeta.bestEnemyTypes || []).map(t => `${t.type}(${t.winRate}%)`).join(', ')}`);
  console.log(`  Best towers: ${(initialMeta.bestTowerTypes || []).map(t => `${t.type}(${t.winRate}%)`).join(', ')}`);

  console.log('\nAfter simulation:');
  console.log(`  Attacker win rate: ${finalMeta.attackerWinRate}%`);
  console.log(`  Best enemies: ${(finalMeta.bestEnemyTypes || []).map(t => `${t.type}(${t.winRate}%)`).join(', ')}`);
  console.log(`  Best towers: ${(finalMeta.bestTowerTypes || []).map(t => `${t.type}(${t.winRate}%)`).join(', ')}`);

  // Analyze build evolution
  console.log('\n--- BUILD EVOLUTION ---');

  // Group attack builds by phase
  const phases = [
    { name: 'Early (1-25)', start: 1, end: 25 },
    { name: 'Mid (26-50)', start: 26, end: 50 },
    { name: 'Late (51-75)', start: 51, end: 75 },
    { name: 'Final (76-100)', start: 76, end: 100 }
  ];

  console.log('\nAttack build signatures by phase:');
  phases.forEach(phase => {
    const phaseBuilds = buildHistory.attack.filter(b => b.match >= phase.start && b.match <= phase.end);
    const signatureCounts = {};
    phaseBuilds.forEach(b => {
      signatureCounts[b.signature] = (signatureCounts[b.signature] || 0) + 1;
    });
    const topSignatures = Object.entries(signatureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sig, count]) => `${sig}(${count})`)
      .join(', ');
    console.log(`  ${phase.name}: ${topSignatures}`);
  });

  console.log('\nDefense build signatures by phase:');
  phases.forEach(phase => {
    const phaseBuilds = buildHistory.defend.filter(b => b.match >= phase.start && b.match <= phase.end);
    const signatureCounts = {};
    phaseBuilds.forEach(b => {
      signatureCounts[b.signature] = (signatureCounts[b.signature] || 0) + 1;
    });
    const topSignatures = Object.entries(signatureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sig, count]) => `${sig}(${count})`)
      .join(', ');
    console.log(`  ${phase.name}: ${topSignatures}`);
  });

  // Show top compositions
  console.log('\n--- TOP COMPOSITIONS (After Simulation) ---');
  console.log('Attack:');
  (finalMeta.attackCompositions || []).slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.composition} - ${c.winRate}% (${c.wins}/${c.total})`);
  });
  console.log('\nDefense:');
  (finalMeta.defenseCompositions || []).slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.composition} - ${c.winRate}% (${c.wins}/${c.total})`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('Simulation complete!');
  console.log('='.repeat(70));
}

// Run the simulation
runSimulation().catch(console.error);
