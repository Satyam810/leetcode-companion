// settings.js – LeetCode Companion

function $(id) { return document.getElementById(id); }

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success', duration = 3500) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, duration);
}

// ── Toggle password visibility ────────────────────────────────────────────────
document.querySelectorAll('.toggle-vis').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// ── Load saved values ─────────────────────────────────────────────────────────
function loadSettings() {
  const logoEl = $('settings-logo');
  if (logoEl) logoEl.src = chrome.runtime.getURL('assets/icons/icon128.png');

  chrome.storage.sync.get(
    ['grokApiKey', 'githubToken', 'githubRepo', 'githubBranch', 'githubFolder', 'autoSync'],
    data => {
      if (data.grokApiKey) {
        $('grok-key').value = data.grokApiKey;
        $('grok-badge').textContent = 'Configured';
        $('grok-badge').className = 'status-badge ok';
      }
      if (data.githubToken) {
        $('github-token').value = data.githubToken;
        $('github-badge').textContent = 'Configured';
        $('github-badge').className = 'status-badge ok';
      }
      if (data.githubRepo)   $('github-repo').value   = data.githubRepo;
      if (data.githubBranch) $('github-branch').value = data.githubBranch;
      if (data.githubFolder) $('github-folder').value = data.githubFolder;
      $('auto-sync').checked = !!data.autoSync;
    }
  );
}

// ── Save ──────────────────────────────────────────────────────────────────────
$('btn-save').addEventListener('click', () => {
  const settings = {
    grokApiKey:        $('grok-key').value.trim(),
    githubToken:       $('github-token').value.trim(),
    githubRepo:        $('github-repo').value.trim(),
    githubBranch:      $('github-branch').value.trim() || 'main',
    githubFolder:      $('github-folder').value.trim(),
    autoSync:          $('auto-sync').checked,
  };

  if (!settings.grokApiKey)   return showToast('⚠ Grok API key is required.', 'error');
  if (!settings.githubToken)  return showToast('⚠ GitHub token is required.', 'error');
  if (!settings.githubRepo)   return showToast('⚠ GitHub repo is required.', 'error');

  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      showToast('❌ Failed to save: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showToast('✅ Settings saved!', 'success');
      $('grok-badge').textContent = 'Configured'; $('grok-badge').className = 'status-badge ok';
      $('github-badge').textContent = 'Configured'; $('github-badge').className = 'status-badge ok';
    }
  });
});

// ── Test Groq API Key ────────────────────────────────────────────
// Uses Groq (groq.com) – 100% free, no billing required
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'llama3-8b-8192', 'llama3-70b-8192'];
const GROQ_BASE   = 'https://api.groq.com/openai/v1';

async function testGroqKey(apiKey) {
  for (const model of GROQ_MODELS) {
    let res;
    try {
      res = await fetch(`${GROQ_BASE}/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with just the word OK' }],
          max_tokens: 5,
        }),
      });
    } catch (e) {
      return { success: false, fatal: true, error: `Network error: ${e.message}` };
    }

    let body;
    try { body = await res.json(); } catch (_) { body = {}; }

    if (res.ok) {
      const text = body?.choices?.[0]?.message?.content?.trim();
      if (text) return { success: true, model };
    }

    const errMsg = body?.error?.message || `HTTP ${res.status}`;

    // Invalid key → stop
    if (res.status === 401 || res.status === 403) {
      return { success: false, fatal: true, error: `Invalid API key (${res.status}): ${errMsg}` };
    }
    // Model issue → try next
  }
  return { success: false, error: 'No working Groq model found for this API key.' };
}

$('btn-test-grok').addEventListener('click', async () => {
  const apiKey = $('grok-key').value.trim();
  if (!apiKey) return showToast('⚠ Enter your Groq API key first.', 'error');
  if (!apiKey.startsWith('gsk_')) {
    showToast('⚠ Groq keys start with "gsk_". Please check your key.', 'error');
    return;
  }

  showToast('🔄 Testing Groq API…', 'success', 10000);
  const result = await testGroqKey(apiKey);

  if (result.success) {
    showToast(`✅ Groq works! Using: ${result.model}`, 'success', 5000);
    $('grok-badge').textContent = result.model;
    $('grok-badge').className = 'status-badge ok';
  } else {
    showToast(`❌ ${result.error}`, 'error', 6000);
    $('grok-badge').textContent = 'Error';
    $('grok-badge').className = 'status-badge bad';
  }
});

// ── Test GitHub Connection ────────────────────────────────────────────────────
$('btn-test').addEventListener('click', async () => {
  const token = $('github-token').value.trim();
  const repo  = $('github-repo').value.trim();
  if (!token || !repo) return showToast('⚠ Fill in GitHub token and repo first.', 'error');

  showToast('🔄 Testing GitHub…', 'success', 10000);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    let data;
    try { data = await res.json(); } catch (_) { data = {}; }

    if (res.ok) {
      showToast(`✅ GitHub connected: ${data.full_name}`, 'success');
    } else {
      showToast(`❌ ${data.message || 'Connection failed'}`, 'error');
    }
  } catch (e) {
    showToast('❌ Network error: ' + e.message, 'error');
  }
});

// ── Clear all ─────────────────────────────────────────────────────────────────
$('btn-clear').addEventListener('click', () => {
  if (!confirm('Clear all saved settings? This cannot be undone.')) return;
  chrome.storage.sync.clear(() => {
    ['grok-key', 'github-token', 'github-repo', 'github-branch', 'github-folder']
      .forEach(id => { $(id).value = ''; });
    $('auto-sync').checked = false;
    $('grok-badge').textContent = 'Not set';   $('grok-badge').className = 'status-badge bad';
    $('github-badge').textContent = 'Not set'; $('github-badge').className = 'status-badge bad';
    showToast('🗑 Settings cleared', 'success');
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadSettings);
