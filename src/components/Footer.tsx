import { Instagram, Facebook, Music2, MessageCircle, MapPin } from 'lucide-react';
import { navigateTo } from '@/hooks/useRouter';

export function Footer() {
  const go = (path: string) => navigateTo(path);

  const shopLinks = [
    { label: 'Shop All', path: '/products' },
    { label: 'Women', path: '/products/women' },
    { label: 'Men', path: '/products/men' },
    { label: 'Shoes', path: '/products/shoes' },
    { label: 'Bags & Accessories', path: '/products/bags' },
    { label: 'New Arrivals', path: '/new-arrivals' },
  ];

  const infoLinks = [
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
    { label: 'Stores', path: '/stores' },
  ];

  return (
    <footer className="bg-neutral-900 text-neutral-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1">
            <h3 className="text-xl font-bold text-white mb-2">
              Small Street Fashion
            </h3>
            <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
              Johannesburg Fashion. Delivered to You.
            </p>
            <div className="flex items-center gap-1 text-sm text-neutral-400">
              <MapPin size={16} className="shrink-0" />
              <span>Johannesburg CBD, Gauteng, South Africa</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Shop
            </h4>
            <ul className="space-y-2">
              {shopLinks.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => go(link.path)}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Information
            </h4>
            <ul className="space-y-2">
              {infoLinks.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => go(link.path)}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Follow Us
            </h4>
            <div className="flex gap-3">
              {[
                { Icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/realsmallstreetfashion' },
                { Icon: Facebook, label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61595166965264' },
                { Icon: Music2, label: 'TikTok' },
                { Icon: MessageCircle, label: 'WhatsApp' },
              ].map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href || '#'}
                  onClick={(e) => { if (!href) e.preventDefault(); }}
                  target={href ? '_blank' : undefined}
                  rel={href ? 'noopener noreferrer' : undefined}
                  className="w-10 h-10 flex items-center justify-center bg-neutral-800 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                  aria-label={label}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">
            &copy; 2026 Small Street Fashion. All rights reserved.
          </p>
          <p className="text-sm text-neutral-600">
            Payments and courier delivery coming soon.
          </p>
        </div>
      </div>
    </footer>
  );
}
