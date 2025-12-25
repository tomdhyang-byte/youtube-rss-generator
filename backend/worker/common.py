"""
Common utilities for backend workers.
Shared logic between youtube.py and podcast.py to reduce code duplication.
"""

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
