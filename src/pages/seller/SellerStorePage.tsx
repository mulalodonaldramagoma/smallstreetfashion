import { useState, useEffect } from 'react';
import { Upload, Save, AlertCircle } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore } from '@/hooks/useData';
import { createStore, updateStore } from '@/services/storeService';
import { uploadProductImage } from '@/services/productService';
import { navigateTo } from '@/hooks/useRouter';
import type { Store } from '@/types';

export function SellerStorePage() {
  const { user } = useAuth();
  const { data: store, loading, error, refetch } = useSellerStore(user?.id ?? null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Small Street, Johannesburg CBD');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const isEditing = !!store;

  useEffect(() => {
    if (store) {
      setName(store.name);
      setDescription(store.description || '');
      setLocation(store.location);
      setPhone(store.phone || '');
      setWhatsapp(store.whatsapp || '');
      setLogoUrl(store.logo_url);
      setBannerUrl(store.banner_url);
    }
  }, [store]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    setFormError(null);
    try {
      const url = await uploadProductImage(file, user.id);
      setLogoUrl(url);
    } catch {
      setFormError('Your logo could not be uploaded. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingBanner(true);
    setFormError(null);
    try {
      const url = await uploadProductImage(file, user.id);
      setBannerUrl(url);
    } catch {
      setFormError('Your banner could not be uploaded. Please try again.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setSuccess(false);

    try {
      if (isEditing && store) {
        await updateStore(store.id, {
          name,
          description,
          location,
          phone,
          whatsapp,
          logo_url: logoUrl,
          banner_url: bannerUrl,
        });
      } else {
        if (!user) throw new Error('Not authenticated');
        await createStore({
          sellerId: user.id,
          name,
          description,
          location,
          phone,
          whatsapp,
          logoUrl,
          bannerUrl,
        });
      }
      setSuccess(true);
      refetch();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setFormError('Your store could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SellerLayout activePage="store">
        <div className="h-64 bg-neutral-100 rounded-xl animate-pulse" />
      </SellerLayout>
    );
  }

  if (error) {
    return (
      <SellerLayout activePage="store">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <AlertCircle size={24} className="text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-700">Unable to load your store information.</p>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout activePage="store">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">
          {isEditing ? 'Edit Your Store' : 'Create Your Store'}
        </h1>
        <p className="text-sm text-neutral-500">
          {isEditing
            ? 'Update your store details and branding'
            : 'Set up your store to start selling on Small Street Fashion'}
        </p>
      </div>

      {isEditing && store && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Status:</span>
            <span className={`text-xs px-2 py-1 rounded-full ${store.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'}`}>
              {store.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Verified:</span>
            <span className={`text-xs px-2 py-1 rounded-full ${store.is_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {store.is_verified ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        {formError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            {formError}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            Store saved successfully.
          </div>
        )}

        {/* Banner Upload */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Banner Image</label>
          <div className="relative h-40 rounded-lg overflow-hidden border-2 border-dashed border-neutral-300 hover:border-neutral-400 transition-colors">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                <Upload size={24} />
                <span className="text-xs mt-2">Click to upload banner</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              disabled={uploadingBanner}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {uploadingBanner && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <span className="text-sm text-neutral-600">Uploading...</span>
              </div>
            )}
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Logo</label>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-dashed border-neutral-300 hover:border-neutral-400 transition-colors shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-400">
                  <Upload size={20} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploadingLogo && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <span className="text-xs text-neutral-600">...</span>
                </div>
              )}
            </div>
            <span className="text-xs text-neutral-400">Square logo, recommended 200x200px</span>
          </div>
        </div>

        {/* Store Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Store Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="e.g. Urban Style SA"
          />
          {name && (
            <p className="text-xs text-neutral-400 mt-1">
              URL slug: /store/{name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            placeholder="Tell customers about your store..."
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Location *</label>
          <input
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Small Street, Johannesburg CBD"
          />
        </div>

        {/* Phone & WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="+27 82 123 4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">WhatsApp</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="+27 82 123 4567"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Store'}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/seller')}
            className="px-6 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </SellerLayout>
  );
}
