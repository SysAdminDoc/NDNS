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

expect(/const UI_STRINGS = Object\.freeze\(\{[\s\S]*analyticsDashboard: 'Analytics Dashboard'[\s\S]*settings: '\\u2699\\ufe0f Settings'[\s\S]*themeStudio: 'Theme Studio'/, 'English UI string catalog is missing key repeated labels.');
expect(/function uiText\(key\) \{[\s\S]*return UI_STRINGS\[key\] \|\| key;/, 'UI string lookup helper is missing.');
expect(/h2\.textContent = uiText\('analyticsDashboard'\);/, 'Analytics dashboard title should use UI string catalog.');
expect(/refreshBtn\.textContent = uiText\('refresh'\);/, 'Refresh buttons should use UI string catalog.');
expect(/csvBtn\.textContent = uiText\('exportCsv'\);[\s\S]*jsonBtn\.textContent = uiText\('exportJson'\);[\s\S]*pdfBtn\.textContent = uiText\('exportPdf'\);/, 'Analytics export buttons should use UI string catalog.');
expect(/exportProfileBtn\.textContent = uiText\('exportProfile'\);/, 'Export Profile button should use UI string catalog.');
expect(/importProfileBtn\.textContent = uiText\('importProfile'\);/, 'Import Profile button should use UI string catalog.');
expect(/saveBtn\.textContent = uiText\('save'\);[\s\S]*exportBtn\.textContent = uiText\('export'\);[\s\S]*importBtn\.textContent = uiText\('import'\);[\s\S]*clearBtn\.textContent = uiText\('clear'\);/, 'Theme Studio action buttons should use UI string catalog.');
reject(/h2\.textContent = 'Analytics Dashboard';/, 'Analytics Dashboard title is hardcoded outside the catalog.');
reject(/textContent = 'Export CSV';/, 'Export CSV label is hardcoded outside the catalog.');
reject(/textContent = 'Export Profile';/, 'Export Profile label is hardcoded outside the catalog.');

if (failures.length) {
  console.error('[ui-string-catalog] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[ui-string-catalog] PASS');
