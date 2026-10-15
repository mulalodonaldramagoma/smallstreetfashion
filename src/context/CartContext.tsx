import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { CartItem } from '@/types';

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  removeFromCart: (productId: string, size: string, colour: string) => void;
  updateQuantity: (
    productId: string,
    size: string,
    colour: string,
    quantity: number
  ) => void;
  clearCart: () => void;
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  selectedDeliveryMethodId: string | null;
  setDeliveryMethod: (methodId: string | null, fee: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'ssf_cart';

function sameLine(
  item: CartItem,
  productId: string,
  size: string,
  colour: string
): boolean {
  return (
    item.productId === productId && item.size === size && item.colour === colour
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDeliveryMethodId, setSelectedDeliveryMethodId] = useState<string | null>(null);
  const [customDeliveryFee, setCustomDeliveryFee] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        // Clamp quantities to stock for items that have a stock field
        const safe = parsed.map((item) => ({
          ...item,
          stock: item.stock ?? 0,
          quantity: Math.min(item.quantity, item.stock ?? item.quantity),
        }));
        setItems(safe);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore write errors
    }
  }, [items]);

  const addToCart = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity: number) => {
      setItems((prev) => {
        const existing = prev.find((i) =>
          sameLine(i, item.productId, item.size, item.colour)
        );
        if (existing) {
          const newQty = Math.min(existing.quantity + quantity, item.stock);
          return prev.map((i) =>
            sameLine(i, item.productId, item.size, item.colour)
              ? { ...i, quantity: newQty }
              : i
          );
        }
        const clampedQty = Math.min(quantity, item.stock);
        return [...prev, { ...item, quantity: clampedQty }];
      });
      setIsOpen(true);
    },
    []
  );

  const removeFromCart = useCallback(
    (productId: string, size: string, colour: string) => {
      setItems((prev) =>
        prev.filter((i) => !sameLine(i, productId, size, colour))
      );
    },
    []
  );

  const updateQuantity = useCallback(
    (productId: string, size: string, colour: string, quantity: number) => {
      if (quantity < 1) return;
      setItems((prev) =>
        prev.map((i) => {
          if (!sameLine(i, productId, size, colour)) return i;
          return { ...i, quantity: Math.min(quantity, i.stock) };
        })
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedDeliveryMethodId(null);
    setCustomDeliveryFee(null);
  }, []);

  const setDeliveryMethod = useCallback((methodId: string | null, fee: number) => {
    setSelectedDeliveryMethodId(methodId);
    setCustomDeliveryFee(fee);
  }, []);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = items.length > 0 && selectedDeliveryMethodId
    ? (customDeliveryFee ?? 0)
    : 0;
  const total = subtotal + deliveryFee;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        subtotal,
        deliveryFee,
        total,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        selectedDeliveryMethodId,
        setDeliveryMethod,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
