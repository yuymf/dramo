import pytest
import sys
import os
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_director_workflow_module_importable():
    """Director workflow can be imported without error."""
    from workflows.director_workflow import director_workflow
    assert director_workflow is not None


def test_director_workflow_has_expected_signature():
    """director_workflow accepts projectId, scriptContext, and returns async generator."""
    import inspect
    from workflows.director_workflow import director_workflow
    sig = inspect.signature(director_workflow)
    params = list(sig.parameters.keys())
    assert 'project_id' in params
    assert 'script_context' in params
