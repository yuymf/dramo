"""
测试 Seedream AI 的 merge_images 功能

这个脚本用于诊断多图融合失败的问题。
"""
import os
from openai import OpenAI
import sys

from ..env_loader import load_backend_env

load_backend_env()

# 检查 API Key
api_key = os.environ.get("ARK_API_KEY")
if not api_key:
    print("❌ ARK_API_KEY not found in environment")
    sys.exit(1)

print(f"✅ API Key found (first 10 chars): {api_key[:10]}...")

# 初始化客户端
client = OpenAI(
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    api_key=api_key,
)

print("\n" + "="*60)
print("测试 1: 使用公开测试图片 URL (picsum.photos)")
print("="*60)

# 测试用的公开图片 URL（确保可访问）
test_urls = [
    "https://picsum.photos/512/512?random=1",  # 公开测试图片 1
    "https://picsum.photos/512/512?random=2",  # 公开测试图片 2
]

print(f"\n测试参数:")
print(f"  图片数量: {len(test_urls)}")
print(f"  URLs:")
for idx, url in enumerate(test_urls):
    print(f"    [{idx}] {url}")
print(f"  Prompt: A beautiful landscape with mountains and rivers")
print(f"  Size: 2K")

try:
    print("\n🔄 正在调用 Seedream API...")
    response = client.images.generate(
        model="doubao-seedream-4-0-250828",
        prompt="A beautiful landscape with mountains and rivers",
        size="2K",
        response_format="url",
        extra_body={
            "image": test_urls,
            "watermark": False,
            "sequential_image_generation": "disabled",
        },
    )
    
    print("\n✅ 测试 1 成功!")
    print(f"生成了 {len(response.data)} 张图片:")
    for idx, img in enumerate(response.data):
        print(f"  [{idx}] {img.url}")

except Exception as e:
    print("\n❌ 测试 1 失败!")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {str(e)}")
    
    if hasattr(e, 'response'):
        print(f"HTTP 状态: {getattr(e.response, 'status_code', 'N/A')}")
        if hasattr(e.response, 'text'):
            print(f"响应内容: {e.response.text[:500]}")

print("\n" + "="*60)
print("测试 2: 只使用 1 张图片 (作为对照)")
print("="*60)

single_url = ["https://picsum.photos/512/512?random=3"]
print(f"\n测试参数:")
print(f"  图片数量: 1")
print(f"  URL: {single_url[0]}")

try:
    print("\n🔄 正在调用 Seedream API...")
    response = client.images.generate(
        model="doubao-seedream-4-0-250828",
        prompt="A beautiful landscape with mountains and rivers",
        size="2K",
        response_format="url",
        extra_body={
            "image": single_url[0],  # 单张图用字符串
            "watermark": False,
        },
    )
    
    print("\n✅ 测试 2 成功!")
    print(f"生成了 {len(response.data)} 张图片:")
    for idx, img in enumerate(response.data):
        print(f"  [{idx}] {img.url}")

except Exception as e:
    print("\n❌ 测试 2 失败!")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {str(e)}")

print("\n" + "="*60)
print("测试总结")
print("="*60)
print("如果测试 1 失败但测试 2 成功，说明 Seedream API 不支持多图融合。")
print("如果两个测试都失败，说明可能是 API 配置问题。")
print("如果两个测试都成功，说明问题在于你的实际图片 URL。")

