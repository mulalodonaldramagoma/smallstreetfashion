import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Save,
  LogOut,
  Package,
  MapPin,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Star,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigateTo } from '@/hooks/useRouter';
import {
  fetchNotificationPreferences,
  upsertNotificationPreferences,
} from '@/services/notificationCentreService';
import type { NotificationPreferences, SavedAddress } from '@/types';

interface LastAddress {
  delivery_address: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
}

const EMPTY_ADDR_FORM: Omit<SavedAddress, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  label: '',
  recipient_name: '',
  phone: '',
  delivery_address: '',
  suburb: '',
  city: '',
  province: '',
  postal_code: '',
  delivery_instructions: '',
  is_default: false,
};

export function AccountPage() {
  const { profile, user, refreshProfile, signOut } = useAuth();
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

  const [lastAddress, setLastAddress] = useState<LastAddress | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrModal, setAddrModal] = useState<{ editId: string | null } | null>(null);
  const [addrForm, setAddrForm] = useState(EMPTY_ADDR_FORM);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [deleteAddrId, setDeleteAddrId] = useState<string | null>(null);

  const loadProfileData = useCallback(() => {
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

  const loadLastAddress = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('orders')
        .select('delivery_address, suburb, city, province, postal_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastAddress(data as LastAddress | null);
    } catch {
      // non-critical
    }
  }, [user]);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddrLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAddresses(data as SavedAddress[] || []);
    } catch {
      // non-critical
    } finally {
      setAddrLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    loadPrefs();
    loadLastAddress();
    loadAddresses();
  }, [loadPrefs, loadLastAddress, loadAddresses]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
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

  const handleAddrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddrSaving(true);
    setAddrError(null);

    if (addrForm.is_default) {
      const { error: clearErr } = await supabase
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true);
      if (clearErr) {
        setAddrError('Failed to update default address.');
        setAddrSaving(false);
        return;
      }
    }

    try {
      if (addrModal?.editId) {
        const { error } = await supabase
          .from('saved_addresses')
          .update({
            label: addrForm.label,
            recipient_name: addrForm.recipient_name,
            phone: addrForm.phone || null,
            delivery_address: addrForm.delivery_address,
            suburb: addrForm.suburb,
            city: addrForm.city,
            province: addrForm.province,
            postal_code: addrForm.postal_code,
            delivery_instructions: addrForm.delivery_instructions || null,
            is_default: addrForm.is_default,
            updated_at: new Date().toISOString(),
          })
          .eq('id', addrModal.editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_addresses')
          .insert({
            user_id: user.id,
            label: addrForm.label,
            recipient_name: addrForm.recipient_name,
            phone: addrForm.phone || null,
            delivery_address: addrForm.delivery_address,
            suburb: addrForm.suburb,
            city: addrForm.city,
            province: addrForm.province,
            postal_code: addrForm.postal_code,
            delivery_instructions: addrForm.delivery_instructions || null,
            is_default: addrForm.is_default,
          });
        if (error) throw error;
      }
      setAddrModal(null);
      setAddrForm(EMPTY_ADDR_FORM);
      await loadAddresses();
    } catch {
      setAddrError('Failed to save address. Please try again.');
    } finally {
      setAddrSaving(false);
    }
  };

  const handleAddrDelete = async () => {
    if (!deleteAddrId) return;
    setAddrSaving(true);
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', deleteAddrId);
      if (error) throw error;
      setDeleteAddrId(null);
      await loadAddresses();
    } catch {
      setAddrError('Failed to delete address.');
    } finally {
      setAddrSaving(false);
    }
  };

  const openEditAddr = (addr: SavedAddress) => {
    setAddrForm({
      label: addr.label,
      recipient_name: addr.recipient_name,
      phone: addr.phone || '',
      delivery_address: addr.delivery_address,
      suburb: addr.suburb,
      city: addr.city,
      province: addr.province,
      postal_code: addr.postal_code,
      delivery_instructions: addr.delivery_instructions || '',
      is_default: addr.is_default,
    });
    setAddrModal({ editId: addr.id });
  };

  const openAddAddr = () => {
    setAddrForm(EMPTY_ADDR_FORM);
    setAddrModal({ editId: null });
  };

  const handleSignOut = async () => {
    await signOut();
    navigateTo('/');
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
    <div className="pt-20 min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">My Account</h1>
          <p className="text-sm text-neutral-500">Manage your profile, security and preferences</p>
        </div>

        {profile?.role === 'seller' && (
          <div className="mb-6 bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Package size={18} className="text-neutral-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Seller Dashboard</p>
                <p className="text-xs text-neutral-500">Manage your store and products</p>
              </div>
            </div>
            <button onClick={() => navigateTo('/seller')} className="flex items-center gap-1 text-sm font-medium text-neutral-900 hover:underline">
              Go <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Profile details */}
        <form onSubmit={handleProfileSave} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <User size={18} className="text-neutral-700" />
            <h2 className="text-sm font-semibold text-neutral-900">Profile Details</h2>
          </div>
          {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">Profile updated successfully.</div>}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="email" value={user?.email || ''} disabled
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-500" />
            </div>
            <p className="text-xs text-neutral-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="+27 82 123 4567" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Account Type</label>
            <input type="text" value={profile?.role || 'customer'} disabled
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-500 capitalize" />
          </div>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2">
            <Save size={16} />{saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Saved delivery addresses */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-neutral-700" />
              <h2 className="text-sm font-semibold text-neutral-900">Saved Delivery Addresses</h2>
            </div>
            <button onClick={openAddAddr}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors">
              <Plus size={14} /> Add
            </button>
          </div>

          {addrError && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-3">{addrError}</div>}

          {addrLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-6">
              <MapPin size={24} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 mb-1">No saved addresses yet.</p>
              <p className="text-xs text-neutral-400">Add one to speed up checkout.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="border border-neutral-200 rounded-lg p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900">{addr.label}</span>
                      {addr.is_default && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                          <Star size={10} className="fill-amber-500 text-amber-500" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-700">{addr.recipient_name}</p>
                    <p className="text-sm text-neutral-500">{addr.delivery_address}</p>
                    <p className="text-sm text-neutral-500">{addr.suburb}, {addr.city}, {addr.province} {addr.postal_code}</p>
                    {addr.phone && <p className="text-xs text-neutral-400 mt-1">{addr.phone}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditAddr(addr)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteAddrId(addr.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Last used address (from orders) as fallback info */}
          {lastAddress && addresses.length === 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Last Used Address</p>
              <p className="text-sm text-neutral-600">{lastAddress.delivery_address}</p>
              <p className="text-sm text-neutral-500">{lastAddress.suburb}, {lastAddress.city}, {lastAddress.province} {lastAddress.postal_code}</p>
            </div>
          )}
        </div>

        {/* Change password */}
        <form onSubmit={handlePasswordChange} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={18} className="text-neutral-700" />
            <h2 className="text-sm font-semibold text-neutral-900">Change Password</h2>
          </div>
          {pwError && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{pwError}</div>}
          {pwSuccess && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">Password changed successfully.</div>}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">New Password</label>
            <input type="password" required value={pwNew} onChange={(e) => setPwNew(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirm New Password</label>
            <input type="password" required value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="Re-enter new password" />
          </div>
          <button type="submit" disabled={pwSaving}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2">
            <Lock size={16} />{pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {/* Account security info */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-neutral-700" />
            <h2 className="text-sm font-semibold text-neutral-900">Account Security</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Email</span>
              <span className="text-sm text-neutral-900">{user?.email || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Account ID</span>
              <span className="text-xs text-neutral-400 font-mono">{user?.id?.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Password</span>
              <span className="text-sm text-green-600">Set</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Account Type</span>
              <span className="text-sm text-neutral-900 capitalize">{profile?.role || 'customer'}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-400">
              Your account is protected by Supabase Auth. Only you can edit your name and phone number. Your role and account type are managed by the platform administrators.
            </p>
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
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
                    <button
                      type="button"
                      onClick={() => handlePrefToggle(key)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${prefs[key] ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs[key] ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                ))}
              </div>
              <button onClick={handlePrefsSave} disabled={prefsSaving}
                className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                <Save size={16} />{prefsSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </>
          )}
        </div>

        {/* Sign out */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      {/* Address add/edit modal */}
      {addrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddrModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-neutral-900">{addrModal.editId ? 'Edit Address' : 'Add Address'}</h3>
              <button onClick={() => setAddrModal(null)} className="p-1 text-neutral-400 hover:text-neutral-900">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddrSave} className="space-y-3">
              {addrError && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{addrError}</div>}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Label</label>
                <input type="text" required value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="e.g. Home, Work" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Recipient Name</label>
                <input type="text" required value={addrForm.recipient_name} onChange={(e) => setAddrForm({ ...addrForm, recipient_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone (optional)</label>
                <input type="tel" value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="+27 82 123 4567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Street Address</label>
                <input type="text" required value={addrForm.delivery_address} onChange={(e) => setAddrForm({ ...addrForm, delivery_address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Suburb</label>
                  <input type="text" required value={addrForm.suburb} onChange={(e) => setAddrForm({ ...addrForm, suburb: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">City</label>
                  <input type="text" required value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Province</label>
                  <input type="text" required value={addrForm.province} onChange={(e) => setAddrForm({ ...addrForm, province: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Postal Code</label>
                  <input type="text" required value={addrForm.postal_code} onChange={(e) => setAddrForm({ ...addrForm, postal_code: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Delivery Instructions (optional)</label>
                <textarea value={addrForm.delivery_instructions} onChange={(e) => setAddrForm({ ...addrForm, delivery_instructions: e.target.value })} rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                  placeholder="e.g. Leave at the front gate" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addrForm.is_default} onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                <span className="text-sm text-neutral-700">Set as default address</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddrModal(null)}
                  className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Cancel</button>
                <button type="submit" disabled={addrSaving}
                  className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {addrSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                  {addrModal.editId ? 'Save Changes' : 'Add Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete address confirmation */}
      {deleteAddrId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteAddrId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={20} className="text-rose-600" />
              <h3 className="font-bold text-neutral-900">Delete Address</h3>
            </div>
            <p className="text-sm text-neutral-500 mb-4">Are you sure you want to delete this saved address? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteAddrId(null)}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Cancel</button>
              <button onClick={handleAddrDelete} disabled={addrSaving}
                className="flex-1 px-5 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {addrSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
