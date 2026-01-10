import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle, AlertTriangle, XCircle, Clock, Check, X, Eye, UserPlus } from 'lucide-react';
import { alertAPI, merchantAPI } from '../services/api';
import toast from 'react-hot-toast';

const severityColors = {
  LOW: 'border-l-slate-400 bg-slate-50',
  MEDIUM: 'border-l-blue-400 bg-blue-50',
  HIGH: 'border-l-amber-400 bg-amber-50',
  CRITICAL: 'border-l-red-400 bg-red-50'
};

const statusIcons = {
  NEW: Bell,
  READ: Eye,
  ACKNOWLEDGED: Check,
  RESOLVED: CheckCircle,
  DISMISSED: X
};

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [showAddMerchantModal, setShowAddMerchantModal] = useState(false);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [selectedAlertId, setSelectedAlertId] = useState('');
  const [merchantForm, setMerchantForm] = useState({
    name: '',
    email: '',
    settlement_cycle: 'DAILY',
    payment_gateway: 'RAZORPAY',
    sla_hours: 24
  });

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = { limit: 50, ...Object.fromEntries(Object.entries(filter).filter(([_, v]) => v)) };
      const response = await alertAPI.getAll(params);
      setAlerts(response.data.data.alerts);
    } catch (error) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const handleMarkAllRead = async () => {
    try {
      await alertAPI.markAllRead();
      toast.success('All alerts marked as read');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleAction = async (id, action) => {
    try {
      if (action === 'read') await alertAPI.markRead(id);
      else if (action === 'acknowledge') await alertAPI.acknowledge(id);
      else if (action === 'resolve') await alertAPI.resolve(id, { resolution_notes: 'Resolved' });
      else if (action === 'dismiss') await alertAPI.dismiss(id);
      toast.success(`Alert ${action}ed`);
      fetchAlerts();
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const openAddMerchantModal = (merchantId, alertId) => {
    setSelectedMerchantId(merchantId);
    setSelectedAlertId(alertId);
    setMerchantForm({
      name: '',
      email: '',
      settlement_cycle: 'DAILY',
      payment_gateway: 'RAZORPAY',
      sla_hours: 24
    });
    setShowAddMerchantModal(true);
  };

  const handleAddMerchant = async (e) => {
    e.preventDefault();
    try {
      await merchantAPI.create({
        ...merchantForm,
        merchant_id: selectedMerchantId
      });
      toast.success(`Merchant ${selectedMerchantId} created successfully!`);
      setShowAddMerchantModal(false);
      // Resolve the alert
      if (selectedAlertId) {
        await alertAPI.resolve(selectedAlertId, { 
          resolution_notes: `Merchant ${selectedMerchantId} was added to the system` 
        });
      }
      fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create merchant');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="text-slate-500">System notifications and alerts</p>
        </div>
        <button onClick={handleMarkAllRead} className="btn btn-outline">Mark All Read</button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-4">
          <div>
            <label className="label">Status</label>
            <select value={filter.status} onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))} className="input">
              <option value="">All</option>
              <option value="NEW">New</option>
              <option value="READ">Read</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
          <div>
            <label className="label">Severity</label>
            <select value={filter.severity} onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value }))} className="input">
              <option value="">All</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : alerts.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">No alerts found</div>
        ) : (
          alerts.map((alert) => {
            const StatusIcon = statusIcons[alert.status] || Bell;
            return (
              <motion.div
                key={alert._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`card p-4 border-l-4 ${severityColors[alert.severity]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${alert.status === 'NEW' ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-500'}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{alert.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>{alert.type}</span>
                        <span>•</span>
                        <span>{new Date(alert.createdAt).toLocaleString()}</span>
                        {alert.merchant_id && (
                          <>
                            <span>•</span>
                            <span>Merchant: {alert.merchant_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${alert.severity === 'CRITICAL' ? 'badge-danger' : alert.severity === 'HIGH' ? 'badge-warning' : 'badge-neutral'}`}>
                      {alert.severity}
                    </span>
                    {/* Add Merchant button for UNKNOWN_MERCHANT alerts */}
                    {alert.type === 'UNKNOWN_MERCHANT' && (alert.merchant_id || alert.data?.merchant_id) && alert.status !== 'RESOLVED' && (
                      <button 
                        onClick={() => openAddMerchantModal(alert.merchant_id || alert.data?.merchant_id, alert._id)}
                        className="btn btn-success btn-sm flex items-center gap-1"
                        title="Add this merchant to the system"
                      >
                        <UserPlus className="w-3 h-3" />
                        Add Merchant
                      </button>
                    )}
                    {alert.status === 'NEW' && (
                      <button onClick={() => handleAction(alert._id, 'acknowledge')} className="btn btn-outline btn-sm">Acknowledge</button>
                    )}
                    {(alert.status === 'NEW' || alert.status === 'READ' || alert.status === 'ACKNOWLEDGED') && (
                      <button onClick={() => handleAction(alert._id, 'resolve')} className="btn btn-primary btn-sm">Resolve</button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Merchant Modal */}
      {showAddMerchantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-lg w-full"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add New Merchant</h2>
                <p className="text-sm text-slate-500 mt-1">Merchant ID: <span className="font-mono font-medium">{selectedMerchantId}</span></p>
              </div>
              <button onClick={() => setShowAddMerchantModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMerchant} className="p-6 space-y-4">
              <div>
                <label className="label">Merchant Name *</label>
                <input
                  type="text"
                  value={merchantForm.name}
                  onChange={(e) => setMerchantForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="Enter merchant name"
                  required
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={merchantForm.email}
                  onChange={(e) => setMerchantForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  placeholder="merchant@example.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Settlement Cycle</label>
                  <select
                    value={merchantForm.settlement_cycle}
                    onChange={(e) => setMerchantForm(prev => ({ ...prev, settlement_cycle: e.target.value }))}
                    className="input"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Gateway</label>
                  <select
                    value={merchantForm.payment_gateway}
                    onChange={(e) => setMerchantForm(prev => ({ ...prev, payment_gateway: e.target.value }))}
                    className="input"
                  >
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">SLA Hours</label>
                <input
                  type="number"
                  value={merchantForm.sla_hours}
                  onChange={(e) => setMerchantForm(prev => ({ ...prev, sla_hours: parseInt(e.target.value) }))}
                  className="input"
                  min="1"
                  max="168"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddMerchantModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Merchant
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
