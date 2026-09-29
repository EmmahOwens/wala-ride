import React, { useState, useEffect } from 'react';
import {
  Check,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  PlusCircle,
  CheckCircle,
  Radio,
} from 'lucide-react';
import { subscriptionService } from '../../services/supabase/SupabaseSubscriptionService';
import type {
  SubscriptionPlan,
  DriverSubscriptionSummary,
  PaymentRecord,
  InitiatePaymentResult,
} from '../../types/domain';

interface DriverSubscriptionViewProps {
  driverId: string;
  onPlanChanged?: () => void;
}

export const DriverSubscriptionView: React.FC<DriverSubscriptionViewProps> = ({
  driverId,
  onPlanChanged,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [summary, setSummary] = useState<DriverSubscriptionSummary | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkout Form State
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [showTopupCheckout, setShowTopupCheckout] = useState(false);
  const [phone, setPhone] = useState('+256772123456');
  const [network, setNetwork] = useState<'MTN MoMo' | 'Airtel Money'>('MTN MoMo');

  // Active USSD Payment In Progress State
  const [activePayment, setActivePayment] = useState<InitiatePaymentResult | null>(null);
  const [paymentStep, setPaymentStep] = useState<'form' | 'waiting_ussd' | 'success'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, subData, historyData] = await Promise.all([
        subscriptionService.getPlans(),
        subscriptionService.getDriverSubscriptionSummary(driverId),
        subscriptionService.getPaymentHistory(driverId),
      ]);
      setPlans(plansData);
      setSummary(subData);
      setPaymentHistory(historyData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load subscription information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [driverId]);

  // Realtime payment listener
  useEffect(() => {
    if (!activePayment || paymentStep !== 'waiting_ussd') return;

    const unsubscribe = subscriptionService.subscribeToPayment(
      activePayment.payment_id,
      async (newStatus) => {
        if (newStatus === 'successful') {
          setPaymentStep('success');
          await loadData();
          if (onPlanChanged) onPlanChanged();
        } else if (newStatus === 'failed') {
          setError('Payment was declined or cancelled on your mobile handset.');
          setPaymentStep('form');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activePayment, paymentStep]);

  const handleStartPayment = async (purpose: 'subscription' | 'lead_topup', planId?: string, amountUgx?: number) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await subscriptionService.initiatePayment({
        driverId,
        purpose,
        planId,
        amountUgx,
        phoneNumber: phone.trim(),
        network,
        leadsCount: 10,
      });

      if (!result) {
        throw new Error('Failed to initiate Mobile Money request. Check phone number.');
      }

      setActivePayment(result);
      setPaymentStep('waiting_ussd');
    } catch (err: any) {
      setError(err?.message || 'Error initiating payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateApproval = async () => {
    if (!activePayment) return;
    setIsProcessing(true);
    try {
      await subscriptionService.processWebhook({
        paymentId: activePayment.payment_id,
        status: 'successful',
        providerRef: 'SIM_MOMO_PROMPT_' + Date.now(),
        rawCallback: {
          event: 'charge.completed',
          status: 'successful',
          tx_ref: activePayment.provider_ref,
          customer: { phone_number: activePayment.phone_number },
        },
      });
      // Realtime listener or direct reload will set step to success
      setPaymentStep('success');
      await loadData();
      if (onPlanChanged) onPlanChanged();
    } catch (err: any) {
      setError(err?.message || 'Simulation error');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeCheckoutModal = () => {
    setSelectedPlanForCheckout(null);
    setShowTopupCheckout(false);
    setActivePayment(null);
    setPaymentStep('form');
    setError(null);
  };

  const formatUgx = (amount: number) => {
    return new Intl.NumberFormat('en-UG').format(amount) + ' UGX';
  };

  if (loading && !summary) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--uber-gray-400)' }}>
        Loading subscription quotas and active plans...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Current Active Plan Status Card */}
      {summary && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    backgroundColor: summary.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: summary.status === 'active' ? '#22c55e' : '#eab308',
                  }}
                >
                  {summary.status.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--uber-gray-400)' }}>
                  Expires in {summary.days_remaining} {summary.days_remaining === 1 ? 'day' : 'days'}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{summary.plan_name}</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginTop: '0.25rem' }}>
                Active Period: {new Date(summary.starts_at).toLocaleDateString()} &mdash;{' '}
                {new Date(summary.ends_at).toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                onClick={() => setShowTopupCheckout(true)}
              >
                <PlusCircle size={16} /> Top Up Leads
              </button>
              <button
                onClick={loadData}
                className="btn btn-outline"
                style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Refresh Quotas"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Quota Progress Bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* Scheduled Trips Quota */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--uber-gray-300)', fontWeight: 600 }}>Scheduled Trips Posted</span>
                <span style={{ fontWeight: 700 }}>
                  {summary.trips_posted} / {summary.max_trips >= 999 ? 'Unlimited' : summary.max_trips}
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (summary.trips_posted / (summary.max_trips >= 999 ? 100 : summary.max_trips)) * 100)}%`,
                    backgroundColor: summary.trips_remaining > 0 ? '#3b82f6' : '#ef4444',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: summary.trips_remaining > 0 ? 'var(--uber-gray-400)' : '#ef4444' }}>
                {summary.max_trips >= 999
                  ? 'Unlimited intercity trip publishing enabled'
                  : `${summary.trips_remaining} trips remaining in this billing cycle`}
              </div>
            </div>

            {/* Radar Lead Credits */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--uber-gray-300)', fontWeight: 600 }}>Radar Leads Unlocked</span>
                <span style={{ fontWeight: 700 }}>
                  {summary.leads_viewed} / {summary.max_leads}
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (summary.leads_viewed / summary.max_leads) * 100)}%`,
                    backgroundColor: summary.leads_remaining > 0 ? '#22c55e' : '#ef4444',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: summary.leads_remaining > 0 ? 'var(--uber-gray-400)' : '#ef4444' }}>
                {summary.leads_remaining} lead credits remaining for contacting passengers directly
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans & Upgrades */}
      <div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Subscription Tiers & Plans</h3>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--uber-gray-400)', fontSize: '0.875rem' }}>
          Select a plan that fits your driving schedule. Renewals stack onto your current period.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {plans.map((p) => {
            const isCurrent = summary?.plan_id === p.id;
            const isPro = p.price_ugx > 30000;

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  border: isCurrent
                    ? '2px solid #3b82f6'
                    : isPro
                    ? '1px solid rgba(168, 85, 247, 0.5)'
                    : '1px solid var(--uber-gray-700)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '20px',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Current Plan
                  </div>
                )}

                {isPro && !isCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '20px',
                      backgroundColor: '#a855f7',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Best Value
                  </div>
                )}

                <div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>{p.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                      {p.price_ugx === 0 ? 'Free' : formatUgx(p.price_ugx)}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--uber-gray-400)' }}>/ {p.period_days} days</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--uber-gray-300)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Check size={16} color="#22c55e" />
                      <span>{p.max_trips_per_period >= 999 ? 'Unlimited Scheduled Trips' : `Up to ${p.max_trips_per_period} Scheduled Trips`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Check size={16} color="#22c55e" />
                      <span>{p.max_leads_per_period} Passenger Radar Lead Unlocks</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Check size={16} color="#22c55e" />
                      <span>Direct Cash & MoMo Fares (100% Driver Keep)</span>
                    </div>
                    {p.featuresMap?.verified_badge === 'true' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={16} color="#22c55e" />
                        <span>Verified Driver Trust Badge</span>
                      </div>
                    )}
                    {p.featuresMap?.priority_listing === 'true' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={16} color="#22c55e" />
                        <span>Top Search Placement & Corridors</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className={isCurrent ? 'btn btn-outline' : 'btn btn-primary'}
                  style={{ width: '100%' }}
                  disabled={isCurrent && summary?.status === 'active'}
                  onClick={() => {
                    setSelectedPlanForCheckout(p);
                    setPaymentStep('form');
                  }}
                >
                  {isCurrent ? 'Renew Current Plan' : `Upgrade for ${p.price_ugx === 0 ? 'Free' : formatUgx(p.price_ugx)}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Mobile Money Checkout Modal */}
      {(selectedPlanForCheckout || showTopupCheckout) && (
        <div className="modal-backdrop" onClick={closeCheckoutModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            {paymentStep === 'form' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Mobile Money Checkout</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--uber-gray-400)' }}>
                      MTN MoMo & Airtel Money Direct USSD Push
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--uber-gray-400)' }}>Item:</span>
                    <span style={{ fontWeight: 600 }}>
                      {showTopupCheckout ? '+10 Radar Leads Pack' : selectedPlanForCheckout?.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <span>Amount Due:</span>
                    <span style={{ color: '#22c55e' }}>
                      {formatUgx(showTopupCheckout ? 10000 : selectedPlanForCheckout?.price_ugx || 0)}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                    Select Provider
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {(['MTN MoMo', 'Airtel Money'] as const).map((net) => (
                      <button
                        key={net}
                        type="button"
                        className="btn"
                        style={{
                          backgroundColor: network === net ? 'var(--uber-white)' : 'var(--uber-gray-800)',
                          color: network === net ? 'var(--uber-black)' : 'var(--uber-white)',
                          border: '1px solid var(--uber-gray-700)',
                          fontSize: '0.85rem',
                        }}
                        onClick={() => setNetwork(net)}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                    Uganda Mobile Money Phone Number
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+256 700 000000"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--uber-gray-400)', marginTop: '0.3rem', display: 'block' }}>
                    * An instant USSD PIN authorization prompt will be pushed to this mobile handset.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={closeCheckoutModal} disabled={isProcessing}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1.5 }}
                    onClick={() => {
                      if (showTopupCheckout) {
                        handleStartPayment('lead_topup', undefined, 10000);
                      } else if (selectedPlanForCheckout) {
                        handleStartPayment('subscription', selectedPlanForCheckout.id, selectedPlanForCheckout.price_ugx);
                      }
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Sending Prompt...' : 'Send USSD Prompt'}
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'waiting_ussd' && activePayment && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: network === 'MTN MoMo' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: network === 'MTN MoMo' ? '#eab308' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <Smartphone size={32} className="pulse-animation" />
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Authorize on Your Phone</h3>
                <p style={{ margin: '0 0 1.25rem', color: 'var(--uber-gray-300)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  A push prompt for <strong>{formatUgx(activePayment.amount_ugx)}</strong> has been sent to{' '}
                  <strong>{activePayment.phone_number}</strong> via <strong>{activePayment.network}</strong>.
                </p>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--uber-gray-400)',
                    marginBottom: '1.5rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Reference:</span>
                    <strong style={{ color: 'var(--uber-white)' }}>{activePayment.provider_ref}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Live Listener:</span>
                    <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Radio size={12} /> Listening for Webhook
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                    onClick={handleSimulateApproval}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Verifying Webhook...' : 'Simulate Handset Approval (Sandbox)'}
                  </button>
                  <button className="btn btn-outline" style={{ width: '100%' }} onClick={closeCheckoutModal}>
                    Cancel Transaction
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'success' && activePayment && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    color: '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <CheckCircle size={36} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Payment Successful!</h3>
                <p style={{ margin: '0 0 1.25rem', color: 'var(--uber-gray-400)', fontSize: '0.875rem' }}>
                  Your Mobile Money payment of <strong>{formatUgx(activePayment.amount_ugx)}</strong> has been verified.
                  Your subscription quotas and active period have been credited.
                </p>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    marginBottom: '1.5rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--uber-gray-400)' }}>Transaction ID:</span>
                    <span>{activePayment.provider_ref}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--uber-gray-400)' }}>Provider:</span>
                    <span>{activePayment.network}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--uber-gray-400)' }}>Status:</span>
                    <strong style={{ color: '#22c55e' }}>CONFIRMED & APPLIED</strong>
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeCheckoutModal}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment & Billing History Log */}
      <div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Payment & Billing History</h3>
        <p style={{ margin: '0 0 1rem', color: 'var(--uber-gray-400)', fontSize: '0.875rem' }}>
          Audit trail of your Mobile Money subscription payments and lead top-ups.
        </p>

        {paymentHistory.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--uber-gray-400)' }}>
            No payment records found yet.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--uber-gray-700)', color: 'var(--uber-gray-400)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Provider & Reference</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((rec) => {
                    const isSuccess = rec.status === 'successful';
                    const isPending = rec.status === 'pending';

                    return (
                      <tr key={rec.payment_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--uber-gray-300)' }}>
                          {new Date(rec.initiated_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          {rec.purpose === 'subscription' ? rec.plan_name : 'Radar Leads Top-up (+10)'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--uber-gray-400)', fontSize: '0.8rem' }}>
                          <div>{rec.provider}</div>
                          <div style={{ fontFamily: 'monospace' }}>{rec.provider_ref}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                          {formatUgx(rec.amount_ugx)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: isSuccess
                                ? 'rgba(34, 197, 94, 0.15)'
                                : isPending
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                              color: isSuccess ? '#22c55e' : isPending ? '#eab308' : '#ef4444',
                            }}
                          >
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
