import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';

export interface PhotoQualityResult {
  isValid: boolean;
  score: number; // 0-100
  issues: PhotoQualityIssue[];
  warnings: string[];
  suggestions: string[];
}

export interface PhotoQualityIssue {
  type: 'blur' | 'low_resolution' | 'too_dark' | 'too_bright' | 'poor_contrast' | 'orientation';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export class ReceiptPhotoQualityService {
  // Minimum recommended resolution (width or height)
  private static readonly MIN_RESOLUTION = 800;
  private static readonly RECOMMENDED_RESOLUTION = 1200;
  
  // Blur threshold (lower is sharper, higher is more blurred)
  private static readonly BLUR_THRESHOLD = 0.3;
  
  // Brightness thresholds (0-1 scale)
  private static readonly MIN_BRIGHTNESS = 0.15;
  private static readonly MAX_BRIGHTNESS = 0.85;
  private static readonly OPTIMAL_BRIGHTNESS_MIN = 0.25;
  private static readonly OPTIMAL_BRIGHTNESS_MAX = 0.75;
  
  // Contrast threshold
  private static readonly MIN_CONTRAST = 0.3;

  /**
   * Analyze photo quality for a receipt image
   */
  static async analyzePhotoQuality(imageUri: string): Promise<PhotoQualityResult> {
    const issues: PhotoQualityIssue[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Get image dimensions
      const dimensions = await this.getImageDimensions(imageUri);
      
      // Check resolution
      const resolutionIssue = this.checkResolution(dimensions);
      if (resolutionIssue) {
        issues.push(resolutionIssue);
        if (resolutionIssue.severity === 'high') {
          warnings.push('Low resolution may affect OCR accuracy');
          suggestions.push('Take a closer photo or use higher camera quality settings');
        }
      }

      // Check if image is too small (quick check before more expensive operations)
      if (dimensions.width < this.MIN_RESOLUTION || dimensions.height < this.MIN_RESOLUTION) {
        return {
          isValid: false,
          score: Math.min(30, (dimensions.width + dimensions.height) / (this.MIN_RESOLUTION * 2) * 30),
          issues,
          warnings,
          suggestions
        };
      }

      // Get image info for additional checks
      // Note: More advanced checks like blur detection would require
      // image processing libraries. For now, we'll do basic checks.
      
      // Check file size as a proxy for quality (very small files might be compressed too much)
      // Note: This is less reliable since cropped/edited photos can be smaller
      // Only flag if BOTH file size is small AND resolution is low
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (fileInfo.exists && 'size' in fileInfo) {
        const fileSizeKB = fileInfo.size / 1024;
        const minDimension = Math.min(dimensions.width, dimensions.height);
        
        // Only flag small file size if resolution is also low
        // This avoids false positives from cropped high-quality images
        if (fileSizeKB < 30 && minDimension < this.RECOMMENDED_RESOLUTION) {
          issues.push({
            type: 'low_resolution',
            severity: 'low',
            message: 'Small file size detected'
          });
        }
      }

      // Orientation check (width vs height) - only flag extreme cases
      // Receipts can be various aspect ratios, so be lenient
      const isPortrait = dimensions.height > dimensions.width;
      const aspectRatio = Math.max(dimensions.width, dimensions.height) / Math.min(dimensions.width, dimensions.height);
      
      // Only flag if aspect ratio is extreme (>3:1) or if landscape with very wide ratio
      // Normal receipts can be 2:1 or 2.5:1 which is fine
      if ((!isPortrait && aspectRatio > 2.5) || (isPortrait && aspectRatio > 4)) {
        issues.push({
          type: 'orientation',
          severity: 'low',
          message: isPortrait ? 'Very tall image - ensure receipt is fully in frame' : 'Landscape orientation - portrait recommended'
        });
        suggestions.push('Hold phone vertically and ensure entire receipt is visible');
      }

      // Calculate quality score
      let score = 100;
      
      // Deduct points for issues
      issues.forEach(issue => {
        switch (issue.severity) {
          case 'high':
            score -= 20;
            break;
          case 'medium':
            score -= 10;
            break;
          case 'low':
            score -= 5;
            break;
        }
      });

      // Resolution bonus/penalty
      if (dimensions.width >= this.RECOMMENDED_RESOLUTION && dimensions.height >= this.RECOMMENDED_RESOLUTION) {
        // Already accounted for in base score
      } else if (dimensions.width < this.MIN_RESOLUTION || dimensions.height < this.MIN_RESOLUTION) {
        score -= 30;
      }

      score = Math.max(0, Math.min(100, score));

      return {
        isValid: score >= 50, // At least 50/100 to be considered valid
        score,
        issues,
        warnings,
        suggestions
      };
    } catch (error) {
      console.error('Error analyzing photo quality:', error);
      // Return a neutral result if analysis fails
      return {
        isValid: true, // Don't block user if we can't analyze
        score: 70,
        issues: [],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Get image dimensions
   */
  private static async getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => {
          resolve({ width, height });
        },
        (error) => {
          console.error('Error getting image dimensions:', error);
          // Return default dimensions if we can't get them
          resolve({ width: 800, height: 600 });
        }
      );
    });
  }

  /**
   * Check if image resolution is adequate
   */
  private static checkResolution(dimensions: { width: number; height: number }): PhotoQualityIssue | null {
    const minDimension = Math.min(dimensions.width, dimensions.height);
    const maxDimension = Math.max(dimensions.width, dimensions.height);

    if (minDimension < this.MIN_RESOLUTION) {
      return {
        type: 'low_resolution',
        severity: 'high',
        message: `Resolution is ${minDimension}px - minimum recommended is ${this.MIN_RESOLUTION}px`
      };
    }

    // Only show medium severity if significantly below recommended (within 200px is fine)
    if (minDimension < this.RECOMMENDED_RESOLUTION - 200) {
      return {
        type: 'low_resolution',
        severity: 'medium',
        message: `Resolution is ${minDimension}px - recommended is ${this.RECOMMENDED_RESOLUTION}px+ for best OCR results`
      };
    }

    return null;
  }

  /**
   * Get user-friendly quality message
   */
  static getQualityMessage(result: PhotoQualityResult): string | null {
    // Only show messages for significant quality issues (score < 70)
    if (result.score >= 70) {
      return null; // Good quality, no message needed
    }

    if (result.score < 50) {
      return 'Photo quality is poor. Consider retaking for better OCR accuracy.';
    }

    if (result.issues.some(i => i.severity === 'high')) {
      const highSeverityIssue = result.issues.find(i => i.severity === 'high');
      return highSeverityIssue?.message || 'Photo may have quality issues.';
    }

    // For medium severity, only show if score is below 60
    if (result.score < 60 && result.issues.some(i => i.severity === 'medium')) {
      return 'Photo quality could be improved for better OCR results.';
    }

    return null; // No significant issues, no message needed
  }

  /**
   * Get primary suggestion
   */
  static getPrimarySuggestion(result: PhotoQualityResult): string | null {
    if (result.suggestions.length === 0) {
      return null;
    }
    return result.suggestions[0];
  }
}
