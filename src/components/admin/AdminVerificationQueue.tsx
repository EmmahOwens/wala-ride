import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/supabase/SupabaseAdminService';
import type { PendingDriverVerification } from '../../services/interfaces/IAdminService';
import { CheckCircle2, XCircle, ExternalLink, Car, FileText, UserCheck, RefreshCw } from 'lucide-react';

export const AdminVerificationQueue: React.FC = () => {
  const [pendingList, setPendingList] = useState<PendingDriverVerification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<PendingDriverVerification | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

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
    // Pre-fetch signed URLs for private KYC documents
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

  return (
    <div className="container" style={{ padding: '40px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="display-lg">Driver Verification Queue</h1>
          <p className="body-md">
            Review submitted KYC documents (National IDs, driving permits, vehicle logbooks) to approve drivers.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
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
                      item.driver.verification_status === 'verified' ? 'badge-verified' : item.driver.verification_status === 'rejected' ? 'badge-rejected' : 'badge-pending'
                    }`}>
                      {item.driver.verification_status}
                    </span>
                  </div>
                  <div className="body-sm" style={{ marginTop: '4px' }}>
                    {item.profile.phone || item.profile.email || 'No contact'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-mute)', marginTop: '8px' }}>
                    {item.documents.length} docs &bull; {item.vehicles.length} vehicle(s)
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details & Review Panel */}
          {selectedDriver && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h2 className="display-md">
                    {selectedDriver.profile.first_name || 'Applicant'} {selectedDriver.profile.last_name || ''}
                  </h2>
                  <p className="body-md">
                    Phone: {selectedDriver.profile.phone || 'N/A'} &bull; Email: {selectedDriver.profile.email || 'N/A'}
                  </p>
                </div>

                {/* Verification Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading === selectedDriver.driver.id}
                    onClick={() => handleRejectDriver(selectedDriver.driver.id)}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading === selectedDriver.driver.id}
                    onClick={() => handleApproveDriver(selectedDriver.driver.id)}
                  >
                    <CheckCircle2 size={15} /> Approve & Verify
                  </button>
                </div>
              </div>

              {/* License Details */}
              <div style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
              }}>
                <div>
                  <div className="body-sm">License Number</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{selectedDriver.driver.license_number || 'Not provided'}</div>
                </div>
                <div>
                  <div className="body-sm">Class / Permit</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Class {selectedDriver.driver.license_class || 'B'}</div>
                </div>
                <div>
                  <div className="body-sm">National ID (NIN)</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{selectedDriver.driver.national_id || 'Not provided'}</div>
                </div>
              </div>

              {/* Uploaded Documents */}
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                Uploaded Verification Documents ({selectedDriver.documents.length})
              </h3>
              {selectedDriver.documents.length === 0 ? (
                <p className="body-sm" style={{ marginBottom: '24px' }}>No documents uploaded yet by this driver.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  {selectedDriver.documents.map((doc) => {
                    const signedUrl = docUrls[doc.id];
                    return (
                      <div
                        key={doc.id}
                        style={{
                          border: '1px solid var(--color-hairline)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <FileText size={16} />
                            <span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'capitalize' }}>
                              {doc.document_type.replace('_', ' ')}
                            </span>
                          </div>
                          <span className={`badge ${doc.verification_status === 'verified' ? 'badge-verified' : 'badge-pending'}`}>
                            {doc.verification_status}
                          </span>
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
  );
};
