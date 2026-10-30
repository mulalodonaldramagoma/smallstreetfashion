import { Mail, MapPin, MessageCircle, Clock } from 'lucide-react';

export function ContactPage() {
  return (
    <div className="pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 mb-3">
          Get in Touch
        </h1>
        <p className="text-lg text-neutral-500">
          Have a question? We'd love to hear from you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <div className="p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center mb-3">
            <Mail size={18} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">Email</h3>
          <p className="text-sm text-neutral-500">hello@smallstreetfashion.co.za</p>
        </div>

        <div className="p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center mb-3">
            <MessageCircle size={18} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">WhatsApp</h3>
          <p className="text-sm text-neutral-500">+27 11 000 0000</p>
        </div>

        <div className="p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center mb-3">
            <MapPin size={18} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">Location</h3>
          <p className="text-sm text-neutral-500">
            Small Street, Johannesburg CBD, Gauteng, South Africa
          </p>
        </div>

        <div className="p-6 bg-white border border-neutral-200 rounded-xl">
          <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center mb-3">
            <Clock size={18} className="text-white" />
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1">Hours</h3>
          <p className="text-sm text-neutral-500">
            Mon &ndash; Sat: 9:00 &ndash; 18:00
            <br />
            Sun: 10:00 &ndash; 15:00
          </p>
        </div>
      </div>

      {/* Contact Form (demo only) */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h2 className="text-xl font-bold text-neutral-900 mb-4">
          Send us a message
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert('Thank you for your message! This is a demo form.');
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Message
            </label>
            <textarea
              required
              rows={4}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              placeholder="How can we help?"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
