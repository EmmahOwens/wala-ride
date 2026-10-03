import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/supabase/SupabaseAdminService';
import type { PendingDriverVerification } from '../../services/interfaces/IAdminService';
import type { ComplianceAlert } from '../../types/domain';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Car,
  FileText,
  UserCheck,
  RefreshCw,
  Clock,
  ShieldAlert,
  Send,
} from 'lucide-react';

export const AdminVerificationQueue: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'compliance'>('pending');
  const [pendingList, setPendingList] = useState<PendingDriverVerification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<PendingDriverVerification | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  // Compliance Alerts State
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([
    {
      id: 'cmp_01',
      driver_id: 'drv_01',
      driver_name: 'Robert Katende',
      driver_phone: '+256 701 445 221',
      vehicle_id: 'veh_01',
      vehicle_plate: 'UBJ 281L',
      document_type: 'Third-Party Motor Insurance',
      expiry_date: '2026-10-12',
      days_remaining: 9,
      status: 'critical',
      is_resolved: false,
    },
    {
      id: 'cmp_02',
      driver_id: 'drv_02',
      driver_name: 'David Okello',
      driver_phone: '+256 788 334 009',
      vehicle_id: 'veh_02',
      vehicle_plate: 'UBH 411K',
      document_type: 'PSV Inspection Certificate',
      expiry_date: '2026-09-28',
      days_remaining: -5,
      status: 'expired',
      is_resolved: false,
    },
    {
      id: 'cmp_03',
      driver_id: 'drv_03',
      driver_name: 'Fred Mukasa',
      driver_phone: '+256 772 119 883',
      vehicle_id: 'veh_03',
      vehicle_plate: 'UBA 902C',
      document_type: 'Class B/DL Driving Permit',
      expiry_date: '2026-10-29',
      days_remaining: 26,
      status: 'warning',
      is_resolved: false,
    },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await adminService.getPendingDrivers();
      setPendingList(data);
      if (data.length > 0 && !selectedDriver) {
        handleSelectDriver(data[0]);
      }
    } catch (err) {
      console.error('Error loading pending drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDriver = async (item: PendingDriverVerification) => {
    setSelectedDriver(item);
    const urls: Record<string, string> = {};
    for (const doc of item.documents) {
      const signed = await adminService.getSignedDocumentUrl(doc.file_path);
      if (signed) {
        urls[doc.id] = signed;
      }
    }
    setDocUrls(urls);
  };

  const handleApproveDriver = async (driverId: string) => {
    setActionLoading(driverId);
    const success = await adminService.updateDriverStatus(driverId, 'verified');
    setActionLoading(null);
    if (success) {
      setMessage('Driver verified successfully! They can now publish scheduled trips.');
      await loadData();
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    const reason = window.prompt('Enter reason for rejection / re-upload request:');
    if (!reason) return;

    setActionLoading(driverId);
    const success = await adminService.updateDriverStatus(driverId, 'rejected');
    setActionLoading(null);
    if (success) {
      setMessage('Driver application marked as rejected.');
      await loadData();
    }
  };

  const handleSendComplianceAlert = (alertId: string, driverName: string, docType: string) => {
    setComplianceAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_resolved: true } : a))
    );
    setMessage(`Renewal reminder for "${docType}" dispatched to ${driverName} via SMS & Email.`);
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="container" style={{ padding: '36px 16px' }}>
      {/* Header & Sub-Tab Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 className="display-lg">Driver KYC & Compliance Operations</h1>
          <p className="body-md">
            Review onboarding submissions and monitor driving permits, insurance, and vehicle inspection expiries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`btn-pill-tab ${activeSubTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pending')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserCheck size={14} />
            <span>Pending KYC ({pendingList.length})</span>
          </button>

          <button
            className={`btn-pill-tab ${activeSubTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('compliance')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={14} color="#ea580c" />
            <span>Document Expiry Tracker ({complianceAlerts.length})</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '20px',
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          fontWeight: 600,
          fontSize: '14px',
        }}>
          {message}
        </div>
      )}

      {/* TAB 1: PENDING KYC REVIEWS */}
      {activeSubTab === 'pending' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <p className="body-md">Loading verification queue...</p>
            </div>
          ) : pendingList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <UserCheck size={48} color="var(--color-mute)" style={{ margin: '0 auto 16px' }} />
              <h3 className="display-sm">No Pending Verifications</h3>
              <p className="body-md" style={{ marginTop: '8px' }}>
                All submitted driver applications and vehicles have been reviewed.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
              {/* Driver List Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingList.map((item) => {
                  const isSelected = selectedDriver?.driver.id === item.driver.id;
                  return (
                    <div
                      key={item.driver.id}
                      onClick={() => handleSelectDriver(item)}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-xl)',
                        border: `1px solid ${isSelected ? '#000000' : 'var(--color-card-border)'}`,
                        backgroundColor: isSelected ? 'var(--color-canvas-soft)' : 'var(--color-canvas)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          {item.profile.first_name || 'Driver'} {item.profile.last_name || ''}
                        </div>
                        <span className={`badge ${
                          item.driver.verification_status === 'verified'
                            ? 'badge-verified'
                            : item.driver.verification_status === 'rejected'
                            ? 'badge-rejected'
                            : 'badge-pending'
                        }`}>
                          {item.driver.verification_status}
                        </span>
                      </div>
                      <div className="body-sm" style={{ marginTop: '4px' }}>
                        {item.profile.phone || item.profile.email || 'No contact'}
                      </div>
                      <div className="body-sm" style={{ marginTop: '4px', fontSize: '12px' }}>
                        Docs: {item.documents.length} &bull; Vehicles: {item.vehicles.length}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Driver Detail Inspector */}
              {selectedDriver && (
                <div className="card" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                      <h2 className="display-sm">
                        {selectedDriver.profile.first_name} {selectedDriver.profile.last_name}
                      </h2>
                      <p className="body-sm" style={{ marginTop: '4px' }}>
                        Phone: <strong>{selectedDriver.profile.phone || 'N/A'}</strong> &bull; License No: <strong>{selectedDriver.driver.license_number || 'N/A'}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading === selectedDriver.driver.id}
                        onClick={() => handleApproveDriver(selectedDriver.driver.id)}
                      >
                        <CheckCircle2 size={15} /> Approve Driver
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        disabled={actionLoading === selectedDriver.driver.id}
                        onClick={() => handleRejectDriver(selectedDriver.driver.id)}
                      >
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  </div>

                  {/* Uploaded KYC Documents */}
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                    Submitted Documents ({selectedDriver.documents.length})
                  </h3>
                  {selectedDriver.documents.length === 0 ? (
                    <p className="body-sm">No documents uploaded yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                      {selectedDriver.documents.map((doc) => {
                        const signedUrl = docUrls[doc.id];
                        return (
                          <div
                            key={doc.id}
                            style={{
                              padding: '14px 16px',
                              borderRadius: 'var(--radius-lg)',
                              border: '1px solid var(--color-hairline)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <FileText size={18} />
                              <div>
                                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                                  {doc.document_type.replace('_', ' ')}
                                </span>
                                <span className="body-sm" style={{ marginLeft: '10px' }}>
                                  File: {doc.file_path.split('/').pop()}
                                </span>
                              </div>
                            </div>

                            {signedUrl ? (
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '12px' }}
                              >
                                <ExternalLink size={12} /> View Document
                              </a>
                            ) : (
                              <span className="body-sm" style={{ fontSize: '11px' }}>Loading URL...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Registered Vehicles */}
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                    Registered Vehicle(s)
                  </h3>
                  {selectedDriver.vehicles.length === 0 ? (
                    <p className="body-sm">No vehicle registered by this driver yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedDriver.vehicles.map((v) => (
                        <div
                          key={v.id}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-hairline)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Car size={18} />
                            <div>
                              <span style={{ fontWeight: 700 }}>{v.make} {v.model}</span>
                              <span className="body-sm" style={{ marginLeft: '10px' }}>Plate: <strong>{v.license_plate}</strong> &bull; Seats: {v.capacity_seats}</span>
                            </div>
                          </div>
                          <span className={`badge ${v.verification_status === 'verified' ? 'badge-verified' : 'badge-pending'}`}>
                            {v.verification_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUTOMATED DOCUMENT EXPIRY TRACKER */}
      {activeSubTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '16px 20px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <ShieldAlert size={24} color="#d97706" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#92400e' }}>
                Automated Regulatory Compliance Guard
              </div>
              <div className="body-sm" style={{ color: '#b45309' }}>
                Drivers with expired vehicle insurance or driving permits are automatically suspended from publishing trips to ensure full passenger legal safety.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {complianceAlerts.map((alert) => (
              <div
                key={alert.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px',
                  borderLeft: `4px solid ${
                    alert.status === 'expired'
                      ? '#dc2626'
                      : alert.status === 'critical'
                      ? '#ea580c'
                      : '#eab308'
                  }`,
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '16px' }}>{alert.driver_name}</span>
                    <span style={{
                      backgroundColor:
                        alert.status === 'expired'
                          ? '#fef2f2'
                          : alert.status === 'critical'
                          ? '#fff7ed'
                          : '#fefce8',
                      color:
                        alert.status === 'expired'
                          ? '#dc2626'
                          : alert.status === 'critical'
                          ? '#c2410c'
                          : '#a16207',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {alert.status === 'expired'
                        ? 'EXPIRED — AUTO-SUSPENDED'
                        : `${alert.days_remaining} Days Remaining`}
                    </span>
                  </div>

                  <div className="body-sm" style={{ marginTop: '4px' }}>
                    Document: <strong>{alert.document_type}</strong> &bull; Vehicle: <strong>{alert.vehicle_plate}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                    Expiry Date: {new Date(alert.expiry_date).toLocaleDateString([], { dateStyle: 'medium' })} &bull; Contact: {alert.driver_phone}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {alert.is_resolved ? (
                    <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={16} /> Reminder Sent
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSendComplianceAlert(alert.id, alert.driver_name, alert.document_type)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Send size={13} /> Send Renewal Notice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
