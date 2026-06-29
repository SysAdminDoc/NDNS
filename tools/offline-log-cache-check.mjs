#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'NDNS.user.js'), 'utf8');
const failures = [];

function expect(pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

expect(/const OFFLINE_LOG_CACHE_STORE = 'logs';/, 'Offline log cache object store is missing.');
expect(/const OFFLINE_LOG_CACHE_MAX_ROWS = 1000;/, 'Offline log cache row cap is missing.');
expect(/function openOfflineLogCacheDb\(\)[\s\S]*indexedDB\.open\(OFFLINE_LOG_CACHE_DB_NAME, 1\)[\s\S]*createObjectStore\(OFFLINE_LOG_CACHE_STORE, \{ keyPath: 'id' \}\)[\s\S]*createIndex\('profileId'[\s\S]*createIndex\('cachedAt'/, 'IndexedDB store and indexes are not created.');
expect(/function buildOfflineLogSnapshot\(row\)[\s\S]*getCurrentProfileId\(\)[\s\S]*normalizeImportedDomain\(row\?\.dataset\?\.ndnsDomain[\s\S]*extractWebhookDevice\(row\)[\s\S]*cachedAt: Date\.now\(\)/, 'Offline cache snapshots must be profile-scoped log-row records.');
expect(/async function writeOfflineLogSnapshots\(snapshots\)[\s\S]*store\.put\(snapshot\)[\s\S]*IDBKeyRange\.upperBound\(cutoff, true\)[\s\S]*OFFLINE_LOG_CACHE_MAX_ROWS/, 'Offline cache writes must persist rows and prune TTL/max rows.');
expect(/async function readOfflineLogSnapshots\(profileId = getCurrentProfileId\(\)\)[\s\S]*row\.profileId === profileId[\s\S]*row\.cachedAt >= cutoff/, 'Offline cache reads must filter by profile and TTL.');
expect(/function scheduleOfflineLogCacheWrite\(\)[\s\S]*offlineLogCachePrivacy\.enabled[\s\S]*document\.querySelectorAll\('div\.list-group-item\.log\[data-ndns-processed\]'\)[\s\S]*writeOfflineLogSnapshots\(snapshots\)/, 'Loaded log rows must be written only when offline cache is enabled.');
expect(/function showOfflineLogCacheModal\(\)[\s\S]*Local profile-scoped snapshots[\s\S]*readOfflineLogSnapshots\(\)[\s\S]*setupDialogAccessibility\(overlay, modal, 'Offline log cache'\)/, 'Offline cache browser modal is missing.');
expect(/function buildOfflineLogCachePanelSection\(\)[\s\S]*View Cached Logs[\s\S]*Cache Loaded Logs[\s\S]*showOfflineLogCacheModal/, 'Logs panel cache controls are missing.');
expect(/content\.appendChild\(buildOfflineLogCachePanelSection\(\)\);/, 'Floating panel must include the offline log cache section.');
expect(/scheduleOfflineLogCacheWrite\(\);[\s\S]*\} finally \{[\s\S]*isCleaningLogs = false;/, 'cleanLogs must schedule offline cache writes after processing.');

if (failures.length) {
  console.error('[offline-log-cache] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[offline-log-cache] PASS');
