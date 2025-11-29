import feedparser
import sys

url = "https://feeds.soundon.fm/podcasts/954689a5-3096-43a4-a80b-7810b219cef3.xml"

import requests

print(f"Parsing URL: {url}")
try:
    response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
    response.raise_for_status()
    feed = feedparser.parse(response.content)
except Exception as e:
    print(f"Requests Error: {e}")
    sys.exit(1)

print(f"Bozo (Error Flag): {feed.bozo}")
if feed.bozo:
    print(f"Bozo Exception: {feed.bozo_exception}")

print(f"Feed Title: {feed.feed.get('title', 'N/A')}")
print(f"Entries Count: {len(feed.entries)}")

if len(feed.entries) > 0:
    print("First Entry Title:", feed.entries[0].title)
    print("First Entry Enclosures:", feed.entries[0].get('enclosures', []))
else:
    print("No entries found!")
    # Check if it's a 403 Forbidden or similar (often due to missing User-Agent)
    print("Status:", getattr(feed, 'status', 'Unknown'))
    print("Headers:", getattr(feed, 'headers', 'Unknown'))
