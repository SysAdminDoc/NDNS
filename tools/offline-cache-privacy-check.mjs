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

expect(/const KEY_OFFLINE_LOG_CACHE_PRIVACY = `\$\{KEY_PREFIX\}offline_log_cache_privacy_v1`;/, 'Offline cache privacy storage key is missing.');
expect(/\[KEY_OFFLINE_LOG_CACHE_PRIVACY\]: \{ enabled: false, ttlDays: 1, includeInBackups: false, lastPurged: null \}/, 'Offline cache must default to opt-out and no cache export.');
expect(/const OFFLINE_LOG_CACHE_DB_NAME = `\$\{KEY_PREFIX\}offline_logs_v1`;/, 'Offline cache IndexedDB name is missing.');
expect(/const OFFLINE_LOG_CACHE_TTL_DAYS = \[1, 7, 14, 30\];/, 'Offline cache TTL options are missing.');
expect(/function normalizeOfflineLogCachePrivacy\(value\)[\s\S]*ttlDays[\s\S]*includeInBackups[\s\S]*lastPurged/, 'Offline cache privacy normalizer is missing.');
expect(/function formatOfflineLogCachePrivacyStatus\(\)[\s\S]*local-only, profile-scoped[\s\S]*excluded from normal settings backups/, 'Offline cache status must visibly mark local/profile-scoped data and backup exclusion.');
expect(/function deleteOfflineLogCacheDatabase\(\)[\s\S]*indexedDB\.deleteDatabase\(OFFLINE_LOG_CACHE_DB_NAME\)/, 'Offline cache purge must delete the IndexedDB database.');
expect(/async function purgeOfflineLogCache\(statusEl = null\)[\s\S]*lastPurged: Date\.now\(\)[\s\S]*KEY_OFFLINE_LOG_CACHE_PRIVACY/, 'Offline cache purge must update privacy metadata.');
expect(/offlineCacheToggle\.onclick = async \(\) => \{[\s\S]*offlineLogCachePrivacy\.enabled = !offlineLogCachePrivacy\.enabled/, 'Offline cache opt-in toggle is missing.');
expect(/offlineTtlSelect\.onchange = async \(\) => \{[\s\S]*offlineLogCachePrivacy\.ttlDays/, 'Offline cache TTL control is missing.');
expect(/offlineBackupToggle\.onclick = async \(\) => \{[\s\S]*offlineLogCachePrivacy\.includeInBackups/, 'Offline cache explicit future export toggle is missing.');
expect(/purgeOfflineCacheBtn\.textContent = 'Purge Offline Log Cache';/, 'Offline cache purge button is missing.');

if (failures.length) {
  console.error('[offline-cache-privacy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[offline-cache-privacy] PASS');
