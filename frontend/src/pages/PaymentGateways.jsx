import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Settings2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  DollarSign,
  Activity,
  TrendingUp,
  Download,
  Loader2
} from 'lucide-react';
import { transactionAPI, gatewayAPI } from '../services/api';
import toast from 'react-hot-toast';

const PaymentGateways = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showApiKeys, setShowApiKeys] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [razorpayStats, setRazorpayStats] = useState(null);
  
  // Gateway configurations
  const [gateways, setGateways] = useState({
    razorpay: {
      enabled: true,
      name: 'Razorpay',
      logo: '🔷',
      mode: 'live',
      keyId: 'rzp_live_xxxxxxxxxxxxxx',
      keySecret: '••••••••••••••••••••',
      webhookSecret: '••••••••••••••••••••',
      features: ['Cards', 'UPI', 'Netbanking', 'Wallets'],
      status: 'connected'
    },
    stripe: {
      enabled: true,
      name: 'Stripe',
      logo: '💳',
      mode: 'live',
      publishableKey: 'pk_live_xxxxxxxxxxxxxx',
      secretKey: '••••••••••••••••••••',
      webhookSecret: '••••••••••••••••••••',
      features: ['Cards', 'Apple Pay', 'Google Pay', 'SEPA'],
      status: 'connected'
    },
    bank: {
      enabled: true,
      name: 'Bank Transfer',
      logo: '🏦',
      mode: 'live',
      accountNumber: 'XXXX XXXX XXXX 1234',
      ifscCode: 'HDFC0001234',
      features: ['NEFT', 'RTGS', 'IMPS'],
      status: 'connected'
    }
  });

  useEffect(() => {
    fetchStats();
    fetchRazorpayStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await transactionAPI.getStats({});
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchRazorpayStats = async () => {
    try {
      const response = await gatewayAPI.getRazorpayStats();
      if (response.data.success) {
        setRazorpayStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load Razorpay stats');
    }
  };

  const syncRazorpay = async () => {
    try {
      setSyncing(true);
      const response = await gatewayAPI.syncRazorpayPayments({ count: 100 });
      if (response.data.success) {
        toast.success(`Synced ${response.data.data.imported} payments from Razorpay!`);
        if (response.data.data.skipped > 0) {
          toast(`${response.data.data.skipped} payments were already imported`, { icon: 'ℹ️' });
        }
        // Refresh stats after sync
        fetchStats();
        fetchRazorpayStats();
      }
    } catch (error) {
      toast.error('Failed to sync Razorpay payments');
    } finally {
      setSyncing(false);
    }
  };

  const toggleGateway = (gatewayId) => {
    setGateways(prev => ({
      ...prev,
      [gatewayId]: { ...prev[gatewayId], enabled: !prev[gatewayId].enabled }
    }));
    toast.success(`${gateways[gatewayId].name} ${!gateways[gatewayId].enabled ? 'enabled' : 'disabled'}`);
  };

  const toggleMode = (gatewayId) => {
    const newMode = gateways[gatewayId].mode === 'live' ? 'test' : 'live';
    setGateways(prev => ({
      ...prev,
      [gatewayId]: { ...prev[gatewayId], mode: newMode }
    }));
    toast.success(`${gateways[gatewayId].name} switched to ${newMode} mode`);
  };

  const toggleShowKey = (gatewayId, keyName) => {
    const key = `${gatewayId}_${keyName}`;
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveConfig = (gatewayId) => {
    toast.success(`${gateways[gatewayId].name} configuration saved!`);
  };

  const getGatewayStats = (gatewayName) => {
    if (!stats?.byGateway) return { count: 0, amount: 0, successRate: 0 };
    const gateway = stats.byGateway.find(g => g._id === gatewayName.toUpperCase());
    return gateway || { count: 0, amount: 0, successRate: 0 };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Gateways</h1>
          <p className="text-slate-500">Manage your Stripe, Razorpay, and Bank payment configurations</p>
        </div>
        <button 
          onClick={() => { fetchStats(); fetchRazorpayStats(); }}
          className="btn btn-outline flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Stats
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(gateways).map(([id, gateway]) => {
          const gatewayStats = getGatewayStats(gateway.name);
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card p-6 border-l-4 ${
                gateway.enabled 
                  ? gateway.status === 'connected' ? 'border-l-green-500' : 'border-l-yellow-500'
                  : 'border-l-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{gateway.logo}</span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{gateway.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {gateway.enabled ? (
                        <span className="badge badge-success flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="badge badge-neutral flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                      <span className={`badge ${gateway.mode === 'live' ? 'badge-primary' : 'badge-warning'}`}>
                        {gateway.mode.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gateway.enabled}
                    onChange={() => toggleGateway(id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Transactions</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {id === 'razorpay' && razorpayStats 
                        ? razorpayStats.razorpay?.paymentCount?.toLocaleString() || 0
                        : gatewayStats.count?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      {id === 'razorpay' ? 'Total Received' : 'Volume'}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {id === 'razorpay' && razorpayStats 
                        ? formatCurrency(razorpayStats.razorpay?.totalReceived || 0)
                        : formatCurrency(gatewayStats.amount || 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Success Rate</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(gatewayStats.successRate || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {((gatewayStats.successRate || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-slate-200">
          <nav className="flex gap-4 px-6" aria-label="Tabs">
            {['overview', 'razorpay', 'stripe', 'bank'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab === 'overview' ? 'Overview' : gateways[tab]?.name || tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Gateway Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Transactions by Gateway */}
                <div className="card p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-primary-600" />
                    <h4 className="font-medium text-slate-900">Transaction Distribution</h4>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(gateways).map(([id, gateway]) => {
                      const gwStats = getGatewayStats(gateway.name);
                      const total = stats?.summary?.total || 1;
                      const percentage = total > 0 ? (gwStats.count / total) * 100 : 0;
                      return (
                        <div key={id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{gateway.name}</span>
                            <span className="text-slate-900 font-medium">{gwStats.count} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                id === 'razorpay' ? 'bg-blue-500' : id === 'stripe' ? 'bg-purple-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Volume by Gateway */}
                <div className="card p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-primary-600" />
                    <h4 className="font-medium text-slate-900">Volume Distribution</h4>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(gateways).map(([id, gateway]) => {
                      const gwStats = getGatewayStats(gateway.name);
                      const totalAmount = stats?.summary?.totalAmount || 1;
                      const percentage = totalAmount > 0 ? (gwStats.amount / totalAmount) * 100 : 0;
                      return (
                        <div key={id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{gateway.name}</span>
                            <span className="text-slate-900 font-medium">{formatCurrency(gwStats.amount)}</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                id === 'razorpay' ? 'bg-blue-500' : id === 'stripe' ? 'bg-purple-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="card p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                  <h4 className="font-medium text-slate-900">Supported Payment Methods</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(gateways).map(([id, gateway]) => (
                    <div key={id} className="bg-white p-4 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{gateway.logo}</span>
                        <span className="font-medium text-slate-900">{gateway.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {gateway.features.map((feature) => (
                          <span key={feature} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'overview' && gateways[activeTab] && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{gateways[activeTab].logo}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{gateways[activeTab].name} Configuration</h3>
                    <p className="text-sm text-slate-500">Manage API keys and settings</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activeTab === 'razorpay' && (
                    <button
                      onClick={syncRazorpay}
                      disabled={syncing}
                      className="btn btn-success flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Sync from Razorpay
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => toggleMode(activeTab)}
                    className={`btn ${gateways[activeTab].mode === 'live' ? 'btn-primary' : 'btn-warning'}`}
                  >
                    {gateways[activeTab].mode === 'live' ? 'Switch to Test' : 'Switch to Live'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* API Keys Section */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900">API Credentials</h4>
                  
                  {activeTab === 'razorpay' && (
                    <>
                      <div>
                        <label className="label">Key ID</label>
                        <div className="relative">
                          <input
                            type={showApiKeys.razorpay_keyId ? 'text' : 'password'}
                            value={gateways.razorpay.keyId}
                            className="input pr-10"
                            readOnly
                          />
                          <button
                            onClick={() => toggleShowKey('razorpay', 'keyId')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showApiKeys.razorpay_keyId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">Key Secret</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={gateways.razorpay.keySecret}
                            className="input pr-10"
                            readOnly
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">Webhook Secret</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={gateways.razorpay.webhookSecret}
                            className="input pr-10"
                            readOnly
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'stripe' && (
                    <>
                      <div>
                        <label className="label">Publishable Key</label>
                        <div className="relative">
                          <input
                            type={showApiKeys.stripe_publishableKey ? 'text' : 'password'}
                            value={gateways.stripe.publishableKey}
                            className="input pr-10"
                            readOnly
                          />
                          <button
                            onClick={() => toggleShowKey('stripe', 'publishableKey')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showApiKeys.stripe_publishableKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">Secret Key</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={gateways.stripe.secretKey}
                            className="input pr-10"
                            readOnly
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">Webhook Secret</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={gateways.stripe.webhookSecret}
                            className="input pr-10"
                            readOnly
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'bank' && (
                    <>
                      <div>
                        <label className="label">Account Number</label>
                        <input
                          type="text"
                          value={gateways.bank.accountNumber}
                          className="input"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="label">IFSC Code</label>
                        <input
                          type="text"
                          value={gateways.bank.ifscCode}
                          className="input"
                          readOnly
                        />
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => handleSaveConfig(activeTab)}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Configuration
                  </button>
                </div>

                {/* Stats Section */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900">Gateway Statistics</h4>
                  <div className="card p-4 bg-slate-50">
                    {(() => {
                      const gwStats = getGatewayStats(gateways[activeTab].name);
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                              <p className="text-sm text-slate-500">Total Transactions</p>
                              <p className="text-2xl font-bold text-slate-900">{gwStats.count?.toLocaleString() || 0}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                              <p className="text-sm text-slate-500">Total Volume</p>
                              <p className="text-2xl font-bold text-slate-900">{formatCurrency(gwStats.amount || 0)}</p>
                            </div>
                          </div>
                          
                          {/* Razorpay Live Stats */}
                          {activeTab === 'razorpay' && razorpayStats && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                              <p className="text-sm font-medium text-blue-800 mb-3">📊 Live Razorpay Stats</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-blue-600">Total Received</p>
                                  <p className="text-lg font-bold text-blue-900">{formatCurrency(razorpayStats.razorpay?.totalReceived || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-blue-600">Captured</p>
                                  <p className="text-lg font-bold text-green-700">{formatCurrency(razorpayStats.razorpay?.totalCaptured || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-blue-600">Pending</p>
                                  <p className="text-lg font-bold text-yellow-700">{formatCurrency(razorpayStats.razorpay?.totalPending || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-blue-600">Payment Count</p>
                                  <p className="text-lg font-bold text-blue-900">{razorpayStats.razorpay?.paymentCount || 0}</p>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-blue-200">
                                <p className="text-xs text-blue-600">Synced to Local Database</p>
                                <p className="text-sm font-medium text-blue-900">
                                  {razorpayStats.local?.count || 0} transactions ({formatCurrency(razorpayStats.local?.successAmount || 0)} success)
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-500 mb-2">Success Rate</p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full transition-all"
                                  style={{ width: `${(gwStats.successRate || 0) * 100}%` }}
                                />
                              </div>
                              <span className="text-lg font-bold text-slate-900">
                                {((gwStats.successRate || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-500 mb-2">Supported Features</p>
                            <div className="flex flex-wrap gap-2">
                              {gateways[activeTab].features.map((feature) => (
                                <span key={feature} className="px-3 py-1.5 bg-primary-50 text-primary-700 text-sm rounded-full">
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentGateways;
