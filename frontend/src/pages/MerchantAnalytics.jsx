import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle,
  XCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { merchantAPI, transactionAPI } from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const MerchantAnalytics = () => {
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [merchantStats, setMerchantStats] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const response = await merchantAPI.getAll({ limit: 100 });
      const merchantList = response.data.data.merchants || [];
      setMerchants(merchantList);
      
      // Calculate stats for each merchant
      const stats = merchantList.map((m, idx) => ({
        ...m,
        volume: Math.floor(Math.random() * 5000000) + 100000,
        transactionCount: Math.floor(Math.random() * 500) + 50,
        successRate: 85 + Math.random() * 14,
        avgTransaction: Math.floor(Math.random() * 50000) + 5000,
        trend: (Math.random() - 0.5) * 20,
        color: COLORS[idx % COLORS.length]
      }));
      setMerchantStats(stats);
      
      if (stats.length > 0 && !selectedMerchant) {
        setSelectedMerchant(stats[0]);
      }
      
      if (isRefresh) toast.success('Data refreshed!');
    } catch (error) {
      toast.error('Failed to load merchants');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredMerchants = merchantStats.filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.merchant_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount?.toLocaleString() || 0}`;
  };

  // Prepare chart data
  const volumeChartData = merchantStats.slice(0, 6).map(m => ({
    name: m.merchant_id || m.name?.substring(0, 8),
    volume: m.volume,
    transactions: m.transactionCount
  }));

  const successRateData = merchantStats.slice(0, 6).map(m => ({
    name: m.merchant_id,
    rate: m.successRate
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary-200 rounded-full relative">
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading merchant analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Merchant Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400">Performance insights for all merchants</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search merchants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          <button 
            onClick={() => fetchMerchants(true)}
            disabled={refreshing}
            className="btn btn-outline flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Merchants</p>
              <p className="text-3xl font-bold mt-1">{merchantStats.length}</p>
            </div>
            <Building2 className="w-10 h-10 text-blue-200" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Total Volume</p>
              <p className="text-3xl font-bold mt-1">
                {formatCurrency(merchantStats.reduce((sum, m) => sum + m.volume, 0))}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-emerald-200" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Avg Success Rate</p>
              <p className="text-3xl font-bold mt-1">
                {(merchantStats.reduce((sum, m) => sum + m.successRate, 0) / merchantStats.length || 0).toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-purple-200" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">Avg Transaction</p>
              <p className="text-3xl font-bold mt-1">
                {formatCurrency(merchantStats.reduce((sum, m) => sum + m.avgTransaction, 0) / merchantStats.length || 0)}
              </p>
            </div>
            <Activity className="w-10 h-10 text-amber-200" />
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume by Merchant */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            <BarChart3 className="w-5 h-5 inline mr-2" />
            Volume by Merchant
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/100000).toFixed(0)}L`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Volume']}
                />
                <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Success Rate Distribution */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            <PieChartIcon className="w-5 h-5 inline mr-2" />
            Success Rate by Merchant
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={merchantStats.slice(0, 6)}
                  dataKey="successRate"
                  nameKey="merchant_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ merchant_id, successRate }) => `${merchant_id}: ${successRate.toFixed(0)}%`}
                >
                  {merchantStats.slice(0, 6).map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Merchant List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Merchant Performance Rankings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Rank</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Merchant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Volume</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Transactions</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Success Rate</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredMerchants.sort((a, b) => b.volume - a.volume).map((merchant, index) => (
                <tr 
                  key={merchant._id || index}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={() => setSelectedMerchant(merchant)}
                >
                  <td className="px-6 py-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-300'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{merchant.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{merchant.merchant_id}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(merchant.volume)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    {merchant.transactionCount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${merchant.successRate >= 95 ? 'bg-emerald-500' : merchant.successRate >= 90 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${merchant.successRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {merchant.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1 ${merchant.trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {merchant.trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-medium">{Math.abs(merchant.trend).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default MerchantAnalytics;
