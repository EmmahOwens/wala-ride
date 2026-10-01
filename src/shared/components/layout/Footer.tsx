import React from 'react';

interface FooterProps {
  onOpenSupport?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenSupport }) => {
  return (
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
              Portals & Apps
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <a href="/" style={{ fontSize: '13px', color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Passenger App (Home)
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
            {onOpenSupport ? (
              <button
                onClick={onOpenSupport}
                style={{ background: 'none', border: 'none', color: '#888888', fontSize: '12px', cursor: 'pointer', padding: 0 }}
              >
                Support Desk
              </button>
            ) : (
              <a
                href="/?support=open"
                style={{ color: '#888888', fontSize: '12px', textDecoration: 'none' }}
              >
                Support Desk
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
