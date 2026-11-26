import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.js';

/**
 * Initialize SQLite Data Layer representing D1-D5 from the SRS & DFD:
 * D1: User Database (users)
 * D2: Food Database (food_listings)
 * D3: Request Database (food_requests)
 * D4: Distribution Database (distributions)
 * D5: Records & Notifications Database (notifications, activity_records)
 */
export function initDatabase(dbPath = path.join(process.cwd(), 'data', 'frms.db')) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('provider', 'seeker', 'admin')),
      organization TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      food_name TEXT NOT NULL,
      food_type TEXT NOT NULL,
      quantity REAL NOT NULL CHECK(quantity > 0),
      remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
      unit TEXT NOT NULL DEFAULT 'portions',
      description TEXT NOT NULL,
      pickup_location TEXT NOT NULL,
      available_from TEXT NOT NULL,
      available_until TEXT NOT NULL,
      dietary_tags TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Available'
        CHECK(status IN ('Available', 'Requested', 'Accepted', 'Distributed', 'Completed', 'Deactivated')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
      seeker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_quantity REAL NOT NULL CHECK(requested_quantity > 0),
      pickup_time TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending'
        CHECK(status IN ('Pending', 'Accepted', 'Rejected', 'Distributed', 'Completed', 'Cancelled')),
      rejection_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL UNIQUE REFERENCES food_requests(id) ON DELETE CASCADE,
      food_id INTEGER NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seeker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quantity_distributed REAL NOT NULL CHECK(quantity_distributed > 0),
      pickup_location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Accepted'
        CHECK(status IN ('Accepted', 'Distributed', 'Completed')),
      notes TEXT DEFAULT '',
      confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
      distributed_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_type TEXT DEFAULT '',
      related_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_role TEXT DEFAULT 'system',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_food_status ON food_listings(status, is_active);
    CREATE INDEX IF NOT EXISTS idx_food_provider ON food_listings(provider_id);
    CREATE INDEX IF NOT EXISTS idx_req_seeker ON food_requests(seeker_id);
    CREATE INDEX IF NOT EXISTS idx_req_provider ON food_requests(provider_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
  `);

  return db;
}

/**
 * Helper to create a notification for a user.
 */
export function createNotification(db, { userId, type, title, message, relatedType = '', relatedId = null }) {
  return db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, message, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, type, title, message, relatedType, relatedId);
}

/**
 * Helper to log system activity into D5 Records Database.
 */
export function logActivity(db, { actorId = null, actorRole = 'system', action, entityType, entityId = null, details = '' }) {
  return db
    .prepare(
      `INSERT INTO activity_records (actor_id, actor_role, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(actorId, actorRole, action, entityType, entityId, details);
}

/**
 * Seed realistic initial data if the database is empty so the application works out-of-the-box.
 */
export function seedDatabase(db) {
  const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (existingUsers.count > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (name, username, email, password_hash, role, organization, phone, address, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const provider1 = insertUser.run(
    'Green Harvest Bistro',
    'greenharvest',
    'provider@frms.org',
    hashPassword('Provider@123'),
    'provider',
    'Green Harvest Bistro & Catering',
    '+91-98260-11223',
    '14 MG Road, Indore, MP'
  ).lastInsertRowid;

  const provider2 = insertUser.run(
    'Sunrise Bakery & Cafe',
    'sunrisebakery',
    'bakery@frms.org',
    hashPassword('Provider@123'),
    'provider',
    'Sunrise Artisan Bakery',
    '+91-98260-44556',
    '88 Vijay Nagar, Indore, MP'
  ).lastInsertRowid;

  const seeker1 = insertUser.run(
    'Hope Community Shelter',
    'hopeshelter',
    'seeker@frms.org',
    hashPassword('Seeker@123'),
    'seeker',
    'Hope Welfare Foundation NGO',
    '+91-98260-77889',
    '22 Rajwada Sector, Indore, MP'
  ).lastInsertRowid;

  const seeker2 = insertUser.run(
    'Asha Meal Drive',
    'ashadrive',
    'asha@frms.org',
    hashPassword('Seeker@123'),
    'seeker',
    'Asha Charitable Trust',
    '+91-98260-99001',
    '5 Bhawarkua Square, Indore, MP'
  ).lastInsertRowid;

  const admin1 = insertUser.run(
    'System Administrator',
    'admin',
    'admin@frms.org',
    hashPassword('Admin@123'),
    'admin',
    'FRMS Operations Center',
    '+91-98260-00001',
    'Medi-Caps Innovation Hub, Indore, MP'
  ).lastInsertRowid;

  const now = new Date();
  const plusHours = (h) => new Date(now.getTime() + h * 3600 * 1000).toISOString().slice(0, 16);
  const minusHours = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString().slice(0, 16);

  const insertFood = db.prepare(`
    INSERT INTO food_listings (
      provider_id, food_name, food_type, quantity, remaining_quantity, unit,
      description, pickup_location, available_from, available_until, dietary_tags, status, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const food1 = insertFood.run(
    provider1,
    'Vegetable Biryani & Dal Tadka Trays',
    'Cooked Meals',
    45,
    45,
    'meals',
    'Freshly prepared surplus vegetarian biryani and dal tadka from lunch buffet, packed in food-grade insulated containers.',
    '14 MG Road, Indore (Back Kitchen Gate)',
    plusHours(0),
    plusHours(5),
    'Vegetarian, Freshly Cooked, Hygienic',
    'Available'
  ).lastInsertRowid;

  const food2 = insertFood.run(
    provider2,
    'Assorted Whole Wheat Loaves & Buns',
    'Bakery & Bread',
    30,
    30,
    'packs',
    'Same-day baked multigrain loaves, dinner rolls, and plain croissants sealed in clean paper bags.',
    '88 Vijay Nagar, Indore (Front Counter)',
    plusHours(0),
    plusHours(8),
    'Vegetarian, Same-Day Baked',
    'Available'
  ).lastInsertRowid;

  const food3 = insertFood.run(
    provider1,
    'Fresh Seasonal Fruit & Salad Boxes',
    'Fresh Produce',
    25,
    10,
    'boxes',
    'Chilled cut apples, papayas, cucumbers, and seasonal greens packed in individual eco-friendly meal boxes.',
    '14 MG Road, Indore (Main Reception)',
    plusHours(0),
    plusHours(6),
    'Vegan, Gluten-Free, Chilled',
    'Requested'
  ).lastInsertRowid;

  const food4 = insertFood.run(
    provider2,
    'Packaged Milk Cartons & Yogurt Cups',
    'Dairy & Beverages',
    40,
    0,
    'units',
    'Refrigerated pasteurized milk tetra packs and sealed plain yogurt cups within best-before date.',
    '88 Vijay Nagar, Indore (Cold Storage Dock)',
    minusHours(4),
    plusHours(4),
    'Vegetarian, Refrigerated, Sealed',
    'Accepted'
  ).lastInsertRowid;

  const food5 = insertFood.run(
    provider1,
    'Corporate Conference Surplus Thali Packs',
    'Event Surplus',
    60,
    0,
    'meals',
    'Unserved hygienic vegetarian thali meal boxes from university seminar catering.',
    'Medi-Caps Campus Auditorium Gate, Indore',
    minusHours(12),
    minusHours(6),
    'Vegetarian, Sealed Containers',
    'Completed'
  ).lastInsertRowid;

  const insertReq = db.prepare(`
    INSERT INTO food_requests (food_id, seeker_id, provider_id, requested_quantity, pickup_time, message, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const reqPending = insertReq.run(
    food3,
    seeker1,
    provider1,
    15,
    plusHours(2),
    'Our shelter volunteers can pick up 15 salad boxes at 4 PM.',
    'Pending'
  ).lastInsertRowid;

  const reqAccepted = insertReq.run(
    food4,
    seeker2,
    provider2,
    40,
    plusHours(1),
    'We have an insulated van ready for dairy pickup for our evening children meal program.',
    'Accepted'
  ).lastInsertRowid;

  const reqCompleted = insertReq.run(
    food5,
    seeker1,
    provider1,
    60,
    minusHours(9),
    'Requesting all 60 thali boxes for evening community distribution.',
    'Completed'
  ).lastInsertRowid;

  const insertDist = db.prepare(`
    INSERT INTO distributions (
      request_id, food_id, provider_id, seeker_id, quantity_distributed, pickup_location, status, notes, distributed_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDist.run(
    reqAccepted,
    food4,
    provider2,
    seeker2,
    40,
    '88 Vijay Nagar, Indore (Cold Storage Dock)',
    'Accepted',
    'Approved for cold-chain pickup within 1 hour.',
    null,
    null
  );

  insertDist.run(
    reqCompleted,
    food5,
    provider1,
    seeker1,
    60,
    'Medi-Caps Campus Auditorium Gate, Indore',
    'Completed',
    'All 60 meals handed over and distributed at Hope Community Shelter.',
    minusHours(8),
    minusHours(7)
  );

  createNotification(db, {
    userId: provider1,
    type: 'request_received',
    title: 'New Food Request Received',
    message: 'Hope Community Shelter requested 15 boxes of Fresh Seasonal Fruit & Salad Boxes.',
    relatedType: 'request',
    relatedId: reqPending,
  });

  createNotification(db, {
    userId: seeker2,
    type: 'request_accepted',
    title: 'Food Request Accepted',
    message: 'Sunrise Bakery & Cafe accepted your request for 40 units of Packaged Milk Cartons & Yogurt Cups.',
    relatedType: 'request',
    relatedId: reqAccepted,
  });

  createNotification(db, {
    userId: seeker1,
    type: 'distribution_completed',
    title: 'Food Distribution Completed',
    message: 'Distribution of 60 meals of Corporate Conference Surplus Thali Packs has been completed.',
    relatedType: 'distribution',
    relatedId: reqCompleted,
  });

  logActivity(db, {
    actorId: admin1,
    actorRole: 'admin',
    action: 'SYSTEM_INITIALIZED',
    entityType: 'system',
    details: 'Initial SRS database seeded with Providers, Seekers, Admin, Food Listings, Requests, and Distributions.',
  });

  void food1;
  void food2;
}
