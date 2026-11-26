import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Store, HeartHandshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'provider',
    organization: '',
    phone: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await register(form);
      navigate(user.role === 'provider' ? '/provider/dashboard' : '/seeker/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '680px' }}>
        <div className="card">
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Create an FRMS Account</h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
              Register as a Food Provider to donate surplus food or as a Food Seeker to request food for people in need.
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <span className="form-label">Select Your Role *</span>
              <div className="grid-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, role: 'provider' }))}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderColor: form.role === 'provider' ? 'var(--primary)' : 'var(--border)',
                    background: form.role === 'provider' ? 'var(--primary-soft)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <Store size={18} color="var(--primary)" /> Food Provider
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Restaurants, events, bakeries & households sharing surplus food.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, role: 'seeker' }))}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderColor: form.role === 'seeker' ? 'var(--primary)' : 'var(--border)',
                    background: form.role === 'seeker' ? 'var(--primary-soft)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <HeartHandshake size={18} color="var(--primary)" /> Food Seeker
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    NGOs, shelters & volunteers requesting surplus food for communities.
                  </div>
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="reg_name">Full Name *</label>
                <input
                  id="reg_name"
                  name="name"
                  className="form-control"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Aditya Rajpoot"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg_username">Username *</label>
                <input
                  id="reg_username"
                  name="username"
                  className="form-control"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="e.g., greenkitchen"
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="reg_email">Email Address *</label>
                <input
                  id="reg_email"
                  name="email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@organization.org"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg_password">Password (min 6 chars) *</label>
                <input
                  id="reg_password"
                  name="password"
                  type="password"
                  minLength={6}
                  className="form-control"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter strong password"
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="reg_org">Organization / Kitchen / NGO</label>
                <input
                  id="reg_org"
                  name="organization"
                  className="form-control"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="Optional organization name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg_phone">Phone Number</label>
                <input
                  id="reg_phone"
                  name="phone"
                  className="form-control"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91-98260-00000"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg_address">Address / Locality</label>
              <input
                id="reg_address"
                name="address"
                className="form-control"
                value={form.address}
                onChange={handleChange}
                placeholder="Street, area, city"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              <UserPlus size={17} /> {submitting ? 'Creating Account...' : 'Register Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1rem', marginBottom: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Already registered? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
