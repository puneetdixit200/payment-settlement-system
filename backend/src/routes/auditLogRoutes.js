const express = require('express');
const router = express.Router();
const { auditLogController } = require('../controllers');
const { verifyToken, requirePermission } = require('../middleware');

router.use(verifyToken);
router.use(requirePermission('canViewAuditLogs'));

// Stats
router.get('/stats', auditLogController.getAuditLogStats);

// Export
router.get('/export', auditLogController.exportAuditLogs);

// Log files
router.get('/files', auditLogController.getLogFiles);
router.get('/files/:filename', auditLogController.viewLogFile);
router.get('/files/:filename/download', auditLogController.downloadLogFile);

// Database logs
router.get('/', auditLogController.getAuditLogs);
router.get('/:id', auditLogController.getAuditLog);

module.exports = router;
