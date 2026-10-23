import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, AlertCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/format';
import { navigateTo } from '@/hooks/useRouter';

export function CartPage() {
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    deliveryFee,
    total,
    cartCount,
  } = useCart();

  if (items.length === 0) {
    return (
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag size={32} className="text-neutral-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            Your cart is empty
          </h1>
          <p className="text-neutral-500 mb-6">
            Browse our collections and add your favourite items.
          </p>
          <button
            onClick={() => navigateTo('/products')}
            className="px-7 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-neutral-900 mb-2">
        Shopping Cart
      </h1>
      <p className="text-neutral-500 mb-8">
        {cartCount} {cartCount === 1 ? 'item' : 'items'} in your cart
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const atStockLimit = item.quantity >= item.stock;
            return (
              <div
                key={`${item.productId}-${item.size}-${item.colour}`}
                className="flex gap-4 bg-white border border-neutral-200 rounded-xl p-4"
              >
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-neutral-100 shrink-0 cursor-pointer"
                  onClick={() => navigateTo(`/product/${item.productId}`)}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mb-1">
                    {item.storeName}
                  </p>
                  <p className="text-xs text-neutral-400 mb-3">
                    Size: {item.size} &middot; Colour: {item.colour}
                  </p>
                  <p className="text-xs text-neutral-500 mb-3">
                    {formatPrice(item.price)} each
                  </p>

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center border border-neutral-200 rounded-lg">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.size,
                            item.colour,
                            item.quantity - 1
                          )
                        }
                        className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-4 text-sm font-semibold text-neutral-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.size,
                            item.colour,
                            item.quantity + 1
                          )
                        }
                        disabled={atStockLimit}
                        className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-neutral-900">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() =>
                          removeFromCart(item.productId, item.size, item.colour)
                        }
                        className="text-neutral-400 hover:text-rose-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {atStockLimit && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Only {item.stock} in stock
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex justify-between items-center pt-4">
            <button
              onClick={() => navigateTo('/products')}
              className="flex items-center gap-1 text-sm font-medium text-neutral-900 hover:gap-2 transition-all"
            >
              <ArrowRight size={16} className="rotate-180" />
              Continue Shopping
            </button>
            <button
              onClick={clearCart}
              className="text-sm text-neutral-500 hover:text-rose-500 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white border border-neutral-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">
              Order Summary
            </h2>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-medium text-neutral-900">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Delivery fee</span>
                <span className="font-medium text-neutral-900">
                  {formatPrice(deliveryFee)}
                </span>
              </div>
              <div className="border-t border-neutral-200 pt-3 flex items-center justify-between">
                <span className="font-semibold text-neutral-900">Total</span>
                <span className="text-xl font-bold text-neutral-900">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 mb-4">
              Delivery fee is a flat rate across South Africa. Courier integration will be added in a future version.
            </p>

            <button
              onClick={() => navigateTo('/checkout')}
              className="w-full py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
            >
              Proceed to Checkout
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
