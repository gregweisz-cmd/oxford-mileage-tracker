import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PerDiemWidgetProps {
  currentTotal: number;
  monthlyLimit: number;
  daysEligible?: number;
  daysClaimed?: number;
  isEligibleToday?: boolean;
  onPress: () => void;
  colors?: {
    card: string;
    text: string;
    textSecondary: string;
  };
}

function PerDiemWidget({
  currentTotal,
  monthlyLimit,
  daysEligible = 0,
  daysClaimed = 0,
  isEligibleToday = false,
  onPress,
  colors = {
    card: '#fff',
    text: '#333',
    textSecondary: '#666'
  }
}: PerDiemWidgetProps) {
  const remaining = monthlyLimit - currentTotal;
  const percentUsed = monthlyLimit > 0 ? (currentTotal / monthlyLimit) * 100 : 0;
  
  // Determine status color
  const getStatusColor = () => {
    if (currentTotal >= monthlyLimit) return '#f44336'; // Red - limit reached
    if (currentTotal >= monthlyLimit * 0.85) return '#FF9800'; // Orange - approaching limit
    return '#4CAF50'; // Green - good
  };

  const statusColor = getStatusColor();

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: colors.card }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header with Icon */}
      <View style={styles.header}>
        <MaterialIcons name="restaurant" size={28} color={statusColor} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Per Diem</Text>
      </View>

      {/* Main Amount */}
      <Text style={[styles.amount, { color: statusColor }]}>
        ${currentTotal.toFixed(2)}
      </Text>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor: statusColor
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {percentUsed.toFixed(0)}% of ${monthlyLimit}
        </Text>
      </View>

      {/* Status Message */}
      {currentTotal >= monthlyLimit ? (
        <View style={[styles.statusBadge, { backgroundColor: '#f44336' }]}>
          <MaterialIcons name="error" size={14} color="#fff" />
          <Text style={styles.statusBadgeText}>LIMIT REACHED</Text>
        </View>
      ) : remaining <= 50 ? (
        <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
          <MaterialIcons name="warning" size={14} color="#fff" />
          <Text style={styles.statusBadgeText}>${remaining.toFixed(0)} remaining</Text>
        </View>
      ) : isEligibleToday ? (
        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
          <MaterialIcons name="check-circle" size={14} color="#fff" />
          <Text style={styles.statusBadgeText}>Eligible today</Text>
        </View>
      ) : null}

      {/* Days Stats (if provided) */}
      {(daysEligible > 0 || daysClaimed > 0) && (
        <View style={styles.daysStats}>
          <View style={styles.daysStat}>
            <Text style={[styles.daysStatValue, { color: colors.text }]}>{daysClaimed}</Text>
            <Text style={[styles.daysStatLabel, { color: colors.textSecondary }]}>claimed</Text>
          </View>
          <View style={styles.daysStatDivider} />
          <View style={styles.daysStat}>
            <Text style={[styles.daysStatValue, { color: colors.text }]}>{daysEligible}</Text>
            <Text style={[styles.daysStatLabel, { color: colors.textSecondary }]}>eligible</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  daysStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  daysStat: {
    alignItems: 'center',
    flex: 1,
  },
  daysStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  daysStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  daysStatDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
});

export default React.memo(PerDiemWidget);
