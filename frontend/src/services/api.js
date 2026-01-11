import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 and try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API Service methods
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updatePassword: (data) => api.put('/auth/password', data),
  getUsers: (params) => api.get('/auth/users', { params }),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`)
};

export const merchantAPI = {
  getAll: (params) => api.get('/merchants', { params }),
  getById: (id) => api.get(`/merchants/${id}`),
  getByMerchantId: (merchantId) => api.get(`/merchants/by-merchant-id/${merchantId}`),
  create: (data) => api.post('/merchants', data),
  createFromTransaction: (data) => api.post('/merchants/from-transaction', data),
  update: (id, data) => api.put(`/merchants/${id}`, data),
  delete: (id) => api.delete(`/merchants/${id}`),
  getStats: () => api.get('/merchants/stats'),
  getUnknown: () => api.get('/merchants/unknown')
};

export const transactionAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  getByTxnId: (txnId) => api.get(`/transactions/by-txn-id/${txnId}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  updateStatus: (id, data) => api.patch(`/transactions/${id}/status`, data),
  bulkUpdate: (data) => api.post('/transactions/bulk-update', data),
  delete: (id) => api.delete(`/transactions/${id}`),
  getStats: (params) => api.get('/transactions/stats', { params }),
  getByMerchant: (merchantId, params) => api.get(`/transactions/by-merchant/${merchantId}`, { params })
};

export const uploadAPI = {
  uploadBank: (formData) => api.post('/upload/bank', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadMerchant: (formData) => api.post('/upload/merchant', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getFiles: (params) => api.get('/upload/files', { params }),
  getFileDetails: (id) => api.get(`/upload/files/${id}`)
};

export const reconciliationAPI = {
  run: (data) => api.post('/reconciliation/run', data),
  getRuns: (params) => api.get('/reconciliation/runs', { params }),
  getRunById: (id) => api.get(`/reconciliation/runs/${id}`),
  getStats: () => api.get('/reconciliation/stats'),
  getUnmatched: (params) => api.get('/reconciliation/unmatched', { params }),
  getDisputes: (params) => api.get('/reconciliation/disputes', { params }),
  resolveDispute: (id, data) => api.put(`/reconciliation/disputes/${id}/resolve`, data)
};

export const dashboardAPI = {
  getSummary: () => api.get('/dashboard'),
  getSLADashboard: () => api.get('/dashboard/sla')
};

export const alertAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
  resolve: (id, data) => api.put(`/alerts/${id}/resolve`, data),
  dismiss: (id) => api.put(`/alerts/${id}/dismiss`),
  markAllRead: () => api.put('/alerts/read-all'),
  getUnreadCount: () => api.get('/alerts/unread-count'),
  getStats: () => api.get('/alerts/stats')
};

export const auditLogAPI = {
  getAll: (params) => api.get('/audit-logs', { params }),
  getById: (id) => api.get(`/audit-logs/${id}`),
  getStats: (params) => api.get('/audit-logs/stats', { params }),
  getFiles: () => api.get('/audit-logs/files'),
  viewFile: (filename, params) => api.get(`/audit-logs/files/${filename}`, { params }),
  downloadFile: (filename) => api.get(`/audit-logs/files/${filename}/download`, { responseType: 'blob' }),
  export: (params) => api.get('/audit-logs/export', { params })
};

export const reportAPI = {
  getDaily: (params) => api.get('/reports/daily', { params }),
  getMerchantSettlements: (params) => api.get('/reports/merchant-settlements', { params }),
  getUnmatched: (params) => api.get('/reports/unmatched', { params }),
  getSLABreaches: (params) => api.get('/reports/sla-breaches', { params }),
  getFailedPayments: (params) => api.get('/reports/failed-payments', { params })
};

export const exportAPI = {
  settlements: (params) => {
    const responseType = params.format === 'json' ? 'json' : (params.format === 'pdf' ? 'arraybuffer' : 'blob');
    return api.get('/export/settlements', { params, responseType });
  },
  transactions: (params) => {
    const responseType = params.format === 'json' ? 'json' : (params.format === 'pdf' ? 'arraybuffer' : 'blob');
    return api.get('/export/transactions', { params, responseType });
  },
  merchants: (params) => {
    const responseType = params.format === 'json' ? 'json' : (params.format === 'pdf' ? 'arraybuffer' : 'blob');
    return api.get('/export/merchants', { params, responseType });
  }
};

export const gatewayAPI = {
  getStatus: () => api.get('/gateways'),
  testRazorpay: () => api.post('/gateways/razorpay/test'),
  updateRazorpayConfig: (data) => api.post('/gateways/razorpay/config', data),
  getRazorpayPayments: (params) => api.get('/gateways/razorpay/payments', { params }),
  syncRazorpayPayments: (data) => api.post('/gateways/razorpay/sync', data),
  getRazorpayStats: () => api.get('/gateways/razorpay/stats')
};

