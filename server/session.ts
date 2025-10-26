import session from 'express-session';
import createMemoryStore from 'memorystore';

const MemoryStore = createMemoryStore(session);

// Validate session secret in production
const sessionSecret = process.env.SESSION_SECRET;
const isDevelopment = process.env.NODE_ENV !== 'production';

if (!sessionSecret && !isDevelopment) {
  throw new Error(
    'FATAL: SESSION_SECRET environment variable must be set in production. ' +
    'Generate a strong secret with: openssl rand -base64 32'
  );
}

// Use a development-only secret if not in production
const secret = sessionSecret || 'dev-secret-only-for-development';

if (!sessionSecret && isDevelopment) {
  console.warn(
    '⚠️  WARNING: Using development session secret. ' +
    'Set SESSION_SECRET environment variable for production.'
  );
}

// Warn about MemoryStore in production
if (!isDevelopment) {
  console.error(
    '⚠️  CRITICAL WARNING: Using MemoryStore for sessions in production is NOT RECOMMENDED.\n' +
    '   - Sessions will be lost on server restart\n' +
    '   - Memory leaks will occur under load\n' +
    '   - Multi-instance deployments will not share sessions\n' +
    '   Replace with a production-ready store like connect-redis or connect-pg-simple.'
  );
}

// Session configuration
// NOTE: MemoryStore is suitable for development only
// For production, use a persistent store like Redis (connect-redis) or PostgreSQL (connect-pg-simple)
export const sessionConfig: session.SessionOptions = {
  secret,
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000, // 24 hours - prune expired entries daily
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  },
  name: '1ashirt.sid',
};

// Extend session data type
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}
