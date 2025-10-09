/**
 * Tips Context for Web Portal
 * 
 * Provides global state management for tips throughout the web portal.
 * Handles showing, dismissing, and tracking user tip interactions.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WebTip, WebTipsService } from '../services/webTipsService';

interface TipsContextType {
  tips: WebTip[];
  isLoading: boolean;
  showTips: boolean;
  loadTipsForScreen: (screen: string, trigger?: string) => Promise<void>;
  dismissTip: (tipId: string) => Promise<void>;
  markTipAsSeen: (tipId: string) => Promise<void>;
  resetAllTips: () => Promise<void>;
  setShowTips: (show: boolean) => void;
  currentUserId: string | null;
  setCurrentUserId: (userId: string | null) => void;
}

const TipsContext = createContext<TipsContextType | undefined>(undefined);

interface TipsProviderProps {
  children: ReactNode;
}

export const TipsProvider: React.FC<TipsProviderProps> = ({ children }) => {
  const [tips, setTips] = useState<WebTip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tipsService] = useState(() => WebTipsService.getInstance());

  // Load tips for a specific screen
  const loadTipsForScreen = async (screen: string, trigger?: string) => {
    if (!currentUserId || !showTips) {
      setTips([]);
      return;
    }

    setIsLoading(true);
    try {
      const screenTips = tipsService.getTipsForScreen(screen, currentUserId, trigger);
      setTips(screenTips);
      console.log(`✅ WebTipsProvider: Loaded ${screenTips.length} tips for ${screen}`);
    } catch (error) {
      console.error('❌ WebTipsProvider: Error loading tips:', error);
      setTips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Dismiss a specific tip
  const dismissTip = async (tipId: string) => {
    if (!currentUserId) return;

    try {
      await tipsService.dismissTip(currentUserId, tipId);
      setTips(prevTips => prevTips.filter(tip => tip.id !== tipId));
      console.log('✅ WebTipsProvider: Tip dismissed:', tipId);
    } catch (error) {
      console.error('❌ WebTipsProvider: Error dismissing tip:', error);
    }
  };

  // Mark a tip as seen
  const markTipAsSeen = async (tipId: string) => {
    if (!currentUserId) return;

    try {
      await tipsService.markTipAsSeen(currentUserId, tipId);
      console.log('✅ WebTipsProvider: Tip marked as seen:', tipId);
    } catch (error) {
      console.error('❌ WebTipsProvider: Error marking tip as seen:', error);
    }
  };

  // Reset all tips for user (useful for testing or if user wants to see tips again)
  const resetAllTips = async () => {
    if (!currentUserId) return;

    try {
      await tipsService.resetUserTips(currentUserId);
      setTips([]);
      console.log('✅ WebTipsProvider: All tips reset for user');
    } catch (error) {
      console.error('❌ WebTipsProvider: Error resetting tips:', error);
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
    currentUserId,
    setCurrentUserId,
  };

  return (
    <TipsContext.Provider value={value}>
      {children}
    </TipsContext.Provider>
  );
};

export const useWebTips = (): TipsContextType => {
  const context = useContext(TipsContext);
  if (context === undefined) {
    throw new Error('useWebTips must be used within a TipsProvider');
  }
  return context;
};
