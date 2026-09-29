import React from 'react';
import type { BookingTicket } from '../../types/domain';
import { X, Phone, Car, QrCode, AlertCircle, Share2, Download } from 'lucide-react';

interface ETicketModalProps {
  ticket: BookingTicket | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelBooking?: (bookingId: string) => void;
}

export const ETicketModal: React.FC<ETicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onCancelBooking,
}) => {
  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Wala Ride E-Ticket: ${ticket.booking_reference}`,
        text: `My trip from ${ticket.origin_town} to ${ticket.dest_town}. Driver: ${ticket.driver_name} (${ticket.driver_phone}). Plate: ${ticket.vehicle_plate}.`,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `Wala Ride Ticket ${ticket.booking_reference}: ${ticket.origin_town} (${ticket.origin_stage}) -> ${ticket.dest_town} (${ticket.dest_stage}). Driver: ${ticket.driver_name} (${ticket.driver_phone})`
      );
      alert('Ticket details copied to clipboard!');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '0', overflow: 'hidden' }}>
        {/* Ticket Header */}
        <div style={{
          backgroundColor: '#000000',
          color: '#ffffff',
          padding: '24px 28px',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a0a0a0' }}>
              Confirmed Boarding Pass
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
            marginBottom: '24px',
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
            <div style={{ marginBottom: '20px', position: 'relative' }}>
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
                Departure: {new Date(ticket.trip_departs_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(ticket.trip_departs_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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

          <div className="divider" style={{ margin: '20px 0' }} />

          {/* Driver & Vehicle info */}
          <div style={{
            backgroundColor: 'var(--color-canvas-soft)',
            padding: '16px',
            borderRadius: 'var(--radius-xl)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#000000',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Car size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>
                  {ticket.vehicle_info} &bull; <span style={{ color: '#000000' }}>{ticket.vehicle_plate}</span>
                </div>
                <div className="body-sm">
                  Driver: {ticket.driver_name} ({ticket.driver_rating} &star;)
                </div>
              </div>
            </div>

            {ticket.driver_phone && (
              <a
                href={`tel:${ticket.driver_phone}`}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 12px' }}
                title="Call Driver"
              >
                <Phone size={14} /> Call
              </a>
            )}
          </div>

          {/* QR Code representation for driver validation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
            padding: '16px',
            border: '1px dashed var(--color-hairline)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: '20px',
          }}>
            <QrCode size={90} strokeWidth={1.5} color="#000000" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-body)' }}>
              Scan at vehicle boarding stage
            </span>
          </div>

          {/* Direct Cash Notice */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning)',
            fontSize: '13px',
            marginBottom: '20px',
          }}>
            <AlertCircle size={16} />
            <span>
              Pay {ticket.total_fare_ugx.toLocaleString()} UGX directly to {ticket.driver_name} when you board.
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary btn-md"
              style={{ flex: 1 }}
              onClick={handleShare}
            >
              <Share2 size={16} /> Share
            </button>
            <button
              className="btn btn-secondary btn-md"
              style={{ flex: 1 }}
              onClick={handlePrint}
            >
              <Download size={16} /> Print / Save
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
    </div>
  );
};
