const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 720,
    minHeight: 540,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/**
 * Run yt-dlp with multiple Windows-friendly invocation attempts.
 * Tries: yt-dlp, yt-dlp.exe, yt-dlp.cmd, py -m yt_dlp, python -m yt_dlp
 * Streams stdout/stderr to UI log in real time.
 */
async function runYtDlp(args, sendLog) {
  const attempts = [
    { cmd: 'yt-dlp', args },
    { cmd: 'yt-dlp.exe', args },
    { cmd: 'yt-dlp.cmd', args },
    { cmd: 'py', args: ['-m', 'yt_dlp', ...args] },
    { cmd: 'python', args: ['-m', 'yt_dlp', ...args] }
  ];

  for (const attempt of attempts) {
    const result = await new Promise((resolve) => {
      let output = '';
      let closed = false;

      const proc = spawn(attempt.cmd, attempt.args, { shell: false });

      const relay = (chunk) => {
        const text = chunk.toString();
        output += text;
        if (typeof sendLog === 'function' && win) win.webContents.send('log', text);
      };

      proc.stdout?.on('data', relay);
      proc.stderr?.on('data', relay);

      proc.on('error', (err) => {
        // ENOENT: command not found; continue to next attempt
        if (err && err.code === 'ENOENT') {
          resolve(null);
        } else {
          resolve({ ok: false, code: 1, output: `Error starting ${attempt.cmd}: ${err.message}\n` });
        }
      });

      proc.on('close', (code) => {
        closed = true;
        resolve({ ok: code === 0, code, output });
      });

      // Failsafe in case close doesn't fire
      setTimeout(() => {
        if (!closed) resolve({ ok: false, code: 1, output: output || 'Process timeout.\n' });
      }, 60000);
    });

    if (result) {
      // Found a command that executed (success or failure)
      return result;
    }
    // Else try next attempt
  }

  return { ok: false, code: 1, output: 'Could not start yt-dlp using any known method.\n' };
}

// Choose save directory
ipcMain.handle('choose-location', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose Save Location',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
});

// Choose cookies.txt (Netscape format)
ipcMain.handle('choose-cookies-file', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Select cookies.txt (Netscape format)',
    properties: ['openFile'],
    filters: [
      { name: 'Cookies', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
});

// List available formats
ipcMain.handle('list-formats', async (_evt, { url, useCookies, browser, cookiesFile }) => {
  if (!url) return 'Error: URL required.';
  const args = ['--no-playlist', '--newline', '-F', url];

  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  } else if (useCookies) {
    args.push('--cookies-from-browser', browser || 'chrome');
  }

  // Best-effort Referer
  try {
    if (url.includes('://')) {
      const domain = url.split('://')[1].split('/')[0];
      const referer = `https://${domain}/`;
      args.push('--add-header', `Referer: ${referer}`);
    }
  } catch (_) {}

  const result = await runYtDlp(args, (text) => {
    if (win) win.webContents.send('log', text);
  });

  return result.output || 'No output.';
});

// Download MP4 with robust fallback and cookies handling
ipcMain.handle('download-mp4', async (_evt, payload) => {
  const { url, savePath, recode, useCookies, browser, cookiesFile } = payload || {};
  if (!url) return { ok: false, message: 'Paste a URL first.' };
  if (!savePath) return { ok: false, message: 'Choose a save location.' };

  const outputTemplate = path.join(savePath, '%(title)s.%(ext)s');

  const buildArgs = (fmt, useCookiesFlag) => {
    const args = ['--no-playlist', '--newline', '-o', outputTemplate, url];
    if (fmt) {
      args.push('-f', fmt);
    }
    if (recode) {
      args.push('--recode-video', 'mp4');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    if (cookiesFile) {
      args.push('--cookies', cookiesFile);
    } else if (useCookiesFlag) {
      args.push('--cookies-from-browser', browser || 'chrome');
    }

    // Best-effort Referer
    try {
      if (url.includes('://')) {
        const domain = url.split('://')[1].split('/')[0];
        const referer = `https://${domain}/`;
        args.push('--add-header', `Referer: ${referer}`);
      }
    } catch (_) {}

    return args;
  };

  if (win) win.webContents.send('log', 'Starting download...\n');

  // First attempt: let yt-dlp auto-select and merge best formats (no -f)
  const first = await runYtDlp(buildArgs(null, useCookies), (text) => {
    if (win) win.webContents.send('log', text);
  });

  if (first.ok) {
    return { ok: true, message: 'Download complete.' };
  }

  // If DPAPI failed while using browser cookies, retry without cookies
  if (!cookiesFile && useCookies && /Failed to decrypt with DPAPI/i.test(first.output || '')) {
    if (win) win.webContents.send('log', '\nBrowser cookie decryption failed. Retrying without cookies...\n');
    const noCookiesRes = await runYtDlp(buildArgs(null, false), (text) => {
      if (win) win.webContents.send('log', text);
    });
    if (noCookiesRes.ok) {
      return { ok: true, message: 'Download complete (no cookies).' };
    }
  }

  if (win) win.webContents.send('log', '\nFirst attempt failed, trying fallback format...\n');

  // Fallback: pre-merged best ("b") suppresses yt-dlp warning about "-f best"
  const fallback = await runYtDlp(buildArgs('b', useCookies), (text) => {
    if (win) win.webContents.send('log', text);
  });

  if (fallback.ok) {
    return { ok: true, message: 'Download complete (used fallback format).' };
  }

  // Diagnostics: list formats
  const listArgs = ['--no-playlist', '--newline', '-F', url];
  if (cookiesFile) listArgs.push('--cookies', cookiesFile);
  else if (useCookies) listArgs.push('--cookies-from-browser', browser || 'chrome');

  try {
    if (url.includes('://')) {
      const domain = url.split('://')[1].split('/')[0];
      const referer = `https://${domain}/`;
      listArgs.push('--add-header', `Referer: ${referer}`);
    }
  } catch (_) {}

  const listed = await runYtDlp(listArgs, (text) => {
    if (win) win.webContents.send('log', text);
  });

  const diagnostic = [
    'First attempt:\n',
    first.output || '(no output)',
    '\n\nFallback attempt:\n',
    fallback.output || '(no output)',
    '\n\nFormats (-F):\n',
    listed.output || '(no output)'
  ].join('');

  return { ok: false, message: diagnostic.slice(0, 4000) };
});