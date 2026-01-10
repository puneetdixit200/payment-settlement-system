const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Transaction, Merchant, ReconciliationRun } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');

// Directory for saving exported files
const EXPORT_DIR = path.join(__dirname, '..', '..', '..', 'test_files', 'exports');

// Ensure export directory exists
const ensureExportDir = () => {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
};

// Save file to disk and return filename
const saveExportFile = (filename, content, isBinary = false) => {
  ensureExportDir();
  const filepath = path.join(EXPORT_DIR, filename);
  if (isBinary) {
    fs.writeFileSync(filepath, content);
  } else {
    fs.writeFileSync(filepath, content, 'utf-8');
  }
  return filepath;
};

// @desc    Export settlements data
// @route   GET /api/export/settlements
// @access  Private
const exportSettlements = asyncHandler(async (req, res) => {
  const { format = 'json', start_date, end_date, merchant_id } = req.query;

  const query = { settlement_time: { $exists: true } };
  if (start_date || end_date) {
    query.settlement_time = { ...query.settlement_time };
    if (start_date) query.settlement_time.$gte = new Date(start_date);
    if (end_date) query.settlement_time.$lte = new Date(end_date);
  }
  if (merchant_id) query.merchant_id = merchant_id;

  const settlements = await Transaction.find(query)
    .populate('merchant', 'name email')
    .sort('-settlement_time')
    .lean();

  // Log export action
  await logAction(req.user, AUDIT_ACTIONS.EXPORT_DATA, 'TRANSACTION', {
    extra: { export_type: 'settlements', format, count: settlements.length },
    ip_address: req.ip
  });

  if (format === 'csv') {
    const headers = ['Transaction ID', 'Merchant ID', 'Merchant Name', 'Amount', 'Currency', 'Status', 'Settlement Time', 'SLA Breached'];
    const rows = settlements.map(s => [
      s.transaction_id,
      s.merchant_id,
      s.merchant?.name || '',
      s.amount,
      s.currency,
      s.status,
      new Date(s.settlement_time).toISOString(),
      s.sla_breached ? 'Yes' : 'No'
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    // Save to test_files/exports folder
    const filename = `settlements_${Date.now()}.csv`;
    saveExportFile(filename, csv);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(csv);
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=settlements_${Date.now()}.pdf`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Settlement Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
    const slaBreaches = settlements.filter(s => s.sla_breached).length;

    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Settlements: ${settlements.length}`);
    doc.text(`Total Amount: INR ${totalAmount.toLocaleString()}`);
    doc.text(`SLA Breaches: ${slaBreaches}`);
    doc.moveDown(2);

    // Table headers
    doc.fontSize(12).text('Settlement Details', { underline: true });
    doc.moveDown();
    doc.fontSize(8);

    // Simple table
    const tableTop = doc.y;
    settlements.slice(0, 50).forEach((s, i) => {
      const y = tableTop + (i * 20);
      if (y > 700) return; // Page limit

      doc.text(s.transaction_id, 50, y, { width: 100 });
      doc.text(s.merchant?.name || s.merchant_id, 150, y, { width: 120 });
      doc.text(`${s.currency} ${s.amount}`, 270, y, { width: 80 });
      doc.text(s.status, 350, y, { width: 60 });
      doc.text(s.sla_breached ? 'BREACH' : 'OK', 410, y, { width: 60 });
    });

    doc.end();
    return;
  }

  // JSON format
  res.status(200).json({
    success: true,
    data: {
      settlements,
      total: settlements.length,
      summary: {
        total_amount: settlements.reduce((sum, s) => sum + s.amount, 0),
        sla_breaches: settlements.filter(s => s.sla_breached).length
      },
      exported_at: new Date()
    }
  });
});

// @desc    Export transactions data
// @route   GET /api/export/transactions
// @access  Private
const exportTransactions = asyncHandler(async (req, res) => {
  const {
    format = 'json',
    start_date,
    end_date,
    merchant_id,
    status,
    reconciliation_status
  } = req.query;

  const query = {};
  if (start_date || end_date) {
    query.transaction_date = {};
    if (start_date) query.transaction_date.$gte = new Date(start_date);
    if (end_date) query.transaction_date.$lte = new Date(end_date);
  }
  if (merchant_id) query.merchant_id = merchant_id;
  if (status) query.status = status;
  if (reconciliation_status) query.reconciliation_status = reconciliation_status;

  const transactions = await Transaction.find(query)
    .populate('merchant', 'name email')
    .sort('-transaction_date')
    .limit(10000)
    .lean();

  await logAction(req.user, AUDIT_ACTIONS.EXPORT_DATA, 'TRANSACTION', {
    extra: { export_type: 'transactions', format, count: transactions.length },
    ip_address: req.ip
  });

  if (format === 'csv') {
    const headers = [
      'Transaction ID', 'Merchant ID', 'Amount', 'Currency', 'Status',
      'Source', 'Payment Gateway', 'Reconciliation Status', 'Transaction Date'
    ];
    const rows = transactions.map(t => [
      t.transaction_id,
      t.merchant_id,
      t.amount,
      t.currency,
      t.status,
      t.source,
      t.payment_gateway,
      t.reconciliation_status,
      new Date(t.transaction_date).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    // Save to test_files/exports folder
    const filename = `transactions_${Date.now()}.csv`;
    saveExportFile(filename, csv);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(csv);
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text('Transaction Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`Total Records: ${transactions.length}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(8);
    const tableTop = doc.y;
    transactions.slice(0, 40).forEach((t, i) => {
      const y = tableTop + (i * 15);
      if (y > 500) return;

      doc.text(t.transaction_id, 30, y, { width: 120 });
      doc.text(t.merchant_id, 150, y, { width: 80 });
      doc.text(t.amount.toString(), 230, y, { width: 60 });
      doc.text(t.status, 290, y, { width: 60 });
      doc.text(t.source, 350, y, { width: 60 });
      doc.text(t.reconciliation_status, 410, y, { width: 100 });
    });

    doc.end();
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      transactions,
      total: transactions.length,
      exported_at: new Date()
    }
  });
});

// @desc    Export merchant summaries
// @route   GET /api/export/merchants
// @access  Private
const exportMerchants = asyncHandler(async (req, res) => {
  const { format = 'json', status, payment_gateway } = req.query;

  const query = {};
  if (status) query.status = status;
  if (payment_gateway) query.payment_gateway = payment_gateway;

  const merchants = await Merchant.find(query).lean();

  // Get transaction stats for each merchant
  const merchantsWithStats = await Promise.all(merchants.map(async (merchant) => {
    const stats = await Transaction.aggregate([
      { $match: { merchant_id: merchant.merchant_id } },
      {
        $group: {
          _id: null,
          total_transactions: { $sum: 1 },
          total_amount: { $sum: '$amount' },
          success_count: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
          failed_count: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          matched_count: { $sum: { $cond: [{ $eq: ['$reconciliation_status', 'MATCHED'] }, 1, 0] } }
        }
      }
    ]);

    return {
      ...merchant,
      transaction_stats: stats[0] || {
        total_transactions: 0,
        total_amount: 0,
        success_count: 0,
        failed_count: 0,
        matched_count: 0
      }
    };
  }));

  await logAction(req.user, AUDIT_ACTIONS.EXPORT_DATA, 'MERCHANT', {
    extra: { export_type: 'merchants', format, count: merchantsWithStats.length },
    ip_address: req.ip
  });

  if (format === 'csv') {
    const headers = [
      'Merchant ID', 'Name', 'Email', 'Status', 'Settlement Cycle',
      'Payment Gateway', 'SLA Hours', 'Total Transactions', 'Total Amount', 'Success Rate'
    ];
    const rows = merchantsWithStats.map(m => {
      const successRate = m.transaction_stats.total_transactions > 0
        ? ((m.transaction_stats.success_count / m.transaction_stats.total_transactions) * 100).toFixed(2)
        : 0;
      return [
        m.merchant_id,
        m.name,
        m.email,
        m.status,
        m.settlement_cycle,
        m.payment_gateway,
        m.sla_hours,
        m.transaction_stats.total_transactions,
        m.transaction_stats.total_amount,
        `${successRate}%`
      ];
    });

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    // Save to test_files/exports folder
    const filename = `merchants_${Date.now()}.csv`;
    saveExportFile(filename, csv);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(csv);
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=merchants_${Date.now()}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text('Merchant Summary Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    merchantsWithStats.slice(0, 20).forEach((m, i) => {
      if (doc.y > 700) doc.addPage();
      
      doc.fontSize(12).text(m.name, { underline: true });
      doc.fontSize(10);
      doc.text(`ID: ${m.merchant_id}`);
      doc.text(`Email: ${m.email}`);
      doc.text(`Status: ${m.status} | Gateway: ${m.payment_gateway}`);
      doc.text(`Transactions: ${m.transaction_stats.total_transactions} | Amount: INR ${m.transaction_stats.total_amount.toLocaleString()}`);
      doc.moveDown();
    });

    doc.end();
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      merchants: merchantsWithStats,
      total: merchantsWithStats.length,
      exported_at: new Date()
    }
  });
});

module.exports = {
  exportSettlements,
  exportTransactions,
  exportMerchants
};
