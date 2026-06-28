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

expect(/const API_REQUEST_TIMEOUT_MS = 30000;/, 'API timeout constant is missing.');
expect(/const API_MAX_RETRIES = 2;/, 'Bounded retry constant is missing.');
expect(/const NON_RETRYABLE_WRITE_METHODS = new Set\(\['POST'\]\);/, 'POST must remain non-retryable by default.');
expect(/function parseRetryAfterMs\(responseHeaders = ''\)/, 'Retry-After parser is missing.');
expect(/function gmXmlHttpRequestWithRetry\(options, retryOptions = {}\)/, 'Shared GM retry wrapper is missing.');
expect(/timeout: API_REQUEST_TIMEOUT_MS,[\s\S]*\.\.\.options,[\s\S]*onload: resolve/, 'GM requests must set an explicit timeout.');
expect(/isRetryableStatus\(response\.status\)/, 'HTTP 429\/5xx retry check is missing.');
expect(/canRetryMethod\(method, retryOptions\)/, 'Retry policy must check method idempotency.');
expect(/function fetchLogsCsv\(profileId\) \{[\s\S]*gmXmlHttpRequestWithRetry\(/, 'Log download must use retry wrapper.');
expect(/async function fetchHageziList\(url, type\) \{[\s\S]*gmXmlHttpRequestWithRetry\(/, 'HaGeZi fetch must use retry wrapper.');
expect(/function postWebhookPayload\(payload, type = 'query'\) \{[\s\S]*timeout: API_REQUEST_TIMEOUT_MS,[\s\S]*ontimeout:/, 'Webhook POST must have timeout reporting.');

if (failures.length) {
  console.error('[api-retry-policy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[api-retry-policy] PASS');
