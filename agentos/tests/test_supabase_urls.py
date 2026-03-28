"""
测试实际的 Supabase Storage URL 可访问性

这个脚本用于验证 Supabase URL 是否能被 Seedream API 访问。
"""
import requests
import sys

print("="*60)
print("Supabase URL 可访问性测试")
print("="*60)

# 说明：请从浏览器控制台或日志中复制实际的 Supabase URL
# 示例 URL 格式：
example_urls = [
    # "https://你的项目.supabase.co/storage/v1/object/public/images/...",
    # "https://你的项目.supabase.co/storage/v1/object/sign/images/...?token=...",
]

print("\n请执行以下步骤获取实际 URL：")
print("1. 在分镜页面打开浏览器控制台（F12）")
print("2. 添加 2 张参考图片")
print("3. 点击 Generate 按钮")
print("4. 在控制台中找到 '[GeneratorModal] Generating with references'")
print("5. 复制显示的 images 数组中的 URL")
print("6. 将 URL 粘贴到下面的 test_urls 列表中\n")

test_urls = [
    # 在这里粘贴你的实际 Supabase URL
    # "https://...",
    # "https://...",
]

if not test_urls:
    print("⚠️  请先添加实际的 URL 到 test_urls 列表中！")
    print("\n作为演示，我将测试一个典型的 Supabase URL 格式...")
    print("（这个测试会失败，因为不是你的实际 URL）\n")
    
    # 示例 URL（会失败）
    test_urls = [
        "https://example.supabase.co/storage/v1/object/public/images/test.jpg",
    ]

print(f"\n测试 {len(test_urls)} 个 URL 的可访问性：\n")

all_accessible = True

for idx, url in enumerate(test_urls):
    print(f"[{idx+1}] 测试: {url[:70]}...")
    
    try:
        # 测试 HEAD 请求（不下载完整内容）
        response = requests.head(url, timeout=10, allow_redirects=True)
        
        if response.status_code == 200:
            print(f"    ✅ 可访问 (HTTP {response.status_code})")
            print(f"    Content-Type: {response.headers.get('content-type', 'N/A')}")
            print(f"    Content-Length: {response.headers.get('content-length', 'N/A')} bytes")
        else:
            print(f"    ❌ 不可访问 (HTTP {response.status_code})")
            all_accessible = False
            
            # 如果是 403，提示可能的原因
            if response.status_code == 403:
                print(f"    💡 原因：Supabase bucket 可能未设为 public")
            elif response.status_code == 404:
                print(f"    💡 原因：图片不存在或路径错误")
    
    except requests.exceptions.Timeout:
        print(f"    ❌ 超时")
        all_accessible = False
    except requests.exceptions.ConnectionError as e:
        print(f"    ❌ 连接失败: {str(e)[:100]}")
        all_accessible = False
    except Exception as e:
        print(f"    ❌ 错误: {type(e).__name__}: {str(e)[:100]}")
        all_accessible = False
    
    print()

print("="*60)
print("测试结果总结")
print("="*60)

if all_accessible and test_urls and "example.supabase" not in test_urls[0]:
    print("✅ 所有 URL 都可以公开访问")
    print("   问题可能在其他地方，需要进一步调查。")
elif not all_accessible:
    print("❌ 有 URL 无法公开访问")
    print("\n解决方案：")
    print("1. 在 Supabase Dashboard 中将 bucket 设为 public")
    print("2. 或者使用签名 URL（需要后端支持）")
    print("3. 或者只使用第一张参考图（临时方案）")
else:
    print("⚠️  请添加实际的 Supabase URL 进行测试")

print("\n下一步：")
print("1. 如果 URL 可访问但仍然报错，查看 AgentOS 日志")
print("2. 如果 URL 不可访问，需要修改 Supabase 权限设置")

