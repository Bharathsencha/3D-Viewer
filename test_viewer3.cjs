const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
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

  win.loadURL(`file://${__dirname}/shell/dist/index.html`); // Simulate prod
});
