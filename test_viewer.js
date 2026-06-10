const { app, BrowserWindow } = require('electron');
app.on('ready', () => {
  const win = new BrowserWindow({ show: true });
  win.loadURL('http://localhost:5173');
  win.webContents.openDevTools();
});
