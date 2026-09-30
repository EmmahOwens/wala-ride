import type { AppNotification } from '../../types/domain';

export interface INotificationService {
  getUserNotifications(userId?: string, limit?: number): Promise<AppNotification[]>;
  markAsRead(notificationId: string): Promise<boolean>;
  markAllAsRead(userId?: string): Promise<boolean>;
  subscribeToNotifications(
    userId: string,
    onNotification: (notification: AppNotification) => void
  ): () => void;
  registerPushSubscription(subscription: any): Promise<boolean>;
}
