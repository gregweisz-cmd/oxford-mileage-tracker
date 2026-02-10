/**
 * Tips Context for Web Portal
 * 
 * Provides global state management for tips throughout the web portal.
 * Handles showing, dismissing, and tracking user tip interactions.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { WebTip, WebTipsService } from '../services/webTipsService';
import { debugLog, debugError } from '../config/debug';

interface TipsContextType {
  tips: WebTip[];
  isLoading: boolean;
  showTips: boolean;
  loadTipsForScreen: (screen: string, trigger?: string, userIdOverride?: string | null) => Promise<void>;
  dismissTip: (tipId: string, userIdOverride?: string | null) => Promise<void>;
  markTipAsSeen: (tipId: string, userIdOverride?: string | null) => Promise<void>;
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

  // Load tips for a specific screen. Use userIdOverride when provided so we use a stable userId even before context state updates.
  const loadTipsForScreen = async (screen: string, trigger?: string, userIdOverride?: string | null) => {
    const userId = userIdOverride ?? currentUserId;
    if (!userId || !showTips) {
      setTips([]);
      return;
    }

    setIsLoading(true);
    try {
      const screenTips = tipsService.getTipsForScreen(screen, userId, trigger);
      setTips(screenTips);
      debugLog(`✅ WebTipsProvider: Loaded ${screenTips.length} tips for ${screen}`);
    } catch (error) {
      debugError('❌ WebTipsProvider: Error loading tips:', error);
      setTips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Dismiss a specific tip. Use userIdOverride so dismiss is always persisted with the same userId used when loading.
  const dismissTip = async (tipId: string, userIdOverride?: string | null) => {
    const userId = userIdOverride ?? currentUserId;
    if (!userId) return;

    try {
      await tipsService.dismissTip(userId, tipId);
      setTips(prevTips => prevTips.filter(tip => tip.id !== tipId));
      debugLog('✅ WebTipsProvider: Tip dismissed:', tipId);
    } catch (error) {
      debugError('❌ WebTipsProvider: Error dismissing tip:', error);
    }
  };

  // Mark a tip as seen
  const markTipAsSeen = async (tipId: string, userIdOverride?: string | null) => {
    const userId = userIdOverride ?? currentUserId;
    if (!userId) return;

    try {
      await tipsService.markTipAsSeen(userId, tipId);
      debugLog('✅ WebTipsProvider: Tip marked as seen:', tipId);
    } catch (error) {
      debugError('❌ WebTipsProvider: Error marking tip as seen:', error);
    }
  };

  // Reset all tips for user (useful for testing or if user wants to see tips again)
  const resetAllTips = async () => {
    if (!currentUserId) return;

    try {
      await tipsService.resetUserTips(currentUserId);
      setTips([]);
      debugLog('✅ WebTipsProvider: All tips reset for user');
    } catch (error) {
      debugError('❌ WebTipsProvider: Error resetting tips:', error);
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
