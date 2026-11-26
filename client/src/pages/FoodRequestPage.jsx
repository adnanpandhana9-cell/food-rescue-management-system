import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function FoodRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getFoodById(id)
      .then((data) => {
        setListing(data.listing);
        setRequestedQuantity(String(data.listing.remaining_quantity || 1));
        setPickupTime(data.listing.available_from?.slice(0, 16) || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createRequest({
        food_id: Number(id),
        requested_quantity: Number(requestedQuantity),
        pickup_time: pickupTime,
        message,
      });
      navigate('/requests', { state: { banner: 'Food request submitted! The provider has been notified.' } });
    } catch (err) {
      setError(err.message || 'Could not submit food request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">Loading food listing...</div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="page">
        <div className="container">
          <div className="alert alert-error">{error || 'Food listing not found.'}</div>
          <Link to="/foods" className="btn btn-secondary">Back to Listings</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '640px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to={`/foods/${id}`} className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} /> Back to Food Details
          </Link>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="badge badge-role">{listing.food_type}</span>
            <StatusBadge status={listing.status} />
          </div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem' }}>Request Surplus Food</h1>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)' }}>
            <strong>{listing.food_name}</strong> — {listing.remaining_quantity} {listing.unit} remaining at{' '}
            {listing.pickup_location}
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="req_qty">
                  Quantity Needed ({listing.unit}) *
                </label>
                <input
                  id="req_qty"
                  type="number"
                  min="1"
                  max={listing.remaining_quantity}
                  step="0.5"
                  className="form-control"
                  value={requestedQuantity}
                  onChange={(e) => setRequestedQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="req_time">Estimated Pickup Time</label>
                <input
                  id="req_time"
                  type="datetime-local"
                  className="form-control"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="req_msg">Pickup Notes / Beneficiary Details</label>
              <textarea
                id="req_msg"
                className="form-control"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share volunteer contact info, container readiness, or community distribution notes..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <Link to={`/foods/${id}`} className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || listing.remaining_quantity <= 0}
              >
                <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Food Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
