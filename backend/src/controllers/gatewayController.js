const { asyncHandler, AppError } = require('../middleware');
const config = require('../config');
const Razorpay = require('razorpay');
const { Transaction } = require('../models');

// @desc    Get gateway configurations status
// @route   GET /api/gateways
// @access  Private
const getGatewayStatus = asyncHandler(async (req, res) => {
  const gateways = {
    razorpay: {
      configured: config.razorpay.isConfigured,
      mode: config.razorpay.keyId?.startsWith('rzp_test_') ? 'test' : 'live',
      keyIdPrefix: config.razorpay.keyId ? config.razorpay.keyId.substring(0, 15) + '...' : null
    },
    stripe: {
      configured: config.stripe.isConfigured,
      mode: config.stripe.secretKey?.startsWith('sk_test_') ? 'test' : 'live'
    }
  };

  res.status(200).json({
    success: true,
    data: { gateways }
  });
});

// @desc    Test Razorpay connection
// @route   POST /api/gateways/razorpay/test
// @access  Private
const testRazorpayConnection = asyncHandler(async (req, res) => {
  if (!config.razorpay.isConfigured) {
    throw new AppError('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.', 400);
  }

  try {
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret
    });

    // Try to fetch payments to verify connection
    const payments = await razorpay.payments.all({ count: 1 });
    
    res.status(200).json({
      success: true,
      message: 'Razorpay connection successful!',
      data: {
        connected: true,
        mode: config.razorpay.keyId.startsWith('rzp_test_') ? 'test' : 'live',
        keyId: config.razorpay.keyId.substring(0, 15) + '...',
        paymentCount: payments.count || 0
      }
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: 'Razorpay connection failed',
      data: {
        connected: false,
        error: error.message
      }
    });
  }
});

// @desc    Update Razorpay credentials
// @route   POST /api/gateways/razorpay/config
// @access  Private/Admin
const updateRazorpayConfig = asyncHandler(async (req, res) => {
  const { keyId, keySecret } = req.body;

  if (!keyId || !keySecret) {
    throw new AppError('Key ID and Key Secret are required', 400);
  }

  // Store in memory for this session (in production, use secure storage)
  config.razorpay.keyId = keyId;
  config.razorpay.keySecret = keySecret;
  config.razorpay.isConfigured = true;

  // Test connection with new credentials
  try {
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    await razorpay.payments.all({ count: 1 });

    res.status(200).json({
      success: true,
      message: 'Razorpay credentials updated and verified!',
      data: {
        connected: true,
        mode: keyId.startsWith('rzp_test_') ? 'test' : 'live',
        keyId: keyId.substring(0, 15) + '...'
      }
    });
  } catch (error) {
    // Reset if failed
    config.razorpay.keyId = process.env.RAZORPAY_KEY_ID;
    config.razorpay.keySecret = process.env.RAZORPAY_KEY_SECRET;
    config.razorpay.isConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    throw new AppError(`Failed to verify Razorpay credentials: ${error.message}`, 400);
  }
});

// @desc    Fetch recent Razorpay payments
// @route   GET /api/gateways/razorpay/payments
// @access  Private
const getRazorpayPayments = asyncHandler(async (req, res) => {
  if (!config.razorpay.isConfigured) {
    throw new AppError('Razorpay is not configured', 400);
  }

  const { count = 10 } = req.query;

  try {
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret
    });

    const payments = await razorpay.payments.all({ count: parseInt(count) });

    res.status(200).json({
      success: true,
      data: {
        payments: payments.items || [],
        count: payments.count || 0
      }
    });
  } catch (error) {
    throw new AppError(`Failed to fetch Razorpay payments: ${error.message}`, 500);
  }
});

// @desc    Sync Razorpay payments to transactions
// @route   POST /api/gateways/razorpay/sync
// @access  Private
const syncRazorpayPayments = asyncHandler(async (req, res) => {
  if (!config.razorpay.isConfigured) {
    throw new AppError('Razorpay is not configured', 400);
  }

  const { count = 50 } = req.body;

  try {
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret
    });

    const payments = await razorpay.payments.all({ count: parseInt(count) });
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const payment of payments.items || []) {
      // Check if already exists
      const existingTxn = await Transaction.findOne({ 
        $or: [
          { transaction_id: payment.id },
          { reference_id: payment.id }
        ]
      });

      if (existingTxn) {
        skipped++;
        continue;
      }

      try {
        // Create transaction from Razorpay payment
        await Transaction.create({
          transaction_id: payment.id,
          merchant_id: payment.notes?.merchant_id || 'RAZORPAY',
          amount: payment.amount / 100, // Razorpay amounts are in paise
          currency: payment.currency?.toUpperCase() || 'INR',
          payment_gateway: 'RAZORPAY',
          status: payment.status === 'captured' ? 'SUCCESS' : 
                  payment.status === 'failed' ? 'FAILED' : 'PENDING',
          source: 'BANK',
          reference_id: payment.order_id || payment.id,
          transaction_date: new Date(payment.created_at * 1000),
          customer_email: payment.email || payment.notes?.email,
          customer_name: payment.notes?.name,
          description: payment.description || `Razorpay payment via ${payment.method}`,
          metadata: {
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id,
            method: payment.method,
            bank: payment.bank,
            wallet: payment.wallet,
            vpa: payment.vpa,
            card_id: payment.card_id,
            international: payment.international,
            fee: payment.fee,
            tax: payment.tax
          },
          created_by: req.user._id
        });
        imported++;
      } catch (err) {
        console.error(`Failed to import payment ${payment.id}:`, err.message);
        errors++;
      }
    }

    // Emit socket event for real-time updates
    if (req.app.get('io') && imported > 0) {
      req.app.get('io').emit('transactions:sync', { imported, source: 'RAZORPAY' });
    }

    res.status(200).json({
      success: true,
      message: `Synced ${imported} payments from Razorpay`,
      data: {
        imported,
        skipped,
        errors,
        total: payments.count || 0
      }
    });
  } catch (error) {
    throw new AppError(`Failed to sync Razorpay payments: ${error.message}`, 500);
  }
});

// @desc    Get Razorpay stats (total received, etc.)
// @route   GET /api/gateways/razorpay/stats
// @access  Private
const getRazorpayStats = asyncHandler(async (req, res) => {
  if (!config.razorpay.isConfigured) {
    throw new AppError('Razorpay is not configured', 400);
  }

  try {
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret
    });

    // Fetch recent payments to calculate stats
    const payments = await razorpay.payments.all({ count: 100 });
    
    let totalReceived = 0;
    let totalCaptured = 0;
    let totalFailed = 0;
    let totalPending = 0;

    for (const payment of payments.items || []) {
      const amount = payment.amount / 100; // Convert paise to rupees
      
      if (payment.status === 'captured') {
        totalCaptured += amount;
        totalReceived += amount;
      } else if (payment.status === 'failed') {
        totalFailed += amount;
      } else {
        totalPending += amount;
      }
    }

    // Also get local transaction stats for Razorpay
    const localStats = await Transaction.aggregate([
      { $match: { payment_gateway: 'RAZORPAY' } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
          successAmount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        razorpay: {
          totalReceived,
          totalCaptured,
          totalFailed,
          totalPending,
          paymentCount: payments.count || 0
        },
        local: localStats[0] || {
          totalAmount: 0,
          count: 0,
          successCount: 0,
          successAmount: 0
        }
      }
    });
  } catch (error) {
    throw new AppError(`Failed to get Razorpay stats: ${error.message}`, 500);
  }
});

module.exports = {
  getGatewayStatus,
  testRazorpayConnection,
  updateRazorpayConfig,
  getRazorpayPayments,
  syncRazorpayPayments,
  getRazorpayStats
};

