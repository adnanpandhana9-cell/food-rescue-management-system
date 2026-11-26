import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function NotificationsPage() {
  const { refreshUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      await refreshUnreadCount();
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id) => {
    await api.markNotificationRead(id);
    loadNotifications();
  };

  const handleMarkAll = async () => {
    await api.markAllNotificationsRead();
    loadNotifications();
  };

  const displayed = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '820px' }}>
        <div className="page-header">
          <div>
            <h1>Notifications</h1>
            <p>Real-time alerts for food requests, approvals, rejections, and distributions.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleMarkAll}>
            <CheckCheck size={16} /> Mark All Read
          </button>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({notifications.filter((n) => !n.is_read).length})
          </button>
        </div>

        {loading ? (
          <div className="card">Loading notifications...</div>
        ) : displayed.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <Bell size={28} color="var(--text-muted)" />
            <p style={{ color: 'var(--text-muted)' }}>No notifications in this view.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayed.map((n) => (
              <div
                key={n.id}
                className="card"
                style={{
                  borderLeft: n.is_read ? '1px solid var(--border)' : '4px solid var(--primary)',
                  background: n.is_read ? 'var(--surface)' : '#f4fbf7',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{n.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: '0.25rem 0' }}>{n.message}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{n.created_at}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <Link to="/requests" className="btn btn-secondary btn-sm">Open</Link>
                  {!n.is_read && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleMarkRead(n.id)}>
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
