import React, { useState, useEffect } from 'react';
import { Radio, MapPin, Calendar, Users, Phone, MessageSquare, Unlock, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { radarService } from '../../services/supabase/SupabaseRadarService';
import { subscriptionService } from '../../services/supabase/SupabaseSubscriptionService';
import type { RadarLead, DriverSubscriptionSummary } from '../../types/domain';

interface DriverRadarDashboardProps {
  driverId: string;
  onPostTripForRoute?: (originTownName: string, destTownName: string, date: string) => void;
  onOpenSubscriptions?: () => void;
}

export const DriverRadarDashboard: React.FC<DriverRadarDashboardProps> = ({
  driverId,
  onPostTripForRoute,
  onOpenSubscriptions,
}) => {
  const [leads, setLeads] = useState<RadarLead[]>([]);
  const [summary, setSummary] = useState<DriverSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadsData, subData] = await Promise.all([
        radarService.getDriverRadarLeads(driverId),
        subscriptionService.getDriverSubscriptionSummary(driverId),
      ]);
      setLeads(leadsData);
      setSummary(subData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load radar signals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [driverId]);

  const handleUnlock = async (alertId: string) => {
    if (!summary || summary.leads_remaining <= 0) {
      if (onOpenSubscriptions) {
        onOpenSubscriptions();
      } else {
        setError('No remaining lead credits. Please upgrade your plan or top up leads.');
      }
      return;
    }

    setUnlockingId(alertId);
    setError(null);
    try {
      const res = await radarService.revealLead(driverId, alertId);
      if (!res) throw new Error('Could not unlock passenger contact.');

      // Refresh state
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock lead.');
    } finally {
      setUnlockingId(null);
    }
  };

  const cleanPhone = (phone: string) => phone.replace(/[^\d+]/g, '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Radio size={24} className="pulse-animation" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Passenger Demand Radar</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--uber-gray-400)' }}>
              Real-time travel searches and passenger trip alerts awaiting scheduled rides
            </p>
          </div>
        </div>

        {summary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--uber-gray-400)' }}>Lead Credits Balance</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: summary.leads_remaining > 0 ? '#22c55e' : '#ef4444' }}>
                {summary.leads_remaining} of {summary.max_leads} left
              </div>
            </div>
            {onOpenSubscriptions && (
              <button className="btn btn-outline" style={{ fontSize: '0.85rem' }} onClick={onOpenSubscriptions}>
                Top Up
              </button>
            )}
            <button
              onClick={loadData}
              className="btn btn-outline"
              style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Refresh Radar"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Radar Leads Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--uber-gray-400)' }}>
          Scanning highway corridor radar signals...
        </div>
      ) : leads.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <Radio size={48} color="var(--uber-gray-500)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem' }}>No Active Demand Signals Right Now</h3>
          <p style={{ margin: 0, color: 'var(--uber-gray-400)', fontSize: '0.9rem' }}>
            When passengers search for intercity routes or tap "Alert Me", their demand signals appear here. Check back soon or publish scheduled trips to capture advance bookings.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {leads.map((lead) => {
            const isUnlocked = lead.is_unlocked;
            const hasPhone = Boolean(lead.passenger_phone && !lead.passenger_phone.includes('•••'));

            return (
              <div
                key={lead.alert_id}
                className="card"
                style={{
                  border: isUnlocked ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--uber-gray-700)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        backgroundColor: isUnlocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: isUnlocked ? '#22c55e' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      {isUnlocked ? <Sparkles size={12} /> : <Radio size={12} />}
                      {isUnlocked ? 'Unlocked Lead' : 'Live Radar Demand'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--uber-gray-400)' }}>
                      {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={16} color="var(--uber-white)" />
                    {lead.origin_town_name} &rarr; {lead.destination_town_name}
                  </h3>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--uber-gray-300)', marginBottom: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={14} color="var(--uber-gray-400)" /> {lead.travel_date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={14} color="var(--uber-gray-400)" /> {lead.seats_needed} {lead.seats_needed === 1 ? 'Passenger' : 'Passengers'}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '0.6rem 0.8rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ color: 'var(--uber-gray-400)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                      Passenger Contact:
                    </div>
                    <div style={{ fontWeight: 600, color: isUnlocked ? 'var(--uber-white)' : 'var(--uber-gray-400)' }}>
                      {lead.passenger_name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: isUnlocked ? '#22c55e' : 'var(--uber-gray-500)', letterSpacing: isUnlocked ? 'normal' : '1px' }}>
                      {lead.passenger_phone || '+256 ••• ••• •••'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {isUnlocked && hasPhone ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <a
                        href={`tel:${cleanPhone(lead.passenger_phone)}`}
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', textDecoration: 'none' }}
                      >
                        <Phone size={14} /> Call
                      </a>
                      <a
                        href={`https://wa.me/${cleanPhone(lead.passenger_phone).replace('+', '')}?text=${encodeURIComponent(
                          `Hello, I saw your Wala Ride travel request for ${lead.origin_town_name} to ${lead.destination_town_name} on ${lead.travel_date}. I have scheduled seats available!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                          color: '#22c55e',
                          borderColor: 'rgba(34, 197, 94, 0.3)',
                        }}
                      >
                        <MessageSquare size={14} /> WhatsApp
                      </a>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={() => handleUnlock(lead.alert_id)}
                      disabled={unlockingId === lead.alert_id}
                    >
                      <Unlock size={16} />
                      {unlockingId === lead.alert_id ? 'Unlocking...' : 'Unlock Passenger (1 Credit)'}
                    </button>
                  )}

                  {onPostTripForRoute && (
                    <button
                      className="btn btn-outline"
                      style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                      onClick={() => onPostTripForRoute(lead.origin_town_name, lead.destination_town_name, lead.travel_date)}
                    >
                      Publish Scheduled Trip for this Route
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
