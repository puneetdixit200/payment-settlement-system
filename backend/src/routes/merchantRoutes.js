const express = require('express');
const router = express.Router();
const { merchantController } = require('../controllers');
const { verifyToken, requirePermission, adminOnly } = require('../middleware');
const { auditLog, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');

router.use(verifyToken);

// Get merchant stats (must be before /:id route)
router.get('/stats', merchantController.getMerchantStats);

// Get unknown merchants
router.get('/unknown', merchantController.getUnknownMerchants);

// Get merchant by merchant_id (not ObjectId)
router.get('/by-merchant-id/:merchantId', merchantController.getMerchantByMerchantId);

// Create merchant from transaction
router.post('/from-transaction', 
  requirePermission('canAddMerchant'),
  merchantController.createMerchantFromTransaction
);

// Standard CRUD
router.get('/', merchantController.getMerchants);
router.get('/:id', merchantController.getMerchant);

router.post('/',
  requirePermission('canAddMerchant'),
  merchantController.createMerchant
);

router.put('/:id',
  requirePermission('canEditMerchant'),
  merchantController.updateMerchant
);

router.delete('/:id',
  adminOnly,
  requirePermission('canDeleteRecords'),
  merchantController.deleteMerchant
);

module.exports = router;
