const express = require('express');
const router = express.Router();
const { alertController } = require('../controllers');
const { verifyToken } = require('../middleware');

router.use(verifyToken);

// Stats
router.get('/stats', alertController.getAlertStats);

// Unread count
router.get('/unread-count', alertController.getUnreadCount);

// Mark all as read
router.put('/read-all', alertController.markAllAlertsRead);

// Standard CRUD
router.get('/', alertController.getAlerts);
router.get('/:id', alertController.getAlert);

// Status updates
router.put('/:id/read', alertController.markAlertRead);
router.put('/:id/acknowledge', alertController.acknowledgeAlert);
router.put('/:id/resolve', alertController.resolveAlert);
router.put('/:id/dismiss', alertController.dismissAlert);

module.exports = router;
