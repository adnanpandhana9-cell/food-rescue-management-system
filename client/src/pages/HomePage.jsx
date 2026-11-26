import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, MapPin, Package, ShieldCheck, Utensils, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.getSummaryStats().then(setStats).catch(() => {});
    api
      .getFoods({ available_only: 'true' })
      .then((res) => setFeatured((res.listings || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  const dashboardPath =
    user?.role === 'provider'
      ? '/provider/dashboard'
      : user?.role === 'seeker'
        ? '/seeker/dashboard'
        : '/admin/dashboard';

  return (
    <div className="page">
      <div className="container">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <span className="hero-pill">
                <ShieldCheck size={15} /> Zero-Waste Surplus Food Network
              </span>
              <h1>Connect Surplus Food Providers with Communities in Need.</h1>
              <p>
                The Food Rescue Management System (FRMS) replaces fragmented phone calls and paper logs with a
                centralized, real-time platform to list surplus food, submit pickup requests, and track distribution
                from kitchen to community.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/foods" className="btn btn-accent">
                  Browse Available Food <ArrowRight size={16} />
                </Link>
                {user ? (
                  <Link to={dashboardPath} className="btn btn-secondary">
                    Go to My Dashboard
                  </Link>
                ) : (
                  <Link to="/register" className="btn btn-secondary">
                    Join as Provider or Seeker
                  </Link>
                )}
              </div>
            </div>

            <div className="hero-panel">
              <h3 style={{ marginTop: 0, marginBottom: '0.85rem' }}>Live Platform Impact</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>
                    {stats ? stats.available_listings : '—'}
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.88 }}>Active Food Listings</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>
                    {stats ? stats.available_portions : '—'}
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.88 }}>Portions Available Now</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>
                    {stats ? stats.portions_rescued : '—'}
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.88 }}>Portions Rescued</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>
                    {stats ? stats.active_providers + stats.active_seekers : '—'}
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.88 }}>Verified Members</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <div className="page-header">
            <div>
              <h2 style={{ margin: 0 }}>How Food Rescue Works</h2>
              <p>End-to-end coordination across Food Providers, Food Seekers, and System Administrators.</p>
            </div>
          </div>

          <div className="grid-3">
            <div className="card">
              <div className="badge badge-available" style={{ marginBottom: '0.75rem' }}>
                <Utensils size={14} /> 1. List Surplus Food
              </div>
              <h3 style={{ margin: '0 0 0.4rem' }}>Food Providers</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                Restaurants, hotels, bakeries, event organizers, and households publish surplus food details—type,
                quantity, pickup location, and availability window.
              </p>
            </div>

            <div className="card">
              <div className="badge badge-accepted" style={{ marginBottom: '0.75rem' }}>
                <Users size={14} /> 2. Search & Request
              </div>
              <h3 style={{ margin: '0 0 0.4rem' }}>Food Seekers</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                Shelters, charities, and community volunteers search available listings by location or food category
                and submit verified pickup requests.
              </p>
            </div>

            <div className="card">
              <div className="badge badge-completed" style={{ marginBottom: '0.75rem' }}>
                <CheckCircle size={14} /> 3. Coordinate & Complete
              </div>
              <h3 style={{ margin: '0 0 0.4rem' }}>Tracked Distribution</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                Providers accept or reject requests with instant notifications, and every handoff is tracked from{' '}
                <strong>Available → Requested → Accepted → Distributed → Completed</strong>.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="page-header">
            <div>
              <h2 style={{ margin: 0 }}>Available Surplus Food Right Now</h2>
              <p>Real-time listings ready for request and collection.</p>
            </div>
            <Link to="/foods" className="btn btn-secondary">
              View All Listings <ArrowRight size={15} />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                No active surplus listings at this moment. Providers can sign in to publish new surplus food.
              </p>
            </div>
          ) : (
            <div className="grid-3">
              {featured.map((item) => (
                <article key={item.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-role">{item.food_type}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.food_name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    {item.description.slice(0, 110)}
                    {item.description.length > 110 ? '...' : ''}
                  </p>
                  <div className="meta-row">
                    <Package size={15} />
                    <strong>
                      {item.remaining_quantity} / {item.quantity} {item.unit}
                    </strong>{' '}
                    remaining
                  </div>
                  <div className="meta-row">
                    <MapPin size={15} /> {item.pickup_location}
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <Link to={`/foods/${item.id}`} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                      View Details & Request
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
