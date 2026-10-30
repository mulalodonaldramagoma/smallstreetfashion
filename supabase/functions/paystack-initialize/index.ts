// Edge function: Paystack initialize — updated for Stage 7 delivery management
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CartItemRequest {
  productId: string;
  size: string;
  colour: string;
  quantity: number;
}

interface InitializeRequest {
  items: CartItemRequest[];
  customer: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    suburb: string;
    city: string;
    province: string;
    postalCode: string;
    deliveryInstructions?: string;
  };
  userId: string | null;
  deliveryMethodId?: string;
  zoneId?: string | null;
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: InitializeRequest = await req.json();

    if (!body.items || body.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cart is empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.customer?.email || !body.customer?.fullName) {
      return new Response(
        JSON.stringify({ error: "Customer details are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.deliveryMethodId) {
      return new Response(
        JSON.stringify({ error: "A delivery method must be selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch all products from the database to get server-side prices and stock
    const productIds = body.items.map((i) => i.productId);
    const { data: products, error: productsError } = await adminClient
      .from("products")
      .select("id, name, price, stock, main_image_url, store_id, is_active")
      .in("id", productIds);

    if (productsError) {
      return new Response(
        JSON.stringify({ error: "Failed to verify products" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each cart item against server-side data
    let serverSubtotal = 0;
    const orderItems: {
      productId: string;
      storeId: string;
      productName: string;
      productImage: string | null;
      size: string;
      colour: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[] = [];

    for (const item of body.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !product.is_active) {
        return new Response(
          JSON.stringify({ error: `Product ${item.productId} is no longer available` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (item.quantity < 1) {
        return new Response(
          JSON.stringify({ error: `Invalid quantity for ${product.name}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (product.stock < item.quantity) {
        return new Response(
          JSON.stringify({ error: `Only ${product.stock} of ${product.name} in stock` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;
      serverSubtotal += lineTotal;

      orderItems.push({
        productId: product.id,
        storeId: product.store_id,
        productName: product.name,
        productImage: product.main_image_url,
        size: item.size,
        colour: item.colour,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    // Look up delivery method, type, and fee from the database (server-side validated)
    let deliveryFee = 0;
    let deliveryMethodId: string | null = null;
    let deliveryType = "delivery";
    let methodZoneId: string | null = null;

    const { data: method, error: methodError } = await adminClient
      .from("delivery_methods")
      .select("id, fee, is_active, type, zone_id")
      .eq("id", body.deliveryMethodId)
      .maybeSingle();

    if (methodError || !method || !method.is_active) {
      return new Response(
        JSON.stringify({ error: "Selected delivery method is not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    deliveryFee = Number(method.fee);
    deliveryMethodId = method.id;
    deliveryType = method.type || "delivery";
    methodZoneId = method.zone_id || null;

    // If a zone ID is provided, look up the zone fee (overrides method fee)
    let zoneId: string | null = methodZoneId;
    if (body.zoneId && deliveryType === "delivery") {
      const { data: zone, error: zoneError } = await adminClient
        .from("delivery_zones")
        .select("id, base_fee, is_active")
        .eq("id", body.zoneId)
        .maybeSingle();

      if (!zoneError && zone && zone.is_active) {
        deliveryFee = Number(zone.base_fee);
        zoneId = zone.id;
      }
    }

    // For pickup, force delivery fee to the method fee (no zone override)
    if (deliveryType === "pickup") {
      zoneId = null;
    }

    const serverTotal = serverSubtotal + deliveryFee;

    // Generate unique reference
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const reference = `SSF-${timestamp}-${random}`;

    // Generate order number
    const { data: orderNumber } = await adminClient.rpc("generate_order_number");
    if (!orderNumber) {
      return new Response(
        JSON.stringify({ error: "Failed to generate order number" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the order
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: body.userId || null,
        customer_name: body.customer.fullName,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone,
        delivery_address: body.customer.address,
        suburb: body.customer.suburb,
        city: body.customer.city,
        province: body.customer.province,
        postal_code: body.customer.postalCode,
        delivery_instructions: body.customer.deliveryInstructions || null,
        subtotal: serverSubtotal,
        delivery_fee: deliveryFee,
        delivery_method_id: deliveryMethodId,
        total: serverTotal,
        status: "pending",
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create order items
    const { error: itemsError } = await adminClient
      .from("order_items")
      .insert(
        orderItems.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          store_id: item.storeId,
          product_name: item.productName,
          product_image: item.productImage,
          size: item.size,
          colour: item.colour,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal,
        }))
      );

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: "Failed to create order items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create delivery record linked to this order
    const { error: deliveryError } = await adminClient
      .from("deliveries")
      .insert({
        order_id: order.id,
        delivery_method_id: deliveryMethodId,
        delivery_fee: deliveryFee,
        status: "awaiting_fulfilment",
        zone_id: zoneId,
      });

    if (deliveryError) {
      return new Response(
        JSON.stringify({ error: "Failed to create delivery record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert initial delivery status history
    const { data: deliveryRec } = await adminClient
      .from("deliveries")
      .select("id")
      .eq("order_id", order.id)
      .single();

    if (deliveryRec) {
      await adminClient.from("delivery_status_history").insert({
        delivery_id: deliveryRec.id,
        status: "awaiting_fulfilment",
        note: "Order placed",
      });
    }

    // Create payment transaction record
    const { error: txError } = await adminClient
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        reference,
        provider: "paystack",
        amount: serverTotal,
        currency: "ZAR",
        status: "pending",
      });

    if (txError) {
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger order confirmation notification (simulated in demo mode)
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          eventType: "order_confirmation",
          orderId: order.id,
        }),
      });
    } catch {
      // Notification failure should not block order creation
    }

    // Initialize Paystack transaction
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!paystackSecretKey) {
      // No Paystack key configured — return order created with test mode flag
      return new Response(
        JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          reference,
          amount: serverTotal,
          currency: "ZAR",
          testMode: true,
          authorizationUrl: null,
          message: "Paystack key not configured. Order created in test mode.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Paystack expects amount in kobo (for ZAR: multiply by 100 → cents)
    const paystackAmount = Math.round(serverTotal * 100);

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}`;
    const siteUrl = Deno.env.get("SITE_URL") || "https://example.com";

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: body.customer.email,
        amount: paystackAmount,
        currency: "ZAR",
        reference,
        callback_url: `${siteUrl}/#/payment/verify/${reference}`,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: body.customer.fullName,
          custom_fields: [
            { display_name: "Order Number", variable_name: "order_number", value: order.order_number },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      // Update transaction status to failed
      await adminClient
        .from("payment_transactions")
        .update({ status: "failed", paystack_response: paystackData })
        .eq("reference", reference);

      return new Response(
        JSON.stringify({ error: paystackData.message || "Failed to initialize payment" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save the access code
    await adminClient
      .from("payment_transactions")
      .update({ paystack_access_code: paystackData.data.access_code })
      .eq("reference", reference);

    return new Response(
      JSON.stringify({
        orderId: order.id,
        orderNumber: order.order_number,
        reference,
        amount: serverTotal,
        currency: "ZAR",
        testMode: false,
        authorizationUrl: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
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
