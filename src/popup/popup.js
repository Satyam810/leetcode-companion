// popup.js – LeetCode AI Companion

function $(id) { return document.getElementById(id); }

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Config Check ─────────────────────────────────────────────────────────────
async function checkConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['grokApiKey', 'githubToken', 'githubRepo'], data => {
      resolve(!!(data.grokApiKey && data.githubToken && data.githubRepo));
    });
  });
}

// ── Tab Detection ─────────────────────────────────────────────────────────────
async function detectLeetCodeTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (chrome.runtime.lastError || !tabs.length) return resolve(null);
      const url = tabs[0].url || '';
      resolve({
        tab:       tabs[0],
        isProblem: /leetcode\.com\/problems\//.test(url),
        isLeetCode: /leetcode\.com/.test(url),
      });
    });
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function loadStats() {
  chrome.storage.local.get(['stats', 'streak'], data => {
    const s = data.stats  || { easy: 0, medium: 0, hard: 0 };
    const k = data.streak || { current: 0, longest: 0 };

    $('stat-easy').textContent   = s.easy;
    $('stat-medium').textContent = s.medium;
    $('stat-hard').textContent   = s.hard;

    // Streak card
    const streakEl = $('stat-streak');
    if (streakEl) {
      streakEl.textContent = k.current;
      const sub = document.getElementById('streak-sub');
      if (sub) sub.textContent = `Best: ${k.longest}`;
    }
  });
}

// ── Streak Protection Settings ────────────────────────────────────────────
function loadStreakSettings() {
  chrome.storage.sync.get(['streakProtect', 'streakProtectHour', 'streakProtectMinute', 'streakProtectAmPm'], data => {
    const enabled = !!data.streakProtect;
    $('streak-protect').checked = enabled;
    $('automation-card').classList.toggle('enabled', enabled);

    // Restore saved time values or use defaults
    const hour = data.streakProtectHour || '10';
    const min  = data.streakProtectMinute !== undefined ? data.streakProtectMinute : '0';
    const ampm = data.streakProtectAmPm  || 'PM';

    $('streak-hour').value   = hour;
    $('streak-minute').value = min;
    $('streak-ampm').value   = ampm;
  });
}

function saveStreakSettings() {
  const enabled = $('streak-protect').checked;
  let   minute  = parseInt($('streak-minute').value, 10);
  if (isNaN(minute) || minute < 0)  minute = 0;
  if (minute > 59)                  minute = 59;
  $('streak-minute').value = minute;

  chrome.storage.sync.set({
    streakProtect:       enabled,
    streakProtectHour:   $('streak-hour').value,
    streakProtectMinute: String(minute),
    streakProtectAmPm:   $('streak-ampm').value,
  });

  $('automation-card').classList.toggle('enabled', enabled);
}

// ── Status Banner ─────────────────────────────────────────────────────────────
function setStatus({ active, text, sub }) {
  const banner = $('status-banner');
  const dot    = $('status-dot');
  banner.className = active ? 'active' : 'inactive';
  dot.className    = `status-dot ${active ? 'green' : 'grey'}`;
  $('status-text').textContent = text;
  $('status-sub').textContent  = sub;
}

// ── Action Handlers ───────────────────────────────────────────────────────────
async function handleToggleSidebar() {
  const result = await detectLeetCodeTab();
  if (!result?.isProblem) {
    return alert('Please navigate to a LeetCode problem page first.');
  }
  chrome.tabs.sendMessage(result.tab.id, { type: 'OPEN_SIDEBAR' }, () => {
    if (chrome.runtime.lastError) {
      alert('Content script not ready. Refresh the LeetCode tab and try again.');
    }
    window.close();
  });
}


async function handleSync() {
  const result = await detectLeetCodeTab();
  if (!result?.isProblem) {
    return alert('Please navigate to a LeetCode problem page first.');
  }
  chrome.tabs.sendMessage(result.tab.id, { type: 'SYNC_TO_GITHUB' }, () => {
    if (chrome.runtime.lastError) {
      alert('Content script not ready. Refresh the LeetCode tab and try again.');
    }
    window.close();
  });
}

async function handleHelpMeSolve() {
  const result = await detectLeetCodeTab();
  if (!result?.isProblem) {
    return alert('Please navigate to a LeetCode problem page first.');
  }
  chrome.tabs.sendMessage(result.tab.id, { type: 'HELP_ME_SOLVE' }, () => {
    if (chrome.runtime.lastError) {
      alert('Content script not ready. Refresh the LeetCode tab and try again.');
    }
    window.close();
  });
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/settings.html') });
  window.close();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Fix icon path — guarantees correct URL regardless of extension ID
  const logoEl = document.getElementById('popup-logo');
  if (logoEl) logoEl.src = chrome.runtime.getURL('assets/icons/icon128.png');
  const configured = await checkConfig();
  if (!configured) $('config-warning').classList.add('show');

  const result = await detectLeetCodeTab();
  if (!result) {
    setStatus({ active: false, text: 'No active tab', sub: 'Open Chrome and try again' });
  } else if (result.isProblem) {
    setStatus({ active: true,  text: 'LeetCode Problem Detected!', sub: result.tab.title || result.tab.url });
  } else if (result.isLeetCode) {
    setStatus({ active: false, text: 'On LeetCode', sub: 'Go to a problem page to use AI features' });
  } else {
    setStatus({ active: false, text: 'Not on LeetCode', sub: 'Visit leetcode.com/problems/ to start' });
  }

  loadStats();
  loadStreakSettings();

  // Try to sync real statistics from LeetCode
  chrome.runtime.sendMessage({ type: 'SYNC_LEETCODE_STATS' }, () => {
    loadStats();
  });

  $('btn-settings').addEventListener('click', openSettings);
  $('btn-refresh').addEventListener('click', () => {
    const btn = $('btn-refresh');
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.5s ease';
    chrome.runtime.sendMessage({ type: 'SYNC_LEETCODE_STATS' }, () => {
      btn.style.transform = 'none';
      btn.style.transition = 'none';
      loadStats();
    });
  });
  $('btn-toggle-sidebar').addEventListener('click', handleToggleSidebar);
  $('btn-help-solve').addEventListener('click', handleHelpMeSolve);
  $('btn-sync').addEventListener('click', handleSync);
  $('btn-history').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com' });
    window.close();
  });
  $('goto-settings').addEventListener('click', e => { e.preventDefault(); openSettings(); });
  $('footer-settings').addEventListener('click', e => { e.preventDefault(); openSettings(); });

  // ── Streak protection controls ──────────────────────────────────────────────
  $('streak-protect').addEventListener('change', saveStreakSettings);
  $('streak-hour').addEventListener('change', saveStreakSettings);
  $('streak-ampm').addEventListener('change', saveStreakSettings);
  $('streak-minute').addEventListener('change', saveStreakSettings);
  $('streak-minute').addEventListener('blur', saveStreakSettings);

  $('btn-save-streak-time').addEventListener('click', async () => {
    saveStreakSettings();
    const btn = $('btn-save-streak-time');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;">
      <polyline points="20 6 9 17 4 12"/>
    </svg> Applied!`;
    
    // Request instant check in background
    chrome.runtime.sendMessage({ type: 'FORCE_CHECK_STREAK_PROTECTION' });

    setTimeout(() => {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }, 1800);
  });

  $('btn-test-auto-solve').addEventListener('click', () => {
    const btn = $('btn-test-auto-solve');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="spinner-icon" style="animation: spin 1s linear infinite; margin-right: 2px;">
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg> Launching...`;
    chrome.runtime.sendMessage({ type: 'FORCE_RUN_AUTO_SOLVE' }, () => {
      // Re-enable and close
      setTimeout(() => {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
        window.close();
      }, 300);
    });
  });

  // Live-update stats when storage changes (background just synced)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.stats)  loadStats();
      if (changes.streak) loadStats();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
