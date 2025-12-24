import time
import datetime
from .db import get_db_connection, fetch_as_dict
from .youtube import process_youtube_channel
from .podcast import process_podcast_channel
from .config import validate_config

# Constants
POLL_INTERVAL = 10  # Seconds
MAINTENANCE_INTERVAL = 3600  # 1 Hour
STUCK_TASK_THRESHOLD = 1800  # 30 Minutes

class TaskProcessor:
    def __init__(self):
        print("[Daemon] Initializing...")
        if not validate_config():
            raise Exception("Configuration validation failed")
        self.last_maintenance = time.time()
        
    def get_conn(self):
        return get_db_connection()

    def recover_stuck_tasks(self):
        """Reset tasks that have been 'PROCESSING' for too long (e.g., worker crash)."""
        print("[Daemon] Checking for stuck tasks...")
        conn = self.get_conn()
        try:
            cursor = conn.cursor()
            # Find stuck tasks
            cursor.execute("""
                UPDATE "ProcessingQueue"
                SET status = 'PENDING', "updatedAt" = NOW()
                WHERE status = 'PROCESSING'
                AND "updatedAt" < NOW() - INTERVAL '30 minutes'
            """)
            if cursor.rowcount > 0:
                print(f"[Daemon] Recovered {cursor.rowcount} stuck tasks.")
            conn.commit()
        except Exception as e:
            print(f"[Daemon] Error recovering tasks: {e}")
        finally:
            conn.close()

    def poll_queue(self):
        """Fetch the next pending task."""
        conn = self.get_conn()
        task = None
        try:
            cursor = conn.cursor()
            # Select and lock the next task (simple version without row locking for now)
            cursor.execute("""
                SELECT id, type, "entityId", attempts
                FROM "ProcessingQueue"
                WHERE status = 'PENDING'
                ORDER BY priority DESC, "createdAt" ASC
                LIMIT 1
            """)
            task = cursor.fetchone()
            
            if task:
                task_id = task[0]
                # Mark as PROCESSING immediately
                cursor.execute("""
                    UPDATE "ProcessingQueue"
                    SET status = 'PROCESSING', "updatedAt" = NOW()
                    WHERE id = %s
                """, (task_id,))
                conn.commit()
                
                return {
                    'id': task[0],
                    'type': task[1],
                    'entityId': task[2],
                    'attempts': task[3]
                }
        except Exception as e:
            print(f"[Daemon] Polling error: {e}")
        finally:
            conn.close()
        return None

    def process_task(self, task):
        """Execute the task logic."""
        task_id = task['id']
        entity_type = task['type']
        entity_id = task['entityId']
        
        print(f"[Daemon] Processing Task #{task_id}: {entity_type} ID={entity_id}")
        
        conn = self.get_conn()
        try:
            cursor = conn.cursor()
            
            # 1. Check if entity has active subscriptions (Optimization)
            is_active = False
            if entity_type == 'YOUTUBE':
                cursor.execute('SELECT COUNT(*) FROM youtube_subscriptions WHERE channel_id = %s', (entity_id,))
                is_active = cursor.fetchone()[0] > 0
            elif entity_type == 'PODCAST':
                cursor.execute('SELECT COUNT(*) FROM podcast_subscriptions WHERE podcast_id = %s', (entity_id,))
                is_active = cursor.fetchone()[0] > 0
                
            if not is_active:
                print(f"[Daemon] Task #{task_id} SKIPPED (No active subscriptions)")
                self.update_task_status(task_id, 'SKIPPED', "No active subscriptions")
                return

            # 2. Process Content
            if entity_type == 'YOUTUBE':
                # Fetch channel details for the processor
                cursor.execute('SELECT * FROM youtube_channels WHERE id = %s', (entity_id,))
                channel = cursor.fetchone()
                # Convert tuple to dict-like if needed (process_youtube_channel expects dict-access if using fetch_as_dict logic, 
                # but currently process_youtube_channel takes 'channel' which might be row object or dict. 
                # Our db.py fetch_as_dict returns dicts. Let's ensure compatibility.)
                # Actually, `fetch_as_dict` uses `RealDictCursor`, but `get_db_connection` returns standard connection.
                # Let's fix this by using `fetch_as_dict` helper or constructing dict manually.
                # Re-fetch using helper to be safe.
                pass 
                
            # Re-implementing fetch to ensure we pass the right object structure
            # The original worker uses `fetch_as_dict`.
            
            if entity_type == 'YOUTUBE':
                cursor.execute('SELECT * FROM youtube_channels WHERE id = %s', (entity_id,))
                columns = [desc[0] for desc in cursor.description]
                row = cursor.fetchone()
                if row:
                    channel_dict = dict(zip(columns, row))
                    process_youtube_channel(conn, channel_dict)
                else:
                    raise Exception(f"Channel {entity_id} not found")
                    
            elif entity_type == 'PODCAST':
                cursor.execute('SELECT * FROM podcast_channels WHERE id = %s', (entity_id,))
                columns = [desc[0] for desc in cursor.description]
                row = cursor.fetchone()
                if row:
                    podcast_dict = dict(zip(columns, row))
                    process_podcast_channel(conn, podcast_dict)
                else:
                    raise Exception(f"Podcast {entity_id} not found")

            # 3. Success
            self.update_task_status(task_id, 'COMPLETED')
            print(f"[Daemon] Task #{task_id} COMPLETED")

        except Exception as e:
            print(f"[Daemon] Task #{task_id} FAILED: {e}")
            self.update_task_status(task_id, 'FAILED', str(e))
        finally:
            conn.close()

    def update_task_status(self, task_id, status, error=None):
        conn = self.get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE "ProcessingQueue"
                SET status = %s, "updatedAt" = NOW(), "errorMessage" = %s
                WHERE id = %s
            """, (status, error, task_id))
            conn.commit()
        finally:
            conn.close()

    def run_routine_maintenance(self):
        """Run the legacy full scan logic."""
        print("[Daemon] Starting Routine Maintenance (Full Scan)...")
        # Reuse the logic from the original main() function
        # But we need to import it carefully or re-implement.
        # For simplicity, we can just call the functions directly.
        from . import main as original_worker_main
        try:
            original_worker_main()
            self.last_maintenance = time.time()
        except Exception as e:
            print(f"[Daemon] Routine Maintenance Error: {e}")

    def start(self):
        print(f"[Daemon] Started. Polling every {POLL_INTERVAL}s...")
        self.recover_stuck_tasks()
        
        while True:
            try:
                # 1. Maintenance Check
                if time.time() - self.last_maintenance > MAINTENANCE_INTERVAL:
                    self.run_routine_maintenance()

                # 2. Process Queue
                task = self.poll_queue()
                if task:
                    self.process_task(task)
                else:
                    # No tasks, sleep
                    time.sleep(POLL_INTERVAL)
                    
            except KeyboardInterrupt:
                print("[Daemon] Stopping...")
                break
            except Exception as e:
                print(f"[Daemon] Loop Error: {e}")
                time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    processor = TaskProcessor()
    processor.start()
