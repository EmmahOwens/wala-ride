import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Car, LogOut, ShieldCheck, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { NotificationBell } from '../../components/common/NotificationBell';

interface DriverNavbarProps {
  onOpenAuth: () => void;
  onOpenAccount?: () => void;
  onOpenTicket?: (ticketId: string) => void;
}

export const DriverNavbar: React.FC<DriverNavbarProps> = ({
  onOpenAuth,
  onOpenAccount,
  onOpenTicket,
}) => {
  const { user, profile, driverProfile, signOut } = useAuth();

  const getKycBadge = () => {
    if (!driverProfile) return null;
    if (driverProfile.verification_status === 'verified') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: '#dcfce7',
          color: '#166534',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          <ShieldCheck size={12} />
          Verified Driver
        </span>
      );
    }
    if (driverProfile.verification_status === 'pending') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          <Clock size={12} />
          KYC Pending
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        fontSize: '11px',
        fontWeight: 700,
      }}>
        <AlertTriangle size={12} />
        Action Required
      </span>
    );
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--color-hairline)',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a
            href="/driver"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#ffffff' }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000',
              fontWeight: 800,
            }}>
              <Car size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}>
                  WALA DRIVER
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: '#222222',
                  color: '#22c55e',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  Portal
                </span>
              </div>
            </div>
          </a>

          {getKycBadge()}
        </div>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#aaaaaa',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #333333',
            }}
          >
            <span>Passenger App</span>
            <ExternalLink size={12} />
          </a>

          {user && (
            <NotificationBell onOpenTicket={onOpenTicket} />
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onOpenAccount}
                title="Manage Driver Account"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#1e1e1e',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid #333333',
                  cursor: 'pointer',
                  color: '#ffffff',
                }}
              >
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#22c55e',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {(profile?.first_name?.[0] || user.email?.[0] || 'D').toUpperCase()}
                </div>
                <span>
                  {profile?.first_name || user.email?.split('@')[0] || user.phone || 'Driver Account'}
                </span>
              </button>

              <button
                className="btn btn-subtle btn-sm"
                onClick={signOut}
                title="Sign Out"
                style={{ padding: '8px', color: '#aaaaaa' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-md"
              onClick={onOpenAuth}
              style={{ backgroundColor: '#22c55e', color: '#000000', border: 'none' }}
            >
              Driver Login / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
