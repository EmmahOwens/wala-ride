import React, { useState } from 'react';
import type { BookingDispute, DisputeStatus } from '../../types/domain';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Award,
  Zap,
} from 'lucide-react';

interface DriverReliabilityMetric {
  driverId: string;
  driverName: string;
  phone: string;
  totalTrips: number;
  completedTrips: number;
  cancellationsWithin2h: number;
  reliabilityScorePct: number;
  fraudRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  strikes: number;
}

export const AdminDisputeCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'disputes' | 'reliability'>('disputes');
  const [filterStatus, setFilterStatus] = useState<DisputeStatus | 'all'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Active Disputes
  const [disputes, setDisputes] = useState<BookingDispute[]>([
    {
      id: 'dsp_01',
      booking_id: 'bk_981',
      booking_reference: 'WALA-7821',
      reported_by_user_id: 'usr_p1',
      reporter_name: 'Sarah Akello',
      reporter_role: 'passenger',
      driver_id: 'drv_01',
      driver_name: 'Robert Katende',
      reason: 'Driver attempted to demand extra UGX 10,000 for standard luggage',
      description: 'The driver insisted that my single travel suitcase required an extra 10,000 UGX fee, despite the platform booking stating 1 medium suitcase is included in the seat hold.',
      status: 'open',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'dsp_02',
      booking_id: 'bk_942',
      booking_reference: 'WALA-4392',
      reported_by_user_id: 'usr_p2',
      reporter_name: 'Brian Tumusiime',
      reporter_role: 'passenger',
      driver_id: 'drv_04',
      driver_name: 'Denis Musoke',
      reason: 'Driver cancelled trip 25 minutes before scheduled departure',
      description: 'I was already waiting at Busega stage when driver called saying he will not travel today. Left stranded with luggage.',
      status: 'under_review',
      created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    },
    {
      id: 'dsp_03',
      booking_id: 'bk_889',
      booking_reference: 'WALA-1102',
      reported_by_user_id: 'usr_d1',
      reporter_name: 'Fred Mukasa',
      reporter_role: 'driver',
      driver_id: 'drv_03',
      driver_name: 'Fred Mukasa',
      reason: 'Passenger no-show at Mukono stage without communication',
      description: 'Held seat for 20 minutes past departure time. Passenger did not pick phone or arrive.',
      status: 'resolved',
      created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      resolution_notes: 'Verified passenger did not show up. Passenger account flagged with warning strike.',
    },
  ]);

  // Driver Reliability Index & Off-Platform Leakage Monitoring
  const [driverMetrics] = useState<DriverReliabilityMetric[]>([
    {
      driverId: 'drv_01',
      driverName: 'Robert Katende',
      phone: '+256 701 445 221',
      totalTrips: 48,
      completedTrips: 47,
      cancellationsWithin2h: 0,
      reliabilityScorePct: 98,
      fraudRiskLevel: 'LOW',
      strikes: 0,
    },
    {
      driverId: 'drv_04',
      driverName: 'Denis Musoke',
      phone: '+256 752 901 334',
      totalTrips: 18,
      completedTrips: 14,
      cancellationsWithin2h: 3,
      reliabilityScorePct: 76,
      fraudRiskLevel: 'HIGH',
      strikes: 2,
    },
    {
      driverId: 'drv_03',
      driverName: 'Fred Mukasa',
      phone: '+256 772 119 883',
      totalTrips: 62,
      completedTrips: 61,
      cancellationsWithin2h: 1,
      reliabilityScorePct: 96,
      fraudRiskLevel: 'LOW',
      strikes: 0,
    },
  ]);

  const handleResolveDispute = (id: string, actionType: 'strike_driver' | 'dismiss' | 'compensate') => {
    setDisputes((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          return {
            ...d,
            status: 'resolved',
            resolution_notes:
              actionType === 'strike_driver'
                ? 'Strike issued to driver for policy breach. Warning recorded on driver profile.'
                : actionType === 'compensate'
                ? 'Passenger compensated with priority booking voucher.'
                : 'Dispute investigated and dismissed due to insufficient evidence.',
          };
        }
        return d;
      })
    );

    setActionNotice('Dispute case successfully mediated and marked as resolved.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const filteredDisputes = disputes.filter((d) => {
    if (filterStatus === 'all') return true;
    return d.status === filterStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-hairline)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Scale size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Dispute Mediation & Driver Reliability Scorecard
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Audit fare violations, passenger no-shows, cancellation strikes, and off-platform disintermediation risks.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn-pill-tab ${activeTab === 'disputes' ? 'active' : ''}`}
            onClick={() => setActiveTab('disputes')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <AlertTriangle size={14} color="#ea580c" />
            <span>Disputes Queue ({disputes.filter((d) => d.status !== 'resolved').length})</span>
          </button>

          <button
            className={`btn-pill-tab ${activeTab === 'reliability' ? 'active' : ''}`}
            onClick={() => setActiveTab('reliability')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Award size={14} color="#16a34a" />
            <span>Driver Reliability Index</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div style={{
          padding: '12px 18px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#166534',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          {actionNotice}
        </div>
      )}

      {/* DISPUTES TAB */}
      {activeTab === 'disputes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-body)' }}>Status Filter:</span>
            {(['all', 'open', 'under_review', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-hairline)',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: filterStatus === st ? '#000000' : '#ffffff',
                  color: filterStatus === st ? '#ffffff' : 'var(--color-body)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredDisputes.map((d) => (
              <div
                key={d.id}
                className="card"
                style={{
                  padding: '20px',
                  borderLeft: `4px solid ${
                    d.status === 'open' ? '#dc2626' : d.status === 'under_review' ? '#ea580c' : '#16a34a'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px' }}>{d.reason}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        Ref: {d.booking_reference}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: d.status === 'open' ? '#fef2f2' : d.status === 'under_review' ? '#fff7ed' : '#f0fdf4',
                        color: d.status === 'open' ? '#dc2626' : d.status === 'under_review' ? '#c2410c' : '#166534',
                        textTransform: 'uppercase',
                      }}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="body-sm" style={{ marginTop: '4px' }}>
                      Reported by <strong>{d.reporter_name}</strong> ({d.reporter_role}) against driver <strong>{d.driver_name}</strong> &bull; {new Date(d.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--color-canvas-soft)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  marginBottom: '14px',
                  border: '1px solid var(--color-hairline)',
                }}>
                  {d.description}
                </div>

                {d.resolution_notes && (
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    color: '#166534',
                    marginBottom: '14px',
                  }}>
                    ✓ <strong>Resolution:</strong> {d.resolution_notes}
                  </div>
                )}

                {d.status !== 'resolved' && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleResolveDispute(d.id, 'strike_driver')}
                      style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: '12px' }}
                    >
                      <ShieldAlert size={13} /> Issue Driver Strike (-5% Reliability)
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleResolveDispute(d.id, 'compensate')}
                      style={{ color: '#2563eb', fontSize: '12px' }}
                    >
                      <CheckCircle2 size={13} /> Resolve & Compensate
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleResolveDispute(d.id, 'dismiss')}
                      style={{ fontSize: '12px' }}
                    >
                      Dismiss Dispute
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RELIABILITY INDEX & FRAUD SHIELD TAB */}
      {activeTab === 'reliability' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '14px 18px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <Zap size={20} color="#2563eb" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e40af' }}>
                Algorithmic Driver Reliability & Disintermediation Shield
              </div>
              <div className="body-sm" style={{ color: '#3b82f6' }}>
                Drivers who repeatedly cancel within 2 hours or divert passengers offline are flagged for commission evasion review.
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--color-hairline)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Driver Profile</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total Completed</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Late Cancellations (&lt;2h)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reliability Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fraud / Disintermediation Risk</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {driverMetrics.map((dm) => (
                  <tr key={dm.driverId} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700 }}>{dm.driverName}</div>
                      <div className="body-sm" style={{ fontSize: '11px' }}>{dm.phone}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {dm.completedTrips} / {dm.totalTrips} Trips
                    </td>
                    <td style={{ padding: '14px 16px', color: dm.cancellationsWithin2h > 0 ? '#dc2626' : '#111827', fontWeight: dm.cancellationsWithin2h > 0 ? 700 : 400 }}>
                      {dm.cancellationsWithin2h} Times
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: dm.reliabilityScorePct >= 90 ? '#16a34a' : '#ea580c' }}>
                          {dm.reliabilityScorePct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: dm.fraudRiskLevel === 'HIGH' ? '#fef2f2' : '#f0fdf4',
                        color: dm.fraudRiskLevel === 'HIGH' ? '#dc2626' : '#166534',
                      }}>
                        {dm.fraudRiskLevel} RISK {dm.strikes > 0 ? `(${dm.strikes} Strikes)` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {dm.fraudRiskLevel === 'HIGH' ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: '11px' }}
                          onClick={() => alert(`Driver ${dm.driverName} suspended from publishing trips pending KYC compliance review.`)}
                        >
                          Suspend Account
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Good Standing ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
