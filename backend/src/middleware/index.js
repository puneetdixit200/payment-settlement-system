const { verifyToken, generateAccessToken, generateRefreshToken, optionalAuth } = require('./auth');
const { requireRole, requirePermission, adminOnly, managerOrAdmin, getUserPermissions, requireAllPermissions, requireAnyPermission } = require('./rbac');
const { auditLog, logAction, AUDIT_ACTIONS } = require('./auditMiddleware');
const { AppError, errorHandler, asyncHandler, notFoundHandler } = require('./errorHandler');

module.exports = {
  // Auth
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
  optionalAuth,
  
  // RBAC
  requireRole,
  requirePermission,
  adminOnly,
  managerOrAdmin,
  getUserPermissions,
  requireAllPermissions,
  requireAnyPermission,
  
  // Audit
  auditLog,
  logAction,
  AUDIT_ACTIONS,
  
  // Error handling
  AppError,
  errorHandler,
  asyncHandler,
  notFoundHandler
};
