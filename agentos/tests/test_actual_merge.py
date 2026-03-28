"""
使用实际的 Supabase URL 测试多图融合

这个脚本会：
1. 测试实际 Supabase URL 的可访问性
2. 使用这些 URL 调用 Seedream API
3. 定位具体的失败点
"""
import os
from openai import OpenAI
import requests
import sys

from ..env_loader import load_backend_env

# 加载后端的 .env 文件
env_path = load_backend_env()
if env_path.exists():
    print(f"✅ 加载了后端 .env: {env_path}\n")
else:
    print(f"⚠️  后端 .env 不存在: {env_path}\n")

print("="*60)
print("实际 URL 多图融合测试")
print("="*60)

# 从你的 Supabase 获取实际 URL
# 请在这里粘贴你实际的图片 URL
ACTUAL_URLS = [
    # 示例：从浏览器控制台或者数据库中获取
    # "https://ypiujdwrugmotyqqucef.supabase.co/storage/v1/object/public/images/...",
    # "https://ypiujdwrugmotyqqucef.supabase.co/storage/v1/object/public/images/...",
]

# 如果没有提供 URL，尝试从 Supabase 获取最近的图片
if not ACTUAL_URLS:
    print("\n⚠️  没有提供测试 URL，尝试从 Supabase 获取最近的图片...\n")
    
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        bucket_name = os.getenv('SUPABASE_BUCKET', 'images')
        
        if supabase_url and supabase_key:
            client = create_client(supabase_url, supabase_key)
            
            # 列出最近的文件
            files = client.storage.from_(bucket_name).list()
            
            if files and len(files) > 0:
                # 获取前两个文件的公开 URL
                for i, file in enumerate(files[:2]):
                    if hasattr(file, 'name'):
                        file_path = file.name
                        url_data = client.storage.from_(bucket_name).get_public_url(file_path)
                        ACTUAL_URLS.append(url_data)
                        print(f"[{i}] 获取到 URL: {url_data[:80]}...")
            
            if not ACTUAL_URLS:
                print("❌ Bucket 中没有文件")
                sys.exit(1)
        else:
            print("❌ Supabase 配置不完整")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ 获取 URL 失败: {str(e)}")
        print("\n请手动在脚本中设置 ACTUAL_URLS 变量")
        sys.exit(1)

print(f"\n找到 {len(ACTUAL_URLS)} 个 URL 用于测试\n")

# 步骤 1: 测试 URL 可访问性
print("="*60)
print("步骤 1: 测试 URL 可访问性")
print("="*60)

all_accessible = True
for idx, url in enumerate(ACTUAL_URLS):
    print(f"\n[{idx+1}] 测试: {url[:70]}...")
    
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        
        if response.status_code == 200:
            print(f"    ✅ 可访问 (HTTP {response.status_code})")
            content_type = response.headers.get('content-type', 'N/A')
            content_length = response.headers.get('content-length', 'N/A')
            print(f"    Content-Type: {content_type}")
            print(f"    Content-Length: {content_length} bytes")
        else:
            print(f"    ❌ HTTP {response.status_code}")
            all_accessible = False
    except Exception as e:
        print(f"    ❌ 错误: {type(e).__name__}: {str(e)[:100]}")
        all_accessible = False

if not all_accessible:
    print("\n⚠️  有 URL 无法访问，跳过 API 测试")
    sys.exit(1)

# 步骤 2: 使用 Seedream API 测试多图融合
print("\n" + "="*60)
print("步骤 2: 使用 Seedream API 测试多图融合")
print("="*60)

api_key = os.environ.get("ARK_API_KEY")
if not api_key:
    print("❌ ARK_API_KEY 未设置")
    sys.exit(1)

client = OpenAI(
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    api_key=api_key,
)

print(f"\n测试参数:")
print(f"  图片数量: {len(ACTUAL_URLS)}")
print(f"  Prompt: A beautiful scene combining these elements")
print(f"  URLs:")
for idx, url in enumerate(ACTUAL_URLS):
    print(f"    [{idx}] {url[:70]}...")

try:
    print("\n🔄 正在调用 Seedream API...")
    
    response = client.images.generate(
        model="doubao-seedream-4-0-250828",
        prompt="A beautiful scene combining these elements",
        size="2K",
        response_format="url",
        extra_body={
            "image": ACTUAL_URLS,
            "watermark": False,
            "sequential_image_generation": "disabled",
        },
    )
    
    print("\n✅ 成功！生成了图片:")
    for idx, img in enumerate(response.data):
        print(f"  [{idx}] {img.url[:80]}...")
    
    print("\n" + "="*60)
    print("结论")
    print("="*60)
    print("✅ Supabase URL 可以被 Seedream API 访问")
    print("✅ 多图融合功能正常")
    print("\n如果前端仍然报错，问题可能在：")
    print("1. 前端传递的 URL 格式")
    print("2. 中间层（Next.js/Node.js）的处理")
    print("3. 请求超时或其他网络问题")

except Exception as e:
    print("\n❌ Seedream API 调用失败!")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {str(e)}")
    
    if hasattr(e, 'response'):
        print(f"\nHTTP 状态: {getattr(e.response, 'status_code', 'N/A')}")
        if hasattr(e.response, 'text'):
            print(f"响应内容: {e.response.text[:500]}")
    
    print("\n" + "="*60)
    print("结论")
    print("="*60)
    print("❌ URL 可访问但 Seedream API 拒绝请求")
    print("\n可能的原因：")
    print("1. URL 格式问题（Seedream 不支持这种格式）")
    print("2. 图片内容问题（格式、大小、内容不符合要求）")
    print("3. API 限制或配额问题")

