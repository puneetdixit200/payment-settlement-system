import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Edit, Trash2, Eye, Building2, X } from 'lucide-react';
import { merchantAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const statusColors = {
  ACTIVE: 'badge-success',
  INACTIVE: 'badge-neutral',
  PENDING: 'badge-warning',
  UNKNOWN_MERCHANT: 'badge-danger'
};

const Merchants = () => {
  const { hasPermission } = useAuth();
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', settlement_cycle: 'DAILY', payment_gateway: 'BANK', sla_hours: 24
  });

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const response = await merchantAPI.getAll({ search, limit: 100 });
      setMerchants(response.data.data.merchants);
    } catch (error) {
      toast.error('Failed to load merchants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMerchant) {
        await merchantAPI.update(editingMerchant._id, formData);
        toast.success('Merchant updated');
      } else {
        await merchantAPI.create(formData);
        toast.success('Merchant created');
      }
      setShowModal(false);
      setEditingMerchant(null);
      setFormData({ name: '', email: '', settlement_cycle: 'DAILY', payment_gateway: 'BANK', sla_hours: 24 });
      fetchMerchants();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      name: merchant.name,
      email: merchant.email,
      settlement_cycle: merchant.settlement_cycle,
      payment_gateway: merchant.payment_gateway,
      sla_hours: merchant.sla_hours
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this merchant?')) return;
    try {
      await merchantAPI.delete(id);
      toast.success('Merchant deleted');
      fetchMerchants();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Merchants</h1>
          <p className="text-slate-500">Manage merchant accounts and settings</p>
        </div>
        {hasPermission('canAddMerchant') && (
          <button onClick={() => { setEditingMerchant(null); setFormData({ name: '', email: '', settlement_cycle: 'DAILY', payment_gateway: 'BANK', sla_hours: 24 }); setShowModal(true); }} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Merchant
          </button>
        )}
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search merchants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchMerchants()}
            className="input pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading...</div>
        ) : merchants.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">No merchants found</div>
        ) : (
          merchants.map((merchant) => (
            <motion.div
              key={merchant._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{merchant.name}</h3>
                    <p className="text-sm text-slate-500">{merchant.merchant_id}</p>
                  </div>
                </div>
                <span className={`badge ${statusColors[merchant.status]}`}>{merchant.status}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-slate-500">Email:</span> {merchant.email}</p>
                <p><span className="text-slate-500">Gateway:</span> {merchant.payment_gateway}</p>
                <p><span className="text-slate-500">Cycle:</span> {merchant.settlement_cycle}</p>
                <p><span className="text-slate-500">SLA:</span> {merchant.sla_hours}h</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                <button onClick={() => handleEdit(merchant)} className="btn btn-outline btn-sm flex-1">
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </button>
                {hasPermission('canDeleteRecords') && (
                  <button onClick={() => handleDelete(merchant._id)} className="btn btn-outline btn-sm text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingMerchant ? 'Edit Merchant' : 'Add Merchant'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Settlement Cycle</label>
                  <select value={formData.settlement_cycle} onChange={(e) => setFormData({ ...formData, settlement_cycle: e.target.value })} className="input">
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Gateway</label>
                  <select value={formData.payment_gateway} onChange={(e) => setFormData({ ...formData, payment_gateway: e.target.value })} className="input">
                    <option value="BANK">Bank</option>
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="STRIPE">Stripe</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">SLA (hours)</label>
                <input type="number" value={formData.sla_hours} onChange={(e) => setFormData({ ...formData, sla_hours: parseInt(e.target.value) })} className="input" min="1" required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">{editingMerchant ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Merchants;
