import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  RotateCcw,
  FileText
} from 'lucide-react';
import { transactionAPI, merchantAPI } from '../services/api';
import { generateTransactionsPDF } from '../utils/pdfGenerator';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const statusColors = {
  SUCCESS: 'badge-success',
  PENDING: 'badge-warning',
  FAILED: 'badge-danger'
};

const reconciliationColors = {
  MATCHED: 'badge-success',
  UNMATCHED_BANK: 'badge-danger',
  UNMATCHED_MERCHANT: 'badge-danger',
  AMOUNT_MISMATCH: 'badge-warning',
  PENDING: 'badge-neutral',
  DUPLICATE: 'badge-info'
};

const Transactions = () => {
  const { hasPermission } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    reconciliation_status: '',
    merchant_id: '',
    payment_gateway: '',
    search: '',
    date_from: '',
    date_to: '',
    amount_min: '',
    amount_max: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activePreset, setActivePreset] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [newTransaction, setNewTransaction] = useState({
    transaction_id: '',
    merchant_id: '',
    amount: '',
    currency: 'INR',
    status: 'PENDING',
    source: 'MERCHANT',
    payment_gateway: 'RAZORPAY',
    reference_id: ''
  });
  const [merchants, setMerchants] = useState([]);
  const [showNewMerchantForm, setShowNewMerchantForm] = useState(false);
  const [newMerchant, setNewMerchant] = useState({
    name: '',
    email: '',
    settlement_cycle: 'DAILY',
    payment_gateway: 'RAZORPAY',
    sla_hours: 24
  });

  const fetchMerchants = async () => {
    try {
      const response = await merchantAPI.getAll({ limit: 100 });
      setMerchants(response.data.data.merchants || []);
    } catch (error) {
      console.error('Failed to fetch merchants');
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      };
      const response = await transactionAPI.getAll(params);
      setTransactions(response.data.data.transactions);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, filters]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchTransactions();
  };

  const handleViewTransaction = async (id) => {
    try {
      const response = await transactionAPI.getById(id);
      setSelectedTransaction(response.data.data.transaction);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to load transaction details');
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      await transactionAPI.delete(id);
      toast.success('Transaction deleted');
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const handleOpenEdit = async (txn) => {
    setEditTransaction({
      _id: txn._id,
      transaction_id: txn.transaction_id,
      merchant_id: txn.merchant_id,
      amount: txn.amount,
      currency: txn.currency || 'INR',
      status: txn.status,
      source: txn.source,
      payment_gateway: txn.payment_gateway,
      reference_id: txn.reference_id || ''
    });
    fetchMerchants();
    setShowEditModal(true);
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    try {
      await transactionAPI.update(editTransaction._id, {
        amount: parseFloat(editTransaction.amount),
        status: editTransaction.status,
        merchant_id: editTransaction.merchant_id,
        payment_gateway: editTransaction.payment_gateway,
        reference_id: editTransaction.reference_id
      });
      toast.success('Transaction updated successfully');
      setShowEditModal(false);
      setEditTransaction(null);
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update transaction');
    }
  };

  const handleBulkUpdate = async (status) => {
    if (selectedItems.length === 0) return;
    
    try {
      await transactionAPI.bulkUpdate({
        transaction_ids: selectedItems,
        updates: { status }
      });
      toast.success(`${selectedItems.length} transactions updated`);
      setSelectedItems([]);
      fetchTransactions();
    } catch (error) {
      toast.error('Bulk update failed');
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === transactions.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(transactions.map(t => t._id));
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    try {
      // If creating a new merchant, create it first
      if (showNewMerchantForm) {
        if (!newMerchant.name || !newMerchant.email) {
          toast.error('Please fill in merchant name and email');
          return;
        }
        await merchantAPI.create({
          ...newMerchant,
          merchant_id: newTransaction.merchant_id
        });
        toast.success(`Merchant ${newTransaction.merchant_id} created!`);
      }

      // Generate transaction ID if empty
      const txnData = {
        ...newTransaction,
        transaction_id: newTransaction.transaction_id || `TXN${Date.now().toString(36).toUpperCase()}`,
        amount: parseFloat(newTransaction.amount)
      };
      await transactionAPI.create(txnData);
      toast.success('Transaction created successfully');
      setShowAddModal(false);
      setShowNewMerchantForm(false);
      setNewTransaction({
        transaction_id: '',
        merchant_id: '',
        amount: '',
        currency: 'INR',
        status: 'PENDING',
        source: 'MERCHANT',
        payment_gateway: 'RAZORPAY',
        reference_id: ''
      });
      setNewMerchant({
        name: '',
        email: '',
        settlement_cycle: 'DAILY',
        payment_gateway: 'RAZORPAY',
        sla_hours: 24
      });
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create transaction');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500">Manage and monitor all transactions</p>
        </div>
        {hasPermission('canEditTransactions') && (
          <button 
            onClick={() => {
              fetchMerchants();
              setShowAddModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 w-full md:max-w-md">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by transaction ID, merchant ID..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="input pl-9"
              />
            </form>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'} flex items-center gap-2`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {Object.values(filters).filter(v => v).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                  {Object.values(filters).filter(v => v).length}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                if (transactions.length === 0) {
                  toast.error('No transactions to export');
                  return;
                }
                generateTransactionsPDF(transactions, 'Transactions Report');
                toast.success('PDF report generated!');
              }}
              className="btn btn-outline flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-slate-700 p-4"
          >
            {/* Quick Presets */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">Quick:</span>
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'failed', label: 'Failed Only' },
                { id: 'pending', label: 'Pending Only' },
                { id: 'unmatched', label: 'Unmatched' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    const now = new Date();
                    let newFilters = { ...filters };
                    setActivePreset(preset.id);
                    
                    if (preset.id === 'today') {
                      newFilters.date_from = now.toISOString().split('T')[0];
                      newFilters.date_to = now.toISOString().split('T')[0];
                    } else if (preset.id === 'week') {
                      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      newFilters.date_from = weekAgo.toISOString().split('T')[0];
                      newFilters.date_to = now.toISOString().split('T')[0];
                    } else if (preset.id === 'month') {
                      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      newFilters.date_from = monthAgo.toISOString().split('T')[0];
                      newFilters.date_to = now.toISOString().split('T')[0];
                    } else if (preset.id === 'failed') {
                      newFilters.status = 'FAILED';
                    } else if (preset.id === 'pending') {
                      newFilters.status = 'PENDING';
                    } else if (preset.id === 'unmatched') {
                      newFilters.reconciliation_status = 'UNMATCHED_BANK';
                    }
                    setFilters(newFilters);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    activePreset === preset.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              {(activePreset || Object.values(filters).some(v => v)) && (
                <button
                  onClick={() => {
                    setFilters({
                      status: '', source: '', reconciliation_status: '', merchant_id: '',
                      payment_gateway: '', search: '', date_from: '', date_to: '', amount_min: '', amount_max: ''
                    });
                    setActivePreset('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <label className="label dark:text-slate-300">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="SUCCESS">Success</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              <div>
                <label className="label dark:text-slate-300">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="BANK">Bank</option>
                  <option value="MERCHANT">Merchant</option>
                </select>
              </div>
              <div>
                <label className="label dark:text-slate-300">Reconciliation</label>
                <select
                  value={filters.reconciliation_status}
                  onChange={(e) => setFilters(prev => ({ ...prev, reconciliation_status: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="MATCHED">Matched</option>
                  <option value="UNMATCHED_BANK">Unmatched (Bank)</option>
                  <option value="UNMATCHED_MERCHANT">Unmatched (Merchant)</option>
                  <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label className="label dark:text-slate-300">Payment Gateway</label>
                <select
                  value={filters.payment_gateway}
                  onChange={(e) => setFilters(prev => ({ ...prev, payment_gateway: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="RAZORPAY">Razorpay</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div>
                <label className="label dark:text-slate-300">Merchant ID</label>
                <input
                  type="text"
                  value={filters.merchant_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, merchant_id: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="MER001"
                />
              </div>
              <div>
                <label className="label dark:text-slate-300">Date From</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>
              <div>
                <label className="label dark:text-slate-300">Date To</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>
              <div>
                <label className="label dark:text-slate-300">Min Amount</label>
                <input
                  type="number"
                  value={filters.amount_min}
                  onChange={(e) => setFilters(prev => ({ ...prev, amount_min: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="label dark:text-slate-300">Max Amount</label>
                <input
                  type="number"
                  value={filters.amount_max}
                  onChange={(e) => setFilters(prev => ({ ...prev, amount_max: e.target.value }))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="100000"
                  min="0"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className="border-t border-slate-200 p-4 bg-primary-50 flex items-center justify-between">
            <p className="text-sm text-primary-700 font-medium">
              {selectedItems.length} item(s) selected
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkUpdate('SUCCESS')}
                className="btn btn-success btn-sm"
              >
                Mark Success
              </button>
              <button
                onClick={() => handleBulkUpdate('FAILED')}
                className="btn btn-danger btn-sm"
              >
                Mark Failed
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="btn btn-outline btn-sm"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12">
                <input
                  type="checkbox"
                  checked={selectedItems.length === transactions.length && transactions.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300"
                />
              </th>
              <th>Transaction ID</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Source</th>
              <th>Reconciliation</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-500">Loading transactions...</span>
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-12 text-slate-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn._id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(txn._id)}
                      onChange={() => toggleSelectItem(txn._id)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </td>
                  <td>
                    <span className="font-mono text-sm dark:text-slate-300">{txn.transaction_id}</span>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium dark:text-white">{txn.merchant?.name || txn.merchant_id}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{txn.merchant_id}</p>
                    </div>
                  </td>
                  <td className="font-medium dark:text-white">
                    {txn.currency} {txn.amount?.toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${statusColors[txn.status]}`}>
                      {txn.status}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{txn.source}</span>
                  </td>
                  <td>
                    <span className={`badge ${reconciliationColors[txn.reconciliation_status]}`}>
                      {txn.reconciliation_status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="text-sm text-slate-600 dark:text-slate-300">
                    {new Date(txn.transaction_date).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewTransaction(txn._id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {hasPermission('canEditTransactions') && (
                        <button
                          onClick={() => handleOpenEdit(txn)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('canDeleteRecords') && (
                        <button
                          onClick={() => handleDeleteTransaction(txn._id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} results
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="btn btn-outline btn-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-700">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.pages}
            className="btn btn-outline btn-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Transaction Details</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">Transaction ID</label>
                  <p className="font-mono font-medium">{selectedTransaction.transaction_id}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Merchant</label>
                  <p className="font-medium">{selectedTransaction.merchant?.name || selectedTransaction.merchant_id}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Amount</label>
                  <p className="font-medium">{selectedTransaction.currency} {selectedTransaction.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Status</label>
                  <span className={`badge ${statusColors[selectedTransaction.status]}`}>
                    {selectedTransaction.status}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Source</label>
                  <p className="font-medium">{selectedTransaction.source}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Payment Gateway</label>
                  <p className="font-medium">{selectedTransaction.payment_gateway}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Reconciliation Status</label>
                  <span className={`badge ${reconciliationColors[selectedTransaction.reconciliation_status]}`}>
                    {selectedTransaction.reconciliation_status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Date</label>
                  <p className="font-medium">{new Date(selectedTransaction.transaction_date).toLocaleString()}</p>
                </div>
              </div>
              {selectedTransaction.sla_breached && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2 text-red-700">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">SLA Breach</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    Exceeded by {selectedTransaction.sla_breach_hours?.toFixed(2)} hours
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Transaction ID (optional - auto-generated if empty)</label>
                  <input
                    type="text"
                    value={newTransaction.transaction_id}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, transaction_id: e.target.value }))}
                    className="input"
                    placeholder="TXN..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Select Merchant *</label>
                  <select
                    value={newTransaction.merchant_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__NEW__') {
                        setShowNewMerchantForm(true);
                        setNewTransaction(prev => ({ ...prev, merchant_id: '' }));
                      } else {
                        setShowNewMerchantForm(false);
                        setNewTransaction(prev => ({ ...prev, merchant_id: value }));
                      }
                    }}
                    className="input"
                    required={!showNewMerchantForm}
                  >
                    <option value="">-- Select a Merchant --</option>
                    {merchants.map((m) => (
                      <option key={m._id} value={m.merchant_id}>
                        {m.name} ({m.merchant_id})
                      </option>
                    ))}
                    <option value="__NEW__">➕ Add New Merchant</option>
                  </select>
                </div>
                
                {/* New Merchant Inline Form */}
                {showNewMerchantForm && (
                  <div className="col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-900">Create New Merchant</h4>
                      <button 
                        type="button"
                        onClick={() => {
                          setShowNewMerchantForm(false);
                          setNewMerchant({ name: '', email: '', settlement_cycle: 'DAILY', payment_gateway: 'RAZORPAY', sla_hours: 24 });
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-sm">Merchant ID *</label>
                        <input
                          type="text"
                          value={newTransaction.merchant_id}
                          onChange={(e) => setNewTransaction(prev => ({ ...prev, merchant_id: e.target.value.toUpperCase() }))}
                          className="input"
                          placeholder="MER001"
                          required
                        />
                      </div>
                      <div>
                        <label className="label text-sm">Merchant Name *</label>
                        <input
                          type="text"
                          value={newMerchant.name}
                          onChange={(e) => setNewMerchant(prev => ({ ...prev, name: e.target.value }))}
                          className="input"
                          placeholder="Company Name"
                          required={showNewMerchantForm}
                        />
                      </div>
                      <div>
                        <label className="label text-sm">Email *</label>
                        <input
                          type="email"
                          value={newMerchant.email}
                          onChange={(e) => setNewMerchant(prev => ({ ...prev, email: e.target.value }))}
                          className="input"
                          placeholder="merchant@email.com"
                          required={showNewMerchantForm}
                        />
                      </div>
                      <div>
                        <label className="label text-sm">Settlement Cycle</label>
                        <select
                          value={newMerchant.settlement_cycle}
                          onChange={(e) => setNewMerchant(prev => ({ ...prev, settlement_cycle: e.target.value }))}
                          className="input"
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="label">Amount *</label>
                  <input
                    type="number"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    className="input"
                    placeholder="1000"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select
                    value={newTransaction.currency}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, currency: e.target.value }))}
                    className="input"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    value={newTransaction.status}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, status: e.target.value }))}
                    className="input"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="label">Source</label>
                  <select
                    value={newTransaction.source}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, source: e.target.value }))}
                    className="input"
                  >
                    <option value="MERCHANT">Merchant</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Gateway</label>
                  <select
                    value={newTransaction.payment_gateway}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, payment_gateway: e.target.value }))}
                    className="input"
                  >
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Reference ID (optional)</label>
                  <input
                    type="text"
                    value={newTransaction.reference_id}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, reference_id: e.target.value }))}
                    className="input"
                    placeholder="REF123456"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Transaction
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Transaction</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <X className="w-5 h-5 dark:text-white" />
              </button>
            </div>
            <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label dark:text-slate-300">Transaction ID</label>
                  <input
                    type="text"
                    value={editTransaction.transaction_id}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white bg-slate-100"
                    disabled
                  />
                </div>
                <div className="col-span-2">
                  <label className="label dark:text-slate-300">Merchant</label>
                  <select
                    value={editTransaction.merchant_id}
                    onChange={(e) => setEditTransaction(prev => ({ ...prev, merchant_id: e.target.value }))}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    required
                  >
                    <option value="">-- Select Merchant --</option>
                    {merchants.map((m) => (
                      <option key={m._id} value={m.merchant_id}>
                        {m.name} ({m.merchant_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label dark:text-slate-300">Amount *</label>
                  <input
                    type="number"
                    value={editTransaction.amount}
                    onChange={(e) => setEditTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label dark:text-slate-300">Currency</label>
                  <input
                    type="text"
                    value={editTransaction.currency}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white bg-slate-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="label dark:text-slate-300">Status</label>
                  <select
                    value={editTransaction.status}
                    onChange={(e) => setEditTransaction(prev => ({ ...prev, status: e.target.value }))}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="label dark:text-slate-300">Payment Gateway</label>
                  <select
                    value={editTransaction.payment_gateway}
                    onChange={(e) => setEditTransaction(prev => ({ ...prev, payment_gateway: e.target.value }))}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label dark:text-slate-300">Reference ID</label>
                  <input
                    type="text"
                    value={editTransaction.reference_id}
                    onChange={(e) => setEditTransaction(prev => ({ ...prev, reference_id: e.target.value }))}
                    className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder="REF123456"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Transaction
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
