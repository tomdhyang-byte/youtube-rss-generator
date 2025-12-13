"""
Database Module
Handles PostgreSQL connection and utility functions.
"""
import ssl
from urllib.parse import urlparse
import pg8000.dbapi

from .config import DATABASE_URL


def get_db_connection():
    """
    Create and return a database connection using pg8000.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL/DIRECT_URL environment variable is not set")
    
    u = urlparse(DATABASE_URL)
    
    # Create SSL context that ignores verification errors (needed for some environments)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    conn = pg8000.dbapi.connect(
        user=u.username,
        password=u.password,
        host=u.hostname,
        port=u.port,
        database=u.path[1:],
        ssl_context=ssl_context
    )
    return conn


def fetch_as_dict(cursor):
    """
    Return all rows from a cursor as a list of dicts.
    """
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
