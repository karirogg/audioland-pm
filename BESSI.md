# Bessi - Audioland Verkefnastjórnun

Verkefnastjórnunarkerfi fyrir Audioland hljóðver.

## Features

### Verkefni
- Stofna, breyta og eyða verkefnum
- Verkefnanúmer (t.d. 2601-001)
- Status: Í vinnslu (grænt), Bíður (gult), Lokið (rautt)
- Mynd, handrit, athugasemdir
- Google Docs integration fyrir handrit

### Tengiliðir
- Lesari (nafn, sími, netfang)
- Framleiðslufyrirtæki, Produs, Tengilið
- Art Director, Copywriter
- Kúnni
- Auto-fill: Ef þú hefur slegið inn tengilið áður, þá fyllist sími/netfang sjálfkrafa út

### Tímaskráning
- Vinnustundir, símtöl, email, fundir
- Samtala á verkefni

### Aðkeypt tónlist
- Skrá lög, heimild, tengil, kostnað
- Samtala kostnaðar

### Lotur (Sessions)
- Bóka upptökulotur
- iCal niðurhal
- Email notifications

### Booth
- Real-time handrit fyrir lesara
- Bold, italic, litir í handriti
- Live update - breytingar sjást strax hjá lesara
- Font size stillingar
- Auto-scroll
- Dark/Light mode
- Mirror mode (fyrir teleprompter)
- LG TV version (`/boothLG.html`)

### Export
- PDF útskrift
- CSV export

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (dev), Turso (prod)
- **Real-time**: WebSocket (dev), Ably (prod)
- **Auth**: Google OAuth með allowed emails lista

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

# Access control
ALLOWED_EMAILS=user1@example.com,user2@example.com
```

## Keyra locally

```bash
npm install
npm start
# http://localhost:3001
```

## URLs

- `/` - Dashboard
- `/booth.html` - Booth (full features)
- `/boothLG.html` - Booth (LG TV, simple polling)
