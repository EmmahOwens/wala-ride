import React, { useState } from 'react';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import { X, Star, CheckCircle2 } from 'lucide-react';

interface TripRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId?: string;
  bookingId?: string;
  driverName?: string;
  onRatingSubmitted?: () => void;
}

export const TripRatingModal: React.FC<TripRatingModalProps> = ({
  isOpen,
  onClose,
  tripId,
  bookingId,
  driverName = 'your driver',
  onRatingSubmitted,
}) => {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const quickTags = [
    'Punctual Departure',
    'Safe & Calm Driving',
    'Clean Vehicle',
    'Polite & Respectful',
    'Luggage Handled Well',
    'Smooth Corridor Route',
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const fullComment = [
      selectedTags.length > 0 ? `Highlights: ${selectedTags.join(', ')}` : '',
      comment.trim(),
    ]
      .filter(Boolean)
      .join(' — ');

    const { success, error } = await trackingService.submitRating({
      tripId,
      bookingId,
      score,
      comment: fullComment || undefined,
    });

    setSubmitting(false);

    if (success) {
      setSubmitted(true);
      if (onRatingSubmitted) onRatingSubmitted();
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2500);
    } else {
      alert(`Could not save rating: ${error?.message || 'Error'}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', padding: '28px', textAlign: 'center' }}
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

        {submitted ? (
          <div style={{ padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#16a34a" style={{ margin: '0 auto 16px' }} />
            <h3 className="display-sm" style={{ marginBottom: '8px' }}>
              Thank You for Rating!
            </h3>
            <p className="body-md">
              Your feedback directly updates the verified rating for {driverName} and helps maintain safety across Wala Ride.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Star size={24} fill="#d97706" />
            </div>

            <h3 className="display-sm" style={{ marginBottom: '6px' }}>
              Rate Your Journey
            </h3>
            <p className="body-sm" style={{ marginBottom: '20px' }}>
              How was your experience traveling with <strong>{driverName}</strong>?
            </p>

            {/* Star Rating Selector */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    transition: 'transform 0.15s ease',
                    transform: (hoverScore || score) >= star ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoverScore(star)}
                  onMouseLeave={() => setHoverScore(0)}
                  onClick={() => setScore(star)}
                >
                  <Star
                    size={34}
                    fill={(hoverScore || score) >= star ? '#eab308' : '#e5e7eb'}
                    color={(hoverScore || score) >= star ? '#ca8a04' : '#d1d5db'}
                  />
                </button>
              ))}
            </div>

            <div style={{ fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '20px' }}>
              {score === 5 && 'Outstanding — Excellent Trip! ⭐'}
              {score === 4 && 'Good — Safe and pleasant!'}
              {score === 3 && 'Average — Okay journey'}
              {score === 2 && 'Below Expectations — Room for improvement'}
              {score === 1 && 'Unsatisfactory — Unpleasant experience'}
            </div>

            {/* Quick Feedback Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {quickTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      border: active ? '1px solid #000000' : '1px solid var(--color-hairline)',
                      backgroundColor: active ? '#000000' : 'var(--color-canvas-soft)',
                      color: active ? '#ffffff' : 'var(--color-ink)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Additional Comment */}
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '24px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>
                Additional Notes or Remarks (Optional)
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Share any details about vehicle comfort, communication, or driving..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-md"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Driver Rating'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
