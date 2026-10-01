import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut, ExternalLink, Activity } from 'lucide-react';
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
      borderBottom: '1px solid #1f2937',
      backgroundColor: '#0f172a',
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
        {/* Brand & Live Ops Pulse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a
            href="/admin"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#ffffff' }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}>
                  WALA OPS
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  backgroundColor: '#7f1d1d',
                  color: '#fecaca',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  Admin
                </span>
              </div>
            </div>
          </a>

          {/* Realtime Live Pulse */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            fontSize: '12px',
            color: '#38bdf8',
            fontWeight: 600,
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              display: 'inline-block',
            }} />
            <Activity size={12} />
            <span>Realtime Channels Active</span>
          </div>
        </div>

        {/* Right side navigation and account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#94a3b8',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #334155',
            }}
          >
            <span>Passenger App</span>
            <ExternalLink size={12} />
          </a>

          <a
            href="/driver"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#94a3b8',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #334155',
            }}
          >
            <span>Driver Portal</span>
            <ExternalLink size={12} />
          </a>

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
                  backgroundColor: '#1e293b',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid #334155',
                  cursor: 'pointer',
                  color: '#ffffff',
                }}
              >
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#dc2626',
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
                style={{ padding: '8px', color: '#94a3b8' }}
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
