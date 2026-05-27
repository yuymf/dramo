"""
Tests for ImageGenerationService singleton thread safety.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch


def test_get_image_service_is_thread_safe():
    """Concurrent calls to get_image_service() must return the same instance."""
    import services.image_service as mod

    # Reset module-level state before the test
    mod._image_service = None

    results = []
    with patch.object(mod, 'ImageGenerationService', side_effect=mod.ImageGenerationService) as MockCls:
        def call():
            results.append(mod.get_image_service())

        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = [pool.submit(call) for _ in range(10)]
            for f in futures:
                f.result()

    # All 10 calls returned the same object
    assert len(set(id(r) for r in results)) == 1, "Multiple instances created — not thread-safe"
    # Constructor called exactly once
    assert MockCls.call_count == 1, f"Constructor called {MockCls.call_count} times"
