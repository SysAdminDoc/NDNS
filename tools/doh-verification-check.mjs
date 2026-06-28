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

expect(/const NEXTDNS_TEST_URL = 'https:\/\/test\.nextdns\.io';/, 'NextDNS diagnostic endpoint constant is missing.');
expect(/async function fetchNextDnsVerificationStatus\(\)[\s\S]*gmXmlHttpRequestWithRetry\(\{[\s\S]*url: `\$\{NEXTDNS_TEST_URL\}\?ndns=\$\{Date\.now\(\)\}`[\s\S]*responseType: 'json'[\s\S]*timeout: 10000[\s\S]*\}, \{ retries: 1 \}\)/, 'Verification must use the retry wrapper against test.nextdns.io with a short timeout.');
expect(/function buildNextDnsVerificationView\(payload = \{\}\)[\s\S]*status === 'ok'[\s\S]*label: 'Verified'[\s\S]*status === 'unconfigured'[\s\S]*label: 'Not active'/, 'Verification view must distinguish active NextDNS from unconfigured browser state.');
expect(/function buildNextDnsVerificationSection\(\)[\s\S]*id: 'ndns-section-doh-verification'[\s\S]*role: 'status'[\s\S]*aria-live': 'polite'[\s\S]*Refresh NextDNS verification/, 'Panel verification section must be visible, live, and manually refreshable.');
expect(/content\.appendChild\(buildNextDnsVerificationSection\(\)\);/, 'Floating panel must include the browser-side NextDNS verification section.');
reject(/fetchNextDnsVerificationStatus[\s\S]{0,500}NDNS_API_KEY/, 'Verification must not require or transmit the NextDNS API key.');

if (failures.length) {
  console.error('[doh-verification] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[doh-verification] PASS');
