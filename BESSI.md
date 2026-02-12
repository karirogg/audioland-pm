# Bessi - Verkefnastjórnun fyrir Hljóðver

Multi-tenant SaaS verkefnastjórnunarkerfi fyrir hljóðver og framleiðslufyrirtæki.

**Live:** [bessi.audioland.is](https://bessi.audioland.is)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       BESSI SaaS                             │
│                   bessi.audioland.is                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Audioland   │  │    Eikisig   │  │  Jukka o.fl. │       │
│  │  (workspace) │  │  (workspace) │  │  (workspace) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│        │                  │                 │                │
│   ┌────┴────┐        ┌────┴────┐       ┌────┴────┐          │
│   │ Verkefni │        │ Verkefni │       │ Verkefni │        │
│   │ Tengiliðir│       │ Tengiliðir│      │ Tengiliðir│       │
│   │ Lotur    │        │ Lotur    │       │ Lotur    │        │
│   │ Booth    │        │ Booth    │       │ Booth    │        │
│   └─────────┘        └─────────┘       └─────────┘          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    NOTENDUR                          │    │
│  │  Allir með Google account geta skráð sig             │    │
│  │  90 daga trial → $200/ári                            │    │
│  │                                                       │    │
│  │  Roles: Owner | Admin | Member | Guest               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Multi-tenant Workspaces
- **Open registration** - Allir geta skráð sig með Google
- **90 daga frítt trial** - Allar features meðfylgjandi
- **Workspace isolation** - Gögn aðskilin milli workspaces
- **Workspace switcher** - Skipta á milli workspaces í header
- **Invite system** - Bjóða meðlimum með link

### Verkefni
- Stofna, breyta og eyða verkefnum
- Verkefnanúmer (t.d. 2602-001) per workspace
- Status með litum: Í vinnslu (grænt), Bíður (gult), Lokið (rautt)
- Mynd, handrit, athugasemdir
- Google Docs integration fyrir handrit

### Tengiliðir
- Lesari (nafn, sími, netfang)
- Framleiðslufyrirtæki, Produs, Tengilið
- Art Director, Copywriter
- Kúnni
- **Auto-fill** - Ef tengiliður hefur verið skráður áður fyllist sími/netfang sjálfkrafa

### Tímaskráning
- Vinnustundir, símtöl, email, fundir
- Samtala per verkefni

### Aðkeypt tónlist
- Skrá lög, heimild, tengil, kostnað
- Samtala kostnaðar

### Lotur (Sessions)
- Bóka upptökulotur
- iCal niðurhal
- Email notifications

### Booth
- **Real-time** handrit fyrir lesara
- **Rich text** - Bold, italic, litir í handriti
- **Live update** - Breytingar sjást strax hjá lesara
- Font size stillingar (1-4)
- Auto-scroll með stillanlegum hraða
- Dark/Light mode
- Mirror mode (fyrir teleprompter)
- **LG TV version** - Einfaldaður booth fyrir smart TV

### Export
- PDF útskrift
- CSV export

## Pricing

| Plan | Verð | Features |
|------|------|----------|
| **Trial** | Frítt í 90 daga | Allt |
| **Pro** | $200/ári | Unlimited verkefni, notendur, support |

## Tech Stack

- **Frontend**: Vanilla JS, CSS
- **Backend**: Node.js, Express
- **Database**: SQLite (dev), Turso (prod)
- **Real-time**: WebSocket (dev), Ably (prod)
- **Auth**: Google OAuth (open registration)
- **Hosting**: Vercel

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  nafn TEXT,
  mynd TEXT,
  created_at TEXT
);

-- Workspaces
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY,
  nafn TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id INTEGER,
  plan TEXT DEFAULT 'trial',        -- trial, pro
  trial_ends_at TEXT,               -- ISO date
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
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

-- Projects
CREATE TABLE verkefni (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER,
  verkefnanumer TEXT,
  nafn TEXT,
  stada TEXT,
  handrit TEXT,
  lesari TEXT,
  ...
);
```

## User Flows

### New User
1. Fer á bessi.audioland.is
2. Smellir á "Innskráning með Google"
3. Google OAuth login
4. Redirect til `/workspace.html`
5. Býr til nýtt workspace (90 daga trial)
6. Kemur inn á dashboard

### Invite Flow
1. Owner/Admin fer í Settings → Bjóða
2. Slær inn email og role
3. Fær invite link
4. Nýr notandi opnar link
5. Skráir sig inn með Google
6. Sjálfkrafa bætist í workspace

### Workspace Switching
1. Smellir á workspace nafn í header
2. Dropdown sýnir öll workspaces
3. Velur annað workspace
4. Síða refreshast með nýjum gögnum

## API Endpoints

### Auth
- `GET /auth/google` - Start OAuth
- `GET /auth/user` - Current user + workspaces
- `POST /auth/workspace/:id` - Switch workspace
- `GET /auth/logout` - Logout

### Workspaces
- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces` - Create (with 90 day trial)
- `GET /api/workspaces/:id/settings` - Get settings
- `PUT /api/workspaces/:id/settings` - Update settings
- `GET /api/workspaces/:id/members` - List members
- `PUT /api/workspaces/:id/members/:id` - Update role
- `DELETE /api/workspaces/:id/members/:id` - Remove member
- `POST /api/workspaces/:id/invite` - Create invite

### Verkefni
- `GET /api/verkefni` - List (filtered by workspace)
- `POST /api/verkefni` - Create
- `GET /api/verkefni/:id` - Get one
- `PUT /api/verkefni/:id` - Update
- `DELETE /api/verkefni/:id` - Delete

### Booth
- `GET /api/booth/state` - Current state
- `POST /api/booth/send` - Send to booth
- `POST /api/booth/update-handrit` - Live update

## URLs

| URL | Lýsing |
|-----|--------|
| `/` | Dashboard |
| `/workspace.html` | Velja/búa til workspace |
| `/settings.html` | Workspace stillingar |
| `/login.html` | Login síða |
| `/booth.html` | Booth (full) |
| `/boothLG.html` | Booth (LG TV) |
| `/search.html` | Leit í handritum |

## Roles & Permissions

| Role | Verkefni | Booth | Invite | Settings | Remove Members |
|------|----------|-------|--------|----------|----------------|
| Owner | Full | Full | Yes | Yes | Yes |
| Admin | Full | Full | Yes | Yes | Yes |
| Member | Full | Full | No | No | No |
| Guest | View | View | No | No | No |

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

# Open registration (empty = all emails allowed)
ALLOWED_EMAILS=
```

## Development

```bash
# Install
npm install

# Run locally
npm start
# → http://localhost:3001

# Database
# Dev: ./bessi.db (SQLite)
# Prod: Turso (libSQL)
```

## Deployment

Automatic deployment via Vercel on push to `main`.

Environment variables set in Vercel dashboard.
