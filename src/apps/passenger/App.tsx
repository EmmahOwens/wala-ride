import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { PassengerNavbar } from './Navbar';
import { AuthModal } from '../../components/auth/AuthModal';
import { AccountModal } from '../../components/auth/AccountModal';
import { PassengerView } from '../../components/passenger/PassengerView';
import { PassengerSupportModal } from '../../components/passenger/PassengerSupportModal';
import { PublicTrackingView } from '../../components/tracking/PublicTrackingView';
import { AddPickupPointModal } from '../../components/common/AddPickupPointModal';
import { isSupabaseConfigured } from '../../config/supabase';
import { AlertTriangle } from 'lucide-react';

const PassengerAppContent: React.FC = () => {
  const { isPasswordRecovery } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isAddStageOpen, setIsAddStageOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [supportBookingRef, setSupportBookingRef] = useState<string | null>(null);
  const [supportBookingId, setSupportBookingId] = useState<string | null>(null);
  const [supportTripId, setSupportTripId] = useState<string | null>(null);
  const [trackToken, setTrackToken] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('track');
  });

  // Automatically open auth modal when password recovery link is clicked
  useEffect(() => {
    if (isPasswordRecovery) {
      setIsAuthOpen(true);
    }
  }, [isPasswordRecovery]);

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
            <strong>Supabase configuration missing:</strong> Please configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
          </span>
        </div>
      )}

      {/* Passenger Navigation */}
      <PassengerNavbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenAddStage={() => setIsAddStageOpen(true)}
        onOpenSupport={() => {
          setSupportBookingRef(null);
          setSupportBookingId(null);
          setSupportTripId(null);
          setIsSupportModalOpen(true);
        }}
        onOpenTicket={() => {
          setIsSupportModalOpen(true);
        }}
      />

      {/* Main View: Tracking View or Passenger Booking */}
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
          <PassengerView
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenAddStage={() => setIsAddStageOpen(true)}
            onOpenSupport={(booking) => {
              if (booking) {
                setSupportBookingRef(booking.booking_reference);
                setSupportBookingId(booking.booking_id);
                setSupportTripId(booking.trip_id || null);
              } else {
                setSupportBookingRef(null);
                setSupportBookingId(null);
                setSupportTripId(null);
              }
              setIsSupportModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Consumer Footer */}
      <footer style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: '60px 0 32px',
        borderTop: '1px solid #222222',
        marginTop: 'auto',
      }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px',
            marginBottom: '48px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <img
                  src="/wala-ride.jpeg"
                  alt="Wala Ride"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  WALA RIDE
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#888888', lineHeight: 1.6, maxWidth: '280px' }}>
                Scheduled intercity ride-sharing across Uganda. Real-time corridor oversight, cash/MoMo directly to verified drivers.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                Popular Corridors
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['Kampala ↔ Mbarara', 'Kampala ↔ Jinja', 'Kampala ↔ Gulu', 'Kampala ↔ Mbale', 'Kampala ↔ Masaka', 'Jinja ↔ Tororo'].map((route) => (
                  <li key={route}>
                    <span style={{ fontSize: '13px', color: '#aaaaaa' }}>{route}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                Platforms & Portals
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <a href="/" style={{ fontSize: '13px', color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                    Passenger App
                  </a>
                </li>
                <li>
                  <a href="/driver" style={{ fontSize: '13px', color: '#aaaaaa', textDecoration: 'none' }}>
                    Driver Portal
                  </a>
                </li>
                <li>
                  <a href="/admin" style={{ fontSize: '13px', color: '#aaaaaa', textDecoration: 'none' }}>
                    Operations Console
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                Safety & Trust
              </h4>
              <p style={{ fontSize: '13px', color: '#888888', lineHeight: 1.6, marginBottom: '12px' }}>
                100% verified Ugandan driver permits, emergency SOS monitoring, live GPS trip shares, zero passenger booking fees.
              </p>
              <div style={{ display: 'inline-block', backgroundColor: '#1a1a1a', border: '1px solid #333333', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                🛡️ Live Safety Escort Active
              </div>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid #222222',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <p style={{ fontSize: '12px', color: '#666666', margin: 0 }}>
              &copy; {new Date().getFullYear()} Wala Ride Uganda. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button
                onClick={() => {
                  setSupportBookingRef(null);
                  setSupportBookingId(null);
                  setSupportTripId(null);
                  setIsSupportModalOpen(true);
                }}
                style={{ background: 'none', border: 'none', color: '#888888', fontSize: '12px', cursor: 'pointer', padding: 0 }}
              >
                Support Desk
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />

      <AddPickupPointModal
        isOpen={isAddStageOpen}
        onClose={() => setIsAddStageOpen(false)}
      />

      <PassengerSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => {
          setIsSupportModalOpen(false);
          setSupportBookingRef(null);
          setSupportBookingId(null);
          setSupportTripId(null);
        }}
        initialBookingRef={supportBookingRef || undefined}
        initialBookingId={supportBookingId || undefined}
        initialTripId={supportTripId || undefined}
      />
    </div>
  );
};

export const PassengerApp: React.FC = () => {
  return (
    <AuthProvider>
      <PassengerAppContent />
    </AuthProvider>
  );
};

export default PassengerApp;
