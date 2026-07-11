const fetch = require('node-fetch'); // We can use dynamic import or just standard node fetch if Node >= 18

async function fetchStats() {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query getUserCalendar($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            streak
            totalActiveDays
            submissionCalendar
          }
        }
      }`,
      variables: { username: 'lee215' }
    })
  });
  const data = await res.json();
  const cal = JSON.parse(data.data.matchedUser.userCalendar.submissionCalendar);
  const keys = Object.keys(cal).slice(-5);
  console.log('Streak from API (Max or current?):', data.data.matchedUser.userCalendar.streak);
  console.log('Recent timestamps:', keys);
  for (let k of keys) {
    console.log(k, '->', new Date(k * 1000).toISOString());
  }
}
fetchStats();
