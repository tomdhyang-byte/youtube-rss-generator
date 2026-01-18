"""
YouTube Metadata Service
Handles fetching raw video data from external sources (RSS, Scrapetube) and YouTube-specific utilities.
"""
import re
import ssl
import urllib.request
from datetime import datetime, timedelta

import feedparser
import scrapetube


def parse_relative_time(text: str) -> datetime:
    """
    Parse relative time strings like '3 days ago' into datetime objects.

    Args:
        text: Relative time string from YouTube (e.g., '3 days ago', '2 weeks ago')

    Returns:
        Approximate datetime when the video was published
    """
    if not text:
        return datetime.now()

    now = datetime.now()
    text_lower = text.lower()

    # Extract number and unit
    match = re.search(r'(\d+)\s*(second|minute|hour|day|week|month|year)', text_lower)
    if not match:
        return now  # Can't parse, use current time

    num = int(match.group(1))
    unit = match.group(2)

    if 'second' in unit:
        return now - timedelta(seconds=num)
    elif 'minute' in unit:
        return now - timedelta(minutes=num)
    elif 'hour' in unit:
        return now - timedelta(hours=num)
    elif 'day' in unit:
        return now - timedelta(days=num)
    elif 'week' in unit:
        return now - timedelta(weeks=num)
    elif 'month' in unit:
        return now - timedelta(days=num * 30)  # Approximate
    elif 'year' in unit:
        return now - timedelta(days=num * 365)  # Approximate

    return now


def is_short_video(video_id: str) -> bool:
    """
    Check if a video is a YouTube Short using HTTP Redirect method.

    Args:
        video_id: The YouTube video ID

    Returns:
        True if it's a Short, False if it's a regular video (or unable to determine)
    """
    try:
        url = f"https://www.youtube.com/shorts/{video_id}"

        # Create a request that forbids automatic redirects
        # Note: urllib.request follows redirects by default. We need to check the response URL.
        # However, for efficiency, a HEAD request is better.
        # But 'http.client' or 'requests' is needed for true no-follow.
        # With standard urllib, we can let it redirect and check the final URL.

        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})

        ssl_context = ssl.create_default_context()

        with urllib.request.urlopen(req, context=ssl_context, timeout=5) as response:
            final_url = response.geturl()
            # If redirected to /watch, it's a regular video
            if "/watch" in final_url:
                return False
            # If stays on /shorts/, it's a Short
            return True

    except Exception as e:
        print(f"    - Warning: Could not check if video is Short ({e}), assuming regular video.")
        return False


def fetch_videos_from_rss(youtube_channel_id: str, limit: int = 15) -> list | None:
    """
    Fetch videos from YouTube RSS feed with precise timestamps.

    Args:
        youtube_channel_id: The YouTube channel ID (e.g., UC...)
        limit: Maximum number of videos to return

    Returns:
        List of video dicts with 'video_id', 'title', 'published_at', or None if RSS unavailable
    """
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={youtube_channel_id}"

    try:
        # Use custom SSL context to handle certificate issues on some systems (e.g., macOS)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context, timeout=15) as response:
            content = response.read().decode('utf-8')

        feed = feedparser.parse(content)

        if not feed.entries:
            return None

        videos = []
        for entry in feed.entries[:limit]:
            # Extract video ID from the yt:videoId tag
            video_id = getattr(entry, 'yt_videoid', None)
            if not video_id and hasattr(entry, 'id'):
                # Fallback: extract from entry.id (format: yt:video:VIDEO_ID)
                video_id = entry.id.split(':')[-1] if 'yt:video:' in entry.id else None

            if not video_id:
                continue

            # Parse published time (precise!)
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_at = datetime(*entry.published_parsed[:6])
            else:
                published_at = datetime.now()

            # Check for Shorts (Redirect Method)
            if is_short_video(video_id):
                print(f"    - ⏭️  Skipping Shorts (RSS): {entry.title}")
                continue

            videos.append({
                'video_id': video_id,
                'title': entry.title,
                'published_at': published_at
            })

        return videos if videos else None

    except Exception as e:
        print(f"    - RSS fetch error: {e}")
        return None


def fetch_videos_from_scrapetube(youtube_channel_id: str, limit: int = 15) -> list:
    """
    Fetch videos using scrapetube (fallback with relative time parsing).

    Args:
        youtube_channel_id: The YouTube channel ID
        limit: Maximum number of videos to return

    Returns:
        List of video dicts with 'video_id', 'title', 'published_at', 'raw_video' (for metadata)
    """
    videos = []
    # Use content_type='videos' to exclude Shorts
    for video in scrapetube.get_channel(channel_id=youtube_channel_id, limit=limit, content_type="videos"):
        video_id = video['videoId']
        title = video['title']['runs'][0]['text']
        published_time_text = video.get('publishedTimeText', {}).get('simpleText', '')
        published_at = parse_relative_time(published_time_text)

        videos.append({
            'video_id': video_id,
            'title': title,
            'published_at': published_at,
            'raw_video': video  # Keep raw for channel title extraction
        })

    return videos
