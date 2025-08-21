#!/usr/bin/env node

/**
 * Build Validator Script
 * Prevents common build failures before they happen
 * Based on real-world build failure patterns
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

class BuildValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  addError(message, fix = null) {
    this.errors.push(message);
    if (fix) this.fixes.push(fix);
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Check 1: JSX in .ts files
   * Common error: Using JSX syntax in .ts files instead of .tsx
   */
  checkJsxInTsFiles() {
    this.log('\n📋 Checking for JSX in .ts files...', colors.blue);
    
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) return;

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
    
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for JSX patterns
      const jsxPatterns = [
        /<[A-Z][^>]*>/,           // Component tags
        /<\/[A-Z][^>]*>/,         // Closing component tags
        /<>/,                      // Fragment shorthand
        /<\/>/,                    // Closing fragment
        /return\s+<[^>]*>/,        // Return JSX
        /\)\s*=>\s*</,            // Arrow function returning JSX
        /React\.ReactNode/,       // React types that suggest JSX usage
        /children:\s*React/       // Children prop
      ];
      
      let hasJsx = false;
      for (const pattern of jsxPatterns) {
        if (pattern.test(content)) {
          hasJsx = true;
          break;
        }
      }
      
      // Check if React is used but not imported
      const usesReact = /React\.|<[A-Z]/.test(content);
      const hasReactImport = /import\s+.*React.*from\s+['"]react['"]/.test(content);
      
      if (hasJsx) {
        const relativePath = path.relative(process.cwd(), file);
        this.addError(
          `JSX syntax found in ${relativePath}`,
          `Rename to .tsx: mv "${file}" "${file.replace('.ts', '.tsx')}"`
        );
      } else if (usesReact && !hasReactImport && !file.includes('.config.')) {
        const relativePath = path.relative(process.cwd(), file);
        this.addWarning(`File ${relativePath} uses React but doesn't import it`);
      }
    }
  }

  /**
   * Check 2: ESLint violations
   * Common errors: Unused variables, missing types, etc.
   */
  checkEslintViolations() {
    this.log('\n📋 Checking ESLint violations...', colors.blue);
    
    try {
      execSync('npx eslint src --ext .ts,.tsx,.js,.jsx --max-warnings 0', { stdio: 'pipe' });
      this.log('✅ No ESLint violations found', colors.green);
    } catch (error) {
      const output = error.stdout ? error.stdout.toString() : '';
      
      // Parse common ESLint errors
      if (output.includes('is defined but never used')) {
        this.addError(
          'Unused variables detected',
          'Prefix unused parameters with underscore (e.g., _request)'
        );
      }
      if (output.includes('Unexpected any')) {
        this.addError(
          'TypeScript "any" type detected',
          'Replace "any" with proper TypeScript interfaces'
        );
      }
      if (output.includes('Curly braces are required')) {
        this.addError(
          'Missing curly braces in conditionals',
          'Add curly braces to all if/else statements'
        );
      }
    }
  }

  /**
   * Check 3: API Routes without dynamic export
   * Next.js 14 requires dynamic export for runtime operations
   */
  checkApiRoutesDynamic() {
    this.log('\n📋 Checking API routes for dynamic exports...', colors.blue);
    
    const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
    if (!fs.existsSync(apiDir)) return;

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
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if route performs runtime operations
      const needsDynamic = 
        /fetch\(/.test(content) ||
        /fs\./.test(content) ||
        /database/.test(content) ||
        /prisma/.test(content) ||
        /mongoose/.test(content) ||
        /process\.env/.test(content);
      
      const hasDynamic = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content);
      
      if (needsDynamic && !hasDynamic) {
        const relativePath = path.relative(process.cwd(), file);
        this.addError(
          `API route ${relativePath} performs runtime operations but lacks dynamic export`,
          `Add "export const dynamic = 'force-dynamic';" after imports`
        );
      }
    }
  }

  /**
   * Check 4: TypeScript configuration
   */
  checkTypeScriptConfig() {
    this.log('\n📋 Checking TypeScript configuration...', colors.blue);
    
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    
    if (!fs.existsSync(tsconfigPath)) {
      this.addError('tsconfig.json not found', 'Run: npx tsc --init');
      return;
    }

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    const compilerOptions = tsconfig.compilerOptions || {};

    // Check for JSX support
    if (!compilerOptions.jsx) {
      this.addWarning('JSX not configured in tsconfig.json');
    }

    // Check for strict mode
    if (!compilerOptions.strict) {
      this.addWarning('TypeScript strict mode is disabled');
    }

    // Check for module resolution
    if (!compilerOptions.moduleResolution) {
      this.addWarning('Module resolution strategy not specified');
    }
  }

  /**
   * Check 5: Environment variables
   */
  checkEnvironmentVariables() {
    this.log('\n📋 Checking environment variables...', colors.blue);
    
    const envExamplePath = path.join(process.cwd(), '.env.example');
    
    if (!fs.existsSync(envExamplePath)) {
      this.addWarning('.env.example not found - cannot validate environment setup');
      return;
    }

    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    const requiredVars = envExample
      .split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split('=')[0]);

    // Check if any code uses undefined env vars
    const srcDir = path.join(process.cwd(), 'src');
    if (fs.existsSync(srcDir)) {
      const findEnvUsage = (content) => {
        const envPattern = /process\.env\.([A-Z_]+)/g;
        const matches = [];
        let match;
        while ((match = envPattern.exec(content)) !== null) {
          matches.push(match[1]);
        }
        return matches;
      };

      const checkDir = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            checkDir(fullPath);
          } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const usedVars = findEnvUsage(content);
            
            for (const varName of usedVars) {
              if (!requiredVars.includes(varName) && !varName.startsWith('NEXT_PUBLIC_')) {
                const relativePath = path.relative(process.cwd(), fullPath);
                this.addWarning(`${relativePath} uses undefined env var: ${varName}`);
              }
            }
          }
        }
      };

      checkDir(srcDir);
    }
  }

  /**
   * Check 6: Package.json scripts
   */
  checkPackageScripts() {
    this.log('\n📋 Checking package.json scripts...', colors.blue);
    
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.addError('package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageJson.scripts || {};

    const requiredScripts = ['dev', 'build', 'start', 'lint'];
    for (const script of requiredScripts) {
      if (!scripts[script]) {
        this.addWarning(`Missing script: ${script}`);
      }
    }

    // Check for type checking script
    if (!scripts.typecheck && !scripts['type-check']) {
      this.addWarning('No TypeScript type checking script found');
    }
  }

  /**
   * Check 7: Dependencies
   */
  checkDependencies() {
    this.log('\n📋 Checking dependencies...', colors.blue);
    
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) return;

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for React in non-.tsx files
    if (deps.react) {
      const srcDir = path.join(process.cwd(), 'src');
      if (fs.existsSync(srcDir)) {
        // Already checked in checkJsxInTsFiles
      }
    }

    // Check for type definitions
    if (deps.react && !deps['@types/react']) {
      this.addWarning('React is installed but @types/react is missing');
    }

    if (deps['react-dom'] && !deps['@types/react-dom']) {
      this.addWarning('react-dom is installed but @types/react-dom is missing');
    }
  }

  /**
   * Run all validations
   */
  async validate() {
    this.log('\n🔍 NEW PROJECT PATHWAY - Build Validator\n', colors.blue);
    this.log('Preventing build failures before they happen...', colors.yellow);

    // Run all checks
    this.checkJsxInTsFiles();
    this.checkApiRoutesDynamic();
    this.checkTypeScriptConfig();
    this.checkEnvironmentVariables();
    this.checkPackageScripts();
    this.checkDependencies();
    this.checkEslintViolations();

    // Report results
    this.log('\n' + '='.repeat(60), colors.blue);
    this.log('\n📊 Validation Results\n', colors.blue);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All checks passed! Your build should succeed.', colors.green);
      return 0;
    }

    if (this.errors.length > 0) {
      this.log(`\n❌ ${this.errors.length} Error(s) Found:`, colors.red);
      this.errors.forEach((error, i) => {
        this.log(`  ${i + 1}. ${error}`, colors.red);
      });

      if (this.fixes.length > 0) {
        this.log('\n💡 Suggested Fixes:', colors.yellow);
        this.fixes.forEach((fix, i) => {
          this.log(`  ${i + 1}. ${fix}`, colors.yellow);
        });
      }
    }

    if (this.warnings.length > 0) {
      this.log(`\n⚠️  ${this.warnings.length} Warning(s):`, colors.yellow);
      this.warnings.forEach((warning, i) => {
        this.log(`  ${i + 1}. ${warning}`, colors.yellow);
      });
    }

    this.log('\n' + '='.repeat(60), colors.blue);

    if (this.errors.length > 0) {
      this.log('\n🛑 Build validation failed. Fix errors before building.', colors.red);
      return 1;
    } else {
      this.log('\n⚠️  Build may succeed but with warnings.', colors.yellow);
      return 0;
    }
  }
}

// Run validator
if (require.main === module) {
  const validator = new BuildValidator();
  validator.validate().then(exitCode => {
    process.exit(exitCode);
  });
}

module.exports = BuildValidator;