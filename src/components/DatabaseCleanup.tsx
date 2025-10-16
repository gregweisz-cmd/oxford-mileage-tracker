import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { getDatabaseConnection } from '../utils/databaseConnection';

export const DatabaseCleanup = () => {
  const cleanupDuplicates = async () => {
    try {
      const db = await getDatabaseConnection();
      
      console.log('🧹 Starting database cleanup...');
      
      // Delete all duplicates, keeping only the entries from backend (original IDs like 'mile1', 'mile2', etc.)
      const result = await db.runAsync(`
        DELETE FROM mileage_entries 
        WHERE id NOT IN (
          SELECT MIN(id) FROM mileage_entries 
          GROUP BY employeeId, date, miles, startLocation, endLocation
        )
      `);
      
      console.log(`✅ Deleted ${result.changes} duplicate entries`);
      
      // Count remaining entries
      const count = await db.getFirstAsync('SELECT COUNT(*) as count FROM mileage_entries');
      console.log(`📊 Remaining entries: ${count.count}`);
      
      Alert.alert(
        'Cleanup Complete',
        `Removed ${result.changes} duplicate entries. ${count.count} entries remaining.`,
        [{ text: 'OK', onPress: () => console.log('Cleanup acknowledged') }]
      );
    } catch (error) {
      console.error('❌ Error cleaning duplicates:', error);
      Alert.alert('Error', 'Failed to cleanup duplicates: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database Cleanup</Text>
      <Text style={styles.description}>
        Remove duplicate mileage entries that were created during sync.
      </Text>
      <TouchableOpacity style={styles.button} onPress={cleanupDuplicates}>
        <Text style={styles.buttonText}>Clean Up Duplicates</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

