import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Edit3, MapPin, Package, Phone, Trash2, User } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LifecycleStepper, StatusBadge } from '../components/StatusBadge.jsx';
import { FoodFormModal } from '../components/FoodFormModal.jsx';

export function FoodDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getFoodById(id);
      setListing(data.listing);
      setSummary(data.requestSummary);
    } catch (err) {
      setError(err.message || 'Could not load food details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleEditSubmit = async (payload) => {
    await api.updateFood(listing.id, payload);
    setEditing(false);
    setSuccess('Food listing updated successfully.');
    loadDetails();
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Deactivate this food listing? Pending requests will be closed.')) return;
    try {
      await api.deactivateFood(listing.id);
      setSuccess('Food listing deactivated.');
      loadDetails();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">Loading food details...</div>
        </div>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="page">
        <div className="container">
          <div className="alert alert-error">{error}</div>
          <Link to="/foods" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Food Listings
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user && (user.id === listing.provider_id || user.role === 'admin');
  const canRequest =
    listing.is_active &&
    ['Available', 'Requested'].includes(listing.status) &&
    listing.remaining_quantity > 0;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '920px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/foods" className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} /> Back to Listings
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="badge badge-role">{listing.food_type}</span>
                <StatusBadge status={listing.status} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{listing.food_name}</h1>
              {listing.dietary_tags && (
                <div style={{ color: 'var(--primary)', fontSize: '0.88rem', fontWeight: 600, marginTop: '0.35rem' }}>
                  {listing.dietary_tags}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isOwner && listing.is_active === 1 && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                    <Edit3 size={16} /> Edit Listing
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDeactivate}>
                    <Trash2 size={16} /> Deactivate
                  </button>
                </>
              )}

              {user?.role === 'seeker' && canRequest && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate(`/foods/${listing.id}/request`)}
                >
                  Request This Food
                </button>
              )}

              {!user && canRequest && (
                <Link to="/login" className="btn btn-primary">
                  Login as Seeker to Request
                </Link>
              )}
            </div>
          </div>

          <div style={{ margin: '1.25rem 0', padding: '1rem', background: 'var(--surface-alt)', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Distribution Status Lifecycle
            </div>
            <LifecycleStepper status={listing.status} />
          </div>

          <p style={{ fontSize: '1rem', lineHeight: 1.65 }}>{listing.description}</p>

          <div className="grid-2" style={{ marginTop: '1.25rem' }}>
            <div className="card" style={{ background: 'var(--bg)' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Availability & Pickup</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.92rem' }}>
                <div className="meta-row">
                  <Package size={16} />
                  <span>
                    Remaining: <strong>{listing.remaining_quantity}</strong> of {listing.quantity} {listing.unit}
                  </span>
                </div>
                <div className="meta-row">
                  <MapPin size={16} />
                  <span>{listing.pickup_location}</span>
                </div>
                <div className="meta-row">
                  <Calendar size={16} />
                  <span>
                    Window: {listing.available_from.replace('T', ' ').slice(0, 16)} →{' '}
                    {listing.available_until.replace('T', ' ').slice(0, 16)}
                  </span>
                </div>
                {summary && (
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Requests received: <strong>{summary.total_requests || 0}</strong> ({summary.pending_requests || 0}{' '}
                    pending)
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg)' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Food Provider Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.92rem' }}>
                <div className="meta-row">
                  <User size={16} />
                  <span>
                    <strong>{listing.provider_organization || listing.provider_name}</strong> ({listing.provider_name})
                  </span>
                </div>
                {listing.provider_phone && (
                  <div className="meta-row">
                    <Phone size={16} />
                    <span>{listing.provider_phone}</span>
                  </div>
                )}
                {listing.provider_address && (
                  <div className="meta-row">
                    <MapPin size={16} />
                    <span>{listing.provider_address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {editing && (
          <FoodFormModal initialData={listing} onClose={() => setEditing(false)} onSubmit={handleEditSubmit} />
        )}
      </div>
    </div>
  );
}
