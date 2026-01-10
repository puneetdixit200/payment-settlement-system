const { AuditLog } = require('../models');
const { AUDIT_ACTIONS } = require('../config/constants');

// Audit logging middleware factory
const auditLog = (action, entityType, getEntityDetails) => {
  return async (req, res, next) => {
    // Store original json function
    const originalJson = res.json.bind(res);
    const startTime = Date.now();

    // Override json to capture response
    res.json = async function(data) {
      const duration = Date.now() - startTime;
      
      try {
        // Extract entity details
        let entityDetails = {};
        if (typeof getEntityDetails === 'function') {
          entityDetails = getEntityDetails(req, data);
        }

        // Create audit log entry
        if (req.user) {
          await AuditLog.log({
            user: req.user._id,
            user_email: req.user.email,
            role: req.user.role,
            action,
            entity_type: entityType,
            entity_id: entityDetails.id || req.params.id,
            entity_name: entityDetails.name,
            details: {
              method: req.method,
              path: req.path,
              query: req.query,
              body: sanitizeBody(req.body),
              ...entityDetails.extra
            },
            changes: entityDetails.changes,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.headers['user-agent'],
            request_id: req.requestId,
            success: data.success !== false && res.statusCode < 400,
            error_message: data.success === false ? data.message : null,
            duration_ms: duration
          });
        }
      } catch (error) {
        console.error('Audit logging failed:', error);
        // Don't fail the request due to audit logging errors
      }

      // Call original json
      return originalJson(data);
    };

    next();
  };
};

// Sanitize request body by removing sensitive fields
const sanitizeBody = (body) => {
  if (!body) return {};
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

// Quick audit log function for manual logging
const logAction = async (user, action, entityType, details = {}) => {
  try {
    await AuditLog.log({
      user: user._id,
      user_email: user.email,
      role: user.role,
      action,
      entity_type: entityType,
      entity_id: details.entity_id,
      entity_name: details.entity_name,
      details: details.extra || {},
      changes: details.changes,
      ip_address: details.ip_address,
      success: details.success !== false,
      error_message: details.error_message,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Manual audit logging failed:', error);
  }
};

module.exports = {
  auditLog,
  logAction,
  AUDIT_ACTIONS
};
