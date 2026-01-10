const express = require('express');
const router = express.Router();
const { reconciliationController } = require('../controllers');
const { verifyToken, requirePermission } = require('../middleware');

router.use(verifyToken);

// Stats (must be before /runs/:id)
router.get('/stats', reconciliationController.getReconciliationStats);

// Unmatched transactions
router.get('/unmatched', reconciliationController.getUnmatchedTransactions);

// Disputes
router.get('/disputes', reconciliationController.getDisputes);
router.put('/disputes/:id/resolve', reconciliationController.resolveDispute);

// Reconciliation runs
router.post('/run',
  requirePermission('canRunReconciliation'),
  reconciliationController.runReconciliation
);

router.get('/runs', reconciliationController.getReconciliationRuns);
router.get('/runs/:id', reconciliationController.getReconciliationRun);

module.exports = router;
