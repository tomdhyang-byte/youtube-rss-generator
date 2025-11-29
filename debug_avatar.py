import yt_dlp

channel_id = "UCjrP2TtSTifuRJ76hW2IW1A"  # 美股咖啡館
channel_url = f"https://www.youtube.com/channel/{channel_id}"

ydl_opts = {
    'quiet': True,
    'extract_flat': True,
}

print(f"正在使用 yt-dlp 抓取頻道資訊: {channel_id}\n")

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(channel_url, download=False)
    
    print(f"頻道名稱: {info.get('uploader') or info.get('channel')}")
    print(f"\n可用的縮圖:")
    
    thumbnails = info.get('thumbnails', [])
    if thumbnails:
        for thumb in thumbnails:
            print(f"  - {thumb.get('url')} ({thumb.get('width')}x{thumb.get('height') if thumb.get('height') else 'auto'})")
    else:
        print("  沒有找到縮圖")
    
    # 也檢查其他可能的欄位
    if 'avatar_url' in info:
        print(f"\navatar_url: {info['avatar_url']}")
    if 'channel_avatar_url' in info:
        print(f"channel_avatar_url: {info['channel_avatar_url']}")
