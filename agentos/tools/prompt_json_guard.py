#!/usr/bin/env python3
"""
检查所有提示词文件是否包含 JSON 安全约束声明。
用于 CI 保障：防止提示词文件被修改后丢失关键约束。
"""
import os
import sys
from pathlib import Path

REQUIRED_PHRASE = "JSON 安全"
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
# 不需要 JSON 输出的提示词可加入豁免列表（文件名相对于 prompts/）
EXEMPT_FILES: set = set()


def check_prompts() -> int:
    """返回违规文件数量"""
    violations = []

    if not PROMPTS_DIR.is_dir():
        print(f"❌ 提示词目录不存在：{PROMPTS_DIR}")
        return 1

    for md_file in PROMPTS_DIR.rglob("*.md"):
        rel = str(md_file.relative_to(PROMPTS_DIR))
        if rel in EXEMPT_FILES:
            continue
        try:
            content = md_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            print(f"⚠️ 无法读取文件 {rel}: {e}")
            violations.append(rel)
            continue
        if REQUIRED_PHRASE not in content:
            violations.append(rel)

    if violations:
        print("❌ 以下提示词文件缺少 JSON 安全约束：")
        for v in violations:
            print(f"   prompts/{v}")
        print(f"\n请在文件末尾添加：")
        print('⚠️ JSON 安全：文本值中的所有引号（""\'\'）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。')
        return len(violations)

    total_checked = sum(1 for md_file in PROMPTS_DIR.rglob("*.md")
                       if str(md_file.relative_to(PROMPTS_DIR)) not in EXEMPT_FILES)
    skipped = len(EXEMPT_FILES)
    if skipped:
        print(f"✅ {total_checked} 个提示词文件均包含 JSON 安全约束（已豁免 {skipped} 个）。")
    else:
        print(f"✅ 所有 {total_checked} 个提示词文件均包含 JSON 安全约束。")
    return 0


if __name__ == "__main__":
    sys.exit(check_prompts())
