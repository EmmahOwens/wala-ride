import type { SubscriptionPlan, DriverSubscriptionSummary } from '../../types/domain';

export interface ISubscriptionService {
  getPlans(): Promise<SubscriptionPlan[]>;
  getDriverSubscriptionSummary(driverId: string): Promise<DriverSubscriptionSummary | null>;
  simulatePayment(
    driverId: string,
    planId: string,
    phoneNumber?: string,
    network?: string
  ): Promise<{ payment_id: string; status: string; plan_name: string; amount_ugx: number } | null>;
  simulateLeadTopup(
    driverId: string,
    leadsCount?: number,
    amountUgx?: number,
    network?: string
  ): Promise<{ payment_id: string; status: string; leads_added: number; amount_ugx: number } | null>;
}
