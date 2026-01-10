// User Roles
const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER'
};

// Transaction Statuses
const TRANSACTION_STATUS = {
  SUCCESS: 'SUCCESS',
  PENDING: 'PENDING',
  FAILED: 'FAILED'
};

// Transaction Sources
const TRANSACTION_SOURCE = {
  BANK: 'BANK',
  MERCHANT: 'MERCHANT'
};

// Payment Gateways
const PAYMENT_GATEWAY = {
  BANK: 'BANK',
  RAZORPAY: 'RAZORPAY',
  STRIPE: 'STRIPE'
};

// Reconciliation Statuses
const RECONCILIATION_STATUS = {
  MATCHED: 'MATCHED',
  UNMATCHED_BANK: 'UNMATCHED_BANK',
  UNMATCHED_MERCHANT: 'UNMATCHED_MERCHANT',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  DUPLICATE: 'DUPLICATE',
  PENDING: 'PENDING'
};

// Merchant Statuses
const MERCHANT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  UNKNOWN: 'UNKNOWN_MERCHANT'
};

// Settlement Cycles
const SETTLEMENT_CYCLE = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY'
};

// Audit Actions
const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  FILE_UPLOAD: 'FILE_UPLOAD',
  TRANSACTION_CREATE: 'TRANSACTION_CREATE',
  TRANSACTION_EDIT: 'TRANSACTION_EDIT',
  TRANSACTION_DELETE: 'TRANSACTION_DELETE',
  TRANSACTION_BULK_UPDATE: 'TRANSACTION_BULK_UPDATE',
  MERCHANT_CREATE: 'MERCHANT_CREATE',
  MERCHANT_EDIT: 'MERCHANT_EDIT',
  MERCHANT_DELETE: 'MERCHANT_DELETE',
  RECONCILIATION_RUN: 'RECONCILIATION_RUN',
  REPORT_GENERATE: 'REPORT_GENERATE',
  EXPORT_DATA: 'EXPORT_DATA',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  GATEWAY_CONFIG: 'GATEWAY_CONFIG'
};

// Permission Matrix
const PERMISSIONS = {
  [ROLES.ADMIN]: {
    canAddMerchant: true,
    canEditMerchant: true,
    canRemoveMerchant: true,
    canUploadFiles: true,
    canEditTransactions: true,
    canDeleteRecords: true,
    canConfigureGateways: true,
    canViewAuditLogs: true,
    canExportData: true,
    canRunReconciliation: true
  },
  [ROLES.MANAGER]: {
    canAddMerchant: true,
    canEditMerchant: true,
    canRemoveMerchant: true,
    canUploadFiles: true,
    canEditTransactions: true,
    canDeleteRecords: false,
    canConfigureGateways: false,
    canViewAuditLogs: true,
    canExportData: true,
    canRunReconciliation: true
  }
};

// Report Types
const REPORT_TYPES = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  MERCHANT_WISE: 'MERCHANT_WISE',
  UNMATCHED: 'UNMATCHED',
  FAILED_PAYMENTS: 'FAILED_PAYMENTS',
  SLA_BREACHES: 'SLA_BREACHES'
};

// Alert Types
const ALERT_TYPES = {
  SLA_BREACH: 'SLA_BREACH',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  RECONCILIATION_COMPLETE: 'RECONCILIATION_COMPLETE',
  DISPUTE_DETECTED: 'DISPUTE_DETECTED',
  UNKNOWN_MERCHANT: 'UNKNOWN_MERCHANT'
};

module.exports = {
  ROLES,
  TRANSACTION_STATUS,
  TRANSACTION_SOURCE,
  PAYMENT_GATEWAY,
  RECONCILIATION_STATUS,
  MERCHANT_STATUS,
  SETTLEMENT_CYCLE,
  AUDIT_ACTIONS,
  PERMISSIONS,
  REPORT_TYPES,
  ALERT_TYPES
};
