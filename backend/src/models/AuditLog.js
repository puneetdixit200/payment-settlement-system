const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../config/constants');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user_email: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: Object.values(AUDIT_ACTIONS),
    required: true
  },
  entity_type: {
    type: String,
    enum: ['USER', 'MERCHANT', 'TRANSACTION', 'FILE', 'RECONCILIATION', 'REPORT', 'SETTINGS', 'GATEWAY'],
    required: true
  },
  entity_id: String,
  entity_name: String,
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  ip_address: String,
  user_agent: String,
  request_id: String,
  success: {
    type: Boolean,
    default: true
  },
  error_message: String,
  duration_ms: Number,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We'll use our own timestamp field
});

// Indexes for efficient querying
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user_email: 1 });

// Static method to create log entry
auditLogSchema.statics.log = async function(data) {
  try {
    const logEntry = new this(data);
    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break main flow
  }
};

// Static method to get logs with pagination and filters
auditLogSchema.statics.getLogs = async function(filters = {}, options = {}) {
  const {
    user,
    action,
    entity_type,
    startDate,
    endDate,
    search
  } = filters;
  
  const {
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = -1
  } = options;
  
  const query = {};
  
  if (user) query.user = user;
  if (action) query.action = action;
  if (entity_type) query.entity_type = entity_type;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  if (search) {
    query.$or = [
      { user_email: { $regex: search, $options: 'i' } },
      { entity_name: { $regex: search, $options: 'i' } },
      { entity_id: { $regex: search, $options: 'i' } }
    ];
  }
  
  const total = await this.countDocuments(query);
  const logs = await this.find(query)
    .populate('user', 'name email role')
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Transform output
auditLogSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
