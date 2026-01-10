require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const config = require('./config');
const { connectDatabase } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware');
const routes = require('./routes');
const { setupSocketHandlers } = require('./websockets/socketHandler');

// Create Express app
const app = express();
const server = http.createServer(app);

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

// Create required directories
const uploadDir = path.join(__dirname, '../uploads');
const logDir = path.join(__dirname, '../logs');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  // Log to file in production
  const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
}

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', routes.authRoutes);
app.use('/api/merchants', routes.merchantRoutes);
app.use('/api/transactions', routes.transactionRoutes);
app.use('/api/upload', routes.uploadRoutes);
app.use('/api/reconciliation', routes.reconciliationRoutes);
app.use('/api/audit-logs', routes.auditLogRoutes);
app.use('/api/export', routes.exportRoutes);
app.use('/api/dashboard', routes.dashboardRoutes);
app.use('/api/alerts', routes.alertRoutes);
app.use('/api/reports', routes.reportRoutes);
app.use('/api/gateways', routes.gatewayRoutes);

// Static files for uploads (if needed)
app.use('/uploads', express.static(uploadDir));

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Setup Socket.io handlers
setupSocketHandlers(io);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start listening
    server.listen(config.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Payment Settlement Platform Server                   ║
║                                                           ║
║   Environment: ${config.nodeEnv.padEnd(10)}                         ║
║   Port:        ${String(config.port).padEnd(10)}                         ║
║   MongoDB:     Connected                                  ║
║   Socket.io:   Ready                                      ║
║                                                           ║
║   API:         http://localhost:${config.port}/api              ║
║   Health:      http://localhost:${config.port}/health           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = { app, server, io };
