import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { reconciliationAPI } from '../services/api';
import toast from 'react-hot-toast';

const Reconciliation = () => {
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, runsRes, disputesRes] = await Promise.all([
        reconciliationAPI.getStats(),
        reconciliationAPI.getRuns({ limit: 10 }),
        reconciliationAPI.getDisputes({ limit: 10, resolved: 'false' })
      ]);
      setStats(statsRes.data.data);
      setRuns(runsRes.data.data.runs);
      setDisputes(disputesRes.data.data.disputes);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunReconciliation = async () => {
    try {
      setRunning(true);
      toast.loading('Running reconciliation...', { id: 'recon' });
      const response = await reconciliationAPI.run({ date_window_hours: 24 });
      toast.success(`Completed! Matched: ${response.data.data.run.summary.matched}`, { id: 'recon' });
      fetchData();
    } catch (error) {
      toast.error('Reconciliation failed', { id: 'recon' });
    } finally {
      setRunning(false);
    }
  };

  const handleResolveDispute = async (id) => {
    try {
      await reconciliationAPI.resolveDispute(id, { resolution: 'Manually resolved', new_status: 'MATCHED' });
      toast.success('Dispute resolved');
      fetchData();
    } catch (error) {
      toast.error('Failed to resolve');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reconciliation</h1>
          <p className="text-slate-500">Match bank and merchant transactions</p>
        </div>
        <button onClick={handleRunReconciliation} disabled={running} className="btn btn-primary flex items-center gap-2">
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run Reconciliation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Matched</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats?.summary?.matched || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Unmatched</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats?.summary?.unmatched || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Disputes</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats?.summary?.disputes || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats?.summary?.pending || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runs */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Recent Runs</h3></div>
          <div className="divide-y">
            {runs.length === 0 ? (
              <p className="p-4 text-slate-500 text-center">No runs yet</p>
            ) : (
              runs.map((run) => (
                <div key={run._id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{run.run_id}</p>
                    <p className="text-sm text-slate-500">{new Date(run.started_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${run.status === 'COMPLETED' ? 'badge-success' : run.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                      {run.status}
                    </span>
                    <p className="text-sm text-slate-500 mt-1">Matched: {run.summary?.matched || 0}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open Disputes */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Open Disputes</h3></div>
          <div className="divide-y">
            {disputes.length === 0 ? (
              <p className="p-4 text-slate-500 text-center">No open disputes</p>
            ) : (
              disputes.map((dispute) => (
                <div key={dispute._id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">{dispute.transaction_id}</p>
                      <p className="text-sm text-slate-500">{dispute.dispute_reason}</p>
                    </div>
                    <button onClick={() => handleResolveDispute(dispute._id)} className="btn btn-outline btn-sm">Resolve</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reconciliation;
