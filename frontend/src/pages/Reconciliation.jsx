import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Upload, FileText } from 'lucide-react';
import { reconciliationAPI, uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

const Reconciliation = () => {
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  
  // File upload states
  const [bankFile, setBankFile] = useState(null);
  const [merchantFile, setMerchantFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const bankInputRef = useRef(null);
  const merchantInputRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, runsRes, disputesRes] = await Promise.all([
        reconciliationAPI.getStats(),
        reconciliationAPI.getRuns({ limit: 5 }),
        reconciliationAPI.getDisputes({ limit: 5, resolved: 'false' })
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

  // Bank file upload
  const handleBankUpload = async () => {
    if (!bankFile) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', bankFile);
      const response = await uploadAPI.uploadBank(formData);
      toast.success(`Bank file uploaded: ${response.data.data.summary?.imported || 0} records`);
      setUploadResults(prev => [...prev, { type: 'BANK', filename: bankFile.name, ...response.data.data.summary }]);
      setBankFile(null);
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bank upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Merchant file upload
  const handleMerchantUpload = async () => {
    if (!merchantFile) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('files', merchantFile);
      const response = await uploadAPI.uploadMerchant(formData);
      toast.success(`Merchant file uploaded: ${response.data.data.results?.[0]?.imported || 0} records`);
      setUploadResults(prev => [...prev, { type: 'MERCHANT', filename: merchantFile.name, ...(response.data.data.results?.[0] || {}) }]);
      setMerchantFile(null);
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error(error.response?.data?.message || 'Merchant upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRunReconciliation = async () => {
    try {
      setRunning(true);
      toast.loading('Running reconciliation...', { id: 'recon' });
      const response = await reconciliationAPI.run({ date_window_hours: 24 });
      const summary = response.data.data.run.summary;
      toast.success(
        `Done! Matched: ${summary.matched}, Unmatched: ${summary.unmatched_bank + summary.unmatched_merchant}, Mismatches: ${summary.amount_mismatch}`,
        { id: 'recon' }
      );
      setUploadResults([]); // Clear upload results after successful run
      fetchData();
    } catch (error) {
      toast.error('Reconciliation failed: ' + (error.response?.data?.message || error.message), { id: 'recon' });
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reconciliation</h1>
          <p className="text-slate-500 dark:text-slate-400">Upload files and match bank/merchant transactions</p>
        </div>
        <button 
          onClick={handleRunReconciliation} 
          disabled={running} 
          className="btn btn-primary flex items-center gap-2"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run Reconciliation
        </button>
      </div>

      {/* File Upload Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold dark:text-white">Step 1: Upload Transaction Files</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bank File */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center">
              <div
                onClick={() => bankInputRef.current?.click()}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg p-3 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {bankFile ? bankFile.name : 'Bank Statement'}
                </p>
                <p className="text-xs text-slate-400">Click to select CSV file</p>
              </div>
              <input
                ref={bankInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setBankFile(e.target.files[0])}
                className="hidden"
              />
              <button 
                onClick={handleBankUpload} 
                disabled={!bankFile || uploading} 
                className="btn btn-outline btn-sm w-full mt-2"
              >
                {uploading ? 'Uploading...' : 'Upload Bank File'}
              </button>
            </div>

            {/* Merchant File */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center">
              <div
                onClick={() => merchantInputRef.current?.click()}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg p-3 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {merchantFile ? merchantFile.name : 'Merchant Records'}
                </p>
                <p className="text-xs text-slate-400">Click to select CSV file</p>
              </div>
              <input
                ref={merchantInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setMerchantFile(e.target.files[0])}
                className="hidden"
              />
              <button 
                onClick={handleMerchantUpload} 
                disabled={!merchantFile || uploading} 
                className="btn btn-outline btn-sm w-full mt-2"
              >
                {uploading ? 'Uploading...' : 'Upload Merchant File'}
              </button>
            </div>
          </div>

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Uploaded Files:</p>
              {uploadResults.map((result, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <FileText className="w-4 h-4" />
                  <span>{result.type}: {result.filename}</span>
                  <span className="text-emerald-600">({result.imported || 0} imported)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Matched</span>
          </div>
          <p className="text-2xl font-bold mt-2 dark:text-white">{stats?.summary?.matched || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Unmatched</span>
          </div>
          <p className="text-2xl font-bold mt-2 dark:text-white">{stats?.summary?.unmatched || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Disputes</span>
          </div>
          <p className="text-2xl font-bold mt-2 dark:text-white">{stats?.summary?.disputes || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-2 dark:text-white">{stats?.summary?.pending || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runs */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold dark:text-white">Recent Runs</h3></div>
          <div className="divide-y dark:divide-slate-700">
            {runs.length === 0 ? (
              <p className="p-4 text-slate-500 text-center">No runs yet. Upload files and click "Run Reconciliation"</p>
            ) : (
              runs.map((run) => (
                <div key={run._id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{run.run_id}</p>
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
          <div className="card-header"><h3 className="font-semibold dark:text-white">Open Disputes</h3></div>
          <div className="divide-y dark:divide-slate-700">
            {disputes.length === 0 ? (
              <p className="p-4 text-slate-500 text-center">No open disputes</p>
            ) : (
              disputes.map((dispute) => (
                <div key={dispute._id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm dark:text-slate-300">{dispute.transaction_id}</p>
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
