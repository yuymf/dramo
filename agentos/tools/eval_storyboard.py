"""
Storyboard Workflow Evaluation Tool

Usage:
    python tools/eval_storyboard.py [--input docs/PV02剧本4.0.docx] [--sample-chars 5000]

This script:
1. Extracts text from a script document (Word, PDF, TXT)
2. Runs it through the storyboard workflow locally
3. Evaluates the output quality (scene count, field completeness, JSON validity)
4. Prints a summary report
"""

import argparse
import json
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from storyboard_workflow import StoryboardWorkflow, logger
from docx import Document  # pip install python-docx


def extract_text_from_docx(filepath: str) -> str:
    """Extract plain text from a Word document"""
    doc = Document(filepath)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def evaluate_storyboard(result: dict) -> dict:
    """Evaluate the quality of generated storyboard"""
    metrics = {
        "valid_json": True,
        "has_projectId": "projectId" in result,
        "scene_count": len(result.get("scenes", [])),
        "total_shots": 0,
        "empty_fields": [],
        "invalid_shot_sizes": [],
        "shot_duration_issues": [],
    }
    
    required_shot_fields = [
        "shot_number", "shot_size", "duration_seconds",
        "scene_description", "director_notes", "audio_description",
        "camera_angle", "camera_movement", "focal_length"
    ]
    
    valid_shot_sizes = ["大远景", "远景", "中景", "近景", "特写"]
    
    for scene in result.get("scenes", []):
        for shot in scene.get("shots", []):
            metrics["total_shots"] += 1
            
            # Check empty fields
            for field in required_shot_fields:
                if not shot.get(field) or str(shot.get(field)).strip() == "":
                    metrics["empty_fields"].append(f"Scene {scene.get('id')}, Shot {shot.get('shot_number')}: {field}")
            
            # Check shot_size validity
            shot_size = shot.get("shot_size", "")
            if shot_size not in valid_shot_sizes:
                metrics["invalid_shot_sizes"].append(f"Scene {scene.get('id')}, Shot {shot.get('shot_number')}: '{shot_size}'")
            
            # Check duration_seconds
            duration = shot.get("duration_seconds", 0)
            if not isinstance(duration, int) or duration <= 0 or duration > 60:
                metrics["shot_duration_issues"].append(f"Scene {scene.get('id')}, Shot {shot.get('shot_number')}: {duration}s")
    
    return metrics


def print_report(metrics: dict, elapsed_time: float):
    """Print evaluation report"""
    print("\n" + "="*60)
    print("📊 Storyboard Evaluation Report")
    print("="*60)
    
    print(f"\n✅ Valid JSON: {metrics['valid_json']}")
    print(f"✅ Has projectId: {metrics['has_projectId']}")
    print(f"\n📽️  Scenes: {metrics['scene_count']}")
    print(f"🎬 Total Shots: {metrics['total_shots']}")
    print(f"⏱️  Generation Time: {elapsed_time:.2f}s")
    
    if metrics["empty_fields"]:
        print(f"\n⚠️  Empty Fields ({len(metrics['empty_fields'])}):")
        for issue in metrics["empty_fields"][:10]:  # Show first 10
            print(f"   - {issue}")
        if len(metrics["empty_fields"]) > 10:
            print(f"   ... and {len(metrics['empty_fields']) - 10} more")
    else:
        print("\n✅ No empty fields detected")
    
    if metrics["invalid_shot_sizes"]:
        print(f"\n⚠️  Invalid Shot Sizes ({len(metrics['invalid_shot_sizes'])}):")
        for issue in metrics["invalid_shot_sizes"][:10]:
            print(f"   - {issue}")
        if len(metrics["invalid_shot_sizes"]) > 10:
            print(f"   ... and {len(metrics['invalid_shot_sizes']) - 10} more")
    else:
        print("\n✅ All shot sizes are valid")
    
    if metrics["shot_duration_issues"]:
        print(f"\n⚠️  Duration Issues ({len(metrics['shot_duration_issues'])}):")
        for issue in metrics["shot_duration_issues"][:10]:
            print(f"   - {issue}")
        if len(metrics["shot_duration_issues"]) > 10:
            print(f"   ... and {len(metrics['shot_duration_issues']) - 10} more")
    else:
        print("\n✅ All shot durations are valid")
    
    # Calculate quality score
    total_checks = metrics["total_shots"] * 3  # empty, size, duration
    issues = len(metrics["empty_fields"]) + len(metrics["invalid_shot_sizes"]) + len(metrics["shot_duration_issues"])
    quality_score = max(0, 100 - (issues / total_checks * 100)) if total_checks > 0 else 0
    
    print(f"\n🏆 Quality Score: {quality_score:.1f}%")
    print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Evaluate storyboard workflow quality")
    parser.add_argument("--input", type=str, default="docs/PV02剧本4.0.docx", help="Input script file")
    parser.add_argument("--sample-chars", type=int, default=5000, help="Number of characters to sample for testing")
    parser.add_argument("--output", type=str, default=None, help="Save result JSON to file")
    args = parser.parse_args()
    
    input_path = Path(__file__).parent.parent / args.input
    
    if not input_path.exists():
        print(f"❌ Error: Input file not found: {input_path}")
        sys.exit(1)
    
    print(f"📄 Loading script from: {input_path}")
    
    # Extract text
    if input_path.suffix == ".docx":
        text = extract_text_from_docx(str(input_path))
    elif input_path.suffix == ".txt":
        with open(input_path, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        print(f"❌ Error: Unsupported file type: {input_path.suffix}")
        sys.exit(1)
    
    # Sample text if requested
    if args.sample_chars and args.sample_chars < len(text):
        print(f"✂️  Sampling first {args.sample_chars} characters from {len(text)} total")
        text = text[:args.sample_chars]
    
    print(f"📝 Input text: {len(text)} characters")
    print(f"\n🚀 Running storyboard workflow...\n")
    
    # Run workflow
    import time
    start_time = time.time()
    
    try:
        # Create workflow instance
        workflow = StoryboardWorkflow()
        
        # Run workflow with official Agno API (returns WorkflowRunOutput)
        workflow_response = workflow.run(
            input={
                "projectId": "eval-test",
                "text": text,
                "chunk_tokens": 1200
            }
        )
        
        elapsed_time = time.time() - start_time
        
        # Extract result from WorkflowRunOutput
        # The content might be a string or dict
        if hasattr(workflow_response, 'content'):
            content = workflow_response.content
            if isinstance(content, str):
                # Try to parse as JSON
                try:
                    result = json.loads(content)
                except json.JSONDecodeError:
                    # If it's a Python dict string representation
                    import ast
                    result = ast.literal_eval(content)
            else:
                result = content
        else:
            print(f"❌ Error: Unexpected workflow response format: {workflow_response}")
            sys.exit(1)
        
        print(f"\n✅ Workflow completed successfully!")
        print(f"Result preview: projectId={result.get('projectId')}, scenes={len(result.get('scenes', []))}")
        
        # Evaluate
        metrics = evaluate_storyboard(result)
        
        # Print report
        print_report(metrics, elapsed_time)
        
        # Save output if requested
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"💾 Result saved to: {output_path}")
        
    except Exception as e:
        print(f"\n❌ Error during workflow execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

