import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Building2, AlertTriangle, XCircle } from 'lucide-react';
import { reportAPI, exportAPI } from '../services/api';
import toast from 'react-hot-toast';

const reportTypes = [
  { id: 'daily', name: 'Daily Report', icon: Calendar, api: reportAPI.getDaily },
  { id: 'merchant', name: 'Merchant Settlements', icon: Building2, api: reportAPI.getMerchantSettlements },
  { id: 'unmatched', name: 'Unmatched Transactions', icon: AlertTriangle, api: reportAPI.getUnmatched },
  { id: 'sla', name: 'SLA Breaches', icon: AlertTriangle, api: reportAPI.getSLABreaches },
  { id: 'failed', name: 'Failed Payments', icon: XCircle, api: reportAPI.getFailedPayments }
];

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const handleGenerateReport = async (report) => {
    try {
      setLoading(true);
      setSelectedReport(report.id);
      const params = {};
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const response = await report.api(params);
      setReportData(response.data.data);
      toast.success('Report generated');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      toast.loading(`Exporting as ${format.toUpperCase()}...`, { id: 'export' });
      
      let response;
      const params = { format };
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      
      // Determine report type for filename fallback
      const reportName = selectedReport || 'transactions';
      const timestamp = Date.now();
      const fallbackFilename = `${reportName}_${timestamp}.${format}`;
      
      if (selectedReport === 'merchant') {
        response = await exportAPI.merchants(params);
      } else {
        response = await exportAPI.transactions(params);
      }
      
      if (format !== 'json') {
        // Try to get filename from Content-Disposition header
        let filename = fallbackFilename;
        const contentDisposition = response.headers?.['content-disposition'];
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '');
          }
        }
        
        const mimeType = format === 'csv' ? 'text/csv' : 'application/pdf';
        const blob = new Blob([response.data], { type: mimeType });
        
        console.log(`Exporting ${format}: ${blob.size} bytes as ${filename}`);
        
        // Use modern download approach
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        
        // Append to body, click, then remove
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        
        // Cleanup blob URL
        window.URL.revokeObjectURL(url);
        
        toast.success(`Downloaded: ${filename}`, { id: 'export' });
      } else {
        toast.success('Export complete', { id: 'export' });
      }
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed: ' + (error.message || 'Unknown error'), { id: 'export' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500">Generate and export settlement reports</p>
      </div>

      {/* Date Range */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="input" />
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <motion.div
              key={report.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleGenerateReport(report)}
              className={`card p-6 cursor-pointer transition-all ${selectedReport === report.id ? 'ring-2 ring-primary-500' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{report.name}</h3>
                  <p className="text-sm text-slate-500">Click to generate</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Report Data */}
      {loading && <div className="text-center py-8"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
      
      {reportData && !loading && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold dark:text-white">Report Results</h3>
            <div className="flex gap-2">
              <button onClick={() => handleExport('csv')} className="btn btn-outline btn-sm flex items-center gap-1">
                <Download className="w-3 h-3" /> CSV
              </button>
              <button onClick={() => handleExport('pdf')} className="btn btn-outline btn-sm flex items-center gap-1">
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>
          <div className="card-body">
            {/* Handle different report data structures */}
            {(() => {
              // Daily report returns data directly as summary
              const summaryData = reportData.summary || (selectedReport === 'daily' ? reportData : null);
              const listData = reportData.transactions || reportData.breaches || (Array.isArray(reportData) ? reportData : null);
              
              return (
                <>
                  {/* Summary Stats */}
                  {summaryData && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {Object.entries(summaryData)
                        .filter(([key, value]) => typeof value !== 'object' || value === null)
                        .map(([key, value]) => (
                        <div key={key} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {typeof value === 'number' ? value.toLocaleString() : String(value ?? 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Merchant Settlements Table (array data) */}
                  {Array.isArray(reportData) && reportData.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Merchant</th>
                            <th>Transactions</th>
                            <th>Amount</th>
                            <th>Success Rate</th>
                            <th>Match Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.slice(0, 10).map((row, idx) => (
                            <tr key={idx}>
                              <td className="dark:text-white">{row.merchant_name || row.merchant_id}</td>
                              <td className="dark:text-slate-300">{row.total_transactions}</td>
                              <td className="dark:text-slate-300">₹{row.total_amount?.toLocaleString()}</td>
                              <td className="dark:text-slate-300">{row.success_rate}%</td>
                              <td className="dark:text-slate-300">{row.match_rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Showing {Math.min(10, reportData.length)} of {reportData.length} records</p>
                    </div>
                  )}
                  
                  {/* Transactions/Breaches List */}
                  {listData && listData.length > 0 && !Array.isArray(reportData) && (
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Transaction ID</th>
                            <th>Merchant</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listData.slice(0, 10).map((row, idx) => (
                            <tr key={idx}>
                              <td className="font-mono text-sm dark:text-slate-300">{row.transaction_id}</td>
                              <td className="dark:text-white">{row.merchant_id}</td>
                              <td className="dark:text-slate-300">₹{row.amount?.toLocaleString()}</td>
                              <td>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  row.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                                  row.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{row.status || row.reconciliation_status}</span>
                              </td>
                              <td className="dark:text-slate-300">{row.transaction_date ? new Date(row.transaction_date).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Showing {Math.min(10, listData.length)} of {listData.length} records</p>
                    </div>
                  )}
                  
                  {/* No Data Message */}
                  {!summaryData && !listData && !Array.isArray(reportData) && (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">No data available for this report</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
