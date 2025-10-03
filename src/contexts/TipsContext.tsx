/**
 * Tips Context
 * 
 * Provides global state management for tips throughout the app.
 * Handles showing, dismissing, and tracking user tip interactions.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppTip, TipsService } from '../services/tipsService';
import { Employee } from '../types';

interface TipsContextType {
  tips: AppTip[];
  isLoading: boolean;
  showTips: boolean;
  loadTipsForScreen: (screen: string, trigger?: string) => Promise<void>;
  dismissTip: (tipId: string) => Promise<void>;
  markTipAsSeen: (tipId: string) => Promise<void>;
  resetAllTips: () => Promise<void>;
  setShowTips: (show: boolean) => void;
  currentEmployee: Employee | null;
  setCurrentEmployee: (employee: Employee | null) => void;
}

const TipsContext = createContext<TipsContextType | undefined>(undefined);

interface TipsProviderProps {
  children: ReactNode;
}

export const TipsProvider: React.FC<TipsProviderProps> = ({ children }) => {
  const [tips, setTips] = useState<AppTip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [tipsService] = useState(() => TipsService.getInstance());

  // Initialize tips service
  useEffect(() => {
    const initializeTips = async () => {
      try {
        await tipsService.initializeTables();
        console.log('✅ TipsProvider: Service initialized');
      } catch (error) {
        console.error('❌ TipsProvider: Error initializing service:', error);
      }
    };

    initializeTips();
  }, [tipsService]);

  // Load tips for a specific screen
  const loadTipsForScreen = async (screen: string, trigger?: string) => {
    if (!currentEmployee?.id || !showTips) {
      setTips([]);
      return;
    }

    setIsLoading(true);
    try {
      const screenTips = await tipsService.getTipsForScreen(screen, currentEmployee.id, trigger);
      setTips(screenTips);
      console.log(`✅ TipsProvider: Loaded ${screenTips.length} tips for ${screen}`);
    } catch (error) {
      console.error('❌ TipsProvider: Error loading tips:', error);
      setTips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Dismiss a specific tip
  const dismissTip = async (tipId: string) => {
    if (!currentEmployee?.id) return;

    try {
      await tipsService.dismissTip(currentEmployee.id, tipId);
      setTips(prevTips => prevTips.filter(tip => tip.id !== tipId));
      console.log('✅ TipsProvider: Tip dismissed:', tipId);
    } catch (error) {
      console.error('❌ TipsProvider: Error dismissing tip:', error);
    }
  };

  // Mark a tip as seen
  const markTipAsSeen = async (tipId: string) => {
    if (!currentEmployee?.id) return;

    try {
      await tipsService.markTipAsSeen(currentEmployee.id, tipId);
      console.log('✅ TipsProvider: Tip marked as seen:', tipId);
    } catch (error) {
      console.error('❌ TipsProvider: Error marking tip as seen:', error);
    }
  };


  // Reset all tips for user (useful for testing or if user wants to see tips again)
  const resetAllTips = async () => {
    if (!currentEmployee?.id) return;

    try {
      await tipsService.resetUserTips(currentEmployee.id);
      setTips([]);
      console.log('✅ TipsProvider: All tips reset for user');
    } catch (error) {
      console.error('❌ TipsProvider: Error resetting tips:', error);
    }
  };

  const value: TipsContextType = {
    tips,
    isLoading,
    showTips,
    loadTipsForScreen,
    dismissTip,
    markTipAsSeen,
    resetAllTips,
    setShowTips,
    currentEmployee,
    setCurrentEmployee,
  };

  return (
    <TipsContext.Provider value={value}>
      {children}
    </TipsContext.Provider>
  );
};

export const useTips = (): TipsContextType => {
  const context = useContext(TipsContext);
  if (context === undefined) {
    throw new Error('useTips must be used within a TipsProvider');
  }
  return context;
};
