'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Auto-updater ──────────────────────────────────────────────────────────────
// Only active in packaged builds (electron-updater no-ops in dev mode)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload    = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version);
    // Notify renderer so user can choose to restart
    BrowserWindow.getAllWindows().forEach(w => {
      if (w && !w.isDestroyed()) {
        w.webContents.send('app:update-ready', { version: info.version });
      }
    });
  });
  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
  });
} catch (_) {
  // electron-updater not available in dev/test environments — continue gracefully
}

// ── Singleton lock ────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let db = null;
let syncScheduler = null;

// ── Window creation ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'modelindex.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates after window is visible (delay avoids blocking startup)
    if (autoUpdater && app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 8000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'modelindex.db');

  // Lazy-require after app ready so native modules are bound to Electron ABI
  db = require('./data/db');
  db.initialize(dbPath);

  syncScheduler = require('./data/sync-scheduler');
  syncScheduler.initScheduler(db); // registers cron jobs, IPC handlers, and catch-up sync

  createWindow();
  registerIpcHandlers();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────
function registerIpcHandlers() {
  // ── db namespace ────────────────────────────────────────────────────────────
  ipcMain.handle('db:getModels', (_e, filters) => db.getModels(filters));
  ipcMain.handle('db:getScores', (_e, modelId) => db.getScores(modelId));
  ipcMain.handle('db:getModelChangelog', (_e, modelId) => db.getModelChangelog(modelId));
  ipcMain.handle('db:getUserPricing', (_e, modelId) => db.getUserPricing(modelId));
  ipcMain.handle('db:saveUserPricing', (_e, data) => db.saveUserPricing(data));
  ipcMain.handle('db:getAllUserPricing', () => db.getAllUserPricing());
  ipcMain.handle('db:deleteUserPricing', (_e, modelId) => db.deleteUserPricing(modelId));
  ipcMain.handle('db:getBaseline', () => db.getBaseline());
  ipcMain.handle('db:getLicenseCompat', () => db.getLicenseCompat());
  ipcMain.handle('db:getHardwareManifest', () => db.getHardwareManifest());
  ipcMain.handle('db:saveIndex', (_e, config) => db.saveIndex(config));
  ipcMain.handle('db:saveIndexVersion', (_e, indexId, snapshot) => db.saveIndexVersion(indexId, snapshot));
  ipcMain.handle('db:getIndexes', () => db.getIndexes());
  ipcMain.handle('db:getIndex', (_e, id) => db.getIndex(id));
  ipcMain.handle('db:deleteIndex', (_e, id) => db.deleteIndex(id));
  ipcMain.handle('db:getIndexVersions', (_e, indexId) => db.getIndexVersions(indexId));
  ipcMain.handle('db:getSyncLog', (_e, connectorId, limit) => db.getSyncLog(connectorId, limit));
  ipcMain.handle('db:getLastSync', (_e, connectorId) => db.getLastSync(connectorId));

  // ── eval namespace ──────────────────────────────────────────────────────────
  ipcMain.handle('eval:getFactorSchema', () => {
    const { FACTOR_SCHEMA } = require('./eval/factors');
    return FACTOR_SCHEMA;
  });
  ipcMain.handle('eval:getPresets', () => {
    const { PRESETS } = require('./eval/presets');
    return PRESETS;
  });
  ipcMain.handle('eval:computeMCS', (_e, modelScores, factorWeights, subDimWeights) => {
    const { computeMCS } = require('./eval/mcs');
    const baseline = db.getBaseline();
    return computeMCS(modelScores, factorWeights, subDimWeights, baseline);
  });
  ipcMain.handle('eval:computeBatchMCS', (_e, allModelScores, factorWeights, subDimWeights) => {
    const { computeMCS } = require('./eval/mcs');
    const baseline = db.getBaseline();
    return allModelScores.map(({ modelId, scores }) => ({
      modelId,
      ...computeMCS(scores, factorWeights, subDimWeights, baseline),
    }));
  });
  ipcMain.handle('eval:runSensitivity', (_e, allModelScores, factorWeights, subDimWeights, step) => {
    const { runSensitivity } = require('./eval/sensitivity');
    const baseline = db.getBaseline();
    return runSensitivity(allModelScores, factorWeights, subDimWeights, baseline, step);
  });

  // ── sync namespace — IPC handlers registered by sync-scheduler.initScheduler() ──

  // ── shell namespace ─────────────────────────────────────────────────────────
  ipcMain.handle('shell:saveFile', async (_e, defaultName, content, filters) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (!filePath) return { saved: false };
    fs.writeFileSync(filePath, content, 'utf8');
    return { saved: true, filePath };
  });
  ipcMain.handle('shell:exportPDF', async (_e, htmlContent) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'modelindex-report.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return { saved: false };
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    fs.writeFileSync(filePath, pdfData);
    return { saved: true, filePath };
  });
  ipcMain.handle('shell:backupDb', async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `modelindex-backup-${new Date().toISOString().slice(0, 16).replace('T', '-')}.modelindex-backup`,
      filters: [{ name: 'ModelIndex Backup', extensions: ['modelindex-backup'] }],
    });
    if (!filePath) return { saved: false };
    await db.backup(filePath);
    return { saved: true, filePath };
  });
  ipcMain.handle('shell:restoreDb', async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'ModelIndex Backup', extensions: ['modelindex-backup'] }],
      properties: ['openFile'],
    });
    if (!filePaths || !filePaths[0]) return { restored: false };
    await db.restore(filePaths[0], app.getPath('userData'));
    return { restored: true };
  });
  ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));
  ipcMain.handle('shell:getAppVersion', () => app.getVersion());
  ipcMain.handle('shell:installUpdate', () => {
    if (autoUpdater) autoUpdater.quitAndInstall(false, true);
  });
  ipcMain.handle('shell:readFile', async (_e, filters) => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (!filePaths || !filePaths[0]) return null;
    return fs.readFileSync(filePaths[0], 'utf8');
  });
}
