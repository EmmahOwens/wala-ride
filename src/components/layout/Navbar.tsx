import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Car, ShieldCheck, User, LogOut, Compass, PlusCircle, LifeBuoy } from 'lucide-react';
import { NotificationBell } from '../common/NotificationBell';
import type { UserRoleType } from '../../types/domain';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenAddStage?: () => void;
  onOpenSupport?: () => void;
  onOpenTicket?: (ticketId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenAddStage,
  onOpenSupport,
  onOpenTicket,
}) => {
  const { user, profile, roles, activeRole, setActiveRole, signOut } = useAuth();

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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            onClick={() => setActiveRole('passenger')}
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
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'none', gap: '8px' }} className="desktop-nav">
            <button
              className={`btn-pill-tab ${activeRole === 'passenger' ? 'active' : ''}`}
              onClick={() => setActiveRole('passenger')}
            >
              <Compass size={16} /> Intercity Rides
            </button>
            <button
              className={`btn-pill-tab ${activeRole === 'driver' ? 'active' : ''}`}
              onClick={() => setActiveRole('driver')}
            >
              <Car size={16} /> Driver Portal
            </button>
            {roles.includes('admin') && (
              <button
                className={`btn-pill-tab ${activeRole === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveRole('admin')}
              >
                <ShieldCheck size={16} /> Admin Console
              </button>
            )}
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
              {/* Role Switcher Pill */}
              <div style={{
                display: 'flex',
                background: 'var(--color-canvas-soft)',
                padding: '3px',
                borderRadius: 'var(--radius-pill)',
              }}>
                {(['passenger', 'driver'] as UserRoleType[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setActiveRole(r)}
                    style={{
                      border: 'none',
                      background: activeRole === r ? '#000000' : 'transparent',
                      color: activeRole === r ? '#ffffff' : 'var(--color-body)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {r}
                  </button>
                ))}
                {roles.includes('admin') && (
                  <button
                    onClick={() => setActiveRole('admin')}
                    style={{
                      border: 'none',
                      background: activeRole === 'admin' ? '#000000' : 'transparent',
                      color: activeRole === 'admin' ? '#ffffff' : 'var(--color-body)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Admin
                  </button>
                )}
              </div>

              {/* User avatar / name */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-canvas-soft)',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                <User size={15} />
                <span>
                  {profile?.first_name || user.email?.split('@')[0] || user.phone || 'My Account'}
                </span>
              </div>

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
