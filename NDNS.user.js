// ==UserScript==
// @name         NextDNS Ultimate Control Panel
// @namespace    https://github.com/SysAdminDoc
// @version      3.4.0
// @updateURL      https://raw.githubusercontent.com/SysAdminDoc/NDNS/main/NDNS.user.js
// @downloadURL    https://raw.githubusercontent.com/SysAdminDoc/NDNS/main/NDNS.user.js
// @description  Enhanced control panel for NextDNS with condensed view, quick actions, and consistent UI state across pages.
// @author       Matt Parker, with community patches
// @match        https://my.nextdns.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nextdns.io
// @connect      api.nextdns.io
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
    const KEY_LIST_PAGE_THEME = `${KEY_PREFIX}list_page_theme_v1`;
    const KEY_HAGEZI_ADDED_TLDS = `${KEY_PREFIX}hagezi_added_tlds_v1`;
    const KEY_HAGEZI_ADDED_ALLOWLIST = `${KEY_PREFIX}hagezi_added_allowlist_v1`;
    // NEW KEYS for v2.0
    const KEY_ULTRA_CONDENSED = `${KEY_PREFIX}ultra_condensed_v1`;
    const KEY_CUSTOM_CSS_ENABLED = `${KEY_PREFIX}custom_css_enabled_v1`;
    // NEW KEYS for v2.5 (NDNS features)
    const KEY_DOMAIN_DESCRIPTIONS = `${KEY_PREFIX}domain_descriptions_v1`;
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
    const KEY_SHOW_CNAME_CHAIN = `${KEY_PREFIX}show_cname_chain_v1`;

    // --- HAGEZI CONFIG ---
    const HAGEZI_TLDS_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock-aggressive.txt";
    const HAGEZI_ALLOWLIST_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock-allow.txt";

    // --- GLOBAL STATE ---
    let panel, lockButton, settingsModal, togglePosButton, settingsButton;
    let leftHeaderControls, rightHeaderControls;
    let isManuallyLocked = false;
    let filters = {};
    let hiddenDomains = new Set();
    let domainActions = {};
    let autoRefreshInterval = null;
    let currentTheme = 'dark';
    let panelWidth = 240;
    let isPreloadingCancelled = false;
    let enableListPageTheme = true;
    let listPageThemeStyleElement = null;
    // NEW STATE for v2.0
    let isUltraCondensed = true;
    let customCssEnabled = true;
    let ultraCondensedStyleElement = null;
    // NEW STATE for v2.5 (NDNS features)
    let domainDescriptions = {};
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
    let showCnameChain = true;
    let scheduledLogTimer = null;
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
            --panel-text-secondary: #94a1b2;
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
            --panel-text-secondary: #555b6e;
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
            --panel-text-secondary: #7a8a9a;
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
            color: #7a8a9a !important;
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

        /* Scheduled Logs */
        .ndns-schedule-config { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
        .ndns-schedule-config select {
            padding: 4px 8px; border-radius: 4px; font-size: 11px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
        }
        .ndns-schedule-status { font-size: 10px; color: var(--panel-text-secondary); margin-top: 4px; }

        /* Webhook Config */
        .ndns-webhook-config { margin-top: 8px; }
        .ndns-webhook-config input {
            width: 100%; padding: 6px 8px; border-radius: 6px; font-size: 12px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
            margin-bottom: 4px; box-sizing: border-box;
        }
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

    async function initializeState() {
        const defaultFilters = { hideList: false, hideBlocked: false, showOnlyWhitelisted: false, autoRefresh: false };
        const values = await storage.get({
            [KEY_FILTER_STATE]: defaultFilters,
            [KEY_HIDDEN_DOMAINS]: ['nextdns.io'],
            [KEY_LOCK_STATE]: true,
            [KEY_THEME]: 'dark',
            [KEY_WIDTH]: 180,
            [KEY_API_KEY]: null,
            [KEY_PROFILE_ID]: null,
            [KEY_DOMAIN_ACTIONS]: {},
            [KEY_LIST_PAGE_THEME]: true,
            [KEY_ULTRA_CONDENSED]: true,
            [KEY_CUSTOM_CSS_ENABLED]: true,
            // NDNS features
            [KEY_DOMAIN_DESCRIPTIONS]: {},
            [KEY_LIST_SORT_AZ]: false,
            [KEY_LIST_SORT_TLD]: false,
            [KEY_LIST_BOLD_ROOT]: true,
            [KEY_LIST_LIGHTEN_SUB]: true,
            [KEY_LIST_RIGHT_ALIGN]: false,

            [KEY_SHOW_LOG_COUNTERS]: true,
            [KEY_COLLAPSE_BLOCKLISTS]: false,
            [KEY_COLLAPSE_TLDS]: false,
            // v3.4 features
            [KEY_REGEX_PATTERNS]: [],
            [KEY_SCHEDULED_LOGS]: { enabled: false, interval: 'daily', lastRun: null },
            [KEY_WEBHOOK_URL]: '',
            [KEY_WEBHOOK_DOMAINS]: [],
            [KEY_SHOW_CNAME_CHAIN]: true
        });
        filters = { ...defaultFilters, ...values[KEY_FILTER_STATE] };
        hiddenDomains = new Set(values[KEY_HIDDEN_DOMAINS]);
        isManuallyLocked = values[KEY_LOCK_STATE];
        currentTheme = values[KEY_THEME];
        panelWidth = values[KEY_WIDTH];
        NDNS_API_KEY = values[KEY_API_KEY];
        globalProfileId = values[KEY_PROFILE_ID];
        domainActions = values[KEY_DOMAIN_ACTIONS];
        enableListPageTheme = values[KEY_LIST_PAGE_THEME];
        isUltraCondensed = values[KEY_ULTRA_CONDENSED];
        customCssEnabled = values[KEY_CUSTOM_CSS_ENABLED];
        // NDNS features
        domainDescriptions = values[KEY_DOMAIN_DESCRIPTIONS];
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
        showCnameChain = values[KEY_SHOW_CNAME_CHAIN];
    }

    async function makeApiRequest(method, endpoint, body = null, apiKey = NDNS_API_KEY, customUrl = null) {
        return new Promise((resolve, reject) => {
            try {
                const headers = { 'X-Api-Key': apiKey };
                if (body) headers['Content-Type'] = 'application/json;charset=utf-8';
                GM_xmlhttpRequest({
                    method: method,
                    url: customUrl || `https://api.nextdns.io${endpoint}`,
                    headers: headers,
                    data: body ? JSON.stringify(body) : undefined,
                    responseType: 'json',
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.response || {});
                        } else if (response.status === 404 && method === 'DELETE') {
                            resolve({});
                        } else {
                            const errorMsg = response.response?.errors?.[0]?.detail || `${response.status}: ${response.statusText || 'Error'}`;
                            reject(new Error(errorMsg));
                        }
                    },
                    onerror: (response) => {
                        reject(new Error(`Network request failed: ${response?.statusText || 'unknown error'}`));
                    },
                    ontimeout: () => {
                        reject(new Error('Request timed out'));
                    }
                });
            } catch (e) {
                reject(new Error(`Request setup failed: ${e?.message || 'unknown'}`));
            }
        });
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

    // --- NEW: Quick Actions from Panel (Download/Clear Logs) ---
    async function quickDownloadLogs() {
        const profileId = getCurrentProfileId();
        if (!profileId || !NDNS_API_KEY) {
            showToast('API Key or Profile ID missing.', true);
            return;
        }

        showToast('Downloading logs...', false, 2000);

        try {
            const csvText = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://api.nextdns.io/profiles/${profileId}/logs/download`,
                    headers: { 'X-Api-Key': NDNS_API_KEY },
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`API Error: ${response.status}`));
                        }
                    },
                    onerror: () => reject(new Error('Network request failed'))
                });
            });
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
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        const content = response.responseText.trim();
                        let items;
                        if (type === 'tld') {
                            items = content.match(/^\|\|(xn--)?\w+\^$/gm)?.map(e => e.slice(2, -1)) || [];
                        } else {
                            items = content.split("\n").map(e => e.slice(4, -1));
                        }
                        resolve(new Set(items));
                    } else {
                        reject(new Error(`Failed to fetch list: ${response.statusText}`));
                    }
                },
                onerror: (err) => reject(new Error('Network error fetching list.'))
            });
        });
    }

    async function manageHageziLists(action, listType, button) {
        const profileId = getCurrentProfileId();
        if (!profileId || !NDNS_API_KEY) return showToast("Profile ID or API Key missing.", true);

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Processing...';

        const config = {
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

        const currentConfig = config[listType];

        try {
            if (action === 'apply') {
                const remoteList = await fetchHageziList(currentConfig.url, currentConfig.parseType);
                const apiResponse = await makeApiRequest('GET', currentConfig.getEndpoint);
                const currentItems = new Set(
                    listType === 'tlds' ? apiResponse.data.tlds.map(t => t.id) : apiResponse.data.map(d => d.id)
                );

                const itemsToAdd = [...remoteList].filter(item => !currentItems.has(item));

                if (itemsToAdd.length === 0) {
                    showToast(`Your ${currentConfig.name} is already up to date.`, false);
                } else {
                    const toast = showToast(`Adding ${itemsToAdd.length} entries to ${currentConfig.name}... 0%`, false, itemsToAdd.length * 600);
                    for (let i = 0; i < itemsToAdd.length; i++) {
                        const item = itemsToAdd[i];
                        const body = listType === 'tlds' ? { id: item } : { id: item, active: true };
                        await makeApiRequest('POST', currentConfig.addEndpoint, body);
                        toast.textContent = `Adding to ${currentConfig.name}... ${Math.round((i + 1) / itemsToAdd.length * 100)}%`;
                        await sleep();
                    }
                    const existingAdded = (await storage.get({ [currentConfig.storageKey]: [] }))[currentConfig.storageKey];
                    const newlyAdded = new Set([...existingAdded, ...itemsToAdd]);
                    await storage.set({ [currentConfig.storageKey]: [...newlyAdded] });
                    showToast(`Successfully added ${itemsToAdd.length} entries.`, false);
                }

            } else if (action === 'remove') {
                const itemsToRemove = (await storage.get({ [currentConfig.storageKey]: [] }))[currentConfig.storageKey];
                if (itemsToRemove.length === 0) {
                    showToast(`No managed ${currentConfig.name} entries found to remove.`, false);
                } else {
                    const toast = showToast(`Removing ${itemsToRemove.length} entries from ${currentConfig.name}... 0%`, false, itemsToRemove.length * 600);
                    for (let i = 0; i < itemsToRemove.length; i++) {
                        const item = itemsToRemove[i];
                        await makeApiRequest('DELETE', currentConfig.removeEndpoint(item));
                        toast.textContent = `Removing from ${currentConfig.name}... ${Math.round((i + 1) / itemsToRemove.length * 100)}%`;
                        await sleep();
                    }
                    await storage.remove(currentConfig.storageKey);
                    showToast(`Successfully removed ${itemsToRemove.length} entries.`, false);
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

    // --- ONBOARDING & ACCOUNT HANDLING ---
    function showOnboardingModal(options = {}) {
        let existingOverlay = document.getElementById('ndns-onboarding-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ndns-onboarding-overlay';

        let modalHTML = `
            <h3>🔑 API Key Required</h3>
            <p>Let's grab your API key from your NextDNS account page to unlock full features.</p>
            <button id="ndns-get-api-key-btn" class="ndns-flashy-button">Take me there!</button>
        `;

        if (options.manual) {
            const profileId = getCurrentProfileId();
            modalHTML = `
                <h3>📋 Manual API Key Entry</h3>
                <p>Your API Key has been copied. Paste it below:</p>
                <div class="api-input-wrapper">
                    <input type="text" id="ndns-manual-api-input" placeholder="Paste API Key here...">
                </div>
                <button id="ndns-manual-api-submit" class="ndns-flashy-button">Accept API Key</button>
                <a href="https://my.nextdns.io/${profileId}/api" target="_blank" style="display: block; font-size: 11px; color: #888; margin-top: 12px; text-decoration: underline;">Didn't copy the key? Click here to return to the API page.</a>
            `;
        }

        overlay.innerHTML = `<div id="ndns-onboarding-modal">${modalHTML}</div>`;
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
        closeBtn.innerHTML = '&times;';
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
                message.innerHTML = `<b>Couldn't create an API key.</b><br>You'll need to upgrade to <b>NextDNS Pro</b> to use this feature.`;
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

        helper.innerHTML = `<p>⏳ Looking for the API section...</p>`;
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
                }
                #root { background-color: #260600; border-style: none; }
                div.pe-1.list-group-item { border-color: #5b0f00; }
                div.mt-4 { background-color: #4d0e00; }
                div.card-header, div.Header { background-color: #5b0f00; }
                button svg path { color: #ed8181; }
            `;
        } else if (isAllowlistPage) {
            cssRules += `
                div.pe-1.list-group-item, .flex-grow-1.d-flex.gap-2.align-items-center, .d-flex.align-items-center,
                .form-control, .list-group.list-group-flush, button.notranslate, span.d-none.d-lg-inline, button.dropdown-toggle {
                    background-color: #0a2915 !important;
                }
                #root { background-color: #0a2915; border-style: none; }
                div.pe-1.list-group-item { border-color: #134e27; }
                div.mt-4 { background-color: #1b3b24; }
                div.card-header, div.Header { background-color: #134e27; }
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
            await makeApiRequest('POST', apiUrl, { "id": domainToSend, "active": true }, NDNS_API_KEY);
            hiddenDomains.add(domain);
            await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
            const level = domain === extractRootDomain(domain) ? 'root' : 'sub';
            await updateDomainAction(domain, mode, level);
            showToast(`${domain} added to ${endpoint} and hidden!`);
            invalidateLogCache();
            cleanLogs();
        } catch (error) {
            showToast(`API Error: ${error.message || 'Unknown'}`, true);
        }
    }

    async function removeDomainViaApi(domain, listType) {
        if (!NDNS_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const endpoint = `/profiles/${pid}/${listType}/${domain}`;
        try {
            await makeApiRequest('DELETE', endpoint, null, NDNS_API_KEY);
            await updateDomainAction(domain, 'remove');
            showToast(`${domain} removed from ${listType}.`);
            invalidateLogCache();
            cleanLogs();
            if (/\/denylist|\/allowlist/.test(location.href)) {
                document.querySelectorAll(".list-group-item").forEach(item => {
                    const domainEl = item.querySelector('.notranslate');
                    if (domainEl && domainEl.textContent.trim() === domain) {
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
            createBtn('📋', 'Copy Domain', () => copyToClipboard(domain)),
            createBtn('🔍', 'Google', () => window.open(`https://www.google.com/search?q=${encodeURIComponent(domain)}`, '_blank')),
            createBtn('🕵️', 'Who.is', () => window.open(`https://www.who.is/whois/${encodeURIComponent(rootDomain)}`, '_blank'))
        ];

        buttons.forEach(btn => wrapper.appendChild(btn));
        const targetEl = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break');
        if (targetEl) targetEl.appendChild(wrapper);
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
                if (domain) checkWebhookAlert(domain);

                row.dataset.ndnsProcessed = '1';
            }

            // Visibility filtering (always runs - filters may have changed)
            const isConsideredBlocked = alreadyProcessed ? row.dataset.ndnsBlocked === '1' : row.classList.contains('ndns-row-blocked');
            const isConsideredAllowed = alreadyProcessed ? row.dataset.ndnsAllowed === '1' : row.classList.contains('ndns-row-allowed');
            const hideByDomainList = filters.hideList && [...hiddenDomains].some(h => domain.includes(h));

            let isVisible = true;
            if (filters.hideList && hideByDomainList) isVisible = false;
            if (filters.hideBlocked && isConsideredBlocked) isVisible = false;
            if (filters.showOnlyWhitelisted && !isConsideredAllowed) isVisible = false;

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
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-ndns-theme', theme);
        currentTheme = theme;
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
            const csvText = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://api.nextdns.io/profiles/${profileId}/logs/download`,
                    headers: { 'X-Api-Key': NDNS_API_KEY },
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`API Request Failed: ${response.status}`));
                        }
                    },
                    onerror: () => reject(new Error('Network request failed'))
                });
            });
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
            exportButton.textContent = 'Export Profile';
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
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => overlay.remove();

        let parsedImport = null;
        let currentConfig = null;

        previewBtn.onclick = async () => {
            const txt = textarea.value.trim();
            if (!txt) return showToast('Paste JSON first.', true);
            try {
                parsedImport = JSON.parse(txt);
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

            diffSummary.textContent = `+${addCount} additions, -${removeCount} removals, ${unchangedCount} unchanged`;
            diffSummary.style.display = '';
            diffContainer.style.display = '';
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
                // Apply each section via PATCH
                await makeApiRequest('PATCH', `/profiles/${pid}`, parsedImport, NDNS_API_KEY);
                showToast('Profile imported successfully! Reloading...');
                overlay.remove();
                setTimeout(() => location.reload(), 1500);
            } catch (e) {
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
                showToast(`Applied ${applied} items. Some sections may need manual config.`);
                overlay.remove();
                setTimeout(() => location.reload(), 1500);
            }
        };

        actions.append(previewBtn, applyBtn, cancelBtn);
        modal.append(label, textarea, diffSummary, diffContainer, actions);
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
        cancelBtn.textContent = 'Cancel';
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
            cancelBtn2.textContent = 'Cancel';
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
        refreshBtn.textContent = 'Refresh';
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
                list.innerHTML = '<div style="font-size: 11px; color: var(--panel-text-secondary); text-align: center; padding: 8px;">No rewrites configured</div>';
            } else {
                rewrites.forEach(rw => {
                    const item = document.createElement('div');
                    item.className = 'ndns-rewrite-item';
                    item.innerHTML = `<span><span class="domain">${escapeHtml(rw.name || '')}</span> <span class="answer">${escapeHtml(rw.content || rw.answer || '')}</span></span>`;
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
                    item.appendChild(delBtn);
                    list.appendChild(item);
                });
            }
        } catch (e) {
            list.innerHTML = `<div style="font-size: 11px; color: var(--danger-color);">Failed to load: ${e.message}</div>`;
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

    let analyticsCache = null;

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

    function buildAnalyticsHeader(pid, container) {
        const header = document.createElement('div');
        header.className = 'ndns-analytics-header';

        const h2 = document.createElement('h2');
        h2.textContent = 'Analytics Dashboard';
        header.appendChild(h2);

        const controls = document.createElement('div');
        controls.className = 'ndns-analytics-controls';

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh';
        refreshBtn.onclick = () => {
            analyticsCache = null;
            container.innerHTML = '';
            renderAnalyticsDashboard(pid, container);
        };
        controls.appendChild(refreshBtn);

        const csvBtn = document.createElement('button');
        csvBtn.textContent = 'Export CSV';
        csvBtn.onclick = () => exportAnalyticsCSV(pid);
        controls.appendChild(csvBtn);

        const jsonBtn = document.createElement('button');
        jsonBtn.textContent = 'Export JSON';
        jsonBtn.onclick = () => exportAnalyticsJSON(pid);
        controls.appendChild(jsonBtn);

        header.appendChild(controls);
        return header;
    }

    async function renderAnalyticsDashboard(pid, container) {
        container.innerHTML = '';
        container.appendChild(buildAnalyticsHeader(pid, container));

        const loading = document.createElement('div');
        loading.className = 'ndns-analytics-loading';
        loading.innerHTML = '<div class="spinner"></div><span>Loading analytics data...</span>';
        container.appendChild(loading);

        try {
            const safeApi = (endpoint) => makeApiRequest('GET', `/profiles/${pid}/analytics/${endpoint}`, null, NDNS_API_KEY).catch((err) => {
                console.warn(`[NDNS] Analytics API failed for ${endpoint}:`, err?.message || err);
                return null;
            });

            console.log('[NDNS] Fetching analytics for profile:', pid);

            const [domains, blockedDomains, statusData, dnssecData, encryptionData, protocolsData, queryTypesData, ipVersionsData, destinationsData, devicesData] = await Promise.all([
                safeApi('domains?limit=50'),
                safeApi('domains?status=blocked&limit=30'),
                safeApi('status'),
                safeApi('dnssec'),
                safeApi('encryption'),
                safeApi('protocols'),
                safeApi('queryTypes'),
                safeApi('ipVersions'),
                safeApi('destinations'),
                safeApi('devices')
            ]);

            console.log('[NDNS] Analytics data loaded successfully');

            const norm = (d) => {
                if (!d) return [];
                if (Array.isArray(d)) return d;
                if (Array.isArray(d.data)) return d.data;
                if (d.data && typeof d.data === 'object') return Object.entries(d.data).map(([k, v]) => ({ name: k, queries: typeof v === 'number' ? v : 0 }));
                return [];
            };
            const excludeDomain = (arr) => arr.filter(d => d?.domain !== 'blockpage.nextdns.io' && d?.name !== 'blockpage.nextdns.io');
            analyticsCache = {
                domains: excludeDomain(norm(domains)), blocked: excludeDomain(norm(blockedDomains)), status: norm(statusData),
                dnssec: norm(dnssecData), encryption: norm(encryptionData), protocols: norm(protocolsData),
                queryTypes: norm(queryTypesData), ipVersions: norm(ipVersionsData),
                destinations: norm(destinationsData), devices: norm(devicesData)
            };

            loading.remove();
            buildDashboardContent(container, analyticsCache);

        } catch (e) {
            loading.innerHTML = `<span style="color:var(--danger-color);">Failed to load analytics: ${escapeHtml(String(e?.message || e || 'Unknown error'))}</span>`;
        }
    }

    function resolveItems(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data.map(d => {
            let name = d?.name || d?.domain || d?.id || d?.status || d?.protocol || d?.type || 'Unknown';
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
        const totalQueries = statusItems.reduce((s, i) => s + i.value, 0);
        const blockedCount = statusItems.find(i => /block/i.test(i.name))?.value || 0;
        const allowedCount = statusItems.find(i => /allow|default|pass|ok/i.test(i.name))?.value || 0;
        const blockedPct = totalQueries > 0 ? (blockedCount / totalQueries * 100).toFixed(1) : '0.0';
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
        cardData.forEach(c => {
            const card = document.createElement('div');
            card.className = 'ndns-stat-card';
            card.innerHTML = `<div class="card-value ${c.cls}">${c.value}</div><div class="card-label">${c.label}</div>${c.sub ? `<div class="card-sub">${c.sub}</div>` : ''}`;
            cards.appendChild(card);
        });
        container.appendChild(cards);

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
            const eName = escapeHtml(item.name);
            row.innerHTML = `<span class="ndns-bar-rank">${idx + 1}</span><span class="ndns-bar-label" title="${eName}">${eName}</span><div class="ndns-bar-track"><div class="ndns-bar-fill ${colorClass}" style="width:${pct}%"></div></div><span class="ndns-bar-count">${item.value.toLocaleString()}</span><span class="ndns-bar-pct">${pctOfTotal}%</span>`;
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
            row.innerHTML = `<span class="ndns-ring-legend-dot" style="background:${colors[i % colors.length]}"></span><span>${escapeHtml(item.name)}</span><span class="ndns-ring-legend-value">${item.value.toLocaleString()}</span><span class="ndns-ring-legend-pct">${pctStr}%</span>`;
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
        thead.innerHTML = '<tr><th>Status</th><th class="right">Queries</th><th class="right">Share</th></tr>';
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        items.forEach(item => {
            const tr = document.createElement('tr');
            const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0';
            tr.innerHTML = `<td>${escapeHtml(item.name)}</td><td class="right mono">${item.value.toLocaleString()}</td><td class="right mono">${pct}%</td>`;
            tbody.appendChild(tr);
        });

        // Total row
        const totalRow = document.createElement('tr');
        totalRow.style.cssText = 'font-weight:700; border-top:2px solid var(--panel-border);';
        totalRow.innerHTML = `<td>Total</td><td class="right mono">${total.toLocaleString()}</td><td class="right mono">100%</td>`;
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
        downloadFile(sections.join('\n'), `nextdns-analytics-${pid}.csv`, 'text/csv');
        showToast('Full analytics exported as CSV.');
    }

    function exportAnalyticsJSON(pid) {
        if (!analyticsCache) { showToast('No analytics data loaded.', true); return; }
        const exportData = { exportedAt: new Date().toISOString(), ...analyticsCache };
        downloadFile(JSON.stringify(exportData, null, 2), `nextdns-analytics-${pid}.json`, 'application/json');
        showToast('Full analytics exported as JSON.');
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

    // --- PARENTAL CONTROL QUICK TOGGLES ---
    async function initParentalControls(container) {
        if (!NDNS_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        container.innerHTML = '<div style="font-size:11px;color:var(--panel-text-secondary);">Loading parental controls...</div>';

        try {
            const config = await makeApiRequest('GET', `/profiles/${pid}/parentalControl`, null, NDNS_API_KEY);
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

            // Recreation time toggle
            const recTimeToggle = document.createElement('div');
            recTimeToggle.className = 'ndns-parental-toggle';
            const recTimeEnabled = config.recreationTime?.enabled || false;
            recTimeToggle.innerHTML = `
                <div class="toggle-label"><span>⏰</span><span>Recreation Time</span></div>
            `;
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

            categories.forEach(cat => {
                const isActive = config[cat.key] || (config.services && config.services.some(s => s.id === cat.key && s.active));
                const toggle = document.createElement('div');
                toggle.className = 'ndns-parental-toggle';
                toggle.innerHTML = `<div class="toggle-label"><span>${cat.icon}</span><span>${cat.label}</span></div>`;

                const sw = document.createElement('div');
                sw.className = `ndns-toggle-switch ${isActive ? 'active' : ''}`;
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
            container.innerHTML = `<div style="font-size:11px;color:var(--danger-color);">Failed: ${e.message}</div>`;
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
            item.innerHTML = `
                <span class="pattern">${escapeHtml(pattern.pattern)}</span>
                <div class="color-swatch" style="background:${escapeHtml(pattern.color || 'rgba(255,193,7,0.3)')}"></div>
            `;
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
    const webhookSentDomains = new Set();

    function checkWebhookAlert(domain) {
        if (!webhookUrl || webhookDomains.length === 0) return;
        if (webhookSentDomains.has(domain)) return;
        webhookSentDomains.add(domain);

        const matches = webhookDomains.some(wd => {
            try {
                return new RegExp(wd, 'i').test(domain);
            } catch {
                return domain.includes(wd);
            }
        });

        if (!matches) return;

        try {
            GM_xmlhttpRequest({
                method: 'POST',
                url: webhookUrl,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    event: 'domain_query',
                    domain: domain,
                    timestamp: new Date().toISOString(),
                    profile: getCurrentProfileId(),
                    source: 'NDNS v3.4.0'
                })
            });
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
            webhookUrl = urlInput.value.trim();
            await storage.set({ [KEY_WEBHOOK_URL]: webhookUrl });
            showToast('Webhook URL saved.');
        };
        container.appendChild(urlInput);

        const desc = document.createElement('div');
        desc.style.cssText = 'font-size: 10px; color: var(--panel-text-secondary); margin: 4px 0;';
        desc.textContent = 'Domains to watch (regex or substring, one per add):';
        container.appendChild(desc);

        const domainList = document.createElement('div');
        domainList.className = 'ndns-webhook-domains-list';
        webhookDomains.forEach((wd, idx) => {
            const item = document.createElement('div');
            item.className = 'ndns-webhook-domain-item';
            item.innerHTML = `<span style="font-family:monospace;">${escapeHtml(wd)}</span>`;
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
        addInput.placeholder = 'Domain pattern to watch';
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
    }

    // --- SETTINGS MODAL ---
    function buildSettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'ndns-settings-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

        const content = document.createElement('div');
        content.className = 'ndns-settings-modal-content';
        overlay.appendChild(content);

        const header = document.createElement('div');
        header.className = 'ndns-settings-modal-header';
        header.innerHTML = `
            <h3>⚙️ Settings</h3>
            <a href="https://github.com/SysAdminDoc" target="_blank" class="github-link">${icons.github.outerHTML} <span>Open Source on GitHub</span></a>
        `;
        content.appendChild(header);
        content.innerHTML += `<button class="ndns-settings-close-btn">&times;</button>`;
        content.querySelector('.ndns-settings-close-btn').onclick = () => overlay.style.display = 'none';

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
            row.innerHTML = `<span>${opt.label}</span>`;

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

        appearSection.appendChild(appearControls);
        modalBody.appendChild(appearSection);

        // Data Management Section
        const dataSection = document.createElement('div');
        dataSection.className = 'ndns-settings-section';
        dataSection.innerHTML = `<label>📦 Data Management</label>`;

        const dataControls = document.createElement('div');
        dataControls.className = 'ndns-settings-controls';

        const exportHostsBtn = document.createElement('button');
        exportHostsBtn.id = 'export-hosts-btn';
        exportHostsBtn.className = 'ndns-panel-button';
        exportHostsBtn.innerHTML = `<span>Export Blocked as HOSTS</span><div class="spinner"></div>`;
        exportHostsBtn.onclick = onDownloadBlockedHosts;

        const exportProfileBtn = document.createElement('button');
        exportProfileBtn.id = 'ndns-export-profile-btn';
        exportProfileBtn.textContent = 'Export Profile';
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

        dataControls.append(exportHostsBtn, exportProfileBtn, importBtn, exportListBtn, clearBtn);
        dataSection.appendChild(dataControls);
        modalBody.appendChild(dataSection);

        // HaGeZi Section
        const hageziSection = document.createElement('div');
        hageziSection.className = 'ndns-settings-section';
        hageziSection.innerHTML = `<label>🛡️ HaGeZi TLD Management</label><div class="settings-section-description">Apply or remove TLDs from HaGeZi Spam TLDs list.</div>`;

        const hageziControls = document.createElement('div');
        hageziControls.className = 'ndns-settings-controls';

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

        hageziSection.appendChild(hageziControls);
        modalBody.appendChild(hageziSection);

        // --- v3.4: Advanced Features Section ---
        const advancedSection = document.createElement('div');
        advancedSection.className = 'ndns-settings-section';
        advancedSection.innerHTML = `<label>🚀 Advanced Features</label>`;

        const advancedControls = document.createElement('div');
        advancedControls.className = 'ndns-settings-controls';

        // Profile Import button
        const importProfileBtn = document.createElement('button');
        importProfileBtn.textContent = 'Import Profile';
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
            row.innerHTML = `<span>${opt.label}</span>`;
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
        settingsButton.onclick = () => { if (settingsModal) settingsModal.style.display = 'flex'; };

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

        logActionSection.append(downloadLogBtn, clearLogBtn);
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
        footer.textContent = 'NDNS v3.4';
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

            const fullDomain = domainEl.textContent.trim();
            const hasWildcard = fullDomain.startsWith('*.');
            const cleanDomain = fullDomain.replace(/^\*\./, '');
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
                const domainA = a.querySelector('.notranslate')?.textContent.toLowerCase().replace(/^\*\./, '') || '';
                const domainB = b.querySelector('.notranslate')?.textContent.toLowerCase().replace(/^\*\./, '') || '';

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

        // --- Helper: Add description input to domain item ---
        function addDescriptionInput(item) {
            if (item.querySelector('.ndns-description-input')) return;

            const domainEl = item.querySelector('.notranslate');
            if (!domainEl) return;

            const domain = domainEl.textContent.trim().replace(/^\*\./, '');
            const container = domainEl.closest('.d-flex') || domainEl.parentElement;

            const descInput = document.createElement('input');
            descInput.className = 'ndns-description-input';
            descInput.placeholder = 'Add description (Enter to save)';
            descInput.value = domainDescriptions[domain] || '';
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
            };

            // Insert after the domain text
            if (container.querySelector('.d-flex')) {
                container.querySelector('.d-flex').appendChild(descInput);
            } else {
                container.appendChild(descInput);
            }
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
        applyUltraCondensedMode(isUltraCondensed);
        applyListPageTheme();
        setupEscapeHandler();

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
            await createPanel();
            settingsModal = buildSettingsModal();
            document.body.appendChild(settingsModal);

            if (sessionStorage.getItem('ndns_reopen_settings')) {
                sessionStorage.removeItem('ndns_reopen_settings');
                setTimeout(() => {
                    if (settingsModal) settingsModal.style.display = 'flex';
                }, 500);
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
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();