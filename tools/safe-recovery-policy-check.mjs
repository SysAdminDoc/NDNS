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

expect(/const THEME_STUDIO_MAX_CSS_BYTES = 20 \* 1024;/, 'Theme Studio CSS size cap is missing.');
expect(/function validateThemeStudioCss\(css\)[\s\S]*THEME_STUDIO_MAX_CSS_BYTES/, 'Theme Studio CSS validator is missing.');
expect(/function isThemeStudioBypassRequested\(\)[\s\S]*ndns-disable-custom-css/, 'Theme Studio safe-mode bypass is missing.');
expect(/await resetThemeStudioCssForBypass\(\);\s*applyThemeStudioCss\(themeStudioCss\);/, 'Theme Studio bypass must run before custom CSS injection.');
expect(/textarea\.oninput[\s\S]*validateThemeStudioCss\(textarea\.value\)[\s\S]*return;[\s\S]*applyThemeStudioCss\(textarea\.value\);/, 'Theme Studio preview must enforce the CSS size cap.');
expect(/saveBtn\.onclick[\s\S]*validateThemeStudioCss\(textarea\.value\)[\s\S]*await storage\.set\(\{ \[KEY_THEME_STUDIO_CSS\]: themeStudioCss \}\);/, 'Theme Studio save must validate before persisting CSS.');
expect(/importInput\.onchange[\s\S]*validateThemeStudioCss\(css\)[\s\S]*await storage\.set\(\{ \[KEY_THEME_STUDIO_CSS\]: themeStudioCss \}\);/, 'Theme Studio import must validate before persisting CSS.');
expect(/function unwrapProfileImportPayload\(payload\)[\s\S]*nextdns-profile-pre-import[\s\S]*return payload\.profile;/, 'Profile importer must accept pre-import backup wrappers.');
expect(/function downloadProfilePreImportBackup\(profileId, profileConfig\)[\s\S]*backupType: 'nextdns-profile-pre-import'[\s\S]*rollback:/, 'Profile pre-import backup writer is missing rollback metadata.');
expect(/downloadProfilePreImportBackup\(pid, backupConfig\);[\s\S]*makeApiRequest\('PATCH', `\/profiles\/\$\{pid\}`/, 'Profile import must download a backup before PATCH.');
expect(/Destructive sections: \$\{destructiveSections\.length \? destructiveSections\.join\(', '\) : 'none detected'\}/, 'Profile import apply summary must identify destructive sections.');
expect(/Roll back by importing the downloaded pre-import backup file/, 'Profile import failure path must show rollback instructions.');

if (failures.length) {
  console.error('[safe-recovery-policy] FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[safe-recovery-policy] PASS');
