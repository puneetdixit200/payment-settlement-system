const { ROLES, PERMISSIONS } = require('../config/constants');

// Check if user has specific role(s)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Check if user has specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userPermissions = PERMISSIONS[req.user.role];
    
    if (!userPermissions || !userPermissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = requireRole(ROLES.ADMIN);

// Manager and Admin middleware
const managerOrAdmin = requireRole(ROLES.ADMIN, ROLES.MANAGER);

// Get user permissions
const getUserPermissions = (role) => {
  return PERMISSIONS[role] || {};
};

// Check multiple permissions (all required)
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userPermissions = PERMISSIONS[req.user.role];
    
    if (!userPermissions) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No permissions assigned.'
      });
    }

    const missingPermissions = permissions.filter(p => !userPermissions[p]);
    
    if (missingPermissions.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`
      });
    }

    next();
  };
};

// Check any permission (at least one required)
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userPermissions = PERMISSIONS[req.user.role];
    
    if (!userPermissions) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No permissions assigned.'
      });
    }

    const hasPermission = permissions.some(p => userPermissions[p]);
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required at least one of: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  adminOnly,
  managerOrAdmin,
  getUserPermissions,
  ROLES,
  PERMISSIONS
};
