#!/bin/bash

# 🎬 Dramo E2E 测试 - 快速命令参考
# 直接复制命令运行查看完整的输入到分镜的中间过程

echo "🎬 Dramo E2E 测试命令参考"
echo "========================"
echo ""

echo "📹 查看完整中间过程（推荐 - 实时浏览器）"
echo "├─ 所有测试:"
echo "│  npm run e2e:headed -- input-modes-with-generation.spec.ts"
echo "│"
echo "├─ 只看 Drama 模式（导入剧本）:"
echo "│  npm run e2e:headed -- input-modes-with-generation.spec.ts --grep 'drama'"
echo "│"
echo "├─ 只看 Pro 模式（结构化表单）:"
echo "│  npm run e2e:headed -- input-modes-with-generation.spec.ts --grep 'pro'"
echo "│"
echo "├─ 只看 Base 模式（聊天输入）:"
echo "│  npm run e2e:headed -- input-modes-with-generation.spec.ts --grep 'base'"
echo "│"
echo "└─ 完整流程带详细日志:"
echo "   npm run e2e:headed -- input-modes-with-generation.spec.ts --grep 'complete workflow'"
echo ""

echo "📊 查看日志和测试结果"
echo "├─ 运行所有测试并输出日志:"
echo "│  npm run e2e:chromium -- input-modes-with-generation.spec.ts"
echo "│"
echo "└─ 生成HTML报告（包括视频、截图）:"
echo "   npm run e2e:chromium -- input-modes-with-generation.spec.ts"
echo "   npx playwright show-report"
echo ""

echo "🔧 调试模式（逐步执行）"
echo "└─ npm run e2e:debug -- input-modes-with-generation.spec.ts"
echo ""

echo "✅ 当前测试状态"
echo "├─ 总测试数: 6"
echo "├─ 通过: 6 ✅"
echo "├─ 失败: 0"
echo "└─ 通过率: 100%"
echo ""

echo "📝 相关文档"
echo "├─ E2E_VIEW_PROCESS.md          - 查看中间过程的快速指南"
echo "├─ E2E_INPUT_MODES_GUIDE.md     - 详细的输入模式说明"
echo "├─ E2E_INPUT_MODES_SUMMARY.md   - 完整的测试总结"
echo "└─ E2E_QUICK_START.md           - 所有E2E测试参考"
echo ""

echo "🎬 推荐操作流程"
echo "1. 第一次使用: npm run e2e:headed -- input-modes-with-generation.spec.ts"
echo "2. 查看特定模式: npm run e2e:headed -- input-modes-with-generation.spec.ts --grep 'pro'"
echo "3. 查看完整报告: npm run e2e:chromium -- input-modes-with-generation.spec.ts && npx playwright show-report"
echo "4. 调试: npm run e2e:debug -- input-modes-with-generation.spec.ts"
echo ""
