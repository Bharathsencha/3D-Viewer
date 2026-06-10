const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'metadata.db');
  db = new Database(dbPath);
  
  db.exec(`
    DROP TABLE IF EXISTS hashes;
    CREATE TABLE IF NOT EXISTS file_hashes (
      filename TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    )
  `);
}

function insertHash(hash, filename) {
  const stmt = db.prepare('INSERT OR REPLACE INTO file_hashes (filename, hash) VALUES (?, ?)');
  stmt.run(filename, hash);
}

function getExistingFilenameByHash(hash) {
  const stmt = db.prepare('SELECT filename FROM file_hashes WHERE hash = ? LIMIT 1');
  const row = stmt.get(hash);
  return row ? row.filename : null;
}

function getAllHashedFiles() {
  const stmt = db.prepare('SELECT filename FROM file_hashes');
  return stmt.all().map(row => row.filename);
}

function deleteHash(filename) {
  const stmt = db.prepare('DELETE FROM file_hashes WHERE filename = ?');
  stmt.run(filename);
}

module.exports = {
  initDatabase,
  insertHash,
  getExistingFilenameByHash,
  getAllHashedFiles,
  deleteHash
};
