import express from 'express';
import { hashPassword } from '../auth.js';
import { logActivity } from '../db.js';
import { cleanString, isValidEmail, isValidPhone, isValidUsername, parsePositiveInt } from '../validation.js';

export function createAdminRoutes(db, { requireAuth, requireRole }) {
  const router = express.Router();
  router.use(requireAuth, requireRole('admin'));

  // DFD 1.0 Manage Users: List all users
  router.get('/users', (_req, res) => {
    const users = db
      .prepare(
        `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at, updated_at
         FROM users ORDER BY created_at DESC`
      )
      .all();
    return res.json({ users });
  });

  // DFD 1.1 Register User by Admin
  router.post('/users', (req, res) => {
    const name = cleanString(req.body?.name || '', 100);
    const username = cleanString(req.body?.username || '', 32).toLowerCase();
    const email = cleanString(req.body?.email || '', 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = cleanString(req.body?.role || '', 20).toLowerCase();
    const organization = cleanString(req.body?.organization || '', 120);
    const phone = cleanString(req.body?.phone || '', 20);
    const address = cleanString(req.body?.address || '', 250);

    if (name.length < 2 || !isValidUsername(username) || !isValidEmail(email) || password.length < 6) {
      return res.status(400).json({ error: 'Valid name, username, email, and password (min 6 chars) are required.' });
    }
    if (!['provider', 'seeker', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be provider, seeker, or admin.' });
    }
    if (!isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone number.' });

    const duplicate = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (duplicate) return res.status(409).json({ error: 'Username or email already exists.' });

    const result = db
      .prepare(
        `INSERT INTO users (name, username, email, password_hash, role, organization, phone, address, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(name, username, email, hashPassword(password), role, organization, phone, address);

    const created = db
      .prepare(
        `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at
         FROM users WHERE id = ?`
      )
      .get(result.lastInsertRowid);

    logActivity(db, {
      actorId: req.user.id,
      actorRole: 'admin',
      action: 'ADMIN_USER_CREATED',
      entityType: 'user',
      entityId: created.id,
      details: `Admin created user ${created.username} (${created.role}).`,
    });

    return res.status(201).json({ message: 'User created successfully.', user: created });
  });

  // DFD 1.2 & 1.3 Update or Activate/Deactivate User
  router.patch('/users/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user ID.' });

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const nextRole = req.body?.role ? cleanString(req.body.role, 20).toLowerCase() : existing.role;
    if (!['provider', 'seeker', 'admin'].includes(nextRole)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const nextActive =
      req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

    if (id === req.user.id && nextActive === 0) {
      return res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
    }

    const nextName = req.body?.name ? cleanString(req.body.name, 100) : existing.name;
    const nextOrg = req.body?.organization !== undefined ? cleanString(req.body.organization, 120) : existing.organization;

    db.prepare(
      `UPDATE users SET name = ?, role = ?, organization = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nextName, nextRole, nextOrg, nextActive, id);

    const updated = db
      .prepare(
        `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .get(id);

    logActivity(db, {
      actorId: req.user.id,
      actorRole: 'admin',
      action: nextActive === existing.is_active ? 'ADMIN_USER_UPDATED' : nextActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
      entityType: 'user',
      entityId: id,
      details: `Admin updated ${updated.username} (active=${updated.is_active}, role=${updated.role}).`,
    });

    return res.json({ message: 'User updated successfully.', user: updated });
  });

  // DFD 5.1 View Records (Users, Food, Requests, Distributions, Activity Log)
  router.get('/records', (_req, res) => {
    const activities = db
      .prepare(
        `SELECT a.*, u.username AS actor_username
         FROM activity_records a
         LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 150`
      )
      .all();

    const listings = db
      .prepare(
        `SELECT f.*, u.name AS provider_name, u.organization AS provider_organization
         FROM food_listings f JOIN users u ON u.id = f.provider_id
         ORDER BY f.created_at DESC`
      )
      .all();

    const requests = db
      .prepare(
        `SELECT r.*, f.food_name, s.name AS seeker_name, p.name AS provider_name
         FROM food_requests r
         JOIN food_listings f ON f.id = r.food_id
         JOIN users s ON s.id = r.seeker_id
         JOIN users p ON p.id = r.provider_id
         ORDER BY r.created_at DESC`
      )
      .all();

    const distributions = db
      .prepare(
        `SELECT d.*, f.food_name, f.unit, p.name AS provider_name, s.name AS seeker_name
         FROM distributions d
         JOIN food_listings f ON f.id = d.food_id
         JOIN users p ON p.id = d.provider_id
         JOIN users s ON s.id = d.seeker_id
         ORDER BY d.confirmed_at DESC`
      )
      .all();

    return res.json({ activities, listings, requests, distributions });
  });

  // DFD 5.2 Generate Reports
  router.get('/reports', (_req, res) => {
    const userStats = db
      .prepare(
        `SELECT role, COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
         FROM users GROUP BY role`
      )
      .all();

    const foodByStatus = db
      .prepare(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(quantity), 0) AS total_quantity,
                COALESCE(SUM(remaining_quantity), 0) AS remaining_quantity
         FROM food_listings GROUP BY status`
      )
      .all();

    const foodByType = db
      .prepare(
        `SELECT food_type, COUNT(*) AS count, COALESCE(SUM(quantity), 0) AS total_quantity
         FROM food_listings GROUP BY food_type`
      )
      .all();

    const requestByStatus = db
      .prepare(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(requested_quantity), 0) AS total_requested
         FROM food_requests GROUP BY status`
      )
      .all();

    const distributionByStatus = db
      .prepare(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(quantity_distributed), 0) AS total_distributed
         FROM distributions GROUP BY status`
      )
      .all();

    return res.json({
      generated_at: new Date().toISOString(),
      userStats,
      foodByStatus,
      foodByType,
      requestByStatus,
      distributionByStatus,
    });
  });

  // SRS 4.2.3 Database Backup Export
  router.get('/backup', (req, res) => {
    const backup = {
      exported_at: new Date().toISOString(),
      exported_by: req.user.username,
      tables: {
        users: db
          .prepare('SELECT id, name, username, email, role, organization, phone, address, is_active, created_at FROM users')
          .all(),
        food_listings: db.prepare('SELECT * FROM food_listings').all(),
        food_requests: db.prepare('SELECT * FROM food_requests').all(),
        distributions: db.prepare('SELECT * FROM distributions').all(),
        notifications: db.prepare('SELECT * FROM notifications').all(),
        activity_records: db.prepare('SELECT * FROM activity_records').all(),
      },
    };

    logActivity(db, {
      actorId: req.user.id,
      actorRole: 'admin',
      action: 'DATABASE_BACKUP_EXPORTED',
      entityType: 'system',
      details: `Admin ${req.user.username} exported full database backup.`,
    });

    res.setHeader('Content-Disposition', 'attachment; filename="frms-backup.json"');
    return res.json(backup);
  });

  return router;
}
