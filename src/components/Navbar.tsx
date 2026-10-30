import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Menu,
  X,
  Heart,
  User,
  LogOut,
  Store,
  Truck,
  Settings,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { useNotificationBadge } from '@/context/NotificationBadgeContext';
import { navigateTo } from '@/hooks/useRouter';
import { fetchVisibleCategoryTree } from '@/services/categoryService';
import type { CategoryWithChildren } from '@/types';

interface NavbarProps {
  onSearch: (query: string) => void;
}

export function Navbar({ onSearch }: NavbarProps) {
  const { cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { unreadCount, unreadMessages } = useNotificationBadge();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [mobileExpandedDepts, setMobileExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [mobileOpen]);

  useEffect(() => {
    fetchVisibleCategoryTree().then(setCategoryTree).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onSearch(searchValue.trim());
      setSearchOpen(false);
      setMobileOpen(false);
      setSearchValue('');
    }
  };

  const go = (path: string) => {
    navigateTo(path);
    setMobileOpen(false);
    setUserMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    navigateTo('/');
  };

  const toggleMobileDept = (deptId: string) => {
    setMobileExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white shadow-md py-3' : 'bg-white/95 py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <button
              onClick={() => go('/')}
              className="flex items-center gap-2 shrink-0"
            >
              <span className="text-xl font-bold tracking-tight text-neutral-900">
                Small Street
              </span>
              <span className="text-xl font-light tracking-tight text-neutral-500">
                Fashion
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1" onMouseLeave={() => setHoveredDept(null)}>
              <button
                onClick={() => go('/')}
                className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
              >
                Home
              </button>
              {categoryTree.map((dept) => (
                <div
                  key={dept.id}
                  className="relative"
                  onMouseEnter={() => setHoveredDept(dept.id)}
                >
                  <button
                    onClick={() => go(`/products/${dept.slug}`)}
                    className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                  >
                    {dept.name}
                  </button>
                  {hoveredDept === dept.id && dept.children.length > 0 && (
                    <div className="absolute left-0 top-full pt-1 z-50">
                      <div className="w-56 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                        <button
                          onClick={() => go(`/products/${dept.slug}`)}
                          className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors border-b border-neutral-100"
                        >
                          Shop All {dept.name}
                        </button>
                        {dept.children.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => go(`/products/${sub.slug}`)}
                            className="block w-full text-left px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => go('/new-arrivals')}
                className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
              >
                New Arrivals
              </button>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setSearchOpen((s) => !s)}
                className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              <button
                onClick={() => go('/wishlist')}
                className="relative p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors hidden sm:block"
                aria-label="Wishlist"
              >
                <Heart size={20} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                onClick={openCart}
                className="relative p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                aria-label="Shopping cart"
              >
                <ShoppingBag size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-neutral-900 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>

              {user && (
                <button
                  onClick={() => go('/messages')}
                  className="relative p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {(unreadCount + unreadMessages) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                      {unreadCount + unreadMessages > 99 ? '99+' : unreadCount + unreadMessages}
                    </span>
                  )}
                </button>
              )}

              {/* User menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((s) => !s)}
                    className="flex items-center gap-1.5 p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                    aria-label="Account"
                  >
                    <User size={20} />
                  </button>
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-100">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {profile?.full_name || 'Account'}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">
                            {user.email}
                          </p>
                          <p className="text-xs text-neutral-400 mt-1 capitalize">
                            {profile?.role}
                          </p>
                        </div>
                        {profile?.role === 'seller' && (
                          <button
                            onClick={() => go('/seller')}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                          >
                            <Store size={16} />
                            Seller Dashboard
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => go('/admin')}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                          >
                            <Settings size={16} />
                            Admin Dashboard
                          </button>
                        )}
                        <button
                          onClick={() => go('/account')}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                          <User size={16} />
                          My Account
                        </button>
                        <button
                          onClick={() => go('/cart')}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                          <ShoppingBag size={16} />
                          My Cart
                        </button>
                        <button
                          onClick={() => go('/messages')}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                          <Bell size={16} />
                          Messages & Notifications
                          {(unreadCount + unreadMessages) > 0 && (
                            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-semibold">
                              {unreadCount + unreadMessages > 99 ? '99+' : unreadCount + unreadMessages}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => go('/deliveries')}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                          <Truck size={16} />
                          My Deliveries
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors border-t border-neutral-100"
                        >
                          <LogOut size={16} />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => go('/login')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                >
                  <User size={18} />
                  Sign In
                </button>
              )}

              <button
                onClick={() => setMobileOpen((s) => !s)}
                className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors lg:hidden"
                aria-label="Menu"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Search Bar (expandable) */}
          {searchOpen && (
            <div className="mt-3 pb-1">
              <form onSubmit={handleSearch} className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search for products, categories, stores..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
                />
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-72 max-w-[80vw] bg-white shadow-xl overflow-y-auto pt-20 pb-6">
            <nav className="flex flex-col px-4 gap-1">
              <button
                onClick={() => go('/')}
                className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Home
              </button>
              {categoryTree.map((dept) => (
                <div key={dept.id}>
                  <div className="flex items-center">
                    <button
                      onClick={() => go(`/products/${dept.slug}`)}
                      className="flex-1 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      {dept.name}
                    </button>
                    {dept.children.length > 0 && (
                      <button
                        onClick={() => toggleMobileDept(dept.id)}
                        className="p-2 text-neutral-400 hover:text-neutral-700"
                      >
                        <ChevronRight
                          size={16}
                          className={`transition-transform ${mobileExpandedDepts.has(dept.id) ? 'rotate-90' : ''}`}
                        />
                      </button>
                    )}
                  </div>
                  {mobileExpandedDepts.has(dept.id) && dept.children.length > 0 && (
                    <div className="ml-4 mb-1">
                      <button
                        onClick={() => go(`/products/${dept.slug}`)}
                        className="block w-full text-left px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        Shop All {dept.name}
                      </button>
                      {dept.children.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => go(`/products/${sub.slug}`)}
                          className="block w-full text-left px-4 py-2 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => go('/new-arrivals')}
                className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                New Arrivals
              </button>
              <div className="border-t border-neutral-200 my-3" />
              <button
                onClick={() => go('/stores')}
                className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Stores
              </button>
              <button
                onClick={() => go('/about')}
                className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                About
              </button>
              <button
                onClick={() => go('/contact')}
                className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Contact
              </button>
              <div className="border-t border-neutral-200 my-3" />
              {user ? (
                <>
                  {profile?.role === 'seller' && (
                    <button
                      onClick={() => go('/seller')}
                      className="flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      <Store size={16} />
                      Seller Dashboard
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => go('/admin')}
                      className="flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      <Settings size={16} />
                      Admin Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => go('/account')}
                    className="flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <User size={16} />
                    My Account
                  </button>
                  <button
                    onClick={() => go('/messages')}
                    className="flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <Bell size={16} />
                    Messages & Notifications
                  </button>
                  <button
                    onClick={() => go('/deliveries')}
                    className="flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <Truck size={16} />
                    My Deliveries
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => go('/login')}
                    className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => go('/register')}
                    className="px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    Create Account
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
