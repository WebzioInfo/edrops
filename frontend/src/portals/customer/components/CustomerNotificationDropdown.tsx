import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  Truck,
  Droplets,
  CreditCard,
  AlertCircle,
  XCircle,
  Package,
  RefreshCw,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { useAuth } from '../../../contexts/AuthContext';

export interface CustomerNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ';
  link?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  metadata?: any;
  createdAt: string;
}

export default function CustomerNotificationDropdown() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from server
  const loadNotifications = useCallback(async (showLoader = false) => {
    if (!user) return;
    if (showLoader) setLoading(true);
    try {
      const res = await fetchWithAuth('/notifications?limit=30');
      if (res && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(typeof res.unreadCount === 'number' ? res.unreadCount : 0);
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [user]);

  // Initial fetch and on-focus refresh
  useEffect(() => {
    loadNotifications(true);

    const handleFocus = () => {
      loadNotifications(false);
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      loadNotifications(false);
    }, 30000); // 30s background heartbeat

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [loadNotifications]);

  // Listen for realtime socket notifications
  useEffect(() => {
    if (!socket || !user) return;

    const handleIncomingEvent = () => {
      // Refresh list immediately when any relevant socket event arrives
      loadNotifications(false);
    };

    socket.on('ORDER_STATUS_CHANGED', handleIncomingEvent);
    socket.on('ORDER_PLACED', handleIncomingEvent);
    socket.on('DELIVERY_COMPLETED', handleIncomingEvent);
    socket.on('PAYMENT_SUCCESS', handleIncomingEvent);

    return () => {
      socket.off('ORDER_STATUS_CHANGED', handleIncomingEvent);
      socket.off('ORDER_PLACED', handleIncomingEvent);
      socket.off('DELIVERY_COMPLETED', handleIncomingEvent);
      socket.off('PAYMENT_SUCCESS', handleIncomingEvent);
    };
  }, [socket, user, loadNotifications]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Mark single notification as read
  const handleMarkAsRead = async (notification: CustomerNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (notification.status === 'UNREAD') {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, status: 'READ' } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetchWithAuth(`/notifications/${notification.id}/read`, {
          method: 'PATCH',
        });
      } catch (err) {
        console.warn('Failed to mark notification as read:', err);
      }
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ' })));
    setUnreadCount(0);

    try {
      await fetchWithAuth('/notifications/read-all', {
        method: 'PATCH',
      });
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
      loadNotifications(false);
    } finally {
      setMarkingAll(false);
    }
  };

  // Handle clicking a notification card
  const handleNotificationClick = async (notification: CustomerNotification) => {
    // 1. Mark as read
    await handleMarkAsRead(notification);
    setIsOpen(false);

    // 2. Navigate to relevant context
    if (notification.link) {
      navigate(notification.link);
    } else if (notification.orderId) {
      if (notification.type === 'DELIVERY_COMPLETED') {
        navigate('/customer/deliveries');
      } else {
        navigate(`/customer/orders/${notification.orderId}`);
      }
    } else if (notification.type.includes('PAYMENT') || notification.type.includes('RECHARGE')) {
      navigate('/customer/wallet');
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Categorize notifications into Today, Yesterday, Earlier
  const categorizedNotifications = React.useMemo(() => {
    const today: CustomerNotification[] = [];
    const yesterday: CustomerNotification[] = [];
    const earlier: CustomerNotification[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    notifications.forEach((item) => {
      const itemTime = new Date(item.createdAt).getTime();
      if (itemTime >= startOfToday) {
        today.push(item);
      } else if (itemTime >= startOfYesterday) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Earlier', items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [notifications]);

  // Status-specific icon & theme
  const getNotificationTheme = (type: string) => {
    switch (type) {
      case 'ORDER_PLACED':
        return {
          icon: <Package className="h-4 w-4 text-[#0284C7]" />,
          bg: 'bg-[#E0F2FE]',
        };
      case 'ORDER_ACCEPTED':
      case 'ORDER_CONFIRMED':
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-[#2563EB]" />,
          bg: 'bg-[#DBEAFE]',
        };
      case 'OUT_FOR_DELIVERY':
      case 'DELIVERY_STARTED':
        return {
          icon: <Truck className="h-4 w-4 text-[#D97706]" />,
          bg: 'bg-[#FEF3C7]',
        };
      case 'DELIVERY_COMPLETED':
        return {
          icon: <Droplets className="h-4 w-4 text-[#059669]" />,
          bg: 'bg-[#D1FAE5]',
        };
      case 'ORDER_CANCELLED':
      case 'DELIVERY_FAILED':
        return {
          icon: <XCircle className="h-4 w-4 text-[#DC2626]" />,
          bg: 'bg-[#FEE2E2]',
        };
      case 'PAYMENT_SUCCESS':
      case 'RECHARGE_SUCCESS':
        return {
          icon: <CreditCard className="h-4 w-4 text-[#059669]" />,
          bg: 'bg-[#D1FAE5]',
        };
      case 'PAYMENT_FAILED':
        return {
          icon: <AlertCircle className="h-4 w-4 text-[#DC2626]" />,
          bg: 'bg-[#FEE2E2]',
        };
      case 'PAYMENT_REFUNDED':
        return {
          icon: <RefreshCw className="h-4 w-4 text-[#7C3AED]" />,
          bg: 'bg-[#EDE9FE]',
        };
      default:
        return {
          icon: <Bell className="h-4 w-4 text-[#0284C7]" />,
          bg: 'bg-[#E0F2FE]',
        };
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications(false);
        }}
        aria-label="Notifications"
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-[#EBF5FB] text-[#0284C7]'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0284C7]'
        }`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-[#EF4444] text-[10.5px] font-bold text-white shadow-sm border-2 border-white animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Modern Notification Center Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-x-3 top-[76px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[410px] rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden z-50 flex flex-col max-h-[85vh] sm:max-h-[580px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9] bg-[#FFFFFF]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#0F172A] tracking-tight">Notifications</span>
                {unreadCount > 0 ? (
                  <span className="text-[11px] font-semibold bg-[#E0F2FE] text-[#0284C7] px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-[#94A3B8]">All caught up</span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:text-[#0369A1] transition-colors cursor-pointer py-1 px-2 rounded-md hover:bg-[#F0F9FF]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Mark all as read</span>
                </button>
              )}
            </div>

            {/* Notification List Body */}
            <div className="overflow-y-auto flex-1 divide-y divide-[#F1F5F9]">
              {loading && notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#94A3B8]">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#0284C7]" />
                  <span className="text-xs font-medium">Loading notifications...</span>
                </div>
              ) : categorizedNotifications.length === 0 ? (
                /* Clean Empty State */
                <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                  <div className="h-14 w-14 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center text-[#0284C7] mb-3 shadow-sm">
                    <Bell className="h-7 w-7 opacity-80" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#0F172A] mb-1">No notifications yet</h4>
                  <p className="text-xs text-[#64748B] max-w-[240px] leading-relaxed">
                    You'll see real-time updates here when your water jars are scheduled, out for delivery, or delivered.
                  </p>
                </div>
              ) : (
                /* Grouped Categorized Notifications */
                categorizedNotifications.map((group) => (
                  <div key={group.label} className="py-1.5">
                    {/* Section Label */}
                    <div className="px-5 py-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]/80">
                      {group.label}
                    </div>

                    <div className="divide-y divide-[#F8FAFC]">
                      {group.items.map((notification) => {
                        const theme = getNotificationTheme(notification.type);
                        const isUnread = notification.status === 'UNREAD';

                        return (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`group relative flex items-start gap-3.5 px-5 py-3.5 cursor-pointer transition-all ${
                              isUnread
                                ? 'bg-[#F0F9FF]/70 hover:bg-[#F0F9FF]'
                                : 'bg-white hover:bg-[#F8FAFC]'
                            }`}
                          >
                            {/* Unread Left Border Highlight */}
                            {isUnread && (
                              <span className="absolute left-0 inset-y-1 w-1 rounded-r-full bg-[#0284C7]" />
                            )}

                            {/* Left Status Icon */}
                            <div
                              className={`h-9 w-9 shrink-0 rounded-xl ${theme.bg} flex items-center justify-center shadow-xs mt-0.5`}
                            >
                              {theme.icon}
                            </div>

                            {/* Center Content */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span
                                  className={`text-[13px] leading-snug truncate ${
                                    isUnread
                                      ? 'font-bold text-[#0F172A]'
                                      : 'font-semibold text-[#334155]'
                                  }`}
                                >
                                  {notification.title}
                                </span>

                                <span className="text-[11px] font-medium text-[#94A3B8] shrink-0">
                                  {formatTimeAgo(notification.createdAt)}
                                </span>
                              </div>

                              <p
                                className={`text-xs leading-relaxed line-clamp-2 ${
                                  isUnread ? 'text-[#334155]' : 'text-[#64748B]'
                                }`}
                              >
                                {notification.message}
                              </p>

                              {/* Order Reference Pill & Actions */}
                              <div className="flex items-center gap-2 mt-2">
                                {notification.orderNumber && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E2E8F0]/70 text-[#475569] text-[10.5px] font-semibold tracking-wide">
                                    <Package className="h-3 w-3 text-[#64748B]" />
                                    {notification.orderNumber}
                                  </span>
                                )}

                                {notification.link && (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#0284C7] group-hover:underline">
                                    <span>View details</span>
                                    <ChevronRight className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Unread indicator dot */}
                            {isUnread && (
                              <div className="mt-2 shrink-0">
                                <span
                                  className="block h-2 w-2 rounded-full bg-[#0284C7] ring-4 ring-[#E0F2FE]"
                                  title="Unread"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Quick Navigation */}
            <div className="px-5 py-2.5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/customer/deliveries');
                }}
                className="text-[#64748B] hover:text-[#0284C7] font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Track Deliveries</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/customer/orders');
                }}
                className="text-[#64748B] hover:text-[#0284C7] font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>All Orders</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
