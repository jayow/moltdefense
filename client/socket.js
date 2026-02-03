// WebSocket Client for Moltdefense

let ws = null;
let currentMatchId = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Track processed events to prevent duplicates
let lastProcessedTick = -1;

// Connect to WebSocket server
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to Moltdefense server');
    reconnectAttempts = 0;

    // Resubscribe if we had a match
    if (currentMatchId) {
      subscribeToMatch(currentMatchId);
    }
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleMessage(message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  };

  ws.onclose = () => {
    console.log('Disconnected from server');

    // Attempt to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(connect, 2000 * reconnectAttempts);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Handle incoming messages
function handleMessage(message) {
  switch (message.type) {
    case 'welcome':
      console.log('Server:', message.message);
      break;

    case 'subscribed':
      console.log('Subscribed to match:', message.matchId);
      break;

    case 'state':
      // Update the game display
      window.renderer.render(message);
      window.renderer.updateUI(message);

      // Process new events (filter out already-processed events)
      if (message.events) {
        for (const event of message.events) {
          // Skip events we've already processed (deduplication)
          if (event.tick !== undefined && event.tick <= lastProcessedTick) {
            continue;
          }

          window.renderer.addEvent(event);

          // Update last processed tick
          if (event.tick !== undefined && event.tick > lastProcessedTick) {
            lastProcessedTick = event.tick;
          }

          // Play sounds for live match events
          if (window.gameAudio) {
            if (event.type === 'damage') {
              window.gameAudio.playSound('shoot');
              // Create projectile for live match
              if (window.renderer.createProjectile && message.towers && message.enemies) {
                const tower = findTowerForProjectile(event.tower, message.towers);
                const enemy = message.enemies.find(e => e.id === event.enemy);
                if (tower && enemy) {
                  // Lead the target slightly to account for enemy movement during projectile flight
                  const leadOffset = 8; // pixels ahead
                  window.renderer.createProjectile(
                    tower.x, tower.y,
                    window.renderer.gameToCanvasX(enemy.position) + leadOffset,
                    100, // PATH_Y
                    tower.type
                  );
                }
              }
            } else if (event.type === 'kill') {
              window.gameAudio.playSound('kill');
            } else if (event.type === 'leak') {
              window.gameAudio.playSound('leak');
            } else if (event.type === 'wave') {
              window.gameAudio.playSound('wave');
            }
          }
        }
      }
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

// Subscribe to a match
function subscribeToMatch(matchId) {
  currentMatchId = matchId;
  lastProcessedTick = -1; // Reset event tracking for new match

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      matchId: matchId
    }));
    window.renderer.clearEvents();
  }
}

// Fetch and render dashboard data
async function fetchDashboard() {
  try {
    const response = await fetch('/dashboard');
    const data = await response.json();

    renderLeaderboard(data.leaderboard, data.totalAgents);
    renderStats(data.stats);
    renderRecentBattles(data.recentMatches);
    renderQueueStatus(data.queue);
    renderLiveMatches(data.liveMatches);

  } catch (error) {
    console.error('Failed to fetch dashboard:', error);
  }
}

// Render leaderboard panel
function renderLeaderboard(leaderboard, totalAgents = 0) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  if (!leaderboard || leaderboard.length === 0) {
    container.innerHTML = '<div class="loading">No rankings yet</div>';
    return;
  }

  const entries = leaderboard.map(entry => {
    const rankClass = entry.rank === 1 ? 'gold' :
                      entry.rank === 2 ? 'silver' :
                      entry.rank === 3 ? 'bronze' : 'normal';

    // Role icon: sword for attacker, shield for defender, robot for external
    let roleIcon, roleClass;
    if (entry.role === 'attacker') {
      roleIcon = '&#9876;'; // ⚔
      roleClass = 'role-attacker';
    } else if (entry.role === 'defender') {
      roleIcon = '&#128737;'; // 🛡
      roleClass = 'role-defender';
    } else {
      roleIcon = '&#129302;'; // 🤖
      roleClass = 'role-external';
    }

    return `
      <div class="leaderboard-entry">
        <div class="leaderboard-rank ${rankClass}">${entry.rank}</div>
        <span class="leaderboard-role ${roleClass}" title="${entry.role || 'external'}">${roleIcon}</span>
        <div class="leaderboard-name">${entry.agentId}</div>
        <div class="leaderboard-elo">${entry.elo}</div>
        <div class="leaderboard-record">${entry.wins}W-${entry.losses}L</div>
      </div>
    `;
  }).join('');

  // Add "View all" link if there are more agents than shown
  const viewAllLink = totalAgents > 10
    ? `<a href="/leaderboard" target="_blank" class="view-all-link">View all ${totalAgents} agents →</a>`
    : '';

  container.innerHTML = entries + viewAllLink;
}

// Render stats panel
function renderStats(stats) {
  if (!stats) return;

  const totalEl = document.getElementById('stat-total');
  const attackRateEl = document.getElementById('stat-attack-rate');
  const defendRateEl = document.getElementById('stat-defend-rate');
  const durationEl = document.getElementById('stat-duration');
  const agentsEl = document.getElementById('stat-agents');

  if (totalEl) totalEl.textContent = stats.totalMatches || 0;
  if (attackRateEl) attackRateEl.textContent = `${stats.attackerWinRate || 50}%`;
  if (defendRateEl) defendRateEl.textContent = `${stats.defenderWinRate || 50}%`;
  if (durationEl) durationEl.textContent = `${stats.avgDuration || 0}s`;
  if (agentsEl) agentsEl.textContent = stats.activeAgents || 0;
}

// Format timestamp to local time
function formatLocalTime(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Format ELO change with color
function formatEloChange(change) {
  if (change === null || change === undefined) return '';
  const sign = change > 0 ? '+' : '';
  const colorClass = change > 0 ? 'elo-gain' : 'elo-loss';
  return `<span class="elo-change ${colorClass}">${sign}${change}</span>`;
}

// Render recent battles panel (now Match Logs)
function renderRecentBattles(matches) {
  const container = document.getElementById('battles-list');
  if (!container) return;

  if (!matches || matches.length === 0) {
    container.innerHTML = '<div class="loading">No recent matches</div>';
    return;
  }

  container.innerHTML = matches.map(match => {
    const winnerClass = match.winner === 'attacker' ? 'attacker' : 'defender';
    const winnerText = match.winner === 'attacker' ? 'ATK Wins' : 'DEF Wins';
    const kills = match.defender?.kills || 0;
    const leaked = match.attacker?.leaked || 0;
    const waves = match.wavesCompleted || 5;
    const localTime = formatLocalTime(match.timestamp);
    const shortMatchId = match.matchId ? match.matchId.slice(0, 10) : '---';

    // ELO info
    const attackerElo = match.attacker?.elo ? `(${match.attacker.elo})` : '';
    const defenderElo = match.defender?.elo ? `(${match.defender.elo})` : '';
    const attackerEloChange = formatEloChange(match.attacker?.eloChange);
    const defenderEloChange = formatEloChange(match.defender?.eloChange);

    return `
      <div class="battle-entry" data-match-id="${match.matchId}" onclick="watchBattle('${match.matchId}')">
        <div class="battle-header">
          <span class="battle-time">${localTime}</span>
          <span class="battle-match-id">${shortMatchId}</span>
        </div>
        <div class="battle-matchup">
          <div class="battle-player attacker-side">
            <span class="battle-attacker">${match.attacker?.agentId || 'Unknown'}</span>
            <span class="battle-elo">${attackerElo}</span>
            ${attackerEloChange}
          </div>
          <span class="battle-vs">vs</span>
          <div class="battle-player defender-side">
            <span class="battle-defender">${match.defender?.agentId || 'Unknown'}</span>
            <span class="battle-elo">${defenderElo}</span>
            ${defenderEloChange}
          </div>
        </div>
        <div class="battle-stats">
          <span class="battle-stat kills" title="Kills">K:${kills}</span>
          <span class="battle-stat leaked" title="Leaked">L:${leaked}</span>
          <span class="battle-stat waves" title="Waves">W:${waves}/5</span>
        </div>
        <div class="battle-result">
          <span class="battle-winner ${winnerClass}">${winnerText}</span>
          <span class="battle-play-icon">▶</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render queue status panel with agent names
function renderQueueStatus(queue) {
  if (!queue) return;

  // Update live matches count
  const activeEl = document.getElementById('queue-active');
  if (activeEl) activeEl.textContent = queue.activeMatches || 0;

  // Update attacker count
  const attackersCountEl = document.getElementById('queue-attackers-count');
  if (attackersCountEl) attackersCountEl.textContent = queue.attackers || 0;

  // Update defender count
  const defendersCountEl = document.getElementById('queue-defenders-count');
  if (defendersCountEl) defendersCountEl.textContent = queue.defenders || 0;

  // Render attackers waiting list
  const attackersListEl = document.getElementById('queue-attackers-list');
  if (attackersListEl) {
    if (queue.attackQueue && queue.attackQueue.length > 0) {
      attackersListEl.innerHTML = queue.attackQueue.map(agent => `
        <div class="queue-entry">
          <span class="queue-agent-name">${agent.agentId}</span>
          <span class="queue-wait-time">${agent.waitingSeconds}s</span>
        </div>
      `).join('');
    } else {
      attackersListEl.innerHTML = '<div class="queue-empty">No attackers waiting</div>';
    }
  }

  // Render defenders waiting list
  const defendersListEl = document.getElementById('queue-defenders-list');
  if (defendersListEl) {
    if (queue.defenseQueue && queue.defenseQueue.length > 0) {
      defendersListEl.innerHTML = queue.defenseQueue.map(agent => `
        <div class="queue-entry">
          <span class="queue-agent-name">${agent.agentId}</span>
          <span class="queue-wait-time">${agent.waitingSeconds}s</span>
        </div>
      `).join('');
    } else {
      defendersListEl.innerHTML = '<div class="queue-empty">No defenders waiting</div>';
    }
  }
}

// Render live matches with spectate option
function renderLiveMatches(liveMatches) {
  const container = document.getElementById('live-matches-list');
  const countEl = document.getElementById('queue-active');

  if (countEl) countEl.textContent = liveMatches?.length || 0;
  if (!container) return;

  if (!liveMatches || liveMatches.length === 0) {
    container.innerHTML = '<div class="queue-empty">No live matches</div>';
    return;
  }

  container.innerHTML = liveMatches.map(match => `
    <div class="live-match-entry" onclick="spectateLive('${match.matchId}')" title="Click to spectate">
      <div class="live-match-players">
        <span class="live-attacker">${match.attacker}</span>
        <span class="live-vs">vs</span>
        <span class="live-defender">${match.defender}</span>
      </div>
      <div class="live-match-info">
        <span class="live-wave">Wave ${match.currentWave || 1}/5</span>
        <span class="live-spectate-icon">👁</span>
      </div>
    </div>
  `).join('');
}

// Spectate a live match
function spectateLive(matchId) {
  console.log('Spectating live match:', matchId);

  // Stop any ongoing replay
  if (typeof stopReplay === 'function') {
    stopReplay();
  }

  // Subscribe to the live match via WebSocket
  subscribeToMatch(matchId);

  // Update UI to show we're watching live
  const matchIdEl = document.getElementById('match-id');
  const matchStatusEl = document.getElementById('match-status');
  if (matchIdEl) matchIdEl.textContent = matchId;
  if (matchStatusEl) {
    matchStatusEl.textContent = 'LIVE';
    matchStatusEl.className = 'match-status active';
  }
}

// Replay state
let replayData = null;
let replayInterval = null;
let replayIndex = 0;
let replaySpeed = 1;
let replayEnemies = {}; // Track active enemies during replay
let replayAnimationFrame = null;

// Watch a battle from history (click-to-watch)
async function watchBattle(matchId) {
  console.log('Watching battle:', matchId);

  // Stop any existing replay
  stopReplay();

  // First check if match is still running
  try {
    const response = await fetch(`/match/${matchId}`);
    const data = await response.json();

    // Only subscribe to live updates if match is actually in progress
    if (data.status === 'in_progress') {
      subscribeToMatch(matchId);
      window.renderer.render(data);
      window.renderer.updateUI(data);
      return;
    }
    // If complete or error, fall through to replay
  } catch (error) {
    // Match not running, try replay
  }

  // Match is complete - try to fetch replay data
  try {
    const replayResponse = await fetch(`/replay/${matchId}`);
    const replay = await replayResponse.json();

    if (replay.error) {
      // No replay data, show final results
      showMatchResults(matchId);
      return;
    }

    // Start replay if we have events
    if (replay.events && replay.events.length > 0) {
      startReplay(replay);
    } else {
      showMatchResults(matchId);
    }
  } catch (error) {
    console.error('Failed to fetch replay:', error);
    showMatchResults(matchId);
  }
}

// Start replaying a match
function startReplay(replay) {
  replayData = replay;
  replayIndex = 0;
  replayEnemies = {};

  // Clear previous state
  window.renderer.clearEvents();

  // Update UI with match info
  document.getElementById('match-status').textContent = `Replaying at ${replaySpeed}x...`;
  document.getElementById('match-status').className = 'match-status active';

  window.renderer.updateUI({
    matchId: replay.matchId,
    status: 'replay',
    currentWave: 0,
    totalWaves: 5,
    attacker: replay.attacker,
    defender: replay.defender
  });

  // Reset wave display to start
  document.getElementById('wave-info').textContent = 'Wave 0/5';
  document.getElementById('attacker-leaked').textContent = 'Leaked: 0';
  document.getElementById('defender-kills').textContent = 'Kills: 0';

  // Convert towers to renderer format
  const towers = convertTowersForRenderer(replay.defender?.build?.towers || []);

  // Group events by tick for proper sequencing
  const eventsByTick = {};
  let maxTick = 0;
  replay.events.forEach(event => {
    const tick = event.tick || 0;
    if (!eventsByTick[tick]) eventsByTick[tick] = [];
    eventsByTick[tick].push(event);
    maxTick = Math.max(maxTick, tick);
  });

  // Real-time replay state
  let currentTick = 0;
  let kills = 0;
  let leaked = 0;
  let lastFrameTime = performance.now();
  const TICKS_PER_SECOND = 60; // Match server tick rate

  // Animation loop for smooth enemy movement AND event processing
  function animateReplay(now) {
    // Calculate elapsed time and ticks to advance
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;

    // Advance simulation ticks based on real time and speed
    const ticksToAdvance = (deltaTime / 1000) * TICKS_PER_SECOND * replaySpeed;
    const previousTick = Math.floor(currentTick);
    currentTick += ticksToAdvance;
    const newTick = Math.floor(currentTick);

    // Process any events that occurred in the ticks we just passed
    for (let tick = previousTick; tick <= newTick; tick++) {
      if (eventsByTick[tick]) {
        eventsByTick[tick].forEach(event => {
          window.renderer.addEvent(event);

          // Handle spawn events - create new enemy
          if (event.type === 'spawn') {
            replayEnemies[event.enemy] = {
              id: event.enemy,
              type: event.enemyType,
              position: 0,
              hp: event.health,
              maxHp: event.health,
              speed: event.speed,
              active: true,
              spawnTick: tick
            };
          }

          // Handle kill events - remove enemy
          if (event.type === 'kill') {
            if (replayEnemies[event.enemy]) {
              replayEnemies[event.enemy].active = false;
            }
            kills++;
            document.getElementById('defender-kills').textContent = `Kills: ${kills}`;
            // Play kill sound
            if (window.gameAudio) window.gameAudio.playSound('kill');
          }

          // Handle leak events - remove enemy
          if (event.type === 'leak') {
            if (replayEnemies[event.enemy]) {
              replayEnemies[event.enemy].active = false;
            }
            leaked++;
            document.getElementById('attacker-leaked').textContent = `Leaked: ${leaked}`;
            // Play leak sound
            if (window.gameAudio) window.gameAudio.playSound('leak');
          }

          // Update wave info on wave events
          if (event.type === 'wave') {
            document.getElementById('wave-info').textContent = `Wave ${event.wave}/5`;
            // Play wave start sound
            if (window.gameAudio) window.gameAudio.playSound('wave');
          }

          // Handle damage events - decrement enemy HP for accurate health bars
          if (event.type === 'damage') {
            if (replayEnemies[event.enemy]) {
              replayEnemies[event.enemy].hp -= event.amount;
              replayEnemies[event.enemy].hp = Math.max(0, replayEnemies[event.enemy].hp);
            }
            // Create projectile animation if renderer supports it
            if (window.renderer.createProjectile) {
              const tower = findTowerForProjectile(event.tower, towers);
              const enemy = replayEnemies[event.enemy];
              if (tower && enemy) {
                // Lead the target slightly to account for enemy movement during projectile flight
                const leadOffset = 8; // pixels ahead
                window.renderer.createProjectile(
                  tower.x, tower.y,
                  window.renderer.gameToCanvasX(enemy.position) + leadOffset,
                  100, // PATH_Y
                  tower.type
                );
              }
            }
            // Play shoot sound
            if (window.gameAudio) window.gameAudio.playSound('shoot');
          }
        });
      }
    }

    // Move all active enemies based on elapsed ticks since spawn
    for (const enemyId in replayEnemies) {
      const enemy = replayEnemies[enemyId];
      if (enemy.active) {
        // Position = speed * (ticks since spawn) / ticks per second
        const ticksSinceSpawn = currentTick - enemy.spawnTick;
        enemy.position = enemy.speed * (ticksSinceSpawn / TICKS_PER_SECOND);
      }
    }

    // Render current state
    const activeEnemies = Object.values(replayEnemies).filter(e => e.active).map(e => ({
      id: e.id,
      type: e.type,
      position: e.position,
      hp: e.hp,
      maxHp: e.maxHp,
      speedMultiplier: 1
    }));

    window.renderer.render({
      towers: towers,
      enemies: activeEnemies,
      events: []
    });

    // Check if replay is complete
    if (currentTick > maxTick + 60) { // Add 1 second buffer after last event
      finishReplay();
      return;
    }

    replayAnimationFrame = requestAnimationFrame(animateReplay);
  }

  // Start animation
  replayAnimationFrame = requestAnimationFrame(animateReplay);
}

// Convert tower build to renderer format
// Note: TOWER_POSITIONS is defined in renderer.js (shared global scope)
function convertTowersForRenderer(towers) {
  if (!towers) return [];

  // Handle array format (new free-flow)
  if (Array.isArray(towers)) {
    return towers.map((t, i) => ({
      slot: `T${i}`,
      type: t.type,
      x: t.x,
      lane: t.lane || 'top'
    }));
  }

  // Handle object format (legacy slot-based)
  return Object.entries(towers).map(([slot, type]) => ({
    slot: slot,
    type: type
  }));
}

// Find tower position for projectile animation
function findTowerForProjectile(towerId, towers) {
  if (!towers || !towerId) return null;

  for (const tower of towers) {
    if (tower.slot === towerId || tower.id === towerId) {
      let canvasX, canvasY;

      // Check for position (from live match state) or x (from converted build)
      if (tower.position !== undefined) {
        // Live match format - uses 'position' field
        canvasX = (tower.position / 1000) * 800;
        canvasY = tower.lane === 'bottom' ? 150 : 50;
      } else if (tower.x !== undefined) {
        // Converted build format - uses 'x' field
        canvasX = (tower.x / 1000) * 800;
        canvasY = tower.lane === 'bottom' ? 150 : 50;
      } else if (tower.slot && TOWER_POSITIONS[tower.slot]) {
        // Slot-based format - lookup position from slot name
        canvasX = (TOWER_POSITIONS[tower.slot] / 1000) * 800;
        canvasY = tower.slot.charCodeAt(0) % 2 === 0 ? 50 : 150;
      } else {
        continue;
      }

      return { x: canvasX, y: canvasY, type: tower.type };
    }
  }
  return null;
}

// Finish replay and show final results
function finishReplay() {
  // Save data before stopping (stopReplay clears replayData)
  const data = replayData;

  stopReplay();

  if (data) {
    document.getElementById('match-status').textContent =
      `Replay Complete - ${data.winner} wins!`;
    document.getElementById('match-status').className = 'match-status complete';

    window.renderer.updateUI({
      matchId: data.matchId,
      status: 'complete',
      winner: data.winner,
      currentWave: data.wavesCompleted,
      totalWaves: 5,
      attacker: data.attacker,
      defender: data.defender
    });
  }
}

// Stop replay playback
function stopReplay() {
  if (replayInterval) {
    clearInterval(replayInterval);
    replayInterval = null;
  }
  if (replayAnimationFrame) {
    cancelAnimationFrame(replayAnimationFrame);
    replayAnimationFrame = null;
  }
  replayData = null;
  replayIndex = 0;
  replayEnemies = {};
}

// Set replay speed (called by speed buttons)
function setReplaySpeed(speed) {
  replaySpeed = speed;
  // Update button states
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
  });
  // Update status if replaying
  if (replayData) {
    document.getElementById('match-status').textContent = `Replaying at ${speed}x...`;
  }
}

// Show match results without replay
async function showMatchResults(matchId) {
  try {
    const resultsResponse = await fetch(`/results/${matchId}`);
    const results = await resultsResponse.json();

    if (results.status === 'complete') {
      window.renderer.updateUI({
        matchId: matchId,
        status: 'complete',
        winner: results.winner,
        currentWave: results.wavesCompleted,
        totalWaves: 5,
        attacker: results.attacker,
        defender: results.defender
      });

      document.getElementById('match-status').textContent =
        `Complete - ${results.winner} wins!`;
      document.getElementById('match-status').className = 'match-status complete';
    }
  } catch (error) {
    console.error('Failed to fetch results:', error);
  }
}

// Run a demo match using the /demo endpoint
async function runDemoMatch(adaptive = false) {
  const statusEl = document.getElementById('match-status');
  if (statusEl) {
    statusEl.textContent = adaptive ? 'Starting adaptive match...' : 'Starting demo match...';
    statusEl.className = 'match-status';
  }

  try {
    const response = await fetch('/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adaptive })
    });

    const data = await response.json();
    console.log('Demo match response:', data);

    if (data.status === 'error') {
      console.error('Demo match error:', data.error);
      if (statusEl) {
        statusEl.textContent = 'Error: ' + data.error;
      }
      return;
    }

    if (data.status === 'matched' && data.match_id) {
      console.log('Demo match started:', data.match_id);

      if (statusEl) {
        const modeLabel = adaptive ? '[ADAPTIVE] ' : '';
        statusEl.textContent = `${modeLabel}${data.attacker.name} vs ${data.defender.name}`;
        statusEl.className = 'match-status active';
      }

      // Subscribe to watch the match
      subscribeToMatch(data.match_id);

      // Refresh dashboard
      setTimeout(fetchDashboard, 1000);
    }
  } catch (error) {
    console.error('Failed to run demo match:', error);
    if (statusEl) {
      statusEl.textContent = 'Connection error';
    }
  }
}

// Set match playback speed
async function setMatchSpeed(speed) {
  if (!currentMatchId) {
    console.warn('No match to set speed for');
    return;
  }

  try {
    const response = await fetch(`/match/${currentMatchId}/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    });

    const data = await response.json();
    if (data.status === 'ok') {
      console.log(`Speed set to ${speed}x`);
      // Update button states
      document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
      });
    }
  } catch (error) {
    console.error('Failed to set match speed:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Connect WebSocket
  connect();

  // Fetch initial dashboard data
  fetchDashboard();

  // Poll dashboard every 5 seconds
  setInterval(fetchDashboard, 5000);

  // Set up button handlers
  document.getElementById('demo-btn').addEventListener('click', () => {
    runDemoMatch(false);
  });

  document.getElementById('adaptive-demo-btn').addEventListener('click', () => {
    runDemoMatch(true);
  });

  // Sound toggle button
  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      if (window.gameAudio) {
        const isEnabled = window.gameAudio.toggle();
        soundBtn.textContent = isEnabled ? 'Sound: ON' : 'Sound: OFF';
        soundBtn.classList.toggle('active', isEnabled);
        // Save preference
        localStorage.setItem('moltdefense-sound', isEnabled ? 'on' : 'off');
      }
    });

    // Restore sound preference
    const savedPref = localStorage.getItem('moltdefense-sound');
    if (savedPref === 'on' && window.gameAudio) {
      window.gameAudio.initAudio();
      soundBtn.textContent = 'Sound: ON';
      soundBtn.classList.add('active');
    }
  }

  // Speed control buttons - work for both live matches and replays
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseInt(btn.dataset.speed);
      // If replaying, use replay speed
      if (replayData || replayAnimationFrame) {
        setReplaySpeed(speed);
      } else if (currentMatchId) {
        // If watching live match, set server speed
        setMatchSpeed(speed);
      } else {
        // Just update UI for next replay
        setReplaySpeed(speed);
      }
    });
  });
});

// Global function for onclick handlers
window.watchBattle = watchBattle;
window.spectateLive = spectateLive;

// Export for debugging
window.moltdefense = {
  connect,
  subscribeToMatch,
  watchBattle,
  spectateLive,
  runDemoMatch,
  fetchDashboard,
  setMatchSpeed,
  setReplaySpeed,
  stopReplay
};
