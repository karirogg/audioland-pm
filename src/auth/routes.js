// auth/routes.js - Authentication routes

const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=unauthorized' }),
  (req, res) => res.redirect('/')
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login.html');
  });
});

// Get current user
router.get('/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.nafn,
        mynd: req.user.mynd,
        is_admin: req.user.is_admin
      }
    });
  } else {
    res.json({ user: null });
  }
});

module.exports = router;
