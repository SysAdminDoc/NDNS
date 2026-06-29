#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API_BASE = 'https://api.nextdns.io';
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOWS = [
  { key: 'api', label: 'API Default', description: 'Native NextDNS window' },
  { key: '90d', label: 'Last 90 Days', description: 'Weekly rollup', days: 90, bucketCount: 13 },
  { key: '1y', label: 'Last 1 Year', description: 'Monthly rollup', days: 365, bucketCount: 12 }
];
const CORE_ENDPOINTS = ['status', 'dnssec', 'encryption', 'protocols', 'queryTypes', 'ipVersions', 'destinations', 'devices'];

function usage() {
  return `Usage: node tools/export-analytics.mjs --profile <id> [options]

Options:
  --api-key <key>      NextDNS API key. Falls back to NEXTDNS_API_KEY or NDNS_API_KEY.
  --profile <id>       Current NextDNS profile ID.
  --scope <current|all> Export current profile or merge all profiles. Default: current.
  --range <api|90d|1y> Analytics range. Default: 90d.
  --out <path>         CSV output path. Defaults to stdout.
  --timeout-ms <ms>    Request timeout. Default: 30000.
  --self-test          Generate fixture CSV without network or credentials.
  --help               Show this help.`;
}

function parseArgs(argv) {
  const args = { scope: 'current', range: '90d', timeoutMs: 30000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--self-test') args.selfTest = true;
    else if (arg === '--api-key') args.apiKey = argv[++i];
    else if (arg === '--profile') args.profile = argv[++i];
    else if (arg === '--scope') args.scope = argv[++i];
    else if (arg === '--range') args.range = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function getWindowConfig(key) {
  return WINDOWS.find(windowConfig => windowConfig.key === key) || WINDOWS[1];
}

function buildRangeParams(config, now = new Date()) {
  if (!config?.days) return {};
  const from = new Date(now.getTime() - (config.days * DAY_MS));
  return { from: from.toISOString(), to: now.toISOString() };
}

function buildEndpoint(endpoint, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}

function normalizeData(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && typeof data.data === 'object') {
    return Object.entries(data.data).map(([name, value]) => ({ name, queries: typeof value === 'number' ? value : 0 }));
  }
  return [];
}

function resolveItems(data) {
  return normalizeData(data)
    .map(item => ({
      name: String(item.name || item.domain || item.status || item.id || 'Unknown'),
      value: Number(item.queries || item.count || item.value || 0)
    }))
    .filter(item => item.value > 0 || item.name !== 'Unknown');
}

function filterDomains(items) {
  return normalizeData(items).filter(item => item?.domain !== 'blockpage.nextdns.io' && item?.name !== 'blockpage.nextdns.io');
}

function summarizeStatusItems(items) {
  const resolved = resolveItems(items);
  const total = resolved.reduce((sum, item) => sum + item.value, 0);
  const blocked = resolved.find(item => /block/i.test(item.name))?.value || 0;
  const allowed = resolved.find(item => /allow|default|pass|ok/i.test(item.name))?.value || 0;
  return {
    total,
    allowed,
    blocked,
    blockedPct: total > 0 ? (blocked / total * 100) : 0
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function fetchJson(url, apiKey, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchApi(path, apiKey, options) {
  return fetchJson(`${API_BASE}${path}`, apiKey, options);
}

async function safeAnalyticsApi(profile, endpoint, params, context) {
  const apiEndpoint = buildEndpoint(endpoint, params);
  try {
    return await fetchApi(`/profiles/${profile.id}/analytics/${apiEndpoint}`, context.apiKey, context);
  } catch (error) {
    context.errors.push({
      type: 'endpoint',
      profileId: profile.id,
      profileName: profile.name,
      endpoint: apiEndpoint,
      message: error.message || String(error)
    });
    return null;
  }
}

function buildBuckets(config, now = new Date()) {
  if (!config?.bucketCount || !config?.days) return [];
  const from = new Date(now.getTime() - (config.days * DAY_MS));
  const bucketMs = (now.getTime() - from.getTime()) / config.bucketCount;
  return Array.from({ length: config.bucketCount }, (_, index) => {
    const bucketFrom = new Date(from.getTime() + (index * bucketMs));
    const bucketTo = index === config.bucketCount - 1 ? now : new Date(from.getTime() + ((index + 1) * bucketMs));
    return {
      from: bucketFrom,
      to: bucketTo,
      label: bucketFrom.toISOString().slice(0, 10)
    };
  });
}

async function fetchStatusSeries(profile, config, context) {
  const rows = [];
  for (const bucket of buildBuckets(config)) {
    const raw = await safeAnalyticsApi(profile, 'status', { from: bucket.from.toISOString(), to: bucket.to.toISOString() }, context);
    rows.push({
      label: bucket.label,
      from: bucket.from.toISOString(),
      to: bucket.to.toISOString(),
      ...summarizeStatusItems(raw)
    });
  }
  return rows;
}

async function fetchAnalyticsPayload(profile, windowConfig, rangeParams, context) {
  const [domains, blockedDomains, ...core] = await Promise.all([
    safeAnalyticsApi(profile, 'domains', { ...rangeParams, limit: 50 }, context),
    safeAnalyticsApi(profile, 'domains', { ...rangeParams, status: 'blocked', limit: 30 }, context),
    ...CORE_ENDPOINTS.map(endpoint => safeAnalyticsApi(profile, endpoint, rangeParams, context))
  ]);
  const series = windowConfig.bucketCount ? await fetchStatusSeries(profile, windowConfig, context) : [];
  const payload = {
    profile,
    domains: filterDomains(domains),
    blocked: filterDomains(blockedDomains),
    statusSeries: series
  };
  CORE_ENDPOINTS.forEach((endpoint, index) => {
    payload[endpoint] = normalizeData(core[index]);
  });
  return payload;
}

function mergeField(payloads, field) {
  const merged = new Map();
  payloads.forEach(payload => resolveItems(payload[field]).forEach((item) => {
    const key = item.name.toLowerCase();
    if (!merged.has(key)) merged.set(key, { name: item.name, queries: 0 });
    merged.get(key).queries += item.value;
  }));
  return Array.from(merged.values()).sort((a, b) => b.queries - a.queries);
}

function mergeSeries(payloads) {
  const merged = new Map();
  payloads.forEach(payload => (payload.statusSeries || []).forEach((point) => {
    const key = `${point.from}|${point.to}|${point.label}`;
    if (!merged.has(key)) merged.set(key, { label: point.label, from: point.from, to: point.to, total: 0, allowed: 0, blocked: 0, blockedPct: 0 });
    const target = merged.get(key);
    target.total += point.total;
    target.allowed += point.allowed;
    target.blocked += point.blocked;
  }));
  return Array.from(merged.values()).map(point => ({
    ...point,
    blockedPct: point.total > 0 ? (point.blocked / point.total * 100) : 0
  })).sort((a, b) => new Date(a.from) - new Date(b.from));
}

function buildProfileSummaries(payloads) {
  return payloads.map(payload => ({
    id: payload.profile.id,
    name: payload.profile.name,
    ...summarizeStatusItems(payload.status)
  })).sort((a, b) => b.total - a.total);
}

function mergePayloads(payloads, windowConfig, rangeParams, scopeKey, errors) {
  return {
    exportedAt: new Date().toISOString(),
    window: { key: windowConfig.key, label: windowConfig.label, description: windowConfig.description, range: rangeParams },
    scope: { key: scopeKey, label: scopeKey === 'all' ? 'All Profiles' : 'Current Profile', profileCount: payloads.length, errorCount: errors.length },
    profileSummaries: buildProfileSummaries(payloads),
    errors,
    domains: mergeField(payloads, 'domains'),
    blocked: mergeField(payloads, 'blocked'),
    status: mergeField(payloads, 'status'),
    dnssec: mergeField(payloads, 'dnssec'),
    encryption: mergeField(payloads, 'encryption'),
    protocols: mergeField(payloads, 'protocols'),
    queryTypes: mergeField(payloads, 'queryTypes'),
    ipVersions: mergeField(payloads, 'ipVersions'),
    destinations: mergeField(payloads, 'destinations'),
    devices: mergeField(payloads, 'devices'),
    statusSeries: mergeSeries(payloads)
  };
}

function buildCsv(cache, profileId) {
  const exportSlug = cache.scope?.key === 'all' ? 'all-profiles' : profileId;
  const sections = [`# NDNS Analytics Export`, `Export,${csvEscape(exportSlug)}`, `Range,${csvEscape(cache.window?.key || 'api')}`, `Generated,${csvEscape(cache.exportedAt)}`];
  const addSection = (title, items) => {
    if (!items || items.length === 0) return;
    sections.push(`\n# ${title}`);
    sections.push('Name,Queries');
    resolveItems(items).forEach(item => sections.push(`${csvEscape(item.name)},${item.value}`));
  };
  addSection('Top Domains', cache.domains);
  addSection('Blocked Domains', cache.blocked);
  addSection('Query Status', cache.status);
  addSection('Query Types', cache.queryTypes);
  addSection('Devices', cache.devices);
  addSection('DNSSEC', cache.dnssec);
  addSection('Encryption', cache.encryption);
  addSection('Protocols', cache.protocols);
  addSection('IP Versions', cache.ipVersions);
  addSection('Destinations', cache.destinations);
  if (cache.profileSummaries?.length > 1) {
    sections.push('\n# Merged Profiles');
    sections.push('Profile,Profile ID,Total Queries,Allowed,Blocked,Blocked Percent');
    cache.profileSummaries.forEach(profile => sections.push([
      csvEscape(profile.name),
      csvEscape(profile.id),
      profile.total,
      profile.allowed,
      profile.blocked,
      profile.blockedPct.toFixed(1)
    ].join(',')));
  }
  if (cache.statusSeries?.length) {
    sections.push('\n# Historical Rollup');
    sections.push('Period,From,To,Total Queries,Allowed,Blocked,Blocked Percent');
    cache.statusSeries.forEach(point => sections.push([
      csvEscape(point.label),
      csvEscape(point.from),
      csvEscape(point.to),
      point.total,
      point.allowed,
      point.blocked,
      point.blockedPct.toFixed(1)
    ].join(',')));
  }
  if (cache.errors?.length) {
    sections.push('\n# Analytics Errors');
    sections.push('Type,Profile,Profile ID,Endpoint,Message');
    cache.errors.forEach(error => sections.push([
      csvEscape(error.type || 'request'),
      csvEscape(error.profileName || ''),
      csvEscape(error.profileId || ''),
      csvEscape(error.endpoint || ''),
      csvEscape(error.message || '')
    ].join(',')));
  }
  return `${sections.join('\n')}\n`;
}

async function loadProfiles(args, context) {
  if (args.scope !== 'all') return [{ id: args.profile, name: 'Current Profile' }];
  try {
    const profiles = await fetchApi('/profiles', context.apiKey, context);
    const profileList = (profiles?.data || profiles || [])
      .filter(profile => profile?.id)
      .map(profile => ({ id: String(profile.id), name: String(profile.name || profile.id) }));
    return profileList.length ? profileList : [{ id: args.profile, name: 'Current Profile' }];
  } catch (error) {
    context.errors.push({ type: 'profile-list', profileId: args.profile, profileName: 'Current Profile', endpoint: '/profiles', message: error.message || String(error) });
    return [{ id: args.profile, name: 'Current Profile' }];
  }
}

function buildFixtureCache() {
  const windowConfig = getWindowConfig('90d');
  const rangeParams = { from: '2026-01-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' };
  return mergePayloads([{
    profile: { id: 'fixture', name: 'Fixture Profile' },
    domains: [{ name: 'example.com', queries: 42 }],
    blocked: [{ name: 'ads.example.com', queries: 12 }],
    status: [{ name: 'Allowed', queries: 30 }, { name: 'Blocked', queries: 12 }],
    dnssec: [{ name: 'Validated', queries: 25 }],
    encryption: [{ name: 'DoH', queries: 42 }],
    protocols: [{ name: 'UDP', queries: 20 }, { name: 'DoH', queries: 22 }],
    queryTypes: [{ name: 'A', queries: 35 }, { name: 'AAAA', queries: 7 }],
    ipVersions: [{ name: 'IPv4', queries: 42 }],
    destinations: [{ name: 'US', queries: 42 }],
    devices: [{ name: 'Laptop', queries: 42 }],
    statusSeries: [{ label: '2026-01-01', from: rangeParams.from, to: rangeParams.to, total: 42, allowed: 30, blocked: 12, blockedPct: 28.6 }]
  }], windowConfig, rangeParams, 'current', []);
}

async function writeOutput(csv, outPath) {
  if (!outPath) {
    process.stdout.write(csv);
    return;
  }
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await writeFile(outPath, csv, 'utf8');
  console.error(`[ndns-analytics] wrote ${outPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.scope && !['current', 'all'].includes(args.scope)) throw new Error('--scope must be current or all.');
  if (!WINDOWS.some(windowConfig => windowConfig.key === args.range)) throw new Error('--range must be api, 90d, or 1y.');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number.');
  if (args.selfTest) {
    await writeOutput(buildCsv(buildFixtureCache(), 'fixture'), args.out);
    return;
  }

  const apiKey = args.apiKey || process.env.NEXTDNS_API_KEY || process.env.NDNS_API_KEY;
  if (!apiKey) throw new Error('Missing API key. Use --api-key or NEXTDNS_API_KEY.');
  if (!args.profile) throw new Error('Missing --profile <id>.');

  const windowConfig = getWindowConfig(args.range);
  const rangeParams = buildRangeParams(windowConfig);
  const context = { apiKey, timeoutMs: args.timeoutMs, errors: [] };
  const profiles = await loadProfiles(args, context);
  const payloads = [];
  for (const profile of profiles) {
    payloads.push(await fetchAnalyticsPayload(profile, windowConfig, rangeParams, context));
  }
  const cache = mergePayloads(payloads, windowConfig, rangeParams, args.scope, context.errors);
  await writeOutput(buildCsv(cache, args.profile), args.out);
}

main().catch((error) => {
  console.error(`[ndns-analytics] ${error.message || error}`);
  process.exit(1);
});
