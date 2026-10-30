import { useState, useEffect } from 'react';
import { fetchProductRatingSummaries } from '@/services/reviewService';
import type { RatingSummary } from '@/types';

export function useProductRatingSummaries(productIds: string[]): {
  summaries: Record<string, RatingSummary>;
  loading: boolean;
} {
  const [summaries, setSummaries] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productIds.length === 0) {
      setSummaries({});
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchProductRatingSummaries(productIds)
      .then((result) => {
        if (mounted) {
          setSummaries(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setSummaries({});
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [productIds.join(',')]);

  return { summaries, loading };
}
