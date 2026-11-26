import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const performLogin = async (id, pw) => {
    setError('');
    setSubmitting(true);
    try {
      const user = await login(id, pw);
      if (user.role === 'provider') navigate('/provider/dashboard');
      else if (user.role === 'seeker') navigate('/seeker/dashboard');
      else navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performLogin(identifier, password);
  };

  const fillDemo = (demoId, demoPw) => {
    setIdentifier(demoId);
    setPassword(demoPw);
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '480px' }}>
        <div className="card">
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Sign In to FRMS</h1>
          <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--text-muted)' }}>
            Use your username or email address to access your dashboard.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login_identifier">Username or Email *</label>
              <input
                id="login_identifier"
                className="form-control"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g., greenharvest or provider@frms.org"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login_password">Password *</label>
              <input
                id="login_password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              <LogIn size={17} /> {submitting ? 'Signing In...' : 'Login'}
            </button>
          </form>

          <div
            style={{
              marginTop: '1.35rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
              Quick Demo Credentials (Click to Fill):
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fillDemo('provider@frms.org', 'Provider@123')}
              >
                Food Provider
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fillDemo('seeker@frms.org', 'Seeker@123')}
              >
                Food Seeker
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fillDemo('admin@frms.org', 'Admin@123')}
              >
                Admin
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '1rem', marginBottom: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            New to FRMS? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
