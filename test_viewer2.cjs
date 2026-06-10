const { app, BrowserWindow } = require('electron');
const path = require('path');
const db = require('./database.cjs');

app.whenReady().then(() => {
  db.initDatabase();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.webContents.on('console-message', (event, level, message) => {
    console.log(`[Browser Console] ${message}`);
  });

  win.loadURL('http://localhost:8080'); // Vite dev server
});
