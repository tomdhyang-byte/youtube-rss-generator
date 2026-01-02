"""
Common utilities for backend workers.
Shared logic between youtube.py and podcast.py to reduce code duplication.
"""

from datetime import datetime, timezone
from .summarize import generate_summary

# Tier limits configuration
TIER_LIMITS = {
    'FREE': 1,
    'PLUS': 5,
    'PRO': 10,
}


def get_effective_tier(user_row: dict) -> str:
    """
    Get the effective tier for a user, considering expiration.
    
    Args:
        user_row: Dict with 'tier' and 'tier_expires_at' keys (both optional for backward compat)
        
    Returns:
        The effective tier ('FREE', 'PLUS', or 'PRO')
    """
    tier = user_row.get('tier', 'FREE') or 'FREE'
    expires_at = user_row.get('tier_expires_at')
    
    if expires_at is None:
        return tier
    
    # Handle different date formats
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        except ValueError:
            return tier
    
    # Compare with timezone-aware datetime
    now = datetime.now(timezone.utc)
    if hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < now:
        return 'FREE'
    
    return tier


def get_max_subscriptions(tier: str) -> int:
    """Get the maximum number of subscriptions for a tier."""
    return TIER_LIMITS.get(tier, 1)


def is_subscription_active(user_row: dict, subscription_index: int) -> bool:
    """
    Check if a user's Nth subscription is within their tier limit.
    
    Args:
        user_row: Dict with tier info
        subscription_index: 0-based index of the subscription
        
    Returns:
        True if the subscription is within the tier limit
    """
    tier = get_effective_tier(user_row)
    limit = get_max_subscriptions(tier)
    return subscription_index < limit


def lock_user_styles(conn, entity_id: int, subscriber_list: list, table_name: str, id_column: str) -> int:
    """
    Lock the summary style and language for each user for a specific content item (video or episode).
    This ensures that when a user changes their settings, past content still shows the old style/language.
    
    Args:
        conn: Database connection
        entity_id: The database ID of the video or episode
        subscriber_list: List of dicts with 'user_id', 'style', and 'language' keys
        table_name: Name of the table to insert into (e.g., 'user_video_styles')
        id_column: Name of the foreign key column (e.g., 'video_id')
        
    Returns:
        Number of styles locked (inserted)
    """
    if not subscriber_list:
        return 0
        
    cursor = conn.cursor()
    locked_count = 0
    
    # query construction needs to be safe against SQL injection if table_name/id_column were user input,
    # but here they are hardcoded internal strings, so f-string is acceptable for table/col names.
    query = f"""
        INSERT INTO {table_name} (user_id, {id_column}, style, language)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, {id_column}) DO NOTHING
    """
    
    for sub in subscriber_list:
        try:
            cursor.execute(query, (sub['user_id'], entity_id, sub['style'], sub['language']))
            if cursor.rowcount > 0:
                locked_count += 1
        except Exception as e:
            print(f"    - Error locking style for user {sub['user_id']} in {table_name}: {e}")
    
    conn.commit()
    if locked_count > 0:
        print(f"    - Locked styles for {locked_count} users in {table_name}.")
        
    return locked_count


def ensure_missing_summaries(conn, entity_id: int, transcript: str, demanded_combos: set, is_podcast: bool = False):
    """
    Ensure that summaries exist for all requested (style, language) combinations.
    If any are missing (e.g., new subscriber with different language), generate them.
    
    Args:
        conn: Database connection
        entity_id: The database ID of the video or episode
        transcript: The content transcript
        demanded_combos: Set of tuples (style, language) that are needed
        is_podcast: Boolean flag to switch between video/episode tables
    """
    table = "episode_summaries" if is_podcast else "video_summaries"
    id_field = "episode_id" if is_podcast else "video_id"
    
    # 1. Query existing summaries
    cursor = conn.cursor()
    # Safe f-string because table/id_field are internal strings controlled by boolean flag
    cursor.execute(f"SELECT style, language FROM {table} WHERE {id_field} = %s", (entity_id,))
    existing_summaries = set((row[0], row[1]) for row in cursor.fetchall())
    
    # 2. Identify missing combos
    missing_combos = demanded_combos - existing_summaries
    
    if not missing_combos:
        return
        
    print(f"    - Found missing summaries for ID {entity_id}: {missing_combos}")
    
    # 3. Generate and save missing summaries
    for (style, language) in missing_combos:
        try:
            print(f"      - Generating missing {style}/{language} summary...")
            summary = generate_summary(transcript, style=style, language=language, is_podcast=is_podcast)
            
            cursor.execute(f"""
                INSERT INTO {table} ({id_field}, style, language, content, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT ({id_field}, style, language) DO UPDATE SET content = EXCLUDED.content
            """, (entity_id, style, language, summary))
            
            print(f"      - Saved missing summary ({style}/{language})")
            
        except Exception as e:
            print(f"      - ⚠️ Failed to generate missing {style}/{language}: {e}")
            
    conn.commit()
