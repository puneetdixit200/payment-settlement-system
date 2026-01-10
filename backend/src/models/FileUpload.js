const mongoose = require('mongoose');

const fileUploadSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  original_filename: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    enum: ['BANK', 'MERCHANT'],
    required: true
  },
  mime_type: String,
  size: Number,
  path: String,
  // Processing status
  status: {
    type: String,
    enum: ['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'],
    default: 'UPLOADED'
  },
  // Processing results
  processing: {
    started_at: Date,
    completed_at: Date,
    duration_ms: Number
  },
  results: {
    total_rows: { type: Number, default: 0 },
    processed_rows: { type: Number, default: 0 },
    successful_rows: { type: Number, default: 0 },
    failed_rows: { type: Number, default: 0 },
    duplicate_rows: { type: Number, default: 0 },
    skipped_rows: { type: Number, default: 0 }
  },
  // Errors encountered
  errors: [{
    row: Number,
    field: String,
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],
  // Column mapping used
  column_mapping: {
    type: Map,
    of: String
  },
  // Merchant association (for merchant files)
  merchant_id: String,
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant'
  },
  // User who uploaded
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Associated reconciliation run
  reconciliation_run: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReconciliationRun'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
fileUploadSchema.index({ status: 1 });
fileUploadSchema.index({ file_type: 1 });
fileUploadSchema.index({ uploaded_by: 1 });
fileUploadSchema.index({ createdAt: -1 });

// Virtual for success rate
fileUploadSchema.virtual('successRate').get(function() {
  if (this.results.total_rows === 0) return 0;
  return ((this.results.successful_rows / this.results.total_rows) * 100).toFixed(2);
});

// Transform output
fileUploadSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('FileUpload', fileUploadSchema);
