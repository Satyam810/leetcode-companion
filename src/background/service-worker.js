// service-worker.js – LeetCode Companion background service worker

import { StorageService } from '../lib/storage.js';
import { GitHubAPI }      from '../lib/github-api.js';
import { GrokAPI }        from '../lib/groq-api.js';

// ── Install / Activate ────────────────────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// ── Message Handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'ACCEPTED_SUBMISSION':
      // Fired by detector.js when LeetCode shows "Accepted"
      handleAcceptedSubmission(message.payload, sendResponse);
      return true;

    case 'SYNC_SOLUTION':
      // Fired manually from popup / injector sidebar
      handleSyncSolution(message.payload, sendResponse);
      return true;

    case 'GET_EXPLANATION':
      handleGetExplanation(message.payload, sendResponse);
      return true;


    case 'GET_SOLUTION_HELP':
      handleGetSolutionHelp(message.payload, sendResponse);
      return true;

    case 'CHAT_FOLLOWUP':
      handleChatFollowUp(message.payload, sendResponse);
      return true;

    case 'AUTO_SOLVE_SUCCESS':
      handleAutoSolveSuccess(message.payload, sendResponse);
      return true;

    case 'SYNC_LEETCODE_STATS':
      handleSyncLeetCodeStats(sendResponse);
      return true;

    case 'FORCE_CHECK_STREAK_PROTECTION':
      checkStreakProtection().then(() => sendResponse({ success: true }));
      return true;

    case 'FORCE_RUN_AUTO_SOLVE':
      runAutoSolveImmediately().then(() => sendResponse({ success: true }));
      return true;

    default:
      return false;
  }
});

// ── Alarm Handler ─────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'streak-protection-alarm') {
    checkStreakProtection();
    // Keep Telegram updates polling active
    startTelegramLongPoll();
  }
});

// Ensure alarm exists and runs every 1 minute
chrome.alarms.get('streak-protection-alarm', alarm => {
  if (!alarm || alarm.periodInMinutes !== 1) {
    chrome.alarms.create('streak-protection-alarm', { periodInMinutes: 1 });
    console.log('[LC-Companion SW] Created/Updated streak-protection-alarm (1 min check)');
  }
});

// ── ACCEPTED_SUBMISSION ────────────────────────────────────────────────────────
function htmlToMarkdown(html) {
  if (!html) return '';
  let text = html;
  
  // Replace basic layout tags
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p>/gi, '').replace(/<\/p>/gi, '\n\n');
  
  // Inline styles / codes
  text = text.replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**');
  text = text.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**');
  text = text.replace(/<em>/gi, '*').replace(/<\/em>/gi, '*');
  text = text.replace(/<i>/gi, '*').replace(/<\/i>/gi, '*');
  text = text.replace(/<code>/gi, '`').replace(/<\/code>/gi, '`');
  
  // Lists
  text = text.replace(/<ul>/gi, '\n').replace(/<\/ul>/gi, '\n');
  text = text.replace(/<ol>/gi, '\n').replace(/<\/ol>/gi, '\n');
  text = text.replace(/<li>/gi, '- ').replace(/<\/li>/gi, '\n');
  
  // Headers
  text = text.replace(/<h1>/gi, '# ').replace(/<\/h1>/gi, '\n\n');
  text = text.replace(/<h2>/gi, '## ').replace(/<\/h2>/gi, '\n\n');
  text = text.replace(/<h3>/gi, '### ').replace(/<\/h3>/gi, '\n\n');
  
  // HTML Entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  
  // Strip all other remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Compress consecutive empty lines
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return text.trim();
}

function formatCodeWithDescription(code, description, language) {
  if (!description || !description.trim()) return code;
  const ext = (language || 'txt').toLowerCase();
  const isPythonOrRubyOrBash = ['py', 'rb', 'sh', 'pl'].includes(ext);
  
  // If description contains HTML tags, convert it to clean markdown format
  const parsedDesc = /<[a-z][\s\S]*>/i.test(description) ? htmlToMarkdown(description) : description;
  const cleanedDesc = parsedDesc.replace(/\n\s*\n/g, '\n\n').trim();
  
  if (isPythonOrRubyOrBash) {
    return `"""\n${cleanedDesc}\n"""\n\n${code}`.replace(/\r\n/g, '\n');
  } else {
    return `/*\n${cleanedDesc}\n*/\n\n${code}`.replace(/\r\n/g, '\n');
  }
}

// Checks whether a problem has already been successfully synced to GitHub
async function hasPreviouslySynced(title) {
  const activity = await StorageService.getActivity();
  return activity.some(entry => entry.title === title && entry.synced === true);
}

// Central handler: updates stats + streak + optionally auto-syncs to GitHub
async function handleAcceptedSubmission(payload, sendResponse) {
  try {
    const { title, difficulty, language, code, slug } = payload;
    const diff = (difficulty || 'unknown').toLowerCase();

    // 1. Update solved stats counter (try GraphQL first for exact counts)
    const fetched = await fetchLeetCodeStats();
    if (!fetched) {
      await StorageService.incrementStat(diff);
    }

    // 2. Update daily streak
    await StorageService.updateStreak();

    // 3. Check settings for auto-sync
    const settings = await StorageService.getSettings();

    if (settings.autoSync && settings.githubToken && settings.githubRepo && code?.trim()) {
      // Check for duplicate before pushing
      const alreadySynced = await hasPreviouslySynced(title);
      if (alreadySynced) {
        sendResponse({ success: true, synced: false, alreadySynced: true });
        return;
      }

      // Auto-push to GitHub
      try {
        const github = new GitHubAPI(
          settings.githubToken,
          settings.githubRepo,
          settings.githubBranch || 'main'
        );
        const folder   = settings.githubFolder ? settings.githubFolder.replace(/\/$/, '') + '/' : '';
        const filename = `${folder}${sanitizeFilename(title)}.${language || 'txt'}`;
        const commitMsg = `✅ ${title} (${difficulty})`;

        let description = '';
        if (slug) {
          description = await fetchProblemDescription(slug);
        }
        if (!description || description.trim().length < 100) {
          description = payload.description || '';
        }
        const fileContent = formatCodeWithDescription(code, description, language);

        await github.createOrUpdateFile(filename, fileContent, commitMsg);

        // 4. Record in activity log
        await StorageService.addActivity({
          title,
          difficulty,
          language,
          syncedAt: new Date().toISOString(),
          synced:   true,
        });

        // Send Telegram alert
        const streak = await StorageService.getStreak();
        const commitUrl = `https://github.com/${settings.githubRepo}/blob/${settings.githubBranch || 'main'}/${filename}`;
        await sendTelegramMessage(
          `🎉 *Streak Protected! (Day ${streak.current})*\n\n` +
          `📖 *Problem:* ${title} (${difficulty})\n` +
          `💻 *Language:* ${language}\n` +
          `🐙 *GitHub:* [View Code](${commitUrl})`
        );

        sendResponse({ success: true, synced: true });
      } catch (githubErr) {
        // GitHub failed – still record as solved locally
        await StorageService.addActivity({
          title, difficulty, language,
          syncedAt: new Date().toISOString(),
          synced:   false,
          syncError: githubErr.message,
        });

        sendResponse({ success: true, synced: false, error: githubErr.message });
      }
    } else {
      // No auto-sync – just record locally
      await StorageService.addActivity({
        title, difficulty, language,
        syncedAt: new Date().toISOString(),
        synced:   false,
      });

      sendResponse({ success: true, synced: false });
    }
  } catch (err) {
    console.error('[LC-AI SW] handleAcceptedSubmission error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

// ── SYNC_SOLUTION (manual) ────────────────────────────────────────────────────
async function handleSyncSolution(payload, sendResponse) {
  try {
    const settings = await StorageService.getSettings();
    if (!settings.githubToken || !settings.githubRepo) {
      return sendResponse({ success: false, error: 'GitHub not configured. Open Settings.' });
    }

    // Check for duplicate before pushing
    const alreadySynced = await hasPreviouslySynced(payload.title);
    if (alreadySynced) {
      return sendResponse({ success: true, alreadySynced: true });
    }

    const github = new GitHubAPI(
      settings.githubToken,
      settings.githubRepo,
      settings.githubBranch || 'main'
    );
    const folder    = settings.githubFolder ? settings.githubFolder.replace(/\/$/, '') + '/' : '';
    const filename  = `${folder}${sanitizeFilename(payload.title)}.${payload.language || 'txt'}`;
    const commitMsg = `✅ ${payload.title} (${payload.difficulty})`;

    let description = '';
    if (payload.slug) {
      description = await fetchProblemDescription(payload.slug);
    }
    if (!description || description.trim().length < 100) {
      description = payload.description || '';
    }
    const fileContent = formatCodeWithDescription(payload.code, description, payload.language);

    await github.createOrUpdateFile(filename, fileContent, commitMsg);

    // Update stats & activity
    const diff = (payload.difficulty || 'unknown').toLowerCase();
    await StorageService.incrementStat(diff);
    await StorageService.updateStreak();
    await StorageService.addActivity({
      title:      payload.title,
      difficulty: payload.difficulty,
      language:   payload.language,
      syncedAt:   new Date().toISOString(),
      synced:     true,
    });

    // Send Telegram alert
    const streak = await StorageService.getStreak();
    const commitUrl = `https://github.com/${settings.githubRepo}/blob/${settings.githubBranch || 'main'}/${filename}`;
    await sendTelegramMessage(
      `🎉 *Solution Synced! (Day ${streak.current})*\n\n` +
      `📖 *Problem:* ${payload.title} (${payload.difficulty})\n` +
      `💻 *Language:* ${payload.language}\n` +
      `🐙 *GitHub:* [View Code](${commitUrl})`
    );

    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── GET_EXPLANATION ───────────────────────────────────────────────────────────
async function handleGetExplanation(payload, sendResponse) {
  try {
    const settings = await StorageService.getSettings();
    if (!settings.grokApiKey) {
      return sendResponse({ success: false, error: 'Groq API key not configured. Open Settings.' });
    }

    let description = payload.description || '';
    if (description.length < 50 && payload.slug) {
      console.log('[LC-Companion SW] Description missing, fetching from GraphQL for:', payload.slug);
      const fetched = await fetchProblemDescription(payload.slug);
      if (fetched) {
        description = fetched;
      }
    }

    const grok = new GrokAPI(settings.grokApiKey);
    const explanation = await grok.explainProblem(payload.title, description, payload.code);
    sendResponse({ success: true, explanation });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── GET_SOLUTION_HELP ─────────────────────────────────────────────────────────
async function handleGetSolutionHelp(payload, sendResponse) {
  try {
    const settings = await StorageService.getSettings();
    if (!settings.grokApiKey) {
      return sendResponse({ success: false, error: 'Groq API key not configured. Open Settings.' });
    }

    let description = payload.description || '';
    if (description.length < 50 && payload.slug) {
      console.log('[LC-Companion SW] Description missing for Help Me Solve, fetching from GraphQL for:', payload.slug);
      const fetched = await fetchProblemDescription(payload.slug);
      if (fetched) {
        description = fetched;
      }
    }

    const grok = new GrokAPI(settings.grokApiKey);
    const explanation = await grok.helpMeSolve(payload.title, description, payload.language || '', payload.editorTemplate || '');
    sendResponse({ success: true, explanation });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── CHAT_FOLLOWUP ─────────────────────────────────────────────────────────────
async function handleChatFollowUp(payload, sendResponse) {
  try {
    const settings = await StorageService.getSettings();
    if (!settings.grokApiKey) {
      return sendResponse({ success: false, error: 'Groq API key not configured. Open Settings.' });
    }

    let description = payload.description || '';
    if (description.length < 50 && payload.slug) {
      const fetched = await fetchProblemDescription(payload.slug);
      if (fetched) description = fetched;
    }

    const grok = new GrokAPI(settings.grokApiKey);
    const reply = await grok.chatFollowUp(
      payload.title,
      description,
      payload.code || '',
      payload.chatHistory || []
    );
    sendResponse({ success: true, reply });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── UPDATE_STATS (legacy) ─────────────────────────────────────────────────────
async function handleUpdateStats(payload, sendResponse) {
  try {
    await StorageService.incrementStat((payload.difficulty || 'unknown').toLowerCase());
    await StorageService.updateStreak();
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sanitizeFilename(title) {
  return (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── LeetCode Stats Fetcher ───────────────────────────────────────────────────
async function fetchLeetCodeStats() {
  try {
    const statusRes = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: `query globalCurrentUserData { userStatus { username isSignedIn } }`
      })
    });
    if (!statusRes.ok) {
      await new Promise(resolve => chrome.storage.local.set({ sessionExpired: true }, resolve));
      return null;
    }
    const statusData = await statusRes.json();
    const { username, isSignedIn } = statusData.data?.userStatus || {};
    if (!isSignedIn || !username) {
      await new Promise(resolve => chrome.storage.local.set({ sessionExpired: true }, resolve));
      return null;
    }
    await new Promise(resolve => chrome.storage.local.set({ sessionExpired: false }, resolve));

    const statsRes = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: `query queryProfileCalendar($username: String!) {
          matchedUser(username: $username) {
            userCalendar {
              streak
              submissionCalendar
            }
            submitStats {
              acSubmissionNum {
                difficulty
                count
              }
            }
          }
        }`,
        variables: { username }
      })
    });
    if (!statsRes.ok) return null;
    const statsData = await statsRes.json();
    const acSubmissions = statsData.data?.matchedUser?.submitStats?.acSubmissionNum || [];

    const stats = { easy: 0, medium: 0, hard: 0 };
    for (const item of acSubmissions) {
      const diff = item.difficulty.toLowerCase();
      if (diff === 'easy') stats.easy = item.count;
      else if (diff === 'medium') stats.medium = item.count;
      else if (diff === 'hard') stats.hard = item.count;
    }

    const calendar = statsData.data?.matchedUser?.userCalendar || {};
    const apiMaxStreak = calendar.streak || 0; // The API 'streak' field actually returns the max streak
    
    let currentStreakVal = 0;
    try {
      const submissionCalendar = JSON.parse(calendar.submissionCalendar || '{}');
      const timestamps = Object.keys(submissionCalendar).map(Number);
      
      if (timestamps.length > 0) {
        // LeetCode operates on UTC days for streak resets. 
        // 86400 seconds = 1 day.
        const currentUtcDay = Math.floor(Date.now() / 86400000);
        const activeDays = new Set(timestamps.map(ts => Math.floor(ts / 86400)));
        
        let streak = 0;
        let dayToCheck = currentUtcDay;
        
        // If they haven't submitted today (UTC), their streak is maintained if they submitted yesterday (UTC)
        if (!activeDays.has(dayToCheck)) {
          dayToCheck--;
        }
        
        while (activeDays.has(dayToCheck)) {
          streak++;
          dayToCheck--;
        }
        currentStreakVal = streak;
      }
      console.log('[LC-Companion SW] Calculated current streak:', currentStreakVal, 'API max streak:', apiMaxStreak);
    } catch (e) {
      console.error('[LC-Companion SW] Error calculating streaks:', e);
    }

    const currentStreak = await new Promise(resolve => {
      chrome.storage.local.get(['streak'], data => {
        resolve(data.streak || { current: 0, longest: 0, lastSolvedDate: null });
      });
    });

    const streak = {
      current: currentStreakVal,
      longest: Math.max(apiMaxStreak, currentStreak.longest || 0),
      lastSolvedDate: new Date().toISOString().slice(0, 10)
    };

    await new Promise(resolve => {
      chrome.storage.local.set({ stats, streak }, resolve);
    });

    return stats;
  } catch (err) {
    console.warn('[LC-Companion SW] fetchLeetCodeStats warning (likely offline/network error):', err);
    return null;
  }
}

async function handleSyncLeetCodeStats(sendResponse) {
  try {
    const stats = await fetchLeetCodeStats();
    if (stats) {
      sendResponse({ success: true, stats });
    } else {
      sendResponse({ success: false, error: 'Not signed in to LeetCode' });
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function fetchProblemDescription(slug) {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query questionContent($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            content
          }
        }`,
        variables: { titleSlug: slug }
      })
    });
    if (!res.ok) return '';
    const data = await res.json();
    const htmlContent = data.data?.question?.content || '';
    // Convert HTML to clean markdown to preserve formatting and paragraphs
    return htmlToMarkdown(htmlContent);
  } catch (err) {
    console.warn('[LC-Companion SW] fetchProblemDescription warning (likely offline/network error):', err);
    return '';
  }
}

// ── Auto-Solve Success (Background tab closure & notifier) ────────────────────
async function handleAutoSolveSuccess(payload, sendResponse) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await new Promise(resolve => {
      chrome.storage.local.set({ lastAutoSolvedDate: today }, resolve);
    });

    const localData = await new Promise(resolve => {
      chrome.storage.local.get(['activeAutoSolveTabId', 'isManualTest'], resolve);
    });

    if (localData.isManualTest) {
      console.log('[LC-Companion SW] Manual test trigger auto-solve succeeded. Leaving tab open.');
      chrome.storage.local.remove(['isManualTest', 'activeAutoSolveTabId']);
    } else if (localData.activeAutoSolveTabId) {
      console.log('[LC-Companion SW] Alarm auto-solve succeeded. Closing background tab.');
      chrome.tabs.remove(localData.activeAutoSolveTabId, () => {
        if (chrome.runtime.lastError) {
          console.warn('[LC-Companion SW] Error closing tab:', chrome.runtime.lastError.message);
        }
      });
      // Clear tab ID
      chrome.storage.local.remove(['activeAutoSolveTabId']);
    }

    if (sendResponse) sendResponse({ success: true });
  } catch (err) {
    console.warn('[LC-Companion SW] handleAutoSolveSuccess warning:', err);
    if (sendResponse) sendResponse({ success: false, error: err.message });
  }
}

// ── Streak Protection Trigger ────────────────────────────────────────────────

/**
 * Converts a 12-hour clock value (with AM/PM) to total minutes since midnight.
 * e.g. getTargetTimeInMinutes('10', '30', 'PM') => 22*60 + 30 = 1350
 */
function getTargetTimeInMinutes(hour12, minute, ampm) {
  let hour = parseInt(hour12, 10) || 10;
  const min = parseInt(minute, 10) || 0;
  if (ampm === 'PM' && hour !== 12) hour += 12;
  else if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

async function checkStreakProtection() {
  try {
    const settings = await StorageService.getSettings();
    if (!settings.streakProtect) {
      console.log('[LC-Companion SW] Streak Protection checked: Disabled in settings.');
      return;
    }

    const now = new Date();
    const curTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    const targetTimeInMinutes = getTargetTimeInMinutes(
      settings.streakProtectHour   || '10',
      settings.streakProtectMinute || '0',
      settings.streakProtectAmPm   || 'PM'
    );

    console.log(`[LC-Companion SW] Streak Protection checked. Current Time: ${curTimeInMinutes}m, Target Time: ${targetTimeInMinutes}m.`);

    if (curTimeInMinutes < targetTimeInMinutes) {
      console.log('[LC-Companion SW] Streak Protection: Not trigger time yet.');
      return;
    }

    // Get exact local date (not UTC) to prevent timezone rollover errors
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${date}`;

    const localData = await new Promise(resolve => {
      chrome.storage.local.get(['lastAutoSolvedDate'], resolve);
    });

    console.log(`[LC-Companion SW] Streak Protection: lastAutoSolvedDate: ${localData.lastAutoSolvedDate}, localDate: ${today}`);

    if (localData.lastAutoSolvedDate === today) {
      console.log('[LC-Companion SW] Streak Protection: Daily challenge already auto-solved today.');
      return;
    }

    // Check if daily challenge has already been solved today
    console.log('[LC-Companion SW] Fetching daily challenge user status from LeetCode...');
    const daily = await fetchDailyChallenge();
    if (!daily) {
      console.warn('[LC-Companion SW] Failed to fetch daily challenge from LeetCode. Retrying on next alarm.');
      return;
    }

    console.log(`[LC-Companion SW] Daily Challenge: "${daily.title}", User Status: "${daily.userStatus}"`);

    if (daily.userStatus === 'Finish') {
      console.log('[LC-Companion SW] Streak Protection: User already finished the daily challenge manually. Marking solved.');
      await new Promise(resolve => {
        chrome.storage.local.set({ lastAutoSolvedDate: today }, resolve);
      });
      return;
    }

    // Unsolved daily challenge! Open a daily challenge tab in foreground
    console.log('[LC-Companion SW] Streak protection triggered! Opening daily challenge tab:', daily.titleSlug);
    chrome.storage.local.set({ autoSolveSlug: daily.titleSlug }, () => {
      chrome.tabs.create({
        url: `https://leetcode.com/problems/${daily.titleSlug}/`,
        active: true
      }, tab => {
        chrome.storage.local.set({ activeAutoSolveTabId: tab.id });
      });
    });
  } catch (err) {
    console.warn('[LC-Companion SW] checkStreakProtection warning:', err);
  }
}

// ── Daily Challenge Fetcher ──────────────────────────────────────────────────
async function fetchDailyChallenge() {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: `query questionOfToday {
          activeDailyCodingChallengeQuestion {
            userStatus
            question {
              titleSlug
              title
              difficulty
            }
          }
        }`
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const challenge = data.data?.activeDailyCodingChallengeQuestion;
    if (!challenge) return null;
    return {
      userStatus: challenge.userStatus,
      titleSlug:  challenge.question.titleSlug,
      title:      challenge.question.title,
      difficulty: challenge.question.difficulty
    };
  } catch (err) {
    console.warn('[LC-Companion SW] fetchDailyChallenge warning (likely offline/network error):', err);
    return null;
  }
}

async function runAutoSolveImmediately() {
  try {
    console.log('[LC-Companion SW] Manual test trigger initiated. Fetching daily challenge...');
    const daily = await fetchDailyChallenge();
    if (!daily) {
      console.warn('[LC-Companion SW] Failed to fetch daily challenge for manual test.');
      return false;
    }
    console.log('[LC-Companion SW] Manual test trigger: Opening challenge in new tab:', daily.titleSlug);
    return new Promise(resolve => {
      chrome.storage.local.set({ autoSolveSlug: daily.titleSlug, isManualTest: true }, () => {
        chrome.tabs.create({
          url: `https://leetcode.com/problems/${daily.titleSlug}/`,
          active: true
        }, tab => {
          chrome.storage.local.set({ activeAutoSolveTabId: tab.id }, () => {
            resolve(true);
          });
        });
      });
    });
  } catch (err) {
    console.warn('[LC-Companion SW] runAutoSolveImmediately warning:', err);
    return false;
  }
}

// ── Telegram Integration ──────────────────────────────────────────────────────
let telegramPollingInterval = null;
let lastTelegramUpdateId = 0;

async function sendTelegramMessage(text) {
  try {
    const settings = await StorageService.getSettings();
    if (!settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) {
      return;
    }
    await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.warn('[LC-Companion SW] sendTelegramMessage warning:', err);
  }
}

async function handleTelegramCommand(cmd) {
  const cleanCmd = cmd.trim().toLowerCase();

  if (cleanCmd.startsWith('/start') || cleanCmd.startsWith('/help')) {
    await sendTelegramMessage(
      `🤖 *LeetCode Companion Bot*\n\n` +
      `Here are the commands you can use:\n` +
      `• /status - View current streak and solved stats\n` +
      `• /today - Get today's daily challenge details\n` +
      `• /question - Get today's full problem description\n` +
      `• /solution [lang] - Fetch today's AI-generated solution (e.g. \`/solution java\`, defaults to Python)\n` +
      `• /solve - Remotely solve today's challenge completely in the background!\n` +
      `• /help - Show this list of commands`
    );
    return;
  }

  if (cleanCmd.startsWith('/status')) {
    const stats = await StorageService.getStats();
    const streak = await StorageService.getStreak();
    const statusText = 
      `📊 *LeetCode Companion Stats*\n\n` +
      `🔥 *Active Streak:* ${streak.current} days (Longest: ${streak.longest})\n` +
      `🟢 *Easy Solved:* ${stats.easy}\n` +
      `🟡 *Medium Solved:* ${stats.medium}\n` +
      `🔴 *Hard Solved:* ${stats.hard}\n` +
      `⚪ *Unknown/Other:* ${stats.unknown || 0}`;
    await sendTelegramMessage(statusText);
    return;
  }

  if (cleanCmd.startsWith('/today')) {
    await sendTelegramTodayCommand();
    return;
  }

  if (cleanCmd.startsWith('/question')) {
    await sendTelegramQuestionCommand();
    return;
  }

  if (cleanCmd.startsWith('/solution')) {
    const parts = cmd.split(/\s+/);
    let lang = 'Python';
    if (parts.length > 1) {
      lang = parts.slice(1).join(' ');
    }
    await sendTelegramSolutionCommand(lang);
    return;
  }

  if (cleanCmd.includes('solve')) {
    await solveDailyChallengeInBackground();
    return;
  }

  // Conversational AI chatbot fallback for all other messages!
  try {
    const settings = await StorageService.getSettings();
    if (settings.grokApiKey) {
      await sendTelegramMessage('🤖 *Thinking…*');
      const grok = new GrokAPI(settings.grokApiKey);
      const daily = await fetchDailyChallenge();
      const dailyDesc = daily ? await fetchProblemDescription(daily.titleSlug) : '';

      const systemPrompt = `You are LeetCode Companion Assistant. Help the user with LeetCode questions, solution code, algorithms, and career advice.
Current Daily Challenge: ${daily ? daily.title + ' (' + daily.difficulty + ')' : 'None'}.
Description:
${dailyDesc}

Format your response in beautiful, copy-pasteable Markdown. Keep your replies concise and clean.`;

      const reply = await grok.generateChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cmd }
      ], { maxTokens: 1000 });

      await sendTelegramMessage(reply);
    } else {
      await sendTelegramMessage('❓ *Unrecognized command.* Type `/help` to see available commands.');
    }
  } catch (err) {
    await sendTelegramMessage(`❌ *AI chatbot error:* ${err.message}`);
  }
}

async function sendTelegramTodayCommand() {
  await sendTelegramMessage('⏳ *Fetching today\'s LeetCode Daily Challenge…*');
  const daily = await fetchDailyChallenge();
  if (!daily) {
    await sendTelegramMessage('❌ *Failed to fetch today\'s challenge.* Ensure you are online.');
    return;
  }
  const statusIcon = daily.userStatus === 'Finish' ? '✅' : '❌';
  const statusMsg = daily.userStatus === 'Finish' ? 'Already Solved' : 'Unsolved';
  
  const text = 
    `📅 *LeetCode Daily Challenge*\n\n` +
    `📖 *Title:* ${daily.title}\n` +
    `🏷️ *Difficulty:* ${daily.difficulty}\n` +
    `${statusIcon} *Status:* ${statusMsg}\n\n` +
    `🔗 *Solve here:* https://leetcode.com/problems/${daily.titleSlug}/`;
    
  await sendTelegramMessage(text);
}

async function sendTelegramQuestionCommand() {
  await sendTelegramMessage('⏳ *Fetching today\'s challenge description…*');
  const daily = await fetchDailyChallenge();
  if (!daily) {
    await sendTelegramMessage('❌ *Failed to fetch today\'s challenge.*');
    return;
  }
  const description = await fetchProblemDescription(daily.titleSlug);
  if (!description) {
    await sendTelegramMessage('❌ *Failed to retrieve the problem description.*');
    return;
  }

  const header = `📖 *${daily.title} (${daily.difficulty})*\n\n`;
  const fullText = header + description;
  if (fullText.length > 4000) {
    await sendTelegramMessage(fullText.slice(0, 4000) + '\n\n*(Truncated due to Telegram limit)*');
  } else {
    await sendTelegramMessage(fullText);
  }
}

async function sendTelegramSolutionCommand(langArg = 'Python') {
  const settings = await StorageService.getSettings();
  if (!settings.grokApiKey) {
    await sendTelegramMessage('❌ *Groq API key not configured.* Open the settings page to add it.');
    return;
  }

  const targetLang = langArg.trim();
  await sendTelegramMessage(`⏳ *Generating solution in ${targetLang} via Groq LLaMA 3.3…*`);
  const daily = await fetchDailyChallenge();
  if (!daily) {
    await sendTelegramMessage('❌ *Failed to fetch today\'s challenge.*');
    return;
  }

  const description = await fetchProblemDescription(daily.titleSlug);
  if (!description) {
    await sendTelegramMessage('❌ *Failed to retrieve the problem description.*');
    return;
  }

  const snippets = await fetchQuestionSnippets(daily.titleSlug);
  let templateCode = '';
  const submitLangSlug = mapLangToLeetCodeSubmitName(targetLang);
  if (snippets) {
    const snippet = snippets.find(s => s.langSlug === submitLangSlug);
    if (snippet) templateCode = snippet.code;
  }

  try {
    const grok = new GrokAPI(settings.grokApiKey);
    const templateHint = templateCode 
      ? `You MUST write your solution inside this exact class/method structure:\n\`\`\`\n${templateCode}\n\`\`\`\n`
      : '';

    const messages = [
      {
        role: 'system',
        content: `You are an expert software engineer. Generate the optimal solution code in ${targetLang} for the LeetCode problem.
${templateHint}Return ONLY the code block inside standard markdown fences (e.g., \`\`\`) without any conversational introduction or conclusion.`
      },
      {
        role: 'user',
        content: `Problem Title: ${daily.title}\nDescription:\n${description}`
      }
    ];
    const codeResponse = await grok.generateChat(messages, { maxTokens: 1500, temperature: 0.2 });
    
    await sendTelegramMessage(`💡 *Optimal AI Solution in ${targetLang} for "${daily.title}":*`);
    await sendTelegramMessage(codeResponse);
  } catch (err) {
    await sendTelegramMessage(`❌ *Failed to generate solution:* ${err.message}`);
  }
}

async function getLeetCodeCsrfToken() {
  return new Promise(resolve => {
    chrome.cookies.get({ url: 'https://leetcode.com', name: 'csrftoken' }, cookie => {
      resolve(cookie ? cookie.value : '');
    });
  });
}

function mapLangToLeetCodeSubmitName(lang) {
  const l = (lang || 'python3').toLowerCase().trim();
  if (l.includes('python') || l === 'py') return 'python3';
  if (l.includes('cpp') || l === 'c++') return 'cpp';
  if (l.includes('java')) return 'java';
  if (l.includes('javascript') || l === 'js') return 'javascript';
  if (l.includes('typescript') || l === 'ts') return 'typescript';
  if (l.includes('golang') || l === 'go') return 'golang';
  if (l.includes('csharp') || l === 'c#') return 'csharp';
  if (l.includes('rust')) return 'rust';
  return l;
}

async function fetchQuestionSnippets(slug) {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query questionEditorData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            codeSnippets {
              lang
              langSlug
              code
            }
          }
        }`,
        variables: { titleSlug: slug }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.question?.codeSnippets || [];
  } catch (err) {
    console.warn('[LC-Companion SW] fetchQuestionSnippets warning:', err);
    return null;
  }
}

async function solveDailyChallengeInBackground() {
  await sendTelegramMessage('⏳ *Starting background Auto-Solver…*');

  const daily = await fetchDailyChallenge();
  if (!daily) {
    await sendTelegramMessage('❌ *Failed to fetch today\'s challenge.*');
    return;
  }

  if (daily.userStatus === 'Finish') {
    await sendTelegramMessage('✅ *Today\'s challenge is already solved!* Streak is safe.');
    return;
  }

  const description = await fetchProblemDescription(daily.titleSlug);
  if (!description) {
    await sendTelegramMessage('❌ *Failed to retrieve the problem description.*');
    return;
  }

  const snippets = await fetchQuestionSnippets(daily.titleSlug);
  let templateCode = '';
  // Default background solve language to python3
  if (snippets) {
    const snippet = snippets.find(s => s.langSlug === 'python3');
    if (snippet) templateCode = snippet.code;
  }

  if (!templateCode) {
    await sendTelegramMessage('❌ *Failed to retrieve LeetCode code snippets.*');
    return;
  }

  await sendTelegramMessage('🧠 *Asking Groq LLaMA 3.3 to write optimal solution code…*');
  let generatedCode = '';
  try {
    const settings = await StorageService.getSettings();
    const grok = new GrokAPI(settings.grokApiKey);
    const messages = [
      {
        role: 'system',
        content: `You are an expert competitive programmer. Write the optimal solution code in Python 3 for the LeetCode problem.
You MUST write your solution inside this exact class/method structure:
\`\`\`python
${templateCode}
\`\`\`
Return ONLY the raw executable python3 code block inside markdown fences (e.g. \`\`\`python). Do not add comments inside the code block.`
      },
      {
        role: 'user',
        content: `Problem Title: ${daily.title}\nDescription:\n${description}`
      }
    ];
    const codeResponse = await grok.generateChat(messages, { maxTokens: 1500, temperature: 0.2 });

    const match = codeResponse.match(/```(?:python|py)?([\s\S]*?)```/i);
    generatedCode = match ? match[1].trim() : codeResponse.trim();
  } catch (err) {
    await sendTelegramMessage(`❌ *AI Generation failed:* ${err.message}`);
    return;
  }

  if (!generatedCode) {
    await sendTelegramMessage('❌ *No code was generated by the AI.*');
    return;
  }

  await sendTelegramMessage('🚀 *Submitting code directly to LeetCode API…*');
  try {
    const csrfToken = await getLeetCodeCsrfToken();
    if (!csrfToken) {
      throw new Error('Could not find active LeetCode session. Make sure you are logged in to leetcode.com on Chrome.');
    }

    const snippetsData = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query questionTitle($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
          }
        }`,
        variables: { titleSlug: daily.titleSlug }
      })
    });
    const parsedSnippet = await snippetsData.json();
    const questionId = parsedSnippet.data?.question?.questionId;

    if (!questionId) {
      throw new Error('Could not retrieve LeetCode question ID.');
    }

    const submitUrl = `https://leetcode.com/problems/${daily.titleSlug}/submit/`;
    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': csrfToken,
        'Referer': `https://leetcode.com/problems/${daily.titleSlug}/`
      },
      credentials: 'include',
      body: JSON.stringify({
        lang: 'python3',
        question_id: questionId,
        typed_code: generatedCode
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} submission error`);
    }

    const data = await res.json();
    const submissionId = data.submission_id;
    if (!submissionId) {
      throw new Error('No submission ID returned. Session might be expired.');
    }

    await sendTelegramMessage('⏳ *Waiting for compiler verdict…*');
    let verdict = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await fetch(`https://leetcode.com/submissions/detail/${submissionId}/check/`, {
        credentials: 'include'
      });
      if (!checkRes.ok) continue;
      const checkData = await checkRes.json();
      if (checkData.state === 'SUCCESS') {
        verdict = checkData;
        break;
      }
    }

    if (!verdict) {
      throw new Error('Compilation timeout.');
    }

    if (verdict.status_msg === 'Accepted') {
      await sendTelegramMessage('✅ *LeetCode Accepted!* Syncing to GitHub…');
      await handleAcceptedSubmission({
        title: daily.title,
        difficulty: daily.difficulty,
        language: 'py',
        code: generatedCode,
        slug: daily.titleSlug
      }, () => {});
    } else {
      let failDetails = verdict.status_msg;
      if (verdict.compile_error) {
        failDetails = `Compile Error: ${verdict.compile_error}`;
      }
      throw new Error(`Verdict: ${failDetails}`);
    }

  } catch (err) {
    await sendTelegramMessage(`❌ *Background solver failed:* ${err.message}`);
  }
}

let isPolling = false;
let isQueueCleared = false;

async function startTelegramLongPoll() {
  if (isPolling) return;
  isPolling = true;

  while (true) {
    const settings = await StorageService.getSettings();
    if (!settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) {
      isPolling = false;
      break;
    }

    // Clear the queue on startup so it doesn't respond to old messages
    if (!isQueueCleared) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/getUpdates?limit=10`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.result && data.result.length > 0) {
            lastTelegramUpdateId = data.result[data.result.length - 1].update_id;
          }
        }
      } catch (e) {
        console.warn('[LC-Companion SW] Queue clearing failed:', e);
      }
      isQueueCleared = true;
      continue;
    }

    try {
      // Long poll request: wait up to 25 seconds for new messages
      const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/getUpdates?offset=${lastTelegramUpdateId + 1}&timeout=25`);
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const data = await res.json();
      if (data.ok && data.result && data.result.length > 0) {
        for (const update of data.result) {
          lastTelegramUpdateId = update.update_id;
          const message = update.message;
          if (message && message.text && String(message.chat.id) === String(settings.telegramChatId)) {
            await handleTelegramCommand(message.text.trim());
          }
        }
      }
    } catch (err) {
      console.warn('[LC-Companion SW] Telegram polling loop warning:', err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function initTelegramPolling() {
  isQueueCleared = false; // Reset queue state
  startTelegramLongPoll();
}

// Initialize on startup
initTelegramPolling();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.telegramEnabled || changes.telegramBotToken || changes.telegramChatId) {
      initTelegramPolling();
    }
  }
});


