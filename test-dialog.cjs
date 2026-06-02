const { dialog, app } = require('electron');
app.whenReady().then(async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }]
    });
    console.log(result);
  } catch (e) {
    console.error(e);
  }
  app.quit();
});
