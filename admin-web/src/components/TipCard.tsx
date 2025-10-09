/**
 * TipCard Component for Web Portal
 * 
 * A reusable component for displaying contextual tips to users in the web portal.
 * Includes dismiss functionality and customizable actions.
 */

import React from 'react';
import './TipCard.css';

export interface TipCardProps {
  tip: {
    id: string;
    title: string;
    message: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
    icon?: string;
    actionText?: string;
    dismissible: boolean;
  };
  onDismiss: (tipId: string) => void;
  onAction?: (tipId: string) => void;
  onMarkSeen?: (tipId: string) => void;
}

export const TipCard: React.FC<TipCardProps> = ({
  tip,
  onDismiss,
  onAction,
  onMarkSeen,
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#f44336'; // Red
      case 'medium': return '#ff9800'; // Orange
      case 'low': return '#4caf50'; // Green
      default: return '#2196F3';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'getting_started': return '🚀';
      case 'gps_tracking': return '📍';
      case 'receipts': return '🧾';
      case 'mileage': return '🚗';
      case 'reports': return '📊';
      case 'settings': return '⚙️';
      case 'advanced': return '🧠';
      case 'expense_management': return '💰';
      case 'data_entry': return '📝';
      case 'approval': return '✅';
      default: return '💡';
    }
  };

  const handleDismiss = () => {
    if (tip.dismissible) {
      if (window.confirm('Are you sure you want to dismiss this tip? You can always see it again in Settings.')) {
        onDismiss(tip.id);
      }
    }
  };

  const handleAction = () => {
    if (onAction) {
      onAction(tip.id);
    }
    if (onMarkSeen) {
      onMarkSeen(tip.id);
    }
  };

  return (
    <div className="tip-card">
      {/* Priority indicator */}
      <div 
        className="tip-priority-indicator"
        style={{ backgroundColor: getPriorityColor(tip.priority) }}
      />

      {/* Header */}
      <div className="tip-header">
        <div className="tip-title-container">
          <span className="tip-icon">
            {tip.icon || getCategoryIcon(tip.category)}
          </span>
          <div className="tip-title-text-container">
            <h3 className="tip-title">
              {tip.title}
            </h3>
            <div className="tip-category-container">
              <span className="tip-category">
                {tip.category.replace('_', ' ').toUpperCase()}
              </span>
              <span 
                className="tip-priority-badge"
                style={{ backgroundColor: getPriorityColor(tip.priority) }}
              >
                {tip.priority}
              </span>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        {tip.dismissible && (
          <button
            className="tip-dismiss-button"
            onClick={handleDismiss}
            title="Dismiss tip"
          >
            ✕
          </button>
        )}
      </div>

      {/* Message */}
      <p className="tip-message">
        {tip.message}
      </p>

      {/* Actions */}
      {tip.actionText && (
        <div className="tip-actions">
          <button
            className="tip-action-button"
            onClick={handleAction}
          >
            {tip.actionText}
          </button>
        </div>
      )}
    </div>
  );
};
