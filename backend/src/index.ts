import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import path from 'path';
import { config } from './config';
import { initDatabase, closeDatabase } from './db/sqlite';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import { setupWebSocketHandler, getActiveSessionCount } from './websocket/terminalHandler';
import connectionsRouter from './routes/connections';

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());

// CORS for development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: getActiveSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

// API routes with Telegram auth
app.use('/api/connections', telegramAuthMiddleware, connectionsRouter);

// Serve static frontend files
app.use(express.static(config.frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(config.frontendPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not found' });
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start server
async function start() {
  try {
    // Initialize database
    initDatabase();
    console.log('Database initialized');

    // Setup WebSocket handler
    setupWebSocketHandler(wss);
    console.log('WebSocket handler initialized');

    // Start server
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Frontend path: ${config.frontendPath}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');

  // Close WebSocket connections
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');

    // Close database
    closeDatabase();
    console.log('Database closed');

    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
start();
