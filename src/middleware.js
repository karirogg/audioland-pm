// middleware.js - Express middleware setup

const express = require('express');
const cookieSession = require('cookie-session');
const config = require('./config');

function setupMiddleware(app) {
  // Trust proxy for Vercel
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // Cookie-session setup (works with serverless)
  // Only use secure cookies when actually deployed to a platform (not localhost)
  // Check for platform-specific env vars to detect real deployment
  const isDeployed = !!(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER);

  app.use(cookieSession({
    name: 'bessi-session',
    keys: [config.sessionSecret],
    maxAge: config.sessionMaxAge,
    secure: isDeployed,
    sameSite: 'lax'
  }));

  // Fix for passport + cookie-session compatibility
  app.use((req, res, next) => {
    if (req.session && !req.session.regenerate) {
      req.session.regenerate = (cb) => cb();
    }
    if (req.session && !req.session.save) {
      req.session.save = (cb) => cb();
    }
    next();
  });

  // JSON body parser
  app.use(express.json({ limit: '10mb' }));
}

module.exports = { setupMiddleware };
