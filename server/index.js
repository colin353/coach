import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sessionsRouter from './routes/sessions.js';
import chatRouter from './routes/chat.js';
import workspacesRouter from './routes/workspaces.js';
import presentationsRouter from './routes/presentations.js';
import { configurePassport, requireAuth, requireWhitelist, isEmailAllowed } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (needed when behind nginx/cloudflare/etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,  // TODO: re-enable once X-Forwarded-Proto is configured in nginx
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Passport initialization
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    console.log('OAuth callback - user:', req.user);
    console.log('OAuth callback - session:', req.session);
    console.log('OAuth callback - sessionID:', req.sessionID);
    
    // Check whitelist after successful auth
    if (!isEmailAllowed(req.user.email)) {
      req.logout(() => {
        res.redirect('/access-denied?email=' + encodeURIComponent(req.user.email));
      });
      return;
    }
    // Explicitly save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      console.log('Session saved, redirecting...');
      res.redirect('/');
    });
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

app.get('/auth/me', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.json({ 
      id: 'dev-user-id',
      email: 'dev@localhost',
      name: 'Dev User',
      picture: null,
    });
  }
  
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!isEmailAllowed(req.user.email)) {
    return res.status(403).json({ 
      error: 'Access denied',
      email: req.user.email,
    });
  }
  
  res.json(req.user);
});

// Protected API routes
app.use('/api/workspaces', requireAuth, requireWhitelist, workspacesRouter);
app.use('/api/sessions', requireAuth, requireWhitelist, sessionsRouter);
app.use('/api/chat', requireAuth, requireWhitelist, chatRouter);
app.use('/api/presentations', requireAuth, requireWhitelist, presentationsRouter);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
