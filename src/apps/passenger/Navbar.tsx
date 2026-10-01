import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Compass, PlusCircle, LifeBuoy, Car } from 'lucide-react';
import { NotificationBell } from '../../components/common/NotificationBell';

interface PassengerNavbarProps {
  onOpenAuth: () => void;
  onOpenAccount?: () => void;
  onOpenAddStage?: () => void;
  onOpenSupport?: () => void;
  onOpenTicket?: (ticketId: string) => void;
}

export const PassengerNavbar: React.FC<PassengerNavbarProps> = ({
  onOpenAuth,
  onOpenAccount,
  onOpenAddStage,
  onOpenSupport,
  onOpenTicket,
}) => {
  const { user, profile, roles, signOut } = useAuth();

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
            href="/"
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
              }}>
                WALA
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                marginLeft: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                RIDE
              </span>
            </div>
          </a>

          {/* Navigation Links */}
          <nav style={{ display: 'none', gap: '8px' }} className="desktop-nav">
            <a
              href="/"
              className="btn-pill-tab active"
              style={{ textDecoration: 'none' }}
            >
              <Compass size={16} /> Intercity Rides
            </a>
            <a
              href="/driver"
              className="btn-pill-tab"
              style={{ textDecoration: 'none' }}
            >
              <Car size={16} /> Drive with Us
            </a>
          </nav>
        </div>

        {/* Right Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

          {onOpenAddStage && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenAddStage}
              title="Add a custom pickup point or stage"
            >
              <PlusCircle size={15} />
              <span>Add Stage</span>
            </button>
          )}

          {user && (
            <NotificationBell onOpenTicket={onOpenTicket} />
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* If user is also a verified driver or admin, show link to portal */}
              {roles.includes('driver') && (
                <a
                  href="/driver"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none', fontSize: '12px' }}
                >
                  Driver Portal &rarr;
                </a>
              )}
              {roles.includes('admin') && (
                <a
                  href="/admin"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none', fontSize: '12px' }}
                >
                  Admin Console &rarr;
                </a>
              )}

              {/* User avatar / name */}
              <button
                type="button"
                onClick={onOpenAccount}
                title="Manage Account & Profile"
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
                <div
                  style={{
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
                  }}
                >
                  {(profile?.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <span>
                  {profile?.first_name || user.email?.split('@')[0] || user.phone || 'My Account'}
                </span>
              </button>

              {/* Sign out */}
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
            <button className="btn btn-primary btn-md" onClick={onOpenAuth}>
              Log in / Sign up
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
