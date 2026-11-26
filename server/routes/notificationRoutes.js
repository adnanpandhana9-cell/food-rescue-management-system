import express from 'express';
import { parsePositiveInt } from '../validation.js';

export function createNotificationRoutes(db, { requireAuth }) {
  const router = express.Router();

  // Get notifications for authenticated user (SRS 4.1.5)
  router.get('/', requireAuth, (req, res) => {
    const notifications = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100')
      .all(req.user.id);
    const unreadRow = db
      .prepare('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id);
    return res.json({ notifications, unreadCount: unreadRow.unread });
  });

  // Mark all notifications as read
  router.patch('/read-all', requireAuth, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    return res.json({ message: 'All notifications marked as read.' });
  });

  // Mark one notification as read
  router.patch('/:id/read', requireAuth, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid notification ID.' });

    const existing = db.prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Notification not found.' });

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    return res.json({ message: 'Notification marked as read.' });
  });

  return router;
}
