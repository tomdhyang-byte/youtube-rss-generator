"""
YouTube Processing Module
Handles fetching and processing YouTube channel videos with style-based summaries.

Design B Implementation:
- Demand-driven: Only generate summaries for styles that subscribers have selected
- Locked style: Record each user's style at the time of video processing
"""
import time
import random
import re
from datetime import datetime, timedelta
import scrapetube

from .transcribe import fetch_supadata_transcript
from .summarize import generate_summary


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
    
    # 1. Query all subscribers and their current styles
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, summary_style 
        FROM youtube_subscriptions 
        WHERE channel_id = %s
    """, (channel_id,))
    subscribers = cursor.fetchall()
    
    if not subscribers:
        print("  - No subscribers, skipping channel.")
        return
    
    # Convert to list of dicts for easier handling
    subscriber_list = [{'user_id': row[0], 'style': row[1]} for row in subscribers]
    demanded_styles = set(sub['style'] for sub in subscriber_list)
    
    print(f"  - Found {len(subscriber_list)} subscribers with styles: {demanded_styles}")
    
    print("  - Fetching video list from YouTube...")
    # NOTE: We propagate exceptions here so main daemon knows if it failed
    videos = scrapetube.get_channel(channel_id=youtube_id, limit=1)
    print("  - Video list fetched.")

    first_video = True
    for video in videos:
        video_id = video['videoId']
        title = video['title']['runs'][0]['text']
        print(f"  - Checking video: {title} ({video_id})")
        
        # Update channel title if it's a placeholder
        if first_video and (channel_title == 'New Channel'):
            try:
                new_title = video.get('ownerText', {}).get('runs', [{}])[0].get('text')
                if not new_title:
                    new_title = video.get('shortBylineText', {}).get('runs', [{}])[0].get('text')
                
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
            # Still need to lock styles for any new subscribers
            _lock_user_styles(conn, video_db_id, subscriber_list)
            continue
            
        print(f"    - New Video found: {title}")
        
        # Fetch transcript once
        print("    - Fetching transcript from Supadata...")
        transcript = fetch_supadata_transcript(video_id)
        
        if not transcript:
            print("    - No transcript available, skipping video.")
            continue
        
        print("    - Transcript fetched.")
        published_time_text = video.get('publishedTimeText', {}).get('simpleText', '')
        published_at = parse_relative_time(published_time_text)
        print(f"    - Published: {published_time_text} -> {published_at}")

        # Insert video record (without summary - summaries are in separate table now)
        cursor.execute(
            """INSERT INTO youtube_videos (youtube_video_id, channel_id, title, transcript, published_at) 
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (video_id, channel_id, title, transcript, published_at)
        )
        video_db_id = cursor.fetchone()[0]
        conn.commit()
        print(f"    - Video saved to DB (ID: {video_db_id})")
        
        # Generate summaries for each demanded style
        print(f"    - Generating summaries for styles: {demanded_styles}")
        successful_styles = 0
        for style in demanded_styles:
            try:
                print(f"      - Generating {style} summary...")
                summary = generate_summary(transcript, style=style, is_podcast=False)
                
                cursor.execute("""
                    INSERT INTO video_summaries (video_id, style, content, created_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (video_id, style) DO NOTHING
                """, (video_db_id, style, summary))
                successful_styles += 1
            except Exception as e:
                print(f"      - ⚠️ Failed to generate {style} summary: {e}")
                continue  # Continue with remaining styles
        
        conn.commit()
        print(f"    - {successful_styles}/{len(demanded_styles)} summaries generated and saved.")
        
        # Lock each subscriber's style for this video (Design B core)
        _lock_user_styles(conn, video_db_id, subscriber_list)
        
        # Rate limiting
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    # Update last_updated timestamp
    cursor.execute("UPDATE youtube_channels SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()


def _lock_user_styles(conn, video_db_id: int, subscriber_list: list) -> None:
    """
    Lock the summary style for each user for this video.
    This ensures that when a user changes their style, past videos still show the old style.
    
    Args:
        conn: Database connection
        video_db_id: The database ID of the video
        subscriber_list: List of dicts with 'user_id' and 'style' keys
    """
    cursor = conn.cursor()
    locked_count = 0
    
    for sub in subscriber_list:
        try:
            cursor.execute("""
                INSERT INTO user_video_styles (user_id, video_id, style)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, video_id) DO NOTHING
            """, (sub['user_id'], video_db_id, sub['style']))
            if cursor.rowcount > 0:
                locked_count += 1
        except Exception as e:
            print(f"    - Error locking style for user {sub['user_id']}: {e}")
    
    conn.commit()
    if locked_count > 0:
        print(f"    - Locked styles for {locked_count} users.")

