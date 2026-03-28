"""
检查 Supabase 配置和 bucket 权限

这个脚本帮助你快速诊断 Supabase 配置问题。
"""
import os
import sys

from ..env_loader import load_backend_env

# 加载环境变量
env_path = load_backend_env()
if env_path.exists():
    print(f"✅ 加载了后端 .env: {env_path}\n")
else:
    print(f"⚠️  后端 .env 不存在: {env_path}\n")

print("="*60)
print("Supabase 配置检查")
print("="*60)

# 检查配置
storage_driver = os.getenv('STORAGE_DRIVER', 'local')
print(f"\n1. STORAGE_DRIVER: {storage_driver}")

if storage_driver == 'supabase':
    print("   ✅ 使用 Supabase 存储")
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    supabase_bucket = os.getenv('SUPABASE_BUCKET', 'images')
    
    print(f"\n2. SUPABASE_URL: {supabase_url or '❌ 未设置'}")
    if supabase_url:
        print(f"   项目: {supabase_url.replace('https://', '').split('.')[0]}")
    
    print(f"\n3. SUPABASE_SERVICE_ROLE_KEY: {'✅ 已设置' if supabase_key else '❌ 未设置'}")
    if supabase_key:
        print(f"   (前 10 个字符: {supabase_key[:10]}...)")
    
    print(f"\n4. SUPABASE_BUCKET: {supabase_bucket}")
    
    # 测试连接
    if supabase_url and supabase_key:
        print("\n" + "="*60)
        print("测试 Supabase 连接")
        print("="*60)
        
        try:
            from supabase import create_client
            
            print("\n正在连接到 Supabase...")
            client = create_client(supabase_url, supabase_key)
            
            # 列出 bucket
            print(f"\n尝试列出 '{supabase_bucket}' bucket 中的文件...")
            result = client.storage.from_(supabase_bucket).list()
            
            if result:
                print(f"✅ 成功连接！bucket 中有 {len(result)} 个项目")
                
                # 检查 bucket 是否为 public
                print(f"\n正在检查 bucket 权限...")
                buckets = client.storage.list_buckets()
                
                target_bucket = next((b for b in buckets if b.name == supabase_bucket), None)
                if target_bucket:
                    is_public = getattr(target_bucket, 'public', False)
                    if is_public:
                        print(f"✅ Bucket '{supabase_bucket}' 是 PUBLIC")
                        print("   所有文件可以通过公开 URL 访问")
                    else:
                        print(f"⚠️  Bucket '{supabase_bucket}' 是 PRIVATE")
                        print("   文件需要签名 URL 才能访问")
                        print("\n修复方法：")
                        print("1. 登录 Supabase Dashboard")
                        print("2. Storage → 选择 bucket → 点击右上角 '...' → Make public")
            else:
                print(f"⚠️  Bucket '{supabase_bucket}' 是空的或无法访问")
            
        except ImportError:
            print("❌ 未安装 supabase 库")
            print("   运行: pip install supabase")
        except Exception as e:
            print(f"❌ 连接失败: {type(e).__name__}")
            print(f"   错误: {str(e)}")
            
    else:
        print("\n⚠️  配置不完整，无法测试连接")
        
elif storage_driver == 'local':
    print("   使用本地文件存储")
    print("\n   如果要使用 Supabase，需要：")
    print("   1. 在后端 .env 中设置 STORAGE_DRIVER=supabase")
    print("   2. 配置 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET")
else:
    print(f"   ❌ 未知的存储驱动: {storage_driver}")

print("\n" + "="*60)
print("下一步建议")
print("="*60)

if storage_driver == 'supabase':
    print("\n如果 bucket 是 PRIVATE:")
    print("→ 将其设为 PUBLIC 以允许 Seedream AI 访问图片")
    print("\n如果已经是 PUBLIC 但仍有问题:")
    print("→ 运行 test_supabase_urls.py 测试实际的图片 URL")
else:
    print("\n当前使用本地存储，Seedream AI 无法访问本地文件。")
    print("建议切换到 Supabase 存储。")

