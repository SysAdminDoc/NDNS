# Research - NDNS

## Executive Summary
NDNS is a single-file Tampermonkey/Violentmonkey userscript that turns `my.nextdns.io` into a power-user console with a floating panel, analytics, profile import/export, HaGeZi sync, webhooks, parental-control helpers, and local theming. Its strongest current shape is rapid client-side automation around the official NextDNS API without a backend. Highest-value direction: harden the script now that it has crossed from UI enhancement into account-changing automation. Priority opportunities: fix the local Firefox parity check false failure, add API retry/backoff and cancellation, narrow cross-origin/network trust for webhooks and `GM_xmlhttpRequest`, replace risky HTML sinks with a small rendering helper, add versioned storage migrations and recovery export, make all-profile analytics partially render under failures, add accessible semantics to custom controls, and add privacy controls around any offline log cache.

## Product Map
- Core workflows: API-key onboarding, floating quick-action panel, log filtering/hiding/export, allowlist/denylist edits, analytics dashboard, profile import/clone, HaGeZi sync, webhook alerts, parental-control schedules, theme customization.
- User personas: NextDNS power users, household administrators, MSP/helpdesk operators managing multiple profiles, privacy-focused users who want local-only tooling, userscript users who prefer not to install a full extension.
- Platforms and distribution: `NDNS.user.js` served from GitHub raw URLs, installed through Tampermonkey, Violentmonkey, or ScriptMonkey-compatible managers on browsers that can run userscripts against `https://my.nextdns.io/*`.
- Key integrations and data flows: `GM_xmlhttpRequest` to `api.nextdns.io`, HaGeZi lists from `raw.githubusercontent.com`, arbitrary user-entered webhook URLs, local `GM.setValue` storage for settings/API key/state, local file downloads for CSV/JSON/PDF/HOSTS exports.

## Competitive Landscape
- NXEnhanced: Does focused NextDNS log-page quality-of-life well, especially in-log allow/deny and hiding. Learn from its low-friction log actions. Avoid copying narrow DOM assumptions without a resilience layer.
- Analytics+ for NextDNS: Shows that users value deeper domain analytics from the dashboard. Learn from request-level analytics expansion. Avoid relying on undocumented backend behavior as the only path.
- nextdns-tools: Strong reference for paginated log download, local statistics, and favicon enrichment. Learn from long-range export and summary views. Avoid adding a separate CLI path before browser reliability is hardened.
- hagezi-to-nextdns: Focused list ingestion into NextDNS. Learn from provenance-aware list sync and chunked API application. Avoid treating imported blocklists as anonymous local state.
- Pi-hole: Table-stakes DNS admin UX includes searchable query log, long-term database, grouped clients/domains, and clear auditability. Learn from dense operational diagnostics. Avoid server-only assumptions.
- AdGuard Home: Strong query log filters, client configuration, blocklist management, and safe-search/parental controls. Learn from list manager layout and status visibility. Avoid feature sprawl that needs a daemon.
- Control D / AdGuard DNS / Cloudflare Gateway: Commercial DNS products make analytics, policy assignment, exports, and team-friendly views first-class. Learn from policy clarity and report export polish. Avoid account/team features that would require server storage.
- Technitium DNS Server / Blocky: Adjacent projects expose Prometheus-style observability and structured config/import paths. Learn from diagnostics and backup/restore patterns. Avoid requiring local infrastructure for a browser-only tool.

## Security, Privacy, and Reliability
- Verified: `NDNS.user.js:11-18` grants `GM_xmlhttpRequest` and includes `@connect *`. That is convenient for arbitrary webhooks but increases blast radius if a DOM or template injection bug reaches request code.
- Verified: `makeApiRequest()` in `NDNS.user.js:2058-2088` has error and timeout callbacks but does not set a timeout, retry 429/5xx responses, honor `Retry-After`, or provide cancellation for long all-profile analytics runs.
- Verified: webhook templates and outbound sends are locally editable at `NDNS.user.js:7299-7507`; delivery destinations are arbitrary URLs. Add destination review, host display, and per-host consent before expanding webhook power.
- Verified: the script has 83 `innerHTML`/`outerHTML` sinks, including dynamic dashboard rows and settings content (`NDNS.user.js:2690`, `NDNS.user.js:5103`, `NDNS.user.js:5730`, `NDNS.user.js:6018`, `NDNS.user.js:7728`). Many values are escaped, but the safer baseline is a tiny element-builder plus Trusted Types policy where supported.
- Verified: custom CSS is persisted and injected directly (`NDNS.user.js:4584-4596`). Keep it as a power-user feature, but add a visible reset/recovery path and CSS length guard so a bad import cannot make the dashboard unusable.
- Verified: profile import applies account-changing patches after preview (`NDNS.user.js:4785-4939`). Add pre-apply backup export, section-level rollback metadata, and clearer destructive-change summaries.
- Verified: all-profile analytics fetches profiles sequentially (`NDNS.user.js:5658-5661`) and fails the whole dashboard on top-level errors (`NDNS.user.js:5687-5688`). Commercial and OSS DNS dashboards favor partial data and visible stale/error state.
- Verified: `tools/firefox-parity-check.mjs` currently fails on `NDNS.user.js:6409` because prose containing `browser. API` matches the forbidden `browser.*` check. The release gate is noisy until the regex is narrowed.

## Architecture Assessment
- Single-file pressure is high: `NDNS.user.js` is 9,233 lines, mixing CSS, storage, API, DOM observers, analytics rendering, webhook logic, parental controls, and list management. Keep shipping readable userscript source, but split internal sections into tested pure helpers before adding more workflows.
- Storage is key-heavy but not schema-versioned (`NDNS.user.js:53-99`, `NDNS.user.js:1973-2055`). Add a `KEY_SCHEMA_VERSION`, migration table, storage doctor, and import/export validation to protect existing users.
- API traffic is centralized enough for a shared request queue, retry policy, timeout, and rate-limit telemetry in `makeApiRequest()`.
- Rendering needs a local HTML policy: maintain `escapeHtml()` for text, but prefer `textContent`, `setAttribute`, and structured builders for new UI. Existing HTML templates should be migrated incrementally from highest-risk user/API values first.
- Test coverage is minimal. There is a useful Firefox parity script, but no package manifest, no DOM fixture tests for log rows/settings modals, and no regression tests for storage migrations, domain parsing, webhook expressions, or analytics merges.
- Documentation is current on features and version, but `README.md` does not document recovery flows for broken custom CSS, bad profile imports, rate-limit behavior, or data retention implications for scheduled/offline logs.
- Category coverage: security, privacy, reliability, accessibility, observability, testing, docs, distribution, offline resilience, migration, and upgrade strategy are represented in the roadmap; i18n/l10n is a P3 string-catalog item; plugin ecosystem and mobile-native expansion are rejected for now; multi-user work should stay local multi-profile/MSP export oriented unless server storage is deliberately introduced later.

## Rejected Ideas
- Native server backend: Rejected from Control D/Cloudflare-style team reporting because NDNS's privacy promise is local-only userscript execution.
- Public read-only hosted dashboards: Deferred despite commercial precedent because log/profile data is sensitive and would require sharing or hosting controls not present today.
- Keyboard shortcuts as a priority: Existing roadmap mentions them, but the current product rules disallow keyboard shortcuts; prioritize visible controls and accessibility semantics instead.
- Plugin marketplace: Rejected after reviewing Pi-hole/AdGuard/Technitium ecosystems because a single userscript should first stabilize API, storage, and DOM boundaries.
- Mobile native app parity: Rejected for this repo because BetterNext and Android NextDNS managers cover adjacent platforms; NDNS should keep the browser userscript surface strong.
- Undocumented analytics request rewriting as the main analytics path: Considered from Analytics+ but risky as a primary strategy; only use behind a clearly labeled experimental toggle if implemented.

## Sources
### Project
- https://github.com/SysAdminDoc/NDNS
- https://github.com/SysAdminDoc/BetterNext
- https://github.com/nextdns/api

### Direct and Adjacent OSS
- https://github.com/hjk789/NXEnhanced
- https://codeberg.org/celenity/analyticsplus-for-nextdns
- https://github.com/MrTakedi/nextdns-tools
- https://github.com/vietthedev/hagezi-to-nextdns
- https://github.com/celenityy/nextdns-settings
- https://github.com/pi-hole/web
- https://github.com/AdguardTeam/AdGuardHome
- https://github.com/TechnitiumSoftware/DnsServer
- https://github.com/0xERR0R/blocky
- https://github.com/DNSCrypt/dnscrypt-proxy

### Commercial and Official Docs
- https://nextdns.io/
- https://help.nextdns.io/
- https://controld.com/
- https://docs.controld.com/
- https://adguard-dns.io/
- https://developers.cloudflare.com/cloudflare-one/policies/gateway/dns-policies/

### Standards and Security
- https://www.rfc-editor.org/rfc/rfc8484
- https://www.rfc-editor.org/rfc/rfc7858
- https://www.rfc-editor.org/rfc/rfc9250
- https://www.rfc-editor.org/rfc/rfc8914
- https://www.rfc-editor.org/rfc/rfc9462
- https://www.tampermonkey.net/documentation.php
- https://violentmonkey.github.io/api/gm/
- https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
- https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

## Open Questions
- Needs live validation: exact NextDNS rate-limit behavior and `Retry-After` headers for bulk allowlist/denylist, analytics, and log-download endpoints.
- Needs live validation: whether Tampermonkey/Violentmonkey can support a practical webhook host allowlist without keeping broad `@connect *` for user-entered destinations.
