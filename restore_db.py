import os
import json
import psycopg2
from dotenv import load_dotenv

def restore_data():
    load_dotenv()
    url = os.getenv('DATABASE_URL')
    if not url:
        print("Error: DATABASE_URL not found.")
        return

    if not os.path.exists('db_backup.json'):
        print("Error: db_backup.json not found. Run dump_db.py first.")
        return

    print("Loading backup data...")
    with open('db_backup.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    channels = data.get('channels', [])
    videos = data.get('videos', [])

    print(f"Loaded {len(channels)} channels and {len(videos)} videos.")
    print("Connecting to destination database...")
    
    # Remove pgbouncer param for psycopg2
    clean_url = url.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')
    
    try:
        conn = psycopg2.connect(clean_url, connect_timeout=30)
        cursor = conn.cursor()

        # 1. Restore Channels
        print("Restoring Channels...")
        for ch in channels:
            # Upsert Channel
            # Note: Adjust columns based on your schema. 
            # Schema: id, youtube_id, title, description, rss_url, last_updated
            # We use ON CONFLICT to avoid duplicates, usually on youtube_id
            
            sql = """
                INSERT INTO "Channel" (youtube_id, title, description, rss_url, last_updated)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (youtube_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    rss_url = EXCLUDED.rss_url,
                    last_updated = EXCLUDED.last_updated
                RETURNING id;
            """
            cursor.execute(sql, (
                ch['youtube_id'], 
                ch['title'], 
                ch['description'], 
                ch['rss_url'], 
                ch['last_updated']
            ))
            # We need to map old ID to new ID if we want to preserve relationships accurately,
            # but since Video links via channel_id (which is an auto-inc int), we must look up the new ID.
            # The RETURNING id helps, but we need to map old_id -> new_id for videos.
            new_id = cursor.fetchone()[0]
            ch['new_db_id'] = new_id
        
        # Create a map of old_id -> new_id
        id_map = {ch['id']: ch.get('new_db_id') for ch in channels}
        conn.commit()
        print("  - Channels restored.")

        # 2. Restore Videos
        print("Restoring Videos...")
        for v in videos:
            old_channel_id = v['channel_id']
            new_channel_id = id_map.get(old_channel_id)
            
            if not new_channel_id:
                print(f"    - Warning: Skipping video {v['title']} because channel ID {old_channel_id} not found in map.")
                continue

            sql = """
                INSERT INTO "Video" (youtube_video_id, channel_id, title, summary, published_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (youtube_video_id) DO NOTHING
            """
            cursor.execute(sql, (
                v['youtube_video_id'],
                new_channel_id,
                v['title'],
                v['summary'],
                v['published_at']
            ))
        
        conn.commit()
        print("  - Videos restored.")
        conn.close()
        print("Migration complete!")

    except Exception as e:
        print(f"Error restoring data: {e}")
        # print full traceback for debugging
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    restore_data()
