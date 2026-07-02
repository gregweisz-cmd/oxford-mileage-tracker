import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ReceiptTaxReminderResult } from '../utils/receiptTaxReminder';

interface ReceiptTaxReminderBannerProps {
  reminder: ReceiptTaxReminderResult;
}

export function ReceiptTaxReminderBanner({ reminder }: ReceiptTaxReminderBannerProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name="info" size={20} color="#1565C0" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{reminder.title}</Text>
        <Text style={styles.description}>{reminder.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
    marginBottom: 16,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D47A1',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#37474F',
    lineHeight: 18,
  },
});
