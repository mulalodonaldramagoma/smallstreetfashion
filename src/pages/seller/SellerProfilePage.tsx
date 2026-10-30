import { useState, useEffect, useCallback } from 'react';
import { Save, Lock, Bell, ChevronRight } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigateTo } from '@/hooks/useRouter';
import {
  fetchNotificationPreferences,
  upsertNotificationPreferences,
} from '@/services/notificationCentreService';
import type { NotificationPreferences } from '@/types';

export function SellerProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const loadPrefs = useCallback(async () => {
    try {
      const p = await fetchNotificationPreferences();
      setPrefs(p);
    } catch {
      setPrefsError('Failed to load preferences');
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    if (!user) {
      setError('Not authenticated.');
      setSaving(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Unable to update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwNew.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      setPwNew('');
      setPwConfirm('');
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError('Unable to change password. Please try again.');
    } finally {
      setPwSaving(false);
    }
  };

  const handlePrefToggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setPrefsSuccess(false);
  };

  const handlePrefsSave = async () => {
    if (!prefs) return;
    setPrefsSaving(true);
    setPrefsError(null);
    setPrefsSuccess(false);
    try {
      const { id, user_id, updated_at, ...updatable } = prefs;
      void id; void user_id; void updated_at;
      await upsertNotificationPreferences(updatable);
      setPrefsSuccess(true);
      setTimeout(() => setPrefsSuccess(false), 3000);
    } catch {
      setPrefsError('Failed to save preferences.');
    } finally {
      setPrefsSaving(false);
    }
  };

  const prefKeys: { key: keyof NotificationPreferences; label: string }[] = [
    { key: 'order_updates', label: 'Order Updates' },
    { key: 'delivery_updates', label: 'Delivery Updates' },
    { key: 'payment_updates', label: 'Payment Updates' },
    { key: 'messages', label: 'Messages' },
    { key: 'store_updates', label: 'Store Updates' },
    { key: 'product_updates', label: 'Product Updates' },
    { key: 'promotions', label: 'Promotions' },
    { key: 'system_alerts', label: 'System Alerts' },
  ];

  return (
    <SellerLayout activePage="profile">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Profile</h1>
        <p className="text-sm text-neutral-500">Manage your account information, security and preferences</p>
      </div>

      {/* Profile details */}
      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4 max-w-lg mb-6">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">Profile updated successfully.</div>}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name</label>
          <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
          <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="+27 82 123 4567" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Account Type</label>
          <input type="text" value={profile?.role || 'seller'} disabled className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-500 capitalize" />
        </div>
        <button type="submit" disabled={saving} className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2">
          <Save size={16} />{saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Store management link */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between max-w-lg mb-6">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Store Management</p>
          <p className="text-xs text-neutral-500">Edit your store details, hours and contact info</p>
        </div>
        <button onClick={() => navigateTo('/seller/store')} className="flex items-center gap-1 text-sm font-medium text-neutral-900 hover:underline">
          Go <ChevronRight size={16} />
        </button>
      </div>

      {/* Change password */}
      <form onSubmit={handlePasswordChange} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4 max-w-lg mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={18} className="text-neutral-700" />
          <h2 className="text-sm font-semibold text-neutral-900">Change Password</h2>
        </div>
        {pwError && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{pwError}</div>}
        {pwSuccess && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">Password changed successfully.</div>}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">New Password</label>
          <input type="password" required value={pwNew} onChange={(e) => setPwNew(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="At least 6 characters" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirm New Password</label>
          <input type="password" required value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="Re-enter new password" />
        </div>
        <button type="submit" disabled={pwSaving} className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2">
          <Lock size={16} />{pwSaving ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      {/* Notification preferences */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-lg mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-neutral-700" />
          <h2 className="text-sm font-semibold text-neutral-900">Notification Preferences</h2>
        </div>
        {prefsError && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-3">{prefsError}</div>}
        {prefsSuccess && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">Preferences saved.</div>}
        {!prefs ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {prefKeys.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-neutral-700">{label}</span>
                  <button type="button" onClick={() => handlePrefToggle(key)} className={`relative w-11 h-6 rounded-full transition-colors ${prefs[key] ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs[key] ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              ))}
            </div>
            <button onClick={handlePrefsSave} disabled={prefsSaving} className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2">
              <Save size={16} />{prefsSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </>
        )}
      </div>
    </SellerLayout>
  );
}
