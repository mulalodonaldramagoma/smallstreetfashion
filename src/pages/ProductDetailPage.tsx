import { useState, useEffect, useMemo } from 'react';
import { Heart, ShoppingBag, Minus, Plus, MapPin, Store, ArrowLeft, Check } from 'lucide-react';
import { ShareButton } from '@/components/ShareButton';
import { useProductById, useCategories } from '@/hooks/useData';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { navigateTo } from '@/hooks/useRouter';
import { formatPrice, calculateDiscount } from '@/utils/format';
import { getProductTags } from '@/utils/productTags';
import { PRODUCT_TAG_LABELS } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { DetailSkeleton, ErrorState } from '@/components/ui/States';
import { fetchProducts } from '@/services/productService';
import { fetchProductRatingSummary } from '@/services/reviewService';
import { useProductRatingSummaries } from '@/hooks/useRatingSummaries';
import { ProductReviewsSection } from '@/components/ProductReviewsSection';
import { StarRating } from '@/components/StarRating';
import type { Product, RatingSummary } from '@/types';

interface ProductDetailPageProps {
  productId: string;
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const { data: product, loading, error } = useProductById(productId);
  const { addToCart, openCart } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColour, setSelectedColour] = useState<string>('');
  const [added, setAdded] = useState(false);
  const [related, setRelated] = useState<Product[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);

  const p = product as Product | null;

  useEffect(() => {
    if (p?.category?.slug) {
      fetchProducts({ category: p.category.slug })
        .then((items) => setRelated(items.filter((item) => item.id !== p.id).slice(0, 4)))
        .catch(() => setRelated([]));
    }
  }, [p?.id, p?.category?.slug]);

  useEffect(() => {
    if (p?.id) {
      fetchProductRatingSummary(p.id)
        .then(setRatingSummary)
        .catch(() => setRatingSummary(null));
    }
  }, [p?.id]);

  const relatedIds = useMemo(() => related.map((rp) => rp.id), [related]);
  const { summaries: relatedSummaries } = useProductRatingSummaries(relatedIds);

  if (loading) {
    return <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><DetailSkeleton /></div>;
  }

  if (error) {
    return <div className="pt-24 max-w-7xl mx-auto px-4 py-20"><ErrorState message="Unable to load this product. Please try again." /></div>;
  }

  if (!p) {
    return (
      <div className="pt-24 max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Product not found</h1>
        <p className="text-neutral-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigateTo('/products')} className="px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors">Back to Shop</button>
      </div>
    );
  }

  const discount = calculateDiscount(Number(p.price), p.compare_at_price ? Number(p.compare_at_price) : undefined);
  const wishlisted = isWishlisted(p.id);
  const imageUrl = p.main_image_url || p.product_images?.[0]?.image_url || 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
  const effectiveSize = selectedSize || p.sizes[0] || 'One Size';
  const effectiveColour = selectedColour || p.colours[0] || 'Default';
  const outOfStock = p.stock === 0;

  const handleAddToCart = () => {
    if (outOfStock) return;
    addToCart({ productId: p.id, name: p.name, price: Number(p.price), image: imageUrl, storeName: p.store?.name || 'Small Street Fashion', storeSlug: p.store?.slug, category: p.category?.name || '', size: effectiveSize, colour: effectiveColour, stock: p.stock }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (outOfStock) return;
    addToCart({ productId: p.id, name: p.name, price: Number(p.price), image: imageUrl, storeName: p.store?.name || 'Small Street Fashion', storeSlug: p.store?.slug, category: p.category?.name || '', size: effectiveSize, colour: effectiveColour, stock: p.stock }, quantity);
    openCart();
  };

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigateTo(`/products/${p.category?.slug || 'all'}`)} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors">
        <ArrowLeft size={16} />Back to {p.category?.name || 'Shop'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <div className="relative">
          <div className="aspect-square rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
            <img src={imageUrl} alt={p.name} className="w-full h-full object-cover" />
          </div>
          {discount && <span className="absolute top-4 left-4 bg-rose-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg">-{discount}% OFF</span>}
          {p.product_images && p.product_images.length > 0 && (
            <div className="mt-3 flex gap-3 overflow-x-auto">
              {p.product_images.map((img) => (
                <div key={img.id} className="w-20 h-20 rounded-lg overflow-hidden border border-neutral-200 shrink-0">
                  <img src={img.image_url} alt={p.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="mb-4">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{p.category?.name || 'Fashion'}</span>
            <h1 className="text-3xl font-bold text-neutral-900 mt-1 mb-2">{p.name}</h1>
            {(() => {
              const detailTags = getProductTags(p);
              if (detailTags.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {detailTags.map((tag) => {
                    const colors: Record<string, string> = {
                      new: 'bg-neutral-900 text-white',
                      trending: 'bg-amber-500 text-white',
                      sale: 'bg-rose-500 text-white',
                      limited_stock: 'bg-orange-500 text-white',
                    };
                    return (
                      <span key={tag} className={`text-xs font-semibold px-2 py-1 rounded-md ${colors[tag] || 'bg-neutral-200 text-neutral-700'}`}>
                        {PRODUCT_TAG_LABELS[tag]}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-bold text-neutral-900">{formatPrice(Number(p.price))}</span>
              {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && <span className="text-lg text-neutral-400 line-through">{formatPrice(Number(p.compare_at_price))}</span>}
            </div>
            {ratingSummary && ratingSummary.totalReviews > 0 && (
              <div className="mb-4">
                <StarRating rating={ratingSummary.avgRating} size={16} showValue count={ratingSummary.totalReviews} />
              </div>
            )}

            {/* Store */}
            <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 mb-5">
              <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center shrink-0"><Store size={18} className="text-white" /></div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Sold by</p>
                <p className="text-sm font-semibold text-neutral-900">{p.store?.name || 'Small Street Fashion'}</p>
                <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5"><MapPin size={12} />{p.store?.location || 'Johannesburg CBD'}</div>
              </div>
              {p.store?.slug && <button onClick={() => navigateTo(`/store/${p.store!.slug}`)} className="ml-auto text-sm font-medium text-neutral-900 hover:underline shrink-0">View Store</button>}
            </div>

            {/* Stock */}
            <div className="mb-5">
              {outOfStock ? (
                <span className="text-sm font-medium text-rose-600">Out of Stock</span>
              ) : p.stock <= 5 ? (
                <span className="text-sm font-medium text-amber-600">Only {p.stock} left in stock</span>
              ) : (
                <span className="text-sm font-medium text-green-600">In Stock</span>
              )}
            </div>

            <p className="text-sm text-neutral-600 leading-relaxed mb-6">{p.description || 'No description available.'}</p>

            {/* Colours */}
            {p.colours.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-neutral-900 mb-2">Colour: <span className="font-normal text-neutral-600">{effectiveColour}</span></p>
                <div className="flex flex-wrap gap-2">
                  {p.colours.map((colour) => (
                    <button key={colour} onClick={() => setSelectedColour(colour)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${effectiveColour === colour ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'}`}>{colour}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            {p.sizes.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-neutral-900 mb-2">Size: <span className="font-normal text-neutral-600">{effectiveSize}</span></p>
                <div className="flex flex-wrap gap-2">
                  {p.sizes.map((size) => (
                    <button key={size} onClick={() => setSelectedSize(size)} className={`min-w-[44px] h-11 px-3 text-sm font-medium rounded-lg border transition-colors ${effectiveSize === size ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'}`}>{size}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-neutral-900 mb-2">Quantity</p>
              <div className="flex items-center border border-neutral-200 rounded-lg w-fit">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-3 text-neutral-600 hover:text-neutral-900 transition-colors" aria-label="Decrease quantity"><Minus size={16} /></button>
                <span className="px-5 text-sm font-semibold text-neutral-900">{quantity}</span>
                <button onClick={() => setQuantity((q) => (q < p.stock ? q + 1 : q))} className="p-3 text-neutral-600 hover:text-neutral-900 transition-colors" aria-label="Increase quantity"><Plus size={16} /></button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-4">
              <button onClick={handleAddToCart} disabled={outOfStock} className={`flex-1 py-3.5 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${added ? 'bg-green-600 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}>
                {added ? <><Check size={18} />Added to Cart</> : <><ShoppingBag size={18} />Add to Cart</>}
              </button>
              <button onClick={handleBuyNow} disabled={outOfStock} className="flex-1 py-3.5 bg-white border-2 border-neutral-900 text-neutral-900 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Buy Now</button>
              <button onClick={() => toggleWishlist(p.id)} className="p-3.5 border border-neutral-200 rounded-lg text-neutral-700 hover:text-rose-500 hover:border-rose-300 transition-colors" aria-label="Add to wishlist">
                <Heart size={20} fill={wishlisted ? '#f43f5e' : 'none'} color={wishlisted ? '#f43f5e' : 'currentColor'} />
              </button>
              <ShareButton
                title={p.name}
                description={`${formatPrice(Number(p.price))} — ${p.store?.name || 'Small Street Fashion'}`}
                url={`${window.location.origin}${window.location.pathname}#/product/${p.id}`}
                image={imageUrl}
                className="flex items-center justify-center gap-2 px-5 py-3.5 border border-neutral-200 rounded-lg text-sm font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              />
            </div>
            <div className="text-xs text-neutral-400 bg-amber-50 border border-amber-200 rounded-lg p-3">Payments and courier delivery will be introduced in a later version.</div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {related.map((rp) => <ProductCard key={rp.id} product={rp} ratingSummary={relatedSummaries[rp.id] ?? null} />)}
          </div>
        </div>
      )}

      <ProductReviewsSection productId={p.id} />
    </div>
  );
}
