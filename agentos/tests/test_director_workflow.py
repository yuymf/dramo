import inspect
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_director_workflow_module_importable():
    from workflows.director_workflow import DirectorWorkflow
    assert DirectorWorkflow is not None


def test_director_workflow_is_agno_workflow():
    from agno.workflow import Workflow
    from workflows.director_workflow import DirectorWorkflow
    assert issubclass(DirectorWorkflow, Workflow)


def test_director_workflow_has_analyze_step():
    from workflows.director_workflow import DirectorWorkflow
    assert hasattr(DirectorWorkflow, '_analyze')
    sig = inspect.signature(DirectorWorkflow._analyze)
    params = list(sig.parameters.keys())
    assert 'execution_input' in params
