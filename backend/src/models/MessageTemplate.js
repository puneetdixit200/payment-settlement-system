const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['EMAIL', 'IN_APP', 'SMS'],
    required: true
  },
  trigger: {
    type: String,
    enum: [
      'TRANSACTION_FAILED',
      'TRANSACTION_PENDING',
      'SLA_BREACH',
      'RECONCILIATION_COMPLETE',
      'DISPUTE_DETECTED',
      'DAILY_SUMMARY',
      'WEEKLY_REPORT',
      'MERCHANT_ONBOARDED',
      'CUSTOM'
    ],
    required: true
  },
  subject: {
    type: String,
    required: function() { return this.type === 'EMAIL'; }
  },
  body: {
    type: String,
    required: true
  },
  // Available variables for template
  variables: [{
    name: String,
    description: String,
    example: String
  }],
  // Status
  is_active: {
    type: Boolean,
    default: true
  },
  // Usage tracking
  last_used: Date,
  use_count: {
    type: Number,
    default: 0
  },
  // Metadata
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
messageTemplateSchema.index({ type: 1, trigger: 1 });
messageTemplateSchema.index({ is_active: 1 });
messageTemplateSchema.index({ name: 1 });

// Static method to render template
messageTemplateSchema.statics.render = function(template, data) {
  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  return rendered;
};

// Transform output
messageTemplateSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);
