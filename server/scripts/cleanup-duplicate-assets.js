#!/usr/bin/env node
/**
 * 清理重复和僵尸角色/地点资产
 * 
 * 策略：
 * 1. 删除没有图片的资产（image_count=0）
 * 2. 对于同名角色，只保留最新的一条
 * 3. 可以指定 projectId 只清理特定项目
 * 
 * 用法：
 * node scripts/cleanup-duplicate-assets.js [projectId] [--dry-run]
 * 
 * 示例：
 * node scripts/cleanup-duplicate-assets.js cmh076oof0005k9au29etu6in --dry-run  # 预览
 * node scripts/cleanup-duplicate-assets.js cmh076oof0005k9au29etu6in           # 执行清理
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const projectId = args.find(arg => !arg.startsWith('--'));
const isDryRun = args.includes('--dry-run');

/**
 * 通用资产清理函数
 * @param {Object} options - 配置选项
 * @param {string} options.modelName - 模型名称（用于日志）
 * @param {Function} options.findMany - Prisma findMany 函数
 * @param {Function} options.deleteMany - Prisma deleteMany 函数
 * @param {string} projectId - 项目ID（可选）
 * @returns {Promise<{deleted: number, kept: number}>}
 */
async function cleanupAssets({ modelName, findMany, deleteMany }, projectId) {
  console.log(`\n📊 分析${modelName}资产...\n`);
  
  const where = projectId ? { projectId } : {};
  const assets = await findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`总共 ${assets.length} 条${modelName}资产`);
  
  // 1. 找出没有图片的资产
  const emptyAssets = assets.filter(asset => {
    const images = Array.isArray(asset.images) ? asset.images : JSON.parse(asset.images || '[]');
    return images.length === 0;
  });

  console.log(`\n❌ 发现 ${emptyAssets.length} 条没有图片的僵尸资产：`);
  emptyAssets.forEach(asset => {
    console.log(`  - ${asset.name} (${asset.id}) - ${asset.createdAt.toISOString()}`);
  });

  // 2. 找出重复的资产（按名称分组）
  const assetsByName = {};
  assets.forEach(asset => {
    if (!assetsByName[asset.name]) {
      assetsByName[asset.name] = [];
    }
    assetsByName[asset.name].push(asset);
  });

  const duplicates = Object.entries(assetsByName)
    .filter(([_, list]) => list.length > 1)
    .map(([name, list]) => ({ name, list }));

  console.log(`\n🔄 发现 ${duplicates.length} 组重复的${modelName}资产：`);
  duplicates.forEach(({ name, list }) => {
    console.log(`\n  "${name}" 有 ${list.length} 条记录：`);
    list.forEach((asset, idx) => {
      const images = Array.isArray(asset.images) ? asset.images : JSON.parse(asset.images || '[]');
      const isNewest = idx === 0; // 已按 createdAt desc 排序
      console.log(`    ${isNewest ? '✅ [保留]' : '❌ [删除]'} ${asset.id} - ${images.length} 张图片 - ${asset.createdAt.toISOString()}`);
    });
  });

  // 3. 收集要删除的 ID
  const toDelete = [];
  
  // 删除空资产
  toDelete.push(...emptyAssets.map(a => a.id));
  
  // 删除重复资产（保留每组最新的）
  duplicates.forEach(({ list }) => {
    // 跳过第一条（最新的），删除其余的
    toDelete.push(...list.slice(1).map(a => a.id));
  });

  // 去重
  const uniqueToDelete = [...new Set(toDelete)];

  console.log(`\n📝 清理汇总：`);
  console.log(`  - 将删除 ${uniqueToDelete.length} 条资产`);
  console.log(`  - 保留 ${assets.length - uniqueToDelete.length} 条资产`);

  if (isDryRun) {
    console.log('\n🔍 [预览模式] 未执行删除操作');
    console.log('要执行删除，请移除 --dry-run 参数');
    return { deleted: 0, kept: assets.length };
  }

  // 执行删除
  console.log('\n🗑️  开始删除...');
  const deleteResult = await deleteMany({
    where: { id: { in: uniqueToDelete } },
  });

  console.log(`✅ 删除成功！删除了 ${deleteResult.count} 条记录`);
  
  return {
    deleted: deleteResult.count,
    kept: assets.length - deleteResult.count,
  };
}

async function cleanupCharacterAssets(projectId) {
  return cleanupAssets(
    {
      modelName: '角色',
      findMany: prisma.characterAsset.findMany.bind(prisma.characterAsset),
      deleteMany: prisma.characterAsset.deleteMany.bind(prisma.characterAsset),
    },
    projectId
  );
}

async function cleanupLocationAssets(projectId) {
  return cleanupAssets(
    {
      modelName: '地点',
      findMany: prisma.locationAsset.findMany.bind(prisma.locationAsset),
      deleteMany: prisma.locationAsset.deleteMany.bind(prisma.locationAsset),
    },
    projectId
  );
}

async function main() {
  console.log('🧹 资产清理工具\n');
  console.log('=' .repeat(60));
  
  if (projectId) {
    console.log(`📦 清理项目: ${projectId}`);
  } else {
    console.log('📦 清理所有项目');
  }
  
  if (isDryRun) {
    console.log('🔍 模式: 预览（不会删除数据）');
  } else {
    console.log('⚠️  模式: 执行（将真实删除数据！）');
  }
  
  console.log('=' .repeat(60));

  try {
    // 清理角色资产
    const charResult = await cleanupCharacterAssets(projectId);
    
    // 清理地点资产
    const locResult = await cleanupLocationAssets(projectId);

    console.log('\n' + '='.repeat(60));
    console.log('📊 清理完成汇总：');
    console.log(`  角色资产: 删除 ${charResult.deleted} 条，保留 ${charResult.kept} 条`);
    console.log(`  地点资产: 删除 ${locResult.deleted} 条，保留 ${locResult.kept} 条`);
    console.log('=' .repeat(60));

    if (isDryRun) {
      console.log('\n💡 提示：这是预览模式，数据未被删除');
      console.log('   要执行清理，请移除 --dry-run 参数');
    }

  } catch (error) {
    console.error('\n❌ 清理失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

