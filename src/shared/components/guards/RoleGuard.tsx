import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import type { UserRoleType } from '../../../types/domain';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: UserRoleType[];
  portalName: string;
  onOpenAuth?: () => void;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  portalName,
  onOpenAuth,
  children,
}) => {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: 'var(--color-ink)',
      }}>
        <div className="spinner" style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--color-hairline)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-subtle)' }}>
          Verifying security clearance for {portalName}...
        </p>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="container" style={{ padding: '80px 16px', maxWidth: '520px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--color-canvas-soft)',
          border: '1px solid var(--color-hairline)',
          color: 'var(--color-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <LogIn size={28} />
        </div>
        <h2 className="display-sm" style={{ marginBottom: '8px' }}>Sign in to {portalName}</h2>
        <p className="body-sm" style={{ marginBottom: '28px', color: 'var(--color-subtle)' }}>
          This portal requires authenticated credentials with designated permissions.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          {onOpenAuth ? (
            <button
              className="btn btn-primary btn-md"
              onClick={onOpenAuth}
              style={{ width: '100%', maxWidth: '280px' }}
            >
              Sign In / Log In
            </button>
          ) : (
            <a
              href="/"
              className="btn btn-primary btn-md"
              style={{ width: '100%', maxWidth: '280px', textDecoration: 'none' }}
            >
              Sign In via Main App
            </a>
          )}
          <a
            href="/"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} />
            <span>Return to Passenger App</span>
          </a>
        </div>
      </div>
    );
  }

  // Authenticated, check role permissions
  const isAuthorized = roles.some((r) => allowedRoles.includes(r));
  if (!isAuthorized) {
    return (
      <div className="container" style={{ padding: '80px 16px', maxWidth: '560px', textAlign: 'center' }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <ShieldAlert size={32} />
        </div>
        <h2 className="display-sm" style={{ marginBottom: '10px', color: '#991b1b' }}>Access Restricted</h2>
        <p className="body-md" style={{ marginBottom: '16px', color: 'var(--color-ink)' }}>
          Your account (<code>{user.email || user.phone}</code>) does not hold the permissions required to access <strong>{portalName}</strong>.
        </p>
        <p className="body-sm" style={{ marginBottom: '32px', color: 'var(--color-subtle)' }}>
          Required role: <strong>{allowedRoles.join(' or ')}</strong>. Your active roles: <strong>{roles.join(', ') || 'None'}</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <a
            href="/"
            className="btn btn-secondary btn-md"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Passenger App</span>
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
