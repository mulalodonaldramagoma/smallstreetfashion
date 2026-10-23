import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export function SellerProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

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

  return (
    <SellerLayout activePage="profile">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Profile</h1>
        <p className="text-sm text-neutral-500">Manage your account information</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4 max-w-lg">
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
    </SellerLayout>
  );
}
