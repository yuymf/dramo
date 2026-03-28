#!/usr/bin/env node

/**
 * 测试用户切换脚本
 * 快速切换不同测试用户进行开发和测试
 */

const fs = require('fs');
const path = require('path');

// 可用的测试用户
const TEST_USERS = {
  '1': 'test-user-dev-001',  // 主要测试用户
  '2': 'test-user-dev-002',  // 次要测试用户
  '3': 'test-user-dev-003',  // 管理员测试用户
  '4': 'test-user-dev-004'   // 访客测试用户
};

function showMenu() {
  console.log('\n=== 测试用户切换工具 ===\n');
  console.log('可用的测试用户:');
  Object.entries(TEST_USERS).forEach(([key, userId]) => {
    const description = {
      'test-user-dev-001': '主要测试用户',
      'test-user-dev-002': '次要测试用户', 
      'test-user-dev-003': '管理员测试用户',
      'test-user-dev-004': '访客测试用户'
    }[userId];
    console.log(`${key}. ${userId} - ${description}`);
  });
  console.log('\n操作选项:');
  console.log('1-4. 切换到指定测试用户');
  console.log('s. 查看当前配置');
  console.log('t. 测试SSE连接');
  console.log('q. 退出');
  console.log('\n请选择操作:');
}

function getCurrentTestUser() {
  // 检查后端环境配置
  const backendEnvPath = path.join(__dirname, '../.env');
  if (fs.existsSync(backendEnvPath)) {
    const content = fs.readFileSync(backendEnvPath, 'utf8');
    const match = content.match(/DEV_TEST_USER_ID=(.+)/);
    if (match) {
      return match[1];
    }
  }
  
  // 检查前端环境配置
  const frontendEnvPath = path.join(__dirname, '../story_agent_front/.env.local');
  if (fs.existsSync(frontendEnvPath)) {
    const content = fs.readFileSync(frontendEnvPath, 'utf8');
    const match = content.match(/NEXT_PUBLIC_TEST_USER_ID=(.+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

function updateTestUser(userId) {
  console.log(`\n正在切换到测试用户: ${userId}...\n`);
  
  // 更新后端环境配置
  const backendEnvPath = path.join(__dirname, '../.env');
  if (fs.existsSync(backendEnvPath)) {
    let content = fs.readFileSync(backendEnvPath, 'utf8');
    
    // 更新或添加DEV_TEST_USER_ID
    if (content.includes('DEV_TEST_USER_ID=')) {
      content = content.replace(/DEV_TEST_USER_ID=.+/, `DEV_TEST_USER_ID=${userId}`);
    } else {
      content += `\nDEV_TEST_USER_ID=${userId}`;
    }
    
    fs.writeFileSync(backendEnvPath, content);
    console.log('✅ 后端环境配置已更新');
  } else {
    console.log('⚠️  后端环境配置文件不存在');
  }
  
  // 更新前端环境配置
  const frontendEnvPath = path.join(__dirname, '../story_agent_front/.env.local');
  if (fs.existsSync(frontendEnvPath)) {
    let content = fs.readFileSync(frontendEnvPath, 'utf8');
    
    // 更新或添加NEXT_PUBLIC_TEST_USER_ID
    if (content.includes('NEXT_PUBLIC_TEST_USER_ID=')) {
      content = content.replace(/NEXT_PUBLIC_TEST_USER_ID=.+/, `NEXT_PUBLIC_TEST_USER_ID=${userId}`);
    } else {
      content += `\nNEXT_PUBLIC_TEST_USER_ID=${userId}`;
    }
    
    fs.writeFileSync(frontendEnvPath, content);
    console.log('✅ 前端环境配置已更新');
  } else {
    console.log('⚠️  前端环境配置文件不存在');
  }
  
  console.log('\n🎉 测试用户切换完成！');
  console.log('请重启前后端服务以应用新配置:');
  console.log('  后端: cd story_agent && docker-compose restart api');
  console.log('  前端: cd story_agent_front && pkill -f "npm run dev" && npm run dev &');
}

async function testSSEConnection() {
  const currentUser = getCurrentTestUser();
  if (!currentUser) {
    console.log('❌ 无法获取当前测试用户ID');
    return;
  }
  
  console.log(`\n测试SSE连接 (用户ID: ${currentUser})...`);
  
  try {
    const response = await fetch(`http://localhost:12321/api/jobs/stream?userId=${currentUser}`, {
      method: 'GET',
    });
    
    if (response.status === 200) {
      console.log('✅ SSE连接成功！');
      console.log(`   监听器事件: job:${currentUser}`);
      console.log('   状态: 准备接收任务更新');
    } else {
      console.log(`❌ SSE连接失败: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('❌ 无法连接到SSE端点');
    console.log('   请确保后端服务已启动: cd story_agent && docker-compose up');
  }
}

function main() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function prompt() {
    showMenu();
    
    rl.question('', (answer) => {
      const choice = answer.trim().toLowerCase();
      
      if (choice === 'q') {
        console.log('\n👋 再见！');
        rl.close();
        return;
      }
      
      if (choice === 's') {
        const currentUser = getCurrentTestUser();
        console.log(`\n当前测试用户: ${currentUser || '未设置'}`);
        prompt();
        return;
      }
      
      if (choice === 't') {
        testSSEConnection().then(() => prompt());
        return;
      }
      
      if (TEST_USERS[choice]) {
        updateTestUser(TEST_USERS[choice]);
        rl.close();
        return;
      }
      
      console.log('\n❌ 无效选择，请重新选择');
      prompt();
    });
  }
  
  prompt();
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { TEST_USERS, getCurrentTestUser, updateTestUser };


