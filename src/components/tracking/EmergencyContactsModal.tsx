import React, { useState, useEffect } from 'react';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import type { EmergencyContact } from '../../types/domain';
import { X, Users, Phone, Plus, Trash2, ShieldCheck } from 'lucide-react';

interface EmergencyContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const EmergencyContactsModal: React.FC<EmergencyContactsModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('+256 ');
  const [relationship, setRelationship] = useState<string>('Family');
  const [adding, setAdding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = async () => {
    if (!userId) return;
    setLoading(true);
    const list = await trackingService.getEmergencyContacts(userId);
    setContacts(list);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadContacts();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('Please log in to save emergency contacts.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    setAdding(true);
    setError(null);

    const created = await trackingService.addEmergencyContact({
      userId,
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || undefined,
    });

    setAdding(false);

    if (created) {
      setName('');
      setPhone('+256 ');
      await loadContacts();
    } else {
      setError('Failed to save contact. Please verify details.');
    }
  };

  const handleDelete = async (contactId: string) => {
    if (window.confirm('Remove this emergency contact?')) {
      const ok = await trackingService.deleteEmergencyContact(contactId);
      if (ok) {
        setContacts((prev) => prev.filter((c) => c.id !== contactId));
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', padding: '28px' }}
      >
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="display-sm" style={{ margin: 0 }}>
              Safety & Emergency Contacts
            </h3>
            <p className="body-sm" style={{ margin: 0 }}>
              Trusted individuals notified if you trigger an SOS.
            </p>
          </div>
        </div>

        <div className="divider" style={{ margin: '18px 0' }} />

        {/* Existing Contacts List */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
            Saved Contacts ({contacts.length})
          </h4>

          {loading ? (
            <p className="body-sm">Loading your safety network...</p>
          ) : contacts.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '20px',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
              }}
            >
              <Users size={28} color="var(--color-mute)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>No emergency contacts saved</div>
              <p className="body-sm" style={{ marginTop: '2px', fontSize: '12px' }}>
                Add family or friends below so they receive instant tracking alerts in an emergency.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{c.name}</span>
                      {c.relationship && (
                        <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '1px 6px' }}>
                          {c.relationship}
                        </span>
                      )}
                    </div>
                    <div className="body-sm" style={{ fontSize: '12px', marginTop: '2px' }}>
                      {c.phone}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <a
                      href={`tel:${c.phone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                    >
                      <Phone size={12} />
                    </a>
                    <button
                      className="btn btn-subtle btn-sm"
                      style={{ color: '#dc2626', padding: '6px 10px' }}
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Contact Form */}
        <form
          onSubmit={handleAdd}
          style={{
            backgroundColor: 'var(--color-canvas-soft)',
            padding: '18px',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Trusted Contact
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '10px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sarah Namubiru"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>Relationship</label>
              <select
                className="form-select"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                <option value="Parent">Parent</option>
                <option value="Spouse">Spouse</option>
                <option value="Sibling">Sibling</option>
                <option value="Friend">Friend</option>
                <option value="Colleague">Colleague</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px' }}>Phone Number (Uganda)</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+256 701 234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
            disabled={adding}
          >
            {adding ? 'Saving...' : 'Save Emergency Contact'}
          </button>
        </form>
      </div>
    </div>
  );
};
