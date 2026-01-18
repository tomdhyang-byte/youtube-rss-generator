"""
Single Episode Processing Module
Handles processing individual YouTube videos or Podcast episodes for the single episode feature.

This module:
1. Fetches metadata for single videos/episodes
2. Transcribes audio
3. Generates summaries with user-specified style/language
4. Updates UserSingleEpisode status throughout the process
"""
import logging
from datetime import datetime

from .db import get_db_connection
from .transcribe import fetch_transcript_with_fallback, download_and_transcribe_audio, transcribe_audio
from .summarize import generate_summary

logger = logging.getLogger("single")


# Error codes for permanent failures (no retry)
PERMANENT_ERRORS = {
    'NO_TRANSCRIPT': 'No transcript available for this video',
    'AGE_RESTRICTED': 'Video is age-restricted',
    'REGION_BLOCKED': 'Video is blocked in server region',
    'VIDEO_TOO_LONG': 'Video exceeds 4 hour limit',
    'VIDEO_NOT_FOUND': 'Video not found or is private',
    'SHORTS_NOT_SUPPORTED': 'YouTube Shorts are not supported',
}

# Error codes for transient failures (retry possible)
TRANSIENT_ERRORS = {
    'API_ERROR': 'External API error',
    'TRANSCRIPTION_ERROR': 'Transcription service error',
    'SUMMARIZATION_ERROR': 'Summary generation error',
}


class PermanentError(Exception):
    """Permanent error - no retry possible."""
    def __init__(self, code: str, message: str = None):
        self.code = code
        self.message = message or PERMANENT_ERRORS.get(code, 'Unknown error')
        super().__init__(self.message)


class TransientError(Exception):
    """Transient error - retry possible."""
    def __init__(self, code: str, message: str = None):
        self.code = code
        self.message = message or TRANSIENT_ERRORS.get(code, 'Unknown error')
        super().__init__(self.message)


def update_user_single_episode_status(
    conn,
    user_single_episode_id: int,
    status: str,
    failure_reason: str = None
) -> None:
    """
    Update the status of a UserSingleEpisode record.

    Args:
        conn: Database connection
        user_single_episode_id: The ID of the UserSingleEpisode record
        status: New status (PENDING, PROCESSING, COMPLETED, FAILED)
        failure_reason: Optional failure reason code
    """
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE user_single_episodes
        SET status = %s, failure_reason = %s
        WHERE id = %s
    """, (status, failure_reason, user_single_episode_id))
    conn.commit()
    logger.info(f"Updated UserSingleEpisode #{user_single_episode_id} status to {status}")


def find_user_single_episode_by_queue(conn, queue_type: str, entity_id: int, user_id: str) -> dict | None:
    """
    Find the UserSingleEpisode record associated with a queue task.

    Args:
        conn: Database connection
        queue_type: SINGLE_VIDEO or SINGLE_EPISODE
        entity_id: The video or episode ID
        user_id: The user ID

    Returns:
        UserSingleEpisode dict or None
    """
    cursor = conn.cursor()

    if queue_type == 'SINGLE_VIDEO':
        cursor.execute("""
            SELECT id, user_id, video_id, style, language, status
            FROM user_single_episodes
            WHERE video_id = %s AND user_id = %s
        """, (entity_id, user_id))
    else:  # SINGLE_EPISODE
        cursor.execute("""
            SELECT id, user_id, episode_id, style, language, status
            FROM user_single_episodes
            WHERE episode_id = %s AND user_id = %s
        """, (entity_id, user_id))

    row = cursor.fetchone()
    if row:
        columns = ['id', 'user_id', 'entity_id', 'style', 'language', 'status']
        return dict(zip(columns, row))
    return None


def ensure_video_exists(conn, youtube_video_id: str) -> int:
    """
    Ensure a YouTube video record exists, creating it with placeholder data if needed.

    Args:
        conn: Database connection
        youtube_video_id: The YouTube video ID

    Returns:
        The database ID of the video
    """
    cursor = conn.cursor()

    # Check if video already exists
    cursor.execute("""
        SELECT id FROM youtube_videos WHERE youtube_video_id = %s
    """, (youtube_video_id,))

    existing = cursor.fetchone()
    if existing:
        return existing[0]

    # Video doesn't exist - we need to create it along with a placeholder channel
    # For single videos, we'll use a placeholder channel
    # First, check if we have a "single videos" placeholder channel
    cursor.execute("""
        SELECT id FROM youtube_channels WHERE youtube_id = 'SINGLE_VIDEOS_PLACEHOLDER'
    """)

    placeholder_channel = cursor.fetchone()
    if not placeholder_channel:
        # Create placeholder channel
        cursor.execute("""
            INSERT INTO youtube_channels (youtube_id, title, description)
            VALUES ('SINGLE_VIDEOS_PLACEHOLDER', 'Single Videos', 'Placeholder for single video submissions')
            RETURNING id
        """)
        channel_id = cursor.fetchone()[0]
        conn.commit()
    else:
        channel_id = placeholder_channel[0]

    # Create the video with placeholder data
    cursor.execute("""
        INSERT INTO youtube_videos (youtube_video_id, channel_id, title, published_at)
        VALUES (%s, %s, %s, %s)
        RETURNING id
    """, (youtube_video_id, channel_id, 'Processing...', datetime.now()))

    video_id = cursor.fetchone()[0]
    conn.commit()

    return video_id


def process_single_video(
    conn,
    video_db_id: int,
    youtube_video_id: str,
    style: str,
    language: str,
    user_single_episode_id: int
) -> None:
    """
    Process a single YouTube video: fetch transcript, generate summary.

    Args:
        conn: Database connection
        video_db_id: Database ID of the YouTube video
        youtube_video_id: The YouTube video ID
        style: Summary style (DEFAULT or QUICK_READ)
        language: Summary language (ZH_TW or EN)
        user_single_episode_id: ID of the UserSingleEpisode record
    """
    cursor = conn.cursor()

    # Check if summary already exists
    cursor.execute("""
        SELECT id FROM video_summaries
        WHERE video_id = %s AND style = %s AND language = %s
    """, (video_db_id, style, language))

    existing_summary = cursor.fetchone()
    if existing_summary:
        logger.info(f"Summary already exists for video {youtube_video_id} with {style}/{language}")
        update_user_single_episode_status(conn, user_single_episode_id, 'COMPLETED')
        return

    # Check if we have a transcript
    cursor.execute("""
        SELECT transcript, title FROM youtube_videos WHERE id = %s
    """, (video_db_id,))
    row = cursor.fetchone()

    transcript = row[0] if row else None
    current_title = row[1] if row else None

    if not transcript:
        # Need to fetch transcript
        logger.info(f"Fetching transcript for video {youtube_video_id}...")

        # Try subtitle-based methods first
        transcript, source = fetch_transcript_with_fallback(youtube_video_id)

        # If no subtitles, try audio transcription
        if not transcript:
            logger.info(f"No subtitles, trying audio transcription for {youtube_video_id}...")
            try:
                transcript = download_and_transcribe_audio(youtube_video_id)
                if transcript:
                    source = "deepgram"
            except Exception as e:
                logger.error(f"Audio transcription failed: {e}")
                raise TransientError('TRANSCRIPTION_ERROR', str(e))

        if not transcript:
            raise PermanentError('NO_TRANSCRIPT')

        logger.info(f"Transcript fetched from {source} ({len(transcript)} chars)")

        # Save transcript to video record
        cursor.execute("""
            UPDATE youtube_videos SET transcript = %s WHERE id = %s
        """, (transcript, video_db_id))
        conn.commit()

    # Generate summary
    logger.info(f"Generating {style}/{language} summary for video {youtube_video_id}...")
    try:
        summary = generate_summary(transcript, style=style, language=language, is_podcast=False)
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        raise TransientError('SUMMARIZATION_ERROR', str(e))

    # Save summary
    cursor.execute("""
        INSERT INTO video_summaries (video_id, style, language, content, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (video_id, style, language) DO UPDATE SET content = EXCLUDED.content
    """, (video_db_id, style, language, summary))
    conn.commit()

    logger.info(f"Summary saved for video {youtube_video_id}")

    # Update UserSingleEpisode status
    update_user_single_episode_status(conn, user_single_episode_id, 'COMPLETED')


def process_single_episode(
    conn,
    episode_db_id: int,
    style: str,
    language: str,
    user_single_episode_id: int
) -> None:
    """
    Process a single Podcast episode: transcribe audio, generate summary.

    Args:
        conn: Database connection
        episode_db_id: Database ID of the podcast episode
        style: Summary style (DEFAULT or QUICK_READ)
        language: Summary language (ZH_TW or EN)
        user_single_episode_id: ID of the UserSingleEpisode record
    """
    cursor = conn.cursor()

    # Check if summary already exists
    cursor.execute("""
        SELECT id FROM episode_summaries
        WHERE episode_id = %s AND style = %s AND language = %s
    """, (episode_db_id, style, language))

    existing_summary = cursor.fetchone()
    if existing_summary:
        logger.info(f"Summary already exists for episode {episode_db_id} with {style}/{language}")
        update_user_single_episode_status(conn, user_single_episode_id, 'COMPLETED')
        return

    # Get episode details
    cursor.execute("""
        SELECT transcript, audio_url, title FROM podcast_episodes WHERE id = %s
    """, (episode_db_id,))
    row = cursor.fetchone()

    if not row:
        raise PermanentError('VIDEO_NOT_FOUND', 'Episode not found')

    transcript = row[0]
    audio_url = row[1]

    if not transcript:
        # Need to transcribe
        logger.info(f"Transcribing audio for episode {episode_db_id}...")

        if not audio_url:
            raise PermanentError('NO_TRANSCRIPT', 'No audio URL available')

        try:
            transcript = transcribe_audio(audio_url)
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise TransientError('TRANSCRIPTION_ERROR', str(e))

        if not transcript:
            raise PermanentError('NO_TRANSCRIPT')

        logger.info(f"Transcript generated ({len(transcript)} chars)")

        # Save transcript
        cursor.execute("""
            UPDATE podcast_episodes SET transcript = %s WHERE id = %s
        """, (transcript, episode_db_id))
        conn.commit()

    # Generate summary
    logger.info(f"Generating {style}/{language} summary for episode {episode_db_id}...")
    try:
        summary = generate_summary(transcript, style=style, language=language, is_podcast=True)
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        raise TransientError('SUMMARIZATION_ERROR', str(e))

    # Save summary
    cursor.execute("""
        INSERT INTO episode_summaries (episode_id, style, language, content, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (episode_id, style, language) DO UPDATE SET content = EXCLUDED.content
    """, (episode_db_id, style, language, summary))
    conn.commit()

    logger.info(f"Summary saved for episode {episode_db_id}")

    # Update UserSingleEpisode status
    update_user_single_episode_status(conn, user_single_episode_id, 'COMPLETED')


def process_single_task(conn, task: dict) -> None:
    """
    Main entry point for processing single video/episode tasks.

    Args:
        conn: Database connection
        task: Task dict with type, entityId, requestedByUserId, requestedStyle, requestedLanguage
    """
    task_type = task['type']
    entity_id = task['entityId']
    user_id = task.get('requestedByUserId')
    style = task.get('requestedStyle', 'DEFAULT')
    language = task.get('requestedLanguage', 'ZH_TW')

    logger.info(f"Processing single task: {task_type} entity={entity_id} user={user_id} style={style} lang={language}")

    if not user_id:
        logger.error(f"No user ID for single task, skipping")
        return

    # Find the UserSingleEpisode record
    user_single_episode = find_user_single_episode_by_queue(conn, task_type, entity_id, user_id)

    if not user_single_episode:
        logger.error(f"UserSingleEpisode not found for {task_type} entity={entity_id} user={user_id}")
        return

    user_single_episode_id = user_single_episode['id']

    # Update status to PROCESSING
    update_user_single_episode_status(conn, user_single_episode_id, 'PROCESSING')

    try:
        if task_type == 'SINGLE_VIDEO':
            # Get the YouTube video ID
            cursor = conn.cursor()
            cursor.execute("SELECT youtube_video_id FROM youtube_videos WHERE id = %s", (entity_id,))
            row = cursor.fetchone()

            if not row:
                raise PermanentError('VIDEO_NOT_FOUND')

            youtube_video_id = row[0]

            process_single_video(
                conn,
                video_db_id=entity_id,
                youtube_video_id=youtube_video_id,
                style=style,
                language=language,
                user_single_episode_id=user_single_episode_id
            )

        elif task_type == 'SINGLE_EPISODE':
            process_single_episode(
                conn,
                episode_db_id=entity_id,
                style=style,
                language=language,
                user_single_episode_id=user_single_episode_id
            )
        else:
            logger.error(f"Unknown task type: {task_type}")

    except PermanentError as e:
        logger.error(f"Permanent error processing {task_type}: {e.code} - {e.message}")
        update_user_single_episode_status(conn, user_single_episode_id, 'FAILED', e.code)

    except TransientError as e:
        logger.error(f"Transient error processing {task_type}: {e.code} - {e.message}")
        update_user_single_episode_status(conn, user_single_episode_id, 'FAILED', e.code)

    except Exception as e:
        logger.error(f"Unexpected error processing {task_type}: {e}")
        update_user_single_episode_status(conn, user_single_episode_id, 'FAILED', 'API_ERROR')
