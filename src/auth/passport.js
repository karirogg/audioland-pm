// auth/passport.js - Passport Google OAuth strategy

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('../config');
const { dbGet, dbRun } = require('../database/helpers');

function setupPassport(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  // Only setup Google auth if credentials exist
  if (config.googleClientId && config.googleClientSecret) {
    passport.use(new GoogleStrategy({
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: '/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        if (!email) {
          return done(null, false, { message: 'Ekkert email fannst' });
        }

        // Check if email is in allowed list (if list exists)
        if (config.allowedEmails.length > 0) {
          if (!config.allowedEmails.includes(email.toLowerCase())) {
            console.log('Access denied for:', email);
            return done(null, false, { message: 'Þú hefur ekki aðgang að þessu kerfi' });
          }
        }

        try {
          // Check if user exists
          let user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

          if (!user) {
            // Create new user
            const result = await dbRun(
              'INSERT INTO users (google_id, email, nafn, mynd) VALUES (?, ?, ?, ?)',
              [profile.id, email.toLowerCase(), profile.displayName, profile.photos?.[0]?.value || '']
            );
            user = {
              id: result.lastInsertRowid,
              google_id: profile.id,
              email: email.toLowerCase(),
              nafn: profile.displayName,
              mynd: profile.photos?.[0]?.value || '',
              is_admin: 0
            };
          } else {
            // Update existing user info
            await dbRun(
              'UPDATE users SET google_id = ?, nafn = ?, mynd = ? WHERE id = ?',
              [profile.id, profile.displayName, profile.photos?.[0]?.value || '', user.id]
            );
            user.nafn = profile.displayName;
            user.mynd = profile.photos?.[0]?.value || '';
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
    console.log('Google OAuth initialized');
  } else {
    console.log('Google OAuth disabled (no credentials)');
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

module.exports = { setupPassport };
