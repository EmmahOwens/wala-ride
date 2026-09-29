import { supabase } from '../../config/supabase';
import type { ISubscriptionService } from '../interfaces/ISubscriptionService';
import type { SubscriptionPlan, DriverSubscriptionSummary } from '../../types/domain';

export class SupabaseSubscriptionService implements ISubscriptionService {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data: plans, error: pErr } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_ugx', { ascending: true });

    if (pErr || !plans) {
      console.error('Error fetching subscription plans:', pErr);
      return [];
    }

    const { data: features } = await supabase
      .from('subscription_features')
      .select('*');

    return plans.map((p) => {
      const featMap: Record<string, string> = {};
      const featList: { feature_key: string; feature_value: string }[] = [];
      if (features) {
        features
          .filter((f) => f.plan_id === p.id)
          .forEach((f) => {
            featMap[f.feature_key] = f.feature_value;
            featList.push({ feature_key: f.feature_key, feature_value: f.feature_value });
          });
      }
      return {
        id: p.id,
        name: p.name,
        price_ugx: p.price_ugx,
        period_days: p.period_days,
        max_trips_per_period: p.max_trips_per_period,
        max_leads_per_period: p.max_leads_per_period,
        is_active: p.is_active,
        features: featList,
        featuresMap: featMap,
      };
    });
  }

  async getDriverSubscriptionSummary(driverId: string): Promise<DriverSubscriptionSummary | null> {
    const { data, error } = await supabase.rpc('get_driver_subscription_summary' as any, {
      p_driver_id: driverId,
    });

    if (error || !data || data.length === 0) {
      console.error('Error fetching subscription summary:', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row as DriverSubscriptionSummary;
  }

  async simulatePayment(
    driverId: string,
    planId: string,
    phoneNumber: string = '+256700000000',
    network: string = 'MTN MoMo'
  ): Promise<{ payment_id: string; status: string; plan_name: string; amount_ugx: number } | null> {
    const { data, error } = await supabase.rpc('simulate_subscription_payment' as any, {
      p_driver_id: driverId,
      p_plan_id: planId,
      p_phone_number: phoneNumber,
      p_network: network,
    });

    if (error || !data) {
      console.error('Payment simulation failed:', error);
      return null;
    }

    return data as { payment_id: string; status: string; plan_name: string; amount_ugx: number };
  }

  async simulateLeadTopup(
    driverId: string,
    leadsCount: number = 10,
    amountUgx: number = 10000,
    network: string = 'MTN MoMo'
  ): Promise<{ payment_id: string; status: string; leads_added: number; amount_ugx: number } | null> {
    const { data, error } = await supabase.rpc('simulate_lead_topup' as any, {
      p_driver_id: driverId,
      p_leads_count: leadsCount,
      p_amount_ugx: amountUgx,
      p_network: network,
    });

    if (error || !data) {
      console.error('Lead topup simulation failed:', error);
      return null;
    }

    return data as { payment_id: string; status: string; leads_added: number; amount_ugx: number };
  }
}

export const subscriptionService = new SupabaseSubscriptionService();
