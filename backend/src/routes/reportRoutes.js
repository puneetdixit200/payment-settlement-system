const express = require('express');
const router = express.Router();
const { reportController } = require('../controllers');
const { verifyToken } = require('../middleware');

router.use(verifyToken);

router.get('/daily', reportController.generateDailyReport);
router.get('/merchant-settlements', reportController.generateMerchantSettlements);
router.get('/unmatched', reportController.generateUnmatchedReport);
router.get('/sla-breaches', reportController.generateSLABreachReport);
router.get('/failed-payments', reportController.generateFailedPaymentsReport);

module.exports = router;
