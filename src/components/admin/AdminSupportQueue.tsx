import React, { useState, useEffect } from 'react';
import { supportService } from '../../services/supabase/SupabaseSupportService';
import type {
  SupportTicket,
  SupportMessage,
  SupportTicketStatus,
  SupportTicketPriority,
} from '../../types/domain';
import {
  LifeBuoy,
  MessageSquare,
  Clock,
  CheckCircle2,
  Send,
  User,
  Phone,
  Mail,
  Car,
  Ticket as TicketIcon,
  RefreshCw,
  Search,
} from 'lucide-react';

export const AdminSupportQueue: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const data = await supportService.getAdminTickets(
        statusFilter === 'all' ? undefined : statusFilter,
        categoryFilter === 'all' ? undefined : categoryFilter
      );
      setTickets(data);
      if (selectedTicketId) {
        const found = data.find((t) => t.id === selectedTicketId);
        if (found) setSelectedTicket(found);
      } else if (data.length > 0 && !selectedTicketId) {
        // Select first ticket by default on desktop
        loadTicketDetails(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    try {
      const details = await supportService.getTicketDetails(ticketId);
      if (details) {
        setSelectedTicket(details.ticket);
        setMessages(details.messages);
      }
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter]);

  // Real-time listener for ticket updates and messages
  useEffect(() => {
    const unsubTicketUpdates = supportService.subscribeToTicketUpdates(() => {
      fetchTickets();
    });

    return () => {
      unsubTicketUpdates();
    };
  }, []);

  useEffect(() => {
    if (!selectedTicketId) return;

    const unsubMessages = supportService.subscribeToTicket(selectedTicketId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // also refresh ticket list to update last message
      fetchTickets();
    });

    return () => {
      unsubMessages();
    };
  }, [selectedTicketId]);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicketId || !replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const sentMsg = await supportService.sendMessage(selectedTicketId, replyText.trim());
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        setReplyText('');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: SupportTicketStatus) => {
    if (!selectedTicketId) return;
    setIsUpdatingStatus(true);
    try {
      const success = await supportService.updateTicketStatus(
        selectedTicketId,
        newStatus,
        undefined,
        `Status set to ${newStatus}`
      );
      if (success) {
        if (selectedTicket) {
          setSelectedTicket({ ...selectedTicket, status: newStatus });
        }
        await fetchTickets();
        await loadTicketDetails(selectedTicketId);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const quickMacros = [
    'We are checking this with the driver immediately.',
    'Thank you for reporting this. We have verified and resolved your request.',
    'Please contact us directly on WhatsApp or phone if you need immediate assistance on the road.',
    'Refund / settlement confirmed for your booking.',
  ];

  const getPriorityBadge = (priority: SupportTicketPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>URGENT</span>;
      case 'high':
        return <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412', fontWeight: 600 }}>HIGH</span>;
      case 'normal':
        return <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>NORMAL</span>;
      case 'low':
        return <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>LOW</span>;
      default:
        return <span className="badge">{priority}</span>;
    }
  };

  const getStatusBadge = (status: SupportTicketStatus) => {
    switch (status) {
      case 'open':
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Open</span>;
      case 'in_progress':
        return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>In Progress</span>;
      case 'waiting_on_user':
        return <span className="badge" style={{ backgroundColor: '#ede9fe', color: '#5b21b6' }}>Waiting on User</span>;
      case 'resolved':
        return <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600 }}>Resolved</span>;
      case 'closed':
        return <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>Closed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.customer?.name && t.customer.name.toLowerCase().includes(q)) ||
      (t.booking?.reference && t.booking.reference.toLowerCase().includes(q)) ||
      (t.trip?.route_name && t.trip.route_name.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <LifeBuoy size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Support Ticket Queue</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Live customer assistance, trip disputes, inquiries & real-time messaging
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status filter tabs */}
          <div style={{ display: 'flex', backgroundColor: 'var(--color-canvas)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            {(['all', 'open', 'in_progress', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === tab ? '#ffffff' : 'transparent',
                  color: statusFilter === tab ? '#000000' : 'var(--color-text-secondary)',
                  boxShadow: statusFilter === tab ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  textTransform: 'capitalize',
                }}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: '#ffffff',
              color: 'var(--color-text)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories</option>
            <option value="payment_issue">Payment Issue</option>
            <option value="delay_cancellation">Delay / Cancel</option>
            <option value="luggage">Luggage</option>
            <option value="safety">Safety</option>
            <option value="app_bug">App Bug</option>
            <option value="general">General</option>
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchTickets}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Ticket List + Conversation Workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 380px) 1fr',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Left Column: Tickets List */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '780px',
        }}>
          {/* Search bar */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="var(--color-text-tertiary)" />
            <input
              type="text"
              placeholder="Search by customer, subject, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                backgroundColor: 'transparent',
              }}
            />
          </div>

          {/* Ticket items scroll container */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredTickets.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <LifeBuoy size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>No tickets found</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  {statusFilter === 'all' ? 'No support tickets have been submitted.' : `No tickets with status "${statusFilter}".`}
                </p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetails(t.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                      borderLeft: isSelected ? '4px solid var(--color-primary)' : '4px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        {t.category || 'General'}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>

                    <h4 style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                      marginBottom: '4px',
                      lineHeight: 1.3,
                    }}>
                      {t.subject}
                    </h4>

                    <p style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      margin: '0 0 8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {t.last_message || t.description || 'No message content'}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        {t.customer?.name || 'Passenger'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare size={12} />
                        {t.messages_count ?? 1}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ticket Conversation Workspace */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '620px',
          maxHeight: '780px',
        }}>
          {selectedTicket ? (
            <>
              {/* Ticket Top Bar */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                backgroundColor: '#fafafa',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                      {selectedTicket.subject}
                    </h3>
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} />
                      <strong>{selectedTicket.customer?.name || 'Customer'}</strong>
                    </span>
                    {selectedTicket.customer?.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={13} />
                        <a href={`tel:${selectedTicket.customer.phone}`} style={{ color: 'inherit' }}>{selectedTicket.customer.phone}</a>
                      </span>
                    )}
                    {selectedTicket.customer?.email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={13} />
                        {selectedTicket.customer.email}
                      </span>
                    )}
                    {selectedTicket.booking?.reference && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TicketIcon size={13} color="var(--color-primary)" />
                        Ref: <strong>{selectedTicket.booking.reference}</strong>
                      </span>
                    )}
                    {selectedTicket.trip?.route_name && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Car size={13} />
                        Route: <strong>{selectedTicket.trip.route_name}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Status action buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedTicket.status !== 'in_progress' && selectedTicket.status !== 'resolved' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUpdateStatus('in_progress')}
                      disabled={isUpdatingStatus}
                    >
                      <Clock size={13} />
                      Mark In Progress
                    </button>
                  )}
                  {selectedTicket.status !== 'resolved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdateStatus('resolved')}
                      disabled={isUpdatingStatus}
                      style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                    >
                      <CheckCircle2 size={13} />
                      Resolve Ticket
                    </button>
                  )}
                  {selectedTicket.status === 'resolved' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUpdateStatus('open')}
                      disabled={isUpdatingStatus}
                    >
                      Reopen Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Thread Container */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: '#fbfbfb',
              }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0' }}>
                    <MessageSquare size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>No messages in this ticket yet.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isStaff = m.is_staff;
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isStaff ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isStaff ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '3px',
                          fontSize: '11px',
                          color: 'var(--color-text-tertiary)',
                        }}>
                          <span style={{ fontWeight: 600, color: isStaff ? 'var(--color-primary)' : '#1e293b' }}>
                            {isStaff ? 'Wala Support' : (m.sender_name || 'Customer')}
                          </span>
                          <span>•</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div style={{
                          backgroundColor: isStaff ? 'var(--color-primary)' : '#ffffff',
                          color: isStaff ? '#ffffff' : '#0f172a',
                          padding: '10px 14px',
                          borderRadius: isStaff ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          border: isStaff ? 'none' : '1px solid var(--color-border)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          fontSize: '13px',
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                        }}>
                          {m.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Macro Suggestions */}
              <div style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--color-border-subtle)',
                backgroundColor: '#ffffff',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                  Quick Reply:
                </span>
                {quickMacros.map((macro, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyText(macro)}
                    style={{
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-canvas)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '3px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      color: 'var(--color-text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    {macro.slice(0, 32)}...
                  </button>
                ))}
              </div>

              {/* Reply Composer Box */}
              <form
                onSubmit={handleSendReply}
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--color-border)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-end',
                }}
              >
                <textarea
                  rows={2}
                  placeholder="Type your response to the customer... (Enter sends)"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  style={{
                    flex: 1,
                    resize: 'none',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!replyText.trim() || isSending}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', padding: '0 16px' }}
                >
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-secondary)', padding: '40px' }}>
              <LifeBuoy size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>Select a Support Ticket</h3>
              <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '360px', margin: 0 }}>
                Choose a customer inquiry or trip dispute from the queue on the left to review the conversation and respond in real time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
