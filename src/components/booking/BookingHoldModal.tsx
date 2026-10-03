import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/supabase/SupabaseBookingService';
import { emailNotificationService } from '../../services/notifications/EmailNotificationService';
import type { SearchResultTrip, BookingTicket, LuggageSize } from '../../types/domain';
import { X, Clock, ArrowRight, AlertTriangle, MapPin, Check, Luggage, Mail } from 'lucide-react';

interface BookingHoldModalProps {
  trip: SearchResultTrip | null;
  isOpen: boolean;
  onClose: () => void;
  onBookingConfirmed: (ticket: BookingTicket) => void;
  onOpenAuth: () => void;
}

export const BookingHoldModal: React.FC<BookingHoldModalProps> = ({
  trip,
  isOpen,
  onClose,
  onBookingConfirmed,
  onOpenAuth,
}) => {
  const { user } = useAuth();

  const [step, setStep] = useState<'select' | 'holding'>('select');
  const [seatCount, setSeatCount] = useState<number>(1);
  const [luggageSize, setLuggageSize] = useState<LuggageSize>('standard');
  const [luggageNotes, setLuggageNotes] = useState<string>('');
  const [passengerEmail, setPassengerEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hold session states
  const [heldBookingId, setHeldBookingId] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 mins

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSeatCount(1);
      setLuggageSize('standard');
      setLuggageNotes('');
      setHeldBookingId(null);
      setErrorMessage(null);
      setSecondsRemaining(900);
      if (user?.email) {
        setPassengerEmail(user.email);
      }
    }
  }, [isOpen, trip?.trip_id, user?.email]);

  // Hold countdown interval
  useEffect(() => {
    if (step === 'holding' && secondsRemaining > 0) {
      const timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setErrorMessage('Your 15-minute seat hold has expired. Please select a seat again.');
            setStep('select');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, secondsRemaining]);

  if (!isOpen || !trip) return null;

  const totalFare = trip.fare_ugx * seatCount;

  const handleStartHold = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const res = await bookingService.bookSegment({
      tripId: trip.trip_id,
      passengerId: user.id,
      originTripStopId: trip.origin_trip_stop_id,
      destTripStopId: trip.dest_trip_stop_id,
      seatCount,
      fareUgx: totalFare,
    });

    setLoading(false);

    if (res.error || !res.bookingId) {
      setErrorMessage(res.error?.message === 'SEATS_UNAVAILABLE'
        ? 'Sorry, those seats were just reserved by another passenger. Please try with fewer seats.'
        : res.error?.message || 'Could not hold seats');
      return;
    }

    setHeldBookingId(res.bookingId);
    setSecondsRemaining(900);
    setStep('holding');
  };

  const handleConfirmReservation = async () => {
    if (!heldBookingId) return;

    setLoading(true);
    setErrorMessage(null);

    const { success, error } = await bookingService.confirmBooking(heldBookingId);
    if (!success || error) {
      setLoading(false);
      setErrorMessage(error?.message || 'Failed to confirm booking');
      return;
    }

    // Fetch confirmed ticket
    const ticket = await bookingService.getBookingTicket(heldBookingId);
    setLoading(false);

    if (ticket) {
      // Enrich ticket with declared luggage and email
      const enrichedTicket: BookingTicket = {
        ...ticket,
        luggage_size: luggageSize,
        luggage_notes: luggageNotes.trim() || undefined,
        passenger_email: passengerEmail.trim() || user?.email || undefined,
      };

      // Automatically email the ticket receipt
      if (enrichedTicket.passenger_email) {
        emailNotificationService.sendTicketReceiptEmail(enrichedTicket, enrichedTicket.passenger_email);
      }

      onClose();
      onBookingConfirmed(enrichedTicket);
    } else {
      onClose();
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--color-canvas-soft)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {errorMessage && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '16px',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Select Seats, Luggage & Email */}
        {step === 'select' && (
          <div>
            <div style={{ marginBottom: '18px' }}>
              <span className="badge badge-neutral" style={{ marginBottom: '8px' }}>
                Trip Booking
              </span>
              <h2 className="display-md">
                {trip.origin_town_name} &rarr; {trip.dest_town_name}
              </h2>
              <p className="body-sm" style={{ marginTop: '4px' }}>
                Departs at {new Date(trip.departs_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(trip.departs_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </p>
            </div>

            {/* Stops summary */}
            <div style={{
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '14px 16px',
              borderRadius: 'var(--radius-xl)',
              marginBottom: '18px',
              fontSize: '13px',
              border: '1px solid var(--color-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MapPin size={15} color="#000000" />
                <span>Boarding: <strong>{trip.origin_pickup_name}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={15} color="#000000" />
                <span>Alighting: <strong>{trip.dest_pickup_name}</strong></span>
              </div>
            </div>

            {/* Seat selector */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Passenger Seats</span>
                <span className="body-sm" style={{ color: 'var(--color-body)' }}>{trip.seats_available} available</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {[1, 2, 3, 4, 5].slice(0, Math.min(5, trip.seats_available)).map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`btn btn-md ${seatCount === num ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px 0', fontSize: '14px' }}
                    onClick={() => setSeatCount(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Luggage Tier Selector */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Luggage size={14} />
                <span>Luggage & Cargo Allowance</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setLuggageSize('standard')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: luggageSize === 'standard' ? '2px solid #000000' : '1px solid var(--color-hairline)',
                    backgroundColor: luggageSize === 'standard' ? '#f4f4f5' : '#ffffff',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '12px' }}>Handbag</div>
                  <div style={{ fontSize: '11px', color: '#16a34a' }}>Free</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLuggageSize('medium')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: luggageSize === 'medium' ? '2px solid #000000' : '1px solid var(--color-hairline)',
                    backgroundColor: luggageSize === 'medium' ? '#f4f4f5' : '#ffffff',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '12px' }}>Suitcase</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>Trunk Space</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLuggageSize('heavy_cargo')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: luggageSize === 'heavy_cargo' ? '2px solid #000000' : '1px solid var(--color-hairline)',
                    backgroundColor: luggageSize === 'heavy_cargo' ? '#f4f4f5' : '#ffffff',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '12px' }}>Cargo / Sack</div>
                  <div style={{ fontSize: '11px', color: '#ea580c' }}>Produce / Box</div>
                </button>
              </div>

              {luggageSize === 'heavy_cargo' && (
                <input
                  type="text"
                  placeholder="Describe cargo (e.g. 1 bunch of matooke, 50kg bag)"
                  value={luggageNotes}
                  onChange={(e) => setLuggageNotes(e.target.value)}
                  className="input"
                  style={{ marginTop: '8px', fontSize: '12px', padding: '6px 10px' }}
                />
              )}
            </div>

            {/* Passenger Email Input for E-Ticket Delivery */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} />
                <span>Ticket Receipt Email</span>
              </label>
              <input
                type="email"
                placeholder="Where should we send your ticket?"
                value={passengerEmail}
                onChange={(e) => setPassengerEmail(e.target.value)}
                className="input"
                style={{ fontSize: '13px', padding: '8px 12px' }}
              />
            </div>

            {/* Price breakdown */}
            <div style={{
              borderTop: '1px solid var(--color-hairline)',
              paddingTop: '14px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--color-body)' }}>Total Direct Fare</span>
                <div style={{ fontSize: '11px', color: 'var(--color-mute)' }}>Paid to driver when boarding</div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>
                {totalFare.toLocaleString()} UGX
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg btn-full"
              disabled={loading}
              onClick={handleStartHold}
            >
              {loading ? 'Securing seat hold...' : `Hold ${seatCount} ${seatCount === 1 ? 'Seat' : 'Seats'} (15 mins)`}
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 2: Active 15-Minute Seat Hold */}
        {step === 'holding' && (
          <div>
            {/* Hold Timer Banner */}
            <div style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '20px',
              borderRadius: 'var(--radius-xl)',
              textAlign: 'center',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a0a0a0' }}>
                <Clock size={14} /> Temporary Seat Hold Active
              </div>
              <div style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: '44px',
                fontWeight: 800,
                letterSpacing: '2px',
                margin: '8px 0',
              }}>
                {formatTimer(secondsRemaining)}
              </div>
              <p style={{ fontSize: '12px', color: '#b0b0b0' }}>
                Your {seatCount} seat(s) on <strong>{trip.vehicle_info}</strong> are held and cannot be booked by anyone else.
              </p>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                Confirm Boarding Reservation
              </h3>
              <p className="body-sm">
                By confirming, you commit to arriving at <strong>{trip.origin_pickup_name}</strong> on time.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '14px 16px',
              borderRadius: 'var(--radius-xl)',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '13px',
              border: '1px solid var(--color-hairline)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="body-sm">Driver</span>
                <span style={{ fontWeight: 600 }}>{trip.driver_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="body-sm">Vehicle Plate</span>
                <span style={{ fontWeight: 600 }}>{trip.vehicle_plate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="body-sm">Luggage Tier</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{luggageSize}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="body-sm">Ticket will be emailed to</span>
                <span style={{ fontWeight: 600 }}>{passengerEmail || user?.email || 'Your account'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-hairline)', paddingTop: '8px', marginTop: '4px' }}>
                <span className="body-sm">Fare to pay driver</span>
                <span style={{ fontWeight: 800, fontSize: '16px' }}>{totalFare.toLocaleString()} UGX</span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || secondsRemaining <= 0}
              onClick={handleConfirmReservation}
            >
              <Check size={18} />
              <span>{loading ? 'Confirming booking...' : 'Confirm Reservation & Get Ticket'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
