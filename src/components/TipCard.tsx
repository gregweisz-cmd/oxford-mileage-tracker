/**
 * TipCard Component
 * 
 * A reusable component for displaying contextual tips to users.
 * Includes dismiss functionality and customizable actions.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

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
  const { colors } = useTheme();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#f44336'; // Red
      case 'medium': return '#ff9800'; // Orange
      case 'low': return '#4caf50'; // Green
      default: return colors.primary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'getting_started': return 'rocket-launch';
      case 'gps_tracking': return 'my-location';
      case 'receipts': return 'receipt';
      case 'mileage': return 'directions-car';
      case 'reports': return 'assessment';
      case 'settings': return 'settings';
      case 'advanced': return 'psychology';
      default: return 'lightbulb-outline';
    }
  };

  const handleDismiss = () => {
    if (tip.dismissible) {
      Alert.alert(
        'Dismiss Tip',
        'Are you sure you want to dismiss this tip? You can always see it again in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Dismiss',
            style: 'destructive',
            onPress: () => onDismiss(tip.id),
          },
        ]
      );
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
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Priority indicator */}
      <View 
        style={[
          styles.priorityIndicator, 
          { backgroundColor: getPriorityColor(tip.priority) }
        ]} 
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <MaterialIcons
            name={tip.icon as any || getCategoryIcon(tip.category)}
            size={24}
            color={colors.primary}
            style={styles.icon}
          />
          <View style={styles.titleTextContainer}>
            <Text style={[styles.title, { color: colors.text }]}>
              {tip.title}
            </Text>
            <View style={styles.categoryContainer}>
              <Text style={[styles.category, { color: colors.textSecondary }]}>
                {tip.category.replace('_', ' ').toUpperCase()}
              </Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(tip.priority) }]}>
                <Text style={styles.priorityText}>{tip.priority}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Dismiss button */}
        {tip.dismissible && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Message */}
      <Text style={[styles.message, { color: colors.text }]}>
        {tip.message}
      </Text>

      {/* Actions */}
      {tip.actionText && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleAction}
          >
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>
              {tip.actionText}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  priorityIndicator: {
    height: 4,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  category: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
