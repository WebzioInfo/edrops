import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

export interface AppNotification {
  id: string;
  orderId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/staff-notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [token]);

  useEffect(() => {
    if (user && ['STAFF', 'MANAGER', 'ADMIN'].includes(user.role)) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (data: { notification: AppNotification, order: any }) => {
      setNotifications(prev => {
        // Prevent duplicates
        if (prev.some(n => n.id === data.notification.id)) return prev;
        return [data.notification, ...prev];
      });

      toast(
        () => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-sm">{data.notification.title}</span>
            <span className="text-xs text-gray-600">{data.notification.message}</span>
          </div>
        ),
        { icon: '🔔', duration: 5000 }
      );

      if (soundEnabled) {
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.play().catch(e => console.warn('Audio play failed:', e));
        } catch (e) {}
      }
    };

    socket.on('NEW_ORDER', handleNewOrder);

    return () => {
      socket.off('NEW_ORDER', handleNewOrder);
    };
  }, [socket, soundEnabled]);

  const markAsRead = async (id: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${apiUrl}/staff-notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${apiUrl}/staff-notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications([]);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const unreadCount = notifications.length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        soundEnabled,
        setSoundEnabled,
        isDropdownOpen,
        setIsDropdownOpen
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
