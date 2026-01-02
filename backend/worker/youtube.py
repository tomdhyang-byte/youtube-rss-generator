"""
YouTube Processing Module
Handles fetching and processing YouTube channel videos with style-based summaries.

Design B Implementation:
- Demand-driven: Only generate summaries for styles that subscribers have selected
- Locked style: Record each user's style at the time of video processing

Transcript Fetching (Multi-tier):
1. Free youtube-transcript-api (with quota/cooldown)
2. Supadata (paid)
3. Deepgram + yt-dlp (for videos without subtitles)
"""
import time
import random
import re
import os
import subprocess
import tempfile
from datetime import datetime, timedelta
import scrapetube
import feedparser
import ssl
import urllib.request

from .transcribe import fetch_transcript_with_fallback, transcribe_audio_file
from .summarize import generate_summary
from .common import lock_user_styles, ensure_missing_summaries
from .cleanup import enforce_video_retention


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
        
        # Use a custom SSL context to avoid certificate issues
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
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


def download_and_transcribe_audio(video_id: str) -> str | None:
    """
    Downloads audio from a YouTube video using yt-dlp and transcribes it using Deepgram.
    
    Args:
        video_id: The YouTube video ID.
        
    Returns:
        The transcribed text, or None if transcription fails.
    """
    print(f"      - Attempting to download audio for {video_id}...")
    
    # Create a temporary directory for the audio file
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = os.path.join(tmpdir, f"{video_id}.mp3")
        
        # yt-dlp command to download audio
        command = [
            "yt-dlp",
            "--extract-audio",
            "--audio-format", "mp3",
            "--output", output_path,
            f"https://www.youtube.com/watch?v={video_id}"
        ]
        
        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
            print(f"      - Audio downloaded to {output_path}")
            
            # Transcribe the downloaded audio file
            transcript = transcribe_audio_file(output_path)
            return transcript
            
        except subprocess.CalledProcessError as e:
            print(f"      - yt-dlp failed for {video_id}: {e.stderr}")
            return None
        except Exception as e:
            print(f"      - Error during audio download or transcription for {video_id}: {e}")
            return None


def process_youtube_channel(conn, channel: dict) -> None:
    """
    Process a YouTube channel: fetch new videos, get transcripts, generate style-based summaries.
    
    Args:
        conn: Database connection
        channel: Channel dict with id, youtube_id, title, description, etc.
    """
    channel_id = channel['id']
    youtube_id = channel['youtube_id']
    channel_title = channel['title']
    
    print(f"Processing YouTube Channel: {channel_title} ({youtube_id})")
    
    # 1. Query all subscribers and their current styles + languages
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, summary_style, summary_language 
        FROM youtube_subscriptions 
        WHERE channel_id = %s
    """, (channel_id,))
    subscribers = cursor.fetchall()
    
    if not subscribers:
        print("  - No subscribers, skipping channel.")
        return
    
    # Convert to list of dicts for easier handling
    subscriber_list = [{'user_id': row[0], 'style': row[1], 'language': row[2]} for row in subscribers]
    # Track unique (style, language) combinations that need summaries
    demanded_combos = set((sub['style'], sub['language']) for sub in subscriber_list)
    
    print(f"  - Found {len(subscriber_list)} subscribers with combos: {demanded_combos}")
    
    # Fetch videos: RSS first (precise timestamps), scrapetube fallback (relative time)
    print("  - Fetching video list from YouTube RSS...")
    videos = fetch_videos_from_rss(youtube_id, limit=1)
    video_source = "rss"
    
    if not videos:
        print("  - RSS unavailable, falling back to scrapetube...")
        videos = fetch_videos_from_scrapetube(youtube_id, limit=1)
        video_source = "scrapetube"
    
    if not videos:
        print("  - ❌ No videos found from any source.")
        return
        
    print(f"  - Video list fetched (source: {video_source}).")

    first_video = True
    for video_info in videos:
        video_id = video_info['video_id']
        title = video_info['title']
        published_at = video_info['published_at']
        raw_video = video_info.get('raw_video')  # Only available in scrapetube fallback
        
        print(f"  - Checking video: {title} ({video_id})")
        
        # Update channel title if it's a placeholder (only works with scrapetube)
        if first_video and (channel_title == 'New Channel') and raw_video:
            try:
                new_title = raw_video.get('ownerText', {}).get('runs', [{}])[0].get('text')
                if not new_title:
                    new_title = raw_video.get('shortBylineText', {}).get('runs', [{}])[0].get('text')
                
                if new_title:
                    print(f"    - Found real channel title: {new_title}")
                    cursor.execute(
                        "UPDATE youtube_channels SET title = %s, description = %s WHERE id = %s", 
                        (new_title, "Updated by worker", channel_id)
                    )
                    conn.commit()
                    channel_title = new_title 
            except Exception as e:
                print(f"    - Could not extract channel title from video: {e}")
        first_video = False
        
        # Check if video already exists
        cursor.execute("SELECT id FROM youtube_videos WHERE youtube_video_id = %s", (video_id,))
        existing = cursor.fetchone()
        if existing:
            video_db_id = existing[0]
            print(f"    - Video already exists (ID: {video_db_id}), checking for missing user styles...")
            
            # 1. Fetch transcript for summary generation if needed
            cursor.execute("SELECT transcript FROM youtube_videos WHERE id = %s", (video_db_id,))
            row = cursor.fetchone()
            transcript = row[0] if row else None
            
            # 2. Ensure missing summaries (e.g. new language demanded)
            if transcript:
                ensure_missing_summaries(conn, video_db_id, transcript, demanded_combos, is_podcast=False)

            # 3. Lock user styles
            lock_user_styles(conn, video_db_id, subscriber_list, 'user_video_styles', 'video_id')
            continue
            
        print(f"    - New Video found: {title}")
        
        # Fetch transcript using multi-tier fallback
        print("    - Fetching transcript...")
        transcript, source = fetch_transcript_with_fallback(video_id)
        
        # If both free API and Supadata failed, try Deepgram (download audio first)
        if not transcript:
            print("    - No subtitle available. Trying Deepgram (yt-dlp + STT)...")
            transcript = download_and_transcribe_audio(video_id)
            if transcript:
                source = "deepgram"
        
        if not transcript:
            print("    - ❌ No transcript available from any source, skipping video.")
            continue
        
        print(f"    - ✅ Transcript fetched (source: {source})")
        print(f"    - Published: {published_at} (via {video_source})")

        # Insert video record (without summary - summaries are in separate table now)
        cursor.execute(
            """INSERT INTO youtube_videos (youtube_video_id, channel_id, title, transcript, published_at) 
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (video_id, channel_id, title, transcript, published_at)
        )
        video_db_id = cursor.fetchone()[0]
        conn.commit()
        print(f"    - Video saved to DB (ID: {video_db_id})")
        
        # Generate summaries for each demanded (style, language) combination
        print(f"    - Generating summaries for combos: {demanded_combos}")
        successful_combos = 0
        for (style, language) in demanded_combos:
            try:
                print(f"      - Generating {style}/{language} summary...")
                summary = generate_summary(transcript, style=style, language=language, is_podcast=False)
                
                # Note: We still store by (video_id, style) since the actual content varies by language
                # TODO: If you want to store multiple language versions, the schema would need (video_id, style, language)
                # For now, we generate on-demand per combo but only store one version per style
                cursor.execute("""
                    INSERT INTO video_summaries (video_id, style, language, content, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (video_id, style, language) DO UPDATE SET content = EXCLUDED.content
                """, (video_db_id, style, language, summary))
                successful_combos += 1
            except Exception as e:
                print(f"      - ⚠️ Failed to generate {style}/{language} summary: {e}")
                continue  # Continue with remaining combos
        
        conn.commit()
        print(f"    - {successful_combos}/{len(demanded_combos)} summaries generated and saved.")
        
        # Lock each subscriber's style for this video (Design B core)
        lock_user_styles(conn, video_db_id, subscriber_list, 'user_video_styles', 'video_id')
        
        # Rate limiting
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    # Enforce retention policy (Keep latest 15 videos)
    enforce_video_retention(conn, channel_id, limit=15)

    # Update last_updated timestamp
    cursor.execute("UPDATE youtube_channels SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()




