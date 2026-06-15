"""SQLite persistence for low-stakes per-user state.

Identity comes from the client-supplied `X-User-ID` header (see PLAN / design
spec §3.1). That is acceptable for watchlist / chart drawings / digest cache —
all low-stakes, read-mostly data. It is NOT acceptable for the vault (see §6
"Auth gap"); key linking lives in vault.py and is gated separately.
"""

import json
import os
import sqlite3
from typing import Optional

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "cryptolens.db"))

DEFAULT_WATCHLIST = ["BTC", "ETH", "BNB", "SOL"]
WATCHLIST_MAX = 10  # cap to keep digest token/quota usage bounded (spec §8 Q2)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Safe to call repeatedly."""
    conn = _connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS watchlist (
                user_id    TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, symbol)
            );

            CREATE TABLE IF NOT EXISTS chart_drawing (
                user_id    TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                drawings   TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, symbol)
            );

            CREATE TABLE IF NOT EXISTS digest_cache (
                user_id    TEXT NOT NULL,
                day        TEXT NOT NULL,
                payload    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, day)
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


# ─── Watchlist ──────────────────────────────────────────────────────────

def get_watchlist(user_id: str) -> list[str]:
    """Return the user's symbols (newest first), or the defaults if empty."""
    init_db()
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    symbols = [r["symbol"] for r in rows]
    return symbols or list(DEFAULT_WATCHLIST)


def is_watchlist_empty(user_id: str) -> bool:
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT 1 FROM watchlist WHERE user_id = ? LIMIT 1", (user_id,)
        ).fetchone()
    finally:
        conn.close()
    return row is None


def count_watchlist(user_id: str) -> int:
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM watchlist WHERE user_id = ?", (user_id,)
        ).fetchone()
    finally:
        conn.close()
    return int(row["n"])


def add_to_watchlist(user_id: str, symbol: str) -> None:
    """Insert a symbol. Idempotent. Seeds defaults first so a user's first
    explicit add doesn't silently wipe the implicit default list."""
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        if is_watchlist_empty(user_id):
            conn.executemany(
                "INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)",
                [(user_id, s) for s in DEFAULT_WATCHLIST],
            )
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)",
            (user_id, symbol),
        )
        conn.commit()
    finally:
        conn.close()


def remove_from_watchlist(user_id: str, symbol: str) -> None:
    """Remove a symbol. If this empties an explicit list, persist that empty
    state with a tombstone-free approach: we keep the row count at zero and let
    get_watchlist fall back to defaults only when the user has *never* curated."""
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        # Materialize defaults on first curation so removal sticks instead of
        # bouncing back to the default list.
        if is_watchlist_empty(user_id):
            conn.executemany(
                "INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)",
                [(user_id, s) for s in DEFAULT_WATCHLIST],
            )
        conn.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        )
        conn.commit()
    finally:
        conn.close()


# ─── Chart drawings ─────────────────────────────────────────────────────

def get_chart_drawings(user_id: str, symbol: str) -> list:
    """Return the saved overlay list for this user/symbol ([] if none)."""
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT drawings FROM chart_drawing WHERE user_id = ? AND symbol = ?",
            (user_id, symbol.upper()),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return []
    try:
        return json.loads(row["drawings"])
    except (ValueError, TypeError):
        return []


def save_chart_drawings(user_id: str, symbol: str, drawings: list) -> None:
    init_db()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO chart_drawing (user_id, symbol, drawings, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, symbol)
            DO UPDATE SET drawings = excluded.drawings, updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, symbol.upper(), json.dumps(drawings)),
        )
        conn.commit()
    finally:
        conn.close()


# ─── Daily digest cache (persistent, true per-day) ──────────────────────

def get_digest_cache(user_id: str, day: str) -> Optional[dict]:
    """The in-memory cache (cache.py) has a 60s TTL — too short for a *daily*
    digest. Persist it here so we hit the LLM at most once per user per day
    and survive restarts (spec §3.2 / §6 quota risk)."""
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT payload FROM digest_cache WHERE user_id = ? AND day = ?",
            (user_id, day),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    try:
        return json.loads(row["payload"])
    except (ValueError, TypeError):
        return None


def set_digest_cache(user_id: str, day: str, payload: dict) -> None:
    init_db()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO digest_cache (user_id, day, payload, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, day)
            DO UPDATE SET payload = excluded.payload, created_at = CURRENT_TIMESTAMP
            """,
            (user_id, day, json.dumps(payload)),
        )
        # Opportunistic cleanup: keep only the 7 most recent days per user.
        conn.execute(
            """
            DELETE FROM digest_cache
            WHERE user_id = ? AND day NOT IN (
                SELECT day FROM digest_cache WHERE user_id = ?
                ORDER BY day DESC LIMIT 7
            )
            """,
            (user_id, user_id),
        )
        conn.commit()
    finally:
        conn.close()
