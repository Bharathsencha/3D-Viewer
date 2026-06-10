const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database.cjs');

app.whenReady().then(() => {
  db.initDatabase();
  ipcMain.handle('get-app-path', () => __dirname);

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

  win.loadURL('http://localhost:8080/build/package/website/index.html#model=file:///home/bharath/Desktop/3D-Viewer/package.json');
});
