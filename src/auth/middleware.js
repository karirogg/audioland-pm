// auth/middleware.js - Authentication middleware

const { dbGet, dbAll } = require('../database/helpers');

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Þú þarft að skrá þig inn' });
  }
  res.redirect('/login.html');
}

// Middleware to load user's workspaces and current workspace
async function loadWorkspace(req, res, next) {
  if (!req.isAuthenticated() || !req.user) {
    return next();
  }

  try {
    // Get user's workspaces
    const workspaces = await dbAll(`
      SELECT w.*, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ?
      ORDER BY w.nafn
    `, [req.user.id]);

    req.userWorkspaces = workspaces;

    // Get current workspace from session or default to first
    let currentWorkspaceId = req.session?.currentWorkspaceId;

    if (!currentWorkspaceId && workspaces.length > 0) {
      currentWorkspaceId = workspaces[0].id;
      req.session.currentWorkspaceId = currentWorkspaceId;
    }

    if (currentWorkspaceId) {
      req.currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
    }

    next();
  } catch (err) {
    console.error('Error loading workspace:', err);
    next();
  }
}

function setupAuthProtection(app, config) {
  // Only protect routes if auth is configured
  if (!config.googleClientId || !config.googleClientSecret) {
    return;
  }

  app.use((req, res, next) => {
    // Allow auth routes
    if (req.path.startsWith('/auth/')) return next();
    // Allow login page, workspace selection, and settings
    if (req.path === '/login.html' || req.path === '/workspace.html' || req.path === '/settings.html') return next();
    // Allow invite pages
    if (req.path.startsWith('/invite/')) return next();
    // Allow static assets (images, css, js, fonts)
    if (req.path.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i)) return next();
    // Allow booth (might be on TV without login)
    if (req.path === '/booth.html' || req.path === '/boothLG.html' || req.path.startsWith('/api/booth')) return next();
    // Allow workspace API for logged in users
    if (req.path.startsWith('/api/workspaces')) return requireAuth(req, res, next);
    // Require auth for everything else
    return requireAuth(req, res, next);
  });

  // Load workspace after auth check
  app.use(loadWorkspace);
}

module.exports = { requireAuth, setupAuthProtection, loadWorkspace };
