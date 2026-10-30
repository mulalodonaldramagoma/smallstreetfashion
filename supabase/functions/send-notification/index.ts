// Edge function: WhatsApp Notification Sender
// Also creates in-app notifications via create_notification RPC.
// Sends (or simulates) a WhatsApp notification for an order/delivery event.
//
// In demo mode (no WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID):
//   - Logs the notification as "simulated" with is_simulated = true
//   - Never claims a message was delivered
//   - Returns simulated: true so callers can display correct UI
//
// In live mode (credentials configured):
//   - Calls the WhatsApp Cloud API to send a template message
//   - Logs the notification as "sent" on success
//   - Logs "failed" with error detail on failure
//
// Idempotency: checks the notification_events table for an existing
// record with the same (event_type, order_id) or (event_type, delivery_id).
// If one exists with status "sent" or "simulated", returns early.
//
// Seller notifications: For order_confirmation and payment_verified events,
// identifies all distinct sellers whose stores have items in the order and
// creates an in-app notification for each seller with only their store's items.
// Also notifies all active admin users.
//
// Customer phone numbers are fetched from the order record and never logged.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendNotificationRequest {
  eventType: string;
  orderId?: string;
  deliveryId?: string;
  shipmentId?: string;
}

interface TemplateParams {
  templateName: string;
  languageCode: string;
  components: { type: string; parameters: { type: string; text: string }[] }[];
  previewText: string;
}

function buildTemplate(
  eventType: string,
  order: { order_number: string; customer_name: string; total: number },
  extra?: { trackingNumber?: string; deliveryAddress?: string; estimatedDays?: string }
): TemplateParams {
  const orderNum = order.order_number;
  const customerName = order.customer_name.split(" ")[0] || "there";
  const total = `R${Number(order.total).toFixed(2)}`;

  switch (eventType) {
    case "order_confirmation":
      return {
        templateName: "order_confirmation",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
            { type: "text", text: total },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} for ${total} has been placed. We'll confirm payment shortly.`,
      };

    case "payment_verified":
      return {
        templateName: "payment_verified",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
            { type: "text", text: total },
          ],
        }],
        previewText: `Hi ${customerName}, payment for order ${orderNum} (${total}) has been confirmed. Your order is being processed.`,
      };

    case "order_processing":
      return {
        templateName: "order_processing",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} is now being prepared by the store.`,
      };

    case "order_dispatched":
      return {
        templateName: "order_dispatched",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
            { type: "text", text: extra?.trackingNumber || "N/A" },
            { type: "text", text: extra?.deliveryAddress || "" },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} has been dispatched${extra?.trackingNumber ? ` (tracking: ${extra.trackingNumber})` : ""}. Delivery to ${extra?.deliveryAddress || "your address"}.`,
      };

    case "delivery_in_transit":
      return {
        templateName: "delivery_in_transit",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} is in transit and on its way to you.`,
      };

    case "delivery_out_for_delivery":
      return {
        templateName: "delivery_out_for_delivery",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} is out for delivery today${extra?.estimatedDays ? ` (${extra.estimatedDays})` : ""}.`,
      };

    case "delivery_delivered":
      return {
        templateName: "delivery_delivered",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} has been delivered. Thank you for shopping with Small Street Fashion!`,
      };

    case "delivery_failed":
      return {
        templateName: "delivery_failed",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, we were unable to deliver your order ${orderNum}. The store will contact you to arrange redelivery.`,
      };

    case "order_cancelled":
      return {
        templateName: "order_cancelled",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, your order ${orderNum} has been cancelled. If you have questions, please contact the store.`,
      };

    default:
      return {
        templateName: "generic_notification",
        languageCode: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderNum },
          ],
        }],
        previewText: `Hi ${customerName}, there's an update on your order ${orderNum}.`,
      };
  }
}

interface SellerOrderInfo {
  sellerId: string;
  storeName: string;
  storeId: string;
  items: { product_name: string; quantity: number; size: string; colour: string }[];
}

async function getSellersForOrder(
  adminClient: ReturnType<typeof createClient>,
  orderId: string
): Promise<SellerOrderInfo[]> {
  // Get order items joined with stores to find seller_id per store
  const { data: items, error } = await adminClient
    .from("order_items")
    .select(`
      product_name, quantity, size, colour, store_id,
      store:stores!order_items_store_id_fkey(id, name, seller_id)
    `)
    .eq("order_id", orderId);

  if (error || !items || items.length === 0) return [];

  // Group items by store/seller
  const sellerMap = new Map<string, SellerOrderInfo>();

  for (const item of items) {
    const store = item.store as { id: string; name: string; seller_id: string | null } | null;
    if (!store || !store.seller_id) continue;

    const key = store.seller_id;
    if (!sellerMap.has(key)) {
      sellerMap.set(key, {
        sellerId: store.seller_id,
        storeName: store.name,
        storeId: store.id,
        items: [],
      });
    }
    sellerMap.get(key)!.items.push({
      product_name: item.product_name,
      quantity: item.quantity,
      size: item.size,
      colour: item.colour,
    });
  }

  return Array.from(sellerMap.values());
}

async function getAdminUserIds(
  adminClient: ReturnType<typeof createClient>
): Promise<string[]> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (error || !data) return [];
  return data.map((p: { id: string }) => p.id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: SendNotificationRequest = await req.json();

    if (!body.eventType) {
      return new Response(
        JSON.stringify({ error: "eventType is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.orderId && !body.deliveryId) {
      return new Response(
        JSON.stringify({ error: "orderId or deliveryId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // --- Idempotency check ---
    let existingQuery = adminClient
      .from("notification_events")
      .select("id, status")
      .eq("event_type", body.eventType)
      .in("status", ["sent", "simulated"]);

    if (body.deliveryId) {
      existingQuery = existingQuery.eq("delivery_id", body.deliveryId);
    } else {
      existingQuery = existingQuery.eq("order_id", body.orderId).is("delivery_id", null);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          message: "Notification already sent — skipping",
          status: existing.status,
          alreadySent: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Fetch order details ---
    let orderQuery = adminClient
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, customer_email, total, user_id, created_at");

    if (body.orderId) {
      orderQuery = orderQuery.eq("id", body.orderId);
    } else if (body.deliveryId) {
      const { data: delivery } = await adminClient
        .from("deliveries")
        .select("order_id")
        .eq("id", body.deliveryId)
        .maybeSingle();

      if (!delivery) {
        return new Response(
          JSON.stringify({ error: "Delivery not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body.orderId = delivery.order_id;
      orderQuery = orderQuery.eq("id", delivery.order_id);
    }

    const { data: order, error: orderError } = await orderQuery.maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch delivery details if needed for tracking number / address
    let trackingNumber: string | undefined;
    let deliveryAddress: string | undefined;
    let estimatedDays: string | undefined;

    if (body.deliveryId || body.eventType.includes("dispatched") || body.eventType.includes("delivery")) {
      const { data: delivery } = await adminClient
        .from("deliveries")
        .select(`
          id, tracking_note,
          delivery_method:delivery_methods(name, estimated_days),
          order:orders(delivery_address, suburb, city)
        `)
        .eq("order_id", order.id)
        .maybeSingle();

      if (delivery) {
        const dm = delivery.delivery_method as { estimated_days?: string } | null;
        estimatedDays = dm?.estimated_days || undefined;
        const ord = delivery.order as { delivery_address?: string; suburb?: string; city?: string } | null;
        if (ord) {
          deliveryAddress = [ord.delivery_address, ord.suburb, ord.city].filter(Boolean).join(", ");
        }
      }

      if (body.shipmentId) {
        const { data: shipment } = await adminClient
          .from("shipments")
          .select("tracking_number")
          .eq("id", body.shipmentId)
          .maybeSingle();
        if (shipment?.tracking_number) {
          trackingNumber = shipment.tracking_number;
        }
      }
    }

    // --- Build template ---
    const template = buildTemplate(body.eventType, order, { trackingNumber, deliveryAddress, estimatedDays });

    // --- Create in-app notification for the customer ---
    const inAppCategoryMap: Record<string, string> = {
      order_confirmation: "order",
      payment_verified: "payment",
      order_processing: "order",
      order_dispatched: "delivery",
      delivery_in_transit: "delivery",
      delivery_out_for_delivery: "delivery",
      delivery_delivered: "delivery",
      delivery_failed: "delivery",
      order_cancelled: "order",
    };
    const inAppCategory = inAppCategoryMap[body.eventType] || "order";
    const actionUrlMap: Record<string, string> = {
      order_confirmation: "/deliveries",
      payment_verified: "/deliveries",
      order_processing: "/deliveries",
      order_dispatched: "/deliveries",
      delivery_in_transit: "/deliveries",
      delivery_out_for_delivery: "/deliveries",
      delivery_delivered: "/deliveries",
      delivery_failed: "/deliveries",
      order_cancelled: "/deliveries",
    };

    if (order.user_id) {
      try {
        await adminClient.rpc("create_notification", {
          p_user_id: order.user_id,
          p_category: inAppCategory,
          p_type: body.eventType,
          p_title: template.previewText.split(",")[0] || template.previewText.slice(0, 60),
          p_body: template.previewText,
          p_entity_type: body.deliveryId ? "delivery" : "order",
          p_entity_id: body.orderId,
          p_action_url: actionUrlMap[body.eventType] || null,
        });
      } catch {
        // In-app notification failure should not block WhatsApp send
      }
    }

    // --- Create seller notifications for order_confirmation and payment_verified ---
    // These are the two events where a seller needs to know an order was placed/paid.
    // Each seller only sees their own store's items.
    const sellerEventTypes = ["order_confirmation", "payment_verified"];
    if (sellerEventTypes.includes(body.eventType)) {
      const sellers = await getSellersForOrder(adminClient, order.id);
      const orderCreatedAt = order.created_at as string;
      const orderNum = order.order_number as string;

      for (const seller of sellers) {
        const itemSummary = seller.items
          .map((i) => `${i.product_name} (Qty ${i.quantity}, ${i.size}/${i.colour})`)
          .join("; ");

        const sellerTitle = "New Order Received";
        const sellerBody = `You have received a new order #${orderNum} from ${seller.storeName}. ` +
          `Items: ${itemSummary}. ` +
          `Order placed at ${new Date(orderCreatedAt).toLocaleString("en-ZA")}. ` +
          `Please review the order and prepare the items.`;

        const sellerActionUrl = `/seller/dispatch`;
        const sellerType = `seller_${body.eventType}`;

        try {
          await adminClient.rpc("create_notification", {
            p_user_id: seller.sellerId,
            p_category: "order",
            p_type: sellerType,
            p_title: sellerTitle,
            p_body: sellerBody,
            p_entity_type: "order",
            p_entity_id: order.id,
            p_action_url: sellerActionUrl,
          });
        } catch (err) {
          console.error(`Failed to create seller notification for ${seller.sellerId}:`, err);
        }
      }

      // --- Notify admin users ---
      const adminUserIds = await getAdminUserIds(adminClient);
      const adminTitle = body.eventType === "order_confirmation"
        ? "New Order Placed"
        : "Payment Verified";
      const adminBody = body.eventType === "order_confirmation"
        ? `Order #${orderNum} has been placed by ${order.customer_name}. Total: R${Number(order.total).toFixed(2)}.`
        : `Payment for order #${orderNum} has been verified. Total: R${Number(order.total).toFixed(2)}.`;

      for (const adminId of adminUserIds) {
        try {
          await adminClient.rpc("create_notification", {
            p_user_id: adminId,
            p_category: inAppCategory,
            p_type: `admin_${body.eventType}`,
            p_title: adminTitle,
            p_body: adminBody,
            p_entity_type: "order",
            p_entity_id: order.id,
            p_action_url: "/admin/orders",
          });
        } catch (err) {
          console.error(`Failed to create admin notification for ${adminId}:`, err);
        }
      }
    }

    // --- Determine mode (demo vs live) ---
    const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const isDemoMode = !whatsappToken || !whatsappPhoneId;

    // Phone number validation: must be a valid international format
    const phone = (order.customer_phone || "").replace(/[^0-9]/g, "");
    if (phone.length < 10) {
      // Log as skipped — no valid phone number
      await adminClient.from("notification_events").insert({
        event_type: body.eventType,
        order_id: order.id,
        delivery_id: body.deliveryId || null,
        shipment_id: body.shipmentId || null,
        channel: "whatsapp",
        status: "skipped",
        is_simulated: false,
        template_key: template.templateName,
        error_message: "No valid phone number on order",
      });

      return new Response(
        JSON.stringify({
          message: "No valid phone number — notification skipped",
          status: "skipped",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isDemoMode) {
      // --- Demo mode: simulate the notification ---
      await adminClient.from("notification_events").insert({
        event_type: body.eventType,
        order_id: order.id,
        delivery_id: body.deliveryId || null,
        shipment_id: body.shipmentId || null,
        channel: "whatsapp",
        status: "simulated",
        is_simulated: true,
        template_key: template.templateName,
        sent_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          status: "simulated",
          simulated: true,
          eventType: body.eventType,
          preview: template.previewText,
          message: "Notification simulated (demo mode). No WhatsApp message was sent.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Live mode: send via WhatsApp Cloud API ---
    try {
      const waResponse = await fetch(
        `https://graph.facebook.com/v20.0/${whatsappPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: template.templateName,
              language: { code: template.languageCode },
              components: template.components,
            },
          }),
        }
      );

      const waData = await waResponse.json();

      if (!waResponse.ok) {
        await adminClient.from("notification_events").insert({
          event_type: body.eventType,
          order_id: order.id,
          delivery_id: body.deliveryId || null,
          shipment_id: body.shipmentId || null,
          channel: "whatsapp",
          status: "failed",
          is_simulated: false,
          template_key: template.templateName,
          error_message: `WhatsApp API error: ${waData.error?.message || waResponse.status}`,
        });

        return new Response(
          JSON.stringify({
            status: "failed",
            error: "WhatsApp API request failed",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient.from("notification_events").insert({
        event_type: body.eventType,
        order_id: order.id,
        delivery_id: body.deliveryId || null,
        shipment_id: body.shipmentId || null,
        channel: "whatsapp",
        status: "sent",
        is_simulated: false,
        template_key: template.templateName,
        sent_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          status: "sent",
          simulated: false,
          eventType: body.eventType,
          messageId: waData.messages?.[0]?.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (sendErr) {
      await adminClient.from("notification_events").insert({
        event_type: body.eventType,
        order_id: order.id,
        delivery_id: body.deliveryId || null,
        shipment_id: body.shipmentId || null,
        channel: "whatsapp",
        status: "failed",
        is_simulated: false,
        template_key: template.templateName,
        error_message: `Network error: ${sendErr instanceof Error ? sendErr.message : "unknown"}`,
      });

      return new Response(
        JSON.stringify({ status: "failed", error: "Failed to send WhatsApp message" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
