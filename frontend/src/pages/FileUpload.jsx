import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

const FileUpload = () => {
  const [bankFile, setBankFile] = useState(null);
  const [merchantFiles, setMerchantFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const bankInputRef = useRef(null);
  const merchantInputRef = useRef(null);

  const handleBankUpload = async () => {
    if (!bankFile) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', bankFile);
      const response = await uploadAPI.uploadBank(formData);
      toast.success(response.data.message);
      setResults(prev => [...prev, { type: 'BANK', ...response.data.data.summary }]);
      setBankFile(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleMerchantUpload = async () => {
    if (merchantFiles.length === 0) return;
    try {
      setUploading(true);
      const formData = new FormData();
      merchantFiles.forEach(file => formData.append('files', file));
      const response = await uploadAPI.uploadMerchant(formData);
      toast.success(response.data.message);
      setResults(prev => [...prev, ...response.data.data.results.map(r => ({ type: 'MERCHANT', ...r }))]);
      setMerchantFiles([]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">File Upload</h1>
        <p className="text-slate-500">Upload bank and merchant transaction files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank File */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Bank File</h3></div>
          <div className="card-body">
            <div
              onClick={() => bankInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
            >
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600">{bankFile ? bankFile.name : 'Click to upload or drag & drop'}</p>
              <p className="text-xs text-slate-400 mt-1">CSV or Excel files</p>
            </div>
            <input
              ref={bankInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setBankFile(e.target.files[0])}
              className="hidden"
            />
            <button onClick={handleBankUpload} disabled={!bankFile || uploading} className="btn btn-primary w-full mt-4">
              {uploading ? 'Uploading...' : 'Upload Bank File'}
            </button>
          </div>
        </div>

        {/* Merchant Files */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Merchant Files</h3></div>
          <div className="card-body">
            <div
              onClick={() => merchantInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
            >
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600">{merchantFiles.length > 0 ? `${merchantFiles.length} file(s) selected` : 'Click to upload multiple files'}</p>
              <p className="text-xs text-slate-400 mt-1">CSV or Excel files</p>
            </div>
            <input
              ref={merchantInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              onChange={(e) => setMerchantFiles(Array.from(e.target.files))}
              className="hidden"
            />
            <button onClick={handleMerchantUpload} disabled={merchantFiles.length === 0 || uploading} className="btn btn-primary w-full mt-4">
              {uploading ? 'Uploading...' : 'Upload Merchant Files'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Upload Results</h3></div>
          <div className="divide-y">
            {results.map((result, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-medium">{result.filename || result.type}</p>
                    <p className="text-sm text-slate-500">
                      {result.status === 'COMPLETED' || result.status === 'PARTIAL' ? (
                        `Imported: ${result.imported || 0}, Failed: ${result.failed || 0}`
                      ) : result.status}
                    </p>
                  </div>
                </div>
                {result.status === 'COMPLETED' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : result.status === 'PARTIAL' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
