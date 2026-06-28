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

function reject(pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

expect(/const KEY_SCHEMA_VERSION = `\$\{KEY_PREFIX\}schema_version_v1`;/, 'Storage schema version key is missing.');
expect(/const STORAGE_SCHEMA_VERSION = 1;/, 'Storage schema version constant is missing.');
expect(/const STORAGE_DEFAULTS = \{[\s\S]*\[KEY_PARENTAL_DEVICE_OVERRIDES\]/, 'Central storage defaults registry is incomplete.');
expect(/const STORAGE_BACKUP_EXCLUDED_KEYS = new Set\(\[KEY_API_KEY\]\);/, 'NDNS settings backups must exclude the API key.');
expect(/const STORAGE_BACKUP_TYPE = 'ndns-settings';/, 'NDNS settings backup type marker is missing.');
expect(/async function runStorageDoctor\(\) \{[\s\S]*currentVersion < STORAGE_SCHEMA_VERSION[\s\S]*normalizeStorageValue\(key, stored\[key\]\)[\s\S]*await storage\.set\(writes\);[\s\S]*\}/, 'Storage doctor must migrate schema and repair normalized values.');
expect(/storageDoctorReport = await runStorageDoctor\(\);\s*const values = await storage\.get\(STORAGE_DEFAULTS\);/, 'initializeState must run the storage doctor before reading repaired values.');
expect(/function renderStorageDoctorStatus\(element, report = storageDoctorReport\)/, 'Storage doctor status renderer is missing.');
expect(/async function exportNdnsSettingsBackup\(\)[\s\S]*backupType: STORAGE_BACKUP_TYPE[\s\S]*excludedKeys: \[\.\.\.STORAGE_BACKUP_EXCLUDED_KEYS\][\s\S]*downloadFile\(JSON\.stringify\(backup, null, 2\)/, 'NDNS settings export must include schema metadata and excluded secret keys.');
expect(/async function importNdnsSettingsBackupFile\(file, statusEl\)[\s\S]*parsed\.backupType !== STORAGE_BACKUP_TYPE[\s\S]*writes = \{ \[KEY_SCHEMA_VERSION\]: STORAGE_SCHEMA_VERSION \}/, 'NDNS settings import must validate backup type and write the current schema version.');
expect(/storageDoctorBtn\.textContent = 'Run Storage Doctor';/, 'Data Management storage doctor button is missing.');
expect(/exportSettingsBtn\.textContent = 'Export NDNS Settings';/, 'NDNS settings export button is missing.');
expect(/importSettingsBtn\.textContent = 'Import NDNS Settings';/, 'NDNS settings import button is missing.');
expect(/storageDoctorReport\?\.repairedCount > 0[\s\S]*showToast\(formatStorageDoctorMessage\(storageDoctorReport\), true, 7000\)/, 'Startup storage repair report toast is missing.');
reject(/backup\.values\[KEY_API_KEY\]/, 'NDNS settings backup must not export KEY_API_KEY.');

if (failures.length) {
  console.error('[storage-policy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[storage-policy] PASS');
