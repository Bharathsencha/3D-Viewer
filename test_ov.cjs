const { app, BrowserWindow, ipcMain } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: false, nodeIntegration: true }});
  win.loadFile('shell/dist/index.html');
  win.webContents.once('did-finish-load', async () => {
    try {
      const type = await win.webContents.executeJavaScript(`typeof window.OV.app.viewer.GetImageAsDataUrl`);
      console.log('type:', type);
      app.quit();
    } catch(e) {
      console.error(e);
      app.quit();
    }
  });
});
