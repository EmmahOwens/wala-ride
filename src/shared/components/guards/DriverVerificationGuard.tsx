import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { DriverOnboarding } from '../../../components/driver/DriverOnboarding';

interface DriverVerificationGuardProps {
  children: React.ReactNode;
}

export const DriverVerificationGuard: React.FC<DriverVerificationGuardProps> = ({ children }) => {
  const { user, driverProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-subtle)',
        fontSize: '14px',
      }}>
        Checking driver verification status...
      </div>
    );
  }

  // If driver has not onboarded or submitted documentation yet
  if (!driverProfile) {
    return <DriverOnboarding />;
  }

  // If driver is pending verification
  if (driverProfile.verification_status === 'pending') {
    return (
      <div className="container" style={{ padding: '60px 16px', maxWidth: '640px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Clock size={32} />
        </div>
        <h2 className="display-sm" style={{ marginBottom: '8px' }}>Driver Application Under Review</h2>
        <p className="body-md" style={{ color: 'var(--color-subtle)', marginBottom: '24px' }}>
          Thank you, {user?.user_metadata?.first_name || 'Driver'}! Our operations team is currently reviewing your National ID and Driving Permit documents.
        </p>

        <div className="card" style={{ textAlign: 'left', padding: '20px', marginBottom: '28px', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <UserCheck size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)' }}>
                Average review turnaround: Under 2 hours
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-subtle)', marginTop: '4px' }}>
                Once verified, you will be able to publish scheduled journeys, manage passengers, and access the passenger demand radar.
              </div>
            </div>
          </div>
        </div>

        <DriverOnboarding />
      </div>
    );
  }

  // If driver verification was rejected
  if (driverProfile.verification_status === 'rejected') {
    return (
      <div className="container" style={{ padding: '60px 16px', maxWidth: '640px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <AlertTriangle size={32} />
        </div>
        <h2 className="display-sm" style={{ marginBottom: '8px', color: '#991b1b' }}>Document Verification Notice</h2>
        <p className="body-md" style={{ color: 'var(--color-ink)', marginBottom: '24px' }}>
          Your driver verification could not be completed. Please review the requirements and re-upload clear photos of your valid documents below.
        </p>
        <DriverOnboarding />
      </div>
    );
  }

  return <>{children}</>;
};
