import express from 'express';
import { createNotification, logActivity } from '../db.js';
import { cleanString, parsePositiveInt, parsePositiveNumber } from '../validation.js';

export function createRequestRoutes(db, { requireAuth, requireRole }) {
  const router = express.Router();

  // Seeker submits a food request (SRS 4.1.3 & DFD 3.1-3.3)
  router.post('/', requireAuth, requireRole('seeker'), (req, res) => {
    const foodId = parsePositiveInt(req.body?.food_id);
    const requestedQuantity = parsePositiveNumber(req.body?.requested_quantity);
    const pickupTime = cleanString(req.body?.pickup_time || '', 60);
    const message = cleanString(req.body?.message || '', 500);

    if (!foodId) return res.status(400).json({ error: 'Valid food listing ID is required.' });
    if (requestedQuantity === null) {
      return res.status(400).json({ error: 'Requested quantity must be a positive number.' });
    }

    // DFD 3.2 Verify Request
    const listing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(foodId);
    if (!listing || !listing.is_active || listing.status === 'Deactivated') {
      return res.status(404).json({ error: 'Food listing is unavailable or deactivated.' });
    }
    if (!['Available', 'Requested'].includes(listing.status) || listing.remaining_quantity <= 0) {
      return res.status(400).json({ error: 'This food listing has already been fully claimed.' });
    }
    if (requestedQuantity > listing.remaining_quantity) {
      return res.status(400).json({
        error: `Requested quantity (${requestedQuantity}) exceeds remaining available quantity (${listing.remaining_quantity} ${listing.unit}).`,
      });
    }

    const result = db
      .prepare(
        `INSERT INTO food_requests (food_id, seeker_id, provider_id, requested_quantity, pickup_time, message, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Pending')`
      )
      .run(foodId, req.user.id, listing.provider_id, requestedQuantity, pickupTime, message);

    const requestRecord = db.prepare('SELECT * FROM food_requests WHERE id = ?').get(result.lastInsertRowid);

    // SRS 4.1.2 & 4.1.4: Update food status to Requested when requested
    if (listing.status === 'Available') {
      db.prepare(`UPDATE food_listings SET status = 'Requested', updated_at = datetime('now') WHERE id = ?`).run(
        foodId
      );
    }

    // DFD 3.3 Send to Provider + SRS 4.1.5 Notification
    createNotification(db, {
      userId: listing.provider_id,
      type: 'request_received',
      title: 'New Food Request Received',
      message: `${req.user.organization || req.user.name} requested ${requestedQuantity} ${listing.unit} of "${listing.food_name}".`,
      relatedType: 'request',
      relatedId: requestRecord.id,
    });

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FOOD_REQUEST_SUBMITTED',
      entityType: 'request',
      entityId: requestRecord.id,
      details: `${req.user.username} requested ${requestedQuantity} ${listing.unit} of "${listing.food_name}".`,
    });

    return res.status(201).json({
      message: 'Food request submitted successfully.',
      request: requestRecord,
    });
  });

  // Seeker views their own food requests (SRS 4.1.4)
  router.get('/my', requireAuth, requireRole('seeker', 'admin'), (req, res) => {
    const query = `
      SELECT r.*, f.food_name, f.food_type, f.unit, f.pickup_location, f.status AS food_status,
             u.name AS provider_name, u.organization AS provider_organization, u.phone AS provider_phone,
             d.id AS distribution_id, d.status AS distribution_status, d.distributed_at, d.completed_at
      FROM food_requests r
      JOIN food_listings f ON f.id = r.food_id
      JOIN users u ON u.id = r.provider_id
      LEFT JOIN distributions d ON d.request_id = r.id
      WHERE r.seeker_id = ?
      ORDER BY r.created_at DESC
    `;
    const requests = db.prepare(query).all(req.user.id);
    return res.json({ requests });
  });

  // Provider views incoming food requests (SRS 4.1.3)
  router.get('/incoming', requireAuth, requireRole('provider', 'admin'), (req, res) => {
    const baseSql = `
      SELECT r.*, f.food_name, f.food_type, f.unit, f.quantity AS total_food_quantity,
             f.remaining_quantity, f.pickup_location, f.status AS food_status,
             s.name AS seeker_name, s.organization AS seeker_organization, s.phone AS seeker_phone, s.email AS seeker_email,
             p.name AS provider_name, p.organization AS provider_organization,
             d.id AS distribution_id, d.status AS distribution_status, d.distributed_at, d.completed_at
      FROM food_requests r
      JOIN food_listings f ON f.id = r.food_id
      JOIN users s ON s.id = r.seeker_id
      JOIN users p ON p.id = r.provider_id
      LEFT JOIN distributions d ON d.request_id = r.id
    `;

    const requests =
      req.user.role === 'admin'
        ? db.prepare(`${baseSql} ORDER BY r.created_at DESC`).all()
        : db.prepare(`${baseSql} WHERE r.provider_id = ? ORDER BY r.created_at DESC`).all(req.user.id);

    return res.json({ requests });
  });

  // Provider accepts or rejects a food request (SRS 4.1.3, 4.1.4, DFD 3.4 & 4.1)
  router.patch('/:id/respond', requireAuth, requireRole('provider', 'admin'), (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid request ID.' });

    const action = cleanString(req.body?.action || '', 20).toLowerCase();
    const rejectionReason = cleanString(req.body?.rejection_reason || '', 300);

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be either "accept" or "reject".' });
    }

    const requestRow = db.prepare('SELECT * FROM food_requests WHERE id = ?').get(id);
    if (!requestRow) return res.status(404).json({ error: 'Food request not found.' });

    if (req.user.role !== 'admin' && requestRow.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only manage requests for your own food listings.' });
    }

    if (requestRow.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot ${action} a request with status "${requestRow.status}".` });
    }

    const listing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(requestRow.food_id);
    if (!listing) return res.status(404).json({ error: 'Associated food listing not found.' });

    if (action === 'accept') {
      if (!listing.is_active) {
        return res.status(400).json({ error: 'Cannot accept request for a deactivated food listing.' });
      }
      if (listing.remaining_quantity < requestRow.requested_quantity) {
        return res.status(400).json({
          error: `Insufficient remaining quantity (${listing.remaining_quantity} ${listing.unit}) to accept ${requestRow.requested_quantity} ${listing.unit}.`,
        });
      }

      const nextRemaining = Math.round((listing.remaining_quantity - requestRow.requested_quantity) * 100) / 100;

      db.prepare(`UPDATE food_requests SET status = 'Accepted', updated_at = datetime('now') WHERE id = ?`).run(id);

      // Determine updated food status
      let nextFoodStatus = 'Accepted';
      if (nextRemaining > 0) {
        const otherPending = db
          .prepare("SELECT COUNT(*) AS cnt FROM food_requests WHERE food_id = ? AND status = 'Pending'")
          .get(listing.id);
        nextFoodStatus = otherPending.cnt > 0 ? 'Requested' : 'Available';
      }

      db.prepare(
        `UPDATE food_listings
         SET remaining_quantity = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(nextRemaining, nextFoodStatus, listing.id);

      // DFD 4.1 Confirm Distribution -> D4 Distribution Database
      const distResult = db
        .prepare(
          `INSERT INTO distributions (request_id, food_id, provider_id, seeker_id, quantity_distributed, pickup_location, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'Accepted', ?)`
        )
        .run(
          id,
          listing.id,
          requestRow.provider_id,
          requestRow.seeker_id,
          requestRow.requested_quantity,
          listing.pickup_location,
          'Request accepted by provider. Ready for pickup/distribution.'
        );

      // SRS 4.1.5 Notify Seeker
      createNotification(db, {
        userId: requestRow.seeker_id,
        type: 'request_accepted',
        title: 'Food Request Accepted',
        message: `Your request for ${requestRow.requested_quantity} ${listing.unit} of "${listing.food_name}" has been accepted! Pickup at: ${listing.pickup_location}.`,
        relatedType: 'distribution',
        relatedId: distResult.lastInsertRowid,
      });

      logActivity(db, {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'FOOD_REQUEST_ACCEPTED',
        entityType: 'request',
        entityId: id,
        details: `Accepted request #${id} for ${requestRow.requested_quantity} ${listing.unit} of "${listing.food_name}".`,
      });

      return res.json({
        message: 'Food request accepted and distribution scheduled.',
        status: 'Accepted',
        distribution_id: distResult.lastInsertRowid,
      });
    }

    // Reject flow
    db.prepare(
      `UPDATE food_requests
       SET status = 'Rejected', rejection_reason = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(rejectionReason, id);

    const remainingPending = db
      .prepare("SELECT COUNT(*) AS cnt FROM food_requests WHERE food_id = ? AND status = 'Pending'")
      .get(listing.id);

    if (listing.is_active && listing.remaining_quantity > 0 && remainingPending.cnt === 0 && listing.status === 'Requested') {
      db.prepare(`UPDATE food_listings SET status = 'Available', updated_at = datetime('now') WHERE id = ?`).run(
        listing.id
      );
    }

    createNotification(db, {
      userId: requestRow.seeker_id,
      type: 'request_rejected',
      title: 'Food Request Rejected',
      message: `Your request for "${listing.food_name}" was declined.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      relatedType: 'request',
      relatedId: id,
    });

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FOOD_REQUEST_REJECTED',
      entityType: 'request',
      entityId: id,
      details: `Rejected request #${id} for "${listing.food_name}".`,
    });

    return res.json({ message: 'Food request rejected.', status: 'Rejected' });
  });

  // Seeker cancels their own pending request
  router.patch('/:id/cancel', requireAuth, requireRole('seeker', 'admin'), (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid request ID.' });

    const requestRow = db.prepare('SELECT * FROM food_requests WHERE id = ?').get(id);
    if (!requestRow) return res.status(404).json({ error: 'Food request not found.' });

    if (req.user.role !== 'admin' && requestRow.seeker_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own requests.' });
    }
    if (requestRow.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled.' });
    }

    db.prepare(`UPDATE food_requests SET status = 'Cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);

    const listing = db.prepare('SELECT * FROM food_listings WHERE id = ?').get(requestRow.food_id);
    if (listing && listing.is_active && listing.remaining_quantity > 0 && listing.status === 'Requested') {
      const otherPending = db
        .prepare("SELECT COUNT(*) AS cnt FROM food_requests WHERE food_id = ? AND status = 'Pending'")
        .get(listing.id);
      if (otherPending.cnt === 0) {
        db.prepare(`UPDATE food_listings SET status = 'Available', updated_at = datetime('now') WHERE id = ?`).run(
          listing.id
        );
      }
    }

    logActivity(db, {
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FOOD_REQUEST_CANCELLED',
      entityType: 'request',
      entityId: id,
      details: `${req.user.username} cancelled pending request #${id}.`,
    });

    return res.json({ message: 'Request cancelled.' });
  });

  return router;
}
