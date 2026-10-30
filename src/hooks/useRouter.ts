import { useState, useEffect, useCallback } from 'react';

export interface Route {
  path: string;
  params: Record<string, string>;
}

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);

  if (parts.length === 0) return { path: '/', params: {} };

  if (parts[0] === 'product' && parts[1]) {
    return { path: '/product', params: { id: parts[1] } };
  }

  if (parts[0] === 'products' && parts[1]) {
    return { path: '/products', params: { category: parts[1] } };
  }

  // Keep backwards compat with /shop/:category
  if (parts[0] === 'shop') {
    return { path: '/products', params: { category: parts[1] || 'all' } };
  }

  if (parts[0] === 'store' && parts[1]) {
    return { path: '/store', params: { slug: parts[1] } };
  }

  if (parts[0] === 'search') {
    const query = decodeURIComponent(parts.slice(1).join('/'));
    return { path: '/search', params: { q: query } };
  }

  if (parts[0] === 'seller') {
    if (parts[1] === 'store') return { path: '/seller/store', params: {} };
    if (parts[1] === 'products') {
      if (parts[2] === 'new')
        return { path: '/seller/products/new', params: {} };
      if (parts[2] && parts[3] === 'edit')
        return { path: '/seller/products/edit', params: { id: parts[2] } };
      return { path: '/seller/products', params: {} };
    }
    if (parts[1] === 'inventory')
      return { path: '/seller/inventory', params: {} };
    if (parts[1] === 'dispatch')
      return { path: '/seller/dispatch', params: {} };
    if (parts[1] === 'profile')
      return { path: '/seller/profile', params: {} };
    return { path: '/seller', params: {} };
  }

  if (parts[0] === 'admin') {
    if (parts[1] === 'stores') return { path: '/admin/stores', params: {} };
    if (parts[1] === 'products') return { path: '/admin/products', params: {} };
    if (parts[1] === 'orders') return { path: '/admin/orders', params: {} };
    if (parts[1] === 'categories') return { path: '/admin/categories', params: {} };
    if (parts[1] === 'delivery-settings') return { path: '/admin/delivery-settings', params: {} };
    if (parts[1] === 'audit') return { path: '/admin/audit', params: {} };
    if (parts[1] === 'messages') return { path: '/admin/messages', params: {} };
    if (parts[1] === 'users') return { path: '/admin/users', params: {} };
    return { path: '/admin', params: {} };
  }

  if (parts[0] === 'deliveries') {
    return { path: '/deliveries', params: {} };
  }

  if (parts[0] === 'messages') {
    return { path: '/messages', params: {} };
  }

  if (parts[0] === 'payment' && parts[1] === 'verify' && parts[2]) {
    return { path: '/payment/verify', params: { reference: parts[2] } };
  }

  if (parts[0] === 'payment' && parts[1] === 'success' && parts[2]) {
    return { path: '/payment/success', params: { reference: parts[2] } };
  }

  if (parts[0] === 'payment' && parts[1] === 'cancelled') {
    return { path: '/payment/cancelled', params: {} };
  }

  if (parts[0] === 'payment' && parts[1] === 'pending' && parts[2]) {
    return { path: '/payment/pending', params: { reference: parts[2] } };
  }

  if (parts[0] === 'payment' && parts[1] === 'failed' && parts[2]) {
    return { path: '/payment/failed', params: { reference: parts[2] } };
  }

  const simpleRoutes: Record<string, string> = {
    'new-arrivals': '/new-arrivals',
    trending: '/trending',
    stores: '/stores',
    about: '/about',
    contact: '/contact',
    cart: '/cart',
    checkout: '/checkout',
    login: '/login',
    register: '/register',
    messages: '/messages',
    account: '/account',
    wishlist: '/wishlist',
  };

  const matched = simpleRoutes[parts[0]];
  if (matched) return { path: matched, params: {} };

  return { path: '/', params: {} };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const handler = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return { route, navigate };
}

export function navigateTo(to: string) {
  window.location.hash = to;
}
