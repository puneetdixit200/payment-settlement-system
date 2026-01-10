const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { exportController } = require('../controllers');
const { verifyToken, requirePermission } = require('../middleware');

// Rate limiting for export endpoints
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: {
    success: false,
    message: 'Too many export requests. Please try again later.'
  }
});

router.use(verifyToken);
router.use(requirePermission('canExportData'));
router.use(exportLimiter);

router.get('/settlements', exportController.exportSettlements);
router.get('/transactions', exportController.exportTransactions);
router.get('/merchants', exportController.exportMerchants);

module.exports = router;
