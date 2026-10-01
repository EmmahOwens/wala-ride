// ============================================================================
// Supabase Edge Function: notifications-dispatcher (Phase 6)
// ============================================================================
// Responsibilities:
//   1. Africa's Talking Uganda SMS Gateway Integration
//   2. Transactional SMS Templates (Booking Confirmation, Departure Alert, SOS)
//   3. Queue Drain & Status Tracking in PostgreSQL notifications table
//   4. Fallback simulator for offline/sandbox test environments
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface DispatchSmsPayload {
  to: string;
  message?: string;
  template?: "booking_confirmed" | "departure_alert" | "sos_emergency" | "custom";
  params?: Record<string, any>;
  notification_id?: string;
  user_id?: string;
}

/** Formats local Uganda phone numbers to E.164 (+256...) */
function formatUgandaPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+256")) return cleaned;
  if (cleaned.startsWith("256")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+256${cleaned.slice(1)}`;
  return cleaned;
}

/** Renders standard SMS templates specified in Backend Implementation Plan Module 8 */
function renderSmsTemplate(template: string, params: Record<string, any> = {}): string {
  switch (template) {
    case "booking_confirmed":
      return `Wala Ride: Booking #${params.booking_reference || "REF"} confirmed for ${params.origin || "Origin"}->${params.destination || "Destination"} on ${params.departure_time || "scheduled date"}. Driver: ${params.driver_name || "Driver"} (${params.driver_phone || "N/A"}). Plate: ${params.license_plate || "N/A"}.`;
    case "departure_alert":
      return `Your Wala Ride departs in ${params.minutes_remaining || 60} minutes from ${params.stage || "stage"}. Driver: ${params.driver_name || "Driver"} (${params.driver_phone || "N/A"}). Vehicle: ${params.license_plate || "N/A"}.`;
    case "sos_emergency":
      return `EMERGENCY: ${params.passenger_name || "Passenger"} triggered SOS on Wala Ride trip ${params.trip_ref || ""}. Track live: ${params.tracking_url || "https://walaride.com"}.`;
    default:
      return params.message || "Wala Ride update.";
  }
}

/** Dispatches SMS via Africa's Talking API with fallback simulation */
async function sendViaAfricasTalking(
  toPhone: string,
  message: string,
  apiKey: string,
  username: string,
  senderId?: string,
): Promise<{ success: boolean; messageId: string; cost: string; raw: any }> {
  const isSandbox = username.toLowerCase() === "sandbox";
  const baseUrl = isSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  if (!apiKey) {
    console.warn("AFRICASTALKING_API_KEY not configured. Simulating SMS delivery in sandbox mode.");
    return {
      success: true,
      messageId: `SIM-AT-UG-${Date.now()}`,
      cost: "UGX 35.0000",
      raw: {
        SMSMessageData: {
          Message: "Sent to 1/1 Total Cost: UGX 35.0000",
          Recipients: [
            {
              number: toPhone,
              status: "Success",
              statusCode: 101,
              cost: "UGX 35.0000",
              messageId: `SIM-AT-UG-${Date.now()}`,
            },
          ],
        },
      },
    };
  }

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append("username", username);
    bodyParams.append("to", toPhone);
    bodyParams.append("message", message);
    if (senderId && !isSandbox) {
      bodyParams.append("from", senderId);
    }

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        apiKey: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const json = await res.json();
    const recipient = json?.SMSMessageData?.Recipients?.[0];
    const isSuccess = recipient?.status === "Success";

    return {
      success: isSuccess,
      messageId: recipient?.messageId || `AT-${Date.now()}`,
      cost: recipient?.cost || "UGX 0.0000",
      raw: json,
    };
  } catch (err: any) {
    console.error("Africa's Talking gateway request failed:", err);
    return {
      success: false,
      messageId: `ERR-${Date.now()}`,
      cost: "0",
      raw: { error: err.message },
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const atApiKey = Deno.env.get("AFRICASTALKING_API_KEY") ?? "";
    const atUsername = Deno.env.get("AFRICASTALKING_USERNAME") ?? "sandbox";
    const senderId = Deno.env.get("SMS_SENDER_ID") ?? "WALARIDE";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "send_sms";

    // ────────────────────────────────────────────────────────────
    // ACTION 1: Drain Pending SMS Queue
    // ────────────────────────────────────────────────────────────
    if (action === "drain_queue") {
      const limit = body.limit || 20;
      const { data: pendingList, error: qErr } = await supabase.rpc(
        "get_pending_notifications",
        { p_channel: "sms", p_limit: limit },
      );

      if (qErr) {
        return new Response(
          JSON.stringify({ error: "FAILED_FETCH_QUEUE", details: qErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const results = [];
      for (const item of (pendingList || [])) {
        const destPhone = formatUgandaPhone(item.phone_number || item.data?.contact_phone || "+256700000000");
        const messageText = item.body || item.title || "Wala Ride Notification";

        const atResult = await sendViaAfricasTalking(
          destPhone,
          messageText,
          atApiKey,
          atUsername,
          senderId,
        );

        // Update database notification delivery status
        await supabase.rpc("update_notification_status", {
          p_notification_id: item.id,
          p_status: atResult.success ? "delivered" : "failed",
          p_provider_ref: atResult.messageId,
          p_error: atResult.success ? null : JSON.stringify(atResult.raw),
        });

        results.push({
          notification_id: item.id,
          phone: destPhone,
          success: atResult.success,
          message_id: atResult.messageId,
          cost: atResult.cost,
        });
      }

      return new Response(
        JSON.stringify({ success: true, processed_count: results.length, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ────────────────────────────────────────────────────────────
    // ACTION 2: Direct Single SMS Dispatch
    // ────────────────────────────────────────────────────────────
    const to = formatUgandaPhone(body.to || "");
    if (!to) {
      return new Response(
        JSON.stringify({ error: "MISSING_RECIPIENT_PHONE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageText = body.template
      ? renderSmsTemplate(body.template, body.params || {})
      : body.message || "Wala Ride travel update.";

    const atResult = await sendViaAfricasTalking(
      to,
      messageText,
      atApiKey,
      atUsername,
      senderId,
    );

    // If linked to a notification row, record delivery
    if (body.notification_id) {
      await supabase.rpc("update_notification_status", {
        p_notification_id: body.notification_id,
        p_status: atResult.success ? "delivered" : "failed",
        p_provider_ref: atResult.messageId,
        p_error: atResult.success ? null : JSON.stringify(atResult.raw),
      });
    }

    return new Response(
      JSON.stringify({
        success: atResult.success,
        recipient: to,
        message: messageText,
        provider: "africas_talking",
        message_id: atResult.messageId,
        cost: atResult.cost,
        raw: atResult.raw,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Notifications dispatcher exception:", err);
    return new Response(
      JSON.stringify({ error: "DISPATCH_FAILED", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
