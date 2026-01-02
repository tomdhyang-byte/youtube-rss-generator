"""
Podcast Processing Module
Handles fetching and processing podcast episodes with style-based summaries.

Design B Implementation:
- Demand-driven: Only generate summaries for styles that subscribers have selected
- Locked style: Record each user's style at the time of episode processing
"""
import time
import random
from datetime import datetime
import requests
import feedparser
import re

from .transcribe import transcribe_audio
from .summarize import generate_summary
from .common import lock_user_styles, ensure_missing_summaries


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
    Process a podcast channel: fetch new episodes, transcribe, generate style-based summaries.
    
    Args:
        conn: Database connection
        podcast: Podcast dict with id, feed_url, title, etc.
    """
    podcast_id = podcast['id']
    feed_url = podcast['feed_url']
    podcast_title = podcast['title'] or "Unknown Podcast"
    
    print(f"Processing Podcast: {podcast_title} ({feed_url})")
    
    # 1. Query all subscribers and their current styles + languages
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, summary_style, summary_language 
        FROM podcast_subscriptions 
        WHERE podcast_id = %s
    """, (podcast_id,))
    subscribers = cursor.fetchall()
    
    if not subscribers:
        print("  - No subscribers, skipping podcast.")
        return
    
    # Convert to list of dicts for easier handling
    subscriber_list = [{'user_id': row[0], 'style': row[1], 'language': row[2]} for row in subscribers]
    # Track unique (style, language) combinations that need summaries
    demanded_combos = set((sub['style'], sub['language']) for sub in subscriber_list)
    
    print(f"  - Found {len(subscriber_list)} subscribers with combos: {demanded_combos}")
    
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
        cursor.execute("""
            UPDATE podcast_channels 
            SET title = %s, description = %s, site_url = %s, image_url = %s 
            WHERE id = %s
        """, (new_title, new_desc, new_site, new_image, podcast_id))
        conn.commit()

    # Process episodes (limit 1 latest)
    for entry in feed.entries[:1]:
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
        cursor.execute("SELECT id FROM podcast_episodes WHERE podcast_id = %s AND guid = %s", (podcast_id, guid))
        existing = cursor.fetchone()
        if existing:
            episode_db_id = existing[0]
            print(f"    - Episode already exists (ID: {episode_db_id}), checking for missing user styles...")
            
            # 1. Fetch transcript for summary generation if needed
            cursor.execute("SELECT transcript FROM podcast_episodes WHERE id = %s", (episode_db_id,))
            row = cursor.fetchone()
            transcript = row[0] if row else None
            
            # 2. Ensure missing summaries (e.g. new language demanded)
            if transcript:
                ensure_missing_summaries(conn, episode_db_id, transcript, demanded_combos, is_podcast=True)
                
            # 3. Lock user styles
            lock_user_styles(conn, episode_db_id, subscriber_list, 'user_episode_styles', 'episode_id')
            continue
            
        print(f"    - New Episode found: {title}")
        
        # Transcribe audio
        print("    - Transcribing audio...")
        transcript = transcribe_audio(audio_url)
        
        if not transcript:
            print("    - No transcript available, skipping episode.")
            continue
        
        print(f"    - Transcript fetched ({len(transcript)} chars).")
        
        # Truncate if too long
        if len(transcript) > 200000:
            print("    - Transcript too long, truncating...")
            transcript = transcript[:200000] + "...(truncated)"
        
        # Parse published_at
        published_at = datetime.now()
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            published_at = datetime.fromtimestamp(time.mktime(entry.published_parsed))
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            published_at = datetime.fromtimestamp(time.mktime(entry.updated_parsed))

        # Insert episode record (without summary - summaries are in separate table now)
        cursor.execute(
            """INSERT INTO podcast_episodes 
               (podcast_id, guid, title, audio_url, transcript, published_at) 
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (podcast_id, guid, title, audio_url, transcript, published_at)
        )
        episode_db_id = cursor.fetchone()[0]
        conn.commit()
        print(f"    - Episode saved to DB (ID: {episode_db_id})")
        
        # Generate summaries for each demanded (style, language) combination
        print(f"    - Generating summaries for combos: {demanded_combos}")
        successful_combos = 0
        for (style, language) in demanded_combos:
            try:
                print(f"      - Generating {style}/{language} summary...")
                summary = generate_summary(transcript, style=style, language=language, is_podcast=True)
                
                # Now storing multiple language versions per style
                cursor.execute("""
                    INSERT INTO episode_summaries (episode_id, style, language, content, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (episode_id, style, language) DO UPDATE SET content = EXCLUDED.content
                """, (episode_db_id, style, language, summary))
                successful_combos += 1
            except Exception as e:
                print(f"      - ⚠️ Failed to generate {style}/{language} summary: {e}")
                continue  # Continue with remaining combos
        
        conn.commit()
        print(f"    - {successful_combos}/{len(demanded_combos)} summaries generated and saved.")
        
        # Lock each subscriber's style for this episode (Design B core)
        lock_user_styles(conn, episode_db_id, subscriber_list, 'user_episode_styles', 'episode_id')
        
        # Rate limiting
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next episode...")
        time.sleep(delay)

    # Update last_updated timestamp
    cursor.execute("UPDATE podcast_channels SET last_updated = %s WHERE id = %s", (datetime.now(), podcast_id))
    conn.commit()




