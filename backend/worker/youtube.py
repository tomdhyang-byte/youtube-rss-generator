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
from datetime import datetime

from backend.services.youtube_metadata import (
    fetch_videos_from_rss,
    fetch_videos_from_scrapetube,
)
from .transcribe import fetch_transcript_with_fallback, download_and_transcribe_audio
from .summarize import generate_summary
from .common import lock_user_styles, ensure_missing_summaries
from .cleanup import enforce_video_retention


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




