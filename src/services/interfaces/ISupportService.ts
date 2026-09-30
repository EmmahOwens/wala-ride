import type {
  SupportTicket,
  SupportMessage,
  TicketDetailsResult,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../types/domain';

export interface CreateTicketParams {
  subject: string;
  description: string;
  category?: string;
  priority?: SupportTicketPriority;
  trip_id?: string | null;
  booking_id?: string | null;
  user_id?: string | null;
}

export interface ISupportService {
  createTicket(params: CreateTicketParams): Promise<{ ticket_id: string; subject: string; status: string } | null>;
  getAdminTickets(status?: string, category?: string): Promise<SupportTicket[]>;
  getUserTickets(userId?: string): Promise<SupportTicket[]>;
  getTicketDetails(ticketId: string): Promise<TicketDetailsResult | null>;
  sendMessage(
    ticketId: string,
    message: string,
    senderId?: string,
    attachmentUrl?: string
  ): Promise<SupportMessage | null>;
  updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    assignedTo?: string,
    resolutionNote?: string
  ): Promise<boolean>;
  subscribeToTicket(
    ticketId: string,
    onMessage: (message: SupportMessage) => void
  ): () => void;
  subscribeToTicketUpdates(
    onTicketChange: (ticket: Partial<SupportTicket>) => void
  ): () => void;
}
