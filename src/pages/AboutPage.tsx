import { Store, MapPin, Truck, Sparkles, Heart } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 mb-3">
          About Small Street Fashion
        </h1>
        <p className="text-lg text-neutral-500">
          Johannesburg Fashion. Delivered to You.
        </p>
      </div>

      <div className="prose prose-neutral max-w-none space-y-6">
        <p className="text-neutral-600 leading-relaxed">
          Small Street Fashion is an online marketplace that brings together
          independent fashion retailers from Small Street and the Johannesburg
          CBD. Our mission is to give these local stores a digital home where
          customers across South Africa can discover and shop their latest
          collections.
        </p>

        <p className="text-neutral-600 leading-relaxed">
          Small Street has long been one of Johannesburg's most vibrant fashion
          destinations &mdash; a place where style, culture and entrepreneurship
          meet. We're building a platform that carries that energy online,
          making it easy to browse, discover and order fashion from multiple
          stores in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
        <div className="text-center p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Store size={22} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">Local Stores</h3>
          <p className="text-sm text-neutral-500">
            Discover independent retailers from Johannesburg CBD
          </p>
        </div>

        <div className="text-center p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Truck size={22} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">
            Nationwide Delivery
          </h3>
          <p className="text-sm text-neutral-500">
            Order from Small Street, delivered across South Africa
          </p>
        </div>

        <div className="text-center p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Heart size={22} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">
            Support Local
          </h3>
          <p className="text-sm text-neutral-500">
            Every purchase supports a local fashion business
          </p>
        </div>
      </div>

      <div className="mt-12 p-6 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <Sparkles size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-neutral-900 mb-1">
            Stage 1: Storefront Demo
          </h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            This is Stage 1 of our marketplace. You can browse products, search,
            filter and build a cart. Payments, courier delivery and verified
            seller accounts will be introduced in later versions.
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-neutral-500">
        <MapPin size={16} />
        Johannesburg CBD, Gauteng, South Africa
      </div>
    </div>
  );
}
