import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Store,
  Package,
  PlusCircle,
  ClipboardList,
  Truck,
  User,
  Wallet,
  Menu,
  X,
  ArrowLeft,
  Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { navigateTo } from '@/hooks/useRouter';

interface SellerLayoutProps {
  children: ReactNode;
  activePage: string;
}

export function SellerLayout({ children, activePage }: SellerLayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/seller' },
    { id: 'store', label: 'My Store', icon: Store, path: '/seller/store' },
    { id: 'products', label: 'Products', icon: Package, path: '/seller/products' },
    { id: 'add-product', label: 'Add Product', icon: PlusCircle, path: '/seller/products/new' },
    { id: 'inventory', label: 'Inventory', icon: ClipboardList, path: '/seller/inventory' },
    { id: 'dispatch', label: 'Dispatch', icon: Truck, path: '/seller/dispatch' },
    { id: 'earnings', label: 'Earnings', icon: Wallet, path: '/seller/earnings' },
    { id: 'reviews', label: 'Reviews', icon: Star, path: '/seller/reviews' },
    { id: 'profile', label: 'Profile', icon: User, path: '/seller/profile' },
  ];

  const go = (path: string) => {
    navigateTo(path);
    setMobileNavOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigateTo('/');
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-neutral-200">
        <h2 className="font-bold text-neutral-900 text-lg">Seller Dashboard</h2>
        <p className="text-xs text-neutral-500 mt-0.5 truncate">
          {profile?.full_name || 'Seller'}
        </p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => go(item.path)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-neutral-200 space-y-1">
        <button
          onClick={() => go('/')}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Storefront
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <X size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="pt-16 min-h-screen bg-neutral-50">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-neutral-200 min-h-[calc(100vh-4rem)] sticky top-16">
          {sidebar}
        </aside>

        {/* Mobile Nav Toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-12 h-12 bg-neutral-900 text-white rounded-full shadow-lg flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
              {sidebar}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
