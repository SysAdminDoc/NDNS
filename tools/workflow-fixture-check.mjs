#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'NDNS.user.js'), 'utf8');
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function expectSource(pattern, message) {
  assert(pattern.test(source), message);
}

function normalizeImportedDomain(raw) {
  let domain = String(raw || '').trim().toLowerCase();
  if (!domain || domain.startsWith('#')) return '';
  domain = domain.replace(/^\*\./, '');
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.split('/')[0].split('?')[0].split('#')[0].replace(/:\d+$/, '');
  return domain.replace(/^\.+|\.+$/g, '');
}

function parseImportedDomains(text) {
  const seen = new Set();
  return String(text || '').split(/\r?\n/)
    .map(normalizeImportedDomain)
    .filter(domain => /^[a-z0-9][a-z0-9.-]*\.[a-z0-9-]{2,}$/i.test(domain))
    .filter((domain) => {
      if (seen.has(domain)) return false;
      seen.add(domain);
      return true;
    });
}

function parseLocalBlocklistDomains(text) {
  const seen = new Set();
  const domains = [];
  const addDomain = (raw) => {
    const domain = normalizeImportedDomain(raw);
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z0-9-]{2,}$/i.test(domain)) return;
    if (seen.has(domain)) return;
    seen.add(domain);
    domains.push(domain);
  };

  String(text || '').split(/\r?\n/).forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!') || line.startsWith('[') || line.startsWith('@@')) return;
    line = line.replace(/\s+#.*$/, '').trim();
    const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1|::1|255\.255\.255\.255)\s+(.+)$/i);
    if (hostsMatch) {
      hostsMatch[1].split(/\s+/).forEach(addDomain);
      return;
    }
    const adblockMatch = line.match(/^\|\|([^/^$*]+)\^/i);
    if (adblockMatch) {
      addDomain(adblockMatch[1]);
      return;
    }
    if (line.startsWith('/') && line.endsWith('/')) return;
    addDomain(line.replace(/^\|\|/, '').replace(/\^.*$/, ''));
  });
  return domains;
}

function matchesWebhookPattern(pattern, target) {
  try {
    return new RegExp(pattern, 'i').test(target);
  } catch {
    return target.toLowerCase().includes(String(pattern || '').toLowerCase());
  }
}

function parseTimePart(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function matchesWebhookTimeWindow(windowExpr, date) {
  const [startRaw, endRaw] = String(windowExpr || '').split('-');
  const start = parseTimePart(startRaw);
  const end = parseTimePart(endRaw);
  if (start === null || end === null) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return start <= end ? now >= start && now <= end : now >= start || now <= end;
}

function matchesWebhookExpression(expression, context) {
  const tokens = String(expression || '').trim().split(/[\s;]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => {
    const sep = token.indexOf(':');
    if (sep === -1) return matchesWebhookPattern(token, context.domain);
    const key = token.slice(0, sep).toLowerCase();
    const value = token.slice(sep + 1);
    if (!value) return false;
    if (key === 'domain') return matchesWebhookPattern(value, context.domain);
    if (key === 'device') return matchesWebhookPattern(value, context.device);
    if (key === 'status') return value.split('|').some(status => matchesWebhookPattern(status, context.status));
    if (key === 'time' || key === 'window') return matchesWebhookTimeWindow(value, context.timestamp);
    return matchesWebhookPattern(token, context.domain);
  });
}

function renderWebhookTemplate(template, context) {
  const escapeValue = value => (typeof value === 'number' || typeof value === 'boolean')
    ? String(value)
    : JSON.stringify(String(value ?? '')).slice(1, -1);
  return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => escapeValue(context[key] ?? ''));
}

function resolveItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(d => ({ name: String(d.name || d.domain || d.status || 'Unknown'), value: d.queries || d.count || 0 }));
  return Object.entries(data).map(([name, value]) => ({ name, value: typeof value === 'number' ? value : 0 }));
}

function mergeAnalyticsField(payloads, field) {
  const merged = new Map();
  payloads.forEach(payload => resolveItems(payload[field]).forEach((item) => {
    const key = item.name.toLowerCase();
    if (!merged.has(key)) merged.set(key, { name: item.name, queries: 0 });
    merged.get(key).queries += item.value;
  }));
  return Array.from(merged.values()).sort((a, b) => b.queries - a.queries);
}

function normalizeStorageFixture(stored) {
  const writes = {};
  const repaired = [];
  const schemaVersion = Math.max(0, Number(stored.ndns_schema_version_v1) || 0);
  if (schemaVersion < 1) writes.ndns_schema_version_v1 = 1;
  if (!Array.isArray(stored.ndns_hidden_domains_v2)) {
    writes.ndns_hidden_domains_v2 = ['nextdns.io'];
    repaired.push('hidden domains');
  }
  const ttl = Number(stored.ndns_offline_log_cache_privacy_v1?.ttlDays);
  if (![1, 7, 14, 30].includes(ttl)) {
    writes.ndns_offline_log_cache_privacy_v1 = { enabled: false, ttlDays: 1, includeInBackups: false, lastPurged: null };
    repaired.push('offline log cache privacy');
  }
  return { writes, repaired };
}

expectSource(/function normalizeImportedDomain\(raw\)/, 'normalizeImportedDomain source is missing.');
expectSource(/function parseLocalBlocklistDomains\(text\)/, 'parseLocalBlocklistDomains source is missing.');
expectSource(/function matchesWebhookExpression\(expression, context\)/, 'matchesWebhookExpression source is missing.');
expectSource(/function renderWebhookTemplate\(template, context\)/, 'renderWebhookTemplate source is missing.');
expectSource(/function mergeAnalyticsPayloads\(payloads, windowConfig, rangeParams, scopeKey, errors = \[\]\)/, 'mergeAnalyticsPayloads source is missing.');
expectSource(/async function runStorageDoctor\(\)/, 'runStorageDoctor source is missing.');

assert(normalizeImportedDomain('*.Example.COM/path') === 'example.com', 'Domain normalization should strip wildcard and lowercase.');
assert(normalizeImportedDomain('https://Example.com:443/foo?q=1') === 'example.com', 'Domain normalization should strip scheme, path, query, and port.');
assert(JSON.stringify(parseImportedDomains('Example.com\n#skip\nhttps://sub.example.com/a\nexample.com')) === JSON.stringify(['example.com', 'sub.example.com']), 'Imported domain parser should dedupe and skip comments.');
assert(JSON.stringify(parseLocalBlocklistDomains('0.0.0.0 ads.example.com tracker.example.net\n||cdn.example.org^\n@@||allow.example.com^\n/badregex/')) === JSON.stringify(['ads.example.com', 'tracker.example.net', 'cdn.example.org']), 'Local blocklist parser should handle hosts/adblock and skip allow/regex rules.');

const webhookContext = {
  domain: 'ads.example.com',
  device: 'Laptop',
  status: 'blocked',
  timestamp: new Date('2026-06-28T22:30:00')
};
assert(matchesWebhookExpression('domain:ads\\.example\\.com status:blocked device:laptop time:22:00-23:00', webhookContext), 'Webhook expression should match domain/status/device/time.');
assert(!matchesWebhookExpression('status:allowed', webhookContext), 'Webhook expression should reject nonmatching status.');
assert(renderWebhookTemplate('{"domain":"{{domain}}","ok":{{blocked}}}', { domain: 'a"b.example', blocked: true }) === '{"domain":"a\\"b.example","ok":true}', 'Webhook template should JSON-escape string values and preserve booleans.');

const mergedDomains = mergeAnalyticsField([
  { domains: [{ name: 'Example.com', queries: 4 }, { name: 'Other.com', queries: 1 }] },
  { domains: [{ name: 'example.com', queries: 6 }] }
], 'domains');
assert(mergedDomains[0].name === 'Example.com' && mergedDomains[0].queries === 10, 'Analytics merge should combine case-insensitive names.');

const storageFixture = normalizeStorageFixture({
  ndns_schema_version_v1: 0,
  ndns_hidden_domains_v2: 'broken',
  ndns_offline_log_cache_privacy_v1: { ttlDays: 999 }
});
assert(storageFixture.writes.ndns_schema_version_v1 === 1, 'Storage fixture should migrate schema version.');
assert(storageFixture.repaired.includes('hidden domains') && storageFixture.repaired.includes('offline log cache privacy'), 'Storage fixture should repair invalid persisted values.');

const firefox = spawnSync(process.execPath, [resolve(root, 'tools/firefox-parity-check.mjs')], { encoding: 'utf8' });
assert(firefox.status === 0, `Firefox parity check failed:\n${firefox.stdout}\n${firefox.stderr}`);

if (failures.length) {
  console.error('[workflow-fixtures] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[workflow-fixtures] PASS');
