from __future__ import annotations

from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

DEFAULT_ENV_PATH = Path(__file__).resolve().parent.parent / "server" / ".env"


def load_backend_env(env_path: Optional[Path] = None) -> Path:
    """Ensure AgentOS loads environment variables from the backend root."""
    resolved_path = (env_path or DEFAULT_ENV_PATH).resolve()

    if resolved_path.exists():
        load_dotenv(resolved_path)
    else:
        load_dotenv()

    return resolved_path


