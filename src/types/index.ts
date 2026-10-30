export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: 'customer' | 'seller' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface OpeningHourPeriod {
  open: string;
  close: string;
}

export interface OpeningHourDay {
  day: number;
  is_closed: boolean;
  periods: OpeningHourPeriod[];
}

export type OpeningHours = OpeningHourDay[];

export interface Store {
  id: string;
  seller_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  location: string;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_demo: boolean;
  source_url: string | null;
  research_date: string | null;
  address_line: string | null;
  building_name: string | null;
  shop_number: string | null;
  area: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  opening_hours: OpeningHours | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  sizes: string[];
  colours: string[];
  main_image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  is_demo: boolean;
  source_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (optional, present when selected with relations)
  store?: Pick<Store, 'id' | 'name' | 'slug' | 'location'>;
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
  product_images?: { id: string; image_url: string; position: number }[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  position: number;
  created_at: string;
}

// Cart item now uses real product IDs from Supabase
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  storeName: string;
  storeSlug?: string;
  category: string;
  size: string;
  colour: string;
  quantity: number;
  stock: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  delivery_instructions: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded' | 'partially_refunded';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  store_id: string;
  product_name: string;
  product_image: string | null;
  size: string;
  colour: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  reference: string;
  provider: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled' | 'abandoned';
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryMethod {
  id: string;
  name: string;
  description: string | null;
  fee: number;
  estimated_days: string | null;
  is_active: boolean;
  sort_order: number;
  type: 'delivery' | 'pickup';
  zone_id: string | null;
  created_at: string;
  updated_at: string;
  delivery_zone?: DeliveryZone | null;
}

export interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  base_fee: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type DeliveryStatus =
  | 'awaiting_fulfilment'
  | 'processing'
  | 'packed'
  | 'ready_for_collection'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'delivery_failed'
  | 'cancelled';

export interface Delivery {
  id: string;
  order_id: string;
  delivery_method_id: string | null;
  delivery_fee: number;
  status: DeliveryStatus;
  tracking_note: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  failed_at: string | null;
  zone_id: string | null;
  created_at: string;
  updated_at: string;
  delivery_method?: Pick<DeliveryMethod, 'id' | 'name' | 'estimated_days' | 'type'>;
  order?: Pick<Order, 'id' | 'order_number' | 'status' | 'total' | 'customer_name' | 'customer_email' | 'customer_phone' | 'delivery_address' | 'suburb' | 'city' | 'province' | 'postal_code' | 'delivery_instructions'>;
}

export interface DeliveryStatusHistory {
  id: string;
  delivery_id: string;
  status: DeliveryStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export type SortOption =
  | 'featured'
  | 'newest'
  | 'price-low'
  | 'price-high';

export type ProductTag = 'new' | 'trending' | 'sale' | 'limited_stock';

export const PRODUCT_TAG_LABELS: Record<ProductTag, string> = {
  new: 'New Arrival',
  trending: 'Trending',
  sale: 'On Sale',
  limited_stock: 'Limited Stock',
};

export interface ProductFilters {
  category: string | 'all';
  priceMin: number;
  priceMax: number;
  sizes: string[];
  colours: string[];
  storeId: string | null;
  search: string;
  tags: ProductTag[];
}

// --- Stage 8: Courier Integration ---

export interface CourierProvider {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  is_demo: boolean;
  tracking_url_template: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ShipmentStatus =
  | 'created'
  | 'pending_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface Shipment {
  id: string;
  delivery_id: string;
  order_id: string;
  courier_provider_id: string;
  shipment_reference: string;
  tracking_number: string | null;
  status: ShipmentStatus;
  tracking_url: string | null;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
  courier_provider?: Pick<CourierProvider, 'id' | 'code' | 'name' | 'is_demo' | 'tracking_url_template'>;
}

export interface ShipmentTrackingEvent {
  id: string;
  shipment_id: string;
  status: string;
  description: string | null;
  location: string | null;
  event_timestamp: string;
  received_at: string;
  source: string;
  raw_payload: Record<string, unknown> | null;
}

// --- Stage 9: Admin Dashboard ---

export interface AdminAuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface AdminStoreWithSeller extends Store {
  seller_profile?: Pick<Profile, 'id' | 'full_name'> | null;
  product_count?: number;
}

// --- Stage 10: WhatsApp Notifications ---

export type NotificationEventType =
  | 'order_confirmation'
  | 'payment_verified'
  | 'order_processing'
  | 'order_dispatched'
  | 'delivery_in_transit'
  | 'delivery_out_for_delivery'
  | 'delivery_delivered'
  | 'delivery_failed'
  | 'order_cancelled';

export type NotificationStatus = 'pending' | 'sent' | 'simulated' | 'failed' | 'skipped';

export interface NotificationEvent {
  id: string;
  event_type: NotificationEventType;
  order_id: string | null;
  delivery_id: string | null;
  shipment_id: string | null;
  channel: string;
  status: NotificationStatus;
  is_simulated: boolean;
  template_key: string | null;
  sent_at: string | null;
  created_at: string;
}

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  order_confirmation: 'Order Placed',
  payment_verified: 'Payment Confirmed',
  order_processing: 'Order Processing',
  order_dispatched: 'Order Dispatched',
  delivery_in_transit: 'In Transit',
  delivery_out_for_delivery: 'Out for Delivery',
  delivery_delivered: 'Delivered',
  delivery_failed: 'Delivery Failed',
  order_cancelled: 'Order Cancelled',
};

// --- In-App Notification Centre ---

export type NotificationCategory =
  | 'order'
  | 'payment'
  | 'delivery'
  | 'store'
  | 'product'
  | 'message'
  | 'system'
  | 'account';

export interface AppNotification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  order: 'Orders',
  payment: 'Payments',
  delivery: 'Delivery',
  store: 'Stores',
  product: 'Products',
  message: 'Messages',
  system: 'System',
  account: 'Account',
};

export const NOTIFICATION_CATEGORY_COLORS: Record<NotificationCategory, string> = {
  order: 'bg-blue-50 text-blue-600',
  payment: 'bg-green-50 text-green-600',
  delivery: 'bg-amber-50 text-amber-600',
  store: 'bg-purple-50 text-purple-600',
  product: 'bg-teal-50 text-teal-600',
  message: 'bg-neutral-50 text-neutral-600',
  system: 'bg-rose-50 text-rose-600',
  account: 'bg-neutral-50 text-neutral-600',
};

// --- Two-Way Messaging ---

export type ConversationCategory =
  | 'general'
  | 'order_update'
  | 'promotion'
  | 'important_notice'
  | 'system_alert'
  | 'support';

export type ConversationStatus = 'open' | 'pending' | 'resolved';

export interface Conversation {
  id: string;
  subject: string;
  category: ConversationCategory;
  status: ConversationStatus;
  initiated_by: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface ConversationWithDetails extends Conversation {
  participants: ConversationParticipant[];
  last_message?: Message | null;
  unread_count?: number;
}

// --- Notification Preferences ---

export interface NotificationPreferences {
  id: string;
  user_id: string;
  order_updates: boolean;
  delivery_updates: boolean;
  payment_updates: boolean;
  messages: boolean;
  store_updates: boolean;
  product_updates: boolean;
  promotions: boolean;
  system_alerts: boolean;
  updated_at: string;
}

// --- Seller Earnings Ledger ---

export type EarningStatus = 'pending' | 'available' | 'paid' | 'reversed';

export interface SellerEarning {
  id: string;
  seller_id: string;
  store_id: string;
  order_id: string;
  order_item_id: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_earnings: number;
  status: EarningStatus;
  created_at: string;
  updated_at: string;
  order?: Pick<Order, 'id' | 'order_number' | 'status' | 'created_at'>;
  order_item?: Pick<OrderItem, 'id' | 'product_name' | 'quantity' | 'product_image'>;
  store?: Pick<Store, 'id' | 'name'>;
}

export interface EarningsSummary {
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  pendingNet: number;
  reversedNet: number;
  adjustedNet: number;
  totalRefunded: number;
  orderCount: number;
}

export const EARNING_STATUS_LABELS: Record<EarningStatus, string> = {
  pending: 'Pending',
  available: 'Available',
  paid: 'Paid',
  reversed: 'Reversed',
};

export const EARNING_STATUS_COLORS: Record<EarningStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  available: 'bg-green-50 text-green-700',
  paid: 'bg-blue-50 text-blue-700',
  reversed: 'bg-rose-50 text-rose-700',
};

// --- Refund and Earnings Adjustments ---

export type RefundStatus = 'pending' | 'processed' | 'failed';

export interface Refund {
  id: string;
  payment_transaction_id: string;
  order_id: string;
  paystack_refund_reference: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  verified_at: string | null;
  processed_by: string;
  created_at: string;
  updated_at: string;
}

export interface SellerEarningAdjustment {
  id: string;
  seller_earning_id: string;
  refund_id: string;
  order_id: string;
  seller_id: string;
  store_id: string;
  adjustment_type: string;
  gross_adjustment: number;
  commission_adjustment: number;
  net_adjustment: number;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: 'Pending',
  processed: 'Processed',
  failed: 'Failed',
};

export const REFUND_STATUS_COLORS: Record<RefundStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  processed: 'bg-rose-50 text-rose-700',
  failed: 'bg-neutral-100 text-neutral-600',
};

// --- Stage A: Ratings and Reviews ---

export type ReviewStatus = 'published' | 'pending' | 'hidden';
export type ReviewType = 'product' | 'store';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReviewSortOption = 'newest' | 'highest';

export interface ReviewPhoto {
  id: string;
  product_review_id: string | null;
  store_review_id: string | null;
  user_id: string;
  storage_path: string;
  image_url: string;
  position: number;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  order_item_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  is_verified_purchase: boolean;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
  reviewer_profile?: Pick<Profile, 'id' | 'full_name'> | null;
  photos?: ReviewPhoto[];
}

export interface StoreReview {
  id: string;
  store_id: string;
  order_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  is_verified_purchase: boolean;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
  reviewer_profile?: Pick<Profile, 'id' | 'full_name'> | null;
  reply?: ReviewReply | null;
  photos?: ReviewPhoto[];
}

export interface ReviewReply {
  id: string;
  store_review_id: string;
  seller_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewReport {
  id: string;
  review_type: ReviewType;
  review_id: string;
  reporter_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface RatingSummary {
  avgRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
}

// --- Saved Delivery Addresses ---

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string | null;
  delivery_address: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  delivery_instructions: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
