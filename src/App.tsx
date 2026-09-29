import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { AuthModal } from './components/auth/AuthModal';
import { DriverOnboarding } from './components/driver/DriverOnboarding';
import { AdminVerificationQueue } from './components/admin/AdminVerificationQueue';
import { AdminIncidentConsole } from './components/admin/AdminIncidentConsole';
import { PassengerView } from './components/passenger/PassengerView';
import { PublicTrackingView } from './components/tracking/PublicTrackingView';
import { AddPickupPointModal } from './components/common/AddPickupPointModal';
import { isSupabaseConfigured } from './config/supabase';
import { Car, ArrowRight, Check, AlertTriangle, ShieldAlert, UserCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, activeRole, setActiveRole } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isAddStageOpen, setIsAddStageOpen] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<'incidents' | 'verification'>('incidents');
  const [trackToken, setTrackToken] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('track');
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-canvas)' }}>
      {!isSupabaseConfigured && (
        <div style={{
          backgroundColor: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          color: '#92400e',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          zIndex: 1000,
        }}>
          <AlertTriangle size={16} color="#d97706" />
          <span>
            <strong>Supabase configuration missing:</strong> Please configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your Vercel Project Settings.
          </span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAddStage={() => setIsAddStageOpen(true)}
      />

      {/* Main View based on Active Role or Public Tracking */}
      <main style={{ flex: 1 }}>
        {trackToken ? (
          <PublicTrackingView
            shareToken={trackToken}
            onGoHome={() => {
              window.history.pushState({}, '', window.location.pathname);
              setTrackToken(null);
            }}
          />
        ) : (
          <>
            {activeRole === 'passenger' && (
              <PassengerView
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenAddStage={() => setIsAddStageOpen(true)}
              />
            )}

            {activeRole === 'driver' && (
              <div>
                {!user ? (
                  <div className="container" style={{ padding: '80px 16px', maxWidth: '640px', textAlign: 'center' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 24px',
                    }}>
                      <Car size={32} />
                    </div>
                    <h1 className="display-lg">Drive with Wala Ride</h1>
                    <p className="body-lg" style={{ marginTop: '12px', marginBottom: '32px' }}>
                      Publish scheduled intercity journeys across Uganda, fill your empty passenger seats, and keep 100% of your fares.
                    </p>

                    <div className="card" style={{ textAlign: 'left', marginBottom: '32px', padding: '24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Check size={20} color="var(--color-success)" />
                          <span style={{ fontSize: '15px', fontWeight: 600 }}>Zero commission on fares — passengers pay you directly</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Check size={20} color="var(--color-success)" />
                          <span style={{ fontSize: '15px', fontWeight: 600 }}>Publish trips for your exact routes & departure times</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Check size={20} color="var(--color-success)" />
                          <span style={{ fontSize: '15px', fontWeight: 600 }}>Access passenger demand radar alerts on unserved routes</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-lg"
                      onClick={() => setIsAuthOpen(true)}
                    >
                      Sign Up as Driver
                      <ArrowRight size={18} />
                    </button>
                  </div>
                ) : (
                  <DriverOnboarding />
                )}
              </div>
            )}

            {activeRole === 'admin' && (
              <div className="container" style={{ padding: '36px 16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '28px',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}>
                  <div>
                    <h1 className="display-md">Platform Operations & Safety</h1>
                    <p className="body-sm" style={{ marginTop: '4px' }}>
                      Real-time Uganda transport corridor oversight, driver onboarding, and emergency SOS incident handling.
                    </p>
                  </div>

                  {/* Admin Tab Switcher */}
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                      <UserCheck size={14} />
                      <span>Driver KYC Queue</span>
                    </button>
                  </div>
                </div>

                {adminTab === 'incidents' && <AdminIncidentConsole />}
                {adminTab === 'verification' && <AdminVerificationQueue />}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: '60px 0 32px',
        marginTop: '60px',
      }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '36px',
            marginBottom: '48px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000' }}>
                  <Car size={18} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em' }}>WALA RIDE</span>
              </div>
              <p className="body-sm" style={{ color: '#a0a0a0', maxWidth: '280px' }}>
                Connecting drivers and passengers across Uganda's long-distance transport corridors.
              </p>
            </div>

            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popular Corridors</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#a0a0a0' }}>
                <li>Kampala &harr; Mbarara</li>
                <li>Jinja &harr; Mbale</li>
                <li>Kampala &harr; Gulu</li>
                <li>Soroti &harr; Kampala</li>
                <li>Kampala &harr; Masaka</li>
              </ul>
            </div>

            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Roles</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#a0a0a0' }}>
                <li style={{ cursor: 'pointer' }} onClick={() => setActiveRole('passenger')}>Passenger Booking</li>
                <li style={{ cursor: 'pointer' }} onClick={() => setActiveRole('driver')}>Driver & Fleet Onboarding</li>
                <li style={{ cursor: 'pointer' }} onClick={() => setActiveRole('admin')}>Admin Verification Console</li>
                <li style={{ cursor: 'pointer' }} onClick={() => setIsAddStageOpen(true)}>Suggest a Stage</li>
              </ul>
            </div>

            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direct Payments</h4>
              <p className="body-sm" style={{ color: '#a0a0a0', lineHeight: 1.6 }}>
                Passengers pay drivers directly at boarding in cash or via MTN MoMo / Airtel Money. Zero app commission on your fares.
              </p>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid #282828',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '13px',
            color: '#707070',
          }}>
            <div>&copy; {new Date().getFullYear()} Wala Ride Uganda. All rights reserved.</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Safety Guidelines</span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <AddPickupPointModal
        isOpen={isAddStageOpen}
        onClose={() => setIsAddStageOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
