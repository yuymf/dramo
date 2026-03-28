-- 改进的清理脚本：优先保留有图片的资产
-- 项目ID: cmh076oof0005k9au29etu6in

-- ==========================================================
-- 预览：查看将要删除的数据（改进版）
-- ==========================================================

SELECT '将要执行的清理操作：' as info;

WITH ranked_assets AS (
  SELECT 
    id,
    name,
    jsonb_array_length(images::jsonb) as image_count,
    "createdAt",
    -- 排序规则：先按图片数量降序，再按创建时间降序
    -- 这样会优先保留有图片且最新的记录
    ROW_NUMBER() OVER (
      PARTITION BY name 
      ORDER BY jsonb_array_length(images::jsonb) DESC, "createdAt" DESC
    ) as rn
  FROM "CharacterAsset"
  WHERE "projectId" = 'cmh076oof0005k9au29etu6in'
)
SELECT 
  id,
  name,
  image_count,
  "createdAt",
  CASE WHEN rn = 1 THEN '✅ 保留' ELSE '❌ 删除' END as action,
  CASE WHEN rn = 1 THEN 'keep' ELSE 'delete' END as decision
FROM ranked_assets
ORDER BY name, rn;

-- 统计
SELECT '清理汇总：' as info;
WITH ranked_assets AS (
  SELECT 
    ROW_NUMBER() OVER (
      PARTITION BY name 
      ORDER BY jsonb_array_length(images::jsonb) DESC, "createdAt" DESC
    ) as rn
  FROM "CharacterAsset"
  WHERE "projectId" = 'cmh076oof0005k9au29etu6in'
)
SELECT 
  COUNT(CASE WHEN rn = 1 THEN 1 END) as "将保留",
  COUNT(CASE WHEN rn > 1 THEN 1 END) as "将删除",
  COUNT(*) as "总计"
FROM ranked_assets;

-- ==========================================================
-- 执行清理（确认上面的预览无误后，取消下面的注释）
-- ==========================================================

-- DELETE FROM "CharacterAsset"
-- WHERE id IN (
--   SELECT id
--   FROM (
--     SELECT 
--       id,
--       ROW_NUMBER() OVER (
--         PARTITION BY name 
--         ORDER BY jsonb_array_length(images::jsonb) DESC, "createdAt" DESC
--       ) as rn
--     FROM "CharacterAsset"
--     WHERE "projectId" = 'cmh076oof0005k9au29etu6in'
--   ) ranked
--   WHERE rn > 1  -- 删除每组除第一条外的所有记录
-- );

-- ==========================================================
-- 验证清理结果
-- ==========================================================

-- SELECT '清理后的角色资产：' as info;
-- SELECT 
--   name,
--   jsonb_array_length(images::jsonb) as image_count,
--   "createdAt"
-- FROM "CharacterAsset"
-- WHERE "projectId" = 'cmh076oof0005k9au29etu6in'
-- ORDER BY name, "createdAt" DESC;

