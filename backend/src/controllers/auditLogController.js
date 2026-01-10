const fs = require('fs');
const path = require('path');
const { AuditLog } = require('../models');
const { asyncHandler, AppError } = require('../middleware');

// Log directory
const LOG_DIR = path.join(__dirname, '../../logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// @desc    Get audit logs from database
// @route   GET /api/audit-logs
// @access  Private
const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    user,
    action,
    entity_type,
    start_date,
    end_date,
    search
  } = req.query;

  const result = await AuditLog.getLogs(
    { user, action, entity_type, startDate: start_date, endDate: end_date, search },
    { page: parseInt(page), limit: parseInt(limit) }
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get single audit log
// @route   GET /api/audit-logs/:id
// @access  Private
const getAuditLog = asyncHandler(async (req, res) => {
  const log = await AuditLog.findById(req.params.id)
    .populate('user', 'name email role');

  if (!log) {
    throw new AppError('Audit log not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { log }
  });
});

// @desc    Get audit log statistics
// @route   GET /api/audit-logs/stats
// @access  Private
const getAuditLogStats = asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  const matchStage = {};
  if (start_date || end_date) {
    matchStage.timestamp = {};
    if (start_date) matchStage.timestamp.$gte = new Date(start_date);
    if (end_date) matchStage.timestamp.$lte = new Date(end_date);
  }

  const byAction = await AuditLog.aggregate([
    { $match: matchStage },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const byUser = await AuditLog.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$user_email',
        count: { $sum: 1 },
        actions: { $addToSet: '$action' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const byEntityType = await AuditLog.aggregate([
    { $match: matchStage },
    { $group: { _id: '$entity_type', count: { $sum: 1 } } }
  ]);

  const byDay = await AuditLog.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 30 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      byAction,
      byUser,
      byEntityType,
      byDay
    }
  });
});

// @desc    Get log files list
// @route   GET /api/audit-logs/files
// @access  Private
const getLogFiles = asyncHandler(async (req, res) => {
  const files = [];

  if (fs.existsSync(LOG_DIR)) {
    const dirContents = fs.readdirSync(LOG_DIR);
    
    for (const file of dirContents) {
      if (file.endsWith('.log') || file.endsWith('.txt')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = fs.statSync(filePath);
        
        files.push({
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
    }
  }

  files.sort((a, b) => new Date(b.modified) - new Date(a.modified));

  res.status(200).json({
    success: true,
    data: { files }
  });
});

// @desc    View log file content
// @route   GET /api/audit-logs/files/:filename
// @access  Private
const viewLogFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const { lines = 100 } = req.query;

  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(LOG_DIR, sanitizedFilename);

  if (!fs.existsSync(filePath)) {
    throw new AppError('Log file not found', 404);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const allLines = content.split('\n').filter(line => line.trim());
  const lastLines = allLines.slice(-parseInt(lines));

  res.status(200).json({
    success: true,
    data: {
      filename: sanitizedFilename,
      totalLines: allLines.length,
      displayedLines: lastLines.length,
      content: lastLines
    }
  });
});

// @desc    Download log file
// @route   GET /api/audit-logs/files/:filename/download
// @access  Private
const downloadLogFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(LOG_DIR, sanitizedFilename);

  if (!fs.existsSync(filePath)) {
    throw new AppError('Log file not found', 404);
  }

  res.download(filePath, sanitizedFilename);
});

// @desc    Export audit logs
// @route   GET /api/audit-logs/export
// @access  Private
const exportAuditLogs = asyncHandler(async (req, res) => {
  const { format = 'json', start_date, end_date, action, entity_type } = req.query;

  const query = {};
  if (start_date || end_date) {
    query.timestamp = {};
    if (start_date) query.timestamp.$gte = new Date(start_date);
    if (end_date) query.timestamp.$lte = new Date(end_date);
  }
  if (action) query.action = action;
  if (entity_type) query.entity_type = entity_type;

  const logs = await AuditLog.find(query)
    .populate('user', 'name email role')
    .sort('-timestamp')
    .limit(10000)
    .lean();

  if (format === 'csv') {
    // Convert to CSV
    const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Success', 'IP Address'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.user?.name || '',
      log.user_email,
      log.role,
      log.action,
      log.entity_type,
      log.entity_id || '',
      log.success ? 'Yes' : 'No',
      log.ip_address || ''
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.csv`);
    return res.send(csv);
  }

  // Default JSON format
  res.status(200).json({
    success: true,
    data: {
      logs,
      total: logs.length,
      exported_at: new Date()
    }
  });
});

module.exports = {
  getAuditLogs,
  getAuditLog,
  getAuditLogStats,
  getLogFiles,
  viewLogFile,
  downloadLogFile,
  exportAuditLogs
};
