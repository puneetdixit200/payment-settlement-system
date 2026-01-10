const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { Transaction, Merchant, FileUpload } = require('../models');
const { asyncHandler, AppError } = require('../middleware');
const { logAction, AUDIT_ACTIONS } = require('../middleware/auditMiddleware');
const { TRANSACTION_STATUS, TRANSACTION_SOURCE, PAYMENT_GATEWAY, RECONCILIATION_STATUS } = require('../config/constants');

// Standard column mappings for bank and merchant files
const COLUMN_MAPPINGS = {
  bank: {
    transaction_id: ['transaction_id', 'txn_id', 'txnid', 'trans_id', 'id'],
    merchant_id: ['merchant_id', 'merchid', 'mid', 'merchant'],
    amount: ['amount', 'amt', 'value', 'transaction_amount'],
    currency: ['currency', 'curr', 'ccy'],
    status: ['status', 'txn_status', 'transaction_status'],
    reference_id: ['reference_id', 'ref_id', 'utr', 'utr_number', 'bank_ref'],
    transaction_date: ['transaction_date', 'txn_date', 'date', 'created_at', 'timestamp']
  },
  merchant: {
    transaction_id: ['transaction_id', 'txn_id', 'order_id', 'payment_id'],
    merchant_id: ['merchant_id', 'store_id', 'shop_id'],
    amount: ['amount', 'total', 'payment_amount', 'order_amount'],
    currency: ['currency', 'curr'],
    status: ['status', 'payment_status', 'order_status'],
    reference_id: ['reference_id', 'gateway_ref', 'pg_ref'],
    transaction_date: ['transaction_date', 'payment_date', 'order_date', 'created_at'],
    customer_email: ['customer_email', 'email', 'buyer_email'],
    customer_name: ['customer_name', 'name', 'buyer_name']
  }
};

// Parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Parse Excel file
const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

// Map columns based on standard mappings
const mapColumns = (row, fileType) => {
  const mappings = COLUMN_MAPPINGS[fileType];
  const mapped = {};

  for (const [targetField, possibleNames] of Object.entries(mappings)) {
    for (const name of possibleNames) {
      const key = Object.keys(row).find(k => k.toLowerCase().trim() === name.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== '') {
        mapped[targetField] = row[key];
        break;
      }
    }
  }

  return mapped;
};

// Normalize and validate row
const normalizeRow = (row, fileType, merchant_id = null) => {
  const mapped = mapColumns(row, fileType);
  const errors = [];

  // Required fields
  if (!mapped.transaction_id) {
    errors.push('Missing transaction_id');
  }
  if (!mapped.amount && mapped.amount !== 0) {
    errors.push('Missing amount');
  }

  // Normalize values
  const normalized = {
    transaction_id: mapped.transaction_id ? String(mapped.transaction_id).toUpperCase().trim() : null,
    merchant_id: (mapped.merchant_id || merchant_id || '').toUpperCase().trim(),
    amount: parseFloat(mapped.amount) || 0,
    currency: (mapped.currency || 'INR').toUpperCase().trim(),
    status: normalizeStatus(mapped.status),
    reference_id: mapped.reference_id ? String(mapped.reference_id).trim() : null,
    transaction_date: parseDate(mapped.transaction_date),
    customer_email: mapped.customer_email || null,
    customer_name: mapped.customer_name || null,
    source: fileType === 'bank' ? TRANSACTION_SOURCE.BANK : TRANSACTION_SOURCE.MERCHANT,
    payment_gateway: fileType === 'bank' ? PAYMENT_GATEWAY.BANK : PAYMENT_GATEWAY.RAZORPAY
  };

  return { normalized, errors };
};

// Normalize status string
const normalizeStatus = (status) => {
  if (!status) return TRANSACTION_STATUS.PENDING;
  
  const s = String(status).toUpperCase().trim();
  
  if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID', 'CAPTURED'].includes(s)) {
    return TRANSACTION_STATUS.SUCCESS;
  }
  if (['FAILED', 'FAILURE', 'DECLINED', 'REJECTED', 'CANCELLED'].includes(s)) {
    return TRANSACTION_STATUS.FAILED;
  }
  return TRANSACTION_STATUS.PENDING;
};

// Parse date from various formats
const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try DD/MM/YYYY format
  const parts = String(dateStr).split(/[\/\-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

// @desc    Upload bank file
// @route   POST /api/upload/bank
// @access  Private
const uploadBankFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload a file', 400);
  }

  const fileRecord = await FileUpload.create({
    filename: req.file.filename,
    original_filename: req.file.originalname,
    file_type: 'BANK',
    mime_type: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
    status: 'PROCESSING',
    uploaded_by: req.user._id,
    processing: { started_at: new Date() }
  });

  try {
    // Parse file based on extension
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows;

    if (ext === '.csv') {
      rows = await parseCSV(req.file.path);
    } else if (['.xlsx', '.xls'].includes(ext)) {
      rows = parseExcel(req.file.path);
    } else {
      throw new AppError('Unsupported file format. Please use CSV or Excel.', 400);
    }

    fileRecord.results.total_rows = rows.length;

    const transactions = [];
    const errors = [];
    const existingTxnIds = new Set();

    // Check for existing transactions
    const allTxnIds = rows
      .map(row => mapColumns(row, 'bank').transaction_id)
      .filter(Boolean)
      .map(id => String(id).toUpperCase().trim());

    const existing = await Transaction.find({
      transaction_id: { $in: allTxnIds },
      source: TRANSACTION_SOURCE.BANK
    }).select('transaction_id');

    existing.forEach(t => existingTxnIds.add(t.transaction_id));

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const { normalized, errors: rowErrors } = normalizeRow(rows[i], 'bank');

      if (rowErrors.length > 0) {
        errors.push({ row: i + 2, field: 'validation', message: rowErrors.join(', '), data: rows[i] });
        fileRecord.results.failed_rows++;
        continue;
      }

      if (existingTxnIds.has(normalized.transaction_id)) {
        errors.push({ row: i + 2, field: 'transaction_id', message: 'Duplicate transaction', data: rows[i] });
        fileRecord.results.duplicate_rows++;
        continue;
      }

      // Check merchant
      const merchant = await Merchant.findOne({ merchant_id: normalized.merchant_id });

      transactions.push({
        ...normalized,
        merchant: merchant?._id,
        uploaded_from_file: fileRecord._id,
        file_row_number: i + 2,
        created_by: req.user._id,
        reconciliation_status: RECONCILIATION_STATUS.PENDING
      });

      existingTxnIds.add(normalized.transaction_id);
      fileRecord.results.successful_rows++;
    }

    // Bulk insert transactions
    if (transactions.length > 0) {
      await Transaction.insertMany(transactions, { ordered: false });
    }

    // Update file record
    fileRecord.status = errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
    fileRecord.errors = errors.slice(0, 100); // Limit errors stored
    fileRecord.processing.completed_at = new Date();
    fileRecord.processing.duration_ms = Date.now() - fileRecord.processing.started_at.getTime();
    fileRecord.results.processed_rows = rows.length;
    await fileRecord.save();

    // Log action
    await logAction(req.user, AUDIT_ACTIONS.FILE_UPLOAD, 'FILE', {
      entity_id: fileRecord._id.toString(),
      entity_name: req.file.originalname,
      extra: {
        file_type: 'BANK',
        total_rows: rows.length,
        successful: transactions.length,
        failed: errors.length
      },
      ip_address: req.ip
    });

    res.status(200).json({
      success: true,
      message: `File processed: ${transactions.length} transactions imported, ${errors.length} errors`,
      data: {
        file: fileRecord,
        summary: {
          total: rows.length,
          imported: transactions.length,
          failed: fileRecord.results.failed_rows,
          duplicates: fileRecord.results.duplicate_rows
        },
        errors: errors.slice(0, 20)
      }
    });

  } catch (error) {
    fileRecord.status = 'FAILED';
    fileRecord.errors.push({ message: error.message });
    await fileRecord.save();
    throw error;
  }
});

// @desc    Upload merchant files
// @route   POST /api/upload/merchant
// @access  Private
const uploadMerchantFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('Please upload at least one file', 400);
  }

  const results = [];

  for (const file of req.files) {
    const fileRecord = await FileUpload.create({
      filename: file.filename,
      original_filename: file.originalname,
      file_type: 'MERCHANT',
      mime_type: file.mimetype,
      size: file.size,
      path: file.path,
      status: 'PROCESSING',
      merchant_id: req.body.merchant_id,
      uploaded_by: req.user._id,
      processing: { started_at: new Date() }
    });

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      let rows;

      if (ext === '.csv') {
        rows = await parseCSV(file.path);
      } else if (['.xlsx', '.xls'].includes(ext)) {
        rows = parseExcel(file.path);
      } else {
        throw new AppError(`Unsupported file format: ${file.originalname}`, 400);
      }

      fileRecord.results.total_rows = rows.length;

      const transactions = [];
      const errors = [];
      const existingTxnIds = new Set();

      const allTxnIds = rows
        .map(row => mapColumns(row, 'merchant').transaction_id)
        .filter(Boolean)
        .map(id => String(id).toUpperCase().trim());

      const existing = await Transaction.find({
        transaction_id: { $in: allTxnIds },
        source: TRANSACTION_SOURCE.MERCHANT
      }).select('transaction_id');

      existing.forEach(t => existingTxnIds.add(t.transaction_id));

      for (let i = 0; i < rows.length; i++) {
        const { normalized, errors: rowErrors } = normalizeRow(rows[i], 'merchant', req.body.merchant_id);

        if (rowErrors.length > 0) {
          errors.push({ row: i + 2, field: 'validation', message: rowErrors.join(', ') });
          fileRecord.results.failed_rows++;
          continue;
        }

        if (existingTxnIds.has(normalized.transaction_id)) {
          errors.push({ row: i + 2, field: 'transaction_id', message: 'Duplicate transaction' });
          fileRecord.results.duplicate_rows++;
          continue;
        }

        const merchant = await Merchant.findOne({ merchant_id: normalized.merchant_id });

        transactions.push({
          ...normalized,
          merchant: merchant?._id,
          uploaded_from_file: fileRecord._id,
          file_row_number: i + 2,
          created_by: req.user._id,
          reconciliation_status: RECONCILIATION_STATUS.PENDING
        });

        existingTxnIds.add(normalized.transaction_id);
        fileRecord.results.successful_rows++;
      }

      if (transactions.length > 0) {
        await Transaction.insertMany(transactions, { ordered: false });
      }

      fileRecord.status = errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
      fileRecord.errors = errors.slice(0, 100);
      fileRecord.processing.completed_at = new Date();
      fileRecord.processing.duration_ms = Date.now() - fileRecord.processing.started_at.getTime();
      fileRecord.results.processed_rows = rows.length;
      await fileRecord.save();

      results.push({
        filename: file.originalname,
        status: fileRecord.status,
        total: rows.length,
        imported: transactions.length,
        errors: errors.length
      });

    } catch (error) {
      fileRecord.status = 'FAILED';
      fileRecord.errors.push({ message: error.message });
      await fileRecord.save();
      
      results.push({
        filename: file.originalname,
        status: 'FAILED',
        error: error.message
      });
    }
  }

  // Log action
  await logAction(req.user, AUDIT_ACTIONS.FILE_UPLOAD, 'FILE', {
    extra: { file_type: 'MERCHANT', files_count: req.files.length, results },
    ip_address: req.ip
  });

  res.status(200).json({
    success: true,
    message: `${req.files.length} files processed`,
    data: { results }
  });
});

// @desc    Get file uploads
// @route   GET /api/upload/files
// @access  Private
const getFileUploads = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, file_type, status } = req.query;

  const query = {};
  if (file_type) query.file_type = file_type;
  if (status) query.status = status;

  const total = await FileUpload.countDocuments(query);
  const files = await FileUpload.find(query)
    .populate('uploaded_by', 'name email')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get file details with errors
// @route   GET /api/upload/files/:id
// @access  Private
const getFileDetails = asyncHandler(async (req, res) => {
  const file = await FileUpload.findById(req.params.id)
    .populate('uploaded_by', 'name email')
    .populate('merchant', 'name merchant_id');

  if (!file) {
    throw new AppError('File not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { file }
  });
});

module.exports = {
  uploadBankFile,
  uploadMerchantFiles,
  getFileUploads,
  getFileDetails
};
