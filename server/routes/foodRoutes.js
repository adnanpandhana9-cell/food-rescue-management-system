import express from 'express';
import { logActivity } from '../db.js';
import { cleanString, parsePositiveInt, validateFoodInput } from '../validation.js';

export function createFoodRoutes(db, { requireAuth, requireRole }) {
  const router = express.Router();

  // Public summary stats for Home Page
  router.get('/stats/summary', (_req, res) => {
    const counts = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM food_listings WHERE is_active = 1 AND status IN ('Available', 'Requested') AND remaining_quantity > 0) AS available_listings,
          (SELECT COALESCE(SUM(remaining_quantity), 0) FROM food_listings WHERE is_active = 1 AND status IN ('Available', 'Requested')) AS available_portions,
          (SELECT COUNT(*) FROM distributions WHERE status = 'Completed') AS completed_rescues,
          (SELECT COALESCE(SUM(quantity_distributed), 0) FROM distributions WHERE status IN ('Distributed', 'Completed')) AS portions_rescued,
          (SELECT COUNT(*) FROM users WHERE role = 'provider' AND is_active = 1) AS active_providers,
          (SELECT COUNT(*) FROM users WHERE role = 'seeker' AND is_active = 1) AS active_seekers`
      )
      .get();
    return res.json(counts);
  });

  // Browse & search food listings (SRS 4.1.2 & 4.1.3)
  router.get('/', (req, res) => {
    const search = cleanString(req.query.search || '', 100).toLowerCase();
    const foodType = cleanString(req.query.food_type || '', 50);
    const location = cleanString(req.query.location || '', 100).toLowerCase();
    const status = cleanString(req.query.status || '', 30);
    const availableOnly = req.query.available_only === 'true';

    const clauses = ['f.is_active = 1'];
    const params = [];

    if (search) {
      clauses.push(
        '(lower(f.food_name) LIKE ? OR lower(f.description) LIKE ? OR lower(f.pickup_location) LIKE ? OR lower(f.dietary_tags) LIKE ? OR lower(u.organization) LIKE ?)'
      );
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (foodType && foodType !== 'All') {
      clauses.push('f.food_type = ?');
      params.push(foodType);
    }

    if (location) {
      clauses.push('lower(f.pickup_location) LIKE ?');
      params.push(`%${location}%`);
    }

    if (status && status !== 'All') {
      clauses.push('f.status = ?');
      params.push(status);
    }

    if (availableOnly) {
      clauses.push("f.status IN ('Available', 'Requested') AND f.remaining_quantity > 0");
    }

    const sql = `
      SELECT f.*, u.name AS provider_name, u.organization AS provider_organization, u.phone AS provider_phone
      FROM food_listings f
      JOIN users u ON u.id = f.provider_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY
        CASE f.status
          WHEN 'Available' THEN 1
          WHEN 'Requested' THEN 2
          WHEN 'Accepted' THEN 3
          WHEN 'Distributed' THEN 4
          WHEN 'Completed' THEN 5
          ELSE 6
        END,
        f.created_at DESC
    `;

    const listings = db.prepare(sql).all(...params);
    return res.json({ listings });
  });

  // Provider's own food listings (must be defined before /:id)
  router.get('/my/listings', requireAuth, requireRole('provider', 'admin'), (req, res) => {
    const query =
      req.user.role === 'admin'
        ? `SELECT f.*, u.name AS provider_name, u.organization AS provider_organization,
                  (SELECT COUNT(*) FROM food_requests r WHERE r.food_id = f.id AND r.status = 'Pending') AS pending_requests_count
           FROM food_listings f
           JOIN users u ON u.id = f.provider_id
           ORDER BY f.created_at DESC`
        : `SELECT f.*, u.name AS provider_name, u.organization AS provider_organization,
                  (SELECT COUNT(*) FROM food_requests r WHERE r.food_id = f.id AND r.status = 'Pending') AS pending_requests_count
           FROM food_listings f
           JOIN users u ON u.id = f.provider_id
           WHERE f.provider_id = ?
           ORDER BY f.created_at DESC`;

    const listings = req.user.role === 'admin' ? db.prepare(query).all() : db.prepare(query).all(req.user.id);
    return res.json({ listings });
  });

  // Get single food listing details (SRS 4.1.3)
  router.get('/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid food listing ID.' });

    const listing = db
      .prepare(
        `SELECT f.*, u.name AS provider_name, u.organization AS provider_organization,
                u.phone AS provider_phone, u.email AS provider_email, u.address AS provider_address
         FROM food_listings f
         JOIN users u ON u.id = f.provider_id
         WHERE f.id = ?`
      )
      .get(id);

    if (!listing) {
      return res.status(404).json({ error: 'Food listing not found.' });
    }

    const requestSummary = db
      .prepare(
        `SELECT COUNT(*) AS total_requests,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_requests,
                SUM(CASE WHEN status IN ('Accepted', 'Distributed', 'Completed') THEN 1 ELSE 0 END) AS fulfilled_requests
         FROM food_requests WHERE food_id = ?`
      )
      .get(id);

    return res.json({ listing, requestSummary });
  });

  // Add surplus food listing (SRS 4.1.2 & DFD 2.1)
  router.post('/', requireAuth, requireRole('provider', 'admin'), (req, res) => {
    const { errors, data } = validateFoodInput(req.body || {}, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const result = db
      .prepare(
        `INSERT INTO food_listings (
          provider_id, food_name, food_type, quantity, remaining_quantity, unit,
          description, pickup_location, available_from, available_until, dietary_tags, status, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 1)`
      )
      .run(
        req.user.id,
        data.food_name,
        data.food_type,
        data.quantity,
        data.quantity,
        data.unit,
        data.description,
        data.pickup_location,
        data.available_from,
        data.available_until,
        data.dietary_tags
      );

    const listing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(result.lastInsertRowid);

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FOOD_LISTING_ADDED',
      entityType: 'food',
      entityId: listing.id,
      details: `${req.user.username} added "${listing.food_name}" (${listing.quantity} ${listing.unit}).`,
    });

    return res.status(201).json({ message: 'Food listing added successfully.', listing });
  });

  // Edit food listing (SRS 4.1.2 & DFD 2.2)
  router.put('/:id', requireAuth, requireRole('provider', 'admin'), (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid food listing ID.' });

    const existing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Food listing not found.' });

    if (req.user.role !== 'admin' && existing.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own food listings.' });
    }

    const { errors, data } = validateFoodInput(req.body || {}, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const allocatedQty = Math.max(0, existing.quantity - existing.remaining_quantity);
    const nextQty = data.quantity ?? existing.quantity;
    if (nextQty < allocatedQty) {
      return res.status(400).json({
        error: `Quantity cannot be less than already accepted quantity (${allocatedQty} ${existing.unit}).`,
      });
    }
    const nextRemaining = Math.round((nextQty - allocatedQty) * 100) / 100;

    let nextStatus = existing.status;
    if (existing.is_active && nextRemaining > 0 && existing.status === 'Completed') {
      nextStatus = 'Available';
    }

    db.prepare(
      `UPDATE food_listings
       SET food_name = ?, food_type = ?, quantity = ?, remaining_quantity = ?, unit = ?,
           description = ?, pickup_location = ?, available_from = ?, available_until = ?,
           dietary_tags = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      data.food_name ?? existing.food_name,
      data.food_type ?? existing.food_type,
      nextQty,
      nextRemaining,
      data.unit ?? existing.unit,
      data.description ?? existing.description,
      data.pickup_location ?? existing.pickup_location,
      data.available_from ?? existing.available_from,
      data.available_until ?? existing.available_until,
      data.dietary_tags ?? existing.dietary_tags,
      nextStatus,
      id
    );

    const updated = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(id);

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FOOD_LISTING_UPDATED',
      entityType: 'food',
      entityId: id,
      details: `${req.user.username} updated "${updated.food_name}".`,
    });

    return res.json({ message: 'Food listing updated successfully.', listing: updated });
  });

  // Deactivate / remove food listing (SRS 4.1.2 & DFD 2.3)
  function deactivateHandler(req, res) {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid food listing ID.' });

    const existing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Food listing not found.' });

    if (req.user.role !== 'admin' && existing.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only remove or deactivate your own food listings.' });
    }

    db.prepare(
      `UPDATE food_listings
       SET is_active = 0, status = 'Deactivated', updated_at = datetime('now')
       WHERE id = ?`
    ).run(id);

    // Reject any pending requests for this deactivated listing
    db.prepare(
      `UPDATE food_requests
       SET status = 'Rejected', rejection_reason = 'Food listing was deactivated by the provider.', updated_at = datetime('now')
       WHERE food_id = ? AND status = 'Pending'`
    ).run(id);

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FOOD_LISTING_DEACTIVATED',
      entityType: 'food',
      entityId: id,
      details: `${req.user.username} deactivated "${existing.food_name}".`,
    });

    return res.json({ message: 'Food listing deactivated successfully.' });
  }

  router.patch('/:id/deactivate', requireAuth, requireRole('provider', 'admin'), deactivateHandler);
  router.delete('/:id', requireAuth, requireRole('provider', 'admin'), deactivateHandler);

  return router;
}
