import React, { useState, useEffect } from 'react';
import {
  Bell, BellOff, CheckCheck, Trash2, FileText, AlertCircle,
  Clock, CheckCircle, RefreshCw, Filter
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface Notification {
  id: string;
  type: string;
  message: string;
  title: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  document?: {
    id: string;
    referenceNumber: string;
    subject: string;
    status: string;
    priority: string;
  };
  department?: {
    id: string;
    name: string;
    nameAr?: string;
  };
}

interface NotificationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

const getNotificationIcon = (type: string) => {
  switch (type.toUpperCase()) {
    case 'DOCUMENT_ASSIGNED':
      return FileText;
    case 'DOCUMENT_STATUS_CHANGED':
      return AlertCircle;
    case 'DOCUMENT_OVERDUE':
      return Clock;
    case 'SYSTEM':
      return Bell;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: string) => {
  switch (type.toUpperCase()) {
    case 'DOCUMENT_ASSIGNED':
      return 'bg-blue-100 text-blue-600';
    case 'DOCUMENT_STATUS_CHANGED':
      return 'bg-green-100 text-green-600';
    case 'DOCUMENT_OVERDUE':
      return 'bg-red-100 text-red-600';
    case 'SYSTEM':
      return 'bg-purple-100 text-purple-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<NotificationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    unreadCount: 0
  });
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [meta.page, showUnreadOnly]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/notifications', {
        params: {
          page: meta.page,
          limit: meta.limit,
          unreadOnly: showUnreadOnly
        }
      });

      const data = response.data || response;
      setNotifications(data.data || []);
      if (data.meta) {
        setMeta(data.meta);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await apiService.put(`/notifications/${notificationId}/read`);

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        )
      );

      setMeta(prev => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1)
      }));

      toast.success('Notification marked as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.put('/notifications/read-all');

      setNotifications(prev =>
        prev.map(n => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString()
        }))
      );

      setMeta(prev => ({ ...prev, unreadCount: 0 }));

      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) return;

    try {
      await apiService.delete(`/notifications/${notificationId}`);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setMeta(prev => ({
        ...prev,
        total: prev.total - 1
      }));

      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bell className="w-6 h-6 mr-2 text-primary-600" />
            Notifications
            {meta.unreadCount > 0 && (
              <span className="ml-3 px-2 py-1 text-xs font-medium bg-red-500 text-white rounded-full">
                {meta.unreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            Stay updated on your documents and assignments
          </p>
        </div>
        <button
          onClick={loadNotifications}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`flex items-center space-x-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showUnreadOnly
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{showUnreadOnly ? 'Showing Unread' : 'Show All'}</span>
            </button>
            <span className="text-sm text-gray-500">
              {meta.total} total notification{meta.total !== 1 ? 's' : ''}
            </span>
          </div>
          {meta.unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type);
            const colorClass = getNotificationColor(notification.type);

            return (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border transition-colors ${
                  notification.isRead
                    ? 'border-gray-200'
                    : 'border-primary-200 bg-primary-50/30'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-2 rounded-lg ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          {notification.document && (
                            <div className="mt-2 flex items-center text-xs text-gray-500">
                              <FileText className="w-3 h-3 mr-1" />
                              <span className="font-medium">
                                {notification.document.referenceNumber}
                              </span>
                              <span className="mx-2">•</span>
                              <span className="truncate">
                                {notification.document.subject}
                              </span>
                            </div>
                          )}
                          {notification.department && (
                            <div className="mt-2 flex items-center text-xs text-gray-500">
                              <span className="font-medium">
                                {notification.department.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                          title="Mark as read"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <BellOff className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications</h3>
            <p className="mt-1 text-sm text-gray-500">
              {showUnreadOnly
                ? 'You have no unread notifications'
                : 'You have no notifications yet'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {meta.page} of {meta.totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setMeta(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={meta.page === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setMeta(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={meta.page === meta.totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
