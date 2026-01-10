import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Merchants from './pages/Merchants';
import MerchantAnalytics from './pages/MerchantAnalytics';
import Reconciliation from './pages/Reconciliation';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import FileUpload from './pages/FileUpload';
import PaymentGateways from './pages/PaymentGateways';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <SocketProvider>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1e293b',
                  color: '#fff',
                  borderRadius: '8px',
                },
              }}
            />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="merchants" element={<Merchants />} />
                <Route path="merchant-analytics" element={<MerchantAnalytics />} />
                <Route path="reconciliation" element={<Reconciliation />} />
                <Route path="upload" element={<FileUpload />} />
                <Route path="reports" element={<Reports />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="payment-gateways" element={<PaymentGateways />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;

