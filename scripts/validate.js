#!/usr/bin/env node

/**
 * Cabal.Ventures Bot - Stage 0 Validation Script
 * Tests all requirements specified in the Stage 0 specification
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const VALIDATION_RESULTS = [];

function logResult(test, passed, message) {
  const status = passed ? '✅' : '❌';
  const result = { test, passed, message };
  VALIDATION_RESULTS.push(result);
  console.log(`${status} ${test}: ${message}`);
}

function runCommand(command, cwd = process.cwd()) {
  try {
    const result = execSync(command, { 
      cwd, 
      encoding: 'utf8', 
      stdio: 'pipe' 
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function directoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function packageHasValidJson(packagePath) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.name && packageJson.version && packageJson.scripts;
  } catch {
    return false;
  }
}

console.log('🧪 Starting Cabal.Ventures Bot - Stage 0 Validation\n');

// Test 0.1: Project Structure
console.log('📁 Testing Project Structure...');

const requiredDirs = ['packages/bot', 'packages/functions', 'packages/infra', 'packages/sql'];
const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'packages/bot/package.json',
  'packages/functions/package.json',
  'packages/infra/package.json',
  'packages/sql/package.json'
];

let structureValid = true;

for (const dir of requiredDirs) {
  if (directoryExists(dir)) {
    console.log(`  ✅ Directory exists: ${dir}`);
  } else {
    console.log(`  ❌ Missing directory: ${dir}`);
    structureValid = false;
  }
}

for (const file of requiredFiles) {
  if (fileExists(file)) {
    console.log(`  ✅ File exists: ${file}`);
  } else {
    console.log(`  ❌ Missing file: ${file}`);
    structureValid = false;
  }
}

// Validate package.json files
for (const pkg of ['packages/bot', 'packages/functions', 'packages/infra', 'packages/sql']) {
  const packagePath = path.join(pkg, 'package.json');
  if (packageHasValidJson(packagePath)) {
    console.log(`  ✅ Valid package.json: ${packagePath}`);
  } else {
    console.log(`  ❌ Invalid package.json: ${packagePath}`);
    structureValid = false;
  }
}

logResult('0.1 Project Structure', structureValid, 
  structureValid ? 'PNPM workspace structure is valid' : 'Some required files/directories are missing');

// Test 0.2: Build Test
console.log('\n🔨 Testing Build Process...');
const buildResult = runCommand('pnpm install && pnpm build');
logResult('0.2 Build Process', buildResult.success, 
  buildResult.success ? 'Workspace builds successfully' : `Build failed: ${buildResult.error}`);

// Test 0.3: Essential Files Check
console.log('\n📄 Testing Essential Files...');

const essentialFiles = [
  'packages/bot/src/index.ts',
  'packages/bot/src/bot.ts',
  'packages/bot/src/config/index.ts',
  'packages/bot/src/types/index.ts',
  'packages/bot/src/commands/start.ts',
  'packages/bot/src/commands/help.ts',
  'packages/bot/src/commands/test.ts',
  'packages/bot/src/services/database.ts',
  'packages/bot/src/services/session.ts',
  'packages/bot/src/services/rateLimiter.ts',
  'packages/bot/src/middleware/session.ts',
  'packages/bot/src/middleware/errorHandler.ts',
  'packages/bot/src/server/healthCheck.ts',
  'packages/sql/schema.sql',
  'Dockerfile',
  '.env.example'
];

let essentialFilesValid = true;
for (const file of essentialFiles) {
  if (fileExists(file)) {
    console.log(`  ✅ Essential file exists: ${file}`);
  } else {
    console.log(`  ❌ Missing essential file: ${file}`);
    essentialFilesValid = false;
  }
}

logResult('0.3 Essential Files', essentialFilesValid, 
  essentialFilesValid ? 'All essential files present' : 'Some essential files are missing');

// Test 0.4: Configuration Validation
console.log('\n⚙️ Testing Configuration...');

let configValid = true;
const envExample = fs.readFileSync('.env.example', 'utf8');
const requiredEnvVars = ['BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'REDIS_URL'];

for (const envVar of requiredEnvVars) {
  if (envExample.includes(envVar)) {
    console.log(`  ✅ Environment variable documented: ${envVar}`);
  } else {
    console.log(`  ❌ Missing environment variable: ${envVar}`);
    configValid = false;
  }
}

logResult('0.4 Environment Config', configValid, 
  configValid ? 'All required environment variables documented' : 'Some environment variables missing');

// Test 0.5: Docker Configuration
console.log('\n🐳 Testing Docker Setup...');

const dockerValid = fileExists('Dockerfile') && fileExists('.dockerignore');
logResult('0.5 Docker Setup', dockerValid, 
  dockerValid ? 'Docker configuration files present' : 'Docker configuration incomplete');

// Test 0.6: Dependencies Check
console.log('\n📦 Testing Dependencies...');

const botPackage = JSON.parse(fs.readFileSync('packages/bot/package.json', 'utf8'));
const requiredDeps = ['telegraf', '@supabase/supabase-js', 'ioredis', 'winston', 'zod', 'dotenv', 'express', 'rate-limiter-flexible'];

let depsValid = true;
for (const dep of requiredDeps) {
  if (botPackage.dependencies && botPackage.dependencies[dep]) {
    console.log(`  ✅ Dependency present: ${dep}`);
  } else {
    console.log(`  ❌ Missing dependency: ${dep}`);
    depsValid = false;
  }
}

logResult('0.6 Dependencies', depsValid, 
  depsValid ? 'All required dependencies present' : 'Some dependencies missing');

// Test 0.7: TypeScript Configuration
console.log('\n📝 Testing TypeScript Setup...');

const tsConfigValid = fileExists('tsconfig.json') && fileExists('packages/bot/tsconfig.json');
logResult('0.7 TypeScript Config', tsConfigValid, 
  tsConfigValid ? 'TypeScript configuration present' : 'TypeScript configuration missing');

// Test 0.8: Database Schema
console.log('\n🗄️ Testing Database Schema...');

const schemaContent = fs.readFileSync('packages/sql/schema.sql', 'utf8');
const schemaValid = schemaContent.includes('users') && schemaContent.includes('telegram_id');
logResult('0.8 Database Schema', schemaValid, 
  schemaValid ? 'Database schema includes users table' : 'Database schema incomplete');

// Test 0.9: Code Quality Setup
console.log('\n🔍 Testing Code Quality...');

const qualityValid = fileExists('.eslintrc.js') && fileExists('.prettierrc') && fileExists('.gitignore');
logResult('0.9 Code Quality', qualityValid, 
  qualityValid ? 'ESLint, Prettier, and Git configuration present' : 'Code quality setup incomplete');

// Test 0.10: Documentation
console.log('\n📚 Testing Documentation...');

const readmeExists = fileExists('README.md');
logResult('0.10 Documentation', readmeExists, 
  readmeExists ? 'README.md present' : 'README.md missing');

// Summary
console.log('\n📊 VALIDATION SUMMARY');
console.log('='.repeat(50));

const passedTests = VALIDATION_RESULTS.filter(r => r.passed).length;
const totalTests = VALIDATION_RESULTS.length;
const passRate = Math.round((passedTests / totalTests) * 100);

console.log(`Tests Passed: ${passedTests}/${totalTests} (${passRate}%)`);

if (passedTests === totalTests) {
  console.log('\n🎉 ALL TESTS PASSED! Stage 0 requirements are complete.');
  console.log('✅ Ready to advance to Stage 1');
} else {
  console.log('\n⚠️  Some tests failed. Please address the issues above.');
  console.log('❌ Not ready for Stage 1');
}

console.log('\nValidation complete! 🚀');