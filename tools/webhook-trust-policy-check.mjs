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

expect(/const KEY_WEBHOOK_TRUST = `\$\{KEY_PREFIX\}webhook_trust_v1`;/, 'Webhook trust storage key is missing.');
expect(/function validateWebhookDestination\(rawUrl\)/, 'Webhook destination validator is missing.');
expect(/parsed\.protocol !== 'https:'/, 'Webhook validator must require HTTPS.');
expect(/Local webhook hosts are blocked/, 'Webhook validator must block local hostnames.');
expect(/Private network webhook hosts are blocked/, 'Webhook validator must block private network addresses.');
expect(/function isWebhookDeliveryTrusted\(destination = validateWebhookDestination\(webhookUrl\)\)/, 'Webhook consent check is missing.');
expect(/recordWebhookDelivery\(\{ type, ok: false, message: `Delivery consent required/, 'Webhook sender must fail closed without consent.');
expect(/const headers = \{\};[\s\S]*isNextDnsApiUrl\(requestUrl\)[\s\S]*headers\['X-Api-Key'\] = apiKey/, 'API key must only be attached to NextDNS API URLs.');
expect(/Destination: \$\{destination\.host\}\. Consent:/, 'Webhook settings must show destination host and consent state.');

if (failures.length) {
  console.error('[webhook-trust-policy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[webhook-trust-policy] PASS');
