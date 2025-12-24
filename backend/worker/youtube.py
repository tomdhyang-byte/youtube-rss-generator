"""
YouTube Processing Module
Handles fetching and processing YouTube channel videos.
"""
import time
import random
from datetime import datetime
import scrapetube

from .transcribe import fetch_supadata_transcript
from .summarize import generate_summary


def process_youtube_channel(conn, channel: dict) -> None:
    """
    Process a YouTube channel: fetch new videos, get transcripts, generate summaries.
    
    Args:
        conn: Database connection
        channel: Channel dict with id, youtube_id, title, description, etc.
    """
    channel_id = channel['id']
    youtube_id = channel['youtube_id']
    channel_title = channel['title']
    
    print(f"Processing YouTube Channel: {channel_title} ({youtube_id})")
    
    print("  - Fetching video list from YouTube...")
    try:
        videos = scrapetube.get_channel(channel_id=youtube_id, limit=3)
        print("  - Video list fetched.")
    except Exception as e:
        print(f"  - Error fetching videos: {e}")
        return

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
                    cursor = conn.cursor()
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
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM youtube_videos WHERE youtube_video_id = %s", (video_id,))
        if cursor.fetchone():
            print(f"    - Video already exists, skipping.")
            continue
            
        print(f"    - New Video found: {title}")
        
        # Fetch transcript
        print("    - Fetching transcript from Supadata...")
        transcript = fetch_supadata_transcript(video_id)
        summary = "No transcript available."
        
        if transcript:
            print("    - Transcript fetched. Generating summary...")
            summary = generate_summary(transcript, is_podcast=False)
            print("    - Summary generated.")
        
        published_at = datetime.now()

        cursor.execute(
            "INSERT INTO youtube_videos (youtube_video_id, channel_id, title, summary, published_at) VALUES (%s, %s, %s, %s, %s)",
            (video_id, channel_id, title, summary, published_at)
        )
        conn.commit()
        print("    - Saved to DB.")
        
        # Rate limiting
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    # Update last_updated timestamp
    cursor = conn.cursor()
    cursor.execute("UPDATE youtube_channels SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()
