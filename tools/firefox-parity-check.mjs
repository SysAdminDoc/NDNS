#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'NDNS.user.js');
const source = readFileSync(scriptPath, 'utf8');

const headerMatch = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function note(message) {
  notes.push(message);
}

if (!headerMatch) {
  fail('Userscript metadata header is missing.');
} else {
  const header = headerMatch[1];
  const grants = [...header.matchAll(/^\s*\/\/\s+@grant\s+(.+)$/gm)].map(match => match[1].trim());
  const matches = [...header.matchAll(/^\s*\/\/\s+@match\s+(.+)$/gm)].map(match => match[1].trim());
  const requiredGrants = ['GM_addStyle', 'GM.setValue', 'GM.getValue', 'GM.deleteValue', 'GM_xmlhttpRequest'];

  for (const field of ['@name', '@namespace', '@version', '@description', '@author']) {
    if (!new RegExp(`^\\s*//\\s+${field}\\s+\\S+`, 'm').test(header)) {
      fail(`Metadata ${field} is missing.`);
    }
  }

  if (!matches.includes('https://my.nextdns.io/*')) {
    fail('Firefox userscript @match for https://my.nextdns.io/* is missing.');
  }

  for (const grant of requiredGrants) {
    if (!grants.includes(grant)) fail(`Required userscript grant missing: ${grant}`);
  }

  if (grants.some(grant => grant.startsWith('chrome.') || grant.startsWith('browser.'))) {
    fail('Extension API grant found in userscript metadata.');
  }
}

const forbiddenApiPatterns = [
  { pattern: /\bchrome\.[a-z_$][\w$]*/g, label: 'chrome.* extension API' },
  { pattern: /\bbrowser\.[a-z_$][\w$]*/g, label: 'browser.* extension API' },
  { pattern: /\bsafari\.extension\b/, label: 'Safari extension API' },
  { pattern: /\bGM_setValue\b|\bGM_getValue\b|\bGM_deleteValue\b/, label: 'legacy GM_* storage API' }
];

for (const { pattern, label } of forbiddenApiPatterns) {
  if (pattern.test(source)) fail(`Forbidden or non-portable API found: ${label}`);
}

if (/\bGM_xmlhttpRequest\b/.test(source)) {
  note('GM_xmlhttpRequest is used for NextDNS API calls and is granted in both Tampermonkey and Violentmonkey.');
}

if (/\bnavigator\.clipboard\b/.test(source)) {
  note('navigator.clipboard is used only on HTTPS dashboard pages.');
}

if (/\bNotification\b/.test(source)) {
  note('Desktop notifications are guarded by Notification permission checks.');
}

if (failures.length) {
  console.error('[firefox-parity] FAIL');
  failures.forEach(item => console.error(`- ${item}`));
  if (notes.length) {
    console.error('[firefox-parity] Notes');
    notes.forEach(item => console.error(`- ${item}`));
  }
  process.exit(1);
}

console.log('[firefox-parity] PASS');
notes.forEach(item => console.log(`- ${item}`));
