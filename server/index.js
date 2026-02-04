const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

// Security configuration
const SECURITY_CONFIG = {
  // Allowed origins for CORS (add production domains as needed)
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  // Rate limiting (relaxed for development, tighten for production)
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: { error: 'Too many requests, please try again later' }
  },
  // WebSocket message limits
  ws: {
    maxMessageSize: 1024, // 1KB max message size
    validMessageTypes: ['subscribe']
  },
  // Speed control bounds
  speedBounds: { min: 1, max: 10 }
};

const submitRouter = require('./api/submit');
const matchRouter = require('./api/match');
const resultsRouter = require('./api/results');
const demoRouter = require('./api/demo');
const historyRouter = require('./api/history');
const statsRouter = require('./api/stats');
const leaderboardRouter = require('./api/leaderboard');
const dashboardRouter = require('./api/dashboard');
const learningRouter = require('./api/learning');
const replayRouter = require('./api/replay');
const rulesRouter = require('./api/rules');
const { setMatchUpdateCallback, getQueueStats, setMatchSpeed } = require('./matchmaker');

// Create Express app
const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Match subscribers: Map<matchId, Set<WebSocket>>
const matchSubscribers = new Map();

// Middleware - Security hardened
// CORS: Restrict to allowed origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (SECURITY_CONFIG.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// JSON body parser with size limit to prevent DoS
app.use(express.json({ limit: '100kb' }));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: SECURITY_CONFIG.rateLimit.windowMs,
  max: SECURITY_CONFIG.rateLimit.max,
  message: SECURITY_CONFIG.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/submit', submitRouter);
app.use('/match', matchRouter);
app.use('/results', resultsRouter);
app.use('/demo', demoRouter);
app.use('/history', historyRouter);
app.use('/stats', statsRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/dashboard', dashboardRouter);
app.use('/learning', learningRouter);
app.use('/replay', replayRouter);
app.use('/api/rules', rulesRouter);

// Queue status endpoint
app.get('/status', (req, res) => {
  res.json(getQueueStats());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Set match playback speed (with bounds validation)
app.post('/match/:id/speed', (req, res) => {
  const matchId = req.params.id;

  // Validate and bound the speed parameter
  const rawSpeed = parseInt(req.body.speed);
  if (isNaN(rawSpeed)) {
    return res.status(400).json({ status: 'error', error: 'speed must be a number' });
  }
  const speed = Math.min(Math.max(rawSpeed, SECURITY_CONFIG.speedBounds.min), SECURITY_CONFIG.speedBounds.max);

  const result = setMatchSpeed(matchId, speed);
  if (result.success) {
    res.json({ status: 'ok', speed: result.speed });
  } else {
    res.status(400).json({ status: 'error', error: result.error });
  }
});

// WebSocket connection handling (with security validation)
wss.on('connection', (ws) => {
  let subscribedMatch = null;

  ws.on('message', (data) => {
    // Security: Check message size before parsing
    if (data.length > SECURITY_CONFIG.ws.maxMessageSize) {
      ws.close(1009, 'Message too large');
      return;
    }

    try {
      const message = JSON.parse(data);

      // Security: Validate message type is allowed
      if (!SECURITY_CONFIG.ws.validMessageTypes.includes(message.type)) {
        return; // Silently ignore invalid message types
      }

      // Security: Validate matchId format (alphanumeric with underscores, reasonable length)
      if (message.matchId && (typeof message.matchId !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(message.matchId))) {
        return; // Silently ignore invalid matchId format
      }

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
║    POST /submit       - Submit a build                    ║
║    POST /demo         - Start demo match                  ║
║    GET  /api/rules    - Game configuration (for agents)   ║
║    GET  /dashboard    - Homepage data (leaderboard/stats) ║
║    GET  /leaderboard  - ELO rankings                      ║
║    GET  /learning/*   - Agent learning API                ║
║    GET  /replay/:id   - Match replay data                 ║
║    GET  /match/:id    - Get match state                   ║
║    GET  /results/:id  - Get match results                 ║
║    GET  /history      - Match history                     ║
║    GET  /stats        - Game balance statistics           ║
║    GET  /status       - Queue status                      ║
║                                                           ║
║  WebSocket: ws://localhost:${PORT}                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
