"""Global AI call rate limiter — stay under free-tier RPM (Gemini = 5/min).

All LLM completions go through `acquire()` before hitting a provider so bursts
from many users (or one user spamming refresh) queue instead of burning quota
with 429s and wasted fallback hops.
"""

import os
import threading
import time

# Headroom under Gemini free-tier 5 RPM; override via AI_MAX_RPM env.
_MAX = int(os.environ.get("AI_MAX_RPM", "4"))
_window: list[float] = []
_lock = threading.Lock()


def acquire() -> None:
    """Block until a call slot is available (rolling 60s window)."""
    while True:
        with _lock:
            now = time.monotonic()
            _window[:] = [t for t in _window if now - t < 60.0]
            if len(_window) < _MAX:
                _window.append(now)
                return
            wait = 60.0 - (now - _window[0]) + 0.05
        time.sleep(max(wait, 0.05))
