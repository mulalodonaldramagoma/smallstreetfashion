// Edge function: Courier Create Shipment
// Creates a shipment record via the configured courier provider.
// Uses a modular adapter pattern: demo adapter is always available,
// real courier adapters are activated when their API credentials are configured.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateShipmentRequest {
  deliveryId: string;
  courierProviderId: string;
  createdBy?: string | null;
}

// --- Demo Courier Adapter ---
// Always available. Generates a mock tracking number and reference.
// Clearly labelled as demo — never claims a live connection.
function demoCreateShipment(): {
  shipmentReference: string;
  trackingNumber: string;
  trackingUrl: string;
  isDemo: true;
} {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const reference = `DEMO-SHP-${timestamp}-${random}`;
  const trackingNumber = `DEMO${timestamp}${random}`;
  return {
    shipmentReference: reference,
    trackingNumber,
    trackingUrl: `https://track.example.com/track/${trackingNumber}`,
    isDemo: true,
  };
}

// --- Real Courier Adapter Registry ---
// Each real adapter checks for its credentials in Deno.env and calls the
// courier's documented API. Only activated when credentials are present.
// To add a new provider, add a case here and a matching env var check.

interface CourierAdapterResult {
  shipmentReference: string;
  trackingNumber: string;
  trackingUrl: string;
  isDemo: false;
}

async function callRealCourierAdapter(
  providerCode: string,
  _shipmentData: {
    deliveryId: string;
    orderId: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    suburb: string;
    city: string;
    province: string;
    postalCode: string;
  }
): Promise<CourierAdapterResult | null> {
  switch (providerCode) {
    // Example: Ardent Express (placeholder — not activated until credentials exist)
    // case "ardent_express": {
    //   const apiKey = Deno.env.get("ARDENT_API_KEY");
    //   if (!apiKey) return null;
    //   const response = await fetch("https://api.ardentexpress.com/shipments", {
    //     method: "POST",
    //     headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    //     body: JSON.stringify({ ... }),
    //   });
    //   const data = await response.json();
    //   return {
    //     shipmentReference: data.shipment_id,
    //     trackingNumber: data.tracking_number,
    //     trackingUrl: data.tracking_url,
    //     isDemo: false,
    //   };
    // }

    // No real adapters have credentials configured yet
    default:
      return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: CreateShipmentRequest = await req.json();

    if (!body.deliveryId || !body.courierProviderId) {
      return new Response(
        JSON.stringify({ error: "deliveryId and courierProviderId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Fetch the delivery and order details
    const { data: delivery, error: deliveryError } = await adminClient
      .from("deliveries")
      .select(`
        id, order_id, status,
        order:orders(
          id, order_number, status, customer_name, customer_phone,
          delivery_address, suburb, city, province, postal_code
        )
      `)
      .eq("id", body.deliveryId)
      .maybeSingle();

    if (deliveryError || !delivery) {
      return new Response(
        JSON.stringify({ error: "Delivery not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Prevent duplicate active shipment
    const { data: existingShipment } = await adminClient
      .from("shipments")
      .select("id, status")
      .eq("delivery_id", body.deliveryId)
      .is("cancelled_at", null)
      .maybeSingle();

    if (existingShipment) {
      return new Response(
        JSON.stringify({
          error: "An active shipment already exists for this delivery. Cancel it first to create a replacement.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch courier provider
    const { data: provider, error: providerError } = await adminClient
      .from("courier_providers")
      .select("*")
      .eq("id", body.courierProviderId)
      .maybeSingle();

    if (providerError || !provider || !provider.is_active) {
      return new Response(
        JSON.stringify({ error: "Courier provider not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Call the appropriate adapter
    let adapterResult: { shipmentReference: string; trackingNumber: string; trackingUrl: string; isDemo: boolean };

    if (provider.is_demo) {
      adapterResult = demoCreateShipment();
    } else {
      const realResult = await callRealCourierAdapter(provider.code, {
        deliveryId: delivery.id,
        orderId: (delivery.order as { id: string }).id,
        customerName: (delivery.order as { customer_name: string }).customer_name,
        customerPhone: (delivery.order as { customer_phone: string }).customer_phone,
        deliveryAddress: (delivery.order as { delivery_address: string }).delivery_address,
        suburb: (delivery.order as { suburb: string }).suburb,
        city: (delivery.order as { city: string }).city,
        province: (delivery.order as { province: string }).province,
        postalCode: (delivery.order as { postal_code: string }).postal_code,
      });

      if (realResult) {
        adapterResult = realResult;
      } else {
        // No credentials for real adapter — fall back to demo mode with clear warning
        const demoResult = demoCreateShipment();
        adapterResult = {
          ...demoResult,
          isDemo: true,
        };
      }
    }

    // 5. Create shipment record
    const { data: shipment, error: shipmentError } = await adminClient
      .from("shipments")
      .insert({
        delivery_id: delivery.id,
        order_id: (delivery.order as { id: string }).id,
        courier_provider_id: provider.id,
        shipment_reference: adapterResult.shipmentReference,
        tracking_number: adapterResult.trackingNumber,
        status: "created",
        tracking_url: adapterResult.trackingUrl,
        created_by: body.createdBy || null,
      })
      .select("id, shipment_reference, tracking_number, status, tracking_url")
      .single();

    if (shipmentError || !shipment) {
      return new Response(
        JSON.stringify({ error: "Failed to create shipment record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Insert initial tracking event
    await adminClient.rpc("insert_tracking_event", {
      p_shipment_id: shipment.id,
      p_status: "created",
      p_description: adapterResult.isDemo
        ? "Shipment created (Demo Mode — no live courier connection)"
        : "Shipment created",
      p_source: adapterResult.isDemo ? "manual" : "api",
    });

    // 7. Update delivery status to dispatched if currently at an earlier stage
    const earlyStatuses = ["awaiting_fulfilment", "processing", "packed", "ready_for_collection"];
    if (earlyStatuses.includes(delivery.status)) {
      await adminClient
        .from("deliveries")
        .update({
          status: "dispatched",
          dispatched_at: new Date().toISOString(),
          tracking_note: adapterResult.isDemo
            ? `Shipment created with ${provider.name} (Demo Mode). Tracking: ${adapterResult.trackingNumber}`
            : `Shipment created with ${provider.name}. Tracking: ${adapterResult.trackingNumber}`,
        })
        .eq("id", delivery.id);

      await adminClient.from("delivery_status_history").insert({
        delivery_id: delivery.id,
        status: "dispatched",
        note: `Shipment created with ${provider.name}`,
        changed_by: body.createdBy || null,
      });
    }

    return new Response(
      JSON.stringify({
        shipmentId: shipment.id,
        shipmentReference: shipment.shipment_reference,
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
        status: shipment.status,
        isDemo: adapterResult.isDemo,
        courierName: provider.name,
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
