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

expect(/const NEXTDNS_DOH_URL = 'https:\/\/dns\.nextdns\.io';/, 'NextDNS DoH endpoint constant is missing.');
expect(/\/\/ @connect      dns\.nextdns\.io/, 'Userscript metadata should disclose the DoH replay host.');
expect(/const DNS_REPLAY_TYPES = \['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'\];/, 'DNS replay record type allowlist is missing.');
expect(/async function replayDnsQuery\(domain, type = 'A'\)[\s\S]*getCurrentProfileId\(\)[\s\S]*normalizeImportedDomain\(domain\)[\s\S]*headers: \{ Accept: 'application\/dns-json' \}[\s\S]*responseType: 'json'[\s\S]*timeout: 10000/, 'DNS replay must query the current profile DoH endpoint as DNS JSON with a short timeout.');
expect(/url: `\$\{NEXTDNS_DOH_URL\}\/\$\{encodeURIComponent\(profileId\)\}\?name=\$\{encodeURIComponent\(queryDomain\)\}&type=\$\{encodeURIComponent\(queryType\)\}`/, 'DNS replay URL must include encoded profile, name, and type parameters.');
expect(/function formatDnsReplayResult\(result\)[\s\S]*Answers:[\s\S]*Authority:/, 'DNS replay formatter must expose answers and authority records.');
expect(/function showDnsReplayModal\(domain\)[\s\S]*DNS Query Replay[\s\S]*setupDialogAccessibility\(overlay, modal, 'DNS query replay'\)[\s\S]*runQuery\(\);/, 'DNS replay modal must be accessible and run on open.');
expect(/createBtn\('DNS', 'Replay DNS Query', \(\) => showDnsReplayModal\(domain\)\)/, 'Each log row needs a DNS replay action.');
reject(/async function replayDnsQuery[\s\S]{0,900}NDNS_API_KEY/, 'DNS replay must not use or transmit the NextDNS API key.');

if (failures.length) {
  console.error('[dns-replay] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[dns-replay] PASS');
