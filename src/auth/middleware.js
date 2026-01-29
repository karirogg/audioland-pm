// auth/middleware.js - Authentication middleware

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Þú þarft að skrá þig inn' });
  }
  res.redirect('/login.html');
}

function setupAuthProtection(app, config) {
  // Only protect routes if auth is configured
  if (!config.googleClientId || !config.googleClientSecret) {
    return;
  }

  app.use((req, res, next) => {
    // Allow auth routes
    if (req.path.startsWith('/auth/')) return next();
    // Allow login page
    if (req.path === '/login.html') return next();
    // Allow static assets (images, css, js, fonts)
    if (req.path.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i)) return next();
    // Allow booth (might be on TV without login)
    if (req.path === '/booth.html' || req.path.startsWith('/api/booth')) return next();
    // Require auth for everything else
    return requireAuth(req, res, next);
  });
}

module.exports = { requireAuth, setupAuthProtection };
