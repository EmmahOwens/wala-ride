import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { PassengerNavbar } from './Navbar';
import { Footer } from '../../shared/components/layout/Footer';
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

      {/* Shared Unified Footer */}
      <Footer onOpenSupport={() => setIsSupportModalOpen(true)} />

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
