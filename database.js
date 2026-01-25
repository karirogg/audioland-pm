const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bessi.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Hlaða gögnum ef til
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Verkefni tafla
  db.run(`
    CREATE TABLE IF NOT EXISTS verkefni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL,
      mynd TEXT,
      
      framleidsla TEXT,
      produser TEXT,
      produser_simi TEXT,
      produser_netfang TEXT,
      
      stofa TEXT,
      tengill_nafn TEXT,
      tengill_simi TEXT,
      tengill_netfang TEXT,
      
      art_director TEXT,
      art_director_simi TEXT,
      copywriter TEXT,
      copywriter_simi TEXT,
      
      lesari TEXT,
      lesari_simi TEXT,
      lesari_netfang TEXT,
      
      handrit TEXT,
      google_doc_url TEXT,
      google_doc_id TEXT,
      
      tonlist_titill TEXT,
      tonlist_heimild TEXT,
      tonlist_url TEXT,
      tonlist_kostnadur REAL,
      
      stada TEXT DEFAULT 'Í vinnslu',
      athugasemdir TEXT,
      
      payday_tengill TEXT,
      dropbox_slod TEXT,
      
      mottekid TEXT,
      skilad TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tímaskráningar
  db.run(`
    CREATE TABLE IF NOT EXISTS timaskraning (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verkefni_id INTEGER NOT NULL,
      tegund TEXT NOT NULL,
      titill TEXT,
      lysing TEXT,
      timi_minutur INTEGER,
      dagsetning TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (verkefni_id) REFERENCES verkefni(id)
    )
  `);

  // Auglýsingastofur
  db.run(`
    CREATE TABLE IF NOT EXISTS auglysingar_stofur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL UNIQUE,
      netfang TEXT,
      simi TEXT
    )
  `);

  // Framleiðslufyrirtæki
  db.run(`
    CREATE TABLE IF NOT EXISTS framleidsla (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL UNIQUE,
      netfang TEXT,
      simi TEXT
    )
  `);

  // Lesendur
  db.run(`
    CREATE TABLE IF NOT EXISTS lesendur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL,
      netfang TEXT,
      simi TEXT
    )
  `);

  // Insert nokkrar auglýsingastofur sem dæmi
  const stofur = ['Pipar TBWA', 'Íslenska', 'Brandenburg', 'Hvíta húsið', "Jónsson & Le'macks", 'Mannvit', 'Sahara'];
  stofur.forEach(stofa => {
    try {
      db.run('INSERT OR IGNORE INTO auglysingar_stofur (nafn) VALUES (?)', [stofa]);
    } catch (e) {}
  });

  // Insert nokkur framleiðslufyrirtæki sem dæmi
  const framleidsla = ['Sagafilm', 'Truenorth', 'RVK Studios', 'Glassriver', 'Ísland í dag'];
  framleidsla.forEach(f => {
    try {
      db.run('INSERT OR IGNORE INTO framleidsla (nafn) VALUES (?)', [f]);
    } catch (e) {}
  });

  saveDatabase();
  console.log('Bessi database setup complete! 🐕');
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

// Vista reglulega
setInterval(saveDatabase, 5000);

module.exports = { initDatabase, getDb, saveDatabase };
