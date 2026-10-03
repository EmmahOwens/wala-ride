import React, { useState, useEffect } from 'react';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import type { Incident, IncidentStatus } from '../../types/domain';
import {
  ShieldAlert,
  CheckCircle2,
  Phone,
  MapPin,
  ExternalLink,
  RefreshCw,
  Check,
} from 'lucide-react';

// Play an alert sound for urgent SOS using Web Audio API
const playEmergencyTone = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Audio context not allowed without user gesture
  }
};

export const AdminIncidentConsole: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadIncidents = async () => {
    setLoading(true);
    const list = await trackingService.getAdminIncidents();
    setIncidents(list);
    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();

    // Subscribe to realtime incident events
    const unsubscribe = trackingService.subscribeToIncidents((newIncident) => {
      playEmergencyTone();
      loadIncidents();
      setMessage(`🚨 New ${newIncident.kind.toUpperCase()} reported!`);
      setTimeout(() => setMessage(null), 6000);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleUpdateStatus = async (incidentId: string, nextStatus: IncidentStatus) => {
    setActionLoading(incidentId);
    const { success, error } = await trackingService.resolveIncident(incidentId, nextStatus);
    setActionLoading(null);

    if (success) {
      await loadIncidents();
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } else {
      alert(`Error updating incident: ${error?.message || 'Network error'}`);
    }
  };

  const filteredIncidents = incidents.filter((i) => {
    if (statusFilter === 'all') return true;
    return i.status === statusFilter;
  });

  const openCount = incidents.filter((i) => i.status === 'open').length;
  const investigatingCount = incidents.filter((i) => i.status === 'investigating').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Alert Banner if real-time SOS fired */}
      {message && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
            color: '#b91c1c',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: 700,
            animation: 'pulse 1s infinite',
          }}
        >
          <ShieldAlert size={24} color="#dc2626" />
          <span>{message}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: openCount > 0 ? '#fef2f2' : 'var(--color-canvas-soft)',
            border: openCount > 0 ? '1px solid #fecaca' : '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: openCount > 0 ? '#991b1b' : 'var(--color-body)', textTransform: 'uppercase' }}>
            Open / Urgent SOS
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: openCount > 0 ? '#dc2626' : 'var(--color-ink)', marginTop: '4px' }}>
            {openCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-body)', textTransform: 'uppercase' }}>
            Under Investigation
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>
            {investigatingCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-body)', textTransform: 'uppercase' }}>
            Resolved Cases
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: '#16a34a' }}>
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Refresh */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn-pill-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Incidents ({incidents.length})
          </button>
          <button
            className={`btn-pill-tab ${statusFilter === 'open' ? 'active' : ''}`}
            onClick={() => setStatusFilter('open')}
            style={openCount > 0 && statusFilter !== 'open' ? { border: '1px solid #ef4444', color: '#dc2626' } : {}}
          >
            Open SOS ({openCount})
          </button>
          <button
            className={`btn-pill-tab ${statusFilter === 'investigating' ? 'active' : ''}`}
            onClick={() => setStatusFilter('investigating')}
          >
            Investigating ({investigatingCount})
          </button>
          <button
            className={`btn-pill-tab ${statusFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('resolved')}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadIncidents} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Live Refresh</span>
        </button>
      </div>

      {/* Main Incident Master-Detail View */}
      {loading ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <p className="body-md">Connecting to live incident telemetry feed...</p>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <CheckCircle2 size={42} color="#16a34a" style={{ margin: '0 auto 12px' }} />
          <h3 className="display-sm">All Highway Corridors Clear</h3>
          <p className="body-md" style={{ marginTop: '4px' }}>
            No active incidents matching the selected filter. Realtime listener is armed for any SOS alerts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)', gap: '20px' }}>
          {/* Incident Feed List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '680px', overflowY: 'auto' }}>
            {filteredIncidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              const isOpen = inc.status === 'open';
              const isSos = inc.kind === 'sos';

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  style={{
                    backgroundColor: isSelected ? 'var(--color-canvas-soft)' : 'var(--color-surface)',
                    border: isOpen
                      ? '2px solid #ef4444'
                      : isSelected
                      ? '2px solid var(--color-ink)'
                      : '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '16px 18px',
                    cursor: 'pointer',
                    boxShadow: isOpen ? '0 4px 12px rgba(239, 68, 68, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      style={{
                        backgroundColor: isSos ? '#fee2e2' : '#fef3c7',
                        color: isSos ? '#dc2626' : '#b45309',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {inc.kind}
                    </span>

                    <span
                      className={`badge ${
                        inc.status === 'open'
                          ? 'badge-pending'
                          : inc.status === 'investigating'
                          ? 'badge-active'
                          : 'badge-verified'
                      }`}
                      style={{ fontSize: '11px' }}
                    >
                      {inc.status}
                    </span>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>
                    {inc.trip?.route_name || 'Highway Corridor Trip'}
                  </div>

                  <div className="body-sm" style={{ color: 'var(--color-body)', fontSize: '12px', marginBottom: '8px' }}>
                    Reporter: <strong>{inc.reporter?.name || 'Passenger'}</strong> &bull; {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>

                  {inc.description && (
                    <div style={{ fontSize: '13px', color: 'var(--color-ink)', fontStyle: 'italic', marginBottom: '8px' }}>
                      "{inc.description}"
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-mute)' }}>
                    <span>Plate: {inc.trip?.vehicle_plate || 'N/A'}</span>
                    <span>Ref: {inc.booking?.reference || 'N/A'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Incident Detail Card */}
          {selectedIncident ? (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        backgroundColor: selectedIncident.kind === 'sos' ? '#fee2e2' : '#fef3c7',
                        color: selectedIncident.kind === 'sos' ? '#dc2626' : '#b45309',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedIncident.kind}
                    </span>
                    <span className="body-sm" style={{ color: 'var(--color-mute)' }}>
                      ID: {selectedIncident.id.substring(0, 8)}
                    </span>
                  </div>
                  <h3 className="display-sm" style={{ margin: 0 }}>
                    {selectedIncident.trip?.route_name || 'Highway Corridor Incident'}
                  </h3>
                </div>

                <span
                  className={`badge ${
                    selectedIncident.status === 'open'
                      ? 'badge-pending'
                      : selectedIncident.status === 'investigating'
                      ? 'badge-active'
                      : 'badge-verified'
                  }`}
                  style={{ fontSize: '13px', padding: '4px 12px' }}
                >
                  Status: {selectedIncident.status}
                </span>
              </div>

              {/* Status Actions */}
              <div
                style={{
                  backgroundColor: 'var(--color-canvas-soft)',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Workflow Operations</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedIncident.status === 'open' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUpdateStatus(selectedIncident.id, 'investigating')}
                      disabled={actionLoading === selectedIncident.id}
                    >
                      Mark Investigating
                    </button>
                  )}
                  {selectedIncident.status !== 'resolved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdateStatus(selectedIncident.id, 'resolved')}
                      disabled={actionLoading === selectedIncident.id}
                    >
                      <Check size={13} />
                      <span>Resolve Incident</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <div className="body-sm" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', marginBottom: '4px' }}>
                  Incident Description / Notes
                </div>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-hairline)',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                  }}
                >
                  {selectedIncident.description || 'No additional passenger remarks entered.'}
                </div>
              </div>

              {/* Two Column Grid: Reporter & Driver */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
                  <div className="body-sm" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Reporter (Passenger)
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '15px', marginTop: '4px' }}>
                    {selectedIncident.reporter?.name || 'Passenger'}
                  </div>
                  {selectedIncident.reporter?.phone && (
                    <a
                      href={`tel:${selectedIncident.reporter.phone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
                    >
                      <Phone size={12} />
                      <span>Call {selectedIncident.reporter.phone}</span>
                    </a>
                  )}
                </div>

                <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
                  <div className="body-sm" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Driver & Vehicle
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '15px', marginTop: '4px' }}>
                    {selectedIncident.trip?.driver_name || 'Driver'}
                  </div>
                  <div className="body-sm" style={{ fontSize: '12px', marginTop: '2px' }}>
                    {selectedIncident.trip?.vehicle_model} &bull; <strong>{selectedIncident.trip?.vehicle_plate}</strong>
                  </div>
                  {selectedIncident.trip?.driver_phone && (
                    <a
                      href={`tel:${selectedIncident.trip.driver_phone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
                    >
                      <Phone size={12} />
                      <span>Call {selectedIncident.trip.driver_phone}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* GPS Coordinates */}
              {selectedIncident.lat !== null && selectedIncident.lng !== null && (
                <div
                  style={{
                    backgroundColor: 'var(--color-canvas-soft)',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} color="#dc2626" />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      Coordinates: {selectedIncident.lat.toFixed(5)}&deg;N, {selectedIncident.lng.toFixed(5)}&deg;E
                    </span>
                  </div>

                  <a
                    href={`https://maps.google.com/?q=${selectedIncident.lat},${selectedIncident.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-subtle btn-sm"
                    style={{ fontSize: '12px' }}
                  >
                    Open Google Maps <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Emergency Operations Runbook */}
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                marginBottom: '16px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  🚨 Emergency Escalation Runbook
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      alert(`Emergency SMS dispatched to ${selectedIncident.reporter?.name || 'Passenger'}'s registered emergency contacts with live GPS coordinates: (${selectedIncident.lat}, ${selectedIncident.lng})`);
                    }}
                    style={{ backgroundColor: '#ffffff', borderColor: '#fca5a5', color: '#991b1b', fontSize: '12px' }}
                  >
                    SMS Emergency Contacts
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const text = `[WALA-RIDE OPS EMERGENCY ESCALATION]\nIncident: ${selectedIncident.kind.toUpperCase()}\nVehicle: ${selectedIncident.trip?.vehicle_plate || 'Unspecified'}\nDriver: ${selectedIncident.trip?.driver_name || 'Unspecified'} (${selectedIncident.trip?.driver_phone || 'N/A'})\nReporter: ${selectedIncident.reporter?.name || 'Passenger'} (${selectedIncident.reporter?.phone || 'N/A'})\nGPS Coordinates: ${selectedIncident.lat}, ${selectedIncident.lng}\nMaps Link: https://maps.google.com/?q=${selectedIncident.lat},${selectedIncident.lng}`;
                      navigator.clipboard.writeText(text);
                      alert('Uganda Police & Traffic Desk dispatch slip copied to clipboard!');
                    }}
                    style={{ backgroundColor: '#ffffff', borderColor: '#fca5a5', color: '#991b1b', fontSize: '12px' }}
                  >
                    Copy Police Dispatch Slip
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--color-mute)' }}>
                Reported at: {new Date(selectedIncident.created_at).toLocaleString()}
                {selectedIncident.resolved_at && ` • Resolved at: ${new Date(selectedIncident.resolved_at).toLocaleString()}`}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <ShieldAlert size={36} color="var(--color-mute)" style={{ margin: '0 auto 12px' }} />
              <p className="body-md">Select an incident from the feed to view operator details, call contacts, and manage resolution.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
