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

expect(/let logOriginFilter = '';/, 'Tab-local origin filter state is missing.');
expect(/function getLogOriginFilterSessionKey\(\)[\s\S]*log_origin_filter_[\s\S]*getCurrentProfileId\(\)/, 'Origin filter must be keyed per profile in sessionStorage.');
expect(/function normalizeLogOriginFilterValue\(value\)[\s\S]*normalizeImportedDomain\(token\)[\s\S]*join\(', '\)/, 'Origin filter must normalize URLs, wildcards, ports, and duplicate tokens.');
expect(/function isLogDomainInOriginFilter\(domain, tokens = getLogOriginFilterTokens\(\)\)[\s\S]*normalizedDomain === token[\s\S]*normalizedDomain\.endsWith\(`\.\$\{token\}`\)[\s\S]*rootDomain === token/, 'Origin filter must match exact domains, subdomains, and root domains.');
expect(/function setLogOriginFilter\(value\)[\s\S]*sessionStorage\.setItem\(getLogOriginFilterSessionKey\(\), logOriginFilter\)[\s\S]*sessionStorage\.removeItem\(getLogOriginFilterSessionKey\(\)\)[\s\S]*cleanLogs\(\)/, 'Applying the origin filter must be tab-local and immediately re-filter loaded rows.');
expect(/function buildLogOriginFilterControls\(\)[\s\S]*id: 'ndns-log-origin-filter'[\s\S]*id: 'ndns-log-origin-filter-input'[\s\S]*Tab-local origin filter/, 'Panel origin filter controls and status copy are missing.');
expect(/const isOriginMatch = isLogDomainInOriginFilter\(domain\);[\s\S]*if \(!isOriginMatch\) isVisible = false;/, 'Log visibility must include the origin filter predicate.');
expect(/content\.appendChild\(buildLogOriginFilterControls\(\)\);/, 'Floating panel must include the tab-local origin filter controls.');
expect(/const originFilterSection = document\.getElementById\('ndns-log-origin-filter'\);[\s\S]*originFilterSection\.style\.display = isLogsPage \? '' : 'none';/, 'Origin filter controls must be shown only on the logs page.');
expect(/loadLogOriginFilter\(\);[\s\S]*await createPanel\(\);/, 'Origin filter should load after the current profile is known and before panel creation.');
reject(/defaultFilters = \{[^}]*logOriginFilter/, 'Origin filter must not be stored in the persisted filter object.');
reject(/storage\.set\(\{ \[KEY_FILTER_STATE\]: filters[\s\S]{0,200}logOriginFilter/, 'Origin filter must not be persisted to GM storage with global filters.');

if (failures.length) {
  console.error('[log-origin-filter] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[log-origin-filter] PASS');
