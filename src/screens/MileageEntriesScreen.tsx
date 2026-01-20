import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { MileageEntry, Employee } from '../types';
import { formatLocationRoute } from '../utils/locationFormatter';
import UnifiedHeader from '../components/UnifiedHeader';

interface MileageEntriesScreenProps {
  navigation: any;
  route?: {
    params?: {
      selectedMonth?: number;
      selectedYear?: number;
    };
  };
}

export default function MileageEntriesScreen({ navigation, route }: MileageEntriesScreenProps) {
  const now = new Date();
  const initialMonth = route?.params?.selectedMonth ?? now.getMonth() + 1;
  const initialYear = route?.params?.selectedYear ?? now.getFullYear();

  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        setEntries([]);
        return;
      }
      setCurrentEmployee(employee);
      const data = await DatabaseService.getMileageEntries(
        employee.id,
        selectedMonth,
        selectedYear
      );
      setEntries(data);
    } catch (error) {
      console.error('Error loading mileage entries:', error);
      Alert.alert('Error', 'Failed to load mileage entries');
    } finally {
      setLoading(false);
    }
  };

  const handleEditEntry = (entryId: string) => {
    navigation.navigate('MileageEntry', { entryId, isEditing: true });
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this mileage entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteMileageEntry(entryId);
              await loadData();
              Alert.alert('Success', 'Mileage entry deleted successfully');
            } catch (error) {
              console.error('Error deleting mileage entry:', error);
              Alert.alert('Error', 'Failed to delete mileage entry');
            }
          },
        },
      ]
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const next = new Date(selectedYear, selectedMonth - 1, 1);
    next.setMonth(next.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedMonth(next.getMonth() + 1);
    setSelectedYear(next.getFullYear());
  };

  const formatMonthLabel = () =>
    new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

  return (
    <View style={styles.container}>
      <UnifiedHeader
        title="Mileage Entries"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        rightButton={{
          icon: 'add',
          onPress: () => navigation.navigate('MileageEntry'),
          color: '#1C75BC'
        }}
      />

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <MaterialIcons name="chevron-left" size={28} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthLabel()}</Text>
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <MaterialIcons name="chevron-right" size={28} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Loading entries...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="directions-car" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No mileage entries this month</Text>
            <Text style={styles.emptyStateSubtext}>
              Add an entry to see it here
            </Text>
          </View>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryInfo}>
                <Text style={styles.entryDate}>
                  {entry.date.toLocaleDateString()}
                </Text>
                <Text style={styles.entryRoute}>{formatLocationRoute(entry)}</Text>
                <Text style={styles.entryPurpose}>{entry.purpose}</Text>
                <Text style={styles.entryMiles}>{entry.miles.toFixed(1)} mi</Text>
                {entry.isGpsTracked && (
                  <View style={styles.gpsBadge}>
                    <MaterialIcons name="gps-fixed" size={12} color="#4CAF50" />
                    <Text style={styles.gpsText}>GPS Tracked</Text>
                  </View>
                )}
              </View>
              <View style={styles.entryActions}>
                <TouchableOpacity onPress={() => handleEditEntry(entry.id)}>
                  <MaterialIcons name="edit" size={20} color="#2196F3" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteEntry(entry.id)}>
                  <MaterialIcons name="delete" size={20} color="#f44336" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  entryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#eee',
  },
  entryInfo: {
    flex: 1,
    marginRight: 12,
  },
  entryDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  entryRoute: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  entryPurpose: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  entryMiles: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 6,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  gpsText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  entryActions: {
    justifyContent: 'space-between',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
  },
});
