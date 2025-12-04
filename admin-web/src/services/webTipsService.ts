/**
 * Tips Service for Web Portal
 * 
 * Manages contextual tips and help for users in the web portal.
 * Provides smart tip suggestions based on user behavior and app usage patterns.
 */

import { debugError } from '../config/debug';

export interface WebTip {
  id: string;
  title: string;
  message: string;
  category: 'getting_started' | 'expense_management' | 'data_entry' | 'reports' | 'approval' | 'settings' | 'advanced';
  priority: 'low' | 'medium' | 'high';
  screen: string; // Which screen this tip appears on
  trigger: 'on_load' | 'after_action' | 'manual' | 'condition_met';
  condition?: string; // Optional condition for when to show this tip
  icon?: string; // Emoji or icon
  actionText?: string; // Optional action button text
  dismissible: boolean; // Whether user can dismiss this tip
  createdAt: Date;
}

export interface UserTipProgress {
  userId: string;
  tipId: string;
  hasSeen: boolean;
  hasDismissed: boolean;
  dismissedAt?: Date;
  lastShown?: Date;
  timesShown: number;
}

export class WebTipsService {
  private static instance: WebTipsService;
  private tips: WebTip[] = [];
  private userProgress: Map<string, UserTipProgress[]> = new Map();

  static getInstance(): WebTipsService {
    if (!WebTipsService.instance) {
      WebTipsService.instance = new WebTipsService();
    }
    return WebTipsService.instance;
  }

  constructor() {
    this.initializeTips();
    this.loadUserProgress();
  }

  private initializeTips() {
    this.tips = [
      // Getting Started Tips
      {
        id: 'welcome_portal',
        title: 'Welcome to Oxford House Staff Portal! 🏠',
        message: 'This is your comprehensive expense tracking and reporting system. Use the navigation tabs above to access different sections of your expense report.',
        category: 'getting_started',
        priority: 'high',
        screen: 'staff_portal',
        trigger: 'on_load',
        dismissible: true,
        createdAt: new Date(),
        actionText: 'Get Started'
      },
      {
        id: 'navigation_tabs',
        title: 'Understanding Navigation Tabs 📑',
        message: 'Each tab represents a different section of your expense report. Warning icons (⚠️) indicate sections that need attention, while checkmarks (✅) show completed sections.',
        category: 'getting_started',
        priority: 'medium',
        screen: 'staff_portal',
        trigger: 'on_load',
        condition: 'first_visit',
        dismissible: true,
        createdAt: new Date()
      },

      // Expense Management Tips
      {
        id: 'cost_center_selection',
        title: 'Cost Center Selection 💼',
        message: 'Make sure to select the correct cost center for each expense. This determines which budget your expenses are charged against and affects your reporting.',
        category: 'expense_management',
        priority: 'high',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'missing_cost_centers',
        dismissible: true,
        createdAt: new Date(),
        actionText: 'Select Cost Centers'
      },
      {
        id: 'mileage_tracking',
        title: 'Mileage Tracking Tips 🚗',
        message: 'Enter your starting odometer reading for the day. The system will automatically calculate your ending odometer reading by adding the trip miles.',
        category: 'expense_management',
        priority: 'medium',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'has_mileage_entries',
        dismissible: true,
        createdAt: new Date()
      },
      {
        id: 'receipt_management',
        title: 'Receipt Management 📸',
        message: 'Upload clear photos of your receipts. Make sure the receipt is fully visible and the text is readable. The system can automatically extract vendor and amount information.',
        category: 'expense_management',
        priority: 'medium',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'has_receipts',
        dismissible: true,
        createdAt: new Date()
      },

      // Data Entry Tips
      {
        id: 'timesheet_completion',
        title: 'Complete Your Timesheet ⏰',
        message: 'Make sure to enter all your working hours, including regular hours, overtime, and any special categories like holiday or PTO hours.',
        category: 'data_entry',
        priority: 'high',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'incomplete_timesheet',
        dismissible: true,
        createdAt: new Date(),
        actionText: 'Complete Timesheet'
      },
      {
        id: 'daily_descriptions',
        title: 'Daily Descriptions 📝',
        message: 'Add detailed descriptions for each day to help supervisors understand your activities. This is especially important for travel and special projects.',
        category: 'data_entry',
        priority: 'medium',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'missing_descriptions',
        dismissible: true,
        createdAt: new Date()
      },

      // Reports Tips
      {
        id: 'report_submission',
        title: 'Submit Your Report 📋',
        message: 'Once all sections are complete (no warning icons), you can submit your expense report for supervisor approval. Make sure all required information is included.',
        category: 'reports',
        priority: 'high',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'report_ready',
        dismissible: true,
        createdAt: new Date(),
        actionText: 'Submit Report'
      },
      {
        id: 'report_review',
        title: 'Review Before Submission 👀',
        message: 'Before submitting, review all your entries for accuracy. Check that amounts, dates, and cost centers are correct. You can edit entries before submission.',
        category: 'reports',
        priority: 'medium',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'report_ready',
        dismissible: true,
        createdAt: new Date()
      },

      // Approval Tips
      {
        id: 'approval_cover_sheet',
        title: 'Approval Cover Sheet ✅',
        message: 'The approval cover sheet contains important information for supervisors. Make sure your personal information and summary totals are accurate.',
        category: 'approval',
        priority: 'medium',
        screen: 'staff_portal',
        trigger: 'condition_met',
        condition: 'approval_needed',
        dismissible: true,
        createdAt: new Date()
      },

      // Advanced Tips
      {
        id: 'mobile_sync',
        title: 'Mobile App Sync 📱',
        message: 'Data entered in the mobile app automatically syncs to this web portal. You can enter expenses on the go and review them here.',
        category: 'advanced',
        priority: 'low',
        screen: 'staff_portal',
        trigger: 'on_load',
        condition: 'has_mobile_data',
        dismissible: true,
        createdAt: new Date()
      },
      {
        id: 'offline_capability',
        title: 'Offline Data Entry 📱',
        message: 'The mobile app works offline. You can enter expenses without internet connection, and they will sync when you\'re back online.',
        category: 'advanced',
        priority: 'low',
        screen: 'staff_portal',
        trigger: 'manual',
        dismissible: true,
        createdAt: new Date()
      }
    ];
  }

  private loadUserProgress() {
    // Load user progress from localStorage
    const saved = localStorage.getItem('web_tips_progress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        this.userProgress = new Map(Object.entries(progress));
      } catch (error) {
        debugError('Error loading tips progress:', error);
      }
    }
  }

  private saveUserProgress() {
    // Save user progress to localStorage
    const progressObj = Object.fromEntries(this.userProgress);
    localStorage.setItem('web_tips_progress', JSON.stringify(progressObj));
  }

  getTipsForScreen(screen: string, userId: string, trigger?: string): WebTip[] {
    const userProgress = this.userProgress.get(userId) || [];
    const dismissedTips = new Set(userProgress.filter(p => p.hasDismissed).map(p => p.tipId));
    
    return this.tips.filter(tip => {
      // Filter by screen
      if (tip.screen !== screen) return false;
      
      // Filter by trigger
      if (trigger && tip.trigger !== trigger) return false;
      
      // Don't show dismissed tips
      if (dismissedTips.has(tip.id)) return false;
      
      // Check conditions
      if (tip.condition) {
        return this.evaluateCondition(tip.condition, userId);
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by priority (high first)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private evaluateCondition(condition: string, userId: string): boolean {
    // This would be implemented based on actual data conditions
    // For now, we'll use simple localStorage-based conditions
    switch (condition) {
      case 'first_visit':
        return !localStorage.getItem('web_portal_visited');
      case 'missing_cost_centers':
        // Check if user has entries without cost centers
        return true; // Simplified for now
      case 'has_mileage_entries':
        return true; // Simplified for now
      case 'has_receipts':
        return true; // Simplified for now
      case 'incomplete_timesheet':
        return true; // Simplified for now
      case 'missing_descriptions':
        return true; // Simplified for now
      case 'report_ready':
        return true; // Simplified for now
      case 'approval_needed':
        return true; // Simplified for now
      case 'has_mobile_data':
        return true; // Simplified for now
      default:
        return true;
    }
  }

  async dismissTip(userId: string, tipId: string): Promise<void> {
    let userProgress = this.userProgress.get(userId) || [];
    let progress = userProgress.find(p => p.tipId === tipId);
    
    if (!progress) {
      progress = {
        userId,
        tipId,
        hasSeen: false,
        hasDismissed: true,
        dismissedAt: new Date(),
        timesShown: 0
      };
      userProgress.push(progress);
    } else {
      progress.hasDismissed = true;
      progress.dismissedAt = new Date();
    }
    
    this.userProgress.set(userId, userProgress);
    this.saveUserProgress();
  }

  async markTipAsSeen(userId: string, tipId: string): Promise<void> {
    let userProgress = this.userProgress.get(userId) || [];
    let progress = userProgress.find(p => p.tipId === tipId);
    
    if (!progress) {
      progress = {
        userId,
        tipId,
        hasSeen: true,
        hasDismissed: false,
        lastShown: new Date(),
        timesShown: 1
      };
      userProgress.push(progress);
    } else {
      progress.hasSeen = true;
      progress.lastShown = new Date();
      progress.timesShown++;
    }
    
    this.userProgress.set(userId, userProgress);
    this.saveUserProgress();
  }

  async resetUserTips(userId: string): Promise<void> {
    this.userProgress.delete(userId);
    this.saveUserProgress();
  }

  markFirstVisit(): void {
    localStorage.setItem('web_portal_visited', 'true');
  }
}
