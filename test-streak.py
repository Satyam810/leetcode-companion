import urllib.request
import json
import time
import math

url = 'https://leetcode.com/graphql'
headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
data = {
    'query': '''
    query getUserCalendar($username: String!) {
      matchedUser(username: $username) {
        userCalendar {
          streak
          totalActiveDays
          submissionCalendar
        }
      }
    }
    ''',
    'variables': {'username': 'satyamvatsa810'}
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        calendar = result['data']['matchedUser']['userCalendar']
        apiMaxStreak = calendar.get('streak', 0)
        
        currentStreakVal = 0
        submissionCalendar = json.loads(calendar.get('submissionCalendar', '{}'))
        timestamps = [int(k) for k in submissionCalendar.keys()]
        
        if len(timestamps) > 0:
            currentUtcDay = math.floor(time.time() / 86400)
            activeDays = set([math.floor(ts / 86400) for ts in timestamps])
            
            streak = 0
            dayToCheck = currentUtcDay
            
            if dayToCheck not in activeDays:
                dayToCheck -= 1
                
            while dayToCheck in activeDays:
                streak += 1
                dayToCheck -= 1
                
            currentStreakVal = streak
            
        print("TEST RESULTS:")
        print(f"Current Streak Calculated: {currentStreakVal}")
        print(f"Best Streak (from API): {apiMaxStreak}")

except Exception as e:
    print(f"Error: {e}")
