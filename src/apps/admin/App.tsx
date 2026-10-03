import React, { useState } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { AdminNavbar } from './Navbar';
import { Footer } from '../../shared/components/layout/Footer';
import { RoleGuard } from '../../shared/components/guards/RoleGuard';
import { AuthModal } from '../../components/auth/AuthModal';
import { AccountModal } from '../../components/auth/AccountModal';
import { AdminIncidentConsole } from '../../components/admin/AdminIncidentConsole';
import { AdminVerificationQueue } from '../../components/admin/AdminVerificationQueue';
import { AdminSupportQueue } from '../../components/admin/AdminSupportQueue';
import { AdminDemandAnalytics } from '../../components/admin/AdminDemandAnalytics';
import { AdminRouteManager } from '../../components/admin/AdminRouteManager';
import { AdminUserDirectory } from './components/AdminUserDirectory';
import { AdminGoogleMapsRadar } from '../../components/admin/AdminGoogleMapsRadar';
import { AdminDisputeCenter } from '../../components/admin/AdminDisputeCenter';
import { useAdminRealtime } from '../../shared/hooks/useAdminRealtime';
import {
  ShieldAlert,
  UserCheck,
  LifeBuoy,
  TrendingUp,
  Route as RouteIcon,
  Users,
  BellRing,
  Radio,
  Scale,
} from 'lucide-react';

type AdminTab = 'radar' | 'incidents' | 'verification' | 'directory' | 'routes' | 'support' | 'demand' | 'disputes';

const AdminDashboard: React.FC = () => {
  const [adminTab, setAdminTab] = useState<AdminTab>('radar');
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Real-time listener for operational alerts across the platform
  useAdminRealtime({
    onIncidentUpdate: (payload) => {
      if (payload.eventType === 'INSERT') {
        setRealtimeNotice(`🚨 New SOS / Incident reported: ${payload.new?.kind?.toUpperCase() || 'Emergency'}`);
        setTimeout(() => setRealtimeNotice(null), 8000);
      }
    },
    onDriverKYCUpdate: (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setRealtimeNotice('📋 New driver document submitted for verification.');
        setTimeout(() => setRealtimeNotice(null), 6000);
      }
    },
    onSupportUpdate: (payload) => {
      if (payload.eventType === 'INSERT') {
        setRealtimeNotice('📩 New customer support ticket / message received.');
        setTimeout(() => setRealtimeNotice(null), 6000);
      }
    },
    onRouteChange: () => {
      setRealtimeNotice('📍 A new custom pickup stage or corridor has been requested.');
      setTimeout(() => setRealtimeNotice(null), 6000);
    },
  });

  return (
    <div className="container" style={{ padding: '36px 16px' }}>
      {/* Realtime Toast Banner */}
      {realtimeNotice && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e40af',
          fontWeight: 600,
          fontSize: '14px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <BellRing size={18} color="#2563eb" />
          <span>{realtimeNotice}</span>
        </div>
      )}

      {/* Header and Tab Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 className="display-md" style={{ marginBottom: '4px' }}>Platform Operations & Safety</h1>
          <p className="body-sm" style={{ color: 'var(--color-subtle)' }}>
            Real-time Uganda transport corridor oversight, driver KYC verification, live SOS triage & corridor management.
          </p>
        </div>

        {/* Admin Navigation Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn-pill-tab ${adminTab === 'radar' ? 'active' : ''}`}
            onClick={() => setAdminTab('radar')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Radio size={14} color="#0284c7" />
            <span>Live Fleet Radar</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setAdminTab('incidents')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldAlert size={14} color="#dc2626" />
            <span>Live SOS & Incidents</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'verification' ? 'active' : ''}`}
            onClick={() => setAdminTab('verification')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserCheck size={14} color="#16a34a" />
            <span>Driver KYC & Expiry</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'disputes' ? 'active' : ''}`}
            onClick={() => setAdminTab('disputes')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Scale size={14} color="#d97706" />
            <span>Disputes & Shield</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'directory' ? 'active' : ''}`}
            onClick={() => setAdminTab('directory')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={14} color="#2563eb" />
            <span>Users & Drivers</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'routes' ? 'active' : ''}`}
            onClick={() => setAdminTab('routes')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RouteIcon size={14} color="#ea580c" />
            <span>Routes & Towns</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'support' ? 'active' : ''}`}
            onClick={() => setAdminTab('support')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LifeBuoy size={14} color="#2563eb" />
            <span>Support Queue</span>
          </button>

          <button
            className={`btn-pill-tab ${adminTab === 'demand' ? 'active' : ''}`}
            onClick={() => setAdminTab('demand')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <TrendingUp size={14} color="#8b5cf6" />
            <span>Demand Radar</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {adminTab === 'radar' && <AdminGoogleMapsRadar />}
      {adminTab === 'incidents' && <AdminIncidentConsole />}
      {adminTab === 'verification' && <AdminVerificationQueue />}
      {adminTab === 'disputes' && <AdminDisputeCenter />}
      {adminTab === 'directory' && <AdminUserDirectory />}
      {adminTab === 'routes' && <AdminRouteManager />}
      {adminTab === 'support' && <AdminSupportQueue />}
      {adminTab === 'demand' && (
        <AdminDemandAnalytics onNavigateToRoutes={() => setAdminTab('routes')} />
      )}
    </div>
  );
};

const AdminAppContent: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-canvas)' }}>
      {/* Admin Operations Header */}
      <AdminNavbar
        onOpenAccount={() => setIsAccountOpen(true)}
      />

      {/* Content Protected by Strict RoleGuard */}
      <main style={{ flex: 1 }}>
        <RoleGuard
          allowedRoles={['admin', 'support_agent']}
          portalName="Admin Console"
          onOpenAuth={() => setIsAuthOpen(true)}
        >
          <AdminDashboard />
        </RoleGuard>
      </main>

      {/* Shared Unified Footer */}
      <Footer />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />
    </div>
  );
};

export const AdminApp: React.FC = () => {
  return (
    <AuthProvider>
      <AdminAppContent />
    </AuthProvider>
  );
};

export default AdminApp;
