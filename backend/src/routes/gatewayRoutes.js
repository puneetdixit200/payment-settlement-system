const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly } = require('../middleware');
const {
  getGatewayStatus,
  testRazorpayConnection,
  updateRazorpayConfig,
  getRazorpayPayments,
  syncRazorpayPayments,
  getRazorpayStats
} = require('../controllers/gatewayController');

// All routes require authentication
router.use(verifyToken);

router.get('/', getGatewayStatus);
router.post('/razorpay/test', testRazorpayConnection);
router.post('/razorpay/config', adminOnly, updateRazorpayConfig);
router.get('/razorpay/payments', getRazorpayPayments);
router.post('/razorpay/sync', syncRazorpayPayments);
router.get('/razorpay/stats', getRazorpayStats);

module.exports = router;


