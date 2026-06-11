const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let hashesMap = new Map();
let dbPath = null;

function initDatabase() {
  try {
    const userData = app.getPath('userData');
    dbPath = path.join(userData, 'hashes_v2.json');
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf8');
      const data = JSON.parse(content);
      hashesMap = new Map(Object.entries(data));
    } else {
      hashesMap = new Map();
    }
  } catch (err) {
    console.error('Failed to initialize or load hashes_v2.json:', err);
    hashesMap = new Map();
  }
}

function saveDatabase() {
  if (!dbPath) return;
  try {
    const data = Object.fromEntries(hashesMap);
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save hashes_v2.json:', err);
  }
}

function insertHash(hash, filename) {
  hashesMap.set(filename, hash);
  saveDatabase();
}

function getExistingFilenameByHash(hash) {
  for (const [filename, fileHash] of hashesMap.entries()) {
    if (fileHash === hash) {
      return filename;
    }
  }
  return null;
}

function getAllHashedFiles() {
  return Array.from(hashesMap.keys());
}

function deleteHash(filename) {
  if (hashesMap.delete(filename)) {
    saveDatabase();
  }
}

function getHashByFilename(filename) {
  return hashesMap.get(filename);
}

module.exports = {
  initDatabase,
  insertHash,
  getExistingFilenameByHash,
  getAllHashedFiles,
  deleteHash,
  getHashByFilename
};
