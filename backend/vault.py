import os
import sqlite3
import base64
import hashlib
import logging
from typing import Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

log = logging.getLogger("vault")

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "cryptolens.db"))
MASTER_KEY_ENV = "CRYPTOLENS_MASTER_KEY"

def init_db():
    """Initialize SQLite database for storing encrypted keys."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            user_id TEXT PRIMARY KEY,
            api_key_encrypted TEXT NOT NULL,
            secret_key_encrypted TEXT NOT NULL,
            nonce_key TEXT NOT NULL,
            nonce_secret TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def _get_master_key() -> str:
    """Retrieve the master encryption key from environment variables or use safe fallback for dev."""
    key = os.environ.get(MASTER_KEY_ENV, "")
    if not key:
        log.warning("CRYPTOLENS_MASTER_KEY not set in environment. Using development fallback.")
        return "DEV_CRYPTOLENS_SECURE_MASTER_KEY_12345!"
    return key

def _get_aes_key(master_key: str) -> bytes:
    """Derive a 256-bit AES key from the master key using SHA256."""
    return hashlib.sha256(master_key.encode("utf-8")).digest()

def encrypt_val(plaintext: str) -> Tuple[str, str]:
    """Encrypt a plaintext string using AES-256-GCM. Returns (ciphertext_b64, nonce_b64)."""
    master_key = _get_master_key()
    key = _get_aes_key(master_key)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 12-byte nonce recommended for AES-GCM
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    
    ciphertext_b64 = base64.b64encode(ciphertext).decode("utf-8")
    nonce_b64 = base64.b64encode(nonce).decode("utf-8")
    return ciphertext_b64, nonce_b64

def decrypt_val(ciphertext_b64: str, nonce_b64: str) -> str:
    """Decrypt an AES-256-GCM encrypted string using the master key."""
    master_key = _get_master_key()
    key = _get_aes_key(master_key)
    aesgcm = AESGCM(key)
    
    ciphertext = base64.b64decode(ciphertext_b64)
    nonce = base64.b64decode(nonce_b64)
    
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")

def store_keys(user_id: str, api_key: str, secret_key: str):
    """Encrypt and store the user's API key and Secret key in SQLite database."""
    init_db()
    
    api_enc, api_nonce = encrypt_val(api_key)
    sec_enc, sec_nonce = encrypt_val(secret_key)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO api_keys 
        (user_id, api_key_encrypted, secret_key_encrypted, nonce_key, nonce_secret)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, api_enc, sec_enc, api_nonce, sec_nonce))
    conn.commit()
    conn.close()

def get_keys(user_id: str) -> Optional[Tuple[str, str]]:
    """Retrieve and decrypt the user's API key and Secret key."""
    init_db()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT api_key_encrypted, secret_key_encrypted, nonce_key, nonce_secret
        FROM api_keys WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    api_enc, sec_enc, api_nonce, sec_nonce = row
    try:
        api_key = decrypt_val(api_enc, api_nonce)
        secret_key = decrypt_val(sec_enc, sec_nonce)
        return api_key, secret_key
    except Exception as e:
        log.error(f"Failed to decrypt API keys for user {user_id}: {e}")
        return None

def delete_keys(user_id: str):
    """Delete the API keys configuration for a user."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM api_keys WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
