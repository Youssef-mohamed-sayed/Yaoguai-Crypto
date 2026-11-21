"""
auth.py — Resilient authentication, JWT session management, SQLite persistence,
avatar handling (.png, .jpg strictly enforced), and progress saving for YAOGUAI.
Compatible with both standard local runs and Vercel Serverless (read-only filesystem).
"""
import base64
import datetime
import hashlib
import hmac
import json
import os
import re
import sqlite3
import tempfile
import time
from contextlib import contextmanager
from typing import Optional, Tuple, Dict, Any

import bcrypt

# Attempt to load PyJWT; if not available, stdlib HS256 fallback will be used
try:
    import jwt
    HAS_PYJWT = True
except ImportError:
    HAS_PYJWT = False

JWT_SECRET = os.environ.get("YAOGUAI_JWT_SECRET", "yaoguai-crypto-secret-key-2024-secure-jwt")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 14

# Allowed avatar extensions & magic byte signatures
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"

# Environment detection for read-only serverless filesystems (e.g. Vercel)
scripts_dir = os.path.dirname(os.path.abspath(__file__))
is_read_only = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
if not is_read_only:
    try:
        test_file = os.path.join(scripts_dir, ".test_write")
        with open(test_file, "w") as f:
            f.write("1")
        os.remove(test_file)
    except Exception:
        is_read_only = True

if is_read_only:
    _temp_base = os.path.join(tempfile.gettempdir(), "yaoguai_data")
    os.makedirs(_temp_base, exist_ok=True)
    DB_PATH = os.path.join(_temp_base, "yaoguai.db")
    AVATARS_DIR = os.path.join(_temp_base, "avatars")
    os.makedirs(AVATARS_DIR, exist_ok=True)
else:
    DB_PATH = os.path.join(scripts_dir, "yaoguai.db")
    AVATARS_DIR = os.path.abspath(os.path.join(scripts_dir, "..", "public", "assets", "avatars"))
    try:
        os.makedirs(AVATARS_DIR, exist_ok=True)
    except Exception:
        _temp_base = os.path.join(tempfile.gettempdir(), "yaoguai_data")
        os.makedirs(_temp_base, exist_ok=True)
        DB_PATH = os.path.join(_temp_base, "yaoguai.db")
        AVATARS_DIR = os.path.join(_temp_base, "avatars")
        os.makedirs(AVATARS_DIR, exist_ok=True)


_db_initialized = False

@contextmanager
def get_db():
    global _db_initialized
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        if not _db_initialized:
            init_db(conn)
            _db_initialized = True
        with conn:
            yield conn
    finally:
        conn.close()


def init_db(conn=None):
    close_when_done = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        close_when_done = True
    try:
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
    except Exception as e:
        print(f"[AUTH] init_db note: {e}")
    finally:
        if close_when_done:
            conn.close()


# Try initializing immediately if possible
try:
    init_db()
except Exception:
    pass


# ------------------------------------------------ JWT HELPERS (PyJWT + stdlib fallback)
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    rem = len(s) % 4
    if rem:
        s += "=" * (4 - rem)
    return base64.urlsafe_b64decode(s.encode("ascii"))


def create_token(user_id: int, username: str) -> str:
    now_ts = int(time.time())
    exp_ts = now_ts + (JWT_EXPIRATION_DAYS * 86400)
    payload = {
        "sub": str(user_id),
        "user_id": int(user_id),
        "username": username,
        "iat": now_ts,
        "exp": exp_ts
    }
    if HAS_PYJWT:
        try:
            return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        except Exception:
            pass

    # Pure stdlib HS256 fallback
    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    msg = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(JWT_SECRET.encode("utf-8"), msg, hashlib.sha256).digest()
    s_b64 = _b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{s_b64}"


def decode_token(token: str) -> Dict[str, Any]:
    if not token or not isinstance(token, str):
        raise ValueError("Invalid authentication token.")

    token = token.strip()
    if HAS_PYJWT:
        try:
            return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise ValueError("Session token has expired. Please log in again.")
        except Exception:
            # Try stdlib fallback before failing
            pass

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid authentication token format.")

    h_b64, p_b64, s_b64 = parts
    try:
        msg = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), msg, hashlib.sha256).digest()
        actual_sig = _b64url_decode(s_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Invalid authentication signature.")

        payload_bytes = _b64url_decode(p_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        if "exp" in payload and int(payload["exp"]) < int(time.time()):
            raise ValueError("Session token has expired. Please log in again.")

        return payload
    except Exception as e:
        if "expired" in str(e).lower():
            raise ValueError("Session token has expired. Please log in again.")
        raise ValueError("Invalid authentication token.")


# ------------------------------------------------ PASSWORD HASHING
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ------------------------------------------------ AVATAR VALIDATION
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

    normalized_ext = ".jpg" if ext in (".jpg", ".jpeg") else ".png"
    return raw_bytes, normalized_ext


def save_avatar_file(user_id: int, raw_bytes: bytes, ext: str) -> str:
    filename = f"avatar_{user_id}_{int(time.time())}{ext}"
    dest_path = os.path.join(AVATARS_DIR, filename)
    with open(dest_path, "wb") as f:
        f.write(raw_bytes)
    return f"assets/avatars/{filename}"


# ------------------------------------------------ USER OPERATIONS
class ValidationError(ValueError):
    def __init__(self, errors):
        self.errors = errors
        super().__init__(" ".join(errors.values()))


def validate_credentials(username, password, registering=False):
    errors = {}
    if not isinstance(username, str) or not username.strip():
        errors["username"] = "Username is required and must be text."
    elif registering:
        username = username.strip()
        if not 3 <= len(username) <= 30:
            errors["username"] = "Username must be between 3 and 30 characters."
        elif not re.fullmatch(r"[a-zA-Z0-9_\-]+", username):
            errors["username"] = "Username can only contain letters, numbers, hyphens, and underscores."
    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required and must be text."
    elif registering and len(password) < 8:
        errors["password"] = "Password must be at least 8 characters long."
    elif registering and len(password.encode("utf-8")) > 72:
        errors["password"] = "Password must be no more than 72 UTF-8 bytes."
    if errors:
        raise ValidationError(errors)


def register_user(username: str, password: str, avatar_bytes: Optional[bytes] = None,
                  avatar_filename: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
    validate_credentials(username, password, registering=True)
    username = (username or "").strip()
    password = password or ""

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
        if avatar_bytes is not None and avatar_filename:
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
    validate_credentials(username, password)
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
