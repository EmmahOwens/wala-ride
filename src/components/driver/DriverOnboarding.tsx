import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { driverService } from '../../services/supabase/SupabaseDriverService';
import type { DriverDocument, Vehicle } from '../../types/domain';
import { TripPublisher } from './TripPublisher';
import { DriverRadarDashboard } from './DriverRadarDashboard';
import { DriverSubscriptionView } from './DriverSubscriptionView';
import { DriverRouteRequestModal } from './DriverRouteRequestModal';
import { ShieldCheck, Clock, AlertTriangle, Upload, Car, FileText, ChevronRight, Calendar, Radio, CreditCard, Route as RouteIcon, Plus } from 'lucide-react';

export const DriverOnboarding: React.FC = () => {
  const { user, driverProfile, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'vehicle' | 'trips' | 'radar' | 'subscription' | 'routes'>('profile');
  const [isRouteRequestOpen, setIsRouteRequestOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile Form State
  const [licenseNumber, setLicenseNumber] = useState<string>(driverProfile?.license_number || '');
  const [licenseClass, setLicenseClass] = useState<string>(driverProfile?.license_class || 'B');
  const [licenseExpiry, setLicenseExpiry] = useState<string>(driverProfile?.license_expiry || '');
  const [nationalId, setNationalId] = useState<string>(driverProfile?.national_id || '');

  // Document upload states
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Vehicle Form State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleMake, setVehicleMake] = useState<string>('Toyota');
  const [vehicleModel, setVehicleModel] = useState<string>('HiAce (14 Seater)');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [capacitySeats, setCapacitySeats] = useState<number>(14);
  const [vehicleColor, setVehicleColor] = useState<string>('White');

  useEffect(() => {
    if (driverProfile?.id) {
      loadDriverData(driverProfile.id);
    }
  }, [driverProfile?.id]);

  const loadDriverData = async (driverId: string) => {
    const [docs, vList] = await Promise.all([
      driverService.getDriverDocuments(driverId),
      driverService.getDriverVehicles(driverId),
    ]);
    setDocuments(docs);
    setVehicles(vList);
  };

  const handleSaveDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    try {
      await driverService.createDriverProfile(user.id, {
        license_number: licenseNumber.trim(),
        license_class: licenseClass,
        license_expiry: licenseExpiry || null,
        national_id: nationalId.trim().toUpperCase(),
      });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Driver profile updated. Proceed to upload your KYC documents.' });
      setActiveTab('documents');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !driverProfile) return;

    setUploadingDoc(documentType);
    setMessage(null);

    const { error } = await driverService.uploadDocument(
      user.id,
      driverProfile.id,
      documentType,
      file
    );

    setUploadingDoc(null);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: `${documentType.replace('_', ' ')} uploaded successfully!` });
      await loadDriverData(driverProfile.id);
    }
  };

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile) return;
    setLoading(true);
    setMessage(null);

    const v = await driverService.registerVehicle(driverProfile.id, {
      make: vehicleMake,
      model: vehicleModel,
      license_plate: licensePlate,
      capacity_seats: Number(capacitySeats),
      color: vehicleColor,
    });

    setLoading(false);
    if (v) {
      setMessage({ type: 'success', text: `Vehicle ${licensePlate} registered successfully!` });
      setLicensePlate('');
      await loadDriverData(driverProfile.id);
    } else {
      setMessage({ type: 'error', text: 'Failed to register vehicle' });
    }
  };

  const verificationStatus = driverProfile?.verification_status || 'pending';

  return (
    <div className="container" style={{ padding: '40px 16px', maxWidth: '860px' }}>
      {/* Verification Status Header Banner */}
      <div style={{
        padding: '24px',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: verificationStatus === 'verified'
          ? 'var(--color-success-bg)'
          : verificationStatus === 'rejected'
          ? 'var(--color-danger-bg)'
          : 'var(--color-warning-bg)',
        border: `1px solid ${
          verificationStatus === 'verified'
            ? 'var(--color-success)'
            : verificationStatus === 'rejected'
            ? 'var(--color-danger)'
            : 'var(--color-warning)'
        }`,
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {verificationStatus === 'verified' ? (
            <ShieldCheck size={32} color="var(--color-success)" />
          ) : verificationStatus === 'rejected' ? (
            <AlertTriangle size={32} color="var(--color-danger)" />
          ) : (
            <Clock size={32} color="var(--color-warning)" />
          )}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {verificationStatus === 'verified'
                ? 'Verified Driver Account'
                : verificationStatus === 'rejected'
                ? 'Verification Needs Attention'
                : 'Driver Verification In Progress'}
            </h3>
            <p className="body-sm" style={{ marginTop: '2px', color: 'var(--color-ink)' }}>
              {verificationStatus === 'verified'
                ? 'Your credentials and vehicle are fully approved. You can now publish scheduled trips.'
                : verificationStatus === 'rejected'
                ? 'Please check the rejection notes below and re-upload the requested documents.'
                : 'Upload your driving permit, national ID, and vehicle logbook for admin review.'}
            </p>
          </div>
        </div>
        <span className={`badge ${
          verificationStatus === 'verified' ? 'badge-verified' : verificationStatus === 'rejected' ? 'badge-rejected' : 'badge-pending'
        }`}>
          {verificationStatus}
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--color-hairline)',
        marginBottom: '28px',
      }}>
        <button
          className={`btn-pill-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <FileText size={16} /> 1. License & ID
        </button>
        <button
          className={`btn-pill-tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <Upload size={16} /> 2. KYC Documents ({documents.length})
        </button>
        <button
          className={`btn-pill-tab ${activeTab === 'vehicle' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicle')}
        >
          <Car size={16} /> 3. Vehicle ({vehicles.length})
        </button>
        <button
          className={`btn-pill-tab ${activeTab === 'trips' ? 'active' : ''}`}
          onClick={() => setActiveTab('trips')}
        >
          <Calendar size={16} /> 4. Publish Trips
        </button>
        <button
          className={`btn-pill-tab ${activeTab === 'radar' ? 'active' : ''}`}
          onClick={() => setActiveTab('radar')}
        >
          <Radio size={16} /> 5. Demand Radar
        </button>
        <button
          className={`btn-pill-tab ${activeTab === 'subscription' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscription')}
        >
          <CreditCard size={16} /> 6. Subscriptions
        </button>
        <button
          className={`btn-pill-tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          <RouteIcon size={16} /> 7. Routes
        </button>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '20px',
          backgroundColor: message.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      {/* TAB 1: Profile & License */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2 className="display-md" style={{ marginBottom: '8px' }}>Driver Credentials</h2>
          <p className="body-md" style={{ marginBottom: '24px' }}>
            Provide your national identity and driving license information as shown on your physical documents.
          </p>

          <form onSubmit={handleSaveDriverProfile}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Driving License Number</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. UG987654321"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Class</label>
                <select
                  className="select-field"
                  value={licenseClass}
                  onChange={(e) => setLicenseClass(e.target.value)}
                >
                  <option value="B">Class B (Passenger Cars / SUVs)</option>
                  <option value="CM">Class CM (Medium Omnibuses & Minivans)</option>
                  <option value="DL">Class DL (Light Goods / Coasters)</option>
                  <option value="DM">Class DM (Heavy Passenger Buses)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">National ID Number (NIN)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. CM90012345ABC"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Expiry Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-md" disabled={loading}>
                {loading ? 'Saving...' : 'Save & Continue to Documents'}
                <ChevronRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Document Uploads */}
      {activeTab === 'documents' && (
        <div>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 className="display-md" style={{ marginBottom: '8px' }}>Upload Verification Documents</h2>
            <p className="body-md" style={{ marginBottom: '24px' }}>
              Files are stored securely in your private encrypted KYC vault. Only authorized platform admins can review them.
            </p>

            <div className="grid-3">
              {[
                { type: 'national_id', title: 'National ID (NIN)', desc: 'Clear front photo of your Uganda National ID card.' },
                { type: 'driving_license', title: 'Driving Permit', desc: 'Valid driving license showing classes and expiry.' },
                { type: 'vehicle_logbook', title: 'Vehicle Logbook', desc: 'URA registration logbook or owner authorization.' },
              ].map((docItem) => {
                const existing = documents.find((d) => d.document_type === docItem.type);
                const isUploading = uploadingDoc === docItem.type;

                return (
                  <div
                    key={docItem.type}
                    style={{
                      border: '1px solid var(--color-hairline)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      backgroundColor: existing ? 'var(--color-canvas-softer)' : 'var(--color-canvas)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{docItem.title}</h4>
                        {existing && (
                          <span className={`badge ${existing.verification_status === 'verified' ? 'badge-verified' : 'badge-pending'}`}>
                            {existing.verification_status}
                          </span>
                        )}
                      </div>
                      <p className="body-sm" style={{ marginBottom: '16px' }}>{docItem.desc}</p>
                    </div>

                    <div>
                      <label className="btn btn-secondary btn-sm btn-full" style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                        <Upload size={14} />
                        <span>{isUploading ? 'Uploading...' : existing ? 'Replace File' : 'Upload File'}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          disabled={isUploading || !driverProfile}
                          onChange={(e) => handleFileUpload(docItem.type, e)}
                        />
                      </label>
                      {existing && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-mute)', textAlign: 'center' }}>
                          Uploaded {new Date(existing.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Vehicle Registration */}
      {activeTab === 'vehicle' && (
        <div className="card">
          <h2 className="display-md" style={{ marginBottom: '8px' }}>Registered Vehicles</h2>
          <p className="body-md" style={{ marginBottom: '24px' }}>
            Add the primary vehicle(s) you use to run intercity journeys.
          </p>

          {/* List existing vehicles */}
          {vehicles.length > 0 && (
            <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-hairline)',
                    backgroundColor: 'var(--color-canvas-soft)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Car size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>
                        {v.make} {v.model} ({v.color || 'Standard'})
                      </div>
                      <div className="body-sm">
                        Plate: <strong>{v.license_plate}</strong> &bull; Capacity: {v.capacity_seats} Passenger Seats
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${v.verification_status === 'verified' ? 'badge-verified' : 'badge-pending'}`}>
                    {v.verification_status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Vehicle Form */}
          <form onSubmit={handleRegisterVehicle} style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              Add a Vehicle
            </h3>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Vehicle Make</label>
                <select
                  className="select-field"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                >
                  <option value="Toyota">Toyota</option>
                  <option value="Nissan">Nissan</option>
                  <option value="Isuzu">Isuzu</option>
                  <option value="Subaru">Subaru</option>
                  <option value="Mitsubishi">Mitsubishi</option>
                  <option value="Mercedes-Benz">Mercedes-Benz</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle Model & Body</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. HiAce Drone / Alphard / Noah"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Plate (Uganda format)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. UBA 123A"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Passenger Seat Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="input-field"
                  placeholder="e.g. 14"
                  value={capacitySeats}
                  onChange={(e) => setCapacitySeats(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle Color</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. White, Silver, Black"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-md" disabled={loading || !licensePlate.trim()}>
                {loading ? 'Adding vehicle...' : 'Register Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Trip Publisher & Manifests */}
      {activeTab === 'trips' && <TripPublisher />}

      {/* TAB 5: Passenger Demand Radar */}
      {activeTab === 'radar' && driverProfile && (
        <DriverRadarDashboard
          driverId={driverProfile.id}
          onPostTripForRoute={() => setActiveTab('trips')}
          onOpenSubscriptions={() => setActiveTab('subscription')}
        />
      )}

      {/* TAB 6: Driver Subscriptions & Quotas */}
      {activeTab === 'subscription' && driverProfile && (
        <DriverSubscriptionView
          driverId={driverProfile.id}
          onPlanChanged={() => refreshProfile()}
        />
      )}

      {/* TAB 7: Route Requests */}
      {activeTab === 'routes' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 className="display-md" style={{ marginBottom: '4px' }}>Corridor Routes</h2>
              <p className="body-md">
                Browse active corridor routes or request a new one for your regular intercity journey.
              </p>
            </div>
            <button
              className="btn btn-primary btn-md"
              onClick={() => setIsRouteRequestOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              Request New Route
            </button>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline)',
            marginTop: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <RouteIcon size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>How Route Requests Work</h3>
            </div>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: 1.6 }}>
              <li>Click <strong>Request New Route</strong> and use the Google Maps picker to select your origin and destination in Uganda.</li>
              <li>The map automatically calculates driving distance and estimated duration for the corridor.</li>
              <li>Submit the request — our admin team reviews it within 24 hours.</li>
              <li>Once approved, the corridor appears in <strong>Publish Trips</strong> (Tab 4) for you and all other drivers to schedule trips on.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Route Request Modal */}
      <DriverRouteRequestModal
        isOpen={isRouteRequestOpen}
        onClose={() => setIsRouteRequestOpen(false)}
      />
    </div>
  );
};
