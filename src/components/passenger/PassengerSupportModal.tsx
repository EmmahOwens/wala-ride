import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supportService } from '../../services/supabase/SupabaseSupportService';
import type {
  SupportTicket,
  SupportMessage,
  SupportTicketPriority,
} from '../../types/domain';
import {
  LifeBuoy,
  X,
  Send,
  CheckCircle2,
  ArrowLeft,
  Ticket as TicketIcon,
} from 'lucide-react';

interface PassengerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookingId?: string | null;
  initialTripId?: string | null;
  initialBookingRef?: string | null;
}

export const PassengerSupportModal: React.FC<PassengerSupportModalProps> = ({
  isOpen,
  onClose,
  initialBookingId,
  initialTripId,
  initialBookingRef,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'thread'>('create');
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Form fields
  const [subject, setSubject] = useState(
    initialBookingRef ? `Assistance with Booking #${initialBookingRef}` : ''
  );
  const [category, setCategory] = useState<string>('general');
  const [priority, setPriority] = useState<SupportTicketPriority>('normal');
  const [description, setDescription] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadUserTickets = async () => {
    if (!user) return;
    try {
      const tickets = await supportService.getUserTickets(user.id);
      setMyTickets(tickets);
      if (tickets.length > 0 && !initialBookingRef && activeTab === 'create') {
        // If user already has tickets and didn't come from specific booking
        // we can still let them choose create or view
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUserTickets();
      if (initialBookingRef) {
        setSubject(`Assistance with Booking #${initialBookingRef}`);
        setActiveTab('create');
      }
    }
  }, [isOpen, user]);

  const loadThread = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    try {
      const details = await supportService.getTicketDetails(ticketId);
      if (details) {
        setSelectedTicket(details.ticket);
        setMessages(details.messages);
        setActiveTab('thread');
      }
    } catch (err) {
      console.error('Failed to load thread:', err);
    }
  };

  useEffect(() => {
    if (!selectedTicketId || activeTab !== 'thread') return;

    const unsub = supportService.subscribeToTicket(selectedTicketId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      unsub();
    };
  }, [selectedTicketId, activeTab]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await supportService.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        booking_id: initialBookingId || null,
        trip_id: initialTripId || null,
        user_id: user?.id || null,
      });

      if (res) {
        setSubmitSuccess(true);
        setTimeout(async () => {
          setSubmitSuccess(false);
          await loadUserTickets();
          await loadThread(res.ticket_id);
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicketId || !replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const newMsg = await supportService.sendMessage(
        selectedTicketId,
        replyText.trim(),
        user?.id
      );
      if (newMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setReplyText('');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-card" style={{ maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeTab === 'thread' && (
              <button
                className="btn-icon"
                onClick={() => setActiveTab(myTickets.length > 0 ? 'list' : 'create')}
                style={{ marginRight: '2px' }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <LifeBuoy size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {activeTab === 'thread' ? selectedTicket?.subject : 'Wala Customer Support'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {activeTab === 'thread' ? `Status: ${selectedTicket?.status}` : 'We are here to help 24/7 across all Uganda routes'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeTab !== 'thread' && myTickets.length > 0 && (
              <div style={{ display: 'flex', backgroundColor: 'var(--color-canvas)', padding: '2px', borderRadius: 'var(--radius-md)' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'create' ? '#ffffff' : 'transparent',
                    color: activeTab === 'create' ? '#000000' : 'var(--color-text-secondary)',
                  }}
                >
                  New Request
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'list' ? '#ffffff' : 'transparent',
                    color: activeTab === 'list' ? '#000000' : 'var(--color-text-secondary)',
                  }}
                >
                  My Requests ({myTickets.length})
                </button>
              </div>
            )}
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {/* TAB 1: CREATE REQUEST */}
          {activeTab === 'create' && (
            <div>
              {submitSuccess ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>Support Ticket Created!</h4>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '340px', margin: '0 auto' }}>
                    An operations agent has been notified and will respond shortly. Opening your conversation thread...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {initialBookingRef && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#1e40af',
                    }}>
                      <TicketIcon size={16} />
                      <span>Attached to Booking Ref: <strong>{initialBookingRef}</strong></span>
                    </div>
                  )}

                  <div>
                    <label className="label">Category</label>
                    <select
                      className="input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="payment_issue">Payment / Fare to Driver</option>
                      <option value="delay_cancellation">Trip Delay or Cancellation</option>
                      <option value="luggage">Luggage & Lost Property</option>
                      <option value="safety">Driver / Safety Concern</option>
                      <option value="app_bug">App Technical Issue</option>
                      <option value="general">General Inquiry</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Subject *</label>
                    <input
                      type="text"
                      required
                      placeholder="Brief summary of your inquiry..."
                      className="input"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">Priority</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['normal', 'high', 'urgent'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: priority === p ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            backgroundColor: priority === p ? '#eff6ff' : '#ffffff',
                            color: priority === p ? 'var(--color-primary)' : 'var(--color-text)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Message / Details *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Please explain what happened, including any driver name, stage, or time details..."
                      className="input"
                      style={{ resize: 'vertical' }}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting...' : 'Submit Support Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: MY TICKETS LIST */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-secondary)' }}>
                  <p>You have no previous support requests.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('create')}>
                    Create a Request
                  </button>
                </div>
              ) : (
                myTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => loadThread(t.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        {t.category}
                      </span>
                      <span className="badge" style={{
                        backgroundColor: t.status === 'resolved' ? '#dcfce7' : t.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                        color: t.status === 'resolved' ? '#166534' : t.status === 'in_progress' ? '#1e40af' : '#92400e',
                      }}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{t.subject}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Tap to view conversation &rarr;</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CONVERSATION THREAD */}
          {activeTab === 'thread' && selectedTicket && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '440px' }}>
              {/* Message scroll container */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '10px 4px',
              }}>
                {messages.map((m) => {
                  const isStaff = m.is_staff;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isStaff ? 'flex-start' : 'flex-end',
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isStaff ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '3px' }}>
                        <strong style={{ color: isStaff ? 'var(--color-primary)' : 'inherit' }}>
                          {isStaff ? 'Wala Support' : 'You'}
                        </strong>
                        {' • '}
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{
                        backgroundColor: isStaff ? '#f1f5f9' : 'var(--color-primary)',
                        color: isStaff ? '#0f172a' : '#ffffff',
                        padding: '10px 14px',
                        borderRadius: isStaff ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                        fontSize: '13px',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}>
                        {m.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply form */}
              <form
                onSubmit={handleSendReply}
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  placeholder="Reply to Wala Support..."
                  className="input"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!replyText.trim() || isSending}
                  style={{ padding: '0 16px', height: '40px' }}
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
