import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { navigateTo } from '@/hooks/useRouter';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function verifyPayment(reference: string): Promise<{
  status: string;
  orderStatus?: string;
  orderId?: string;
  alreadyProcessed?: boolean;
  testMode?: boolean;
  message?: string;
}> {
  const response = await fetch(`${supabaseUrl}/functions/v1/paystack-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ reference }),
  });

  if (!response.ok) {
    throw new Error(`Verification failed (${response.status})`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export function PaymentVerifyPage({ reference }: { reference: string }) {
  const { clearCart } = useCart();
  const [result, setResult] = useState<{
    status: string;
    orderStatus?: string;
    orderId?: string;
    alreadyProcessed?: boolean;
    testMode?: boolean;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doVerify = useCallback(async () => {
    try {
      const data = await verifyPayment(reference);
      setResult(data);
      if (data.status === 'success' && !data.alreadyProcessed) {
        clearCart();
      } else if (data.alreadyProcessed) {
        // Already processed — don't clear cart again, but show success
      }
    } catch (err) {
      setError('Verification failed');
    }
  }, [reference, clearCart]);

  useEffect(() => {
    doVerify();
  }, [doVerify]);

  if (error) {
    return (
      <div className="pt-20 max-w-md mx-auto px-4 py-16">
        <div className="text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={36} className="text-rose-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            Verification Error
          </h1>
          <p className="text-sm text-neutral-500 mb-6">{error}</p>
          <button
            onClick={() => navigateTo('/')}
            className="px-7 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="pt-20 max-w-md mx-auto px-4 py-16">
        <div className="text-center">
          <Loader2 size={40} className="text-neutral-400 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            Verifying your payment...
          </h1>
          <p className="text-sm text-neutral-500">
            Please wait while we confirm your transaction with Paystack.
          </p>
        </div>
      </div>
    );
  }

  if (result.status === 'success') {
    return <PaymentSuccessPage reference={reference} />;
  }

  if (result.status === 'pending' || result.testMode) {
    return <PaymentPendingPage reference={reference} testMode={result.testMode} />;
  }

  return <PaymentFailedPage reference={reference} message={result.message} />;
}

export function PaymentSuccessPage({ reference }: { reference: string }) {
  return (
    <div className="pt-20 max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Payment Successful
        </h1>
        <p className="text-neutral-500 mb-2">
          Your order has been confirmed and payment verified.
        </p>
        <p className="text-xs text-neutral-400 mb-6">
          Reference: {reference}
        </p>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <ShoppingBag size={20} className="text-neutral-400 shrink-0 mt-0.5" />
            <div className="text-sm text-neutral-600">
              We've sent a confirmation to your email. You can continue shopping
              or track your order status from your account.
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigateTo('/products')}
            className="flex-1 px-6 py-3.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Continue Shopping
          </button>
          <button
            onClick={() => navigateTo('/')}
            className="flex-1 px-6 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
          >
            Home
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentFailedPage({
  reference,
  message,
}: {
  reference: string;
  message?: string;
}) {
  return (
    <div className="pt-20 max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={36} className="text-rose-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Payment Failed
        </h1>
        <p className="text-neutral-500 mb-2">
          {message || 'Your payment could not be completed. Please try again.'}
        </p>
        <p className="text-xs text-neutral-400 mb-6">
          Reference: {reference}
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Your cart items are still saved. You can try checking out again.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigateTo('/cart')}
            className="flex-1 px-6 py-3.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Back to Cart
          </button>
          <button
            onClick={() => navigateTo('/products')}
            className="flex-1 px-6 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentCancelledPage() {
  return (
    <div className="pt-20 max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={36} className="text-neutral-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Payment Cancelled
        </h1>
        <p className="text-neutral-500 mb-6">
          You cancelled the payment. Your cart items are still saved, so you can
          try again whenever you're ready.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigateTo('/cart')}
            className="flex-1 px-6 py-3.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Back to Cart
          </button>
          <button
            onClick={() => navigateTo('/products')}
            className="flex-1 px-6 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentPendingPage({
  reference,
  testMode,
}: {
  reference: string;
  testMode?: boolean;
}) {
  return (
    <div className="pt-20 max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={36} className="text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Payment Pending
        </h1>
        <p className="text-neutral-500 mb-2">
          {testMode
            ? 'Paystack is not yet configured. This is a test-mode order — no real payment was processed.'
            : 'Your payment is still being processed. We will confirm once it completes.'}
        </p>
        <p className="text-xs text-neutral-400 mb-6">
          Reference: {reference}
        </p>
        {testMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                To process real payments, add your Paystack secret key to the
                Supabase project secrets as <strong>PAYSTACK_SECRET_KEY</strong>.
                Until then, all payments run in test mode.
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => navigateTo('/products')}
            className="flex-1 px-6 py-3.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Continue Shopping
          </button>
          <button
            onClick={() => navigateTo('/')}
            className="flex-1 px-6 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
