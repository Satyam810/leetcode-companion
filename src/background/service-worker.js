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
function formatCodeWithDescription(code, description, language) {
  if (!description || !description.trim()) return code;
  const ext = (language || 'txt').toLowerCase();
  const isPythonOrRubyOrBash = ['py', 'rb', 'sh', 'pl'].includes(ext);
  const cleanedDesc = description.replace(/\n\s*\n/g, '\n\n').trim();
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
    if (!statusRes.ok) return null;
    const statusData = await statusRes.json();
    const { username, isSignedIn } = statusData.data?.userStatus || {};
    if (!isSignedIn || !username) return null;

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
    console.error('[LC-Companion SW] fetchLeetCodeStats error:', err);
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
    // Strip HTML tags and normalize whitespace
    return htmlContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    console.error('[LC-Companion SW] fetchProblemDescription error:', err);
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
    console.error('[LC-Companion SW] handleAutoSolveSuccess error:', err);
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
    console.error('[LC-Companion SW] checkStreakProtection error:', err);
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
      title:      challenge.question.title
    };
  } catch (err) {
    console.error('[LC-Companion SW] fetchDailyChallenge error:', err);
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
    console.error('[LC-Companion SW] runAutoSolveImmediately error:', err);
    return false;
  }
}


