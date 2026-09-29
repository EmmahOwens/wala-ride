import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, Smartphone, RefreshCw, PlusCircle } from 'lucide-react';
import { subscriptionService } from '../../services/supabase/SupabaseSubscriptionService';
import type { SubscriptionPlan, DriverSubscriptionSummary } from '../../types/domain';

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
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<SubscriptionPlan | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('+256772123456');
  const [paymentNetwork, setPaymentNetwork] = useState('MTN MoMo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, subData] = await Promise.all([
        subscriptionService.getPlans(),
        subscriptionService.getDriverSubscriptionSummary(driverId),
      ]);
      setPlans(plansData);
      setSummary(subData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [driverId]);

  const handleSimulatePayment = async () => {
    if (!payingPlan) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await subscriptionService.simulatePayment(
        driverId,
        payingPlan.id,
        paymentPhone,
        paymentNetwork
      );
      if (!res) throw new Error('Payment processing failed.');

      setPaymentSuccess(`Successfully upgraded to ${res.plan_name}! Quotas and active period have been updated.`);
      setPayingPlan(null);
      await loadData();
      if (onPlanChanged) onPlanChanged();
    } catch (err: any) {
      setError(err?.message || 'Payment simulation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateTopup = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await subscriptionService.simulateLeadTopup(
        driverId,
        10,
        10000,
        paymentNetwork
      );
      if (!res) throw new Error('Top-up failed.');

      setPaymentSuccess('Successfully added +10 Radar Leads to your account balance!');
      setShowTopupModal(false);
      await loadData();
      if (onPlanChanged) onPlanChanged();
    } catch (err: any) {
      setError(err?.message || 'Top-up simulation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatUgx = (amount: number) => {
    return new Intl.NumberFormat('en-UG').format(amount) + ' UGX';
  };

  if (loading) {
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
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
                Active Period: {new Date(summary.starts_at).toLocaleDateString()} &mdash; {new Date(summary.ends_at).toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                onClick={() => setShowTopupModal(true)}
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
                  {summary.trips_posted} / {summary.max_trips}
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
                    width: `${Math.min(100, (summary.trips_posted / summary.max_trips) * 100)}%`,
                    backgroundColor: summary.trips_remaining > 0 ? '#3b82f6' : '#ef4444',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: summary.trips_remaining > 0 ? 'var(--uber-gray-400)' : '#ef4444' }}>
                {summary.trips_remaining > 0 ? `${summary.trips_remaining} trips remaining in this billing cycle` : 'Trip publication limit reached. Upgrade for more.'}
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

      {paymentSuccess && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Check size={18} />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Available Subscription Tiers */}
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
                    <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{p.price_ugx === 0 ? 'Free' : formatUgx(p.price_ugx)}</span>
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
                  onClick={() => setPayingPlan(p)}
                >
                  {isCurrent ? 'Renew Current Plan' : `Upgrade for ${p.price_ugx === 0 ? 'Free' : formatUgx(p.price_ugx)}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulated Mobile Money Checkout Modal */}
      {payingPlan && (
        <div className="modal-backdrop" onClick={() => setPayingPlan(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
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
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Mobile Money Checkout</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--uber-gray-400)' }}>
                  Aggregator Webhook & USSD Prompt Simulation
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--uber-gray-400)' }}>Plan Selection:</span>
                <span style={{ fontWeight: 600 }}>{payingPlan.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--uber-gray-400)' }}>Duration:</span>
                <span>{payingPlan.period_days} Days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span>Total Due:</span>
                <span style={{ color: '#22c55e' }}>{formatUgx(payingPlan.price_ugx)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                Payment Provider
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {['MTN MoMo', 'Airtel Money'].map((net) => (
                  <button
                    key={net}
                    type="button"
                    className="btn"
                    style={{
                      backgroundColor: paymentNetwork === net ? 'var(--uber-white)' : 'var(--uber-gray-800)',
                      color: paymentNetwork === net ? 'var(--uber-black)' : 'var(--uber-white)',
                      border: '1px solid var(--uber-gray-700)',
                      fontSize: '0.85rem',
                    }}
                    onClick={() => setPaymentNetwork(net)}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                Registered MoMo Phone Number
              </label>
              <input
                type="tel"
                className="input-field"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                placeholder="+256 700 000000"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--uber-gray-400)', marginTop: '0.25rem', display: 'block' }}>
                * A simulated USSD PIN prompt will trigger instant webhook confirmation and quota activation.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setPayingPlan(null)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1.5 }}
                onClick={handleSimulatePayment}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing USSD...' : `Pay ${formatUgx(payingPlan.price_ugx)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Top-Up Modal */}
      {showTopupModal && (
        <div className="modal-backdrop" onClick={() => setShowTopupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>Radar Leads Top-Up Pack</h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--uber-gray-400)', fontSize: '0.85rem' }}>
              Add 10 extra passenger lead credits to your current billing cycle to unlock more travel requests.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span>Pack:</span>
                <strong>+10 Lead Credits</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700 }}>
                <span>Price:</span>
                <span style={{ color: '#22c55e' }}>10,000 UGX</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setShowTopupModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1.5 }}
                onClick={handleSimulateTopup}
                disabled={isProcessing}
              >
                {isProcessing ? 'Confirming...' : 'Buy +10 Leads (10,000 UGX)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
