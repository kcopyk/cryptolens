import time
from typing import Any

_store: dict[str, tuple[Any, float]] = {}
TTL = 60.0


def get(key: str) -> Any | None:
    entry = _store.get(key)
    if entry and time.monotonic() - entry[1] < TTL:
        return entry[0]
    return None


def set(key: str, value: Any) -> None:
    _store[key] = (value, time.monotonic())


def get_stale(key: str) -> Any | None:
    entry = _store.get(key)
    return entry[0] if entry else None
