import time
import datetime
import logging
import sys
from .db import get_db_connection, fetch_as_dict
from .youtube import process_youtube_channel
from .podcast import process_podcast_channel
from .config import validate_config, POLL_INTERVAL, MAINTENANCE_INTERVAL, STUCK_TASK_THRESHOLD

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("daemon")

class TaskProcessor:
    def __init__(self):
        logger.info("Initializing Daemon...")
        if not validate_config():
            raise Exception("Configuration validation failed")
        self.last_maintenance = time.time()
        
    def get_conn(self):
        return get_db_connection()

    def recover_stuck_tasks(self):
        """Reset tasks that have been 'PROCESSING' for too long (e.g., worker crash)."""
        logger.info("Checking for stuck tasks...")
        conn = self.get_conn()
        try:
            cursor = conn.cursor()
            # Find stuck tasks
            cursor.execute(f"""
                UPDATE "processing_queue"
                SET status = 'PENDING', "updatedAt" = NOW()
                WHERE status = 'PROCESSING'
                AND "updatedAt" < NOW() - INTERVAL '{STUCK_TASK_THRESHOLD} seconds'
            """)
            
            if cursor.rowcount > 0:
                logger.warning(f"Recovered {cursor.rowcount} stuck tasks.")
            conn.commit()
        except Exception as e:
            logger.error(f"Error recovering tasks: {e}")
        finally:
            conn.close()

    def poll_queue(self):
        """Fetch the next pending task."""
        conn = self.get_conn()
        task = None
        try:
            cursor = conn.cursor()
            # Select and lock the next task
            cursor.execute("""
                SELECT id, type, "entityId", attempts
                FROM "processing_queue"
                WHERE status = 'PENDING'
                ORDER BY priority DESC, "createdAt" ASC
                LIMIT 1
            """)
            task = cursor.fetchone()
            
            if task:
                task_id = task[0]
                # Mark as PROCESSING immediately
                cursor.execute("""
                    UPDATE "processing_queue"
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
            logger.error(f"Polling error: {e}")
        finally:
            conn.close()
        return None

    def process_task(self, task):
        """Execute the task logic."""
        task_id = task['id']
        entity_type = task['type']
        entity_id = task['entityId']
        
        logger.info(f"Processing Task #{task_id}: {entity_type} ID={entity_id}")
        
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
                logger.info(f"Task #{task_id} SKIPPED (No active subscriptions)")
                self.update_task_status(task_id, 'SKIPPED', "No active subscriptions")
                return

            # 2. Process Content
            if entity_type == 'YOUTUBE':
                cursor.execute('SELECT * FROM youtube_channels WHERE id = %s', (entity_id,))
                columns = [desc[0] for desc in cursor.description]
                row = cursor.fetchone()
                if row:
                    channel_dict = dict(zip(columns, row))
                    # Note: We pass the connection to the processor. 
                    # Ensure process_youtube_channel handles it correctly (it likely commit()s but doesn't close())
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
            logger.info(f"Task #{task_id} COMPLETED")

        except Exception as e:
            logger.error(f"Task #{task_id} FAILED: {e}")
            self.update_task_status(task_id, 'FAILED', str(e))
        finally:
            conn.close()

    def update_task_status(self, task_id, status, error=None):
        conn = self.get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE "processing_queue"
                SET status = %s, "updatedAt" = NOW(), "errorMessage" = %s
                WHERE id = %s
            """, (status, error, task_id))
            conn.commit()
        finally:
            conn.close()

    def run_routine_maintenance(self):
        """Run the legacy full scan logic."""
        logger.info("Starting Routine Maintenance (Full Scan)...")
        from . import main as original_worker_main
        try:
            original_worker_main()
            self.last_maintenance = time.time()
        except Exception as e:
            logger.error(f"Routine Maintenance Error: {e}")

    def start(self):
        logger.info(f"Started. Polling every {POLL_INTERVAL}s...")
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
                logger.info("Stopping...")
                break
            except Exception as e:
                logger.critical(f"Loop Error: {e}")
                time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    processor = TaskProcessor()
    processor.start()
