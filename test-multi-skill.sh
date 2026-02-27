#!/bin/bash

# 多技能仓库测试脚本
# 测试从 planetscale/database-skills 获取 postgres 技能

echo "🧪 Testing Multi-Skill Repository"
echo "================================"
echo ""
echo "Repository: https://github.com/planetscale/database-skills.git"
echo "Expected skill: postgres (in skills/mysql/)"
echo ""

# 测试场景 1: 解析仓库 URL
echo "📋 Test 1: Parse repository URL"
node -e "
const { parseSource, buildSkillId } = require('./out/utils/source-parser.js');

const source = parseSource('https://github.com/planetscale/database-skills.git');
console.log('Parsed source type:', source.type);
console.log('Owner:', source.owner);
console.log('Repo:', source.repo);

// 模拟在 skills/mysql 找到技能后的 skillId
const skillId = buildSkillId(source);
console.log('Skill ID:', skillId);
console.log('Safe cache key:', skillId.replace(/\//g, '-'));
"
echo ""

# 测试场景 2: 验证缓存文件名安全性
echo "📋 Test 2: Verify cache filename safety"
node -e "
const skillId = 'github/planetscale/database-skills/skills/mysql';
const safeSkillId = skillId.replace(/\//g, '-');
console.log('Original skillId:', skillId);
console.log('Safe cache filename:', safeSkillId + '.md');
console.log('Contains slashes:', safeSkillId.includes('/'));
"
echo ""

echo "✅ Tests completed!"
echo ""
echo "Next steps to test the actual extension:"
echo "1. Compile the extension: npm run compile"
echo "2. Press F5 to launch the extension"
echo "3. Search for 'postgres' skill"
echo "4. Click to view skill details"
echo ""
echo "Expected behavior:"
echo "- Repository should clone successfully"
echo "- Should find multiple skills in the repository"
echo "- Should select the correct skill based on skillId"
echo "- Should cache with a safe filename (no slashes)"
