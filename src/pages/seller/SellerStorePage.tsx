import { useState, useEffect } from 'react';
import { Upload, Save, AlertCircle, MapPin, MessageCircle, Globe, Clock } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { OpeningHoursEditor } from '@/components/OpeningHoursEditor';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore } from '@/hooks/useData';
import { createStore, updateStore } from '@/services/storeService';
import { uploadProductImage } from '@/services/productService';
import { navigateTo } from '@/hooks/useRouter';
import {
  makeDefaultOpeningHours,
  normalizeWhatsAppNumber,
  normalizeSocialUrl,
  normalizeWebsiteUrl,
  validateOpeningHours,
  deriveLocationLabel,
  DAYS_OF_WEEK,
} from '@/utils/storeUtils';
import type { Store, OpeningHours } from '@/types';

export function SellerStorePage() {
  const { user } = useAuth();
  const { data: store, loading, error, refetch } = useSellerStore(user?.id ?? null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  // Structured address
  const [addressLine, setAddressLine] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [shopNumber, setShopNumber] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Social links
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Opening hours
  const [openingHours, setOpeningHours] = useState<OpeningHours>(makeDefaultOpeningHours());
  const [enableHours, setEnableHours] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const isEditing = !!store;

  useEffect(() => {
    if (store) {
      const s = store as Store;
      setName(s.name);
      setDescription(s.description || '');
      setPhone(s.phone || '');
      setWhatsapp(s.whatsapp || '');
      setLogoUrl(s.logo_url);
      setBannerUrl(s.banner_url);
      setAddressLine(s.address_line || '');
      setBuildingName(s.building_name || '');
      setShopNumber(s.shop_number || '');
      setArea(s.area || '');
      setCity(s.city || '');
      setProvince(s.province || '');
      setPostalCode(s.postal_code || '');
      setGoogleMapsUrl(s.google_maps_url || '');
      setLatitude(s.latitude != null ? String(s.latitude) : '');
      setLongitude(s.longitude != null ? String(s.longitude) : '');
      setInstagramUrl(s.instagram_url || '');
      setTiktokUrl(s.tiktok_url || '');
      setFacebookUrl(s.facebook_url || '');
      setWebsiteUrl(s.website_url || '');
      if (s.opening_hours && s.opening_hours.length > 0) {
        setOpeningHours(s.opening_hours);
        setEnableHours(true);
      } else {
        setOpeningHours(makeDefaultOpeningHours());
        setEnableHours(false);
      }
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

    // Validate WhatsApp if provided
    if (whatsapp.trim()) {
      const normalized = normalizeWhatsAppNumber(whatsapp);
      if (!normalized) {
        setFormError('WhatsApp number is invalid. Use a South African number like 082 123 4567 or +27 82 123 4567.');
        setSaving(false);
        return;
      }
    }

    // Validate social URLs
    const cleanedInstagram = instagramUrl.trim() ? normalizeSocialUrl('instagram', instagramUrl) : null;
    const cleanedTiktok = tiktokUrl.trim() ? normalizeSocialUrl('tiktok', tiktokUrl) : null;
    const cleanedFacebook = facebookUrl.trim() ? normalizeSocialUrl('facebook', facebookUrl) : null;
    const cleanedWebsite = websiteUrl.trim() ? normalizeWebsiteUrl(websiteUrl) : null;

    if (instagramUrl.trim() && !cleanedInstagram) {
      setFormError('Instagram URL is invalid. Enter a full HTTPS URL or username.');
      setSaving(false);
      return;
    }
    if (tiktokUrl.trim() && !cleanedTiktok) {
      setFormError('TikTok URL is invalid. Enter a full HTTPS URL or username.');
      setSaving(false);
      return;
    }
    if (facebookUrl.trim() && !cleanedFacebook) {
      setFormError('Facebook URL is invalid. Enter a full HTTPS URL or username.');
      setSaving(false);
      return;
    }
    if (websiteUrl.trim() && !cleanedWebsite) {
      setFormError('Website URL is invalid. Enter a full HTTPS URL.');
      setSaving(false);
      return;
    }

    // Validate opening hours
    let hoursToSave: OpeningHours | null = null;
    if (enableHours) {
      const hoursError = validateOpeningHours(openingHours);
      if (hoursError) {
        setFormError(hoursError);
        setSaving(false);
        return;
      }
      hoursToSave = openingHours;
    }

    // Validate coordinates
    let latNum: number | null = null;
    let lngNum: number | null = null;
    if (latitude.trim()) {
      latNum = parseFloat(latitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        setFormError('Latitude must be a number between -90 and 90.');
        setSaving(false);
        return;
      }
    }
    if (longitude.trim()) {
      lngNum = parseFloat(longitude);
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        setFormError('Longitude must be a number between -180 and 180.');
        setSaving(false);
        return;
      }
    }

    const derivedLocation = deriveLocationLabel({
      area: area.trim() || null,
      city: city.trim() || null,
      province: province.trim() || null,
    });

    try {
      const extraData = {
        address_line: addressLine.trim() || null,
        building_name: buildingName.trim() || null,
        shop_number: shopNumber.trim() || null,
        area: area.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        latitude: latNum,
        longitude: lngNum,
        instagram_url: cleanedInstagram,
        tiktok_url: cleanedTiktok,
        facebook_url: cleanedFacebook,
        website_url: cleanedWebsite,
        opening_hours: hoursToSave as OpeningHours | null,
      };

      if (isEditing && store) {
        await updateStore(store.id, {
          name,
          description,
          location: derivedLocation,
          phone,
          whatsapp,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          ...extraData,
        });
      } else {
        if (!user) throw new Error('Not authenticated');
        await createStore({
          sellerId: user.id,
          name,
          description,
          location: derivedLocation,
          phone,
          whatsapp,
          logoUrl,
          bannerUrl,
          ...extraData,
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

  const inputClass = 'w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900';

  return (
    <SellerLayout activePage="store">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">
          {isEditing ? 'Edit Your Store' : 'Create Your Store'}
        </h1>
        <p className="text-sm text-neutral-500">
          {isEditing
            ? 'Update your store details, location, and contact information'
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

      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* Branding section */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">Branding</h2>

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
              className={inputClass}
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
              className={`${inputClass} resize-none`}
              placeholder="Tell customers about your store..."
            />
          </div>
        </div>

        {/* Store Location & Contact */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">Store Location & Contact</h2>
          </div>
          <p className="text-xs text-neutral-500 -mt-2">Enter your shop address so customers can find you and get directions. A short location label is generated automatically from the area and city for store cards.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Street Address</label>
              <input type="text" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={inputClass} placeholder="123 Main Street" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Building / Shopping Centre</label>
              <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} className={inputClass} placeholder="e.g. Gandhi Square Mall" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Shop Number</label>
              <input type="text" value={shopNumber} onChange={(e) => setShopNumber(e.target.value)} className={inputClass} placeholder="Shop B12" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Area</label>
              <input type="text" value={area} onChange={(e) => setArea(e.target.value)} className={inputClass} placeholder="Small Street" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="Johannesburg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Province</label>
              <input type="text" value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass} placeholder="Gauteng" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Postal Code</label>
              <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} placeholder="2000" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Google Maps URL (optional)</label>
              <input type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} className={inputClass} placeholder="https://maps.app.goo.gl/..." />
              <p className="text-xs text-neutral-400 mt-1">A Google Maps share link for your shop.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Latitude</label>
                <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} placeholder="-26.2041" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Longitude</label>
                <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} placeholder="28.0473" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="+27 82 123 4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <MessageCircle size={14} /> WhatsApp Number
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
                placeholder="082 123 4567 or +27 82 123 4567"
              />
              <p className="text-xs text-neutral-400 mt-1">South African numbers. Local 0 or +27 format accepted.</p>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">Social Media & Website</h2>
          </div>
          <p className="text-xs text-neutral-500 -mt-2">Optional. Enter a full URL or just your username for social platforms.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Instagram</label>
              <input type="text" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={inputClass} placeholder="@username or https://instagram.com/username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">TikTok</label>
              <input type="text" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} className={inputClass} placeholder="@username or https://tiktok.com/@username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Facebook</label>
              <input type="text" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={inputClass} placeholder="https://facebook.com/yourpage" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Website</label>
              <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} placeholder="https://yourwebsite.co.za" />
            </div>
          </div>
        </div>

        {/* Opening Hours */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">Opening Hours</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableHours}
                onChange={(e) => setEnableHours(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <span className="text-sm text-neutral-600">Enable schedule</span>
            </label>
          </div>

          {enableHours ? (
            <OpeningHoursEditor hours={openingHours} onChange={setOpeningHours} />
          ) : (
            <p className="text-sm text-neutral-400">Opening hours not configured. Enable the schedule to set your weekly hours.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
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
