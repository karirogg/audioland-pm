# Audioland PM

Verkefnastjórnunarkerfi fyrir Audioland hljóðver. Hannað fyrir auglýsingaframleiðslu með booth-skjá fyrir lesara.

## Eiginleikar

- **Verkefnastjórnun** - Halda utan um auglýsingaverkefni, tengiliði, handrit
- **Booth skjár** - Teleprompter view fyrir lesara með:
  - 4 leturstærðir
  - Autoscroll með stillanlegum hraða
  - Mirror mode fyrir teleprompter
  - Take teljari
- **Google Docs tenging** - Live sync frá Google Docs (uppfærist á 3 sek fresti)
- **WebSocket** - Real-time samskipti milli stjórnborðs og booth

## Uppsetning

### 1. Setja upp Node.js
Sæktu og settu upp [Node.js](https://nodejs.org/)

### 2. Setja upp verkefnið
```bash
cd audioland-pm
npm install
```

### 3. Google Docs tenging (valkvæmt)
Ef þú vilt nota Google Docs live sync:

1. Farðu á [Google Cloud Console](https://console.cloud.google.com/)
2. Búðu til nýtt project
3. Virkjaðu Google Docs API
4. Búðu til OAuth credentials (Desktop app)
5. Halaðu niður `credentials.json` og settu í möppuna
6. Keyrðu `npm run auth` og fylgdu leiðbeiningum

### 4. Keyra
```bash
npm start
```

Opnaðu í vafra:
- **Stjórnborð:** http://localhost:3000
- **Booth:** http://localhost:3000/booth

## Notkun

### Stjórnborð
- Búa til verkefni með nafni, tengiliðum, handriti
- Setja Google Docs URL fyrir live sync
- Senda handrit í booth með "📺 Booth" takka
- Remote stýra scroll með "▶ Scroll" takka

### Booth
- **A/A+/A++/A+++** - Breyta leturstærð
- **▶ Scroll** - Starta/stoppa autoscroll
- **−/+** við hraða - Stilla scroll hraða
- **Take −/+** - Breyta take númeri
- **⟷ Mirror** - Spegla texta fyrir teleprompter
- **↑ Efst** - Fara efst í handrit
- **⛶** - Fullscreen
- **Smella á texta** - Stoppa/starta scroll

## Tæknilegar upplýsingar

- **Backend:** Node.js + Express
- **Database:** SQLite (sql.js)
- **Real-time:** WebSocket
- **Frontend:** Vanilla HTML/CSS/JS

---

Þróað af [Audioland](https://audioland.is)
