import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import {
  Users,
  Search,
  RefreshCw,
  Mail,
  Phone,
} from 'lucide-react';

interface DirectoryUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string;
  created_at: string;
  roles: string[];
  driver_profile?: {
    id: string;
    verification_status: string;
    total_trips: number;
    rating_average: number;
  } | null;
}

export const AdminUserDirectory: React.FC = () => {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'passenger' | 'admin'>('all');
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDirectory = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (pErr || !profiles) {
        setUsers([]);
        return;
      }

      // Fetch user roles
      const userIds = profiles.map((p) => p.id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Fetch driver profiles
      const { data: driverData } = await supabase
        .from('driver_profiles')
        .select('id, user_id, verification_status, total_trips, rating_average')
        .in('user_id', userIds);

      const userMap: DirectoryUser[] = profiles.map((p) => {
        const uRoles = (rolesData || [])
          .filter((r) => r.user_id === p.id)
          .map((r) => r.role);
        const dProfile = (driverData || []).find((d) => d.user_id === p.id) || null;

        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.phone,
          account_status: p.account_status || 'active',
          created_at: p.created_at,
          roles: uRoles,
          driver_profile: dProfile,
        };
      });

      setUsers(userMap);
    } catch (err) {
      console.error('Error loading user directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmAction = window.confirm(`Are you sure you want to mark this account as ${nextStatus.toUpperCase()}?`);
    if (!confirmAction) return;

    setStatusUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ account_status: nextStatus })
      .eq('id', userId);

    setStatusUpdating(null);
    if (!error) {
      setFeedback(`User status updated to ${nextStatus}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, account_status: nextStatus } : u))
      );
      setTimeout(() => setFeedback(null), 4000);
    } else {
      alert(`Error updating status: ${error.message}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || email.includes(search.toLowerCase()) || phone.includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (roleFilter === 'driver') return u.roles.includes('driver');
    if (roleFilter === 'passenger') return u.roles.includes('passenger') && !u.roles.includes('driver');
    if (roleFilter === 'admin') return u.roles.includes('admin') || u.roles.includes('support_agent');
    return true;
  });

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--color-primary)" />
            Active User & Driver Directory
          </h2>
          <p className="body-sm" style={{ color: 'var(--color-subtle)', marginTop: '2px' }}>
            Inspect registered passengers, active corridor drivers, KYC standing, and manage account statuses.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadDirectory}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: '#dcfce7',
          color: '#166534',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
        }}>
          {feedback}
        </div>
      )}

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--color-subtle)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'driver', 'passenger', 'admin'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className={`btn-pill-tab ${roleFilter === tab ? 'active' : ''}`}
              style={{ textTransform: 'capitalize' }}
            >
              {tab === 'all' ? `All (${users.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-subtle)' }}>
          Loading user records...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-subtle)' }}>
          No user profiles found matching your query.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)', textAlign: 'left', color: 'var(--color-subtle)' }}>
                <th style={{ padding: '10px 12px' }}>User</th>
                <th style={{ padding: '10px 12px' }}>Contact</th>
                <th style={{ padding: '10px 12px' }}>Assigned Roles</th>
                <th style={{ padding: '10px 12px' }}>Driver Standing</th>
                <th style={{ padding: '10px 12px' }}>Account Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}>
                        {(u.first_name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                          {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}` : 'Unnamed User'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {u.phone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-ink)' }}>
                          <Phone size={12} color="var(--color-subtle)" />
                          {u.phone}
                        </span>
                      )}
                      {u.email && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-subtle)', fontSize: '12px' }}>
                          <Mail size={12} />
                          {u.email}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor:
                              r === 'admin'
                                ? '#fee2e2'
                                : r === 'driver'
                                ? '#dcfce7'
                                : '#e0e7ff',
                            color:
                              r === 'admin'
                                ? '#991b1b'
                                : r === 'driver'
                                ? '#166534'
                                : '#3730a3',
                            textTransform: 'capitalize',
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    {u.driver_profile ? (
                      <div>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor:
                              u.driver_profile.verification_status === 'verified'
                                ? '#dcfce7'
                                : u.driver_profile.verification_status === 'pending'
                                ? '#fef3c7'
                                : '#fee2e2',
                            color:
                              u.driver_profile.verification_status === 'verified'
                                ? '#166534'
                                : u.driver_profile.verification_status === 'pending'
                                ? '#92400e'
                                : '#991b1b',
                          }}
                        >
                          {u.driver_profile.verification_status.toUpperCase()}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '4px' }}>
                          {u.driver_profile.total_trips} trips &bull; ⭐ {u.driver_profile.rating_average.toFixed(1)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-subtle)', fontSize: '12px' }}>Passenger</span>
                    )}
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: u.account_status === 'active' ? '#f0fdf4' : '#fef2f2',
                        color: u.account_status === 'active' ? '#15803d' : '#b91c1c',
                        border: `1px solid ${u.account_status === 'active' ? '#bbf7d0' : '#fecaca'}`,
                      }}
                    >
                      {u.account_status.toUpperCase()}
                    </span>
                  </td>

                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      className="btn btn-subtle btn-sm"
                      onClick={() => handleToggleStatus(u.id, u.account_status)}
                      disabled={statusUpdating === u.id}
                      style={{ fontSize: '11px' }}
                    >
                      {statusUpdating === u.id
                        ? 'Updating...'
                        : u.account_status === 'active'
                        ? 'Suspend'
                        : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
