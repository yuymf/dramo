#!/usr/bin/env node

/**
 * 用户ID验证脚本
 * 验证前后端用户ID一致性
 */

const fs = require('fs');
const path = require('path');

console.log('=== 用户ID验证脚本 ===\n');

// 1. 检查环境配置
console.log('1. 检查环境配置...');
const backendEnvPath = path.join(__dirname, '../.env');
const frontendEnvPath = path.join(__dirname, '../story_agent_front/.env.local');

if (fs.existsSync(backendEnvPath)) {
  console.log('✅ 后端环境配置文件存在');
  const envContent = fs.readFileSync(backendEnvPath, 'utf8');
  const devTestUserMatch = envContent.match(/DEV_TEST_USER_ID=(.+)/);
  if (devTestUserMatch) {
    console.log(`   DEV_TEST_USER_ID: ${devTestUserMatch[1]}`);
  } else {
    console.log('   ⚠️  未找到 DEV_TEST_USER_ID 配置');
  }
} else {
  console.log('❌ 后端环境配置文件不存在');
}

if (fs.existsSync(frontendEnvPath)) {
  console.log('✅ 前端环境配置文件存在');
  const envContent = fs.readFileSync(frontendEnvPath, 'utf8');
  const publicTestUserMatch = envContent.match(/NEXT_PUBLIC_TEST_USER_ID=(.+)/);
  if (publicTestUserMatch) {
    console.log(`   NEXT_PUBLIC_TEST_USER_ID: ${publicTestUserMatch[1]}`);
  } else {
    console.log('   ⚠️  未找到 NEXT_PUBLIC_TEST_USER_ID 配置');
  }
} else {
  console.log('❌ 前端环境配置文件不存在');
}

// 2. 检查硬编码用户ID
console.log('\n2. 检查硬编码用户ID...');
const hardcodedPattern = 'cmh0744w70000k9auunjnjrvi';

// 检查后端文件
const backendDir = path.join(__dirname, '../src');
const backendFiles = [
  'api/middleware/auth.ts',
  'api/routes/generation-jobs.ts'
];

backendFiles.forEach(file => {
  const filePath = path.join(backendDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(hardcodedPattern)) {
      console.log(`❌ 后端文件 ${file} 仍包含硬编码用户ID`);
    } else {
      console.log(`✅ 后端文件 ${file} 已移除硬编码用户ID`);
    }
  }
});

// 检查前端文件
const frontendDir = path.join(__dirname, '../story_agent_front');
const frontendFiles = [
  'lib/hooks/useJobsSSE/connection.ts'
];

frontendFiles.forEach(file => {
  const filePath = path.join(frontendDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(hardcodedPattern)) {
      console.log(`❌ 前端文件 ${file} 仍包含硬编码用户ID`);
    } else {
      console.log(`✅ 前端文件 ${file} 已移除硬编码用户ID`);
    }
  }
});

// 3. 检查核心用户ID管理系统
console.log('\n3. 检查用户ID管理系统...');
const userIdentityDir = path.join(__dirname, '../src/lib/user-identity');
const requiredFiles = ['index.ts', 'constants.ts', 'config.ts'];

requiredFiles.forEach(file => {
  const filePath = path.join(userIdentityDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
  }
});

// 4. 测试API连接
console.log('\n4. 测试API连接...');
const testAPIConnection = async () => {
  try {
    const response = await fetch('http://localhost:12321/api/health', {
      method: 'GET',
    });
    console.log(`✅ 后端API健康检查: ${response.status}`);
  } catch (error) {
    console.log('❌ 无法连接到后端API，请确保服务已启动');
    console.log('   启动命令: cd story_agent && docker-compose up');
  }
};

testAPIConnection();

// 5. 检查SSE连接
console.log('\n5. 测试SSE连接...');
const testSSEConnection = async () => {
  try {
    const response = await fetch('http://localhost:12321/api/jobs/stream?userId=test-user-dev-001', {
      method: 'GET',
    });
    console.log(`✅ SSE端点连接: ${response.status} (${response.statusText})`);
    if (response.status === 200) {
      console.log('   🎉 SSE连接成功！监听器数量应该为1');
    }
  } catch (error) {
    console.log('❌ 无法连接到SSE端点，请确保服务已启动');
    console.log('   启动命令: cd story_agent && docker-compose up');
  }
};

testSSEConnection();

console.log('\n=== 验证完成 ===');
console.log('\n推荐操作:');
console.log('1. 确保前后端服务都已启动');
console.log('2. 访问 http://localhost:12323/projects/cmhbxtpcp0001mgw5rp6obftv/storyboard');
console.log('3. 尝试生成一个图片，验证SSE连接和任务处理');
console.log('4. 检查后端日志确认监听器数量为1');


