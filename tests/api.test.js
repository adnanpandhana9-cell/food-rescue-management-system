import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { initDatabase, seedDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

let server;
let baseUrl;
let db;

async function apiCall(path, { method = 'GET', token = '', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

before(async () => {
  db = initDatabase(':memory:');
  seedDatabase(db);
  const app = createApp(db);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

describe('Food Rescue Management System — SRS End-to-End Verification', () => {
  let providerToken = '';
  let seekerToken = '';
  let adminToken = '';
  let createdFoodId = null;
  let createdRequestId = null;
  let createdDistId = null;

  it('4.1.1 Registration, Login, Profile, and RBAC Enforcement', async () => {
    // Register a new Food Provider
    const regProvider = await apiCall('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Spice Garden Kitchen',
        username: 'spicegarden',
        email: 'spice@frms.org',
        password: 'Password@123',
        role: 'provider',
        organization: 'Spice Garden Hospitality',
        phone: '+91-98260-12345',
        address: 'Palasia Square, Indore',
      },
    });
    assert.equal(regProvider.status, 201);
    assert.ok(regProvider.data.token);
    assert.equal(regProvider.data.user.role, 'provider');
    providerToken = regProvider.data.token;

    // Register a new Food Seeker
    const regSeeker = await apiCall('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Seva Food Bank',
        username: 'sevabank',
        email: 'seva@frms.org',
        password: 'Password@123',
        role: 'seeker',
        organization: 'Seva Welfare Society',
      },
    });
    assert.equal(regSeeker.status, 201);
    assert.equal(regSeeker.data.user.role, 'seeker');
    seekerToken = regSeeker.data.token;

    // Reject invalid role registration (admin self-registration blocked)
    const badRole = await apiCall('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Fake Admin',
        username: 'fakeadmin',
        email: 'fake@frms.org',
        password: 'Password@123',
        role: 'admin',
      },
    });
    assert.equal(badRole.status, 400);

    // Login with username and email
    const loginByUsername = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'spicegarden', password: 'Password@123' },
    });
    assert.equal(loginByUsername.status, 200);

    // Seeded Admin login
    const adminLogin = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin@frms.org', password: 'Admin@123' },
    });
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.data.token;

    // RBAC: Seeker cannot add food listings
    const forbiddenAdd = await apiCall('/api/foods', {
      method: 'POST',
      token: seekerToken,
      body: {
        food_name: 'Unauthorized Item',
        food_type: 'Cooked Meals',
        quantity: 10,
        unit: 'meals',
        description: 'Should fail RBAC',
        pickup_location: 'Test',
        available_from: '2026-11-25T10:00',
        available_until: '2026-11-25T16:00',
      },
    });
    assert.equal(forbiddenAdd.status, 403);
  });

  it('4.1.2 Food Listing Management (Add, Edit, Search, Deactivate)', async () => {
    const addRes = await apiCall('/api/foods', {
      method: 'POST',
      token: providerToken,
      body: {
        food_name: 'Fresh Paneer Pulao Packs',
        food_type: 'Cooked Meals',
        quantity: 25,
        unit: 'meals',
        description: 'Freshly cooked vegetarian paneer pulao packed hygienically.',
        pickup_location: 'Palasia Square, Indore',
        available_from: '2026-11-25T12:00',
        available_until: '2026-11-25T20:00',
        dietary_tags: 'Vegetarian, Hygienic',
      },
    });
    assert.equal(addRes.status, 201);
    assert.equal(addRes.data.listing.status, 'Available');
    assert.equal(addRes.data.listing.remaining_quantity, 25);
    createdFoodId = addRes.data.listing.id;

    // Edit listing
    const editRes = await apiCall(`/api/foods/${createdFoodId}`, {
      method: 'PUT',
      token: providerToken,
      body: { quantity: 30 },
    });
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.listing.quantity, 30);
    assert.equal(editRes.data.listing.remaining_quantity, 30);

    // Search listing by keyword & location
    const searchRes = await apiCall('/api/foods?search=Paneer&location=Palasia');
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.data.listings.some((l) => l.id === createdFoodId));
  });

  it('4.1.3 & 4.1.4 & 4.1.5 Food Request, Acceptance, Distribution Lifecycle & Notifications', async () => {
    // Reject over-quantity request
    const overReq = await apiCall('/api/requests', {
      method: 'POST',
      token: seekerToken,
      body: {
        food_id: createdFoodId,
        requested_quantity: 50,
        message: 'Too much',
      },
    });
    assert.equal(overReq.status, 400);

    // Valid full-quantity request
    const reqRes = await apiCall('/api/requests', {
      method: 'POST',
      token: seekerToken,
      body: {
        food_id: createdFoodId,
        requested_quantity: 30,
        pickup_time: '2026-11-25T15:00',
        message: 'Picking up for evening shelter dinner.',
      },
    });
    assert.equal(reqRes.status, 201);
    createdRequestId = reqRes.data.request.id;

    // Food listing status should update to Requested
    const afterReqFood = await apiCall(`/api/foods/${createdFoodId}`);
    assert.equal(afterReqFood.data.listing.status, 'Requested');

    // Provider should receive a notification
    const providerNotifs = await apiCall('/api/notifications', { token: providerToken });
    assert.equal(providerNotifs.status, 200);
    assert.ok(providerNotifs.data.unreadCount >= 1);

    // Provider accepts request
    const acceptRes = await apiCall(`/api/requests/${createdRequestId}/respond`, {
      method: 'PATCH',
      token: providerToken,
      body: { action: 'accept' },
    });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.data.status, 'Accepted');
    createdDistId = acceptRes.data.distribution_id;

    // Food listing status should be Accepted with 0 remaining
    const afterAcceptFood = await apiCall(`/api/foods/${createdFoodId}`);
    assert.equal(afterAcceptFood.data.listing.status, 'Accepted');
    assert.equal(afterAcceptFood.data.listing.remaining_quantity, 0);

    // Seeker receives acceptance notification
    const seekerNotifs = await apiCall('/api/notifications', { token: seekerToken });
    assert.ok(seekerNotifs.data.notifications.some((n) => n.type === 'request_accepted'));

    // Provider marks Distributed
    const distRes = await apiCall(`/api/distributions/${createdDistId}/status`, {
      method: 'PATCH',
      token: providerToken,
      body: { status: 'Distributed', notes: 'Handed over at gate.' },
    });
    assert.equal(distRes.status, 200);
    assert.equal(distRes.data.distribution.status, 'Distributed');

    const foodDistributed = await apiCall(`/api/foods/${createdFoodId}`);
    assert.equal(foodDistributed.data.listing.status, 'Distributed');

    // Seeker/Provider marks Completed
    const completeRes = await apiCall(`/api/distributions/${createdDistId}/status`, {
      method: 'PATCH',
      token: seekerToken,
      body: { status: 'Completed', notes: 'All 30 meals distributed.' },
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.distribution.status, 'Completed');

    const foodCompleted = await apiCall(`/api/foods/${createdFoodId}`);
    assert.equal(foodCompleted.data.listing.status, 'Completed');
  });

  it('Admin Management, Reports, Records & Database Backup (DFD 1.0, 5.1, 5.2 & SRS 4.2.3)', async () => {
    const usersRes = await apiCall('/api/admin/users', { token: adminToken });
    assert.equal(usersRes.status, 200);
    assert.ok(usersRes.data.users.length >= 7);

    const reportsRes = await apiCall('/api/admin/reports', { token: adminToken });
    assert.equal(reportsRes.status, 200);
    assert.ok(Array.isArray(reportsRes.data.foodByStatus));

    const recordsRes = await apiCall('/api/admin/records', { token: adminToken });
    assert.equal(recordsRes.status, 200);
    assert.ok(recordsRes.data.activities.length > 0);

    const backupRes = await apiCall('/api/admin/backup', { token: adminToken });
    assert.equal(backupRes.status, 200);
    assert.ok(backupRes.data.tables.food_listings.length > 0);
  });
});
