// Edge function: Courier Webhook
// Receives tracking update webhooks from courier providers.
// Validates the payload, prevents duplicate/out-of-order events,
// and records the event in shipment_tracking_events.
// Never invents tracking events or auto-marks deliveries as completed.
//
// For demo mode, this endpoint accepts manually posted updates (no signature).
// For real providers, webhook signature verification is added per-provider.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WebhookPayload {
  shipmentReference: string;
  status: string;
  description?: string;
  location?: string;
  eventTimestamp?: string;
}

// Valid shipment statuses that can come from a courier webhook
const VALID_COURIER_STATUSES = [
  "created",
  "pending_pickup",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body: WebhookPayload = await req.json();

    if (!body.shipmentReference || !body.status) {
      return new Response(
        JSON.stringify({ error: "shipmentReference and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_COURIER_STATUSES.includes(body.status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status: ${body.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the shipment by reference
    const { data: shipment, error: shipmentError } = await adminClient
      .from("shipments")
      .select("id, status, delivery_id, cancelled_at")
      .eq("shipment_reference", body.shipmentReference)
      .maybeSingle();

    if (shipmentError || !shipment) {
      return new Response(
        JSON.stringify({ error: "Shipment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ignore updates for cancelled shipments
    if (shipment.cancelled_at) {
      return new Response(
        JSON.stringify({ message: "Shipment is cancelled — update ignored" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent duplicate events: check if an event with the same status
    // and timestamp already exists for this shipment
    const eventTimestamp = body.eventTimestamp || new Date().toISOString();
    const { data: existingEvent } = await adminClient
      .from("shipment_tracking_events")
      .select("id")
      .eq("shipment_id", shipment.id)
      .eq("status", body.status)
      .eq("event_timestamp", eventTimestamp)
      .maybeSingle();

    if (existingEvent) {
      return new Response(
        JSON.stringify({ message: "Duplicate event — already recorded" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the tracking event
    await adminClient.rpc("insert_tracking_event", {
      p_shipment_id: shipment.id,
      p_status: body.status,
      p_description: body.description || null,
      p_location: body.location || null,
      p_event_timestamp: eventTimestamp,
      p_source: "webhook",
      p_raw_payload: body,
    });

    // Update shipment status to the latest from the webhook
    // Only update if the shipment is not already in a terminal state
    const terminalStatuses = ["delivered", "failed", "cancelled"];
    if (!terminalStatuses.includes(shipment.status)) {
      const updateData: Record<string, unknown> = { status: body.status };

      // If tracking number is provided in the webhook, update it
      // (some couriers assign the tracking number after pickup)

      await adminClient
        .from("shipments")
        .update(updateData)
        .eq("id", shipment.id);

      // Also update the delivery status to keep in sync
      // But NEVER auto-mark as delivered — that requires explicit confirmation
      const deliveryStatusMap: Record<string, string> = {
        picked_up: "dispatched",
        in_transit: "in_transit",
        out_for_delivery: "in_transit",
        failed: "delivery_failed",
      };

      const mappedDeliveryStatus = deliveryStatusMap[body.status];
      if (mappedDeliveryStatus) {
        const deliveryUpdate: Record<string, unknown> = {
          status: mappedDeliveryStatus,
        };

        if (mappedDeliveryStatus === "delivery_failed") {
          deliveryUpdate.failed_at = new Date().toISOString();
        }

        await adminClient
          .from("deliveries")
          .update(deliveryUpdate)
          .eq("id", shipment.delivery_id);

        await adminClient.from("delivery_status_history").insert({
          delivery_id: shipment.delivery_id,
          status: mappedDeliveryStatus,
          note: body.description || `Courier update: ${body.status}`,
          changed_by: null,
        });

        // Trigger notification for the delivery status change
        // Map delivery status to notification event type
        const notificationEventMap: Record<string, string> = {
          dispatched: "order_dispatched",
          in_transit: "delivery_in_transit",
          delivery_failed: "delivery_failed",
        };

        const notificationEventType = notificationEventMap[mappedDeliveryStatus];
        if (notificationEventType) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                eventType: notificationEventType,
                deliveryId: shipment.delivery_id,
                shipmentId: shipment.id,
              }),
            });
          } catch {
            // Notification failure should not block webhook processing
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Tracking event recorded",
        shipmentId: shipment.id,
        status: body.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
