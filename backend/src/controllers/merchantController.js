const { Merchant, Transaction } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');
const { MERCHANT_STATUS, SETTLEMENT_CYCLE, PAYMENT_GATEWAY } = require('../config/constants');

// @desc    Get all merchants
// @route   GET /api/merchants
// @access  Private
const getMerchants = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    payment_gateway,
    search,
    sort = '-createdAt'
  } = req.query;

  const query = {};
  
  if (status) query.status = status;
  if (payment_gateway) query.payment_gateway = payment_gateway;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { merchant_id: { $regex: search, $options: 'i' } }
    ];
  }

  const total = await Merchant.countDocuments(query);
  const merchants = await Merchant.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  res.status(200).json({
    success: true,
    data: {
      merchants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get single merchant
// @route   GET /api/merchants/:id
// @access  Private
const getMerchant = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.params.id)
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email');

  if (!merchant) {
    throw new AppError('Merchant not found', 404);
  }

  // Get merchant transactions summary
  const transactionsSummary = await Transaction.aggregate([
    { $match: { merchant_id: merchant.merchant_id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        successCount: {
          $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
        },
        failedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
        },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
        },
        matchedCount: {
          $sum: { $cond: [{ $eq: ['$reconciliation_status', 'MATCHED'] }, 1, 0] }
        },
        slaBreachedCount: {
          $sum: { $cond: ['$sla_breached', 1, 0] }
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      merchant,
      transactionsSummary: transactionsSummary[0] || {
        total: 0,
        totalAmount: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        matchedCount: 0,
        slaBreachedCount: 0
      }
    }
  });
});

// @desc    Get merchant by merchant_id
// @route   GET /api/merchants/by-merchant-id/:merchantId
// @access  Private
const getMerchantByMerchantId = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findOne({ merchant_id: req.params.merchantId });

  if (!merchant) {
    throw new AppError('Merchant not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { merchant }
  });
});

// @desc    Create merchant
// @route   POST /api/merchants
// @access  Private
const createMerchant = asyncHandler(async (req, res) => {
  const {
    merchant_id,
    name,
    email,
    settlement_cycle,
    payment_gateway,
    status,
    sla_hours,
    contact_person,
    phone,
    address,
    business_type,
    gst_number,
    pan_number,
    bank_details,
    razorpay_account_id,
    stripe_account_id,
    notifications,
    notes
  } = req.body;

  // Check for duplicate merchant_id
  if (merchant_id) {
    const existing = await Merchant.findOne({ merchant_id: merchant_id.toUpperCase() });
    if (existing) {
      throw new AppError('Merchant ID already exists', 400);
    }
  }

  // Check for duplicate email
  const emailExists = await Merchant.findOne({ email: email.toLowerCase() });
  if (emailExists) {
    throw new AppError('Email already registered to another merchant', 400);
  }

  const merchant = await Merchant.create({
    merchant_id,
    name,
    email,
    settlement_cycle: settlement_cycle || SETTLEMENT_CYCLE.DAILY,
    payment_gateway: payment_gateway || PAYMENT_GATEWAY.BANK,
    status: status || MERCHANT_STATUS.ACTIVE,
    sla_hours: sla_hours || 24,
    contact_person,
    phone,
    address,
    business_type,
    gst_number,
    pan_number,
    bank_details,
    razorpay_account_id,
    stripe_account_id,
    notifications,
    notes,
    created_by: req.user._id
  });

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.MERCHANT_CREATE, 'MERCHANT', {
    entity_id: merchant._id.toString(),
    entity_name: merchant.name,
    ip_address: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Merchant created successfully',
    data: { merchant }
  });
});

// @desc    Create merchant from transaction (Unknown Merchant handling)
// @route   POST /api/merchants/from-transaction
// @access  Private
const createMerchantFromTransaction = asyncHandler(async (req, res) => {
  const { transaction_id, name, email, ...otherData } = req.body;

  if (!transaction_id || !name || !email) {
    throw new AppError('Transaction ID, name, and email are required', 400);
  }

  // Find the transaction
  const transaction = await Transaction.findOne({ transaction_id });
  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  // Check if merchant already exists
  const existingMerchant = await Merchant.findOne({ merchant_id: transaction.merchant_id });
  if (existingMerchant) {
    throw new AppError('Merchant with this ID already exists', 400);
  }

  // Create merchant with data from transaction
  const merchant = await Merchant.create({
    merchant_id: transaction.merchant_id,
    name,
    email,
    payment_gateway: transaction.payment_gateway || PAYMENT_GATEWAY.BANK,
    status: MERCHANT_STATUS.ACTIVE,
    created_by: req.user._id,
    notes: `Created from transaction ${transaction_id}`,
    ...otherData
  });

  // Update transaction to link to merchant
  transaction.merchant = merchant._id;
  await transaction.save();

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.MERCHANT_CREATE, 'MERCHANT', {
    entity_id: merchant._id.toString(),
    entity_name: merchant.name,
    extra: { created_from_transaction: transaction_id },
    ip_address: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Merchant created from transaction successfully',
    data: { merchant }
  });
});

// @desc    Update merchant
// @route   PUT /api/merchants/:id
// @access  Private
const updateMerchant = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.params.id);

  if (!merchant) {
    throw new AppError('Merchant not found', 404);
  }

  const beforeUpdate = merchant.toJSON();

  // Fields that can be updated
  const allowedUpdates = [
    'name', 'email', 'settlement_cycle', 'payment_gateway', 'status',
    'sla_hours', 'contact_person', 'phone', 'address', 'business_type',
    'gst_number', 'pan_number', 'bank_details', 'razorpay_account_id',
    'stripe_account_id', 'notifications', 'notes'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      merchant[field] = req.body[field];
    }
  });

  merchant.updated_by = req.user._id;
  await merchant.save();

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.MERCHANT_EDIT, 'MERCHANT', {
    entity_id: merchant._id.toString(),
    entity_name: merchant.name,
    changes: { before: beforeUpdate, after: merchant.toJSON() },
    ip_address: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Merchant updated successfully',
    data: { merchant }
  });
});

// @desc    Delete merchant
// @route   DELETE /api/merchants/:id
// @access  Private/Admin
const deleteMerchant = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.params.id);

  if (!merchant) {
    throw new AppError('Merchant not found', 404);
  }

  // Check if merchant has transactions
  const transactionCount = await Transaction.countDocuments({ merchant_id: merchant.merchant_id });
  
  if (transactionCount > 0) {
    throw new AppError(
      `Cannot delete merchant with ${transactionCount} transactions. Set status to INACTIVE instead.`,
      400
    );
  }

  await merchant.deleteOne();

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.MERCHANT_DELETE, 'MERCHANT', {
    entity_id: merchant._id.toString(),
    entity_name: merchant.name,
    ip_address: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Merchant deleted successfully'
  });
});

// @desc    Get unknown merchants (from transactions)
// @route   GET /api/merchants/unknown
// @access  Private
const getUnknownMerchants = asyncHandler(async (req, res) => {
  // Find all unique merchant_ids in transactions that don't have a corresponding merchant
  const allMerchantIds = await Merchant.distinct('merchant_id');
  
  const unknownMerchants = await Transaction.aggregate([
    { $match: { merchant_id: { $nin: allMerchantIds } } },
    {
      $group: {
        _id: '$merchant_id',
        transactionCount: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        firstSeen: { $min: '$createdAt' },
        lastSeen: { $max: '$createdAt' },
        payment_gateways: { $addToSet: '$payment_gateway' }
      }
    },
    { $sort: { transactionCount: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      unknownMerchants,
      total: unknownMerchants.length
    }
  });
});

// @desc    Get merchant statistics
// @route   GET /api/merchants/stats
// @access  Private
const getMerchantStats = asyncHandler(async (req, res) => {
  const stats = await Merchant.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'INACTIVE'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } }
      }
    }
  ]);

  const byGateway = await Merchant.aggregate([
    {
      $group: {
        _id: '$payment_gateway',
        count: { $sum: 1 }
      }
    }
  ]);

  const byCycle = await Merchant.aggregate([
    {
      $group: {
        _id: '$settlement_cycle',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || { total: 0, active: 0, inactive: 0, pending: 0 },
      byGateway,
      byCycle
    }
  });
});

module.exports = {
  getMerchants,
  getMerchant,
  getMerchantByMerchantId,
  createMerchant,
  createMerchantFromTransaction,
  updateMerchant,
  deleteMerchant,
  getUnknownMerchants,
  getMerchantStats
};
