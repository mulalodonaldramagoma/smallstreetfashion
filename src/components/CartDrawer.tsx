import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/format';
import { navigateTo } from '@/hooks/useRouter';

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    subtotal,
    deliveryFee,
    total,
  } = useCart();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <ShoppingBag size={20} />
            Your Cart
          </h2>
          <button
            onClick={closeCart}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={28} className="text-neutral-400" />
            </div>
            <p className="text-neutral-600 font-medium mb-1">
              Your cart is empty
            </p>
            <p className="text-sm text-neutral-400 mb-6">
              Start shopping to add items to your cart.
            </p>
            <button
              onClick={() => {
                closeCart();
                navigateTo('/products');
              }}
              className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.size}-${item.colour}`}
                  className="flex gap-3"
                >
                  <div
                    className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 shrink-0 cursor-pointer"
                    onClick={() => {
                      closeCart();
                      navigateTo(`/product/${item.productId}`);
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-neutral-900 line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="text-xs text-neutral-500 mb-1">
                      {item.storeName}
                    </p>
                    <p className="text-xs text-neutral-400 mb-2">
                      Size: {item.size} &middot; {item.colour}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-neutral-200 rounded-md">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.size,
                              item.colour,
                              item.quantity - 1
                            )
                          }
                          className="p-1.5 text-neutral-600 hover:text-neutral-900 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-3 text-sm font-medium text-neutral-900">
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
                          disabled={item.quantity >= item.stock}
                          className="p-1.5 text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-neutral-900">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                        <button
                          onClick={() =>
                            removeFromCart(
                              item.productId,
                              item.size,
                              item.colour
                            )
                          }
                          className="text-neutral-400 hover:text-rose-500 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t border-neutral-200 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-medium text-neutral-900">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Estimated delivery</span>
                <span className="font-medium text-neutral-900">
                  {formatPrice(deliveryFee)}
                </span>
              </div>
              <div className="flex items-center justify-between text-base pt-2 border-t border-neutral-100">
                <span className="font-semibold text-neutral-900">Total</span>
                <span className="font-bold text-neutral-900">
                  {formatPrice(total)}
                </span>
              </div>

              <button
                onClick={() => {
                  closeCart();
                  navigateTo('/cart');
                }}
                className="w-full py-3 bg-white border border-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition-colors"
              >
                View Cart
              </button>
              <button
                onClick={() => {
                  closeCart();
                  navigateTo('/checkout');
                }}
                className="w-full py-3 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
