const { Transaction, Merchant, Alert } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');
const { TRANSACTION_STATUS, RECONCILIATION_STATUS, ALERT_TYPES } = require('../config/constants');

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    source,
    reconciliation_status,
    merchant_id,
    payment_gateway,
    sla_breached,
    is_disputed,
    start_date,
    end_date,
    search,
    sort = '-createdAt'
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (source) query.source = source;
  if (reconciliation_status) query.reconciliation_status = reconciliation_status;
  if (merchant_id) query.merchant_id = merchant_id;
  if (payment_gateway) query.payment_gateway = payment_gateway;
  if (sla_breached === 'true') query.sla_breached = true;
  if (sla_breached === 'false') query.sla_breached = false;
  if (is_disputed === 'true') query.is_disputed = true;
  if (is_disputed === 'false') query.is_disputed = false;
  
  if (start_date || end_date) {
    query.transaction_date = {};
    if (start_date) query.transaction_date.$gte = new Date(start_date);
    if (end_date) query.transaction_date.$lte = new Date(end_date);
  }

  if (search) {
    query.$or = [
      { transaction_id: { $regex: search, $options: 'i' } },
      { merchant_id: { $regex: search, $options: 'i' } },
      { reference_id: { $regex: search, $options: 'i' } },
      { customer_email: { $regex: search, $options: 'i' } }
    ];
  }

  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .populate('merchant', 'name email')
    .populate('created_by', 'name')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  res.status(200).json({
    success: true,
    data: {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('merchant', 'name email sla_hours')
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email')
    .populate('reconciled_with')
    .populate('status_history.changed_by', 'name');

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { transaction }
  });
});

// @desc    Get transaction by transaction_id
// @route   GET /api/transactions/by-txn-id/:transactionId
// @access  Private
const getTransactionByTxnId = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ transaction_id: req.params.transactionId })
    .populate('merchant', 'name email');

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { transaction }
  });
});

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  const {
    transaction_id,
    merchant_id,
    amount,
    currency,
    payment_gateway,
    status,
    source,
    reference_id,
    transaction_date,
    customer_email,
    customer_name,
    description,
    metadata
  } = req.body;

  // Check for duplicate transaction_id
  if (transaction_id) {
    const existing = await Transaction.findOne({ transaction_id: transaction_id.toUpperCase() });
    if (existing) {
      throw new AppError('Transaction ID already exists', 400);
    }
  }

  // Check if merchant exists
  const merchant = await Merchant.findOne({ merchant_id: merchant_id.toUpperCase() });
  
  const transaction = await Transaction.create({
    transaction_id,
    merchant_id: merchant_id.toUpperCase(),
    merchant: merchant?._id,
    amount,
    currency: currency || 'INR',
    payment_gateway,
    status: status || TRANSACTION_STATUS.PENDING,
    source,
    reference_id,
    transaction_date: transaction_date || new Date(),
    customer_email,
    customer_name,
    description,
    metadata,
    sla_hours: merchant?.sla_hours,
    created_by: req.user._id
  });

  // If merchant doesn't exist, create an alert
  if (!merchant) {
    await Alert.createAlert({
      type: ALERT_TYPES.UNKNOWN_MERCHANT,
      severity: 'HIGH',
      title: 'Unknown Merchant Detected',
      message: `Transaction ${transaction.transaction_id} has unknown merchant ID: ${merchant_id}`,
      entity_type: 'TRANSACTION',
      entity_id: transaction.transaction_id,
      merchant_id: merchant_id.toUpperCase(),
      transaction_id: transaction.transaction_id,
      transaction: transaction._id,
      data: { merchant_id: merchant_id.toUpperCase() }
    });
  }

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.TRANSACTION_CREATE, 'TRANSACTION', {
    entity_id: transaction._id.toString(),
    entity_name: transaction.transaction_id,
    ip_address: req.ip
  });

  // Emit socket event
  if (req.app.get('io')) {
    req.app.get('io').emit('transaction:new', {
      transaction: transaction.toJSON()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: { transaction, merchantExists: !!merchant }
  });
});

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  const beforeUpdate = transaction.toJSON();

  const allowedUpdates = [
    'amount', 'currency', 'status', 'reference_id', 'transaction_date',
    'customer_email', 'customer_name', 'description', 'metadata',
    'settlement_time', 'dispute_reason', 'dispute_resolved', 'dispute_resolution'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      transaction[field] = req.body[field];
    }
  });

  // Check for SLA breach on settlement
  if (req.body.settlement_time && !transaction.settlement_time) {
    const merchant = await Merchant.findOne({ merchant_id: transaction.merchant_id });
    if (merchant && merchant.sla_hours) {
      const createdAt = new Date(transaction.createdAt);
      const settlementTime = new Date(req.body.settlement_time);
      const hoursToSettle = (settlementTime - createdAt) / (1000 * 60 * 60);
      
      if (hoursToSettle > merchant.sla_hours) {
        transaction.sla_breached = true;
        transaction.sla_breach_hours = hoursToSettle - merchant.sla_hours;

        // Create SLA breach alert
        await Alert.createAlert({
          type: ALERT_TYPES.SLA_BREACH,
          severity: 'HIGH',
          title: 'SLA Breach Detected',
          message: `Transaction ${transaction.transaction_id} exceeded SLA by ${transaction.sla_breach_hours.toFixed(2)} hours`,
          entity_type: 'TRANSACTION',
          entity_id: transaction.transaction_id,
          merchant_id: transaction.merchant_id,
          transaction_id: transaction.transaction_id,
          transaction: transaction._id,
          data: { 
            expected_hours: merchant.sla_hours, 
            actual_hours: hoursToSettle 
          }
        });
      }
    }
  }

  transaction.updated_by = req.user._id;
  await transaction.save();

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.TRANSACTION_EDIT, 'TRANSACTION', {
    entity_id: transaction._id.toString(),
    entity_name: transaction.transaction_id,
    changes: { before: beforeUpdate, after: transaction.toJSON() },
    ip_address: req.ip
  });

  // Emit socket event
  if (req.app.get('io')) {
    req.app.get('io').emit('transaction:update', {
      transaction: transaction.toJSON()
    });
  }

  res.status(200).json({
    success: true,
    message: 'Transaction updated successfully',
    data: { transaction }
  });
});

// @desc    Update transaction status
// @route   PATCH /api/transactions/:id/status
// @access  Private
const updateTransactionStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  if (!status || !Object.values(TRANSACTION_STATUS).includes(status)) {
    throw new AppError('Valid status is required', 400);
  }

  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  const oldStatus = transaction.status;
  transaction.status = status;
  transaction.updated_by = req.user._id;
  
  // Add to status history
  transaction.status_history.push({
    status,
    changed_at: new Date(),
    changed_by: req.user._id,
    reason
  });

  await transaction.save();

  // Create alert for failed transactions
  if (status === TRANSACTION_STATUS.FAILED && oldStatus !== TRANSACTION_STATUS.FAILED) {
    await Alert.createAlert({
      type: ALERT_TYPES.TRANSACTION_FAILED,
      severity: 'MEDIUM',
      title: 'Transaction Failed',
      message: `Transaction ${transaction.transaction_id} has failed. Reason: ${reason || 'Not specified'}`,
      entity_type: 'TRANSACTION',
      entity_id: transaction.transaction_id,
      merchant_id: transaction.merchant_id,
      transaction_id: transaction.transaction_id,
      transaction: transaction._id
    });
  }

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.TRANSACTION_EDIT, 'TRANSACTION', {
    entity_id: transaction._id.toString(),
    entity_name: transaction.transaction_id,
    extra: { action: 'status_update', oldStatus, newStatus: status, reason },
    ip_address: req.ip
  });

  // Emit socket event
  if (req.app.get('io')) {
    req.app.get('io').emit('transaction:update', {
      transaction: transaction.toJSON()
    });
  }

  res.status(200).json({
    success: true,
    message: 'Transaction status updated successfully',
    data: { transaction }
  });
});

// @desc    Bulk update transactions
// @route   POST /api/transactions/bulk-update
// @access  Private
const bulkUpdateTransactions = asyncHandler(async (req, res) => {
  const { transaction_ids, updates } = req.body;

  if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
    throw new AppError('Transaction IDs array is required', 400);
  }

  if (!updates || typeof updates !== 'object') {
    throw new AppError('Updates object is required', 400);
  }

  const allowedBulkUpdates = ['status', 'reconciliation_status', 'settlement_time'];
  const sanitizedUpdates = {};
  
  for (const key of allowedBulkUpdates) {
    if (updates[key] !== undefined) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  sanitizedUpdates.updated_by = req.user._id;

  const result = await Transaction.updateMany(
    { _id: { $in: transaction_ids } },
    { $set: sanitizedUpdates }
  );

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.TRANSACTION_BULK_UPDATE, 'TRANSACTION', {
    extra: { 
      transaction_count: transaction_ids.length,
      updates: sanitizedUpdates,
      matched: result.matchedCount,
      modified: result.modifiedCount
    },
    ip_address: req.ip
  });

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} transactions updated successfully`,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private/Admin
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  await transaction.deleteOne();

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.TRANSACTION_DELETE, 'TRANSACTION', {
    entity_id: transaction._id.toString(),
    entity_name: transaction.transaction_id,
    ip_address: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Transaction deleted successfully'
  });
});

// @desc    Get transaction statistics
// @route   GET /api/transactions/stats
// @access  Private
const getTransactionStats = asyncHandler(async (req, res) => {
  const { start_date, end_date, merchant_id } = req.query;

  const matchStage = {};
  if (start_date || end_date) {
    matchStage.transaction_date = {};
    if (start_date) matchStage.transaction_date.$gte = new Date(start_date);
    if (end_date) matchStage.transaction_date.$lte = new Date(end_date);
  }
  if (merchant_id) matchStage.merchant_id = merchant_id;

  const stats = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        successCount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
        successAmount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
        failedCount: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        failedAmount: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, '$amount', 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$amount', 0] } },
        matchedCount: { $sum: { $cond: [{ $eq: ['$reconciliation_status', 'MATCHED'] }, 1, 0] } },
        unmatchedCount: { $sum: { $cond: [{ $in: ['$reconciliation_status', ['UNMATCHED_BANK', 'UNMATCHED_MERCHANT']] }, 1, 0] } },
        slaBreachedCount: { $sum: { $cond: ['$sla_breached', 1, 0] } },
        disputedCount: { $sum: { $cond: ['$is_disputed', 1, 0] } }
      }
    }
  ]);

  const byGateway = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$payment_gateway',
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
        successRate: {
          $avg: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
        }
      }
    }
  ]);

  const bySource = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    }
  ]);

  const byReconciliationStatus = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$reconciliation_status',
        count: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || {
        total: 0,
        totalAmount: 0,
        successCount: 0,
        successAmount: 0,
        failedCount: 0,
        failedAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        slaBreachedCount: 0,
        disputedCount: 0
      },
      byGateway,
      bySource,
      byReconciliationStatus
    }
  });
});

// @desc    Get transactions by merchant
// @route   GET /api/transactions/by-merchant/:merchantId
// @access  Private
const getTransactionsByMerchant = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, start_date, end_date } = req.query;

  const query = { merchant_id: req.params.merchantId.toUpperCase() };
  if (status) query.status = status;
  if (start_date || end_date) {
    query.transaction_date = {};
    if (start_date) query.transaction_date.$gte = new Date(start_date);
    if (end_date) query.transaction_date.$lte = new Date(end_date);
  }

  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .sort('-transaction_date')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  res.status(200).json({
    success: true,
    data: {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

module.exports = {
  getTransactions,
  getTransaction,
  getTransactionByTxnId,
  createTransaction,
  updateTransaction,
  updateTransactionStatus,
  bulkUpdateTransactions,
  deleteTransaction,
  getTransactionStats,
  getTransactionsByMerchant
};
