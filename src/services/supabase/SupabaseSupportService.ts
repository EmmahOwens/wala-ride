import { supabase } from '../../config/supabase';
import type { ISupportService, CreateTicketParams } from '../interfaces/ISupportService';
import type {
  SupportTicket,
  SupportMessage,
  TicketDetailsResult,
  SupportTicketStatus,
} from '../../types/domain';

export class SupabaseSupportService implements ISupportService {
  async createTicket(params: CreateTicketParams): Promise<{ ticket_id: string; subject: string; status: string } | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('create_support_ticket', {
        p_subject: params.subject,
        p_description: params.description,
        p_category: params.category || 'general',
        p_priority: params.priority || 'normal',
        p_trip_id: params.trip_id || null,
        p_booking_id: params.booking_id || null,
        p_user_id: params.user_id || null,
      });

      if (error) {
        console.error('Error creating support ticket via RPC:', error);
        return null;
      }

      return data as { ticket_id: string; subject: string; status: string };
    } catch (err) {
      console.error('Exception creating support ticket:', err);
      return null;
    }
  }

  async getAdminTickets(status?: string, category?: string): Promise<SupportTicket[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_admin_support_tickets', {
        p_status: status || null,
        p_category: category || null,
      });

      if (error) {
        console.error('Error fetching admin support tickets:', error);
        return [];
      }

      return (data || []) as SupportTicket[];
    } catch (err) {
      console.error('Exception fetching admin support tickets:', err);
      return [];
    }
  }

  async getUserTickets(userId?: string): Promise<SupportTicket[]> {
    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          booking:bookings(id, booking_reference, total_seats, status),
          trip:trips(id, status, departs_at, routes(name))
        `)
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching user tickets:', error);
        return [];
      }

      return (data || []).map((t: any) => ({
        ...t,
        trip: t.trip ? {
          id: t.trip.id,
          status: t.trip.status,
          departs_at: t.trip.departs_at,
          route_name: t.trip.routes?.name || 'Corridor Trip',
        } : null,
      })) as SupportTicket[];
    } catch (err) {
      console.error('Exception fetching user tickets:', err);
      return [];
    }
  }

  async getTicketDetails(ticketId: string): Promise<TicketDetailsResult | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_ticket_details', {
        p_ticket_id: ticketId,
      });

      if (error || !data) {
        console.error('Error fetching ticket details RPC:', error);
        return null;
      }

      return data as TicketDetailsResult;
    } catch (err) {
      console.error('Exception fetching ticket details:', err);
      return null;
    }
  }

  async sendMessage(
    ticketId: string,
    message: string,
    senderId?: string,
    attachmentUrl?: string
  ): Promise<SupportMessage | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('send_ticket_reply', {
        p_ticket_id: ticketId,
        p_message: message,
        p_sender_id: senderId || null,
        p_attachment_url: attachmentUrl || null,
      });

      if (error) {
        console.error('Error sending ticket reply:', error);
        return null;
      }

      return data as SupportMessage;
    } catch (err) {
      console.error('Exception sending ticket reply:', err);
      return null;
    }
  }

  async updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    assignedTo?: string,
    resolutionNote?: string
  ): Promise<boolean> {
    try {
      const { error } = await (supabase.rpc as any)('update_ticket_status_rpc', {
        p_ticket_id: ticketId,
        p_status: status,
        p_assigned_to: assignedTo || null,
        p_resolution_note: resolutionNote || null,
      });

      if (error) {
        console.error('Error updating ticket status:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Exception updating ticket status:', err);
      return false;
    }
  }

  subscribeToTicket(
    ticketId: string,
    onMessage: (message: SupportMessage) => void
  ): () => void {
    const channelName = `ticket-messages-${ticketId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload: any) => {
          const newMsg = payload.new;
          // Fetch sender profile name for rich display
          let senderName = 'Participant';
          let isStaff = false;
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', newMsg.sender_id)
              .maybeSingle();

            if (profile) {
              senderName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Participant';
            }

            const { data: roles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', newMsg.sender_id);

            isStaff = roles?.some((r: any) => r.role === 'admin' || r.role === 'support_agent') ?? false;
          } catch (e) {
            // fallback
          }

          onMessage({
            id: newMsg.id,
            ticket_id: newMsg.ticket_id,
            sender_id: newMsg.sender_id,
            message: newMsg.message,
            attachment_url: newMsg.attachment_url,
            created_at: newMsg.created_at,
            sender_name: senderName,
            is_staff: isStaff,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  subscribeToTicketUpdates(
    onTicketChange: (ticket: Partial<SupportTicket>) => void
  ): () => void {
    const channelName = `tickets-realtime-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        (payload: any) => {
          onTicketChange(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const supportService = new SupabaseSupportService();
