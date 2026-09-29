import React, { useState, useEffect } from 'react';
import { geographyService } from '../../services/supabase/SupabaseGeographyService';
import type { Town, PickupPointKind } from '../../types/domain';
import { X, MapPin, Plus, CheckCircle2 } from 'lucide-react';

interface AddPickupPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export const AddPickupPointModal: React.FC<AddPickupPointModalProps> = ({ isOpen, onClose, onAdded }) => {
  const [towns, setTowns] = useState<Town[]>([]);
  const [selectedTownId, setSelectedTownId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [kind, setKind] = useState<PickupPointKind>('stage');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      geographyService.getTowns().then((tList) => {
        setTowns(tList);
        if (tList.length > 0 && !selectedTownId) {
          setSelectedTownId(tList[0].id);
        }
      });
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTownId || !name.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const point = await geographyService.createPickupPoint({
      town_id: selectedTownId,
      name: name.trim(),
      kind,
      description: description.trim() || undefined,
    });

    setLoading(false);
    if (point) {
      setSuccessMessage(`Pickup stage "${name.trim()}" added successfully!`);
      setName('');
      setDescription('');
      if (onAdded) onAdded();
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setErrorMessage('Could not add pickup point. It might already exist in this town.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="display-sm">Add a Pickup Point / Stage</h2>
            <p className="body-sm">Suggest a new boarding landmark or taxi stage.</p>
          </div>
        </div>

        {successMessage ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}>
            <CheckCircle2 size={40} color="var(--color-success)" />
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-success)' }}>
              {successMessage}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                fontSize: '13px',
                marginBottom: '14px',
              }}>
                {errorMessage}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Town / City</label>
              <select
                className="select-field"
                value={selectedTownId}
                onChange={(e) => setSelectedTownId(e.target.value)}
                required
              >
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.region || 'Uganda'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Stage or Landmark Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Total Stage, Kobil Roundabout"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Point Category</label>
              <select
                className="select-field"
                value={kind}
                onChange={(e) => setKind(e.target.value as PickupPointKind)}
              >
                <option value="stage">Stage (Roadside Taxi/Coaster Stage)</option>
                <option value="terminal">Bus / Taxi Terminal</option>
                <option value="landmark">Prominent Landmark / Roundabout</option>
                <option value="custom">Custom Pickup Location</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Helpful Description / Directions (Optional)</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="e.g. Near the main market gate along the highway"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || !name.trim()}
              style={{ marginTop: '16px' }}
            >
              <Plus size={16} />
              <span>{loading ? 'Adding stage...' : 'Add Pickup Point'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
