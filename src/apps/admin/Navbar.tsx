import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut, Compass, Car, Activity } from 'lucide-react';
import { NotificationBell } from '../../components/common/NotificationBell';

interface AdminNavbarProps {
  onOpenAccount?: () => void;
  onOpenTicket?: (ticketId: string) => void;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  onOpenAccount,
  onOpenTicket,
}) => {
  const { user, profile, signOut } = useAuth();

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
        {/* Brand & Live Ops Pulse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a
            href="/admin"
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
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                marginLeft: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                ADMIN
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
              className="btn-pill-tab"
              style={{ textDecoration: 'none' }}
            >
              <Car size={16} /> Driver Portal
            </a>
            <a
              href="/admin"
              className="btn-pill-tab active"
              style={{ textDecoration: 'none' }}
            >
              <ShieldCheck size={16} /> Admin Console
            </a>
          </nav>
        </div>

        {/* Right side navigation and account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Realtime Live Pulse */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline)',
            fontSize: '12px',
            color: 'var(--color-body)',
            fontWeight: 600,
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success)',
              boxShadow: '0 0 6px var(--color-success)',
              display: 'inline-block',
            }} />
            <Activity size={12} color="var(--color-success)" />
            <span>Live Sync Active</span>
          </div>

          {user && (
            <NotificationBell onOpenTicket={onOpenTicket} />
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onOpenAccount}
                title="Manage Admin Profile"
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
                  {(profile?.first_name?.[0] || user.email?.[0] || 'A').toUpperCase()}
                </div>
                <span>
                  {profile?.first_name || user.email?.split('@')[0] || 'Admin Operator'}
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
          )}
        </div>
      </div>
    </header>
  );
};
