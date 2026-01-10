const mongoose = require('mongoose');
const { ALERT_TYPES } = require('../config/constants');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(ALERT_TYPES),
    required: true
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  // Related entities
  entity_type: {
    type: String,
    enum: ['TRANSACTION', 'MERCHANT', 'RECONCILIATION', 'SYSTEM']
  },
  entity_id: String,
  // Merchant association
  merchant_id: String,
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant'
  },
  // Transaction association
  transaction_id: String,
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  // Additional data
  data: mongoose.Schema.Types.Mixed,
  // Status
  status: {
    type: String,
    enum: ['NEW', 'READ', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
    default: 'NEW'
  },
  read_at: Date,
  read_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledged_at: Date,
  acknowledged_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolved_at: Date,
  resolved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution_notes: String,
  // Notification status
  email_sent: {
    type: Boolean,
    default: false
  },
  email_sent_at: Date,
  // Expiry
  expires_at: Date
}, {
  timestamps: true
});

// Indexes
alertSchema.index({ type: 1, status: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ merchant_id: 1 });
alertSchema.index({ status: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Static method to create alert
alertSchema.statics.createAlert = async function(data) {
  const alert = new this(data);
  await alert.save();
  return alert;
};

// Transform output
alertSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Alert', alertSchema);
