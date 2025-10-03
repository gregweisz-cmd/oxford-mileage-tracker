#!/usr/bin/env node

/**
 * Automated Dependency Update Script
 * Updates all project dependencies with safety checks and testing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Directories to update
  directories: [
    '.', // Root project
    'admin-web' // Admin web portal
  ],
  
  // Commands to run
  commands: {
    check: 'npm outdated',
    update: 'npm update',
    audit: 'npm audit',
    install: 'npm install',
    test: 'npm test'
  },
  
  // Safety settings
  safety: {
    createBackup: true,
    runTests: true,
    checkVulnerabilities: true,
    dryRun: false
  }
};

class DependencyUpdater {
  constructor() {
    this.results = {
      updated: [],
      failed: [],
      vulnerabilities: [],
      tests: []
    };
  }

  /**
   * Main update function
   */
  async updateAll() {
    console.log('🚀 Starting automated dependency update...\n');
    
    try {
      // Create backup if enabled
      if (CONFIG.safety.createBackup) {
        await this.createBackup();
      }
      
      // Update each directory
      for (const dir of CONFIG.directories) {
        console.log(`📁 Updating dependencies in: ${dir}`);
        await this.updateDirectory(dir);
      }
      
      // Run security audit
      if (CONFIG.safety.checkVulnerabilities) {
        await this.runSecurityAudit();
      }
      
      // Run tests
      if (CONFIG.safety.runTests) {
        await this.runTests();
      }
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Update failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Update dependencies in a specific directory
   */
  async updateDirectory(directory) {
    const originalDir = process.cwd();
    
    try {
      // Change to directory
      if (directory !== '.') {
        process.chdir(directory);
      }
      
      console.log(`  📦 Checking for outdated packages...`);
      
      // Check for outdated packages
      const outdated = this.runCommand(CONFIG.commands.check, { silent: true });
      
      if (outdated.trim()) {
        console.log(`  🔄 Found outdated packages, updating...`);
        
        if (CONFIG.safety.dryRun) {
          console.log(`  🔍 DRY RUN: Would update packages`);
          console.log(outdated);
        } else {
          // Update packages
          this.runCommand(CONFIG.commands.update);
          console.log(`  ✅ Updated packages in ${directory}`);
        }
        
        this.results.updated.push({
          directory,
          packages: this.parseOutdatedPackages(outdated)
        });
      } else {
        console.log(`  ✅ All packages up to date in ${directory}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Failed to update ${directory}:`, error.message);
      this.results.failed.push({ directory, error: error.message });
    } finally {
      // Return to original directory
      process.chdir(originalDir);
    }
  }

  /**
   * Run security audit
   */
  async runSecurityAudit() {
    console.log('\n🔒 Running security audit...');
    
    for (const dir of CONFIG.directories) {
      try {
        const originalDir = process.cwd();
        
        if (dir !== '.') {
          process.chdir(dir);
        }
        
        const auditResult = this.runCommand(CONFIG.commands.audit, { silent: true });
        
        if (auditResult.includes('found 0 vulnerabilities')) {
          console.log(`  ✅ No vulnerabilities found in ${dir}`);
        } else {
          console.log(`  ⚠️ Vulnerabilities found in ${dir}`);
          this.results.vulnerabilities.push({
            directory: dir,
            details: auditResult
          });
        }
        
        process.chdir(originalDir);
      } catch (error) {
        console.error(`  ❌ Security audit failed for ${dir}:`, error.message);
      }
    }
  }

  /**
   * Run tests
   */
  async runTests() {
    console.log('\n🧪 Running tests...');
    
    for (const dir of CONFIG.directories) {
      try {
        const originalDir = process.cwd();
        
        if (dir !== '.') {
          process.chdir(dir);
        }
        
        // Check if test script exists
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        if (packageJson.scripts && packageJson.scripts.test) {
          console.log(`  🧪 Running tests in ${dir}...`);
          
          try {
            this.runCommand(CONFIG.commands.test);
            console.log(`  ✅ Tests passed in ${dir}`);
            this.results.tests.push({ directory: dir, status: 'passed' });
          } catch (error) {
            console.log(`  ❌ Tests failed in ${dir}:`, error.message);
            this.results.tests.push({ directory: dir, status: 'failed', error: error.message });
          }
        } else {
          console.log(`  ⏭️ No test script found in ${dir}`);
        }
        
        process.chdir(originalDir);
      } catch (error) {
        console.error(`  ❌ Test execution failed for ${dir}:`, error.message);
      }
    }
  }

  /**
   * Create backup of package.json files
   */
  async createBackup() {
    console.log('💾 Creating backup of package.json files...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `backups/dependencies-${timestamp}`;
    
    // Create backup directory
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups');
    }
    fs.mkdirSync(backupDir);
    
    // Backup package.json files
    for (const dir of CONFIG.directories) {
      const packageJsonPath = path.join(dir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const backupPath = path.join(backupDir, `${dir === '.' ? 'root' : dir}-package.json`);
        fs.copyFileSync(packageJsonPath, backupPath);
        console.log(`  📄 Backed up ${packageJsonPath} to ${backupPath}`);
      }
    }
    
    console.log(`  ✅ Backup created in ${backupDir}\n`);
  }

  /**
   * Run a command and return output
   */
  runCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit'
      });
      return result;
    } catch (error) {
      if (options.silent) {
        return error.stdout || error.stderr || error.message;
      }
      throw error;
    }
  }

  /**
   * Parse outdated packages from npm outdated output
   */
  parseOutdatedPackages(outdated) {
    const lines = outdated.split('\n').filter(line => line.trim());
    const packages = [];
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        packages.push({
          name: parts[0],
          current: parts[1],
          wanted: parts[2],
          latest: parts[3]
        });
      }
    }
    
    return packages;
  }

  /**
   * Generate update report
   */
  generateReport() {
    console.log('\n📊 Update Report');
    console.log('================\n');
    
    // Updated packages
    if (this.results.updated.length > 0) {
      console.log('✅ Updated Packages:');
      this.results.updated.forEach(result => {
        console.log(`  📁 ${result.directory}:`);
        result.packages.forEach(pkg => {
          console.log(`    - ${pkg.name}: ${pkg.current} → ${pkg.latest}`);
        });
      });
      console.log();
    }
    
    // Failed updates
    if (this.results.failed.length > 0) {
      console.log('❌ Failed Updates:');
      this.results.failed.forEach(result => {
        console.log(`  📁 ${result.directory}: ${result.error}`);
      });
      console.log();
    }
    
    // Vulnerabilities
    if (this.results.vulnerabilities.length > 0) {
      console.log('⚠️ Security Vulnerabilities:');
      this.results.vulnerabilities.forEach(result => {
        console.log(`  📁 ${result.directory}:`);
        console.log(`    ${result.details}`);
      });
      console.log();
    }
    
    // Test results
    if (this.results.tests.length > 0) {
      console.log('🧪 Test Results:');
      this.results.tests.forEach(result => {
        const status = result.status === 'passed' ? '✅' : '❌';
        console.log(`  ${status} ${result.directory}: ${result.status}`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      });
      console.log();
    }
    
    // Summary
    const totalUpdated = this.results.updated.reduce((sum, result) => sum + result.packages.length, 0);
    const totalFailed = this.results.failed.length;
    const totalVulnerabilities = this.results.vulnerabilities.length;
    const totalTests = this.results.tests.length;
    const passedTests = this.results.tests.filter(t => t.status === 'passed').length;
    
    console.log('📈 Summary:');
    console.log(`  - Packages updated: ${totalUpdated}`);
    console.log(`  - Updates failed: ${totalFailed}`);
    console.log(`  - Security vulnerabilities: ${totalVulnerabilities}`);
    console.log(`  - Tests run: ${totalTests}`);
    console.log(`  - Tests passed: ${passedTests}/${totalTests}`);
    
    if (totalFailed > 0 || totalVulnerabilities > 0) {
      console.log('\n⚠️ Please review failed updates and security vulnerabilities.');
    } else {
      console.log('\n🎉 All updates completed successfully!');
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  if (args.includes('--dry-run')) {
    CONFIG.safety.dryRun = true;
    console.log('🔍 DRY RUN MODE: No actual updates will be performed\n');
  }
  
  if (args.includes('--no-backup')) {
    CONFIG.safety.createBackup = false;
  }
  
  if (args.includes('--no-tests')) {
    CONFIG.safety.runTests = false;
  }
  
  if (args.includes('--no-audit')) {
    CONFIG.safety.checkVulnerabilities = false;
  }
  
  // Run the updater
  const updater = new DependencyUpdater();
  updater.updateAll().catch(error => {
    console.error('❌ Update process failed:', error);
    process.exit(1);
  });
}

module.exports = DependencyUpdater;
