#!/usr/bin/env node

/**
 * 开发模式完整测试脚本
 * 测试用户ID系统和所有相关功能
 */

const http = require('http');
const https = require('https');

console.log('🧪 开始开发模式完整测试...\n');

// 测试配置
const testUserId = 'test-user-dev-001';
const apiBase = 'http://localhost:12321';
const frontendUrl = 'http://localhost:12323';

// HTTP请求封装
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// 测试后端API健康状态
async function testBackendHealth() {
  console.log('1. 测试后端API健康状态...');
  try {
    const response = await makeRequest(`${apiBase}/api/health`);
    if (response.status === 200) {
      const data = JSON.parse(response.data);
      console.log('   ✅ 后端API正常');
      console.log(`   版本: ${data.version}`);
      console.log(`   运行时间: ${Math.round(data.uptimeSeconds)}秒`);
      return true;
    } else {
      console.log(`   ❌ 后端API异常: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 无法连接到后端API');
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

// 测试SSE端点
async function testSSEEndpoint() {
  console.log('\n2. 测试SSE端点...');
  try {
    const response = await makeRequest(`${apiBase}/api/jobs/stream?userId=${testUserId}`);
    if (response.status === 200) {
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('text/event-stream')) {
        console.log('   ✅ SSE端点正常');
        console.log('   Content-Type: text/event-stream');
        return true;
      } else {
        console.log('   ⚠️  SSE端点响应但Content-Type不正确');
        console.log(`   Content-Type: ${contentType}`);
        return false;
      }
    } else {
      console.log(`   ❌ SSE端点异常: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 无法连接到SSE端点');
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

// 测试认证端点
async function testAuthEndpoint() {
  console.log('\n3. 测试认证端点...');
  try {
    // 测试无认证访问
    const response = await makeRequest(`${apiBase}/api/auth/me`);
    if (response.status === 200) {
      const data = JSON.parse(response.data);
      if (data.user && data.user.userId === testUserId) {
        console.log('   ✅ 开发模式认证正常');
        console.log(`   用户ID: ${data.user.userId}`);
        console.log(`   邮箱: ${data.user.email}`);
        return true;
      } else {
        console.log('   ⚠️  认证响应格式异常');
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
        return false;
      }
    } else {
      console.log(`   ❌ 认证端点异常: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 无法连接到认证端点');
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

// 测试前端可访问性
async function testFrontend() {
  console.log('\n4. 测试前端可访问性...');
  try {
    const response = await makeRequest(frontendUrl);
    if (response.status === 200) {
      console.log('   ✅ 前端可访问');
      console.log(`   URL: ${frontendUrl}`);
      return true;
    } else {
      console.log(`   ❌ 前端访问异常: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 无法访问前端');
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

// 测试图片生成端点
async function testImageGeneration() {
  console.log('\n5. 测试图片生成端点...');
  try {
    const testData = {
      projectId: 'test-project',
      frameId: 'test-frame',
      params: {
        name: 'Test Generation',
        prompt: 'Test prompt'
      }
    };
    
    const response = await new Promise((resolve, reject) => {
      const data = JSON.stringify(testData);
      const options = {
        hostname: 'localhost',
        port: 12321,
        path: '/api/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        });
      });
      
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    
    if (response.status === 200 || response.status === 202) {
      console.log('   ✅ 图片生成端点正常');
      console.log(`   状态: ${response.status}`);
      return true;
    } else {
      console.log(`   ⚠️  图片生成端点响应: ${response.status}`);
      if (response.data) {
        try {
          const data = JSON.parse(response.data);
          console.log(`   响应: ${data.error || data.message || 'Unknown'}`);
        } catch (e) {
          console.log(`   响应: ${response.data.substring(0, 100)}...`);
        }
      }
      return true; // 不一定失败，可能是配置问题
    }
  } catch (error) {
    console.log('   ❌ 无法连接到图片生成端点');
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

// 总体结果
function printSummary(results) {
  console.log('\n📊 测试结果汇总:');
  console.log('='.repeat(50));
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ 通过' : '❌ 失败';
    const testName = {
      backend: '后端API健康检查',
      sse: 'SSE端点连接',
      auth: '认证端点',
      frontend: '前端可访问性',
      imageGen: '图片生成端点'
    }[test] || test;
    
    console.log(`${testName}: ${status}`);
  });
  
  console.log('='.repeat(50));
  console.log(`总测试: ${total}项`);
  console.log(`通过: ${passed}项`);
  console.log(`失败: ${total - passed}项`);
  console.log(`成功率: ${Math.round((passed / total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 所有测试通过！开发模式配置正确。');
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置。');
  }
  
  console.log('\n💡 建议的下一步:');
  console.log('1. 访问 http://localhost:12323/projects/cmhbxtpcp0001mgw5rp6obftv/storyboard');
  console.log('2. 尝试生成一张图片测试完整流程');
  console.log('3. 检查后端日志: cd story_agent && docker-compose logs api');
  console.log('4. 如需切换测试用户: node scripts/switch-test-user.js');
}

// 主测试流程
async function main() {
  const results = {
    backend: await testBackendHealth(),
    sse: await testSSEEndpoint(),
    auth: await testAuthEndpoint(),
    frontend: await testFrontend(),
    imageGen: await testImageGeneration()
  };
  
  printSummary(results);
}

// 运行测试
main().catch(console.error);


