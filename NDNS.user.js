// ==UserScript==
// @name         NextDNS Ultimate Control Panel
// @namespace    https://github.com/SysAdminDoc
// @version      3.4.41
// @updateURL      https://raw.githubusercontent.com/SysAdminDoc/NDNS/master/NDNS.user.js
// @downloadURL    https://raw.githubusercontent.com/SysAdminDoc/NDNS/master/NDNS.user.js
// @description  Enhanced control panel for NextDNS with condensed view, quick actions, and consistent UI state across pages.
// @author       Matt Parker, with community patches
// @match        https://my.nextdns.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nextdns.io
// @connect      api.nextdns.io
// @connect      dns.nextdns.io
// @connect      raw.githubusercontent.com
// @connect      *
// @grant        GM_addStyle
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

const storage = {
  get: async (keys) => {
    const results = {};
    const keysToFetch = Array.isArray(keys) ? keys : Object.keys(keys);
    const defaults = Array.isArray(keys) ? {} : keys;
    for (const key of keysToFetch) {
      results[key] = await GM.getValue(key, defaults[key]);
    }
    return results;
  },
  set: (items) => {
    const promises = Object.entries(items).map(([key, value]) => GM.setValue(key, value));
    return Promise.all(promises);
  },
  remove: (keys) => {
    const keysToRemove = Array.isArray(keys) ? keys : [keys];
    const promises = keysToRemove.map(key => GM.deleteValue(key));
    return Promise.all(promises);
  }
};

function addGlobalStyle(css) {
    GM_addStyle(css);
}

(function() {
    'use strict';

    // --- CONFIGURATION & STORAGE KEYS ---
    let NDNS_API_KEY = null;
    let globalProfileId = null;
    const KEY_PREFIX = 'ndns_';
    const KEY_SCHEMA_VERSION = `${KEY_PREFIX}schema_version_v1`;
    const KEY_POSITION_TOP = `${KEY_PREFIX}panel_position_top_v2`;
    const KEY_POSITION_SIDE = `${KEY_PREFIX}panel_position_side_v2`;
    const KEY_FILTER_STATE = `${KEY_PREFIX}filter_state_v2`;
    const KEY_HIDDEN_DOMAINS = `${KEY_PREFIX}hidden_domains_v2`;
    const KEY_LOCK_STATE = `${KEY_PREFIX}lock_state_v1`;
    const KEY_THEME = `${KEY_PREFIX}theme_v1`;
    const KEY_WIDTH = `${KEY_PREFIX}panel_width_v1`;
    const KEY_API_KEY = `${KEY_PREFIX}api_key`;
    const KEY_PROFILE_ID = `${KEY_PREFIX}profile_id_v1`;
    const KEY_DOMAIN_ACTIONS = `${KEY_PREFIX}domain_actions_v1`;
    const KEY_DOMAIN_UNDO_STACK = `${KEY_PREFIX}domain_undo_stack_v1`;
    const KEY_DOMAIN_OF_DAY = `${KEY_PREFIX}domain_of_day_v1`;
    const KEY_LIST_PAGE_THEME = `${KEY_PREFIX}list_page_theme_v1`;
    const KEY_HAGEZI_ADDED_TLDS = `${KEY_PREFIX}hagezi_added_tlds_v1`;
    const KEY_HAGEZI_ADDED_ALLOWLIST = `${KEY_PREFIX}hagezi_added_allowlist_v1`;
    const KEY_HAGEZI_LIST_META = `${KEY_PREFIX}hagezi_list_meta_v1`;
    const KEY_HAGEZI_LIST_SNAPSHOTS = `${KEY_PREFIX}hagezi_list_snapshots_v1`;
    const KEY_HAGEZI_AUTO_SYNC = `${KEY_PREFIX}hagezi_auto_sync_v1`;
    // NEW KEYS for v2.0
    const KEY_ULTRA_CONDENSED = `${KEY_PREFIX}ultra_condensed_v1`;
    const KEY_CUSTOM_CSS_ENABLED = `${KEY_PREFIX}custom_css_enabled_v1`;
    const KEY_THEME_STUDIO_CSS = `${KEY_PREFIX}theme_studio_css_v1`;
    const KEY_DENSITY_MODE = `${KEY_PREFIX}density_mode_v1`;
    // NEW KEYS for v2.5 (NDNS features)
    const KEY_DOMAIN_DESCRIPTIONS = `${KEY_PREFIX}domain_descriptions_v1`;
    const KEY_DOMAIN_TAGS = `${KEY_PREFIX}domain_tags_v1`;
    const KEY_LIST_SORT_AZ = `${KEY_PREFIX}list_sort_az_v1`;
    const KEY_LIST_SORT_TLD = `${KEY_PREFIX}list_sort_tld_v1`;
    const KEY_LIST_BOLD_ROOT = `${KEY_PREFIX}list_bold_root_v1`;
    const KEY_LIST_LIGHTEN_SUB = `${KEY_PREFIX}list_lighten_sub_v1`;
    const KEY_LIST_RIGHT_ALIGN = `${KEY_PREFIX}list_right_align_v1`;

    const KEY_SHOW_LOG_COUNTERS = `${KEY_PREFIX}show_log_counters_v1`;
    const KEY_COLLAPSE_BLOCKLISTS = `${KEY_PREFIX}collapse_blocklists_v1`;
    const KEY_COLLAPSE_TLDS = `${KEY_PREFIX}collapse_tlds_v1`;
    // NEW KEYS for v3.4 (advanced features)
    const KEY_REGEX_PATTERNS = `${KEY_PREFIX}regex_patterns_v1`;
    const KEY_SCHEDULED_LOGS = `${KEY_PREFIX}scheduled_logs_v1`;
    const KEY_WEBHOOK_URL = `${KEY_PREFIX}webhook_url_v1`;
    const KEY_WEBHOOK_DOMAINS = `${KEY_PREFIX}webhook_domains_v1`;
    const KEY_WEBHOOK_TEMPLATE = `${KEY_PREFIX}webhook_template_v1`;
    const KEY_WEBHOOK_DELIVERIES = `${KEY_PREFIX}webhook_deliveries_v1`;
    const KEY_WEBHOOK_RATE_LIMIT = `${KEY_PREFIX}webhook_rate_limit_v1`;
    const KEY_WEBHOOK_TRUST = `${KEY_PREFIX}webhook_trust_v1`;
    const KEY_SHOW_CNAME_CHAIN = `${KEY_PREFIX}show_cname_chain_v1`;
    const KEY_PARENTAL_WEEKLY_SCHEDULE = `${KEY_PREFIX}parental_weekly_schedule_v1`;
    const KEY_PARENTAL_DEVICE_OVERRIDES = `${KEY_PREFIX}parental_device_overrides_v1`;
    const KEY_OFFLINE_LOG_CACHE_PRIVACY = `${KEY_PREFIX}offline_log_cache_privacy_v1`;
    const STORAGE_SCHEMA_VERSION = 1;
    const STORAGE_BACKUP_TYPE = 'ndns-settings';
    const defaultFilters = { hideList: false, hideBlocked: false, showOnlyWhitelisted: false, autoRefresh: false };
    const STORAGE_DEFAULTS = {
        [KEY_FILTER_STATE]: defaultFilters,
        [KEY_HIDDEN_DOMAINS]: ['nextdns.io'],
        [KEY_LOCK_STATE]: true,
        [KEY_THEME]: 'dark',
        [KEY_WIDTH]: 180,
        [KEY_API_KEY]: null,
        [KEY_PROFILE_ID]: null,
        [KEY_DOMAIN_ACTIONS]: {},
        [KEY_DOMAIN_UNDO_STACK]: [],
        [KEY_DOMAIN_OF_DAY]: {},
        [KEY_LIST_PAGE_THEME]: true,
        [KEY_HAGEZI_ADDED_TLDS]: [],
        [KEY_HAGEZI_ADDED_ALLOWLIST]: [],
        [KEY_HAGEZI_LIST_META]: {},
        [KEY_HAGEZI_LIST_SNAPSHOTS]: {},
        [KEY_HAGEZI_AUTO_SYNC]: { enabled: false, lastRun: null },
        [KEY_ULTRA_CONDENSED]: true,
        [KEY_CUSTOM_CSS_ENABLED]: true,
        [KEY_THEME_STUDIO_CSS]: '',
        [KEY_DENSITY_MODE]: 'compact',
        [KEY_DOMAIN_DESCRIPTIONS]: {},
        [KEY_DOMAIN_TAGS]: {},
        [KEY_LIST_SORT_AZ]: false,
        [KEY_LIST_SORT_TLD]: false,
        [KEY_LIST_BOLD_ROOT]: true,
        [KEY_LIST_LIGHTEN_SUB]: true,
        [KEY_LIST_RIGHT_ALIGN]: false,
        [KEY_SHOW_LOG_COUNTERS]: true,
        [KEY_COLLAPSE_BLOCKLISTS]: false,
        [KEY_COLLAPSE_TLDS]: false,
        [KEY_REGEX_PATTERNS]: [],
        [KEY_SCHEDULED_LOGS]: { enabled: false, interval: 'daily', lastRun: null },
        [KEY_WEBHOOK_URL]: '',
        [KEY_WEBHOOK_DOMAINS]: [],
        [KEY_WEBHOOK_TEMPLATE]: { preset: 'generic', template: '' },
        [KEY_WEBHOOK_DELIVERIES]: [],
        [KEY_WEBHOOK_RATE_LIMIT]: 60,
        [KEY_WEBHOOK_TRUST]: { url: '', host: '', consent: false },
        [KEY_SHOW_CNAME_CHAIN]: true,
        [KEY_PARENTAL_WEEKLY_SCHEDULE]: { enabled: false, slots: [], lastApplied: null },
        [KEY_PARENTAL_DEVICE_OVERRIDES]: { rules: [], activeRuleId: null, previousRecreationEnabled: null },
        [KEY_OFFLINE_LOG_CACHE_PRIVACY]: { enabled: false, ttlDays: 1, includeInBackups: false, lastPurged: null }
    };
    const STORAGE_BACKUP_EXCLUDED_KEYS = new Set([KEY_API_KEY]);
    const STORAGE_BACKUP_KEYS = Object.keys(STORAGE_DEFAULTS).filter(key => !STORAGE_BACKUP_EXCLUDED_KEYS.has(key));

    // --- HAGEZI CONFIG ---
    const HAGEZI_TLDS_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock-aggressive.txt";
    const HAGEZI_ALLOWLIST_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock-allow.txt";
    const HAGEZI_AUTO_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
    const API_REQUEST_TIMEOUT_MS = 30000;
    const API_MAX_RETRIES = 2;
    const API_RETRY_BASE_DELAY_MS = 600;
    const API_RETRY_MAX_DELAY_MS = 10000;
    const NON_RETRYABLE_WRITE_METHODS = new Set(['POST']);
    const NEXTDNS_TEST_URL = 'https://test.nextdns.io';
    const NEXTDNS_DOH_URL = 'https://dns.nextdns.io';
    const DNS_REPLAY_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
    const THEME_STUDIO_MAX_CSS_BYTES = 20 * 1024;
    const THEME_STUDIO_BYPASS_PARAMS = ['ndns-safe-mode', 'ndnsDisableCustomCss'];
    const OFFLINE_LOG_CACHE_DB_NAME = `${KEY_PREFIX}offline_logs_v1`;
    const OFFLINE_LOG_CACHE_TTL_DAYS = [1, 7, 14, 30];
    const UI_STRINGS = Object.freeze({
        analyticsDashboard: 'Analytics Dashboard',
        cancel: 'Cancel',
        clear: 'Clear',
        export: 'Export',
        exportCsv: 'Export CSV',
        exportJson: 'Export JSON',
        exportPdf: 'Export PDF',
        exportProfile: 'Export Profile',
        import: 'Import',
        importProfile: 'Import Profile',
        refresh: 'Refresh',
        save: 'Save',
        settings: '\u2699\ufe0f Settings',
        themeStudio: 'Theme Studio'
    });

    // --- GLOBAL STATE ---
    let panel, lockButton, settingsModal, togglePosButton, settingsButton;
    let leftHeaderControls, rightHeaderControls;
    let isManuallyLocked = false;
    let filters = {};
    let logOriginFilter = '';
    let hiddenDomains = new Set();
    let domainActions = {};
    let domainUndoStack = [];
    let domainOfDayState = {};
    let autoRefreshInterval = null;
    let currentTheme = 'dark';
    let panelWidth = 240;
    let isPreloadingCancelled = false;
    let enableListPageTheme = true;
    let listPageThemeStyleElement = null;
    let hageziListMeta = {};
    let hageziListSnapshots = {};
    let hageziAutoSyncConfig = { enabled: false, lastRun: null };
    let hageziAutoSyncTimer = null;
    let hageziAutoSyncRunning = false;
    // NEW STATE for v2.0
    let isUltraCondensed = true;
    let customCssEnabled = true;
    let ultraCondensedStyleElement = null;
    let themeStudioCss = '';
    let themeStudioStyleElement = null;
    let densityMode = 'compact';
    // NEW STATE for v2.5 (NDNS features)
    let domainDescriptions = {};
    let domainTags = {};
    let listSortAZ = false;
    let listSortTLD = false;
    let listBoldRoot = true;
    let listLightenSub = true;
    let listRightAlign = false;

    let showLogCounters = true;
    let collapseBlocklists = false;
    let collapseTLDs = false;
    // NEW STATE for v3.4 (advanced features)
    let regexPatterns = [];
    let scheduledLogsConfig = { enabled: false, interval: 'daily', lastRun: null };
    let webhookUrl = '';
    let webhookDomains = [];
    let webhookTemplate = { preset: 'generic', template: '' };
    let webhookDeliveries = [];
    let webhookRateLimitSeconds = 60;
    let webhookTrust = { url: '', host: '', consent: false };
    let showCnameChain = true;
    let scheduledLogTimer = null;
    let parentalWeeklySchedule = { enabled: false, slots: [] };
    let parentalWeeklyTimer = null;
    let parentalWeeklyApplying = false;
    let parentalWeeklyLastErrorAt = 0;
    let parentalDeviceOverrides = { rules: [], activeRuleId: null, previousRecreationEnabled: null };
    let parentalDeviceOverrideTimer = null;
    let parentalDeviceOverrideApplying = false;
    let parentalDeviceOverrideLastErrorAt = 0;
    let storageDoctorReport = null;
    let offlineLogCachePrivacy = { enabled: false, ttlDays: 1, includeInBackups: false, lastPurged: null };
    // SLDs for proper root domain detection (unified list used everywhere)
    const SLDs = new Set(["co", "com", "org", "edu", "gov", "mil", "net", "ac", "or", "ne", "go", "ltd"]);

    // --- SVG ICON BUILDER ---
    function buildSvgIcon(pathData, viewBox = '0 0 24 24') {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', viewBox);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        svg.appendChild(path);
        return svg;
    }

    const icons = {
        unlocked: buildSvgIcon("M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm3 5V7c0-1.66-1.34-3-3-3S9 5.34 9 7h2c0-.55.45-1 1-1s1 .45 1 1v2h-4v8h12v-8h-5z"),
        locked: buildSvgIcon("M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3z"),
        arrowLeft: buildSvgIcon("M15 19l-7-7 7-7"),
        arrowRight: buildSvgIcon("M9 5l7 7-7 7"),
        settings: buildSvgIcon("M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"),
        eye: buildSvgIcon("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7C10.62 9.5 9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S13.38 9.5 12 9.5z"),
        eyeSlash: buildSvgIcon("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.11 17 4.5 12 4.5c-1.6 0-3.14.35-4.6.98l2.1 2.1C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"),
        remove: buildSvgIcon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"),
        github: buildSvgIcon("M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.291 0 .319.217.694.824.576C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"),
        // New icons for v2.0
        download: buildSvgIcon("M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"),
        trash: buildSvgIcon("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"),
        refresh: buildSvgIcon("M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"),
        star: buildSvgIcon("M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"),
        starOutline: buildSvgIcon("M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"),
        compress: buildSvgIcon("M4 14h4v4h2v-6H4v2zm4-4H4v2h6V6H8v4zm8 8h-2v-6h6v2h-4v4zm-2-12v4h4V6h2v6h-6V6h2z"),
        expand: buildSvgIcon("M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z"),
        chart: buildSvgIcon("M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"),
        copy: buildSvgIcon("M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"),
        link: buildSvgIcon("M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"),
        filter: buildSvgIcon("M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"),
        clock: buildSvgIcon("M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"),
        shield: buildSvgIcon("M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"),
        zap: buildSvgIcon("M7 2v11h3v9l7-12h-4l4-8z"),
        menu: buildSvgIcon("M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"),
        chevronDown: buildSvgIcon("M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"),
        chevronUp: buildSvgIcon("M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"),
        close: buildSvgIcon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z")
    };

    // --- INJECTED CSS ---
    addGlobalStyle(`
        :root, html[data-ndns-theme="dark"] {
            --panel-bg: rgba(22, 22, 26, 0.95);
            --panel-bg-solid: #16161a;
            --panel-text: #fffffe;
            --panel-text-secondary: #c0c8d4;
            --panel-header-bg: rgba(32, 32, 38, 0.98);
            --panel-border: rgba(148, 161, 178, 0.1);
            --btn-bg: rgba(148, 161, 178, 0.1);
            --btn-hover-bg: rgba(148, 161, 178, 0.2);
            --btn-border: rgba(148, 161, 178, 0.15);
            --btn-active-bg: linear-gradient(135deg, #7f5af0 0%, #6246ea 100%);
            --scrollbar-track: rgba(148, 161, 178, 0.05);
            --scrollbar-thumb: rgba(148, 161, 178, 0.2);
            --handle-color: #7f5af0;
            --input-bg: rgba(148, 161, 178, 0.08);
            --input-text: #fffffe;
            --input-border: rgba(148, 161, 178, 0.15);
            --input-focus: #7f5af0;
            --success-color: #2cb67d;
            --danger-color: #e53170;
            --info-color: #7f5af0;
            --warning-color: #ffc857;
            --section-bg: rgba(148, 161, 178, 0.05);
            --accent-color: #7f5af0;
            --accent-secondary: #2cb67d;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
            --glow-color: rgba(127, 90, 240, 0.15);
        }
        html[data-ndns-theme="light"] {
            --panel-bg: rgba(255, 255, 255, 0.95);
            --panel-bg-solid: #ffffff;
            --panel-text: #16161a;
            --panel-text-secondary: #33384a;
            --panel-header-bg: rgba(248, 249, 252, 0.98);
            --panel-border: rgba(22, 22, 26, 0.08);
            --btn-bg: rgba(22, 22, 26, 0.05);
            --btn-hover-bg: rgba(22, 22, 26, 0.1);
            --btn-border: rgba(22, 22, 26, 0.1);
            --btn-active-bg: linear-gradient(135deg, #6246ea 0%, #7f5af0 100%);
            --scrollbar-track: rgba(22, 22, 26, 0.03);
            --scrollbar-thumb: rgba(22, 22, 26, 0.15);
            --input-bg: rgba(22, 22, 26, 0.04);
            --input-text: #16161a;
            --input-border: rgba(22, 22, 26, 0.12);
            --input-focus: #6246ea;
            --section-bg: rgba(22, 22, 26, 0.03);
            --accent-color: #6246ea;
            --accent-secondary: #1f9d5c;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
            --glow-color: rgba(98, 70, 234, 0.1);
        }
        html[data-ndns-theme="darkblue"] {
            --panel-bg: rgba(25, 32, 40, 0.95);
            --panel-bg-solid: #192028;
            --panel-text: #e8f1ff;
            --panel-text-secondary: #b2bdcb;
            --panel-header-bg: rgba(31, 40, 51, 0.98);
            --panel-border: rgba(90, 155, 207, 0.12);
            --btn-bg: rgba(90, 155, 207, 0.1);
            --btn-hover-bg: rgba(90, 155, 207, 0.18);
            --btn-border: rgba(90, 155, 207, 0.15);
            --btn-active-bg: linear-gradient(135deg, #5a9bcf 0%, #4a8bbf 100%);
            --scrollbar-track: rgba(90, 155, 207, 0.05);
            --scrollbar-thumb: rgba(90, 155, 207, 0.2);
            --handle-color: #5a9bcf;
            --input-bg: rgba(90, 155, 207, 0.08);
            --input-text: #e8f1ff;
            --input-border: rgba(90, 155, 207, 0.15);
            --input-focus: #5a9bcf;
            --success-color: #41b883;
            --danger-color: #e06c75;
            --info-color: #61afef;
            --warning-color: #e5c07b;
            --section-bg: rgba(90, 155, 207, 0.05);
            --accent-color: #5a9bcf;
            --accent-secondary: #41b883;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
            --glow-color: rgba(90, 155, 207, 0.12);
        }

        /* Dark Blue Theme - Full Page Styles */
        html[data-ndns-theme="darkblue"] body {
            background-color: #192028 !important;
            color: #b8c5d6 !important;
        }
        html[data-ndns-theme="darkblue"] .Header {
            background-color: #192028 !important;
            border-bottom-color: #2d3a4a !important;
        }
        html[data-ndns-theme="darkblue"] .Header img {
            filter: brightness(0) invert(1);
        }
        html[data-ndns-theme="darkblue"] .nav {
            background: #1f2833 !important;
            border: none !important;
        }
        html[data-ndns-theme="darkblue"] .nav .nav-link {
            color: #b8c5d6 !important;
        }
        html[data-ndns-theme="darkblue"] .nav .nav-link.active {
            background-color: transparent !important;
            border-bottom-color: #5a9bcf !important;
        }
        html[data-ndns-theme="darkblue"] .card,
        html[data-ndns-theme="darkblue"] .list-group-item {
            background-color: #1f2833 !important;
            color: #b8c5d6 !important;
            border-color: #2d3a4a !important;
        }
        html[data-ndns-theme="darkblue"] .list-group-item:hover {
            background-color: #243040 !important;
        }
        html[data-ndns-theme="darkblue"] .btn-primary {
            background-color: #5a9bcf !important;
            border-color: #5a9bcf !important;
            color: #192028 !important;
        }
        html[data-ndns-theme="darkblue"] .btn-light {
            background-color: #243040 !important;
            color: #b8c5d6 !important;
            border-color: #3d4a5a !important;
        }
        html[data-ndns-theme="darkblue"] .form-control,
        html[data-ndns-theme="darkblue"] .custom-select,
        html[data-ndns-theme="darkblue"] .form-select {
            background-color: #1f2833 !important;
            color: #b8c5d6 !important;
            border-color: #3d4a5a !important;
        }
        html[data-ndns-theme="darkblue"] .modal-content {
            background-color: #1f2833 !important;
        }
        html[data-ndns-theme="darkblue"] .modal-header {
            background-color: #243040 !important;
            border-bottom-color: #3d4a5a !important;
        }
        html[data-ndns-theme="darkblue"] .dropdown-menu {
            background-color: #243040 !important;
            border-color: #3d4a5a !important;
        }
        html[data-ndns-theme="darkblue"] .dropdown-item {
            color: #b8c5d6 !important;
        }
        html[data-ndns-theme="darkblue"] .dropdown-item:hover {
            background-color: #2d3a4a !important;
        }
        html[data-ndns-theme="darkblue"] a {
            color: #61afef !important;
        }
        html[data-ndns-theme="darkblue"] a:hover {
            color: #8ac7f4 !important;
        }
        html[data-ndns-theme="darkblue"] .text-muted {
            color: #b2bdcb !important;
        }
        html[data-ndns-theme="darkblue"] .settings-button path,
        html[data-ndns-theme="darkblue"] .stream-button path {
            fill: #b8c5d6 !important;
        }

        /* Log Entry Row Coloring Based on Status */
        .Logs .log.list-group-item.ndns-row-blocked {
            background-color: rgba(113, 14, 14, 0.35) !important;
        }
        .Logs .log.list-group-item.ndns-row-allowed {
            background-color: rgba(14, 113, 35, 0.35) !important;
        }
        /* Dark Blue Theme - Log Entry Row Coloring */
        html[data-ndns-theme="darkblue"] .Logs .log.list-group-item.ndns-row-blocked {
            background-color: rgba(224, 108, 117, 0.2) !important;
        }
        html[data-ndns-theme="darkblue"] .Logs .log.list-group-item.ndns-row-allowed {
            background-color: rgba(65, 184, 131, 0.2) !important;
        }
        /* Light Theme - Log Entry Row Coloring */
        html[data-ndns-theme="light"] .Logs .log.list-group-item.ndns-row-blocked {
            background-color: rgba(220, 53, 69, 0.15) !important;
        }
        html[data-ndns-theme="light"] .Logs .log.list-group-item.ndns-row-allowed {
            background-color: rgba(40, 167, 69, 0.15) !important;
        }

        /* ============================================
           MODERN PANEL DESIGN
           ============================================ */

        .ndns-panel {
            position: fixed;
            z-index: 9999;
            background: var(--panel-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            color: var(--panel-text);
            border-radius: 16px;
            box-shadow: var(--card-shadow), 0 0 0 1px var(--panel-border);
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
            font-size: 13px;
            overflow: hidden;
        }
        .ndns-panel:hover {
            box-shadow: var(--card-shadow), 0 0 40px var(--glow-color), 0 0 0 1px var(--panel-border);
        }
        .ndns-panel.left-side {
            left: 0;
            border-left: none;
            border-right: 4px solid var(--handle-color);
            transform: translateX(calc(-100% + 4px));
            border-radius: 0 16px 16px 0;
        }
        .ndns-panel.right-side {
            right: 0;
            border-right: none;
            border-left: 4px solid var(--handle-color);
            transform: translateX(calc(100% - 4px));
            border-radius: 16px 0 0 16px;
        }
        .ndns-panel.visible { transform: translateX(0); }
        div.ndns-panel.right-side.visible, div.ndns-panel.left-side.visible { margin: 0; padding: 0; }

        /* Panel Header */
        .ndns-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            cursor: move;
            background: var(--panel-header-bg);
            border-bottom: 1px solid var(--panel-border);
        }
        .ndns-header-title {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .ndns-panel.left-side .ndns-panel-header { border-top-right-radius: 16px; }
        .ndns-panel.right-side .ndns-panel-header { border-top-left-radius: 16px; }

        .panel-header-controls { display: flex; align-items: center; gap: 4px; }
        .panel-header-controls button, .panel-header-controls a {
            background: var(--btn-bg);
            border: none;
            color: var(--panel-text-secondary);
            cursor: pointer;
            padding: 6px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        .panel-header-controls button:hover, .panel-header-controls a:hover {
            background: var(--btn-hover-bg);
            color: var(--panel-text);
            transform: translateY(-1px);
        }
        .panel-header-controls svg { pointer-events: none; width: 16px; height: 16px; }

        /* Panel Content */
        div.ndns-panel-content {
            padding: 8px;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
            overflow-x: hidden;
        }
        .ndns-panel-content::-webkit-scrollbar { width: 5px; }
        .ndns-panel-content::-webkit-scrollbar-track { background: transparent; }
        .ndns-panel-content::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 10px;
        }
        .ndns-panel-content::-webkit-scrollbar-thumb:hover {
            background: var(--panel-text-secondary);
        }

        /* Panel Footer */
        .ndns-panel-footer {
            padding: 10px 14px;
            background: var(--panel-header-bg);
            border-top: 1px solid var(--panel-border);
            text-align: center;
            font-size: 10px;
            color: var(--panel-text-secondary);
            letter-spacing: 0.3px;
        }
        .ndns-panel.left-side .ndns-panel-footer { border-bottom-right-radius: 16px; }
        .ndns-panel.right-side .ndns-panel-footer { border-bottom-left-radius: 16px; }

        /* ============================================
           MODERN BUTTON STYLES
           ============================================ */

        button.ndns-panel-button {
            background: var(--btn-bg);
            color: var(--panel-text);
            border: 1px solid var(--btn-border);
            border-radius: 10px;
            padding: 8px 12px;
            margin: 0;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            text-align: center;
            width: 100%;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }
        .ndns-panel-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.05) 100%);
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .ndns-panel-button:hover::before { opacity: 1; }
        .ndns-panel-button:disabled { cursor: not-allowed; opacity: 0.4; }
        .ndns-panel-button:hover:not(:disabled) {
            background: var(--btn-hover-bg);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .ndns-panel-button:active:not(:disabled) {
            transform: translateY(0);
        }
        .ndns-panel-button.active {
            background: var(--btn-active-bg);
            color: white;
            border-color: transparent;
            box-shadow: 0 4px 16px rgba(127, 90, 240, 0.3);
        }
        .ndns-panel-button.danger {
            background: linear-gradient(135deg, var(--danger-color) 0%, #c42860 100%);
            color: white;
            border-color: transparent;
        }
        .ndns-panel-button.danger:hover { box-shadow: 0 4px 16px rgba(229, 49, 112, 0.3); }
        .ndns-panel-button.warning {
            background: linear-gradient(135deg, var(--warning-color) 0%, #e6b32a 100%);
            color: #16161a;
            border-color: transparent;
        }
        .ndns-panel-button.info {
            background: linear-gradient(135deg, var(--info-color) 0%, #6246ea 100%);
            color: white;
            border-color: transparent;
        }

        /* Small Buttons */
        .ndns-btn-sm {
            padding: 6px 10px;
            font-size: 11px;
            border-radius: 8px;
        }
        .ndns-btn-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 10px;
        }
        .ndns-btn-icon svg { width: 14px; height: 14px; }

        /* Button Groups */
        .ndns-btn-group { display: flex; gap: 6px; }
        .ndns-btn-group-vertical { display: flex; flex-direction: column; gap: 6px; }
        .ndns-btn-row { display: flex; gap: 6px; }
        .ndns-btn-row > * { flex: 1; }

        /* Section Styles */
        .ndns-section {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px;
            background: var(--section-bg);
            border-radius: 12px;
            border: 1px solid var(--panel-border);
        }
        .ndns-section-content { display: flex; flex-direction: column; gap: 6px; }

        /* Quick Actions Bar */
        .ndns-quick-actions {
            display: flex;
            gap: 8px;
            padding: 8px;
            background: var(--section-bg);
            border-radius: 12px;
            border: 1px solid var(--panel-border);
            flex-wrap: wrap;
        }
        button.ndns-quick-action-btn {
            flex: 1;
            min-width: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px 8px;
            margin: 0;
            background: var(--btn-bg);
            border: 1px solid var(--btn-border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--panel-text);
            font-size: 11px;
            font-weight: 600;
            text-align: center;
            white-space: nowrap;
        }
        .ndns-quick-action-btn:hover {
            background: var(--btn-hover-bg);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .ndns-quick-action-btn svg { width: 22px; height: 22px; opacity: 0.8; }
        .ndns-quick-action-btn:hover svg { opacity: 1; }
        .ndns-quick-action-btn.download svg { color: var(--info-color); }
        .ndns-quick-action-btn.clear svg { color: var(--danger-color); }
        button.ndns-quick-action-btn.active { display: none; }

        /* Stats Display */
        .ndns-stats-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            font-size: 11px;
            background: var(--section-bg);
            border-radius: 10px;
            border: 1px solid var(--panel-border);
        }
        .ndns-stats-label {
            color: var(--panel-text-secondary);
            font-weight: 500;
        }
        .ndns-stats-value {
            font-weight: 700;
            font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .ndns-stats-value.blocked { color: var(--danger-color); }
        .ndns-stats-value.allowed { color: var(--success-color); }
        .ndns-doh-section {
            gap: 8px;
        }
        .ndns-doh-status-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
        }
        .ndns-doh-status {
            min-width: 0;
        }
        .ndns-doh-value {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            font-size: 12px;
            font-weight: 700;
        }
        .ndns-doh-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex: 0 0 8px;
            background: var(--panel-text-secondary);
        }
        .ndns-doh-dot.ok { background: var(--success-color); }
        .ndns-doh-dot.warning { background: var(--warning-color); }
        .ndns-doh-dot.error { background: var(--danger-color); }
        .ndns-doh-detail {
            margin-top: 2px;
            color: var(--panel-text-secondary);
            font-size: 10px;
            line-height: 1.35;
            overflow-wrap: anywhere;
        }
        .ndns-doh-refresh {
            flex: 0 0 auto;
        }
        .ndns-log-origin-filter {
            gap: 7px;
        }
        .ndns-log-origin-filter label {
            color: var(--panel-text-secondary);
            font-size: 11px;
            font-weight: 700;
        }
        .ndns-log-origin-filter input {
            width: 100%;
            min-width: 0;
            padding: 8px 10px;
            color: var(--input-text);
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            border-radius: 8px;
            font-size: 11px;
            box-sizing: border-box;
        }
        .ndns-log-origin-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        .ndns-log-origin-status {
            color: var(--panel-text-secondary);
            font-size: 10px;
            line-height: 1.35;
            overflow-wrap: anywhere;
        }
        .ndns-log-origin-filter.active {
            border-color: color-mix(in srgb, var(--accent-secondary) 60%, var(--panel-border));
        }
        .ndns-dns-replay-meta {
            padding: 8px;
            color: var(--panel-text-secondary);
            background: var(--section-bg);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            font-family: monospace;
            font-size: 11px;
            overflow-wrap: anywhere;
        }
        .ndns-dns-replay-controls {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
        }
        .ndns-dns-replay-result {
            min-height: 120px;
            max-height: 280px;
            overflow: auto;
            padding: 10px;
            margin: 0;
            color: var(--panel-text);
            background: var(--section-bg);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 11px;
        }

        /* Dividers */
        .ndns-divider {
            height: 1px;
            background: linear-gradient(90deg, transparent 0%, var(--panel-border) 50%, transparent 100%);
            margin: 4px 0;
        }

        /* Collapsible Sections */
        .ndns-collapsible-section summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--panel-text-secondary);
            font-size: 11px;
            padding: 6px 0;
            list-style: none;
            transition: color 0.2s ease;
        }
        .ndns-collapsible-section summary:hover { color: var(--panel-text); }
        .ndns-collapsible-section summary::-webkit-details-marker { display: none; }
        .ndns-collapsible-section-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px 0 4px 0;
        }

        /* Toggle Switches - Modern */
        .ndns-toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            font-size: 12px;
        }
        .ndns-toggle-row label {
            cursor: pointer;
            flex: 1;
            color: var(--panel-text);
            font-weight: 500;
        }
        .ndns-toggle-switch {
            position: relative;
            width: 40px;
            height: 22px;
            background: var(--btn-bg);
            border-radius: 11px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid var(--btn-border);
        }
        .ndns-toggle-switch.active {
            background: linear-gradient(135deg, var(--success-color) 0%, #1f9d5c 100%);
            border-color: transparent;
        }
        .ndns-toggle-switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .ndns-toggle-switch.active::after { transform: translateX(18px); }

        /* Input Styles - Modern */
        .ndns-input {
            width: 100%;
            padding: 10px 14px;
            background: var(--input-bg);
            color: var(--input-text);
            border: 1px solid var(--input-border);
            border-radius: 10px;
            font-size: 13px;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }
        .ndns-input:focus {
            outline: none;
            border-color: var(--input-focus);
            box-shadow: 0 0 0 3px var(--glow-color);
        }
        .ndns-input::placeholder {
            color: var(--panel-text-secondary);
        }

        /* Recent Domains List */
        .ndns-recent-domains {
            max-height: 120px;
            overflow-y: auto;
            font-size: 11px;
            border-radius: 10px;
            border: 1px solid var(--panel-border);
        }
        .ndns-recent-domain-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--panel-border);
            transition: background 0.15s ease;
        }
        .ndns-recent-domain-item:last-child { border-bottom: none; }
        .ndns-recent-domain-item:hover { background: var(--btn-hover-bg); }
        .ndns-recent-domain-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 11px;
        }
        .ndns-recent-domain-actions { display: flex; gap: 4px; }
        .ndns-recent-domain-actions button {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: var(--panel-text-secondary);
            border-radius: 6px;
            transition: all 0.15s ease;
        }
        .ndns-recent-domain-actions button:hover {
            color: var(--panel-text);
            background: var(--btn-bg);
        }

        /* Toast Notifications - Modern */
        .ndns-toast-countdown {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 14px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 20000;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            font-size: 13px;
            font-weight: 500;
            max-width: 380px;
            backdrop-filter: blur(10px);
        }

        /* Preload Container */
        .preload-container { display: flex; gap: 6px; }
        .preload-container select {
            flex-grow: 1;
            background: var(--input-bg);
            color: var(--input-text);
            border: 1px solid var(--input-border);
            border-radius: 10px;
            font-size: 12px;
            padding: 8px 12px;
        }
        .preload-container button {
            background: var(--btn-active-bg);
            color: white;
            border-radius: 10px;
        }
        .danger-button {
            background: linear-gradient(135deg, var(--danger-color) 0%, #c42860 100%) !important;
            color: white !important;
            border-color: transparent !important;
        }

        /* ============================================
           MODERN SETTINGS MODAL
           ============================================ */

        .ndns-settings-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        }
        .ndns-settings-modal-content {
            background: var(--panel-bg-solid);
            color: var(--panel-text);
            padding: 0;
            border-radius: 16px;
            width: 92%;
            max-width: 650px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--panel-border);
            position: relative;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .ndns-settings-modal-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 16px 20px 14px;
            background: var(--panel-header-bg);
            border-bottom: 1px solid var(--panel-border);
        }
        .ndns-settings-modal-header h3 {
            margin: 0 0 6px 0;
            font-size: 20px;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .ndns-settings-modal-header .github-link {
            display: inline-flex;
            align-items: center;
            text-decoration: none;
            color: var(--panel-text-secondary);
            font-size: 12px;
            font-weight: 500;
            padding: 4px 10px;
            background: var(--btn-bg);
            border-radius: 16px;
            transition: all 0.2s ease;
        }
        .ndns-settings-modal-header .github-link:hover {
            color: var(--panel-text);
            background: var(--btn-hover-bg);
        }
        .ndns-settings-modal-header .github-link svg {
            width: 14px;
            height: 14px;
            margin-right: 6px;
        }
        .ndns-settings-close-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            background: var(--btn-bg);
            border: none;
            cursor: pointer;
            color: var(--panel-text-secondary);
            font-size: 16px;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        .ndns-settings-close-btn:hover {
            background: var(--btn-hover-bg);
            color: var(--panel-text);
            transform: rotate(90deg);
        }

        .ndns-settings-modal-body {
            padding: 14px 20px 28px 20px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
        }

        .ndns-settings-section {
            margin-bottom: 14px;
            background: var(--section-bg);
            border-radius: 12px;
            padding: 12px;
            border: 1px solid var(--panel-border);
        }
        .ndns-settings-section:last-child { margin-bottom: 0; }
        .ndns-settings-section > label {
            display: block;
            margin-bottom: 8px;
            font-weight: 700;
            font-size: 13px;
            color: var(--panel-text);
        }
        .ndns-settings-section > .settings-section-description {
            font-size: 11px;
            color: var(--panel-text-secondary);
            margin-top: -5px;
            margin-bottom: 8px;
            line-height: 1.4;
        }
        .ndns-settings-controls {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .settings-control-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 7px 10px;
            background: var(--btn-bg);
            border-radius: 8px;
            border: 1px solid var(--btn-border);
            transition: all 0.2s ease;
        }
        .settings-control-row:hover {
            background: var(--btn-hover-bg);
        }
        .settings-control-row span {
            font-size: 13px;
            font-weight: 500;
            color: var(--panel-text);
        }
        .settings-control-row .btn-group {
            display: flex;
            gap: 6px;
        }

        /* Custom Switches for Settings - Modern */
        .custom-switch { display: flex; align-items: center; }
        .custom-switch label {
            margin-left: 10px;
            user-select: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .custom-switch input[type="checkbox"] {
            appearance: none;
            width: 44px;
            height: 24px;
            background: var(--btn-bg);
            border-radius: 12px;
            position: relative;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid var(--btn-border);
        }
        .custom-switch input[type="checkbox"]:checked {
            background: linear-gradient(135deg, var(--success-color) 0%, #1f9d5c 100%);
            border-color: transparent;
        }
        .custom-switch input[type="checkbox"]::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .custom-switch input[type="checkbox"]:checked::after {
            transform: translateX(20px);
        }

        /* API Key Section - Modern */
        .api-key-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.2s ease;
        }
        .api-key-wrapper:focus-within {
            border-color: var(--input-focus);
            box-shadow: 0 0 0 3px var(--glow-color);
        }
        .api-key-wrapper .ndns-input {
            border: none;
            border-radius: 0;
            background: transparent;
        }
        .api-key-wrapper .ndns-input:focus {
            box-shadow: none;
        }
        .api-key-toggle-visibility {
            background: transparent;
            border: none;
            padding: 10px 14px;
            cursor: pointer;
            color: var(--panel-text-secondary);
            transition: color 0.2s ease;
        }
        .api-key-toggle-visibility:hover {
            color: var(--panel-text);
        }
        .api-key-toggle-visibility svg {
            width: 18px;
            height: 18px;
        }

        /* Inline Controls for Log Rows */
        .ndns-reason-info { margin-left: 8px; font-size: 0.8em; font-style: italic; user-select: text; white-space: nowrap; opacity: 0.9; }
        .list-group-item.log .reason-icon { opacity: 1 !important; visibility: visible !important; display: inline-block !important; }
        .ndns-inline-controls { display: flex; align-items: center; gap: 4px; margin-left: auto; }
        .ndns-inline-controls button { cursor: pointer; background: transparent; border: none; font-size: 12px; padding: 0 3px; }
        .ndns-inline-controls span { margin-left: 2px; }
        .ndns-inline-controls .divider { border-left: 1px solid rgba(150, 150, 150, 0.3); margin: 0 6px; height: 16px; align-self: center; }
        .list-group-item .notranslate strong { font-weight: bold !important; color: var(--panel-text) !important; }
        .list-group-item .notranslate .subdomain { opacity: 0.5; }

        /* List Page Features CSS */
        .ndns-options-container {
            border: 1px solid var(--panel-border); border-radius: 12px; padding: 12px 15px;
            background: var(--panel-bg); position: absolute; right: 50px; top: 50px; z-index: 100;
            display: none; min-width: 220px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .ndns-options-container.show { display: block; }
        .ndns-options-btn {
            background: var(--btn-bg); border: 1px solid var(--btn-border); border-radius: 8px;
            padding: 6px 10px; cursor: pointer; color: var(--panel-text); font-size: 16px;
        }
        .ndns-options-btn:hover { background: var(--btn-hover-bg); }
        .ndns-switch { display: flex; align-items: center; padding: 6px 0; }
        .ndns-switch input[type="checkbox"] {
            appearance: none; width: 32px; height: 18px; background: var(--btn-bg);
            border-radius: 9px; position: relative; cursor: pointer; transition: background 0.2s;
            flex-shrink: 0;
        }
        .ndns-switch input[type="checkbox"]:checked { background: var(--success-color); }
        .ndns-switch input[type="checkbox"]::after {
            content: ''; position: absolute; top: 2px; left: 2px;
            width: 14px; height: 14px; background: white; border-radius: 50%;
            transition: transform 0.2s;
        }
        .ndns-switch input[type="checkbox"]:checked::after { transform: translateX(14px); }
        .ndns-switch label { margin-left: 10px; user-select: none; cursor: pointer; font-size: 12px; color: var(--panel-text); }

        /* Domain Description Input */
        .ndns-description-input {
            border: 0; background: transparent; color: gray; width: 100%; height: 24px;
            padding-left: 10px; padding-top: 2px; margin-top: 2px; font-size: 11px;
            outline: none; display: none;
        }
        .ndns-description-input::placeholder { color: #888; font-style: italic; }
        .ndns-description-input:focus, .ndns-description-input.has-value { display: block !important; }
        .list-group-item:hover .ndns-description-input { display: block !important; }
        .ndns-domain-meta-row {
            display: none; align-items: center; gap: 6px; width: 100%; padding-left: 10px; margin-top: 2px;
        }
        .list-group-item:hover .ndns-domain-meta-row,
        .ndns-domain-meta-row:focus-within,
        .ndns-domain-meta-row.has-value {
            display: flex !important;
        }
        .ndns-domain-meta-row .ndns-description-input {
            display: block !important; flex: 1 1 auto; min-width: 140px; padding-left: 0; margin-top: 0;
        }
        .ndns-domain-tag-select {
            flex: 0 0 120px; height: 22px; border: 1px solid var(--panel-border); border-radius: 6px;
            background: var(--panel-bg); color: var(--panel-text); font-size: 11px; outline: none;
        }
        .ndns-domain-tag-select.has-value { border-color: var(--warning-color); color: var(--warning-color); }

        /* Log Counters */
        .ndns-log-counters {
            display: flex; gap: 15px; padding: 8px 15px; background: var(--section-bg);
            border-radius: 8px; margin-bottom: 10px; font-size: 12px; align-items: center;
        }
        .ndns-log-counters span { color: var(--panel-text); }
        .ndns-log-counters .counter-value { font-weight: bold; margin-left: 4px; }
        .ndns-log-counters .visible-count { color: var(--success-color); }
        .ndns-log-counters .filtered-count { color: var(--warning-color); }
        .ndns-log-counters .total-count { color: var(--info-color); }

        /* Collapsible Lists */
        .ndns-collapse-container { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
        .ndns-collapse-btn {
            padding: 6px 12px; background: var(--btn-bg); color: var(--panel-text);
            border: 1px solid var(--btn-border); border-radius: 6px; cursor: pointer; font-size: 12px;
        }
        .ndns-collapse-btn:hover { background: var(--btn-hover-bg); }
        .ndns-always-collapse { display: flex; align-items: center; font-size: 11px; }
        .ndns-always-collapse input { margin-right: 5px; }

        /* Styled Domain in Lists */
        .ndns-root-domain { font-weight: bold; color: inherit; }
        .ndns-subdomain { opacity: 0.5; }
        .ndns-wildcard { opacity: 0.3; }
        .list-group-item.ndns-right-align .d-flex { justify-content: flex-end; }
        .list-group-item.ndns-right-align img { order: 2; margin-left: 6px; margin-right: 0; }

        /* Onboarding Modal */
        #ndns-onboarding-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 10002; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        #ndns-onboarding-modal { background: #1e1e1e; color: #fff; padding: 30px; border-radius: 12px; width: 90%; max-width: 480px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); text-align: center; border: 1px solid #333; }
        #ndns-onboarding-modal h3 { font-size: 22px; margin-top: 0; margin-bottom: 12px; }
        #ndns-onboarding-modal p { color: #aaa; font-size: 14px; margin-bottom: 20px; }
        #ndns-onboarding-modal .api-input-wrapper { display: flex; gap: 8px; margin-top: 15px; }
        #ndns-onboarding-modal input { flex-grow: 1; padding: 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a2a; color: #fff; font-size: 14px; }
        .ndns-flashy-button { background: linear-gradient(45deg, #a855f7, #ec4899, #22d3ee, #f59e0b); background-size: 300% 300%; animation: gradient-shift 4s ease infinite; border: none; color: white !important; width: 100%; padding: 12px; margin-top: 15px; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
        .ndns-flashy-button:hover { transform: scale(1.02); }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        /* Login Spotlight */
        .ndns-spotlight-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(20, 20, 20, 0.8); backdrop-filter: blur(5px); z-index: 10000; }
        .ndns-login-focus { position: relative !important; z-index: 10001 !important; background: var(--panel-bg, #1e1e1e); padding: 20px; border-radius: 12px; }
        .ndns-affiliate-pitch { position: fixed; z-index: 10001; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; text-align: center; max-width: 480px; font-size: 15px; line-height: 1.6; }
        .ndns-affiliate-pitch p { margin-bottom: 1em; }
        .ndns-affiliate-pitch a { color: var(--info-color); font-weight: 600; }
        .ndns-spotlight-close { position: fixed; top: 20px; right: 20px; z-index: 10002; font-size: 28px; color: white; cursor: pointer; opacity: 0.7; }
        .ndns-spotlight-close:hover { opacity: 1; }

        /* API Helper Bar */
        .ndns-api-helper {
            position: sticky; top: 0; z-index: 10001; background: #1e1e1e; color: white;
            padding: 12px 20px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border-bottom: 1px solid #333;
            display: flex; align-items: center; justify-content: center; gap: 15px;
        }
        .ndns-api-helper p { margin: 0; font-size: 14px; font-weight: 600; }
        .ndns-api-helper button { padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 5px; border: none; cursor: pointer; transition: all 0.2s ease; }
        .ndns-api-helper .save-key-btn { background-color: var(--info-color); color: white; }
        .ndns-api-helper .save-key-btn:hover { background-color: #19b9d1; }
        .ndns-api-helper .generate-key-btn { background: linear-gradient(45deg, #a855f7, #ec4899); color: white; }
        .ndns-api-helper button:disabled { background-color: var(--success-color) !important; cursor: not-allowed; animation: none; }

        /* Auto Refresh Animation */
        .ndns-panel-button.auto-refresh-active {
            background: linear-gradient(270deg, #17a2b8, #28a745, #17a2b8);
            background-size: 200% 200%;
            animation: gradient-shine 2s linear infinite;
            color: white;
        }
        @keyframes gradient-shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* Compact Mode */
        html.ndns-compact-mode .ndns-panel-button { padding: 4px 6px; font-size: 10px; }
        html.ndns-compact-mode .ndns-panel-content { gap: 4px; }
        html.ndns-compact-mode .ndns-inline-controls { gap: 3px; }
        html.ndns-compact-mode .ndns-inline-controls button { font-size: 10px; }
        html.ndns-compact-mode .log .text-end .fa-lock { display: none; }
        html.ndns-compact-mode .log .text-end > .notranslate { display: none; }
        html[data-ndns-density="roomy"] button.ndns-panel-button {
            padding: 9px 12px; min-height: 34px; font-size: 12px; line-height: 1.25;
        }
        html[data-ndns-density="roomy"] div.ndns-panel-content { gap: 10px; padding: 10px; }
        html[data-ndns-density="roomy"] .settings-control-row { padding: 8px 0; }
        html[data-ndns-density="roomy"] .ndns-settings-section { margin-bottom: 18px; }
        html[data-ndns-density="roomy"] .ndns-parental-toggle,
        html[data-ndns-density="roomy"] .ndns-regex-item,
        html[data-ndns-density="roomy"] .ndns-webhook-domain-item,
        html[data-ndns-density="roomy"] .ndns-device-override-row {
            padding: 9px 12px; margin-bottom: 6px;
        }
        html[data-ndns-density="roomy"] .log.list-group-item { padding-top: 8px; padding-bottom: 8px; }

        @media (max-width: 680px) {
            .ndns-panel,
            .ndns-panel.left-side,
            .ndns-panel.right-side {
                top: auto !important; left: 8px !important; right: 8px !important; bottom: 0 !important;
                width: calc(100vw - 16px) !important; min-width: 0 !important; max-width: none !important;
                border: 1px solid var(--panel-border) !important; border-bottom: 0 !important;
                border-radius: 16px 16px 0 0 !important;
                transform: translateY(calc(100% - 48px));
            }
            .ndns-panel.visible,
            .ndns-panel.left-side.visible,
            .ndns-panel.right-side.visible {
                transform: translateY(0);
            }
            .ndns-panel.left-side .ndns-panel-header,
            .ndns-panel.right-side .ndns-panel-header {
                border-radius: 16px 16px 0 0;
            }
            .ndns-panel-header { cursor: default; padding: 10px 12px; }
            div.ndns-panel-content {
                max-height: min(62vh, calc(100vh - 160px));
                padding: 8px;
            }
            .ndns-panel-footer { padding: 8px 12px; }
            .ndns-settings-modal-overlay {
                align-items: stretch; justify-content: stretch; padding: 8px; box-sizing: border-box;
            }
            .ndns-settings-modal-content {
                width: 100%; max-width: none; max-height: calc(100vh - 16px); border-radius: 14px;
            }
            .ndns-settings-modal-header {
                align-items: flex-start; text-align: left; padding: 14px 44px 12px 16px;
            }
            .ndns-settings-modal-body { padding: 12px; }
            .settings-control-row { gap: 8px; align-items: flex-start; }
            .settings-control-row .btn-group { flex-wrap: wrap; justify-content: flex-end; }
            .ndns-parental-presets { grid-template-columns: 1fr; }
        }

        /* Export Button */
        #export-hosts-btn { display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
        #export-hosts-btn .spinner { display: none; margin-left: 6px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Stream Button - Always visible refresh icon */
        .stream-button {
            display: inline-flex !important; align-items: center; justify-content: center;
            padding: 4px; cursor: pointer;
        }
        .stream-button svg {
            width: 18px !important; height: 18px !important;
            fill: currentColor !important;
            transition: transform 0.2s ease;
        }
        .stream-button:hover svg {
            transform: rotate(30deg);
        }
        .stream-button.streaming svg,
        .stream-button.auto-refresh-active svg {
            animation: spin 1s linear infinite !important;
        }
        .stream-button.streaming,
        .stream-button.auto-refresh-active {
            background: linear-gradient(270deg, #17a2b8, #28a745, #17a2b8);
            background-size: 200% 200%;
            animation: gradient-shine 2s linear infinite;
            border-radius: 50% !important;
        }
        .stream-button.streaming svg,
        .stream-button.auto-refresh-active svg {
            fill: white !important;
        }

        /* Live Stats Widget */
        .ndns-live-stats {
            background: linear-gradient(135deg, var(--section-bg), var(--panel-bg));
            border-radius: 6px; padding: 8px; border: 1px solid var(--panel-border);
        }
        .ndns-live-stats-header {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 10px; font-weight: 600; text-transform: uppercase; opacity: 0.7;
            margin-bottom: 6px;
        }
        .ndns-live-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .ndns-stat-box {
            background: var(--btn-bg); border-radius: 4px; padding: 6px;
            text-align: center;
        }
        .ndns-stat-box-value { font-size: 16px; font-weight: 700; font-family: monospace; }
        .ndns-stat-box-label { font-size: 9px; opacity: 0.6; text-transform: uppercase; }
        .ndns-stat-pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

        /* Tooltip Styles */
        .ndns-tooltip { position: relative; }
        .ndns-tooltip::after {
            content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%;
            transform: translateX(-50%) translateY(-4px); padding: 4px 8px;
            background: rgba(0,0,0,0.9); color: white; font-size: 10px; white-space: nowrap;
            border-radius: 4px; opacity: 0; visibility: hidden; transition: all 0.2s ease;
            z-index: 10000; pointer-events: none;
        }
        .ndns-tooltip:hover::after { opacity: 1; visibility: visible; }

        /* List group item border fix */
        div.px-3.bg-2.list-group-item { border-top-width: 1px; border-style: solid; }

        /* ============================================
           v3.4 FEATURE STYLES
           ============================================ */

        /* Config Import/Export & Profile Clone Modal */
        .ndns-profile-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
            z-index: 10003; display: flex; align-items: center; justify-content: center;
        }
        .ndns-profile-modal {
            background: var(--panel-bg-solid); color: var(--panel-text); padding: 24px;
            border-radius: 12px; width: 90%; max-width: 560px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6); border: 1px solid var(--panel-border);
            max-height: 80vh; overflow-y: auto;
        }
        .ndns-profile-modal h3 { margin: 0 0 16px 0; font-size: 18px; }
        .ndns-profile-modal label { font-size: 12px; font-weight: 600; color: var(--panel-text-secondary); display: block; margin-bottom: 4px; }
        .ndns-profile-modal select, .ndns-profile-modal textarea {
            width: 100%; padding: 8px 10px; border-radius: 6px; font-size: 13px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
            font-family: monospace; box-sizing: border-box;
        }
        .ndns-profile-modal textarea { min-height: 120px; resize: vertical; }
        .ndns-profile-modal .modal-actions { display: flex; gap: 8px; margin-top: 16px; }
        .ndns-profile-modal .modal-actions button { flex: 1; }

        /* Diff View */
        .ndns-diff-view { max-height: 300px; overflow-y: auto; margin: 12px 0; font-size: 12px; font-family: monospace; }
        .ndns-diff-add { color: var(--success-color); padding: 2px 6px; }
        .ndns-diff-remove { color: var(--danger-color); padding: 2px 6px; }
        .ndns-diff-same { color: var(--panel-text-secondary); padding: 2px 6px; opacity: 0.5; }
        .ndns-diff-summary { font-size: 12px; padding: 8px; background: var(--section-bg); border-radius: 6px; margin-bottom: 8px; }

        /* DNS Rewrite Panel */
        .ndns-rewrite-panel { margin-top: 8px; }
        .ndns-rewrite-list { max-height: 200px; overflow-y: auto; margin: 8px 0; }
        .ndns-rewrite-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 8px; background: var(--section-bg); border-radius: 6px; margin-bottom: 4px;
            font-size: 12px; font-family: monospace;
        }
        .ndns-rewrite-item .domain { color: var(--accent-color); }
        .ndns-rewrite-item .answer { color: var(--accent-secondary); margin-left: 8px; }
        .ndns-rewrite-item .delete-btn {
            background: none; border: none; color: var(--danger-color); cursor: pointer;
            padding: 2px 6px; font-size: 14px; opacity: 0.7;
        }
        .ndns-rewrite-item .delete-btn:hover { opacity: 1; }
        .ndns-rewrite-add { display: flex; gap: 4px; margin-top: 6px; }
        .ndns-rewrite-add input {
            flex: 1; padding: 6px 8px; border-radius: 6px; font-size: 12px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
        }

        /* Analytics Dashboard */
        .ndns-analytics-page {
            max-width: 1200px; margin: 0 auto; padding: 24px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .ndns-analytics-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 20px; flex-wrap: wrap; gap: 10px;
        }
        .ndns-analytics-header h2 {
            margin: 0; font-size: 22px; font-weight: 700; color: var(--panel-text);
            background: linear-gradient(135deg, var(--accent-color), var(--accent-secondary));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .ndns-analytics-controls { display: flex; gap: 8px; align-items: center; }
        .ndns-analytics-controls select, .ndns-analytics-controls button {
            padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
            background: var(--btn-bg); color: var(--panel-text); border: 1px solid var(--btn-border);
            cursor: pointer; transition: all 0.2s ease;
        }
        .ndns-analytics-controls select:hover, .ndns-analytics-controls button:hover {
            background: var(--btn-hover-bg);
        }
        .ndns-analytics-controls button.active {
            background: var(--btn-active-bg); color: #fff; border-color: transparent;
        }
        .ndns-analytics-loading {
            display: flex; align-items: center; justify-content: center; min-height: 300px;
            font-size: 14px; color: var(--panel-text-secondary);
        }
        .ndns-analytics-loading .spinner {
            width: 28px; height: 28px; border: 3px solid var(--btn-border);
            border-top-color: var(--accent-color); border-radius: 50%;
            animation: ndns-spin 0.8s linear infinite; margin-right: 12px;
        }
        .ndns-analytics-warning {
            display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
            padding: 12px 14px; margin: 0 0 16px; border-radius: 10px;
            border: 1px solid color-mix(in srgb, var(--warning-color) 55%, var(--panel-border));
            background: color-mix(in srgb, var(--warning-color) 14%, var(--section-bg));
            color: var(--panel-text); font-size: 12px;
        }
        .ndns-analytics-warning strong { display: block; margin-bottom: 4px; }
        .ndns-analytics-warning ul { margin: 4px 0 0 16px; padding: 0; color: var(--panel-text-secondary); }
        .ndns-analytics-warning button {
            flex: 0 0 auto; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700;
            background: var(--btn-bg); color: var(--panel-text); border: 1px solid var(--btn-border); cursor: pointer;
        }
        @keyframes ndns-spin { to { transform: rotate(360deg); } }

        /* Stat Cards Row */
        .ndns-stat-cards {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px; margin-bottom: 20px;
        }
        .ndns-stat-card {
            background: var(--section-bg); border: 1px solid var(--panel-border);
            border-radius: 12px; padding: 16px; text-align: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .ndns-stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .ndns-stat-card .card-value {
            font-size: 26px; font-weight: 800; font-family: monospace;
            background: linear-gradient(135deg, var(--accent-color), var(--accent-secondary));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .ndns-stat-card .card-value.green { background: linear-gradient(135deg, var(--success-color), #51cf66); -webkit-background-clip: text; background-clip: text; }
        .ndns-stat-card .card-value.red { background: linear-gradient(135deg, var(--danger-color), #ff6b6b); -webkit-background-clip: text; background-clip: text; }
        .ndns-stat-card .card-value.blue { background: linear-gradient(135deg, var(--info-color), #74c0fc); -webkit-background-clip: text; background-clip: text; }
        .ndns-stat-card .card-value.orange { background: linear-gradient(135deg, var(--warning-color), #ffd43b); -webkit-background-clip: text; background-clip: text; }
        .ndns-stat-card .card-label {
            font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
            color: var(--panel-text-secondary); margin-top: 4px;
        }
        .ndns-stat-card .card-sub {
            font-size: 10px; color: var(--panel-text-secondary); margin-top: 2px; opacity: 0.7;
        }

        /* Widget Grid */
        .ndns-widget-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
        }
        .ndns-widget-grid.three-col { grid-template-columns: 1fr 1fr 1fr; }
        @media (max-width: 900px) {
            .ndns-widget-grid, .ndns-widget-grid.three-col { grid-template-columns: 1fr; }
        }
        .ndns-widget {
            background: var(--section-bg); border: 1px solid var(--panel-border);
            border-radius: 12px; padding: 16px; overflow: hidden;
        }
        .ndns-widget.full-width { grid-column: 1 / -1; }
        .ndns-widget h4 {
            font-size: 13px; font-weight: 700; margin: 0 0 12px 0;
            color: var(--panel-text); display: flex; align-items: center; gap: 6px;
        }
        .ndns-widget h4 .widget-icon { font-size: 15px; }
        .ndns-widget .widget-empty {
            font-size: 11px; color: var(--panel-text-secondary); text-align: center; padding: 20px 0;
        }

        /* Time Series */
        .ndns-timeseries-chart {
            width: 100%; overflow-x: auto; padding-bottom: 4px;
        }
        .ndns-timeseries-svg {
            width: 100%; min-width: 640px; height: auto; display: block;
        }
        .ndns-timeseries-grid { stroke: var(--panel-border); stroke-width: 1; }
        .ndns-timeseries-axis { fill: var(--panel-text-secondary); font-size: 10px; font-family: monospace; }
        .ndns-timeseries-total {
            fill: none; stroke: var(--accent-color); stroke-width: 3;
            stroke-linecap: round; stroke-linejoin: round;
        }
        .ndns-timeseries-point { fill: var(--accent-color); stroke: var(--panel-bg-solid); stroke-width: 2; }
        .ndns-timeseries-blocked { fill: var(--danger-color); opacity: 0.58; }
        .ndns-timeseries-summary {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px; margin-top: 10px;
        }
        .ndns-timeseries-chip {
            background: var(--btn-bg); border: 1px solid var(--btn-border);
            border-radius: 8px; padding: 8px 10px;
        }
        .ndns-timeseries-chip span {
            display: block; font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.4px; color: var(--panel-text-secondary);
        }
        .ndns-timeseries-chip strong {
            display: block; margin-top: 3px; font-size: 15px; font-family: monospace;
            color: var(--panel-text);
        }

        /* Device Drill-down */
        .ndns-device-drilldown {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 10px;
        }
        .ndns-device-card {
            background: rgba(255,255,255,0.025); border: 1px solid var(--panel-border);
            border-radius: 8px; padding: 12px; min-width: 0;
        }
        .ndns-device-head {
            display: flex; align-items: flex-start; justify-content: space-between;
            gap: 10px; margin-bottom: 10px;
        }
        .ndns-device-name {
            color: var(--panel-text); font-size: 13px; font-weight: 700;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ndns-device-meta {
            color: var(--panel-text-secondary); font-size: 10px; margin-top: 2px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ndns-device-count {
            color: var(--panel-text-secondary); font-size: 11px; font-family: monospace;
            white-space: nowrap;
        }
        .ndns-app-list { display: flex; flex-direction: column; gap: 8px; }
        .ndns-app-row { display: grid; grid-template-columns: minmax(80px, 130px) 1fr auto; gap: 8px; align-items: center; }
        .ndns-app-name {
            color: var(--panel-text); font-size: 11px; font-weight: 600;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ndns-app-track { height: 14px; background: var(--btn-bg); border-radius: 4px; overflow: hidden; }
        .ndns-app-fill {
            height: 100%; min-width: 3px; border-radius: 4px;
            background: linear-gradient(90deg, var(--accent-secondary), var(--accent-color));
        }
        .ndns-app-count {
            color: var(--panel-text-secondary); font-size: 10px; font-family: monospace;
            min-width: 42px; text-align: right;
        }
        .ndns-app-domains {
            grid-column: 1 / -1; color: var(--panel-text-secondary); font-size: 10px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8;
        }
        @media (max-width: 620px) {
            .ndns-app-row { grid-template-columns: 1fr auto; }
            .ndns-app-track { grid-column: 1 / -1; }
        }

        /* Anomaly Alerts */
        .ndns-anomaly-list { display: flex; flex-direction: column; gap: 8px; }
        .ndns-anomaly-row {
            display: grid; grid-template-columns: minmax(120px, 1fr) auto auto auto;
            gap: 10px; align-items: center; padding: 10px;
            background: rgba(229, 49, 112, 0.08); border: 1px solid rgba(229, 49, 112, 0.18);
            border-radius: 8px;
        }
        .ndns-anomaly-name {
            color: var(--panel-text); font-size: 12px; font-weight: 700;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ndns-anomaly-stat {
            color: var(--panel-text-secondary); font-size: 11px; font-family: monospace;
            white-space: nowrap; text-align: right;
        }
        .ndns-anomaly-badge {
            color: #fff; background: var(--danger-color); border-radius: 999px;
            padding: 3px 7px; font-size: 10px; font-weight: 800; font-family: monospace;
            white-space: nowrap;
        }
        @media (max-width: 620px) {
            .ndns-anomaly-row { grid-template-columns: 1fr 1fr; }
            .ndns-anomaly-badge { justify-self: start; }
        }

        /* Bar Chart */
        .ndns-bar-chart { display: flex; flex-direction: column; gap: 6px; }
        .ndns-bar-row {
            display: flex; align-items: center; gap: 8px; font-size: 12px;
            padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .ndns-bar-row:last-child { border-bottom: none; }
        .ndns-bar-rank {
            min-width: 18px; font-size: 10px; font-weight: 700; color: var(--panel-text-secondary);
            text-align: center;
        }
        .ndns-bar-label {
            min-width: 140px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;
            white-space: nowrap; color: var(--panel-text); font-weight: 500;
        }
        .ndns-bar-track { flex: 1; height: 18px; background: var(--btn-bg); border-radius: 4px; overflow: hidden; }
        .ndns-bar-fill {
            height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
            min-width: 3px;
        }
        .ndns-bar-fill.purple { background: linear-gradient(90deg, var(--accent-color), #9775fa); }
        .ndns-bar-fill.green { background: linear-gradient(90deg, var(--success-color), #51cf66); }
        .ndns-bar-fill.red { background: linear-gradient(90deg, var(--danger-color), #ff6b6b); }
        .ndns-bar-fill.blue { background: linear-gradient(90deg, var(--info-color), #74c0fc); }
        .ndns-bar-fill.orange { background: linear-gradient(90deg, var(--warning-color), #ffd43b); }
        .ndns-bar-fill.teal { background: linear-gradient(90deg, #20c997, #38d9a9); }
        .ndns-bar-count {
            min-width: 50px; font-size: 11px; font-family: monospace; font-weight: 600;
            color: var(--panel-text-secondary); text-align: right;
        }
        .ndns-bar-pct {
            min-width: 38px; font-size: 10px; font-family: monospace;
            color: var(--panel-text-secondary); text-align: right; opacity: 0.7;
        }

        /* Ring Chart */
        .ndns-ring-chart {
            display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
        }
        .ndns-ring-svg { flex-shrink: 0; }
        .ndns-ring-legend { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 120px; }
        .ndns-ring-legend-item {
            display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--panel-text);
        }
        .ndns-ring-legend-dot {
            width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
        }
        .ndns-ring-legend-value {
            margin-left: auto; font-family: monospace; font-weight: 600; font-size: 11px;
            color: var(--panel-text-secondary);
        }
        .ndns-ring-legend-pct {
            font-size: 10px; font-family: monospace; color: var(--panel-text-secondary); opacity: 0.7;
            min-width: 36px; text-align: right;
        }

        /* Data Table */
        .ndns-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .ndns-data-table th {
            text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.5px; color: var(--panel-text-secondary);
            border-bottom: 1px solid var(--panel-border);
        }
        .ndns-data-table td {
            padding: 6px 8px; color: var(--panel-text); border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .ndns-data-table tr:hover td { background: rgba(255,255,255,0.02); }
        .ndns-data-table td.mono { font-family: monospace; }
        .ndns-data-table td.right, .ndns-data-table th.right { text-align: right; }

        /* Export Bar */
        .ndns-analytics-export-bar {
            display: flex; gap: 8px; align-items: center; justify-content: flex-end;
            margin-bottom: 16px;
        }

        /* Regex Pattern Highlights */
        .ndns-regex-highlight { padding: 1px 4px; border-radius: 3px; font-weight: 600; }
        .ndns-regex-manager { margin-top: 8px; }
        .ndns-regex-item {
            display: flex; align-items: center; gap: 6px; padding: 4px 8px;
            background: var(--section-bg); border-radius: 4px; margin-bottom: 3px; font-size: 11px;
        }
        .ndns-regex-item .pattern { font-family: monospace; flex: 1; color: var(--accent-color); }
        .ndns-regex-item .color-swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--panel-border); }

        /* CNAME Chain */
        .ndns-cname-chain {
            font-size: 10px; color: var(--panel-text-secondary); margin-top: 2px;
            display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
        }
        .ndns-cname-link { color: var(--info-color); }
        .ndns-cname-arrow { opacity: 0.5; }

        /* Parental Controls */
        .ndns-parental-section { margin: 8px 0; }
        .ndns-parental-toggle {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 10px; background: var(--section-bg); border-radius: 6px;
            margin-bottom: 4px; font-size: 12px;
        }
        .ndns-parental-toggle .toggle-label { display: flex; align-items: center; gap: 6px; }
        .ndns-parental-presets {
            display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;
            margin: 8px 0;
        }
        .ndns-parental-presets button { min-width: 0; white-space: normal; line-height: 1.15; }
        .ndns-theme-studio { margin-top: 8px; }
        .ndns-theme-studio textarea {
            width: 100%; min-height: 140px; resize: vertical; box-sizing: border-box;
            padding: 8px; border-radius: 6px; border: 1px solid var(--input-border);
            background: var(--input-bg); color: var(--input-text); font: 11px/1.45 monospace;
        }
        .ndns-theme-studio-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .ndns-theme-studio-status { margin-top: 5px; font-size: 10px; color: var(--panel-text-secondary); }
        .ndns-weekly-schedule { margin-top: 8px; overflow-x: auto; }
        .ndns-weekly-schedule-grid {
            display: grid; grid-template-columns: 42px repeat(24, 18px); gap: 2px;
            align-items: center; min-width: 540px;
        }
        .ndns-weekly-schedule-label { font-size: 10px; color: var(--panel-text-secondary); }
        .ndns-weekly-schedule-cell {
            width: 18px; height: 18px; padding: 0; cursor: pointer;
            border: 1px solid var(--panel-border); border-radius: 4px; background: var(--btn-bg);
        }
        .ndns-weekly-schedule-cell.active {
            background: var(--success-color); border-color: var(--success-color);
        }
        .ndns-weekly-schedule-cell.now { outline: 2px solid var(--warning-color); outline-offset: 1px; }
        .ndns-weekly-schedule-status { font-size: 10px; color: var(--panel-text-secondary); margin-top: 6px; }
        .ndns-device-overrides { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--panel-border); }
        .ndns-device-override-form {
            display: grid; grid-template-columns: 1fr 76px 76px 112px auto; gap: 6px;
            align-items: center; margin: 6px 0;
        }
        .ndns-device-override-form input,
        .ndns-device-override-form select {
            min-width: 0; padding: 5px 6px; border-radius: 4px; font-size: 11px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
        }
        .ndns-device-override-days { display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0 6px; }
        .ndns-device-override-day {
            width: 28px; height: 22px; padding: 0; border-radius: 4px;
            border: 1px solid var(--panel-border); background: var(--btn-bg); color: var(--panel-text);
            font-size: 10px; cursor: pointer;
        }
        .ndns-device-override-day.active {
            background: var(--accent-color); border-color: var(--accent-color); color: #fffffe;
        }
        .ndns-device-override-row {
            display: grid; grid-template-columns: 1fr auto auto; gap: 6px; align-items: center;
            padding: 6px 8px; margin-top: 4px; border-radius: 5px; background: var(--section-bg);
            font-size: 11px;
        }
        .ndns-device-override-row.active { outline: 1px solid var(--warning-color); }
        .ndns-device-override-title { font-weight: 600; color: var(--panel-text); }
        .ndns-device-override-meta { margin-top: 2px; color: var(--panel-text-secondary); font-size: 10px; }
        .ndns-device-override-status { font-size: 10px; color: var(--panel-text-secondary); margin-top: 5px; }
        @media (max-width: 720px) {
            .ndns-device-override-form { grid-template-columns: 1fr 1fr; }
            .ndns-device-override-form button { grid-column: span 2; }
        }

        /* Scheduled Logs */
        .ndns-schedule-config { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
        .ndns-schedule-config select {
            padding: 4px 8px; border-radius: 4px; font-size: 11px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
        }
        .ndns-schedule-status { font-size: 10px; color: var(--panel-text-secondary); margin-top: 4px; }

        /* Webhook Config */
        .ndns-webhook-config { margin-top: 8px; }
        .ndns-webhook-config input, .ndns-webhook-config select, .ndns-webhook-config textarea {
            width: 100%; padding: 6px 8px; border-radius: 6px; font-size: 12px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
            margin-bottom: 4px; box-sizing: border-box;
        }
        .ndns-webhook-config textarea { min-height: 130px; resize: vertical; font-family: monospace; }
        .ndns-webhook-domains-list { font-size: 11px; max-height: 100px; overflow-y: auto; margin: 4px 0; }
        .ndns-webhook-domain-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 3px 6px; background: var(--section-bg); border-radius: 3px; margin-bottom: 2px;
        }
    `);

    // --- ULTRA CONDENSED CSS (User's Custom CSS) ---
    const ultraCondensedCSS = `
        button.dropdown-toggle.btn.btn-light {
            padding-left: 5px;
            padding-bottom: 3px;
            padding-top: 3px;
            padding-right: 4px;
            display: none;
        }
        div.flex-grow-1.ms-3 { display: none; }
        div.mb-4.d-flex.col { display: none; }
        div.col {
            margin: 0;
            padding: 0;
            border-width: 0;
        }
        .col {
            padding: 0;
            margin: 0;
            border-width: 0;
        }
        input.form-control.form-control-sm {
            padding-top: 0px;
            padding-bottom: 0px;
            border-style: outset;
            border-top-width: 0px;
        }
        div.nav.nav-tabs {
            border-style: none;
            margin-top: -62px;
        }
        div.mt-4.Logs.mb-5 {
            border-style: none;
            margin: 0;
        }
        div.log.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        div.text-muted.list-group-item {
            display: none;
            border-style: none;
        }
        div.card {
            border-top-width: 0px;
            border-bottom-width: 0px;
            margin-bottom: 0px;
            padding: 0;
        }
        div.mt-4 {
            margin-top: 0px;
            border-style: none;
            margin-bottom: 0px;
            padding: 0;
        }
        div.card-header {
            padding: 0;
            border-style: none;
            margin: 0;
            margin-top: -17px;
        }
        svg.injected-svg {
            border-width: 0;
        }
        div.settings-button {
            margin-right: -10px;
            margin-top: 0px;
            margin-left: -10px;
            margin-bottom: 0px;
        }
        span.divider {
            border-left-width: 2px;
            border-right-width: 1px;
            border-style: groove;
            padding: 0;
        }
        *:not(.ndns-panel):not(.ndns-panel *):not(.ndns-settings-modal-overlay):not(.ndns-settings-modal-overlay *):not(.ndns-toast-countdown) { border-radius: 0 !important; }
        div.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        .mt-1 { display: none; }
        div.card-body {
            border-style: outset;
            border-color: #999999;
            padding: 10px;
            border-width: 1px;
        }
        div.px-3.text-center { display: none; }
        .card > .list-group-flush.list-group .flex-grow-1 > div > div:nth-of-type(2) { display: none; }
        div.py-3.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        div.d-block.d-md-flex {
            margin-left: -195px;
            margin-top: -6px;
            padding-bottom: 12px;
        }
        div[role="alert"] { display: none !important; }
        div span span { font-size: 16px; }
        div.pe-1.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        button.btn.btn-link {
            padding: 0;
            margin: 0;
        }
        div.text-end { display: none; }
        div.px-3.bg-2.list-group-item {
            border-top-width: 1px;
            border-style: solid;
            border-bottom-width: 1px;
            padding-left: 0px;
            padding-right: 4px;
        }
        div.text-center.py-2.mb-4.card {
            border-top-width: 0px;
            border-bottom-width: 1px;
            border-left-width: 0px;
            border-right-width: 0px;
            border-style: none;
        }
        svg.recharts-surface {
            height: 105px;
        }
        .recharts-surface {
            margin-top: -114px;
        }
        path.recharts-sector {
            display: none;
        }
        svg.rsm-svg {
            margin-bottom: -35px;
            padding-top: 0px;
            margin-top: -45px;
        }
        div div h5 {
            margin-bottom: 0px;
        }
        div.col-md-4 {
            padding-top: 0px;
            padding-bottom: 0px;
            margin-bottom: -22px;
            margin-top: -28px;
        }
        div.d-flex.mt-3 {
            margin-top: 0px;
        }
        div.d-md-flex {
            display: none;
        }
    `;


    // --- HELPER FUNCTIONS ---
    const sleep = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

    const toHex = (text) => {
        let hex = '';
        for (let i = 0; i < text.length; i++) {
            hex += text.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
    };

    function showToast(msg, isError = false, duration = 4000) {
        let existingToast = document.querySelector('.ndns-toast-countdown');
        if (existingToast) existingToast.remove();

        const n = document.createElement('div');
        n.className = 'ndns-toast-countdown';
        n.textContent = msg;
        Object.assign(n.style, {
            position: 'fixed', bottom: '20px', right: '20px',
            background: isError ? 'var(--danger-color)' : 'var(--success-color)',
            color: '#fff', padding: '12px 18px', borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 20000,
            transform: 'translateY(100px)', opacity: '0',
            transition: 'transform 0.4s ease, opacity 0.4s ease',
            fontSize: '13px', maxWidth: '350px'
        });
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.transform = 'translateY(0)';
            n.style.opacity = '1';
        }, 10);
        setTimeout(() => {
            n.style.transform = 'translateY(100px)';
            n.style.opacity = '0';
            const cleanup = () => { if (n.parentNode) n.remove(); };
            n.addEventListener('transitionend', cleanup, { once: true });
            setTimeout(cleanup, 500); // Fallback if transitionend doesn't fire
        }, duration);
        return n;
    }

    function cloneStorageValue(value) {
        if (value === undefined || value === null) return value;
        return JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function valuesEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function normalizeBoolean(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (value === 'true') return true;
        if (value === 'false') return false;
        return fallback;
    }

    function normalizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function normalizeString(value, fallback = '') {
        if (typeof value === 'string') return value;
        if (value === null || value === undefined) return fallback;
        return String(value);
    }

    function normalizeNullableString(value) {
        if (value === null || value === undefined || value === '') return null;
        return String(value);
    }

    function normalizeTimestamp(value) {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function normalizeStringArray(value, fallback = []) {
        if (!Array.isArray(value)) return fallback.slice();
        return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
    }

    function normalizeObjectMap(value) {
        return isPlainObject(value) ? value : {};
    }

    function normalizeFilterState(value) {
        const source = isPlainObject(value) ? value : {};
        return {
            hideList: normalizeBoolean(source.hideList, defaultFilters.hideList),
            hideBlocked: normalizeBoolean(source.hideBlocked, defaultFilters.hideBlocked),
            showOnlyWhitelisted: normalizeBoolean(source.showOnlyWhitelisted, defaultFilters.showOnlyWhitelisted),
            autoRefresh: normalizeBoolean(source.autoRefresh, defaultFilters.autoRefresh)
        };
    }

    function normalizeHageziAutoSync(value) {
        const source = isPlainObject(value) ? value : {};
        return {
            enabled: normalizeBoolean(source.enabled, false),
            lastRun: normalizeTimestamp(source.lastRun)
        };
    }

    function normalizeRegexPatterns(value) {
        if (!Array.isArray(value)) return [];
        return value
            .filter(item => isPlainObject(item) && typeof item.pattern === 'string' && item.pattern.trim())
            .map(item => ({
                pattern: item.pattern,
                flags: typeof item.flags === 'string' ? item.flags : 'i',
                label: typeof item.label === 'string' ? item.label : '',
                color: typeof item.color === 'string' ? item.color : 'rgba(255,193,7,0.3)',
                textColor: typeof item.textColor === 'string' ? item.textColor : 'inherit'
            }));
    }

    function normalizeScheduledLogsConfig(value) {
        const source = isPlainObject(value) ? value : {};
        const interval = ['hourly', 'daily', 'weekly'].includes(source.interval) ? source.interval : 'daily';
        return {
            enabled: normalizeBoolean(source.enabled, false),
            interval,
            lastRun: normalizeTimestamp(source.lastRun)
        };
    }

    function normalizeWebhookTemplate(value) {
        const source = isPlainObject(value) ? value : {};
        return {
            preset: ['generic', 'discord', 'slack'].includes(source.preset) ? source.preset : 'generic',
            template: typeof source.template === 'string' ? source.template : ''
        };
    }

    function normalizeWebhookDeliveries(value) {
        if (!Array.isArray(value)) return [];
        return value
            .filter(item => isPlainObject(item))
            .slice(0, 5)
            .map(item => ({
                at: normalizeTimestamp(item.at) || Date.now(),
                ok: normalizeBoolean(item.ok, false),
                status: Number.isFinite(Number(item.status)) ? Number(item.status) : null,
                type: typeof item.type === 'string' ? item.type : 'event',
                detail: typeof item.detail === 'string' ? item.detail.slice(0, 180) : ''
            }));
    }

    function normalizeOfflineLogCachePrivacy(value) {
        const source = isPlainObject(value) ? value : {};
        const ttlDays = Math.round(normalizeNumber(source.ttlDays, 1, 1, 30));
        return {
            enabled: normalizeBoolean(source.enabled, false),
            ttlDays: OFFLINE_LOG_CACHE_TTL_DAYS.includes(ttlDays) ? ttlDays : 1,
            includeInBackups: normalizeBoolean(source.includeInBackups, false),
            lastPurged: normalizeTimestamp(source.lastPurged)
        };
    }

    function normalizeStorageValue(key, value) {
        const defaultValue = STORAGE_DEFAULTS[key];
        switch (key) {
            case KEY_FILTER_STATE: return normalizeFilterState(value);
            case KEY_HIDDEN_DOMAINS:
            case KEY_HAGEZI_ADDED_TLDS:
            case KEY_HAGEZI_ADDED_ALLOWLIST:
            case KEY_WEBHOOK_DOMAINS:
                return normalizeStringArray(value, cloneStorageValue(defaultValue));
            case KEY_LOCK_STATE:
            case KEY_LIST_PAGE_THEME:
            case KEY_ULTRA_CONDENSED:
            case KEY_CUSTOM_CSS_ENABLED:
            case KEY_LIST_SORT_AZ:
            case KEY_LIST_SORT_TLD:
            case KEY_LIST_BOLD_ROOT:
            case KEY_LIST_LIGHTEN_SUB:
            case KEY_LIST_RIGHT_ALIGN:
            case KEY_SHOW_LOG_COUNTERS:
            case KEY_COLLAPSE_BLOCKLISTS:
            case KEY_COLLAPSE_TLDS:
            case KEY_SHOW_CNAME_CHAIN:
                return normalizeBoolean(value, defaultValue);
            case KEY_WIDTH:
                return normalizeNumber(value, defaultValue, 120, 640);
            case KEY_API_KEY:
            case KEY_PROFILE_ID:
                return normalizeNullableString(value);
            case KEY_THEME:
                return ['dark', 'darkblue', 'light'].includes(value) ? value : defaultValue;
            case KEY_DENSITY_MODE:
                return value === 'roomy' ? 'roomy' : 'compact';
            case KEY_THEME_STUDIO_CSS:
            case KEY_WEBHOOK_URL:
                return normalizeString(value, defaultValue);
            case KEY_DOMAIN_ACTIONS:
            case KEY_DOMAIN_OF_DAY:
            case KEY_HAGEZI_LIST_META:
            case KEY_HAGEZI_LIST_SNAPSHOTS:
            case KEY_DOMAIN_DESCRIPTIONS:
            case KEY_DOMAIN_TAGS:
                return normalizeObjectMap(value);
            case KEY_DOMAIN_UNDO_STACK:
                return Array.isArray(value) ? value.slice(0, 10) : [];
            case KEY_HAGEZI_AUTO_SYNC:
                return normalizeHageziAutoSync(value);
            case KEY_REGEX_PATTERNS:
                return normalizeRegexPatterns(value);
            case KEY_SCHEDULED_LOGS:
                return normalizeScheduledLogsConfig(value);
            case KEY_WEBHOOK_TEMPLATE:
                return normalizeWebhookTemplate(value);
            case KEY_WEBHOOK_DELIVERIES:
                return normalizeWebhookDeliveries(value);
            case KEY_WEBHOOK_RATE_LIMIT:
                return Math.round(normalizeNumber(value, defaultValue, 0, 86400));
            case KEY_WEBHOOK_TRUST:
                return normalizeWebhookTrust(value);
            case KEY_PARENTAL_WEEKLY_SCHEDULE:
                return normalizeParentalWeeklySchedule(value);
            case KEY_PARENTAL_DEVICE_OVERRIDES:
                return normalizeParentalDeviceOverrides(value);
            case KEY_OFFLINE_LOG_CACHE_PRIVACY:
                return normalizeOfflineLogCachePrivacy(value);
            default:
                return cloneStorageValue(defaultValue);
        }
    }

    function describeStorageKey(key) {
        return key.replace(KEY_PREFIX, '').replace(/_v\d+$/, '').replace(/_/g, ' ');
    }

    function buildStorageDefaultsWithSchema() {
        return { [KEY_SCHEMA_VERSION]: 0, ...STORAGE_DEFAULTS };
    }

    async function runStorageDoctor() {
        const stored = await storage.get(buildStorageDefaultsWithSchema());
        const currentVersion = Math.max(0, Number(stored[KEY_SCHEMA_VERSION]) || 0);
        const writes = {};
        const repaired = [];
        const migrations = [];

        if (currentVersion < STORAGE_SCHEMA_VERSION) {
            migrations.push(`schema ${currentVersion || 'new'} -> ${STORAGE_SCHEMA_VERSION}`);
            writes[KEY_SCHEMA_VERSION] = STORAGE_SCHEMA_VERSION;
        }

        Object.keys(STORAGE_DEFAULTS).forEach((key) => {
            const normalized = normalizeStorageValue(key, stored[key]);
            if (!valuesEqual(normalized, stored[key])) {
                writes[key] = normalized;
                repaired.push(describeStorageKey(key));
            }
        });

        if (Object.keys(writes).length) {
            await storage.set(writes);
        }

        return {
            schemaVersion: STORAGE_SCHEMA_VERSION,
            previousSchemaVersion: currentVersion,
            migrations,
            repaired,
            repairedCount: repaired.length,
            wrote: Object.keys(writes)
        };
    }

    function formatStorageDoctorMessage(report) {
        if (!report) return 'Storage doctor has not run yet.';
        if (!report.migrations.length && report.repairedCount === 0) {
            return `Storage schema v${report.schemaVersion} healthy.`;
        }
        const parts = [];
        if (report.migrations.length) parts.push(report.migrations.join(', '));
        if (report.repairedCount) parts.push(`repaired ${report.repairedCount}: ${report.repaired.slice(0, 4).join(', ')}${report.repairedCount > 4 ? '...' : ''}`);
        return `Storage doctor: ${parts.join('; ')}.`;
    }

    function renderStorageDoctorStatus(element, report = storageDoctorReport) {
        if (!element) return;
        element.textContent = formatStorageDoctorMessage(report);
    }

    async function exportNdnsSettingsBackup() {
        const values = await storage.get(STORAGE_BACKUP_KEYS);
        const backup = {
            app: 'NDNS',
            backupType: STORAGE_BACKUP_TYPE,
            schemaVersion: STORAGE_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            excludedKeys: [...STORAGE_BACKUP_EXCLUDED_KEYS],
            values: {}
        };
        STORAGE_BACKUP_KEYS.forEach((key) => {
            backup.values[key] = normalizeStorageValue(key, values[key]);
        });
        downloadFile(JSON.stringify(backup, null, 2), `NDNS-Settings-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
        showToast('NDNS settings backup exported.');
    }

    async function importNdnsSettingsBackupFile(file, statusEl) {
        if (!file) return;
        const text = await file.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            showToast('Invalid NDNS settings backup JSON.', true);
            return;
        }
        if (!isPlainObject(parsed) || parsed.backupType !== STORAGE_BACKUP_TYPE || !isPlainObject(parsed.values)) {
            showToast('This is not an NDNS settings backup.', true);
            return;
        }

        const writes = { [KEY_SCHEMA_VERSION]: STORAGE_SCHEMA_VERSION };
        const repaired = [];
        STORAGE_BACKUP_KEYS.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(parsed.values, key)) return;
            const normalized = normalizeStorageValue(key, parsed.values[key]);
            writes[key] = normalized;
            if (!valuesEqual(normalized, parsed.values[key])) repaired.push(describeStorageKey(key));
        });

        await storage.set(writes);
        storageDoctorReport = await runStorageDoctor();
        renderStorageDoctorStatus(statusEl);
        showToast(`NDNS settings imported${repaired.length ? ` with ${repaired.length} repaired values` : ''}. Reloading...`, false, 2500);
        setTimeout(() => location.reload(), 1200);
    }

    function formatOfflineLogCachePrivacyStatus() {
        const state = offlineLogCachePrivacy.enabled ? 'enabled' : 'off';
        const purged = offlineLogCachePrivacy.lastPurged
            ? ` Last purge: ${new Date(offlineLogCachePrivacy.lastPurged).toLocaleString()}.`
            : '';
        return `Offline log cache is ${state}. Cached DNS logs are local-only, profile-scoped, TTL ${offlineLogCachePrivacy.ttlDays} day(s), and excluded from normal settings backups. Future cache export is ${offlineLogCachePrivacy.includeInBackups ? 'allowed' : 'blocked'}.${purged}`;
    }

    function deleteOfflineLogCacheDatabase() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                resolve('IndexedDB unavailable');
                return;
            }
            const request = indexedDB.deleteDatabase(OFFLINE_LOG_CACHE_DB_NAME);
            request.onsuccess = () => resolve('deleted');
            request.onblocked = () => resolve('blocked');
            request.onerror = () => reject(request.error || new Error('IndexedDB delete failed'));
        });
    }

    async function purgeOfflineLogCache(statusEl = null) {
        const result = await deleteOfflineLogCacheDatabase();
        offlineLogCachePrivacy = {
            ...offlineLogCachePrivacy,
            lastPurged: Date.now()
        };
        await storage.set({ [KEY_OFFLINE_LOG_CACHE_PRIVACY]: offlineLogCachePrivacy });
        if (statusEl) statusEl.textContent = formatOfflineLogCachePrivacyStatus();
        showToast(result === 'blocked' ? 'Offline log cache purge is blocked by another open tab.' : 'Offline log cache purged.');
    }

    async function initializeState() {
        storageDoctorReport = await runStorageDoctor();
        const values = await storage.get(STORAGE_DEFAULTS);
        filters = { ...defaultFilters, ...values[KEY_FILTER_STATE] };
        hiddenDomains = new Set(values[KEY_HIDDEN_DOMAINS]);
        isManuallyLocked = values[KEY_LOCK_STATE];
        currentTheme = values[KEY_THEME];
        panelWidth = values[KEY_WIDTH];
        NDNS_API_KEY = values[KEY_API_KEY];
        globalProfileId = values[KEY_PROFILE_ID];
        domainActions = values[KEY_DOMAIN_ACTIONS];
        domainUndoStack = Array.isArray(values[KEY_DOMAIN_UNDO_STACK]) ? values[KEY_DOMAIN_UNDO_STACK].slice(0, 10) : [];
        domainOfDayState = values[KEY_DOMAIN_OF_DAY] || {};
        enableListPageTheme = values[KEY_LIST_PAGE_THEME];
        hageziListMeta = values[KEY_HAGEZI_LIST_META] || {};
        hageziListSnapshots = values[KEY_HAGEZI_LIST_SNAPSHOTS] || {};
        hageziAutoSyncConfig = { enabled: false, lastRun: null, ...(values[KEY_HAGEZI_AUTO_SYNC] || {}) };
        isUltraCondensed = values[KEY_ULTRA_CONDENSED];
        customCssEnabled = values[KEY_CUSTOM_CSS_ENABLED];
        themeStudioCss = String(values[KEY_THEME_STUDIO_CSS] || '');
        densityMode = values[KEY_DENSITY_MODE] === 'roomy' ? 'roomy' : 'compact';
        // NDNS features
        domainDescriptions = values[KEY_DOMAIN_DESCRIPTIONS];
        domainTags = values[KEY_DOMAIN_TAGS];
        listSortAZ = values[KEY_LIST_SORT_AZ];
        listSortTLD = values[KEY_LIST_SORT_TLD];
        listBoldRoot = values[KEY_LIST_BOLD_ROOT];
        listLightenSub = values[KEY_LIST_LIGHTEN_SUB];
        listRightAlign = values[KEY_LIST_RIGHT_ALIGN];

        showLogCounters = values[KEY_SHOW_LOG_COUNTERS];
        collapseBlocklists = values[KEY_COLLAPSE_BLOCKLISTS];
        collapseTLDs = values[KEY_COLLAPSE_TLDS];
        // v3.4 features
        regexPatterns = values[KEY_REGEX_PATTERNS];
        scheduledLogsConfig = values[KEY_SCHEDULED_LOGS];
        webhookUrl = values[KEY_WEBHOOK_URL];
        webhookDomains = values[KEY_WEBHOOK_DOMAINS];
        webhookTemplate = { preset: 'generic', template: '', ...(values[KEY_WEBHOOK_TEMPLATE] || {}) };
        webhookDeliveries = Array.isArray(values[KEY_WEBHOOK_DELIVERIES]) ? values[KEY_WEBHOOK_DELIVERIES].slice(0, 5) : [];
        webhookRateLimitSeconds = Number(values[KEY_WEBHOOK_RATE_LIMIT] ?? 60);
        webhookTrust = normalizeWebhookTrust(values[KEY_WEBHOOK_TRUST]);
        showCnameChain = values[KEY_SHOW_CNAME_CHAIN];
        parentalWeeklySchedule = normalizeParentalWeeklySchedule(values[KEY_PARENTAL_WEEKLY_SCHEDULE]);
        parentalDeviceOverrides = normalizeParentalDeviceOverrides(values[KEY_PARENTAL_DEVICE_OVERRIDES]);
        offlineLogCachePrivacy = normalizeOfflineLogCachePrivacy(values[KEY_OFFLINE_LOG_CACHE_PRIVACY]);
    }

    function delayRequest(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function createRequestError(message, meta = {}) {
        const error = new Error(message);
        Object.assign(error, meta);
        return error;
    }

    function getResponseHeader(responseHeaders = '', name) {
        const wanted = name.toLowerCase();
        return String(responseHeaders || '').split(/\r?\n/).reduce((found, line) => {
            if (found) return found;
            const idx = line.indexOf(':');
            if (idx === -1) return '';
            return line.slice(0, idx).trim().toLowerCase() === wanted ? line.slice(idx + 1).trim() : '';
        }, '');
    }

    function parseRetryAfterMs(responseHeaders = '') {
        const value = getResponseHeader(responseHeaders, 'retry-after');
        if (!value) return null;
        const seconds = Number(value);
        if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
        const retryAt = Date.parse(value);
        return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
    }

    function canRetryMethod(method, options = {}) {
        const normalized = String(method || 'GET').toUpperCase();
        return options.retryNonIdempotent === true || !NON_RETRYABLE_WRITE_METHODS.has(normalized);
    }

    function isRetryableStatus(status) {
        return status === 429 || (status >= 500 && status <= 599);
    }

    function isNextDnsApiUrl(url) {
        try {
            const parsed = new URL(url, 'https://api.nextdns.io');
            return parsed.protocol === 'https:' && parsed.hostname === 'api.nextdns.io';
        } catch {
            return false;
        }
    }

    function getRetryDelayMs(responseOrError, attempt) {
        const retryAfterMs = parseRetryAfterMs(responseOrError?.responseHeaders);
        if (Number.isFinite(retryAfterMs)) return Math.min(retryAfterMs, API_RETRY_MAX_DELAY_MS);
        const jitter = Math.floor(Math.random() * 150);
        return Math.min(API_RETRY_MAX_DELAY_MS, (API_RETRY_BASE_DELAY_MS * (2 ** attempt)) + jitter);
    }

    function gmXmlHttpRequestOnce(options) {
        return new Promise((resolve, reject) => {
            try {
                GM_xmlhttpRequest({
                    timeout: API_REQUEST_TIMEOUT_MS,
                    ...options,
                    onload: resolve,
                    onerror: (response) => reject(createRequestError(`Network request failed: ${response?.statusText || 'unknown error'}`, {
                        isNetworkError: true,
                        status: response?.status,
                        responseHeaders: response?.responseHeaders || ''
                    })),
                    ontimeout: () => reject(createRequestError('Request timed out', { isTimeout: true }))
                });
            } catch (e) {
                reject(createRequestError(`Request setup failed: ${e?.message || 'unknown'}`, { isSetupError: true }));
            }
        });
    }

    async function gmXmlHttpRequestWithRetry(options, retryOptions = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const maxRetries = Number.isFinite(Number(retryOptions.retries)) ? Number(retryOptions.retries) : API_MAX_RETRIES;
        const canRetry = retryOptions.retry !== false && canRetryMethod(method, retryOptions);

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await gmXmlHttpRequestOnce(options);
                response.ndnsAttempts = attempt + 1;
                if (canRetry && attempt < maxRetries && isRetryableStatus(response.status)) {
                    const delay = getRetryDelayMs(response, attempt);
                    console.warn(`[NDNS] Retrying ${method} ${options.url} after HTTP ${response.status} in ${delay}ms`);
                    await delayRequest(delay);
                    continue;
                }
                return response;
            } catch (error) {
                error.ndnsAttempts = attempt + 1;
                const retryableFailure = error.isTimeout || error.isNetworkError;
                if (!canRetry || !retryableFailure || attempt >= maxRetries) throw error;
                const delay = getRetryDelayMs(error, attempt);
                console.warn(`[NDNS] Retrying ${method} ${options.url} after ${error.message} in ${delay}ms`);
                await delayRequest(delay);
            }
        }

        throw createRequestError('Request failed after retry loop');
    }

    async function makeApiRequest(method, endpoint, body = null, apiKey = NDNS_API_KEY, customUrl = null, options = {}) {
        const normalizedMethod = String(method || 'GET').toUpperCase();
        const requestUrl = customUrl || `https://api.nextdns.io${endpoint}`;
        const headers = {};
        if (apiKey && isNextDnsApiUrl(requestUrl)) headers['X-Api-Key'] = apiKey;
        if (body) headers['Content-Type'] = 'application/json;charset=utf-8';

        const response = await gmXmlHttpRequestWithRetry({
            method: normalizedMethod,
            url: requestUrl,
            headers,
            data: body ? JSON.stringify(body) : undefined,
            responseType: 'json',
            timeout: options.timeoutMs || API_REQUEST_TIMEOUT_MS
        }, options);

        if (response.status >= 200 && response.status < 300) return response.response || {};
        if (response.status === 404 && normalizedMethod === 'DELETE') return {};

        const errorMsg = response.response?.errors?.[0]?.detail || `${response.status}: ${response.statusText || 'Error'}`;
        const attempts = response.ndnsAttempts || 1;
        throw createRequestError(attempts > 1 ? `${errorMsg} after ${attempts} attempts` : errorMsg, {
            status: response.status,
            statusText: response.statusText,
            responseHeaders: response.responseHeaders || '',
            ndnsAttempts: attempts
        });
    }

    function parseNextDnsTestResponse(response) {
        if (response?.response && typeof response.response === 'object') return response.response;
        if (typeof response?.responseText === 'string' && response.responseText.trim()) {
            return JSON.parse(response.responseText);
        }
        return {};
    }

    async function fetchNextDnsVerificationStatus() {
        const response = await gmXmlHttpRequestWithRetry({
            method: 'GET',
            url: `${NEXTDNS_TEST_URL}?ndns=${Date.now()}`,
            responseType: 'json',
            timeout: 10000
        }, { retries: 1 });

        if (response.status < 200 || response.status >= 300) {
            throw createRequestError(`${response.status}: ${response.statusText || 'NextDNS test failed'}`, {
                status: response.status,
                statusText: response.statusText,
                responseHeaders: response.responseHeaders || ''
            });
        }

        return parseNextDnsTestResponse(response);
    }

    function formatProtocolLabel(protocol) {
        const normalized = String(protocol || '').trim();
        if (!normalized) return '';
        const upper = normalized.toUpperCase();
        if (upper === 'DOH') return 'DoH';
        if (upper === 'DOT') return 'DoT';
        if (upper === 'UDP' || upper === 'TCP') return upper;
        return normalized;
    }

    function buildNextDnsVerificationView(payload = {}) {
        const status = String(payload.status || '').toLowerCase();
        const profile = String(payload.profile || payload.profileId || '').trim();
        const currentProfile = String(getCurrentProfileId() || '').trim();
        const protocol = formatProtocolLabel(payload.protocol);
        const resolver = payload.resolver || payload.srcIP || payload.destIP || '';
        const details = [protocol, profile ? `profile ${profile}` : '', payload.server || resolver]
            .filter(Boolean)
            .join(' / ');

        if (status === 'ok') {
            if (currentProfile && profile && profile !== currentProfile) {
                return {
                    level: 'warning',
                    label: 'Other profile',
                    detail: details || 'NextDNS is active, but not for the open dashboard profile.'
                };
            }
            return {
                level: 'ok',
                label: 'Verified',
                detail: details || 'NextDNS is active for this browser.'
            };
        }

        if (status === 'unconfigured') {
            return {
                level: 'warning',
                label: 'Not active',
                detail: resolver ? `Resolver ${resolver} is not mapped to this profile.` : 'This browser is not using a configured NextDNS resolver.'
            };
        }

        return {
            level: status ? 'warning' : 'error',
            label: status ? status.replace(/[-_]/g, ' ') : 'Unknown',
            detail: details || 'NextDNS test returned an unexpected response.'
        };
    }

    function buildNextDnsVerificationSection() {
        const section = createSafeElement('div', {
            id: 'ndns-section-doh-verification',
            className: 'ndns-section ndns-doh-section',
            attrs: { role: 'status', 'aria-live': 'polite' }
        });

        const row = createSafeElement('div', { className: 'ndns-doh-status-row' });
        const statusWrap = createSafeElement('div', { className: 'ndns-doh-status' });
        const value = createSafeElement('div', { className: 'ndns-doh-value' });
        const dot = createSafeElement('span', { className: 'ndns-doh-dot' });
        const label = createSafeElement('span', { text: 'Checking...' });
        const detail = createSafeElement('div', {
            className: 'ndns-doh-detail',
            text: 'Verifying this browser with test.nextdns.io'
        });
        const refreshBtn = createSafeElement('button', {
            className: 'ndns-panel-button ndns-btn-sm ndns-doh-refresh ndns-tooltip',
            text: uiText('refresh'),
            attrs: { type: 'button', 'aria-label': 'Refresh NextDNS verification' }
        });
        refreshBtn.dataset.tooltip = 'Check whether this browser is using NextDNS now';

        value.append(dot, label);
        statusWrap.append(value, detail);
        row.append(statusWrap, refreshBtn);
        section.append(row);

        const render = (view) => {
            dot.className = `ndns-doh-dot ${view.level}`;
            label.textContent = view.label;
            detail.textContent = view.detail;
        };

        const refresh = async () => {
            refreshBtn.disabled = true;
            render({ level: '', label: 'Checking...', detail: 'Verifying this browser with test.nextdns.io' });
            try {
                render(buildNextDnsVerificationView(await fetchNextDnsVerificationStatus()));
            } catch (error) {
                render({
                    level: 'error',
                    label: 'Unavailable',
                    detail: error?.message || 'NextDNS verification request failed.'
                });
            } finally {
                refreshBtn.disabled = false;
            }
        };

        refreshBtn.onclick = refresh;
        section.ndnsRefreshNextDnsVerification = refresh;
        setTimeout(refresh, 250);
        return section;
    }

    function getProfileID() {
        const m = window.location.pathname.match(/\/([a-z0-9]+)\//);
        return m ? m[1] : null;
    }

    function getCurrentProfileId() {
        return globalProfileId || getProfileID();
    }

    function extractRootDomain(domain) {
        const parts = domain.replace(/^\*\./, '').split('.');
        if (parts.length < 2) return domain.replace(/^\*\./, '');
        if (parts.length > 2 && SLDs.has(parts[parts.length - 2])) {
            return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function createTrustedHtmlPolicy() {
        if (typeof trustedTypes === 'undefined' || !trustedTypes.createPolicy) return null;
        try {
            return trustedTypes.createPolicy('ndns-static-html', { createHTML: (html) => html });
        } catch {
            return null;
        }
    }

    const trustedHtmlPolicy = createTrustedHtmlPolicy();

    function uiText(key) {
        return UI_STRINGS[key] || key;
    }

    function setStaticHtml(element, html) {
        element.innerHTML = trustedHtmlPolicy ? trustedHtmlPolicy.createHTML(html) : html;
    }

    function createSafeElement(tag, options = {}, children = []) {
        const element = document.createElement(tag);
        if (options.className) element.className = options.className;
        if (options.style) element.style.cssText = options.style;
        if (options.title !== undefined) element.title = String(options.title);
        if (options.text !== undefined) element.textContent = String(options.text);
        Object.entries(options.attrs || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) element.setAttribute(key, String(value));
        });
        children.flat().forEach((child) => {
            if (child === undefined || child === null) return;
            element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return element;
    }

    function getDialogFocusable(dialog) {
        return Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter(element => !element.disabled && element.offsetParent !== null);
    }

    function focusDialog(overlay) {
        const dialog = overlay.querySelector('[role="dialog"]');
        if (!dialog) return;
        overlay.ndnsPreviousFocus = document.activeElement;
        const focusable = getDialogFocusable(dialog);
        (focusable[0] || dialog).focus({ preventScroll: true });
    }

    function restoreDialogFocus(overlay) {
        const previous = overlay?.ndnsPreviousFocus;
        if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
            previous.focus({ preventScroll: true });
        }
        if (overlay) overlay.ndnsPreviousFocus = null;
    }

    function setupDialogAccessibility(overlay, dialog, label) {
        if (!overlay || !dialog || overlay.dataset.ndnsDialogA11y === '1') return;
        overlay.dataset.ndnsDialogA11y = '1';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', label);
        dialog.tabIndex = -1;
        overlay.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const focusable = getDialogFocusable(dialog);
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        });
        const removalObserver = new MutationObserver(() => {
            if (!document.body.contains(overlay)) {
                restoreDialogFocus(overlay);
                removalObserver.disconnect();
            }
        });
        removalObserver.observe(document.body, { childList: true, subtree: true });
        if (getComputedStyle(overlay).display !== 'none') setTimeout(() => focusDialog(overlay), 0);
    }

    function scanDialogAccessibility(root = document) {
        const overlays = [];
        if (root.matches?.('.ndns-profile-modal-overlay, .ndns-settings-modal-overlay, #ndns-onboarding-overlay')) overlays.push(root);
        root.querySelectorAll?.('.ndns-profile-modal-overlay, .ndns-settings-modal-overlay, #ndns-onboarding-overlay').forEach(overlay => overlays.push(overlay));
        overlays.forEach((overlay) => {
            const dialog = overlay.querySelector('.ndns-profile-modal, .ndns-settings-modal-content, #ndns-onboarding-modal');
            const label = dialog?.querySelector('h3,h2')?.textContent?.trim() || 'NDNS dialog';
            setupDialogAccessibility(overlay, dialog, label);
        });
    }

    function initAccessibilityObserver() {
        scanDialogAccessibility();
        scanSwitchAccessibility();
        const observer = new MutationObserver((records) => {
            records.forEach(record => record.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                scanDialogAccessibility(node);
                scanSwitchAccessibility(node);
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function inferSwitchLabel(element) {
        const container = element.closest('.settings-control-row, .ndns-parental-toggle, .ndns-device-override-row, .ndns-webhook-row, .ndns-weekly-schedule');
        if (!container) return element.getAttribute('aria-label') || 'Toggle setting';
        const clone = container.cloneNode(true);
        clone.querySelectorAll('.ndns-toggle-switch, button, input, select, textarea').forEach(control => control.remove());
        return clone.textContent.trim().replace(/\s+/g, ' ') || element.getAttribute('aria-label') || 'Toggle setting';
    }

    function scanSwitchAccessibility(root = document) {
        const switches = [];
        if (root.matches?.('.ndns-toggle-switch')) switches.push(root);
        root.querySelectorAll?.('.ndns-toggle-switch').forEach(element => switches.push(element));
        switches.forEach(element => enhanceSwitch(element, inferSwitchLabel(element), element.classList.contains('active')));
    }

    function enhanceSwitch(element, label, checked = false) {
        if (!element || element.dataset.ndnsSwitchA11y === '1') return element;
        element.dataset.ndnsSwitchA11y = '1';
        element.setAttribute('role', 'switch');
        element.setAttribute('aria-label', label);
        element.tabIndex = 0;
        const update = () => element.setAttribute('aria-checked', element.classList.contains('active') ? 'true' : 'false');
        element.classList.toggle('active', !!checked);
        update();
        element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            element.click();
        });
        new MutationObserver(update).observe(element, { attributes: true, attributeFilter: ['class'] });
        return element;
    }

    function getDomainTag(domain) {
        const key = normalizeImportedDomain(domain);
        if (!key || !domainTags) return '';
        const tagValue = domainTags[key];
        if (!tagValue) return '';
        if (typeof tagValue === 'string') return tagValue;
        return tagValue.tag || '';
    }

    function isProtectedDomainTag(domain) {
        const tag = getDomainTag(domain);
        return tag === 'protected' || tag === 'local';
    }

    function downloadFile(content, fileName, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Logs CSV fetch (redirect-safe) ---
    // The NextDNS /logs/download endpoint 302-redirects to a pre-signed public
    // file URL on a different host. Following that redirect with the X-Api-Key
    // header re-attached fails ("Failed to fetch"). Use ?redirect=0 to get the
    // public URL as JSON, then fetch that URL directly with no auth header.
    function fetchLogsCsv(profileId) {
        return gmXmlHttpRequestWithRetry({
            method: 'GET',
            url: `https://api.nextdns.io/profiles/${profileId}/logs/download?redirect=0`,
            headers: { 'X-Api-Key': NDNS_API_KEY },
            responseType: 'json',
            timeout: API_REQUEST_TIMEOUT_MS
        }).then((meta) => {
            if (meta.status < 200 || meta.status >= 300) {
                const attempts = meta.ndnsAttempts || 1;
                throw new Error(`API Error: ${meta.status}${attempts > 1 ? ` after ${attempts} attempts` : ''}`);
            }
            const fileUrl = meta.response?.url || meta.response?.data?.url;
            if (!fileUrl) throw new Error('No log file URL returned by API');
            // Public pre-signed URL — must NOT send X-Api-Key (would be rejected).
            return gmXmlHttpRequestWithRetry({ method: 'GET', url: fileUrl, timeout: API_REQUEST_TIMEOUT_MS });
        }).then((file) => {
            if (file.status < 200 || file.status >= 300) {
                const attempts = file.ndnsAttempts || 1;
                throw new Error(`Download Error: ${file.status}${attempts > 1 ? ` after ${attempts} attempts` : ''}`);
            }
            return file.responseText;
        });
    }

    // --- NEW: Quick Actions from Panel (Download/Clear Logs) ---
    async function quickDownloadLogs() {
        const profileId = getCurrentProfileId();
        if (!profileId || !NDNS_API_KEY) {
            showToast('API Key or Profile ID missing.', true);
            return;
        }

        showToast('Downloading logs...', false, 2000);

        try {
            const csvText = await fetchLogsCsv(profileId);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadFile(csvText, `nextdns-logs-${profileId}-${timestamp}.csv`, 'text/csv');
            showToast('Logs downloaded successfully!');
        } catch (error) {
            showToast(`Failed to download logs: ${error.message}`, true);
        }
    }

    async function quickClearLogs() {
        const profileId = getCurrentProfileId();
        if (!profileId || !NDNS_API_KEY) {
            showToast('API Key or Profile ID missing.', true);
            return;
        }

        showToast('Clearing logs...', false, 2000);

        try {
            await makeApiRequest('DELETE', `/profiles/${profileId}/logs`);
            showToast('Logs cleared successfully!');

            // Refresh page if on logs page
            if (location.pathname.includes('/logs')) {
                setTimeout(() => location.reload(), 1000);
            }
        } catch (error) {
            showToast(`Failed to clear logs: ${error.message}`, true);
        }
    }

    // --- NEW: Toggle Ultra Condensed Mode ---
    function applyUltraCondensedMode(enabled) {
        if (ultraCondensedStyleElement) {
            ultraCondensedStyleElement.remove();
            ultraCondensedStyleElement = null;
        }

        if (enabled && customCssEnabled) {
            ultraCondensedStyleElement = document.createElement('style');
            ultraCondensedStyleElement.id = 'ndns-ultra-condensed';
            ultraCondensedStyleElement.textContent = ultraCondensedCSS;
            document.head.appendChild(ultraCondensedStyleElement);
        }

        isUltraCondensed = enabled;
    }

    // --- Escape key to close overlays ---
    function setupEscapeHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (settingsModal && settingsModal.style.display !== 'none') {
                    settingsModal.style.display = 'none';
                    restoreDialogFocus(settingsModal);
                }
            }
        });
    }

    // --- NEW: Copy to Clipboard ---
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!', false, 1500);
        }).catch(() => {
            showToast('Failed to copy', true, 1500);
        });
    }

    // --- HAGEZI INTEGRATION ---
    async function fetchHageziList(url, type) {
        const response = await gmXmlHttpRequestWithRetry({
            method: 'GET',
            url,
            timeout: API_REQUEST_TIMEOUT_MS
        });
        if (response.status < 200 || response.status >= 300) {
            const attempts = response.ndnsAttempts || 1;
            throw new Error(`Failed to fetch list: ${response.statusText || response.status}${attempts > 1 ? ` after ${attempts} attempts` : ''}`);
        }

        const content = response.responseText.trim();
        let items;
        if (type === 'tld') {
            items = content.match(/^\|\|(xn--)?\w+\^$/gm)?.map(e => e.slice(2, -1)) || [];
        } else {
            items = content.split("\n").map(e => e.slice(4, -1));
        }
        return new Set(items);
    }

    function normalizeHageziItems(items) {
        return Array.from(new Set(Array.from(items || [])
            .map(item => String(item || '').trim().toLowerCase())
            .filter(Boolean)))
            .sort((a, b) => a.localeCompare(b));
    }

    function hashHageziItems(items) {
        const data = normalizeHageziItems(items).join('\n');
        let hash = 2166136261;
        for (let i = 0; i < data.length; i++) {
            hash = Math.imul(hash ^ data.charCodeAt(i), 16777619) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    }

    function diffHageziItems(previousItems, currentItems) {
        const previous = normalizeHageziItems(previousItems);
        const current = normalizeHageziItems(currentItems);
        const previousSet = new Set(previous);
        const currentSet = new Set(current);
        return {
            previous,
            current,
            added: current.filter(item => !previousSet.has(item)),
            removed: previous.filter(item => !currentSet.has(item))
        };
    }

    function serializeHageziDiff(diff) {
        const limit = 150;
        return {
            listType: diff.listType,
            listName: diff.listName,
            checkedAt: diff.checkedAt,
            previousHash: diff.previousHash,
            hash: diff.hash,
            previousCount: diff.previousCount,
            count: diff.count,
            addedCount: diff.added.length,
            removedCount: diff.removed.length,
            added: diff.added.slice(0, limit),
            removed: diff.removed.slice(0, limit),
            addedOverflow: Math.max(0, diff.added.length - limit),
            removedOverflow: Math.max(0, diff.removed.length - limit)
        };
    }

    async function recordHageziListVersion(listType, items, listName) {
        const previousItems = hageziListSnapshots[listType] || [];
        const diff = diffHageziItems(previousItems, items);
        const previousMeta = hageziListMeta[listType] || {};
        const checkedAt = new Date().toISOString();
        const hash = hashHageziItems(diff.current);

        hageziListSnapshots[listType] = diff.current;
        hageziListMeta[listType] = {
            hash,
            count: diff.current.length,
            checkedAt,
            addedCount: diff.added.length,
            removedCount: diff.removed.length
        };
        await storage.set({
            [KEY_HAGEZI_LIST_META]: hageziListMeta,
            [KEY_HAGEZI_LIST_SNAPSHOTS]: hageziListSnapshots
        });

        return {
            ...diff,
            listType,
            listName,
            checkedAt,
            previousHash: previousMeta.hash || '',
            hash,
            previousCount: diff.previous.length,
            count: diff.current.length
        };
    }

    function formatHageziVersionStatus() {
        const rows = [
            ['tlds', 'TLDs'],
            ['allowlist', 'Allowlist']
        ].map(([key, label]) => {
            const meta = hageziListMeta[key];
            if (!meta?.hash) return `${label}: not checked`;
            const when = meta.checkedAt ? new Date(meta.checkedAt).toLocaleString() : 'unknown time';
            return `${label}: ${meta.count} entries, ${meta.hash}, ${when}`;
        });
        return `Tracked upstream versions: ${rows.join(' | ')}`;
    }

    function formatHageziAutoSyncStatus() {
        return hageziAutoSyncConfig.lastRun
            ? `Last auto-sync: ${new Date(hageziAutoSyncConfig.lastRun).toLocaleString()}`
            : 'No auto-sync run yet.';
    }

    function updateHageziAutoSyncStatusElement() {
        const status = document.getElementById('ndns-hagezi-auto-status');
        if (status) status.textContent = formatHageziAutoSyncStatus();
    }

    function renderHageziDiffColumn(title, items, overflow) {
        const column = document.createElement('div');
        column.style.cssText = 'min-width:0;';

        const heading = document.createElement('div');
        heading.style.cssText = 'font-size:12px;font-weight:700;margin-bottom:6px;color:var(--panel-text);';
        heading.textContent = `${title} (${items.length + overflow})`;

        const list = document.createElement('div');
        list.style.cssText = 'max-height:220px;overflow:auto;border:1px solid var(--panel-border);border-radius:8px;background:var(--section-bg);padding:8px;font-family:monospace;font-size:11px;';

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.style.color = 'var(--panel-text-secondary)';
            empty.textContent = 'No changes.';
            list.appendChild(empty);
        } else {
            items.forEach((item) => {
                const row = document.createElement('div');
                row.textContent = item;
                list.appendChild(row);
            });
            if (overflow > 0) {
                const more = document.createElement('div');
                more.style.color = 'var(--panel-text-secondary)';
                more.textContent = `...and ${overflow} more`;
                list.appendChild(more);
            }
        }

        column.append(heading, list);
        return column;
    }

    function showHageziDiffView(diff) {
        if (!diff) return;
        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.style.maxWidth = '720px';
        modal.onclick = (e) => e.stopPropagation();

        const title = document.createElement('h3');
        title.textContent = `${diff.listName} Upstream Diff`;

        const summary = document.createElement('div');
        summary.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin-bottom:10px;';
        const previousHash = diff.previousHash || 'baseline';
        summary.textContent = `${diff.previousCount} -> ${diff.count} entries, ${previousHash} -> ${diff.hash}, checked ${new Date(diff.checkedAt).toLocaleString()}.`;

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
        grid.append(
            renderHageziDiffColumn('Added upstream', diff.added || [], diff.addedOverflow || 0),
            renderHageziDiffColumn('Removed upstream', diff.removed || [], diff.removedOverflow || 0)
        );

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ndns-panel-button';
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '12px';
        closeBtn.onclick = () => overlay.remove();

        modal.append(title, summary, grid, closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function getHageziConfig(profileId) {
        return {
            tlds: {
                url: HAGEZI_TLDS_URL,
                parseType: 'tld',
                getEndpoint: `/profiles/${profileId}/security`,
                addEndpoint: `/profiles/${profileId}/security/tlds`,
                removeEndpoint: (item) => `/profiles/${profileId}/security/tlds/hex:${toHex(item)}`,
                storageKey: KEY_HAGEZI_ADDED_TLDS,
                navUrl: `https://my.nextdns.io/${profileId}/security`,
                name: 'TLD Blocklist'
            },
            allowlist: {
                url: HAGEZI_ALLOWLIST_URL,
                parseType: 'domain',
                getEndpoint: `/profiles/${profileId}/allowlist`,
                addEndpoint: `/profiles/${profileId}/allowlist`,
                removeEndpoint: (item) => `/profiles/${profileId}/allowlist/${item}`,
                storageKey: KEY_HAGEZI_ADDED_ALLOWLIST,
                navUrl: `https://my.nextdns.io/${profileId}/allowlist`,
                name: 'Domain Allowlist'
            }
        };
    }

    async function applyHageziListUpdates(listType, currentConfig, onProgress = null) {
        const remoteList = await fetchHageziList(currentConfig.url, currentConfig.parseType);
        const remoteItems = [...remoteList];
        const hageziDiff = await recordHageziListVersion(listType, remoteItems, currentConfig.name);
        const apiResponse = await makeApiRequest('GET', currentConfig.getEndpoint);
        const currentItems = new Set(
            listType === 'tlds' ? apiResponse.data.tlds.map(t => t.id) : apiResponse.data.map(d => d.id)
        );

        const itemsToAdd = remoteItems.filter(item => !currentItems.has(item));
        if (onProgress) onProgress({ stage: 'start', total: itemsToAdd.length });

        for (let i = 0; i < itemsToAdd.length; i++) {
            const item = itemsToAdd[i];
            const body = listType === 'tlds' ? { id: item } : { id: item, active: true };
            await makeApiRequest('POST', currentConfig.addEndpoint, body);
            if (onProgress) onProgress({ stage: 'progress', completed: i + 1, total: itemsToAdd.length });
            await sleep();
        }

        if (itemsToAdd.length > 0) {
            const existingAdded = (await storage.get({ [currentConfig.storageKey]: [] }))[currentConfig.storageKey];
            const newlyAdded = new Set([...existingAdded, ...itemsToAdd]);
            await storage.set({ [currentConfig.storageKey]: [...newlyAdded] });
            if (listType === 'allowlist') {
                itemsToAdd.forEach((item) => {
                    const domain = normalizeImportedDomain(item);
                    if (domain && !domainTags[domain]) domainTags[domain] = 'hagezi';
                });
                await storage.set({ [KEY_DOMAIN_TAGS]: domainTags });
            }
        }

        return {
            listType,
            listName: currentConfig.name,
            diff: serializeHageziDiff(hageziDiff),
            addedCount: itemsToAdd.length
        };
    }

    async function manageHageziLists(action, listType, button) {
        const profileId = getCurrentProfileId();
        if (!profileId || !NDNS_API_KEY) return showToast("Profile ID or API Key missing.", true);

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Processing...';

        const config = getHageziConfig(profileId);

        const currentConfig = config[listType];

        try {
            if (action === 'apply') {
                let progressToast = null;
                const result = await applyHageziListUpdates(listType, currentConfig, ({ stage, completed, total }) => {
                    if (stage === 'start' && total > 0) {
                        progressToast = showToast(`Adding ${total} entries to ${currentConfig.name}... 0%`, false, total * 600);
                    } else if (stage === 'progress' && progressToast) {
                        progressToast.textContent = `Adding to ${currentConfig.name}... ${Math.round(completed / total * 100)}%`;
                    }
                });
                sessionStorage.setItem('ndns_hagezi_diff', JSON.stringify(result.diff));

                if (result.addedCount === 0) {
                    showToast(`Your ${currentConfig.name} is already up to date.`, false);
                } else {
                    showToast(`Successfully added ${result.addedCount} entries.`, false);
                }

            } else if (action === 'remove') {
                const managedItems = (await storage.get({ [currentConfig.storageKey]: [] }))[currentConfig.storageKey];
                const protectedItems = listType === 'allowlist' ? managedItems.filter(isProtectedDomainTag) : [];
                const itemsToRemove = listType === 'allowlist'
                    ? managedItems.filter(item => !isProtectedDomainTag(item))
                    : managedItems;

                if (managedItems.length === 0) {
                    showToast(`No managed ${currentConfig.name} entries found to remove.`, false);
                } else if (itemsToRemove.length === 0) {
                    await storage.set({ [currentConfig.storageKey]: protectedItems });
                    showToast(`Skipped ${protectedItems.length} protected ${currentConfig.name} entries.`, false);
                } else {
                    const skipLabel = protectedItems.length ? ` (${protectedItems.length} protected skipped)` : '';
                    const toast = showToast(`Removing ${itemsToRemove.length} entries from ${currentConfig.name}${skipLabel}... 0%`, false, itemsToRemove.length * 600);
                    for (let i = 0; i < itemsToRemove.length; i++) {
                        const item = itemsToRemove[i];
                        await makeApiRequest('DELETE', currentConfig.removeEndpoint(item));
                        toast.textContent = `Removing from ${currentConfig.name}... ${Math.round((i + 1) / itemsToRemove.length * 100)}%`;
                        await sleep();
                    }
                    if (protectedItems.length) {
                        await storage.set({ [currentConfig.storageKey]: protectedItems });
                    } else {
                        await storage.remove(currentConfig.storageKey);
                    }
                    if (listType === 'allowlist') {
                        itemsToRemove.forEach((item) => {
                            const domain = normalizeImportedDomain(item);
                            if (domain && getDomainTag(domain) === 'hagezi') delete domainTags[domain];
                        });
                        await storage.set({ [KEY_DOMAIN_TAGS]: domainTags });
                    }
                    showToast(`Successfully removed ${itemsToRemove.length} entries${skipLabel}.`, false);
                }
            }

            sessionStorage.setItem('ndns_reopen_settings', 'true');
            window.location.href = currentConfig.navUrl;

        } catch (error) {
            showToast(`Error: ${error.message}`, true, 6000);
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    function notifyHageziAutoSync(results) {
        const changedResults = results.filter(result =>
            result.addedCount > 0 || result.diff.addedCount > 0 || result.diff.removedCount > 0
        );
        if (changedResults.length === 0) return;

        const body = changedResults.map(result =>
            `${result.listName}: ${result.addedCount} applied, upstream +${result.diff.addedCount}/-${result.diff.removedCount}`
        ).join('; ');

        showToast(`HaGeZi auto-sync updated: ${body}`, false, 7000);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification('NDNS HaGeZi auto-sync', { body });
            } catch {}
        }
    }

    async function runHageziAutoSync() {
        if (!hageziAutoSyncConfig.enabled || hageziAutoSyncRunning) return;
        if (!NDNS_API_KEY) return;
        const profileId = getCurrentProfileId();
        if (!profileId) return;

        hageziAutoSyncRunning = true;
        try {
            const config = getHageziConfig(profileId);
            const results = [];
            for (const listType of ['tlds', 'allowlist']) {
                results.push(await applyHageziListUpdates(listType, config[listType]));
            }
            hageziAutoSyncConfig.lastRun = Date.now();
            await storage.set({ [KEY_HAGEZI_AUTO_SYNC]: hageziAutoSyncConfig });
            updateHageziAutoSyncStatusElement();
            notifyHageziAutoSync(results);
        } catch (error) {
            showToast(`HaGeZi auto-sync failed: ${error.message || 'Unknown error'}`, true, 6000);
        } finally {
            hageziAutoSyncRunning = false;
        }
    }

    function initHageziAutoSync() {
        if (hageziAutoSyncTimer) {
            clearInterval(hageziAutoSyncTimer);
            hageziAutoSyncTimer = null;
        }
        if (!hageziAutoSyncConfig.enabled) return;

        const checkAndSync = async () => {
            const lastRun = hageziAutoSyncConfig.lastRun || 0;
            if (Date.now() - lastRun >= HAGEZI_AUTO_SYNC_INTERVAL_MS) {
                await runHageziAutoSync();
            }
        };

        checkAndSync();
        hageziAutoSyncTimer = setInterval(checkAndSync, 60000);
    }

    // --- ONBOARDING & ACCOUNT HANDLING ---
    function showOnboardingModal(options = {}) {
        let existingOverlay = document.getElementById('ndns-onboarding-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ndns-onboarding-overlay';
        const modal = document.createElement('div');
        modal.id = 'ndns-onboarding-modal';

        if (options.manual) {
            const profileId = encodeURIComponent(String(getCurrentProfileId() || ''));
            const inputWrapper = createSafeElement('div', { className: 'api-input-wrapper' }, [
                createSafeElement('input', {
                    attrs: {
                        type: 'text',
                        id: 'ndns-manual-api-input',
                        placeholder: 'Paste API Key here...'
                    }
                })
            ]);
            modal.append(
                createSafeElement('h3', { text: 'Manual API Key Entry' }),
                createSafeElement('p', { text: 'Your API Key has been copied. Paste it below:' }),
                inputWrapper,
                createSafeElement('button', {
                    className: 'ndns-flashy-button',
                    text: 'Accept API Key',
                    attrs: { id: 'ndns-manual-api-submit' }
                }),
                createSafeElement('a', {
                    text: "Didn't copy the key? Click here to return to the API page.",
                    style: 'display: block; font-size: 11px; color: #b0b0b0; margin-top: 12px; text-decoration: underline;',
                    attrs: {
                        href: `https://my.nextdns.io/${profileId}/api`,
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    }
                })
            );
        } else {
            modal.append(
                createSafeElement('h3', { text: 'API Key Required' }),
                createSafeElement('p', { text: "Let's grab your API key from your NextDNS account page to unlock full features." }),
                createSafeElement('button', {
                    className: 'ndns-flashy-button',
                    text: 'Take me there!',
                    attrs: { id: 'ndns-get-api-key-btn' }
                })
            );
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        if (options.manual) {
            document.getElementById('ndns-manual-api-submit').onclick = async () => {
                const key = document.getElementById('ndns-manual-api-input').value;
                if (key) {
                    const settingsSaveBtn = settingsModal.querySelector('#ndns-settings-save-api-key-btn');
                    const settingsInput = settingsModal.querySelector('.api-key-wrapper input');
                    if (settingsInput && settingsSaveBtn) {
                        settingsInput.value = key;
                        settingsSaveBtn.click();
                        overlay.remove();
                    }
                } else {
                    showToast("Please paste a key.", true);
                }
            };
        } else {
            document.getElementById('ndns-get-api-key-btn').onclick = () => {
                sessionStorage.setItem('ndnsRedirectUrl', window.location.href);
                window.location.href = 'https://my.nextdns.io/account';
            };
        }
    }

    function createLoginSpotlight() {
        const loginForm = document.querySelector('.col-xl-4.col-lg-5');
        if (!loginForm) return;

        const overlay = document.createElement('div');
        overlay.className = 'ndns-spotlight-overlay';

        const pitch = document.createElement('div');
        pitch.className = 'ndns-affiliate-pitch';
        pitch.innerHTML = `
            <p>To get the most out of this extension, you'll want to sign in and use an API key for full automation.</p>
            <p>NextDNS Pro is just $1.99/month and gives you network-wide DNS blocking.</p>
            <p>Support the project by signing up through my affiliate link:<br><a href="https://nextdns.io/?from=6mrqtjw2" target="_blank">https://nextdns.io/?from=6mrqtjw2</a></p>
        `;

        const closeBtn = document.createElement('span');
        closeBtn.className = 'ndns-spotlight-close';
        closeBtn.textContent = '\u00d7';
        closeBtn.onclick = () => {
            overlay.remove();
            pitch.remove();
            closeBtn.remove();
            loginForm.classList.remove('ndns-login-focus');
        };

        document.body.appendChild(overlay);
        document.body.appendChild(pitch);
        document.body.appendChild(closeBtn);
        loginForm.classList.add('ndns-login-focus');
    }

    function handleAccountPage() {
        if (document.getElementById('ndns-api-helper')) return;

        const dimOverlay = document.createElement('div');
        dimOverlay.className = 'ndns-dim-overlay';
        document.body.appendChild(dimOverlay);

        const helper = document.createElement('div');
        helper.id = 'ndns-api-helper';
        helper.className = 'ndns-api-helper';
        document.body.prepend(helper);

        const updateHelperUI = () => {
            const apiKeyDiv = document.querySelector('div.font-monospace');
            const generateButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Generate API key'));
            const proPlanCard = Array.from(document.querySelectorAll('.card-title')).find(el => el.textContent.includes('Pro'))?.closest('.row');

            helper.innerHTML = '';
            const message = document.createElement('p');
            const actionButton = document.createElement('button');
            helper.appendChild(message);
            helper.appendChild(actionButton);
            actionButton.style.display = 'block';

            if (apiKeyDiv && apiKeyDiv.textContent.trim()) {
                message.textContent = '✅ API Key found!';
                actionButton.textContent = 'Capture Key & Return to Logs';
                actionButton.className = 'save-key-btn';
                actionButton.onclick = async () => {
                    const apiKey = apiKeyDiv.textContent.trim();
                    navigator.clipboard.writeText(apiKey);
                    await storage.set({
                        'ndns_api_key_to_transfer': apiKey,
                        'ndns_return_from_account': true
                    });
                    const redirectUrl = globalProfileId ? `https://my.nextdns.io/${globalProfileId}/logs` : 'https://my.nextdns.io/';
                    showToast('API Key captured! Returning...', false, 2000);
                    setTimeout(() => { window.location.href = redirectUrl; }, 800);
                };
            } else if (generateButton) {
                message.textContent = '❗️ Your API Key isn\'t generated yet.';
                actionButton.textContent = 'Generate API Key';
                actionButton.className = 'generate-key-btn';
                actionButton.onclick = () => {
                    generateButton.click();
                    showToast('Generating key... Page will reload.', false, 2000);
                    setTimeout(() => location.reload(), 1000);
                };
            } else if (proPlanCard) {
                helper.style.transition = 'opacity 0.5s';
                helper.style.opacity = '0.5';
                helper.style.pointerEvents = 'none';
                message.textContent = '';
                message.append(
                    createSafeElement('b', { text: "Couldn't create an API key." }),
                    document.createElement('br'),
                    'You\'ll need to upgrade to ',
                    createSafeElement('b', { text: 'NextDNS Pro' }),
                    ' to use this feature.'
                );
                actionButton.textContent = 'Upgrade to Pro';
                actionButton.className = 'save-key-btn';
                actionButton.onclick = () => window.open('https://nextdns.io/?from=6mrqtjw2', '_blank');
                proPlanCard.style.boxShadow = '0 0 0 3px var(--info-color)';
                proPlanCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                message.textContent = 'Please create an account or login to access your API key.';
                actionButton.style.display = 'none';
            }
        };

        helper.textContent = '';
        helper.appendChild(createSafeElement('p', { text: 'Looking for the API section...' }));
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        setTimeout(() => {
            updateHelperUI();
            const observer = new MutationObserver(() => updateHelperUI());
            const targetNode = Array.from(document.querySelectorAll('h5')).find(h => h.textContent === 'API Keys')?.closest('.card');
            if (targetNode) {
                observer.observe(targetNode, { childList: true, subtree: true });
            }
        }, 1500);
    }

    async function finalizeApiKeySetup() {
        try {
            const data = await storage.get(['ndns_api_key_to_transfer']);
            const apiKey = data.ndns_api_key_to_transfer;

            await storage.remove(['ndns_api_key_to_transfer', 'ndns_return_from_account']);

            if (!apiKey || !/^[a-f0-9]{60,}/i.test(apiKey)) {
                throw new Error("Failed to retrieve a valid API key.");
            }

            const profileId = getCurrentProfileId();
            if (!profileId) {
                throw new Error("Could not find Profile ID.");
            }

            await makeApiRequest('GET', `/profiles/${profileId}`, null, apiKey);

            const apiKeyInput = settingsModal.querySelector('.api-key-wrapper input');
            const apiKeySaveBtn = settingsModal.querySelector('#ndns-settings-save-api-key-btn');

            if (!apiKeyInput || !apiKeySaveBtn) {
                throw new Error("Could not find settings elements.");
            }

            apiKeyInput.value = apiKey.trim();
            showToast("API Key validated. Submitting automatically...", false, 2500);

            setTimeout(() => apiKeySaveBtn.click(), 2000);

        } catch (err) {
            showOnboardingModal({ manual: true });
        }
    }

    // --- THEMING ---
    function applyListPageTheme() {
        if (listPageThemeStyleElement) {
            listPageThemeStyleElement.remove();
            listPageThemeStyleElement = null;
        }

        if (!enableListPageTheme) return;

        const isAllowlistPage = window.location.href.includes('/allowlist');
        const isDenylistPage = window.location.href.includes('/denylist');

        if (!isAllowlistPage && !isDenylistPage) return;

        let cssRules = `
            div.mb-4.card { width: 1300px; margin-left: -50px; }
            div.text-end { margin-right: 11px; }
            div div button { margin-left: -5px; padding: 0; }
            div.ndns-inline-controls { margin-right: 5px; }
            div.log.list-group-item { padding-top: 0px; padding-bottom: 0px; }
            svg.svg-inline--fa.fa-xmark { padding-left: 17px; }
            div.pe-1.list-group-item { padding-top: 0px; padding-bottom: 0px; border-style: outset; border-bottom-width: 1px; border-top-width: 1px; }
            div div div { border-style: none; }
            .list-group.list-group-flush { border-style: none; }
            a.menu.nav-link.active { background-color: #209528; }
        `;

        if (isDenylistPage) {
            cssRules += `
                div.pe-1.list-group-item, .flex-grow-1.d-flex.gap-2.align-items-center, .d-flex.align-items-center,
                .form-control, .list-group.list-group-flush, button.notranslate, span.d-none.d-lg-inline, button.dropdown-toggle {
                    background-color: #260600 !important;
                    color: #f5d4d0 !important;
                }
                #root { background-color: #260600; border-style: none; color: #f5d4d0; }
                div.pe-1.list-group-item { border-color: #5b0f00; color: #f5d4d0 !important; }
                div.pe-1.list-group-item *, .list-group.list-group-flush * { color: #f5d4d0 !important; }
                .form-control { color: #f5d4d0 !important; }
                .form-control::placeholder { color: #c08680 !important; }
                div.mt-4 { background-color: #4d0e00; color: #f5d4d0 !important; }
                div.card-header, div.Header { background-color: #5b0f00; color: #f5d4d0 !important; }
                button svg path { color: #ed8181; }
            `;
        } else if (isAllowlistPage) {
            cssRules += `
                div.pe-1.list-group-item, .flex-grow-1.d-flex.gap-2.align-items-center, .d-flex.align-items-center,
                .form-control, .list-group.list-group-flush, button.notranslate, span.d-none.d-lg-inline, button.dropdown-toggle {
                    background-color: #0a2915 !important;
                    color: #d0eedd !important;
                }
                #root { background-color: #0a2915; border-style: none; color: #d0eedd; }
                div.pe-1.list-group-item { border-color: #134e27; color: #d0eedd !important; }
                div.pe-1.list-group-item *, .list-group.list-group-flush * { color: #d0eedd !important; }
                .form-control { color: #d0eedd !important; }
                .form-control::placeholder { color: #7fb997 !important; }
                div.mt-4 { background-color: #1b3b24; color: #d0eedd !important; }
                div.card-header, div.Header { background-color: #134e27; color: #d0eedd !important; }
                button svg path { color: #81ed9d; }
            `;
        }

        listPageThemeStyleElement = document.createElement('style');
        listPageThemeStyleElement.id = 'ndns-list-page-theme';
        listPageThemeStyleElement.textContent = cssRules;
        document.head.appendChild(listPageThemeStyleElement);
    }

    // --- AUTO SCROLL / PRELOAD ---
    async function autoScrollLog() {
        const preloadBtn = document.getElementById('preload-btn');
        if (!preloadBtn) return;

        isPreloadingCancelled = false;
        const originalOnClick = preloadBtn.onclick;

        preloadBtn.textContent = 'Stop Loading';
        preloadBtn.classList.add('danger-button');
        preloadBtn.onclick = () => { isPreloadingCancelled = true; };

        const originalFilters = { ...filters };
        const hadActiveFilters = Object.values(originalFilters).some(v => v === true);
        const originalScrollY = window.scrollY;

        try {
            if (hadActiveFilters) {
                showToast('Temporarily showing all logs to preload...', false, 2000);
                Object.keys(filters).forEach(k => { if (typeof filters[k] === 'boolean') filters[k] = false; });
                cleanLogs();
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            showToast('Loading all logs... (Click "Stop" to cancel)', false, 2000);

            let previousHeight = document.body.scrollHeight;
            let noNewDataCount = 0;
            const waitTime = 800;
            const maxRetries = 5;

            while (!isPreloadingCancelled) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                const newHeight = document.body.scrollHeight;

                if (newHeight === previousHeight) {
                    noNewDataCount++;
                    if (noNewDataCount >= maxRetries) {
                        showToast('Finished loading logs.', false, 3000);
                        break;
                    }
                    showToast(`Waiting for data... (${noNewDataCount}/${maxRetries})`, false, 900);
                } else {
                    noNewDataCount = 0;
                    previousHeight = newHeight;
                }
            }

            if (isPreloadingCancelled) {
                showToast('Preloading stopped.', true, 2000);
            }

        } catch (error) {
            console.error('Auto-scroll error:', error);
            showToast('Error during auto-scroll.', true);
        } finally {
            if (hadActiveFilters) {
                Object.assign(filters, originalFilters);
                cleanLogs();
                await storage.set({ [KEY_FILTER_STATE]: filters });
            }

            preloadBtn.textContent = 'Load All Logs';
            preloadBtn.classList.remove('danger-button');
            preloadBtn.onclick = originalOnClick;
            window.scrollTo({ top: originalScrollY, behavior: 'instant' });
        }
    }

    async function clearHiddenDomains() {
        hiddenDomains.clear();
        hiddenDomains.add('nextdns.io');
        await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
        showToast('Cleared hidden domains.');
        invalidateLogCache();
        cleanLogs();
        return true;
    }

    async function updateDomainAction(domain, type, level) {
        if (type === 'remove') {
            delete domainActions[domain];
        } else {
            domainActions[domain] = { type, level };
        }
        await storage.set({ [KEY_DOMAIN_ACTIONS]: domainActions });
    }

    function domainModeToListType(mode) {
        return mode === 'allow' || mode === 'allowlist' ? 'allowlist' : 'denylist';
    }

    function domainListTypeToMode(listType) {
        return listType === 'allowlist' || listType === 'allow' ? 'allow' : 'deny';
    }

    function formatDomainUndoEntry(entry) {
        if (!entry) return 'No domain actions';
        const modeLabel = domainModeToListType(entry.mode).replace('list', ' list');
        const actionLabel = entry.action === 'remove' ? 'Removed from' : 'Added to';
        const when = entry.at ? new Date(entry.at).toLocaleString() : 'Unknown time';
        return `${actionLabel} ${modeLabel}: ${entry.domain} (${when})`;
    }

    function updateDomainUndoButtonState(button = document.getElementById('ndns-domain-undo-btn')) {
        if (!button) return;
        const count = domainUndoStack.length;
        button.textContent = count ? `Undo Domain Action (${count})` : 'Undo Domain Action';
        button.disabled = count === 0;
        button.title = count ? formatDomainUndoEntry(domainUndoStack[0]) : 'No domain actions to undo';
    }

    async function saveDomainUndoStack() {
        domainUndoStack = domainUndoStack
            .filter(entry => entry && entry.domain && entry.mode && entry.action)
            .slice(0, 10);
        await storage.set({ [KEY_DOMAIN_UNDO_STACK]: domainUndoStack });
        updateDomainUndoButtonState();
    }

    async function pushDomainUndoAction(entry) {
        const domain = normalizeImportedDomain(entry.domain);
        if (!domain) return;
        const mode = domainListTypeToMode(entry.mode || entry.listType);
        domainUndoStack = [{
            action: entry.action === 'remove' ? 'remove' : 'add',
            domain,
            mode,
            at: new Date().toISOString()
        }, ...domainUndoStack].slice(0, 10);
        await saveDomainUndoStack();
    }

    async function performDomainUndo(entry) {
        if (!entry) throw new Error('No domain action to undo.');
        if (!NDNS_API_KEY) throw new Error('API Key not set.');
        const profileId = getCurrentProfileId();
        if (!profileId) throw new Error('Could not find Profile ID.');

        const domain = normalizeImportedDomain(entry.domain);
        if (!domain) throw new Error('Domain is empty.');
        const mode = domainListTypeToMode(entry.mode);
        const listType = domainModeToListType(mode);

        if (entry.action === 'remove') {
            await makeApiRequest('POST', `/profiles/${profileId}/${listType}`, { id: domain, active: true }, NDNS_API_KEY);
            hiddenDomains.add(domain);
            await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
            const level = domain === extractRootDomain(domain) ? 'root' : 'sub';
            await updateDomainAction(domain, mode, level);
            return `${domain} restored to ${listType}.`;
        }

        await makeApiRequest('DELETE', `/profiles/${profileId}/${listType}/${domain}`, null, NDNS_API_KEY);
        hiddenDomains.delete(domain);
        await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
        await updateDomainAction(domain, 'remove');
        return `${domain} removed from ${listType}.`;
    }

    async function undoLatestDomainAction(statusEl = null) {
        const entry = domainUndoStack[0];
        if (!entry) {
            showToast('No domain action to undo.', false, 1500);
            return;
        }

        if (statusEl) statusEl.textContent = `Undoing: ${formatDomainUndoEntry(entry)}`;
        const message = await performDomainUndo(entry);
        domainUndoStack.shift();
        await saveDomainUndoStack();
        invalidateLogCache();
        cleanLogs();
        if (/\/denylist|\/allowlist/.test(location.href)) sessionStorage.setItem('ndns_needs_refresh', 'true');
        showToast(message, false, 2500);
        if (statusEl) statusEl.textContent = message;
    }

    async function sendDomainViaApi(domain, mode = 'deny') {
        if (!NDNS_API_KEY) {
            showToast('API Key not set.', true);
            return;
        }
        const pid = getCurrentProfileId();
        if (!pid) {
            showToast('Could not find NextDNS profile ID.', true);
            return;
        }
        const domainToSend = domain.replace(/^\*\./, '');
        const endpoint = mode === 'deny' ? 'denylist' : 'allowlist';
        const apiUrl = `/profiles/${pid}/${endpoint}`;
        try {
            await addDomainToList(domainToSend, mode, pid);
            showToast(`${domain} added to ${endpoint} and hidden!`);
            invalidateLogCache();
            cleanLogs();
        } catch (error) {
            showToast(`API Error: ${error.message || 'Unknown'}`, true);
        }
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

    async function addDomainToList(domain, mode = 'deny', profileId = getCurrentProfileId(), options = {}) {
        if (!NDNS_API_KEY) throw new Error('API Key not set.');
        if (!profileId) throw new Error('Could not find Profile ID.');
        const domainToSend = normalizeImportedDomain(domain);
        if (!domainToSend) throw new Error('Domain is empty.');
        const endpoint = mode === 'deny' ? 'denylist' : 'allowlist';
        await makeApiRequest('POST', `/profiles/${profileId}/${endpoint}`, { id: domainToSend, active: true }, NDNS_API_KEY);
        hiddenDomains.add(domainToSend);
        await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
        const level = domainToSend === extractRootDomain(domainToSend) ? 'root' : 'sub';
        await updateDomainAction(domainToSend, mode, level);
        if (options.trackUndo !== false) await pushDomainUndoAction({ action: 'add', domain: domainToSend, mode });
        return domainToSend;
    }

    function showDomainUndoHistory() {
        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();

        const title = document.createElement('h3');
        title.textContent = 'Domain Undo Stack';

        const help = document.createElement('p');
        help.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;';
        help.textContent = 'Latest 10 allow/deny actions. Undo applies the newest entry first.';

        const historyList = document.createElement('div');
        historyList.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:240px;overflow:auto;margin:8px 0;';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);min-height:18px;';

        const buttonRow = document.createElement('div');
        buttonRow.className = 'modal-actions';

        const undoBtn = document.createElement('button');
        undoBtn.className = 'ndns-panel-button';
        undoBtn.textContent = 'Undo Latest';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ndns-panel-button danger';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => overlay.remove();

        const renderHistory = () => {
            historyList.textContent = '';
            undoBtn.disabled = domainUndoStack.length === 0;
            if (domainUndoStack.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);padding:8px;border:1px solid var(--panel-border);border-radius:8px;';
                empty.textContent = 'No stored domain actions.';
                historyList.appendChild(empty);
                statusEl.textContent = 'Idle';
                updateDomainUndoButtonState();
                return;
            }

            domainUndoStack.forEach((entry, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'font-size:12px;padding:8px;border:1px solid var(--panel-border);border-radius:8px;background:var(--section-bg);';
                row.textContent = `${index + 1}. ${formatDomainUndoEntry(entry)}`;
                historyList.appendChild(row);
            });
            statusEl.textContent = `${domainUndoStack.length}/10 actions stored.`;
            updateDomainUndoButtonState();
        };

        undoBtn.onclick = async () => {
            undoBtn.disabled = true;
            try {
                await undoLatestDomainAction(statusEl);
                renderHistory();
            } catch (error) {
                statusEl.textContent = `Undo failed: ${error.message || 'Unknown error'}`;
                showToast(statusEl.textContent, true, 5000);
            } finally {
                undoBtn.disabled = domainUndoStack.length === 0;
            }
        };

        buttonRow.append(undoBtn, closeBtn);
        modal.append(title, help, historyList, statusEl, buttonRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        renderHistory();
    }

    function showBulkDomainImport() {
        if (!NDNS_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = '<h3>Bulk Import Domains</h3><p style="font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;">Paste one domain per line and choose the target list.</p>';

        const listSelect = document.createElement('select');
        listSelect.className = 'ndns-input';
        listSelect.innerHTML = '<option value="deny">Denylist</option><option value="allow">Allowlist</option>';

        const textarea = document.createElement('textarea');
        textarea.className = 'ndns-input';
        textarea.placeholder = 'ads.example.com\ntracker.example.net\nallowed.example.org';
        textarea.style.cssText = 'min-height:160px;resize:vertical;margin-top:8px;font-family:monospace;';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size: 12px; color: var(--panel-text-secondary); margin-top: 8px;';
        statusEl.textContent = 'Idle';

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';

        const importBtn = document.createElement('button');
        importBtn.className = 'ndns-panel-button';
        importBtn.textContent = 'Import';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ndns-panel-button danger';
        cancelBtn.textContent = 'Close';
        cancelBtn.onclick = () => overlay.remove();

        importBtn.onclick = async () => {
            const mode = listSelect.value;
            const domains = parseImportedDomains(textarea.value);
            if (domains.length === 0) {
                statusEl.textContent = 'No valid domains found.';
                showToast('No valid domains found.', true);
                return;
            }

            importBtn.disabled = true;
            listSelect.disabled = true;
            textarea.disabled = true;
            let added = 0;
            const failures = [];

            for (let i = 0; i < domains.length; i++) {
                const domain = domains[i];
                statusEl.textContent = `Importing ${i + 1}/${domains.length}: ${domain}`;
                try {
                    await addDomainToList(domain, mode, pid);
                    added++;
                } catch (error) {
                    failures.push(`${domain}: ${error.message || 'Unknown error'}`);
                }
                await sleep(120);
            }

            invalidateLogCache();
            cleanLogs();
            statusEl.textContent = failures.length
                ? `Imported ${added}/${domains.length}. Failed: ${failures.slice(0, 3).join('; ')}`
                : `Imported ${added}/${domains.length}.`;
            showToast(`Imported ${added} domains to ${mode === 'deny' ? 'denylist' : 'allowlist'}${failures.length ? ` (${failures.length} failed)` : ''}.`, failures.length > 0);
            importBtn.disabled = false;
            listSelect.disabled = false;
            textarea.disabled = false;
        };

        buttonRow.append(importBtn, cancelBtn);
        modal.append(listSelect, textarea, statusEl, buttonRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        textarea.focus();
    }

    function showLocalBlocklistImport() {
        if (!NDNS_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();

        const title = document.createElement('h3');
        title.textContent = 'Import Local Blocklist';

        const help = document.createElement('p');
        help.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;';
        help.textContent = 'Paste hosts-file rows, AdBlock ||domain^ rules, URLs, or plain domains. Exceptions and regex rules are skipped.';

        const textarea = document.createElement('textarea');
        textarea.className = 'ndns-input';
        textarea.placeholder = '0.0.0.0 ads.example.com\n||tracker.example.net^\nhttps://bad.example.org/path';
        textarea.style.cssText = 'min-height:180px;resize:vertical;font-family:monospace;';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin-top:8px;';
        statusEl.textContent = 'Idle';

        const buttonRow = document.createElement('div');
        buttonRow.className = 'modal-actions';

        const importBtn = document.createElement('button');
        importBtn.className = 'ndns-panel-button';
        importBtn.textContent = 'Import to Denylist';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ndns-panel-button danger';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => overlay.remove();

        importBtn.onclick = async () => {
            const domains = parseLocalBlocklistDomains(textarea.value);
            if (domains.length === 0) {
                statusEl.textContent = 'No valid blocklist domains found.';
                showToast(statusEl.textContent, true);
                return;
            }

            importBtn.disabled = true;
            textarea.disabled = true;
            let added = 0;
            const failures = [];

            for (let i = 0; i < domains.length; i++) {
                const domain = domains[i];
                statusEl.textContent = `Importing ${i + 1}/${domains.length}: ${domain}`;
                try {
                    await addDomainToList(domain, 'deny', pid);
                    added++;
                } catch (error) {
                    failures.push(`${domain}: ${error.message || 'Unknown error'}`);
                }
                await sleep(120);
            }

            invalidateLogCache();
            cleanLogs();
            statusEl.textContent = failures.length
                ? `Imported ${added}/${domains.length}. Failed: ${failures.slice(0, 3).join('; ')}`
                : `Imported ${added}/${domains.length}.`;
            showToast(`Imported ${added} blocklist domains${failures.length ? ` (${failures.length} failed)` : ''}.`, failures.length > 0);
            importBtn.disabled = false;
            textarea.disabled = false;
        };

        buttonRow.append(importBtn, closeBtn);
        modal.append(title, help, textarea, statusEl, buttonRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        textarea.focus();
    }

    function escapeRegexLiteral(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function collectRecentLogDomains(limit = 250) {
        const domains = new Set();
        document.querySelectorAll('.list-group-item.log, .Logs .list-group .list-group-item').forEach((row) => {
            const raw = row.dataset?.ndnsDomain || row.querySelector('.notranslate')?.textContent || '';
            const domain = normalizeImportedDomain(raw);
            if (domain) domains.add(domain);
        });
        return Array.from(domains).slice(0, limit);
    }

    function getLocalDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function chooseRandomDomain(domains, avoidDomain = '') {
        const candidates = domains.filter(domain => domain !== avoidDomain);
        const pool = candidates.length ? candidates : domains;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    async function pickDomainOfDay(forceNew = false) {
        const recentDomains = collectRecentLogDomains(500)
            .filter(domain => domain && !hiddenDomains.has(domain));
        if (recentDomains.length === 0) {
            showToast('No loaded log domains found to review.', true);
            return null;
        }

        const today = getLocalDateKey();
        const storedDomain = normalizeImportedDomain(domainOfDayState.domain || '');
        const domain = (!forceNew && domainOfDayState.date === today && recentDomains.includes(storedDomain))
            ? storedDomain
            : chooseRandomDomain(recentDomains, storedDomain);

        if (!domain) return null;
        domainOfDayState = {
            date: today,
            domain,
            poolSize: recentDomains.length,
            pickedAt: new Date().toISOString()
        };
        await storage.set({ [KEY_DOMAIN_OF_DAY]: domainOfDayState });
        return { domain, date: today, poolSize: recentDomains.length };
    }

    async function showDomainOfDay(forceNew = false) {
        const pick = await pickDomainOfDay(forceNew);
        if (!pick) return;

        const pid = getCurrentProfileId();
        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();

        const title = document.createElement('h3');
        title.textContent = 'Domain of the Day';

        const help = document.createElement('p');
        help.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;';
        help.textContent = `${pick.date} pick from ${pick.poolSize} loaded query domains.`;

        const domainBox = document.createElement('div');
        domainBox.style.cssText = 'font-family:monospace;font-size:15px;font-weight:700;padding:10px;border:1px solid var(--panel-border);border-radius:8px;background:var(--section-bg);word-break:break-all;';
        domainBox.textContent = pick.domain;

        const rootDomain = extractRootDomain(pick.domain);
        const rootBox = document.createElement('div');
        rootBox.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin-top:6px;';
        rootBox.textContent = rootDomain === pick.domain ? 'Root domain selected.' : `Root domain: ${rootDomain}`;

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);min-height:18px;margin-top:10px;';
        statusEl.textContent = 'Ready for review.';

        const actionGrid = document.createElement('div');
        actionGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;';

        const addActionButton = (label, mode, domain) => {
            const button = document.createElement('button');
            button.className = 'ndns-panel-button';
            button.textContent = label;
            button.onclick = async () => {
                if (!NDNS_API_KEY) return showToast('API Key not set.', true);
                if (!pid) return showToast('Could not find Profile ID.', true);
                button.disabled = true;
                statusEl.textContent = `Adding ${domain} to ${mode === 'deny' ? 'denylist' : 'allowlist'}...`;
                try {
                    await addDomainToList(domain, mode, pid);
                    invalidateLogCache();
                    cleanLogs();
                    statusEl.textContent = `${domain} added to ${mode === 'deny' ? 'denylist' : 'allowlist'}.`;
                    showToast(statusEl.textContent, false, 2500);
                } catch (error) {
                    statusEl.textContent = `Action failed: ${error.message || 'Unknown error'}`;
                    showToast(statusEl.textContent, true, 5000);
                } finally {
                    button.disabled = false;
                }
            };
            actionGrid.appendChild(button);
        };

        addActionButton('Block Domain', 'deny', pick.domain);
        addActionButton('Allow Domain', 'allow', pick.domain);
        addActionButton('Block Root', 'deny', rootDomain);
        addActionButton('Allow Root', 'allow', rootDomain);

        const utilityRow = document.createElement('div');
        utilityRow.className = 'modal-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ndns-panel-button';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => copyToClipboard(pick.domain);

        const searchBtn = document.createElement('button');
        searchBtn.className = 'ndns-panel-button';
        searchBtn.textContent = 'Search';
        searchBtn.onclick = () => window.open(`https://www.google.com/search?q=${encodeURIComponent(pick.domain)}`, '_blank');

        const nextBtn = document.createElement('button');
        nextBtn.className = 'ndns-panel-button';
        nextBtn.textContent = 'Pick Another';
        nextBtn.onclick = () => {
            overlay.remove();
            showDomainOfDay(true);
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ndns-panel-button danger';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => overlay.remove();

        utilityRow.append(copyBtn, searchBtn, nextBtn, closeBtn);
        modal.append(title, help, domainBox, rootBox, actionGrid, statusEl, utilityRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function buildDomainMatcher(mode, pattern) {
        const normalized = normalizeImportedDomain(pattern);
        if (mode === 'regex') return new RegExp(pattern, 'i');
        if (!normalized) return null;
        if (mode === 'wildcard') {
            const root = extractRootDomain(normalized);
            return new RegExp(`(^|\\.)${escapeRegexLiteral(root)}$`, 'i');
        }
        return new RegExp(`^${escapeRegexLiteral(normalized)}$`, 'i');
    }

    function showWildcardBuilder() {
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = '<h3>Wildcard Builder</h3><p style="font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;">Build exact, wildcard-root, or regex matches from recently loaded log domains.</p>';

        const modeSelect = document.createElement('select');
        modeSelect.className = 'ndns-input';
        modeSelect.innerHTML = '<option value="wildcard">Wildcard root (*.example.com)</option><option value="exact">Exact domain</option><option value="regex">Regex</option>';

        const targetSelect = document.createElement('select');
        targetSelect.className = 'ndns-input';
        targetSelect.innerHTML = '<option value="deny">Add matches to denylist</option><option value="allow">Add matches to allowlist</option>';
        targetSelect.style.marginTop = '8px';

        const patternInput = document.createElement('input');
        patternInput.className = 'ndns-input';
        patternInput.placeholder = 'example.com or ^.*\\.example\\.com$';
        patternInput.style.marginTop = '8px';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size: 12px; color: var(--panel-text-secondary); margin-top: 8px;';

        const preview = document.createElement('div');
        preview.style.cssText = 'max-height:180px;overflow:auto;margin-top:8px;border:1px solid var(--panel-border);border-radius:8px;padding:8px;font-size:11px;font-family:monospace;';

        const recentDomains = collectRecentLogDomains();
        let currentMatches = [];

        const renderPreview = () => {
            preview.innerHTML = '';
            currentMatches = [];
            let matcher = null;
            try {
                matcher = buildDomainMatcher(modeSelect.value, patternInput.value);
            } catch (error) {
                statusEl.textContent = `Invalid regex: ${error.message}`;
                return;
            }
            if (!matcher) {
                statusEl.textContent = recentDomains.length ? 'Enter a domain or regex.' : 'No recent log domains found on this page.';
                return;
            }

            currentMatches = recentDomains.filter(domain => matcher.test(domain));
            const addDomains = getWildcardBuilderAddDomains(currentMatches, modeSelect.value);
            statusEl.textContent = `${currentMatches.length}/${recentDomains.length} recent domains matched; ${addDomains.length} unique entries will be added.`;
            if (currentMatches.length === 0) {
                preview.innerHTML = '<div style="color:var(--panel-text-secondary);">No matches.</div>';
                return;
            }
            currentMatches.slice(0, 80).forEach((domain) => {
                const item = document.createElement('div');
                item.textContent = domain;
                preview.appendChild(item);
            });
        };

        modeSelect.onchange = renderPreview;
        patternInput.oninput = renderPreview;

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';

        const addBtn = document.createElement('button');
        addBtn.className = 'ndns-panel-button';
        addBtn.textContent = 'Add Matches';
        addBtn.onclick = async () => {
            const domainsToAdd = getWildcardBuilderAddDomains(currentMatches, modeSelect.value);
            if (domainsToAdd.length === 0) return showToast('No matched domains to add.', true);
            addBtn.disabled = true;
            let added = 0;
            const failures = [];
            for (let i = 0; i < domainsToAdd.length; i++) {
                const domain = domainsToAdd[i];
                statusEl.textContent = `Adding ${i + 1}/${domainsToAdd.length}: ${domain}`;
                try {
                    await addDomainToList(domain, targetSelect.value, pid);
                    added++;
                } catch (error) {
                    failures.push(`${domain}: ${error.message || 'Unknown error'}`);
                }
                await sleep(120);
            }
            invalidateLogCache();
            cleanLogs();
            statusEl.textContent = failures.length
                ? `Added ${added}/${domainsToAdd.length}. Failed: ${failures.slice(0, 3).join('; ')}`
                : `Added ${added}/${domainsToAdd.length}.`;
            showToast(`Added ${added} wildcard-builder entries${failures.length ? ` (${failures.length} failed)` : ''}.`, failures.length > 0);
            addBtn.disabled = false;
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ndns-panel-button danger';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => overlay.remove();

        buttonRow.append(addBtn, closeBtn);
        modal.append(modeSelect, targetSelect, patternInput, statusEl, preview, buttonRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        renderPreview();
        patternInput.focus();
    }

    function getWildcardBuilderAddDomains(matches, mode) {
        const domains = mode === 'wildcard'
            ? matches.map(domain => extractRootDomain(domain))
            : matches;
        return Array.from(new Set(domains.map(normalizeImportedDomain).filter(Boolean)));
    }

    async function fetchAllowDenyConflicts(profileId) {
        const [allowResponse, denyResponse] = await Promise.all([
            makeApiRequest('GET', `/profiles/${profileId}/allowlist`, null, NDNS_API_KEY),
            makeApiRequest('GET', `/profiles/${profileId}/denylist`, null, NDNS_API_KEY)
        ]);
        const allowSet = new Set((allowResponse.data || []).map(item => normalizeImportedDomain(item.id)).filter(Boolean));
        const denySet = new Set((denyResponse.data || []).map(item => normalizeImportedDomain(item.id)).filter(Boolean));
        return [...allowSet].filter(domain => denySet.has(domain)).sort((a, b) => a.localeCompare(b));
    }

    function showConflictResolver() {
        if (!NDNS_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.style.maxWidth = '760px';
        modal.onclick = (e) => e.stopPropagation();

        const title = document.createElement('h3');
        title.textContent = 'Allow/Deny Conflicts';

        const help = document.createElement('p');
        help.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;';
        help.textContent = 'Domains found in both lists are ambiguous. Keep one side to remove the other list entry.';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);min-height:18px;margin-bottom:8px;';
        statusEl.textContent = 'Loading conflicts...';

        const listEl = document.createElement('div');
        listEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:340px;overflow:auto;';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ndns-panel-button danger';
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '12px';
        closeBtn.onclick = () => overlay.remove();

        const resolveConflict = async (domain, keepMode, button) => {
            const listToRemove = keepMode === 'allow' ? 'denylist' : 'allowlist';
            button.disabled = true;
            statusEl.textContent = `Resolving ${domain} by removing it from ${listToRemove}...`;
            try {
                await makeApiRequest('DELETE', `/profiles/${pid}/${listToRemove}/${domain}`, null, NDNS_API_KEY);
                const level = domain === extractRootDomain(domain) ? 'root' : 'sub';
                await updateDomainAction(domain, keepMode, level);
                showToast(`${domain}: kept ${keepMode === 'allow' ? 'allowlist' : 'denylist'}.`, false, 2500);
                await renderConflicts();
            } catch (error) {
                statusEl.textContent = `Resolve failed: ${error.message || 'Unknown error'}`;
                showToast(statusEl.textContent, true, 5000);
                button.disabled = false;
            }
        };

        const renderConflicts = async () => {
            listEl.textContent = '';
            statusEl.textContent = 'Scanning allowlist and denylist...';
            try {
                const conflicts = await fetchAllowDenyConflicts(pid);
                statusEl.textContent = conflicts.length
                    ? `${conflicts.length} conflicts found.`
                    : 'No allow/deny conflicts found.';

                if (conflicts.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'font-size:12px;color:var(--panel-text-secondary);padding:8px;border:1px solid var(--panel-border);border-radius:8px;';
                    empty.textContent = 'Allowlist and denylist are consistent.';
                    listEl.appendChild(empty);
                    return;
                }

                conflicts.forEach((domain) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px;border:1px solid var(--panel-border);border-radius:8px;background:var(--section-bg);';

                    const label = document.createElement('div');
                    label.style.cssText = 'font-family:monospace;font-size:12px;word-break:break-all;';
                    label.textContent = domain;

                    const keepAllowBtn = document.createElement('button');
                    keepAllowBtn.className = 'ndns-panel-button ndns-btn-sm';
                    keepAllowBtn.textContent = 'Keep Allow';
                    keepAllowBtn.onclick = () => resolveConflict(domain, 'allow', keepAllowBtn);

                    const keepDenyBtn = document.createElement('button');
                    keepDenyBtn.className = 'ndns-panel-button ndns-btn-sm danger';
                    keepDenyBtn.textContent = 'Keep Deny';
                    keepDenyBtn.onclick = () => resolveConflict(domain, 'deny', keepDenyBtn);

                    row.append(label, keepAllowBtn, keepDenyBtn);
                    listEl.appendChild(row);
                });
            } catch (error) {
                statusEl.textContent = `Conflict scan failed: ${error.message || 'Unknown error'}`;
                showToast(statusEl.textContent, true, 5000);
            }
        };

        modal.append(title, help, statusEl, listEl, closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        renderConflicts();
    }

    async function removeDomainViaApi(domain, listType) {
        if (!NDNS_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const domainToRemove = normalizeImportedDomain(domain);
        if (!domainToRemove) return showToast('Domain is empty.', true);
        const endpoint = `/profiles/${pid}/${listType}/${domainToRemove}`;
        try {
            await makeApiRequest('DELETE', endpoint, null, NDNS_API_KEY);
            await updateDomainAction(domainToRemove, 'remove');
            await pushDomainUndoAction({ action: 'remove', domain: domainToRemove, mode: domainListTypeToMode(listType) });
            showToast(`${domainToRemove} removed from ${listType}.`);
            invalidateLogCache();
            cleanLogs();
            if (/\/denylist|\/allowlist/.test(location.href)) {
                document.querySelectorAll(".list-group-item").forEach(item => {
                    const domainEl = item.querySelector('.notranslate');
                    const itemDomain = normalizeImportedDomain(domainEl?.dataset?.ndnsDomain || domainEl?.textContent || '');
                    if (itemDomain === domainToRemove) {
                        item.style.transition = 'opacity 0.3s';
                        item.style.opacity = '0';
                        setTimeout(() => item.remove(), 300);
                    }
                });
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    }

    // --- BULK DELETE FUNCTIONALITY ---
    let bulkDeleteActive = false;
    const BULK_DELETE_BATCH_SIZE = 30;
    const BULK_DELETE_COOLDOWN_MS = 10000;
    const BULK_DELETE_CLICK_DELAY_MS = 300;
    const BULK_DELETE_STORAGE_KEY = 'ndns_bulk_deleter_next_run';

    function updateBulkDeleteStatus(text) {
        const statusEl = document.getElementById('bulk-delete-status');
        if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.querySelector('.ndns-stats-value').textContent = text;
        }
    }

    function stopBulkDelete() {
        bulkDeleteActive = false;
        localStorage.removeItem(BULK_DELETE_STORAGE_KEY);

        const bulkBtn = document.getElementById('bulk-delete-btn');
        const stopBtn = document.getElementById('stop-bulk-delete-btn');
        const statusEl = document.getElementById('bulk-delete-status');

        if (bulkBtn) bulkBtn.style.display = '';
        if (stopBtn) stopBtn.style.display = 'none';
        if (statusEl) statusEl.style.display = 'none';

        showToast('Bulk delete stopped.');
    }

    async function runBulkDeleteBatch() {
        updateBulkDeleteStatus('Scanning for entries...');

        // Find all delete buttons (buttons containing the X icon)
        const deleteIcons = Array.from(document.querySelectorAll('svg.fa-xmark, .remove-list-item-btn svg'));
        const buttons = deleteIcons.map(icon => icon.closest('button')).filter(btn => btn !== null);

        if (buttons.length === 0) {
            updateBulkDeleteStatus('No entries found. Done!');
            localStorage.removeItem(BULK_DELETE_STORAGE_KEY);
            bulkDeleteActive = false;

            const bulkBtn = document.getElementById('bulk-delete-btn');
            const stopBtn = document.getElementById('stop-bulk-delete-btn');
            if (bulkBtn) bulkBtn.style.display = '';
            if (stopBtn) stopBtn.style.display = 'none';

            showToast('Bulk delete complete! No more entries.');
            return;
        }

        const buttonsToClick = buttons.slice(0, BULK_DELETE_BATCH_SIZE);
        updateBulkDeleteStatus(`Found ${buttons.length}. Deleting ${buttonsToClick.length}...`);

        for (let i = 0; i < buttonsToClick.length; i++) {
            if (!bulkDeleteActive) {
                updateBulkDeleteStatus('Stopped by user.');
                return;
            }
            updateBulkDeleteStatus(`Deleting ${i + 1}/${buttonsToClick.length}...`);
            buttonsToClick[i].click();
            await new Promise(r => setTimeout(r, BULK_DELETE_CLICK_DELAY_MS));
        }

        updateBulkDeleteStatus('Batch done. Cooldown...');

        // Set the timer for the next run
        localStorage.setItem(BULK_DELETE_STORAGE_KEY, Date.now() + BULK_DELETE_COOLDOWN_MS);

        // Wait a moment for requests to fire, then reload
        setTimeout(() => {
            if (bulkDeleteActive) {
                window.location.reload();
            }
        }, 2000);
    }

    function startBulkDelete() {
        bulkDeleteActive = true;

        const bulkBtn = document.getElementById('bulk-delete-btn');
        const stopBtn = document.getElementById('stop-bulk-delete-btn');

        if (bulkBtn) bulkBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = '';

        // Check if we're in a cooldown period
        const nextRun = localStorage.getItem(BULK_DELETE_STORAGE_KEY);
        const now = Date.now();

        if (nextRun && now < parseInt(nextRun)) {
            // We are in the cooling period - start countdown
            const countdownInterval = setInterval(() => {
                if (!bulkDeleteActive) {
                    clearInterval(countdownInterval);
                    return;
                }

                const remaining = parseInt(nextRun) - Date.now();
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    runBulkDeleteBatch();
                } else {
                    const secondsLeft = Math.ceil(remaining / 1000);
                    updateBulkDeleteStatus(`Cooldown: ${secondsLeft}s...`);
                }
            }, 1000);
        } else {
            // No wait needed, run after a short delay
            setTimeout(runBulkDeleteBatch, 500);
        }
    }

    // Auto-resume bulk delete if we were in the middle of it
    function checkBulkDeleteResume() {
        const nextRun = localStorage.getItem(BULK_DELETE_STORAGE_KEY);
        if (nextRun && /\/denylist|\/allowlist/.test(location.href)) {
            // Resume bulk delete after page load
            setTimeout(() => {
                const bulkBtn = document.getElementById('bulk-delete-btn');
                if (bulkBtn) {
                    showToast('Resuming bulk delete...', false, 2000);
                    startBulkDelete();
                }
            }, 2000);
        }
    }

    async function createRowButtons(row, domain) {
        if (row.querySelector('.ndns-inline-controls')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'ndns-inline-controls';

        const createBtn = (icon, title, action, className = '') => {
            const b = document.createElement('button');
            b.innerHTML = icon;
            b.title = title;
            b.className = className;
            b.onclick = action;
            return b;
        };

        const createDivider = () => {
            const d = document.createElement('span');
            d.className = 'divider';
            return d;
        };

        const onHide = async (domToHide) => {
            hiddenDomains.add(domToHide);
            await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
            cleanLogs();
            showToast(`Hidden: ${domToHide}`);
        };

        const rootDomain = extractRootDomain(domain);

        const buttons = [
            createBtn('🚫', 'Block Full Domain', () => sendDomainViaApi(domain, 'deny')),
            createBtn('⛔', 'Block Root Domain', () => sendDomainViaApi(rootDomain, 'deny')),
            createDivider(),
            createBtn('✅', 'Allow Full Domain', () => sendDomainViaApi(domain, 'allow')),
            createBtn('🟢', 'Allow Root Domain', () => sendDomainViaApi(rootDomain, 'allow')),
            createDivider(),
            createBtn('👁️', 'Hide Full', () => onHide(domain)),
            createBtn('🙈', 'Hide Root', () => onHide(rootDomain)),
            createDivider(),
            createBtn('DNS', 'Replay DNS Query', () => showDnsReplayModal(domain)),
            createBtn('📋', 'Copy Domain', () => copyToClipboard(domain)),
            createBtn('🔍', 'Google', () => window.open(`https://www.google.com/search?q=${encodeURIComponent(domain)}`, '_blank')),
            createBtn('🕵️', 'Who.is', () => window.open(`https://www.who.is/whois/${encodeURIComponent(rootDomain)}`, '_blank'))
        ];

        buttons.forEach(btn => wrapper.appendChild(btn));
        const targetEl = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break');
        if (targetEl) targetEl.appendChild(wrapper);
    }

    function getLogOriginFilterSessionKey() {
        return `${KEY_PREFIX}log_origin_filter_${getCurrentProfileId() || 'profile'}`;
    }

    function normalizeLogOriginFilterValue(value) {
        return String(value || '')
            .split(/[,;\s]+/)
            .map(token => normalizeImportedDomain(token))
            .filter(Boolean)
            .filter((token, index, tokens) => tokens.indexOf(token) === index)
            .join(', ');
    }

    function getLogOriginFilterTokens(value = logOriginFilter) {
        return normalizeLogOriginFilterValue(value).split(', ').filter(Boolean);
    }

    function loadLogOriginFilter() {
        try {
            logOriginFilter = normalizeLogOriginFilterValue(sessionStorage.getItem(getLogOriginFilterSessionKey()) || '');
        } catch {
            logOriginFilter = '';
        }
    }

    function isLogDomainInOriginFilter(domain, tokens = getLogOriginFilterTokens()) {
        if (tokens.length === 0) return true;
        const normalizedDomain = normalizeImportedDomain(domain);
        if (!normalizedDomain) return false;
        const rootDomain = extractRootDomain(normalizedDomain);
        return tokens.some((token) => (
            normalizedDomain === token ||
            normalizedDomain.endsWith(`.${token}`) ||
            rootDomain === token ||
            (!token.includes('.') && normalizedDomain.includes(token))
        ));
    }

    function updateLogOriginFilterControls() {
        const filterSection = document.getElementById('ndns-log-origin-filter');
        const input = document.getElementById('ndns-log-origin-filter-input');
        const status = document.getElementById('ndns-log-origin-filter-status');
        const clearBtn = document.getElementById('ndns-log-origin-filter-clear');
        const tokens = getLogOriginFilterTokens();

        if (filterSection) filterSection.classList.toggle('active', tokens.length > 0);
        if (input && document.activeElement !== input) input.value = logOriginFilter;
        if (clearBtn) clearBtn.disabled = tokens.length === 0;
        if (status) {
            status.textContent = tokens.length
                ? `Tab-local origin filter: ${tokens.join(', ')}. Matching exact domains, subdomains, and root domains.`
                : 'Tab-local origin filter off.';
        }
    }

    function setLogOriginFilter(value) {
        logOriginFilter = normalizeLogOriginFilterValue(value);
        try {
            if (logOriginFilter) sessionStorage.setItem(getLogOriginFilterSessionKey(), logOriginFilter);
            else sessionStorage.removeItem(getLogOriginFilterSessionKey());
        } catch {}
        updateLogOriginFilterControls();
        cleanLogs();
        showToast(logOriginFilter ? `Origin filter applied: ${logOriginFilter}` : 'Origin filter cleared.', false, 2200);
    }

    function buildLogOriginFilterControls() {
        const wrap = createSafeElement('div', {
            id: 'ndns-log-origin-filter',
            className: 'ndns-section ndns-log-origin-filter'
        });
        const label = createSafeElement('label', {
            text: 'Tab Origin Filter',
            attrs: { for: 'ndns-log-origin-filter-input' }
        });
        const input = createSafeElement('input', {
            id: 'ndns-log-origin-filter-input',
            attrs: {
                type: 'text',
                placeholder: 'example.com, ads.example.net',
                autocomplete: 'off',
                spellcheck: 'false',
                'aria-label': 'Tab-local origin or domain filter'
            }
        });
        input.value = logOriginFilter;

        const actions = createSafeElement('div', { className: 'ndns-log-origin-actions' });
        const applyBtn = createSafeElement('button', {
            id: 'ndns-log-origin-filter-apply',
            className: 'ndns-panel-button ndns-btn-sm',
            text: 'Apply',
            attrs: { type: 'button' }
        });
        const clearBtn = createSafeElement('button', {
            id: 'ndns-log-origin-filter-clear',
            className: 'ndns-panel-button ndns-btn-sm',
            text: uiText('clear'),
            attrs: { type: 'button' }
        });
        const status = createSafeElement('div', {
            id: 'ndns-log-origin-filter-status',
            className: 'ndns-log-origin-status'
        });
        const activeTokens = getLogOriginFilterTokens();
        clearBtn.disabled = activeTokens.length === 0;
        status.textContent = activeTokens.length
            ? `Tab-local origin filter: ${activeTokens.join(', ')}. Matching exact domains, subdomains, and root domains.`
            : 'Tab-local origin filter off.';

        applyBtn.onclick = () => setLogOriginFilter(input.value);
        clearBtn.onclick = () => {
            input.value = '';
            setLogOriginFilter('');
        };
        input.oninput = () => {
            if (status) status.textContent = 'Apply to filter loaded rows in this dashboard tab only.';
        };

        actions.append(applyBtn, clearBtn);
        wrap.append(label, input, actions, status);
        updateLogOriginFilterControls();
        return wrap;
    }

    function parseDnsJsonResponse(response) {
        if (response?.response && typeof response.response === 'object') return response.response;
        if (typeof response?.responseText === 'string' && response.responseText.trim()) {
            return JSON.parse(response.responseText);
        }
        return {};
    }

    async function replayDnsQuery(domain, type = 'A') {
        const profileId = getCurrentProfileId();
        const queryDomain = normalizeImportedDomain(domain);
        const queryType = DNS_REPLAY_TYPES.includes(String(type).toUpperCase()) ? String(type).toUpperCase() : 'A';

        if (!profileId) throw new Error('Could not find Profile ID.');
        if (!queryDomain) throw new Error('Could not find a DNS name to replay.');

        const response = await gmXmlHttpRequestWithRetry({
            method: 'GET',
            url: `${NEXTDNS_DOH_URL}/${encodeURIComponent(profileId)}?name=${encodeURIComponent(queryDomain)}&type=${encodeURIComponent(queryType)}`,
            headers: { Accept: 'application/dns-json' },
            responseType: 'json',
            timeout: 10000
        }, { retries: 1 });

        if (response.status < 200 || response.status >= 300) {
            throw createRequestError(`${response.status}: ${response.statusText || 'DNS replay failed'}`, {
                status: response.status,
                statusText: response.statusText,
                responseHeaders: response.responseHeaders || ''
            });
        }

        return {
            domain: queryDomain,
            type: queryType,
            profileId,
            payload: parseDnsJsonResponse(response)
        };
    }

    function getDnsReplayStatusLabel(status) {
        const labels = {
            0: 'NOERROR',
            1: 'FORMERR',
            2: 'SERVFAIL',
            3: 'NXDOMAIN',
            4: 'NOTIMP',
            5: 'REFUSED'
        };
        const code = Number(status);
        return `${Number.isFinite(code) ? code : '?'} ${labels[code] || 'UNKNOWN'}`;
    }

    function getDnsReplayTypeName(type) {
        const names = {
            1: 'A',
            2: 'NS',
            5: 'CNAME',
            15: 'MX',
            16: 'TXT',
            28: 'AAAA'
        };
        return names[Number(type)] || String(type || '?');
    }

    function formatDnsReplayResult(result) {
        const payload = result.payload || {};
        const lines = [
            `${result.type} ${result.domain}`,
            `Profile: ${result.profileId}`,
            `Status: ${getDnsReplayStatusLabel(payload.Status)}`,
            `Flags: RD=${!!payload.RD} RA=${!!payload.RA} AD=${!!payload.AD} CD=${!!payload.CD}`
        ];
        const answers = Array.isArray(payload.Answer) ? payload.Answer : [];
        if (answers.length) {
            lines.push('', 'Answers:');
            answers.forEach((answer) => {
                lines.push(`- ${getDnsReplayTypeName(answer.type)} ${answer.name || result.domain} TTL ${answer.TTL ?? '?'} -> ${answer.data || ''}`);
            });
        } else {
            lines.push('', 'No answers returned.');
        }
        const authority = Array.isArray(payload.Authority) ? payload.Authority : [];
        if (authority.length) {
            lines.push('', 'Authority:');
            authority.slice(0, 5).forEach((answer) => {
                lines.push(`- ${getDnsReplayTypeName(answer.type)} ${answer.name || ''} TTL ${answer.TTL ?? '?'} -> ${answer.data || ''}`);
            });
        }
        return lines.join('\n');
    }

    function showDnsReplayModal(domain) {
        const queryDomain = normalizeImportedDomain(domain);
        if (!queryDomain) return showToast('Could not find a DNS name to replay.', true);

        const overlay = createSafeElement('div', { className: 'ndns-profile-modal-overlay' });
        overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

        const modal = createSafeElement('div', { className: 'ndns-profile-modal' });
        modal.style.maxWidth = '720px';
        modal.onclick = (e) => e.stopPropagation();

        const title = createSafeElement('h3', { text: 'DNS Query Replay' });
        const help = createSafeElement('p', {
            style: 'font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;',
            text: 'Replay this query through the current profile DoH endpoint and inspect the live resolver response.'
        });
        const meta = createSafeElement('div', {
            className: 'ndns-dns-replay-meta',
            text: `${queryDomain} via ${NEXTDNS_DOH_URL}/${getCurrentProfileId() || 'profile'}`
        });
        const controls = createSafeElement('div', { className: 'ndns-dns-replay-controls' });
        const typeSelect = createSafeElement('select', { attrs: { 'aria-label': 'DNS record type' } });
        DNS_REPLAY_TYPES.forEach((recordType) => {
            const option = createSafeElement('option', { text: recordType, attrs: { value: recordType } });
            typeSelect.appendChild(option);
        });
        const runBtn = createSafeElement('button', {
            className: 'ndns-panel-button ndns-btn-sm',
            text: 'Run Query',
            attrs: { type: 'button' }
        });
        controls.append(typeSelect, runBtn);

        const status = createSafeElement('div', {
            style: 'font-size:12px;color:var(--panel-text-secondary);min-height:18px;',
            attrs: { role: 'status', 'aria-live': 'polite' },
            text: 'Ready.'
        });
        const result = createSafeElement('pre', {
            className: 'ndns-dns-replay-result',
            text: 'No query run yet.'
        });
        const closeBtn = createSafeElement('button', {
            className: 'ndns-panel-button danger',
            text: uiText('cancel'),
            attrs: { type: 'button', 'aria-label': 'Close DNS query replay' }
        });

        function closeModal() {
            restoreDialogFocus(overlay);
            overlay.remove();
        }

        async function runQuery() {
            runBtn.disabled = true;
            status.textContent = `Querying ${queryDomain} ${typeSelect.value}...`;
            result.textContent = 'Waiting for resolver response...';
            try {
                const replay = await replayDnsQuery(queryDomain, typeSelect.value);
                status.textContent = `Response received: ${getDnsReplayStatusLabel(replay.payload?.Status)}.`;
                result.textContent = formatDnsReplayResult(replay);
            } catch (error) {
                status.textContent = `Replay failed: ${error.message || 'Unknown error'}`;
                result.textContent = status.textContent;
                showToast(status.textContent, true, 5000);
            } finally {
                runBtn.disabled = false;
            }
        }

        runBtn.onclick = runQuery;
        closeBtn.onclick = closeModal;

        modal.append(title, help, meta, controls, status, result, closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        setupDialogAccessibility(overlay, modal, 'DNS query replay');
        focusDialog(overlay);
        runQuery();
    }

    let isCleaningLogs = false; // Guard against re-entry

    function invalidateLogCache() {
        document.querySelectorAll('div.list-group-item.log[data-ndns-processed]').forEach(row => {
            delete row.dataset.ndnsProcessed;
        });
    }

    function cleanLogs() {
        if (isCleaningLogs) return;
        isCleaningLogs = true;

        try {
            document.querySelectorAll('div.list-group-item.log').forEach(row => {
                let domain = row.dataset.ndnsDomain;
                const alreadyProcessed = row.dataset.ndnsProcessed === '1';

                if (!alreadyProcessed) {
                    row.querySelector('svg[data-icon="ellipsis-vertical"]')?.closest('.dropdown')?.style.setProperty('display', 'none', 'important');
                    domain = row.querySelector('.text-break > div > span')?.innerText.trim() || row.querySelector('.text-break')?.innerText.trim().match(/^([a-zA-Z0-9.-]+)/)?.[0];
                    if (!domain) return;
                    row.dataset.ndnsDomain = domain;
                    createRowButtons(row, domain);

                    const rootDomain = extractRootDomain(domain);
                    const domainAction = domainActions[domain];
                    const rootAction = domainActions[rootDomain];
                    const historicalAction = domainAction || rootAction;

                    if (historicalAction) {
                        const borderStyle = historicalAction.level === 'root' ? 'solid' : 'dotted';
                        const borderColor = historicalAction.type === 'deny' ? 'var(--danger-color)' : 'var(--success-color)';
                        row.style.borderLeft = `4px ${borderStyle} ${borderColor}`;
                    } else {
                        // Clear any previously-applied NDNS border so removed actions don't linger
                        if (row.style.borderLeft) row.style.borderLeft = '';
                        row.classList.remove('ndns-row-blocked', 'ndns-row-allowed');
                    }
                    row.dataset.ndnsHistAction = historicalAction ? historicalAction.type : '';
                }

                if (!domain) return;
                const rootDomain = extractRootDomain(domain);
                const historicalAction = alreadyProcessed
                    ? (row.dataset.ndnsHistAction ? { type: row.dataset.ndnsHistAction } : null)
                    : (domainActions[domain] || domainActions[rootDomain]);

            if (!alreadyProcessed && !row.querySelector('.ndns-reason-info')) {
                // Try to find reason info from various sources
                let reasonText = null;
                let reasonColor = null;

                // Method 1: Check .reason[title] element
                const reasonEl = row.querySelector('.reason[title]');
                if (reasonEl) {
                    const tooltipText = reasonEl.getAttribute('title');
                    const blockedByMatch = tooltipText.match(/Blocked by\s+(.+)/i);
                    const allowedByMatch = tooltipText.match(/Allowed by\s+(.+)/i);
                    if (blockedByMatch?.[1]) {
                        reasonText = `Blocked by ${blockedByMatch[1].replace(/\.$/, '').trim()}`;
                        reasonColor = 'var(--danger-color)';
                    } else if (allowedByMatch?.[1]) {
                        reasonText = `Allowed by ${allowedByMatch[1].replace(/\.$/, '').trim()}`;
                        reasonColor = 'var(--success-color)';
                    }
                }

                // Method 2: Check reason-icon parent for title/data-bs-original-title
                if (!reasonText) {
                    const reasonIcon = row.querySelector('.reason-icon');
                    if (reasonIcon) {
                        // Check all possible tooltip data locations
                        const possibleSources = [
                            reasonIcon,
                            reasonIcon.parentElement,
                            reasonIcon.closest('[title]'),
                            reasonIcon.closest('[data-bs-original-title]'),
                            reasonIcon.closest('[data-original-title]'),
                            reasonIcon.closest('[data-bs-title]'),
                            row.querySelector('[data-bs-original-title]'),
                            row.querySelector('[data-original-title]'),
                            row.querySelector('[title*="Blocked"]'),
                            row.querySelector('[title*="Allowed"]')
                        ].filter(Boolean);

                        let tooltipText = '';
                        for (const source of possibleSources) {
                            tooltipText = source.getAttribute('title') ||
                                         source.getAttribute('data-bs-original-title') ||
                                         source.getAttribute('data-original-title') ||
                                         source.getAttribute('data-bs-title') || '';
                            if (tooltipText.includes('Blocked') || tooltipText.includes('Allowed')) break;
                        }

                        const blockedMatch = tooltipText.match(/Blocked by\s+(.+)/i);
                        const allowedMatch = tooltipText.match(/Allowed by\s+(.+)/i);

                        if (blockedMatch?.[1]) {
                            reasonText = `Blocked by ${blockedMatch[1].replace(/\.$/, '').trim()}`;
                            reasonColor = 'var(--danger-color)';
                        } else if (allowedMatch?.[1]) {
                            reasonText = `Allowed by ${allowedMatch[1].replace(/\.$/, '').trim()}`;
                            reasonColor = 'var(--success-color)';
                        } else {
                            // Fallback: check icon color to determine if blocked or allowed
                            const iconStyle = reasonIcon.getAttribute('style') || '';
                            if (iconStyle.includes('rgb(255, 65, 54)') || iconStyle.includes('rgb(255, 69, 58)')) {
                                reasonText = 'Blocked';
                                reasonColor = 'var(--danger-color)';
                            } else if (iconStyle.includes('rgb(46, 204, 64)') || iconStyle.includes('rgb(50, 205, 50)')) {
                                reasonText = 'Allowed';
                                reasonColor = 'var(--success-color)';
                            }
                        }
                    }
                }

                // Create inline reason display
                if (reasonText) {
                    const infoElement = document.createElement('span');
                    infoElement.className = 'ndns-reason-info';
                    infoElement.textContent = `(${reasonText})`;
                    if (reasonColor) infoElement.style.color = reasonColor;

                    const targetContainer = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break > div') ||
                                           row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break');
                    targetContainer?.appendChild(infoElement);
                }

                // Determine and cache row status for coloring
                // Use .reason-icon (NextDNS native) and historicalAction (NDNS) as authoritative sources
                const reasonIcon = row.querySelector('.reason-icon');
                const isBlockedByReason = !!reasonIcon;
                // Check reason icon color for allowed status (green icon = allowed by allowlist)
                const reasonIconStyle = reasonIcon?.getAttribute('style') || '';
                const isAllowedByReason = reasonIconStyle.includes('rgb(46, 204') || reasonIconStyle.includes('rgb(50, 205');

                const isConsideredBlocked = (isBlockedByReason && !isAllowedByReason) || historicalAction?.type === 'deny';
                const isConsideredAllowed = isAllowedByReason || historicalAction?.type === 'allow';

                // Apply row background class
                if (isConsideredBlocked && !isConsideredAllowed) {
                    row.classList.remove('ndns-row-allowed');
                    row.classList.add('ndns-row-blocked');
                } else if (isConsideredAllowed) {
                    row.classList.remove('ndns-row-blocked');
                    row.classList.add('ndns-row-allowed');
                }

                row.dataset.ndnsBlocked = isConsideredBlocked ? '1' : '';
                row.dataset.ndnsAllowed = isConsideredAllowed ? '1' : '';

                // v3.4: Regex highlighting
                applyRegexHighlights(row);

                // v3.4: CNAME chain display
                fetchAndShowCnameChain(row);

                // v3.4: Webhook alert check
                if (domain) {
                    checkWebhookAlert(domain, {
                        row,
                        device: extractWebhookDevice(row),
                        status: isConsideredBlocked && !isConsideredAllowed ? 'blocked' : (isConsideredAllowed ? 'allowed' : 'unknown'),
                        timestamp: new Date()
                    });
                }

                row.dataset.ndnsProcessed = '1';
            }

            // Visibility filtering (always runs - filters may have changed)
            const isConsideredBlocked = alreadyProcessed ? row.dataset.ndnsBlocked === '1' : row.classList.contains('ndns-row-blocked');
            const isConsideredAllowed = alreadyProcessed ? row.dataset.ndnsAllowed === '1' : row.classList.contains('ndns-row-allowed');
            const hideByDomainList = filters.hideList && [...hiddenDomains].some(h => domain.includes(h));
            const isOriginMatch = isLogDomainInOriginFilter(domain);

            let isVisible = true;
            if (filters.hideList && hideByDomainList) isVisible = false;
            if (filters.hideBlocked && isConsideredBlocked) isVisible = false;
            if (filters.showOnlyWhitelisted && !isConsideredAllowed) isVisible = false;
            if (!isOriginMatch) isVisible = false;

            row.style.display = isVisible ? '' : 'none';
        });

        // Update log counters after processing
        if (showLogCounters && logCountersElement) {
            updateLogCounters();
        }
        } finally {
            isCleaningLogs = false;
        }
    }

    function observeLogs() {
        const logContainer = document.querySelector('div.logs') || document.body;
        let debounceTimer = null;

        const observer = new MutationObserver(() => {
            if (isCleaningLogs) return;

            // Debounce to avoid rapid-fire calls
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                cleanLogs();
            }, 50);
        });

        observer.observe(logContainer, { childList: true, subtree: true });

        // Fallback: periodically check for rows without buttons (catches any missed entries)
        setInterval(() => {
            if (isCleaningLogs) return;
            const allRows = document.querySelectorAll('div.list-group-item.log');
            const hasRowsWithoutButtons = Array.from(allRows).some(row => !row.querySelector('.ndns-inline-controls'));
            if (hasRowsWithoutButtons) {
                cleanLogs();
            }
        }, 1000);
    }

    // Replace stream button SVG with proper refresh icon
    function replaceStreamButtonIcon() {
        const streamButton = document.querySelector('.stream-button');
        if (!streamButton) return;

        const existingSvg = streamButton.querySelector('svg');
        if (existingSvg && existingSvg.dataset.ndnsReplaced) return;

        // Create refresh icon SVG
        const refreshSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        refreshSvg.setAttribute('viewBox', '0 0 24 24');
        refreshSvg.setAttribute('width', '18');
        refreshSvg.setAttribute('height', '18');
        refreshSvg.setAttribute('fill', 'currentColor');
        refreshSvg.dataset.ndnsReplaced = 'true';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z');

        refreshSvg.appendChild(path);

        // Replace the inner content
        const innerDiv = streamButton.querySelector('div');
        if (innerDiv) {
            innerDiv.innerHTML = '';
            innerDiv.appendChild(refreshSvg);
        } else {
            streamButton.innerHTML = '';
            streamButton.appendChild(refreshSvg);
        }
    }

    function startAutoRefresh() {
        if (autoRefreshInterval) return;
        autoRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
        }, 5000);
    }

    function stopAutoRefresh() {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    function hidePanel() {
        if (panel && !isManuallyLocked) panel.classList.remove('visible');
    }

    async function toggleLock() {
        isManuallyLocked = !isManuallyLocked;
        await storage.set({ [KEY_LOCK_STATE]: isManuallyLocked });
        updateLockIcon();
    }

    function updateLockIcon() {
        if (!lockButton) return;
        while (lockButton.firstChild) lockButton.removeChild(lockButton.firstChild);
        lockButton.appendChild(isManuallyLocked ? icons.locked.cloneNode(true) : icons.unlocked.cloneNode(true));
        if (isManuallyLocked) panel.classList.add('visible');
    }

    function updateTogglePositionIcon() {
        if (!panel || !togglePosButton) return;
        const isLeftSide = panel.classList.contains('left-side');
        while (togglePosButton.firstChild) togglePosButton.removeChild(togglePosButton.firstChild);
        togglePosButton.appendChild(isLeftSide ? icons.arrowRight.cloneNode(true) : icons.arrowLeft.cloneNode(true));
        togglePosButton.title = isLeftSide ? 'Move Panel to Right' : 'Move Panel to Left';
    }

    async function applyPanelPosition() {
        const side = (await storage.get({ [KEY_POSITION_SIDE]: 'right' }))[KEY_POSITION_SIDE];
        const top = (await storage.get({ [KEY_POSITION_TOP]: '10px' }))[KEY_POSITION_TOP];
        panel.style.top = top;
        panel.classList.remove('left-side', 'right-side');
        panel.classList.add(side === 'left' ? 'left-side' : 'right-side');
        leftHeaderControls.innerHTML = '';
        rightHeaderControls.innerHTML = '';

        if (side === 'left') {
            leftHeaderControls.appendChild(settingsButton);
            rightHeaderControls.append(togglePosButton, lockButton);
        } else {
            leftHeaderControls.append(lockButton, togglePosButton);
            rightHeaderControls.appendChild(settingsButton);
        }
        updateTogglePositionIcon();
    }

    function updatePanelBorderColor() {
        if (!panel) return;
        if (filters.showOnlyWhitelisted) {
            panel.style.borderColor = 'var(--success-color)';
        } else {
            panel.style.borderColor = 'var(--handle-color)';
        }
    }

    async function toggleFeature(key) {
        const isTurningOn = !filters[key];
        const exclusiveKeys = ['hideBlocked', 'showOnlyWhitelisted'];

        if (isTurningOn) {
            if (key === 'hideList') filters.showOnlyWhitelisted = false;

            // If turning on Show Allowed Only, deselect Show Blocked Only (native toggle)
            if (key === 'showOnlyWhitelisted') {
                deselectShowBlockedOnly();
            }
        }

        if (exclusiveKeys.includes(key)) {
            if (isTurningOn) {
                exclusiveKeys.forEach(k => { filters[k] = false; });
                filters[key] = true;
            } else {
                filters[key] = false;
            }
        } else {
            filters[key] = isTurningOn;
        }

        if (key === 'autoRefresh') {
            if (isTurningOn) {
                document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        }

        await storage.set({ [KEY_FILTER_STATE]: filters });
        updateButtonStates();
        updatePanelBorderColor();
        cleanLogs();

        if (/\/denylist|\/allowlist/.test(location.href)) {
            location.reload();
        }
    }

    // --- Native NextDNS Toggle Functions ---
    // Style element for hiding settings box when Show Blocked Only is active
    let blockedOnlyStyleElement = null;

    function toggleNativeCheckbox(checkboxId, buttonId) {
        const checkbox = document.getElementById(checkboxId);
        const button = document.getElementById(buttonId);

        if (checkbox) {
            // Checkbox exists, click it directly
            const wasChecked = checkbox.checked;
            checkbox.click();

            // Update button state after a delay to ensure checkbox state has updated
            setTimeout(() => {
                const isNowChecked = document.getElementById(checkboxId)?.checked || false;
                if (button) {
                    button.classList.toggle('active', isNowChecked);
                }

                // For blocked-queries-only, manage CSS hiding and settings box
                if (checkboxId === 'blocked-queries-only') {
                    applyBlockedOnlyCSS(isNowChecked);
                    // If we just checked it, deselect Show Allowed Only
                    if (isNowChecked) {
                        deselectShowAllowedOnly();
                    }
                    // If we just unchecked it, close the settings box
                    if (!isNowChecked) {
                        setTimeout(() => {
                            const closeBtn = document.querySelector('div.settings-button.active');
                            if (closeBtn) closeBtn.click();
                        }, 100);
                    }
                }
            }, 150);
            return true;
        }

        // Checkbox not visible, need to open settings first
        const settingsBtn = document.querySelector('div.settings-button');
        if (settingsBtn) {
            settingsBtn.click();
            // Wait for settings to appear, then click the checkbox
            setTimeout(() => {
                const cb = document.getElementById(checkboxId);
                const btn = document.getElementById(buttonId);
                if (cb) {
                    cb.click();

                    // Update button state after checkbox click
                    setTimeout(() => {
                        const isChecked = document.getElementById(checkboxId)?.checked || false;
                        if (btn) {
                            btn.classList.toggle('active', isChecked);
                        }

                        // For blocked-queries-only, apply CSS hiding instead of closing settings
                        if (checkboxId === 'blocked-queries-only') {
                            applyBlockedOnlyCSS(isChecked);
                            // Deselect Show Allowed Only when Show Blocked Only is enabled
                            if (isChecked) {
                                deselectShowAllowedOnly();
                            }
                            // Don't close settings - it needs to stay open for the filter to work
                        } else {
                            // Close settings for other toggles
                            setTimeout(() => {
                                const closeBtn = document.querySelector('div.settings-button.active');
                                if (closeBtn) closeBtn.click();
                            }, 100);
                        }
                    }, 150);
                }
            }, 150);
        }
        return false;
    }

    // Function to deselect Show Allowed Only if it's active
    async function deselectShowAllowedOnly() {
        if (filters.showOnlyWhitelisted) {
            filters.showOnlyWhitelisted = false;
            await storage.set({ [KEY_FILTER_STATE]: filters });
            updateButtonStates();
            updatePanelBorderColor();
            cleanLogs();
        }
    }

    // Function to deselect Show Blocked Only if it's active
    function deselectShowBlockedOnly() {
        const blockedCheckbox = document.getElementById('blocked-queries-only');
        const blockedBtn = document.getElementById('toggle-blockedOnly');

        if (blockedCheckbox && blockedCheckbox.checked) {
            blockedCheckbox.click();
            if (blockedBtn) blockedBtn.classList.remove('active');
            applyBlockedOnlyCSS(false);
            // Close settings box
            setTimeout(() => {
                const closeBtn = document.querySelector('div.settings-button.active');
                if (closeBtn) closeBtn.click();
            }, 100);
        }
    }

    function applyBlockedOnlyCSS(enabled) {
        if (enabled) {
            if (!blockedOnlyStyleElement) {
                blockedOnlyStyleElement = document.createElement('style');
                blockedOnlyStyleElement.id = 'ndns-blocked-only-hide';
                blockedOnlyStyleElement.textContent = `
                    .list-group-item.bg-2.px-3 > .d-md-flex { display: none !important; }
                `;
                document.head.appendChild(blockedOnlyStyleElement);
            }
        } else {
            if (blockedOnlyStyleElement) {
                blockedOnlyStyleElement.remove();
                blockedOnlyStyleElement = null;
            }
        }
    }

    function updateNativeToggleButton(checkboxId, buttonId) {
        setTimeout(() => {
            const checkbox = document.getElementById(checkboxId);
            const button = document.getElementById(buttonId);
            if (checkbox && button) {
                button.classList.toggle('active', checkbox.checked);
            }
        }, 200);
    }

    function initNativeToggleStates() {
        // Update button states based on native checkbox states
        setTimeout(() => {
            const blockedCheckbox = document.getElementById('blocked-queries-only');
            const blockedBtn = document.getElementById('toggle-blockedOnly');
            if (blockedCheckbox && blockedBtn) {
                blockedBtn.classList.toggle('active', blockedCheckbox.checked);
                // Apply CSS hiding if already checked
                if (blockedCheckbox.checked) {
                    applyBlockedOnlyCSS(true);
                }
            }

            const rawCheckbox = document.getElementById('advanced-mode');
            const rawBtn = document.getElementById('toggle-rawDnsLogs');
            if (rawCheckbox && rawBtn) {
                rawBtn.classList.toggle('active', rawCheckbox.checked);
            }
        }, 500);
    }

    function updateButtonStates() {
        Object.keys(filters).forEach(k => {
            const btn = document.getElementById(`toggle-${k}`);
            if (btn) {
                btn.classList.toggle('active', filters[k]);
                if (k === 'autoRefresh') {
                    btn.classList.toggle('auto-refresh-active', filters[k]);
                    document.querySelector('.stream-button')?.classList.toggle('auto-refresh-active', filters[k]);
                }
            }
        });
        updateLogOriginFilterControls();
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-ndns-theme', theme);
        currentTheme = theme;
    }

    function applyDensityMode(mode) {
        densityMode = mode === 'roomy' ? 'roomy' : 'compact';
        document.documentElement.setAttribute('data-ndns-density', densityMode);
    }

    function getTextByteSize(text) {
        return new Blob([String(text || '')]).size;
    }

    function validateThemeStudioCss(css) {
        const size = getTextByteSize(css);
        if (size > THEME_STUDIO_MAX_CSS_BYTES) {
            return {
                ok: false,
                size,
                message: `Custom CSS is ${size.toLocaleString()} bytes; max is ${THEME_STUDIO_MAX_CSS_BYTES.toLocaleString()} bytes.`
            };
        }
        return { ok: true, size, message: '' };
    }

    function isThemeStudioBypassRequested() {
        const params = new URLSearchParams(location.search);
        return THEME_STUDIO_BYPASS_PARAMS.some(param => params.has(param)) || location.hash.includes('ndns-disable-custom-css');
    }

    function applyThemeStudioCss(css = themeStudioCss) {
        if (themeStudioStyleElement) {
            themeStudioStyleElement.remove();
            themeStudioStyleElement = null;
        }

        themeStudioCss = String(css || '');
        if (!themeStudioCss.trim()) return;
        const validation = validateThemeStudioCss(themeStudioCss);
        if (!validation.ok) {
            console.warn('[NDNS] Theme Studio CSS skipped:', validation.message);
            showToast(`Theme Studio CSS skipped: ${validation.message}`, true, 7000);
            return;
        }

        themeStudioStyleElement = document.createElement('style');
        themeStudioStyleElement.id = 'ndns-theme-studio-css';
        themeStudioStyleElement.textContent = themeStudioCss;
        document.head.appendChild(themeStudioStyleElement);
    }

    async function resetThemeStudioCssForBypass() {
        if (!isThemeStudioBypassRequested()) return false;
        themeStudioCss = '';
        await storage.set({ [KEY_THEME_STUDIO_CSS]: '' });
        setTimeout(() => showToast('Theme Studio CSS reset by NDNS safe-mode URL.', false, 7000), 600);
        return true;
    }

    function unwrapProfileImportPayload(payload) {
        if (payload?.backupType === 'nextdns-profile-pre-import' && payload.profile && typeof payload.profile === 'object') {
            return payload.profile;
        }
        return payload;
    }

    function downloadProfilePreImportBackup(profileId, profileConfig) {
        const exportedAt = new Date().toISOString();
        const payload = {
            app: 'NDNS',
            backupType: 'nextdns-profile-pre-import',
            profileId,
            exportedAt,
            rollback: 'Open NDNS settings, choose Import Profile, paste this file, preview, then apply.',
            profile: profileConfig
        };
        downloadFile(JSON.stringify(payload, null, 2), `NextDNS-Profile-${profileId}-PreImport-${exportedAt.replace(/[:.]/g, '-')}.json`, 'application/json');
    }

    function buildThemeStudioControls() {
        const wrap = document.createElement('div');
        wrap.className = 'ndns-theme-studio';

        const header = document.createElement('div');
        header.className = 'settings-control-row';
        header.appendChild(createSafeElement('span', { text: uiText('themeStudio') }));
        wrap.appendChild(header);

        const textarea = document.createElement('textarea');
        textarea.value = themeStudioCss;
        textarea.placeholder = ':root { --accent-color: #7f5af0; }\n.ndns-panel { box-shadow: 0 20px 60px rgba(0,0,0,0.4); }';
        wrap.appendChild(textarea);

        const actions = document.createElement('div');
        actions.className = 'ndns-theme-studio-actions';

        const status = document.createElement('div');
        status.className = 'ndns-theme-studio-status';
        status.textContent = themeStudioCss.trim()
            ? `Saved CSS loaded. Max ${THEME_STUDIO_MAX_CSS_BYTES.toLocaleString()} bytes; safe-mode reset: add ?ndns-safe-mode=1 to the URL.`
            : `No custom theme CSS saved. Max ${THEME_STUDIO_MAX_CSS_BYTES.toLocaleString()} bytes.`;

        let previewTimer = null;
        textarea.oninput = () => {
            clearTimeout(previewTimer);
            previewTimer = setTimeout(() => {
                const validation = validateThemeStudioCss(textarea.value);
                if (!validation.ok) {
                    status.textContent = validation.message;
                    showToast(validation.message, true, 5000);
                    return;
                }
                applyThemeStudioCss(textarea.value);
                status.textContent = `Previewing unsaved CSS (${validation.size.toLocaleString()} bytes).`;
            }, 150);
        };

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'ndns-panel-button ndns-btn-sm';
        saveBtn.textContent = uiText('save');
        saveBtn.onclick = async () => {
            const validation = validateThemeStudioCss(textarea.value);
            if (!validation.ok) {
                status.textContent = validation.message;
                showToast(validation.message, true, 5000);
                return;
            }
            applyThemeStudioCss(textarea.value);
            await storage.set({ [KEY_THEME_STUDIO_CSS]: themeStudioCss });
            status.textContent = `Saved (${validation.size.toLocaleString()} bytes). Safe-mode reset: add ?ndns-safe-mode=1 to the URL.`;
            showToast('Theme Studio CSS saved.');
        };

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'ndns-panel-button ndns-btn-sm';
        exportBtn.textContent = uiText('export');
        exportBtn.onclick = () => {
            const version = typeof GM_info !== 'undefined' ? (GM_info.script?.version || 'unknown') : 'unknown';
            const payload = {
                app: 'NDNS Theme Studio',
                version,
                exportedAt: new Date().toISOString(),
                css: textarea.value
            };
            downloadFile(JSON.stringify(payload, null, 2), `ndns-theme-studio-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
            status.textContent = 'Exported.';
        };

        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.json,.css,application/json,text/css,text/plain';
        importInput.style.display = 'none';
        importInput.onchange = () => {
            const file = importInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                const text = String(reader.result || '');
                let css = text;
                try {
                    const parsed = JSON.parse(text);
                    if (typeof parsed.css === 'string') css = parsed.css;
                } catch {}
                const validation = validateThemeStudioCss(css);
                if (!validation.ok) {
                    status.textContent = validation.message;
                    showToast(validation.message, true, 5000);
                    importInput.value = '';
                    return;
                }
                textarea.value = css;
                applyThemeStudioCss(css);
                await storage.set({ [KEY_THEME_STUDIO_CSS]: themeStudioCss });
                status.textContent = `Imported and saved (${validation.size.toLocaleString()} bytes).`;
                showToast('Theme Studio CSS imported.');
                importInput.value = '';
            };
            reader.onerror = () => showToast('Theme import failed.', true);
            reader.readAsText(file);
        };

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'ndns-panel-button ndns-btn-sm';
        importBtn.textContent = uiText('import');
        importBtn.onclick = () => importInput.click();

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'ndns-panel-button ndns-btn-sm danger';
        clearBtn.textContent = uiText('clear');
        clearBtn.onclick = async () => {
            textarea.value = '';
            applyThemeStudioCss('');
            await storage.set({ [KEY_THEME_STUDIO_CSS]: '' });
            status.textContent = 'Cleared.';
            showToast('Theme Studio CSS cleared.');
        };

        actions.append(saveBtn, exportBtn, importBtn, clearBtn, importInput);
        wrap.append(actions, status);
        return wrap;
    }

    function applyPanelWidth(width) {
        panel.style.minWidth = `${width}px`;
        panel.style.width = `${width}px`;
        panelWidth = width;
    }

    async function onDownloadBlockedHosts(event) {
        const button = event.currentTarget;
        const spinner = button.querySelector('.spinner');
        const buttonText = button.querySelector('span');
        const originalText = buttonText.textContent;
        const profileId = getCurrentProfileId();

        if (!profileId) {
            showToast('Error: Could not detect Profile ID.', true);
            return;
        }

        button.disabled = true;
        buttonText.textContent = 'Processing...';
        spinner.style.display = 'inline-block';

        try {
            const csvText = await fetchLogsCsv(profileId);
            const lines = csvText.trim().split('\n');
            const header = lines.shift().split(',').map(h => h.trim());
            const domainIndex = header.indexOf('domain');
            const reasonsIndex = header.indexOf('reasons');

            if (domainIndex === -1 || reasonsIndex === -1) {
                throw new Error('CSV missing required columns.');
            }

            const blockedDomains = new Set();
            lines.forEach(line => {
                const columns = line.split(',');
                const reasons = (columns[reasonsIndex] || '').toLowerCase();
                if (reasons.includes('blacklist') || reasons.includes('blocklist')) {
                    const domain = columns[domainIndex];
                    if (domain) blockedDomains.add(domain);
                }
            });

            const hostsContent = Array.from(blockedDomains).map(domain => `0.0.0.0 ${domain}`).join('\n');
            downloadFile(hostsContent, 'hosts');
            showToast('HOSTS file downloaded.', false);

        } catch (error) {
            showToast(`Failed: ${error.message}`, true, 5000);
        } finally {
            button.disabled = false;
            buttonText.textContent = originalText;
            spinner.style.display = 'none';
        }
    }

    async function exportProfile() {
        const pid = getCurrentProfileId();
        if (!pid || !NDNS_API_KEY) {
            showToast("Profile ID or API Key missing.", true);
            return;
        }
        const exportButton = document.getElementById('ndns-export-profile-btn');
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';

        try {
            const result = await makeApiRequest('GET', `/profiles/${pid}`, null, NDNS_API_KEY);
            const content = JSON.stringify(result, null, 2);
            downloadFile(content, `NextDNS-Profile-${pid}-Export.json`, 'application/json');
            showToast("Profile exported!");
        } catch (error) {
            showToast(`Export failed: ${error.message}`, true);
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = uiText('exportProfile');
        }
    }

    // --- PROFILE IMPORT WITH DIFF VIEW ---
    async function importProfile() {
        const pid = getCurrentProfileId();
        if (!pid || !NDNS_API_KEY) return showToast("Profile ID or API Key missing.", true);

        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = '<h3>Import Profile Configuration</h3>';

        const label = document.createElement('label');
        label.textContent = 'Paste exported profile JSON:';
        const textarea = document.createElement('textarea');
        textarea.placeholder = '{"name":"...","security":{...},...}';

        const diffContainer = document.createElement('div');
        diffContainer.className = 'ndns-diff-view';
        diffContainer.style.display = 'none';

        const diffSummary = document.createElement('div');
        diffSummary.className = 'ndns-diff-summary';
        diffSummary.style.display = 'none';

        const rollbackNotice = document.createElement('div');
        rollbackNotice.className = 'ndns-diff-summary';
        rollbackNotice.style.display = 'none';
        rollbackNotice.textContent = 'A timestamped pre-import backup will download before changes are applied. Use that file in this importer to roll back.';

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const previewBtn = document.createElement('button');
        previewBtn.className = 'ndns-panel-button';
        previewBtn.textContent = 'Preview Changes';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'ndns-panel-button';
        applyBtn.textContent = 'Apply Import';
        applyBtn.disabled = true;
        applyBtn.style.opacity = '0.5';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ndns-panel-button danger';
        cancelBtn.textContent = uiText('cancel');
        cancelBtn.onclick = () => overlay.remove();

        let parsedImport = null;
        let currentConfig = null;
        let destructiveSections = [];

        previewBtn.onclick = async () => {
            const txt = textarea.value.trim();
            if (!txt) return showToast('Paste JSON first.', true);
            try {
                parsedImport = unwrapProfileImportPayload(JSON.parse(txt));
            } catch { return showToast('Invalid JSON.', true); }

            previewBtn.textContent = 'Loading current...';
            previewBtn.disabled = true;
            try {
                currentConfig = await makeApiRequest('GET', `/profiles/${pid}`, null, NDNS_API_KEY);
            } catch (e) {
                previewBtn.textContent = 'Preview Changes';
                previewBtn.disabled = false;
                return showToast(`Failed to load current config: ${e.message}`, true);
            }

            // Build diff
            diffContainer.innerHTML = '';
            let addCount = 0, removeCount = 0, unchangedCount = 0;
            const destructive = new Set();
            const sections = ['denylist', 'allowlist', 'security', 'privacy', 'parentalControl', 'settings', 'rewrites'];

            sections.forEach(section => {
                const imported = parsedImport[section];
                const current = currentConfig[section];
                if (!imported && !current) return;

                const sectionHeader = document.createElement('div');
                sectionHeader.style.cssText = 'font-weight: 600; margin-top: 8px; color: var(--accent-color);';
                sectionHeader.textContent = section.toUpperCase();
                diffContainer.appendChild(sectionHeader);

                if (Array.isArray(imported) && Array.isArray(current)) {
                    const currentIds = new Set(current.map(i => i.id || JSON.stringify(i)));
                    const importedIds = new Set(imported.map(i => i.id || JSON.stringify(i)));

                    imported.forEach(item => {
                        const id = item.id || JSON.stringify(item);
                        const line = document.createElement('div');
                        if (currentIds.has(id)) {
                            line.className = 'ndns-diff-same';
                            line.textContent = `  ${id}`;
                            unchangedCount++;
                        } else {
                            line.className = 'ndns-diff-add';
                            line.textContent = `+ ${id}`;
                            addCount++;
                        }
                        diffContainer.appendChild(line);
                    });
                    current.forEach(item => {
                        const id = item.id || JSON.stringify(item);
                        if (!importedIds.has(id)) {
                            const line = document.createElement('div');
                            line.className = 'ndns-diff-remove';
                            line.textContent = `- ${id}`;
                            removeCount++;
                            destructive.add(section);
                            diffContainer.appendChild(line);
                        }
                    });
                } else {
                    const importStr = JSON.stringify(imported, null, 2);
                    const currentStr = JSON.stringify(current, null, 2);
                    if (importStr !== currentStr) {
                        const line = document.createElement('div');
                        line.className = 'ndns-diff-add';
                        line.textContent = `~ Changed`;
                        addCount++;
                        if (current !== undefined && current !== null) destructive.add(section);
                        diffContainer.appendChild(line);
                    } else {
                        const line = document.createElement('div');
                        line.className = 'ndns-diff-same';
                        line.textContent = `  No changes`;
                        unchangedCount++;
                        diffContainer.appendChild(line);
                    }
                }
            });

            destructiveSections = [...destructive];
            const destructiveText = destructiveSections.length ? ` Destructive sections: ${destructiveSections.join(', ')}.` : '';
            diffSummary.textContent = `+${addCount} additions, -${removeCount} removals, ${unchangedCount} unchanged.${destructiveText}`;
            diffSummary.style.display = '';
            diffContainer.style.display = '';
            rollbackNotice.style.display = '';
            applyBtn.disabled = false;
            applyBtn.style.opacity = '1';
            previewBtn.textContent = 'Preview Changes';
            previewBtn.disabled = false;
        };

        applyBtn.onclick = async () => {
            if (!parsedImport) return;
            applyBtn.textContent = 'Applying...';
            applyBtn.disabled = true;

            try {
                const backupConfig = currentConfig || await makeApiRequest('GET', `/profiles/${pid}`, null, NDNS_API_KEY);
                downloadProfilePreImportBackup(pid, backupConfig);
                rollbackNotice.textContent = `Pre-import backup downloaded. Destructive sections: ${destructiveSections.length ? destructiveSections.join(', ') : 'none detected'}.`;
                rollbackNotice.style.display = '';
                // Apply each section via PATCH
                await makeApiRequest('PATCH', `/profiles/${pid}`, parsedImport, NDNS_API_KEY);
                showToast('Profile imported successfully. Pre-import backup downloaded for rollback. Reloading...');
                overlay.remove();
                setTimeout(() => location.reload(), 1500);
            } catch (e) {
                rollbackNotice.textContent = `Import PATCH failed: ${e.message || e}. Roll back by importing the downloaded pre-import backup file. Trying section fallback now.`;
                rollbackNotice.style.display = '';
                // Fallback: apply sections individually
                const sections = ['denylist', 'allowlist', 'rewrites'];
                let applied = 0;
                for (const section of sections) {
                    if (!parsedImport[section] || !Array.isArray(parsedImport[section])) continue;
                    for (const item of parsedImport[section]) {
                        try {
                            await makeApiRequest('POST', `/profiles/${pid}/${section}`, item, NDNS_API_KEY);
                            applied++;
                            await new Promise(r => setTimeout(r, 200));
                        } catch {}
                    }
                }
                showToast(`Applied ${applied} items after PATCH failure. Use the downloaded pre-import backup to roll back if needed.`, applied === 0, 7000);
                overlay.remove();
                setTimeout(() => location.reload(), 1500);
            }
        };

        actions.append(previewBtn, applyBtn, cancelBtn);
        modal.append(label, textarea, diffSummary, rollbackNotice, diffContainer, actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // --- PROFILE CLONING ---
    async function cloneProfile() {
        if (!NDNS_API_KEY) return showToast("API Key not set.", true);

        const overlay = document.createElement('div');
        overlay.className = 'ndns-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'ndns-profile-modal';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = '<h3>Clone Profile</h3><p style="font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;">Copy all settings from one profile to another.</p>';

        // Loading profiles
        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size: 12px; color: var(--panel-text-secondary); margin: 8px 0;';
        statusEl.textContent = 'Loading profiles...';
        modal.appendChild(statusEl);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ndns-panel-button danger';
            cancelBtn.textContent = uiText('cancel');
        cancelBtn.style.marginTop = '12px';
        cancelBtn.onclick = () => overlay.remove();
        modal.appendChild(cancelBtn);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        try {
            // Fetch all profiles
            const profiles = await makeApiRequest('GET', '/profiles', null, NDNS_API_KEY);
            const profileList = profiles.data || profiles || [];
            if (profileList.length < 2) {
                statusEl.textContent = 'Need at least 2 profiles to clone.';
                return;
            }

            statusEl.remove();
            cancelBtn.remove();

            const currentPid = getCurrentProfileId();

            const sourceLabel = document.createElement('label');
            sourceLabel.textContent = 'Source Profile:';
            const sourceSelect = document.createElement('select');
            profileList.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} (${p.id})`;
                if (p.id === currentPid) opt.selected = true;
                sourceSelect.appendChild(opt);
            });

            const destLabel = document.createElement('label');
            destLabel.style.marginTop = '12px';
            destLabel.textContent = 'Destination Profile:';
            const destSelect = document.createElement('select');
            let destSelected = false;
            profileList.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} (${p.id})`;
                if (!destSelected && p.id !== currentPid) {
                    opt.selected = true;
                    destSelected = true;
                }
                destSelect.appendChild(opt);
            });

            const actions = document.createElement('div');
            actions.className = 'modal-actions';

            const cloneBtn = document.createElement('button');
            cloneBtn.className = 'ndns-panel-button';
            cloneBtn.textContent = 'Clone Settings';

            const cancelBtn2 = document.createElement('button');
            cancelBtn2.className = 'ndns-panel-button danger';
            cancelBtn2.textContent = uiText('cancel');
            cancelBtn2.onclick = () => overlay.remove();

            cloneBtn.onclick = async () => {
                const src = sourceSelect.value;
                const dest = destSelect.value;
                if (src === dest) return showToast('Source and destination must differ.', true);

                cloneBtn.textContent = 'Cloning...';
                cloneBtn.disabled = true;
                try {
                    const sourceConfig = await makeApiRequest('GET', `/profiles/${src}`, null, NDNS_API_KEY);
                    // Remove non-clonable fields
                    delete sourceConfig.id;
                    delete sourceConfig.fingerprint;
                    delete sourceConfig.name;

                    await makeApiRequest('PATCH', `/profiles/${dest}`, sourceConfig, NDNS_API_KEY);
                    showToast(`Profile cloned from ${src} to ${dest}!`);
                    overlay.remove();
                } catch (e) {
                    showToast(`Clone failed: ${e.message}`, true);
                    cloneBtn.textContent = 'Clone Settings';
                    cloneBtn.disabled = false;
                }
            };

            actions.append(cloneBtn, cancelBtn2);
            modal.append(sourceLabel, sourceSelect, destLabel, destSelect, actions);
        } catch (e) {
            statusEl.textContent = `Failed to load profiles: ${e.message}`;
        }
    }

    // --- DNS REWRITE MANAGEMENT ---
    async function initRewritePanel(container) {
        if (!NDNS_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        container.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
        header.innerHTML = '<span style="font-size: 12px; font-weight: 600;">DNS Rewrites</span>';

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'ndns-panel-button ndns-btn-sm';
        refreshBtn.textContent = uiText('refresh');
        refreshBtn.style.cssText = 'padding: 2px 8px; font-size: 10px; width: auto;';
        refreshBtn.onclick = () => initRewritePanel(container);
        header.appendChild(refreshBtn);
        container.appendChild(header);

        const list = document.createElement('div');
        list.className = 'ndns-rewrite-list';
        container.appendChild(list);

        try {
            const result = await makeApiRequest('GET', `/profiles/${pid}/rewrites`, null, NDNS_API_KEY);
            const rewrites = result.data || result || [];

            if (rewrites.length === 0) {
                list.textContent = '';
                list.appendChild(createSafeElement('div', {
                    text: 'No rewrites configured',
                    style: 'font-size: 11px; color: var(--panel-text-secondary); text-align: center; padding: 8px;'
                }));
            } else {
                rewrites.forEach(rw => {
                    const item = document.createElement('div');
                    item.className = 'ndns-rewrite-item';
                    const summary = createSafeElement('span', {}, [
                        createSafeElement('span', { className: 'domain', text: rw.name || '' }),
                        ' ',
                        createSafeElement('span', { className: 'answer', text: rw.content || rw.answer || '' })
                    ]);
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-btn';
                    delBtn.textContent = 'x';
                    delBtn.onclick = async () => {
                        try {
                            await makeApiRequest('DELETE', `/profiles/${pid}/rewrites/${encodeURIComponent(rw.id)}`, null, NDNS_API_KEY);
                            item.remove();
                            showToast(`Rewrite ${rw.name} removed.`);
                        } catch (e) { showToast(`Error: ${e.message}`, true); }
                    };
                    item.append(summary, delBtn);
                    list.appendChild(item);
                });
            }
        } catch (e) {
            list.textContent = '';
            list.appendChild(createSafeElement('div', {
                text: `Failed to load: ${e.message}`,
                style: 'font-size: 11px; color: var(--danger-color);'
            }));
        }

        // Add new rewrite form
        const addRow = document.createElement('div');
        addRow.className = 'ndns-rewrite-add';
        const nameInput = document.createElement('input');
        nameInput.placeholder = 'Domain';
        const answerInput = document.createElement('input');
        answerInput.placeholder = 'Answer (IP/CNAME)';
        const addBtn = document.createElement('button');
        addBtn.className = 'ndns-panel-button ndns-btn-sm';
        addBtn.textContent = '+';
        addBtn.style.cssText = 'width: auto; padding: 4px 10px;';
        addBtn.onclick = async () => {
            const name = nameInput.value.trim();
            const answer = answerInput.value.trim();
            if (!name || !answer) return showToast('Both fields required.', true);
            try {
                await makeApiRequest('POST', `/profiles/${pid}/rewrites`, { name, content: answer }, NDNS_API_KEY);
                showToast(`Rewrite added: ${name} -> ${answer}`);
                nameInput.value = '';
                answerInput.value = '';
                initRewritePanel(container);
            } catch (e) { showToast(`Error: ${e.message}`, true); }
        };
        addRow.append(nameInput, answerInput, addBtn);
        container.appendChild(addRow);
    }

    // --- ANALYTICS ENHANCEMENTS ---
    // --- ANALYTICS DASHBOARD ---
    const ANALYTICS_RING_COLORS = ['#7f5af0','#2cb67d','#e53170','#4ea8de','#f0b429','#20c997','#ff6b6b','#845ef7','#ff922b','#74c0fc','#51cf66','#cc5de8'];
    const ANALYTICS_DAY_MS = 24 * 60 * 60 * 1000;
    const ANALYTICS_WINDOWS = [
        { key: 'api', label: 'API Default', description: 'Native NextDNS window' },
        { key: '90d', label: 'Last 90 Days', description: 'Weekly rollup', days: 90, bucketCount: 13 },
        { key: '1y', label: 'Last 1 Year', description: 'Monthly rollup', days: 365, bucketCount: 12 }
    ];
    const ANALYTICS_SCOPES = [
        { key: 'current', label: 'Current Profile' },
        { key: 'all', label: 'All Profiles' }
    ];
    const DEVICE_DRILLDOWN_LIMIT = 5;
    const ANALYTICS_SPIKE_RATIO = 1.75;
    const ANALYTICS_SPIKE_MIN_QUERIES = 25;
    const ANALYTICS_CATEGORY_ENDPOINTS = ['categories', 'reasons'];
    const DEVICE_APP_SIGNATURES = [
        { name: 'Apple / iCloud', domains: ['apple.com', 'icloud.com', 'icloud-content.com', 'mzstatic.com', 'itunes.apple.com', 'aaplimg.com', 'apple-dns.net'] },
        { name: 'Google / Android', domains: ['google.com', 'gstatic.com', 'googleapis.com', 'googleusercontent.com', 'googlevideo.com', 'youtube.com', 'ytimg.com', 'android.com', 'firebaseio.com', 'app-measurement.com'] },
        { name: 'Microsoft / Windows', domains: ['microsoft.com', 'windows.com', 'windowsupdate.com', 'msftconnecttest.com', 'live.com', 'office.com', 'office365.com', 'outlook.com', 'teams.microsoft.com'] },
        { name: 'Meta', domains: ['facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com', 'whatsapp.net', 'whatsapp.com', 'messenger.com'] },
        { name: 'Amazon', domains: ['amazon.com', 'amazonaws.com', 'cloudfront.net', 'media-amazon.com', 'alexa.com', 'amazonalexa.com'] },
        { name: 'Streaming', domains: ['netflix.com', 'nflxvideo.net', 'hulu.com', 'disneyplus.com', 'spotify.com', 'roku.com', 'pandora.com', 'hbo.com', 'max.com'] },
        { name: 'Gaming', domains: ['steampowered.com', 'steamcontent.com', 'epicgames.com', 'playstation.net', 'xboxlive.com', 'nintendo.net', 'battle.net'] },
        { name: 'Messaging / Work', domains: ['slack.com', 'discord.com', 'zoom.us', 'telegram.org', 'signal.org', 'webex.com'] },
        { name: 'Network / CDN', domains: ['nextdns.io', 'cloudflare.com', 'cloudflare-dns.com', 'akamaihd.net', 'akadns.net', 'fastly.net', 'fastly-edge.com'] },
        { name: 'Smart Home / IoT', domains: ['tuyaus.com', 'tuya.com', 'ring.com', 'nest.com', 'samsungiotcloud.com', 'samsungcloudsolution.com', 'lgsmartad.com', 'tplinkcloud.com', 'meross.com', 'ecobee.com', 'ewelink.cc'] },
        { name: 'Ads / Telemetry', domains: ['doubleclick.net', 'googlesyndication.com', 'sentry.io', 'crashlytics.com', 'amplitude.com', 'segment.io', 'scorecardresearch.com'] }
    ];

    let analyticsCache = null;
    let analyticsWindowKey = '90d';
    let analyticsScopeKey = 'current';
    let lastAnomalyNotificationKey = '';

    async function initAnalyticsEnhancements() {
        if (!NDNS_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;
        if (document.querySelector('.ndns-analytics-page')) return;

        // Wait for the Analytics section to appear, then replace its content
        const waitForPage = setInterval(() => {
            try {
                if (document.querySelector('.ndns-analytics-page')) { clearInterval(waitForPage); return; }

                const analyticsSection = document.querySelector('.Analytics');
                if (!analyticsSection) return;

                clearInterval(waitForPage);

                // Hide existing analytics content
                Array.from(analyticsSection.children).forEach(child => {
                    child.dataset.ndnsHidden = '1';
                    child.style.display = 'none';
                });

                const dashboard = document.createElement('div');
                dashboard.className = 'ndns-analytics-page';
                analyticsSection.appendChild(dashboard);

                renderAnalyticsDashboard(pid, dashboard);
            } catch (e) {
                console.error('[NDNS] initAnalyticsEnhancements error:', e);
            }
        }, 500);
        setTimeout(() => clearInterval(waitForPage), 20000);
    }

    function getAnalyticsWindowConfig(key = analyticsWindowKey) {
        return ANALYTICS_WINDOWS.find(w => w.key === key) || ANALYTICS_WINDOWS[1];
    }

    function buildAnalyticsRangeParams(config) {
        if (!config?.days) return {};
        const to = new Date();
        const from = new Date(to.getTime() - (config.days * ANALYTICS_DAY_MS));
        return { from: from.toISOString(), to: to.toISOString() };
    }

    function buildAnalyticsEndpoint(endpoint, params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
        });
        const qs = query.toString();
        return qs ? `${endpoint}?${qs}` : endpoint;
    }

    function normalizeAnalyticsData(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.data)) return data.data;
        if (data.data && typeof data.data === 'object') {
            return Object.entries(data.data).map(([k, v]) => ({ name: k, queries: typeof v === 'number' ? v : 0 }));
        }
        return [];
    }

    function filterAnalyticsDomains(items) {
        return items.filter(d => d?.domain !== 'blockpage.nextdns.io' && d?.name !== 'blockpage.nextdns.io');
    }

    function summarizeStatusItems(items) {
        const total = items.reduce((s, i) => s + i.value, 0);
        const blocked = items.find(i => /block/i.test(i.name))?.value || 0;
        const allowed = items.find(i => /allow|default|pass|ok/i.test(i.name))?.value || 0;
        return {
            total,
            allowed,
            blocked,
            blockedPct: total > 0 ? (blocked / total * 100) : 0
        };
    }

    function getAnalyticsItemValue(item) {
        return Number(item?.queries || item?.count || item?.value || 0);
    }

    function getDomainFromAnalyticsItem(item) {
        return String(item?.domain || item?.name || item?.id || '').toLowerCase();
    }

    function normalizeDeviceItem(item) {
        const id = String(item?.id || item?.device || item?.name || 'unknown-device');
        const name = String(item?.name || item?.deviceName || item?.id || 'Unknown Device');
        const metaParts = [item?.model, item?.os, item?.localIp || item?.ip].filter(Boolean).map(String);
        return {
            id,
            name,
            meta: metaParts.join(' / '),
            queries: getAnalyticsItemValue(item)
        };
    }

    function domainMatchesSuffix(domain, suffix) {
        return domain === suffix || domain.endsWith(`.${suffix}`);
    }

    function inferAppFromDomain(domain) {
        if (!domain) return 'Unclassified';
        const hit = DEVICE_APP_SIGNATURES.find(signature => signature.domains.some(suffix => domainMatchesSuffix(domain, suffix)));
        return hit?.name || 'Unclassified';
    }

    function buildAppBreakdown(domainRows) {
        const groups = new Map();
        normalizeAnalyticsData(domainRows).forEach((item) => {
            const domain = getDomainFromAnalyticsItem(item);
            const queries = getAnalyticsItemValue(item);
            if (!domain || queries <= 0) return;
            const appName = inferAppFromDomain(domain);
            if (!groups.has(appName)) groups.set(appName, { name: appName, queries: 0, domains: [] });
            const group = groups.get(appName);
            group.queries += queries;
            if (group.domains.length < 4 && !group.domains.includes(domain)) group.domains.push(domain);
        });
        return Array.from(groups.values())
            .sort((a, b) => b.queries - a.queries)
            .slice(0, 6);
    }

    async function fetchDeviceDrilldowns(safeApi, devicesRaw, rangeParams) {
        const devices = normalizeAnalyticsData(devicesRaw)
            .map(normalizeDeviceItem)
            .filter(device => device.id && device.queries > 0)
            .sort((a, b) => b.queries - a.queries)
            .slice(0, DEVICE_DRILLDOWN_LIMIT);

        const drilldowns = [];
        for (const device of devices) {
            const domains = await safeApi('domains', { ...rangeParams, device: device.id, limit: 100 });
            drilldowns.push({
                ...device,
                apps: buildAppBreakdown(domains)
            });
        }
        return drilldowns;
    }

    function buildAnalyticsComparisonRanges(config) {
        if (!config?.days) return null;
        const to = new Date();
        const from = new Date(to.getTime() - (config.days * ANALYTICS_DAY_MS));
        const mid = new Date(from.getTime() + ((to.getTime() - from.getTime()) / 2));
        return {
            previous: { from: from.toISOString(), to: mid.toISOString() },
            current: { from: mid.toISOString(), to: to.toISOString() }
        };
    }

    async function fetchBlockedCategoryBreakdown(safeApi, params, preferredEndpoint = null) {
        const endpoints = preferredEndpoint ? [preferredEndpoint] : ANALYTICS_CATEGORY_ENDPOINTS;
        for (const endpoint of endpoints) {
            const raw = await safeApi(endpoint, { ...params, status: 'blocked' });
            const items = resolveItems(normalizeAnalyticsData(raw)).filter(item => item.value > 0);
            if (items.length > 0) return { endpoint, items };
        }
        return { endpoint: preferredEndpoint || ANALYTICS_CATEGORY_ENDPOINTS[0], items: [] };
    }

    async function fetchBlockedCategorySpikes(safeApi, config) {
        const ranges = buildAnalyticsComparisonRanges(config);
        if (!ranges) return [];
        const current = await fetchBlockedCategoryBreakdown(safeApi, ranges.current);
        if (current.items.length === 0) return [];
        const previous = await fetchBlockedCategoryBreakdown(safeApi, ranges.previous, current.endpoint);
        const previousMap = new Map(previous.items.map(item => [item.name.toLowerCase(), item.value]));
        return current.items.map((item) => {
            const previousValue = previousMap.get(item.name.toLowerCase()) || 0;
            const ratio = previousValue > 0 ? item.value / previousValue : Infinity;
            const changePct = previousValue > 0 ? ((item.value - previousValue) / previousValue * 100) : 100;
            return {
                category: item.name,
                current: item.value,
                previous: previousValue,
                ratio,
                changePct,
                endpoint: current.endpoint
            };
        })
            .filter(item => item.current >= ANALYTICS_SPIKE_MIN_QUERIES && item.ratio >= ANALYTICS_SPIKE_RATIO)
            .sort((a, b) => b.changePct - a.changePct)
            .slice(0, 8);
    }

    function notifyBlockedCategorySpikes(pid, windowKey, spikes) {
        if (!spikes?.length) return;
        const signature = `${pid}:${windowKey}:${spikes.map(spike => `${spike.category}:${spike.current}:${spike.previous}`).join('|')}`;
        if (signature === lastAnomalyNotificationKey) return;
        lastAnomalyNotificationKey = signature;
        const top = spikes[0];
        const body = `${top.category}: ${top.current.toLocaleString()} blocked queries vs ${top.previous.toLocaleString()} previous.`;
        showToast(`Blocked-query spike: ${top.category}`, true, 6000);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification('NDNS blocked-query spike', { body });
            } catch (err) {
                console.warn('[NDNS] Desktop notification failed:', err?.message || err);
            }
        }
    }

    function formatAnalyticsErrorMessage(err) {
        return String(err?.message || err || 'Unknown error');
    }

    function buildAnalyticsSafeApi(profile, errors = []) {
        const profileId = typeof profile === 'object' ? profile.id : profile;
        const profileName = typeof profile === 'object' ? profile.name : profileId;
        return (endpoint, params = {}) => {
            const apiEndpoint = buildAnalyticsEndpoint(endpoint, params);
            return makeApiRequest('GET', `/profiles/${profileId}/analytics/${apiEndpoint}`, null, NDNS_API_KEY).catch((err) => {
                const message = formatAnalyticsErrorMessage(err);
                errors.push({
                    type: 'endpoint',
                    profileId,
                    profileName,
                    endpoint: apiEndpoint,
                    message
                });
                console.warn(`[NDNS] Analytics API failed for ${profileId}/${apiEndpoint}:`, message);
                return null;
            });
        };
    }

    async function loadAnalyticsProfiles(currentPid, errors = []) {
        if (analyticsScopeKey !== 'all') return [{ id: currentPid, name: 'Current Profile' }];
        const profiles = await makeApiRequest('GET', '/profiles', null, NDNS_API_KEY).catch((err) => {
            const message = formatAnalyticsErrorMessage(err);
            errors.push({
                type: 'profile-list',
                profileId: currentPid,
                profileName: 'Current Profile',
                endpoint: '/profiles',
                message
            });
            console.warn('[NDNS] Profile list failed:', message);
            return null;
        });
        const profileList = (profiles?.data || profiles || [])
            .filter(profile => profile?.id)
            .map(profile => ({ id: String(profile.id), name: String(profile.name || profile.id) }));
        if (profileList.length === 0) return [{ id: currentPid, name: 'Current Profile' }];
        return profileList;
    }

    async function fetchAnalyticsPayload(profile, windowConfig, rangeParams) {
        const errors = [];
        const safeApi = buildAnalyticsSafeApi(profile, errors);
        const withRange = (params = {}) => ({ ...rangeParams, ...params });
        const seriesPromise = windowConfig.bucketCount ? fetchAnalyticsStatusSeries(safeApi, windowConfig).catch((err) => {
            const message = formatAnalyticsErrorMessage(err);
            errors.push({
                type: 'rollup',
                profileId: profile.id,
                profileName: profile.name,
                endpoint: 'status rollup',
                message
            });
            console.warn(`[NDNS] Analytics rollup failed for ${profile.id}:`, message);
            return null;
        }) : Promise.resolve([]);

        const [domains, blockedDomains, statusData, dnssecData, encryptionData, protocolsData, queryTypesData, ipVersionsData, destinationsData, devicesData, statusSeries] = await Promise.all([
            safeApi('domains', withRange({ limit: 50 })),
            safeApi('domains', withRange({ status: 'blocked', limit: 30 })),
            safeApi('status', rangeParams),
            safeApi('dnssec', rangeParams),
            safeApi('encryption', rangeParams),
            safeApi('protocols', rangeParams),
            safeApi('queryTypes', rangeParams),
            safeApi('ipVersions', rangeParams),
            safeApi('destinations', rangeParams),
            safeApi('devices', rangeParams),
            seriesPromise
        ]);

        return {
            profile,
            safeApi,
            domains: filterAnalyticsDomains(normalizeAnalyticsData(domains)),
            blocked: filterAnalyticsDomains(normalizeAnalyticsData(blockedDomains)),
            status: normalizeAnalyticsData(statusData),
            dnssec: normalizeAnalyticsData(dnssecData),
            encryption: normalizeAnalyticsData(encryptionData),
            protocols: normalizeAnalyticsData(protocolsData),
            queryTypes: normalizeAnalyticsData(queryTypesData),
            ipVersions: normalizeAnalyticsData(ipVersionsData),
            destinations: normalizeAnalyticsData(destinationsData),
            devices: normalizeAnalyticsData(devicesData),
            statusSeries: statusSeries || [],
            errors
        };
    }

    function mergeAnalyticsField(payloads, field) {
        const merged = new Map();
        payloads.forEach((payload) => {
            resolveItems(payload[field]).forEach((item) => {
                const key = item.name.toLowerCase();
                if (!merged.has(key)) merged.set(key, { name: item.name, queries: 0 });
                merged.get(key).queries += item.value;
            });
        });
        return Array.from(merged.values()).sort((a, b) => b.queries - a.queries);
    }

    function mergeAnalyticsSeries(payloads) {
        const merged = new Map();
        payloads.forEach((payload) => {
            (payload.statusSeries || []).forEach((point) => {
                const key = `${point.from}|${point.to}|${point.label}`;
                if (!merged.has(key)) merged.set(key, { label: point.label, from: point.from, to: point.to, total: 0, allowed: 0, blocked: 0, blockedPct: 0 });
                const target = merged.get(key);
                target.total += point.total;
                target.allowed += point.allowed;
                target.blocked += point.blocked;
            });
        });
        return Array.from(merged.values()).map((point) => ({
            ...point,
            blockedPct: point.total > 0 ? (point.blocked / point.total * 100) : 0
        })).sort((a, b) => new Date(a.from) - new Date(b.from));
    }

    function buildProfileSummaries(payloads) {
        return payloads.map((payload) => {
            const summary = summarizeStatusItems(resolveItems(payload.status));
            return {
                id: payload.profile.id,
                name: payload.profile.name,
                ...summary
            };
        }).sort((a, b) => b.total - a.total);
    }

    function mergeAnalyticsPayloads(payloads, windowConfig, rangeParams, scopeKey, errors = []) {
        const profileSummaries = buildProfileSummaries(payloads);
        const payloadErrors = payloads.flatMap(payload => payload.errors || []);
        const allErrors = [...errors, ...payloadErrors];
        return {
            window: {
                key: windowConfig.key,
                label: windowConfig.label,
                description: windowConfig.description,
                range: rangeParams
            },
            scope: {
                key: scopeKey,
                label: scopeKey === 'all' ? 'All Profiles' : 'Current Profile',
                profileCount: payloads.length,
                errorCount: allErrors.length
            },
            profileSummaries,
            errors: allErrors,
            domains: mergeAnalyticsField(payloads, 'domains'),
            blocked: mergeAnalyticsField(payloads, 'blocked'),
            status: mergeAnalyticsField(payloads, 'status'),
            dnssec: mergeAnalyticsField(payloads, 'dnssec'),
            encryption: mergeAnalyticsField(payloads, 'encryption'),
            protocols: mergeAnalyticsField(payloads, 'protocols'),
            queryTypes: mergeAnalyticsField(payloads, 'queryTypes'),
            ipVersions: mergeAnalyticsField(payloads, 'ipVersions'),
            destinations: mergeAnalyticsField(payloads, 'destinations'),
            devices: mergeAnalyticsField(payloads, 'devices'),
            statusSeries: mergeAnalyticsSeries(payloads),
            deviceDrilldowns: [],
            categorySpikes: []
        };
    }

    function formatShortDate(date) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function formatAnalyticsNumber(value) {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return String(value);
    }

    function buildAnalyticsBuckets(config) {
        if (!config?.days || !config?.bucketCount) return [];
        const to = new Date();
        const from = new Date(to.getTime() - (config.days * ANALYTICS_DAY_MS));
        const bucketMs = (to.getTime() - from.getTime()) / config.bucketCount;
        return Array.from({ length: config.bucketCount }, (_, idx) => {
            const bucketFrom = new Date(from.getTime() + (idx * bucketMs));
            const bucketTo = idx === config.bucketCount - 1 ? to : new Date(from.getTime() + ((idx + 1) * bucketMs));
            return {
                from: bucketFrom,
                to: bucketTo,
                label: formatShortDate(bucketFrom)
            };
        });
    }

    async function fetchAnalyticsStatusSeries(safeApi, config) {
        const buckets = buildAnalyticsBuckets(config);
        const rows = [];
        for (const bucket of buckets) {
            const raw = await safeApi('status', { from: bucket.from.toISOString(), to: bucket.to.toISOString() });
            const items = resolveItems(normalizeAnalyticsData(raw));
            rows.push({
                label: bucket.label,
                from: bucket.from.toISOString(),
                to: bucket.to.toISOString(),
                ...summarizeStatusItems(items)
            });
        }
        return rows;
    }

    function buildAnalyticsHeader(pid, container) {
        const header = document.createElement('div');
        header.className = 'ndns-analytics-header';

        const h2 = document.createElement('h2');
        h2.textContent = uiText('analyticsDashboard');
        header.appendChild(h2);

        const controls = document.createElement('div');
        controls.className = 'ndns-analytics-controls';

        const rangeSelect = document.createElement('select');
        rangeSelect.setAttribute('aria-label', 'Analytics range');
        ANALYTICS_WINDOWS.forEach((windowConfig) => {
            const option = document.createElement('option');
            option.value = windowConfig.key;
            option.textContent = `${windowConfig.label} - ${windowConfig.description}`;
            option.selected = windowConfig.key === analyticsWindowKey;
            rangeSelect.appendChild(option);
        });
        rangeSelect.onchange = () => {
            analyticsWindowKey = rangeSelect.value;
            analyticsCache = null;
            container.innerHTML = '';
            renderAnalyticsDashboard(pid, container);
        };
        controls.appendChild(rangeSelect);

        const scopeSelect = document.createElement('select');
        scopeSelect.setAttribute('aria-label', 'Analytics profile scope');
        ANALYTICS_SCOPES.forEach((scopeConfig) => {
            const option = document.createElement('option');
            option.value = scopeConfig.key;
            option.textContent = scopeConfig.label;
            option.selected = scopeConfig.key === analyticsScopeKey;
            scopeSelect.appendChild(option);
        });
        scopeSelect.onchange = () => {
            analyticsScopeKey = scopeSelect.value;
            analyticsCache = null;
            container.innerHTML = '';
            renderAnalyticsDashboard(pid, container);
        };
        controls.appendChild(scopeSelect);

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = uiText('refresh');
        refreshBtn.onclick = () => {
            analyticsCache = null;
            container.innerHTML = '';
            renderAnalyticsDashboard(pid, container);
        };
        controls.appendChild(refreshBtn);

        const csvBtn = document.createElement('button');
        csvBtn.textContent = uiText('exportCsv');
        csvBtn.onclick = () => exportAnalyticsCSV(pid);
        controls.appendChild(csvBtn);

        const jsonBtn = document.createElement('button');
        jsonBtn.textContent = uiText('exportJson');
        jsonBtn.onclick = () => exportAnalyticsJSON(pid);
        controls.appendChild(jsonBtn);

        const pdfBtn = document.createElement('button');
        pdfBtn.textContent = uiText('exportPdf');
        pdfBtn.onclick = () => exportAnalyticsPDF(pid);
        controls.appendChild(pdfBtn);

        header.appendChild(controls);
        return header;
    }

    function buildAnalyticsWarning(cache, retryHandler) {
        const errors = cache?.errors || [];
        if (!errors.length) return null;
        const warning = document.createElement('div');
        warning.className = 'ndns-analytics-warning';
        warning.setAttribute('role', 'status');
        warning.setAttribute('aria-live', 'polite');

        const body = document.createElement('div');
        body.appendChild(createSafeElement('strong', {
            text: `Partial analytics data: ${errors.length} request${errors.length === 1 ? '' : 's'} failed`
        }));
        body.appendChild(createSafeElement('div', {
            text: 'Showing all data that loaded successfully. Exports include these errors.'
        }));
        const list = document.createElement('ul');
        errors.slice(0, 5).forEach((error) => {
            list.appendChild(createSafeElement('li', {
                text: `${error.profileName || error.profileId || 'Profile'} / ${error.endpoint || error.type}: ${error.message}`
            }));
        });
        if (errors.length > 5) {
            list.appendChild(createSafeElement('li', { text: `${errors.length - 5} more errors included in exports.` }));
        }
        body.appendChild(list);

        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry Analytics';
        retryBtn.onclick = retryHandler;
        warning.append(body, retryBtn);
        return warning;
    }

    async function renderAnalyticsDashboard(pid, container) {
        container.innerHTML = '';
        container.appendChild(buildAnalyticsHeader(pid, container));

        const loading = document.createElement('div');
        loading.className = 'ndns-analytics-loading';
        loading.setAttribute('role', 'status');
        loading.setAttribute('aria-live', 'polite');
        loading.innerHTML = '<div class="spinner"></div><span>Loading analytics data...</span>';
        container.appendChild(loading);

        try {
            const windowConfig = getAnalyticsWindowConfig();
            const rangeParams = buildAnalyticsRangeParams(windowConfig);
            const analyticsErrors = [];
            const profiles = await loadAnalyticsProfiles(pid, analyticsErrors);

            console.log('[NDNS] Fetching analytics range:', windowConfig.key, 'scope:', analyticsScopeKey, 'profiles:', profiles.length);

            const payloads = [];
            for (const profile of profiles) {
                try {
                    payloads.push(await fetchAnalyticsPayload(profile, windowConfig, rangeParams));
                } catch (err) {
                    const message = formatAnalyticsErrorMessage(err);
                    analyticsErrors.push({
                        type: 'profile',
                        profileId: profile.id,
                        profileName: profile.name,
                        endpoint: 'profile analytics',
                        message
                    });
                    console.warn(`[NDNS] Analytics profile failed for ${profile.id}:`, message);
                }
            }

            if (payloads.length === 0) {
                throw new Error(analyticsErrors.length ? analyticsErrors.map(error => error.message).join('; ') : 'No analytics profiles loaded');
            }

            analyticsCache = mergeAnalyticsPayloads(payloads, windowConfig, rangeParams, analyticsScopeKey, analyticsErrors);

            if (analyticsScopeKey === 'current' && payloads[0]) {
                try {
                    const safeApi = buildAnalyticsSafeApi(payloads[0].profile, analyticsCache.errors);
                    analyticsCache.deviceDrilldowns = await fetchDeviceDrilldowns(safeApi, payloads[0].devices, rangeParams);
                } catch (err) {
                    analyticsCache.errors.push({
                        type: 'device-drilldown',
                        profileId: payloads[0].profile.id,
                        profileName: payloads[0].profile.name,
                        endpoint: 'device drill-down',
                        message: formatAnalyticsErrorMessage(err)
                    });
                    console.warn('[NDNS] Device drill-down failed:', err?.message || err);
                }
            }

            if (analyticsScopeKey === 'current') {
                try {
                    const safeApi = buildAnalyticsSafeApi(payloads[0]?.profile || { id: pid, name: 'Current Profile' }, analyticsCache.errors);
                    analyticsCache.categorySpikes = await fetchBlockedCategorySpikes(safeApi, windowConfig);
                    notifyBlockedCategorySpikes(pid, windowConfig.key, analyticsCache.categorySpikes);
                } catch (err) {
                    analyticsCache.errors.push({
                        type: 'category-spikes',
                        profileId: payloads[0]?.profile?.id || pid,
                        profileName: payloads[0]?.profile?.name || 'Current Profile',
                        endpoint: 'blocked category spikes',
                        message: formatAnalyticsErrorMessage(err)
                    });
                    console.warn('[NDNS] Category anomaly detection failed:', err?.message || err);
                }
            }
            analyticsCache.scope.errorCount = analyticsCache.errors.length;

            console.log('[NDNS] Analytics data loaded successfully');

            loading.remove();
            const warning = buildAnalyticsWarning(analyticsCache, () => {
                analyticsCache = null;
                container.innerHTML = '';
                renderAnalyticsDashboard(pid, container);
            });
            if (warning) container.appendChild(warning);
            buildDashboardContent(container, analyticsCache);

        } catch (e) {
            loading.textContent = '';
            loading.appendChild(createSafeElement('span', {
                text: `Failed to load analytics: ${String(e?.message || e || 'Unknown error')}`,
                style: 'color:var(--danger-color);'
            }));
        }
    }

    function resolveItems(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data.map(d => {
            let name = d?.name || d?.category || d?.reason || d?.domain || d?.id || d?.status || d?.protocol || d?.type || 'Unknown';
            if (d?.validated !== undefined && !d?.name && !d?.domain) name = d.validated ? 'Validated' : 'Not Validated';
            if (d?.encrypted !== undefined && !d?.name && !d?.domain) name = d.encrypted ? 'Encrypted' : 'Unencrypted';
            return { name: String(name), value: d?.queries || d?.count || 0 };
        });
        if (typeof data === 'object') return Object.entries(data).map(([k, v]) => ({ name: k, value: typeof v === 'number' ? v : 0 }));
        return [];
    }

    function buildDashboardContent(container, data) {
        // --- Summary Stat Cards ---
        const statusItems = resolveItems(data.status);
        const statusSummary = summarizeStatusItems(statusItems);
        const totalQueries = statusSummary.total;
        const blockedCount = statusSummary.blocked;
        const allowedCount = statusSummary.allowed;
        const blockedPct = statusSummary.blockedPct.toFixed(1);
        const uniqueDomains = (data.domains || []).length;
        const deviceCount = resolveItems(data.devices).length;

        const cards = document.createElement('div');
        cards.className = 'ndns-stat-cards';
        const cardData = [
            { value: totalQueries.toLocaleString(), label: 'Total Queries', cls: '', sub: '' },
            { value: allowedCount.toLocaleString(), label: 'Allowed', cls: 'green', sub: totalQueries > 0 ? `${(allowedCount/totalQueries*100).toFixed(1)}% of total` : '' },
            { value: blockedCount.toLocaleString(), label: 'Blocked', cls: 'red', sub: `${blockedPct}% blocked` },
            { value: String(uniqueDomains), label: 'Unique Domains', cls: 'blue', sub: 'Top queried' },
            { value: String(deviceCount), label: 'Devices', cls: 'orange', sub: 'Active' }
        ];
        if (data.scope?.key === 'all') {
            cardData.splice(4, 0, { value: String(data.scope.profileCount || 0), label: 'Profiles', cls: 'orange', sub: 'Merged' });
        }
        cardData.forEach(c => {
            const card = document.createElement('div');
            card.className = 'ndns-stat-card';
            card.append(
                createSafeElement('div', { className: `card-value ${c.cls}`.trim(), text: c.value }),
                createSafeElement('div', { className: 'card-label', text: c.label })
            );
            if (c.sub) card.appendChild(createSafeElement('div', { className: 'card-sub', text: c.sub }));
            cards.appendChild(card);
        });
        container.appendChild(cards);

        if (data.profileSummaries?.length > 1) {
            const profileRow = document.createElement('div');
            profileRow.className = 'ndns-widget-grid';
            profileRow.appendChild(buildProfileSummaryWidget(data.profileSummaries));
            container.appendChild(profileRow);
        }

        if (data.statusSeries?.length) {
            const trendRow = document.createElement('div');
            trendRow.className = 'ndns-widget-grid';
            trendRow.appendChild(buildTimeSeriesWidget(data.statusSeries, data.window));
            container.appendChild(trendRow);
        }

        if (data.window?.range?.from && data.scope?.key === 'current') {
            const anomalyRow = document.createElement('div');
            anomalyRow.className = 'ndns-widget-grid';
            anomalyRow.appendChild(buildAnomalyWidget(data.categorySpikes || []));
            container.appendChild(anomalyRow);
        }

        // --- Row 1: Status Breakdown Ring + Query Types Ring ---
        const row1 = document.createElement('div');
        row1.className = 'ndns-widget-grid';
        row1.appendChild(buildRingWidget('Query Status', statusItems, ['#2cb67d','#e53170','#4ea8de','#f0b429','#845ef7','#ff6b6b']));
        row1.appendChild(buildRingWidget('Query Types', resolveItems(data.queryTypes), ANALYTICS_RING_COLORS));
        container.appendChild(row1);

        // --- Row 2: Top Queried Domains + Top Blocked Domains ---
        const row2 = document.createElement('div');
        row2.className = 'ndns-widget-grid';
        row2.appendChild(buildBarWidget('Top Queried Domains', data.domains, 30, 'purple'));
        row2.appendChild(buildBarWidget('Top Blocked Domains', data.blocked, 30, 'red'));
        container.appendChild(row2);

        // --- Row 3: Devices + Destinations ---
        const row3 = document.createElement('div');
        row3.className = 'ndns-widget-grid';
        row3.appendChild(buildBarWidget('Devices', data.devices, 15, 'teal'));
        row3.appendChild(buildBarWidget('Resolver Destinations', data.destinations, 15, 'blue'));
        container.appendChild(row3);

        if (data.deviceDrilldowns?.length) {
            const deviceRow = document.createElement('div');
            deviceRow.className = 'ndns-widget-grid';
            deviceRow.appendChild(buildDeviceDrilldownWidget(data.deviceDrilldowns));
            container.appendChild(deviceRow);
        }

        // --- Row 4: DNSSEC + Encryption + Protocols (3-col) ---
        const row4 = document.createElement('div');
        row4.className = 'ndns-widget-grid three-col';
        row4.appendChild(buildRingWidget('DNSSEC', resolveItems(data.dnssec), ['#2cb67d','#e53170','#4ea8de']));
        row4.appendChild(buildRingWidget('Encryption', resolveItems(data.encryption), ['#7f5af0','#f0b429','#e53170','#4ea8de']));
        row4.appendChild(buildRingWidget('Protocols', resolveItems(data.protocols), ['#4ea8de','#2cb67d','#f0b429','#845ef7']));
        container.appendChild(row4);

        // --- Row 5: IP Versions Ring + Full Status Table ---
        const row5 = document.createElement('div');
        row5.className = 'ndns-widget-grid';
        row5.appendChild(buildRingWidget('IP Versions', resolveItems(data.ipVersions), ['#4ea8de','#2cb67d','#f0b429']));
        row5.appendChild(buildTableWidget('All Query Statuses', statusItems));
        container.appendChild(row5);
    }

    // --- Widget Builders ---
    function buildAnomalyWidget(spikes) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget full-width';
        const h4 = document.createElement('h4');
        h4.textContent = 'Blocked Category Spikes';
        widget.appendChild(h4);

        if (!spikes || spikes.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No blocked category spikes detected';
            widget.appendChild(empty);
            return widget;
        }

        const list = document.createElement('div');
        list.className = 'ndns-anomaly-list';
        spikes.forEach((spike) => {
            const row = document.createElement('div');
            row.className = 'ndns-anomaly-row';
            const previousLabel = spike.previous > 0 ? spike.previous.toLocaleString() : '0';
            const ratioLabel = Number.isFinite(spike.ratio) ? `${spike.ratio.toFixed(1)}x` : 'new';
            row.append(
                createSafeElement('div', { className: 'ndns-anomaly-name', text: spike.category, title: spike.category }),
                createSafeElement('div', { className: 'ndns-anomaly-stat', text: `now ${spike.current.toLocaleString()}` }),
                createSafeElement('div', { className: 'ndns-anomaly-stat', text: `prev ${previousLabel}` }),
                createSafeElement('div', { className: 'ndns-anomaly-badge', text: ratioLabel })
            );
            list.appendChild(row);
        });
        widget.appendChild(list);
        return widget;
    }

    function buildProfileSummaryWidget(profiles) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget full-width';
        const h4 = document.createElement('h4');
        h4.textContent = 'Merged Profiles';
        widget.appendChild(h4);

        const table = document.createElement('table');
        table.className = 'ndns-data-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.append(
            createSafeElement('th', { text: 'Profile' }),
            createSafeElement('th', { className: 'right', text: 'Queries' }),
            createSafeElement('th', { className: 'right', text: 'Blocked' }),
            createSafeElement('th', { className: 'right', text: 'Blocked %' })
        );
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        (profiles || []).forEach((profile) => {
            const tr = document.createElement('tr');
            const pct = profile.total > 0 ? (profile.blocked / profile.total * 100).toFixed(1) : '0.0';
            tr.append(
                createSafeElement('td', {}, [
                    String(profile.name || ''),
                    ' ',
                    createSafeElement('span', {
                        text: profile.id || '',
                        style: 'color:var(--panel-text-secondary);font-family:monospace;'
                    })
                ]),
                createSafeElement('td', { className: 'right mono', text: profile.total.toLocaleString() }),
                createSafeElement('td', { className: 'right mono', text: profile.blocked.toLocaleString() }),
                createSafeElement('td', { className: 'right mono', text: `${pct}%` })
            );
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        widget.appendChild(table);
        return widget;
    }

    function buildTimeSeriesWidget(series, windowMeta) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget full-width';
        const h4 = document.createElement('h4');
        h4.textContent = `${windowMeta?.label || 'Historical'} Query Rollup`;
        widget.appendChild(h4);

        const points = (series || []).filter(point => point && Number.isFinite(point.total));
        const activePoints = points.filter(point => point.total > 0 || point.allowed > 0 || point.blocked > 0);
        if (activePoints.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No historical rollup data available';
            widget.appendChild(empty);
            return widget;
        }

        const width = 760;
        const height = 220;
        const padLeft = 54;
        const padRight = 20;
        const padTop = 18;
        const padBottom = 42;
        const plotWidth = width - padLeft - padRight;
        const plotHeight = height - padTop - padBottom;
        const maxTotal = Math.max(...points.map(point => point.total), 1);
        const xFor = (idx) => padLeft + (points.length === 1 ? plotWidth / 2 : (idx / (points.length - 1)) * plotWidth);
        const yFor = (value) => padTop + plotHeight - ((value / maxTotal) * plotHeight);
        const linePoints = points.map((point, idx) => `${xFor(idx).toFixed(1)},${yFor(point.total).toFixed(1)}`).join(' ');
        const labelEvery = Math.max(1, Math.ceil(points.length / 6));
        const avgTotal = Math.round(points.reduce((s, point) => s + point.total, 0) / points.length);
        const avgBlockedPct = points.reduce((s, point) => s + point.blockedPct, 0) / points.length;
        const peak = points.reduce((best, point) => point.total > best.total ? point : best, points[0]);
        const latest = points[points.length - 1];

        const gridLines = [0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = padTop + (plotHeight * step);
            const labelValue = Math.round(maxTotal * (1 - step));
            return `<line class="ndns-timeseries-grid" x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}"></line><text class="ndns-timeseries-axis" x="${padLeft - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${escapeHtml(formatAnalyticsNumber(labelValue))}</text>`;
        }).join('');
        const bars = points.map((point, idx) => {
            const x = xFor(idx);
            const barWidth = Math.max(8, Math.min(34, (plotWidth / points.length) * 0.46));
            const barHeight = Math.max(0, (point.blocked / maxTotal) * plotHeight);
            const y = padTop + plotHeight - barHeight;
            return `<rect class="ndns-timeseries-blocked" x="${(x - barWidth / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3"><title>${escapeHtml(point.label)} blocked: ${point.blocked.toLocaleString()}</title></rect>`;
        }).join('');
        const dots = points.map((point, idx) => `<circle class="ndns-timeseries-point" cx="${xFor(idx).toFixed(1)}" cy="${yFor(point.total).toFixed(1)}" r="4"><title>${escapeHtml(point.label)} total: ${point.total.toLocaleString()}</title></circle>`).join('');
        const labels = points.map((point, idx) => {
            if (idx !== 0 && idx !== points.length - 1 && idx % labelEvery !== 0) return '';
            return `<text class="ndns-timeseries-axis" x="${xFor(idx).toFixed(1)}" y="${height - 14}" text-anchor="middle">${escapeHtml(point.label)}</text>`;
        }).join('');

        const chart = document.createElement('div');
        chart.className = 'ndns-timeseries-chart';
        chart.innerHTML = `
            <svg class="ndns-timeseries-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(windowMeta?.label || 'Historical')} query trend">
                ${gridLines}
                ${bars}
                <polyline class="ndns-timeseries-total" points="${linePoints}"></polyline>
                ${dots}
                ${labels}
            </svg>
        `;
        widget.appendChild(chart);

        const summary = document.createElement('div');
        summary.className = 'ndns-timeseries-summary';
        summary.innerHTML = `
            <div class="ndns-timeseries-chip"><span>Latest bucket</span><strong>${latest.total.toLocaleString()}</strong></div>
            <div class="ndns-timeseries-chip"><span>Average bucket</span><strong>${avgTotal.toLocaleString()}</strong></div>
            <div class="ndns-timeseries-chip"><span>Peak bucket</span><strong>${peak.total.toLocaleString()}</strong></div>
            <div class="ndns-timeseries-chip"><span>Avg blocked</span><strong>${avgBlockedPct.toFixed(1)}%</strong></div>
        `;
        widget.appendChild(summary);
        return widget;
    }

    function buildDeviceDrilldownWidget(devices) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget full-width';
        const h4 = document.createElement('h4');
        h4.textContent = 'Device App Drill-down';
        widget.appendChild(h4);

        const activeDevices = (devices || []).filter(device => device.apps?.length);
        if (activeDevices.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No per-device app data available';
            widget.appendChild(empty);
            return widget;
        }

        const grid = document.createElement('div');
        grid.className = 'ndns-device-drilldown';
        activeDevices.forEach((device) => {
            const card = document.createElement('div');
            card.className = 'ndns-device-card';

            const header = document.createElement('div');
            header.className = 'ndns-device-head';
            const deviceInfo = document.createElement('div');
            deviceInfo.appendChild(createSafeElement('div', {
                className: 'ndns-device-name',
                text: device.name,
                title: device.name
            }));
            if (device.meta) {
                deviceInfo.appendChild(createSafeElement('div', {
                    className: 'ndns-device-meta',
                    text: device.meta,
                    title: device.meta
                }));
            }
            header.append(
                deviceInfo,
                createSafeElement('div', { className: 'ndns-device-count', text: device.queries.toLocaleString() })
            );
            card.appendChild(header);

            const maxAppQueries = Math.max(...device.apps.map(app => app.queries), 1);
            const appList = document.createElement('div');
            appList.className = 'ndns-app-list';
            device.apps.forEach((app) => {
                const pct = Math.max(2, app.queries / maxAppQueries * 100);
                const row = document.createElement('div');
                row.className = 'ndns-app-row';
                const appTrack = createSafeElement('div', { className: 'ndns-app-track' }, [
                    createSafeElement('div', { className: 'ndns-app-fill', style: `width:${pct.toFixed(1)}%` })
                ]);
                const domains = app.domains.join(', ');
                row.append(
                    createSafeElement('div', { className: 'ndns-app-name', text: app.name, title: app.name }),
                    appTrack,
                    createSafeElement('div', { className: 'ndns-app-count', text: app.queries.toLocaleString() }),
                    createSafeElement('div', { className: 'ndns-app-domains', text: domains, title: domains })
                );
                appList.appendChild(row);
            });
            card.appendChild(appList);
            grid.appendChild(card);
        });

        widget.appendChild(grid);
        return widget;
    }

    function buildBarWidget(title, rawData, limit, colorClass) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        const items = resolveItems(rawData).slice(0, limit);
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const maxVal = Math.max(...items.map(i => i.value), 1);
        const total = items.reduce((s, i) => s + i.value, 0);
        const chart = document.createElement('div');
        chart.className = 'ndns-bar-chart';

        items.forEach((item, idx) => {
            const pct = (item.value / maxVal * 100).toFixed(1);
            const pctOfTotal = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0';
            const row = document.createElement('div');
            row.className = 'ndns-bar-row';
            const track = createSafeElement('div', { className: 'ndns-bar-track' }, [
                createSafeElement('div', { className: `ndns-bar-fill ${colorClass}`, style: `width:${pct}%` })
            ]);
            row.append(
                createSafeElement('span', { className: 'ndns-bar-rank', text: idx + 1 }),
                createSafeElement('span', { className: 'ndns-bar-label', text: item.name, title: item.name }),
                track,
                createSafeElement('span', { className: 'ndns-bar-count', text: item.value.toLocaleString() }),
                createSafeElement('span', { className: 'ndns-bar-pct', text: `${pctOfTotal}%` })
            );
            chart.appendChild(row);
        });

        widget.appendChild(chart);
        return widget;
    }

    function buildRingWidget(title, items, colors) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const total = items.reduce((s, i) => s + i.value, 0);
        if (total === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const ringContainer = document.createElement('div');
        ringContainer.className = 'ndns-ring-chart';

        // SVG ring
        const size = 120;
        const radius = 46;
        const stroke = 14;
        const circumference = 2 * Math.PI * radius;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.classList.add('ndns-ring-svg');

        let offset = 0;
        items.forEach((item, i) => {
            const pct = item.value / total;
            const dashLen = pct * circumference;
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', size / 2);
            circle.setAttribute('cy', size / 2);
            circle.setAttribute('r', radius);
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', colors[i % colors.length]);
            circle.setAttribute('stroke-width', stroke);
            circle.setAttribute('stroke-dasharray', `${dashLen} ${circumference - dashLen}`);
            circle.setAttribute('stroke-dashoffset', -offset);
            circle.setAttribute('transform', `rotate(-90 ${size/2} ${size/2})`);
            circle.style.transition = 'stroke-dasharray 0.6s ease';
            svg.appendChild(circle);
            offset += dashLen;
        });

        // Center total text
        const centerText = document.createElementNS(svgNS, 'text');
        centerText.setAttribute('x', size / 2);
        centerText.setAttribute('y', size / 2);
        centerText.setAttribute('text-anchor', 'middle');
        centerText.setAttribute('dominant-baseline', 'central');
        centerText.setAttribute('fill', 'var(--panel-text)');
        centerText.setAttribute('font-size', '16');
        centerText.setAttribute('font-weight', '700');
        centerText.setAttribute('font-family', 'monospace');
        centerText.textContent = total >= 1000000 ? (total / 1000000).toFixed(1) + 'M' : total >= 1000 ? (total / 1000).toFixed(1) + 'K' : total;
        svg.appendChild(centerText);

        ringContainer.appendChild(svg);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'ndns-ring-legend';
        items.forEach((item, i) => {
            const row = document.createElement('div');
            row.className = 'ndns-ring-legend-item';
            const pctStr = (item.value / total * 100).toFixed(1);
            row.append(
                createSafeElement('span', { className: 'ndns-ring-legend-dot', style: `background:${colors[i % colors.length]}` }),
                createSafeElement('span', { text: item.name }),
                createSafeElement('span', { className: 'ndns-ring-legend-value', text: item.value.toLocaleString() }),
                createSafeElement('span', { className: 'ndns-ring-legend-pct', text: `${pctStr}%` })
            );
            legend.appendChild(row);
        });
        ringContainer.appendChild(legend);

        widget.appendChild(ringContainer);
        return widget;
    }

    function buildTableWidget(title, items) {
        const widget = document.createElement('div');
        widget.className = 'ndns-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const total = items.reduce((s, i) => s + i.value, 0);
        const table = document.createElement('table');
        table.className = 'ndns-data-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.append(
            createSafeElement('th', { text: 'Status' }),
            createSafeElement('th', { className: 'right', text: 'Queries' }),
            createSafeElement('th', { className: 'right', text: 'Share' })
        );
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        items.forEach(item => {
            const tr = document.createElement('tr');
            const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0';
            tr.append(
                createSafeElement('td', { text: item.name }),
                createSafeElement('td', { className: 'right mono', text: item.value.toLocaleString() }),
                createSafeElement('td', { className: 'right mono', text: `${pct}%` })
            );
            tbody.appendChild(tr);
        });

        // Total row
        const totalRow = document.createElement('tr');
        totalRow.style.cssText = 'font-weight:700; border-top:2px solid var(--panel-border);';
        totalRow.append(
            createSafeElement('td', { text: 'Total' }),
            createSafeElement('td', { className: 'right mono', text: total.toLocaleString() }),
            createSafeElement('td', { className: 'right mono', text: '100%' })
        );
        tbody.appendChild(totalRow);

        table.appendChild(tbody);
        widget.appendChild(table);
        return widget;
    }

    // --- Analytics Export ---
    function csvEscape(val) {
        const s = String(val);
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    function exportAnalyticsCSV(pid) {
        if (!analyticsCache) { showToast('No analytics data loaded.', true); return; }
        const exportSlug = analyticsCache.scope?.key === 'all' ? 'all-profiles' : pid;
        const sections = [];
        const addSection = (title, items) => {
            if (!items || items.length === 0) return;
            sections.push(`\n# ${title}`);
            sections.push('Name,Queries');
            resolveItems(items).forEach(i => sections.push(`${csvEscape(i.name)},${i.value}`));
        };
        addSection('Top Domains', analyticsCache.domains);
        addSection('Blocked Domains', analyticsCache.blocked);
        addSection('Query Status', analyticsCache.status);
        addSection('Query Types', analyticsCache.queryTypes);
        addSection('Devices', analyticsCache.devices);
        addSection('DNSSEC', analyticsCache.dnssec);
        addSection('Encryption', analyticsCache.encryption);
        addSection('Protocols', analyticsCache.protocols);
        addSection('IP Versions', analyticsCache.ipVersions);
        addSection('Destinations', analyticsCache.destinations);
        if (analyticsCache.profileSummaries?.length > 1) {
            sections.push('\n# Merged Profiles');
            sections.push('Profile,Profile ID,Total Queries,Allowed,Blocked,Blocked Percent');
            analyticsCache.profileSummaries.forEach((profile) => {
                sections.push([
                    csvEscape(profile.name),
                    csvEscape(profile.id),
                    profile.total,
                    profile.allowed,
                    profile.blocked,
                    profile.blockedPct.toFixed(1)
                ].join(','));
            });
        }
        if (analyticsCache.deviceDrilldowns?.length) {
            sections.push('\n# Device App Drill-down');
            sections.push('Device,Device Queries,App Guess,App Queries,Top Domains');
            analyticsCache.deviceDrilldowns.forEach((device) => {
                device.apps.forEach((app) => {
                    sections.push([
                        csvEscape(device.name),
                        device.queries,
                        csvEscape(app.name),
                        app.queries,
                        csvEscape(app.domains.join(' | '))
                    ].join(','));
                });
            });
        }
        if (analyticsCache.categorySpikes?.length) {
            sections.push('\n# Blocked Category Spikes');
            sections.push('Category,Current,Previous,Ratio,Change Percent,Endpoint');
            analyticsCache.categorySpikes.forEach((spike) => {
                sections.push([
                    csvEscape(spike.category),
                    spike.current,
                    spike.previous,
                    Number.isFinite(spike.ratio) ? spike.ratio.toFixed(2) : 'new',
                    spike.changePct.toFixed(1),
                    csvEscape(spike.endpoint)
                ].join(','));
            });
        }
        if (analyticsCache.statusSeries?.length) {
            sections.push('\n# Historical Rollup');
            sections.push('Period,From,To,Total Queries,Allowed,Blocked,Blocked Percent');
            analyticsCache.statusSeries.forEach((point) => {
                sections.push([
                    csvEscape(point.label),
                    csvEscape(point.from),
                    csvEscape(point.to),
                    point.total,
                    point.allowed,
                    point.blocked,
                    point.blockedPct.toFixed(1)
                ].join(','));
            });
        }
        if (analyticsCache.errors?.length) {
            sections.push('\n# Analytics Errors');
            sections.push('Type,Profile,Profile ID,Endpoint,Message');
            analyticsCache.errors.forEach((error) => {
                sections.push([
                    csvEscape(error.type || 'request'),
                    csvEscape(error.profileName || ''),
                    csvEscape(error.profileId || ''),
                    csvEscape(error.endpoint || ''),
                    csvEscape(error.message || '')
                ].join(','));
            });
        }
        downloadFile(sections.join('\n'), `nextdns-analytics-${exportSlug}-${analyticsCache.window?.key || 'api'}.csv`, 'text/csv');
        showToast('Full analytics exported as CSV.');
    }

    function exportAnalyticsJSON(pid) {
        if (!analyticsCache) { showToast('No analytics data loaded.', true); return; }
        const exportSlug = analyticsCache.scope?.key === 'all' ? 'all-profiles' : pid;
        const exportData = { exportedAt: new Date().toISOString(), ...analyticsCache };
        downloadFile(JSON.stringify(exportData, null, 2), `nextdns-analytics-${exportSlug}-${analyticsCache.window?.key || 'api'}.json`, 'application/json');
        showToast('Full analytics exported as JSON.');
    }

    function buildReportTable(title, headers, rows) {
        if (!rows || rows.length === 0) return '';
        return `
            <section class="report-section">
                <h2>${escapeHtml(title)}</h2>
                <table>
                    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </section>
        `;
    }

    function buildMetricRows(items, limit = 20) {
        const resolved = resolveItems(items).slice(0, limit);
        const total = resolved.reduce((s, item) => s + item.value, 0);
        return resolved.map(item => [
            item.name,
            item.value.toLocaleString(),
            total > 0 ? `${(item.value / total * 100).toFixed(1)}%` : '0.0%'
        ]);
    }

    function buildDeviceReportRows(devices) {
        const rows = [];
        (devices || []).forEach((device) => {
            (device.apps || []).forEach((app) => {
                rows.push([
                    device.name,
                    device.queries.toLocaleString(),
                    app.name,
                    app.queries.toLocaleString(),
                    app.domains.join(', ')
                ]);
            });
        });
        return rows;
    }

    function buildRollupReportRows(series) {
        return (series || []).map(point => [
            point.label,
            point.total.toLocaleString(),
            point.allowed.toLocaleString(),
            point.blocked.toLocaleString(),
            `${point.blockedPct.toFixed(1)}%`
        ]);
    }

    function buildAnomalyReportRows(spikes) {
        return (spikes || []).map(spike => [
            spike.category,
            spike.current.toLocaleString(),
            spike.previous.toLocaleString(),
            Number.isFinite(spike.ratio) ? `${spike.ratio.toFixed(1)}x` : 'new',
            `${spike.changePct.toFixed(1)}%`
        ]);
    }

    function buildProfileReportRows(profiles) {
        return (profiles || []).map(profile => [
            profile.name,
            profile.id,
            profile.total.toLocaleString(),
            profile.allowed.toLocaleString(),
            profile.blocked.toLocaleString(),
            `${profile.blockedPct.toFixed(1)}%`
        ]);
    }

    function buildAnalyticsErrorReportRows(errors) {
        return (errors || []).map(error => [
            error.type || 'request',
            error.profileName || '',
            error.profileId || '',
            error.endpoint || '',
            error.message || ''
        ]);
    }

    function buildAnalyticsReportHTML(pid) {
        const statusItems = resolveItems(analyticsCache.status);
        const summary = summarizeStatusItems(statusItems);
        const generatedAt = new Date().toLocaleString();
        const windowLabel = analyticsCache.window?.label || 'API Default';
        const windowDescription = analyticsCache.window?.description || 'Native NextDNS window';
        const profileLabel = analyticsCache.scope?.key === 'all' ? `${analyticsCache.scope.profileCount} profiles` : pid;
        const topDomainRows = buildMetricRows(analyticsCache.domains, 20);
        const blockedRows = buildMetricRows(analyticsCache.blocked, 20);
        const deviceRows = buildMetricRows(analyticsCache.devices, 20);
        const deviceAppRows = buildDeviceReportRows(analyticsCache.deviceDrilldowns);
        const rollupRows = buildRollupReportRows(analyticsCache.statusSeries);
        const anomalyRows = buildAnomalyReportRows(analyticsCache.categorySpikes);
        const profileRows = buildProfileReportRows(analyticsCache.profileSummaries?.length > 1 ? analyticsCache.profileSummaries : []);
        const errorRows = buildAnalyticsErrorReportRows(analyticsCache.errors);

        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>NDNS Analytics Report - ${escapeHtml(pid)}</title>
<style>
    :root { color-scheme: light; --accent:#6246ea; --green:#1f9d5c; --red:#c2255c; --ink:#14161f; --muted:#5b6272; --line:#d8dce6; --bg:#f6f7fb; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: var(--bg); }
    .report { max-width: 1040px; margin: 0 auto; background: #fff; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
    header { padding: 28px 32px; color: #fff; background: linear-gradient(135deg, #16161a, var(--accent)); }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.86; }
    h1 { margin: 8px 0 6px; font-size: 30px; line-height: 1.1; }
    .subtitle { margin: 0; font-size: 13px; opacity: 0.9; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 18px 32px; border-bottom: 1px solid var(--line); background: #fbfcff; }
    .meta div, .card { padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .label { display: block; margin-bottom: 4px; color: var(--muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    .value { font-size: 15px; font-weight: 700; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 22px 32px 6px; }
    .card strong { display: block; font-size: 22px; }
    .card.total strong { color: var(--accent); }
    .card.allowed strong { color: var(--green); }
    .card.blocked strong { color: var(--red); }
    .report-section { padding: 20px 32px; break-inside: avoid; }
    h2 { margin: 0 0 10px; font-size: 17px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid var(--line); }
    td { padding: 8px; border-bottom: 1px solid #edf0f5; vertical-align: top; }
    tr:nth-child(even) td { background: #fafbfe; }
    footer { padding: 18px 32px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--line); }
    @media print {
        body { padding: 0; background: #fff; }
        .report { border: 0; border-radius: 0; }
        header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .meta, .cards { grid-template-columns: repeat(2, 1fr); }
    }
</style>
</head>
<body>
<main class="report">
    <header>
        <div class="brand">NDNS / NextDNS</div>
        <h1>Analytics Report</h1>
        <p class="subtitle">Prepared from the loaded NDNS analytics dashboard.</p>
    </header>
    <section class="meta">
        <div><span class="label">Profile</span><span class="value">${escapeHtml(profileLabel)}</span></div>
        <div><span class="label">Range</span><span class="value">${escapeHtml(windowLabel)}</span></div>
        <div><span class="label">Rollup</span><span class="value">${escapeHtml(windowDescription)}</span></div>
        <div><span class="label">Generated</span><span class="value">${escapeHtml(generatedAt)}</span></div>
    </section>
    <section class="cards">
        <div class="card total"><span class="label">Total Queries</span><strong>${summary.total.toLocaleString()}</strong></div>
        <div class="card allowed"><span class="label">Allowed</span><strong>${summary.allowed.toLocaleString()}</strong></div>
        <div class="card blocked"><span class="label">Blocked</span><strong>${summary.blocked.toLocaleString()}</strong></div>
        <div class="card"><span class="label">Blocked Rate</span><strong>${summary.blockedPct.toFixed(1)}%</strong></div>
    </section>
    ${buildReportTable('Historical Rollup', ['Period', 'Total', 'Allowed', 'Blocked', 'Blocked %'], rollupRows)}
    ${buildReportTable('Merged Profiles', ['Profile', 'ID', 'Total', 'Allowed', 'Blocked', 'Blocked %'], profileRows)}
    ${buildReportTable('Analytics Errors', ['Type', 'Profile', 'Profile ID', 'Endpoint', 'Message'], errorRows)}
    ${buildReportTable('Blocked Category Spikes', ['Category', 'Current', 'Previous', 'Ratio', 'Change %'], anomalyRows)}
    ${buildReportTable('Top Queried Domains', ['Domain', 'Queries', 'Share'], topDomainRows)}
    ${buildReportTable('Top Blocked Domains', ['Domain', 'Queries', 'Share'], blockedRows)}
    ${buildReportTable('Devices', ['Device', 'Queries', 'Share'], deviceRows)}
    ${buildReportTable('Device App Drill-down', ['Device', 'Device Queries', 'App Guess', 'App Queries', 'Top Domains'], deviceAppRows)}
    ${buildReportTable('Query Status', ['Status', 'Queries', 'Share'], buildMetricRows(analyticsCache.status, 20))}
    ${buildReportTable('Query Types', ['Type', 'Queries', 'Share'], buildMetricRows(analyticsCache.queryTypes, 20))}
    ${buildReportTable('DNSSEC', ['State', 'Queries', 'Share'], buildMetricRows(analyticsCache.dnssec, 20))}
    ${buildReportTable('Encryption', ['State', 'Queries', 'Share'], buildMetricRows(analyticsCache.encryption, 20))}
    ${buildReportTable('Protocols', ['Protocol', 'Queries', 'Share'], buildMetricRows(analyticsCache.protocols, 20))}
    ${buildReportTable('IP Versions', ['Version', 'Queries', 'Share'], buildMetricRows(analyticsCache.ipVersions, 20))}
    ${buildReportTable('Destinations', ['Destination', 'Queries', 'Share'], buildMetricRows(analyticsCache.destinations, 20))}
    <footer>NDNS report generated locally in the browser. API key and analytics data were not sent to a third-party reporting service.</footer>
</main>
<script>
    window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 350));
<\/script>
</body>
</html>`;
    }

    function exportAnalyticsPDF(pid) {
        if (!analyticsCache) { showToast('No analytics data loaded.', true); return; }
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            showToast('Popup blocked. Allow popups to export the PDF report.', true);
            return;
        }
        reportWindow.document.open();
        reportWindow.document.write(buildAnalyticsReportHTML(pid));
        reportWindow.document.close();
        showToast('PDF report opened. Choose Save as PDF in the print dialog.');
    }

    // --- SCHEDULED LOG DOWNLOADS ---
    function initScheduledLogs() {
        if (!scheduledLogsConfig.enabled) return;
        if (scheduledLogTimer) clearInterval(scheduledLogTimer);

        const intervals = { hourly: 3600000, daily: 86400000, weekly: 604800000 };
        const intervalMs = intervals[scheduledLogsConfig.interval] || 86400000;

        const checkAndDownload = async () => {
            // Only auto-download when on the logs page to avoid surprise downloads
            if (!/\/logs/.test(location.href)) return;
            const now = Date.now();
            const lastRun = scheduledLogsConfig.lastRun || 0;
            if (now - lastRun >= intervalMs) {
                await quickDownloadLogs();
                scheduledLogsConfig.lastRun = now;
                await storage.set({ [KEY_SCHEDULED_LOGS]: scheduledLogsConfig });
            }
        };

        checkAndDownload();
        scheduledLogTimer = setInterval(checkAndDownload, 60000);
    }

    // --- PARENTAL WEEKLY SCHEDULE ---
    const PARENTAL_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const PARENTAL_DEVICE_OVERRIDE_ACTIVITY_MINUTES = 60;

    function createDefaultWeeklySlots() {
        return Array.from({ length: 7 }, () => Array(24).fill(false));
    }

    function normalizeParentalWeeklySchedule(value = {}) {
        value = value && typeof value === 'object' ? value : {};
        const slots = createDefaultWeeklySlots();
        (value.slots || []).forEach((daySlots, day) => {
            if (!Array.isArray(daySlots) || day > 6) return;
            daySlots.slice(0, 24).forEach((active, hour) => {
                slots[day][hour] = !!active;
            });
        });

        return {
            enabled: !!value.enabled,
            slots,
            lastApplied: typeof value.lastApplied === 'boolean' ? value.lastApplied : null
        };
    }

    function isParentalWeeklySlotActive(date = new Date()) {
        parentalWeeklySchedule = normalizeParentalWeeklySchedule(parentalWeeklySchedule);
        return !!parentalWeeklySchedule.slots[date.getDay()]?.[date.getHours()];
    }

    async function saveParentalWeeklySchedule() {
        parentalWeeklySchedule = normalizeParentalWeeklySchedule(parentalWeeklySchedule);
        await storage.set({ [KEY_PARENTAL_WEEKLY_SCHEDULE]: parentalWeeklySchedule });
    }

    function updateParentalWeeklyStatusElement() {
        const status = document.getElementById('ndns-parental-weekly-status');
        if (!status) return;
        const active = isParentalWeeklySlotActive();
        status.textContent = parentalWeeklySchedule.enabled
            ? `Current slot: ${active ? 'Recreation on' : 'Recreation off'}`
            : 'Weekly schedule disabled.';
    }

    async function applyParentalWeeklySchedule() {
        if (!parentalWeeklySchedule.enabled || parentalWeeklyApplying || !NDNS_API_KEY) return;
        if (parentalDeviceOverrides.activeRuleId) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        parentalWeeklyApplying = true;
        try {
            const desired = isParentalWeeklySlotActive();
            const config = await makeApiRequest('GET', `/profiles/${pid}/parentalControl`, null, NDNS_API_KEY);
            const current = !!config.recreationTime?.enabled;
            if (current !== desired) {
                const recreationTime = { ...(config.recreationTime || {}), enabled: desired };
                await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, { recreationTime }, NDNS_API_KEY);
            }

            if (parentalWeeklySchedule.lastApplied !== desired) {
                parentalWeeklySchedule.lastApplied = desired;
                await saveParentalWeeklySchedule();
            }
            parentalWeeklyLastErrorAt = 0;
            updateParentalWeeklyStatusElement();
        } catch (e) {
            const now = Date.now();
            if (now - parentalWeeklyLastErrorAt > 300000) {
                showToast(`Weekly schedule failed: ${e.message}`, true, 5000);
                parentalWeeklyLastErrorAt = now;
            }
        } finally {
            parentalWeeklyApplying = false;
        }
    }

    function initParentalWeeklySchedule() {
        if (parentalWeeklyTimer) {
            clearInterval(parentalWeeklyTimer);
            parentalWeeklyTimer = null;
        }
        if (!parentalWeeklySchedule.enabled) {
            updateParentalWeeklyStatusElement();
            return;
        }

        applyParentalWeeklySchedule();
        parentalWeeklyTimer = setInterval(applyParentalWeeklySchedule, 60000);
    }

    // --- PARENTAL DEVICE OVERRIDES ---
    function normalizeTimeValue(value, fallback) {
        const text = String(value || '').trim();
        return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
    }

    function normalizeParentalDeviceOverrides(value = {}) {
        value = value && typeof value === 'object' ? value : {};
        const rawRules = Array.isArray(value) ? value : (Array.isArray(value.rules) ? value.rules : []);
        const rules = rawRules.map((rule, idx) => {
            const deviceId = String(rule?.deviceId || rule?.device || '').trim();
            if (!deviceId) return null;
            const days = Array.isArray(rule.days) ? rule.days.map(Number).filter(day => day >= 0 && day <= 6) : [0, 1, 2, 3, 4, 5, 6];
            const uniqueDays = Array.from(new Set(days)).sort((a, b) => a - b);
            return {
                id: String(rule.id || `${deviceId}-${idx}`),
                deviceId,
                deviceName: String(rule.deviceName || rule.name || deviceId).trim() || deviceId,
                days: uniqueDays.length ? uniqueDays : [0, 1, 2, 3, 4, 5, 6],
                start: normalizeTimeValue(rule.start, '20:00'),
                end: normalizeTimeValue(rule.end, '07:00'),
                action: rule.action === 'on' ? 'on' : 'off',
                enabled: rule.enabled !== false,
                lastApplied: Number.isFinite(Number(rule.lastApplied)) ? Number(rule.lastApplied) : null
            };
        }).filter(Boolean).slice(0, 20);
        const activeRuleId = rules.some(rule => rule.id === value.activeRuleId) ? value.activeRuleId : null;

        return {
            rules,
            activeRuleId,
            previousRecreationEnabled: typeof value.previousRecreationEnabled === 'boolean' ? value.previousRecreationEnabled : null
        };
    }

    async function saveParentalDeviceOverrides() {
        parentalDeviceOverrides = normalizeParentalDeviceOverrides(parentalDeviceOverrides);
        await storage.set({ [KEY_PARENTAL_DEVICE_OVERRIDES]: parentalDeviceOverrides });
    }

    function timeToMinutes(value) {
        const [hours, minutes] = normalizeTimeValue(value, '00:00').split(':').map(Number);
        return (hours * 60) + minutes;
    }

    function isTimeWithinWindow(start, end, date = new Date()) {
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);
        const nowMinutes = (date.getHours() * 60) + date.getMinutes();
        if (startMinutes === endMinutes) return true;
        if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
        return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }

    function getScheduleDayForWindow(start, end, date = new Date()) {
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);
        const nowMinutes = (date.getHours() * 60) + date.getMinutes();
        if (startMinutes > endMinutes && nowMinutes < endMinutes) return (date.getDay() + 6) % 7;
        return date.getDay();
    }

    function formatDeviceOverrideDays(days) {
        return (days || []).map(day => PARENTAL_WEEKDAYS[day]).filter(Boolean).join(', ');
    }

    async function fetchParentalDeviceOptions(pid) {
        const to = new Date();
        const from = new Date(to.getTime() - (30 * ANALYTICS_DAY_MS));
        const raw = await makeApiRequest('GET', `/profiles/${pid}/analytics/${buildAnalyticsEndpoint('devices', {
            from: from.toISOString(),
            to: to.toISOString(),
            limit: 100
        })}`, null, NDNS_API_KEY).catch((err) => {
            console.warn('[NDNS] Device option lookup failed:', err?.message || err);
            return null;
        });

        return normalizeAnalyticsData(raw)
            .map(normalizeDeviceItem)
            .filter(device => device.id && device.id !== 'unknown-device')
            .sort((a, b) => b.queries - a.queries);
    }

    async function fetchRecentDeviceActivity(pid) {
        const to = new Date();
        const from = new Date(to.getTime() - (PARENTAL_DEVICE_OVERRIDE_ACTIVITY_MINUTES * 60000));
        const raw = await makeApiRequest('GET', `/profiles/${pid}/analytics/${buildAnalyticsEndpoint('devices', {
            from: from.toISOString(),
            to: to.toISOString(),
            limit: 100
        })}`, null, NDNS_API_KEY);

        return normalizeAnalyticsData(raw)
            .map(normalizeDeviceItem)
            .filter(device => device.queries > 0);
    }

    function isDeviceActiveForRule(rule, devices) {
        const wantedId = String(rule.deviceId || '').toLowerCase();
        const wantedName = String(rule.deviceName || '').toLowerCase();
        return devices.some((device) => {
            const deviceId = String(device.id || '').toLowerCase();
            const deviceName = String(device.name || '').toLowerCase();
            return deviceId === wantedId || deviceName === wantedId || deviceName === wantedName;
        });
    }

    function isDeviceOverrideRuleActive(rule, devices, date = new Date()) {
        if (!rule.enabled || !isTimeWithinWindow(rule.start, rule.end, date)) return false;
        const scheduleDay = getScheduleDayForWindow(rule.start, rule.end, date);
        return rule.days.includes(scheduleDay) && isDeviceActiveForRule(rule, devices);
    }

    function updateParentalDeviceOverrideStatusElement(message = null) {
        const status = document.getElementById('ndns-device-override-status');
        if (!status) return;
        if (message) {
            status.textContent = message;
            return;
        }
        const activeRule = parentalDeviceOverrides.rules.find(rule => rule.id === parentalDeviceOverrides.activeRuleId);
        if (activeRule) {
            status.textContent = `Active override: ${activeRule.deviceName} -> Recreation ${activeRule.action === 'on' ? 'on' : 'off'}.`;
        } else if (parentalDeviceOverrides.rules.length) {
            status.textContent = `${parentalDeviceOverrides.rules.length} device override${parentalDeviceOverrides.rules.length === 1 ? '' : 's'} saved.`;
        } else {
            status.textContent = 'No device overrides saved.';
        }
    }

    async function setParentalRecreationTime(pid, desired) {
        const config = await makeApiRequest('GET', `/profiles/${pid}/parentalControl`, null, NDNS_API_KEY);
        const current = !!config.recreationTime?.enabled;
        if (current !== desired) {
            const recreationTime = { ...(config.recreationTime || {}), enabled: desired };
            await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, { recreationTime }, NDNS_API_KEY);
        }
        return current;
    }

    async function applyParentalDeviceOverrides() {
        if (parentalDeviceOverrideApplying || !NDNS_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        const enabledRules = parentalDeviceOverrides.rules.filter(rule => rule.enabled);
        if (!enabledRules.length && !parentalDeviceOverrides.activeRuleId) {
            updateParentalDeviceOverrideStatusElement();
            return;
        }

        parentalDeviceOverrideApplying = true;
        try {
            const devices = enabledRules.length ? await fetchRecentDeviceActivity(pid) : [];
            const activeRules = enabledRules.filter(rule => isDeviceOverrideRuleActive(rule, devices));

            if (activeRules.length) {
                const activeRule = activeRules[activeRules.length - 1];
                const desired = activeRule.action === 'on';
                const current = await setParentalRecreationTime(pid, desired);
                if (parentalDeviceOverrides.activeRuleId !== activeRule.id && typeof parentalDeviceOverrides.previousRecreationEnabled !== 'boolean') {
                    parentalDeviceOverrides.previousRecreationEnabled = current;
                }
                parentalDeviceOverrides.activeRuleId = activeRule.id;
                activeRule.lastApplied = Date.now();
                await saveParentalDeviceOverrides();
            } else if (parentalDeviceOverrides.activeRuleId) {
                const fallback = parentalWeeklySchedule.enabled
                    ? isParentalWeeklySlotActive()
                    : parentalDeviceOverrides.previousRecreationEnabled;
                if (typeof fallback === 'boolean') await setParentalRecreationTime(pid, fallback);
                parentalDeviceOverrides.activeRuleId = null;
                parentalDeviceOverrides.previousRecreationEnabled = null;
                await saveParentalDeviceOverrides();
            }

            parentalDeviceOverrideLastErrorAt = 0;
            updateParentalDeviceOverrideStatusElement();
        } catch (e) {
            const now = Date.now();
            if (now - parentalDeviceOverrideLastErrorAt > 300000) {
                showToast(`Device override failed: ${e.message}`, true, 5000);
                parentalDeviceOverrideLastErrorAt = now;
            }
        } finally {
            parentalDeviceOverrideApplying = false;
        }
    }

    function initParentalDeviceOverrides() {
        if (parentalDeviceOverrideTimer) {
            clearInterval(parentalDeviceOverrideTimer);
            parentalDeviceOverrideTimer = null;
        }

        const hasEnabledRules = parentalDeviceOverrides.rules.some(rule => rule.enabled);
        if (hasEnabledRules || parentalDeviceOverrides.activeRuleId) applyParentalDeviceOverrides();
        if (hasEnabledRules) {
            parentalDeviceOverrideTimer = setInterval(applyParentalDeviceOverrides, 60000);
        } else {
            updateParentalDeviceOverrideStatusElement();
        }
    }

    function buildParentalDeviceOverrideManager(pid, deviceOptions) {
        const wrap = document.createElement('div');
        wrap.className = 'ndns-device-overrides';

        const header = document.createElement('div');
        header.className = 'settings-control-row';
        const label = document.createElement('span');
        label.textContent = 'Device Overrides';
        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'ndns-panel-button ndns-btn-sm';
        runBtn.textContent = 'Run';
        runBtn.onclick = () => applyParentalDeviceOverrides();
        header.append(label, runBtn);
        wrap.appendChild(header);

        const listId = `ndns-device-override-options-${pid}`;
        const deviceInput = document.createElement('input');
        deviceInput.setAttribute('list', listId);
        deviceInput.placeholder = 'Device ID or name';
        deviceInput.autocomplete = 'off';
        const dataList = document.createElement('datalist');
        dataList.id = listId;
        deviceOptions.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.id;
            option.label = device.name === device.id ? device.id : `${device.name} (${device.id})`;
            dataList.appendChild(option);
        });

        const startInput = document.createElement('input');
        startInput.type = 'time';
        startInput.value = '20:00';
        startInput.setAttribute('aria-label', 'Override start time');

        const endInput = document.createElement('input');
        endInput.type = 'time';
        endInput.value = '07:00';
        endInput.setAttribute('aria-label', 'Override end time');

        const actionSelect = document.createElement('select');
        actionSelect.setAttribute('aria-label', 'Override action');
        [
            { value: 'off', label: 'Recreation Off' },
            { value: 'on', label: 'Recreation On' }
        ].forEach((item) => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            actionSelect.appendChild(option);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'ndns-panel-button ndns-btn-sm';
        addBtn.textContent = 'Add';

        const form = document.createElement('div');
        form.className = 'ndns-device-override-form';
        form.append(deviceInput, startInput, endInput, actionSelect, addBtn);
        wrap.append(dataList, form);

        const selectedDays = new Set([0, 1, 2, 3, 4, 5, 6]);
        const dayControls = document.createElement('div');
        dayControls.className = 'ndns-device-override-days';
        PARENTAL_WEEKDAYS.forEach((dayLabel, day) => {
            const dayBtn = document.createElement('button');
            dayBtn.type = 'button';
            dayBtn.className = 'ndns-device-override-day active';
            dayBtn.textContent = dayLabel;
            dayBtn.onclick = () => {
                if (selectedDays.has(day)) selectedDays.delete(day);
                else selectedDays.add(day);
                dayBtn.classList.toggle('active', selectedDays.has(day));
            };
            dayControls.appendChild(dayBtn);
        });
        wrap.appendChild(dayControls);

        const rulesList = document.createElement('div');
        wrap.appendChild(rulesList);

        const status = document.createElement('div');
        status.id = 'ndns-device-override-status';
        status.className = 'ndns-device-override-status';
        wrap.appendChild(status);

        const findDeviceOption = (value) => {
            const needle = String(value || '').toLowerCase();
            return deviceOptions.find(device => String(device.id).toLowerCase() === needle || String(device.name).toLowerCase() === needle);
        };

        const renderRules = () => {
            parentalDeviceOverrides = normalizeParentalDeviceOverrides(parentalDeviceOverrides);
            rulesList.innerHTML = '';
            if (!parentalDeviceOverrides.rules.length) {
                updateParentalDeviceOverrideStatusElement();
                return;
            }

            parentalDeviceOverrides.rules.forEach((rule) => {
                const row = document.createElement('div');
                row.className = `ndns-device-override-row ${parentalDeviceOverrides.activeRuleId === rule.id ? 'active' : ''}`.trim();

                const info = document.createElement('div');
                const actionText = rule.action === 'on' ? 'Recreation On' : 'Recreation Off';
                info.append(
                    createSafeElement('div', { className: 'ndns-device-override-title', text: rule.deviceName }),
                    createSafeElement('div', {
                        className: 'ndns-device-override-meta',
                        text: `${formatDeviceOverrideDays(rule.days)} ${rule.start}-${rule.end} / ${actionText}`
                    })
                );

                const sw = document.createElement('div');
                sw.className = `ndns-toggle-switch ${rule.enabled ? 'active' : ''}`;
                sw.onclick = async () => {
                    rule.enabled = !rule.enabled;
                    sw.classList.toggle('active', rule.enabled);
                    if (!rule.enabled && parentalDeviceOverrides.activeRuleId === rule.id) {
                        await applyParentalDeviceOverrides();
                    }
                    await saveParentalDeviceOverrides();
                    renderRules();
                    initParentalDeviceOverrides();
                };

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-btn';
                delBtn.textContent = 'Del';
                delBtn.onclick = async () => {
                    const wasActive = parentalDeviceOverrides.activeRuleId === rule.id;
                    parentalDeviceOverrides.rules = parentalDeviceOverrides.rules.filter(item => item.id !== rule.id);
                    if (wasActive) await applyParentalDeviceOverrides();
                    await saveParentalDeviceOverrides();
                    renderRules();
                    initParentalDeviceOverrides();
                };

                row.append(info, sw, delBtn);
                rulesList.appendChild(row);
            });
            updateParentalDeviceOverrideStatusElement();
        };

        addBtn.onclick = async () => {
            const rawDevice = deviceInput.value.trim();
            if (!rawDevice) {
                showToast('Enter a device ID or name.', true);
                return;
            }
            if (!selectedDays.size) {
                showToast('Select at least one day.', true);
                return;
            }

            const matchedDevice = findDeviceOption(rawDevice);
            const deviceId = matchedDevice?.id || rawDevice;
            const deviceName = matchedDevice?.name || rawDevice;
            parentalDeviceOverrides.rules.push({
                id: `pdo-${Date.now().toString(36)}`,
                deviceId,
                deviceName,
                days: Array.from(selectedDays).sort((a, b) => a - b),
                start: normalizeTimeValue(startInput.value, '20:00'),
                end: normalizeTimeValue(endInput.value, '07:00'),
                action: actionSelect.value === 'on' ? 'on' : 'off',
                enabled: true,
                lastApplied: null
            });
            deviceInput.value = '';
            await saveParentalDeviceOverrides();
            renderRules();
            initParentalDeviceOverrides();
            showToast('Device override saved.');
        };

        renderRules();
        return wrap;
    }

    function buildParentalPresetControls(pid, presets, categorySwitches) {
        const wrap = document.createElement('div');
        wrap.className = 'ndns-parental-presets';

        presets.forEach((preset) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ndns-panel-button ndns-btn-sm';
            button.textContent = preset.label;
            button.onclick = async () => {
                button.disabled = true;
                try {
                    await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, preset.values, NDNS_API_KEY);
                    Object.entries(preset.values).forEach(([key, value]) => {
                        categorySwitches.get(key)?.classList.toggle('active', !!value);
                    });
                    showToast(`${preset.label} applied.`);
                } catch (e) {
                    showToast(`Preset failed: ${e.message}`, true);
                } finally {
                    button.disabled = false;
                }
            };
            wrap.appendChild(button);
        });

        return wrap;
    }

    // --- PARENTAL CONTROL QUICK TOGGLES ---
    async function initParentalControls(container) {
        if (!NDNS_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        container.textContent = '';
        container.appendChild(createSafeElement('div', {
            text: 'Loading parental controls...',
            style: 'font-size:11px;color:var(--panel-text-secondary);'
        }));

        try {
            const [config, deviceOptions] = await Promise.all([
                makeApiRequest('GET', `/profiles/${pid}/parentalControl`, null, NDNS_API_KEY),
                fetchParentalDeviceOptions(pid)
            ]);
            container.innerHTML = '';

            // Services/categories toggles
            const categories = [
                { key: 'youtube', label: 'YouTube Restricted', icon: '📺' },
                { key: 'safeSearch', label: 'Safe Search', icon: '🔍' },
                { key: 'websites', label: 'Block Websites', icon: '🌐' },
                { key: 'apps', label: 'Block Apps', icon: '📱' },
                { key: 'games', label: 'Block Games', icon: '🎮' },
                { key: 'gambling', label: 'Block Gambling', icon: '🎰' },
                { key: 'dating', label: 'Block Dating', icon: '💕' },
                { key: 'socialNetworks', label: 'Block Social', icon: '👥' },
                { key: 'porn', label: 'Block Adult', icon: '🔞' }
            ];
            const categorySwitches = new Map();
            const categoryPresets = [
                {
                    label: 'Safe Mode',
                    values: {
                        youtube: true,
                        safeSearch: true,
                        websites: true,
                        apps: true,
                        games: true,
                        gambling: true,
                        dating: true,
                        socialNetworks: true,
                        porn: true
                    }
                },
                {
                    label: 'Work Mode',
                    values: {
                        youtube: true,
                        safeSearch: true,
                        websites: false,
                        apps: false,
                        games: true,
                        gambling: true,
                        dating: true,
                        socialNetworks: true,
                        porn: true
                    }
                },
                {
                    label: 'Chill Mode',
                    values: {
                        youtube: false,
                        safeSearch: true,
                        websites: false,
                        apps: false,
                        games: false,
                        gambling: true,
                        dating: true,
                        socialNetworks: false,
                        porn: true
                    }
                }
            ];

            // Recreation time toggle
            const recTimeToggle = document.createElement('div');
            recTimeToggle.className = 'ndns-parental-toggle';
            const recTimeEnabled = config.recreationTime?.enabled || false;
            recTimeToggle.appendChild(createSafeElement('div', { className: 'toggle-label' }, [
                createSafeElement('span', { text: '\u23f0' }),
                createSafeElement('span', { text: 'Recreation Time' })
            ]));
            const recToggle = document.createElement('div');
            recToggle.className = `ndns-toggle-switch ${recTimeEnabled ? 'active' : ''}`;
            recToggle.onclick = async () => {
                const newVal = !recToggle.classList.contains('active');
                try {
                    const newConfig = { ...(config.recreationTime || {}), enabled: newVal };
                    await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, { recreationTime: newConfig }, NDNS_API_KEY);
                    recToggle.classList.toggle('active', newVal);
                    showToast(`Recreation Time ${newVal ? 'enabled' : 'disabled'}.`);
                } catch (e) { showToast(`Error: ${e.message}`, true); }
            };
            recTimeToggle.appendChild(recToggle);
            container.appendChild(recTimeToggle);

            const weeklyWrap = document.createElement('div');
            weeklyWrap.className = 'ndns-weekly-schedule';

            const weeklyHeader = document.createElement('div');
            weeklyHeader.className = 'settings-control-row';
            const weeklyLabel = document.createElement('span');
            weeklyLabel.textContent = 'Weekly Schedule';
            const weeklyToggle = document.createElement('div');
            weeklyToggle.className = `ndns-toggle-switch ${parentalWeeklySchedule.enabled ? 'active' : ''}`;
            weeklyToggle.onclick = async () => {
                parentalWeeklySchedule.enabled = !parentalWeeklySchedule.enabled;
                weeklyToggle.classList.toggle('active', parentalWeeklySchedule.enabled);
                await saveParentalWeeklySchedule();
                initParentalWeeklySchedule();
                showToast(`Weekly schedule ${parentalWeeklySchedule.enabled ? 'enabled' : 'disabled'}.`);
            };
            weeklyHeader.append(weeklyLabel, weeklyToggle);

            const grid = document.createElement('div');
            grid.className = 'ndns-weekly-schedule-grid';
            grid.appendChild(document.createElement('div'));
            for (let hour = 0; hour < 24; hour++) {
                const hourLabel = document.createElement('div');
                hourLabel.className = 'ndns-weekly-schedule-label';
                hourLabel.textContent = String(hour).padStart(2, '0');
                grid.appendChild(hourLabel);
            }

            const now = new Date();
            PARENTAL_WEEKDAYS.forEach((dayLabel, day) => {
                const rowLabel = document.createElement('div');
                rowLabel.className = 'ndns-weekly-schedule-label';
                rowLabel.textContent = dayLabel;
                grid.appendChild(rowLabel);

                for (let hour = 0; hour < 24; hour++) {
                    const cell = document.createElement('button');
                    const active = !!parentalWeeklySchedule.slots[day]?.[hour];
                    cell.type = 'button';
                    cell.className = `ndns-weekly-schedule-cell ${active ? 'active' : ''} ${now.getDay() === day && now.getHours() === hour ? 'now' : ''}`.trim();
                    cell.title = `${dayLabel} ${String(hour).padStart(2, '0')}:00 ${active ? 'on' : 'off'}`;
                    cell.setAttribute('aria-label', cell.title);
                    cell.onclick = async () => {
                        const next = !parentalWeeklySchedule.slots[day][hour];
                        parentalWeeklySchedule.slots[day][hour] = next;
                        cell.classList.toggle('active', next);
                        cell.title = `${dayLabel} ${String(hour).padStart(2, '0')}:00 ${next ? 'on' : 'off'}`;
                        cell.setAttribute('aria-label', cell.title);
                        await saveParentalWeeklySchedule();
                        updateParentalWeeklyStatusElement();
                        if (parentalWeeklySchedule.enabled) await applyParentalWeeklySchedule();
                    };
                    grid.appendChild(cell);
                }
            });

            const weeklyStatus = document.createElement('div');
            weeklyStatus.id = 'ndns-parental-weekly-status';
            weeklyStatus.className = 'ndns-weekly-schedule-status';
            weeklyWrap.append(weeklyHeader, grid, weeklyStatus);
            container.appendChild(weeklyWrap);
            updateParentalWeeklyStatusElement();

            container.appendChild(buildParentalDeviceOverrideManager(pid, deviceOptions));
            container.appendChild(buildParentalPresetControls(pid, categoryPresets, categorySwitches));

            categories.forEach(cat => {
                const isActive = config[cat.key] || (config.services && config.services.some(s => s.id === cat.key && s.active));
                const toggle = document.createElement('div');
                toggle.className = 'ndns-parental-toggle';
                toggle.appendChild(createSafeElement('div', { className: 'toggle-label' }, [
                    createSafeElement('span', { text: cat.icon }),
                    createSafeElement('span', { text: cat.label })
                ]));

                const sw = document.createElement('div');
                sw.className = `ndns-toggle-switch ${isActive ? 'active' : ''}`;
                categorySwitches.set(cat.key, sw);
                sw.onclick = async () => {
                    const newVal = !sw.classList.contains('active');
                    try {
                        const body = {};
                        body[cat.key] = newVal;
                        await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, body, NDNS_API_KEY);
                        sw.classList.toggle('active', newVal);
                        showToast(`${cat.label} ${newVal ? 'enabled' : 'disabled'}.`);
                    } catch (e) { showToast(`Error: ${e.message}`, true); }
                };
                toggle.appendChild(sw);
                container.appendChild(toggle);
            });

        } catch (e) {
            container.textContent = '';
            container.appendChild(createSafeElement('div', {
                text: `Failed: ${e.message}`,
                style: 'font-size:11px;color:var(--danger-color);'
            }));
        }
    }

    // --- REGEX PATTERN MATCHING IN LOGS ---
    function applyRegexHighlights(row) {
        if (!regexPatterns || regexPatterns.length === 0) return;
        const domain = row.dataset.ndnsDomain;
        if (!domain) return;
        if (row.querySelector('.ndns-regex-highlight')) return;

        for (const pattern of regexPatterns) {
            try {
                const regex = new RegExp(pattern.pattern, pattern.flags || 'i');
                if (regex.test(domain)) {
                    // Apply highlight as a border + background on the row itself, not by rewriting DOM
                    row.style.outline = `2px solid ${pattern.textColor || '#ffc107'}`;
                    row.style.outlineOffset = '-2px';
                    row.dataset.ndnsRegexLabel = pattern.label || pattern.pattern;

                    // Also add a small badge after the domain text
                    const domainEl = row.querySelector('.text-break > div > span') || row.querySelector('.text-break');
                    if (domainEl) {
                        const badge = document.createElement('span');
                        badge.className = 'ndns-regex-highlight';
                        badge.style.backgroundColor = pattern.color || 'rgba(255, 193, 7, 0.3)';
                        badge.style.color = pattern.textColor || 'inherit';
                        badge.style.marginLeft = '4px';
                        badge.textContent = pattern.label || 'regex';
                        badge.title = `Matched: ${pattern.pattern}`;
                        domainEl.appendChild(badge);
                    }
                    break; // Only apply first matching pattern per row
                }
            } catch {}
        }
    }

    function buildRegexManager(container) {
        container.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 12px; font-weight: 600; margin-bottom: 6px;';
        header.textContent = 'Regex Pattern Highlights';
        container.appendChild(header);

        // List existing patterns
        regexPatterns.forEach((pattern, idx) => {
            const item = document.createElement('div');
            item.className = 'ndns-regex-item';
            item.append(
                createSafeElement('span', { className: 'pattern', text: pattern.pattern }),
                createSafeElement('div', {
                    className: 'color-swatch',
                    style: `background:${pattern.color || 'rgba(255,193,7,0.3)'}`
                })
            );
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.style.cssText = 'background:none;border:none;color:var(--danger-color);cursor:pointer;font-size:12px;padding:2px 4px;';
            delBtn.textContent = 'x';
            delBtn.onclick = async () => {
                regexPatterns.splice(idx, 1);
                await storage.set({ [KEY_REGEX_PATTERNS]: regexPatterns });
                buildRegexManager(container);
                invalidateLogCache();
                cleanLogs();
            };
            item.appendChild(delBtn);
            container.appendChild(item);
        });

        // Add new pattern form
        const addRow = document.createElement('div');
        addRow.style.cssText = 'display: flex; gap: 4px; margin-top: 6px;';
        const patternInput = document.createElement('input');
        patternInput.className = 'ndns-input';
        patternInput.placeholder = 'Regex pattern';
        patternInput.style.cssText = 'flex: 1; padding: 4px 6px; font-size: 11px;';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#ffc107';
        colorInput.style.cssText = 'width: 28px; height: 24px; border: none; cursor: pointer; background: none;';

        const addBtn = document.createElement('button');
        addBtn.className = 'ndns-panel-button ndns-btn-sm';
        addBtn.textContent = '+';
        addBtn.style.cssText = 'width: auto; padding: 4px 8px;';
        addBtn.onclick = async () => {
            const p = patternInput.value.trim();
            if (!p) return;
            try { new RegExp(p); } catch { return showToast('Invalid regex pattern.', true); }
            const hexColor = colorInput.value;
            regexPatterns.push({ pattern: p, color: hexColor + '4D', textColor: hexColor, flags: 'i' });
            await storage.set({ [KEY_REGEX_PATTERNS]: regexPatterns });
            patternInput.value = '';
            buildRegexManager(container);
            invalidateLogCache();
            cleanLogs();
        };

        addRow.append(patternInput, colorInput, addBtn);
        container.appendChild(addRow);
    }

    // --- CNAME CHAIN DISPLAY ---
    function fetchAndShowCnameChain(row) {
        if (!showCnameChain || !NDNS_API_KEY) return;
        if (row.querySelector('.ndns-cname-chain')) return;

        const domain = row.dataset.ndnsDomain;
        if (!domain) return;

        // Try to extract CNAME info from the row's existing data
        const existingDetails = row.querySelectorAll('.text-muted, small, [class*="detail"]');
        let cnameData = [];

        existingDetails.forEach(el => {
            const text = el.textContent || '';
            const cnameMatch = text.match(/CNAME\s*[:\s]+\s*([a-zA-Z0-9.-]+)/i);
            if (cnameMatch) cnameData.push(cnameMatch[1]);
        });

        // Also look for answer records in expanded view
        const answerEls = row.querySelectorAll('[class*="answer"], [class*="record"]');
        answerEls.forEach(el => {
            const text = el.textContent.trim();
            if (text && text.includes('.') && text !== domain) {
                cnameData.push(text);
            }
        });

        if (cnameData.length === 0) return;

        const chainEl = document.createElement('div');
        chainEl.className = 'ndns-cname-chain';
        const firstLink = document.createElement('span');
        firstLink.className = 'ndns-cname-link';
        firstLink.textContent = domain;
        chainEl.appendChild(firstLink);

        cnameData.forEach(cname => {
            const arrow = document.createElement('span');
            arrow.className = 'ndns-cname-arrow';
            arrow.textContent = '->';
            const link = document.createElement('span');
            link.className = 'ndns-cname-link';
            link.textContent = cname;
            chainEl.append(arrow, link);
        });

        const targetContainer = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break > div') ||
                               row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break') ||
                               row.querySelector('.text-break');
        if (targetContainer) targetContainer.appendChild(chainEl);
    }

    // --- WEBHOOK/ALERT INTEGRATION ---
    const webhookSentDomains = new Map();
    const WEBHOOK_TEMPLATE_PRESETS = {
        generic: `{
  "event": "domain_query",
  "domain": "{{domain}}",
  "device": "{{device}}",
  "status": "{{status}}",
  "matchedFilter": "{{matchedFilter}}",
  "timestamp": "{{timestamp}}",
  "profile": "{{profile}}",
  "source": "{{source}}"
}`,
        discord: `{
  "embeds": [
    {
      "title": "NDNS domain query",
      "color": {{color}},
      "fields": [
        { "name": "Domain", "value": "{{domain}}", "inline": true },
        { "name": "Status", "value": "{{status}}", "inline": true },
        { "name": "Device", "value": "{{device}}", "inline": true },
        { "name": "Filter", "value": "{{matchedFilter}}", "inline": false }
      ],
      "timestamp": "{{timestamp}}"
    }
  ]
}`,
        slack: `{
  "text": "NDNS {{status}} query: {{domain}}",
  "blocks": [
    { "type": "section", "text": { "type": "mrkdwn", "text": "*NDNS {{status}} query*\\n\`{{domain}}\`" } },
    { "type": "context", "elements": [
      { "type": "mrkdwn", "text": "Device: {{device}}" },
      { "type": "mrkdwn", "text": "Filter: {{matchedFilter}}" }
    ] }
  ]
}`
    };

    function normalizeWebhookTrust(value = {}) {
        value = value && typeof value === 'object' ? value : {};
        return {
            url: String(value.url || ''),
            host: String(value.host || ''),
            consent: value.consent === true
        };
    }

    function normalizeWebhookHost(hostname) {
        return String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    }

    function isPrivateWebhookIpv4(hostname) {
        const parts = normalizeWebhookHost(hostname).split('.');
        if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part))) return false;
        const nums = parts.map(Number);
        if (nums.some(num => num < 0 || num > 255)) return false;
        return nums[0] === 10 ||
            nums[0] === 127 ||
            (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) ||
            (nums[0] === 192 && nums[1] === 168) ||
            (nums[0] === 169 && nums[1] === 254) ||
            (nums[0] === 0 && nums[1] === 0 && nums[2] === 0 && nums[3] === 0);
    }

    function isPrivateWebhookIpv6(hostname) {
        const host = normalizeWebhookHost(hostname);
        return host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
    }

    function validateWebhookDestination(rawUrl) {
        const input = String(rawUrl || '').trim();
        if (!input) return { ok: false, reason: 'Webhook URL is empty.' };

        let parsed;
        try {
            parsed = new URL(input);
        } catch {
            return { ok: false, reason: 'Webhook URL is invalid.' };
        }

        const host = normalizeWebhookHost(parsed.hostname);
        if (parsed.protocol !== 'https:') return { ok: false, reason: 'Webhook URL must use HTTPS.' };
        if (parsed.username || parsed.password) return { ok: false, reason: 'Webhook URL cannot include credentials.' };
        if (!host) return { ok: false, reason: 'Webhook URL host is missing.' };
        if (host === 'localhost' || host.endsWith('.local')) return { ok: false, reason: 'Local webhook hosts are blocked.' };
        if (isPrivateWebhookIpv4(host) || isPrivateWebhookIpv6(host)) return { ok: false, reason: 'Private network webhook hosts are blocked.' };

        return { ok: true, url: parsed.href, host };
    }

    function isWebhookDeliveryTrusted(destination = validateWebhookDestination(webhookUrl)) {
        return destination.ok &&
            webhookTrust.consent === true &&
            webhookTrust.url === destination.url &&
            webhookTrust.host === destination.host;
    }

    function matchesWebhookPattern(pattern, value) {
        const target = String(value || '');
        if (!target) return false;
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

    function matchesWebhookTimeWindow(windowExpr, date = new Date()) {
        const [startRaw, endRaw] = String(windowExpr || '').split('-');
        const start = parseTimePart(startRaw);
        const end = parseTimePart(endRaw);
        if (start === null || end === null) return false;
        const now = date.getHours() * 60 + date.getMinutes();
        return start <= end
            ? now >= start && now <= end
            : now >= start || now <= end;
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
            if (key === 'status') {
                return value.split('|').some(status => matchesWebhookPattern(status, context.status));
            }
            if (key === 'time' || key === 'window') return matchesWebhookTimeWindow(value, context.timestamp);
            return matchesWebhookPattern(token, context.domain);
        });
    }

    function extractWebhookDevice(row) {
        return row?.querySelector('.text-end .notranslate')?.textContent?.trim() ||
               row?.querySelector('[data-device]')?.getAttribute('data-device') ||
               '';
    }

    function escapeWebhookTemplateValue(value) {
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return JSON.stringify(String(value ?? '')).slice(1, -1);
    }

    function renderWebhookTemplate(template, context) {
        return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) =>
            escapeWebhookTemplateValue(context[key] ?? '')
        );
    }

    function buildGenericWebhookPayload(context, templateError = '') {
        return {
            event: 'domain_query',
            domain: context.domain,
            device: context.device,
            status: context.status,
            matchedFilter: context.matchedFilter,
            timestamp: context.timestamp,
            profile: context.profile,
            source: context.source,
            ...(templateError ? { templateError } : {})
        };
    }

    function buildWebhookPayload(context) {
        const preset = webhookTemplate.preset || 'generic';
        const template = webhookTemplate.template || WEBHOOK_TEMPLATE_PRESETS[preset] || WEBHOOK_TEMPLATE_PRESETS.generic;
        try {
            return JSON.parse(renderWebhookTemplate(template, context));
        } catch (error) {
            return buildGenericWebhookPayload(context, `Invalid webhook template JSON: ${error.message || 'parse failed'}`);
        }
    }

    function isWebhookRateLimited(key) {
        const seconds = Math.max(0, Number(webhookRateLimitSeconds) || 0);
        if (seconds === 0) return false;
        const now = Date.now();
        const windowMs = seconds * 1000;
        const lastSent = webhookSentDomains.get(key) || 0;
        if (now - lastSent < windowMs) return true;

        webhookSentDomains.set(key, now);
        for (const [storedKey, timestamp] of webhookSentDomains.entries()) {
            if (now - timestamp > windowMs * 2) webhookSentDomains.delete(storedKey);
        }
        return false;
    }

    function renderWebhookDeliveries(container = document.getElementById('ndns-webhook-delivery-log')) {
        if (!container) return;
        container.textContent = '';
        if (webhookDeliveries.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:10px;color:var(--panel-text-secondary);';
            empty.textContent = 'No deliveries yet.';
            container.appendChild(empty);
            return;
        }

        webhookDeliveries.forEach((delivery) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;gap:6px;font-size:10px;padding:3px 6px;background:var(--section-bg);border-radius:4px;margin-bottom:2px;';
            const when = delivery.at ? new Date(delivery.at).toLocaleTimeString() : 'unknown';
            const left = document.createElement('span');
            left.textContent = `${when} ${delivery.type || 'webhook'}`;
            const right = document.createElement('span');
            right.style.color = delivery.ok ? 'var(--success-color)' : 'var(--danger-color)';
            right.textContent = `${delivery.ok ? 'OK' : 'FAIL'}${delivery.status ? ` ${delivery.status}` : ''}`;
            row.title = delivery.message || '';
            row.append(left, right);
            container.appendChild(row);
        });
    }

    async function recordWebhookDelivery(entry) {
        webhookDeliveries = [{
            at: new Date().toISOString(),
            type: entry.type || 'query',
            ok: !!entry.ok,
            status: entry.status || '',
            message: entry.message || ''
        }, ...webhookDeliveries].slice(0, 5);
        await storage.set({ [KEY_WEBHOOK_DELIVERIES]: webhookDeliveries });
        renderWebhookDeliveries();
    }

    function postWebhookPayload(payload, type = 'query') {
        if (!webhookUrl) return;
        const destination = validateWebhookDestination(webhookUrl);
        if (!destination.ok) {
            recordWebhookDelivery({ type, ok: false, message: destination.reason });
            return;
        }
        if (!isWebhookDeliveryTrusted(destination)) {
            recordWebhookDelivery({ type, ok: false, message: `Delivery consent required for ${destination.host}` });
            return;
        }
        try {
            GM_xmlhttpRequest({
                method: 'POST',
                url: destination.url,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                timeout: API_REQUEST_TIMEOUT_MS,
                onload: (response) => {
                    const ok = response.status >= 200 && response.status < 300;
                    recordWebhookDelivery({
                        type,
                        ok,
                        status: response.status,
                        message: ok ? 'Delivered' : (response.statusText || 'HTTP error')
                    });
                },
                onerror: () => recordWebhookDelivery({ type, ok: false, message: 'Network error' }),
                ontimeout: () => recordWebhookDelivery({ type, ok: false, message: 'Request timed out' })
            });
        } catch (error) {
            recordWebhookDelivery({ type, ok: false, message: error.message || 'Request failed' });
        }
    }

    function checkWebhookAlert(domain, context = {}) {
        if (!webhookUrl || webhookDomains.length === 0) return;
        const payloadContext = {
            domain,
            device: context.device || '',
            status: context.status || 'unknown',
            timestamp: context.timestamp || new Date()
        };
        const sentKey = `${payloadContext.domain}|${payloadContext.device}|${payloadContext.status}`;

        const matchedFilter = webhookDomains.find(wd => matchesWebhookExpression(wd, payloadContext));
        if (!matchedFilter) return;
        if (isWebhookRateLimited(sentKey)) return;

        const templateContext = {
            ...payloadContext,
            matchedFilter,
            timestamp: payloadContext.timestamp.toISOString(),
            profile: getCurrentProfileId(),
            source: 'NDNS v3.4.41',
            color: payloadContext.status === 'blocked' ? 15020400 : 2926205
        };

        try {
            postWebhookPayload(buildWebhookPayload(templateContext), 'query');
        } catch {}
    }

    function buildWebhookConfig(container) {
        container.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 12px; font-weight: 600; margin-bottom: 6px;';
        header.textContent = 'Webhook Alerts';
        container.appendChild(header);

        const urlInput = document.createElement('input');
        urlInput.placeholder = 'Webhook URL (e.g., Discord/Slack webhook)';
        urlInput.value = webhookUrl;
        urlInput.onchange = async () => {
            const nextUrl = urlInput.value.trim();
            if (!nextUrl) {
                webhookUrl = '';
                webhookTrust = { url: '', host: '', consent: false };
                await storage.set({ [KEY_WEBHOOK_URL]: webhookUrl, [KEY_WEBHOOK_TRUST]: webhookTrust });
                renderTrustState();
                showToast('Webhook URL cleared.');
                return;
            }

            const destination = validateWebhookDestination(nextUrl);
            if (!destination.ok) {
                renderTrustState(destination);
                showToast(destination.reason, true, 5000);
                return;
            }

            webhookUrl = destination.url;
            webhookTrust = { url: destination.url, host: destination.host, consent: false };
            urlInput.value = webhookUrl;
            await storage.set({ [KEY_WEBHOOK_URL]: webhookUrl, [KEY_WEBHOOK_TRUST]: webhookTrust });
            renderTrustState(destination);
            showToast('Webhook URL saved. Enable delivery consent before sending.');
        };

        const trustStatus = document.createElement('div');
        trustStatus.style.cssText = 'font-size:10px;color:var(--panel-text-secondary);margin:4px 0 6px;';

        const trustRow = document.createElement('div');
        trustRow.className = 'settings-control-row';
        trustRow.innerHTML = '<span>Allow Webhook Delivery</span>';
        const trustToggle = document.createElement('div');
        trustToggle.className = 'ndns-toggle-switch';
        const renderTrustState = (overrideDestination = null) => {
            const destination = overrideDestination || validateWebhookDestination(webhookUrl);
            const trusted = isWebhookDeliveryTrusted(destination);
            trustToggle.classList.toggle('active', trusted);
            if (!webhookUrl) {
                trustStatus.textContent = 'No webhook destination configured.';
            } else if (!destination.ok) {
                trustStatus.textContent = destination.reason;
            } else {
                trustStatus.textContent = `Destination: ${destination.host}. Consent: ${trusted ? 'enabled' : 'disabled'}.`;
            }
        };
        trustToggle.onclick = async () => {
            const destination = validateWebhookDestination(webhookUrl);
            if (!destination.ok) {
                renderTrustState(destination);
                showToast(destination.reason, true, 5000);
                return;
            }
            const nextConsent = !isWebhookDeliveryTrusted(destination);
            webhookTrust = { url: destination.url, host: destination.host, consent: nextConsent };
            await storage.set({ [KEY_WEBHOOK_TRUST]: webhookTrust });
            renderTrustState(destination);
            showToast(`Webhook delivery ${nextConsent ? 'allowed' : 'paused'} for ${destination.host}.`);
        };
        trustRow.appendChild(trustToggle);
        renderTrustState();
        container.append(urlInput, trustStatus, trustRow);

        const templateDesc = document.createElement('div');
        templateDesc.style.cssText = 'font-size: 10px; color: var(--panel-text-secondary); margin: 6px 0 4px;';
        templateDesc.textContent = 'Payload template. Presets support placeholders like {{domain}}, {{status}}, {{device}}, {{timestamp}}, {{profile}}, and {{matchedFilter}}.';
        container.appendChild(templateDesc);

        const templateSelect = document.createElement('select');
        [
            ['generic', 'Generic JSON'],
            ['discord', 'Discord Embed'],
            ['slack', 'Slack Block Kit']
        ].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            templateSelect.appendChild(option);
        });
        templateSelect.value = webhookTemplate.preset || 'generic';

        const templateArea = document.createElement('textarea');
        const loadSelectedTemplate = () => {
            templateArea.value = webhookTemplate.preset === templateSelect.value && webhookTemplate.template
                ? webhookTemplate.template
                : WEBHOOK_TEMPLATE_PRESETS[templateSelect.value] || WEBHOOK_TEMPLATE_PRESETS.generic;
        };
        templateSelect.onchange = loadSelectedTemplate;
        loadSelectedTemplate();

        const templateActions = document.createElement('div');
        templateActions.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;';

        const saveTemplateBtn = document.createElement('button');
        saveTemplateBtn.className = 'ndns-panel-button ndns-btn-sm';
        saveTemplateBtn.textContent = 'Save Template';
        saveTemplateBtn.onclick = async () => {
            const sample = {
                domain: 'ads.example.com',
                device: 'laptop',
                status: 'blocked',
                matchedFilter: 'domain:ads status:blocked',
                timestamp: new Date().toISOString(),
                profile: getCurrentProfileId() || 'profile',
                source: 'NDNS preview',
                color: 15020400
            };
            try {
                JSON.parse(renderWebhookTemplate(templateArea.value, sample));
            } catch (error) {
                showToast(`Template JSON invalid: ${error.message || 'parse failed'}`, true, 5000);
                return;
            }
            webhookTemplate = {
                preset: templateSelect.value,
                template: templateArea.value === WEBHOOK_TEMPLATE_PRESETS[templateSelect.value] ? '' : templateArea.value
            };
            await storage.set({ [KEY_WEBHOOK_TEMPLATE]: webhookTemplate });
            showToast('Webhook template saved.');
        };

        const resetTemplateBtn = document.createElement('button');
        resetTemplateBtn.className = 'ndns-panel-button ndns-btn-sm danger';
        resetTemplateBtn.textContent = 'Reset';
        resetTemplateBtn.onclick = async () => {
            templateArea.value = WEBHOOK_TEMPLATE_PRESETS[templateSelect.value] || WEBHOOK_TEMPLATE_PRESETS.generic;
            webhookTemplate = { preset: templateSelect.value, template: '' };
            await storage.set({ [KEY_WEBHOOK_TEMPLATE]: webhookTemplate });
            showToast('Webhook template reset.');
        };

        templateActions.append(saveTemplateBtn, resetTemplateBtn);
        container.append(templateSelect, templateArea, templateActions);

        const desc = document.createElement('div');
        desc.style.cssText = 'font-size: 10px; color: var(--panel-text-secondary); margin: 4px 0;';
        desc.textContent = 'Filters to watch: plain/regex domain, or AND terms like domain:ads status:blocked device:phone time:08:00-18:00.';
        container.appendChild(desc);

        const domainList = document.createElement('div');
        domainList.className = 'ndns-webhook-domains-list';
        webhookDomains.forEach((wd, idx) => {
            const item = document.createElement('div');
            item.className = 'ndns-webhook-domain-item';
            item.appendChild(createSafeElement('span', {
                text: wd,
                style: 'font-family:monospace;'
            }));
            const delBtn = document.createElement('button');
            delBtn.style.cssText = 'background:none;border:none;color:var(--danger-color);cursor:pointer;font-size:11px;';
            delBtn.textContent = 'x';
            delBtn.onclick = async () => {
                webhookDomains.splice(idx, 1);
                await storage.set({ [KEY_WEBHOOK_DOMAINS]: webhookDomains });
                buildWebhookConfig(container);
            };
            item.appendChild(delBtn);
            domainList.appendChild(item);
        });
        container.appendChild(domainList);

        const addRow = document.createElement('div');
        addRow.style.cssText = 'display: flex; gap: 4px;';
        const addInput = document.createElement('input');
        addInput.placeholder = 'domain:ads.* status:blocked device:phone time:08:00-18:00';
        addInput.style.cssText = 'flex: 1;';
        const addBtn = document.createElement('button');
        addBtn.className = 'ndns-panel-button ndns-btn-sm';
        addBtn.textContent = '+';
        addBtn.style.cssText = 'width: auto; padding: 4px 8px;';
        addBtn.onclick = async () => {
            const val = addInput.value.trim();
            if (!val) return;
            webhookDomains.push(val);
            await storage.set({ [KEY_WEBHOOK_DOMAINS]: webhookDomains });
            addInput.value = '';
            buildWebhookConfig(container);
        };
        addRow.append(addInput, addBtn);
        container.appendChild(addRow);

        const rateDesc = document.createElement('div');
        rateDesc.style.cssText = 'font-size: 10px; color: var(--panel-text-secondary); margin: 6px 0 4px;';
        rateDesc.textContent = 'Duplicate guard window (seconds). Use 0 to disable duplicate suppression.';
        const rateInput = document.createElement('input');
        rateInput.type = 'number';
        rateInput.min = '0';
        rateInput.step = '1';
        rateInput.value = String(Math.max(0, Number(webhookRateLimitSeconds) || 0));
        rateInput.onchange = async () => {
            webhookRateLimitSeconds = Math.max(0, Number(rateInput.value) || 0);
            rateInput.value = String(webhookRateLimitSeconds);
            webhookSentDomains.clear();
            await storage.set({ [KEY_WEBHOOK_RATE_LIMIT]: webhookRateLimitSeconds });
            showToast('Webhook duplicate guard saved.');
        };
        container.append(rateDesc, rateInput);

        const testRow = document.createElement('div');
        testRow.style.cssText = 'display:flex;gap:4px;margin-top:6px;';
        const testBtn = document.createElement('button');
        testBtn.className = 'ndns-panel-button ndns-btn-sm';
        testBtn.textContent = 'Test Webhook';
        testBtn.onclick = () => {
            if (!webhookUrl) return showToast('Webhook URL required.', true);
            const destination = validateWebhookDestination(webhookUrl);
            if (!destination.ok) return showToast(destination.reason, true, 5000);
            if (!isWebhookDeliveryTrusted(destination)) return showToast(`Enable delivery consent for ${destination.host} first.`, true, 5000);
            const sampleContext = {
                domain: 'ads.example.com',
                device: 'laptop',
                status: 'blocked',
                matchedFilter: webhookDomains[0] || 'domain:ads status:blocked',
                timestamp: new Date().toISOString(),
                profile: getCurrentProfileId() || 'profile',
                source: 'NDNS test',
                color: 15020400
            };
            postWebhookPayload(buildWebhookPayload(sampleContext), 'test');
            showToast('Webhook test sent.');
        };
        testRow.appendChild(testBtn);
        container.appendChild(testRow);

        const deliveryTitle = document.createElement('div');
        deliveryTitle.style.cssText = 'font-size: 10px; color: var(--panel-text-secondary); margin: 6px 0 4px;';
        deliveryTitle.textContent = 'Last 5 deliveries:';
        const deliveryLog = document.createElement('div');
        deliveryLog.id = 'ndns-webhook-delivery-log';
        container.append(deliveryTitle, deliveryLog);
        renderWebhookDeliveries(deliveryLog);
    }

    // --- SETTINGS MODAL ---
    function buildSettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'ndns-settings-modal-overlay';
        const closeSettingsModal = () => {
            overlay.style.display = 'none';
            restoreDialogFocus(overlay);
        };
        overlay.onclick = (e) => { if (e.target === overlay) closeSettingsModal(); };

        const content = document.createElement('div');
        content.className = 'ndns-settings-modal-content';
        overlay.appendChild(content);

        const header = document.createElement('div');
        header.className = 'ndns-settings-modal-header';
        header.innerHTML = `
            <h3>${uiText('settings')}</h3>
            <a href="https://github.com/SysAdminDoc" target="_blank" class="github-link">${icons.github.outerHTML} <span>Open Source on GitHub</span></a>
        `;
        content.appendChild(header);
        content.innerHTML += `<button class="ndns-settings-close-btn">&times;</button>`;
        const closeButton = content.querySelector('.ndns-settings-close-btn');
        closeButton.setAttribute('aria-label', 'Close settings');
        closeButton.onclick = closeSettingsModal;

        // Create scrollable body container
        const modalBody = document.createElement('div');
        modalBody.className = 'ndns-settings-modal-body';
        content.appendChild(modalBody);

        // API Key Section
        const apiSection = document.createElement('div');
        apiSection.className = 'ndns-settings-section';
        apiSection.innerHTML = `<label>🔑 API Key</label>`;

        const apiControls = document.createElement('div');
        apiControls.className = 'ndns-settings-controls';

        const apiWrapper = document.createElement('div');
        apiWrapper.className = 'api-key-wrapper';
        const apiInput = document.createElement('input');
        apiInput.type = 'password';
        apiInput.className = 'ndns-input';
        apiInput.placeholder = 'Paste your API key';
        apiInput.value = NDNS_API_KEY || '';

        const visToggle = document.createElement('button');
        visToggle.className = 'api-key-toggle-visibility';
        visToggle.appendChild(icons.eye.cloneNode(true));
        visToggle.onclick = () => {
            const isPassword = apiInput.type === 'password';
            apiInput.type = isPassword ? 'text' : 'password';
            visToggle.innerHTML = '';
            visToggle.appendChild(isPassword ? icons.eyeSlash.cloneNode(true) : icons.eye.cloneNode(true));
        };
        apiWrapper.append(apiInput, visToggle);

        const apiSaveBtn = document.createElement('button');
        apiSaveBtn.id = 'ndns-settings-save-api-key-btn';
        apiSaveBtn.textContent = 'Save API Key';
        apiSaveBtn.className = 'ndns-panel-button';
        apiSaveBtn.onclick = async () => {
            const newKey = apiInput.value.trim();
            if (newKey) {
                await storage.set({ [KEY_API_KEY]: newKey });
                NDNS_API_KEY = newKey;
                sessionStorage.setItem('ndns_needs_refresh', 'true');
                showToast('API Key saved! Reloading...', false, 1500);
                setTimeout(() => location.reload(), 1000);
            } else {
                showToast('API Key cannot be empty.', true);
            }
        };

        apiControls.append(apiWrapper, apiSaveBtn);
        apiSection.appendChild(apiControls);
        modalBody.appendChild(apiSection);

        // Appearance Section
        const appearSection = document.createElement('div');
        appearSection.className = 'ndns-settings-section';
        appearSection.innerHTML = `<label>🎨 Appearance</label>`;

        const appearControls = document.createElement('div');
        appearControls.className = 'ndns-settings-controls';

        // Theme toggle
        const themeRow = document.createElement('div');
        themeRow.className = 'settings-control-row';
        themeRow.innerHTML = `<span>Theme</span>`;
        const themeBtnGroup = document.createElement('div');
        themeBtnGroup.className = 'btn-group';

        const updateThemeBtns = (activeTheme) => {
            lightBtn.classList.toggle('active', activeTheme === 'light');
            darkBtn.classList.toggle('active', activeTheme === 'dark');
            darkBlueBtn.classList.toggle('active', activeTheme === 'darkblue');
        };

        const lightBtn = document.createElement('button');
        lightBtn.textContent = 'Light';
        lightBtn.className = `ndns-panel-button ndns-btn-sm ${currentTheme === 'light' ? 'active' : ''}`;
        lightBtn.onclick = async () => {
            applyTheme('light');
            await storage.set({ [KEY_THEME]: 'light' });
            updateThemeBtns('light');
        };

        const darkBtn = document.createElement('button');
        darkBtn.textContent = 'Dark';
        darkBtn.className = `ndns-panel-button ndns-btn-sm ${currentTheme === 'dark' ? 'active' : ''}`;
        darkBtn.onclick = async () => {
            applyTheme('dark');
            await storage.set({ [KEY_THEME]: 'dark' });
            updateThemeBtns('dark');
        };

        const darkBlueBtn = document.createElement('button');
        darkBlueBtn.textContent = 'Dark Blue';
        darkBlueBtn.className = `ndns-panel-button ndns-btn-sm ${currentTheme === 'darkblue' ? 'active' : ''}`;
        darkBlueBtn.onclick = async () => {
            applyTheme('darkblue');
            await storage.set({ [KEY_THEME]: 'darkblue' });
            updateThemeBtns('darkblue');
        };

        themeBtnGroup.append(lightBtn, darkBtn, darkBlueBtn);
        themeRow.appendChild(themeBtnGroup);
        appearControls.appendChild(themeRow);

        const densityRow = document.createElement('div');
        densityRow.className = 'settings-control-row';
        densityRow.innerHTML = '<span>Panel Density</span>';
        const densityBtnGroup = document.createElement('div');
        densityBtnGroup.className = 'btn-group';

        const updateDensityBtns = (activeDensity) => {
            compactDensityBtn.classList.toggle('active', activeDensity === 'compact');
            roomyDensityBtn.classList.toggle('active', activeDensity === 'roomy');
        };

        const compactDensityBtn = document.createElement('button');
        compactDensityBtn.textContent = 'Compact';
        compactDensityBtn.className = `ndns-panel-button ndns-btn-sm ${densityMode === 'compact' ? 'active' : ''}`;
        compactDensityBtn.onclick = async () => {
            applyDensityMode('compact');
            await storage.set({ [KEY_DENSITY_MODE]: 'compact' });
            updateDensityBtns('compact');
        };

        const roomyDensityBtn = document.createElement('button');
        roomyDensityBtn.textContent = 'Roomy';
        roomyDensityBtn.className = `ndns-panel-button ndns-btn-sm ${densityMode === 'roomy' ? 'active' : ''}`;
        roomyDensityBtn.onclick = async () => {
            applyDensityMode('roomy');
            await storage.set({ [KEY_DENSITY_MODE]: 'roomy' });
            updateDensityBtns('roomy');
        };

        densityBtnGroup.append(compactDensityBtn, roomyDensityBtn);
        densityRow.appendChild(densityBtnGroup);
        appearControls.appendChild(densityRow);

        // Toggle options
        const toggleOptions = [
            { key: KEY_ULTRA_CONDENSED, label: 'Compact Mode', get: () => isUltraCondensed, set: async (v) => { applyUltraCondensedMode(v); await storage.set({ [KEY_ULTRA_CONDENSED]: v }); } },
            { key: KEY_LIST_PAGE_THEME, label: 'List Page Theming', get: () => enableListPageTheme, set: async (v) => { enableListPageTheme = v; await storage.set({ [KEY_LIST_PAGE_THEME]: v }); applyListPageTheme(); } },
            { key: KEY_SHOW_LOG_COUNTERS, label: 'Show Log Counters', get: () => showLogCounters, set: async (v) => { showLogCounters = v; await storage.set({ [KEY_SHOW_LOG_COUNTERS]: v }); if (v && /\/logs/.test(location.href)) { createLogCounters(); updateLogCounters(); } else if (!v && logCountersElement) { logCountersElement.remove(); logCountersElement = null; } } },
            { key: KEY_COLLAPSE_BLOCKLISTS, label: 'Collapse Blocklists', get: () => collapseBlocklists, set: async (v) => { collapseBlocklists = v; await storage.set({ [KEY_COLLAPSE_BLOCKLISTS]: v }); } },
            { key: KEY_COLLAPSE_TLDS, label: 'Collapse TLD Lists', get: () => collapseTLDs, set: async (v) => { collapseTLDs = v; await storage.set({ [KEY_COLLAPSE_TLDS]: v }); } }
        ];

        toggleOptions.forEach(opt => {
            const row = document.createElement('div');
            row.className = 'settings-control-row';
            row.appendChild(createSafeElement('span', { text: opt.label }));

            const toggle = document.createElement('div');
            toggle.className = `ndns-toggle-switch ${opt.get() ? 'active' : ''}`;
            toggle.onclick = async () => {
                const newVal = !opt.get();
                await opt.set(newVal);
                toggle.classList.toggle('active', newVal);
            };

            row.appendChild(toggle);
            appearControls.appendChild(row);
        });

        appearControls.appendChild(buildThemeStudioControls());
        appearSection.appendChild(appearControls);
        modalBody.appendChild(appearSection);

        // Data Management Section
        const dataSection = document.createElement('div');
        dataSection.className = 'ndns-settings-section';
        dataSection.innerHTML = `<label>📦 Data Management</label>`;

        const dataControls = document.createElement('div');
        dataControls.className = 'ndns-settings-controls';

        const storageDoctorStatus = document.createElement('div');
        storageDoctorStatus.className = 'settings-section-description';
        renderStorageDoctorStatus(storageDoctorStatus);

        const storageDoctorBtn = document.createElement('button');
        storageDoctorBtn.textContent = 'Run Storage Doctor';
        storageDoctorBtn.className = 'ndns-panel-button';
        storageDoctorBtn.onclick = async () => {
            storageDoctorBtn.disabled = true;
            storageDoctorBtn.textContent = 'Checking...';
            try {
                storageDoctorReport = await runStorageDoctor();
                renderStorageDoctorStatus(storageDoctorStatus);
                showToast(formatStorageDoctorMessage(storageDoctorReport), storageDoctorReport.repairedCount > 0, 6000);
                if (storageDoctorReport.repairedCount > 0 || storageDoctorReport.migrations.length > 0) {
                    setTimeout(() => location.reload(), 1200);
                }
            } catch (error) {
                showToast(`Storage doctor failed: ${error.message || error}`, true, 6000);
            } finally {
                storageDoctorBtn.disabled = false;
                storageDoctorBtn.textContent = 'Run Storage Doctor';
            }
        };

        const exportSettingsBtn = document.createElement('button');
        exportSettingsBtn.textContent = 'Export NDNS Settings';
        exportSettingsBtn.className = 'ndns-panel-button';
        exportSettingsBtn.onclick = exportNdnsSettingsBackup;

        const importSettingsInput = document.createElement('input');
        importSettingsInput.type = 'file';
        importSettingsInput.accept = 'application/json,.json';
        importSettingsInput.style.display = 'none';

        const importSettingsBtn = document.createElement('button');
        importSettingsBtn.textContent = 'Import NDNS Settings';
        importSettingsBtn.className = 'ndns-panel-button';
        importSettingsBtn.onclick = () => {
            importSettingsInput.value = '';
            importSettingsInput.click();
        };
        importSettingsInput.onchange = async () => {
            await importNdnsSettingsBackupFile(importSettingsInput.files?.[0], storageDoctorStatus);
        };

        const offlineCacheStatus = document.createElement('div');
        offlineCacheStatus.className = 'settings-section-description';
        offlineCacheStatus.textContent = formatOfflineLogCachePrivacyStatus();

        const offlineCacheRow = document.createElement('div');
        offlineCacheRow.className = 'settings-control-row';
        offlineCacheRow.appendChild(createSafeElement('span', { text: 'Offline Log Cache' }));
        const offlineCacheToggle = document.createElement('div');
        offlineCacheToggle.className = `ndns-toggle-switch ${offlineLogCachePrivacy.enabled ? 'active' : ''}`;
        offlineCacheToggle.onclick = async () => {
            offlineLogCachePrivacy.enabled = !offlineLogCachePrivacy.enabled;
            offlineCacheToggle.classList.toggle('active', offlineLogCachePrivacy.enabled);
            await storage.set({ [KEY_OFFLINE_LOG_CACHE_PRIVACY]: offlineLogCachePrivacy });
            offlineCacheStatus.textContent = formatOfflineLogCachePrivacyStatus();
            showToast(`Offline log cache ${offlineLogCachePrivacy.enabled ? 'enabled' : 'disabled'}.`);
        };
        offlineCacheRow.appendChild(offlineCacheToggle);

        const offlineTtlRow = document.createElement('div');
        offlineTtlRow.className = 'settings-control-row';
        offlineTtlRow.appendChild(createSafeElement('span', { text: 'Offline Cache TTL' }));
        const offlineTtlSelect = document.createElement('select');
        offlineTtlSelect.setAttribute('aria-label', 'Offline cache TTL');
        OFFLINE_LOG_CACHE_TTL_DAYS.forEach((days) => {
            const option = document.createElement('option');
            option.value = String(days);
            option.textContent = `${days} day${days === 1 ? '' : 's'}`;
            option.selected = offlineLogCachePrivacy.ttlDays === days;
            offlineTtlSelect.appendChild(option);
        });
        offlineTtlSelect.onchange = async () => {
            offlineLogCachePrivacy.ttlDays = Number(offlineTtlSelect.value) || 1;
            await storage.set({ [KEY_OFFLINE_LOG_CACHE_PRIVACY]: offlineLogCachePrivacy });
            offlineCacheStatus.textContent = formatOfflineLogCachePrivacyStatus();
        };
        offlineTtlRow.appendChild(offlineTtlSelect);

        const offlineBackupRow = document.createElement('div');
        offlineBackupRow.className = 'settings-control-row';
        offlineBackupRow.appendChild(createSafeElement('span', { text: 'Allow Future Cache Export' }));
        const offlineBackupToggle = document.createElement('div');
        offlineBackupToggle.className = `ndns-toggle-switch ${offlineLogCachePrivacy.includeInBackups ? 'active' : ''}`;
        offlineBackupToggle.onclick = async () => {
            offlineLogCachePrivacy.includeInBackups = !offlineLogCachePrivacy.includeInBackups;
            offlineBackupToggle.classList.toggle('active', offlineLogCachePrivacy.includeInBackups);
            await storage.set({ [KEY_OFFLINE_LOG_CACHE_PRIVACY]: offlineLogCachePrivacy });
            offlineCacheStatus.textContent = formatOfflineLogCachePrivacyStatus();
        };
        offlineBackupRow.appendChild(offlineBackupToggle);

        const purgeOfflineCacheBtn = document.createElement('button');
        purgeOfflineCacheBtn.textContent = 'Purge Offline Log Cache';
        purgeOfflineCacheBtn.className = 'ndns-panel-button danger';
        purgeOfflineCacheBtn.onclick = async () => {
            purgeOfflineCacheBtn.disabled = true;
            try {
                await purgeOfflineLogCache(offlineCacheStatus);
            } catch (error) {
                showToast(`Offline cache purge failed: ${error.message || error}`, true, 6000);
            } finally {
                purgeOfflineCacheBtn.disabled = false;
            }
        };

        const exportHostsBtn = document.createElement('button');
        exportHostsBtn.id = 'export-hosts-btn';
        exportHostsBtn.className = 'ndns-panel-button';
        exportHostsBtn.innerHTML = `<span>Export Blocked as HOSTS</span><div class="spinner"></div>`;
        exportHostsBtn.onclick = onDownloadBlockedHosts;

        const exportProfileBtn = document.createElement('button');
        exportProfileBtn.id = 'ndns-export-profile-btn';
        exportProfileBtn.textContent = uiText('exportProfile');
        exportProfileBtn.className = 'ndns-panel-button';
        exportProfileBtn.onclick = exportProfile;

        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Hidden List';
        importBtn.className = 'ndns-panel-button';
        importBtn.onclick = async () => {
            // Toggle inline import textarea
            let importArea = content.querySelector('.ndns-import-area');
            if (importArea) {
                importArea.remove();
                return;
            }
            importArea = document.createElement('div');
            importArea.className = 'ndns-import-area';
            importArea.style.cssText = 'margin-top: 8px;';
            const textarea = document.createElement('textarea');
            textarea.placeholder = 'Paste JSON hidden list here...';
            textarea.style.cssText = 'width:100%;min-height:60px;max-height:120px;resize:vertical;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;padding:10px;font-size:13px;font-family:inherit;box-sizing:border-box;';
            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Submit Import';
            submitBtn.className = 'ndns-panel-button';
            submitBtn.style.marginTop = '4px';
            submitBtn.onclick = async () => {
                const txt = textarea.value.trim();
                if (!txt) return;
                try {
                    JSON.parse(txt).forEach(d => hiddenDomains.add(d));
                    await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
                    showToast('Hidden list imported.');
                    importArea.remove();
                } catch { showToast('Invalid JSON', true); }
            };
            importArea.append(textarea, submitBtn);
            importBtn.parentElement.insertBefore(importArea, importBtn.nextSibling);
        };

        const bulkImportBtn = document.createElement('button');
        bulkImportBtn.textContent = 'Bulk Import Domains';
        bulkImportBtn.className = 'ndns-panel-button';
        bulkImportBtn.onclick = showBulkDomainImport;

        const wildcardBuilderBtn = document.createElement('button');
        wildcardBuilderBtn.textContent = 'Wildcard Builder';
        wildcardBuilderBtn.className = 'ndns-panel-button';
        wildcardBuilderBtn.onclick = showWildcardBuilder;

        const domainUndoBtn = document.createElement('button');
        domainUndoBtn.id = 'ndns-domain-undo-btn';
        domainUndoBtn.className = 'ndns-panel-button';
        domainUndoBtn.textContent = 'Undo Domain Action';
        domainUndoBtn.onclick = showDomainUndoHistory;
        updateDomainUndoButtonState(domainUndoBtn);

        const exportListBtn = document.createElement('button');
        exportListBtn.textContent = 'Export Hidden List';
        exportListBtn.className = 'ndns-panel-button';
        exportListBtn.onclick = () => {
            downloadFile(JSON.stringify([...hiddenDomains], null, 2), 'hidden_domains.json', 'application/json');
        };

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Hidden List';
        clearBtn.className = 'ndns-panel-button danger';
        clearBtn.onclick = async () => {
            if (await clearHiddenDomains()) {
                overlay.style.display = 'none';
            }
        };

        dataControls.append(
            storageDoctorStatus,
            storageDoctorBtn,
            exportSettingsBtn,
            importSettingsBtn,
            importSettingsInput,
            offlineCacheStatus,
            offlineCacheRow,
            offlineTtlRow,
            offlineBackupRow,
            purgeOfflineCacheBtn,
            exportHostsBtn,
            exportProfileBtn,
            bulkImportBtn,
            wildcardBuilderBtn,
            domainUndoBtn,
            importBtn,
            exportListBtn,
            clearBtn
        );
        dataSection.appendChild(dataControls);
        modalBody.appendChild(dataSection);

        // HaGeZi Section
        const hageziSection = document.createElement('div');
        hageziSection.className = 'ndns-settings-section';
        hageziSection.innerHTML = `<label>🛡️ HaGeZi TLD Management</label><div class="settings-section-description">Apply or remove TLDs from HaGeZi Spam TLDs list.</div>`;

        const hageziControls = document.createElement('div');
        hageziControls.className = 'ndns-settings-controls';

        const hageziVersionStatus = document.createElement('div');
        hageziVersionStatus.className = 'settings-section-description';
        hageziVersionStatus.textContent = formatHageziVersionStatus();

        const hageziAutoRow = document.createElement('div');
        hageziAutoRow.className = 'settings-control-row';
        hageziAutoRow.innerHTML = '<span>Weekly Auto-Sync</span>';

        const hageziAutoStatus = document.createElement('div');
        hageziAutoStatus.id = 'ndns-hagezi-auto-status';
        hageziAutoStatus.className = 'settings-section-description';
        hageziAutoStatus.textContent = formatHageziAutoSyncStatus();

        const hageziAutoToggle = document.createElement('div');
        hageziAutoToggle.className = `ndns-toggle-switch ${hageziAutoSyncConfig.enabled ? 'active' : ''}`;
        hageziAutoToggle.onclick = async () => {
            hageziAutoSyncConfig.enabled = !hageziAutoSyncConfig.enabled;
            hageziAutoToggle.classList.toggle('active', hageziAutoSyncConfig.enabled);
            await storage.set({ [KEY_HAGEZI_AUTO_SYNC]: hageziAutoSyncConfig });
            updateHageziAutoSyncStatusElement();
            if (hageziAutoSyncConfig.enabled) initHageziAutoSync();
            else if (hageziAutoSyncTimer) { clearInterval(hageziAutoSyncTimer); hageziAutoSyncTimer = null; }
        };
        hageziAutoRow.appendChild(hageziAutoToggle);

        const hageziButtons = [
            { text: 'Apply TLD Blocklist', action: 'apply', type: 'tlds', danger: false },
            { text: 'Remove TLD Blocklist', action: 'remove', type: 'tlds', danger: true },
            { text: 'Apply Domain Allowlist', action: 'apply', type: 'allowlist', danger: false },
            { text: 'Remove Domain Allowlist', action: 'remove', type: 'allowlist', danger: true }
        ];

        hageziButtons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.className = `ndns-panel-button ${btn.danger ? 'danger' : ''}`;
            button.onclick = (e) => manageHageziLists(btn.action, btn.type, e.target);
            hageziControls.appendChild(button);
        });

        const conflictResolverBtn = document.createElement('button');
        conflictResolverBtn.textContent = 'Resolve Allow/Deny Conflicts';
        conflictResolverBtn.className = 'ndns-panel-button';
        conflictResolverBtn.onclick = showConflictResolver;
        hageziControls.appendChild(conflictResolverBtn);

        const localBlocklistBtn = document.createElement('button');
        localBlocklistBtn.textContent = 'Import Local Blocklist';
        localBlocklistBtn.className = 'ndns-panel-button';
        localBlocklistBtn.onclick = showLocalBlocklistImport;
        hageziControls.appendChild(localBlocklistBtn);

        hageziControls.prepend(hageziAutoRow, hageziAutoStatus);
        hageziSection.append(hageziVersionStatus, hageziControls);
        modalBody.appendChild(hageziSection);

        // --- v3.4: Advanced Features Section ---
        const advancedSection = document.createElement('div');
        advancedSection.className = 'ndns-settings-section';
        advancedSection.innerHTML = `<label>🚀 Advanced Features</label>`;

        const advancedControls = document.createElement('div');
        advancedControls.className = 'ndns-settings-controls';

        // Profile Import button
        const importProfileBtn = document.createElement('button');
        importProfileBtn.textContent = uiText('importProfile');
        importProfileBtn.className = 'ndns-panel-button';
        importProfileBtn.onclick = () => { overlay.style.display = 'none'; importProfile(); };

        // Profile Clone button
        const cloneProfileBtn = document.createElement('button');
        cloneProfileBtn.textContent = 'Clone Profile';
        cloneProfileBtn.className = 'ndns-panel-button';
        cloneProfileBtn.onclick = () => { overlay.style.display = 'none'; cloneProfile(); };

        // Toggle options for v3.4 features
        const advancedToggles = [
            { label: 'CNAME Chain Display', get: () => showCnameChain, set: async (v) => { showCnameChain = v; await storage.set({ [KEY_SHOW_CNAME_CHAIN]: v }); invalidateLogCache(); cleanLogs(); } }
        ];

        advancedToggles.forEach(opt => {
            const row = document.createElement('div');
            row.className = 'settings-control-row';
            row.appendChild(createSafeElement('span', { text: opt.label }));
            const toggle = document.createElement('div');
            toggle.className = `ndns-toggle-switch ${opt.get() ? 'active' : ''}`;
            toggle.onclick = async () => {
                const newVal = !opt.get();
                await opt.set(newVal);
                toggle.classList.toggle('active', newVal);
            };
            row.appendChild(toggle);
            advancedControls.appendChild(row);
        });

        advancedControls.prepend(importProfileBtn, cloneProfileBtn);
        advancedSection.appendChild(advancedControls);
        modalBody.appendChild(advancedSection);

        // --- v3.4: DNS Rewrites Section ---
        const rewriteSection = document.createElement('div');
        rewriteSection.className = 'ndns-settings-section';
        rewriteSection.innerHTML = `<label>🔄 DNS Rewrites</label>`;
        const rewriteContainer = document.createElement('div');
        rewriteContainer.className = 'ndns-rewrite-panel';
        rewriteSection.appendChild(rewriteContainer);
        modalBody.appendChild(rewriteSection);

        // Load rewrites when section becomes visible
        const rewriteLoadBtn = document.createElement('button');
        rewriteLoadBtn.textContent = 'Load Rewrites';
        rewriteLoadBtn.className = 'ndns-panel-button ndns-btn-sm';
        rewriteLoadBtn.onclick = () => initRewritePanel(rewriteContainer);
        rewriteContainer.appendChild(rewriteLoadBtn);

        // --- v3.4: Parental Controls Section ---
        const parentalSection = document.createElement('div');
        parentalSection.className = 'ndns-settings-section';
        parentalSection.innerHTML = `<label>👪 Parental Controls</label>`;
        const parentalContainer = document.createElement('div');
        parentalContainer.className = 'ndns-parental-section';
        parentalSection.appendChild(parentalContainer);
        modalBody.appendChild(parentalSection);

        const parentalLoadBtn = document.createElement('button');
        parentalLoadBtn.textContent = 'Load Parental Controls';
        parentalLoadBtn.className = 'ndns-panel-button ndns-btn-sm';
        parentalLoadBtn.onclick = () => initParentalControls(parentalContainer);
        parentalContainer.appendChild(parentalLoadBtn);

        // --- v3.4: Regex Patterns Section ---
        const regexSection = document.createElement('div');
        regexSection.className = 'ndns-settings-section';
        regexSection.innerHTML = `<label>🔍 Regex Log Highlighting</label><div class="settings-section-description">Highlight log entries matching custom patterns.</div>`;
        const regexContainer = document.createElement('div');
        regexContainer.className = 'ndns-regex-manager';
        regexSection.appendChild(regexContainer);
        modalBody.appendChild(regexSection);
        buildRegexManager(regexContainer);

        // --- v3.4: Webhook Section ---
        const webhookSection = document.createElement('div');
        webhookSection.className = 'ndns-settings-section';
        webhookSection.innerHTML = `<label>🔔 Webhook Alerts</label><div class="settings-section-description">Send alerts when watched domains are queried.</div>`;
        const webhookContainer = document.createElement('div');
        webhookContainer.className = 'ndns-webhook-config';
        webhookSection.appendChild(webhookContainer);
        modalBody.appendChild(webhookSection);
        buildWebhookConfig(webhookContainer);

        // --- v3.4: Scheduled Logs Section ---
        const schedSection = document.createElement('div');
        schedSection.className = 'ndns-settings-section';
        schedSection.innerHTML = `<label>📅 Scheduled Log Downloads</label>`;
        const schedControls = document.createElement('div');
        schedControls.className = 'ndns-settings-controls';

        const schedRow = document.createElement('div');
        schedRow.className = 'settings-control-row';
        schedRow.innerHTML = '<span>Auto-Download Logs</span>';
        const schedToggle = document.createElement('div');
        schedToggle.className = `ndns-toggle-switch ${scheduledLogsConfig.enabled ? 'active' : ''}`;

        const schedConfig = document.createElement('div');
        schedConfig.className = 'ndns-schedule-config';
        schedConfig.style.display = scheduledLogsConfig.enabled ? 'flex' : 'none';

        const schedSelect = document.createElement('select');
        ['hourly', 'daily', 'weekly'].forEach(interval => {
            const opt = document.createElement('option');
            opt.value = interval;
            opt.textContent = interval.charAt(0).toUpperCase() + interval.slice(1);
            if (scheduledLogsConfig.interval === interval) opt.selected = true;
            schedSelect.appendChild(opt);
        });
        schedSelect.onchange = async () => {
            scheduledLogsConfig.interval = schedSelect.value;
            await storage.set({ [KEY_SCHEDULED_LOGS]: scheduledLogsConfig });
            initScheduledLogs();
        };

        const schedStatus = document.createElement('div');
        schedStatus.className = 'ndns-schedule-status';
        schedStatus.textContent = scheduledLogsConfig.lastRun
            ? `Last download: ${new Date(scheduledLogsConfig.lastRun).toLocaleString()}`
            : 'No downloads yet';

        schedToggle.onclick = async () => {
            scheduledLogsConfig.enabled = !scheduledLogsConfig.enabled;
            schedToggle.classList.toggle('active', scheduledLogsConfig.enabled);
            schedConfig.style.display = scheduledLogsConfig.enabled ? 'flex' : 'none';
            await storage.set({ [KEY_SCHEDULED_LOGS]: scheduledLogsConfig });
            if (scheduledLogsConfig.enabled) initScheduledLogs();
            else if (scheduledLogTimer) { clearInterval(scheduledLogTimer); scheduledLogTimer = null; }
        };

        schedRow.appendChild(schedToggle);
        schedConfig.appendChild(schedSelect);
        schedConfig.appendChild(schedStatus);
        schedControls.append(schedRow, schedConfig);
        schedSection.appendChild(schedControls);
        modalBody.appendChild(schedSection);

        return overlay;
    }

    // --- PANEL CREATION ---
    async function createPanel() {
        if (document.getElementById('ndns-panel-main')) return;

        panel = document.createElement('div');
        panel.id = 'ndns-panel-main';
        panel.className = 'ndns-panel';

        applyPanelWidth(panelWidth);
        panel.addEventListener('mouseenter', () => panel.classList.add('visible'));
        panel.addEventListener('mouseleave', hidePanel);

        // Header
        const header = document.createElement('div');
        header.className = 'ndns-panel-header';
        leftHeaderControls = document.createElement('div');
        leftHeaderControls.className = 'panel-header-controls';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'ndns-header-title';
        titleSpan.textContent = 'NDNS';
        rightHeaderControls = document.createElement('div');
        rightHeaderControls.className = 'panel-header-controls';
        header.append(leftHeaderControls, titleSpan, rightHeaderControls);
        panel.appendChild(header);

        // Header buttons
        settingsButton = document.createElement('button');
        settingsButton.title = 'Settings';
        settingsButton.appendChild(icons.settings.cloneNode(true));
        settingsButton.onclick = () => {
            if (!settingsModal) return;
            settingsModal.style.display = 'flex';
            scanDialogAccessibility(settingsModal);
            focusDialog(settingsModal);
        };

        togglePosButton = document.createElement('button');
        togglePosButton.onclick = async () => {
            const currentSide = panel.classList.contains('left-side') ? 'left' : 'right';
            await storage.set({ [KEY_POSITION_SIDE]: (currentSide === 'left' ? 'right' : 'left') });
            await applyPanelPosition();
        };

        lockButton = document.createElement('button');
        lockButton.title = 'Lock/Unlock Panel';
        lockButton.onclick = toggleLock;

        // Content
        const content = document.createElement('div');
        content.className = 'ndns-panel-content';
        panel.appendChild(content);

        content.appendChild(buildNextDnsVerificationSection());

        // --- LOG ACTION BUTTONS (only on logs page) ---
        const logActionSection = document.createElement('div');
        logActionSection.id = 'ndns-section-logActions';
        logActionSection.className = 'ndns-section';

        const downloadLogBtn = document.createElement('button');
        downloadLogBtn.className = 'ndns-panel-button ndns-tooltip';
        downloadLogBtn.textContent = 'Download Log';
        downloadLogBtn.dataset.tooltip = 'Download all logs as CSV file';
        downloadLogBtn.onclick = quickDownloadLogs;

        const clearLogBtn = document.createElement('button');
        clearLogBtn.className = 'ndns-panel-button danger ndns-tooltip';
        clearLogBtn.textContent = 'Clear Log';
        clearLogBtn.dataset.tooltip = 'Delete all log entries';
        clearLogBtn.onclick = quickClearLogs;

        const reviewDomainBtn = document.createElement('button');
        reviewDomainBtn.className = 'ndns-panel-button ndns-tooltip';
        reviewDomainBtn.textContent = 'Review Domain';
        reviewDomainBtn.dataset.tooltip = 'Pick one loaded query domain for review';
        reviewDomainBtn.onclick = () => showDomainOfDay(false);

        logActionSection.append(downloadLogBtn, clearLogBtn, reviewDomainBtn);
        content.appendChild(logActionSection);

        // --- FILTER BUTTONS (only on logs page) ---
        const filterSection = document.createElement('div');
        filterSection.id = 'ndns-section-filters';
        filterSection.className = 'ndns-section';

        const filterButtons = [
            { key: 'hideList', label: 'Hide Hidden', tooltip: 'Hide domains in your hidden list' },
            { key: 'hideBlocked', label: 'Hide Blocked', tooltip: 'Hide blocked queries from log' },
            { key: 'showOnlyWhitelisted', label: 'Show Allowed Only', tooltip: 'Show only allowed queries' }
        ];

        filterButtons.forEach(({ key, label, tooltip }) => {
            const b = document.createElement('button');
            b.id = `toggle-${key}`;
            b.textContent = label;
            b.className = 'ndns-panel-button ndns-tooltip';
            b.dataset.tooltip = tooltip;
            b.onclick = () => toggleFeature(key);
            filterSection.appendChild(b);
        });

        // Native NextDNS toggle: Show Blocked Only
        const blockedOnlyBtn = document.createElement('button');
        blockedOnlyBtn.id = 'toggle-blockedOnly';
        blockedOnlyBtn.textContent = 'Show Blocked Only';
        blockedOnlyBtn.className = 'ndns-panel-button ndns-tooltip';
        blockedOnlyBtn.dataset.tooltip = 'Use NextDNS native filter to show only blocked queries';
        blockedOnlyBtn.onclick = () => toggleNativeCheckbox('blocked-queries-only', 'toggle-blockedOnly');
        filterSection.appendChild(blockedOnlyBtn);

        // Native NextDNS toggle: Raw DNS Logs
        const rawLogsBtn = document.createElement('button');
        rawLogsBtn.id = 'toggle-rawDnsLogs';
        rawLogsBtn.textContent = 'Raw DNS Logs';
        rawLogsBtn.className = 'ndns-panel-button ndns-tooltip';
        rawLogsBtn.dataset.tooltip = 'Show raw DNS logs with more technical details';
        rawLogsBtn.onclick = () => toggleNativeCheckbox('advanced-mode', 'toggle-rawDnsLogs');
        filterSection.appendChild(rawLogsBtn);

        content.appendChild(filterSection);
        content.appendChild(buildLogOriginFilterControls());

        // --- AUTO REFRESH (only on logs page) ---
        const autoRefreshSection = document.createElement('div');
        autoRefreshSection.id = 'ndns-section-autoRefresh';
        autoRefreshSection.className = 'ndns-section';

        const autoRefreshBtn = document.createElement('button');
        autoRefreshBtn.id = 'toggle-autoRefresh';
        autoRefreshBtn.textContent = '🔄 Auto Refresh (5s)';
        autoRefreshBtn.className = 'ndns-panel-button ndns-tooltip';
        autoRefreshBtn.dataset.tooltip = 'Automatically refresh logs every 5 seconds';
        autoRefreshBtn.onclick = () => toggleFeature('autoRefresh');

        autoRefreshSection.appendChild(autoRefreshBtn);
        content.appendChild(autoRefreshSection);

        // --- LOAD ALL LOGS BUTTON (only on logs page) ---
        const preloadSection = document.createElement('div');
        preloadSection.id = 'ndns-section-preload';
        preloadSection.className = 'ndns-section';

        const preloadBtn = document.createElement('button');
        preloadBtn.id = 'preload-btn';
        preloadBtn.textContent = 'Load All Logs';
        preloadBtn.className = 'ndns-panel-button ndns-tooltip';
        preloadBtn.dataset.tooltip = 'Scroll and load all available log entries';
        preloadBtn.onclick = () => autoScrollLog();

        preloadSection.appendChild(preloadBtn);
        content.appendChild(preloadSection);

        // --- BULK DELETE SECTION (only on denylist/allowlist pages) ---
        const bulkDeleteSection = document.createElement('div');
        bulkDeleteSection.id = 'ndns-section-bulkDelete';
        bulkDeleteSection.className = 'ndns-section';

        const bulkDeleteBtn = document.createElement('button');
        bulkDeleteBtn.id = 'bulk-delete-btn';
        bulkDeleteBtn.textContent = '🗑️ Bulk Delete';
        bulkDeleteBtn.className = 'ndns-panel-button danger ndns-tooltip';
        bulkDeleteBtn.dataset.tooltip = 'Delete entries in batches (rate limit safe)';
        bulkDeleteBtn.onclick = startBulkDelete;

        const stopBulkDeleteBtn = document.createElement('button');
        stopBulkDeleteBtn.id = 'stop-bulk-delete-btn';
        stopBulkDeleteBtn.textContent = '⏹️ Stop Deleting';
        stopBulkDeleteBtn.className = 'ndns-panel-button warning ndns-tooltip';
        stopBulkDeleteBtn.dataset.tooltip = 'Stop the bulk delete process';
        stopBulkDeleteBtn.style.display = 'none';
        stopBulkDeleteBtn.onclick = stopBulkDelete;

        const bulkDeleteStatus = document.createElement('div');
        bulkDeleteStatus.id = 'bulk-delete-status';
        bulkDeleteStatus.className = 'ndns-stats-row';
        bulkDeleteStatus.style.display = 'none';
        bulkDeleteStatus.innerHTML = '<span class="ndns-stats-label">Status:</span><span class="ndns-stats-value">Idle</span>';

        bulkDeleteSection.append(bulkDeleteBtn, stopBulkDeleteBtn, bulkDeleteStatus);
        content.appendChild(bulkDeleteSection);

        // --- PANEL FOOTER ---
        const footer = document.createElement('div');
        footer.className = 'ndns-panel-footer';
        footer.textContent = 'NDNS v3.4.41';
        panel.appendChild(footer);

        document.body.appendChild(panel);

        // --- PANEL VISIBILITY FUNCTION ---
        // Updates which sections are visible based on current page
        function updatePanelVisibility() {
            const currentPath = location.pathname;
            const isLogsPage = currentPath.includes('/logs');
            const isListPage = /\/denylist|\/allowlist/.test(currentPath);

            // Get section elements
            const logActionSection = document.getElementById('ndns-section-logActions');
            const filterSection = document.getElementById('ndns-section-filters');
            const originFilterSection = document.getElementById('ndns-log-origin-filter');
            const autoRefreshSection = document.getElementById('ndns-section-autoRefresh');
            const preloadSection = document.getElementById('ndns-section-preload');
            const bulkDeleteSection = document.getElementById('ndns-section-bulkDelete');

            // Log page sections: only on logs page
            if (logActionSection) {
                logActionSection.style.display = isLogsPage ? '' : 'none';
            }
            if (filterSection) {
                filterSection.style.display = isLogsPage ? '' : 'none';
            }
            if (originFilterSection) {
                originFilterSection.style.display = isLogsPage ? '' : 'none';
            }
            if (autoRefreshSection) {
                autoRefreshSection.style.display = isLogsPage ? '' : 'none';
            }
            if (preloadSection) {
                preloadSection.style.display = isLogsPage ? '' : 'none';
            }

            // Bulk Delete: only on denylist/allowlist pages
            if (bulkDeleteSection) {
                bulkDeleteSection.style.display = isListPage ? '' : 'none';
            }

        }

        // Call immediately
        updatePanelVisibility();

        // Store reference globally for use elsewhere
        window.ndnsUpdatePanelVisibility = updatePanelVisibility;

        // --- URL CHANGE OBSERVER ---
        // Watch for URL changes (SPA navigation) and force refresh on specific pages
        let lastUrl = location.href;
        const REFRESH_PAGES_PATTERN = /\/(logs|denylist|allowlist|analytics)$/;
        const REFRESH_MARKER_KEY = 'ndns_page_refreshed';

        function handleUrlChange() {
            const currentUrl = location.href;
            if (currentUrl === lastUrl) return;

            lastUrl = currentUrl;
            updatePanelVisibility();
            applyListPageTheme();

            // Clean up analytics dashboard when navigating away
            if (!/\/analytics/.test(currentUrl)) {
                const dashboardEl = document.querySelector('.ndns-analytics-page');
                if (dashboardEl) {
                    const parent = dashboardEl.parentElement;
                    dashboardEl.remove();
                    if (parent) {
                        parent.querySelectorAll('[data-ndns-hidden]').forEach(child => {
                            child.style.display = '';
                            delete child.dataset.ndnsHidden;
                        });
                    }
                }
            }

            // Check if we navigated TO a page that needs refresh (logs/denylist/allowlist)
            // Only refresh if API key is set (onboarding complete) and we didn't just refresh
            if (NDNS_API_KEY && REFRESH_PAGES_PATTERN.test(currentUrl)) {
                const refreshMarker = sessionStorage.getItem(REFRESH_MARKER_KEY);
                const markerData = refreshMarker ? JSON.parse(refreshMarker) : null;

                // Check if we already refreshed this exact URL recently (within 2 seconds)
                if (!markerData || markerData.url !== currentUrl || Date.now() - markerData.time > 2000) {
                    // Set marker before refresh to prevent loop
                    sessionStorage.setItem(REFRESH_MARKER_KEY, JSON.stringify({
                        url: currentUrl,
                        time: Date.now()
                    }));
                    // Force full page refresh
                    window.location.reload();
                    return;
                }
            }
        }

        const urlObserver = new MutationObserver(handleUrlChange);
        urlObserver.observe(document.body, { childList: true, subtree: true });

        // Also listen for popstate (browser back/forward)
        window.addEventListener('popstate', handleUrlChange);

        // Drag functionality (vertical)
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.panel-header-controls')) return;
            let offsetY = e.clientY - panel.getBoundingClientRect().top;
            const mouseMoveHandler = (e) => panel.style.top = (e.clientY - offsetY) + 'px';
            const mouseUpHandler = async () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                await storage.set({ [KEY_POSITION_TOP]: panel.style.top });
            };
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        // Resize functionality (horizontal via blue edge)
        let isResizing = false;
        panel.addEventListener('mousedown', async function(e) {
            const rect = panel.getBoundingClientRect();
            const isRightSide = panel.classList.contains('right-side');
            const edgeSize = 12; // Blue border is 8px + some tolerance

            // Check if clicking on the edge (blue border area)
            let onEdge = false;
            if (isRightSide) {
                onEdge = e.clientX <= rect.left + edgeSize;
            } else {
                onEdge = e.clientX >= rect.right - edgeSize;
            }

            if (!onEdge) return;

            e.preventDefault();
            isResizing = true;
            panel.style.cursor = 'ew-resize';
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';

            const startX = e.clientX;
            const startWidth = panelWidth;

            const resizeMoveHandler = (e) => {
                if (!isResizing) return;
                let newWidth;
                if (isRightSide) {
                    newWidth = startWidth + (startX - e.clientX);
                } else {
                    newWidth = startWidth + (e.clientX - startX);
                }
                newWidth = Math.max(140, Math.min(500, newWidth));
                applyPanelWidth(newWidth);
            };

            const resizeUpHandler = async () => {
                isResizing = false;
                panel.style.cursor = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', resizeMoveHandler);
                document.removeEventListener('mouseup', resizeUpHandler);
                await storage.set({ [KEY_WIDTH]: panelWidth });
            };

            document.addEventListener('mousemove', resizeMoveHandler);
            document.addEventListener('mouseup', resizeUpHandler);
        });
    }

    function initAllowDenyListPage() {
        const listType = location.pathname.includes('/denylist') ? 'denylist' : 'allowlist';

        // --- Inject page-specific CSS for denylist/allowlist ---
        if (!document.getElementById('ndns-list-page-css')) {
            const listPageStyles = document.createElement('style');
            listPageStyles.id = 'ndns-list-page-css';
            listPageStyles.textContent = `
                /* Denylist/Allowlist page-specific styles */
                .list-group-item .remove-list-item-btn { display: none !important; }
                .ndns-description-input { text-align: right; }
                .list-group-item span.notranslate { width: 1000px; display: inline-block; }
            `;
            document.head.appendChild(listPageStyles);
        }

        // Use unified extractRootDomain from outer scope
        const extractRootDomainFromFull = extractRootDomain;

        // --- Helper: Style domain with bold root / lighten subdomain ---
        function styleDomainElement(domainEl) {
            if (!domainEl || domainEl.dataset.ndnsStyled) return;
            domainEl.dataset.ndnsStyled = 'true';

            const fullDomain = domainEl.dataset.ndnsFullDomain || domainEl.textContent.trim();
            const hasWildcard = fullDomain.startsWith('*.');
            const cleanDomain = fullDomain.replace(/^\*\./, '');
            domainEl.dataset.ndnsFullDomain = fullDomain;
            domainEl.dataset.ndnsDomain = cleanDomain;
            const rootDomain = extractRootDomainFromFull(cleanDomain);
            const subdomain = cleanDomain.replace(rootDomain, '').replace(/\.$/, '');

            domainEl.innerHTML = '';

            if (hasWildcard) {
                const wildcardSpan = document.createElement('span');
                wildcardSpan.className = 'ndns-wildcard';
                wildcardSpan.textContent = '*.';
                domainEl.appendChild(wildcardSpan);
            }

            if (subdomain && listLightenSub) {
                const subSpan = document.createElement('span');
                subSpan.className = 'ndns-subdomain';
                subSpan.textContent = subdomain;
                domainEl.appendChild(subSpan);
            } else if (subdomain) {
                domainEl.appendChild(document.createTextNode(subdomain));
            }

            if (listBoldRoot) {
                const rootSpan = document.createElement('span');
                rootSpan.className = 'ndns-root-domain';
                rootSpan.textContent = rootDomain;
                domainEl.appendChild(rootSpan);
            } else {
                domainEl.appendChild(document.createTextNode(rootDomain));
            }
        }

        // --- Helper: Sort domains A-Z ---
        function sortDomainsAZ() {
            const listGroup = document.querySelector('.list-group:nth-child(2)');
            if (!listGroup) return;

            const items = Array.from(listGroup.querySelectorAll('.list-group-item'));
            const header = items.shift(); // Keep first item (input row) at top

            items.sort((a, b) => {
                const domainAEl = a.querySelector('.notranslate');
                const domainBEl = b.querySelector('.notranslate');
                const domainA = (domainAEl?.dataset.ndnsDomain || domainAEl?.textContent || '').toLowerCase().replace(/^\*\./, '');
                const domainB = (domainBEl?.dataset.ndnsDomain || domainBEl?.textContent || '').toLowerCase().replace(/^\*\./, '');

                const partsA = domainA.split('.');
                const partsB = domainB.split('.');

                // Sort TLDs first if enabled
                if (listSortTLD) {
                    const tldA = partsA[partsA.length - 1] || '';
                    const tldB = partsB[partsB.length - 1] || '';
                    if (tldA !== tldB) return tldA.localeCompare(tldB);
                }

                // Then sort by root domain
                let levelA = partsA.length - (listSortTLD ? 1 : 2);
                let levelB = partsB.length - (listSortTLD ? 1 : 2);

                if (levelA < 0) levelA = 0;
                if (levelB < 0) levelB = 0;

                let rootA = partsA[levelA] || '';
                let rootB = partsB[levelB] || '';

                // Handle SLDs
                if (SLDs.has(rootA) && levelA > 0) rootA = partsA[--levelA] || rootA;
                if (SLDs.has(rootB) && levelB > 0) rootB = partsB[--levelB] || rootB;

                return rootA.localeCompare(rootB);
            });

            // Re-append in sorted order
            if (header) listGroup.appendChild(header);
            items.forEach(item => listGroup.appendChild(item));
        }

        function getDomainFromItem(item) {
            const domainEl = item.querySelector('.notranslate');
            if (!domainEl) return '';
            return normalizeImportedDomain(domainEl.dataset.ndnsDomain || domainEl.textContent.trim().replace(/^\*\./, ''));
        }

        function getOrCreateDomainMetaRow(item) {
            let row = item.querySelector('.ndns-domain-meta-row');
            if (row) return row;

            const domainEl = item.querySelector('.notranslate');
            if (!domainEl) return null;
            const container = domainEl.closest('.d-flex') || domainEl.parentElement;
            if (!container) return null;
            row = document.createElement('div');
            row.className = 'ndns-domain-meta-row';

            const nestedContainer = container.querySelector('.d-flex');
            if (nestedContainer) {
                nestedContainer.appendChild(row);
            } else {
                container.appendChild(row);
            }
            return row;
        }

        function syncDomainMetaRowState(row) {
            if (!row) return;
            const hasDescription = !!row.querySelector('.ndns-description-input.has-value');
            const hasTag = !!row.querySelector('.ndns-domain-tag-select.has-value');
            row.classList.toggle('has-value', hasDescription || hasTag);
        }

        // --- Helper: Add description input to domain item ---
        function addDescriptionInput(item) {
            if (item.querySelector('.ndns-description-input')) return;

            const domain = getDomainFromItem(item);
            if (!domain) return;
            const row = getOrCreateDomainMetaRow(item);
            if (!row) return;

            const descInput = document.createElement('input');
            descInput.className = 'ndns-description-input';
            descInput.placeholder = 'Add description (Enter to save)';
            const legacyDomain = item.querySelector('.notranslate')?.textContent.trim().replace(/^\*\./, '') || '';
            descInput.value = domainDescriptions[domain] || domainDescriptions[legacyDomain] || '';
            if (descInput.value) descInput.classList.add('has-value');

            descInput.onkeypress = async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    domainDescriptions[domain] = descInput.value;
                    await storage.set({ [KEY_DOMAIN_DESCRIPTIONS]: domainDescriptions });
                    descInput.blur();
                    if (descInput.value) {
                        descInput.classList.add('has-value');
                    } else {
                        descInput.classList.remove('has-value');
                    }
                    syncDomainMetaRowState(row);
                    showToast('Description saved!', false, 1500);
                }
            };

            descInput.onblur = async () => {
                domainDescriptions[domain] = descInput.value;
                await storage.set({ [KEY_DOMAIN_DESCRIPTIONS]: domainDescriptions });
                if (descInput.value) {
                    descInput.classList.add('has-value');
                } else {
                    descInput.classList.remove('has-value');
                }
                syncDomainMetaRowState(row);
            };

            row.appendChild(descInput);
            syncDomainMetaRowState(row);
        }

        function addDomainTagEditor(item) {
            if (item.querySelector('.ndns-domain-tag-select')) return;

            const domain = getDomainFromItem(item);
            if (!domain) return;
            const row = getOrCreateDomainMetaRow(item);
            if (!row) return;

            const tagSelect = document.createElement('select');
            tagSelect.className = 'ndns-domain-tag-select';
            tagSelect.title = 'Domain tag';
            [
                { value: '', label: 'No tag' },
                { value: 'protected', label: 'Local keep' },
                { value: 'hagezi', label: 'HaGeZi' },
                { value: 'watch', label: 'Review' }
            ].forEach((optionDef) => {
                const option = document.createElement('option');
                option.value = optionDef.value;
                option.textContent = optionDef.label;
                tagSelect.appendChild(option);
            });

            const currentTag = getDomainTag(domain);
            if ([...tagSelect.options].some(option => option.value === currentTag)) {
                tagSelect.value = currentTag;
            }
            tagSelect.classList.toggle('has-value', !!tagSelect.value);

            tagSelect.onchange = async () => {
                if (tagSelect.value) {
                    domainTags[domain] = tagSelect.value;
                } else {
                    delete domainTags[domain];
                }
                tagSelect.classList.toggle('has-value', !!tagSelect.value);
                syncDomainMetaRowState(row);
                await storage.set({ [KEY_DOMAIN_TAGS]: domainTags });
                showToast(tagSelect.value === 'protected' ? 'Domain protected from HaGeZi removal.' : 'Domain tag saved.', false, 1500);
            };

            row.appendChild(tagSelect);
            syncDomainMetaRowState(row);
        }

        // --- Create Options Menu ---
        function createOptionsMenu() {
            if (document.getElementById('ndns-options-btn')) return;

            const listGroup = document.querySelector('.list-group');
            const firstItem = listGroup?.querySelector('.list-group-item');
            if (!firstItem) return;

            // Options button
            const optionsBtn = document.createElement('button');
            optionsBtn.id = 'ndns-options-btn';
            optionsBtn.className = 'ndns-options-btn';
            optionsBtn.innerHTML = '⚙️';
            optionsBtn.title = 'List Options';
            optionsBtn.style.cssText = 'position: absolute; right: 15px; top: 15px; z-index: 10;';

            // Options container
            const optionsContainer = document.createElement('div');
            optionsContainer.id = 'ndns-options-container';
            optionsContainer.className = 'ndns-options-container';

            // Create switches
            const switches = [
                { id: 'sortAZ', label: 'Sort A-Z by root domain', checked: listSortAZ, key: KEY_LIST_SORT_AZ, var: 'listSortAZ' },
                { id: 'sortTLD', label: 'Sort by TLD', checked: listSortTLD, key: KEY_LIST_SORT_TLD, var: 'listSortTLD' },
                { id: 'boldRoot', label: 'Bold root domain', checked: listBoldRoot, key: KEY_LIST_BOLD_ROOT, var: 'listBoldRoot' },
                { id: 'lightenSub', label: 'Lighten subdomains', checked: listLightenSub, key: KEY_LIST_LIGHTEN_SUB, var: 'listLightenSub' },
                { id: 'rightAlign', label: 'Right-align domains', checked: listRightAlign, key: KEY_LIST_RIGHT_ALIGN, var: 'listRightAlign' }
            ];

            switches.forEach(sw => {
                const switchDiv = document.createElement('div');
                switchDiv.className = 'ndns-switch';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = 'ndns-' + sw.id;
                checkbox.checked = sw.checked;

                const label = document.createElement('label');
                label.htmlFor = 'ndns-' + sw.id;
                label.textContent = sw.label;

                checkbox.onchange = async () => {
                    await storage.set({ [sw.key]: checkbox.checked });
                    // Update local variable
                    if (sw.var === 'listSortAZ') listSortAZ = checkbox.checked;
                    else if (sw.var === 'listSortTLD') listSortTLD = checkbox.checked;
                    else if (sw.var === 'listBoldRoot') listBoldRoot = checkbox.checked;
                    else if (sw.var === 'listLightenSub') listLightenSub = checkbox.checked;
                    else if (sw.var === 'listRightAlign') listRightAlign = checkbox.checked;

                    // Apply changes
                    if (sw.var.includes('Sort')) {
                        if (listSortAZ || listSortTLD) sortDomainsAZ();
                    }
                    if (sw.var.includes('bold') || sw.var.includes('lighten')) {
                        document.querySelectorAll('.list-group-item .notranslate').forEach(el => {
                            el.dataset.ndnsStyled = '';
                            styleDomainElement(el);
                        });
                    }
                    if (sw.var === 'listRightAlign') {
                        document.querySelectorAll('.list-group-item').forEach(item => {
                            if (listRightAlign) item.classList.add('ndns-right-align');
                            else item.classList.remove('ndns-right-align');
                        });
                    }
                };

                switchDiv.appendChild(checkbox);
                switchDiv.appendChild(label);
                optionsContainer.appendChild(switchDiv);
            });

            // Toggle options
            optionsBtn.onclick = (e) => {
                e.stopPropagation();
                optionsContainer.classList.toggle('show');
            };

            document.body.onclick = () => optionsContainer.classList.remove('show');
            optionsContainer.onclick = (e) => e.stopPropagation();

            firstItem.style.position = 'relative';
            firstItem.appendChild(optionsBtn);
            firstItem.appendChild(optionsContainer);
        }

        // --- Main enhancement function ---
        const enhanceDomainItems = () => {
            document.querySelectorAll(".list-group-item").forEach(item => {
                const domainEl = item.querySelector('.notranslate');
                if (!domainEl) return;

                // Style domain
                styleDomainElement(domainEl);

                // Add description input
                addDescriptionInput(item);
                addDomainTagEditor(item);

                // Apply right align if enabled
                if (listRightAlign) item.classList.add('ndns-right-align');
            });

            // Sort if enabled
            if (listSortAZ || listSortTLD) sortDomainsAZ();
        };

        // Wait for list to load then enhance
        const waitForList = setInterval(() => {
            const items = document.querySelectorAll('.list-group-item');
            if (items.length > 1) {
                clearInterval(waitForList);
                createOptionsMenu();
                enhanceDomainItems();

                // Observer for dynamic changes
                const observer = new MutationObserver(enhanceDomainItems);
                const targetNode = document.querySelector('.list-group');
                if (targetNode) {
                    observer.observe(targetNode, { childList: true, subtree: true });
                }
            }
        }, 200);
    }

    // --- NDNS: Log Counters ---
    let logCountersElement = null;
    let visibleCount = 0, filteredCount = 0, totalCount = 0;

    function createLogCounters() {
        if (!showLogCounters || logCountersElement) return;

        const logsContainer = document.querySelector('.Logs .list-group');
        if (!logsContainer) return;

        logCountersElement = document.createElement('div');
        logCountersElement.className = 'ndns-log-counters';
        logCountersElement.innerHTML = `
            <span>Visible: <span class="counter-value visible-count">0</span></span>
            <span>Filtered: <span class="counter-value filtered-count">0</span></span>
            <span>Total: <span class="counter-value total-count">0</span></span>
        `;

        logsContainer.parentElement.insertBefore(logCountersElement, logsContainer);
    }

    function updateLogCounters() {
        if (!logCountersElement) return;

        const allLogs = document.querySelectorAll('.Logs .list-group .log, .Logs .list-group .list-group-item:not(:first-child)');
        totalCount = allLogs.length;
        visibleCount = Array.from(allLogs).filter(el => el.style.display !== 'none').length;
        filteredCount = totalCount - visibleCount;

        const visibleEl = logCountersElement.querySelector('.visible-count');
        const filteredEl = logCountersElement.querySelector('.filtered-count');
        const totalEl = logCountersElement.querySelector('.total-count');

        if (visibleEl) visibleEl.textContent = visibleCount;
        if (filteredEl) filteredEl.textContent = filteredCount;
        if (totalEl) totalEl.textContent = totalCount;
    }

    // --- NDNS: Privacy Page - Collapsible Blocklists ---
    function initPrivacyPageEnhancements() {
        const waitForBlocklists = setInterval(() => {
            const listGroups = document.querySelectorAll('.list-group');
            let blocklistGroup = null;

            listGroups.forEach(lg => {
                if (lg.querySelector('.list-group-item')?.textContent.includes('blocklist')) {
                    blocklistGroup = lg;
                }
            });

            // Find blocklist section by looking for list with toggle switches
            const sections = document.querySelectorAll('.card, .list-group');
            sections.forEach(section => {
                const header = section.querySelector('.list-group-item');
                const items = section.querySelectorAll('.list-group-item');

                if (items.length > 3 && !section.querySelector('.ndns-collapse-btn')) {
                    // Check if this is the blocklist section (has many items with checkboxes)
                    const hasCheckboxes = section.querySelectorAll('input[type="checkbox"], .form-check').length > 2;
                    if (!hasCheckboxes) return;

                    const collapseContainer = document.createElement('div');
                    collapseContainer.className = 'ndns-collapse-container';

                    const collapseBtn = document.createElement('button');
                    collapseBtn.className = 'ndns-collapse-btn';
                    collapseBtn.textContent = collapseBlocklists ? 'Show list' : 'Hide list';

                    const alwaysCollapseLabel = document.createElement('label');
                    alwaysCollapseLabel.className = 'ndns-always-collapse';
                    const alwaysCollapseCheckbox = document.createElement('input');
                    alwaysCollapseCheckbox.type = 'checkbox';
                    alwaysCollapseCheckbox.checked = collapseBlocklists;
                    alwaysCollapseLabel.appendChild(alwaysCollapseCheckbox);
                    alwaysCollapseLabel.appendChild(document.createTextNode(' Always collapse'));

                    const toggleItems = (hide) => {
                        Array.from(items).slice(1).forEach(item => {
                            item.style.display = hide ? 'none' : '';
                        });
                        collapseBtn.textContent = hide ? 'Show list' : 'Hide list';
                    };

                    collapseBtn.onclick = () => {
                        const isHidden = items[1]?.style.display === 'none';
                        toggleItems(!isHidden);
                    };

                    alwaysCollapseCheckbox.onchange = async () => {
                        collapseBlocklists = alwaysCollapseCheckbox.checked;
                        await storage.set({ [KEY_COLLAPSE_BLOCKLISTS]: collapseBlocklists });
                    };

                    collapseContainer.appendChild(collapseBtn);
                    collapseContainer.appendChild(alwaysCollapseLabel);

                    if (header) {
                        header.appendChild(collapseContainer);
                        if (collapseBlocklists) toggleItems(true);
                    }
                }
            });

            if (document.querySelector('.ndns-collapse-btn')) {
                clearInterval(waitForBlocklists);
            }
        }, 500);

        // Clear after 10 seconds to prevent infinite loop
        setTimeout(() => clearInterval(waitForBlocklists), 10000);
    }

    // --- NDNS: Security Page - Collapsible TLDs ---
    function initSecurityPageEnhancements() {
        const waitForTLDs = setInterval(() => {
            const listGroups = document.querySelectorAll('.list-group');

            listGroups.forEach(section => {
                const items = section.querySelectorAll('.list-group-item');

                // Look for TLD list (items that look like .xyz, .top, etc.)
                const hasTLDs = Array.from(items).some(item => {
                    const text = item.textContent.trim();
                    return /^\.[a-z]{2,10}$/i.test(text.split(' ')[0]);
                });

                if (hasTLDs && items.length > 3 && !section.querySelector('.ndns-collapse-btn')) {
                    const header = items[0];

                    const collapseContainer = document.createElement('div');
                    collapseContainer.className = 'ndns-collapse-container';

                    const collapseBtn = document.createElement('button');
                    collapseBtn.className = 'ndns-collapse-btn';
                    collapseBtn.textContent = collapseTLDs ? 'Show list' : 'Hide list';

                    const alwaysCollapseLabel = document.createElement('label');
                    alwaysCollapseLabel.className = 'ndns-always-collapse';
                    const alwaysCollapseCheckbox = document.createElement('input');
                    alwaysCollapseCheckbox.type = 'checkbox';
                    alwaysCollapseCheckbox.checked = collapseTLDs;
                    alwaysCollapseLabel.appendChild(alwaysCollapseCheckbox);
                    alwaysCollapseLabel.appendChild(document.createTextNode(' Always collapse'));

                    const toggleItems = (hide) => {
                        Array.from(items).slice(1).forEach(item => {
                            item.style.display = hide ? 'none' : '';
                        });
                        collapseBtn.textContent = hide ? 'Show list' : 'Hide list';
                    };

                    collapseBtn.onclick = () => {
                        const isHidden = items[1]?.style.display === 'none';
                        toggleItems(!isHidden);
                    };

                    alwaysCollapseCheckbox.onchange = async () => {
                        collapseTLDs = alwaysCollapseCheckbox.checked;
                        await storage.set({ [KEY_COLLAPSE_TLDS]: collapseTLDs });
                    };

                    collapseContainer.appendChild(collapseBtn);
                    collapseContainer.appendChild(alwaysCollapseLabel);

                    header.appendChild(collapseContainer);
                    if (collapseTLDs) toggleItems(true);
                }
            });

            if (document.querySelector('.ndns-collapse-btn')) {
                clearInterval(waitForTLDs);
            }
        }, 500);

        setTimeout(() => clearInterval(waitForTLDs), 10000);
    }

    // --- MAIN FUNCTION ---
    async function main() {
        await initializeState();
        applyTheme(currentTheme);
        applyDensityMode(densityMode);
        applyUltraCondensedMode(isUltraCondensed);
        await resetThemeStudioCssForBypass();
        applyThemeStudioCss(themeStudioCss);
        applyListPageTheme();
        setupEscapeHandler();
        initAccessibilityObserver();
        if (storageDoctorReport?.repairedCount > 0) {
            setTimeout(() => showToast(formatStorageDoctorMessage(storageDoctorReport), true, 7000), 600);
        }

        const isLoggedIn = !document.querySelector('form[action="#submit"]');

        const profileIdFromUrl = getProfileID();
        if (profileIdFromUrl) {
            globalProfileId = profileIdFromUrl;
            await storage.set({ [KEY_PROFILE_ID]: profileIdFromUrl });
        }

        if (!isLoggedIn) {
            if (location.pathname === '/login' || location.pathname === '/signup') {
                createLoginSpotlight();
            } else if (location.pathname === '/') {
                window.location.href = 'https://my.nextdns.io/login';
            }
            return;
        }

        if (location.pathname.includes('/account')) {
            handleAccountPage();
            return;
        }

        if (sessionStorage.getItem('ndns_needs_refresh')) {
            sessionStorage.removeItem('ndns_needs_refresh');
            location.reload();
        }

        if (globalProfileId) {
            sessionStorage.setItem('ndns_profile_id', globalProfileId);
            loadLogOriginFilter();
            await createPanel();
            settingsModal = buildSettingsModal();
            document.body.appendChild(settingsModal);

            if (sessionStorage.getItem('ndns_reopen_settings')) {
                sessionStorage.removeItem('ndns_reopen_settings');
                setTimeout(() => {
                    if (settingsModal) {
                        settingsModal.style.display = 'flex';
                        scanDialogAccessibility(settingsModal);
                        focusDialog(settingsModal);
                    }
                }, 500);
            }

            const hageziDiffPayload = sessionStorage.getItem('ndns_hagezi_diff');
            if (hageziDiffPayload) {
                sessionStorage.removeItem('ndns_hagezi_diff');
                setTimeout(() => {
                    try {
                        showHageziDiffView(JSON.parse(hageziDiffPayload));
                    } catch {}
                }, 750);
            }

            const returnFlag = await storage.get(['ndns_return_from_account']);
            if (returnFlag.ndns_return_from_account) {
                await finalizeApiKeySetup();
                return;
            }

            if (!NDNS_API_KEY) {
                showOnboardingModal();
                return;
            }

            await applyPanelPosition();
            updateButtonStates();
            updateLockIcon();
            updatePanelBorderColor();

            if (filters.autoRefresh) startAutoRefresh();

            if (/\/logs/.test(location.href)) {
                const initialLogCheck = () => {
                    if (document.querySelector('div.list-group-item.log')) {
                        cleanLogs();
                        observeLogs();
                        initNativeToggleStates();
                        replaceStreamButtonIcon();
                        // NDNS: Log counters
                        if (showLogCounters) {
                            createLogCounters();
                            updateLogCounters();
                            // Update counters when logs change (childList only, not attributes to avoid loops)
                            const logsContainer = document.querySelector('.Logs .list-group');
                            if (logsContainer) {
                                const counterObserver = new MutationObserver(updateLogCounters);
                                counterObserver.observe(logsContainer, { childList: true, subtree: true });
                            }
                        }
                        return true;
                    }
                    return false;
                };
                if (!initialLogCheck()) {
                    const observer = new MutationObserver(() => {
                        if (initialLogCheck()) {
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            }

            if (/\/denylist|\/allowlist/.test(location.href)) {
                initAllowDenyListPage();
                checkBulkDeleteResume();
            }

            // NDNS: Privacy page enhancements
            if (/\/privacy/.test(location.href)) {
                initPrivacyPageEnhancements();
            }

            // NDNS: Security page enhancements
            if (/\/security/.test(location.href)) {
                initSecurityPageEnhancements();
            }

            // NDNS v3.4: Analytics page enhancements
            if (/\/analytics/.test(location.href)) {
                initAnalyticsEnhancements();
            }

            // NDNS v3.4: Scheduled log downloads
            initScheduledLogs();
            initHageziAutoSync();
            initParentalWeeklySchedule();
            initParentalDeviceOverrides();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
