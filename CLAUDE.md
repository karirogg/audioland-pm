# Bessi - Project Management System

Bessi is a project management system for audio technicians, built by Audioland. Features include project tracking, time logging, script management with a teleprompter booth view, and Google Docs integration.

**Note:** This is a hobby project. The code is mostly written with Claude Code by Jói B, who is an audio technician, not a software engineer. Be the software engineering expert and follow best practices.

## Tech Stack (DO NOT CHANGE)

- **Backend:** Node.js + Express
- **Database:** Turso (SQLite) - see `database.js`
- **Auth:** Google OAuth via Passport.js
- **Real-time:** Ably (production) / WebSocket (development)
- **Hosting:** Vercel

Do NOT suggest adding new services or frameworks. Solve problems with the existing stack.

## Project Structure

```
src/                    # Backend code
├── index.js            # Entry point
├── config.js           # Environment config
├── middleware.js       # Express middleware
├── auth/               # Authentication (Google OAuth)
├── booth/              # Booth state & broadcasting
├── realtime/           # WebSocket & Ably
├── database/           # DB helpers
└── routes/             # API routes

public/                 # Frontend
├── css/                # Stylesheets (common.css + page-specific)
├── js/                 # JavaScript (common.js + page-specific)
└── *.html              # HTML pages (no inline CSS/JS!)
```

## Code Rules

1. **DRY:** Re-use existing functions. Check `src/database/helpers.js`, `public/js/common.js` before writing new utilities.

2. **File size limits:**
   - \>500 lines → consider splitting
   - \>1000 lines → must split

3. **Separation of concerns:** Keep HTML, CSS, and JS in separate files. No inline styles or scripts.

4. **Icelandic naming:** The codebase uses Icelandic for domain terms (verkefni=project, handrit=script, stofa=agency, lesari=voice actor). Keep this consistent.

5. **Error messages:** User-facing errors should be in Icelandic.
