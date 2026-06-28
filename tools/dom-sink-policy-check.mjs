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

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) {
    failures.push(`${name} is missing.`);
    return '';
  }
  const signatureEnd = source.indexOf(') {', start);
  const bodyStart = signatureEnd === -1 ? -1 : signatureEnd + 2;
  if (bodyStart === -1) {
    failures.push(`${name} signature could not be parsed.`);
    return '';
  }
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  failures.push(`${name} body could not be parsed.`);
  return '';
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.className = '';
    this.style = { cssText: '' };
    this.title = '';
    this.innerHTML = '';
    this._textContent = '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.flat().forEach(child => this.appendChild(child));
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return `${this._textContent}${this.children.map(child => child.textContent || '').join('')}`;
  }
}

function runSafeElementFixture() {
  const helperSource = extractFunction('createSafeElement');
  if (!helperSource) return;

  const fakeDocument = {
    createElement: tag => new FakeElement(tag),
    createTextNode: text => ({ nodeType: 3, textContent: String(text) })
  };
  const createSafeElement = Function('document', `${helperSource}; return createSafeElement;`)(fakeDocument);
  const maliciousDomain = '<img src=x onerror=alert(1)>';
  const maliciousProfile = 'profile" onclick="alert(1)';
  const row = createSafeElement('tr', {}, [
    createSafeElement('td', {}, [
      maliciousProfile,
      ' ',
      createSafeElement('span', {
        text: maliciousDomain,
        title: maliciousDomain,
        attrs: { 'data-domain': maliciousDomain }
      })
    ]),
    createSafeElement('td', { text: maliciousDomain })
  ]);

  if (!row.textContent.includes(maliciousDomain) || !row.textContent.includes(maliciousProfile)) {
    failures.push('Safe DOM fixture did not preserve malicious names as text.');
  }
  if (row.innerHTML || row.children.some(child => child.innerHTML)) {
    failures.push('Safe DOM fixture wrote malicious fixture data through innerHTML.');
  }
  const domainNode = row.children[0].children[2];
  if (domainNode.attributes['data-domain'] !== maliciousDomain || domainNode.title !== maliciousDomain) {
    failures.push('Safe DOM fixture did not preserve unsafe attribute values as attributes.');
  }
}

expect(/function createSafeElement\(tag, options = \{\}, children = \[\]\)/, 'Safe DOM builder helper is missing.');
expect(/function createTrustedHtmlPolicy\(\)/, 'Trusted Types policy helper is missing.');
expect(/trustedTypes\.createPolicy\('ndns-static-html'/, 'Trusted Types static HTML policy wrapper is missing.');
reject(/overlay\.innerHTML = `<div id="ndns-onboarding-modal">/, 'Onboarding modal must not interpolate profile state through innerHTML.');
reject(/loading\.innerHTML = `<span style="color:var\(--danger-color\);">Failed to load analytics:/, 'Analytics errors must render as text nodes.');
reject(/item\.innerHTML = `<span><span class="domain">/, 'DNS rewrite rows must not use HTML string rendering.');
reject(/tr\.innerHTML = `<td>\$\{escapeHtml\(profile\.name\)\}/, 'Profile summary rows must not use HTML string rendering.');
reject(/header\.innerHTML = `\s*<div>\s*<div class="ndns-device-name"/, 'Device drilldown headers must not use HTML string rendering.');
reject(/row\.innerHTML = `\s*<div class="ndns-app-name"/, 'Device app rows must not use HTML string rendering.');
reject(/row\.innerHTML = `<span class="ndns-bar-rank">/, 'Analytics bar rows must not use HTML string rendering.');
reject(/row\.innerHTML = `<span class="ndns-ring-legend-dot"/, 'Ring legend rows must not use HTML string rendering.');
reject(/toggle\.innerHTML = `<div class="toggle-label"><span>\$\{cat\.icon\}<\/span><span>\$\{cat\.label\}<\/span><\/div>`;/, 'Parental category rows must not use HTML string rendering.');
reject(/container\.innerHTML = `<div style="font-size:11px;color:var\(--danger-color\);">Failed: \$\{e\.message\}<\/div>`;/, 'Parental errors must render as text nodes.');
reject(/item\.innerHTML = `\s*<span class="pattern">\$\{escapeHtml\(pattern\.pattern\)\}<\/span>/, 'Regex pattern rows must not use HTML string rendering.');
reject(/item\.innerHTML = `<span style="font-family:monospace;">\$\{escapeHtml\(wd\)\}<\/span>`;/, 'Webhook filter rows must not use HTML string rendering.');
reject(/info\.innerHTML = `\s*<div class="ndns-device-override-title"/, 'Device override rows must not use HTML string rendering.');
reject(/row\.innerHTML = `<span>\$\{opt\.label\}<\/span>`;/, 'Settings option rows must not use HTML string rendering.');

runSafeElementFixture();

if (failures.length) {
  console.error('[dom-sink-policy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[dom-sink-policy] PASS');
