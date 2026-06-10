const { app } = require('electron');
app.on('ready', () => {
  const Database = require('better-sqlite3');
  const db = new Database('/home/bharath/.config/3d-viewer/metadata.db');
  const stmt = db.prepare('SELECT * FROM file_hashes');
  const rows = stmt.all();
  console.log("DBROWS_FILE_HASHES:", rows.length);
  if (rows.length > 0) console.log(rows[0]);
  app.quit();
});
