# Roadmap

Userscript enhancement for the NextDNS web dashboard — floating control panel, API-driven analytics, domain tools, webhooks. Roadmap mirrors BetterNext (the Chrome extension sibling) plus userscript-specific polish.

## Planned Features

### UX / Platform
- Keyboard shortcut picker (rebindable) — currently no shortcuts
- Firefox parity verification on every release (Violentmonkey + Tampermonkey)

## Competitive Research
- **Pi-hole admin UI** — richer network-level analytics; mirror top-domain treemap and tail-log UX.
- **AdGuard Home** — better schedule editor and bulk list management; borrow its list-manager layout.
- **Control D dashboard** — clean profile-switcher UI, good reference for the cross-profile merge.
- **BetterNext** (sibling repo) — keep feature parity; CI diff on every release to catch drift.

## Nice-to-Haves
- Browser-side DoH verification indicator (are you actually using NextDNS right now?)
- Per-tab / per-origin query log filter
- Query replay: send the same DNS query from the browser for debugging
- CLI twin (Node) for headless export of analytics to CSV via the same NextDNS API
- Public read-only dashboard share link for MSP customers
- IndexedDB cache of last 24h logs for offline browsing

## Open-Source Research (Round 2)

### Related OSS Projects
- https://github.com/hjk789/NXEnhanced — NextDNS QoL browser extension: allow/deny buttons in logs, domain hiding, date-filter log loading, relative/absolute timestamps
- https://codeberg.org/celenity/analyticsplus-for-nextdns — Analytics+ extension, bumps domain list from 6 → 50 via request rewriting
- https://github.com/vietthedev/hagezi-to-nextdns — HaGeZi list fetcher that pushes into NextDNS allow/deny lists
- https://github.com/MrTakedi/nextdns-tools — log downloader with pagination (2-year retention), statistics dashboard, favicon integration
- https://github.com/celenityy/nextdns-settings — curated NextDNS config recommendations (content for documentation/preset ideas)
- https://github.com/doubleangels/nextdnsmanager — Android NextDNS settings manager (reference for mobile UX)
- https://github.com/nextdns/api — official API docs, schema source of truth

### Features to Borrow
- In-log allow/deny buttons with "add root domain" / "add specific" / "edit-then-add" options (NXEnhanced) — biggest daily-use win, currently NDNS lacks this
- Client-side log hiding rules (hide crashlytics, telemetry noise) separate from blocklists (NXEnhanced)
- Request-rewrite trick to unlock 50-domain analytics (Analytics+) — implement as an NDNS toggle, undocumented but widely used
- Favicon-on-domain in logs/lists via `icons.duckduckgo.com` or NextDNS favicon service (nextdns-tools) — already common but worth auditing NDNS coverage
- HaGeZi / OISD / 1Hosts bulk-import wizard (hagezi-to-nextdns) — fetch + chunked POST with NextDNS API ratelimit handling
- Log export to CSV/JSON with 2-year pagination (nextdns-tools)
- Statistics dashboard: unique domains, device counts, blocked ratios (nextdns-tools) — supplements native analytics

### Patterns & Architectures Worth Studying
- Request-interception via fetch/XHR hook to rewrite API query params before they hit NextDNS backend (Analytics+) — userscript-level, no server needed
- Chunked API pagination with exponential backoff for large log pulls (nextdns-tools) — NextDNS ratelimits aggressively on the logs endpoint
- Blocklist merge with deduplication and per-list provenance tracking (hagezi-to-nextdns) — lets users see "this domain came from HaGeZi Multi"
- Cross-session floating panel state that persists via `GM_setValue` with versioned schema — survives NDNS UI redesigns

## Research-Driven Additions

- [ ] P0 - Repair the Firefox parity release gate
  Why: The current parity checker fails on prose containing `browser. API`, so release verification is noisy.
  Evidence: `tools/firefox-parity-check.mjs`; `NDNS.user.js:6409`
  Touches: `tools/firefox-parity-check.mjs`, optional fixture strings in `tools/`
  Acceptance: `rtk node tools/firefox-parity-check.mjs` passes while still failing real `browser.` and `chrome.` API usage.
  Complexity: S

- [ ] P0 - Add API timeout, retry, and rate-limit handling
  Why: Bulk edits, all-profile analytics, HaGeZi sync, and parental schedules can fail hard under transient NextDNS errors or rate limits.
  Evidence: `NDNS.user.js:2058-2088`; nextdns-tools pagination/backoff pattern; NextDNS API usage
  Touches: `makeApiRequest`, `fetchLogsCsv`, HaGeZi sync, bulk domain import, analytics loaders
  Acceptance: API calls use an explicit timeout, retry 429/5xx with bounded exponential backoff and `Retry-After` support, surface final failures in toast/status UI, and never duplicate non-idempotent writes.
  Complexity: M

- [ ] P0 - Harden cross-origin request and webhook trust boundaries
  Why: `@connect *` plus arbitrary webhook URLs gives the userscript broad outbound reach from a page that stores an API key.
  Evidence: `NDNS.user.js:11-18`; `NDNS.user.js:7299-7507`; Tampermonkey and Violentmonkey `GM_xmlhttpRequest` docs
  Touches: userscript metadata, webhook settings UI, `postWebhookPayload`, `makeApiRequest`
  Acceptance: webhook saves show destination host and consent state, non-NextDNS requests never receive `X-Api-Key`, high-risk schemes/hosts are blocked, and metadata uses the narrowest practical `@connect` set.
  Complexity: M

- [ ] P1 - Replace high-risk HTML string sinks with safe render helpers
  Why: The script has dozens of `innerHTML` sinks fed by API, profile, domain, and template data; escaping is manual and uneven.
  Evidence: `NDNS.user.js:2690`, `NDNS.user.js:5103`, `NDNS.user.js:5730`, `NDNS.user.js:6018`, `NDNS.user.js:7728`; MDN Trusted Types; OWASP XSS cheat sheet
  Touches: shared DOM helpers, analytics widgets, settings modal, profile import diff, list-row enhancements
  Acceptance: new helper APIs cover text nodes, attributes, fragments, and optional Trusted Types policy; migrated sinks preserve UI and pass a targeted DOM fixture test with malicious domain/profile names.
  Complexity: L

- [ ] P1 - Add versioned storage migrations and a storage doctor
  Why: NDNS now persists many independent keys without a schema version, migration path, or corrupted-state recovery.
  Evidence: `NDNS.user.js:53-99`; `NDNS.user.js:1973-2055`; Pi-hole/AdGuard backup and config patterns
  Touches: `initializeState`, storage wrapper, settings Data Management section, profile/theme/domain importers
  Acceptance: storage has `KEY_SCHEMA_VERSION`, migrations are idempotent, invalid stored values are repaired with a visible report, and users can export/import an NDNS settings backup separate from NextDNS profile JSON.
  Complexity: M

- [ ] P1 - Make all-profile analytics resilient and partially renderable
  Why: One failed profile or endpoint should not blank the whole analytics dashboard.
  Evidence: `NDNS.user.js:5416-5496`; `NDNS.user.js:5642-5688`; Pi-hole, AdGuard Home, and Control D analytics UX
  Touches: `fetchAnalyticsPayload`, `mergeAnalyticsPayloads`, analytics cache shape, analytics loading/error UI, CSV/JSON/PDF exports
  Acceptance: profile and endpoint failures render inline warnings, successful profiles still display/export, exports include an errors section, and retries can be triggered without reloading the page.
  Complexity: M

- [ ] P1 - Add accessibility semantics for custom modals, toggles, and dashboards
  Why: Custom div toggles and modal overlays lack consistent roles, labels, focus management, and screen-reader status output.
  Evidence: settings controls around `NDNS.user.js:7717-8168`; recent mobile panel work; WCAG expectations
  Touches: settings modal, onboarding modal, theme/density toggles, HaGeZi/webhook/parental controls, analytics loading/error states
  Acceptance: interactive divs become buttons or `role="switch"` with `aria-checked`, modals trap/restore focus, loading/error regions use live status semantics, and keyboard tab order works without hidden traps.
  Complexity: M

- [ ] P1 - Add safe recovery for custom CSS and profile imports
  Why: Theme Studio and profile import are powerful account/UI mutation paths with limited rollback if bad CSS or imported config breaks the experience.
  Evidence: `NDNS.user.js:4584-4596`; `NDNS.user.js:4785-4939`; commercial DNS dashboard backup/restore patterns
  Touches: Theme Studio controls, profile import modal, profile export, settings Data Management
  Acceptance: custom CSS has a max-size guard and reset-on-load bypass, profile import creates a timestamped pre-change backup, apply summaries identify destructive sections, and rollback instructions are shown after failures.
  Complexity: M

- [ ] P2 - Add privacy controls to the planned offline log cache
  Why: Offline log browsing is valuable, but DNS logs expose sensitive habits and need TTL, purge, and export boundaries from the start.
  Evidence: existing ROADMAP IndexedDB cache item; NextDNS privacy/log retention docs; Pi-hole long-term data model
  Touches: future IndexedDB log cache, settings Data Management, scheduled log downloads, log export flows
  Acceptance: cached logs are opt-in, TTL-limited, profile-scoped, purgeable from settings, excluded from normal settings backup unless explicitly selected, and visibly marked as local cached data.
  Complexity: M

- [ ] P2 - Add local fixture tests for parser and workflow helpers
  Why: Rapid single-file feature additions need cheap regression checks beyond syntax and metadata.
  Evidence: `normalizeImportedDomain`, webhook expression parser, analytics merge helpers, storage keys, current parity checker
  Touches: `tools/`, optional `package.json`, pure helper extraction inside `NDNS.user.js`
  Acceptance: local test command covers domain normalization, blocklist parsing, webhook filters/templates, analytics merges, storage migrations, and the Firefox parity check without needing live NextDNS credentials.
  Complexity: M

- [ ] P3 - Introduce an optional UI string catalog
  Why: User-facing labels are hardcoded across settings, analytics, webhooks, parental controls, and import flows, making copy cleanup and future localization costly.
  Evidence: `NDNS.user.js:7717-8168`; NextDNS international user base
  Touches: settings labels, analytics labels, toast messages, modal text, export labels
  Acceptance: repeated strings move into a small catalog, English remains the default, and all existing UI text remains unchanged unless intentionally revised.
  Complexity: L
