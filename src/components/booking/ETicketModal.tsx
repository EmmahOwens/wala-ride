import React, { useState, useEffect } from 'react';
import type { BookingTicket } from '../../types/domain';
import { offlineTicketService } from '../../services/offline/OfflineTicketService';
import { emailNotificationService } from '../../services/notifications/EmailNotificationService';
import {
  X,
  Phone,
  Car,
  QrCode,
  AlertCircle,
  Share2,
  Download,
  Navigation,
  Mail,
  WifiOff,
  Luggage,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface ETicketModalProps {
  ticket: BookingTicket | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelBooking?: (bookingId: string) => void;
  onOpenLiveTracking?: () => void;
}

export const ETicketModal: React.FC<ETicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onCancelBooking,
  onOpenLiveTracking,
}) => {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailInput, setEmailInput] = useState<string>('');
  const [showEmailInput, setShowEmailInput] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() => !offlineTicketService.isOnline());
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (ticket) {
      // Automatically cache confirmed ticket offline
      offlineTicketService.saveTicket(ticket);
      if (ticket.passenger_email) {
        setEmailInput(ticket.passenger_email);
      }
    }
  }, [ticket]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (!isOpen || !ticket) return null;

  const handlePrintPdf = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    const targetEmail = emailInput.trim() || ticket.passenger_email;
    if (!targetEmail || !targetEmail.includes('@')) {
      setShowEmailInput(true);
      return;
    }

    setEmailStatus('sending');
    const res = await emailNotificationService.sendTicketReceiptEmail(ticket, targetEmail);
    if (res.success) {
      setEmailStatus('sent');
      setTimeout(() => setEmailStatus('idle'), 5000);
      setShowEmailInput(false);
    } else {
      setEmailStatus('error');
    }
  };

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleShare = () => {
    const maskedDriver = emailNotificationService.maskPhoneNumber(ticket.driver_phone);
    if (navigator.share) {
      navigator.share({
        title: `Wala Ride Boarding Pass: ${ticket.booking_reference}`,
        text: `Trip from ${ticket.origin_town} to ${ticket.dest_town} on ${new Date(ticket.trip_departs_at).toLocaleDateString()}. Driver: ${ticket.driver_name} (${ticket.vehicle_plate}). Ref: ${ticket.booking_reference}`,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `Wala Ride Ticket ${ticket.booking_reference}: ${ticket.origin_town} (${ticket.origin_stage}) -> ${ticket.dest_town} (${ticket.dest_stage}). Driver: ${ticket.driver_name} (${maskedDriver}). Plate: ${ticket.vehicle_plate}`
      );
      alert('Ticket details copied to clipboard!');
    }
  };

  const maskedDriverPhone = emailNotificationService.maskPhoneNumber(ticket.driver_phone);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content printable-ticket-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', padding: '0', overflow: 'hidden' }}
      >
        {/* Offline Banner if running offline */}
        {isOffline && (
          <div style={{
            backgroundColor: '#fef3c7',
            color: '#92400e',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid #fde68a',
          }}>
            <WifiOff size={14} color="#d97706" />
            <span>Offline Mode: Boarding pass is securely cached on this device.</span>
          </div>
        )}

        {/* Ticket Header */}
        <div
          className="ticket-header-print"
          style={{
            backgroundColor: '#000000',
            color: '#ffffff',
            padding: '24px 28px',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            className="no-print"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: '#282828',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <img
              src="/wala-ride.jpeg"
              alt="Wala Ride"
              style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff' }}>
              Wala Ride Boarding Pass
            </span>
            <span className="badge badge-verified" style={{ fontSize: '11px', padding: '2px 8px' }}>
              {ticket.status}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#888' }}>Booking Reference</div>
              <div style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                color: '#ffffff',
              }}>
                {ticket.booking_reference}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#888' }}>Direct Fare (Cash/MoMo)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                {ticket.total_fare_ugx.toLocaleString()} UGX
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Body */}
        <div style={{ padding: '28px' }}>
          {/* Route details */}
          <div style={{
            position: 'relative',
            paddingLeft: '28px',
            marginBottom: '20px',
          }}>
            {/* Vertical connector line */}
            <div style={{
              position: 'absolute',
              left: '9px',
              top: '12px',
              bottom: '12px',
              width: '2px',
              backgroundColor: '#000000',
            }} />

            {/* Origin */}
            <div style={{ marginBottom: '18px', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '-28px',
                top: '2px',
                width: '12px',
                height: '12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#000000',
              }} />
              <div style={{ fontSize: '12px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
                Boarding Point &bull; {ticket.origin_town}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
                {ticket.origin_stage}
              </div>
              <div className="body-sm" style={{ marginTop: '2px' }}>
                Departure: {new Date(ticket.trip_departs_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(ticket.trip_departs_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {/* Destination */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '-28px',
                top: '2px',
                width: '12px',
                height: '12px',
                borderRadius: 'var(--radius-none)',
                backgroundColor: '#000000',
              }} />
              <div style={{ fontSize: '12px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
                Alighting Point &bull; {ticket.dest_town}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
                {ticket.dest_stage}
              </div>
            </div>
          </div>

          {/* Passenger & Luggage Spec */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              flex: 1,
              minWidth: '140px',
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-hairline)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
                Seats Reserved
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>
                {ticket.total_seats} Seat{ticket.total_seats > 1 ? 's' : ''} ({ticket.passenger_name})
              </div>
            </div>

            <div style={{
              flex: 1,
              minWidth: '140px',
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-hairline)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Luggage size={12} /> Luggage Allowance
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px', textTransform: 'capitalize' }}>
                {ticket.luggage_size || 'Standard Handbag'}
              </div>
            </div>
          </div>

          <div className="divider" style={{ margin: '16px 0' }} />

          {/* Driver & Vehicle info */}
          <div style={{
            backgroundColor: 'var(--color-canvas-soft)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid var(--color-hairline)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#000000',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Car size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>
                  {ticket.vehicle_info} &bull; <span style={{ color: '#000000' }}>{ticket.vehicle_plate}</span>
                </div>
                <div className="body-sm" style={{ fontSize: '12px' }}>
                  Driver: {ticket.driver_name} ({ticket.driver_rating} &star;) &bull; Phone: {maskedDriverPhone}
                </div>
              </div>
            </div>

            {ticket.driver_phone && (
              <a
                href={`tel:${ticket.driver_phone}`}
                className="btn btn-secondary btn-sm no-print"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                title="Call Driver via Platform Relay"
              >
                <Phone size={13} /> Call
              </a>
            )}
          </div>

          {/* QR Code representation for driver validation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '6px',
            padding: '14px',
            border: '1px dashed var(--color-hairline)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '16px',
            backgroundColor: '#ffffff',
          }}>
            <QrCode size={80} strokeWidth={1.5} color="#000000" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-body)' }}>
              Scan at vehicle boarding stage
            </span>
            <span style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--color-subtle)',
              letterSpacing: '0.05em',
            }}>
              {ticket.offline_token || offlineTicketService.generateOfflineToken(ticket)}
            </span>
          </div>

          {/* Direct Cash Notice */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning)',
            fontSize: '12px',
            marginBottom: '16px',
          }}>
            <AlertCircle size={15} />
            <span>
              Pay <strong>{ticket.total_fare_ugx.toLocaleString()} UGX</strong> directly to {ticket.driver_name} upon boarding (Cash or MoMo).
            </span>
          </div>

          {/* Email Receipt Status / Input Bar */}
          <div className="no-print" style={{ marginBottom: '16px' }}>
            {showEmailInput ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="input"
                  style={{ flex: 1, fontSize: '13px', padding: '6px 10px' }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSendEmail}
                  disabled={emailStatus === 'sending'}
                >
                  <Mail size={14} /> Send
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowEmailInput(true)}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}
                >
                  <Mail size={14} color="#2563eb" />
                  <span>{emailStatus === 'sent' ? 'Receipt Dispatched ✓' : 'Email Ticket Receipt'}</span>
                </button>

                {ticket.offline_token && (
                  <span style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <ShieldCheck size={13} /> Offline Validated
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Live GPS Tracking & Safety */}
          {onOpenLiveTracking && (
            <button
              className="btn btn-primary btn-md no-print"
              style={{
                width: '100%',
                marginBottom: '12px',
                justifyContent: 'center',
                backgroundColor: '#111827',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              }}
              onClick={onOpenLiveTracking}
            >
              <Navigation size={16} color="#60a5fa" />
              <span>Live Highway Tracking & SOS</span>
            </button>
          )}

          {/* PWA Install Banner if applicable */}
          {installPrompt && !isInstalled && (
            <button
              className="btn btn-secondary btn-sm no-print"
              onClick={handleInstallPWA}
              style={{
                width: '100%',
                marginBottom: '12px',
                justifyContent: 'center',
                backgroundColor: '#eff6ff',
                borderColor: '#bfdbfe',
                color: '#1e40af',
                fontSize: '12px',
              }}
            >
              <Smartphone size={14} />
              <span>Add Wala-Ride to Home Screen for Offline Boarding</span>
            </button>
          )}

          {/* Action buttons */}
          <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary btn-md"
              style={{ flex: 1 }}
              onClick={handleShare}
            >
              <Share2 size={15} /> Share
            </button>
            <button
              className="btn btn-secondary btn-md"
              style={{ flex: 1 }}
              onClick={handlePrintPdf}
              title="Download clean printable boarding pass (PDF)"
            >
              <Download size={15} /> Download PDF
            </button>
            {onCancelBooking && (
              <button
                className="btn btn-subtle btn-md"
                style={{ color: 'var(--color-danger)' }}
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this reservation?')) {
                    onCancelBooking(ticket.booking_id);
                  }
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Print Styles for Vector PDF Generation */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-ticket-container,
          .printable-ticket-container * {
            visibility: visible;
          }
          .printable-ticket-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
          .no-print {
            display: none !important;
          }
          .ticket-header-print {
            background-color: #000 !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};
