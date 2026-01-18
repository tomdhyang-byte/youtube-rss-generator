# Refactoring Plan: Decompose `backend/worker/youtube.py`

**Date:** 2026-01-18
**Status:** Phase 1, 2 & 3 Complete
**Target Module:** `backend/worker/youtube.py`
**Last Updated:** 2026-01-18 (Integration Test Verified)

---

## Current State Summary

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| `youtube.py` lines | 416 | **197** | ~200 |
| `transcribe.py` lines | 326 | 370 | — |
| `youtube_metadata.py` | — | **184** (new) | — |
| Unit tests | 0 | **28** | — |

**What's Done:**
- [x] Phase 1: `download_and_transcribe_audio` moved to `transcribe.py`
- [x] Phase 2: Metadata service created with 4 functions
- [x] Unit tests created (28 tests, all passing)
- [x] Phase 3: Manual integration test verified

**What Remains:**
- [ ] Phase 4: Future work (out of scope)

---

## 1. Problem Statement

The module `backend/worker/youtube.py` was a "God Module" (~416 lines) handling:
1. **Orchestration**: The main loop processing channels.
2. **Scraping**: Calls to `scrapetube` and handling RSS feeds.
3. **Data Processing**: Parsing timestamps, detecting Shorts.
4. **Audio Logic**: Downloading audio with `yt-dlp` and calling transcription services.
5. **Database Interactions**: CRUD operations for videos and summaries.

This high coupling made it difficult to test components in isolation and increased the risk of regressions.

## 2. Target Architecture

We introduced a Service Layer pattern to separate concerns, while respecting existing module boundaries.

### Directory Structure After Refactoring
```
backend/
  services/
    __init__.py               # [CREATED]
    youtube_metadata.py       # [CREATED] 184 lines
  worker/
    youtube.py                # [MODIFIED] 197 lines (was 416)
    transcribe.py             # [MODIFIED] 370 lines (was 326)
    common.py                 # [UNCHANGED]
tests/
  __init__.py                 # [CREATED]
  test_youtube_metadata.py    # [CREATED] 22 tests
  test_transcribe.py          # [CREATED] 6 tests
```

### Design Decisions
- **No `video_processor.py`**: The existing `common.py` already provides `ensure_missing_summaries()` and `lock_user_styles()`. Adding another processing layer would create redundant abstraction.
- **`download_and_transcribe_audio` → `transcribe.py`**: This function is transcript acquisition logic and belongs with other transcript methods.
- **`podcast.py` symmetry**: This refactoring pattern can be applied to `podcast.py` in a future iteration.

## 3. Component Details

### A. `services/youtube_metadata.py` (NEW)
**Responsibility:** Fetching raw video data from external sources (RSS, Scrapetube) and YouTube-specific utilities.

**Public API:**
```python
from datetime import datetime

def fetch_videos_from_rss(channel_id: str, limit: int = 15) -> list[dict] | None:
    """Fetch videos from YouTube RSS feed with precise timestamps."""
    ...

def fetch_videos_from_scrapetube(channel_id: str, limit: int = 15) -> list[dict]:
    """Fetch videos using scrapetube (fallback with relative time parsing)."""
    ...

def is_short_video(video_id: str) -> bool:
    """Check if a video is a YouTube Short using HTTP redirect method."""
    ...

def parse_relative_time(text: str) -> datetime:
    """Parse relative time strings like '3 days ago' into datetime objects."""
    ...
```

**Imports:**
- Standard library: `datetime`, `timedelta`, `re`, `ssl`, `urllib.request`
- Third-party: `scrapetube`, `feedparser`

### B. `worker/transcribe.py` (MODIFIED)
**New Addition:** `download_and_transcribe_audio` moved from `youtube.py`.

```python
def download_and_transcribe_audio(video_id: str) -> str | None:
    """
    Downloads audio from a YouTube video using yt-dlp and transcribes it using Whisper.
    Used as final fallback when no subtitles are available.
    """
    ...
```

**Added imports:** `subprocess`, `tempfile`

### C. `worker/youtube.py` (MODIFIED - The Orchestrator)
**Responsibility:** High-level loop, subscriber management, and error handling.

**Current Structure:**
```python
from backend.services.youtube_metadata import (
    fetch_videos_from_rss,
    fetch_videos_from_scrapetube
)
from .transcribe import fetch_transcript_with_fallback, download_and_transcribe_audio
from .common import lock_user_styles, ensure_missing_summaries

def process_youtube_channel(conn, channel: dict):
    # 1. Query subscribers and demanded (style, language) combos
    # 2. Fetch videos: RSS first, scrapetube fallback
    # 3. For each video:
    #    a. Check if exists in DB
    #    b. If existing: ensure_missing_summaries(), lock_user_styles()
    #    c. If new: fetch transcript, save to DB, generate summaries, lock styles
    # 4. Cleanup (enforce_video_retention) & update timestamp
```

**Line count:** 197 lines (target was ~200)

## 4. Implementation Steps

### Phase 1: Move Transcript Logic ✅ COMPLETE
1. ✅ **Moved `download_and_transcribe_audio`** to `transcribe.py`
2. ✅ **Updated imports** in `youtube.py`
3. ✅ **Verified:** Import test passed

### Phase 2: Create Metadata Service ✅ COMPLETE
4. ✅ **Created `backend/services/__init__.py`**
5. ✅ **Created `backend/services/youtube_metadata.py`** with:
   - `parse_relative_time`
   - `is_short_video`
   - `fetch_videos_from_rss`
   - `fetch_videos_from_scrapetube`
6. ✅ **Moved imports** to the new module
7. ✅ **Updated `youtube.py`** to import from `backend.services.youtube_metadata`
8. ✅ **Verified:** Import test passed

### Phase 3: Cleanup & Testing ✅ COMPLETE
9. ✅ **Removed dead imports** from `youtube.py`
10. ✅ **Added unit tests** (see Section 8 below)
11. ✅ **Manual integration test:** Ran `./backend/run_worker.sh` - verified RSS fetching, Shorts filtering, and scrapetube fallback all working correctly

### Phase 4: Future Work (Out of Scope)
- Apply similar refactoring to `podcast.py` if needed.
- Consider adding caching to `is_short_video()` to avoid repeated HTTP checks.

## 5. Dependencies
- No new external libraries required.
- `pytest` added as dev dependency for testing.
- Existing dependencies reorganized:
  - `scrapetube`, `feedparser` → `services/youtube_metadata.py`
  - `subprocess`, `tempfile` → `worker/transcribe.py`

## 6. Rollback Plan
If issues arise:
1. Revert to the commit before refactoring.
2. All changes are internal reorganization; no API or database schema changes.

## 7. Success Criteria

- [x] `youtube.py` reduced to ~200 lines (actual: 197)
- [x] `download_and_transcribe_audio` lives in `transcribe.py`
- [x] All 4 metadata functions live in `services/youtube_metadata.py`
- [x] Worker processes videos correctly (integration test passed)
- [x] Unit tests pass for `parse_relative_time`

## 8. Test Suite

**Location:** `tests/`

**Run tests:** `python -m pytest tests/ -v`

### Test Coverage

| File | Class | Tests | Description |
|------|-------|-------|-------------|
| `test_youtube_metadata.py` | `TestParseRelativeTime` | 12 | Empty/None input, all time units, case insensitivity, unparseable strings |
| `test_youtube_metadata.py` | `TestIsShortVideo` | 3 | Shorts detection, regular video, error handling |
| `test_youtube_metadata.py` | `TestFetchVideosFromRss` | 4 | Success, empty feed, network error, Shorts filtering |
| `test_youtube_metadata.py` | `TestFetchVideosFromScrapetube` | 3 | Success, empty channel, content_type parameter |
| `test_transcribe.py` | `TestDownloadAndTranscribeAudio` | 6 | Success, yt-dlp failure, transcription failure, URL construction |

**Total: 28 tests, all passing**

---

## Handover Notes

1. **Status:** ✅ Refactoring complete. Integration test verified on 2026-01-18. The worker successfully processes YouTube channels with the refactored code.

2. **Key files changed:**
   - `backend/worker/youtube.py` - Now 197 lines, imports from new service
   - `backend/worker/transcribe.py` - Added `download_and_transcribe_audio`
   - `backend/services/youtube_metadata.py` - New file with 4 functions
   - `tests/` - New test suite

3. **Import verification:** Run this to confirm imports work:
   ```bash
   python -c "from backend.services.youtube_metadata import fetch_videos_from_rss; from backend.worker.youtube import process_youtube_channel; print('OK')"
   ```

4. **Test verification:** Run `python -m pytest tests/ -v` (requires `pip install pytest`)
