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
DIGEST_FORCE_MAX = 3  # max manual force-refreshes per user per UTC hour


def digest_shared_key(bucket: str, symbols: list[str]) -> str:
    return f"{bucket}:{','.join(sorted(symbols))}"


def digest_holdings_key(bucket: str, holdings: list[dict]) -> str:
    """Weighted digest cache key — changes when symbols or amounts change."""
    parts = [
        f"{h['symbol']}:{h['amount']:g}"
        for h in sorted(holdings, key=lambda x: x["symbol"])
    ]
    return f"{bucket}:{'|'.join(parts)}"


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
                avg_price  REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, symbol)
            );

            CREATE TABLE IF NOT EXISTS digest_shared_cache (
                cache_key  TEXT PRIMARY KEY,
                payload    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS digest_force_refresh (
                user_id TEXT NOT NULL,
                bucket  TEXT NOT NULL,
                count   INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (user_id, bucket)
            );

            CREATE TABLE IF NOT EXISTS user_settings (
                user_id             TEXT PRIMARY KEY,
                binance_use_testnet INTEGER NOT NULL DEFAULT 0,
                portfolio_mode      TEXT NOT NULL DEFAULT 'demo',
                updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        cols = [r[1] for r in conn.execute("PRAGMA table_info(holding)").fetchall()]
        if "avg_price" not in cols:
            conn.execute("ALTER TABLE holding ADD COLUMN avg_price REAL")
        settings_cols = [
            r[1] for r in conn.execute("PRAGMA table_info(user_settings)").fetchall()
        ]
        if settings_cols and "portfolio_mode" not in settings_cols:
            conn.execute(
                "ALTER TABLE user_settings ADD COLUMN portfolio_mode TEXT NOT NULL DEFAULT 'demo'"
            )
            conn.execute(
                """
                UPDATE user_settings
                SET portfolio_mode = CASE
                    WHEN binance_use_testnet = 1 THEN 'testnet'
                    ELSE 'demo'
                END
                """
            )
        conn.commit()
    finally:
        conn.close()


def _env_default_mainnet() -> bool:
    return os.environ.get("ENABLE_BINANCE_MAINNET", "").lower() == "true"


def get_portfolio_mode(user_id: str) -> str:
    """demo = manual portfolio for presentation · testnet = + Binance Spot sync."""
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT portfolio_mode, binance_use_testnet FROM user_settings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return "demo"
    mode = row["portfolio_mode"]
    if mode in ("demo", "testnet"):
        return mode
    return "testnet" if row["binance_use_testnet"] else "demo"


def get_binance_use_testnet(user_id: str) -> bool:
    return get_portfolio_mode(user_id) == "testnet"


def get_binance_mainnet(user_id: str) -> bool:
    return False


def set_portfolio_mode(user_id: str, mode: str) -> None:
    if mode not in ("demo", "testnet"):
        raise ValueError(f"Invalid portfolio mode: {mode}")
    init_db()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO user_settings (user_id, binance_use_testnet, portfolio_mode, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id)
            DO UPDATE SET
                binance_use_testnet = excluded.binance_use_testnet,
                portfolio_mode = excluded.portfolio_mode,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, 1 if mode == "testnet" else 0, mode),
        )
        conn.commit()
    finally:
        conn.close()


def set_binance_use_testnet(user_id: str, use_testnet: bool) -> None:
    set_portfolio_mode(user_id, "testnet" if use_testnet else "demo")


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
    """Return holdings as [{symbol, amount, avg_price?}], oldest-added first."""
    init_db()
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT symbol, amount, avg_price FROM holding WHERE user_id = ? "
            "ORDER BY created_at ASC, symbol ASC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        item = {"symbol": r["symbol"], "amount": r["amount"]}
        if r["avg_price"] is not None:
            item["avg_price"] = r["avg_price"]
        out.append(item)
    return out


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


def upsert_holding(
    user_id: str,
    symbol: str,
    amount: float,
    avg_price: Optional[float] = None,
) -> None:
    """Add or update a held amount. Idempotent on (user, symbol)."""
    init_db()
    symbol = symbol.upper()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO holding (user_id, symbol, amount, avg_price, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, symbol)
            DO UPDATE SET
                amount = excluded.amount,
                avg_price = excluded.avg_price,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, symbol, amount, avg_price),
        )
        conn.commit()
    finally:
        conn.close()


def replace_holdings(user_id: str, holdings: list[dict]) -> None:
    """Replace all holdings (e.g. after Binance sync)."""
    init_db()
    conn = _connect()
    try:
        conn.execute("DELETE FROM holding WHERE user_id = ?", (user_id,))
        for h in holdings:
            conn.execute(
                """
                INSERT INTO holding (user_id, symbol, amount, avg_price, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    user_id,
                    h["symbol"].upper(),
                    h["amount"],
                    h.get("avg_price"),
                ),
            )
        conn.commit()
    finally:
        conn.close()


def clear_all_holdings(user_id: str) -> None:
    init_db()
    conn = _connect()
    try:
        conn.execute("DELETE FROM holding WHERE user_id = ?", (user_id,))
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


# ─── Shared digest cache (same symbols, no holdings → one LLM call for all) ─

def get_shared_digest_cache(cache_key: str) -> Optional[dict]:
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT payload FROM digest_shared_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    try:
        return json.loads(row["payload"])
    except (ValueError, TypeError):
        return None


def set_shared_digest_cache(cache_key: str, payload: dict) -> None:
    init_db()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO digest_shared_cache (cache_key, payload, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(cache_key)
            DO UPDATE SET payload = excluded.payload, created_at = CURRENT_TIMESTAMP
            """,
            (cache_key, json.dumps(payload)),
        )
        conn.execute(
            """
            DELETE FROM digest_shared_cache
            WHERE cache_key NOT IN (
                SELECT cache_key FROM digest_shared_cache
                ORDER BY created_at DESC LIMIT 96
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


# ─── Force-refresh budget (per user per UTC hour) ───────────────────────

def can_force_refresh(user_id: str, bucket: str, max_per_hour: int = DIGEST_FORCE_MAX) -> bool:
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT count FROM digest_force_refresh WHERE user_id = ? AND bucket = ?",
            (user_id, bucket),
        ).fetchone()
    finally:
        conn.close()
    return int(row["count"]) < max_per_hour if row else True


def record_force_refresh(user_id: str, bucket: str) -> None:
    init_db()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO digest_force_refresh (user_id, bucket, count)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, bucket)
            DO UPDATE SET count = count + 1
            """,
            (user_id, bucket),
        )
        conn.execute(
            """
            DELETE FROM digest_force_refresh
            WHERE bucket NOT IN (
                SELECT bucket FROM digest_force_refresh
                ORDER BY bucket DESC LIMIT 72
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def force_refresh_remaining(user_id: str, bucket: str, max_per_hour: int = DIGEST_FORCE_MAX) -> int:
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT count FROM digest_force_refresh WHERE user_id = ? AND bucket = ?",
            (user_id, bucket),
        ).fetchone()
    finally:
        conn.close()
    used = int(row["count"]) if row else 0
    return max(0, max_per_hour - used)


# ─── Per-user digest cache (portfolio-weighted digests) ─────────────────

def get_digest_cache(user_id: str, cache_key: str) -> Optional[dict]:
    """Portfolio-weighted digest cache keyed by bucket + holdings fingerprint."""
    init_db()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT payload FROM digest_cache WHERE user_id = ? AND day = ?",
            (user_id, cache_key),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    try:
        return json.loads(row["payload"])
    except (ValueError, TypeError):
        return None


def set_digest_cache(user_id: str, cache_key: str, payload: dict) -> None:
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
            (user_id, cache_key, json.dumps(payload)),
        )
        # Keep the 48 most recent cache entries per user (~2 days).
        conn.execute(
            """
            DELETE FROM digest_cache
            WHERE user_id = ? AND day NOT IN (
                SELECT day FROM digest_cache WHERE user_id = ?
                ORDER BY day DESC LIMIT 48
            )
            """,
            (user_id, user_id),
        )
        conn.commit()
    finally:
        conn.close()
