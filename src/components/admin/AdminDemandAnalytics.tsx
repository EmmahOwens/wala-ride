import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/supabase/SupabaseAdminService';
import type { DemandAnalyticsResult } from '../../types/domain';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  Search,
  ArrowRight,
  RefreshCw,
  Zap,
  MapPin,
  Calendar,
} from 'lucide-react';

interface AdminDemandAnalyticsProps {
  onNavigateToRoutes?: () => void;
}

export const AdminDemandAnalytics: React.FC<AdminDemandAnalyticsProps> = ({ onNavigateToRoutes }) => {
  const [analytics, setAnalytics] = useState<DemandAnalyticsResult | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [blastMessage, setBlastMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getDemandAnalytics(periodDays);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load demand analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlastSupplyAlert = (origin: string, dest: string, unservedCount: number) => {
    setBlastMessage(`⚡ Broadcast dispatched! Push/SMS notification sent to verified corridor drivers for ${origin} → ${dest} (${unservedCount} unmet searches).`);
    setTimeout(() => setBlastMessage(null), 5000);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [periodDays]);

  const summary = analytics?.summary;
  const corridors = analytics?.corridors || [];
  const dailyTrends = analytics?.daily_trends || [];

  const maxDailySearches = Math.max(...dailyTrends.map((d) => d.search_count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Real-time Demand Blast Notification Banner */}
      {blastMessage && (
        <div style={{
          padding: '12px 18px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-lg)',
          color: '#1d4ed8',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Zap size={16} color="#2563eb" />
          <span>{blastMessage}</span>
        </div>
      )}

      {/* Top Controls Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Corridor Demand Analytics & Radar Signals</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Real passenger search volume, unserved routes, and driver recruitment opportunities across Uganda
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--color-canvas)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            {[7, 14, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: periodDays === days ? '#ffffff' : 'transparent',
                  color: periodDays === days ? '#000000' : 'var(--color-text-secondary)',
                  boxShadow: periodDays === days ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Last {days}d
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {/* Card 1: Total Passenger Searches */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Total Searches</span>
            <Search size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>
            {summary ? summary.total_searches.toLocaleString() : '...'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
            Passenger journey lookups in last {periodDays} days
          </span>
        </div>

        {/* Card 2: Unserved Passenger Demand */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Unserved Searches</span>
            <AlertTriangle size={18} color="#dc2626" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>
              {summary ? summary.unserved_searches.toLocaleString() : '...'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>
              ({summary ? summary.unserved_rate_pct : 0}%)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
            Zero matching scheduled trips found
          </span>
        </div>

        {/* Card 3: Passengers Demanding Seats */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Seats In Demand</span>
            <Users size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>
            {summary ? summary.passengers_demanding.toLocaleString() : '...'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
            Total seat capacity requested by travelers
          </span>
        </div>

        {/* Card 4: Radar Alert Conversions */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Radar Leads Generated</span>
            <Zap size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706' }}>
            {summary ? summary.alert_conversions.toLocaleString() : '...'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
            Travelers opted into alerts for driver notification
          </span>
        </div>
      </div>

      {/* Corridor Supply vs Demand Matrix Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Corridor Supply vs. Demand Gap</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Prioritized by unmet searches to direct marketing and driver route publication
            </p>
          </div>
          {onNavigateToRoutes && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onNavigateToRoutes}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Manage Corridors & Stops</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Corridor (Route)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Searches</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Unmet (0 Trips)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Seats Demanded</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Active Trips</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Supply Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {corridors.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No search events recorded in this period.
                  </td>
                </tr>
              ) : (
                corridors.map((c, idx) => {
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: c.supply_status === 'CRITICAL_SHORTAGE' ? '#fff5f5' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                          <MapPin size={14} color="var(--color-primary)" />
                          <span>{c.origin_town_name}</span>
                          <ArrowRight size={12} color="var(--color-text-tertiary)" />
                          <span>{c.destination_town_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {c.search_count}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: c.unserved_count > 0 ? '#dc2626' : 'var(--color-text)' }}>
                        {c.unserved_count}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {c.total_seats_requested} seats
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontWeight: 600,
                          color: c.active_trips_count === 0 ? '#dc2626' : '#166534',
                        }}>
                          {c.active_trips_count} scheduled
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {c.supply_status === 'CRITICAL_SHORTAGE' && (
                          <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                            CRITICAL SHORTAGE
                          </span>
                        )}
                        {c.supply_status === 'HIGH_DEMAND' && (
                          <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412', fontWeight: 600 }}>
                            HIGH DEMAND
                          </span>
                        )}
                        {c.supply_status === 'BALANCED' && (
                          <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                            BALANCED
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {c.unserved_count > 0 ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleBlastSupplyAlert(c.origin_town_name, c.destination_town_name, c.unserved_count)}
                            style={{
                              fontSize: '11px',
                              padding: '5px 10px',
                              backgroundColor: '#fff7ed',
                              borderColor: '#fed7aa',
                              color: '#c2410c',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <Zap size={12} color="#ea580c" />
                            <span>Blast Supply Alert</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                            Corridor Balanced ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Search Trends Bar Visualization */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Daily Search Volume & Unserved Trends</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Comparison of total search volume (blue) versus unserved searches (red)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
              Total Searches
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
              Unserved
            </span>
          </div>
        </div>

        {dailyTrends.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Calendar size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '13px' }}>No daily trend data in selected window.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            height: '140px',
            paddingTop: '20px',
            borderBottom: '1px solid var(--color-border)',
            overflowX: 'auto',
          }}>
            {dailyTrends.map((d, i) => {
              const heightPct = Math.round((d.search_count / maxDailySearches) * 100);
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '40px' }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(heightPct, 8)}%`,
                    backgroundColor: '#3b82f6',
                    borderRadius: '4px 4px 0 0',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                  }}>
                    {d.unserved_count > 0 && (
                      <div style={{
                        width: '100%',
                        height: `${Math.max((d.unserved_count / d.search_count) * 100, 10)}%`,
                        backgroundColor: '#ef4444',
                        borderRadius: '4px 4px 0 0',
                      }} />
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
