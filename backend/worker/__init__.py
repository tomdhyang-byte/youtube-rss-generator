"""
YouTube RSS Generator Worker Package

This package provides the worker functionality for processing
YouTube channels and Podcasts, including transcription and AI summarization.
"""

from .config import validate_config
from .db import get_db_connection, fetch_as_dict
from .youtube import process_youtube_channel
from .podcast import process_podcast_channel


def main():
    """
    Main worker function. Processes all YouTube channels and Podcasts
    that have active subscriptions.
    """
    print("Starting Worker...")
    
    # Validate configuration
    if not validate_config():
        print("Configuration validation failed. Exiting.")
        return
    
    print("Connecting to database...")
    conn = get_db_connection()
    print("Database connected.")
    
    try:
        # 1. Process YouTube Channels (Only those with active subscriptions)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT c.id, c.youtube_id, c.title, c.description, c.rss_url, c.last_updated
            FROM youtube_channels c
            JOIN youtube_subscriptions s ON c.id = s.channel_id
        """)
        channels = fetch_as_dict(cursor)
        print(f"Found {len(channels)} YouTube channels with active subscriptions.")
        for channel in channels:
            process_youtube_channel(conn, channel)
            
        # 2. Process Podcast Channels (Only those with active subscriptions)
        cursor.execute("""
            SELECT DISTINCT c.id, c.feed_url, c.title, c.description, c.site_url, c.image_url, c.last_updated
            FROM podcast_channels c
            JOIN podcast_subscriptions s ON c.id = s.podcast_id
        """)
        podcasts = fetch_as_dict(cursor)
        print(f"Found {len(podcasts)} Podcast channels with active subscriptions.")
        for podcast in podcasts:
            process_podcast_channel(conn, podcast)
            
    except Exception as e:
        print(f"Worker Error: {e}")
    finally:
        conn.close()
    
    print("Worker Finished.")


__all__ = [
    'main',
    'validate_config',
    'get_db_connection',
    'fetch_as_dict',
    'process_youtube_channel',
    'process_podcast_channel',
]
