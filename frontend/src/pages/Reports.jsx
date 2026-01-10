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
      
      // Determine report type for filename
      const reportName = selectedReport || 'transactions';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${reportName}_report_${timestamp}.${format}`;
      
      if (selectedReport === 'merchant') {
        response = await exportAPI.merchants(params);
      } else {
        response = await exportAPI.transactions(params);
      }
      
      if (format !== 'json') {
        const mimeType = format === 'csv' ? 'text/csv' : 'application/pdf';
        const blob = new Blob([response.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      
      toast.success(`Exported: ${filename}`, { id: 'export' });
      
      // Reset form after successful export
      setSelectedReport(null);
      setReportData(null);
      setDateRange({ start: '', end: '' });
      
    } catch (error) {
      toast.error('Export failed', { id: 'export' });
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
            <h3 className="font-semibold">Report Results</h3>
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
            {reportData.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {Object.entries(reportData.summary)
                  .filter(([key, value]) => typeof value !== 'object' || value === null)
                  .map(([key, value]) => (
                  <div key={key} className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-xl font-bold text-slate-900">
                      {typeof value === 'number' ? value.toLocaleString() : String(value ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {(reportData.transactions || reportData.breaches || []).length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-sm text-slate-500">Showing first 10 records</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
