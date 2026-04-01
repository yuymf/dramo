#!/usr/bin/env python3
"""
AgentOS AI 服务集成测试
验证腾讯混元和火山引擎 API 是否可用
"""

import os
import sys
import asyncio
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 加载环境变量
from agentos.env_loader import load_backend_env
load_backend_env()

from agentos.config import get_provider_config, get_available_providers


def test_hunyuan_config():
    """测试腾讯混元配置"""
    print("=" * 50)
    print("🔍 测试腾讯混元配置")
    print("=" * 50)

    api_key = os.getenv("HUNYUAN_OPENAPI_KEY")
    model_id = os.getenv("HUNYUAN_MODEL_ID")
    api_url = os.getenv("HUNYUAN_OPENAPI_URL")

    checks = {
        "API Key": bool(api_key),
        "Model ID": bool(model_id),
        "API URL": bool(api_url),
    }

    for key, value in checks.items():
        status = "✅" if value else "❌"
        print(f"{status} {key}: {value}")

    if api_key:
        print(f"   Key: {api_key[:20]}...")
    if model_id:
        print(f"   Model: {model_id}")
    if api_url:
        print(f"   URL: {api_url}")

    return all(checks.values())


def test_ark_config():
    """测试火山引擎配置"""
    print("\n" + "=" * 50)
    print("🔍 测试火山引擎配置")
    print("=" * 50)

    api_key = os.getenv("ARK_API_KEY")
    api_base = os.getenv("ARK_API_BASE")

    checks = {
        "API Key": bool(api_key),
        "API Base": bool(api_base),
    }

    for key, value in checks.items():
        status = "✅" if value else "❌"
        print(f"{status} {key}: {value}")

    if api_key:
        print(f"   Key: {api_key[:20]}...")
    if api_base:
        print(f"   Base URL: {api_base}")

    return all(checks.values())


def test_seedream_config():
    """测试 SeedDream 配置"""
    print("\n" + "=" * 50)
    print("🔍 测试 SeedDream 配置")
    print("=" * 50)

    model = os.getenv("SEEDREAM_MODEL")

    checks = {
        "Model": bool(model),
    }

    for key, value in checks.items():
        status = "✅" if value else "❌"
        print(f"{status} {key}: {value}")

    if model:
        print(f"   Model: {model}")

    return all(checks.values())


def test_available_providers():
    """测试可用的 AI 提供商"""
    print("\n" + "=" * 50)
    print("🔍 可用的 AI 提供商")
    print("=" * 50)

    try:
        providers = get_available_providers()

        for provider in providers:
            status = "✅" if provider.get("available") else "❌"
            active = " (当前使用)" if provider.get("active") else ""
            print(f"{status} {provider.get('display_name')}{active}")
            print(f"   Model: {provider.get('model')}")
            print(f"   Available: {provider.get('available')}")

        return True
    except Exception as e:
        print(f"❌ 获取提供商信息失败: {e}")
        return False


def test_model_instantiation():
    """测试模型实例化"""
    print("\n" + "=" * 50)
    print("🔍 测试模型实例化")
    print("=" * 50)

    try:
        from agentos.config import get_model_from_config

        hunyuan_config = {
            "model_id": os.getenv("HUNYUAN_MODEL_ID", "hunyuan-standard-256k"),
            "api_key": os.getenv("HUNYUAN_OPENAPI_KEY"),
            "base_url": os.getenv("HUNYUAN_OPENAPI_URL")
        }

        if hunyuan_config["api_key"] and hunyuan_config["base_url"]:
            model = get_model_from_config(hunyuan_config)
            print(f"✅ 腾讯混元模型实例化成功")
            print(f"   Model ID: {model.id}")
            print(f"   Base URL: {model.base_url}")
        else:
            print(f"❌ 缺少必要的腾讯混元配置")
            return False

        return True
    except Exception as e:
        print(f"❌ 模型实例化失败: {e}")
        return False


def main():
    """主测试函数"""
    print("\n" + "=" * 70)
    print("AgentOS AI 服务集成测试")
    print("=" * 70 + "\n")

    results = {
        "腾讯混元配置": test_hunyuan_config(),
        "火山引擎配置": test_ark_config(),
        "SeedDream 配置": test_seedream_config(),
        "可用提供商": test_available_providers(),
        "模型实例化": test_model_instantiation(),
    }

    # 汇总
    print("\n" + "=" * 70)
    print("✨ 测试汇总")
    print("=" * 70)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"\n总体: {passed}/{total} 测试通过")

    if passed == total:
        print("\n🎉 所有测试都通过了！AI 服务已正确配置。")
        return 0
    else:
        print("\n⚠️ 部分测试失败，请检查环境变量配置。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
