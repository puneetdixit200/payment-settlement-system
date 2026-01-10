import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Download, FileText, User, Calendar } from 'lucide-react';
import { auditLogAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [filters, setFilters] = useState({ action: '', entity_type: '', start_date: '', end_date: '' });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const response = await auditLogAPI.getAll(params);
      setLogs(response.data.data.logs);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const handleExport = async () => {
    try {
      const response = await auditLogAPI.export({ format: 'csv', ...filters });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${Date.now()}.csv`;
      a.click();
      toast.success('Exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const actionColors = {
    LOGIN: 'text-emerald-600 bg-emerald-50',
    LOGOUT: 'text-slate-600 bg-slate-50',
    TRANSACTION_CREATE: 'text-blue-600 bg-blue-50',
    TRANSACTION_EDIT: 'text-amber-600 bg-amber-50',
    TRANSACTION_DELETE: 'text-red-600 bg-red-50',
    MERCHANT_CREATE: 'text-purple-600 bg-purple-50',
    RECONCILIATION_RUN: 'text-indigo-600 bg-indigo-50',
    FILE_UPLOAD: 'text-teal-600 bg-teal-50'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500">Track all system activities</p>
        </div>
        <button onClick={handleExport} className="btn btn-outline flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Action</label>
            <select value={filters.action} onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))} className="input">
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="TRANSACTION_CREATE">Transaction Create</option>
              <option value="TRANSACTION_EDIT">Transaction Edit</option>
              <option value="MERCHANT_CREATE">Merchant Create</option>
              <option value="FILE_UPLOAD">File Upload</option>
              <option value="RECONCILIATION_RUN">Reconciliation Run</option>
            </select>
          </div>
          <div>
            <label className="label">Entity Type</label>
            <select value={filters.entity_type} onChange={(e) => setFilters(prev => ({ ...prev, entity_type: e.target.value }))} className="input">
              <option value="">All Types</option>
              <option value="USER">User</option>
              <option value="TRANSACTION">Transaction</option>
              <option value="MERCHANT">Merchant</option>
              <option value="FILE">File</option>
              <option value="RECONCILIATION">Reconciliation</option>
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input type="date" value={filters.start_date} onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" value={filters.end_date} onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))} className="input" />
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        <div className="divide-y">
          {loading ? (
            <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No logs found</div>
          ) : (
            logs.map((log) => (
              <div key={log._id} className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{log.user?.name || log.user_email}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] || 'text-slate-600 bg-slate-50'}`}>
                      {log.action?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-slate-500">{log.entity_type}</span>
                    {log.entity_id && <span className="text-sm text-slate-400 font-mono">{log.entity_id}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleString()}
                    {log.ip_address && <span>• {log.ip_address}</span>}
                  </p>
                </div>
                <span className={`badge ${log.success ? 'badge-success' : 'badge-danger'}`}>
                  {log.success ? 'Success' : 'Failed'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>Page {pagination.page} of {pagination.pages || 1}</span>
        <div className="flex gap-2">
          <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} disabled={pagination.page === 1} className="btn btn-outline btn-sm">Previous</button>
          <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page >= pagination.pages} className="btn btn-outline btn-sm">Next</button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
