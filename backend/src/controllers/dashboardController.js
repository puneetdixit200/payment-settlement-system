const { Transaction, Merchant, ReconciliationRun, Alert } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');

// @desc    Get dashboard summary
// @route   GET /api/dashboard
// @access  Private
const getDashboardSummary = asyncHandler(async (req, res) => {
  // Date ranges
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  // Transaction stats
  const transactionStats = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        successCount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
        failedCount: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        matchedCount: { $sum: { $cond: [{ $eq: ['$reconciliation_status', 'MATCHED'] }, 1, 0] } },
        unmatchedCount: { $sum: { $cond: [{ $in: ['$reconciliation_status', ['UNMATCHED_BANK', 'UNMATCHED_MERCHANT']] }, 1, 0] } },
        slaBreachedCount: { $sum: { $cond: ['$sla_breached', 1, 0] } },
        disputedCount: { $sum: { $cond: ['$is_disputed', 1, 0] } }
      }
    }
  ]);

  // Today's stats
  const todayStats = await Transaction.aggregate([
    { $match: { createdAt: { $gte: today } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    }
  ]);

  // Gateway success rates
  const gatewayStats = await Transaction.aggregate([
    {
      $group: {
        _id: '$payment_gateway',
        total: { $sum: 1 },
        successCount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $project: {
        _id: 1,
        total: 1,
        successCount: 1,
        totalAmount: 1,
        successRate: {
          $multiply: [{ $divide: ['$successCount', { $max: ['$total', 1] }] }, 100]
        }
      }
    }
  ]);

  // Merchant stats
  const merchantCount = await Merchant.countDocuments({ status: 'ACTIVE' });
  
  // Top merchants by transaction volume
  const topMerchants = await Transaction.aggregate([
    { $match: { transaction_date: { $gte: thisMonth } } },
    {
      $group: {
        _id: '$merchant_id',
        transactionCount: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'merchants',
        localField: '_id',
        foreignField: 'merchant_id',
        as: 'merchant'
      }
    },
    { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } }
  ]);

  // Recent reconciliation runs
  const recentRuns = await ReconciliationRun.find({ status: 'COMPLETED' })
    .select('run_id started_at summary matchRate')
    .sort('-started_at')
    .limit(5);

  // Unread alerts count
  const unreadAlerts = await Alert.countDocuments({ status: 'NEW' });

  // Transactions by day (last 7 days)
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  const dailyTransactions = await Transaction.aggregate([
    { $match: { transaction_date: { $gte: last7Days } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$transaction_date' } },
        count: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      transactions: transactionStats[0] || {
        total: 0,
        totalAmount: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        slaBreachedCount: 0,
        disputedCount: 0
      },
      today: todayStats[0] || { total: 0, amount: 0 },
      gatewayStats,
      merchantCount,
      topMerchants,
      recentRuns,
      unreadAlerts,
      dailyTransactions
    }
  });
});

// @desc    Get SLA dashboard
// @route   GET /api/dashboard/sla
// @access  Private
const getSLADashboard = asyncHandler(async (req, res) => {
  // SLA breach summary
  const slaSummary = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        breached: { $sum: { $cond: ['$sla_breached', 1, 0] } },
        avgSettlementHours: {
          $avg: {
            $cond: [
              { $and: ['$settlement_time', '$createdAt'] },
              { $divide: [{ $subtract: ['$settlement_time', '$createdAt'] }, 3600000] },
              null
            ]
          }
        }
      }
    }
  ]);

  // SLA breaches by merchant
  const breachesByMerchant = await Transaction.aggregate([
    { $match: { sla_breached: true } },
    {
      $group: {
        _id: '$merchant_id',
        breachCount: { $sum: 1 },
        avgBreachHours: { $avg: '$sla_breach_hours' }
      }
    },
    { $sort: { breachCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'merchants',
        localField: '_id',
        foreignField: 'merchant_id',
        as: 'merchant'
      }
    },
    { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } }
  ]);

  // Recent SLA breaches
  const recentBreaches = await Transaction.find({ sla_breached: true })
    .select('transaction_id merchant_id amount sla_breach_hours createdAt')
    .sort('-createdAt')
    .limit(10);

  // Pending transactions at risk (approaching SLA)
  const pendingTransactions = await Transaction.find({
    status: 'PENDING',
    sla_breached: false,
    sla_hours: { $exists: true }
  }).select('transaction_id merchant_id amount sla_hours createdAt');

  const atRisk = pendingTransactions.filter(txn => {
    const hours = (Date.now() - txn.createdAt.getTime()) / 3600000;
    return hours > (txn.sla_hours * 0.8); // 80% of SLA time elapsed
  });

  res.status(200).json({
    success: true,
    data: {
      summary: slaSummary[0] || { total: 0, breached: 0, avgSettlementHours: 0 },
      breachesByMerchant,
      recentBreaches,
      atRiskCount: atRisk.length,
      atRiskTransactions: atRisk.slice(0, 10)
    }
  });
});

module.exports = {
  getDashboardSummary,
  getSLADashboard
};
