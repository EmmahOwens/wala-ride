import React, { useState } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { DriverNavbar } from './Navbar';
import { Footer } from '../../shared/components/layout/Footer';
import { AuthModal } from '../../components/auth/AuthModal';
import { AccountModal } from '../../components/auth/AccountModal';
import { RoleGuard } from '../../shared/components/guards/RoleGuard';
import { DriverVerificationGuard } from '../../shared/components/guards/DriverVerificationGuard';
import { TripPublisher } from '../../components/driver/TripPublisher';
import { DriverRadarDashboard } from '../../components/driver/DriverRadarDashboard';
import { DriverSubscriptionView } from '../../components/driver/DriverSubscriptionView';
import { DriverRouteRequestModal } from '../../components/driver/DriverRouteRequestModal';
import { DriverOnboarding } from '../../components/driver/DriverOnboarding';
import {
  Car,
  Radio,
  CreditCard,
  MapPin,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  UserCheck,
  Star,
  Award,
  Zap,
} from 'lucide-react';

const DriverCockpit: React.FC = () => {
  const { driverProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'radar' | 'subscription' | 'profile'>('trips');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: '1000px' }}>
      {/* Top Banner / Tab Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 className="display-sm" style={{ marginBottom: '4px' }}>Driver Cockpit</h1>
          <p className="body-sm" style={{ color: 'var(--color-subtle)' }}>
            Publish scheduled journeys, view passenger manifests, and unlock unserved route leads.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn-pill-tab ${activeTab === 'trips' ? 'active' : ''}`}
            onClick={() => setActiveTab('trips')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Car size={15} />
            <span>My Trips & Manifest</span>
          </button>

          <button
            className={`btn-pill-tab ${activeTab === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Radio size={15} color="#ea580c" />
            <span>Demand Radar</span>
          </button>

          <button
            className={`btn-pill-tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CreditCard size={15} color="#2563eb" />
            <span>Subscription</span>
          </button>

          <button
            className={`btn-pill-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserCheck size={15} />
            <span>Documents & Vehicle</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsRouteModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <MapPin size={14} color="#16a34a" />
            <span>Propose Route</span>
          </button>
        </div>
      </div>

      {/* Driver Performance & Super Driver Scorecard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '28px',
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-hairline)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#fefce8',
            color: '#a16207',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
              Tier Standing
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#a16207', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Star size={13} fill="#eab308" color="#eab308" /> Super Driver
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
              Verification
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534' }}>
              100% KYC Approved
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
              On-Time Rate
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e40af' }}>
              98.4% On Schedule
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#fff7ed',
            color: '#ea580c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
              Completion Rate
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#9a3412' }}>
              100% (0 Cancellations)
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'trips' && <TripPublisher />}

      {activeTab === 'radar' && driverProfile && (
        <DriverRadarDashboard
          driverId={driverProfile.id}
          onOpenSubscriptions={() => setActiveTab('subscription')}
        />
      )}

      {activeTab === 'subscription' && driverProfile && (
        <DriverSubscriptionView driverId={driverProfile.id} />
      )}

      {activeTab === 'profile' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2 className="title-md">Driver Credentials & Registered Vehicles</h2>
            <p className="body-sm" style={{ color: 'var(--color-subtle)' }}>
              Manage your National ID, driving permit class, and vehicle details.
            </p>
          </div>
          <DriverOnboarding />
        </div>
      )}

      {/* Propose Route Modal */}
      <DriverRouteRequestModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
      />
    </div>
  );
};

const DriverAppContent: React.FC = () => {
  const { user } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-canvas)' }}>
      {/* Driver Header */}
      <DriverNavbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
      />

      {/* Content */}
      <main style={{ flex: 1 }}>
        {!user ? (
          /* Unauthenticated Landing */
          <div className="container" style={{ padding: '80px 16px', maxWidth: '720px', textAlign: 'center' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#22c55e',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <Car size={34} />
            </div>

            <h1 className="display-lg" style={{ marginBottom: '16px' }}>
              Drive with Wala Ride
            </h1>
            <p className="body-lg" style={{ color: 'var(--color-subtle)', marginBottom: '36px', maxWidth: '580px', margin: '0 auto 36px' }}>
              Publish scheduled intercity journeys across Uganda, fill empty passenger seats, and keep 100% of your collected fares.
            </p>

            <div className="card" style={{ textAlign: 'left', marginBottom: '36px', padding: '28px', backgroundColor: '#fcfcfc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <CheckCircle2 size={20} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '15px' }}>Zero Commission on Fares</strong>
                    <p style={{ fontSize: '13px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      Passengers pay you directly via cash or your personal MoMo number.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <TrendingUp size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '15px' }}>Passenger Demand Radar</strong>
                    <p style={{ fontSize: '13px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      See unserved passenger routes and alerts along your travel corridor.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '15px' }}>Verified & Secure</strong>
                    <p style={{ fontSize: '13px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      Verified passenger manifests with digital boarding reference codes.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Car size={20} color="#ea580c" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '15px' }}>Your Schedule, Your Routes</strong>
                    <p style={{ fontSize: '13px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      Post departure times and pickup stages that align with your travel plans.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={() => setIsAuthOpen(true)}
              style={{
                fontWeight: 700,
                padding: '14px 32px',
                fontSize: '16px',
              }}
            >
              Sign Up or Log In as Driver
              <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </div>
        ) : (
          /* Authenticated: Enforce Role Guard and Verification Guard */
          <RoleGuard
            allowedRoles={['driver', 'operator']}
            portalName="Driver Portal"
            onOpenAuth={() => setIsAuthOpen(true)}
          >
            <DriverVerificationGuard>
              <DriverCockpit />
            </DriverVerificationGuard>
          </RoleGuard>
        )}
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

export const DriverApp: React.FC = () => {
  return (
    <AuthProvider>
      <DriverAppContent />
    </AuthProvider>
  );
};

export default DriverApp;
