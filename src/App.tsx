import { useCallback, type ReactNode } from 'react';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useRouter, navigateTo } from '@/hooks/useRouter';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CartDrawer } from '@/components/CartDrawer';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { NewArrivalsPage } from '@/pages/NewArrivalsPage';
import { StoresPage } from '@/pages/StoresPage';
import { StoreDetailPage } from '@/pages/StoreDetailPage';
import { SearchPage } from '@/pages/SearchPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import {
  PaymentVerifyPage,
  PaymentSuccessPage,
  PaymentFailedPage,
  PaymentCancelledPage,
  PaymentPendingPage,
} from '@/pages/PaymentResultPages';
import { SellerOverviewPage } from '@/pages/seller/SellerOverviewPage';
import { SellerStorePage } from '@/pages/seller/SellerStorePage';
import { SellerProductsPage } from '@/pages/seller/SellerProductsPage';
import { SellerProductFormPage } from '@/pages/seller/SellerProductFormPage';
import { SellerInventoryPage } from '@/pages/seller/SellerInventoryPage';
import { SellerProfilePage } from '@/pages/seller/SellerProfilePage';
import { SellerDispatchPage } from '@/pages/seller/SellerDispatchPage';
import { SellerEarningsPage } from '@/pages/seller/SellerEarningsPage';
import { SellerReviewsPage } from '@/pages/seller/SellerReviewsPage';
import { DeliveryTrackingPage } from '@/pages/DeliveryTrackingPage';
import { AdminDeliverySettingsPage } from '@/pages/admin/AdminDeliverySettingsPage';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminStoresPage } from '@/pages/admin/AdminStoresPage';
import { AdminProductsPage } from '@/pages/admin/AdminProductsPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminAuditLogPage } from '@/pages/admin/AdminAuditLogPage';
import { AdminMessagesPage } from '@/pages/admin/AdminMessagesPage';
import { AdminReconciliationPage } from '@/pages/admin/AdminReconciliationPage';
import { AdminReviewsPage } from '@/pages/admin/AdminReviewsPage';
import { MessagesNotificationsPage } from '@/pages/MessagesNotificationsPage';
import { AdminLayout } from '@/components/AdminLayout';
import { NotificationBadgeProvider } from '@/context/NotificationBadgeContext';

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigateTo('/login');
    return null;
  }

  if (!isAdmin) {
    navigateTo('/');
    return null;
  }

  return <>{children}</>;
}

function SellerRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigateTo('/login');
    return null;
  }

  if (profile?.role === 'customer') {
    navigateTo('/');
    return null;
  }

  return <>{children}</>;
}

function Routes() {
  const { route } = useRouter();
  const { path, params } = route;

  const renderPage = () => {
    switch (path) {
      case '/':
        return <HomePage />;
      case '/products':
        return <ShopPage category={params.category} />;
      case '/product':
        return <ProductDetailPage productId={params.id} />;
      case '/new-arrivals':
        return <NewArrivalsPage />;
      case '/stores':
        return <StoresPage />;
      case '/store':
        return <StoreDetailPage storeSlug={params.slug} />;
      case '/search':
        return <SearchPage query={params.q || ''} />;
      case '/cart':
        return <CartPage />;
      case '/checkout':
        return <CheckoutPage />;
      case '/about':
        return <AboutPage />;
      case '/contact':
        return <ContactPage />;
      case '/login':
        return <LoginPage />;
      case '/register':
        return <RegisterPage />;
      case '/payment/verify':
        return <PaymentVerifyPage reference={params.reference} />;
      case '/payment/success':
        return <PaymentSuccessPage reference={params.reference} />;
      case '/payment/cancelled':
        return <PaymentCancelledPage />;
      case '/payment/pending':
        return <PaymentPendingPage reference={params.reference} />;
      case '/payment/failed':
        return <PaymentFailedPage reference={params.reference} />;
      case '/seller':
        return <SellerRoute><SellerOverviewPage /></SellerRoute>;
      case '/seller/store':
        return <SellerRoute><SellerStorePage /></SellerRoute>;
      case '/seller/products':
        return <SellerRoute><SellerProductsPage /></SellerRoute>;
      case '/seller/products/new':
        return <SellerRoute><SellerProductFormPage /></SellerRoute>;
      case '/seller/products/edit':
        return <SellerRoute><SellerProductFormPage productId={params.id} /></SellerRoute>;
      case '/seller/inventory':
        return <SellerRoute><SellerInventoryPage /></SellerRoute>;
      case '/seller/profile':
        return <SellerRoute><SellerProfilePage /></SellerRoute>;
      case '/seller/dispatch':
        return <SellerRoute><SellerDispatchPage /></SellerRoute>;
      case '/seller/earnings':
        return <SellerRoute><SellerEarningsPage /></SellerRoute>;
      case '/seller/reviews':
        return <SellerRoute><SellerReviewsPage /></SellerRoute>;
      case '/deliveries':
        return <DeliveryTrackingPage />;
      case '/messages':
        return <MessagesNotificationsPage />;
      case '/admin':
        return <AdminRoute><AdminLayout activePage="overview"><AdminOverviewPage /></AdminLayout></AdminRoute>;
      case '/admin/stores':
        return <AdminRoute><AdminLayout activePage="stores"><AdminStoresPage /></AdminLayout></AdminRoute>;
      case '/admin/products':
        return <AdminRoute><AdminLayout activePage="products"><AdminProductsPage /></AdminLayout></AdminRoute>;
      case '/admin/orders':
        return <AdminRoute><AdminLayout activePage="orders"><AdminOrdersPage /></AdminLayout></AdminRoute>;
      case '/admin/categories':
        return <AdminRoute><AdminLayout activePage="categories"><AdminCategoriesPage /></AdminLayout></AdminRoute>;
      case '/admin/delivery-settings':
        return <AdminRoute><AdminLayout activePage="delivery"><AdminDeliverySettingsPage /></AdminLayout></AdminRoute>;
      case '/admin/audit':
        return <AdminRoute><AdminLayout activePage="audit"><AdminAuditLogPage /></AdminLayout></AdminRoute>;
      case '/admin/messages':
        return <AdminRoute><AdminLayout activePage="messages"><AdminMessagesPage /></AdminLayout></AdminRoute>;
      case '/admin/reconciliation':
        return <AdminRoute><AdminLayout activePage="reconciliation"><AdminReconciliationPage /></AdminLayout></AdminRoute>;
      case '/admin/reviews':
        return <AdminRoute><AdminLayout activePage="reviews"><AdminReviewsPage /></AdminLayout></AdminRoute>;
      default:
        return <HomePage />;
    }
  };

  const isSellerRoute = path.startsWith('/seller');
  const isAuthRoute = path === '/login' || path === '/register';
  const isDeliveryRoute = path === '/deliveries';
  const isAdminRoute = path.startsWith('/admin');
  const isMessagesRoute = path === '/messages';

  return (
    <main className="min-h-screen">
      {renderPage()}
      {!isSellerRoute && !isAuthRoute && !isDeliveryRoute && !isAdminRoute && !isMessagesRoute && <Footer />}
    </main>
  );
}

function App() {
  const handleSearch = useCallback((query: string) => {
    navigateTo(`/search/${query}`);
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <NotificationBadgeProvider>
            <div className="min-h-screen bg-white flex flex-col">
              <Navbar onSearch={handleSearch} />
              <div className="flex-1">
                <Routes />
              </div>
              <CartDrawer />
            </div>
          </NotificationBadgeProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
