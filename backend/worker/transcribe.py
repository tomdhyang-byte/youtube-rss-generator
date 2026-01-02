"""
Transcription Module
Handles fetching transcripts from multiple sources:
1. Free youtube-transcript-api (with quota management)
2. Supadata (paid, YouTube)
3. Deepgram (for podcasts and YouTube fallback when no subtitles)
"""
import os
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path

from .config import (
    SUPADATA_API_KEY, 
    DEEPGRAM_API_KEY,
    FREE_API_DAILY_LIMIT,
    FREE_API_COOLDOWN_MINUTES
)


# ============================================================
# Free API Quota Manager
# ============================================================

class FreeApiQuotaManager:
    """
    Manages daily quota and cooldown for free youtube-transcript-api.
    State is persisted to a JSON file to survive worker restarts.
    """
    
    def __init__(self):
        self.state_file = Path(__file__).parent / "free_api_state.json"
        self.state = self._load_state()
    
    def _load_state(self) -> dict:
        """Load state from file, or return fresh state if file doesn't exist."""
        today = datetime.now().strftime("%Y-%m-%d")
        default_state = {
            "date": today,
            "usage_count": 0,
            "last_used_at": None,
            "is_blocked": False
        }
        
        if not self.state_file.exists():
            return default_state
        
        try:
            with open(self.state_file, 'r') as f:
                state = json.load(f)
            
            # Reset if it's a new day
            if state.get("date") != today:
                return default_state
            
            return state
        except Exception:
            return default_state
    
    def _save_state(self):
        """Save current state to file."""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            print(f"    - Warning: Could not save free API state: {e}")
    
    def can_use(self) -> bool:
        """Check if we can use the free API (quota + cooldown + not blocked)."""
        # Reload state in case it was updated by another process
        self.state = self._load_state()
        
        # Check if blocked (failed today)
        if self.state.get("is_blocked"):
            return False
        
        # Check daily quota
        if self.state.get("usage_count", 0) >= FREE_API_DAILY_LIMIT:
            return False
        
        # Check cooldown
        last_used = self.state.get("last_used_at")
        if last_used:
            last_used_dt = datetime.fromisoformat(last_used)
            cooldown_end = last_used_dt + timedelta(minutes=FREE_API_COOLDOWN_MINUTES)
            if datetime.now() < cooldown_end:
                return False
        
        return True
    
    def record_usage(self):
        """Record a successful usage of the free API."""
        self.state["usage_count"] = self.state.get("usage_count", 0) + 1
        self.state["last_used_at"] = datetime.now().isoformat()
        self._save_state()
    
    def record_failure(self):
        """Record a failure - block for the rest of the day."""
        self.state["is_blocked"] = True
        self._save_state()


# Global instance
_quota_manager = FreeApiQuotaManager()


# ============================================================
# Transcript Fetching Functions
# ============================================================

def fetch_free_transcript(video_id: str) -> str | None:
    """
    Fetch YouTube transcript using free youtube-transcript-api.
    This may be blocked by YouTube if used too frequently.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        
        # New API requires instantiation
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        
        # Try to find transcript in preferred languages
        transcript = None
        preferred_langs = ['zh-TW', 'zh-Hant', 'zh', 'en', 'ja']
        
        for lang in preferred_langs:
            try:
                transcript = transcript_list.find_transcript([lang])
                break
            except Exception:
                continue
        
        # If no preferred language found, get first available
        if not transcript:
            for t in transcript_list:
                transcript = t
                break
        
        if not transcript:
            return None
        
        # Fetch and join the transcript text
        # New API uses .text attribute instead of dict
        transcript_data = transcript.fetch()
        text = ' '.join([entry.text for entry in transcript_data])
        return text
        
    except Exception as e:
        error_str = str(e).lower()
        if 'disabled' in error_str or 'no transcript' in error_str or 'could not retrieve' in error_str:
            # No transcript available - not a rate limit issue
            return None
        # Other errors might be rate limiting
        print(f"    - Free API error (may be rate limited): {e}")
        return None


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
        
        # Check for error response from Supadata
        if isinstance(data, dict):
            # Error response: {'error': 'transcript-unavailable', ...}
            if 'error' in data:
                print(f"    - Supadata returned error: {data.get('error')} - {data.get('message', '')}")
                return None
            
            # Success response: {'content': '...'}
            if 'content' in data:
                content = data['content']
                # Validate content is a non-empty string
                if isinstance(content, str) and content.strip():
                    return content
                print("    - Supadata returned empty content")
                return None
        
        # Handle direct string response (rare but possible)
        if isinstance(data, str) and data.strip():
            return data
        
        # Unknown format - log and return None
        print(f"    - Supadata returned unexpected format: {type(data)}")
        return None

    except Exception as e:
        print(f"  - Supadata Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"    Status Code: {e.response.status_code}")
            print(f"    Response: {e.response.text}")
        return None


def fetch_transcript_with_fallback(video_id: str) -> tuple[str | None, str]:
    """
    Fetch transcript using multi-tier fallback:
    1. Free youtube-transcript-api (if quota allows)
    2. Supadata (paid)
    3. Returns (None, source) if both fail - caller should try Deepgram
    
    Returns:
        tuple: (transcript_text, source_name)
        source_name is one of: "free_api", "supadata", "none"
    """
    # Tier 1: Try free API if quota allows
    if _quota_manager.can_use():
        print("    - Trying free youtube-transcript-api...")
        transcript = fetch_free_transcript(video_id)
        
        if transcript:
            _quota_manager.record_usage()
            print("    - ✅ Got transcript from free API")
            return transcript, "free_api"
        else:
            # Could be no transcript OR rate limited
            # We don't block here, just fall through to Supadata
            print("    - Free API returned nothing, trying Supadata...")
    else:
        print("    - Free API quota exhausted or in cooldown, using Supadata...")
    
    # Tier 2: Supadata
    transcript = fetch_supadata_transcript(video_id)
    if transcript:
        print("    - ✅ Got transcript from Supadata")
        return transcript, "supadata"
    
    # Both failed - caller should try Deepgram
    return None, "none"


# ============================================================
# Audio Transcription (Deepgram)
# ============================================================

def transcribe_audio(audio_url: str) -> str | None:
    """
    Transcribe podcast audio using Deepgram API (URL-based).
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


def transcribe_audio_file(file_path: str) -> str | None:
    """
    Transcribe audio file using Deepgram API (file upload).
    Used for YouTube videos without subtitles.
    Returns the transcript text or None if unavailable.
    """
    if not DEEPGRAM_API_KEY:
        print("    - Deepgram API Key missing.")
        return None
    
    if not os.path.exists(file_path):
        print(f"    - Audio file not found: {file_path}")
        return None
    
    url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true"
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "audio/mpeg"  # Works for mp3
    }
    
    try:
        file_size = os.path.getsize(file_path)
        print(f"    - Uploading audio to Deepgram: {file_path} ({file_size / 1024 / 1024:.2f} MB)")
        
        with open(file_path, 'rb') as audio_file:
            response = requests.post(url, headers=headers, data=audio_file, timeout=600)
        
        print(f"    - Deepgram response status: {response.status_code}")
        response.raise_for_status()
        result = response.json()
        
        # Extract transcript
        transcript = result.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', '')
        
        if transcript:
            print(f"    - ✅ Deepgram transcription successful ({len(transcript)} chars)")
        else:
            print(f"    - ⚠️ Deepgram returned empty transcript")
            print(f"    - Deepgram raw response: {json.dumps(result, ensure_ascii=False)[:500]}...")
        
        return transcript if transcript else None
    except Exception as e:
        print(f"    - Deepgram file upload error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"    - Response status: {e.response.status_code}")
            print(f"    - Response body: {e.response.text[:500]}")
        return None

