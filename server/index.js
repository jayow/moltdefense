const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const submitRouter = require('./api/submit');
const matchRouter = require('./api/match');
const resultsRouter = require('./api/results');
const demoRouter = require('./api/demo');
const { setMatchUpdateCallback, getQueueStats, setMatchSpeed } = require('./matchmaker');

// Create Express app
const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Match subscribers: Map<matchId, Set<WebSocket>>
const matchSubscribers = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/submit', submitRouter);
app.use('/match', matchRouter);
app.use('/results', resultsRouter);
app.use('/demo', demoRouter);

// Queue status endpoint
app.get('/status', (req, res) => {
  res.json(getQueueStats());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Set match playback speed
app.post('/match/:id/speed', (req, res) => {
  const matchId = req.params.id;
  const speed = parseInt(req.body.speed) || 1;

  const result = setMatchSpeed(matchId, speed);
  if (result.success) {
    res.json({ status: 'ok', speed: result.speed });
  } else {
    res.status(400).json({ status: 'error', error: result.error });
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  let subscribedMatch = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'subscribe' && message.matchId) {
        // Unsubscribe from previous match
        if (subscribedMatch) {
          const subscribers = matchSubscribers.get(subscribedMatch);
          if (subscribers) {
            subscribers.delete(ws);
          }
        }

        // Subscribe to new match
        subscribedMatch = message.matchId;
        if (!matchSubscribers.has(subscribedMatch)) {
          matchSubscribers.set(subscribedMatch, new Set());
        }
        matchSubscribers.get(subscribedMatch).add(ws);

        ws.send(JSON.stringify({
          type: 'subscribed',
          matchId: subscribedMatch
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    // Clean up subscription
    if (subscribedMatch) {
      const subscribers = matchSubscribers.get(subscribedMatch);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          matchSubscribers.delete(subscribedMatch);
        }
      }
    }
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Moltdefense server'
  }));
});

// Set up match update callback to broadcast to subscribers
setMatchUpdateCallback((matchId, state) => {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify({
    type: 'state',
    ...state
  });

  for (const ws of subscribers) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                      MOLTDEFENSE                          ║
║               Tower Defense for AI Agents                 ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                  ║
║                                                           ║
║  Endpoints:                                               ║
║    POST /submit      - Submit a build                     ║
║    POST /demo        - Start demo match                   ║
║    GET  /match/:id   - Get match state                    ║
║    GET  /results/:id - Get match results                  ║
║    GET  /status      - Queue status                       ║
║                                                           ║
║  WebSocket: ws://localhost:${PORT}                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
