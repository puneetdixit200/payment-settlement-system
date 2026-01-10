const { Alert } = require('../models');
const { asyncHandler, AppError } = require('../middleware');

// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
const getAlerts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    severity,
    merchant_id
  } = req.query;

  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (severity) query.severity = severity;
  if (merchant_id) query.merchant_id = merchant_id;

  const total = await Alert.countDocuments(query);
  const alerts = await Alert.find(query)
    .populate('merchant', 'name')
    .populate('read_by', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get single alert
// @route   GET /api/alerts/:id
// @access  Private
const getAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id)
    .populate('merchant', 'name email')
    .populate('transaction')
    .populate('read_by', 'name')
    .populate('acknowledged_by', 'name')
    .populate('resolved_by', 'name');

  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { alert }
  });
});

// @desc    Mark alert as read
// @route   PUT /api/alerts/:id/read
// @access  Private
const markAlertRead = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  if (alert.status === 'NEW') {
    alert.status = 'READ';
    alert.read_at = new Date();
    alert.read_by = req.user._id;
    await alert.save();
  }

  res.status(200).json({
    success: true,
    message: 'Alert marked as read',
    data: { alert }
  });
});

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private
const acknowledgeAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  alert.status = 'ACKNOWLEDGED';
  alert.acknowledged_at = new Date();
  alert.acknowledged_by = req.user._id;
  await alert.save();

  res.status(200).json({
    success: true,
    message: 'Alert acknowledged',
    data: { alert }
  });
});

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private
const resolveAlert = asyncHandler(async (req, res) => {
  const { resolution_notes } = req.body;

  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  alert.status = 'RESOLVED';
  alert.resolved_at = new Date();
  alert.resolved_by = req.user._id;
  alert.resolution_notes = resolution_notes;
  await alert.save();

  res.status(200).json({
    success: true,
    message: 'Alert resolved',
    data: { alert }
  });
});

// @desc    Dismiss alert
// @route   PUT /api/alerts/:id/dismiss
// @access  Private
const dismissAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  alert.status = 'DISMISSED';
  await alert.save();

  res.status(200).json({
    success: true,
    message: 'Alert dismissed',
    data: { alert }
  });
});

// @desc    Mark all alerts as read
// @route   PUT /api/alerts/read-all
// @access  Private
const markAllAlertsRead = asyncHandler(async (req, res) => {
  const result = await Alert.updateMany(
    { status: 'NEW' },
    {
      status: 'READ',
      read_at: new Date(),
      read_by: req.user._id
    }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} alerts marked as read`
  });
});

// @desc    Get unread alerts count
// @route   GET /api/alerts/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Alert.countDocuments({ status: 'NEW' });

  res.status(200).json({
    success: true,
    data: { count }
  });
});

// @desc    Get alert statistics
// @route   GET /api/alerts/stats
// @access  Private
const getAlertStats = asyncHandler(async (req, res) => {
  const byType = await Alert.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  const bySeverity = await Alert.aggregate([
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]);

  const byStatus = await Alert.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    data: { byType, bySeverity, byStatus }
  });
});

module.exports = {
  getAlerts,
  getAlert,
  markAlertRead,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  markAllAlertsRead,
  getUnreadCount,
  getAlertStats
};
