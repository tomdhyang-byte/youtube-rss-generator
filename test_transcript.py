from youtube_transcript_api import YouTubeTranscriptApi

try:
    api = YouTubeTranscriptApi()
    # Try with a known video ID (Veritasium video from seed)
    video_id = 'rHe539j1YUk' # "This graph will change how you see the world"
    
    print(f"Fetching transcript for {video_id}...")
    # Try fetch directly
    transcript = api.fetch(video_id)
    print("Type of transcript:", type(transcript))
    print("First item:", transcript[0] if transcript else "Empty")
    
except Exception as e:
    print(f"Error: {e}")
