const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Directory chooser
  chooseLocation: () => ipcRenderer.invoke('choose-location'),

  // cookies.txt chooser (Netscape format)
  chooseCookiesFile: () => ipcRenderer.invoke('choose-cookies-file'),

  // List available formats for a URL
  listFormats: (payload) => ipcRenderer.invoke('list-formats', payload),

  // Download with options (savePath, recode, cookies, browser/cookiesFile)
  downloadMp4: (payload) => ipcRenderer.invoke('download-mp4', payload),

  // Subscribe to streaming logs from the main process
  // Returns an unsubscribe function to remove the listener
  onLog: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const listener = (_evt, msg) => {
      try {
        cb(String(msg));
      } catch (_) {
        // Ignore callback errors to avoid breaking logging
      }
    };
    ipcRenderer.on('log', listener);
    return () => ipcRenderer.removeListener('log', listener);
  }
});