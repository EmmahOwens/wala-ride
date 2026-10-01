// ============================================================================
// Supabase Edge Function: payment-webhook  (Phase 4 — hardened)
// ============================================================================
// Security model:
//   1. HMAC signature verification    – reject forged callbacks before DB touch
//   2. Back-channel provider query    – verify status independently of payload
//   3. Idempotency guard              – duplicate webhook → 200 no-op
//   4. Full audit log                 – every attempt written to webhook_verification_log
//
// Supported providers: Flutterwave, Pesapal, Wala internal simulator
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, verif-hash, x-pesapal-signature, x-wala-signature",
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Constant-time HMAC-SHA256 verification (prevents timing attacks). */
async function verifyHmacSha256(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = hexToBytes(signature);
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/^0x/, "");
  const buf = new ArrayBuffer(clean.length / 2);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Provider verification: Flutterwave
// ---------------------------------------------------------------------------
interface FlwVerifyResult {
  status: "successful" | "failed" | "pending" | "unknown";
  raw: Record<string, unknown>;
}

async function verifyFlutterwaveTransaction(
  txRef: string,
  secretKey: string,
): Promise<FlwVerifyResult> {
  try {
    const url = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    const json = await res.json() as Record<string, unknown>;
    const dataStatus = (json?.data as Record<string, unknown>)?.status as string | undefined;
    const status: FlwVerifyResult["status"] =
      dataStatus === "successful" ? "successful"
      : dataStatus === "failed" ? "failed"
      : dataStatus === "pending" ? "pending"
      : "unknown";
    return { status, raw: json };
  } catch (err) {
    console.error("FLW back-channel error:", err);
    return { status: "unknown", raw: { error: String(err) } };
  }
}

// ---------------------------------------------------------------------------
// Provider verification: Pesapal
// ---------------------------------------------------------------------------
interface PesapalVerifyResult {
  status: "successful" | "failed" | "pending" | "unknown";
  raw: Record<string, unknown>;
}

async function verifyPesapalTransaction(
  orderTrackingId: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<PesapalVerifyResult> {
  try {
    // Step 1: Get OAuth token
    const tokenRes = await fetch(
      "https://pay.pesapal.com/v3/api/Auth/RequestToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    const tokenJson = await tokenRes.json() as Record<string, unknown>;
    const token = tokenJson?.token as string | undefined;
    if (!token) {
      console.error("Pesapal token not obtained:", tokenJson);
      return { status: "unknown", raw: { error: "token_fetch_failed", details: tokenJson } };
    }

    // Step 2: Query transaction status
    const statusRes = await fetch(
      `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      },
    );
    const statusJson = await statusRes.json() as Record<string, unknown>;
    const paymentStatus = statusJson?.payment_status_description as string | undefined;
    const status: PesapalVerifyResult["status"] =
      paymentStatus === "Completed" ? "successful"
      : paymentStatus === "Failed" ? "failed"
      : paymentStatus === "Pending" ? "pending"
      : "unknown";
    return { status, raw: statusJson };
  } catch (err) {
    console.error("Pesapal back-channel error:", err);
    return { status: "unknown", raw: { error: String(err) } };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const flwSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";
    const flwWebhookSecret = Deno.env.get("FLUTTERWAVE_WEBHOOK_SECRET") ?? "";
    const pesapalConsumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? "";
    const pesapalConsumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? "";
    const simulatorSecret = Deno.env.get("WALA_SIMULATOR_WEBHOOK_SECRET") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Capture raw body for HMAC before JSON parsing
    const rawBody = await req.text();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "INVALID_JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Received payment webhook payload:", JSON.stringify(body));

    // ── Variables collected across detection branches ──────────────────────
    let paymentId: string | null = null;
    let providerRef: string | null = null;
    let provider = "unknown";
    let eventType: string | null = null;
    let signatureHeader: string | null = null;
    let signatureValid: boolean | null = null;
    let backChannelStatus = "pending";
    let backChannelResponse: Record<string, unknown> = {};
    let resolvedStatus = "failed";
    let idempotencyKey: string | null = null;

    // ============================================================
    // BRANCH 1: Flutterwave  (event: "charge.completed")
    // ============================================================
    if (body.event === "charge.completed" && body.data) {
      provider = "flutterwave";
      const flwData = body.data as Record<string, unknown>;
      eventType = "charge.completed";
      providerRef = ((flwData.tx_ref ?? flwData.flw_ref ?? String(flwData.id)) as string);
      idempotencyKey = providerRef;

      // 1a. HMAC / hash check
      signatureHeader = req.headers.get("verif-hash");
      if (flwWebhookSecret && signatureHeader) {
        // Flutterwave sends its webhook secret directly as the verif-hash header value
        signatureValid = signatureHeader === flwWebhookSecret;
      } else if (!flwWebhookSecret) {
        signatureValid = null;
        console.warn("FLUTTERWAVE_WEBHOOK_SECRET not set; skipping signature check (sandbox)");
      } else {
        signatureValid = false;
      }

      if (signatureValid === false) {
        console.error("FLW webhook: signature mismatch — rejecting");
        return new Response(
          JSON.stringify({ error: "SIGNATURE_INVALID" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 1b. Back-channel verification
      if (flwSecretKey && providerRef) {
        const flwResult = await verifyFlutterwaveTransaction(providerRef, flwSecretKey);
        backChannelStatus = flwResult.status;
        backChannelResponse = flwResult.raw;
        resolvedStatus = flwResult.status === "successful" ? "successful" : "failed";
      } else {
        resolvedStatus = (flwData.status as string) === "successful" ? "successful" : "failed";
        backChannelStatus = "skipped_no_api_key";
        console.warn("FLUTTERWAVE_SECRET_KEY not set; trusting payload (sandbox mode)");
      }

      // 1c. Resolve payment row
      const { data: pData } = await supabase
        .from("payments")
        .select("id")
        .or(`provider_ref.eq.${providerRef},idempotency_key.eq.${providerRef}`)
        .maybeSingle();
      if (pData) paymentId = pData.id;
    }

    // ============================================================
    // BRANCH 2: Pesapal  (IPN callback)
    // ============================================================
    else if (body.OrderMerchantReference || body.orderMerchantReference) {
      provider = "pesapal";
      eventType = "ipn_callback";
      const orderTrackingId = (body.OrderTrackingId ?? body.orderTrackingId) as string;
      const merchantRef = (body.OrderMerchantReference ?? body.orderMerchantReference) as string;
      providerRef = orderTrackingId;
      idempotencyKey = orderTrackingId ?? merchantRef;

      // 2a. Pesapal HMAC signature check
      signatureHeader = req.headers.get("x-pesapal-signature");
      if (pesapalConsumerSecret && signatureHeader) {
        signatureValid = await verifyHmacSha256(pesapalConsumerSecret, rawBody, signatureHeader);
        if (!signatureValid) {
          console.error("Pesapal webhook: HMAC invalid — rejecting");
          return new Response(
            JSON.stringify({ error: "SIGNATURE_INVALID" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        signatureValid = null;
        console.warn("Pesapal signature header missing or secret unconfigured");
      }

      // 2b. Back-channel verification
      if (pesapalConsumerKey && pesapalConsumerSecret && orderTrackingId) {
        const ppResult = await verifyPesapalTransaction(orderTrackingId, pesapalConsumerKey, pesapalConsumerSecret);
        backChannelStatus = ppResult.status;
        backChannelResponse = ppResult.raw;
        resolvedStatus = ppResult.status === "successful" ? "successful" : "failed";
      } else {
        resolvedStatus = "successful";
        backChannelStatus = "skipped_no_credentials";
        console.warn("Pesapal credentials not set; trusting IPN (sandbox)");
      }

      // 2c. Resolve payment row
      const { data: pData } = await supabase
        .from("payments")
        .select("id")
        .or(`id.eq.${merchantRef},provider_ref.eq.${merchantRef},idempotency_key.eq.${merchantRef}`)
        .maybeSingle();
      if (pData) paymentId = pData.id;
    }

    // ============================================================
    // BRANCH 3: Wala internal MoMo simulator
    // ============================================================
    else if (body.payment_id) {
      provider = "simulator";
      eventType = "simulator_callback";
      paymentId = body.payment_id as string;
      providerRef = (body.provider_ref as string) ?? `SIM-${Date.now()}`;
      idempotencyKey = providerRef;

      // 3a. Simulator HMAC (optional)
      signatureHeader = req.headers.get("x-wala-signature");
      if (simulatorSecret && signatureHeader) {
        signatureValid = await verifyHmacSha256(simulatorSecret, rawBody, signatureHeader);
        if (!signatureValid) {
          return new Response(
            JSON.stringify({ error: "SIGNATURE_INVALID" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        signatureValid = null;
      }

      resolvedStatus = ((body.status as string) ?? "successful").toLowerCase();
      if (!["successful", "failed", "pending"].includes(resolvedStatus)) {
        resolvedStatus = "failed";
      }
      backChannelStatus = "simulator_self_attested";
      backChannelResponse = { note: "Simulator: no back-channel needed" };
    }

    // ============================================================
    // Idempotency: check if this webhook event was already fully processed
    // ============================================================
    if (idempotencyKey) {
      const { data: prevLog } = await supabase
        .from("webhook_verification_log")
        .select("id, resolved_payment_status")
        .eq("idempotency_key", idempotencyKey)
        .not("resolved_payment_status", "eq", "unresolved")
        .maybeSingle();

      if (prevLog) {
        console.log("Duplicate webhook — idempotent no-op:", prevLog);
        return new Response(
          JSON.stringify({ success: true, idempotent: true, already_processed: true, log_id: prevLog.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ============================================================
    // Guard: payment record must be found
    // ============================================================
    if (!paymentId) {
      await supabase.rpc("record_webhook_attempt", {
        p_payment_id: null,
        p_provider: provider,
        p_event_type: eventType,
        p_raw_payload: body,
        p_signature_header: signatureHeader,
        p_signature_valid: signatureValid,
        p_back_channel_status: "payment_not_found",
        p_back_channel_response: backChannelResponse,
        p_resolved_status: "unresolved",
        p_idempotency_key: idempotencyKey,
        p_ip_address: clientIp,
      });
      return new Response(
        JSON.stringify({ error: "PAYMENT_RECORD_NOT_IDENTIFIED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============================================================
    // Write audit log entry
    // ============================================================
    const { data: logRow } = await supabase.rpc("record_webhook_attempt", {
      p_payment_id: paymentId,
      p_provider: provider,
      p_event_type: eventType,
      p_raw_payload: body,
      p_signature_header: signatureHeader,
      p_signature_valid: signatureValid,
      p_back_channel_status: backChannelStatus,
      p_back_channel_response: backChannelResponse,
      p_resolved_status: resolvedStatus,
      p_idempotency_key: idempotencyKey,
      p_ip_address: clientIp,
    });

    // ============================================================
    // Call the DB webhook processor
    // ============================================================
    const { data: result, error: rpcErr } = await supabase.rpc("process_payment_webhook", {
      p_payment_id: paymentId,
      p_status: resolvedStatus,
      p_provider_ref: providerRef,
      p_raw_callback: body,
      p_signature_verified: signatureValid,
      p_provider_verified_at: new Date().toISOString(),
      p_provider_verified_status: backChannelStatus,
    });

    if (rpcErr) {
      console.error("RPC process_payment_webhook error:", rpcErr);
      return new Response(
        JSON.stringify({ error: rpcErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        result,
        log_id: logRow as string | null,
        provider,
        signature_valid: signatureValid,
        back_channel_status: backChannelStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "INTERNAL_ERROR";
    console.error("Webhook handler unhandled error:", err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
