// auth/routes.js - Authentication routes

const express = require('express');
const passport = require('passport');
const router = express.Router();
const { dbAll, dbGet } = require('../database/helpers');

// Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=unauthorized' }),
  async (req, res) => {
    try {
      // Check if user has any workspaces
      const workspaces = await dbAll(`
        SELECT w.id FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
      `, [req.user.id]);

      if (workspaces.length === 0) {
        // No workspace - redirect to create/join
        res.redirect('/workspace.html');
      } else if (workspaces.length === 1) {
        // One workspace - auto select and go to dashboard
        req.session.currentWorkspaceId = workspaces[0].id;
        res.redirect('/');
      } else {
        // Multiple workspaces - let user choose
        res.redirect('/workspace.html');
      }
    } catch (err) {
      console.error('Error checking workspaces:', err);
      res.redirect('/');
    }
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.currentWorkspaceId = null;
    res.redirect('/login.html');
  });
});

// Get current user with workspace info
router.get('/user', async (req, res) => {
  if (req.isAuthenticated() && req.user) {
    try {
      // Get user's workspaces
      const workspaces = await dbAll(`
        SELECT w.*, wm.role
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
        ORDER BY w.nafn
      `, [req.user.id]);

      const currentWorkspaceId = req.session?.currentWorkspaceId;
      const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0];

      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.nafn,
          mynd: req.user.mynd,
          is_admin: req.user.is_admin
        },
        workspaces,
        currentWorkspace: currentWorkspace || null
      });
    } catch (err) {
      console.error('Error fetching user workspaces:', err);
      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.nafn,
          mynd: req.user.mynd,
          is_admin: req.user.is_admin
        },
        workspaces: [],
        currentWorkspace: null
      });
    }
  } else {
    res.json({ user: null, workspaces: [], currentWorkspace: null });
  }
});

// Switch workspace
router.post('/workspace/:id', async (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Ekki innskráður' });
  }

  const workspaceId = parseInt(req.params.id);

  try {
    // Verify user is member of workspace
    const membership = await dbGet(`
      SELECT w.*, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE w.id = ? AND wm.user_id = ?
    `, [workspaceId, req.user.id]);

    if (!membership) {
      return res.status(403).json({ error: 'Ekki aðgangur að þessu workspace' });
    }

    req.session.currentWorkspaceId = workspaceId;
    res.json({ message: 'Workspace valið', workspace: membership });
  } catch (err) {
    console.error('Error switching workspace:', err);
    res.status(500).json({ error: 'Villa' });
  }
});

module.exports = router;
