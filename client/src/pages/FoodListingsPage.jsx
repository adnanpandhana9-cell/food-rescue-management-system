import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package, Plus, Search, Clock } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { FoodFormModal } from '../components/FoodFormModal.jsx';

const FOOD_TYPES = [
  'All',
  'Cooked Meals',
  'Fresh Produce',
  'Bakery & Bread',
  'Packaged Food',
  'Dairy & Beverages',
  'Event Surplus',
  'Other',
];

const STATUS_FILTERS = ['All', 'Available', 'Requested', 'Accepted', 'Distributed', 'Completed'];

export function FoodListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [foodType, setFoodType] = useState('All');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [banner, setBanner] = useState('');

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getFoods({
        search,
        food_type: foodType,
        location,
        status,
        available_only: availableOnly ? 'true' : '',
      });
      setListings(data.listings || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, foodType, location, status, availableOnly]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const handleCreateFood = async (payload) => {
    await api.createFood(payload);
    setShowAddModal(false);
    setBanner('Surplus food listing published successfully!');
    fetchFoods();
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Surplus Food Listings</h1>
            <p>Browse, search, and filter available food donations across locations.</p>
          </div>
          {user && (user.role === 'provider' || user.role === 'admin') && (
            <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Add Surplus Food
            </button>
          )}
        </div>

        {banner && <div className="alert alert-success">{banner}</div>}

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="grid-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="filter_search">Search Food / Keyword</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="filter_search"
                  className="form-control"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Biryani, bread, vegan..."
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="filter_type">Food Type</label>
              <select
                id="filter_type"
                className="form-control"
                value={foodType}
                onChange={(e) => setFoodType(e.target.value)}
              >
                {FOOD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="filter_loc">Pickup Location</label>
              <input
                id="filter_loc"
                className="form-control"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Indore, MG Road..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="filter_status">Listing Status</label>
              <select
                id="filter_status"
                className="form-control"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
              />
              Show only food with remaining available quantity
            </label>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setFoodType('All');
                setLocation('');
                setStatus('All');
                setAvailableOnly(false);
              }}
            >
              <Search size={14} /> Reset Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card">Loading food listings...</div>
        ) : listings.length === 0 ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>No matching food listings found</h3>
            <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
              Try adjusting your search keywords, location, or status filter.
            </p>
          </div>
        ) : (
          <div className="grid-3">
            {listings.map((item) => (
              <article key={item.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-role">{item.food_type}</span>
                  <StatusBadge status={item.status} />
                </div>

                <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.12rem' }}>{item.food_name}</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Provided by <strong>{item.provider_organization || item.provider_name}</strong>
                </div>

                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  {item.description.slice(0, 120)}
                  {item.description.length > 120 ? '...' : ''}
                </p>

                <div className="meta-row">
                  <Package size={15} />
                  <span>
                    <strong>
                      {item.remaining_quantity} / {item.quantity} {item.unit}
                    </strong>{' '}
                    available
                  </span>
                </div>

                <div className="meta-row">
                  <MapPin size={15} />
                  <span>{item.pickup_location}</span>
                </div>

                <div className="meta-row">
                  <Clock size={15} />
                  <span>Until: {item.available_until.replace('T', ' ').slice(0, 16)}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <Link to={`/foods/${item.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                    Details
                  </Link>
                  {user?.role === 'seeker' && item.remaining_quantity > 0 && ['Available', 'Requested'].includes(item.status) && (
                    <Link to={`/foods/${item.id}/request`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                      Request Food
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {showAddModal && <FoodFormModal onClose={() => setShowAddModal(false)} onSubmit={handleCreateFood} />}
      </div>
    </div>
  );
}
