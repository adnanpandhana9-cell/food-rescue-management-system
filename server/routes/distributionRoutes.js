import express from 'express';
import { createNotification, logActivity } from '../db.js';
import { cleanString, parsePositiveInt } from '../validation.js';

export function createDistributionRoutes(db, { requireAuth }) {
  const router = express.Router();

  // List distributions scoped to user's role (SRS 4.1.4 & DFD 4.0)
  router.get('/', requireAuth, (req, res) => {
    const baseSql = `
      SELECT d.*, f.food_name, f.food_type, f.unit,
             p.name AS provider_name, p.organization AS provider_organization, p.phone AS provider_phone,
             s.name AS seeker_name, s.organization AS seeker_organization, s.phone AS seeker_phone
      FROM distributions d
      JOIN food_listings f ON f.id = d.food_id
      JOIN users p ON p.id = d.provider_id
      JOIN users s ON s.id = d.seeker_id
    `;

    let rows;
    if (req.user.role === 'admin') {
      rows = db.prepare(`${baseSql} ORDER BY d.confirmed_at DESC`).all();
    } else if (req.user.role === 'provider') {
      rows = db.prepare(`${baseSql} WHERE d.provider_id = ? ORDER BY d.confirmed_at DESC`).all(req.user.id);
    } else {
      rows = db.prepare(`${baseSql} WHERE d.seeker_id = ? ORDER BY d.confirmed_at DESC`).all(req.user.id);
    }

    return res.json({ distributions: rows });
  });

  // Update distribution status: Accepted -> Distributed -> Completed (DFD 4.2 & 4.3)
  router.patch('/:id/status', requireAuth, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid distribution ID.' });

    const nextStatus = cleanString(req.body?.status || '', 30);
    const notes = cleanString(req.body?.notes || '', 400);

    if (!['Distributed', 'Completed'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Distribution status must be "Distributed" or "Completed".' });
    }

    const dist = db.prepare('SELECT * FROM distributions WHERE id = ?').get(id);
    if (!dist) return res.status(404).json({ error: 'Distribution record not found.' });

    const isProviderOwner = req.user.role === 'provider' && dist.provider_id === req.user.id;
    const isSeekerOwner = req.user.role === 'seeker' && dist.seeker_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isProviderOwner && !isSeekerOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to update this distribution.' });
    }

    // Seekers can confirm Completed once Distributed (or Accepted), Providers/Admins can mark Distributed or Completed
    if (nextStatus === 'Distributed' && !isProviderOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the Food Provider or Admin can mark food as Distributed.' });
    }

    if (dist.status === 'Completed') {
      return res.status(400).json({ error: 'This distribution is already Completed.' });
    }
    if (nextStatus === 'Distributed' && dist.status === 'Distributed') {
      return res.status(400).json({ error: 'This distribution is already marked as Distributed.' });
    }

    const distributedAtSql = nextStatus === 'Distributed' ? "datetime('now')" : "COALESCE(distributed_at, datetime('now'))";
    const completedAtSql = nextStatus === 'Completed' ? "datetime('now')" : 'completed_at';

    db.prepare(
      `UPDATE distributions
       SET status = ?,
           notes = CASE WHEN ? != '' THEN ? ELSE notes END,
           distributed_at = ${distributedAtSql},
           completed_at = ${completedAtSql}
       WHERE id = ?`
    ).run(nextStatus, notes, notes, id);

    // Sync food_requests status
    db.prepare(`UPDATE food_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      nextStatus,
      dist.request_id
    );

    // Sync food_listings status when no remaining quantity is left
    const listing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(dist.food_id);
    if (listing && listing.remaining_quantity === 0) {
      const openDistributions = db
        .prepare("SELECT COUNT(*) AS cnt FROM distributions WHERE food_id = ? AND status != 'Completed'")
        .get(dist.food_id);

      const nextFoodStatus =
        nextStatus === 'Completed' && openDistributions.cnt === 0 ? 'Completed' : 'Distributed';

      db.prepare(`UPDATE food_listings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        nextFoodStatus,
        dist.food_id
      );
    }

    const foodName = listing ? listing.food_name : `Listing #${dist.food_id}`;
    const notifyTarget = req.user.id === dist.provider_id ? dist.seeker_id : dist.provider_id;

    createNotification(db, {
      userId: notifyTarget,
      type: nextStatus === 'Completed' ? 'distribution_completed' : 'food_distributed',
      title: `Food ${nextStatus}`,
      message: `Distribution for "${foodName}" (${dist.quantity_distributed} units) is now marked as ${nextStatus}.`,
      relatedType: 'distribution',
      relatedId: id,
    });

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `DISTRIBUTION_${nextStatus.toUpperCase()}`,
      entityType: 'distribution',
      entityId: id,
      details: `Distribution #${id} for "${foodName}" marked ${nextStatus}.`,
    });

    const updated = db.prepare('SELECT * FROM distributions WHERE id = ?').get(id);
    return res.json({ message: `Distribution marked as ${nextStatus}.`, distribution: updated });
  });

  return router;
}
