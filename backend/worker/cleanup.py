
def enforce_video_retention(conn, channel_id: int, limit: int = 15):
    """
    Keep only the latest `limit` videos for the given channel.
    Deletes older videos to maintain database size.
    
    Args:
        conn: Database connection
        channel_id: The ID of the channel to clean up
        limit: Number of most recent videos to keep (default: 15)
    """
    cursor = conn.cursor()
    
    # 1. Check total count first to avoid expensive queries if not needed
    cursor.execute("SELECT COUNT(*) FROM youtube_videos WHERE channel_id = %s", (channel_id,))
    count = cursor.fetchone()[0]
    
    if count <= limit:
        return
        
    print(f"  - 🧹 Retention Policy: Channel {channel_id} has {count} videos (Limit: {limit}). Cleaning up...")
    
    # 2. Delete videos that are NOT in the top N newest
    # Note: We rely on PostgreSQL CASCADE DELETE to remove related:
    # - video_summaries
    # - user_video_styles
    try:
        cursor.execute("""
            DELETE FROM youtube_videos 
            WHERE id IN (
                SELECT id FROM youtube_videos 
                WHERE channel_id = %s 
                ORDER BY published_at DESC 
                OFFSET %s
            )
        """, (channel_id, limit))
        
        deleted_count = cursor.rowcount
        conn.commit()
        print(f"  - ✅ Deleted {deleted_count} old videos.")
        
    except Exception as e:
        conn.rollback()
        print(f"  - ⚠️ Error enforcing retention policy: {e}")
