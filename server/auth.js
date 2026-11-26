import crypto from 'node:crypto';

const TOKEN_SECRET = process.env.FRMS_SECRET || 'frms-dev-secret-change-in-production-2026';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Hash a plain-text password using scrypt with a unique random salt.
 * @param {string} password
 * @returns {string} salt:hash hex string
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Verify a plain-text password against a stored scrypt salt:hash string.
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/**
 * Sign a compact JWT-compatible HMAC-SHA256 token for authenticated sessions.
 * @param {{ id: number, role: string, username: string }} payload
 * @returns {string}
 */
export function signToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      sub: payload.id,
      role: payload.role,
      username: payload.username,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    })
  );
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 token. Returns null if invalid or expired.
 * @param {string} token
 * @returns {{ sub: number, role: string, username: string, iat: number, exp: number } | null}
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp < now) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract bearer token from Authorization header or cookie fallback.
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * Middleware: require authenticated and active user in database.
 * Attaches sanitized `req.user` from DB so role & active status are always fresh.
 */
export function createAuthMiddleware(db) {
  function requireAuth(req, res, next) {
    const token = extractToken(req);
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const user = db
      .prepare(
        `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at
         FROM users WHERE id = ?`
      )
      .get(decoded.sub);

    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
    }

    req.user = user;
    next();
  }

  function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    const decoded = verifyToken(token);
    if (decoded) {
      const user = db
        .prepare(
          `SELECT id, name, username, email, role, organization, phone, address, is_active, created_at
           FROM users WHERE id = ? AND is_active = 1`
        )
        .get(decoded.sub);
      if (user) req.user = user;
    }
    next();
  }

  function requireRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Access denied. This action requires ${allowedRoles.join(' or ')} privileges.`,
        });
      }
      next();
    };
  }

  return { requireAuth, optionalAuth, requireRole };
}
