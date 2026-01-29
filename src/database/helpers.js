// database/helpers.js - Database abstraction for SQLite and Turso

const { getDb, getTursoClient, isUsingTurso, saveDatabase } = require('../../database');

async function dbAll(sql, params = []) {
  if (isUsingTurso()) {
    const client = getTursoClient();
    const result = await client.execute({ sql, args: params });
    return result.rows;
  } else {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }
}

async function dbGet(sql, params = []) {
  const results = await dbAll(sql, params);
  return results[0] || null;
}

async function dbRun(sql, params = []) {
  if (isUsingTurso()) {
    const client = getTursoClient();
    const result = await client.execute({ sql, args: params });
    return { lastInsertRowid: result.lastInsertRowid };
  } else {
    const db = getDb();
    db.run(sql, params);
    saveDatabase();
    return {
      lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0],
    };
  }
}

module.exports = { dbAll, dbGet, dbRun };
