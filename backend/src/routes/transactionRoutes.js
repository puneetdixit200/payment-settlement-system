const express = require('express');
const router = express.Router();
const { transactionController } = require('../controllers');
const { verifyToken, requirePermission, adminOnly } = require('../middleware');

router.use(verifyToken);

// Stats routes (must be before /:id)
router.get('/stats', transactionController.getTransactionStats);

// Bulk operations
router.post('/bulk-update',
  requirePermission('canEditTransactions'),
  transactionController.bulkUpdateTransactions
);

// Get by transaction_id (not ObjectId)
router.get('/by-txn-id/:transactionId', transactionController.getTransactionByTxnId);

// Get by merchant
router.get('/by-merchant/:merchantId', transactionController.getTransactionsByMerchant);

// Standard CRUD
router.get('/', transactionController.getTransactions);
router.get('/:id', transactionController.getTransaction);

router.post('/',
  requirePermission('canEditTransactions'),
  transactionController.createTransaction
);

router.put('/:id',
  requirePermission('canEditTransactions'),
  transactionController.updateTransaction
);

router.patch('/:id/status',
  requirePermission('canEditTransactions'),
  transactionController.updateTransactionStatus
);

router.delete('/:id',
  adminOnly,
  requirePermission('canDeleteRecords'),
  transactionController.deleteTransaction
);

module.exports = router;
