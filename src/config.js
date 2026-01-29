// config.js - Environment and configuration

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  // Environment
  isProduction,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,

  // Session
  sessionSecret: process.env.SESSION_SECRET || 'bessi-secret-key-change-in-production',
  sessionMaxAge: 7 * 24 * 60 * 60 * 1000, // 1 week

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  // Ably (real-time for production)
  ablyApiKey: process.env.ABLY_API_KEY,
  useAbly: isProduction && !!process.env.ABLY_API_KEY,
};

module.exports = config;
