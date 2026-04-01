#!/usr/bin/env node

/**
 * API 连通性测试脚本
 * 测试腾讯混元、火山引擎和本地 AgentOS 的连接
 */

const https = require('https');
const http = require('http');

const configs = {
  hunyuan: {
    name: '腾讯混元 (Hunyuan)',
    protocol: 'http',
    host: 'hunyuanapi.woa.com',
    port: 80,
    path: '/openapi/v1/chat/completions',
    method: 'POST',
    apiKey: '9BDyz2GvcNH3H9YVJEfe7SoS4GfOtF6N',
    modelId: 'hunyuan-standard-256k',
    timeout: 10000
  },
  ark: {
    name: '火山引擎 (ByteDance ARK)',
    protocol: 'https',
    host: 'ark.cn-beijing.volces.com',
    port: 443,
    path: '/api/v3/chat/completions',
    method: 'POST',
    apiKey: 'f72cc4de-eb29-4d91-b4bd-daf49887edd1',
    timeout: 10000
  },
  agentos: {
    name: '本地 AgentOS',
    protocol: 'http',
    host: 'localhost',
    port: 12322,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  }
};

async function testAPI(config) {
  return new Promise((resolve) => {
    const client = config.protocol === 'https' ? https : http;

    const options = {
      hostname: config.host,
      port: config.port,
      path: config.path,
      method: config.method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: config.timeout
    };

    // 添加 API 密钥
    if (config.apiKey) {
      if (config.name.includes('混元')) {
        options.headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (config.name.includes('火山')) {
        options.headers['Authorization'] = `Bearer ${config.apiKey}`;
      }
    }

    const startTime = Date.now();

    const req = client.request(options, (res) => {
      const elapsed = Date.now() - startTime;

      if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 400) {
        // 200: 成功，401/400: API 认证或格式问题，说明连接通
        resolve({
          name: config.name,
          connected: true,
          statusCode: res.statusCode,
          elapsed: elapsed,
          message: `✅ 连通 (HTTP ${res.statusCode}, ${elapsed}ms)`
        });
      } else if (res.statusCode === 502 || res.statusCode === 503) {
        resolve({
          name: config.name,
          connected: false,
          statusCode: res.statusCode,
          elapsed: elapsed,
          message: `❌ 服务不可用 (HTTP ${res.statusCode})`
        });
      } else {
        resolve({
          name: config.name,
          connected: true,
          statusCode: res.statusCode,
          elapsed: elapsed,
          message: `⚠️ 响应异常 (HTTP ${res.statusCode}, ${elapsed}ms)`
        });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: config.name,
        connected: false,
        elapsed: config.timeout,
        message: `❌ 超时 (>${config.timeout}ms)`
      });
    });

    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      resolve({
        name: config.name,
        connected: false,
        elapsed: elapsed,
        error: error.code || error.message,
        message: `❌ 连接失败: ${error.code || error.message} (${elapsed}ms)`
      });
    });

    // 发送测试数据（POST 请求）
    if (config.method === 'POST') {
      const payload = JSON.stringify({
        model: config.modelId,
        messages: [
          { role: 'user', content: 'test' }
        ],
        max_tokens: 100
      });
      req.write(payload);
    }

    req.end();
  });
}

async function runTests() {
  console.log('🔍 开始 API 连通性测试...\n');

  const results = [];

  for (const [key, config] of Object.entries(configs)) {
    console.log(`测试 ${config.name}...`);
    const result = await testAPI(config);
    results.push(result);
    console.log(`  ${result.message}\n`);
  }

  // 汇总结果
  console.log('========== 测试汇总 ==========');
  const connectedCount = results.filter(r => r.connected).length;
  console.log(`\n连通: ${connectedCount}/${results.length}\n`);

  results.forEach(r => {
    console.log(`${r.name}: ${r.message}`);
  });

  // 配置说明
  console.log('\n========== 环境变量配置 ==========\n');
  console.log('已配置在 server/.env 中:');
  console.log('- HUNYUAN_OPENAPI_KEY=9BDyz2GvcNH3H9YVJEfe7SoS4GfOtF6N');
  console.log('- HUNYUAN_MODEL_ID=hunyuan-standard-256k');
  console.log('- HUNYUAN_OPENAPI_URL=http://hunyuanapi.woa.com/openapi/v1/');
  console.log('- ARK_API_KEY=f72cc4de-eb29-4d91-b4bd-daf49887edd1');
  console.log('- ARK_API_BASE=https://ark.cn-beijing.volces.com/api/v3');
  console.log('- SEEDREAM_MODEL=seedream-latest');
}

runTests().catch(console.error);
