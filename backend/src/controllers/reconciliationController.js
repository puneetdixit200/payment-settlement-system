const { Transaction, Merchant, ReconciliationRun, Alert } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');
const { RECONCILIATION_STATUS, ALERT_TYPES } = require('../config/constants');

// @desc    Run reconciliation
// @route   POST /api/reconciliation/run
// @access  Private
const runReconciliation = asyncHandler(async (req, res) => {
  const {
    date_window_hours = 24,
    amount_tolerance = 0,
    include_merchants = [],
    exclude_merchants = [],
    start_date,
    end_date
  } = req.body;

  // Create reconciliation run record
  const run = await ReconciliationRun.create({
    status: 'RUNNING',
    initiated_by: req.user._id,
    config: {
      date_window_hours,
      amount_tolerance,
      include_merchants,
      exclude_merchants,
      date_range: { start: start_date, end: end_date }
    }
  });

  try {
    // Build query for transactions
    const baseQuery = {
      reconciliation_status: RECONCILIATION_STATUS.PENDING
    };

    if (start_date || end_date) {
      baseQuery.transaction_date = {};
      if (start_date) baseQuery.transaction_date.$gte = new Date(start_date);
      if (end_date) baseQuery.transaction_date.$lte = new Date(end_date);
    }

    if (include_merchants.length > 0) {
      baseQuery.merchant_id = { $in: include_merchants.map(m => m.toUpperCase()) };
    }

    if (exclude_merchants.length > 0) {
      baseQuery.merchant_id = { ...baseQuery.merchant_id, $nin: exclude_merchants.map(m => m.toUpperCase()) };
    }

    // Get all pending bank transactions
    const bankTransactions = await Transaction.find({
      ...baseQuery,
      source: 'BANK'
    }).lean();

    // Get all pending merchant transactions
    const merchantTransactions = await Transaction.find({
      ...baseQuery,
      source: 'MERCHANT'
    }).lean();

    run.summary.total_bank_transactions = bankTransactions.length;
    run.summary.total_merchant_transactions = merchantTransactions.length;

    // Create index maps for faster matching
    const merchantTxnMap = new Map();
    merchantTransactions.forEach(txn => {
      const key = `${txn.transaction_id}-${txn.merchant_id}-${txn.amount}`;
      if (!merchantTxnMap.has(key)) {
        merchantTxnMap.set(key, []);
      }
      merchantTxnMap.get(key).push(txn);
    });

    const matchedBankIds = new Set();
    const matchedMerchantIds = new Set();
    const merchantSummary = new Map();

    // Process bank transactions
    for (const bankTxn of bankTransactions) {
      // Exact match
      const exactKey = `${bankTxn.transaction_id}-${bankTxn.merchant_id}-${bankTxn.amount}`;
      const exactMatches = merchantTxnMap.get(exactKey) || [];

      // Check date window
      const validMatches = exactMatches.filter(mTxn => {
        if (matchedMerchantIds.has(mTxn._id.toString())) return false;
        
        const bankDate = new Date(bankTxn.transaction_date);
        const merchantDate = new Date(mTxn.transaction_date);
        const hoursDiff = Math.abs(bankDate - merchantDate) / (1000 * 60 * 60);
        return hoursDiff <= date_window_hours;
      });

      if (validMatches.length > 0) {
        // Matched
        const matchedMerchant = validMatches[0];
        
        await Transaction.updateOne(
          { _id: bankTxn._id },
          {
            reconciliation_status: RECONCILIATION_STATUS.MATCHED,
            reconciled_with: matchedMerchant._id,
            reconciliation_date: new Date(),
            reconciliation_run_id: run._id
          }
        );

        await Transaction.updateOne(
          { _id: matchedMerchant._id },
          {
            reconciliation_status: RECONCILIATION_STATUS.MATCHED,
            reconciled_with: bankTxn._id,
            reconciliation_date: new Date(),
            reconciliation_run_id: run._id
          }
        );

        matchedBankIds.add(bankTxn._id.toString());
        matchedMerchantIds.add(matchedMerchant._id.toString());
        run.summary.matched++;
        run.amounts.total_matched_amount += bankTxn.amount;

        // Update merchant summary
        if (!merchantSummary.has(bankTxn.merchant_id)) {
          merchantSummary.set(bankTxn.merchant_id, { matched: 0, unmatched: 0, mismatches: 0, total_amount: 0 });
        }
        merchantSummary.get(bankTxn.merchant_id).matched++;
        merchantSummary.get(bankTxn.merchant_id).total_amount += bankTxn.amount;

      } else {
        // Check for amount mismatch
        const fuzzyMatches = await Transaction.find({
          source: 'MERCHANT',
          transaction_id: bankTxn.transaction_id,
          merchant_id: bankTxn.merchant_id,
          reconciliation_status: RECONCILIATION_STATUS.PENDING
        });

        if (fuzzyMatches.length > 0) {
          const mismatchTxn = fuzzyMatches[0];
          const amountDiff = Math.abs(bankTxn.amount - mismatchTxn.amount);

          if (amount_tolerance > 0 && amountDiff <= amount_tolerance) {
            // Within tolerance - mark as matched
            await Transaction.updateMany(
              { _id: { $in: [bankTxn._id, mismatchTxn._id] } },
              {
                reconciliation_status: RECONCILIATION_STATUS.MATCHED,
                reconciliation_date: new Date(),
                reconciliation_run_id: run._id
              }
            );
            run.summary.matched++;
          } else {
            // Amount mismatch
            await Transaction.updateOne(
              { _id: bankTxn._id },
              {
                reconciliation_status: RECONCILIATION_STATUS.AMOUNT_MISMATCH,
                is_disputed: true,
                dispute_reason: `Amount mismatch: Bank ${bankTxn.amount} vs Merchant ${mismatchTxn.amount}`,
                dispute_amount: amountDiff,
                reconciliation_run_id: run._id
              }
            );

            await Transaction.updateOne(
              { _id: mismatchTxn._id },
              {
                reconciliation_status: RECONCILIATION_STATUS.AMOUNT_MISMATCH,
                is_disputed: true,
                dispute_reason: `Amount mismatch: Bank ${bankTxn.amount} vs Merchant ${mismatchTxn.amount}`,
                dispute_amount: amountDiff,
                reconciliation_run_id: run._id
              }
            );

            run.summary.amount_mismatch++;
            run.summary.disputes_detected++;
            run.amounts.total_mismatch_difference += amountDiff;

            // Create dispute alert
            await Alert.createAlert({
              type: ALERT_TYPES.DISPUTE_DETECTED,
              severity: 'HIGH',
              title: 'Amount Mismatch Detected',
              message: `Transaction ${bankTxn.transaction_id}: Bank amount ${bankTxn.amount} differs from Merchant amount ${mismatchTxn.amount}`,
              entity_type: 'TRANSACTION',
              entity_id: bankTxn.transaction_id,
              merchant_id: bankTxn.merchant_id,
              transaction_id: bankTxn.transaction_id,
              data: { bank_amount: bankTxn.amount, merchant_amount: mismatchTxn.amount, difference: amountDiff }
            });

            if (!merchantSummary.has(bankTxn.merchant_id)) {
              merchantSummary.set(bankTxn.merchant_id, { matched: 0, unmatched: 0, mismatches: 0, total_amount: 0 });
            }
            merchantSummary.get(bankTxn.merchant_id).mismatches++;
          }

          matchedBankIds.add(bankTxn._id.toString());
          matchedMerchantIds.add(mismatchTxn._id.toString());

        } else {
          // Unmatched bank transaction
          await Transaction.updateOne(
            { _id: bankTxn._id },
            {
              reconciliation_status: RECONCILIATION_STATUS.UNMATCHED_BANK,
              reconciliation_run_id: run._id
            }
          );

          run.summary.unmatched_bank++;
          run.amounts.total_unmatched_bank_amount += bankTxn.amount;

          if (!merchantSummary.has(bankTxn.merchant_id)) {
            merchantSummary.set(bankTxn.merchant_id, { matched: 0, unmatched: 0, mismatches: 0, total_amount: 0 });
          }
          merchantSummary.get(bankTxn.merchant_id).unmatched++;
        }
      }

      // Check for unknown merchant
      const merchant = await Merchant.findOne({ merchant_id: bankTxn.merchant_id });
      if (!merchant) {
        run.summary.unknown_merchants++;
      }
    }

    // Process unmatched merchant transactions
    for (const mTxn of merchantTransactions) {
      if (matchedMerchantIds.has(mTxn._id.toString())) continue;

      await Transaction.updateOne(
        { _id: mTxn._id },
        {
          reconciliation_status: RECONCILIATION_STATUS.UNMATCHED_MERCHANT,
          reconciliation_run_id: run._id
        }
      );

      run.summary.unmatched_merchant++;
      run.amounts.total_unmatched_merchant_amount += mTxn.amount;

      if (!merchantSummary.has(mTxn.merchant_id)) {
        merchantSummary.set(mTxn.merchant_id, { matched: 0, unmatched: 0, mismatches: 0, total_amount: 0 });
      }
      merchantSummary.get(mTxn.merchant_id).unmatched++;
    }

    // Check for SLA breaches
    const slaBreachedTransactions = await Transaction.find({
      reconciliation_run_id: run._id,
      sla_breached: true
    }).countDocuments();
    run.summary.sla_breaches = slaBreachedTransactions;

    // Format merchant summary
    run.merchant_summary = [];
    for (const [merchant_id, stats] of merchantSummary) {
      const merchant = await Merchant.findOne({ merchant_id });
      run.merchant_summary.push({
        merchant_id,
        merchant_name: merchant?.name || 'Unknown',
        ...stats
      });
    }

    // Complete the run
    run.status = 'COMPLETED';
    run.completed_at = new Date();
    run.duration_ms = Date.now() - run.started_at.getTime();
    await run.save();

    // Log action
    await logAction(req.user, AUDIT_ACTIONS.RECONCILIATION_RUN, 'RECONCILIATION', {
      entity_id: run._id.toString(),
      entity_name: run.run_id,
      extra: run.summary,
      ip_address: req.ip
    });

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('reconciliation:complete', {
        run_id: run.run_id,
        summary: run.summary
      });
    }

    // Create completion alert
    await Alert.createAlert({
      type: ALERT_TYPES.RECONCILIATION_COMPLETE,
      severity: 'LOW',
      title: 'Reconciliation Completed',
      message: `Reconciliation run ${run.run_id} completed. Matched: ${run.summary.matched}, Unmatched: ${run.summary.unmatched_bank + run.summary.unmatched_merchant}`,
      entity_type: 'RECONCILIATION',
      entity_id: run.run_id,
      data: run.summary
    });

    res.status(200).json({
      success: true,
      message: 'Reconciliation completed successfully',
      data: { run }
    });

  } catch (error) {
    run.status = 'FAILED';
    run.errors.push({ message: error.message, timestamp: new Date() });
    await run.save();
    throw error;
  }
});

// @desc    Get reconciliation runs
// @route   GET /api/reconciliation/runs
// @access  Private
const getReconciliationRuns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = {};
  if (status) query.status = status;

  const total = await ReconciliationRun.countDocuments(query);
  const runs = await ReconciliationRun.find(query)
    .populate('initiated_by', 'name email')
    .sort('-started_at')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      runs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get reconciliation run details
// @route   GET /api/reconciliation/runs/:id
// @access  Private
const getReconciliationRun = asyncHandler(async (req, res) => {
  const run = await ReconciliationRun.findById(req.params.id)
    .populate('initiated_by', 'name email');

  if (!run) {
    throw new AppError('Reconciliation run not found', 404);
  }

  // Get transactions from this run
  const transactions = await Transaction.find({ reconciliation_run_id: run._id })
    .select('transaction_id merchant_id amount status reconciliation_status source')
    .limit(100);

  res.status(200).json({
    success: true,
    data: { run, transactions }
  });
});

// @desc    Get reconciliation statistics
// @route   GET /api/reconciliation/stats
// @access  Private
const getReconciliationStats = asyncHandler(async (req, res) => {
  const stats = await Transaction.aggregate([
    {
      $group: {
        _id: '$reconciliation_status',
        count: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    }
  ]);

  const latestRuns = await ReconciliationRun.find({ status: 'COMPLETED' })
    .select('run_id started_at summary matchRate')
    .sort('-started_at')
    .limit(5);

  const overallStats = {
    total_transactions: 0,
    matched: 0,
    unmatched: 0,
    pending: 0,
    disputes: 0
  };

  stats.forEach(s => {
    overallStats.total_transactions += s.count;
    if (s._id === 'MATCHED') overallStats.matched = s.count;
    if (s._id === 'PENDING') overallStats.pending = s.count;
    if (['UNMATCHED_BANK', 'UNMATCHED_MERCHANT'].includes(s._id)) {
      overallStats.unmatched += s.count;
    }
    if (s._id === 'AMOUNT_MISMATCH') overallStats.disputes = s.count;
  });

  res.status(200).json({
    success: true,
    data: {
      summary: overallStats,
      byStatus: stats,
      latestRuns
    }
  });
});

// @desc    Get unmatched transactions
// @route   GET /api/reconciliation/unmatched
// @access  Private
const getUnmatchedTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, source, merchant_id } = req.query;

  const query = {
    reconciliation_status: { $in: [RECONCILIATION_STATUS.UNMATCHED_BANK, RECONCILIATION_STATUS.UNMATCHED_MERCHANT] }
  };

  if (source) query.source = source;
  if (merchant_id) query.merchant_id = merchant_id;

  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .populate('merchant', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

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

// @desc    Get disputes
// @route   GET /api/reconciliation/disputes
// @access  Private
const getDisputes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, resolved, merchant_id } = req.query;

  const query = { is_disputed: true };
  if (resolved === 'true') query.dispute_resolved = true;
  if (resolved === 'false') query.dispute_resolved = false;
  if (merchant_id) query.merchant_id = merchant_id;

  const total = await Transaction.countDocuments(query);
  const disputes = await Transaction.find(query)
    .populate('merchant', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      disputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Resolve dispute
// @route   PUT /api/reconciliation/disputes/:id/resolve
// @access  Private
const resolveDispute = asyncHandler(async (req, res) => {
  const { resolution, new_status } = req.body;

  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  if (!transaction.is_disputed) {
    throw new AppError('Transaction is not disputed', 400);
  }

  transaction.dispute_resolved = true;
  transaction.dispute_resolution = resolution;
  transaction.updated_by = req.user._id;

  if (new_status) {
    transaction.reconciliation_status = new_status;
  }

  await transaction.save();

  res.status(200).json({
    success: true,
    message: 'Dispute resolved successfully',
    data: { transaction }
  });
});

module.exports = {
  runReconciliation,
  getReconciliationRuns,
  getReconciliationRun,
  getReconciliationStats,
  getUnmatchedTransactions,
  getDisputes,
  resolveDispute
};
