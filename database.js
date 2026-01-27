const fs = require("fs");
const path = require("path");

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const DB_PATH = path.join(__dirname, "bessi.db");

// Database abstraction - holds either sql.js db or Turso client
let db = null;
let tursoClient = null;

// SQL statements for table creation
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS verkefni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verkefnanumer TEXT,
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
  )`,
  `CREATE TABLE IF NOT EXISTS timaskraning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verkefni_id INTEGER NOT NULL,
    tegund TEXT NOT NULL,
    titill TEXT,
    lysing TEXT,
    timi_minutur INTEGER,
    dagsetning TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (verkefni_id) REFERENCES verkefni(id)
  )`,
  `CREATE TABLE IF NOT EXISTS auglysingar_stofur (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nafn TEXT NOT NULL UNIQUE,
    netfang TEXT,
    simi TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS framleidsla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nafn TEXT NOT NULL UNIQUE,
    netfang TEXT,
    simi TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS lesendur (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nafn TEXT NOT NULL,
    netfang TEXT,
    simi TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS adkeypt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verkefni_id INTEGER NOT NULL,
    titill TEXT,
    heimild TEXT,
    url TEXT,
    kostnadur INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (verkefni_id) REFERENCES verkefni(id)
  )`,
];

async function initTursoDatabase() {
  const { createClient } = require("@libsql/client");

  tursoClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_TOKEN,
  });

  // Create tables
  for (const sql of CREATE_TABLES_SQL) {
    await tursoClient.execute(sql);
  }

  // Insert sample data
  const stofur = [
    "Pipar TBWA",
    "Íslenska",
    "Brandenburg",
    "Hvíta húsið",
    "Jónsson & Le'macks",
    "Mannvit",
    "Sahara",
  ];
  for (const stofa of stofur) {
    try {
      await tursoClient.execute({
        sql: "INSERT OR IGNORE INTO auglysingar_stofur (nafn) VALUES (?)",
        args: [stofa],
      });
    } catch (e) {}
  }

  const framleidslaList = [
    "Sagafilm",
    "Truenorth",
    "RVK Studios",
    "Glassriver",
    "Ísland í dag",
  ];
  for (const f of framleidslaList) {
    try {
      await tursoClient.execute({
        sql: "INSERT OR IGNORE INTO framleidsla (nafn) VALUES (?)",
        args: [f],
      });
    } catch (e) {}
  }

  console.log("Bessi database setup complete (Turso)! 🐕");
}

async function initSqliteDatabase() {
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file),
  });

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  for (const sql of CREATE_TABLES_SQL) {
    db.run(sql);
  }

  // Insert sample data
  const stofur = [
    "Pipar TBWA",
    "Íslenska",
    "Brandenburg",
    "Hvíta húsið",
    "Jónsson & Le'macks",
    "Mannvit",
    "Sahara",
  ];
  stofur.forEach((stofa) => {
    try {
      db.run("INSERT OR IGNORE INTO auglysingar_stofur (nafn) VALUES (?)", [
        stofa,
      ]);
    } catch (e) {}
  });

  const framleidslaList = [
    "Sagafilm",
    "Truenorth",
    "RVK Studios",
    "Glassriver",
    "Ísland í dag",
  ];
  framleidslaList.forEach((f) => {
    try {
      db.run("INSERT OR IGNORE INTO framleidsla (nafn) VALUES (?)", [f]);
    } catch (e) {}
  });

  saveDatabase();
  console.log("Bessi database setup complete (SQLite)! 🐕");
}

async function initDatabase() {
  if (isProduction) {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_TOKEN) {
      throw new Error(
        "TURSO_DATABASE_URL and TURSO_TOKEN must be set in production",
      );
    }
    await initTursoDatabase();
  } else {
    await initSqliteDatabase();
  }
}

function saveDatabase() {
  if (!isProduction && db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

function getTursoClient() {
  return tursoClient;
}

function isUsingTurso() {
  return isProduction;
}

// Save periodically (only for SQLite)
if (!isProduction) {
  setInterval(saveDatabase, 5000);
}

module.exports = {
  initDatabase,
  getDb,
  getTursoClient,
  isUsingTurso,
  saveDatabase,
};
