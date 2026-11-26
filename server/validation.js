/**
 * Input validation & sanitization utilities (SRS 4.2.2 Security Requirements).
 */

export const FOOD_TYPES = [
  'Cooked Meals',
  'Fresh Produce',
  'Bakery & Bread',
  'Packaged Food',
  'Dairy & Beverages',
  'Event Surplus',
  'Other',
];

export const FOOD_STATUSES = [
  'Available',
  'Requested',
  'Accepted',
  'Distributed',
  'Completed',
  'Deactivated',
];

export const REQUEST_STATUSES = [
  'Pending',
  'Accepted',
  'Rejected',
  'Distributed',
  'Completed',
  'Cancelled',
];

export function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(username);
}

export function isValidPhone(phone) {
  if (!phone) return true;
  return /^[0-9+\-\s()]{7,20}$/.test(phone);
}

export function parsePositiveNumber(val) {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

export function parsePositiveInt(val) {
  const num = Number(val);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export function validateRegistrationInput(body) {
  const errors = [];
  const name = cleanString(body.name, 100);
  const username = cleanString(body.username, 32).toLowerCase();
  const email = cleanString(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = cleanString(body.role, 20).toLowerCase();
  const organization = cleanString(body.organization, 120);
  const phone = cleanString(body.phone, 20);
  const address = cleanString(body.address, 250);

  if (name.length < 2) errors.push('Full name must be at least 2 characters.');
  if (!isValidUsername(username)) {
    errors.push('Username must be 3-32 characters (letters, numbers, ., _, -).');
  }
  if (!isValidEmail(email)) errors.push('Please enter a valid email address.');
  if (password.length < 6) errors.push('Password must be at least 6 characters.');
  if (!['provider', 'seeker'].includes(role)) {
    errors.push('Role must be either Food Provider (provider) or Food Seeker (seeker).');
  }
  if (!isValidPhone(phone)) errors.push('Phone number format is invalid.');

  return {
    errors,
    data: { name, username, email, password, role, organization, phone, address },
  };
}

export function validateFoodInput(body, isPartial = false) {
  const errors = [];
  const data = {};

  if (!isPartial || body.food_name !== undefined) {
    const food_name = cleanString(body.food_name, 120);
    if (food_name.length < 2) errors.push('Food name must be at least 2 characters.');
    data.food_name = food_name;
  }

  if (!isPartial || body.food_type !== undefined) {
    const food_type = cleanString(body.food_type, 50);
    if (!FOOD_TYPES.includes(food_type)) {
      errors.push(`Food type must be one of: ${FOOD_TYPES.join(', ')}.`);
    }
    data.food_type = food_type;
  }

  if (!isPartial || body.quantity !== undefined) {
    const quantity = parsePositiveNumber(body.quantity);
    if (quantity === null) errors.push('Quantity must be a positive number.');
    data.quantity = quantity;
  }

  if (!isPartial || body.unit !== undefined) {
    const unit = cleanString(body.unit || 'portions', 30);
    if (!unit) errors.push('Unit is required.');
    data.unit = unit;
  }

  if (!isPartial || body.description !== undefined) {
    const description = cleanString(body.description, 1000);
    if (description.length < 5) errors.push('Description must be at least 5 characters.');
    data.description = description;
  }

  if (!isPartial || body.pickup_location !== undefined) {
    const pickup_location = cleanString(body.pickup_location, 250);
    if (pickup_location.length < 3) errors.push('Pickup location is required.');
    data.pickup_location = pickup_location;
  }

  if (!isPartial || body.available_from !== undefined) {
    const available_from = cleanString(body.available_from, 40);
    if (!available_from) errors.push('Available from date/time is required.');
    data.available_from = available_from;
  }

  if (!isPartial || body.available_until !== undefined) {
    const available_until = cleanString(body.available_until, 40);
    if (!available_until) errors.push('Available until date/time is required.');
    data.available_until = available_until;
  }

  if (body.dietary_tags !== undefined) {
    data.dietary_tags = cleanString(body.dietary_tags, 150);
  } else if (!isPartial) {
    data.dietary_tags = '';
  }

  if (data.available_from && data.available_until) {
    const fromTime = Date.parse(data.available_from);
    const untilTime = Date.parse(data.available_until);
    if (!Number.isNaN(fromTime) && !Number.isNaN(untilTime) && untilTime <= fromTime) {
      errors.push('Available until time must be after available from time.');
    }
  }

  return { errors, data };
}
