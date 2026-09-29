// Supabase Edge Function: payment-webhook
// Handles Mobile Money payment webhooks (Flutterwave, Pesapal, and Wala MoMo Simulator)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received payment webhook payload:', JSON.stringify(body));

    let paymentId: string | null = null;
    let status = 'failed';
    let providerRef: string | null = null;

    // 1. Flutterwave format
    if (body.event === 'charge.completed' && body.data) {
      const flwData = body.data;
      status = flwData.status === 'successful' ? 'successful' : 'failed';
      providerRef = flwData.tx_ref || flwData.flw_ref || String(flwData.id);

      // Find payment by provider_ref
      const { data: pData } = await supabase
        .from('payments')
        .select('id')
        .or(`provider_ref.eq.${providerRef},idempotency_key.eq.${providerRef}`)
        .maybeSingle();

      if (pData) {
        paymentId = pData.id;
      }
    }
    // 2. Pesapal format
    else if (body.OrderMerchantReference || body.orderMerchantReference) {
      providerRef = body.OrderTrackingId || body.orderTrackingId;
      const merchantRef = body.OrderMerchantReference || body.orderMerchantReference;

      const { data: pData } = await supabase
        .from('payments')
        .select('id')
        .or(`id.eq.${merchantRef},provider_ref.eq.${merchantRef}`)
        .maybeSingle();

      if (pData) {
        paymentId = pData.id;
        status = 'successful';
      }
    }
    // 3. Direct Wala MoMo Simulator
    else if (body.payment_id) {
      paymentId = body.payment_id;
      status = body.status || 'successful';
      providerRef = body.provider_ref || `SIM-${Date.now()}`;
    }

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'PAYMENT_RECORD_NOT_IDENTIFIED', body }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call database webhook processor
    const { data: result, error: rpcErr } = await supabase.rpc('process_payment_webhook', {
      p_payment_id: paymentId,
      p_status: status,
      p_provider_ref: providerRef,
      p_raw_callback: body,
    });

    if (rpcErr) {
      console.error('RPC process_payment_webhook error:', rpcErr);
      return new Response(
        JSON.stringify({ error: rpcErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Webhook handler unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
