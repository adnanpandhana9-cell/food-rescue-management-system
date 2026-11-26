import React, { useCallback, useEffect, useState } from 'react';
import { Download, Shield, UserCheck, UserPlus, UserX } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function AdminDashboardPage() {
  const [tab, setTab] = useState('reports');
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState({ activities: [], listings: [], requests: [], distributions: [] });
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'provider',
    organization: '',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, recRes, repRes] = await Promise.all([
        api.getAdminUsers(),
        api.getAdminRecords(),
        api.getAdminReports(),
      ]);
      setUsers(uRes.users || []);
      setRecords(recRes);
      setReports(repRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToggleUser = async (u) => {
    setError('');
    try {
      await api.updateAdminUser(u.id, { is_active: !u.is_active });
      setBanner(`User ${u.username} ${u.is_active ? 'deactivated' : 'activated'}.`);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createAdminUser(newUser);
      setBanner(`Created user ${newUser.username}.`);
      setNewUser({ name: '', username: '', email: '', password: '', role: 'provider', organization: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const backup = await api.getAdminBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frms-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBanner('Full database backup exported.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>
              <Shield size={24} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
              Admin Control Center
            </h1>
            <p>Manage Users (DFD 1.0), View System Records (DFD 5.1), and Generate Reports & Backups (DFD 5.2).</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleDownloadBackup}>
            <Download size={16} /> Export Database Backup
          </button>
        </div>

        {banner && <div className="alert alert-success">{banner}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          <button type="button" className={`tab-btn ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
            Reports & Analytics
          </button>
          <button type="button" className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            Manage Users ({users.length})
          </button>
          <button type="button" className={`tab-btn ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>
            System Records & Activity Log
          </button>
        </div>

        {loading ? (
          <div className="card">Loading admin data...</div>
        ) : tab === 'reports' && reports ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="grid-4">
              <div className="stat-card">
                <span className="stat-label">Registered Users</span>
                <span className="stat-value">{users.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Food Listings</span>
                <span className="stat-value">{records.listings.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Food Requests</span>
                <span className="stat-value">{records.requests.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Distributions</span>
                <span className="stat-value">{records.distributions.length}</span>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Food Listings by Status</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Listings</th>
                        <th>Total Qty</th>
                        <th>Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.foodByStatus.map((row) => (
                        <tr key={row.status}>
                          <td><StatusBadge status={row.status} /></td>
                          <td>{row.count}</td>
                          <td>{row.total_quantity}</td>
                          <td>{row.remaining_quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Requests & Distributions Breakdown</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Request Status</th>
                        <th>Count</th>
                        <th>Requested Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.requestByStatus.map((row) => (
                        <tr key={row.status}>
                          <td><StatusBadge status={row.status} /></td>
                          <td>{row.count}</td>
                          <td>{row.total_requested}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'users' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Register New User (DFD 1.1)</h3>
              <form onSubmit={handleCreateUser} className="grid-3">
                <input
                  className="form-control"
                  placeholder="Full Name"
                  value={newUser.name}
                  onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  className="form-control"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                  required
                />
                <input
                  className="form-control"
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                  required
                />
                <input
                  className="form-control"
                  type="password"
                  placeholder="Password (min 6)"
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <select
                  className="form-control"
                  value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="provider">Food Provider</option>
                  <option value="seeker">Food Seeker</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="btn btn-primary">
                  <UserPlus size={16} /> Create User
                </button>
              </form>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name & Org</th>
                    <th>Username / Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td>
                        <strong>{u.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.organization || '—'}</div>
                      </td>
                      <td>
                        <div>{u.username}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </td>
                      <td><span className="badge badge-role" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                      <td>
                        <StatusBadge status={u.is_active ? 'Available' : 'Deactivated'} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-primary'}`}
                          onClick={() => handleToggleUser(u)}
                        >
                          {u.is_active ? (
                            <>
                              <UserX size={14} /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck size={14} /> Activate
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {records.activities.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{a.created_at}</td>
                    <td>
                      {a.actor_username || 'system'}{' '}
                      <span className="badge badge-role">{a.actor_role}</span>
                    </td>
                    <td><strong>{a.action}</strong></td>
                    <td>{a.entity_type} {a.entity_id ? `#${a.entity_id}` : ''}</td>
                    <td>{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
