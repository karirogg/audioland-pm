# Bessi - Verkefnastjórnun Audioland

Verkefnastjórnunarkerfi fyrir hljóðstúdíó með sérstökum eiginleikum fyrir auglýsingaframleiðslu.

## Eiginleikar

- **Verkefnaskráning** - Halda utan um auglýsingaverkefni með öllum upplýsingum
- **Tímaskráning** - Skrá vinnutíma, símtöl, fundi og tölvupóst
- **Google Docs samþætting** - Sækja handrit beint úr Google Docs (live sync)
- **Booth View** - Senda handrit í upptökubás í rauntíma (teleprompter)
- **Aðkeypt tónlist** - Halda utan um keyptan tónlistarrétt
- **Leit** - Leita í öllum handritum
- **PDF skýrslur** - Tímaskýrslur á PDF formi

## Tæknileg arkitektúr

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Dashboard  │  │    Booth    │  │       Search        │  │
│  │ (index.html)│  │ (booth.html)│  │   (search.html)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (server.js)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  REST API   │  │  WebSocket  │  │   Auth Middleware   │  │
│  │  /api/*     │  │ (dev only)  │  │   (Supabase JWT)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │    Auth     │  │   Row Level Security │  │
│  │  (database) │  │ (Google SSO)│  │   (multi-tenancy)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Uppsetning

### Kröfur

- Node.js 18+
- Supabase account (ókeypis tier virkar)
- Google Cloud Console (fyrir OAuth)

### 1. Klóna og installa

```bash
git clone <repo-url>
cd audioland-verkefni
npm install
```

### 2. Setja upp Supabase

1. Búðu til project á [supabase.com](https://supabase.com)
2. Farðu í **SQL Editor** og keyrðu `supabase-schema.sql`
3. Farðu í **Settings → API** og afritaðu:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Setja upp Google OAuth

1. Farðu á [Google Cloud Console](https://console.cloud.google.com)
2. Búðu til OAuth 2.0 Client (Web application)
3. Bættu við Authorized redirect URI:
   ```
   https://<your-project>.supabase.co/auth/v1/callback
   ```
4. Í Supabase → Authentication → Providers → Google:
   - Settu inn Client ID og Client Secret

### 4. Umhverfisbreytur

```bash
cp .env.example .env
```

Fylltu út `.env`:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
ABLY_API_KEY=          # Aðeins fyrir production
```

### 5. Keyra

```bash
npm start
```

Opnaðu í vafra: http://localhost:3001

## Notkun

### Dashboard

- **Búa til verkefni** - Smelltu á "Nýtt verkefni"
- **Tengiliðir** - Skrá pródúser, tengiliðir, lesara
- **Handrit** - Setja inn handrit eða tengja Google Docs
- **Tímaskráning** - Skrá vinnutíma, símtöl, fundi
- **Booth** - Senda handrit í upptökubás

### Booth (Teleprompter)

- **A/A+/A++/A+++** - Leturstærð
- **▶ Scroll** - Auto-scroll
- **Mirror** - Spegla texta
- **Take ±** - Take teljari
- **⛶** - Fullscreen

### Leit

- Leita í öllum handritum eftir texta
- Sía eftir lesara, stofu, stöðu

## API

### Opinberir endapunktar (enginn auth)

| Method | Path | Lýsing |
|--------|------|--------|
| GET | `/api/config` | Client config (supabase keys) |
| GET | `/api/booth/state` | Núverandi booth state |
| GET | `/api/google-doc/:id` | Sækja Google Doc |
| GET | `/api/stofur` | Listi af auglýsingastofum |
| GET | `/api/framleidsla` | Listi af framleiðslufyrirtækjum |

### Verndaðir endapunktar (þarfnast JWT)

| Method | Path | Lýsing |
|--------|------|--------|
| GET | `/api/verkefni` | Öll verkefni |
| POST | `/api/verkefni` | Búa til verkefni |
| PUT | `/api/verkefni/:id` | Uppfæra verkefni |
| DELETE | `/api/verkefni/:id` | Eyða verkefni |
| GET | `/api/verkefni/:id/timi` | Tímaskráningar |
| POST | `/api/verkefni/:id/timi` | Ný tímaskráning |

Sjá fulla API skjölun í kóða (`server.js`).

## Gagnagrunnur

PostgreSQL með Row Level Security (RLS) fyrir örugga multi-tenancy.

### Töflur

| Tafla | Lýsing |
|-------|--------|
| `users` | Notendur (sync við Supabase Auth) |
| `verkefni` | Verkefni með öllum gögnum |
| `timaskraning` | Tímaskráningar |
| `adkeypt` | Aðkeypt tónlist |
| `auglysingar_stofur` | Lookup tafla |
| `framleidsla` | Lookup tafla |

Sjá `supabase-schema.sql` fyrir schema og RLS policies.

## Deployment

### Vercel

1. Tengdu GitHub repo
2. Stilltu env vars í Vercel dashboard
3. Bættu við `ABLY_API_KEY` fyrir real-time WebSocket

### Aðrar platformar

```bash
# Production start
NODE_ENV=production npm start
```

## Skráarskipulag

```
├── server.js           # Express server og API routes
├── database.js         # Supabase tengsl
├── public/
│   ├── index.html      # Dashboard (aðalsíða)
│   ├── login.html      # Innskráning
│   ├── booth.html      # Teleprompter view
│   └── search.html     # Leitarsíða
├── supabase-schema.sql # Database schema
├── .env.example        # Umhverfisbreytur template
└── package.json
```

## Þróað af

**Audioland ehf** - [audioland.is](https://audioland.is)

---

*Bessi v2.0 - Supabase edition*
