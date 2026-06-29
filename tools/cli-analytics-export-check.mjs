#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = readFileSync(resolve(root, 'tools/export-analytics.mjs'), 'utf8');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const failures = [];

function expect(pattern, message, source = cli) {
  if (!pattern.test(source)) failures.push(message);
}

expect(/const API_BASE = 'https:\/\/api\.nextdns\.io';/, 'CLI must use the official NextDNS API host.');
expect(/--api-key <key>[\s\S]*--profile <id>[\s\S]*--scope <current\|all>[\s\S]*--range <api\|90d\|1y>/, 'CLI usage must document key, profile, scope, and range options.');
expect(/process\.env\.NEXTDNS_API_KEY \|\| process\.env\.NDNS_API_KEY/, 'CLI must support API key environment variables.');
expect(/const CORE_ENDPOINTS = \['status', 'dnssec', 'encryption', 'protocols', 'queryTypes', 'ipVersions', 'destinations', 'devices'\];/, 'CLI core analytics endpoint list is incomplete.');
expect(/async function fetchAnalyticsPayload\(profile, windowConfig, rangeParams, context\)[\s\S]*safeAnalyticsApi\(profile, 'domains'[\s\S]*CORE_ENDPOINTS\.map\(endpoint => safeAnalyticsApi\(profile, endpoint, rangeParams, context\)\)/, 'CLI must fetch the same core analytics endpoint groups as the browser dashboard.');
expect(/function buildCsv\(cache, profileId\)[\s\S]*addSection\('Top Domains'[\s\S]*addSection\('Blocked Domains'[\s\S]*# Historical Rollup[\s\S]*# Analytics Errors/, 'CLI CSV export sections are incomplete.');
expect(/async function fetchStatusSeries\(profile, config, context\)[\s\S]*safeAnalyticsApi\(profile, 'status'/, 'CLI must support historical status rollups.');
expect(/--self-test[\s\S]*buildFixtureCache/, 'CLI must include a credential-free fixture mode.');
expect(/node tools\/export-analytics\.mjs --profile/, 'README must document the analytics CLI.', readme);

const selfTest = spawnSync(process.execPath, [resolve(root, 'tools/export-analytics.mjs'), '--self-test'], { encoding: 'utf8' });
if (selfTest.status !== 0) failures.push(`CLI self-test failed: ${selfTest.stderr || selfTest.stdout}`);
if (!/# Top Domains[\s\S]*example\.com,42[\s\S]*# Historical Rollup/.test(selfTest.stdout)) {
  failures.push('CLI self-test output did not include expected CSV sections.');
}

if (failures.length) {
  console.error('[cli-analytics-export] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[cli-analytics-export] PASS');
