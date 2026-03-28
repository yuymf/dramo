/**
 * 创建开发账户脚本
 * 用于在数据库中注册开发用户账户
 * 
 * 使用方法:
 *   node scripts/create-dev-user.js <email> <password> [name]
 * 
 * 示例:
 *   node scripts/create-dev-user.js dev@example.com dev123456 开发用户
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createDevUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('用法: node scripts/create-dev-user.js <email> <password> [name]');
    console.error('示例: node scripts/create-dev-user.js dev@example.com dev123456 开发用户');
    process.exit(1);
  }

  const [email, password, name] = args;

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('错误: 邮箱格式无效');
    process.exit(1);
  }

  // 验证密码长度
  if (password.length < 6) {
    console.error('错误: 密码长度至少为6个字符');
    process.exit(1);
  }

  try {
    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // 如果用户已存在，更新密码
      const hashedPassword = await bcrypt.hash(password, 10);
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          name: name || existingUser.name || email.split('@')[0],
        },
      });

      console.log('✓ 用户已存在，密码已更新');
      console.log(`  邮箱: ${updatedUser.email}`);
      console.log(`  名称: ${updatedUser.name}`);
      console.log(`  ID: ${updatedUser.id}`);
    } else {
      // 创建新用户
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0],
        },
      });

      console.log('✓ 开发账户创建成功');
      console.log(`  邮箱: ${newUser.email}`);
      console.log(`  名称: ${newUser.name}`);
      console.log(`  ID: ${newUser.id}`);
    }
  } catch (error) {
    console.error('错误: 创建用户失败', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDevUser();

