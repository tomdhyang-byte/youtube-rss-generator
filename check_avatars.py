import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
clean_url = DATABASE_URL.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')

conn = psycopg2.connect(clean_url, connect_timeout=30)
cursor = conn.cursor(cursor_factory=RealDictCursor)

cursor.execute('SELECT id, title, avatar_url FROM "Channel"')
channels = cursor.fetchall()

print("=== 資料庫中的頻道圖標狀態 ===\n")
for ch in channels:
    status = "✅ 有圖標" if ch['avatar_url'] else "❌ 缺少圖標"
    print(f"{status} | ID: {ch['id']} | {ch['title']}")
    if ch['avatar_url']:
        print(f"        URL: {ch['avatar_url']}")
    print()

conn.close()
