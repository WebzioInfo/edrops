export enum NotificationChannel {
  SLACK = 'SLACK',
  SOCKET = 'SOCKET',
  DATABASE = 'DATABASE',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  WHATSAPP = 'WHATSAPP',
}

export interface NotificationPayload {
  id?: string;
  type: string;
  title: string;
  message: string;
  recipients?: {
    userId?: string;
    email?: string;
    phone?: string;
    fcmToken?: string;
    socketRoom?: string; // For broadcasting to a room
  };
  channels: NotificationChannel[];
  data?: any;
}

export interface INotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
}
