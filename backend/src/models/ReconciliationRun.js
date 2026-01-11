const mongoose = require('mongoose');

const reconciliationRunSchema = new mongoose.Schema({
  run_id: {
    type: String,
    unique: true
    // Note: run_id is auto-generated in pre-save hook, not required on creation
  },
  status: {
    type: String,
    enum: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'RUNNING'
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  completed_at: Date,
  duration_ms: Number,
  // Configuration used for this run
  config: {
    date_window_hours: { type: Number, default: 24 },
    amount_tolerance: { type: Number, default: 0 },
    include_merchants: [String],
    exclude_merchants: [String],
    date_range: {
      start: Date,
      end: Date
    }
  },
  // Summary statistics
  summary: {
    total_bank_transactions: { type: Number, default: 0 },
    total_merchant_transactions: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    unmatched_bank: { type: Number, default: 0 },
    unmatched_merchant: { type: Number, default: 0 },
    amount_mismatch: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    disputes_detected: { type: Number, default: 0 },
    sla_breaches: { type: Number, default: 0 },
    unknown_merchants: { type: Number, default: 0 }
  },
  // Amount summaries
  amounts: {
    total_matched_amount: { type: Number, default: 0 },
    total_unmatched_bank_amount: { type: Number, default: 0 },
    total_unmatched_merchant_amount: { type: Number, default: 0 },
    total_mismatch_difference: { type: Number, default: 0 }
  },
  // Per-merchant breakdown
  merchant_summary: [{
    merchant_id: String,
    merchant_name: String,
    matched: Number,
    unmatched: Number,
    mismatches: Number,
    total_amount: Number
  }],
  // Errors encountered
  errors: [{
    message: String,
    transaction_id: String,
    timestamp: Date
  }],
  // Files processed
  files_processed: [{
    file_id: mongoose.Schema.Types.ObjectId,
    filename: String,
    source: String,
    rows_processed: Number
  }],
  // User who initiated
  initiated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
reconciliationRunSchema.index({ run_id: 1 });
reconciliationRunSchema.index({ status: 1 });
reconciliationRunSchema.index({ started_at: -1 });
reconciliationRunSchema.index({ initiated_by: 1 });

// Pre-save to generate run_id
reconciliationRunSchema.pre('save', function(next) {
  if (!this.run_id) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.run_id = `REC${timestamp}${random}`;
  }
  next();
});

// Virtual for match rate
reconciliationRunSchema.virtual('matchRate').get(function() {
  const total = this.summary.total_bank_transactions + this.summary.total_merchant_transactions;
  if (total === 0) return 0;
  return ((this.summary.matched * 2) / total * 100).toFixed(2);
});

// Transform output
reconciliationRunSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ReconciliationRun', reconciliationRunSchema);
