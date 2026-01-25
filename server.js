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
  
  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const { client_id, client_secret } = credentials.installed || credentials.web;
    
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      'http://localhost:3001/oauth2callback'
    );
    
    oauth2Client.setCredentials(token);
    googleAuth = oauth2Client;
    return oauth2Client;
  } catch (err) {
    console.error('Google Auth villa:', err);
    return null;
  }
}

// WebSocket tengingar - til að synca booth
let boothClients = [];
let currentBoothState = {
  handrit: '',
  nafn: '',
  lesari: '',
  take: 1,
  fontSize: 2,
  autoScroll: false,
  scrollSpeed: 50
};

wss.on('connection', (ws, req) => {
  if (req.url === '/booth-ws') {
    boothClients.push(ws);
    console.log('Booth tengdist');
    
    // Senda núverandi stöðu til nýs booth
    ws.send(JSON.stringify({ type: 'state', ...currentBoothState }));
    
    ws.on('close', () => {
      boothClients = boothClients.filter(client => client !== ws);
      console.log('Booth aftengdist');
    });
  }
});

function broadcastToBooth(data) {
  // Uppfæra state
  if (data.type === 'handrit') {
    currentBoothState = { ...currentBoothState, ...data };
  } else if (data.type === 'settings') {
    currentBoothState = { ...currentBoothState, ...data };
  }
  
  boothClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// Helper til að keyra queries
function dbAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results[0] || null;
}

function dbRun(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDatabase();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
}

// API routes

// Sækja öll verkefni
app.get('/api/verkefni', (req, res) => {
  const verkefni = dbAll('SELECT * FROM audlysingar ORDER BY created_at DESC');
  res.json(verkefni);
});

// Sækja eitt verkefni
app.get('/api/verkefni/:id', (req, res) => {
  const verkefni = dbGet('SELECT * FROM audlysingar WHERE id = ?', [req.params.id]);
  
  if (!verkefni) {
    return res.status(404).json({ error: 'Verkefni fannst ekki' });
  }
  res.json(verkefni);
});

// Búa til nýtt verkefni
app.post('/api/verkefni', (req, res) => {
  const {
    nafn, stofa, tengill_nafn, tengill_simi,
    art_director, art_director_simi, copywriter, copywriter_simi,
    lesari, handrit, google_doc_url, athugasemdir, stada, payday_tengill, dropbox_slod, mottekid, skilad
  } = req.body;

  // Extracta doc ID úr URL
  let google_doc_id = '';
  if (google_doc_url) {
    const match = google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) google_doc_id = match[1];
  }

  const result = dbRun(`
    INSERT INTO audlysingar (
      nafn, stofa, tengill_nafn, tengill_simi,
      art_director, art_director_simi, copywriter, copywriter_simi,
      lesari, handrit, google_doc_url, google_doc_id, athugasemdir, stada, payday_tengill, dropbox_slod, mottekid, skilad
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    nafn || '', stofa || '', tengill_nafn || '', tengill_simi || '',
    art_director || '', art_director_simi || '', copywriter || '', copywriter_simi || '',
    lesari || '', handrit || '', google_doc_url || '', google_doc_id || '', athugasemdir || '', stada || 'Bíður', 
    payday_tengill || '', dropbox_slod || '', mottekid || '', skilad || ''
  ]);

  res.json({ id: result.lastInsertRowid, message: 'Verkefni búið til' });
});

// Uppfæra verkefni
app.put('/api/verkefni/:id', (req, res) => {
  const {
    nafn, stofa, tengill_nafn, tengill_simi,
    art_director, art_director_simi, copywriter, copywriter_simi,
    lesari, handrit, google_doc_url, athugasemdir, stada, payday_tengill, dropbox_slod, mottekid, skilad
  } = req.body;

  // Extracta doc ID úr URL
  let google_doc_id = '';
  if (google_doc_url) {
    const match = google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) google_doc_id = match[1];
  }

  dbRun(`
    UPDATE audlysingar SET
      nafn = ?, stofa = ?, tengill_nafn = ?, tengill_simi = ?,
      art_director = ?, art_director_simi = ?, copywriter = ?, copywriter_simi = ?,
      lesari = ?, handrit = ?, google_doc_url = ?, google_doc_id = ?, athugasemdir = ?, stada = ?, payday_tengill = ?, dropbox_slod = ?,
      mottekid = ?, skilad = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    nafn || '', stofa || '', tengill_nafn || '', tengill_simi || '',
    art_director || '', art_director_simi || '', copywriter || '', copywriter_simi || '',
    lesari || '', handrit || '', google_doc_url || '', google_doc_id || '', athugasemdir || '', stada || 'Bíður', 
    payday_tengill || '', dropbox_slod || '',
    mottekid || '', skilad || '',
    req.params.id
  ]);

  res.json({ message: 'Verkefni uppfært' });
});

// Eyða verkefni
app.delete('/api/verkefni/:id', (req, res) => {
  dbRun('DELETE FROM audlysingar WHERE id = ?', [req.params.id]);
  res.json({ message: 'Verkefni eytt' });
});

// Senda handrit í booth
app.post('/api/booth/birta', (req, res) => {
  const { verkefni_id, take_number, fontSize, autoScroll, scrollSpeed } = req.body;
  
  const verkefni = dbGet('SELECT nafn, handrit, lesari, google_doc_id FROM audlysingar WHERE id = ?', [verkefni_id]);

  if (!verkefni) {
    return res.status(404).json({ error: 'Verkefni fannst ekki' });
  }

  broadcastToBooth({
    type: 'handrit',
    nafn: verkefni.nafn,
    handrit: verkefni.handrit,
    lesari: verkefni.lesari,
    googleDocId: verkefni.google_doc_id || null,
    take: take_number || 1,
    fontSize: fontSize || 2,
    autoScroll: autoScroll || false,
    scrollSpeed: scrollSpeed || 50
  });

  res.json({ message: 'Sent í booth' });
});

// Hreinsa booth
app.post('/api/booth/hreinsa', (req, res) => {
  broadcastToBooth({ type: 'hreinsa' });
  res.json({ message: 'Booth hreinsað' });
});

// Uppfæra take númer
app.post('/api/booth/take', (req, res) => {
  const { take_number } = req.body;
  broadcastToBooth({ type: 'take', take: take_number });
  res.json({ message: 'Take uppfært' });
});

// Uppfæra booth stillingar (leturstærð, autoscroll)
app.post('/api/booth/settings', (req, res) => {
  const { fontSize, autoScroll, scrollSpeed } = req.body;
  broadcastToBooth({ 
    type: 'settings', 
    fontSize, 
    autoScroll, 
    scrollSpeed 
  });
  res.json({ message: 'Stillingar uppfærðar' });
});

// Remote scroll toggle
app.post('/api/booth/scroll-toggle', (req, res) => {
  broadcastToBooth({ type: 'scroll-toggle' });
  res.json({ message: 'Scroll toggled' });
});

// Sækja auglýsingastofur
app.get('/api/stofur', (req, res) => {
  const stofur = dbAll('SELECT * FROM auglysingar_stofur ORDER BY nafn');
  res.json(stofur);
});

// Sækja texta úr Google Docs via API
app.post('/api/google-docs/fetch', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL vantar' });
  }

  const auth = getGoogleAuth();
  if (!auth) {
    return res.status(400).json({ error: 'Google Docs ekki tengt. Keyrðu: npm run auth' });
  }

  try {
    // Finna doc ID úr URL
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Ógilt Google Docs URL' });
    }
    
    const docId = match[1];
    const docs = google.docs({ version: 'v1', auth });
    
    const doc = await docs.documents.get({ documentId: docId });
    
    // Extracta texta úr document
    let text = '';
    const content = doc.data.body.content;
    
    for (const element of content) {
      if (element.paragraph) {
        for (const textRun of element.paragraph.elements) {
          if (textRun.textRun && textRun.textRun.content) {
            text += textRun.textRun.content;
          }
        }
      }
    }
    
    res.json({ text: text.trim(), docId, title: doc.data.title });
    
  } catch (error) {
    console.error('Google Docs villa:', error.message);
    if (error.code === 404) {
      res.status(404).json({ error: 'Skjal fannst ekki' });
    } else if (error.code === 403) {
      res.status(403).json({ error: 'Ekki aðgangur að skjali' });
    } else {
      res.status(500).json({ error: 'Villa við að sækja skjal' });
    }
  }
});

// Sækja Google Docs live (fyrir booth polling)
app.get('/api/google-docs/live/:docId', async (req, res) => {
  const auth = getGoogleAuth();
  if (!auth) {
    return res.status(400).json({ error: 'Google Docs ekki tengt' });
  }

  try {
    const docs = google.docs({ version: 'v1', auth });
    const doc = await docs.documents.get({ documentId: req.params.docId });
    
    let text = '';
    const content = doc.data.body.content;
    
    for (const element of content) {
      if (element.paragraph) {
        for (const textRun of element.paragraph.elements) {
          if (textRun.textRun && textRun.textRun.content) {
            text += textRun.textRun.content;
          }
        }
      }
    }
    
    res.json({ text: text.trim(), title: doc.data.title });
    
  } catch (error) {
    res.status(500).json({ error: 'Villa við að sækja skjal' });
  }
});

// Síður
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/booth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booth.html'));
});

const PORT = process.env.PORT || 3000;

// Byrja server eftir að database er tilbúinn
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║           AUDIOLAND VERKEFNASTJÓRNUN                  ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║   Stjórnborð:  http://localhost:${PORT}                 ║
║   Booth:       http://localhost:${PORT}/booth           ║
║                                                       ║
║   Booth á öðru tæki:                                  ║
║   http://[þín-ip]:${PORT}/booth                         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Villa við að ræsa database:', err);
});
