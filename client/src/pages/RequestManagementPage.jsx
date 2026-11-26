import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, CheckCircle2, Truck, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LifecycleStepper, StatusBadge } from '../components/StatusBadge.jsx';

export function RequestManagementPage() {
  const { user, refreshUnreadCount } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(location.state?.banner || '');
  const [error, setError] = useState('');

  const isProviderOrAdmin = user?.role === 'provider' || user?.role === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, distRes] = await Promise.all([
        isProviderOrAdmin ? api.getIncomingRequests() : api.getMyRequests(),
        api.getDistributions(),
      ]);
      setRequests(reqRes.requests || []);
      setDistributions(distRes.distributions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isProviderOrAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRespond = async (id, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Optional rejection reason:') || '';
    }
    setError('');
    try {
      await api.respondToRequest(id, action, reason);
      setBanner(`Request ${action === 'accept' ? 'accepted & distribution created' : 'rejected'}.`);
      await Promise.all([loadData(), refreshUnreadCount()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this pending food request?')) return;
    setError('');
    try {
      await api.cancelRequest(id);
      setBanner('Food request cancelled.');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDistStatus = async (id, status) => {
    setError('');
    try {
      await api.updateDistributionStatus(id, status);
      setBanner(`Distribution status updated to ${status}.`);
      await Promise.all([loadData(), refreshUnreadCount()]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Request & Distribution Management</h1>
            <p>
              {isProviderOrAdmin
                ? 'Review incoming food requests, accept or reject them, and coordinate food distribution.'
                : 'Track your food requests and confirm completed distributions.'}
            </p>
          </div>
          {user?.role === 'seeker' && (
            <Link to="/foods" className="btn btn-primary">Browse Available Food</Link>
          )}
        </div>

        {banner && <div className="alert alert-success">{banner}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'requests' ? 'active' : ''}`}
            onClick={() => setTab('requests')}
          >
            Food Requests ({requests.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'distributions' ? 'active' : ''}`}
            onClick={() => setTab('distributions')}
          >
            Distributions ({distributions.length})
          </button>
        </div>

        {loading ? (
          <div className="card">Loading records...</div>
        ) : tab === 'requests' ? (
          requests.length === 0 ? (
            <div className="card" style={{ color: 'var(--text-muted)' }}>No food requests found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Food Listing</th>
                    <th>{isProviderOrAdmin ? 'Food Seeker' : 'Food Provider'}</th>
                    <th>Qty</th>
                    <th>Pickup / Message</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>
                        <Link to={`/foods/${r.food_id}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {r.food_name}
                        </Link>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.pickup_location}</div>
                      </td>
                      <td>
                        <div>
                          {isProviderOrAdmin
                            ? r.seeker_organization || r.seeker_name
                            : r.provider_organization || r.provider_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {isProviderOrAdmin ? r.seeker_phone : r.provider_phone}
                        </div>
                      </td>
                      <td>{r.requested_quantity} {r.unit}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{r.message || '—'}</div>
                        {r.rejection_reason && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                            Reason: {r.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {isProviderOrAdmin && r.status === 'Pending' && (
                            <>
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
                            </>
                          )}
                          {!isProviderOrAdmin && r.status === 'Pending' && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleCancel(r.id)}
                            >
                              Cancel
                            </button>
                          )}
                          {r.distribution_id && ['Accepted', 'Distributed'].includes(r.status) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setTab('distributions')}
                            >
                              Track Distribution
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : distributions.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)' }}>No distribution records yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {distributions.map((d) => (
              <div key={d.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span className="badge badge-role">Distribution #{d.id}</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <h3 style={{ margin: 0 }}>{d.food_name} ({d.quantity_distributed} {d.unit})</h3>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Provider: <strong>{d.provider_organization || d.provider_name}</strong> → Seeker:{' '}
                      <strong>{d.seeker_organization || d.seeker_name}</strong>
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      Pickup Location: {d.pickup_location}
                    </div>
                    {d.notes && (
                      <div style={{ fontSize: '0.86rem', marginTop: '0.35rem' }}>
                        Notes: {d.notes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isProviderOrAdmin && d.status === 'Accepted' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDistStatus(d.id, 'Distributed')}
                      >
                        <Truck size={15} /> Mark Distributed
                      </button>
                    )}
                    {d.status !== 'Completed' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDistStatus(d.id, 'Completed')}
                      >
                        <CheckCircle2 size={15} /> Mark Completed
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '0.9rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border)' }}>
                  <LifecycleStepper status={d.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
