import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Car, Compass, LogOut, ShieldCheck, Clock, AlertTriangle, LifeBuoy } from 'lucide-react';
import { NotificationBell } from '../../components/common/NotificationBell';

interface DriverNavbarProps {
  onOpenAuth: () => void;
  onOpenAccount?: () => void;
  onOpenTicket?: (ticketId: string) => void;
  onOpenSupport?: () => void;
}

export const DriverNavbar: React.FC<DriverNavbarProps> = ({
  onOpenAuth,
  onOpenAccount,
  onOpenTicket,
  onOpenSupport,
}) => {
  const { user, profile, roles, driverProfile, signOut } = useAuth();

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
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
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
          backgroundColor: 'var(--color-warning-bg)',
          color: 'var(--color-warning)',
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
        backgroundColor: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
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
      backgroundColor: 'var(--color-canvas)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a
            href="/driver"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}
          >
            <img
              src="/wala-ride.jpeg"
              alt="Wala Ride"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                objectFit: 'cover',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              }}
            />
            <div>
              <span style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--color-ink)',
              }}>
                WALA
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'var(--color-canvas-soft)',
                color: 'var(--color-ink)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                marginLeft: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                DRIVER
              </span>
            </div>
          </a>

          {/* Navigation Links */}
          <nav style={{ display: 'none', gap: '8px' }} className="desktop-nav">
            <a
              href="/"
              className="btn-pill-tab"
              style={{ textDecoration: 'none' }}
            >
              <Compass size={16} /> Intercity Rides
            </a>
            <a
              href="/driver"
              className="btn-pill-tab active"
              style={{ textDecoration: 'none' }}
            >
              <Car size={16} /> Driver Portal
            </a>
            {roles.includes('admin') && (
              <a
                href="/admin"
                className="btn-pill-tab"
                style={{ textDecoration: 'none' }}
              >
                <ShieldCheck size={16} /> Admin Console
              </a>
            )}
          </nav>
        </div>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getKycBadge()}

          {onOpenSupport && (
            <button
              className="btn btn-subtle btn-sm"
              onClick={onOpenSupport}
              title="Customer Support"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LifeBuoy size={16} color="var(--color-primary)" />
              <span style={{ fontWeight: 600 }}>Help</span>
            </button>
          )}

          {user && (
            <NotificationBell onOpenTicket={onOpenTicket} />
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* User avatar / name */}
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
                  backgroundColor: 'var(--color-canvas-soft)',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid var(--color-hairline)',
                  cursor: 'pointer',
                  color: 'var(--color-ink)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#000000',
                  color: '#ffffff',
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
                style={{ padding: '8px' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-md"
              onClick={onOpenAuth}
            >
              Driver Login / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
