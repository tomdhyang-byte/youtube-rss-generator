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
import feedparser
import requests
from dateutil import parser as date_parser

# Load environment variables
load_dotenv()

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables. Summaries will be mocked or skipped.")

if not DEEPGRAM_API_KEY:
    print("Warning: DEEPGRAM_API_KEY not found in environment variables. Transcriptions will be skipped.")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    # Remove pgbouncer param for psycopg2
    clean_url = DATABASE_URL.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')
    conn = psycopg2.connect(clean_url, connect_timeout=30)
    return conn

# --- YouTube Logic ---

def fetch_youtube_transcript(video_id):
    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.fetch(video_id, languages=['zh-TW', 'zh-Hant', 'zh-Hans', 'zh', 'en'])
        full_text = " ".join([t.text for t in transcript_list])
        return full_text
    except Exception as e:
        print(f"  - No YouTube transcript found or error: {e}")
        return None

def generate_summary(text, is_podcast=False):
    if not client:
        return "Summary not available (Missing OpenAI Key)."
    
    system_prompt = """你是一位資深的繁體中文內容分析師。請針對這段影片字幕進行「深度摘要」。
    
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
    <p>(講者最後給出的建議、對未來的預測，或是你歸納出的具體行動方案。)</p>"""

    if is_podcast:
        system_prompt = """你是一位資深的 Podcast 內容分析師。請針對這段 Podcast 逐字稿進行「深度摘要」。

目標：你的讀者是忙碌的聽眾，他們希望「不用聽完全集」也能掌握 90% 的精華細節。
原則：
1. **強調來賓觀點**：明確指出是哪位來賓說的，以及他的核心論點。
2. **關鍵時間點**：如果逐字稿有時間標記，請盡量提及關鍵話題發生的順序。
3. **提取洞察 (Insights)**：不要只寫流水帳，要保留具體的例子、數據或故事。

請嚴格遵守以下 HTML 格式回傳（因為要嵌入 RSS，請勿使用 Markdown）：

    <p><b>🎙️ 節目核心 (Executive Summary)：</b><br>
    (請用一段約 100-150 字的完整段落，清楚說明本集主題、來賓背景，以及討論的核心問題。)</p>

    <h3>🔑 精彩觀點與對話摘要：</h3>
    <ul>
        <li><b>話題 1 - (請自擬小標題)：</b>(請詳細解釋這個觀點，包含來賓的獨特見解、邏輯推演或提到的案例。不要只有一句話。)</li>
        <li><b>話題 2 - (請自擬小標題)：</b>(同上，請深入挖掘細節。)</li>
        <li><b>話題 3 - (請自擬小標題)：</b>(同上，請深入挖掘細節。)</li>
        <li><b>話題 4 - (請自擬小標題)：</b>(如果有更多重點，請繼續列出，不限於 3 點。)</li>
    </ul>

    <h3>💡 總結與反思：</h3>
    <p>(主持人或來賓最後的總結、對未來的展望，或是你歸納出的聽眾行動建議。)</p>"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini", # Using gpt-4o-mini as requested for Podcast, keeping cost low
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"內容如下：\n\n{text[:15000]}"} 
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"  - OpenAI API Error: {e}")
        return "Summary generation failed."

def process_youtube_channel(conn, channel):
    channel_id = channel['id']
    youtube_id = channel['youtube_id']
    channel_title = channel['title']
    
    print(f"Processing YouTube Channel: {channel_title} ({youtube_id})")
    
    # Update Channel Metadata if needed
    if channel_title == 'New Channel' or channel['description'] == 'Waiting for worker to update...':
        pass 

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
        
        if first_video and (channel_title == 'New Channel'):
             try:
                 new_title = video.get('ownerText', {}).get('runs', [{}])[0].get('text')
                 if not new_title:
                     new_title = video.get('shortBylineText', {}).get('runs', [{}])[0].get('text')
                 
                 if new_title:
                     print(f"    - Found real channel title: {new_title}")
                     cursor = conn.cursor()
                     cursor.execute("UPDATE \"Channel\" SET title = %s, description = %s WHERE id = %s", 
                                  (new_title, "Updated by worker", channel_id))
                     conn.commit()
                     channel_title = new_title 
             except Exception as e:
                 print(f"    - Could not extract channel title from video: {e}")
        first_video = False
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id FROM \"Video\" WHERE youtube_video_id = %s", (video_id,))
        if cursor.fetchone():
            print(f"    - Video already exists, skipping.")
            continue
            
        print(f"    - New Video found: {title}")
        
        print("    - Fetching transcript...")
        transcript = fetch_youtube_transcript(video_id)
        summary = "No transcript available."
        
        if transcript:
            print("    - Transcript fetched. Generating summary...")
            summary = generate_summary(transcript, is_podcast=False)
            print("    - Summary generated.")
        
        published_at = datetime.now()

        cursor.execute(
            "INSERT INTO \"Video\" (youtube_video_id, channel_id, title, summary, published_at) VALUES (%s, %s, %s, %s, %s)",
            (video_id, channel_id, title, summary, published_at)
        )
        conn.commit()
        print("    - Saved to DB.")
        
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    cursor = conn.cursor()
    cursor.execute("UPDATE \"Channel\" SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()

# --- Podcast Logic ---

def transcribe_audio(audio_url):
    if not DEEPGRAM_API_KEY:
        return None
    
    url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true"
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {"url": audio_url}
    
    try:
        print(f"    - Calling Deepgram for: {audio_url}")
        response = requests.post(url, headers=headers, json=data, timeout=300) # 5 min timeout for long audio
        response.raise_for_status()
        result = response.json()
        
        # Extract transcript
        transcript = result.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', '')
        return transcript
    except Exception as e:
        print(f"    - Deepgram Error: {e}")
        return None

def process_podcast_channel(conn, podcast):
    podcast_id = podcast['id']
    feed_url = podcast['feed_url']
    podcast_title = podcast['title'] or "Unknown Podcast"
    
    print(f"Processing Podcast: {podcast_title} ({feed_url})")
    
    try:
        response = requests.get(feed_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except Exception as e:
        print(f"  - Error parsing RSS: {e}")
        return

    # Update podcast metadata if missing
    if not podcast['title'] and feed.feed.get('title'):
        new_title = feed.feed.get('title')
        new_desc = feed.feed.get('description', '')
        new_site = feed.feed.get('link', '')
        new_image = feed.feed.get('image', {}).get('href', '')
        
        print(f"  - Updating podcast metadata: {new_title}")
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE "PodcastChannel" 
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
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id FROM \"PodcastEpisode\" WHERE podcast_id = %s AND guid = %s", (podcast_id, guid))
        if cursor.fetchone():
            print(f"    - Episode already exists, skipping.")
            continue
            
        print(f"    - New Episode found: {title}")
        
        # Transcribe
        print("    - Transcribing audio...")
        transcript = transcribe_audio(audio_url)
        summary = "No transcript available."
        
        if transcript:
            print(f"    - Transcript fetched ({len(transcript)} chars).")
            
            # Truncate if too long
            if len(transcript) > 100000:
                print("    - Transcript too long, truncating...")
                transcript = transcript[:100000] + "...(truncated)"
            
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
            """INSERT INTO "PodcastEpisode" 
               (podcast_id, guid, title, audio_url, transcript, summary, published_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (podcast_id, guid, title, audio_url, transcript, summary, published_at)
        )
        conn.commit()
        print("    - Saved to DB.")
        
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next episode...")
        time.sleep(delay)

    cursor = conn.cursor()
    cursor.execute("UPDATE \"PodcastChannel\" SET last_updated = %s WHERE id = %s", (datetime.now(), podcast_id))
    conn.commit()

def main():
    print("Starting Worker...")
    print("Connecting to database...")
    conn = get_db_connection()
    print("Database connected.")
    
    try:
        # 1. Process YouTube Channels
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM \"Channel\"")
        channels = cursor.fetchall()
        for channel in channels:
            process_youtube_channel(conn, channel)
            
        # 2. Process Podcast Channels
        cursor.execute("SELECT * FROM \"PodcastChannel\"")
        podcasts = cursor.fetchall()
        for podcast in podcasts:
            process_podcast_channel(conn, podcast)
            
    except Exception as e:
        print(f"Worker Error: {e}")
    finally:
        conn.close()
    print("Worker Finished.")

if __name__ == "__main__":
    main()
