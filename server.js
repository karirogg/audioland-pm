const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { initDatabase, getDb, saveDatabase } = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Google Docs setup
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
let googleAuth = null;

function getGoogleAuth() {
  if (googleAuth) return googleAuth;
  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) return null;
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const { client_id, client_secret } = credentials.installed || credentials.web;
    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3001/oauth2callback');
    oauth2Client.setCredentials(token);
    googleAuth = oauth2Client;
    return oauth2Client;
  } catch (err) {
    console.error('Google Auth villa:', err);
    return null;
  }
}

// WebSocket
let boothClients = [];
let dashboardClients = [];
let currentBoothState = { handrit: '', nafn: '', lesari: '', take: 1, fontSize: 2, autoScroll: false, scrollSpeed: 50 };

wss.on('connection', (ws, req) => {
  if (req.url === '/booth-ws') {
    boothClients.push(ws);
    console.log('Booth tengdist');
    ws.send(JSON.stringify({ type: 'state', ...currentBoothState }));
    ws.on('close', () => { boothClients = boothClients.filter(c => c !== ws); console.log('Booth aftengdist'); });
  } else if (req.url === '/dashboard-ws') {
    dashboardClients.push(ws);
    console.log('Dashboard tengdist');
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'handrit') {
          currentBoothState = { ...currentBoothState, ...data };
          boothClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify(data)); });
        }
      } catch (err) {}
    });
    ws.on('close', () => { dashboardClients = dashboardClients.filter(c => c !== ws); });
  }
});

function broadcastToBooth(data) {
  if (data.type === 'handrit' || data.type === 'settings') currentBoothState = { ...currentBoothState, ...data };
  boothClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify(data)); });
}

// DB helpers
function dbAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null;
}

function dbRun(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDatabase();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
}

// API - Verkefni
app.get('/api/verkefni', (req, res) => {
  const verkefni = dbAll('SELECT * FROM verkefni ORDER BY created_at DESC');
  res.json(verkefni);
});

app.get('/api/verkefni/:id', (req, res) => {
  const verkefni = dbGet('SELECT * FROM verkefni WHERE id = ?', [req.params.id]);
  if (!verkefni) return res.status(404).json({ error: 'Verkefni fannst ekki' });
  res.json(verkefni);
});

app.post('/api/verkefni', (req, res) => {
  const b = req.body;
  let google_doc_id = '';
  if (b.google_doc_url) {
    const match = b.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) google_doc_id = match[1];
  }
  
  const result = dbRun(`
    INSERT INTO verkefni (nafn, mynd, framleidsla, produser, produser_simi, produser_netfang,
      stofa, tengill_nafn, tengill_simi, tengill_netfang, art_director, art_director_simi,
      copywriter, copywriter_simi, lesari, handrit, google_doc_url, google_doc_id,
      tonlist_titill, tonlist_heimild, tonlist_url, tonlist_kostnadur,
      stada, athugasemdir, payday_tengill, dropbox_slod, mottekid, skilad)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    b.nafn||'', b.mynd||'', b.framleidsla||'', b.produser||'', b.produser_simi||'', b.produser_netfang||'',
    b.stofa||'', b.tengill_nafn||'', b.tengill_simi||'', b.tengill_netfang||'', b.art_director||'', b.art_director_simi||'',
    b.copywriter||'', b.copywriter_simi||'', b.lesari||'', b.handrit||'', b.google_doc_url||'', google_doc_id,
    b.tonlist_titill||'', b.tonlist_heimild||'', b.tonlist_url||'', b.tonlist_kostnadur||0,
    b.stada||'Í vinnslu', b.athugasemdir||'', b.payday_tengill||'', b.dropbox_slod||'', b.mottekid||'', b.skilad||''
  ]);
  res.json({ id: result.lastInsertRowid, message: 'Verkefni búið til' });
});

app.put('/api/verkefni/:id', (req, res) => {
  const b = req.body;
  let google_doc_id = '';
  if (b.google_doc_url) {
    const match = b.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) google_doc_id = match[1];
  }
  
  dbRun(`
    UPDATE verkefni SET nafn=?, mynd=?, framleidsla=?, produser=?, produser_simi=?, produser_netfang=?,
      stofa=?, tengill_nafn=?, tengill_simi=?, tengill_netfang=?, art_director=?, art_director_simi=?,
      copywriter=?, copywriter_simi=?, lesari=?, handrit=?, google_doc_url=?, google_doc_id=?,
      tonlist_titill=?, tonlist_heimild=?, tonlist_url=?, tonlist_kostnadur=?,
      stada=?, athugasemdir=?, payday_tengill=?, dropbox_slod=?, mottekid=?, skilad=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [
    b.nafn||'', b.mynd||'', b.framleidsla||'', b.produser||'', b.produser_simi||'', b.produser_netfang||'',
    b.stofa||'', b.tengill_nafn||'', b.tengill_simi||'', b.tengill_netfang||'', b.art_director||'', b.art_director_simi||'',
    b.copywriter||'', b.copywriter_simi||'', b.lesari||'', b.handrit||'', b.google_doc_url||'', google_doc_id,
    b.tonlist_titill||'', b.tonlist_heimild||'', b.tonlist_url||'', b.tonlist_kostnadur||0,
    b.stada||'Í vinnslu', b.athugasemdir||'', b.payday_tengill||'', b.dropbox_slod||'', b.mottekid||'', b.skilad||'',
    req.params.id
  ]);
  res.json({ message: 'Verkefni uppfært' });
});

app.delete('/api/verkefni/:id', (req, res) => {
  dbRun('DELETE FROM verkefni WHERE id = ?', [req.params.id]);
  dbRun('DELETE FROM timaskraning WHERE verkefni_id = ?', [req.params.id]);
  res.json({ message: 'Verkefni eytt' });
});

// API - Tímaskráning
app.get('/api/verkefni/:id/timi', (req, res) => {
  const timi = dbAll('SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning DESC', [req.params.id]);
  res.json(timi);
});

app.post('/api/verkefni/:id/timi', (req, res) => {
  const { tegund, titill, lysing, timi_minutur, dagsetning } = req.body;
  const result = dbRun(`
    INSERT INTO timaskraning (verkefni_id, tegund, titill, lysing, timi_minutur, dagsetning)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [req.params.id, tegund||'', titill||'', lysing||'', timi_minutur||0, dagsetning||'']);
  res.json({ id: result.lastInsertRowid, message: 'Tímaskráning bætt við' });
});

app.delete('/api/timi/:id', (req, res) => {
  dbRun('DELETE FROM timaskraning WHERE id = ?', [req.params.id]);
  res.json({ message: 'Tímaskráning eytt' });
});

// API - Stofur og Framleiðsla
app.get('/api/stofur', (req, res) => {
  res.json(dbAll('SELECT * FROM auglysingar_stofur ORDER BY nafn'));
});

app.get('/api/framleidsla', (req, res) => {
  res.json(dbAll('SELECT * FROM framleidsla ORDER BY nafn'));
});

// API - PDF
app.get('/api/verkefni/:id/pdf', async (req, res) => {
  const v = dbGet('SELECT * FROM verkefni WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).send('Verkefni fannst ekki');
  
  const timi = dbAll('SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning', [req.params.id]);
  const totalMin = timi.filter(t => t.tegund === 'timi').reduce((s, t) => s + (t.timi_minutur || 0), 0);
  const totalSimtol = timi.filter(t => t.tegund === 'simtal').length;
  const totalEmail = timi.filter(t => t.tegund === 'email').length;
  const totalFundir = timi.filter(t => t.tegund === 'fundur').length;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tímaskýrsla - ${v.nafn}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #f5a623; border-bottom: 2px solid #f5a623; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
    .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
    .info-label { font-weight: bold; color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5a623; color: #000; }
    .totals { display: flex; gap: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; margin-top: 30px; }
    .total-item { text-align: center; }
    .total-value { font-size: 24px; font-weight: bold; color: #f5a623; }
    .total-label { font-size: 12px; color: #666; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>Tímaskýrsla</h1>
  <h2>${v.nafn}</h2>
  
  <div class="info">
    <div class="info-item"><div class="info-label">Lesari</div>${v.lesari || '—'}</div>
    <div class="info-item"><div class="info-label">Staða</div>${v.stada}</div>
    <div class="info-item"><div class="info-label">Framleiðsla</div>${v.framleidsla || '—'}</div>
    <div class="info-item"><div class="info-label">Pródúser</div>${v.produser || '—'}</div>
    <div class="info-item"><div class="info-label">Auglýsingastofa</div>${v.stofa || '—'}</div>
    <div class="info-item"><div class="info-label">Tengiliður</div>${v.tengill_nafn || '—'}</div>
    <div class="info-item"><div class="info-label">Móttekið</div>${v.mottekid || '—'}</div>
    <div class="info-item"><div class="info-label">Skilað</div>${v.skilad || '—'}</div>
  </div>
  
  <h2>Tímaskráningar</h2>
  <table>
    <tr><th>Dags.</th><th>Tegund</th><th>Lýsing</th><th>Tími</th></tr>
    ${timi.map(t => `<tr><td>${t.dagsetning||'—'}</td><td>${t.tegund}</td><td>${t.titill||'—'}</td><td>${t.timi_minutur ? t.timi_minutur + ' mín' : '—'}</td></tr>`).join('')}
  </table>
  
  <div class="totals">
    <div class="total-item"><div class="total-value">${totalMin}</div><div class="total-label">mínútur</div></div>
    <div class="total-item"><div class="total-value">${totalSimtol}</div><div class="total-label">símtöl</div></div>
    <div class="total-item"><div class="total-value">${totalEmail}</div><div class="total-label">email</div></div>
    <div class="total-item"><div class="total-value">${totalFundir}</div><div class="total-label">fundir</div></div>
  </div>
  
  <div class="footer">Bessi - Audioland • ${new Date().toLocaleDateString('is-IS')}</div>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Google Docs API
app.get('/api/google-doc/:docId', async (req, res) => {
  const auth = getGoogleAuth();
  if (!auth) return res.status(401).json({ error: 'Google Auth ekki uppsett' });
  try {
    const docs = google.docs({ version: 'v1', auth });
    const doc = await docs.documents.get({ documentId: req.params.docId });
    let text = '';
    doc.data.body?.content?.forEach(item => {
      item.paragraph?.elements?.forEach(el => {
        if (el.textRun?.content) text += el.textRun.content;
      });
    });
    res.json({ title: doc.data.title, content: text.trim() });
  } catch (err) {
    console.error('Google Docs villa:', err);
    res.status(500).json({ error: 'Villa við að sækja skjal' });
  }
});

// Senda í booth
app.post('/api/booth/send', (req, res) => {
  const { nafn, handrit, lesari, take } = req.body;
  broadcastToBooth({ type: 'handrit', nafn, handrit, lesari, take: take || 1 });
  res.json({ message: 'Sent í booth' });
});

// Start
const PORT = process.env.PORT || 3001;

initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log('🐕 Bessi keyrir á http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('Villa við database:', err);
  process.exit(1);
});
