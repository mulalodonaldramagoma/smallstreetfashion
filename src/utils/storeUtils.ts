import type { OpeningHours, OpeningHourDay, Store } from '@/types';

export const DAYS_OF_WEEK = [
  { day: 1, label: 'Monday', short: 'Mon' },
  { day: 2, label: 'Tuesday', short: 'Tue' },
  { day: 3, label: 'Wednesday', short: 'Wed' },
  { day: 4, label: 'Thursday', short: 'Thu' },
  { day: 5, label: 'Friday', short: 'Fri' },
  { day: 6, label: 'Saturday', short: 'Sat' },
  { day: 7, label: 'Sunday', short: 'Sun' },
];

// --- WhatsApp ---

const SAFARI_WHATSAPP_MESSAGE =
  'Hi, I found your store on Small Street Fashion and would like to ask about your products.';

export function normalizeWhatsAppNumber(input: string): string | null {
  if (!input) return null;
  let cleaned = input.replace(/[\s()\-]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = '27' + cleaned.slice(1);
  if (!/^2\d{8,12}$/.test(cleaned)) return null;
  return cleaned;
}

export function buildWhatsAppUrl(rawNumber: string): string | null {
  const normalized = normalizeWhatsAppNumber(rawNumber);
  if (!normalized) return null;
  const message = encodeURIComponent(SAFARI_WHATSAPP_MESSAGE);
  return `https://wa.me/${normalized}?text=${message}`;
}

// --- Social / website URL validation ---

const SOCIAL_DOMAINS: Record<string, string[]> = {
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  facebook: ['facebook.com', 'fb.com'],
};

function isHttpsUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeSocialUrl(platform: keyof typeof SOCIAL_DOMAINS, input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^javascript:|^data:|^vbscript:/i.test(trimmed)) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    const handle = candidate.replace(/^@/, '');
    candidate = `https://${SOCIAL_DOMAINS[platform][0]}/${handle}`;
  }

  const parsed = isHttpsUrl(candidate);
  if (!parsed) return null;

  const hostname = parsed.hostname.replace(/^www\./, '');
  const allowed = SOCIAL_DOMAINS[platform];
  const matches = allowed.some((d) => hostname === d || hostname.endsWith('.' + d));
  if (!matches) return null;
  return parsed.href;
}

export function normalizeWebsiteUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^javascript:|^data:|^vbscript:/i.test(trimmed)) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate;
  }
  const parsed = isHttpsUrl(candidate);
  if (!parsed) return null;
  return parsed.href;
}

// --- Google Maps directions ---

export function buildDirectionsUrl(store: Pick<Store, 'latitude' | 'longitude' | 'google_maps_url' | 'address_line' | 'building_name' | 'shop_number' | 'area' | 'city' | 'province' | 'postal_code'>): string | null {
  if (typeof store.latitude === 'number' && typeof store.longitude === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
  }
  if (store.google_maps_url) {
    const parsed = isHttpsUrl(store.google_maps_url);
    if (parsed && (parsed.hostname.includes('google.com') || parsed.hostname.includes('maps.app.goo.gl'))) {
      return parsed.href;
    }
  }
  const addressParts = [
    store.shop_number,
    store.building_name,
    store.address_line,
    store.area,
    store.city,
    store.province,
    store.postal_code,
  ].filter(Boolean);
  if (addressParts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts.join(', '))}`;
}

export function formatStoreAddress(store: Pick<Store, 'shop_number' | 'building_name' | 'address_line' | 'area' | 'city' | 'province' | 'postal_code'>): string | null {
  const line1 = [store.shop_number, store.building_name, store.address_line].filter(Boolean).join(', ');
  const line2 = [store.area, store.city, store.province, store.postal_code].filter(Boolean).join(', ');
  const full = [line1, line2].filter(Boolean).join(', ');
  return full || null;
}

export function deriveLocationLabel(store: Pick<Store, 'area' | 'city' | 'province'>): string {
  const parts = [store.area, store.city].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (store.province) return store.province;
  return 'Small Street, Johannesburg CBD';
}

// --- Opening hours ---

function getJoburgNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 2 * 3600000);
}

export function getJoburgDayOfWeek(): number {
  const joburg = getJoburgNow();
  const jsDay = joburg.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function getJoburgCurrentTime(): string {
  const joburg = getJoburgNow();
  return joburg.toTimeString().slice(0, 5);
}

export function formatTime12h(time: string): string {
  const [hStr, m] = time.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export function isTimeAfter(a: string, b: string): boolean {
  return a > b;
}

export type StoreOpenStatus =
  | { status: 'open'; closesAt: string }
  | { status: 'opens'; opensAt: string }
  | { status: 'closed' }
  | { status: 'not_configured' };

export function getStoreOpenStatus(hours: OpeningHours | null): StoreOpenStatus {
  if (!hours || hours.length === 0) return { status: 'not_configured' };

  const today = getJoburgDayOfWeek();
  const nowTime = getJoburgCurrentTime();
  const todayHours = hours.find((d) => d.day === today);

  if (!todayHours || todayHours.is_closed || todayHours.periods.length === 0) {
    const tomorrow = today === 7 ? 1 : today + 1;
    const tomorrowHours = hours.find((d) => d.day === tomorrow);
    if (tomorrowHours && !tomorrowHours.is_closed && tomorrowHours.periods.length > 0) {
      return { status: 'opens', opensAt: tomorrowHours.periods[0].open };
    }
    return { status: 'closed' };
  }

  for (const period of todayHours.periods) {
    const crossesMidnight = isTimeAfter(period.open, period.close);
    if (crossesMidnight) {
      if (nowTime >= period.open || nowTime < period.close) {
        return { status: 'open', closesAt: period.close };
      }
    } else {
      if (nowTime >= period.open && nowTime < period.close) {
        return { status: 'open', closesAt: period.close };
      }
    }
  }

  const nextPeriod = todayHours.periods.find((p) => p.open > nowTime);
  if (nextPeriod) {
    return { status: 'opens', opensAt: nextPeriod.open };
  }

  const tomorrow = today === 7 ? 1 : today + 1;
  const tomorrowHours = hours.find((d) => d.day === tomorrow);
  if (tomorrowHours && !tomorrowHours.is_closed && tomorrowHours.periods.length > 0) {
    return { status: 'opens', opensAt: tomorrowHours.periods[0].open };
  }
  return { status: 'closed' };
}

export function makeDefaultOpeningHours(): OpeningHours {
  return DAYS_OF_WEEK.map((d) => ({
    day: d.day,
    is_closed: d.day === 7,
    periods: d.day === 7 ? [] : [{ open: '09:00', close: '17:00' }],
  }));
}

export function validateOpeningHours(hours: OpeningHours): string | null {
  for (const day of hours) {
    for (const period of day.periods) {
      if (!period.open || !period.close) {
        return `Incomplete opening period on ${DAYS_OF_WEEK.find((d) => d.day === day.day)?.label}`;
      }
      if (!/^\d{2}:\d{2}$/.test(period.open) || !/^\d{2}:\d{2}$/.test(period.close)) {
        return `Invalid time format on ${DAYS_OF_WEEK.find((d) => d.day === day.day)?.label}. Use HH:mm 24-hour format.`;
      }
      const [oh, om] = period.open.split(':').map(Number);
      const [ch, cm] = period.close.split(':').map(Number);
      if (oh > 23 || om > 59 || ch > 23 || cm > 59) {
        return `Invalid time on ${DAYS_OF_WEEK.find((d) => d.day === day.day)?.label}`;
      }
      if (period.open === period.close) {
        return `Opening and closing times are the same on ${DAYS_OF_WEEK.find((d) => d.day === day.day)?.label}`;
      }
    }
  }
  return null;
}

export function hasConfiguredHours(hours: OpeningHours | null): boolean {
  if (!hours || hours.length === 0) return false;
  return hours.some((d) => !d.is_closed && d.periods.length > 0);
}
