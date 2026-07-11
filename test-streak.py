import urllib.request
import json
import datetime

url = 'https://leetcode.com/graphql'
headers = {'Content-Type': 'application/json'}
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
    'variables': {'username': 'Satyam810'}
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        calendar = result['data']['matchedUser']['userCalendar']
        sub_cal = json.loads(calendar['submissionCalendar'])
        print(f"API returned streak: {calendar['streak']}")
        print("Last 10 active dates from submissionCalendar (converted to local timezone):")
        timestamps = sorted([int(k) for k in sub_cal.keys()])[-10:]
        for ts in timestamps:
            dt = datetime.datetime.fromtimestamp(ts)
            dt_utc = datetime.datetime.utcfromtimestamp(ts)
            print(f"Unix {ts} -> Local: {dt.strftime('%Y-%m-%d %H:%M:%S')} | UTC: {dt_utc.strftime('%Y-%m-%d %H:%M:%S')}")
except Exception as e:
    print(f"Error: {e}")
