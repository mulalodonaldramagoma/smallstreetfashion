import { ArrowLeft, MapPin, Package, Store as StoreIcon, Phone, Clock, Instagram, Facebook, Globe, Navigation, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ShareButton } from '@/components/ShareButton';
import { useStoreBySlug } from '@/hooks/useData';
import { fetchProductsByStore } from '@/services/storeService';
import { ProductCard } from '@/components/ProductCard';
import { navigateTo } from '@/hooks/useRouter';
import { DetailSkeleton, ErrorState, EmptyState, ProductGridSkeleton } from '@/components/ui/States';
import {
  buildWhatsAppUrl,
  buildDirectionsUrl,
  formatStoreAddress,
  getStoreOpenStatus,
  formatTime12h,
  hasConfiguredHours,
  DAYS_OF_WEEK,
} from '@/utils/storeUtils';
import type { Product, Store as StoreType, RatingSummary } from '@/types';
import { StoreReviewsSection } from '@/components/StoreReviewsSection';
import { fetchStoreRatingSummary } from '@/services/reviewService';
import { StarRating } from '@/components/StarRating';

interface StoreDetailPageProps {
  storeSlug: string;
}

// TikTok icon (not in lucide-react)
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export function StoreDetailPage({ storeSlug }: StoreDetailPageProps) {
  const { data: store, loading, error } = useStoreBySlug(storeSlug);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [storeRating, setStoreRating] = useState<RatingSummary | null>(null);

  const s = store as StoreType | null;

  useEffect(() => {
    if (s?.id) {
      setProductsLoading(true);
      fetchProductsByStore(s.id)
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setProductsLoading(false));
    }
  }, [s?.id]);

  useEffect(() => {
    if (s?.id) {
      fetchStoreRatingSummary(s.id)
        .then(setStoreRating)
        .catch(() => setStoreRating(null));
    }
  }, [s?.id]);

  if (loading) {
    return <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><DetailSkeleton /></div>;
  }

  if (error || !s) {
    return (
      <div className="pt-24 max-w-7xl mx-auto px-4 py-20">
        <ErrorState message="Unable to load this store. Please try again." />
        <div className="text-center mt-4">
          <button onClick={() => navigateTo('/stores')} className="px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors">View All Stores</button>
        </div>
      </div>
    );
  }

  const address = formatStoreAddress(s);
  const directionsUrl = buildDirectionsUrl(s);
  const whatsappUrl = buildWhatsAppUrl(s.whatsapp || '');
  const openStatus = getStoreOpenStatus(s.opening_hours);
  const hoursConfigured = hasConfiguredHours(s.opening_hours);

  const socialLinks: { url: string; label: string; icon: React.ReactNode }[] = [];
  if (s.instagram_url) socialLinks.push({ url: s.instagram_url, label: 'Instagram', icon: <Instagram size={16} /> });
  if (s.tiktok_url) socialLinks.push({ url: s.tiktok_url, label: 'TikTok', icon: <TikTokIcon size={16} /> });
  if (s.facebook_url) socialLinks.push({ url: s.facebook_url, label: 'Facebook', icon: <Facebook size={16} /> });
  if (s.website_url) socialLinks.push({ url: s.website_url, label: 'Website', icon: <Globe size={16} /> });

  const statusBadge = (() => {
    if (!hoursConfigured) return null;
    switch (openStatus.status) {
      case 'open':
        return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Open now · closes {formatTime12h(openStatus.closesAt)}</span>;
      case 'opens':
        return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Opens {formatTime12h(openStatus.opensAt)}</span>;
      case 'closed':
        return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Closed now</span>;
      default:
        return null;
    }
  })();

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigateTo('/stores')} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors">
        <ArrowLeft size={16} />Back to Stores
      </button>

      {/* Share bar */}
      <div className="flex justify-end mb-4">
        <ShareButton
          title={s.name}
          description={s.description || 'A Small Street Fashion store'}
          url={`${window.location.origin}${window.location.pathname}#/store/${s.slug}`}
          image={s.logo_url || s.banner_url}
        />
      </div>

      {/* Store Header */}
      <div className="relative h-64 rounded-2xl overflow-hidden mb-8 bg-neutral-100">
        {s.banner_url ? (
          <img src={s.banner_url} alt={s.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          {s.logo_url && (
            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-lg shrink-0">
              <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <StoreIcon size={16} /><span>Small Street Store</span>
              {s.is_verified && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Verified</span>}
            </div>
            <h1 className="text-3xl font-bold text-white">{s.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-white/80 text-sm flex-wrap">
              <span className="flex items-center gap-1"><MapPin size={14} />{address || s.location}</span>
              <span className="flex items-center gap-1"><Package size={14} />{products.length} products</span>
              {storeRating && storeRating.totalReviews > 0 && (
                <span className="flex items-center gap-1.5">
                  <StarRating rating={storeRating.avgRating} size={14} className="[&_svg]:text-white" />
                  <span className="text-white/80">{storeRating.avgRating.toFixed(1)} ({storeRating.totalReviews})</span>
                </span>
              )}
              {statusBadge}
            </div>
          </div>
        </div>
      </div>

      {/* Store Info + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <p className="text-neutral-600 leading-relaxed">{s.description || 'A Small Street Fashion store'}</p>

          {/* Contact & Location section */}
          <div className="mt-6 space-y-4">
            {/* Address & Directions */}
            {address && (
              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-neutral-400" /> Store Address
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{address}</p>
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    <Navigation size={15} /> Get Directions
                  </a>
                )}
              </div>
            )}

            {/* Opening Hours */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <Clock size={16} className="text-neutral-400" /> Opening Hours
              </h3>
              {!hoursConfigured ? (
                <p className="text-sm text-neutral-400 italic">Opening hours not provided</p>
              ) : (
                <>
                  {statusBadge}
                  <div className="mt-3 space-y-1.5">
                    {DAYS_OF_WEEK.map((dayInfo) => {
                      const dayHours = s.opening_hours?.find((d) => d.day === dayInfo.day);
                      const isToday = (() => {
                        const now = new Date();
                        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
                        const joburg = new Date(utcMs + 2 * 3600000);
                        const jsDay = joburg.getDay();
                        const todayNum = jsDay === 0 ? 7 : jsDay;
                        return dayInfo.day === todayNum;
                      })();
                      return (
                        <div key={dayInfo.day} className={`flex items-center justify-between text-sm py-1 ${isToday ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>
                          <span className="flex items-center gap-2">
                            {dayInfo.label}
                            {isToday && <span className="text-xs text-blue-600">Today</span>}
                          </span>
                          <span className="text-right">
                            {!dayHours || dayHours.is_closed || dayHours.periods.length === 0 ? (
                              <span className="text-neutral-400">Closed</span>
                            ) : (
                              dayHours.periods.map((p, i) => (
                                <span key={i} className="block">
                                  {formatTime12h(p.open)} – {formatTime12h(p.close)}
                                </span>
                              ))
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Contact Sidebar */}
        <div className="space-y-4">
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Contact Information</h3>
            {s.phone && (
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Phone size={14} className="shrink-0" /> {s.phone}
              </div>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                <MessageCircle size={14} className="shrink-0" /> Chat on WhatsApp
              </a>
            )}
            {address && (
              <div className="flex items-start gap-2 text-sm text-neutral-600">
                <MapPin size={14} className="shrink-0 mt-0.5" />
                <span>{s.location}</span>
              </div>
            )}
            {!s.phone && !whatsappUrl && !address && (
              <p className="text-sm text-neutral-400 italic">No contact details provided</p>
            )}
          </div>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 space-y-2">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Follow & Visit</h3>
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-neutral-500">{link.icon}</span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Products from {s.name}</h2>

      {productsLoading ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <EmptyState title="No products available" message="This store hasn't added any products yet." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}

      <StoreReviewsSection storeId={s.id} sellerId={s.seller_id} />
    </div>
  );
}
