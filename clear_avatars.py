import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
clean_url = DATABASE_URL.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')

conn = psycopg2.connect(clean_url, connect_timeout=30)
cursor = conn.cursor()

print("清空所有頻道的 avatar_url...\n")
cursor.execute('UPDATE "Channel" SET avatar_url = NULL')
conn.commit()

print("✓ 所有頻道的 avatar_url 已清空，可以重新抓取了")

conn.close()
