const jwt = require('jsonwebtoken');
const dbService = require('../services/dbService');
const { debugError, debugWarn } = require('../debug');

const SUPER_ADMIN_EMAIL = 'greg.weisz@oxfordhouse.org';
const ALLOWED_ROLES = ['employee', 'supervisor', 'admin', 'finance', 'contracts'];
const DEFAULT_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || process.env.AUTH_TOKEN_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    debugWarn('⚠️ JWT_SECRET is not set. Set JWT_SECRET in production environment variables.');
  }
  return 'development-only-change-me';
}

function getEffectiveRole(employee, allowedRoles = ALLOWED_ROLES) {
  const email = (employee && employee.email || '').trim().toLowerCase();
  if (email === SUPER_ADMIN_EMAIL) return 'admin';
  const userRole = (employee && employee.role) || 'employee';
  return allowedRoles.includes(userRole) ? userRole : 'employee';
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match?.[1]?.trim() || null;
}

function signAuthToken(employee) {
  const role = getEffectiveRole(employee);
  return jwt.sign(
    {
      sub: employee.id,
      role,
      email: employee.email || '',
      typ: 'access',
    },
    getJwtSecret(),
    {
      expiresIn: DEFAULT_TOKEN_EXPIRES_IN,
      issuer: 'oxford-mileage-tracker',
      audience: 'oxford-mileage-users',
    }
  );
}

function verifyAuthToken(token) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: 'oxford-mileage-tracker',
      audience: 'oxford-mileage-users',
    });
    return { employeeId: payload.sub, tokenType: 'jwt', payload };
  } catch (error) {
    // Temporary compatibility so existing logged-in sessions survive the deploy.
    const legacyMatch = /^session_(.+)_(\d+)$/.exec(token);
    if (legacyMatch) {
      return {
        employeeId: legacyMatch[1],
        tokenType: 'legacy-session',
        payload: { sub: legacyMatch[1], iat: Number(legacyMatch[2]) },
      };
    }
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    const verified = verifyAuthToken(token);
    if (!verified?.employeeId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const employee = await dbService.getEmployeeById(verified.employeeId);
    if (!employee) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    if (employee.archived === 1) {
      return res.status(403).json({ error: 'This account is archived. Please contact your administrator.' });
    }

    const role = getEffectiveRole(employee);
    req.auth = {
      employeeId: employee.id,
      role,
      tokenType: verified.tokenType,
      tokenPayload: verified.payload,
    };
    req.authenticatedEmployee = { ...employee, role };
    return next();
  } catch (error) {
    debugError('❌ Error verifying auth token:', error);
    return res.status(500).json({ error: 'Failed to verify session' });
  }
}

function hasAnyRole(employee, roles) {
  const role = getEffectiveRole(employee);
  return roles.includes(role);
}

function requireAnyRole(roles) {
  return async (req, res, next) => {
    await requireAuth(req, res, () => {
      if (!hasAnyRole(req.authenticatedEmployee, roles)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return next();
    });
  };
}

function requireSelfOrRole(paramName, roles = ['admin']) {
  return async (req, res, next) => {
    await requireAuth(req, res, () => {
      const targetId = req.params[paramName] || req.body?.[paramName] || req.query?.[paramName];
      if (targetId && targetId === req.authenticatedEmployee.id) return next();
      if (hasAnyRole(req.authenticatedEmployee, roles)) return next();
      return res.status(403).json({ error: 'Access denied' });
    });
  };
}

module.exports = {
  ALLOWED_ROLES,
  SUPER_ADMIN_EMAIL,
  getEffectiveRole,
  getBearerToken,
  signAuthToken,
  verifyAuthToken,
  requireAuth,
  requireAnyRole,
  requireSelfOrRole,
};
