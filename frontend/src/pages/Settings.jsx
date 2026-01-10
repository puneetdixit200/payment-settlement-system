import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Bell, Palette, Save, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      setSaving(true);
      await authAPI.updatePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      toast.success('Password updated successfully');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card dark:bg-slate-800 dark:border-slate-700 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' 
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card dark:bg-slate-800 dark:border-slate-700">
              <div className="card-header dark:border-slate-700">
                <h3 className="font-semibold dark:text-white">Profile Information</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-2xl font-bold">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{user?.name}</h3>
                    <p className="text-slate-500 dark:text-slate-400">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 text-xs font-medium rounded">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="label dark:text-slate-300">Name</label>
                    <input type="text" value={user?.name || ''} className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white" disabled />
                  </div>
                  <div>
                    <label className="label dark:text-slate-300">Email</label>
                    <input type="email" value={user?.email || ''} className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white" disabled />
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Contact your administrator to update profile information.</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card dark:bg-slate-800 dark:border-slate-700">
              <div className="card-header dark:border-slate-700">
                <h3 className="font-semibold dark:text-white">Change Password</h3>
              </div>
              <form onSubmit={handlePasswordChange} className="card-body space-y-4">
                <div>
                  <label className="label dark:text-slate-300">Current Password</label>
                  <input type="password" value={passwords.current} onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))} className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                </div>
                <div>
                  <label className="label dark:text-slate-300">New Password</label>
                  <input type="password" value={passwords.new} onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))} className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                </div>
                <div>
                  <label className="label dark:text-slate-300">Confirm New Password</label>
                  <input type="password" value={passwords.confirm} onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))} className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card dark:bg-slate-800 dark:border-slate-700">
              <div className="card-header dark:border-slate-700">
                <h3 className="font-semibold dark:text-white">Appearance Settings</h3>
              </div>
              <div className="card-body space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    {isDark ? <Moon className="w-8 h-8 text-primary-500" /> : <Sun className="w-8 h-8 text-amber-500" />}
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Dark Mode</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isDark ? 'Dark theme is enabled' : 'Light theme is enabled'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                      isDark ? 'bg-primary-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        isDark ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Your preference is saved automatically and will persist across sessions.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card dark:bg-slate-800 dark:border-slate-700">
              <div className="card-header dark:border-slate-700">
                <h3 className="font-semibold dark:text-white">Notification Preferences</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between py-3 border-b dark:border-slate-700">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">SLA Breach Alerts</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Get notified when SLA is breached</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 dark:border-slate-600" />
                </div>
                <div className="flex items-center justify-between py-3 border-b dark:border-slate-700">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Reconciliation Complete</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Notify when reconciliation finishes</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 dark:border-slate-600" />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Failed Transactions</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Alert on transaction failures</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 dark:border-slate-600" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

