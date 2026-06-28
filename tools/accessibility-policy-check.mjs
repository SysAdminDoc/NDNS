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

expect(/function setupDialogAccessibility\(overlay, dialog, label\)[\s\S]*role', 'dialog'[\s\S]*aria-modal', 'true'[\s\S]*event\.key !== 'Tab'/, 'Dialog setup must add roles and trap Tab focus.');
expect(/function restoreDialogFocus\(overlay\)[\s\S]*previous\.focus/, 'Dialog focus restoration helper is missing.');
expect(/function initAccessibilityObserver\(\)[\s\S]*scanDialogAccessibility\(\);[\s\S]*scanSwitchAccessibility\(\);/, 'Accessibility observer must scan dialogs and switches.');
expect(/function enhanceSwitch\(element, label, checked = false\)[\s\S]*role', 'switch'[\s\S]*tabIndex = 0[\s\S]*aria-checked/, 'Switch helper must add role, aria-checked, and tab focusability.');
expect(/function inferSwitchLabel\(element\)[\s\S]*closest\('\.settings-control-row, \.ndns-parental-toggle, \.ndns-device-override-row, \.ndns-webhook-row, \.ndns-weekly-schedule'\)/, 'Switch labels must be inferred from nearby visible labels.');
expect(/settingsButton\.onclick = \(\) => \{[\s\S]*scanDialogAccessibility\(settingsModal\);[\s\S]*focusDialog\(settingsModal\);/, 'Settings button must focus the dialog on open.');
expect(/closeButton\.setAttribute\('aria-label', 'Close settings'\);/, 'Settings close button needs an accessible label.');
expect(/restoreDialogFocus\(settingsModal\);/, 'Escape close must restore focus from settings modal.');
expect(/loading\.setAttribute\('role', 'status'\);[\s\S]*loading\.setAttribute\('aria-live', 'polite'\);/, 'Analytics loading must be a live status region.');
expect(/warning\.setAttribute\('role', 'status'\);[\s\S]*warning\.setAttribute\('aria-live', 'polite'\);/, 'Analytics partial warning must be a live status region.');

if (failures.length) {
  console.error('[accessibility-policy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[accessibility-policy] PASS');
