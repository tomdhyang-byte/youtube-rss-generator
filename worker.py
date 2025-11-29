import psycopg2
from psycopg2.extras import RealDictCursor
import os
import time
import random
from datetime import datetime
import scrapetube
from youtube_transcript_api import YouTubeTranscriptApi
from openai import OpenAI
from dotenv import load_dotenv
import yt_dlp

# Load environment variables
load_dotenv()

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables. Summaries will be mocked or skipped.")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    # Remove pgbouncer param for psycopg2
    clean_url = DATABASE_URL.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')
    conn = psycopg2.connect(clean_url, connect_timeout=30)
    return conn

def fetch_channel_avatar(youtube_id):
    """Fetch channel avatar URL using yt-dlp"""
    try:
        channel_url = f"https://www.youtube.com/channel/{youtube_id}"
        ydl_opts = {
            'quiet': True,
            'extract_flat': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            thumbnails = info.get('thumbnails', [])
            
            # Find the best square avatar (usually 900x900)
            for thumb in reversed(thumbnails):  # Start from highest quality
                if thumb.get('width') == thumb.get('height'):  # Square thumbnail
                    return thumb.get('url')
            
            # Fallback to last thumbnail if no square found
            if thumbnails:
                return thumbnails[-1].get('url')
        
        return None
    except Exception as e:
        print(f"    - Error fetching channel avatar: {e}")
        return None

def fetch_transcript(video_id):
    try:
        # Instantiate the API
        api = YouTubeTranscriptApi()
        # Use fetch with language priority: Chinese (Traditional, Simplified, Generic) then English
        transcript_list = api.fetch(video_id, languages=['zh-TW', 'zh-Hant', 'zh-Hans', 'zh', 'en'])
        # Combine text
        full_text = " ".join([t.text for t in transcript_list])
        return full_text
    except Exception as e:
        print(f"  - No transcript found or error: {e}")
        return None

def generate_summary(text):
    if not client:
        return "Summary not available (Missing OpenAI Key)."
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o", # Upgraded to gpt-4o for better quality
            messages=[
                {"role": "system", "content": """你是一位資深的繁體中文內容分析師。請針對這段影片字幕進行「深度摘要」。
    
目標：你的讀者是忙碌的專業人士，他們希望「不用看影片」也能掌握 90% 的精華細節。
原則：不要只寫流水帳，要提取洞察 (Insights)，並保留具體的例子或數據。
請嚴格遵守以下 HTML 格式回傳（因為要嵌入 RSS，請勿使用 Markdown）：

    <p><b>🎯 核心主旨 (Executive Summary)：</b><br>
    (請用一段約 100-150 字的完整段落，清楚說明這部影片在解決什麼問題，以及講者的核心立場。)</p>

    <h3>🔑 關鍵洞察與細節：</h3>
    <ul>
        <li><b>重點 1 - (請自擬小標題)：</b>(請詳細解釋這個觀點，包含講者的邏輯推演、提到的案例或數據支持。不要只有一句話。)</li>
        <li><b>重點 2 - (請自擬小標題)：</b>(同上，請深入挖掘細節。)</li>
        <li><b>重點 3 - (請自擬小標題)：</b>(同上，請深入挖掘細節。)</li>
        <li><b>重點 4 - (請自擬小標題)：</b>(如果有更多重點，請繼續列出，不限於 3 點。)</li>
    </ul>

    <h3>💡 結論或行動建議：</h3>
    <p>(講者最後給出的建議、對未來的預測，或是你歸納出的具體行動方案。)</p>"""},
                {"role": "user", "content": f"影片字幕內容如下：\n\n{text[:15000]}"} 
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"  - OpenAI API Error: {e}")
        return "Summary generation failed."

def process_channel(conn, channel):
    channel_id = channel['id']
    youtube_id = channel['youtube_id']
    channel_title = channel['title']
    
    print(f"Processing Channel: {channel_title} ({youtube_id})")
    
    # Update Channel Metadata if needed (if it was added via Vercel with placeholder)
    if channel_title == 'New Channel' or channel['description'] == 'Waiting for worker to update...' or not channel.get('avatar_url'):
        print("  - Updating channel metadata...")
        try:
            # We can use scrapetube to get some info, or just rely on the videos.
            # Actually, scrapetube doesn't give channel description easily.
            # But we can assume if we fetch videos, we might get the author name from the first video found.
            pass # We will update title and avatar from the first video found
        except Exception as e:
            print(f"  - Failed to update metadata: {e}")

    # Fetch latest videos (limit to last 5 to avoid quota/time issues on first run)
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
        
        # Update Channel Title and Avatar from video if needed
        if first_video:
             updated_fields = {}
             
             # Extract title if it's a placeholder
             if channel_title == 'New Channel':
                 # Try to get channel name from video details
                 # scrapetube video object usually has 'ownerText' or similar in 'shortBylineText'
                 try:
                     new_title = video.get('ownerText', {}).get('runs', [{}])[0].get('text')
                     if not new_title:
                         # Fallback to looking deeper if structure varies
                         new_title = video.get('shortBylineText', {}).get('runs', [{}])[0].get('text')
                     
                     if new_title:
                         print(f"    - Found real channel title: {new_title}")
                         updated_fields['title'] = new_title
                         channel_title = new_title # Update local var
                 except Exception as e:
                     print(f"    - Could not extract channel title from video: {e}")
             
             # Extract avatar URL using yt-dlp
             if not channel.get('avatar_url'):
                 print("    - Fetching channel avatar using yt-dlp...")
                 avatar_url = fetch_channel_avatar(youtube_id)
                 if avatar_url:
                     print(f"    - Found channel avatar: {avatar_url[:80]}...")
                     updated_fields['avatar_url'] = avatar_url
                 else:
                     print("    - Could not fetch channel avatar")
             
             # Update database if we have any fields to update
             if updated_fields:
                 cursor = conn.cursor()
                 set_parts = []
                 values = []
                 for key, value in updated_fields.items():
                     set_parts.append(f"{key} = %s")
                     values.append(value)
                 
                 if not updated_fields.get('title'):
                     # Also update description if we didn't update title
                     set_parts.append("description = %s")
                     values.append("Updated by worker")
                 
                 values.append(channel_id)
                 query = f"UPDATE \"Channel\" SET {', '.join(set_parts)} WHERE id = %s"
                 cursor.execute(query, values)
                 conn.commit()
        first_video = False
        
        # Check if exists
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id FROM \"Video\" WHERE youtube_video_id = %s", (video_id,))
        if cursor.fetchone():
            print(f"    - Video already exists, skipping.")
            continue
            
        print(f"    - New Video found: {title}")
        
        # Get Transcript
        print("    - Fetching transcript...")
        transcript = fetch_transcript(video_id)
        summary = "No transcript available."
        
        if transcript:
            print("    - Transcript fetched. Generating summary (calling OpenAI)...")
            summary = generate_summary(transcript)
            print("    - Summary generated.")
        
        # Parse published time
        # For Postgres, we can store as TIMESTAMP (datetime object) or keep using milliseconds/ISO if schema allows.
        # Prisma schema says `DateTime`. Prisma usually maps this to `timestamp(3)` in Postgres.
        # It expects a valid timestamp format.
        # Let's use a proper datetime object for psycopg2, it handles it well.
        published_at = datetime.now()

        cursor.execute(
            "INSERT INTO \"Video\" (youtube_video_id, channel_id, title, summary, published_at) VALUES (%s, %s, %s, %s, %s)",
            (video_id, channel_id, title, summary, published_at)
        )
        conn.commit()
        conn.commit()
        print("    - Saved to DB.")
        
        # Polite delay to avoid IP blocks - random 5-10 seconds with jitter
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    # Update channel last_updated
    cursor = conn.cursor()
    cursor.execute("UPDATE \"Channel\" SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()

def main():
    print("Starting Worker...")
    print("Connecting to database...")
    conn = get_db_connection()
    print("Database connected.")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM \"Channel\"")
        channels = cursor.fetchall()
        
        for channel in channels:
            process_channel(conn, channel)
            
    except Exception as e:
        print(f"Worker Error: {e}")
    finally:
        conn.close()
    print("Worker Finished.")

if __name__ == "__main__":
    main()
