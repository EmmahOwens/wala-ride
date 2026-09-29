import React, { useState, useEffect } from 'react';
import { geographyService } from '../../services/supabase/SupabaseGeographyService';
import type { Town, PickupPoint } from '../../types/domain';
import { Search, MapPin, Calendar, Users, Shield, ArrowRight, Wallet, CheckCircle, Navigation } from 'lucide-react';

interface PassengerViewProps {
  onOpenAuth: () => void;
  onOpenAddStage: () => void;
}

export const PassengerView: React.FC<PassengerViewProps> = ({ onOpenAuth, onOpenAddStage }) => {
  const [towns, setTowns] = useState<Town[]>([]);
  const [originTownId, setOriginTownId] = useState<string>('');
  const [destinationTownId, setDestinationTownId] = useState<string>('');
  const [originStages, setOriginStages] = useState<PickupPoint[]>([]);
  const [destinationStages, setDestinationStages] = useState<PickupPoint[]>([]);
  const [selectedOriginStage, setSelectedOriginStage] = useState<string>('');
  const [selectedDestinationStage, setSelectedDestinationStage] = useState<string>('');
  const [travelDate, setTravelDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [seats, setSeats] = useState<number>(1);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

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

  const handleQuickRoute = (originName: string, destName: string) => {
    const o = towns.find((t) => t.name === originName);
    const d = towns.find((t) => t.name === destName);
    if (o && d) {
      setOriginTownId(o.id);
      setDestinationTownId(d.id);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const originTown = towns.find((t) => t.id === originTownId)?.name || 'Origin';
  const destTown = towns.find((t) => t.id === destinationTownId)?.name || 'Destination';

  return (
    <div>
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

                <button type="submit" className="btn btn-primary btn-lg">
                  <Search size={18} />
                  <span>Search Scheduled Trips</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* SEARCH RESULTS PREVIEW (Phase 1 Ready) */}
      {hasSearched && (
        <section style={{ padding: '20px 0 60px' }}>
          <div className="container">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}>
              <div>
                <h2 className="display-md">
                  Trips from {originTown} to {destTown}
                </h2>
                <p className="body-sm">
                  Showing scheduled departures for {new Date(travelDate).toLocaleDateString('en-GB', { dateStyle: 'full' })}
                </p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenAddStage}
              >
                + Add Stage in {originTown}
              </button>
            </div>

            {/* Empty Demand Alert Card */}
            <div className="card" style={{
              padding: '40px 24px',
              textAlign: 'center',
              borderStyle: 'dashed',
              backgroundColor: 'var(--color-canvas-soft)',
            }}>
              <Navigation size={40} style={{ margin: '0 auto 12px', color: 'var(--color-body)' }} />
              <h3 className="display-sm">No driver has published this route yet for today</h3>
              <p className="body-md" style={{ maxWidth: '520px', margin: '8px auto 20px' }}>
                We've logged your route search as a demand signal. Click below to save an alert so drivers running from <strong>{originTown} to {destTown}</strong> see you on their radar.
              </p>
              <button
                className="btn btn-primary btn-md"
                onClick={onOpenAuth}
              >
                Alert Me When a Driver Posts This Route
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* VALUE PROPOSITIONS & WHY WALA */}
      <section style={{ padding: '60px 0', borderTop: '1px solid var(--color-hairline)' }}>
        <div className="container">
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
    </div>
  );
};
