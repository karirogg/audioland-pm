# Bessi - Verkefnastjórnun fyrir Hljóðver

Multi-tenant SaaS verkefnastjórnunarkerfi fyrir hljóðver og framleiðslufyrirtæki.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    BESSI SaaS                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │  Audioland   │  │  Jukka Studio │  ...       │
│  │  (workspace) │  │  (workspace)  │            │
│  └──────────────┘  └──────────────┘             │
│        │                  │                      │
│   ┌────┴────┐        ┌────┴────┐                │
│   │ Verkefni │        │ Verkefni │               │
│   │ Tengiliðir│       │ Tengiliðir│              │
│   │ Lotur    │        │ Lotur    │               │
│   └─────────┘        └─────────┘                │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │              NOTENDUR                    │    │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │    │
│  │  │Owner│  │Admin│  │Member│ │Guest │    │    │
│  │  └─────┘  └─────┘  └─────┘  └─────┘    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Features

### Multi-tenant
- **Workspaces** - Hvert hljóðver/fyrirtæki fær sitt workspace
- **Roles** - Owner, Admin, Member, Guest
- **Invites** - Bjóða notendum með email link
- **Data isolation** - Gögn aðskilin milli workspaces

### Verkefni
- Stofna, breyta og eyða verkefnum
- Verkefnanúmer (t.d. 2601-001) per workspace
- Status: Í vinnslu (grænt), Bíður (gult), Lokið (rautt)
- Mynd, handrit, athugasemdir
- Google Docs integration

### Tengiliðir
- Lesari, Framleiðslufyrirtæki, Produs, Tengilið
- Art Director, Copywriter, Kúnni
- Auto-fill frá fyrri verkefnum

### Tímaskráning
- Vinnustundir, símtöl, email, fundir
- Samtala per verkefni

### Aðkeypt tónlist
- Skrá lög, heimild, tengil, kostnað

### Lotur (Sessions)
- Bóka upptökulotur
- iCal niðurhal
- Email notifications

### Booth
- Real-time handrit fyrir lesara
- Bold, italic, litir í handriti
- Live update
- LG TV version (`/boothLG.html`)

### Export
- PDF útskrift
- CSV export

## Database Schema

### Core Tables
```sql
-- Users (all users across all workspaces)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  nafn TEXT,
  mynd TEXT,
  created_at TEXT
);

-- Workspaces (hljóðver/fyrirtæki)
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY,
  nafn TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id INTEGER,
  created_at TEXT
);

-- Workspace membership
CREATE TABLE workspace_members (
  workspace_id INTEGER,
  user_id INTEGER,
  role TEXT DEFAULT 'member',  -- owner, admin, member, guest
  PRIMARY KEY (workspace_id, user_id)
);

-- Invites
CREATE TABLE invites (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER,
  email TEXT,
  role TEXT,
  token TEXT UNIQUE,
  expires_at TEXT,
  used_at TEXT
);

-- Projects (per workspace)
CREATE TABLE verkefni (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER,
  verkefnanumer TEXT,
  nafn TEXT,
  stada TEXT,
  ...
);
```

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (dev), Turso (prod)
- **Real-time**: WebSocket (dev), Ably (prod)
- **Auth**: Google OAuth

## User Flow

### New User
1. Fer á bessi.is
2. Smellir á "Innskráning með Google"
3. Google OAuth login
4. Redirect til `/workspace.html`
5. Annað hvort:
   - Býr til nýtt workspace
   - Samþykkir boð (ef með invite link)

### Existing User
1. Google OAuth login
2. Ef eitt workspace → auto redirect til dashboard
3. Ef mörg workspaces → velja workspace

### Invite Flow
1. Admin býr til invite á `/api/workspaces/:id/invite`
2. Fær invite URL: `/invite/abc123`
3. Nýr notandi opnar link, skráir sig inn með Google
4. Sjálfkrafa bætist í workspace

## Environment Variables

```env
NODE_ENV=development
PORT=3001

# Database (production)
TURSO_DATABASE_URL=libsql://...
TURSO_TOKEN=...

# Real-time (production)
ABLY_API_KEY=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...

# Access control (optional - if empty, anyone can sign up)
ALLOWED_EMAILS=user1@example.com,user2@example.com
```

## API Endpoints

### Auth
- `GET /auth/google` - Start Google OAuth
- `GET /auth/user` - Get current user + workspaces
- `POST /auth/workspace/:id` - Switch workspace
- `GET /auth/logout` - Logout

### Workspaces
- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces/:id/members` - List members
- `POST /api/workspaces/:id/invite` - Create invite
- `GET /api/workspaces/invite/:token` - Get invite info
- `POST /api/workspaces/invite/:token` - Accept invite

### Verkefni
- `GET /api/verkefni` - List (filtered by workspace)
- `POST /api/verkefni` - Create
- `GET /api/verkefni/:id` - Get one
- `PUT /api/verkefni/:id` - Update
- `DELETE /api/verkefni/:id` - Delete

### Booth
- `GET /api/booth/state` - Current booth state
- `POST /api/booth/send` - Send to booth
- `POST /api/booth/update-handrit` - Live update handrit

## URLs

- `/` - Dashboard
- `/workspace.html` - Workspace selection/creation
- `/login.html` - Login page
- `/booth.html` - Booth (full features)
- `/boothLG.html` - Booth (LG TV, simple polling)
- `/invite/:token` - Accept invite

## Run Locally

```bash
npm install
npm start
# http://localhost:3001
```

## Roles

| Role | Verkefni | Booth | Invite | Settings |
|------|----------|-------|--------|----------|
| Owner | Full | Full | Yes | Yes |
| Admin | Full | Full | Yes | Limited |
| Member | Full | Full | No | No |
| Guest | View | View | No | No |
