import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { geographyService } from '../../services/supabase/SupabaseGeographyService';
import { bookingService } from '../../services/supabase/SupabaseBookingService';
import { tripService } from '../../services/supabase/SupabaseTripService';
import { BookingHoldModal } from '../booking/BookingHoldModal';
import { ETicketModal } from '../booking/ETicketModal';
import { TripAlertModal } from './TripAlertModal';
import { LiveTripTrackerModal } from '../tracking/LiveTripTrackerModal';
import { EmergencyContactsModal } from '../tracking/EmergencyContactsModal';
import { offlineTicketService } from '../../services/offline/OfflineTicketService';
import type { Town, PickupPoint, SearchResultTrip, BookingTicket, Route } from '../../types/domain';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Shield,
  ArrowRight,
  Wallet,
  CheckCircle,
  Navigation,
  Ticket,
  Clock,
  ShieldAlert,
  LifeBuoy,
  Route as RouteIcon,
  ExternalLink,
  Heart,
  Wind,
  Star,
  Package,
  ArrowLeftRight,
  Filter,
} from 'lucide-react';

interface PassengerViewProps {
  onOpenAuth: () => void;
  onOpenAddStage: () => void;
  onOpenSupport?: (booking?: BookingTicket) => void;
}

export const PassengerView: React.FC<PassengerViewProps> = ({
  onOpenAuth,
  onOpenAddStage,
  onOpenSupport,
}) => {
  const { user } = useAuth();

  const [towns, setTowns] = useState<Town[]>([]);
  const [originTownId, setOriginTownId] = useState<string>('');
  const [destinationTownId, setDestinationTownId] = useState<string>('');
  const [originStages, setOriginStages] = useState<PickupPoint[]>([]);
  const [destinationStages, setDestinationStages] = useState<PickupPoint[]>([]);
  const [selectedOriginStage, setSelectedOriginStage] = useState<string>('');
  const [selectedDestinationStage, setSelectedDestinationStage] = useState<string>('');
  const [travelDate, setTravelDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [seats, setSeats] = useState<number>(1);

  // Search Results State
  const [searchResults, setSearchResults] = useState<SearchResultTrip[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Filters State
  const [departureWindow, setDepartureWindow] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [filterLadiesOnly, setFilterLadiesOnly] = useState<boolean>(false);
  const [filterAc, setFilterAc] = useState<boolean>(false);
  const [filterTopRated, setFilterTopRated] = useState<boolean>(false);
  const [filterParcels, setFilterParcels] = useState<boolean>(false);

  // Return Journey State
  const [showReturnCard, setShowReturnCard] = useState<boolean>(false);
  const [returnDate, setReturnDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });

  // All active corridor routes
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);

  // Active Passenger Tickets (including offline cached)
  const [passengerTickets, setPassengerTickets] = useState<BookingTicket[]>([]);

  // Modals
  const [selectedTripForHold, setSelectedTripForHold] = useState<SearchResultTrip | null>(null);
  const [selectedTicketForView, setSelectedTicketForView] = useState<BookingTicket | null>(null);
  const [selectedTicketForTracking, setSelectedTicketForTracking] = useState<BookingTicket | null>(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState<boolean>(false);
  const [isContactsOpen, setIsContactsOpen] = useState<boolean>(false);
  const [showTripAlertModal, setShowTripAlertModal] = useState<boolean>(false);


  useEffect(() => {
    geographyService.getTowns().then((tList) => {
      setTowns(tList);
      if (tList.length >= 2) {
        const kampala = tList.find((t) => t.name === 'Kampala') || tList[0];
        const mbarara = tList.find((t) => t.name === 'Mbarara') || tList[1];
        setOriginTownId(kampala.id);
        setDestinationTownId(mbarara.id);
      }
    });
    // Load all active corridor routes for the browse section
    tripService.getRoutes().then(setAllRoutes);
  }, []);

  useEffect(() => {
    if (originTownId) {
      geographyService.getPickupPoints(originTownId).then((stages) => {
        setOriginStages(stages);
        if (stages.length > 0) setSelectedOriginStage(stages[0].id);
      });
    }
  }, [originTownId]);

  useEffect(() => {
    if (destinationTownId) {
      geographyService.getPickupPoints(destinationTownId).then((stages) => {
        setDestinationStages(stages);
        if (stages.length > 0) setSelectedDestinationStage(stages[0].id);
      });
    }
  }, [destinationTownId]);

  useEffect(() => {
    // Check for cached offline tickets on mount
    const cachedTickets = offlineTicketService.getAllTickets();
    if (cachedTickets.length > 0) {
      setPassengerTickets(cachedTickets);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadPassengerTickets(user.id);
    }
  }, [user?.id]);

  const loadPassengerTickets = async (passengerId: string) => {
    try {
      const tickets = await bookingService.getPassengerTickets(passengerId);
      // Cache each ticket for offline access
      tickets.forEach((tk) => offlineTicketService.saveTicket(tk));
      setPassengerTickets(tickets);
    } catch {
      const cached = offlineTicketService.getAllTickets();
      if (cached.length > 0) {
        setPassengerTickets(cached);
      }
    }
  };

  const handleQuickRoute = (originName: string, destName: string) => {
    const o = towns.find((t) => t.name === originName);
    const d = towns.find((t) => t.name === destName);
    if (o && d) {
      setOriginTownId(o.id);
      setDestinationTownId(d.id);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originTownId || !destinationTownId) return;

    setSearchLoading(true);
    setHasSearched(true);
    setShowReturnCard(true);

    const results = await bookingService.searchTrips({
      originTownId,
      destTownId: destinationTownId,
      date: travelDate,
      seats,
    });

    setSearchResults(results);
    setSearchLoading(false);
  };

  const handleSearchReturnTrip = async () => {
    if (!originTownId || !destinationTownId) return;
    const prevOrigin = originTownId;
    const prevDest = destinationTownId;

    // Flip corridor
    setOriginTownId(prevDest);
    setDestinationTownId(prevOrigin);
    setTravelDate(returnDate);
    setShowReturnCard(false);

    setSearchLoading(true);
    setHasSearched(true);

    const results = await bookingService.searchTrips({
      originTownId: prevDest,
      destTownId: prevOrigin,
      date: returnDate,
      seats,
    });

    setSearchResults(results);
    setSearchLoading(false);
  };

  const handleCancelBooking = async (bookingId: string) => {
    await bookingService.cancelBooking(bookingId);
    offlineTicketService.removeTicket(bookingId);
    setSelectedTicketForView(null);
    if (user?.id) loadPassengerTickets(user.id);
  };

  // Filter computation
  const filteredSearchResults = searchResults.filter((trip) => {
    if (departureWindow !== 'all') {
      const d = new Date(trip.departs_at);
      const hours = d.getHours();
      if (departureWindow === 'morning' && (hours < 6 || hours >= 12)) return false;
      if (departureWindow === 'afternoon' && (hours < 12 || hours >= 17)) return false;
      if (departureWindow === 'evening' && hours < 17) return false;
    }
    if (filterLadiesOnly && !trip.is_ladies_only) return false;
    if (filterAc && !trip.has_ac) return false;
    if (filterTopRated && (trip.driver_rating < 4.5)) return false;
    if (filterParcels && !trip.accepts_parcels) return false;
    return true;
  });

  const originTown = towns.find((t) => t.id === originTownId)?.name || 'Origin';
  const destTown = towns.find((t) => t.id === destinationTownId)?.name || 'Destination';

  return (
    <div>
      {/* PASSENGER'S ACTIVE E-TICKETS BANNER */}
      {passengerTickets.length > 0 && (
        <section style={{ backgroundColor: 'var(--color-canvas-soft)', borderBottom: '1px solid var(--color-hairline)', padding: '16px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Ticket size={20} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: '15px' }}>
                  You have {passengerTickets.length} confirmed trip {passengerTickets.length === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {passengerTickets.slice(0, 2).map((tk) => (
                  <div key={tk.booking_id} style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedTicketForView(tk)}
                    >
                      Ticket ({tk.booking_reference})
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: '#111827', color: '#ffffff', gap: '6px' }}
                      onClick={() => {
                        setSelectedTicketForTracking(tk);
                        setIsLiveTrackingOpen(true);
                      }}
                    >
                      <Navigation size={12} color="#60a5fa" />
                      <span>Live Track</span>
                    </button>
                    {onOpenSupport && (
                      <button
                        className="btn btn-subtle btn-sm"
                        style={{ gap: '4px' }}
                        title="Get help with this journey"
                        onClick={() => onOpenSupport(tk)}
                      >
                        <LifeBuoy size={12} color="var(--color-primary)" />
                        <span>Help</span>
                      </button>
                    )}
                  </div>
                ))}
                {user && (
                  <button
                    className="btn btn-subtle btn-sm"
                    style={{ gap: '6px' }}
                    onClick={() => setIsContactsOpen(true)}
                  >
                    <ShieldAlert size={14} color="#dc2626" />
                    <span>Safety Contacts</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* HERO SECTION */}
      <section style={{
        padding: '60px 0 40px',
        backgroundColor: 'var(--color-canvas)',
      }}>
        <div className="container">
          <div style={{ maxWidth: '780px', marginBottom: '36px' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-body)',
              display: 'inline-block',
              marginBottom: '12px',
            }}>
              Direct Intercity Carpools & Scheduled Shuttles
            </span>
            <h1 className="display-xxl">
              Go anywhere in Uganda. Reserve your seat ahead.
            </h1>
            <p className="body-lg" style={{ marginTop: '16px' }}>
              Travel comfortably between Kampala, Mbarara, Jinja, Mbale, Gulu, Soroti, and Masaka with verified drivers. Pay directly in cash or Mobile Money when boarding.
            </p>
          </div>

          {/* SEARCH WIZARD CARD */}
          <div className="card card-elevated" style={{ padding: '32px' }}>
            <form onSubmit={handleSearch}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '20px',
              }}>
                {/* Origin Town & Stage */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#000000" /> Origin Town
                  </label>
                  <select
                    className="select-field"
                    value={originTownId}
                    onChange={(e) => setOriginTownId(e.target.value)}
                  >
                    {towns.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {originStages.length > 0 && (
                    <select
                      className="select-field"
                      style={{ marginTop: '8px', fontSize: '13px' }}
                      value={selectedOriginStage}
                      onChange={(e) => setSelectedOriginStage(e.target.value)}
                    >
                      {originStages.map((s) => (
                        <option key={s.id} value={s.id}>
                          Boarding: {s.name} ({s.kind})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Destination Town & Stage */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Navigation size={14} color="#000000" /> Destination Town
                  </label>
                  <select
                    className="select-field"
                    value={destinationTownId}
                    onChange={(e) => setDestinationTownId(e.target.value)}
                  >
                    {towns.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.id === originTownId}>{t.name}</option>
                    ))}
                  </select>

                  {destinationStages.length > 0 && (
                    <select
                      className="select-field"
                      style={{ marginTop: '8px', fontSize: '13px' }}
                      value={selectedDestinationStage}
                      onChange={(e) => setSelectedDestinationStage(e.target.value)}
                    >
                      {destinationStages.map((s) => (
                        <option key={s.id} value={s.id}>
                          Alighting: {s.name} ({s.kind})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Date */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#000000" /> Travel Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Seats */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} color="#000000" /> Passenger Seats
                  </label>
                  <select
                    className="select-field"
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Seat' : 'Seats'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit & Quick Corridors */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-hairline)',
              }}>
                {/* Popular Corridors */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="body-sm" style={{ fontWeight: 600 }}>Frequent routes:</span>
                  {[
                    ['Kampala', 'Mbarara'],
                    ['Jinja', 'Mbale'],
                    ['Kampala', 'Gulu'],
                    ['Soroti', 'Kampala'],
                  ].map(([orig, dest]) => (
                    <button
                      key={`${orig}-${dest}`}
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => handleQuickRoute(orig, dest)}
                    >
                      {orig} &rarr; {dest}
                    </button>
                  ))}
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={searchLoading}>
                  <Search size={18} />
                  <span>{searchLoading ? 'Searching routes...' : 'Search Scheduled Trips'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* SEARCH RESULTS FEED */}
      {hasSearched && (
        <section style={{ padding: '20px 0 60px' }}>
          <div className="container">
            {/* RETURN TRIP PROMPT CARD */}
            {showReturnCard && (
              <div
                className="card"
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <ArrowLeftRight size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#166534' }}>
                      Planning Your Return Leg? ({destTown} &rarr; {originTown})
                    </div>
                    <div className="body-sm" style={{ color: '#15803d' }}>
                      Easily search or reserve your return trip ahead to avoid last-minute stage delays.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#166534" />
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="input"
                      style={{ padding: '6px 10px', fontSize: '13px', width: '150px' }}
                    />
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleSearchReturnTrip}
                    style={{ backgroundColor: '#ffffff', borderColor: '#86efac', color: '#166534', gap: '6px' }}
                  >
                    <span>Search Return</span> &rarr;
                  </button>
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <h2 className="display-md">
                  Trips from {originTown} to {destTown}
                </h2>
                <p className="body-sm">
                  {filteredSearchResults.length} of {searchResults.length} departure(s) match your filters for {new Date(travelDate).toLocaleDateString('en-GB', { dateStyle: 'full' })}
                </p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenAddStage}
              >
                + Add Stage in {originTown}
              </button>
            </div>

            {/* QUICK FILTERS BAR */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: 'var(--color-canvas-soft)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-body)' }}>
                <Filter size={14} /> Filter:
              </div>

              {/* Time of day selector */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'morning', 'afternoon', 'evening'] as const).map((win) => (
                  <button
                    key={win}
                    type="button"
                    onClick={() => setDepartureWindow(win)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--color-hairline)',
                      backgroundColor: departureWindow === win ? '#000000' : '#ffffff',
                      color: departureWindow === win ? '#ffffff' : 'var(--color-body)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {win === 'all' ? 'Any Time' : win}
                  </button>
                ))}
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-hairline)' }} />

              {/* Ladies Only toggle */}
              <button
                type="button"
                onClick={() => setFilterLadiesOnly(!filterLadiesOnly)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: filterLadiesOnly ? '1px solid #ec4899' : '1px solid var(--color-hairline)',
                  backgroundColor: filterLadiesOnly ? '#fdf2f8' : '#ffffff',
                  color: filterLadiesOnly ? '#be185d' : 'var(--color-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Heart size={12} color={filterLadiesOnly ? '#ec4899' : 'var(--color-subtle)'} />
                Ladies Only
              </button>

              {/* AC toggle */}
              <button
                type="button"
                onClick={() => setFilterAc(!filterAc)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: filterAc ? '1px solid #3b82f6' : '1px solid var(--color-hairline)',
                  backgroundColor: filterAc ? '#eff6ff' : '#ffffff',
                  color: filterAc ? '#1d4ed8' : 'var(--color-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Wind size={12} color={filterAc ? '#3b82f6' : 'var(--color-subtle)'} />
                Air Conditioned
              </button>

              {/* Top Rated toggle */}
              <button
                type="button"
                onClick={() => setFilterTopRated(!filterTopRated)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: filterTopRated ? '1px solid #eab308' : '1px solid var(--color-hairline)',
                  backgroundColor: filterTopRated ? '#fefce8' : '#ffffff',
                  color: filterTopRated ? '#a16207' : 'var(--color-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Star size={12} color={filterTopRated ? '#eab308' : 'var(--color-subtle)'} />
                Super Driver (4.5★+)
              </button>

              {/* Parcels Accepted toggle */}
              <button
                type="button"
                onClick={() => setFilterParcels(!filterParcels)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: filterParcels ? '1px solid #ea580c' : '1px solid var(--color-hairline)',
                  backgroundColor: filterParcels ? '#fff7ed' : '#ffffff',
                  color: filterParcels ? '#c2410c' : 'var(--color-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Package size={12} color={filterParcels ? '#ea580c' : 'var(--color-subtle)'} />
                Accepts Parcels
              </button>
            </div>

            {searchLoading ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <p className="body-md">Checking available vehicle segment capacity...</p>
              </div>
            ) : filteredSearchResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredSearchResults.map((trip) => (
                  <div
                    key={trip.trip_id}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '20px',
                      padding: '24px',
                    }}
                  >
                    <div>
                      {/* Driver & Rating & Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '18px' }}>{trip.driver_name}</span>
                        <span className="badge badge-verified">
                          Verified &bull; {trip.driver_rating} &star;
                        </span>
                        {trip.driver_rating >= 4.7 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: '#fefce8',
                            color: '#a16207',
                            border: '1px solid #fef08a',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            <Star size={11} fill="#eab308" color="#eab308" /> Super Driver
                          </span>
                        )}
                        {trip.is_ladies_only && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: '#fdf2f8',
                            color: '#be185d',
                            border: '1px solid #fbcfe8',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            <Heart size={11} color="#ec4899" fill="#ec4899" /> Ladies Only
                          </span>
                        )}
                        {trip.has_ac && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            <Wind size={11} color="#3b82f6" /> AC
                          </span>
                        )}
                        {trip.accepts_parcels && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            <Package size={11} color="#ea580c" /> Parcels OK
                          </span>
                        )}
                        <span className="body-sm">
                          {trip.vehicle_info} ({trip.vehicle_plate})
                        </span>
                      </div>

                      {/* Stops & Times */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '10px 0', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={16} color="var(--color-primary)" />
                          <span style={{ fontWeight: 700, fontSize: '16px' }}>
                            {new Date(trip.departs_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="body-sm" style={{ color: 'var(--color-body)' }}>
                          Boarding: <strong>{trip.origin_pickup_name}</strong> &rarr; Alighting: <strong>{trip.dest_pickup_name}</strong>
                        </div>
                      </div>

                      {/* Available Seats Pill */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>
                          &bull; {trip.seats_available} seats remaining on this segment
                        </span>
                      </div>
                    </div>

                    {/* Price and Book Button */}
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--color-mute)' }}>Fare per seat</div>
                      <div style={{ fontSize: '26px', fontWeight: 800 }}>
                        {trip.fare_ugx.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600 }}>UGX</span>
                      </div>
                      <button
                        className="btn btn-primary btn-md"
                        onClick={() => setSelectedTripForHold(trip)}
                      >
                        Book Seat
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty Demand Alert Card */
              <div className="card" style={{
                padding: '40px 24px',
                textAlign: 'center',
                borderStyle: 'dashed',
                backgroundColor: 'var(--color-canvas-soft)',
              }}>
                <Navigation size={40} style={{ margin: '0 auto 12px', color: 'var(--color-body)' }} />
                <h3 className="display-sm">No driver has published this route yet for this date</h3>
                <p className="body-md" style={{ maxWidth: '520px', margin: '8px auto 20px' }}>
                  We've logged your search as a demand signal. Save an alert below so drivers running from <strong>{originTown} to {destTown}</strong> see you on their radar.
                </p>
                <button
                  className="btn btn-primary btn-md"
                  onClick={() => {
                    if (!user) {
                      onOpenAuth();
                    } else {
                      setShowTripAlertModal(true);
                    }
                  }}
                >
                  Alert Me When a Driver Posts This Route
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* VALUE PROPOSITIONS & WHY WALA */}
      <section style={{ padding: '60px 0', borderTop: '1px solid var(--color-hairline)' }}>
        <div className="container">
          {/* BROWSE ALL ROUTES */}
          {allRoutes.length > 0 && (
            <div style={{ marginBottom: '60px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 className="display-md">All Active Corridor Routes</h2>
                  <p className="body-md" style={{ marginTop: '4px' }}>
                    {allRoutes.length} intercity corridors currently served by Wala Ride drivers.
                  </p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {allRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="card"
                    style={{
                      padding: '18px 20px',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.2s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = '';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                    }}
                    onClick={() => {
                      if (route.origin_town?.id) setOriginTownId(route.origin_town.id);
                      if (route.destination_town?.id) setDestinationTownId(route.destination_town.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: 'var(--radius-pill)',
                        backgroundColor: '#000', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <RouteIcon size={16} />
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>{route.name}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <MapPin size={13} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600 }}>{route.origin_town?.name || '—'}</span>
                      <ArrowRight size={13} />
                      <Navigation size={13} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600 }}>{route.destination_town?.name || '—'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {route.distance_km && (
                        <span style={{
                          fontSize: '12px', fontWeight: 600,
                          backgroundColor: 'var(--color-canvas-soft)',
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--color-hairline)',
                        }}>
                          {route.distance_km} km
                        </span>
                      )}
                      {route.estimated_duration_minutes && (
                        <span style={{
                          fontSize: '12px', fontWeight: 600,
                          backgroundColor: 'var(--color-canvas-soft)',
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--color-hairline)',
                        }}>
                          ~{Math.floor(route.estimated_duration_minutes / 60)}h {route.estimated_duration_minutes % 60}m
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (route.origin_town?.id) setOriginTownId(route.origin_town.id);
                          if (route.destination_town?.id) setDestinationTownId(route.destination_town.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Search Trips <ArrowRight size={13} />
                      </button>
                      {route.origin_town?.lat && route.destination_town?.lat && (
                        <a
                          href={`https://maps.google.com/maps/dir/${route.origin_town.lat},${route.origin_town.lng}/${route.destination_town.lat},${route.destination_town.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-subtle btn-sm"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          Maps <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid-3">
            <div className="card" style={{ border: 'none', padding: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <Shield size={24} />
              </div>
              <h3 className="display-sm">Admin-Verified Drivers</h3>
              <p className="body-md" style={{ marginTop: '8px' }}>
                Every driver is thoroughly vetted with their Uganda National ID, valid driving permit, and verified vehicle logbook before taking passenger trips.
              </p>
            </div>

            <div className="card" style={{ border: 'none', padding: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <Wallet size={24} />
              </div>
              <h3 className="display-sm">Direct Cash or MoMo</h3>
              <p className="body-md" style={{ marginTop: '8px' }}>
                No upfront app card charges. Pay your driver directly in cash or personal MTN MoMo / Airtel Money upon boarding or arrival.
              </p>
            </div>

            <div className="card" style={{ border: 'none', padding: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <CheckCircle size={24} />
              </div>
              <h3 className="display-sm">Guaranteed Capacity</h3>
              <p className="body-md" style={{ marginTop: '8px' }}>
                Our segment reservation engine reserves your seat on your exact boarding & alighting stops, avoiding overcrowded stages.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CURATED PICKUP POINTS DIRECTORY */}
      <section style={{ padding: '60px 0', backgroundColor: 'var(--color-canvas-soft)' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 className="display-md">Ugandan Highway Pickup Hubs</h2>
              <p className="body-md">
                Official taxi stages, coach terminals, and regional highway boarding points.
              </p>
            </div>

            <button className="btn btn-secondary btn-md" onClick={onOpenAddStage}>
              + Suggest a New Stage
            </button>
          </div>

          <div className="grid-3">
            {towns.map((town) => (
              <div key={town.id} className="card" style={{ backgroundColor: 'var(--color-canvas)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: 700 }}>{town.name}</h4>
                  <span className="badge badge-neutral">{town.region}</span>
                </div>
                <p className="body-sm" style={{ marginBottom: '16px' }}>
                  Active transportation corridor hub connecting travelers across {town.region} Uganda.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-subtle btn-sm btn-full"
                    onClick={() => {
                      setOriginTownId(town.id);
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                  >
                    Depart from {town.name}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODALS */}
      <BookingHoldModal
        trip={selectedTripForHold}
        isOpen={Boolean(selectedTripForHold)}
        onClose={() => setSelectedTripForHold(null)}
        onBookingConfirmed={(ticket) => {
          setSelectedTripForHold(null);
          setSelectedTicketForView(ticket);
          if (user?.id) loadPassengerTickets(user.id);
        }}
        onOpenAuth={onOpenAuth}
      />

      <ETicketModal
        ticket={selectedTicketForView}
        isOpen={Boolean(selectedTicketForView)}
        onClose={() => setSelectedTicketForView(null)}
        onCancelBooking={handleCancelBooking}
        onOpenLiveTracking={() => {
          setSelectedTicketForTracking(selectedTicketForView);
          setIsLiveTrackingOpen(true);
        }}
      />

      {/* Live GPS Tracker Modal */}
      <LiveTripTrackerModal
        ticket={selectedTicketForTracking}
        isOpen={isLiveTrackingOpen}
        onClose={() => setIsLiveTrackingOpen(false)}
        userId={user?.id}
      />

      {/* Emergency Safety Contacts Modal */}
      <EmergencyContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        userId={user?.id}
      />

      {showTripAlertModal && user && (
        <TripAlertModal
          passengerId={user.id}
          towns={towns}
          initialOriginId={originTownId}
          initialDestId={destinationTownId}
          initialDate={travelDate}
          initialSeats={seats}
          onClose={() => setShowTripAlertModal(false)}
        />
      )}
    </div>
  );
};
