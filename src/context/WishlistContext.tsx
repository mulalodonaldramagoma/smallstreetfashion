import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface WishlistContextValue {
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  wishlistCount: number;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const STORAGE_KEY = 'ssf_wishlist';

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const syncingRef = useRef(false);

  // Load from localStorage on mount (for guests or before auth resolves)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setWishlist(JSON.parse(stored) as string[]);
    } catch {
      // ignore
    }
  }, []);

  // When user signs in, load DB wishlist and merge localStorage items
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        syncingRef.current = true;
        const { data: dbItems, error } = await supabase
          .from('wishlist_items')
          .select('product_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const dbIds = (dbItems || []).map((r) => r.product_id as string);

        // Merge localStorage guest items into DB
        let guestIds: string[] = [];
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) guestIds = JSON.parse(stored) as string[];
        } catch {
          // ignore
        }

        const toAdd = guestIds.filter((id) => !dbIds.includes(id));
        if (toAdd.length > 0) {
          await supabase
            .from('wishlist_items')
            .insert(
              toAdd.map((product_id) => ({
                user_id: user.id,
                product_id,
              }))
            );
        }

        if (mounted) {
          setWishlist([...new Set([...dbIds, ...toAdd])]);
          setLoading(false);
        }

        // Clear localStorage after successful merge
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      } catch {
        // If DB sync fails, fall back to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored && mounted) setWishlist(JSON.parse(stored) as string[]);
          if (mounted) setLoading(false);
        } catch {
          if (mounted) setLoading(false);
        }
      } finally {
        syncingRef.current = false;
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Persist to localStorage for guests
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
      } catch {
        // ignore
      }
    }
  }, [wishlist, user]);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const isAdded = wishlist.includes(productId);

      // Optimistic update
      setWishlist((prev) =>
        isAdded ? prev.filter((id) => id !== productId) : [...prev, productId]
      );

      if (user && !syncingRef.current) {
        if (isAdded) {
          supabase
            .from('wishlist_items')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .then(({ error }) => {
              if (error) {
                setWishlist((prev) => [...prev, productId]);
              }
            });
        } else {
          supabase
            .from('wishlist_items')
            .insert({ user_id: user.id, product_id: productId })
            .then(({ error }) => {
              if (error) {
                setWishlist((prev) => prev.filter((id) => id !== productId));
              }
            });
        }
      }
    },
    [wishlist, user]
  );

  const isWishlisted = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        toggleWishlist,
        isWishlisted,
        wishlistCount: wishlist.length,
        loading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
