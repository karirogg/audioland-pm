// src/index.js - Main entry point

// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');

const config = require('./config');
const { setupMiddleware } = require('./middleware');
const { setupPassport } = require('./auth/passport');
const { setupAuthProtection } = require('./auth/middleware');
const authRoutes = require('./auth/routes');
const { setupWebSocket } = require('./realtime/websocket');
const { setupAbly } = require('./realtime/ably');

// Route modules
const verkefniRoutes = require('./routes/verkefni');
const timiRoutes = require('./routes/timi');
const adkeyptRoutes = require('./routes/adkeypt');
const referenceRoutes = require('./routes/reference');
const searchRoutes = require('./routes/search');
const googleDocsRoutes = require('./routes/google-docs');
const pdfRoutes = require('./routes/pdf');
const configRoutes = require('./routes/config');
const ablyTokenRoutes = require('./routes/ably-token');
const { router: boothRoutes } = require('./booth/routes');

// Database
const { initDatabase, isUsingTurso } = require('../database');

// Create app
const app = express();
const server = http.createServer(app);

// Setup middleware
setupMiddleware(app);

// Setup Passport
setupPassport(app);

// Setup Ably for production
setupAbly();

// Auth routes
app.use('/auth', authRoutes);

// Setup auth protection (after auth routes, before API routes)
setupAuthProtection(app, config);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/verkefni', verkefniRoutes);
app.use('/api', timiRoutes);
app.use('/api', adkeyptRoutes);
app.use('/api', referenceRoutes);
app.use('/api', searchRoutes);
app.use('/api', googleDocsRoutes);
app.use('/api', pdfRoutes);
app.use('/api', configRoutes);
app.use('/api', ablyTokenRoutes);
app.use('/api/booth', boothRoutes);

// Setup WebSocket for development
if (!config.isProduction) {
  setupWebSocket(server);
}

// Start server
initDatabase()
  .then(() => {
    server.listen(config.port, () => {
      console.log('🐕 Bessi keyrir á http://localhost:' + config.port);
      console.log('   Mode:', config.nodeEnv);
      console.log('   Database:', isUsingTurso() ? 'Turso' : 'SQLite');
    });
  })
  .catch((err) => {
    console.error('Villa við database:', err);
    process.exit(1);
  });
