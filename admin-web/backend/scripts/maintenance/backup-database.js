/**
 * Database Backup Script
 * Creates automated backups of the SQLite database
 * 
 * Usage:
 *   node scripts/maintenance/backup-database.js [options]
 * 
 * Options:
 *   --output-dir <path>  Custom backup directory (default: ./backups)
 *   --retention <days>   Number of days to keep backups (default: 30)
 *   --verify             Verify backup integrity after creation
 *   --compress           Compress backup file (gzip)
 *   --upload-s3          Upload to S3 (requires AWS credentials)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dbService = require('../../services/dbService');
const { debugLog, debugError, debugWarn } = require('../../debug');

// Configuration
const DEFAULT_BACKUP_DIR = path.join(__dirname, '../../backups');
const DEFAULT_RETENTION_DAYS = 30;
const DB_PATH = dbService.DB_PATH;

// Parse command line arguments
const args = process.argv.slice(2);
const outputDir = args.includes('--output-dir') 
  ? args[args.indexOf('--output-dir') + 1]
  : DEFAULT_BACKUP_DIR;
const retentionDays = args.includes('--retention')
  ? parseInt(args[args.indexOf('--retention') + 1], 10)
  : DEFAULT_RETENTION_DAYS;
const shouldVerify = args.includes('--verify');
const shouldCompress = args.includes('--compress');
const shouldUploadS3 = args.includes('--upload-s3');

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    debugLog(`📁 Created backup directory: ${dir}`);
  }
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                   new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
  return `expense_tracker_${timestamp}.db`;
}

/**
 * Create database backup using SQLite backup command
 */
async function createBackup() {
  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Database file not found: ${DB_PATH}`);
    }

    // Get database file size for verification
    const dbStats = fs.statSync(DB_PATH);
    const dbSize = dbStats.size;
    debugLog(`📊 Database size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);

    // Ensure backup directory exists
    ensureBackupDir(outputDir);

    // Generate backup filename
    const backupFilename = generateBackupFilename();
    const backupPath = path.join(outputDir, backupFilename);

    debugLog(`🔄 Creating backup: ${backupPath}`);

    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath);

    // Verify backup was created
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file was not created');
    }

    const backupStats = fs.statSync(backupPath);
    const backupSize = backupStats.size;

    if (backupSize !== dbSize) {
      throw new Error(`Backup size mismatch: original ${dbSize} bytes, backup ${backupSize} bytes`);
    }

    debugLog(`✅ Backup created successfully: ${backupPath} (${(backupSize / 1024 / 1024).toFixed(2)} MB)`);

    // Verify backup integrity if requested
    if (shouldVerify) {
      debugLog('🔍 Verifying backup integrity...');
      await verifyBackup(backupPath);
    }

    // Compress backup if requested
    let finalBackupPath = backupPath;
    if (shouldCompress) {
      finalBackupPath = await compressBackup(backupPath);
    }

    // Upload to S3 if requested
    if (shouldUploadS3) {
      await uploadToS3(finalBackupPath);
    }

    return {
      success: true,
      backupPath: finalBackupPath,
      size: backupSize,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    debugError('❌ Backup failed:', error);
    throw error;
  }
}

/**
 * Verify backup integrity by checking if SQLite can read it
 */
function verifyBackup(backupPath) {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const testDb = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        throw new Error(`Cannot open backup file: ${err.message}`);
      }
    });

    return new Promise((resolve, reject) => {
      testDb.get('SELECT COUNT(*) as count FROM sqlite_master', [], (err, row) => {
        testDb.close();
        
        if (err) {
          reject(new Error(`Backup verification failed: ${err.message}`));
          return;
        }

        if (!row || row.count === 0) {
          reject(new Error('Backup appears to be empty or corrupted'));
          return;
        }

        debugLog(`✅ Backup verified: ${row.count} tables found`);
        resolve(true);
      });
    });
  } catch (error) {
    throw new Error(`Backup verification error: ${error.message}`);
  }
}

/**
 * Compress backup file using gzip
 */
function compressBackup(backupPath) {
  return new Promise((resolve, reject) => {
    try {
      const zlib = require('zlib');
      const gzip = zlib.createGzip();
      const compressedPath = backupPath + '.gz';
      
      debugLog(`🗜️  Compressing backup...`);
      
      const readStream = fs.createReadStream(backupPath);
      const writeStream = fs.createWriteStream(compressedPath);
      
      readStream.pipe(gzip).pipe(writeStream);
      writeStream.on('finish', () => {
        // Get sizes before deleting
        const originalSize = fs.statSync(backupPath).size;
        const compressedSize = fs.statSync(compressedPath).size;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        
        // Delete uncompressed backup
        fs.unlinkSync(backupPath);
        
        debugLog(`✅ Backup compressed: ${compressedPath} (${ratio}% reduction)`);
        resolve(compressedPath);
      });
      
      writeStream.on('error', (error) => {
        reject(new Error(`Compression failed: ${error.message}`));
      });
      
      readStream.on('error', (error) => {
        reject(new Error(`Read error during compression: ${error.message}`));
      });
    } catch (error) {
      debugError('❌ Compression failed:', error);
      reject(error);
    }
  });
}

/**
 * Upload backup to S3 (if configured)
 */
function uploadToS3(backupPath) {
  try {
    // This would require AWS SDK - implement if needed
    debugWarn('⚠️  S3 upload not yet implemented. Skipping...');
    // TODO: Implement S3 upload if needed
    // const AWS = require('aws-sdk');
    // const s3 = new AWS.S3();
    // ... upload logic
  } catch (error) {
    debugError('❌ S3 upload failed:', error);
    throw error;
  }
}

/**
 * Clean up old backups based on retention policy
 */
function cleanupOldBackups() {
  try {
    if (!fs.existsSync(outputDir)) {
      return;
    }

    debugLog(`🧹 Cleaning up backups older than ${retentionDays} days...`);
    
    const files = fs.readdirSync(outputDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    let freedSpace = 0;

    files.forEach((file) => {
      if (!file.startsWith('expense_tracker_')) {
        return; // Skip non-backup files
      }

      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        const fileSize = stats.size;
        fs.unlinkSync(filePath);
        deletedCount++;
        freedSpace += fileSize;
        debugLog(`🗑️  Deleted old backup: ${file}`);
      }
    });

    if (deletedCount > 0) {
      debugLog(`✅ Cleanup complete: Deleted ${deletedCount} backups, freed ${(freedSpace / 1024 / 1024).toFixed(2)} MB`);
    } else {
      debugLog(`✅ Cleanup complete: No old backups to delete`);
    }

    return { deletedCount, freedSpace };
  } catch (error) {
    debugError('❌ Cleanup failed:', error);
    throw error;
  }
}

/**
 * Main backup function
 */
async function main() {
  try {
    debugLog('🚀 Starting database backup...');
    debugLog(`📂 Backup directory: ${outputDir}`);
    debugLog(`🗄️  Database path: ${DB_PATH}`);

    // Create backup
    const result = createBackup();
    
    // Cleanup old backups
    cleanupOldBackups();

    debugLog('✅ Backup process completed successfully');
    
    console.log(JSON.stringify({
      success: true,
      backup: result,
      message: 'Backup completed successfully'
    }, null, 2));

    process.exit(0);
  } catch (error) {
    debugError('❌ Backup process failed:', error);
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Backup failed'
    }, null, 2));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  createBackup,
  verifyBackup,
  cleanupOldBackups,
  generateBackupFilename
};

