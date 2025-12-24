"""
Podcast Processing Module
Handles fetching and processing podcast episodes.
"""
import time
import random
from datetime import datetime
import requests
import feedparser

from .transcribe import transcribe_audio
from .summarize import generate_summary

import re

def strip_html(text: str) -> str:
    """
    Strip HTML tags from a string.
    Used to clean RSS feed descriptions that may contain HTML markup.
    """
    if not text:
        return ''
    return re.sub(r'<[^>]*>', '', text).strip()


def process_podcast_channel(conn, podcast: dict) -> None:
    """
    Process a podcast channel: fetch new episodes, transcribe, generate summaries.
    
    Args:
        conn: Database connection
        podcast: Podcast dict with id, feed_url, title, etc.
    """
    podcast_id = podcast['id']
    feed_url = podcast['feed_url']
    podcast_title = podcast['title'] or "Unknown Podcast"
    
    print(f"Processing Podcast: {podcast_title} ({feed_url})")
    
    # Fetch and parse RSS feed
    # Fetch and parse RSS feed
    # NOTE: We propagate exceptions here so main daemon knows if it failed
    response = requests.get(feed_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
    response.raise_for_status()
    feed = feedparser.parse(response.content)

    # Update podcast metadata if missing
    if not podcast['title'] and feed.feed.get('title'):
        new_title = feed.feed.get('title')
        new_desc = strip_html(feed.feed.get('description', ''))
        new_site = feed.feed.get('link', '')
        new_image = feed.feed.get('image', {}).get('href', '')
        
        print(f"  - Updating podcast metadata: {new_title}")
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE podcast_channels 
            SET title = %s, description = %s, site_url = %s, image_url = %s 
            WHERE id = %s
        """, (new_title, new_desc, new_site, new_image, podcast_id))
        conn.commit()

    # Process episodes (limit 3 latest)
    for entry in feed.entries[:3]:
        guid = entry.get('guid', entry.get('link'))
        title = entry.get('title', 'Untitled Episode')
        
        # Find audio URL
        audio_url = None
        for enclosure in entry.get('enclosures', []):
            if enclosure.get('type', '').startswith('audio'):
                audio_url = enclosure.get('href')
                break
        
        if not audio_url:
            print(f"  - No audio found for: {title}, skipping.")
            continue

        print(f"  - Checking episode: {title}")
        
        # Check if exists
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM podcast_episodes WHERE podcast_id = %s AND guid = %s", (podcast_id, guid))
        if cursor.fetchone():
            print(f"    - Episode already exists, skipping.")
            continue
            
        print(f"    - New Episode found: {title}")
        
        # Transcribe audio
        print("    - Transcribing audio...")
        transcript = transcribe_audio(audio_url)
        summary = "No transcript available."
        
        if transcript:
            print(f"    - Transcript fetched ({len(transcript)} chars).")
            
            # Truncate if too long
            if len(transcript) > 200000:
                print("    - Transcript too long, truncating...")
                transcript = transcript[:200000] + "...(truncated)"
            
            print("    - Generating summary...")
            summary = generate_summary(transcript, is_podcast=True)
            print("    - Summary generated.")
        
        # Parse published_at
        published_at = datetime.now()
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            published_at = datetime.fromtimestamp(time.mktime(entry.published_parsed))
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            published_at = datetime.fromtimestamp(time.mktime(entry.updated_parsed))

        cursor.execute(
            """INSERT INTO podcast_episodes 
               (podcast_id, guid, title, audio_url, transcript, summary, published_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (podcast_id, guid, title, audio_url, transcript, summary, published_at)
        )
        conn.commit()
        print("    - Saved to DB.")
        
        # Rate limiting
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next episode...")
        time.sleep(delay)

    # Update last_updated timestamp
    cursor = conn.cursor()
    cursor.execute("UPDATE podcast_channels SET last_updated = %s WHERE id = %s", (datetime.now(), podcast_id))
    conn.commit()
