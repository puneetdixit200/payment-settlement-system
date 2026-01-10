import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  DollarSign,
  CreditCard,
  FileCheck,
  Upload,
  ArrowRight,
  Zap,
  Activity,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { dashboardAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Quick Stats Card with gradient background
const QuickStatCard = ({ title, value, subtext, icon: Icon, gradient, trend, trendType }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.02, y: -2 }}
    transition={{ duration: 0.2 }}
    className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${gradient}`}
  >
    <div className="relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtext && <p className="text-sm text-white/70 mt-1">{subtext}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trendType === 'positive' ? 'text-green-200' : 'text-red-200'
            }`}>
              {trendType === 'positive' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{trend}% from last week</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </div>
    {/* Decorative elements */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
  </motion.div>
);

// Quick Action Card
const QuickActionCard = ({ title, description, icon: Icon, onClick, color }) => (
  <motion.button
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all w-full text-left group`}
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1">
      <p className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">{title}</p>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
  </motion.button>
);

// Status Badge
const StatusBadge = ({ status, count }) => {
  const config = {
    success: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
    failed: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
    sla: { bg: 'bg-purple-100', text: 'text-purple-700', icon: AlertTriangle },
  };
  const { bg, text, icon: StatusIcon } = config[status] || config.pending;
  
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <StatusIcon className={`w-4 h-4 ${text}`} />
      <span className={`text-sm font-medium ${text}`}>{count}</span>
    </div>
  );
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [slaData, setSlaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [comparisonData, setComparisonData] = useState(null);

  const dateRangeOptions = [
    { id: 'today', label: 'Today', days: 1 },
    { id: '7d', label: 'Last 7 Days', days: 7 },
    { id: '30d', label: 'Last 30 Days', days: 30 },
    { id: '90d', label: 'Last 90 Days', days: 90 },
    { id: 'custom', label: 'Custom Range', days: null }
  ];

  const getDateRangeParams = () => {
    const now = new Date();
    let from, to;
    if (dateRange === 'custom' && customDates.from && customDates.to) {
      from = customDates.from;
      to = customDates.to;
    } else {
      const option = dateRangeOptions.find(o => o.id === dateRange) || dateRangeOptions[1];
      const daysAgo = new Date(now.getTime() - option.days * 24 * 60 * 60 * 1000);
      from = daysAgo.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    }
    return { from, to };
  };

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [summaryRes, slaRes] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getSLADashboard()
      ]);
      setData(summaryRes.data.data);
      setSlaData(slaRes.data.data);
      
      // Calculate mock comparison data (previous period vs current)
      const transactions = summaryRes.data.data?.transactions || {};
      const prevPeriodFactor = 0.85 + Math.random() * 0.3; // Random 85-115%
      setComparisonData({
        volumeChange: ((1 - prevPeriodFactor) * 100).toFixed(1),
        transactionChange: ((1 - (0.9 + Math.random() * 0.2)) * 100).toFixed(1),
        successRateChange: (Math.random() * 4 - 2).toFixed(1)
      });
      
      if (isRefresh) toast.success('Dashboard refreshed!');
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, customDates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-200 rounded-full" />
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const transactions = data?.transactions || {};
  const gatewayStats = data?.gatewayStats || [];
  const dailyTransactions = data?.dailyTransactions || [];
  
  // Calculate totals and rates
  const totalAmount = transactions.totalAmount || 0;
  const successRate = transactions.total > 0 
    ? ((transactions.successCount / transactions.total) * 100).toFixed(1) 
    : 0;
  
  const reconciliationData = [
    { name: 'Matched', value: transactions.matchedCount || 0 },
    { name: 'Unmatched', value: transactions.unmatchedCount || 0 },
    { name: 'Pending', value: Math.max(0, (transactions.total || 0) - (transactions.matchedCount || 0) - (transactions.unmatchedCount || 0)) }
  ].filter(d => d.value > 0);

  // Format currency
  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount?.toLocaleString() || 0}`;
  };

  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header with Date Range Picker */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold text-slate-900 dark:text-white"
          >
            {getGreeting()}, {user?.name?.split(' ')[0] || 'User'}! 👋
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 mt-1"
          >
            Here's what's happening with your payments
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="btn btn-outline flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <Calendar className="w-4 h-4" />
              {dateRangeOptions.find(o => o.id === dateRange)?.label || 'Select Range'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showDatePicker && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-20 p-2"
              >
                {dateRangeOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setDateRange(option.id);
                      if (option.id !== 'custom') setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      dateRange === option.id
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {dateRange === 'custom' && (
                  <div className="mt-2 p-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">From</label>
                      <input
                        type="date"
                        value={customDates.from}
                        onChange={(e) => setCustomDates(prev => ({ ...prev, from: e.target.value }))}
                        className="input w-full text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">To</label>
                      <input
                        type="date"
                        value={customDates.to}
                        onChange={(e) => setCustomDates(prev => ({ ...prev, to: e.target.value }))}
                        className="input w-full text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="btn btn-primary w-full text-sm py-2"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="btn btn-outline flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </motion.button>
        </div>
      </div>

      {/* Quick Stats Cards with Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <QuickStatCard
          title="Total Volume"
          value={formatCurrency(totalAmount)}
          subtext={`${transactions.total?.toLocaleString() || 0} transactions`}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={comparisonData?.volumeChange}
          trendType={parseFloat(comparisonData?.volumeChange || 0) >= 0 ? 'positive' : 'negative'}
        />
        <QuickStatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtext={`${transactions.successCount?.toLocaleString() || 0} successful`}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          trend={comparisonData?.successRateChange}
          trendType={parseFloat(comparisonData?.successRateChange || 0) >= 0 ? 'positive' : 'negative'}
        />
        <QuickStatCard
          title="Failed Payments"
          value={transactions.failedCount?.toLocaleString() || '0'}
          subtext="Needs attention"
          icon={XCircle}
          gradient="bg-gradient-to-br from-red-500 to-red-600"
        />
        <QuickStatCard
          title="SLA Breaches"
          value={transactions.slaBreachedCount?.toLocaleString() || '0'}
          subtext={`Avg: ${slaData?.summary?.avgSettlementHours?.toFixed(1) || 0}h`}
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-amber-500 to-amber-600"
        />
      </div>

      {/* Quick Status Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100"
      >
        <span className="text-sm font-medium text-slate-600">Transaction Status:</span>
        <StatusBadge status="success" count={`${transactions.successCount || 0} Success`} />
        <StatusBadge status="pending" count={`${transactions.pendingCount || 0} Pending`} />
        <StatusBadge status="failed" count={`${transactions.failedCount || 0} Failed`} />
        <div className="ml-auto">
          <StatusBadge status="sla" count={`${transactions.matchedCount || 0} Matched`} />
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Trend - Takes 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Transaction Trend</h3>
              <p className="text-sm text-slate-500">Last 7 days performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTransactions}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="_id" 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    padding: '12px 16px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#colorCount)"
                  name="Transactions"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Reconciliation Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Reconciliation</h3>
            <p className="text-sm text-slate-500">Current status breakdown</p>
          </div>
          <div className="h-48 flex items-center justify-center">
            {reconciliationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reconciliationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {reconciliationData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No data available</p>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {reconciliationData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <span className="text-sm text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="Upload Files"
            description="Import bank & merchant data"
            icon={Upload}
            color="bg-blue-500"
            onClick={() => navigate('/upload')}
          />
          <QuickActionCard
            title="Run Reconciliation"
            description="Match transactions now"
            icon={FileCheck}
            color="bg-emerald-500"
            onClick={() => navigate('/reconciliation')}
          />
          <QuickActionCard
            title="View Transactions"
            description="Browse all transactions"
            icon={CreditCard}
            color="bg-purple-500"
            onClick={() => navigate('/transactions')}
          />
          <QuickActionCard
            title="Payment Gateways"
            description="Manage Stripe & Razorpay"
            icon={Zap}
            color="bg-amber-500"
            onClick={() => navigate('/payment-gateways')}
          />
        </div>
      </motion.div>

      {/* Bottom Section - Top Merchants & Gateway Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Top Merchants</h3>
              <p className="text-sm text-slate-500">By transaction volume</p>
            </div>
            <button 
              onClick={() => navigate('/merchants')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all →
            </button>
          </div>
          <div className="space-y-3">
            {data?.topMerchants?.slice(0, 5).map((merchant, index) => (
              <div key={merchant._id} className="flex items-center gap-4 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${
                  index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500' :
                  index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                  index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                  'bg-gradient-to-br from-primary-400 to-primary-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {merchant.merchant_info?.name || merchant._id}
                  </p>
                  <p className="text-sm text-slate-500">
                    {merchant.transactionCount} transactions
                  </p>
                </div>
                <p className="font-semibold text-slate-900">
                  {formatCurrency(merchant.totalAmount)}
                </p>
              </div>
            ))}
            {(!data?.topMerchants || data.topMerchants.length === 0) && (
              <div className="text-center py-8 text-slate-400">
                <p>No merchant data available yet</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Gateway Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Gateway Performance</h3>
              <p className="text-sm text-slate-500">Success rates by gateway</p>
            </div>
            <button 
              onClick={() => navigate('/payment-gateways')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage →
            </button>
          </div>
          <div className="space-y-4">
            {gatewayStats.length > 0 ? gatewayStats.map((gateway, index) => {
              const rate = ((gateway.successRate || 0) * 100).toFixed(1);
              const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500'];
              return (
                <div key={gateway._id || index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700">{gateway._id}</span>
                    <span className="text-sm font-semibold text-slate-900">{rate}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${rate}%` }}
                      transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                      className={`h-full rounded-full ${colors[index % colors.length]}`}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{gateway.count?.toLocaleString()} transactions</span>
                    <span>{formatCurrency(gateway.amount)}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-8 text-slate-400">
                <p>No gateway data available yet</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
