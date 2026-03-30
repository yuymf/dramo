"""
AgentOS Storyboard Workflow v2
4-phase pipeline: screenplay → plan_panels → (cinematographer ‖ acting_direction) → detail_refiner
Processes clips concurrently with ThreadPoolExecutor.
"""
from agno.agent import Agent
from agno.workflow import Workflow, Step, StepInput, StepOutput
from typing import List, Dict, Any
import logging
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import get_model_from_config

try:
    from ..env_loader import load_backend_env
except ImportError:
    from env_loader import load_backend_env

try:
    from ..lib.json_utils import safe_parse_json
except ImportError:
    from lib.json_utils import safe_parse_json

load_backend_env()
logger = logging.getLogger(__name__)

_MAX_LLM_CONCURRENCY = 10
LLM_CONCURRENCY = min(int(os.getenv("LLM_CONCURRENCY", "3")), _MAX_LLM_CONCURRENCY)

# ============ Helpers ============

try:
    from ..lib.prompt_loader import load_prompt as _load_prompt
except ImportError:
    from lib.prompt_loader import load_prompt as _load_prompt


def merge_scenes(scene_lists: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Merge scenes from multiple chunks and renumber scenes + shots globally"""
    merged = []
    scene_counter = 1
    shot_counter = 1

    for scenes in scene_lists:
        for scene in scenes:
            new_scene = dict(scene)
            new_scene['id'] = f"scene-{scene_counter}"
            scene_counter += 1

            new_shots = []
            for shot in scene.get('shots', []):
                new_shot = dict(shot)
                new_shot['shot_number'] = f"{shot_counter:03d}"
                shot_counter += 1
                new_shots.append(new_shot)
            new_scene['shots'] = new_shots
            merged.append(new_scene)

    return merged


def _parse_input(step_input: StepInput) -> Dict[str, Any]:
    """Parse workflow input from StepInput"""
    raw_input = getattr(step_input, 'input', None)
    if raw_input is None:
        return {}
    if isinstance(raw_input, str):
        return safe_parse_json(raw_input, expected_type=dict, fallback={})
    if isinstance(raw_input, dict):
        return raw_input
    return {}


def _get_previous_output(step_input: StepInput) -> Dict[str, Any]:
    """Get previous step output"""
    if hasattr(step_input, 'previous_step_outputs') and step_input.previous_step_outputs:
        outputs_list = list(step_input.previous_step_outputs.values())
        if outputs_list:
            last = outputs_list[-1]
            if hasattr(last, 'content'):
                content = last.content
                if isinstance(content, dict):
                    return content
                if isinstance(content, str):
                    return safe_parse_json(content, expected_type=dict, fallback={})
    return {}


# ============ Workflow ============

class StoryboardWorkflow(Workflow):
    """4-phase storyboard workflow: screenplay → plan → enrich → refine"""

    def __init__(self):
        self._prompts = {
            'screenplay': _load_prompt("screenplay/screenplay_conversion.md"),
            'plan_panels': _load_prompt("storyboard/plan_panels.md"),
            'cinematographer': _load_prompt("storyboard/cinematographer.md"),
            'acting_direction': _load_prompt("storyboard/acting_direction.md"),
            'detail_refiner': _load_prompt("storyboard/detail_refiner.md"),
        }

        super().__init__(
            name="StoryboardWorkflow",
            description="Generates storyboard from drama text (4-phase pipeline)",
            steps=[
                Step(name="prepare", description="Validate input and convert screenplay to clips",
                     executor=self.prepare_step),
                Step(name="process_clips", description="Process each clip through 4-phase pipeline",
                     executor=self.process_clips_step),
                Step(name="merge", description="Merge and finalize scenes",
                     executor=self.merge_step),
            ]
        )

    # ---- Phase 0: screenplay conversion ----

    def _screenplay_conversion(self, text: str, model: Any) -> List[Dict[str, Any]]:
        """Convert raw text to structured clips via LLM"""
        agent = Agent(
            name="Screenplay Converter",
            model=model,
            instructions=self._prompts['screenplay'],
            markdown=False,
        )
        response = agent.run(f"请将以下剧本文本转换为结构化 clips：\n\n{text}")
        clips = safe_parse_json(response.content, expected_type=list, fallback=[])
        if not clips:
            logger.warning("[screenplay_conversion] LLM returned empty clips, falling back to single clip")
            clips = [{"clip_id": "clip-001", "summary": "完整内容", "location": "未指定",
                      "characters": [], "content": [{"type": "action", "text": text}]}]
        return clips

    def prepare_step(self, step_input: StepInput) -> Dict[str, Any]:
        """Phase 0: validate LLM config, run screenplay conversion, build assets_context"""
        workflow_input = _parse_input(step_input)

        llm_config = workflow_input.get("_llm_config")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        text = workflow_input.get("text", "")
        if not text:
            raise ValueError("text is required")

        characters_lib = workflow_input.get("characters_lib") or []
        locations_lib = workflow_input.get("locations_lib") or []

        model = get_model_from_config(llm_config)

        logger.info("[prepare_step] Running screenplay conversion")
        clips = self._screenplay_conversion(text, model)
        logger.info(f"[prepare_step] Got {len(clips)} clips")

        logger.info(json.dumps({"type": "progress", "phase": "clips_ready",
                                "total_clips": len(clips), "progress": 10}))

        return StepOutput(content={
            "clips": clips,
            "assets_context": {
                "characters_lib": characters_lib,
                "locations_lib": locations_lib,
            },
            "_llm_config": llm_config,
            "projectId": workflow_input.get("projectId", ""),
        })

    # ---- Phase 1-3: per-clip pipeline ----

    def _plan_panels(self, clip: Dict[str, Any], assets_context: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 1: generate panel drafts for one clip"""
        prompt = (
            self._prompts['plan_panels']
            .replace("{clip_json}", json.dumps(clip, ensure_ascii=False))
            .replace("{characters_lib}", json.dumps(assets_context.get("characters_lib", []), ensure_ascii=False))
            .replace("{locations_lib}", json.dumps(assets_context.get("locations_lib", []), ensure_ascii=False))
        )
        agent = Agent(name="Panel Planner", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请为这个 clip 规划镜头序列草稿。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _cinematographer(self, panels: List[Dict], assets_context: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 2a: generate cinematography package for panels"""
        prompt = (
            self._prompts['cinematographer']
            .replace("{panels_json}", json.dumps(panels, ensure_ascii=False))
            .replace("{panel_count}", str(len(panels)))
            .replace("{locations_lib}", json.dumps(assets_context.get("locations_lib", []), ensure_ascii=False))
        )
        agent = Agent(name="Cinematographer", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请为这些面板生成摄影规则包。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _acting_direction(self, panels: List[Dict], assets_context: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 2b: generate acting direction for panels"""
        prompt = (
            self._prompts['acting_direction']
            .replace("{panels_json}", json.dumps(panels, ensure_ascii=False))
            .replace("{panel_count}", str(len(panels)))
            .replace("{characters_lib}", json.dumps(assets_context.get("characters_lib", []), ensure_ascii=False))
        )
        agent = Agent(name="Acting Director", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请为这些面板生成表演指导。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _detail_refiner(self, panels: List[Dict], cinematography: List[Dict],
                        acting: List[Dict], clip: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 3: integrate Phase1+2a+2b into final Shot[]"""
        prompt = (
            self._prompts['detail_refiner']
            .replace("{panels_json}", json.dumps(panels, ensure_ascii=False))
            .replace("{cinematography_json}", json.dumps(cinematography, ensure_ascii=False))
            .replace("{acting_json}", json.dumps(acting, ensure_ascii=False))
            .replace("{clip_content}", json.dumps(clip.get("content", []), ensure_ascii=False))
        )
        agent = Agent(name="Detail Refiner", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请整合生成最终分镜面板。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _process_single_clip(self, clip_index: int, clip: Dict, total_clips: int,
                              assets_context: Dict, llm_config: dict) -> Dict[str, Any]:
        """Run full 4-phase pipeline for one clip"""
        model = get_model_from_config(llm_config)
        logger.info(f"[clip {clip_index+1}/{total_clips}] Phase 1: plan_panels")
        panels = self._plan_panels(clip, assets_context, model)

        if not panels:
            logger.warning(f"[clip {clip_index+1}] plan_panels returned empty, skipping")
            return {"title": clip.get("location", f"场景{clip_index+1}"),
                    "summary": clip.get("summary", ""), "shots": []}

        logger.info(f"[clip {clip_index+1}/{total_clips}] Phase 2: cinematographer ‖ acting_direction")

        # Phase 2a + 2b in parallel — each gets its own model instance to avoid
        # shared mutable state across concurrent threads.
        cinematography: List[Dict] = []
        acting: List[Dict] = []

        model_cine = get_model_from_config(llm_config)
        model_act = get_model_from_config(llm_config)

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_cine = executor.submit(self._cinematographer, panels, assets_context, model_cine)
            future_act = executor.submit(self._acting_direction, panels, assets_context, model_act)
            try:
                cinematography = future_cine.result(timeout=120)
            except Exception as e:
                logger.warning(f"[clip {clip_index+1}] cinematographer failed: {e}")
                cinematography = []
            try:
                acting = future_act.result(timeout=120)
            except Exception as e:
                logger.warning(f"[clip {clip_index+1}] acting_direction failed: {e}")
                acting = []

        logger.info(f"[clip {clip_index+1}/{total_clips}] Phase 3: detail_refiner")
        shots = self._detail_refiner(panels, cinematography, acting, clip, model)

        if not shots:
            logger.warning(f"[clip {clip_index+1}] detail_refiner empty, using raw panels as fallback")
            shots = [{"shot_number": f"{i+1:03d}", **p} for i, p in enumerate(panels)]

        progress = int(10 + (clip_index + 1) / total_clips * 80)
        logger.info(json.dumps({"type": "progress", "phase": "clip_done",
                                "clip_index": clip_index, "progress": progress}))

        return {
            "title": clip.get("location", f"场景{clip_index+1}"),
            "summary": clip.get("summary", ""),
            "shots": shots,
        }

    def process_clips_step(self, step_input: StepInput) -> Dict[str, Any]:
        """Process all clips in parallel"""
        prev = _get_previous_output(step_input)
        clips = prev.get("clips", [])
        assets_context = prev.get("assets_context", {})
        llm_config = prev.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration missing in previous step output")

        total_clips = len(clips)
        max_workers = LLM_CONCURRENCY

        logger.info(f"[process_clips_step] Processing {total_clips} clips with {max_workers} workers")

        all_scenes = [None] * total_clips

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_index = {
                executor.submit(self._process_single_clip, i, clip, total_clips, assets_context, llm_config): i
                for i, clip in enumerate(clips)
            }
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                try:
                    all_scenes[idx] = future.result()
                except Exception as e:
                    logger.error(f"[clip {idx}] failed: {e}", exc_info=True)
                    all_scenes[idx] = {"title": f"场景{idx+1}", "summary": "", "shots": []}

        return StepOutput(content={"all_scenes": all_scenes, "projectId": prev.get("projectId", "")})

    def merge_step(self, step_input: StepInput) -> StepOutput:
        """Merge all scenes and return final JSON string"""
        prev = _get_previous_output(step_input)
        all_scenes = prev.get("all_scenes", [])
        project_id = prev.get("projectId", "")

        workflow_input = _parse_input(step_input)
        if not project_id:
            project_id = workflow_input.get("projectId", "")

        logger.info(json.dumps({"type": "progress", "phase": "merge_start", "progress": 90}))

        merged_scenes = merge_scenes([[s] for s in all_scenes if s])

        logger.info(json.dumps({"type": "progress", "phase": "complete",
                                "progress": 100, "scene_count": len(merged_scenes)}))

        return StepOutput(content=json.dumps({
            "projectId": project_id,
            "scenes": merged_scenes,
        }, ensure_ascii=False))
