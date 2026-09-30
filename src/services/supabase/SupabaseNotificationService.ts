import { supabase } from '../../config/supabase';
import type { INotificationService } from '../interfaces/INotificationService';
import type { AppNotification } from '../../types/domain';

export class SupabaseNotificationService implements INotificationService {
  async getUserNotifications(userId?: string, limit: number = 20): Promise<AppNotification[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_user_notifications', {
        p_user_id: userId || null,
        p_limit: limit,
      });

      if (error) {
        console.error('Error fetching notifications via RPC:', error);
        return [];
      }

      return (data || []) as AppNotification[];
    } catch (err) {
      console.error('Exception fetching notifications:', err);
      return [];
    }
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await (supabase.rpc as any)('mark_notification_read', {
        p_notification_id: notificationId,
      });

      return !error;
    } catch (err) {
      console.error('Exception marking notification as read:', err);
      return false;
    }
  }

  async markAllAsRead(userId?: string): Promise<boolean> {
    try {
      const { error } = await (supabase.rpc as any)('mark_all_notifications_read', {
        p_user_id: userId || null,
      });

      return !error;
    } catch (err) {
      console.error('Exception marking all notifications as read:', err);
      return false;
    }
  }

  subscribeToNotifications(
    userId: string,
    onNotification: (notification: AppNotification) => void
  ): () => void {
    const channelName = `notifications-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          onNotification(payload.new as AppNotification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async registerPushSubscription(subscription: any): Promise<boolean> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return false;

      const endpoint = subscription?.endpoint || (typeof subscription === 'string' ? subscription : 'https://fcm.googleapis.com/fcm/send/demo');
      const keys = subscription?.keys || { p256dh: 'mock-key', auth: 'mock-auth' };

      const { error } = await supabase.from('push_notifications').insert({
        user_id: user.id,
        endpoint,
        keys,
        user_agent: navigator.userAgent,
      });

      return !error;
    } catch (err) {
      console.error('Exception registering push subscription:', err);
      return false;
    }
  }
}

export const notificationService = new SupabaseNotificationService();
