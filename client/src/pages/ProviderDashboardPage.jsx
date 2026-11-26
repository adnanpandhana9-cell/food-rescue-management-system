import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Edit3, Plus, Trash2, Truck, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { FoodFormModal } from '../components/FoodFormModal.jsx';

export function ProviderDashboardPage() {
  const { user, refreshUnreadCount } = useAuth();
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foodRes, reqRes, distRes] = await Promise.all([
        api.getMyFoods(),
        api.getIncomingRequests(),
        api.getDistributions(),
      ]);
      setListings(foodRes.listings || []);
      setRequests(reqRes.requests || []);
      setDistributions(distRes.distributions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveFood = async (payload) => {
    if (editTarget) {
      await api.updateFood(editTarget.id, payload);
      setBanner('Food listing updated.');
    } else {
      await api.createFood(payload);
      setBanner('New surplus food listing added.');
    }
    setModalOpen(false);
    setEditTarget(null);
    loadData();
  };

  const handleDeactivate = async (item) => {
    if (!window.confirm(`Deactivate "${item.food_name}"?`)) return;
    setError('');
    try {
      await api.deactivateFood(item.id);
      setBanner(`"${item.food_name}" deactivated.`);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRespond = async (reqId, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Optional rejection reason:') || '';
    }
    setError('');
    try {
      await api.respondToRequest(reqId, action, reason);
      setBanner(`Request ${action === 'accept' ? 'accepted' : 'rejected'} successfully.`);
      await Promise.all([loadData(), refreshUnreadCount()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDistStatus = async (distId, status) => {
    setError('');
    try {
      await api.updateDistributionStatus(distId, status);
      setBanner(`Distribution marked as ${status}.`);
      await Promise.all([loadData(), refreshUnreadCount()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'Pending');
  const activeListings = listings.filter((f) => f.is_active && ['Available', 'Requested'].includes(f.status));
  const completedRescues = distributions.filter((d) => d.status === 'Completed');

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Food Provider Dashboard</h1>
            <p>
              Welcome back, <strong>{user?.organization || user?.name}</strong>. Manage surplus listings, incoming
              requests, and distributions.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditTarget(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Surplus Food
          </button>
        </div>

        {banner && <div className="alert alert-success">{banner}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
          <div className="stat-card">
            <span className="stat-label">Total Listings</span>
            <span className="stat-value">{listings.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active Available</span>
            <span className="stat-value" style={{ color: 'var(--primary)' }}>{activeListings.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pending Requests</span>
            <span className="stat-value" style={{ color: 'var(--accent)' }}>{pendingRequests.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Completed Rescues</span>
            <span className="stat-value">{completedRescues.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="card">Loading dashboard...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Incoming Food Requests</h2>
                <Link to="/requests" className="btn btn-secondary btn-sm">Open Request Manager</Link>
              </div>
              {pendingRequests.length === 0 ? (
                <div className="card" style={{ color: 'var(--text-muted)' }}>No pending requests right now.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Food Seeker</th>
                        <th>Requested Qty</th>
                        <th>Pickup Note</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.food_name}</strong>
                          </td>
                          <td>
                            <div>{r.seeker_organization || r.seeker_name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.seeker_phone}</div>
                          </td>
                          <td>
                            {r.requested_quantity} {r.unit}
                          </td>
                          <td>{r.message || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.45rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleRespond(r.id, 'accept')}
                              >
                                <Check size={14} /> Accept
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRespond(r.id, 'reject')}
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>Active Distributions</h2>
              {distributions.filter((d) => d.status !== 'Completed').length === 0 ? (
                <div className="card" style={{ color: 'var(--text-muted)' }}>No active distributions in progress.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Seeker</th>
                        <th>Quantity</th>
                        <th>Status</th>
                        <th>Update Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributions
                        .filter((d) => d.status !== 'Completed')
                        .map((d) => (
                          <tr key={d.id}>
                            <td><strong>{d.food_name}</strong></td>
                            <td>{d.seeker_organization || d.seeker_name}</td>
                            <td>{d.quantity_distributed} {d.unit}</td>
                            <td><StatusBadge status={d.status} /></td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                {d.status === 'Accepted' && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleDistStatus(d.id, 'Distributed')}
                                  >
                                    <Truck size={14} /> Mark Distributed
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleDistStatus(d.id, 'Completed')}
                                >
                                  <Check size={14} /> Mark Completed
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>My Food Listings</h2>
              {listings.length === 0 ? (
                <div className="card">
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    You haven&apos;t added any surplus food listings yet.
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Food Name</th>
                        <th>Type</th>
                        <th>Remaining / Total</th>
                        <th>Pickup Location</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <Link to={`/foods/${item.id}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              {item.food_name}
                            </Link>
                          </td>
                          <td>{item.food_type}</td>
                          <td>
                            {item.remaining_quantity} / {item.quantity} {item.unit}
                          </td>
                          <td>{item.pickup_location}</td>
                          <td><StatusBadge status={item.status} /></td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {item.is_active === 1 && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setEditTarget(item);
                                      setModalOpen(true);
                                    }}
                                  >
                                    <Edit3 size={14} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeactivate(item)}
                                  >
                                    <Trash2 size={14} /> Deactivate
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {modalOpen && (
          <FoodFormModal
            initialData={editTarget}
            onClose={() => {
              setModalOpen(false);
              setEditTarget(null);
            }}
            onSubmit={handleSaveFood}
          />
        )}
      </div>
    </div>
  );
}
