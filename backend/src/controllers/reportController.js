const PDFDocument = require('pdfkit');
const { Transaction, Merchant, ReconciliationRun } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');

// @desc    Generate daily report
// @route   GET /api/reports/daily
// @access  Private
const generateDailyReport = asyncHandler(async (req, res) => {
  const { date, format = 'json' } = req.query;

  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const transactions = await Transaction.find({
    transaction_date: { $gte: startOfDay, $lte: endOfDay }
  }).lean();

  const summary = {
    date: startOfDay.toISOString().split('T')[0],
    total_transactions: transactions.length,
    total_amount: transactions.reduce((sum, t) => sum + t.amount, 0),
    by_status: {},
    by_source: {},
    by_gateway: {},
    by_reconciliation: {}
  };

  transactions.forEach(t => {
    summary.by_status[t.status] = (summary.by_status[t.status] || 0) + 1;
    summary.by_source[t.source] = (summary.by_source[t.source] || 0) + 1;
    summary.by_gateway[t.payment_gateway] = (summary.by_gateway[t.payment_gateway] || 0) + 1;
    summary.by_reconciliation[t.reconciliation_status] = (summary.by_reconciliation[t.reconciliation_status] || 0) + 1;
  });

  await logAction(req.user, AUDIT_ACTIONS.REPORT_GENERATE, 'REPORT', {
    extra: { report_type: 'daily', date: summary.date, format },
    ip_address: req.ip
  });

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=daily_report_${summary.date}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('Daily Transaction Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Date: ${summary.date}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Transactions: ${summary.total_transactions}`);
    doc.text(`Total Amount: INR ${summary.total_amount.toLocaleString()}`);
    doc.moveDown();

    doc.text('By Status:', { underline: true });
    Object.entries(summary.by_status).forEach(([status, count]) => {
      doc.text(`  ${status}: ${count}`);
    });
    doc.moveDown();

    doc.text('By Source:', { underline: true });
    Object.entries(summary.by_source).forEach(([source, count]) => {
      doc.text(`  ${source}: ${count}`);
    });
    doc.moveDown();

    doc.text('By Reconciliation Status:', { underline: true });
    Object.entries(summary.by_reconciliation).forEach(([status, count]) => {
      doc.text(`  ${status}: ${count}`);
    });

    doc.end();
    return;
  }

  res.status(200).json({
    success: true,
    data: summary
  });
});

// @desc    Generate merchant-wise settlements report
// @route   GET /api/reports/merchant-settlements
// @access  Private
const generateMerchantSettlements = asyncHandler(async (req, res) => {
  const { start_date, end_date, format = 'json' } = req.query;

  const matchStage = {};
  if (start_date || end_date) {
    matchStage.transaction_date = {};
    if (start_date) matchStage.transaction_date.$gte = new Date(start_date);
    if (end_date) matchStage.transaction_date.$lte = new Date(end_date);
  }

  const settlements = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$merchant_id',
        total_transactions: { $sum: 1 },
        total_amount: { $sum: '$amount' },
        success_count: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
        success_amount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
        failed_count: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        matched_count: { $sum: { $cond: [{ $eq: ['$reconciliation_status', 'MATCHED'] }, 1, 0] } },
        sla_breached_count: { $sum: { $cond: ['$sla_breached', 1, 0] } }
      }
    },
    { $sort: { total_amount: -1 } },
    {
      $lookup: {
        from: 'merchants',
        localField: '_id',
        foreignField: 'merchant_id',
        as: 'merchant_info'
      }
    },
    { $unwind: { path: '$merchant_info', preserveNullAndEmptyArrays: true } }
  ]);

  const report = settlements.map(s => ({
    merchant_id: s._id,
    merchant_name: s.merchant_info?.name || 'Unknown',
    total_transactions: s.total_transactions,
    total_amount: s.total_amount,
    success_count: s.success_count,
    success_amount: s.success_amount,
    success_rate: ((s.success_count / s.total_transactions) * 100).toFixed(2),
    failed_count: s.failed_count,
    matched_count: s.matched_count,
    match_rate: ((s.matched_count / s.total_transactions) * 100).toFixed(2),
    sla_breached_count: s.sla_breached_count
  }));

  if (format === 'csv') {
    const headers = ['Merchant ID', 'Merchant Name', 'Total Txns', 'Total Amount', 'Success Count', 'Success Rate', 'Matched', 'SLA Breaches'];
    const rows = report.map(r => [
      r.merchant_id, r.merchant_name, r.total_transactions, r.total_amount,
      r.success_count, `${r.success_rate}%`, r.matched_count, r.sla_breached_count
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell)}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=merchant_settlements_${Date.now()}.csv`);
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    Generate unmatched transactions report
// @route   GET /api/reports/unmatched
// @access  Private
const generateUnmatchedReport = asyncHandler(async (req, res) => {
  const { format = 'json', merchant_id } = req.query;

  const query = {
    reconciliation_status: { $in: ['UNMATCHED_BANK', 'UNMATCHED_MERCHANT', 'AMOUNT_MISMATCH'] }
  };
  if (merchant_id) query.merchant_id = merchant_id;

  const transactions = await Transaction.find(query)
    .select('transaction_id merchant_id amount status source reconciliation_status transaction_date')
    .sort('-transaction_date')
    .lean();

  const summary = {
    total: transactions.length,
    unmatched_bank: transactions.filter(t => t.reconciliation_status === 'UNMATCHED_BANK').length,
    unmatched_merchant: transactions.filter(t => t.reconciliation_status === 'UNMATCHED_MERCHANT').length,
    amount_mismatch: transactions.filter(t => t.reconciliation_status === 'AMOUNT_MISMATCH').length,
    total_amount: transactions.reduce((sum, t) => sum + t.amount, 0)
  };

  if (format === 'csv') {
    const headers = ['Transaction ID', 'Merchant ID', 'Amount', 'Status', 'Source', 'Reconciliation Status', 'Date'];
    const rows = transactions.map(t => [
      t.transaction_id, t.merchant_id, t.amount, t.status, t.source, t.reconciliation_status,
      new Date(t.transaction_date).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell)}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=unmatched_transactions_${Date.now()}.csv`);
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data: { summary, transactions: transactions.slice(0, 100) }
  });
});

// @desc    Generate SLA breach report
// @route   GET /api/reports/sla-breaches
// @access  Private
const generateSLABreachReport = asyncHandler(async (req, res) => {
  const { start_date, end_date, format = 'json' } = req.query;

  const matchStage = { sla_breached: true };
  if (start_date || end_date) {
    matchStage.transaction_date = {};
    if (start_date) matchStage.transaction_date.$gte = new Date(start_date);
    if (end_date) matchStage.transaction_date.$lte = new Date(end_date);
  }

  const breaches = await Transaction.find(matchStage)
    .select('transaction_id merchant_id amount sla_hours sla_breach_hours createdAt settlement_time')
    .populate('merchant', 'name')
    .sort('-sla_breach_hours')
    .lean();

  const byMerchant = {};
  breaches.forEach(b => {
    if (!byMerchant[b.merchant_id]) {
      byMerchant[b.merchant_id] = { count: 0, name: b.merchant?.name || 'Unknown' };
    }
    byMerchant[b.merchant_id].count++;
  });

  const summary = {
    total_breaches: breaches.length,
    total_amount: breaches.reduce((sum, b) => sum + b.amount, 0),
    avg_breach_hours: breaches.length > 0
      ? (breaches.reduce((sum, b) => sum + (b.sla_breach_hours || 0), 0) / breaches.length).toFixed(2)
      : 0,
    by_merchant: Object.entries(byMerchant).map(([id, data]) => ({ merchant_id: id, ...data }))
  };

  if (format === 'csv') {
    const headers = ['Transaction ID', 'Merchant ID', 'Merchant Name', 'Amount', 'SLA Hours', 'Breach Hours', 'Created At'];
    const rows = breaches.map(b => [
      b.transaction_id, b.merchant_id, b.merchant?.name || '', b.amount,
      b.sla_hours, b.sla_breach_hours?.toFixed(2), new Date(b.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell)}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sla_breaches_${Date.now()}.csv`);
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data: { summary, breaches: breaches.slice(0, 100) }
  });
});

// @desc    Generate failed payments report
// @route   GET /api/reports/failed-payments
// @access  Private
const generateFailedPaymentsReport = asyncHandler(async (req, res) => {
  const { start_date, end_date, format = 'json' } = req.query;

  const matchStage = { status: 'FAILED' };
  if (start_date || end_date) {
    matchStage.transaction_date = {};
    if (start_date) matchStage.transaction_date.$gte = new Date(start_date);
    if (end_date) matchStage.transaction_date.$lte = new Date(end_date);
  }

  const failed = await Transaction.find(matchStage)
    .select('transaction_id merchant_id amount payment_gateway source transaction_date')
    .populate('merchant', 'name')
    .sort('-transaction_date')
    .lean();

  const byGateway = {};
  const byMerchant = {};
  
  failed.forEach(f => {
    byGateway[f.payment_gateway] = (byGateway[f.payment_gateway] || 0) + 1;
    if (!byMerchant[f.merchant_id]) {
      byMerchant[f.merchant_id] = { count: 0, name: f.merchant?.name || 'Unknown' };
    }
    byMerchant[f.merchant_id].count++;
  });

  const summary = {
    total_failed: failed.length,
    total_amount: failed.reduce((sum, f) => sum + f.amount, 0),
    by_gateway: Object.entries(byGateway).map(([gateway, count]) => ({ gateway, count })),
    by_merchant: Object.entries(byMerchant)
      .map(([id, data]) => ({ merchant_id: id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  };

  res.status(200).json({
    success: true,
    data: { summary, transactions: failed.slice(0, 100) }
  });
});

module.exports = {
  generateDailyReport,
  generateMerchantSettlements,
  generateUnmatchedReport,
  generateSLABreachReport,
  generateFailedPaymentsReport
};
