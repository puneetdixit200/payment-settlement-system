const jwt = require('jsonwebtoken');
const config = require('../config');

const setupSocketHandlers = (io) => {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userEmail} (${socket.id})`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);
    
    // Join user to role-based room
    socket.join(`role:${socket.userRole}`);

    // Subscribe to merchant updates
    socket.on('subscribe:merchant', (merchantId) => {
      socket.join(`merchant:${merchantId}`);
      console.log(`${socket.userEmail} subscribed to merchant:${merchantId}`);
    });

    // Unsubscribe from merchant updates
    socket.on('unsubscribe:merchant', (merchantId) => {
      socket.leave(`merchant:${merchantId}`);
      console.log(`${socket.userEmail} unsubscribed from merchant:${merchantId}`);
    });

    // Subscribe to all alerts
    socket.on('subscribe:alerts', () => {
      socket.join('alerts');
      console.log(`${socket.userEmail} subscribed to alerts`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.userEmail} (${reason})`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.userEmail}:`, error);
    });
  });

  // Helper function to emit to all connected clients
  io.emitToAll = (event, data) => {
    io.emit(event, data);
  };

  // Helper function to emit to specific merchant subscribers
  io.emitToMerchant = (merchantId, event, data) => {
    io.to(`merchant:${merchantId}`).emit(event, data);
  };

  // Helper function to emit to specific user
  io.emitToUser = (userId, event, data) => {
    io.to(`user:${userId}`).emit(event, data);
  };

  // Helper function to emit to role
  io.emitToRole = (role, event, data) => {
    io.to(`role:${role}`).emit(event, data);
  };

  console.log('Socket.io handlers initialized');
};

// Event types for reference
const SOCKET_EVENTS = {
  TRANSACTION_NEW: 'transaction:new',
  TRANSACTION_UPDATE: 'transaction:update',
  RECONCILIATION_COMPLETE: 'reconciliation:complete',
  DISPUTE_NEW: 'dispute:new',
  ALERT_NEW: 'alert:new',
  SLA_BREACH: 'sla:breach'
};

module.exports = { setupSocketHandlers, SOCKET_EVENTS };
