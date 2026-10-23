import { Heart, ShoppingBag } from 'lucide-react';
import type { Product, RatingSummary } from '@/types';
import { StarRating } from '@/components/StarRating';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { navigateTo } from '@/hooks/useRouter';
import { formatPrice, calculateDiscount } from '@/utils/format';

interface ProductCardProps {
  product: Product;
  ratingSummary?: RatingSummary | null;
}

export function ProductCard({ product, ratingSummary }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const discount = calculateDiscount(
    Number(product.price),
    product.compare_at_price ? Number(product.compare_at_price) : undefined
  );
  const wishlisted = isWishlisted(product.id);

  const imageUrl =
    product.main_image_url ||
    product.product_images?.[0]?.image_url ||
    'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

  const handleCardClick = () => {
    navigateTo(`/product/${product.id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultSize = product.sizes[0] || 'One Size';
    const defaultColour = product.colours[0] || 'Default';
    addToCart(
      {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        image: imageUrl,
        storeName: product.store?.name || 'Small Street Fashion',
        storeSlug: product.store?.slug,
        category: product.category?.name || '',
        size: defaultSize,
        colour: defaultColour,
        stock: product.stock,
      },
      1
    );
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const isNew = (() => {
    const created = new Date(product.created_at).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return created > thirtyDaysAgo;
  })();

  const outOfStock = product.stock === 0;

  return (
    <div
      onClick={handleCardClick}
      className={`group cursor-pointer bg-white rounded-xl overflow-hidden border border-neutral-200 hover:shadow-lg hover:border-neutral-300 transition-all duration-300 ${
        outOfStock ? 'opacity-60' : ''
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        <img
          src={imageUrl}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {discount && (
            <span className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-md">
              -{discount}%
            </span>
          )}
          {isNew && !outOfStock && (
            <span className="bg-neutral-900 text-white text-xs font-bold px-2 py-1 rounded-md">
              NEW
            </span>
          )}
          {outOfStock && (
            <span className="bg-neutral-500 text-white text-xs font-bold px-2 py-1 rounded-md">
              SOLD OUT
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={handleWishlist}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur rounded-full text-neutral-700 hover:text-rose-500 hover:bg-white transition-colors shadow-sm"
          aria-label="Add to wishlist"
        >
          <Heart
            size={18}
            fill={wishlisted ? '#f43f5e' : 'none'}
            color={wishlisted ? '#f43f5e' : 'currentColor'}
          />
        </button>

        {/* Quick Add to Cart */}
        {!outOfStock && (
          <button
            onClick={handleAddToCart}
            className="absolute bottom-0 left-0 right-0 bg-neutral-900 text-white py-3 text-sm font-medium flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
          >
            <ShoppingBag size={16} />
            Add to Cart
          </button>
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <p className="text-xs text-neutral-500 mb-1">
          {product.store?.name || 'Small Street Fashion'}
        </p>
        <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1 mb-1">
          {product.name}
        </h3>
        <p className="text-xs text-neutral-400 mb-2">
          {product.category?.name || 'Fashion'}
        </p>
        {ratingSummary && ratingSummary.totalReviews > 0 && (
          <div className="mb-2">
            <StarRating rating={ratingSummary.avgRating} size={12} showValue count={ratingSummary.totalReviews} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-neutral-900">
            {formatPrice(Number(product.price))}
          </span>
          {product.compare_at_price &&
            Number(product.compare_at_price) > Number(product.price) && (
              <span className="text-sm text-neutral-400 line-through">
                {formatPrice(Number(product.compare_at_price))}
              </span>
            )}
        </div>
      </div>
    </div>
  );
}
