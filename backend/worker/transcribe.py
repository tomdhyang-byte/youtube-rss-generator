"""
Transcription Module
Handles fetching transcripts from Supadata (YouTube) and Deepgram (Podcasts).
"""
import requests
from .config import SUPADATA_API_KEY, DEEPGRAM_API_KEY


def fetch_supadata_transcript(video_id: str) -> str | None:
    """
    Fetch YouTube video transcript using Supadata API.
    Returns the transcript text or None if unavailable.
    """
    if not SUPADATA_API_KEY:
        print("  - Supadata API Key missing.")
        return None

    url = f"https://api.supadata.ai/v1/youtube/transcript?videoId={video_id}&text=true"
    headers = {"x-api-key": SUPADATA_API_KEY}

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, dict) and 'content' in data:
            return data['content']
        elif isinstance(data, str):
            return data
        else:
            return str(data)

    except Exception as e:
        print(f"  - Supadata Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"    Status Code: {e.response.status_code}")
            print(f"    Response: {e.response.text}")
        return None


def transcribe_audio(audio_url: str) -> str | None:
    """
    Transcribe podcast audio using Deepgram API.
    Returns the transcript text or None if unavailable.
    """
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
        response = requests.post(url, headers=headers, json=data, timeout=600)  # 10 min timeout
        response.raise_for_status()
        result = response.json()
        
        # Extract transcript
        transcript = result.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', '')
        return transcript
    except Exception as e:
        print(f"    - Deepgram Error: {e}")
        return None
