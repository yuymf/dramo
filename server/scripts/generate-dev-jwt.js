#!/usr/bin/env node
/**
 * 生成开发环境用的固定 JWT token
 * 使用与后端相同的 JWT_SECRET 签名
 *
 * 用法：
 * node scripts/generate-dev-jwt.js [userId] [email]
 *
 * 示例：
 * node scripts/generate-dev-jwt.js cmh076lsg0003k9auttwbl5vq dev@example.com
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

function getJwtSecret() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/JWT_SECRET=(.+)/);
    if (match) {
      return match[1].trim();
    }
  }

  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  console.warn('⚠️  警告：使用默认 JWT_SECRET，生产环境请设置 JWT_SECRET 环境变量');
  return 'dev-secret-change-me';
}

const args = process.argv.slice(2);
const userId = args[0] || 'cmh076lsg0003k9auttwbl5vq';
const email = args[1] || 'dev@example.com';

const jwtSecret = getJwtSecret();

const token = jwt.sign(
  {
    userId,
    sub: userId,
    email,
    iss: 'story-agent-dev',
    aud: 'story-agent',
  },
  jwtSecret,
  {
    expiresIn: '3650d',
  }
);

console.log('✅ 开发环境 JWT Token 已生成');
console.log('');
console.log('用户信息:');
console.log(`  userId: ${userId}`);
console.log(`  email:  ${email}`);
console.log('');
console.log('Token:');
console.log(token);
console.log('');
console.log('提示：
- 将该 token 作为 Bearer Token 使用（Authorization: Bearer <token>）
- 确保后端 JWT_SECRET 与生成时一致');
