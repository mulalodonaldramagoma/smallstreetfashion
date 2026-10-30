import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}

export function StarRating({
  rating,
  size = 16,
  showValue = false,
  count,
  className = '',
}: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const roundedStars = rating - fullStars >= 0.75 ? fullStars + 1 : fullStars;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = star <= roundedStars;
          const isHalf = hasHalf && star === fullStars + 1;
          return (
            <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
              <Star
                size={size}
                className="absolute inset-0 text-neutral-300"
                fill="currentColor"
              />
              {(isFull || isHalf) && (
                <Star
                  size={size}
                  className="absolute inset-0 text-amber-400"
                  fill="currentColor"
                  style={isHalf ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
                />
              )}
            </span>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-neutral-700">
          {rating > 0 ? rating.toFixed(1) : 'New'}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs text-neutral-500">
          {count > 0 ? `(${count})` : ''}
        </span>
      )}
    </div>
  );
}

interface RatingBreakdownProps {
  distribution: Record<string, number>;
  totalReviews: number;
}

export function RatingBreakdown({ distribution, totalReviews }: RatingBreakdownProps) {
  if (totalReviews === 0) return null;

  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[String(star)] || 0;
        const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-0.5 w-12 text-neutral-600">
              {star} <Star size={11} className="text-amber-400" fill="currentColor" />
            </span>
            <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-neutral-500">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
