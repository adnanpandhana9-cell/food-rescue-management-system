import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package, Search } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function SeekerDashboardPage() {
  const { user, refreshUnreadCount } = useAuth();
  const [availableFoods, setAvailableFoods] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foodRes, reqRes, notifRes] = await Promise.all([
        api.getFoods({ available_only: 'true' }),
        api.getMyRequests(),
        api.getNotifications(),
      ]);
      setAvailableFoods((foodRes.listings || []).slice(0, 6));
      setRequests(reqRes.requests || []);
      setNotifications((notifRes.notifications || []).slice(0, 5));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmCompleted = async (distId) => {
    setError('');
    try {
      await api.updateDistributionStatus(distId, 'Completed', 'Confirmed received by Food Seeker.');
      setBanner('Food pickup confirmed as Completed!');
      await Promise.all([loadData(), refreshUnreadCount()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const activeCount = requests.filter((r) => ['Accepted', 'Distributed'].includes(r.status)).length;
  const completedCount = requests.filter((r) => r.status === 'Completed').length;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Food Seeker Dashboard</h1>
            <p>
              Welcome, <strong>{user?.organization || user?.name}</strong>. Discover available surplus food and track
              your pickup requests.
            </p>
          </div>
          <Link to="/foods" className="btn btn-primary">
            <Search size={16} /> Search All Food
          </Link>
        </div>

        {banner && <div className="alert alert-success">{banner}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
          <div className="stat-card">
            <span className="stat-label">Available Listings Nearby</span>
            <span className="stat-value" style={{ color: 'var(--primary)' }}>{availableFoods.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pending Requests</span>
            <span className="stat-value" style={{ color: 'var(--accent)' }}>{pendingCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Ready / In Distribution</span>
            <span className="stat-value" style={{ color: 'var(--info)' }}>{activeCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Completed Rescues</span>
            <span className="stat-value">{completedCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="card">Loading seeker dashboard...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Food Requests & Pickups</h2>
                <Link to="/requests" className="btn btn-secondary btn-sm">Manage All Requests</Link>
              </div>
              {requests.length === 0 ? (
                <div className="card">
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    You haven&apos;t requested any food yet. Browse available surplus food below to get started.
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Provider</th>
                        <th>Requested Qty</th>
                        <th>Pickup Location</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.slice(0, 6).map((r) => (
                        <tr key={r.id}>
                          <td>
                            <Link to={`/foods/${r.food_id}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              {r.food_name}
                            </Link>
                          </td>
                          <td>{r.provider_organization || r.provider_name}</td>
                          <td>{r.requested_quantity} {r.unit}</td>
                          <td>{r.pickup_location}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td>
                            {r.distribution_id && ['Accepted', 'Distributed'].includes(r.status) ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleConfirmCompleted(r.distribution_id)}
                              >
                                Confirm Received
                              </button>
                            ) : (
                              <Link to="/requests" className="btn btn-secondary btn-sm">View</Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>Available Food Ready to Request</h2>
              {availableFoods.length === 0 ? (
                <div className="card" style={{ color: 'var(--text-muted)' }}>No available surplus food right now.</div>
              ) : (
                <div className="grid-3">
                  {availableFoods.map((item) => (
                    <article key={item.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-role">{item.food_type}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{item.food_name}</h3>
                      <div className="meta-row">
                        <Package size={14} /> {item.remaining_quantity} {item.unit} available
                      </div>
                      <div className="meta-row">
                        <MapPin size={14} /> {item.pickup_location}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <Link to={`/foods/${item.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                          Details
                        </Link>
                        <Link to={`/foods/${item.id}/request`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                          Request
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Recent Notifications</h2>
                <Link to="/notifications" className="btn btn-secondary btn-sm">All Notifications</Link>
              </div>
              {notifications.length === 0 ? (
                <div className="card" style={{ color: 'var(--text-muted)' }}>No notifications yet.</div>
              ) : (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: n.is_read ? 'var(--bg)' : 'var(--primary-soft)',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{n.title}</div>
                      <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
