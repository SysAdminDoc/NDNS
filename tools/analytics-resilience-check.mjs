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

expect(/function buildAnalyticsSafeApi\(profile, errors = \[\]\)[\s\S]*errors\.push\(\{[\s\S]*type: 'endpoint'[\s\S]*return null;/, 'Analytics safe API must record endpoint failures and keep rendering.');
expect(/async function loadAnalyticsProfiles\(currentPid, errors = \[\]\)[\s\S]*type: 'profile-list'[\s\S]*return null;/, 'Profile-list failures must be recorded while falling back.');
expect(/const analyticsErrors = \[\];[\s\S]*for \(const profile of profiles\)[\s\S]*try \{[\s\S]*fetchAnalyticsPayload[\s\S]*catch \(err\)[\s\S]*type: 'profile'/, 'Profile fetch failures must be isolated per profile.');
expect(/if \(payloads\.length === 0\)[\s\S]*throw new Error/, 'Analytics should only hard-fail when no profile payloads loaded.');
expect(/function buildAnalyticsWarning\(cache, retryHandler\)[\s\S]*Retry Analytics/, 'Inline partial-data warning with retry is missing.');
expect(/analyticsCache = mergeAnalyticsPayloads\(payloads, windowConfig, rangeParams, analyticsScopeKey, analyticsErrors\);/, 'Merged analytics cache must include collected errors.');
expect(/errors: allErrors,/, 'Analytics cache must retain errors for export.');
expect(/# Analytics Errors[\s\S]*Type,Profile,Profile ID,Endpoint,Message/, 'CSV export must include analytics errors.');
expect(/buildReportTable\('Analytics Errors', \['Type', 'Profile', 'Profile ID', 'Endpoint', 'Message'\], errorRows\)/, 'PDF report must include analytics errors.');
expect(/\.ndns-analytics-warning/, 'Partial analytics warning styles are missing.');

if (failures.length) {
  console.error('[analytics-resilience] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[analytics-resilience] PASS');
