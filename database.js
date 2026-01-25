const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'audioland.db');

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

  // Búa til töflur
  db.run(`
    CREATE TABLE IF NOT EXISTS audlysingar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL,
      stofa TEXT,
      tengill_nafn TEXT,
      tengill_simi TEXT,
      art_director TEXT,
      art_director_simi TEXT,
      copywriter TEXT,
      copywriter_simi TEXT,
      lesari TEXT,
      handrit TEXT,
      google_doc_url TEXT,
      google_doc_id TEXT,
      athugasemdir TEXT,
      stada TEXT DEFAULT 'Bíður',
      payday_tengill TEXT,
      dropbox_slod TEXT,
      mottekid TEXT,
      skilad TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS auglysingar_stofur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL UNIQUE,
      netfang TEXT,
      simi TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lesendur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nafn TEXT NOT NULL,
      netfang TEXT,
      simi TEXT
    )
  `);

  // Insert nokkrar auglýsingastofur sem dæmi
  const stofur = ['Pipar TBWA', 'Íslenska', 'Brandenburg', 'Hvíta húsið', "Jónsson & Le'macks"];
  stofur.forEach(stofa => {
    try {
      db.run('INSERT OR IGNORE INTO auglysingar_stofur (nafn) VALUES (?)', [stofa]);
    } catch (e) {}
  });

  saveDatabase();
  console.log('Database setup complete!');
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
