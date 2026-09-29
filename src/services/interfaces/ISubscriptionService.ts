import type {
  SubscriptionPlan,
  DriverSubscriptionSummary,
  PaymentRecord,
  InitiatePaymentResult,
} from '../../types/domain';

export interface ISubscriptionService {
  getPlans(): Promise<SubscriptionPlan[]>;
  getDriverSubscriptionSummary(driverId: string): Promise<DriverSubscriptionSummary | null>;

  initiatePayment(params: {
    driverId: string;
    purpose: 'subscription' | 'lead_topup';
    planId?: string;
    amountUgx?: number;
    phoneNumber?: string;
    network?: string;
    leadsCount?: number;
  }): Promise<InitiatePaymentResult | null>;

  processWebhook(params: {
    paymentId: string;
    status: string;
    providerRef?: string;
    rawCallback?: Record<string, any>;
  }): Promise<{ success: boolean; status: string } | null>;

  getPaymentHistory(driverId: string): Promise<PaymentRecord[]>;

  subscribeToPayment(paymentId: string, onStatusChange: (status: string) => void): () => void;

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
