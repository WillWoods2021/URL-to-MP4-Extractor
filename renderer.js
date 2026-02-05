const urlEl = document.getElementById('url');
const chooseBtn = document.getElementById('choose');
const savePathEl = document.getElementById('savePath');
const recodeEl = document.getElementById('recode');
const useCookiesEl = document.getElementById('useCookies');
const browserEl = document.getElementById('browser');
const chooseCookiesBtn = document.getElementById('chooseCookies');
const cookiesPathEl = document.getElementById('cookiesPath');
const listBtn = document.getElementById('list');
const downloadBtn = document.getElementById('download');
const outputEl = document.getElementById('output');

let savePath = '';
let cookiesFile = '';
let unsubscribeLog = null;

function log(text) {
  outputEl.textContent += String(text);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput() {
  outputEl.textContent = '';
}

function setRunning(running) {
  chooseBtn.disabled = running;
  chooseCookiesBtn.disabled = running;
  listBtn.disabled = running;
  downloadBtn.disabled = running;
}

unsubscribeLog = window.api.onLog((msg) => log(msg));

chooseBtn.addEventListener('click', async () => {
  const chosen = await window.api.chooseLocation();
  if (chosen) {
    savePath = chosen;
    savePathEl.textContent = chosen;
    log(`Save location: ${chosen}\n`);
  }
});

chooseCookiesBtn.addEventListener('click', async () => {
  const path = await window.api.chooseCookiesFile();
  if (path) {
    cookiesFile = path;
    cookiesPathEl.textContent = path;
    log(`Cookies file: ${path}\n`);
  }
});

listBtn.addEventListener('click', async () => {
  clearOutput();
  const url = (urlEl.value || '').trim();
  const useCookies = useCookiesEl.checked;
  const browser = browserEl.value;

  if (!url) {
    log('Error: Paste a URL first.\n');
    return;
  }

  setRunning(true);
  try {
    const result = await window.api.listFormats({ url, useCookies, browser, cookiesFile });
    log(result + '\n');
  } catch (err) {
    log('Failed to list formats.\n' + String(err) + '\n');
  } finally {
    setRunning(false);
  }
});

downloadBtn.addEventListener('click', async () => {
  clearOutput();
  const url = (urlEl.value || '').trim();
  if (!url) {
    log('Error: Paste a URL first.\n');
    return;
  }
  if (!savePath) {
    log('Error: Choose a save location.\n');
    return;
  }

  const recode = recodeEl.checked;
  const useCookies = useCookiesEl.checked;
  const browser = browserEl.value;

  setRunning(true);
  try {
    const res = await window.api.downloadMp4({ url, savePath, recode, useCookies, browser, cookiesFile });
    if (res.ok) {
      log(res.message + '\n');
    } else {
      log('Download failed.\n\n' + (res.message || 'No diagnostic output available.') + '\n');
      if (useCookies && !cookiesFile && /Failed to decrypt with DPAPI/i.test(res.message || '')) {
        log('\nTip: Provide a cookies.txt via "Choose cookies.txt" to avoid DPAPI errors.\n');
      }
    }
  } catch (err) {
    log('Unexpected error.\n' + String(err) + '\n');
  } finally {
    setRunning(false);
  }
});