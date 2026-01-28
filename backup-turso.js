#!/usr/bin/env node
/**
 * Backup Turso database to local JSON file
 * Usage: node backup-turso.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_TOKEN,
});

const TABLES = [
  'users',
  'verkefni',
  'timaskraning',
  'auglysingar_stofur',
  'framleidsla',
  'lesendur',
  'adkeypt'
];

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, 'backups');

  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const backup = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  console.log('Backing up Turso database...\n');

  for (const table of TABLES) {
    try {
      const result = await client.execute(`SELECT * FROM ${table}`);
      backup.tables[table] = result.rows;
      console.log(`  ${table}: ${result.rows.length} rows`);
    } catch (err) {
      console.log(`  ${table}: skipped (${err.message})`);
      backup.tables[table] = [];
    }
  }

  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(backupDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

  console.log(`\nBackup saved to: ${filepath}`);

  // Also save as 'latest.json' for easy access
  const latestPath = path.join(backupDir, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2));
  console.log(`Also saved to: ${latestPath}`);
}

backup().catch(err => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
