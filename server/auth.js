import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALLOWED_USERS_PATH = join(__dirname, '../config/allowed-users.json');

// Load allowed users (re-read on each check for hot-reload)
function getAllowedEmails() {
  try {
    const data = readFileSync(ALLOWED_USERS_PATH, 'utf-8');
    return JSON.parse(data).allowedEmails || [];
  } catch (e) {
    console.error('Failed to load allowed users:', e.message);
    return [];
  }
}

function isEmailAllowed(email) {
  const allowed = getAllowedEmails();
  return allowed.includes(email.toLowerCase());
}

// Dev user for development mode
const DEV_USER = {
  id: 'dev-user-id',
  email: 'dev@localhost',
  name: 'Dev User',
  picture: null,
};

export function configurePassport() {
  // Only configure Google strategy in production
  if (process.env.NODE_ENV === 'production') {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback';

    if (!clientID || !clientSecret) {
      console.error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in production');
      process.exit(1);
    }

    passport.use(new GoogleStrategy({
      clientID,
      clientSecret,
      callbackURL,
    }, (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(null, false, { message: 'No email found in Google profile' });
      }

      const user = {
        id: profile.id,
        email: email.toLowerCase(),
        name: profile.displayName,
        picture: profile.photos?.[0]?.value,
      };

      return done(null, user);
    }));
  }

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });
}

// Middleware: inject dev user in development, require auth in production
export function requireAuth(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    req.user = DEV_USER;
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

// Middleware: check if user is on whitelist
export function requireWhitelist(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!req.user || !isEmailAllowed(req.user.email)) {
    return res.status(403).json({ 
      error: 'Access denied',
      email: req.user?.email,
      message: 'Your account is not authorized. Please contact colin.merkel@gmail.com to request access.'
    });
  }

  next();
}

export { isEmailAllowed };
