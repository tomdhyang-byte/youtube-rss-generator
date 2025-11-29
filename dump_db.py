import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import datetime

# Custom JSON encoder for datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super(DateTimeEncoder, self).default(obj)

def dump_data():
    load_dotenv()
    url = os.getenv('DATABASE_URL')
    if not url:
        print("Error: DATABASE_URL not found.")
        return

    print(f"Using URL: {url.split('@')[-1] if '@' in url else '...'}")

    try:
        print("  - Calling psycopg2.connect...")
        conn = psycopg2.connect(url, connect_timeout=5)
        print("  - Connected!")
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Dump Channels
        print("Fetching Channels...")
        cursor.execute('SELECT * FROM "Channel"')
        channels = cursor.fetchall()
        print(f"  - Found {len(channels)} channels.")

        # 2. Dump Videos
        print("Fetching Videos...")
        cursor.execute('SELECT * FROM "Video"')
        videos = cursor.fetchall()
        print(f"  - Found {len(videos)} videos.")

        data = {
            "channels": channels,
            "videos": videos
        }

        with open('db_backup.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)
        
        print("Success! Data backed up to 'db_backup.json'.")
        conn.close()

    except Exception as e:
        print(f"Error dumping data: {e}")

if __name__ == "__main__":
    dump_data()
