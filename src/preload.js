'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ── Helper ────────────────────────────────────────────────────────────────────
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const on = (channel, cb) => {
  const handler = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

// ── Exposed API ───────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('modelIndex', {

  // ── db ─────────────────────────────────────────────────────────────────────
  db: {
    getModels:          (filters)           => invoke('db:getModels', filters),
    getScores:          (modelId)           => invoke('db:getScores', modelId),
    getModelChangelog:  (modelId)           => invoke('db:getModelChangelog', modelId),
    getUserPricing:     (modelId)           => invoke('db:getUserPricing', modelId),
    saveUserPricing:    (data)              => invoke('db:saveUserPricing', data),
    getAllUserPricing:   ()                  => invoke('db:getAllUserPricing'),
    deleteUserPricing:  (modelId)           => invoke('db:deleteUserPricing', modelId),
    getBaseline:        ()                  => invoke('db:getBaseline'),
    getLicenseCompat:   ()                  => invoke('db:getLicenseCompat'),
    getHardwareManifest:()                  => invoke('db:getHardwareManifest'),
    saveIndex:          (config)            => invoke('db:saveIndex', config),
    saveIndexVersion:   (indexId, snapshot) => invoke('db:saveIndexVersion', indexId, snapshot),
    getIndexes:         ()                  => invoke('db:getIndexes'),
    getIndex:           (id)                => invoke('db:getIndex', id),
    deleteIndex:        (id)                => invoke('db:deleteIndex', id),
    getIndexVersions:   (indexId)           => invoke('db:getIndexVersions', indexId),
    getSyncLog:         (connectorId, limit)=> invoke('db:getSyncLog', connectorId, limit),
    getLastSync:        (connectorId)       => invoke('db:getLastSync', connectorId),
  },

  // ── eval ───────────────────────────────────────────────────────────────────
  eval: {
    getFactorSchema:  ()                                      => invoke('eval:getFactorSchema'),
    getPresets:       ()                                      => invoke('eval:getPresets'),
    computeMCS:       (modelScores, weights, subDimWeights)   => invoke('eval:computeMCS', modelScores, weights, subDimWeights),
    computeBatchMCS:  (allModelScores, weights, subDimWeights)=> invoke('eval:computeBatchMCS', allModelScores, weights, subDimWeights),
    runSensitivity:   (allModelScores, weights, subDimWeights, step) => invoke('eval:runSensitivity', allModelScores, weights, subDimWeights, step),
  },

  // ── sync ───────────────────────────────────────────────────────────────────
  sync: {
    triggerManualSync:    (connectorId)           => invoke('sync:triggerManualSync', connectorId),
    triggerAll:           ()                      => invoke('sync:triggerAll'),
    getConnectorStatuses: ()                      => invoke('sync:getConnectorStatuses'),
    importFile:           (connectorId, filePath) => invoke('sync:importFile', connectorId, filePath),
    onSyncProgress:       (cb)                    => on('sync:progress', cb),
    onSyncComplete:       (cb)                    => on('sync:complete', cb),
    onSyncError:          (cb)                    => on('sync:error', cb),
  },

  // ── shell ──────────────────────────────────────────────────────────────────
  shell: {
    saveFile:      (defaultName, content, filters) => invoke('shell:saveFile', defaultName, content, filters),
    exportPDF:     (htmlContent)                   => invoke('shell:exportPDF', htmlContent),
    backupDb:      ()                              => invoke('shell:backupDb'),
    restoreDb:     ()                              => invoke('shell:restoreDb'),
    openExternal:  (url)                           => invoke('shell:openExternal', url),
    getAppVersion: ()                              => invoke('shell:getAppVersion'),
    readFile:      (filters)                       => invoke('shell:readFile', filters),
    installUpdate: ()                              => invoke('shell:installUpdate'),
    onUpdateReady: (cb)                            => on('app:update-ready', cb),
  },
});
