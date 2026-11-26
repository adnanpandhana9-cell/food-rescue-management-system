import React, { useState } from 'react';
import { X } from 'lucide-react';

const FOOD_TYPES = [
  'Cooked Meals',
  'Fresh Produce',
  'Bakery & Bread',
  'Packaged Food',
  'Dairy & Beverages',
  'Event Surplus',
  'Other',
];

function defaultDateTime(offsetHours) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FoodFormModal({ initialData = null, onClose, onSubmit }) {
  const [form, setForm] = useState({
    food_name: initialData?.food_name || '',
    food_type: initialData?.food_type || 'Cooked Meals',
    quantity: initialData?.quantity ?? '',
    unit: initialData?.unit || 'meals',
    description: initialData?.description || '',
    pickup_location: initialData?.pickup_location || '',
    available_from: initialData?.available_from?.slice(0, 16) || defaultDateTime(0),
    available_until: initialData?.available_until?.slice(0, 16) || defaultDateTime(6),
    dietary_tags: initialData?.dietary_tags || '',
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
      await onSubmit({
        ...form,
        quantity: Number(form.quantity),
      });
    } catch (err) {
      setError(err.message || 'Could not save food listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{initialData ? 'Edit Food Listing' : 'Add Surplus Food Listing'}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="food_name">Food Name *</label>
              <input
                id="food_name"
                name="food_name"
                className="form-control"
                value={form.food_name}
                onChange={handleChange}
                placeholder="e.g., Vegetable Biryani Trays"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="food_type">Food Type *</label>
              <select
                id="food_type"
                name="food_type"
                className="form-control"
                value={form.food_type}
                onChange={handleChange}
              >
                {FOOD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="quantity">Quantity *</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="0.5"
                className="form-control"
                value={form.quantity}
                onChange={handleChange}
                placeholder="e.g., 30"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="unit">Unit *</label>
              <input
                id="unit"
                name="unit"
                className="form-control"
                value={form.unit}
                onChange={handleChange}
                placeholder="meals, kg, packs, boxes"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pickup_location">Pickup Location *</label>
            <input
              id="pickup_location"
              name="pickup_location"
              className="form-control"
              value={form.pickup_location}
              onChange={handleChange}
              placeholder="Full address and pickup landmark"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="available_from">Available From *</label>
              <input
                id="available_from"
                name="available_from"
                type="datetime-local"
                className="form-control"
                value={form.available_from}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="available_until">Available Until *</label>
              <input
                id="available_until"
                name="available_until"
                type="datetime-local"
                className="form-control"
                value={form.available_until}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="dietary_tags">Dietary / Hygiene Notes</label>
            <input
              id="dietary_tags"
              name="dietary_tags"
              className="form-control"
              value={form.dietary_tags}
              onChange={handleChange}
              placeholder="e.g., Vegetarian, Sealed, Refrigerated"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              className="form-control"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe freshness, packaging, and pickup instructions..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : initialData ? 'Save Changes' : 'Publish Food Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
