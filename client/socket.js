// WebSocket Client for Moltdefense

let ws = null;
let currentMatchId = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Connect to WebSocket server
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to Moltdefense server');
    reconnectAttempts = 0;
    updateConnectionStatus('Connected');

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
    updateConnectionStatus('Disconnected');

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

      // Process new events
      if (message.events) {
        for (const event of message.events) {
          window.renderer.addEvent(event);
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

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      matchId: matchId
    }));
    window.renderer.clearEvents();
  }
}

// Update connection status in UI
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('queue-status');
  if (statusEl) {
    statusEl.textContent = `Connection: ${status}`;
  }
}

// Fetch queue status
async function fetchQueueStatus() {
  try {
    const response = await fetch('/status');
    const data = await response.json();

    const statusEl = document.getElementById('queue-status');
    if (statusEl) {
      statusEl.innerHTML = `
        Attackers in queue: ${data.attackers}<br>
        Defenders in queue: ${data.defenders}<br>
        Active matches: ${data.activeMatches}<br>
        Completed matches: ${data.completedMatches}
      `;
    }
  } catch (error) {
    console.error('Failed to fetch queue status:', error);
  }
}

// Run a demo match using the /demo endpoint with random strategies
async function runDemoMatch() {
  const statusEl = document.getElementById('match-status');
  if (statusEl) {
    statusEl.textContent = 'Starting demo match...';
    statusEl.className = 'match-status';
  }

  try {
    const response = await fetch('/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})  // Uses random strategies by default
    });

    const data = await response.json();
    console.log('Demo match response:', data);

    if (data.status === 'error') {
      console.error('Demo match error:', data.error);
      alert('Failed to start demo: ' + data.error);
      if (statusEl) {
        statusEl.textContent = 'Error: ' + data.error;
      }
      return;
    }

    if (data.status === 'matched' && data.match_id) {
      console.log('Demo match started:', data.match_id);
      console.log('Attacker strategy:', data.attacker.strategy);
      console.log('Defender strategy:', data.defender.strategy);

      // Update UI with match info
      if (statusEl) {
        statusEl.textContent = `Match started! ${data.attacker.strategy} vs ${data.defender.strategy}`;
        statusEl.className = 'match-status active';
      }

      // Update match ID input so user can see it
      const matchInput = document.getElementById('match-id-input');
      if (matchInput) {
        matchInput.value = data.match_id;
      }

      // Subscribe to watch the match
      subscribeToMatch(data.match_id);
      fetchQueueStatus();
    } else {
      console.warn('Unexpected demo response:', data);
      alert('Unexpected response from demo endpoint');
    }
  } catch (error) {
    console.error('Failed to run demo match:', error);
    alert('Failed to run demo match: ' + error.message);
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
    } else {
      console.error('Failed to set speed:', data.error);
    }
  } catch (error) {
    console.error('Failed to set match speed:', error);
  }
}

// Watch a specific match
async function watchMatch(matchId) {
  if (!matchId) {
    alert('Please enter a match ID');
    return;
  }

  subscribeToMatch(matchId);

  // Also fetch current state via HTTP
  try {
    const response = await fetch(`/match/${matchId}`);
    const data = await response.json();

    if (data.status === 'error') {
      alert(data.error);
      return;
    }

    window.renderer.render(data);
    window.renderer.updateUI(data);
  } catch (error) {
    console.error('Failed to fetch match:', error);
    alert('Failed to fetch match: ' + error.message);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Connect WebSocket
  connect();

  // Fetch initial queue status
  fetchQueueStatus();
  setInterval(fetchQueueStatus, 5000);

  // Set up button handlers
  document.getElementById('watch-btn').addEventListener('click', () => {
    const matchId = document.getElementById('match-id-input').value.trim();
    watchMatch(matchId);
  });

  document.getElementById('demo-btn').addEventListener('click', () => {
    runDemoMatch();
  });

  // Enter key on input
  document.getElementById('match-id-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const matchId = document.getElementById('match-id-input').value.trim();
      watchMatch(matchId);
    }
  });

  // Speed control buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseInt(btn.dataset.speed);
      setMatchSpeed(speed);
    });
  });
});

// Export for debugging
window.moltdefense = {
  connect,
  subscribeToMatch,
  watchMatch,
  runDemoMatch,
  fetchQueueStatus,
  setMatchSpeed
};
