const mongoose = require('mongoose');
const { MERCHANT_STATUS, SETTLEMENT_CYCLE, PAYMENT_GATEWAY } = require('../config/constants');

const merchantSchema = new mongoose.Schema({
  merchant_id: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Merchant name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  settlement_cycle: {
    type: String,
    enum: Object.values(SETTLEMENT_CYCLE),
    default: SETTLEMENT_CYCLE.DAILY
  },
  payment_gateway: {
    type: String,
    enum: Object.values(PAYMENT_GATEWAY),
    default: PAYMENT_GATEWAY.BANK
  },
  status: {
    type: String,
    enum: Object.values(MERCHANT_STATUS),
    default: MERCHANT_STATUS.ACTIVE
  },
  // SLA Configuration (Feature 1)
  sla_hours: {
    type: Number,
    default: 24,
    min: [1, 'SLA must be at least 1 hour'],
    max: [720, 'SLA cannot exceed 720 hours (30 days)']
  },
  // Contact Information
  contact_person: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postal_code: String
  },
  // Business Information
  business_type: {
    type: String,
    trim: true
  },
  gst_number: {
    type: String,
    trim: true,
    uppercase: true
  },
  pan_number: {
    type: String,
    trim: true,
    uppercase: true
  },
  // Bank Details
  bank_details: {
    account_number: String,
    ifsc_code: String,
    bank_name: String,
    branch: String
  },
  // Gateway Specific IDs
  razorpay_account_id: String,
  stripe_account_id: String,
  // Statistics (updated on reconciliation)
  stats: {
    total_transactions: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    success_rate: { type: Number, default: 0 },
    avg_settlement_time: { type: Number, default: 0 },
    sla_breach_count: { type: Number, default: 0 }
  },
  // Notification Preferences
  notifications: {
    email_enabled: { type: Boolean, default: true },
    sla_breach_alert: { type: Boolean, default: true },
    daily_summary: { type: Boolean, default: true }
  },
  // Metadata
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
merchantSchema.index({ merchant_id: 1 });
merchantSchema.index({ email: 1 });
merchantSchema.index({ status: 1 });
merchantSchema.index({ payment_gateway: 1 });
merchantSchema.index({ name: 'text' });

// Pre-save middleware to generate merchant_id if not provided
merchantSchema.pre('save', async function(next) {
  if (!this.merchant_id) {
    const prefix = 'MER';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.merchant_id = `${prefix}${timestamp}${random}`;
  }
  next();
});

// Virtual for full address
merchantSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const { street, city, state, country, postal_code } = this.address;
  return [street, city, state, country, postal_code].filter(Boolean).join(', ');
});

// Transform output
merchantSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Merchant', merchantSchema);
