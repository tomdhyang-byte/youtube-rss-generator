"""
Unit tests for backend/services/youtube_metadata.py
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from backend.services.youtube_metadata import (
    parse_relative_time,
    is_short_video,
    fetch_videos_from_rss,
    fetch_videos_from_scrapetube,
)


class TestParseRelativeTime:
    """Tests for parse_relative_time function."""

    def test_empty_string_returns_now(self):
        result = parse_relative_time("")
        assert abs((result - datetime.now()).total_seconds()) < 1

    def test_none_returns_now(self):
        result = parse_relative_time(None)
        assert abs((result - datetime.now()).total_seconds()) < 1

    def test_seconds_ago(self):
        result = parse_relative_time("30 seconds ago")
        expected = datetime.now() - timedelta(seconds=30)
        assert abs((result - expected).total_seconds()) < 1

    def test_minutes_ago(self):
        result = parse_relative_time("5 minutes ago")
        expected = datetime.now() - timedelta(minutes=5)
        assert abs((result - expected).total_seconds()) < 1

    def test_hours_ago(self):
        result = parse_relative_time("2 hours ago")
        expected = datetime.now() - timedelta(hours=2)
        assert abs((result - expected).total_seconds()) < 1

    def test_days_ago(self):
        result = parse_relative_time("3 days ago")
        expected = datetime.now() - timedelta(days=3)
        assert abs((result - expected).total_seconds()) < 60

    def test_weeks_ago(self):
        result = parse_relative_time("2 weeks ago")
        expected = datetime.now() - timedelta(weeks=2)
        assert abs((result - expected).total_seconds()) < 60

    def test_months_ago(self):
        result = parse_relative_time("3 months ago")
        expected = datetime.now() - timedelta(days=90)  # 3 * 30
        assert abs((result - expected).total_seconds()) < 60

    def test_years_ago(self):
        result = parse_relative_time("1 year ago")
        expected = datetime.now() - timedelta(days=365)
        assert abs((result - expected).total_seconds()) < 60

    def test_case_insensitive(self):
        result1 = parse_relative_time("3 DAYS AGO")
        result2 = parse_relative_time("3 days ago")
        assert abs((result1 - result2).total_seconds()) < 1

    def test_singular_unit(self):
        result = parse_relative_time("1 day ago")
        expected = datetime.now() - timedelta(days=1)
        assert abs((result - expected).total_seconds()) < 60

    def test_unparseable_returns_now(self):
        result = parse_relative_time("streamed live")
        assert abs((result - datetime.now()).total_seconds()) < 1


class TestIsShortVideo:
    """Tests for is_short_video function."""

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    def test_short_video_returns_true(self, mock_urlopen):
        """When URL stays on /shorts/, it's a Short."""
        mock_response = MagicMock()
        mock_response.geturl.return_value = "https://www.youtube.com/shorts/abc123"
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = is_short_video("abc123")
        assert result is True

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    def test_regular_video_returns_false(self, mock_urlopen):
        """When URL redirects to /watch, it's a regular video."""
        mock_response = MagicMock()
        mock_response.geturl.return_value = "https://www.youtube.com/watch?v=abc123"
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = is_short_video("abc123")
        assert result is False

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    def test_exception_returns_false(self, mock_urlopen):
        """When request fails, assume regular video."""
        mock_urlopen.side_effect = Exception("Network error")

        result = is_short_video("abc123")
        assert result is False


class TestFetchVideosFromRss:
    """Tests for fetch_videos_from_rss function."""

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    @patch("backend.services.youtube_metadata.is_short_video")
    def test_successful_fetch(self, mock_is_short, mock_urlopen):
        """Test successful RSS fetch with valid entries."""
        mock_is_short.return_value = False

        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
            <entry>
                <yt:videoId>video123</yt:videoId>
                <title>Test Video</title>
                <published>2024-01-15T10:00:00+00:00</published>
            </entry>
        </feed>"""

        mock_response = MagicMock()
        mock_response.read.return_value = rss_content.encode("utf-8")
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = fetch_videos_from_rss("UC123", limit=5)

        assert result is not None
        assert len(result) == 1
        assert result[0]["video_id"] == "video123"
        assert result[0]["title"] == "Test Video"

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    def test_empty_feed_returns_none(self, mock_urlopen):
        """Test empty RSS feed returns None."""
        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
        </feed>"""

        mock_response = MagicMock()
        mock_response.read.return_value = rss_content.encode("utf-8")
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = fetch_videos_from_rss("UC123")
        assert result is None

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    def test_network_error_returns_none(self, mock_urlopen):
        """Test network error returns None."""
        mock_urlopen.side_effect = Exception("Network error")

        result = fetch_videos_from_rss("UC123")
        assert result is None

    @patch("backend.services.youtube_metadata.urllib.request.urlopen")
    @patch("backend.services.youtube_metadata.is_short_video")
    def test_shorts_are_filtered(self, mock_is_short, mock_urlopen):
        """Test that Shorts are filtered out."""
        mock_is_short.return_value = True  # All videos are Shorts

        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
            <entry>
                <yt:videoId>short123</yt:videoId>
                <title>Short Video</title>
                <published>2024-01-15T10:00:00+00:00</published>
            </entry>
        </feed>"""

        mock_response = MagicMock()
        mock_response.read.return_value = rss_content.encode("utf-8")
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = fetch_videos_from_rss("UC123")
        assert result is None  # All filtered out


class TestFetchVideosFromScrapetube:
    """Tests for fetch_videos_from_scrapetube function."""

    @patch("backend.services.youtube_metadata.scrapetube.get_channel")
    def test_successful_fetch(self, mock_get_channel):
        """Test successful scrapetube fetch."""
        mock_get_channel.return_value = [
            {
                "videoId": "video123",
                "title": {"runs": [{"text": "Test Video"}]},
                "publishedTimeText": {"simpleText": "3 days ago"},
            }
        ]

        result = fetch_videos_from_scrapetube("UC123", limit=5)

        assert len(result) == 1
        assert result[0]["video_id"] == "video123"
        assert result[0]["title"] == "Test Video"
        assert "published_at" in result[0]
        assert "raw_video" in result[0]

    @patch("backend.services.youtube_metadata.scrapetube.get_channel")
    def test_empty_channel_returns_empty_list(self, mock_get_channel):
        """Test empty channel returns empty list."""
        mock_get_channel.return_value = []

        result = fetch_videos_from_scrapetube("UC123")
        assert result == []

    @patch("backend.services.youtube_metadata.scrapetube.get_channel")
    def test_uses_correct_content_type(self, mock_get_channel):
        """Test that content_type='videos' is passed to exclude Shorts."""
        mock_get_channel.return_value = []

        fetch_videos_from_scrapetube("UC123", limit=10)

        mock_get_channel.assert_called_once_with(
            channel_id="UC123", limit=10, content_type="videos"
        )
