const { app } = require('electron');
app.on('ready', () => {
  const Database = require('better-sqlite3');
  const db = new Database('/home/bharath/.config/3d-viewer/metadata.db');
  const stmt = db.prepare('SELECT * FROM hashes');
  console.log("DBROWS:", stmt.all());
  app.quit();
});
