"""
Unit tests for backend/worker/transcribe.py
Specifically for download_and_transcribe_audio (moved from youtube.py in Phase 1)
"""
import pytest
import subprocess
from unittest.mock import patch, MagicMock

from backend.worker.transcribe import download_and_transcribe_audio


class TestDownloadAndTranscribeAudio:
    """Tests for download_and_transcribe_audio function."""

    @patch("backend.worker.transcribe.transcribe_audio_file")
    @patch("backend.worker.transcribe.subprocess.run")
    def test_successful_download_and_transcribe(self, mock_run, mock_transcribe):
        """Test successful audio download and transcription."""
        mock_run.return_value = MagicMock(returncode=0)
        mock_transcribe.return_value = "This is the transcribed text."

        result = download_and_transcribe_audio("video123")

        assert result == "This is the transcribed text."
        mock_run.assert_called_once()
        mock_transcribe.assert_called_once()

        # Verify yt-dlp command arguments
        call_args = mock_run.call_args
        command = call_args[0][0]
        assert command[0] == "yt-dlp"
        assert "--extract-audio" in command
        assert "--audio-format" in command
        assert "mp3" in command

    @patch("backend.worker.transcribe.subprocess.run")
    def test_ytdlp_failure_returns_none(self, mock_run):
        """Test that yt-dlp failure returns None."""
        mock_run.side_effect = subprocess.CalledProcessError(
            returncode=1, cmd="yt-dlp", stderr="Download failed"
        )

        result = download_and_transcribe_audio("video123")

        assert result is None

    @patch("backend.worker.transcribe.transcribe_audio_file")
    @patch("backend.worker.transcribe.subprocess.run")
    def test_transcription_failure_returns_none(self, mock_run, mock_transcribe):
        """Test that transcription failure returns None."""
        mock_run.return_value = MagicMock(returncode=0)
        mock_transcribe.return_value = None

        result = download_and_transcribe_audio("video123")

        assert result is None

    @patch("backend.worker.transcribe.subprocess.run")
    def test_general_exception_returns_none(self, mock_run):
        """Test that general exceptions return None."""
        mock_run.side_effect = Exception("Unexpected error")

        result = download_and_transcribe_audio("video123")

        assert result is None

    @patch("backend.worker.transcribe.transcribe_audio_file")
    @patch("backend.worker.transcribe.subprocess.run")
    def test_uses_low_audio_quality(self, mock_run, mock_transcribe):
        """Test that low audio quality (9) is used for smaller file size."""
        mock_run.return_value = MagicMock(returncode=0)
        mock_transcribe.return_value = "text"

        download_and_transcribe_audio("video123")

        call_args = mock_run.call_args
        command = call_args[0][0]
        # Find --audio-quality and check its value
        quality_idx = command.index("--audio-quality")
        assert command[quality_idx + 1] == "9"

    @patch("backend.worker.transcribe.transcribe_audio_file")
    @patch("backend.worker.transcribe.subprocess.run")
    def test_constructs_correct_youtube_url(self, mock_run, mock_transcribe):
        """Test that correct YouTube URL is constructed."""
        mock_run.return_value = MagicMock(returncode=0)
        mock_transcribe.return_value = "text"

        download_and_transcribe_audio("abc123XYZ")

        call_args = mock_run.call_args
        command = call_args[0][0]
        assert "https://www.youtube.com/watch?v=abc123XYZ" in command
