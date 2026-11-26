import express from 'express';
import { hashPassword, verifyPassword, signToken } from '../auth.js';
import { logActivity } from '../db.js';
import {
  cleanString,
  isValidEmail,
  isValidPhone,
  isValidUsername,
  validateRegistrationInput,
} from '../validation.js';

export function createAuthRoutes(db, { requireAuth }) {
  const router = express.Router();

  // Public Registration (SRS 4.1.1 & DFD 1.1)
  router.post('/register', (req, res) => {
    const { errors, data } = validateRegistrationInput(req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const existing = db
      .prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?')
      .get(data.username, data.email);

    if (existing) {
      const conflictField = existing.email === data.email ? 'Email' : 'Username';
      return res.status(409).json({ error: `${conflictField} is already registered.` });
    }

    const passwordHash = hashPassword(data.password);
    const result = db
      .prepare(
        `INSERT INTO users (name, username, email, password_hash, role, organization, phone, address, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        data.name,
        data.username,
        data.email,
        passwordHash,
        data.role,
        data.organization,
        data.phone,
        data.address
      );

    const user = db
      .prepare(
        `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at
         FROM users WHERE id = ?`
      )
      .get(result.lastInsertRowid);

    logActivity(db, {
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      details: `${user.name} (${user.role}) registered.`,
    });

    const token = signToken(user);
    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user,
    });
  });

  // Login using username or email + password (SRS 4.1.1)
  router.post('/login', (req, res) => {
    const identifier = cleanString(req.body?.identifier || req.body?.email || req.body?.username, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const userRow = db
      .prepare('SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ?')
      .get(identifier, identifier);

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    if (!userRow.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact the administrator.' });
    }

    const { password_hash: _ignored, ...user } = userRow;
    const token = signToken(user);

    logActivity(db, {
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      details: `${user.username} logged in.`,
    });

    return res.json({
      message: 'Login successful.',
      token,
      user,
    });
  });

  // Logout (SRS 4.1.1)
  router.post('/logout', requireAuth, (req, res) => {
    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_LOGOUT',
      entityType: 'user',
      entityId: req.user.id,
      details: `${req.user.username} logged out.`,
    });
    return res.json({ message: 'Logged out successfully.' });
  });

  // Current authenticated user profile
  router.get('/me', requireAuth, (req, res) => {
    return res.json({ user: req.user });
  });

  // Update user profile (SRS 3.1 User Profile Page & DFD 1.2)
  router.put('/profile', requireAuth, (req, res) => {
    const name = cleanString(req.body?.name ?? req.user.name, 100);
    const username = cleanString(req.body?.username ?? req.user.username, 32).toLowerCase();
    const email = cleanString(req.body?.email ?? req.user.email, 120).toLowerCase();
    const organization = cleanString(req.body?.organization ?? req.user.organization, 120);
    const phone = cleanString(req.body?.phone ?? req.user.phone, 20);
    const address = cleanString(req.body?.address ?? req.user.address, 250);

    if (name.length < 2) return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 valid characters.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email is required.' });
    if (!isValidPhone(phone)) return res.status(400).json({ error: 'Phone number format is invalid.' });

    const duplicate = db
      .prepare('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?')
      .get(username, email, req.user.id);
    if (duplicate) {
      return res.status(409).json({ error: 'Username or email is already used by another account.' });
    }

    db.prepare(
      `UPDATE users
       SET name = ?, username = ?, email = ?, organization = ?, phone = ?, address = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(name, username, email, organization, phone, address, req.user.id);

    const updatedUser = db
      .prepare(
        `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .get(req.user.id);

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'PROFILE_UPDATED',
      entityType: 'user',
      entityId: req.user.id,
      details: `${updatedUser.username} updated profile information.`,
    });

    return res.json({ message: 'Profile updated successfully.', user: updatedUser });
  });

  // Change password
  router.put('/password', requireAuth, (req, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Current password and new password (min 6 chars) are required.' });
    }

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
      hashPassword(newPassword),
      req.user.id
    );

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: req.user.id,
      details: `${req.user.username} changed their password.`,
    });

    return res.json({ message: 'Password updated successfully.' });
  });

  return router;
}
