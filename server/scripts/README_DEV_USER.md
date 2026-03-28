# 开发账户创建说明

## 创建开发账户

### 方法1: 使用脚本（需要数据库运行）

确保数据库服务已启动，然后运行：

```bash
cd /Users/halyu/Documents/Code/story_agent
node scripts/create-dev-user.js dev@example.com dev123456 开发用户
```

### 方法2: 通过Docker容器执行

如果使用Docker运行后端，可以在容器内执行：

```bash
# 进入API容器
docker-compose exec api sh

# 在容器内运行脚本
node scripts/create-dev-user.js dev@example.com dev123456 开发用户
```

### 方法3: 通过注册页面

1. 启动前端和后端服务
2. 访问 http://localhost:12323/register
3. 使用以下信息注册：
   - 邮箱: dev@example.com
   - 密码: dev123456
   - 姓名: 开发用户（可选）

### 默认开发账户信息

- **邮箱**: dev@example.com
- **密码**: dev123456
- **姓名**: 开发用户

## 数据库迁移

在创建用户之前，确保已运行数据库迁移：

```bash
# 如果使用Docker
docker-compose exec api npx prisma migrate deploy --schema=src/db/schema.prisma

# 如果本地运行
cd /Users/halyu/Documents/Code/story_agent
npx prisma migrate deploy --schema=src/db/schema.prisma
```

## 注意事项

1. 如果用户已存在，脚本会更新密码
2. 密码会被bcrypt加密存储
3. 确保数据库连接配置正确（检查.env文件中的DATABASE_URL）

