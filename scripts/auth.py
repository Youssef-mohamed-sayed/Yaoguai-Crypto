"""
auth.py — Authentication, JWT session management, SQLite persistence,
avatar handling (.png, .jpg strictly enforced), and progress saving for YAOGUAI.
"""
import base64
import datetime
import json
import os
import re
import sqlite3
import time
from typing import Optional, Tuple, Dict, Any

import bcrypt
import jwt

DB_PATH = os.path.join(os.path.dirname(__file__), "yaoguai.db")
JWT_SECRET = os.environ.get("YAOGUAI_JWT_SECRET", "yaoguai-crypto-secret-key-2024-secure-jwt")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 14

AVATARS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "public", "assets", "avatars")
)
os.makedirs(AVATARS_DIR, exist_ok=True)

# Allowed avatar extensions & magic byte signatures
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                avatar_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS progress (
                user_id INTEGER PRIMARY KEY,
                progress_json TEXT NOT NULL DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        conn.commit()


# Initialize on import
init_db()


def create_token(user_id: int, username: str) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "username": username,
        "iat": now,
        "exp": now + datetime.timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Session token has expired. Please log in again.")
    except Exception as e:
        raise ValueError("Invalid authentication token.")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def validate_avatar_file(raw_bytes: bytes, filename: str) -> Tuple[bytes, str]:
    """
    Strictly validates that uploaded avatar is .png or .jpg/.jpeg.
    Checks both file extension and image header magic bytes.
    Returns (raw_bytes, extension) on success, or raises ValueError.
    """
    if not raw_bytes:
        raise ValueError("Empty avatar file uploaded.")

    if len(raw_bytes) > 2 * 1024 * 1024:  # 2MB
        raise ValueError("Avatar file exceeds 2 MB limit.")

    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_IMAGE_EXTS:
        raise ValueError("Profile avatar must be a .png or .jpg file.")

    # Check magic bytes
    if ext == ".png":
        if not raw_bytes.startswith(PNG_MAGIC):
            raise ValueError("Invalid PNG image format (corrupted or fake file header).")
    elif ext in (".jpg", ".jpeg"):
        if not raw_bytes.startswith(JPEG_MAGIC):
            raise ValueError("Invalid JPG image format (corrupted or fake file header).")

    # Normalize extension to .png or .jpg
    normalized_ext = ".jpg" if ext in (".jpg", ".jpeg") else ".png"
    return raw_bytes, normalized_ext


def save_avatar_file(user_id: int, raw_bytes: bytes, ext: str) -> str:
    filename = f"avatar_{user_id}_{int(time.time())}{ext}"
    dest_path = os.path.join(AVATARS_DIR, filename)
    with open(dest_path, "wb") as f:
        f.write(raw_bytes)
    return f"assets/avatars/{filename}"


def register_user(username: str, password: str, avatar_bytes: Optional[bytes] = None,
                  avatar_filename: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
    username = (username or "").strip()
    password = password or ""

    if not username:
        raise ValueError("Username is required.")
    if len(username) < 3 or len(username) > 30:
        raise ValueError("Username must be between 3 and 30 characters.")
    if not re.match(r"^[a-zA-Z0-9_\-]+$", username):
        raise ValueError("Username can only contain letters, numbers, hyphens, and underscores.")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters long.")

    pw_hash = hash_password(password)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cur.fetchone():
            raise ValueError("A user with that username already exists.")

        cur.execute(
            "INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?)",
            (username, pw_hash, "")
        )
        user_id = cur.lastrowid

        avatar_url = ""
        if avatar_bytes and avatar_filename:
            valid_bytes, ext = validate_avatar_file(avatar_bytes, avatar_filename)
            avatar_url = save_avatar_file(user_id, valid_bytes, ext)
            cur.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user_id))

        conn.commit()

    token = create_token(user_id, username)
    user_info = {
        "id": user_id,
        "username": username,
        "avatar_url": avatar_url,
        "progress": {}
    }
    return user_info, token


def login_user(username: str, password: str) -> Tuple[Dict[str, Any], str]:
    username = (username or "").strip()
    password = password or ""
    if not username or not password:
        raise ValueError("Username and password are required.")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, username, password_hash, avatar_url FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Invalid username or password.")

        if not verify_password(password, row["password_hash"]):
            raise ValueError("Invalid username or password.")

        user_id = row["id"]
        avatar_url = row["avatar_url"] or ""

        # Fetch progress
        cur.execute("SELECT progress_json FROM progress WHERE user_id = ?", (user_id,))
        prog_row = cur.fetchone()
        progress = {}
        if prog_row and prog_row["progress_json"]:
            try:
                progress = json.loads(prog_row["progress_json"])
            except Exception:
                progress = {}

    token = create_token(user_id, row["username"])
    user_info = {
        "id": user_id,
        "username": row["username"],
        "avatar_url": avatar_url,
        "progress": progress
    }
    return user_info, token


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, username, avatar_url FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        if not row:
            return None

        cur.execute("SELECT progress_json FROM progress WHERE user_id = ?", (user_id,))
        prog_row = cur.fetchone()
        progress = {}
        if prog_row and prog_row["progress_json"]:
            try:
                progress = json.loads(prog_row["progress_json"])
            except Exception:
                progress = {}

        return {
            "id": row["id"],
            "username": row["username"],
            "avatar_url": row["avatar_url"] or "",
            "progress": progress
        }


def update_user_avatar(user_id: int, raw_bytes: bytes, filename: str) -> str:
    valid_bytes, ext = validate_avatar_file(raw_bytes, filename)
    avatar_url = save_avatar_file(user_id, valid_bytes, ext)
    with get_db() as conn:
        conn.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user_id))
        conn.commit()
    return avatar_url


def get_progress(user_id: int) -> Dict[str, Any]:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT progress_json FROM progress WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        if row and row["progress_json"]:
            try:
                return json.loads(row["progress_json"])
            except Exception:
                return {}
        return {}


def save_progress(user_id: int, progress_data: Dict[str, Any]) -> None:
    progress_str = json.dumps(progress_data or {})
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO progress (user_id, progress_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                progress_json = excluded.progress_json,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, progress_str))
        conn.commit()
