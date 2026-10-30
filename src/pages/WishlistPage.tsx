import { useState, useEffect } from 'react';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { navigateTo } from '@/hooks/useRouter';
import { useProductRatingSummaries } from '@/hooks/useRatingSummaries';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton, EmptyState } from '@/components/ui/States';
import { fetchProductsByIds } from '@/services/productService';
import type { Product } from '@/types';

export function WishlistPage() {
  const { wishlist, loading: wishlistLoading } = useWishlist();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wishlistLoading) return;
    if (wishlist.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    fetchProductsByIds(wishlist)
      .then((data) => {
        if (mounted) {
          setProducts(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Unable to load your wishlist. Please try again.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [wishlist, wishlistLoading]);

  const productIds = products.map((p) => p.id);
  const { summaries } = useProductRatingSummaries(productIds);

  if (wishlistLoading || loading) {
    return (
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-6">My Wishlist</h1>
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-6">My Wishlist</h1>
        <EmptyState
          title="Something went wrong"
          message={error}
          actionLabel="Try Again"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-6">My Wishlist</h1>
        <EmptyState
          title="Your wishlist is empty"
          message="Save products you love by tapping the heart icon on any product card."
          actionLabel="Start Shopping"
          onAction={() => navigateTo('/products')}
        />
      </div>
    );
  }

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">My Wishlist</h1>
          <p className="text-neutral-500 mt-1">
            {products.length} {products.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
        <button
          onClick={() => navigateTo('/products')}
          className="hidden sm:flex items-center gap-1 text-sm font-medium text-neutral-900 hover:gap-2 transition-all"
        >
          Continue Shopping
          <ArrowRight size={16} />
        </button>
      </div>

      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-6">
          Your wishlist is saved on this device.{' '}
          <button onClick={() => navigateTo('/login')} className="font-medium underline">
            Sign in
          </button>{' '}
          to save it to your account and access it from any device.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            ratingSummary={summaries[product.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
