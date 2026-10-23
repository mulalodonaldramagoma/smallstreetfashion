import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  ShoppingBag,
  MapPin,
  User,
  Lock,
  Loader2,
  AlertCircle,
  Truck,
  Store as StoreIcon,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/utils/format';
import { navigateTo } from '@/hooks/useRouter';
import { fetchActiveDeliveryMethods, fetchActiveDeliveryZones } from '@/services/deliveryService';
import type { DeliveryMethod, DeliveryZone } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

interface CheckoutForm {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryInstructions: string;
}

type Step = 'details' | 'review' | 'payment';

export function CheckoutPage() {
  const { items, subtotal, deliveryFee, total, selectedDeliveryMethodId, setDeliveryMethod } = useCart();
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>('details');
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);

  const [form, setForm] = useState<CheckoutForm>({
    fullName: profile?.full_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    address: '',
    suburb: '',
    city: '',
    province: 'Gauteng',
    postalCode: '',
    deliveryInstructions: '',
  });

  useEffect(() => {
    let mounted = true;
    setMethodsLoading(true);
    setMethodsError(null);
    Promise.all([fetchActiveDeliveryMethods(), fetchActiveDeliveryZones()])
      .then(([methods, activeZones]) => {
        if (mounted) {
          setDeliveryMethods(methods);
          setZones(activeZones);
          if (methods.length > 0 && !selectedDeliveryMethodId) {
            const first = methods[0];
            setDeliveryMethod(first.id, Number(first.fee));
          } else if (methods.length === 0) {
            setDeliveryMethod(null, 0);
          }
          setMethodsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setMethodsError('Failed to load delivery options. Please refresh the page.');
          setMethodsLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMethod = deliveryMethods.find((m) => m.id === selectedDeliveryMethodId);
  const isPickup = selectedMethod?.type === 'pickup';

  if (items.length === 0 && !paying) {
    return (
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag size={32} className="text-neutral-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Your cart is empty</h1>
          <p className="text-neutral-500 mb-6">Add items to your cart before checking out.</p>
          <button
            onClick={() => navigateTo('/products')}
            className="px-7 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  const handlePay = async () => {
    setPaying(true);
    setPayError(null);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/paystack-initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            colour: item.colour,
            quantity: item.quantity,
          })),
          customer: {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            address: isPickup ? '' : form.address,
            suburb: isPickup ? '' : form.suburb,
            city: isPickup ? '' : form.city,
            province: isPickup ? '' : form.province,
            postalCode: isPickup ? '' : form.postalCode,
            deliveryInstructions: form.deliveryInstructions,
          },
          userId: user?.id || null,
          deliveryMethodId: selectedDeliveryMethodId,
          zoneId: isPickup ? null : selectedZoneId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else if (data.testMode) {
        navigateTo(`/payment/pending/${data.reference}`);
      }
    } catch (err) {
      setPayError('Failed to initialize payment');
      setPaying(false);
    }
  };

  const updateField = (field: keyof CheckoutForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateDetails = (): boolean => {
    const newErrors: Partial<Record<keyof CheckoutForm, string>> = {};

    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required.';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (form.phone.replace(/\s/g, '').length < 10) {
      newErrors.phone = 'Please enter a valid phone number.';
    }

    // Address fields only required for delivery (not pickup)
    if (!isPickup) {
      if (!form.address.trim()) newErrors.address = 'Delivery address is required.';
      if (!form.suburb.trim()) newErrors.suburb = 'Suburb is required.';
      if (!form.city.trim()) newErrors.city = 'City is required.';
      if (!form.province.trim()) newErrors.province = 'Province is required.';
      if (!form.postalCode.trim()) {
        newErrors.postalCode = 'Postal code is required.';
      } else if (!/^\d{4}$/.test(form.postalCode.trim())) {
        newErrors.postalCode = 'South African postal codes have 4 digits.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinueToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliveryMethodId) {
      setMethodsError('Please select a delivery method to continue.');
      return;
    }
    if (validateDetails()) {
      setStep('review');
      window.scrollTo(0, 0);
    }
  };

  const handleBackToDetails = () => {
    setStep('details');
    window.scrollTo(0, 0);
  };

  const handleContinueToPayment = () => {
    setStep('payment');
    window.scrollTo(0, 0);
  };

  const handleSelectMethod = (method: DeliveryMethod) => {
    setDeliveryMethod(method.id, Number(method.fee));
    if (method.type === 'delivery' && method.zone_id) {
      setSelectedZoneId(method.zone_id);
    }
  };

  const handleSelectZone = (zone: DeliveryZone) => {
    setSelectedZoneId(zone.id);
    // Update the delivery fee to the zone's base fee
    setDeliveryMethod(selectedDeliveryMethodId, Number(zone.base_fee));
  };

  const stepNumber = step === 'details' ? 1 : step === 'review' ? 2 : 3;

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigateTo('/cart')}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Cart
      </button>

      <h1 className="text-3xl font-bold text-neutral-900 mb-2">Checkout</h1>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { num: 1, label: 'Your Details', key: 'details' as Step },
          { num: 2, label: 'Review', key: 'review' as Step },
          { num: 3, label: 'Payment', key: 'payment' as Step },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                stepNumber >= s.num ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs">
                {stepNumber > s.num ? <Check size={12} /> : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < 2 && (
              <div className={`w-6 h-px ${stepNumber > s.num ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Step 1: Details */}
          {step === 'details' && (
            <form onSubmit={handleContinueToReview} className="space-y-6">
              {/* Contact details */}
              <div className="bg-white border border-neutral-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <User size={18} className="text-neutral-900" />
                  <h2 className="font-bold text-neutral-900">Contact Details</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.fullName ? 'border-rose-400' : 'border-neutral-200'}`}
                      placeholder="Your full name"
                    />
                    {errors.fullName && <p className="text-xs text-rose-600 mt-1">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.email ? 'border-rose-400' : 'border-neutral-200'}`}
                      placeholder="you@example.com"
                    />
                    {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.phone ? 'border-rose-400' : 'border-neutral-200'}`}
                      placeholder="+27 82 123 4567"
                    />
                    {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* Delivery method selection */}
              <div className="bg-white border border-neutral-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Truck size={18} className="text-neutral-900" />
                  <h2 className="font-bold text-neutral-900">Delivery Method</h2>
                </div>
                {methodsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : methodsError ? (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700">{methodsError}</p>
                  </div>
                ) : deliveryMethods.length === 0 ? (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      No delivery methods have been configured yet. An administrator must set up
                      delivery options in the admin dashboard under Delivery Settings before checkout
                      can proceed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveryMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedDeliveryMethodId === method.id
                            ? 'border-neutral-900 bg-neutral-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value={method.id}
                          checked={selectedDeliveryMethodId === method.id}
                          onChange={() => handleSelectMethod(method)}
                          className="w-4 h-4 accent-neutral-900"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 justify-between">
                            <span className="text-sm font-medium text-neutral-900 flex items-center gap-1.5">
                              {method.type === 'pickup' ? <StoreIcon size={14} /> : <Truck size={14} />}
                              {method.name}
                            </span>
                            <span className="text-sm font-semibold text-neutral-900">
                              {method.fee === 0 ? 'Free' : formatPrice(Number(method.fee))}
                            </span>
                          </div>
                          {method.estimated_days && (
                            <p className="text-xs text-neutral-500 mt-0.5">{method.estimated_days}</p>
                          )}
                          {method.description && (
                            <p className="text-xs text-neutral-400 mt-0.5">{method.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery zone selection (only for delivery methods, if zones exist) */}
              {!isPickup && zones.length > 0 && selectedDeliveryMethodId && (
                <div className="bg-white border border-neutral-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <MapPin size={18} className="text-neutral-900" />
                    <h2 className="font-bold text-neutral-900">Delivery Zone</h2>
                  </div>
                  <p className="text-xs text-neutral-500 mb-4">
                    Select your delivery area. The fee adjusts based on your zone.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {zones.map((zone) => (
                      <label
                        key={zone.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedZoneId === zone.id
                            ? 'border-neutral-900 bg-neutral-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="deliveryZone"
                            value={zone.id}
                            checked={selectedZoneId === zone.id}
                            onChange={() => handleSelectZone(zone)}
                            className="w-4 h-4 accent-neutral-900"
                          />
                          <div>
                            <span className="text-sm font-medium text-neutral-900">{zone.name}</span>
                            {zone.description && (
                              <p className="text-xs text-neutral-400">{zone.description}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-neutral-900">
                          {zone.base_fee === 0 ? 'Free' : formatPrice(Number(zone.base_fee))}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery address (hidden for pickup) */}
              {!isPickup && (
                <div className="bg-white border border-neutral-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <MapPin size={18} className="text-neutral-900" />
                    <h2 className="font-bold text-neutral-900">Delivery Address</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Street Address *</label>
                      <input
                        type="text"
                        required={!isPickup}
                        value={form.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.address ? 'border-rose-400' : 'border-neutral-200'}`}
                        placeholder="123 Main Street"
                      />
                      {errors.address && <p className="text-xs text-rose-600 mt-1">{errors.address}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Suburb *</label>
                        <input
                          type="text"
                          required={!isPickup}
                          value={form.suburb}
                          onChange={(e) => updateField('suburb', e.target.value)}
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.suburb ? 'border-rose-400' : 'border-neutral-200'}`}
                          placeholder="Braamfontein"
                        />
                        {errors.suburb && <p className="text-xs text-rose-600 mt-1">{errors.suburb}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">City *</label>
                        <input
                          type="text"
                          required={!isPickup}
                          value={form.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.city ? 'border-rose-400' : 'border-neutral-200'}`}
                          placeholder="Johannesburg"
                        />
                        {errors.city && <p className="text-xs text-rose-600 mt-1">{errors.city}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Province *</label>
                        <select
                          value={form.province}
                          onChange={(e) => updateField('province', e.target.value)}
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.province ? 'border-rose-400' : 'border-neutral-200'}`}
                        >
                          {SA_PROVINCES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {errors.province && <p className="text-xs text-rose-600 mt-1">{errors.province}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Postal Code *</label>
                        <input
                          type="text"
                          required={!isPickup}
                          maxLength={4}
                          value={form.postalCode}
                          onChange={(e) => updateField('postalCode', e.target.value.replace(/\D/g, ''))}
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${errors.postalCode ? 'border-rose-400' : 'border-neutral-200'}`}
                          placeholder="2000"
                        />
                        {errors.postalCode && <p className="text-xs text-rose-600 mt-1">{errors.postalCode}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Delivery Instructions <span className="text-neutral-400">(optional)</span>
                      </label>
                      <textarea
                        value={form.deliveryInstructions}
                        onChange={(e) => updateField('deliveryInstructions', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                        placeholder="e.g. Leave at reception, call on arrival"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pickup notice */}
              {isPickup && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <StoreIcon size={18} className="text-blue-600" />
                    <h2 className="font-bold text-blue-900">Store Pickup</h2>
                  </div>
                  <p className="text-sm text-blue-700">
                    You've selected store pickup. No delivery address needed — you'll collect
                    your order from the store. We'll contact you when your order is ready for collection.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedDeliveryMethodId}
                className="w-full sm:w-auto px-8 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Review
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-neutral-900" />
                    <h2 className="font-bold text-neutral-900">Contact Details</h2>
                  </div>
                  <button onClick={handleBackToDetails} className="text-sm text-neutral-500 hover:text-neutral-900">Edit</button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-neutral-500">Name</dt><dd className="font-medium text-neutral-900">{form.fullName}</dd></div>
                  <div><dt className="text-neutral-500">Email</dt><dd className="font-medium text-neutral-900">{form.email}</dd></div>
                  <div><dt className="text-neutral-500">Phone</dt><dd className="font-medium text-neutral-900">{form.phone}</dd></div>
                </dl>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    {isPickup ? <StoreIcon size={18} className="text-neutral-900" /> : <Truck size={18} className="text-neutral-900" />}
                    <h2 className="font-bold text-neutral-900">Delivery Method</h2>
                  </div>
                  <button onClick={handleBackToDetails} className="text-sm text-neutral-500 hover:text-neutral-900">Edit</button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-neutral-900">{selectedMethod?.name}</span>
                    {selectedMethod?.estimated_days && (
                      <p className="text-xs text-neutral-500 mt-0.5">{selectedMethod.estimated_days}</p>
                    )}
                  </div>
                  <span className="font-semibold text-neutral-900">
                    {deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}
                  </span>
                </div>
              </div>

              {!isPickup && (
                <div className="bg-white border border-neutral-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-neutral-900" />
                      <h2 className="font-bold text-neutral-900">Delivery Address</h2>
                    </div>
                    <button onClick={handleBackToDetails} className="text-sm text-neutral-500 hover:text-neutral-900">Edit</button>
                  </div>
                  <div className="text-sm text-neutral-700 space-y-1">
                    <p className="font-medium text-neutral-900">{form.address}</p>
                    <p>{form.suburb}, {form.city}</p>
                    <p>{form.province} {form.postalCode}</p>
                    {form.deliveryInstructions && (
                      <p className="text-neutral-500 mt-2">
                        <span className="text-neutral-400">Instructions: </span>
                        {form.deliveryInstructions}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white border border-neutral-200 rounded-xl p-6">
                <h2 className="font-bold text-neutral-900 mb-4">Order Items</h2>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 line-clamp-1">{item.name}</p>
                        <p className="text-xs text-neutral-500">
                          {item.size} &middot; {item.colour} &middot; Qty {item.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-neutral-900 shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBackToDetails}
                  className="px-6 py-3.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={handleContinueToPayment}
                  className="flex-1 px-8 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                >
                  Continue to Payment
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 'payment' && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-xl p-8">
                <div className="flex items-center gap-2 mb-5">
                  <CreditCard size={18} className="text-neutral-900" />
                  <h2 className="font-bold text-neutral-900">Payment</h2>
                </div>
                <p className="text-sm text-neutral-600 mb-6">
                  You'll be redirected to Paystack's secure checkout page to complete your payment.
                  We never see or store your card details.
                </p>

                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Amount due</span>
                    <span className="font-bold text-neutral-900">{formatPrice(total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Currency</span>
                    <span className="font-medium text-neutral-900">ZAR (R)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Payment provider</span>
                    <span className="font-medium text-neutral-900">Paystack</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 text-xs text-neutral-400">
                  <Lock size={14} />
                  Secured by Paystack — test mode active
                </div>

                {payError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 mt-4">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700">{payError}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('review')}
                  disabled={paying}
                  className="px-6 py-3.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex-1 px-8 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {paying ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Preparing Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      Pay {formatPrice(total)}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white border border-neutral-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Order Summary</h2>

            <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-neutral-500">{item.size} &middot; {item.colour} &middot; Qty {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium text-neutral-900 shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-neutral-200 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-medium text-neutral-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">
                  {isPickup ? 'Pickup' : 'Delivery fee'}
                </span>
                <span className="font-medium text-neutral-900">
                  {deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}
                </span>
              </div>
              <div className="border-t border-neutral-200 pt-3 flex items-center justify-between">
                <span className="font-semibold text-neutral-900">Total</span>
                <span className="text-xl font-bold text-neutral-900">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
