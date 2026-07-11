// injector.js – injects the LeetCode Companion sidebar into LeetCode problem pages

(function () {
  'use strict';

  // ── Guard: only inject once ───────────────────────────────────────────────
  if (document.getElementById('lc-companion-root')) return;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getProblemTitle() {
    const tries = [
      () => document.querySelector('[data-cy="question-title"]')?.textContent.trim(),
      () => document.querySelector('a[class*="title"]')?.textContent.trim(),
      () => document.querySelector('.text-title-large')?.textContent.trim(),
      () => document.title.replace(/\s*-\s*LeetCode.*/, '').trim(),
    ];
    for (const fn of tries) {
      try { const v = fn(); if (v) return v; } catch (_) {}
    }
    const match = location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown Problem';
  }

  function getProblemSlug() {
    const match = location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : '';
  }

  function getDescription() {
    const el = document.querySelector('[data-track-load="description_content"]')
             || document.querySelector('.question-content')
             || document.querySelector('div[class*="description"]');
    return el ? el.innerText.slice(0, 2000) : '';
  }

  async function getFullMonacoCode() {
    return new Promise(resolve => {
      const div = document.createElement('div');
      div.id = 'lc-companion-extract-comm-div';
      document.body.appendChild(div);

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        div.remove();
      };

      div.addEventListener('lc-code-extracted', () => {
        const code = div.dataset.code || '';
        cleanup();
        resolve(code);
      });

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/content/editor-injector.js');
      (document.head || document.documentElement).appendChild(script);

      setTimeout(() => {
        if (!cleanedUp) {
          const code = div.dataset.code || '';
          cleanup();
          resolve(code);
        }
      }, 100);
    });
  }

  async function getCode() {
    try {
      const monacoCode = await getFullMonacoCode();
      if (monacoCode && monacoCode.trim()) return monacoCode;
    } catch (_) {}

    // 1. Monaco editor – each .view-line is one line of code
    const viewLines = document.querySelectorAll('.view-line');
    if (viewLines.length > 0) {
      return [...viewLines].map(l => l.textContent).join('\n').trimEnd();
    }
    // 2. Submission result page – code shown in a <pre> or pre-formatted block
    const pre = document.querySelector('pre') || document.querySelector('code');
    if (pre && pre.textContent.trim().length > 10) return pre.textContent.trim();
    // 3. CodeMirror fallback
    const cm = document.querySelector('.CodeMirror');
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();
    return '';
  }

  function getLanguage() {
    // LeetCode shows the selected language in a button or selector near the editor
    const candidates = [
      document.querySelector('button[id*="headlessui-listbox-button"]'),
      document.querySelector('.ant-select-selection-item'),
      ...[...document.querySelectorAll('button, span')].filter(el => {
        const t = el.textContent.trim();
        return /^(Python3?|JavaScript|TypeScript|Java|C\+\+|C#?|Go|Rust|Kotlin|Swift|Ruby|Scala)$/i.test(t)
               && !el.closest('#lc-companion-root'); // not our own UI
      }),
    ].filter(Boolean);

    const raw = candidates[0]?.textContent.trim().toLowerCase() || '';
    const map = {
      python: 'py', python3: 'py', javascript: 'js', typescript: 'ts',
      java: 'java', 'c++': 'cpp', c: 'c', 'c#': 'cs', go: 'go',
      rust: 'rs', kotlin: 'kt', swift: 'swift', ruby: 'rb', scala: 'scala',
    };
    return map[raw] || raw || 'txt';
  }

  function getDifficulty() {
    const els = document.querySelectorAll('span, div');
    for (const el of els) {
      const t = el.textContent.trim();
      if (t === 'Easy' || t === 'Medium' || t === 'Hard') return t;
    }
    return 'Unknown';
  }

  // ── Create sidebar ────────────────────────────────────────────────────────
  const STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    #lc-companion-root {
      --lc-bg-main: rgba(15, 17, 23, 0.97);
      --lc-bg-header: #151824;
      --lc-bg-card: #1e2235;
      --lc-border-color: rgba(255, 255, 255, 0.08);
      --lc-border: 1px solid var(--lc-border-color);
      --lc-border-focus: #6c63ff;
      --lc-text-primary: #fff;
      --lc-text-secondary: #e8eaf6;
      --lc-text-muted: #9094b4;
      --lc-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
      --lc-header-border: #2d3154;
      --lc-bg-tab: #11131c;
      --lc-bg-tab-hover: rgba(255, 255, 255, 0.02);
      --lc-bg-tab-active: rgba(129, 140, 248, 0.03);
      --lc-card-glow: rgba(129, 140, 248, 0.08);
      --lc-card-border-glow: rgba(129, 140, 248, 0.18);
      --lc-card-hover-border: rgba(129, 140, 248, 0.3);
      --lc-card-hover-shadow: rgba(0, 0, 0, 0.25);
    }

    #lc-companion-root.theme-light {
      --lc-bg-main: rgba(248, 250, 252, 0.98);
      --lc-bg-header: #f1f5f9;
      --lc-bg-card: #ffffff;
      --lc-border-color: rgba(15, 23, 42, 0.08);
      --lc-border: 1px solid var(--lc-border-color);
      --lc-border-focus: #4f46e5;
      --lc-text-primary: #0f172a;
      --lc-text-secondary: #334155;
      --lc-text-muted: #64748b;
      --lc-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
      --lc-header-border: #cbd5e1;
      --lc-bg-tab: #e2e8f0;
      --lc-bg-tab-hover: rgba(15, 23, 42, 0.03);
      --lc-bg-tab-active: rgba(79, 70, 229, 0.04);
      --lc-card-glow: rgba(79, 70, 229, 0.02);
      --lc-card-border-glow: rgba(79, 70, 229, 0.12);
      --lc-card-hover-border: rgba(79, 70, 229, 0.32);
      --lc-card-hover-shadow: rgba(15, 23, 42, 0.04);
    }

    #lc-companion-root * { box-sizing: border-box; font-family: 'Inter', sans-serif; }

    #lc-companion-panel {
      position: fixed; right: 20px; top: 75px;
      width: 380px; height: 600px;
      max-height: calc(100vh - 120px);
      background: var(--lc-bg-main); border: var(--lc-border);
      border-radius: 16px;
      backdrop-filter: blur(16px);
      display: flex; flex-direction: column;
      z-index: 9999; overflow: hidden;
      box-shadow: var(--lc-shadow);
      transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      transform: translateY(10px) scale(0.98);
      pointer-events: none;
    }
    #lc-companion-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    #lc-panel-header {
      padding: 16px 18px; border-bottom: 1px solid var(--lc-header-border);
      display: flex; align-items: center; gap: 12px;
      background: var(--lc-bg-header); flex-shrink: 0;
      cursor: grab;
      user-select: none;
    }
    #lc-panel-header:active {
      cursor: grabbing;
    }
    .lc-panel-logo {
      width: 32px; height: 32px; border-radius: 9px;
      background: linear-gradient(135deg, #6c63ff, #9c63ff);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(108,99,255,0.3);
    }
    .lc-panel-title {
      font-weight: 700; font-size: 13.5px; color: var(--lc-text-primary); white-space: nowrap;
    }
    .lc-panel-sub { font-size: 10.5px; color: var(--lc-text-muted); margin-top: 1px; }
    #lc-panel-close {
      margin-left: auto; background: none; border: none; color: var(--lc-text-muted);
      cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 6px;
      border-radius: 6px; transition: background .2s, color .2s;
    }
    #lc-panel-close:hover { background: var(--lc-bg-tab-hover); color: var(--lc-text-primary); }

    #lc-panel-content {
      flex: 1; overflow-y: auto; padding: 16px 18px;
      color: var(--lc-text-secondary); font-size: 13.5px; line-height: 1.7;
    }
    #lc-panel-content::-webkit-scrollbar { width: 6px; }
    #lc-panel-content::-webkit-scrollbar-track { background: transparent; }
    #lc-panel-content::-webkit-scrollbar-thumb { background: var(--lc-header-border); border-radius: 4px; }
    #lc-panel-content::-webkit-scrollbar-thumb:hover { background: var(--lc-border-focus); }

    #lc-panel-content h1, #lc-panel-content h2, #lc-panel-content h3 {
      color: var(--lc-border-focus); margin: 18px 0 8px; font-size: 13.5px;
      font-weight: 600; text-transform: uppercase; letter-spacing: .5px;
      border-bottom: 1px solid var(--lc-header-border); padding-bottom: 4px;
    }
    #lc-panel-content p { margin-bottom: 12px; color: var(--lc-text-secondary); text-align: justify; }
    #lc-panel-content ul, #lc-panel-content ol { padding-left: 20px; margin-bottom: 12px; color: var(--lc-text-secondary); }
    #lc-panel-content li { margin-bottom: 6px; }
    #lc-panel-content strong { color: var(--lc-text-primary); font-weight: 600; }

    .lc-inline-code {
      background: var(--lc-bg-card); color: #ff79c6; border: var(--lc-border);
      padding: 2px 6px; border-radius: 5px; font-family: monospace; font-size: 12px;
    }

    #lc-panel-actions {
      padding: 14px 18px; border-top: 1px solid var(--lc-header-border);
      display: flex; gap: 10px; flex-shrink: 0;
      background: var(--lc-bg-header);
    }
    .lc-btn {
      flex: 1; padding: 10px 14px; border-radius: 10px; border: none;
      cursor: pointer; font-weight: 600; font-size: 13px;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: all .2s;
    }
    .lc-btn:hover { opacity: .9; transform: translateY(-1px); }
    .lc-btn:active { transform: translateY(0); }
    .lc-btn-primary {
      background: linear-gradient(135deg, #6c63ff, #9c63ff);
      color: #fff;
      box-shadow: 0 4px 15px rgba(108,99,255,.4);
    }
    .lc-btn-secondary {
      background: var(--lc-bg-card); border: var(--lc-border); color: var(--lc-text-secondary);
    }
    .lc-btn-secondary:hover { border-color: var(--lc-border-focus); color: var(--lc-text-primary); }
    .lc-btn-warn {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #fff;
      box-shadow: 0 4px 15px rgba(245,158,11,.35);
    }
    .lc-btn-warn:hover { opacity: .9; }

    .lc-alert {
      padding: 12px 14px; border-radius: 10px; margin: 10px 0;
      font-size: 13px; line-height: 1.55;
    }
    .lc-alert-ok  { background: rgba(0,210,106,.08);  border: 1px solid rgba(0,210,106,.3);  color: #00d26a; }
    .lc-alert-err { background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.3); color: #f87171; }
    .lc-alert-info{ background: rgba(108,99,255,.08);  border: 1px solid rgba(108,99,255,.3);  color: #a5a0ff; }

    .lc-spinner {
      width: 28px; height: 28px; border: 3px solid var(--lc-header-border);
      border-top-color: #6c63ff; border-radius: 50%;
      animation: lc-spin .7s linear infinite; margin: 0 auto 12px;
    }
    @keyframes lc-spin { to { transform: rotate(360deg); } }

    #lc-companion-toggle {
      position: fixed; right: 0; top: 50%;
      width: 36px; height: 80px;
      background: linear-gradient(180deg, #6c63ff, #9c63ff);
      border: none; border-radius: 10px 0 0 10px;
      cursor: grab; z-index: 10000; color: #fff; font-size: 15px;
      box-shadow: -4px 0 20px rgba(108,99,255,.45);
      transition: background .2s, box-shadow .2s;
      display: flex; align-items: center; justify-content: center;
      padding-left: 2px;
      touch-action: none;
    }
    #lc-companion-toggle:active {
      cursor: grabbing;
    }

    #lc-toggle-close {
      position: absolute; top: -7px; left: -7px;
      width: 18px; height: 18px; border-radius: 50%;
      background: rgba(30, 34, 53, 0.92);
      border: 1.5px solid rgba(108, 99, 255, 0.5);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      color: #9ca3af; font-size: 11px; font-weight: 700; line-height: 1;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
      transition: color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.25s;
      z-index: 10001;
    }
    #lc-toggle-close:hover {
      color: #c4b5fd;
      border-color: rgba(139, 92, 246, 0.9);
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.5), 0 2px 8px rgba(0,0,0,0.4);
      transform: rotate(90deg) scale(1.15);
    }

    /* ── Chat Input Bar ──────────────────────────────────── */
    #lc-chat-bar {
      padding: 10px 14px; border-top: 1px solid var(--lc-header-border);
      background: var(--lc-bg-header); flex-shrink: 0;
      display: none;
    }
    #lc-chat-bar.active { display: flex; gap: 8px; align-items: center; }
    #lc-chat-input {
      flex: 1; background: var(--lc-bg-card); border: var(--lc-border);
      border-radius: 10px; padding: 9px 14px; color: var(--lc-text-secondary);
      font-size: 12.5px; font-family: 'Inter', sans-serif;
      outline: none; transition: border-color .2s;
      resize: none; min-height: 36px; max-height: 80px;
    }
    #lc-chat-input:focus { border-color: var(--lc-border-focus); }
    #lc-chat-input::placeholder { color: var(--lc-text-muted); }
    #lc-chat-send {
      width: 36px; height: 36px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #6c63ff, #9c63ff);
      color: #fff; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(108,99,255,.3);
      transition: all .2s; flex-shrink: 0;
    }
    #lc-chat-send:hover { transform: scale(1.05); box-shadow: 0 4px 14px rgba(108,99,255,.5); }
    #lc-chat-send:disabled { opacity: .4; cursor: not-allowed; transform: none; }

    /* ── Chat Messages ───────────────────────────────────── */
    .lc-chat-msg {
      margin: 8px 0; padding: 11px 15px; border-radius: 14px;
      font-size: 13px; line-height: 1.6; max-width: 88%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      animation: lc-msg-in .28s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes lc-msg-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .lc-chat-msg.user {
      background: linear-gradient(135deg, #6c63ff 0%, #4f46e5 100%);
      color: #fff; margin-left: auto; border-bottom-right-radius: 4px;
      box-shadow: 0 4px 12px rgba(108, 99, 255, 0.2);
    }
    .lc-chat-msg.ai {
      background: var(--lc-bg-card); border: var(--lc-border);
      color: var(--lc-text-secondary); border-bottom-left-radius: 4px;
      backdrop-filter: blur(8px);
    }
    .lc-chat-msg.ai h1, .lc-chat-msg.ai h2, .lc-chat-msg.ai h3 {
      color: var(--lc-border-focus); margin: 12px 0 6px; font-size: 12.5px;
      font-weight: 600; text-transform: uppercase; letter-spacing: .4px;
      border-bottom: 1px solid var(--lc-header-border); padding-bottom: 3px;
    }
    .lc-chat-msg.ai p { margin-bottom: 8px; }
    .lc-chat-msg.ai ul, .lc-chat-msg.ai ol { padding-left: 18px; margin-bottom: 8px; }
    .lc-chat-msg.ai li { margin-bottom: 4px; }
    .lc-chat-msg.ai strong { color: var(--lc-text-primary); }
    .lc-chat-label {
      font-size: 9.5px; text-transform: uppercase; letter-spacing: .6px;
      color: var(--lc-text-muted); margin-bottom: 3px; font-weight: 600;
    }
    .lc-chat-label.user-label { text-align: right; }

    .lc-typing {
      display: flex; gap: 4px; align-items: center; padding: 12px 16px;
    }
    .lc-typing-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #6c63ff;
      animation: lc-bounce .6s infinite alternate;
    }
    .lc-typing-dot:nth-child(2) { animation-delay: .15s; }
    .lc-typing-dot:nth-child(3) { animation-delay: .3s; }

    /* ── Tab Layout ──────────────────────────────────────── */
    .lc-tabs {
      display: flex; border-bottom: 1px solid var(--lc-border-color); background: var(--lc-bg-tab); flex-shrink: 0;
    }
    .lc-tab-btn {
      flex: 1; padding: 12px; background: none; border: none; color: var(--lc-text-muted);
      font-weight: 600; font-size: 12px; cursor: pointer; transition: all 0.2s;
      border-bottom: 2px solid transparent;
    }
    .lc-tab-btn.active {
      color: var(--lc-border-focus); border-bottom-color: var(--lc-border-focus); background: var(--lc-bg-tab-active);
    }
    .lc-tab-btn:hover:not(.active) {
      color: var(--lc-text-primary); background: var(--lc-bg-tab-hover);
    }
    
    /* ── Stats Card Layout ───────────────────────────────── */
    .lc-stats-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;
    }
    .lc-stat-card {
      background: var(--lc-bg-card);
      border: var(--lc-border);
      border-radius: 12px; padding: 12px; text-align: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .lc-stat-card:hover {
      transform: translateY(-2px); border-color: var(--lc-card-hover-border);
      box-shadow: 0 4px 12px var(--lc-card-hover-shadow);
    }
    .lc-stat-card:last-child {
      background: var(--lc-card-glow);
      border-color: var(--lc-card-border-glow);
    }
    .lc-stat-card:last-child:hover {
      border-color: var(--lc-card-hover-border);
    }
    .lc-stat-value { font-size: 20px; font-weight: 700; line-height: 1.1; }
    .lc-stat-value.easy { color: #34d399; }
    .lc-stat-value.medium { color: #fbbf24; }
    .lc-stat-value.hard { color: #f87171; }
    .lc-stat-value.streak { color: #818cf8; }
    .lc-stat-label { font-size: 9px; color: var(--lc-text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .lc-stat-sub { font-size: 9px; color: var(--lc-text-muted); margin-top: 2px; }

    /* ── Action Rows ─────────────────────────────────────── */
    .lc-sidebar-action-btn {
      display: flex; align-items: center; gap: 12px;
      background: var(--lc-bg-card);
      border: var(--lc-border);
      border-radius: 12px; padding: 10px 12px; cursor: pointer;
      transition: all 0.25s ease; text-align: left; width: 100%;
    }
    .lc-sidebar-action-btn:hover {
      border-color: var(--lc-card-hover-border);
      background: var(--lc-bg-tab-active);
      transform: translateX(2px);
    }
    .lc-action-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 14px;
    }
    .lc-action-icon.yellow { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
    .lc-action-icon.green { background: rgba(52, 211, 153, 0.12); color: #34d399; }
    .lc-action-text strong { display: block; font-size: 12.5px; font-weight: 600; color: var(--lc-text-primary); }
    .lc-action-text span { display: block; font-size: 10px; color: var(--lc-text-muted); margin-top: 1px; }

    /* ── Streak Protection Card ────────────────────────── */
    .lc-sidebar-card {
      background: var(--lc-bg-card);
      border: var(--lc-border);
      border-radius: 14px; padding: 14px; margin-bottom: 16px;
    }
    .lc-sidebar-card.enabled {
      border-color: var(--lc-card-border-glow);
      background: var(--lc-card-glow);
    }
    .lc-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .lc-card-title { font-weight: 600; font-size: 13px; color: var(--lc-text-primary); }
    .lc-card-sub { font-size: 10.5px; color: var(--lc-text-muted); margin-top: 1px; }
    
    .lc-switch { position: relative; display: inline-block; width: 34px; height: 18px; margin-left: auto; }
    .lc-switch input { opacity: 0; width: 0; height: 0; }
    .lc-slider { position: absolute; cursor: pointer; inset: 0; background: #2d3154; border-radius: 18px; transition: 0.3s; }
    .lc-slider::before { content: ''; position: absolute; height: 12px; width: 12px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
    .lc-switch input:checked + .lc-slider { background: #818cf8; }
    .lc-switch input:checked + .lc-slider::before { transform: translateX(16px); }

    .lc-time-picker {
      display: flex; align-items: center; gap: 6px;
      padding-top: 10px; border-top: var(--lc-border);
      margin-top: 10px;
    }
    .lc-time-select, .lc-time-input {
      background: var(--lc-bg-main); border: var(--lc-border);
      border-radius: 6px; padding: 4px 6px; color: var(--lc-text-primary);
      font-size: 11.5px; font-weight: 600; text-align: center; outline: none;
    }
    .lc-time-select:focus, .lc-time-input:focus { border-color: var(--lc-border-focus); }
    .lc-time-select { width: 50px; }
    .lc-time-input { width: 38px; }
    .lc-time-ampm { width: 50px; }
    
    .lc-action-row { display: flex; gap: 8px; margin-top: 10px; }
    .lc-action-btn {
      flex: 1; padding: 7px 10px; border-radius: 6px; border: none;
      font-weight: 600; font-size: 11px; cursor: pointer; text-align: center;
      transition: all 0.2s;
    }
    .lc-action-btn.primary { background: linear-gradient(135deg, #818cf8 0%, #4f46e5 100%); color: #fff; }
    .lc-action-btn.secondary { background: transparent; border: var(--lc-border); color: var(--lc-text-muted); }
    .lc-action-btn.secondary:hover { background: var(--lc-bg-tab-hover); color: var(--lc-text-primary); }
  `;

  function injectStyles() {
    const el = document.createElement('style');
    el.id = 'lc-companion-styles';
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  function createSidebar() {
    const root = document.createElement('div');
    root.id = 'lc-companion-root';
    root.innerHTML = `
      <div id="lc-companion-panel">
        <div id="lc-panel-header">
          <div class="lc-panel-logo" style="background:transparent; display:flex; align-items:center; justify-content:center;">
            <img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width: 22px; height: 22px; object-fit: contain;" alt="logo" />
          </div>
          <div>
            <div class="lc-panel-title">LeetCode Companion</div>
            <div class="lc-panel-sub" id="lc-panel-sub">Ready</div>
          </div>
          <button id="lc-panel-close" title="Close">×</button>
        </div>

        <!-- Tab Bar -->
        <div class="lc-tabs">
          <button class="lc-tab-btn active" id="lc-tab-dashboard">📊 Dashboard</button>
          <button class="lc-tab-btn" id="lc-tab-ai">🤖 AI Assistant</button>
        </div>

        <!-- Dashboard View -->
        <div id="lc-view-dashboard" style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 16px 18px;">
          <!-- Stats Grid -->
          <div class="lc-stats-grid">
            <div class="lc-stat-card">
              <div class="lc-stat-value easy" id="lc-db-easy">0</div>
              <div class="lc-stat-label">Easy</div>
            </div>
            <div class="lc-stat-card">
              <div class="lc-stat-value medium" id="lc-db-medium">0</div>
              <div class="lc-stat-label">Medium</div>
            </div>
            <div class="lc-stat-card">
              <div class="lc-stat-value hard" id="lc-db-hard">0</div>
              <div class="lc-stat-label">Hard</div>
            </div>
            <div class="lc-stat-card">
              <div class="lc-stat-value streak" id="lc-db-streak">0</div>
              <div class="lc-stat-label">🔥 Streak</div>
              <div class="lc-stat-sub" id="lc-db-streak-best">Best: 0</div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex; flex-direction:column; gap: 8px; margin-bottom:16px;">
            <button class="lc-sidebar-action-btn" id="lc-db-btn-help">
              <div class="lc-action-icon yellow">💡</div>
              <div class="lc-action-text">
                <strong>Help Me Solve</strong>
                <span>Get step-by-step guidance & hints</span>
              </div>
            </button>
            <button class="lc-sidebar-action-btn" id="lc-db-btn-sync">
              <div class="lc-action-icon green">⬆</div>
              <div class="lc-action-text">
                <strong>Sync to GitHub</strong>
                <span>Push current solution to your repo</span>
              </div>
            </button>
          </div>

          <!-- Streak Protection Card -->
          <div class="lc-sidebar-card" id="lc-db-streak-card">
            <div class="lc-card-header">
              <div>
                <div class="lc-card-title" style="font-size:12.5px; font-weight:600; color:#fff;">Streak Protection</div>
                <div class="lc-card-sub" id="lc-db-streak-status">Checking schedule...</div>
              </div>
              <label class="lc-switch">
                <input type="checkbox" id="lc-db-toggle-streak" />
                <span class="lc-slider"></span>
              </label>
            </div>
            
            <div class="lc-time-picker" id="lc-db-time-picker">
              <span style="font-size:11px; color:#9094b4;">Trigger:</span>
              <select class="lc-time-select" id="lc-db-hour">
                <option value="01">01</option><option value="02">02</option><option value="03">03</option><option value="04">04</option><option value="05">05</option><option value="06">06</option>
                <option value="07">07</option><option value="08">08</option><option value="09">09</option><option value="10">10</option><option value="11">11</option><option value="12">12</option>
              </select>
              <span style="color:#5c607d;">:</span>
              <input type="text" class="lc-time-input" id="lc-db-minute" value="00" maxlength="2" />
              <select class="lc-time-select lc-time-ampm" id="lc-db-ampm">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            
            <div class="lc-action-row" id="lc-db-automation-actions">
              <button class="lc-action-btn primary" id="lc-db-save-time">Save Schedule</button>
              <button class="lc-action-btn secondary" id="lc-db-test-now">Test Trigger</button>
            </div>
          </div>
        </div>

        <!-- AI Assistant View -->
        <div id="lc-view-ai" style="display:none; flex-direction:column; flex: 1; overflow:hidden;">
          <div id="lc-panel-content">
            <p style="color:#5c607d; text-align:center; margin-top:40px; font-size:12px;">
              Click <strong style="color:#fbbf24">Help Me Solve</strong> to get step-by-step guidance & hints,
              or <strong style="color:#9094b4">Sync</strong> to push your solution to GitHub.
            </p>
          </div>
          <div id="lc-panel-actions">
            <button class="lc-btn lc-btn-warn" id="lc-btn-help" style="flex: 1.2;">💡 Help Me Solve</button>
            <button class="lc-btn lc-btn-primary" id="lc-btn-autosolve" style="flex: 1.2; background: linear-gradient(135deg, #a78bfa, #7c3aed); border: none; color: #fff;">⚡ Auto-Solve</button>
            <button class="lc-btn lc-btn-secondary" id="lc-btn-sync" style="flex: 0.8;">⬆ Sync</button>
          </div>
          <div id="lc-chat-bar">
            <textarea id="lc-chat-input" placeholder="Ask a follow-up question..." rows="1"></textarea>
            <button id="lc-chat-send" title="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <button id="lc-companion-toggle" title="LeetCode Companion" style="display:flex; align-items:center; justify-content:center; padding: 0;">
        <img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width: 24px; height: 24px; object-fit: contain;" alt="logo" />
        <span id="lc-toggle-close" title="Hide sidebar completely">×</span>
      </button>
    `;
    document.body.appendChild(root);
  }

  // ── Wire up interactions ──────────────────────────────────────────────────
  function setupListeners() {
    const panel   = document.getElementById('lc-companion-panel');
    const toggle  = document.getElementById('lc-companion-toggle');
    const close   = document.getElementById('lc-panel-close');
    const content = document.getElementById('lc-panel-content');
    const sub     = document.getElementById('lc-panel-sub');
    const toggleClose = document.getElementById('lc-toggle-close');
    const chatBar   = document.getElementById('lc-chat-bar');
    const chatInput = document.getElementById('lc-chat-input');
    const chatSend  = document.getElementById('lc-chat-send');

    // Code blocks storage for copy delegation
    let currentCodeBlocks = [];

    // Chat state for 2-way conversation
    let chatHistory = [];  // Array of { role: 'user'|'assistant', content: string }

    const tabDashboard = document.getElementById('lc-tab-dashboard');
    const tabAi = document.getElementById('lc-tab-ai');
    const viewDashboard = document.getElementById('lc-view-dashboard');
    const viewAi = document.getElementById('lc-view-ai');

    function loadDbStats() {
      chrome.storage.local.get(['stats', 'streak'], (data) => {
        const stats = data.stats || { easy: 0, medium: 0, hard: 0 };
        const streak = data.streak || { current: 0, longest: 0 };
        
        const dbEasy = document.getElementById('lc-db-easy');
        const dbMedium = document.getElementById('lc-db-medium');
        const dbHard = document.getElementById('lc-db-hard');
        const dbStreak = document.getElementById('lc-db-streak');
        const dbStreakBest = document.getElementById('lc-db-streak-best');
        
        if (dbEasy) dbEasy.textContent = stats.easy;
        if (dbMedium) dbMedium.textContent = stats.medium;
        if (dbHard) dbHard.textContent = stats.hard;
        if (dbStreak) dbStreak.textContent = streak.current;
        if (dbStreakBest) dbStreakBest.textContent = `Best: ${streak.longest}`;
      });
    }

    function loadDbStreakSettings() {
      chrome.storage.sync.get(['streakProtect', 'streakProtectHour', 'streakProtectMinute', 'streakProtectAmPm'], (data) => {
        const isEnabled = data.streakProtect === true;
        const hour = data.streakProtectHour || '10';
        const min  = data.streakProtectMinute !== undefined ? data.streakProtectMinute : '00';
        const ampm = data.streakProtectAmPm  || 'PM';
        
        const toggleVal = document.getElementById('lc-db-toggle-streak');
        const hourSelect = document.getElementById('lc-db-hour');
        const minInput = document.getElementById('lc-db-minute');
        const ampmSelect = document.getElementById('lc-db-ampm');
        const card = document.getElementById('lc-db-streak-card');
        const statusText = document.getElementById('lc-db-streak-status');
        
        if (toggleVal) toggleVal.checked = isEnabled;
        if (card) {
          if (isEnabled) card.classList.add('enabled');
          else card.classList.remove('enabled');
        }
        
        if (statusText) {
          statusText.textContent = isEnabled 
            ? `Auto-solve active at ${hour}:${String(min).padStart(2, '0')} ${ampm}` 
            : 'Automated protection disabled';
        }
        
        if (hourSelect) hourSelect.value = String(hour).padStart(2, '0');
        if (minInput) minInput.value = String(min).padStart(2, '0');
        if (ampmSelect) ampmSelect.value = ampm;
      });
    }

    function saveDbSchedule() {
      const toggleVal = document.getElementById('lc-db-toggle-streak');
      const hourSelect = document.getElementById('lc-db-hour');
      const minInput = document.getElementById('lc-db-minute');
      const ampmSelect = document.getElementById('lc-db-ampm');
      
      const isEnabled = toggleVal ? toggleVal.checked : false;
      const hour = hourSelect ? hourSelect.value : '10';
      let minStr = minInput ? minInput.value.trim() : '00';
      const ampm = ampmSelect ? ampmSelect.value : 'PM';
      
      let min = parseInt(minStr, 10);
      if (isNaN(min) || min < 0 || min > 59) min = 0;
      minStr = String(min).padStart(2, '0');
      if (minInput) minInput.value = minStr;
      
      chrome.storage.sync.set({
        streakProtect: isEnabled,
        streakProtectHour: hour,
        streakProtectMinute: minStr,
        streakProtectAmPm: ampm
      }, () => {
        chrome.runtime.sendMessage({ type: 'UPDATE_ALARM' }, () => {
          const saveBtn = document.getElementById('lc-db-save-time');
          if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved! ✓';
            saveBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            setTimeout(() => {
              saveBtn.textContent = originalText;
              saveBtn.style.background = '';
              loadDbStreakSettings();
            }, 1500);
          }
        });
      });
    }

    function runDbTest() {
      const testBtn = document.getElementById('lc-db-test-now');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
      }
      
      chrome.runtime.sendMessage({ type: 'FORCE_RUN_AUTO_SOLVE' }, (res) => {
        if (testBtn) {
          testBtn.disabled = false;
          testBtn.textContent = 'Test Trigger';
        }
        if (res && res.success) {
          const sub = document.getElementById('lc-db-streak-status');
          if (sub) sub.textContent = 'Test triggered successfully!';
        } else {
          const sub = document.getElementById('lc-db-streak-status');
          if (sub) sub.textContent = 'Test trigger failed.';
        }
      });
    }

    function switchTab(tabName) {
      if (tabName === 'dashboard') {
        tabDashboard.classList.add('active');
        tabAi.classList.remove('active');
        viewDashboard.style.display = 'flex';
        viewAi.style.display = 'none';
        loadDbStats();
        loadDbStreakSettings();
      } else {
        tabDashboard.classList.remove('active');
        tabAi.classList.add('active');
        viewDashboard.style.display = 'none';
        viewAi.style.display = 'flex';
      }
    }

    function openPanel()  {
      const root = document.getElementById('lc-companion-root');
      if (root) {
        root.style.setProperty('display', '', 'important');
      }
      panel.classList.add('open');
      toggle.style.display = 'none';
      loadDbStats();
      loadDbStreakSettings();
    }
    
    function closePanel() {
      panel.classList.remove('open');
      toggle.style.display = '';
      chrome.storage.sync.get(['showSidebar'], (data) => {
        if (data.showSidebar === false) {
          const root = document.getElementById('lc-companion-root');
          if (root) {
            root.style.setProperty('display', 'none', 'important');
          }
        }
      });
    }

    function handleToggleFromPopup() {
      const root = document.getElementById('lc-companion-root');
      if (!root || !toggle || !panel) return;

      chrome.storage.sync.get(['showSidebar'], (data) => {
        const isCurrentlyShown = data.showSidebar !== false;
        
        if (isCurrentlyShown) {
          chrome.storage.sync.set({ showSidebar: false }, () => {
            root.style.setProperty('display', 'none', 'important');
            panel.classList.remove('open');
            toggle.style.display = 'none';
          });
        } else {
          chrome.storage.sync.set({ showSidebar: true }, () => {
            root.style.setProperty('display', '', 'important');
            panel.classList.remove('open');
            toggle.style.display = '';
            
            toggle.style.transition = 'transform 0.15s ease, background 0.15s ease';
            toggle.style.transform = 'scale(1.35)';
            setTimeout(() => {
              toggle.style.transform = 'scale(1)';
            }, 300);
          });
        }
      });
    }

    // Draggable toggle button with edge snapping
    let toggleDragging = false;
    let toggleStartX, toggleStartY;
    let toggleStartLeft, toggleStartTop;
    let toggleMoved = false;

    toggle.addEventListener('mousedown', (e) => {
      if (e.target.closest('#lc-toggle-close')) return;
      toggleDragging = true;
      toggleStartX = e.clientX;
      toggleStartY = e.clientY;
      toggleMoved = false;

      const rect = toggle.getBoundingClientRect();
      toggleStartLeft = rect.left;
      toggleStartTop = rect.top;

      toggle.style.right = 'auto';
      toggle.style.left = toggleStartLeft + 'px';
      toggle.style.top = toggleStartTop + 'px';
      toggle.style.transform = 'none';
      toggle.style.transition = 'none';

      document.addEventListener('mousemove', onToggleMouseMove);
      document.addEventListener('mouseup', onToggleMouseUp);
      e.preventDefault();
    });

    function onToggleMouseMove(e) {
      if (!toggleDragging) return;
      const dx = e.clientX - toggleStartX;
      const dy = e.clientY - toggleStartY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        toggleMoved = true;
      }

      let newLeft = toggleStartLeft + dx;
      let newTop = toggleStartTop + dy;

      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 36));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - 80));

      toggle.style.left = newLeft + 'px';
      toggle.style.top = newTop + 'px';
    }

    function onToggleMouseUp() {
      if (!toggleDragging) return;
      toggleDragging = false;
      document.removeEventListener('mousemove', onToggleMouseMove);
      document.removeEventListener('mouseup', onToggleMouseUp);

      if (!toggleMoved) {
        openPanel();
      } else {
        toggle.style.transition = 'left 0.2s ease, right 0.2s ease, border-radius 0.2s ease';
        const midPoint = window.innerWidth / 2;
        const rect = toggle.getBoundingClientRect();
        if (rect.left < midPoint) {
          toggle.style.left = '0px';
          toggle.style.right = 'auto';
          toggle.style.borderRadius = '0 10px 10px 0';
        } else {
          toggle.style.left = 'auto';
          toggle.style.right = '0px';
          toggle.style.borderRadius = '10px 0 0 10px';
        }
      }
    }

    // Draggable Panel
    let panelDragging = false;
    let panelStartX, panelStartY;
    let panelStartLeft, panelStartTop;

    const panelHeader = document.getElementById('lc-panel-header');
    panelHeader.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      panelDragging = true;
      panelStartX = e.clientX;
      panelStartY = e.clientY;

      const rect = panel.getBoundingClientRect();
      panelStartLeft = rect.left;
      panelStartTop = rect.top;

      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = panelStartLeft + 'px';
      panel.style.top = panelStartTop + 'px';
      panel.style.transition = 'none';

      document.addEventListener('mousemove', onPanelMouseMove);
      document.addEventListener('mouseup', onPanelMouseUp);
      e.preventDefault();
    });

    function onPanelMouseMove(e) {
      if (!panelDragging) return;
      const dx = e.clientX - panelStartX;
      const dy = e.clientY - panelStartY;

      let newLeft = panelStartLeft + dx;
      let newTop = panelStartTop + dy;

      newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - 390));
      newTop = Math.max(10, Math.min(newTop, window.innerHeight - 100));

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    }

    function onPanelMouseUp() {
      if (!panelDragging) return;
      panelDragging = false;
      document.removeEventListener('mousemove', onPanelMouseMove);
      document.removeEventListener('mouseup', onPanelMouseUp);
      panel.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    close.addEventListener('click', closePanel);

    // Hide sidebar completely when toggle close button clicked
    toggleClose.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const root = document.getElementById('lc-companion-root');
      if (root) {
        root.style.transition = 'opacity 0.2s ease';
        root.style.opacity = '0';
        setTimeout(() => {
          root.style.setProperty('display', 'none', 'important');
          root.style.opacity = '';
          root.style.transition = '';
        }, 200);
      }
      try {
        chrome.storage.sync.set({ showSidebar: false });
      } catch (err) {
        console.warn('[LC-Companion] Error setting showSidebar:', err);
      }
    });

    // Check saved visibility state on tab load
    chrome.storage.sync.get(['showSidebar'], (data) => {
      const show = data.showSidebar !== false;
      const root = document.getElementById('lc-companion-root');
      if (root) root.style.display = show ? '' : 'none';
    });

    // Listen for storage changes to instantly update visibility
    chrome.storage.onChanged.addListener((changes, area) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
      if (area === 'sync' && changes.showSidebar) {
        const root = document.getElementById('lc-companion-root');
        if (root) root.style.display = changes.showSidebar.newValue ? '' : 'none';
      }
    });

    // Copy to clipboard delegation
    content.addEventListener('click', (e) => {
      if (e.target.classList.contains('lc-copy-btn')) {
        const idx = parseInt(e.target.getAttribute('data-code-idx'), 10);
        const block = currentCodeBlocks[idx];
        if (block) {
          navigator.clipboard.writeText(block.code).then(() => {
            const oldText = e.target.textContent;
            e.target.textContent = 'Copied!';
            e.target.style.color = '#00d26a';
            setTimeout(() => {
              e.target.textContent = oldText;
              e.target.style.color = '#6c63ff';
            }, 2000);
          }).catch(err => {
            console.error('Failed to copy code: ', err);
          });
        }
      }

      if (e.target.classList.contains('lc-insert-btn')) {
        const idx = parseInt(e.target.getAttribute('data-code-idx'), 10);
        const block = currentCodeBlocks[idx];
        if (block) {
          injectCodeToLeetCodeEditor(block.code);
          const oldText = e.target.textContent;
          e.target.textContent = 'Inserted!';
          e.target.style.color = '#00d26a';
          setTimeout(() => {
            e.target.textContent = oldText;
            e.target.style.color = '#fbbf24';
          }, 2000);
        }
      }
    });

    function injectCodeToLeetCodeEditor(code) {
      // Create a temporary communication div
      const commDiv = document.createElement('div');
      commDiv.id = 'lc-companion-comm-div';
      commDiv.style.display = 'none';
      commDiv.dataset.code = code;
      document.body.appendChild(commDiv);

      // Inject the script file
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/content/editor-injector.js');
      (document.head || document.documentElement).appendChild(script);
    }

    function isUserLoggedIn() {
      const avatar = document.querySelector('#navbar_user_avatar') || 
                     document.querySelector('[class*="avatar"]') || 
                     document.querySelector('[class*="profile"] img') ||
                     document.querySelector('.avatar-input-wrapper') ||
                     document.querySelector('[class*="UserMenu"]') ||
                     document.querySelector('[class*="user-menu"]');
      const signInLink = document.querySelector('a[href*="/accounts/login"]') || 
                         document.querySelector('a[href*="/login"]');
      if (signInLink && !avatar) {
        return false;
      }
      return true;
    }

    function updateThemeClass() {
      const root = document.getElementById('lc-companion-root');
      if (!root) return;
      
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark') ||
                     document.documentElement.getAttribute('data-theme') === 'dark' ||
                     localStorage.getItem('theme') === 'dark';
      
      if (isDark) {
        root.classList.remove('theme-light');
      } else {
        root.classList.add('theme-light');
      }
    }

    function observeTheme() {
      updateThemeClass();
      const observer = new MutationObserver(() => {
        updateThemeClass();
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    function setContent(html) { content.innerHTML = html; }
    function loading(msg = 'Working…') {
      setContent(`<div style="text-align:center;padding:36px 16px;color:#9094b4;">
        <div class="lc-spinner"></div>
        <p style="font-size:12.5px;">${msg}</p>
      </div>`);
    }

    // Premium Markdown Parser
    function renderMarkdown(text) {
      if (!text) return '<p style="color:var(--text-muted);">No explanation returned from AI.</p>';
      
      // 1. Separate code blocks to avoid line-by-line parsing interference
      let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${currentCodeBlocks.length}__`;
        currentCodeBlocks.push({ lang: lang || 'code', code: code.trim() });
        return placeholder;
      });

      // 2. Parse Markdown elements line-by-line
      const lines = html.split('\n');
      let insideList = false;
      let listType = null;
      let outputLines = [];

      for (let line of lines) {
        let trimmed = line.trim();
        if (!trimmed) {
          if (insideList) {
            outputLines.push(`</${listType}>`);
            insideList = false;
          }
          continue;
        }

        // Headers
        if (trimmed.startsWith('#')) {
          if (insideList) {
            outputLines.push(`</${listType}>`);
            insideList = false;
          }
          const level = Math.min(trimmed.match(/^#+/)[0].length, 6);
          const headerText = trimmed.replace(/^#+\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1');
          outputLines.push(`<h${level}>${headerText}</h${level}>`);
          continue;
        }

        // Bullet lists
        const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
        if (bulletMatch) {
          if (!insideList || listType !== 'ul') {
            if (insideList) outputLines.push(`</${listType}>`);
            outputLines.push('<ul>');
            insideList = true;
            listType = 'ul';
          }
          let itemText = bulletMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                      .replace(/`(.+?)`/g, '<code class="lc-inline-code">$1</code>');
          outputLines.push(`<li>${itemText}</li>`);
          continue;
        }

        // Numbered lists
        const numberMatch = trimmed.match(/^\d+\.\s+(.*)/);
        if (numberMatch) {
          if (!insideList || listType !== 'ol') {
            if (insideList) outputLines.push(`</${listType}>`);
            outputLines.push('<ol>');
            insideList = true;
            listType = 'ol';
          }
          let itemText = numberMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                      .replace(/`(.+?)`/g, '<code class="lc-inline-code">$1</code>');
          outputLines.push(`<li>${itemText}</li>`);
          continue;
        }

        // Paragraph
        if (insideList) {
          outputLines.push(`</${listType}>`);
          insideList = false;
        }

        let parsedLine = trimmed
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/`(.+?)`/g, '<code class="lc-inline-code">$1</code>');
        outputLines.push(`<p>${parsedLine}</p>`);
      }

      if (insideList) {
        outputLines.push(`</${listType}>`);
      }

      let parsedHtml = outputLines.join('\n');

      // 3. Re-inject formatted code blocks
      currentCodeBlocks.forEach((block, idx) => {
        const escapedCode = block.code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        const codeWrapper = `
          <div class="lc-code-block-container" style="
            position: relative; margin: 14px 0; background: #1e2230;
            border: 1px solid #2d3154; border-radius: 8px; overflow: hidden;
            font-family: monospace;
          ">
            <div class="lc-code-header" style="
              display: flex; justify-content: space-between; align-items: center;
              padding: 6px 12px; background: #151824; border-bottom: 1px solid #2d3154;
              font-size: 11px; color: #9094b4; text-transform: uppercase;
            ">
              <span>${block.lang || 'code'}</span>
              <div style="display: flex; gap: 10px;">
                <button class="lc-insert-btn" data-code-idx="${idx}" style="
                  background: none; border: none; color: #fbbf24; cursor: pointer;
                  font-weight: 600; font-size: 11px; transition: color 0.2s;
                ">⚡ Insert</button>
                <button class="lc-copy-btn" data-code-idx="${idx}" style="
                  background: none; border: none; color: #6c63ff; cursor: pointer;
                  font-weight: 600; font-size: 11px; transition: color 0.2s;
                ">Copy</button>
              </div>
            </div>
            <pre style="
              margin: 0; padding: 12px; overflow-x: auto;
              font-size: 12px; line-height: 1.5; color: #e8eaf6;
              background: #1e2230;
            "><code class="language-${block.lang}">${escapedCode}</code></pre>
          </div>
        `;
        parsedHtml = parsedHtml.replace(`__CODE_BLOCK_PLACEHOLDER_${idx}__`, codeWrapper);
      });

      return parsedHtml;
    }

    // ── Context Check ────────────────────────────────────────────────────────
    function checkContext() {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        setContent('<div class="lc-alert lc-alert-err">⚠️ Extension context was invalidated (extension reloaded/updated). Please refresh this page to continue.</div>');
        return false;
      }
      return true;
    }

    // ── Explain ──────────────────────────────────────────────────────────
    async function doExplain() {
      if (!checkContext()) return;
      openPanel();
      const title = getProblemTitle();
      sub.textContent = title.length > 28 ? title.slice(0, 28) + '…' : title;
      loading('Getting AI hints & code…');
      currentCodeBlocks = [];
      chatHistory = [];
      chatBar.classList.remove('active');

      const payload = {
        title,
        slug:        getProblemSlug(),
        description: getDescription(),
        code:        await getCode(),
      };

      try {
        chrome.runtime.sendMessage({ type: 'GET_EXPLANATION', payload }, res => {
          if (chrome.runtime.lastError) {
            setContent(`<div class="lc-alert lc-alert-err">❌ ${chrome.runtime.lastError.message}</div>`);
            return;
          }
          if (!res?.success) {
            setContent(`<div class="lc-alert lc-alert-err">❌ ${res?.error || 'Unknown error'}</div>`);
            return;
          }
          chatHistory.push({ role: 'assistant', content: res.explanation });
          setContent(renderMarkdown(res.explanation));
          chatBar.classList.add('active');
        });
      } catch (err) {
        setContent(`<div class="lc-alert lc-alert-err">❌ Extension was reloaded. Please refresh the page.</div>`);
      }
    }

    // ── Help Me Solve ────────────────────────────────────────────────────
    async function doHelpMeSolve() {
      if (!checkContext()) return;
      openPanel();
      const title = getProblemTitle();
      sub.textContent = title.length > 28 ? title.slice(0, 28) + '…' : title;
      loading('Teaching you step-by-step…');
      currentCodeBlocks = [];
      chatHistory = [];
      chatBar.classList.remove('active');

      const payload = {
        title,
        slug:           getProblemSlug(),
        description:    getDescription(),
        language:       getLanguage(),
        editorTemplate: await getCode(),
      };

      try {
        chrome.runtime.sendMessage({ type: 'GET_SOLUTION_HELP', payload }, res => {
          if (chrome.runtime.lastError) {
            setContent(`<div class="lc-alert lc-alert-err">❌ ${chrome.runtime.lastError.message}</div>`);
            return;
          }
          if (!res?.success) {
            setContent(`<div class="lc-alert lc-alert-err">❌ ${res?.error || 'Unknown error'}</div>`);
            return;
          }
          chatHistory.push({ role: 'assistant', content: res.explanation });
          setContent(renderMarkdown(res.explanation));
          chatBar.classList.add('active');
        });
      } catch (err) {
        setContent(`<div class="lc-alert lc-alert-err">❌ Extension was reloaded. Please refresh the page.</div>`);
      }
    }

    // ── Auto-Solve & Self-Healing Loop ───────────────────────────────────
    let autoSolveAttempt = 0;
    const MAX_AUTOSOLVE_ATTEMPTS = 3;
    let lastErrorDetails = '';
    let pollInterval = null;
    let pollTimer = null;

    async function doAutoSolveLoop() {
      if (!checkContext()) return;
      openPanel();
      
      if (!isUserLoggedIn()) {
        setContent(`
          <div class="lc-alert lc-alert-err" style="padding: 16px; border-radius: 12px; background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25);">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #f87171;">❌ Session Expired</div>
            <div style="font-size: 12px; line-height: 1.5; color: #fca5a5;">
              You are currently signed out of LeetCode. Please sign in to LeetCode to protect your streak and auto-sync solutions!
            </div>
            <a href="/accounts/login/" class="lc-btn lc-btn-primary" style="display: flex; margin-top: 14px; text-decoration: none; font-size: 12px; height: 36px; align-items: center; justify-content: center;">
              Sign In to LeetCode
            </a>
          </div>
        `);
        chatBar.classList.remove('active');
        return;
      }

      autoSolveAttempt = 0;
      lastErrorDetails = '';
      runAutoSolveIteration();
    }

    async function runAutoSolveIteration() {
      autoSolveAttempt++;
      if (autoSolveAttempt > MAX_AUTOSOLVE_ATTEMPTS) {
        setContent(`<div class="lc-alert lc-alert-err">❌ Auto-Solve failed after ${MAX_AUTOSOLVE_ATTEMPTS} attempts. Please review the errors in the console.</div>`);
        chatBar.classList.add('active');
        return;
      }

      loading(`Auto-Solve Attempt ${autoSolveAttempt}/${MAX_AUTOSOLVE_ATTEMPTS}: Getting code...`);

      let code = '';
      if (autoSolveAttempt === 1) {
        currentCodeBlocks = [];
        chatHistory = [];
        chatBar.classList.remove('active');

        const payload = {
          title:          getProblemTitle(),
          slug:           getProblemSlug(),
          description:    getDescription(),
          language:       getLanguage(),
          editorTemplate: await getCode(),
        };

        try {
          chrome.runtime.sendMessage({ type: 'GET_SOLUTION_HELP', payload }, async res => {
            if (chrome.runtime.lastError || !res?.success) {
              setContent(`<div class="lc-alert lc-alert-err">❌ Error: ${chrome.runtime.lastError?.message || res?.error || 'Failed to get solution'}</div>`);
              return;
            }

            chatHistory.push({ role: 'assistant', content: res.explanation });
            setContent(renderMarkdown(res.explanation));
            
            code = extractCodeFromExplanation(res.explanation);
            if (!code) {
              setContent(`<div class="lc-alert lc-alert-err">❌ Failed to extract clean code from AI response.</div>`);
              return;
            }

            await executeSubmissionFlow(code);
          });
        } catch (err) {
          setContent(`<div class="lc-alert lc-alert-err">❌ Extension was reloaded. Please refresh the page.</div>`);
        }
      } else {
        const lastErrorText = getLastErrorContext();
        const followUpMessage = `The code I ran failed with a compilation or runtime error. Please correct the code and provide the fixed version.\n\nError details:\n${lastErrorText}`;
        
        chatHistory.push({ role: 'user', content: followUpMessage });

        const payload = {
          title:       getProblemTitle(),
          slug:        getProblemSlug(),
          description: getDescription(),
          code:        await getCode(),
          chatHistory
        };

        try {
          chrome.runtime.sendMessage({ type: 'CHAT_FOLLOWUP', payload }, async res => {
            if (chrome.runtime.lastError || !res?.success) {
              setContent(`<div class="lc-alert lc-alert-err">❌ Error: ${chrome.runtime.lastError?.message || res?.error || 'Failed to get correction'}</div>`);
              return;
            }

            chatHistory.push({ role: 'assistant', content: res.reply });
            setContent(renderMarkdown(res.reply));

            code = extractCodeFromExplanation(res.reply);
            if (!code) {
              setContent(`<div class="lc-alert lc-alert-err">❌ Failed to extract clean code from AI correction.</div>`);
              return;
            }

            await executeSubmissionFlow(code);
          });
        } catch (err) {
          setContent(`<div class="lc-alert lc-alert-err">❌ Extension was reloaded. Please refresh the page.</div>`);
        }
      }
    }

    async function executeSubmissionFlow(code) {
      loading(`Auto-Solve Attempt ${autoSolveAttempt}/${MAX_AUTOSOLVE_ATTEMPTS}: Injecting code into editor...`);
      injectCodeToLeetCodeEditor(code);

      // Wait 1.5 seconds for Monaco to update its values
      await new Promise(resolve => setTimeout(resolve, 1500));

      loading(`Auto-Solve Attempt ${autoSolveAttempt}/${MAX_AUTOSOLVE_ATTEMPTS}: Submitting code to LeetCode...`);
      
      const submitBtn = document.querySelector('[data-cy="submit-code-btn"]') || 
                        document.querySelector('button[class*="submit"]') ||
                        [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Submit');
      
      if (!submitBtn) {
        setContent(`<div class="lc-alert lc-alert-err">❌ LeetCode "Submit" button not found on page. Make sure you are signed in.</div>`);
        chatBar.classList.add('active');
        return;
      }

      submitBtn.click();

      // Wait 3 seconds for LeetCode to clear previous state and start judging
      await new Promise(resolve => setTimeout(resolve, 3000));

      pollSubmissionResult();
    }

    function pollSubmissionResult() {
      loading(`Auto-Solve Attempt ${autoSolveAttempt}/${MAX_AUTOSOLVE_ATTEMPTS}: Judging submission...`);
      
      clearTimeout(pollTimer);
      pollTimer = setTimeout(() => {
        clearInterval(pollInterval);
        setContent(`<div class="lc-alert lc-alert-err">⚠️ Submission timeout. Please check your submission tab on LeetCode.</div>`);
        chatBar.classList.add('active');
      }, 45000);

      clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        const result = getSubmissionStatus();
        if (result) {
          clearInterval(pollInterval);
          clearTimeout(pollTimer);
          handleSubmissionOutcome(result);
        }
      }, 1500);
    }

    function handleSubmissionOutcome(outcome) {
      if (outcome.status === 'ACCEPTED') {
        setContent(`
          <div class="lc-alert lc-alert-ok">
            🎉 Auto-Solve Successful! Accepted on LeetCode!
          </div>
          <p style="font-size:12.5px;color:#c8cae6;margin-top:12px;text-align:center;">
            Your daily streak is safe! Solution synced to storage.
          </p>
        `);
        sub.textContent = 'Solved ✓';
        chatBar.classList.add('active');

        chrome.storage.sync.get(['autoSync'], (data) => {
          if (data.autoSync) {
            doSync();
          }
        });

        try {
          chrome.runtime.sendMessage({ type: 'AUTO_SOLVE_SUCCESS', payload: { title: getProblemTitle() } });
        } catch (e) {}
      } else {
        lastErrorDetails = outcome.details || 'Unknown submission error.';
        runAutoSolveIteration();
      }
    }

    function getLastErrorContext() {
      return lastErrorDetails;
    }

    function extractCodeFromExplanation(text) {
      if (!text) return '';
      // Look for code block under 'Complete Solution' or 'LeetCode-Ready'
      const sectionMatch = text.match(/## (?:Complete Solution|LeetCode-Ready)[\s\S]*?(```(?:\w*)\n([\s\S]*?)```)/i);
      if (sectionMatch) {
        return sectionMatch[2].trim();
      }
      // Fallback: match the last code block (Complete Solution is always near the end)
      const matches = [...text.matchAll(/```(?:\w*)\n([\s\S]*?)```/g)];
      if (matches.length > 0) {
        return matches[matches.length - 1][1].trim();
      }
      return '';
    }

    function getSubmissionStatus() {
      const textElements = document.querySelectorAll('span, div, p, a');
      for (const el of textElements) {
        const txt = el.textContent.trim();
        if (txt === 'Accepted') return { status: 'ACCEPTED' };
        if (txt === 'Wrong Answer') {
          return { status: 'WRONG_ANSWER', details: scrapeWrongAnswerDetails() };
        }
        if (txt === 'Runtime Error') {
          return { status: 'RUNTIME_ERROR', details: scrapeErrorDetails() };
        }
        if (txt === 'Compile Error') {
          return { status: 'COMPILE_ERROR', details: scrapeErrorDetails() };
        }
        if (txt === 'Time Limit Exceeded') {
          return { status: 'TIME_LIMIT_EXCEEDED', details: 'Time Limit Exceeded (code was too slow).' };
        }
      }
      return null;
    }

    function scrapeWrongAnswerDetails() {
      let details = '';
      try {
        const labels = document.querySelectorAll('div, span, p');
        let inputVal = '', outputVal = '', expectedVal = '';
        for (let i = 0; i < labels.length; i++) {
          const text = labels[i].textContent.trim();
          if (text === 'Input' || text === 'TestCase') {
            inputVal = labels[i].nextElementSibling?.textContent.trim() || '';
          } else if (text === 'Output' || text === 'Your Input' || text === 'Result') {
            outputVal = labels[i].nextElementSibling?.textContent.trim() || '';
          } else if (text === 'Expected') {
            expectedVal = labels[i].nextElementSibling?.textContent.trim() || '';
          }
        }
        details = `Failed Testcase:\nInput: ${inputVal}\nYour Output: ${outputVal}\nExpected: ${expectedVal}`;
      } catch (err) {
        console.warn('Failed to scrape wrong answer details:', err);
      }
      return details || 'Wrong Answer (failed on a testcase).';
    }

    function scrapeErrorDetails() {
      try {
        const errEl = document.querySelector('div[class*="error"], pre[class*="error"], div[class*="compiler-message"]');
        if (errEl) return errEl.textContent.trim();
      } catch (e) {}
      return 'Syntax or Runtime Error during execution.';
    }

    // ── Sync ─────────────────────────────────────────────────────────────
    async function doSync() {
      if (!checkContext()) return;
      openPanel();
      loading('Pushing to GitHub…');

      const code = await getCode();
      if (!code.trim()) {
        setContent('<div class="lc-alert lc-alert-err">⚠️ No code found in the editor. Make sure your solution is open.</div>');
        return;
      }

      const payload = {
        title:      getProblemTitle(),
        difficulty: getDifficulty(),
        language:   getLanguage(),
        code,
        slug:       getProblemSlug(),
      };

      try {
        chrome.runtime.sendMessage({ type: 'SYNC_SOLUTION', payload }, res => {
          if (chrome.runtime.lastError) {
            setContent(`<div class="lc-alert lc-alert-err">❌ ${chrome.runtime.lastError.message}</div>`);
            return;
          }
          if (!res?.success) {
            setContent(`<div class="lc-alert lc-alert-err">❌ ${res?.error || 'Sync failed'}</div>`);
            return;
          }
          if (res.alreadySynced) {
            setContent(`
              <div class="lc-alert lc-alert-info" style="display:flex;gap:10px;align-items:flex-start;">
                <span style="font-size:20px;flex-shrink:0;">📌</span>
                <div>
                  <div style="font-weight:700;color:#a5a0ff;margin-bottom:4px;">Already in GitHub</div>
                  <div style="font-size:12px;opacity:.8;"><strong>${escapeHtml(payload.title)}</strong> was already pushed previously. No duplicate commit created.</div>
                </div>
              </div>
            `);
            sub.textContent = 'Already synced';
            return;
          }
          setContent(`
            <div class="lc-alert lc-alert-ok">
              ✅ Pushed to GitHub!
            </div>
            <div class="lc-alert lc-alert-info" style="margin-top:8px;">
              <strong>${escapeHtml(payload.title)}</strong><br/>
              <span style="font-size:11px;opacity:.8;">${escapeHtml(payload.difficulty)} · ${escapeHtml(payload.language)}</span>
            </div>
          `);
          sub.textContent = 'Synced ✓';
        });
      } catch (err) {
        setContent(`<div class="lc-alert lc-alert-err">❌ Extension was reloaded. Please refresh the page.</div>`);
      }
    }

    // ── Chat Messaging ──────────────────────────────────────────────────
    async function sendChatMessage() {
      if (!checkContext()) return;
      const val = chatInput.value.trim();
      if (!val) return;

      // 1. Add User Message to history & display
      chatHistory.push({ role: 'user', content: val });
      
      const welcomePara = content.querySelector('p[style*="text-align:center"]');
      if (welcomePara) {
        content.innerHTML = '';
      }

      const userMsgHtml = `
        <div class="lc-chat-label user-label">Student</div>
        <div class="lc-chat-msg user">${escapeHtml(val)}</div>
      `;
      content.insertAdjacentHTML('beforeend', userMsgHtml);
      content.scrollTop = content.scrollHeight;

      // Clear input
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatInput.disabled = true;
      chatSend.disabled = true;

      // 2. Add Typing Indicator
      const typingId = 'lc-chat-typing';
      const typingHtml = `
        <div id="${typingId}" class="lc-typing">
          <span class="lc-typing-dot"></span>
          <span class="lc-typing-dot"></span>
          <span class="lc-typing-dot"></span>
        </div>
      `;
      content.insertAdjacentHTML('beforeend', typingHtml);
      content.scrollTop = content.scrollHeight;

      // 3. Send message to service worker
      const payload = {
        title:       getProblemTitle(),
        slug:        getProblemSlug(),
        description: getDescription(),
        code:        await getCode(),
        chatHistory
      };

      try {
        chrome.runtime.sendMessage({ type: 'CHAT_FOLLOWUP', payload }, res => {
          // Remove typing indicator
          const typingEl = document.getElementById(typingId);
          if (typingEl) typingEl.remove();

          chatInput.disabled = false;
          chatSend.disabled = false;
          chatInput.focus();

          if (chrome.runtime.lastError) {
            const errHtml = `
              <div class="lc-alert lc-alert-err">
                ❌ Error: ${chrome.runtime.lastError.message}
              </div>
            `;
            content.insertAdjacentHTML('beforeend', errHtml);
            content.scrollTop = content.scrollHeight;
            return;
          }

          if (!res?.success) {
            const errHtml = `
              <div class="lc-alert lc-alert-err">
                ❌ Error: ${res?.error || 'Failed to get response'}
              </div>
            `;
            content.insertAdjacentHTML('beforeend', errHtml);
            content.scrollTop = content.scrollHeight;
            return;
          }

          // Append assistant response to history
          chatHistory.push({ role: 'assistant', content: res.reply });

          // Render assistant response
          const replyHtml = `
            <div class="lc-chat-label">Assistant</div>
            <div class="lc-chat-msg ai">${renderMarkdown(res.reply)}</div>
          `;
          content.insertAdjacentHTML('beforeend', replyHtml);
          content.scrollTop = content.scrollHeight;
        });
      } catch (err) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        chatInput.disabled = false;
        chatSend.disabled = false;
        content.insertAdjacentHTML('beforeend', `<div class="lc-alert lc-alert-err">❌ Extension was reloaded. Please refresh the page.</div>`);
      }
    }

    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
    });

    chatSend.addEventListener('click', sendChatMessage);

    // Sidebar tab bindings
    if (tabDashboard) tabDashboard.addEventListener('click', () => switchTab('dashboard'));
    if (tabAi) tabAi.addEventListener('click', () => switchTab('ai'));

    // Dashboard quick actions
    const dbBtnHelp = document.getElementById('lc-db-btn-help');
    if (dbBtnHelp) {
      dbBtnHelp.addEventListener('click', () => {
        switchTab('ai');
        doHelpMeSolve();
      });
    }

    const dbBtnSync = document.getElementById('lc-db-btn-sync');
    if (dbBtnSync) {
      dbBtnSync.addEventListener('click', doSync);
    }

    // Streak protection schedule hooks
    const dbToggleStreak = document.getElementById('lc-db-toggle-streak');
    if (dbToggleStreak) {
      dbToggleStreak.addEventListener('change', () => {
        const card = document.getElementById('lc-db-streak-card');
        if (card) {
          if (dbToggleStreak.checked) card.classList.add('enabled');
          else card.classList.remove('enabled');
        }
        saveDbSchedule();
      });
    }

    const dbSaveTime = document.getElementById('lc-db-save-time');
    if (dbSaveTime) {
      dbSaveTime.addEventListener('click', saveDbSchedule);
    }

    const dbTestNow = document.getElementById('lc-db-test-now');
    if (dbTestNow) {
      dbTestNow.addEventListener('click', runDbTest);
    }

    document.getElementById('lc-btn-help').addEventListener('click', doHelpMeSolve);
    document.getElementById('lc-btn-autosolve').addEventListener('click', doAutoSolveLoop);
    document.getElementById('lc-btn-sync').addEventListener('click', doSync);

    // Listen for messages from popup/extension actions
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'HELP_ME_SOLVE')    { switchTab('ai'); doHelpMeSolve(); sendResponse({ success: true }); }
      if (msg.type === 'AUTO_SOLVE')        { switchTab('ai'); doAutoSolveLoop(); sendResponse({ success: true }); }
      if (msg.type === 'SYNC_TO_GITHUB')   { doSync(); sendResponse({ success: true }); }
      if (msg.type === 'OPEN_SIDEBAR')     { openPanel(); switchTab('dashboard'); sendResponse({ success: true }); }
      if (msg.type === 'CLOSE_SIDEBAR')    { closePanel(); sendResponse({ success: true }); }
    });

    // Check for auto-solve flag in local storage (resilient to SPA router stripping hash)
    chrome.storage.local.get(['autoSolveSlug'], (data) => {
      const currentSlug = getProblemSlug();
      if (data.autoSolveSlug && data.autoSolveSlug === currentSlug) {
        chrome.storage.local.remove(['autoSolveSlug']);
        setTimeout(() => {
          doAutoSolveLoop();
        }, 3000);
      }
    });

    // Real-time synchronization when settings or stats change elsewhere
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        if (changes.streakProtect || changes.streakProtectHour || changes.streakProtectMinute || changes.streakProtectAmPm) {
          loadDbStreakSettings();
        }
      }
      if (area === 'local') {
        if (changes.stats || changes.streak) {
          loadDbStats();
        }
      }
    });

    observeTheme();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  injectStyles();
  createSidebar();
  setupListeners();

  console.log('[LC-Companion] injector.js loaded');
})();
