#!/usr/bin/env node

/**
 * Fix Build Issues Script
 * Automatically fixes common build issues in NEW PROJECT PATHWAY
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

class BuildFixer {
  constructor() {
    this.fixes = [];
    this.projectRoot = process.cwd();
  }

  /**
   * Fix 1: Ensure next-env.d.ts exists
   */
  fixNextEnv() {
    log('\n🔧 Checking Next.js TypeScript declarations...', colors.blue);
    
    const nextEnvPath = path.join(this.projectRoot, 'next-env.d.ts');
    
    if (!fs.existsSync(nextEnvPath)) {
      const content = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
`;
      fs.writeFileSync(nextEnvPath, content);
      log('✅ Created next-env.d.ts', colors.green);
      this.fixes.push('Created Next.js TypeScript declarations');
    } else {
      log('✓ next-env.d.ts already exists', colors.green);
    }
  }

  /**
   * Fix 2: Create config barrel export
   */
  fixConfigExports() {
    log('\n🔧 Checking config exports...', colors.blue);
    
    const configIndexPath = path.join(this.projectRoot, 'src', 'config', 'index.ts');
    const configDir = path.dirname(configIndexPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(configIndexPath)) {
      const content = `// Config barrel export
export { featureFlags, useFeatureFlag, FeatureFlag } from './flags';
export { env, validateEnv } from './env';
`;
      fs.writeFileSync(configIndexPath, content);
      log('✅ Created src/config/index.ts', colors.green);
      this.fixes.push('Created config barrel export');
    } else {
      log('✓ src/config/index.ts already exists', colors.green);
    }
  }

  /**
   * Fix 3: Install missing dependencies
   */
  fixDependencies() {
    log('\n🔧 Checking dependencies...', colors.blue);
    
    const packagePath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredDeps = {
      '@types/jest': '^29.5.0',
      'eslint-plugin-react-hooks': '^4.6.0'
    };
    
    let needsInstall = false;
    
    for (const [dep, version] of Object.entries(requiredDeps)) {
      if (!packageJson.devDependencies?.[dep] && !packageJson.dependencies?.[dep]) {
        if (!packageJson.devDependencies) {
          packageJson.devDependencies = {};
        }
        packageJson.devDependencies[dep] = version;
        needsInstall = true;
        log(`  Adding ${dep}@${version}`, colors.yellow);
      }
    }
    
    if (needsInstall) {
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      log('📦 Installing dependencies...', colors.blue);
      try {
        execSync('npm install', { stdio: 'inherit' });
        log('✅ Dependencies installed', colors.green);
        this.fixes.push('Installed missing dependencies');
      } catch (error) {
        log('⚠️  Could not auto-install. Please run: npm install', colors.yellow);
      }
    } else {
      log('✓ All required dependencies present', colors.green);
    }
  }

  /**
   * Fix 4: Update tsconfig paths
   */
  fixTsConfig() {
    log('\n🔧 Checking TypeScript configuration...', colors.blue);
    
    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
    
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }
      
      // Ensure proper path mappings
      if (!tsconfig.compilerOptions.paths) {
        tsconfig.compilerOptions.paths = {};
      }
      
      if (!tsconfig.compilerOptions.paths['@/*']) {
        tsconfig.compilerOptions.paths['@/*'] = ['./src/*'];
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        log('✅ Updated tsconfig.json paths', colors.green);
        this.fixes.push('Updated TypeScript path mappings');
      } else {
        log('✓ TypeScript paths configured', colors.green);
      }
    }
  }

  /**
   * Fix 5: Add dynamic exports to API routes
   */
  fixApiRoutes() {
    log('\n🔧 Checking API routes...', colors.blue);
    
    const apiDir = path.join(this.projectRoot, 'src', 'app', 'api');
    
    if (!fs.existsSync(apiDir)) {
      log('✓ No API routes to check', colors.green);
      return;
    }
    
    const findRouteFiles = (dir) => {
      const files = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...findRouteFiles(fullPath));
        } else if (item === 'route.ts' || item === 'route.tsx') {
          files.push(fullPath);
        }
      }
      return files;
    };
    
    const routeFiles = findRouteFiles(apiDir);
    let fixedCount = 0;
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if route needs dynamic export
      const needsDynamic = 
        /fetch\(/.test(content) ||
        /fs\./.test(content) ||
        /database/.test(content) ||
        /process\.env/.test(content);
      
      const hasDynamic = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content);
      
      if (needsDynamic && !hasDynamic) {
        // Add dynamic export after imports
        const lines = content.split('\n');
        let insertIndex = 0;
        
        // Find last import statement
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import ')) {
            insertIndex = i + 1;
          }
        }
        
        // Insert dynamic export
        lines.splice(insertIndex, 0, '', "// Force dynamic rendering for runtime operations", "export const dynamic = 'force-dynamic';");
        
        fs.writeFileSync(file, lines.join('\n'));
        fixedCount++;
        
        const relativePath = path.relative(this.projectRoot, file);
        log(`  Fixed: ${relativePath}`, colors.yellow);
      }
    }
    
    if (fixedCount > 0) {
      log(`✅ Added dynamic exports to ${fixedCount} API routes`, colors.green);
      this.fixes.push(`Fixed ${fixedCount} API routes`);
    } else {
      log('✓ All API routes configured correctly', colors.green);
    }
  }

  /**
   * Fix 6: Rename .ts files with JSX to .tsx
   */
  fixJsxFiles() {
    log('\n🔧 Checking for JSX in .ts files...', colors.blue);
    
    const srcDir = path.join(this.projectRoot, 'src');
    
    if (!fs.existsSync(srcDir)) {
      log('✓ No source directory to check', colors.green);
      return;
    }
    
    const findTsFiles = (dir) => {
      const files = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...findTsFiles(fullPath));
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts') && !item.endsWith('.test.ts')) {
          files.push(fullPath);
        }
      }
      return files;
    };
    
    const tsFiles = findTsFiles(srcDir);
    let renamedCount = 0;
    
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // More accurate JSX detection
      const hasJsx = /<[A-Z][^>]*>/.test(content) || /<\/[A-Z]/.test(content) || /<>/.test(content) || /<\/>/.test(content);
      const hasReactImport = /import.*React/.test(content);
      
      if (hasJsx || (hasReactImport && /return\s*\(/.test(content))) {
        const newPath = file.replace('.ts', '.tsx');
        fs.renameSync(file, newPath);
        renamedCount++;
        
        const relativePath = path.relative(this.projectRoot, file);
        log(`  Renamed: ${relativePath} → .tsx`, colors.yellow);
      }
    }
    
    if (renamedCount > 0) {
      log(`✅ Renamed ${renamedCount} files to .tsx`, colors.green);
      this.fixes.push(`Renamed ${renamedCount} files with JSX to .tsx`);
    } else {
      log('✓ No JSX in .ts files found', colors.green);
    }
  }

  /**
   * Run all fixes
   */
  async runAllFixes() {
    log('\n🚀 NEW PROJECT PATHWAY - Build Issue Fixer\n', colors.blue);
    log('Automatically fixing common build issues...', colors.yellow);
    
    this.fixNextEnv();
    this.fixConfigExports();
    this.fixDependencies();
    this.fixTsConfig();
    this.fixApiRoutes();
    this.fixJsxFiles();
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('\n📊 Fix Summary\n', colors.blue);
    
    if (this.fixes.length === 0) {
      log('✅ No issues found! Your project is ready to build.', colors.green);
    } else {
      log(`✅ Applied ${this.fixes.length} fix(es):\n`, colors.green);
      this.fixes.forEach((fix, i) => {
        log(`  ${i + 1}. ${fix}`, colors.green);
      });
      
      log('\n🎯 Next Steps:', colors.yellow);
      log('  1. Run: npm run build', colors.white);
      log('  2. If any issues remain, check the error messages', colors.white);
      log('  3. Run: npm run build:validate for detailed checks', colors.white);
    }
    
    log('\n' + '='.repeat(60), colors.blue);
  }
}

// Run fixer
if (require.main === module) {
  const fixer = new BuildFixer();
  fixer.runAllFixes().then(() => {
    process.exit(0);
  });
}

module.exports = BuildFixer;