import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Determine if this is a webhook event or a manual verification request
    const contentType = req.headers.get("content-type") || "";
    const isWebhook = contentType.includes("application/json") &&
      req.headers.get("x-paystack-signature") !== null;

    let reference: string;
    let isWebhookEvent = false;

    if (isWebhook && paystackSecretKey) {
      // Verify webhook signature
      const crypto = await import("node:crypto");
      const rawBody = await req.text();
      const signature = crypto
        .createHmac("sha512", paystackSecretKey)
        .update(rawBody)
        .digest("hex");

      const providedSignature = req.headers.get("x-paystack-signature");
      if (signature !== providedSignature) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const event = JSON.parse(rawBody);
      reference = event.data.reference;
      isWebhookEvent = true;

      // Only process charge.success events
      if (event.event !== "charge.success") {
        return new Response(
          JSON.stringify({ message: "Event ignored" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Manual verification (from frontend redirect)
      const body = await req.json();
      reference = body.reference;
    }

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Reference is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the transaction in our database
    const { data: transaction, error: txError } = await adminClient
      .from("payment_transactions")
      .select("id, order_id, reference, status, amount, verified_at")
      .eq("reference", reference)
      .maybeSingle();

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent duplicate processing — if already verified and success, return existing state
    if (transaction.status === "success" && transaction.verified_at) {
      // Return the current order status
      const { data: order } = await adminClient
        .from("orders")
        .select("id, order_number, status, total")
        .eq("id", transaction.order_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          reference: transaction.reference,
          status: "success",
          orderStatus: order?.status || "paid",
          orderId: transaction.order_id,
          orderNumber: order?.order_number,
          alreadyProcessed: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If Paystack is not configured (test mode), we can't verify via API
    if (!paystackSecretKey) {
      // In test mode without Paystack, mark as pending
      return new Response(
        JSON.stringify({
          reference: transaction.reference,
          status: "pending",
          testMode: true,
          message: "Paystack not configured. Payment verification unavailable.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the transaction with Paystack API
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.status) {
      // Verification failed
      await adminClient
        .from("payment_transactions")
        .update({
          status: "failed",
          paystack_response: verifyData,
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference);

      await adminClient
        .from("orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", transaction.order_id);

      return new Response(
        JSON.stringify({
          reference: transaction.reference,
          status: "failed",
          message: verifyData.message || "Payment verification failed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paystackStatus = verifyData.data.status;
    const paystackAmount = verifyData.data.amount;
    const paystackCurrency = verifyData.data.currency;
    const expectedAmount = Math.round(Number(transaction.amount) * 100);

    // Validate amount and currency match
    if (
      paystackStatus !== "success" ||
      paystackAmount !== expectedAmount ||
      paystackCurrency !== "ZAR"
    ) {
      await adminClient
        .from("payment_transactions")
        .update({
          status: paystackStatus === "success" ? "success" : "failed",
          paystack_response: verifyData,
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference);

      if (paystackStatus !== "success") {
        await adminClient
          .from("orders")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", transaction.order_id);

        return new Response(
          JSON.stringify({
            reference: transaction.reference,
            status: "failed",
            message: `Payment status: ${paystackStatus}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Amount/currency mismatch — flag as failed
      await adminClient
        .from("orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", transaction.order_id);

      return new Response(
        JSON.stringify({
          reference: transaction.reference,
          status: "failed",
          message: "Amount or currency mismatch",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payment verified successfully — update transaction and order
    await adminClient
      .from("payment_transactions")
      .update({
        status: "success",
        verified_at: new Date().toISOString(),
        paystack_response: verifyData,
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference);

    await adminClient
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", transaction.order_id);

    // Decrement product stock
    const { data: orderItems } = await adminClient
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", transaction.order_id);

    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        await adminClient.rpc("decrement_stock", {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        }).then(() => {});
      }
    }

    // Trigger payment verified notification (only after server-side verification)
    // Idempotency is handled by the send-notification function
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          eventType: "payment_verified",
          orderId: transaction.order_id,
        }),
      });
    } catch {
      // Notification failure should not block payment processing
    }

    return new Response(
      JSON.stringify({
        reference: transaction.reference,
        status: "success",
        orderStatus: "paid",
        orderId: transaction.order_id,
        alreadyProcessed: false,
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
