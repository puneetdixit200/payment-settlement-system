const mongoose = require('mongoose');
const { 
  TRANSACTION_STATUS, 
  TRANSACTION_SOURCE, 
  PAYMENT_GATEWAY,
  RECONCILIATION_STATUS 
} = require('../config/constants');

const transactionSchema = new mongoose.Schema({
  transaction_id: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  merchant_id: {
    type: String,
    required: [true, 'Merchant ID is required'],
    trim: true,
    uppercase: true
  },
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant'
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true
  },
  payment_gateway: {
    type: String,
    enum: Object.values(PAYMENT_GATEWAY),
    required: [true, 'Payment gateway is required']
  },
  status: {
    type: String,
    enum: Object.values(TRANSACTION_STATUS),
    default: TRANSACTION_STATUS.PENDING
  },
  source: {
    type: String,
    enum: Object.values(TRANSACTION_SOURCE),
    required: [true, 'Source is required']
  },
  reference_id: {
    type: String,
    trim: true
  },
  // Reconciliation fields
  reconciliation_status: {
    type: String,
    enum: Object.values(RECONCILIATION_STATUS),
    default: RECONCILIATION_STATUS.PENDING
  },
  reconciled_with: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  reconciliation_date: Date,
  reconciliation_run_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReconciliationRun'
  },
  // SLA Tracking (Feature 1)
  settlement_time: Date,
  sla_hours: Number,
  sla_breached: {
    type: Boolean,
    default: false
  },
  sla_breach_hours: Number,
  // Dispute Information
  is_disputed: {
    type: Boolean,
    default: false
  },
  dispute_reason: String,
  dispute_amount: Number,
  dispute_resolved: {
    type: Boolean,
    default: false
  },
  dispute_resolution: String,
  // Gateway specific fields
  gateway_transaction_id: String,
  gateway_response: mongoose.Schema.Types.Mixed,
  gateway_fee: Number,
  gateway_fee_currency: String,
  // Bank specific fields
  bank_reference: String,
  bank_settlement_date: Date,
  utr_number: String,
  // Additional fields
  customer_email: String,
  customer_name: String,
  customer_phone: String,
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  // File upload tracking
  uploaded_from_file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileUpload'
  },
  file_row_number: Number,
  // Audit fields
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Status history
  status_history: [{
    status: String,
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }],
  // Original transaction date (from file or gateway)
  transaction_date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
transactionSchema.index({ transaction_id: 1 });
transactionSchema.index({ merchant_id: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ source: 1 });
transactionSchema.index({ reconciliation_status: 1 });
transactionSchema.index({ payment_gateway: 1 });
transactionSchema.index({ transaction_date: -1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ sla_breached: 1 });
transactionSchema.index({ is_disputed: 1 });
// Compound indexes for reconciliation queries
transactionSchema.index({ transaction_id: 1, merchant_id: 1, amount: 1 });
transactionSchema.index({ source: 1, reconciliation_status: 1 });
transactionSchema.index({ merchant_id: 1, transaction_date: -1 });

// Pre-save middleware
transactionSchema.pre('save', async function(next) {
  // Generate transaction_id if not provided
  if (!this.transaction_id) {
    const prefix = this.source === 'BANK' ? 'BNK' : 'MER';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.transaction_id = `${prefix}${timestamp}${random}`;
  }
  
  // Track status changes
  if (this.isModified('status') && !this.isNew) {
    this.status_history.push({
      status: this.status,
      changed_at: new Date(),
      changed_by: this.updated_by
    });
  }
  
  next();
});

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency || 'INR'
  }).format(this.amount);
});

// Virtual for SLA status
transactionSchema.virtual('slaStatus').get(function() {
  if (!this.sla_hours) return 'NOT_CONFIGURED';
  if (this.sla_breached) return 'BREACHED';
  if (this.settlement_time) return 'MET';
  return 'PENDING';
});

// Static method to find potential matches
transactionSchema.statics.findPotentialMatches = async function(transaction, dateWindowHours = 24) {
  const dateWindow = new Date(transaction.transaction_date);
  dateWindow.setHours(dateWindow.getHours() - dateWindowHours);
  
  const endDate = new Date(transaction.transaction_date);
  endDate.setHours(endDate.getHours() + dateWindowHours);
  
  return this.find({
    _id: { $ne: transaction._id },
    source: transaction.source === 'BANK' ? 'MERCHANT' : 'BANK',
    merchant_id: transaction.merchant_id,
    amount: transaction.amount,
    transaction_date: { $gte: dateWindow, $lte: endDate },
    reconciliation_status: RECONCILIATION_STATUS.PENDING
  });
};

// Transform output
transactionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
