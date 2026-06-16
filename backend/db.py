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
                position   INTEGER,
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

            CREATE TABLE IF NOT EXISTS holding (
                user_id    TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                amount     REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, symbol)
            );
            """
        )

        # Migration: add `position` to pre-existing watchlist tables and backfill
        # it from the current created_at-desc order so display order is preserved.
        cols = [r[1] for r in conn.execute("PRAGMA table_info(watchlist)").fetchall()]
        if "position" not in cols:
            conn.execute("ALTER TABLE watchlist ADD COLUMN position INTEGER")
        for (uid,) in conn.execute(
            "SELECT DISTINCT user_id FROM watchlist WHERE position IS NULL"
        ).fetchall():
            rows = conn.execute(
                "SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY created_at DESC",
                (uid,),
            ).fetchall()
            for i, r in enumerate(rows):
                conn.execute(
                    "UPDATE watchlist SET position = ? WHERE user_id = ? AND symbol = ?",
                    (i, uid, r["symbol"]),
                )
        conn.commit()
    finally:
        conn.close()


def _is_empty(conn: sqlite3.Connection, user_id: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM watchlist WHERE user_id = ? LIMIT 1", (user_id,)
    ).fetchone() is None


def _materialize_defaults(conn: sqlite3.Connection, user_id: str) -> None:
    """Seed the default coins with explicit positions on first curation, so an
    explicit add/remove/reorder doesn't bounce back to the implicit defaults."""
    conn.executemany(
        "INSERT OR IGNORE INTO watchlist (user_id, symbol, position) VALUES (?, ?, ?)",
        [(user_id, s, i) for i, s in enumerate(DEFAULT_WATCHLIST)],
    )


# ─── Watchlist ──────────────────────────────────────────────────────────

def get_watchlist(user_id: str) -> list[str]:
    """Return the user's symbols in their saved order, or the defaults if empty."""
    init_db()
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT symbol FROM watchlist WHERE user_id = ? "
            "ORDER BY position IS NULL, position ASC, created_at ASC",
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
    """Insert a symbol at the end. Idempotent. Seeds defaults first so a user's
    first explicit add doesn't silently wipe the implicit default list."""
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        if _is_empty(conn, user_id):
            _materialize_defaults(conn, user_id)
        next_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM watchlist WHERE user_id = ?",
            (user_id,),
        ).fetchone()["p"]
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, symbol, position) VALUES (?, ?, ?)",
            (user_id, symbol, next_pos),
        )
        conn.commit()
    finally:
        conn.close()


def remove_from_watchlist(user_id: str, symbol: str) -> None:
    """Remove a symbol. Materializes defaults first so removing a default sticks
    instead of bouncing back to the implicit default list."""
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        if _is_empty(conn, user_id):
            _materialize_defaults(conn, user_id)
        conn.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        )
        conn.commit()
    finally:
        conn.close()


def reorder_watchlist(user_id: str, symbols: list[str]) -> None:
    """Persist an explicit ordering: position = index for each known symbol."""
    init_db()
    conn = _connect()
    try:
        if _is_empty(conn, user_id):
            _materialize_defaults(conn, user_id)
        existing = {
            r["symbol"]
            for r in conn.execute(
                "SELECT symbol FROM watchlist WHERE user_id = ?", (user_id,)
            ).fetchall()
        }
        pos = 0
        for s in symbols:
            su = s.upper()
            if su in existing:
                conn.execute(
                    "UPDATE watchlist SET position = ? WHERE user_id = ? AND symbol = ?",
                    (pos, user_id, su),
                )
                pos += 1
        conn.commit()
    finally:
        conn.close()


# ─── Manual holdings (PLAN milestone 1) ─────────────────────────────────
# "พอร์ตของคุณ" — the user types in what they hold (symbol + amount). No API
# key, no liability. This is what turns "the market" into "your money" and
# powers the portfolio-weighted digest. Cap = WATCHLIST_MAX to bound digest
# token/quota usage (same rationale as the watchlist cap).

def get_holdings(user_id: str) -> list[dict]:
    """Return the user's holdings as [{symbol, amount}], newest-edited first."""
    init_db()
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT symbol, amount FROM holding WHERE user_id = ? "
            "ORDER BY updated_at DESC, symbol ASC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    return [{"symbol": r["symbol"], "amount": r["amount"]} for r in rows]


def count_holdings(user_id: str) -> int:
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM holding WHERE user_id = ?", (user_id,)
        ).fetchone()
    finally:
        conn.close()
    return int(row["n"])


def upsert_holding(user_id: str, symbol: str, amount: float) -> None:
    """Add or update a held amount. Idempotent on (user, symbol)."""
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO holding (user_id, symbol, amount, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, symbol)
            DO UPDATE SET amount = excluded.amount, updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, symbol, amount),
        )
        conn.commit()
    finally:
        conn.close()


def remove_holding(user_id: str, symbol: str) -> None:
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        conn.execute(
            "DELETE FROM holding WHERE user_id = ? AND symbol = ?",
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
