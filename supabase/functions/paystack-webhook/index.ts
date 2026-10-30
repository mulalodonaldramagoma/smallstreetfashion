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
    let webhookEvent: string | null = null;
    let webhookData: Record<string, unknown> | null = null;

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
      webhookEvent = event.event;
      webhookData = event.data;
      reference = event.data.reference;
      isWebhookEvent = true;

      // Handle refund events — all four refund lifecycle events
      if (event.event === "refund.processed" || event.event === "refund.failed" ||
          event.event === "refund.pending" || event.event === "refund.processing") {
        return await handleRefundEvent(
          adminClient,
          supabaseUrl,
          serviceRoleKey,
          paystackSecretKey,
          event.event,
          event.data
        );
      }

      // Only process charge.success events for payment verification
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

    // Process stock decrement and seller earnings atomically via the
    // process_order_post_payment function. This replaces the previous
    // non-atomic per-item stock decrement loop. The function is idempotent
    // (safe to retry) and uses order_processing_log to track completion.
    const { data: processingResult, error: processingError } = await adminClient.rpc(
      "process_order_post_payment",
      { p_order_id: transaction.order_id }
    );

    // If post-payment processing fails, the order is still marked paid
    // but the processing_error field in order_processing_log will record
    // the issue for later reconciliation. The function can be safely retried.
    if (processingError) {
      console.error(`Post-payment processing failed for order ${transaction.order_id}:`, processingError.message);
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

// ============================================================
// Refund event handler
// ============================================================
async function handleRefundEvent(
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  paystackSecretKey: string | undefined,
  eventType: string,
  data: Record<string, unknown>
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };

  try {
    // Extract fields from Paystack refund webhook payload.
    // Per Paystack official docs (docs-v2.paystack.com/payments/refunds):
    //   data.transaction_reference — string, the original payment reference
    //   data.refund_reference — string or null (null for pending, present for processed/failed)
    //   data.amount — string, amount in kobo/cents
    //   data.currency — string (e.g. "NGN", "ZAR")
    //   data.status — string ("pending" | "processing" | "processed" | "failed")

    const originalReference = (data.transaction_reference as string) || null;
    const refundReferenceFromPaystack = (data.refund_reference as string) || null;
    const refundAmountRaw = Number(data.amount) || 0;
    const refundAmountZar = refundAmountRaw / 100;
    const refundCurrency = (data.currency as string) || null;
    const refundStatusFromPayload = (data.status as string) || null;

    if (!originalReference) {
      console.error("Refund webhook: no transaction_reference found in payload");
      return new Response(
        JSON.stringify({ error: "No transaction_reference in refund data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the original payment to get the order_id
    const { data: paymentTx, error: paymentError } = await adminClient
      .from("payment_transactions")
      .select("id, order_id, reference, amount, currency")
      .eq("reference", originalReference)
      .maybeSingle();

    if (paymentError || !paymentTx) {
      console.error("Refund webhook: original payment not found for reference", originalReference);
      return new Response(
        JSON.stringify({ error: "Original payment transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate currency matches the original payment
    if (refundCurrency && refundCurrency !== "ZAR") {
      console.error("Refund webhook: currency mismatch:", refundCurrency);
      return new Response(
        JSON.stringify({ error: `Unexpected refund currency: ${refundCurrency}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Paystack's refund_reference if provided. If null (e.g. pending event),
    // construct a deterministic reference from the event type + transaction reference
    // so that retries of the same webhook event map to the same refund record.
    // Never use Date.now() — that would create a new reference on every retry,
    // defeating idempotency.
    const refundReference = refundReferenceFromPaystack ||
      `refund-${eventType}-${originalReference}`;

    if (eventType === "refund.failed" || eventType === "refund.pending" || eventType === "refund.processing") {
      // Record as pending — no earnings adjustment for non-processed events
      const { error: refundError } = await adminClient.rpc(
        "process_refund_notification",
        {
          p_refund_reference: refundReference,
          p_order_id: paymentTx.order_id,
          p_amount: refundAmountZar,
          p_paystack_response: JSON.stringify(data),
          p_verified: false,
        }
      );

      if (refundError) {
        console.error("Refund webhook: failed to record failed refund:", refundError.message);
      }

      return new Response(
        JSON.stringify({ message: "Refund failure recorded", refundReference }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // refund.processed — verify the refund server-side before adjusting earnings
    // If Paystack is not configured, we cannot verify — record as pending only
    if (!paystackSecretKey) {
      const { error: rpcError } = await adminClient.rpc(
        "process_refund_notification",
        {
          p_refund_reference: refundReference,
          p_order_id: paymentTx.order_id,
          p_amount: refundAmountZar,
          p_paystack_response: JSON.stringify(data),
          p_verified: false,
        }
      );

      if (rpcError) {
        console.error("Refund webhook: failed to record pending refund:", rpcError.message);
      }

      return new Response(
        JSON.stringify({
          message: "Refund recorded as pending — Paystack not configured for verification",
          refundReference,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the refund with Paystack API using the transaction reference
    // Paystack provides a list refunds endpoint: GET /transaction/:id/refund
    // Or verify the transaction itself to see refund status
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${originalReference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.status) {
      // Verification failed — record as pending, do NOT adjust earnings
      const { error: rpcError } = await adminClient.rpc(
        "process_refund_notification",
        {
          p_refund_reference: refundReference,
          p_order_id: paymentTx.order_id,
          p_amount: refundAmountZar,
          p_paystack_response: JSON.stringify(verifyData),
          p_verified: false,
        }
      );

      if (rpcError) {
        console.error("Refund webhook: failed to record unverified refund:", rpcError.message);
      }

      return new Response(
        JSON.stringify({
          message: "Refund could not be verified — recorded as pending",
          refundReference,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refund verified — process the adjustment
    const { data: refundResult, error: refundError } = await adminClient.rpc(
      "process_refund_notification",
      {
        p_refund_reference: refundReference,
        p_order_id: paymentTx.order_id,
        p_amount: refundAmountZar,
        p_paystack_response: JSON.stringify(verifyData),
        p_verified: true,
      }
    );

    if (refundError) {
      console.error("Refund webhook: failed to process verified refund:", refundError.message);
      return new Response(
        JSON.stringify({ error: "Failed to process refund" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send refund notification to the seller
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          eventType: "order_cancelled",
          orderId: paymentTx.order_id,
        }),
      });
    } catch {
      // Notification failure should not block refund processing
    }

    return new Response(
      JSON.stringify({
        message: "Refund processed",
        refundReference,
        result: refundResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Refund handler error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Refund handler error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
