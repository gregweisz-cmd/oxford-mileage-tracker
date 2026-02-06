import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { PreferencesService, UserPreferences } from '../services/preferencesService';
import UnifiedHeader from '../components/UnifiedHeader';
import { useTheme } from '../contexts/ThemeContext';

interface PreferencesScreenProps {
  navigation: any;
}

export default function PreferencesScreen({ navigation }: PreferencesScreenProps) {
  const { colors } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await PreferencesService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!preferences) return;

    try {
      setSaving(true);
      const updated = await PreferencesService.updatePreferences({ [key]: value });
      setPreferences(updated);
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to save preference');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPreferences = () => {
    Alert.alert(
      'Reset Preferences',
      'Are you sure you want to reset all preferences to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const defaults = await PreferencesService.resetPreferences();
              setPreferences(defaults);
              Alert.alert('Success', 'Preferences reset to defaults');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset preferences');
            }
          },
        },
      ]
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    sectionHeader: {
      backgroundColor: colors.card,
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    preferenceItem: {
      backgroundColor: colors.card,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    preferenceLeft: {
      flex: 1,
      marginRight: 16,
    },
    preferenceTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    preferenceDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

  if (loading || !preferences) {
    return (
      <View style={[dynamicStyles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <UnifiedHeader
        title="App Preferences"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onHomePress={() => navigation.navigate('Home')}
      />

      <ScrollView style={styles.content}>
        {/* GPS Tracking Section */}
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>📍 GPS Tracking</Text>
        </View>

        <View style={dynamicStyles.preferenceItem}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Show Duration Counter</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Display how long you've been tracking
            </Text>
          </View>
          <Switch
            value={preferences.showGpsDuration}
            onValueChange={(value) => updatePreference('showGpsDuration', value)}
            disabled={saving}
          />
        </View>

        <View style={dynamicStyles.preferenceItem}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Stationary Alerts</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Get notified if you've been stationary for 5+ minutes
            </Text>
          </View>
          <Switch
            value={true} // Always enabled for now
            onValueChange={() => {}}
            disabled={true}
          />
        </View>

        {/* Display Section */}
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>🎨 Display</Text>
        </View>

        <TouchableOpacity 
          style={dynamicStyles.preferenceItem}
          onPress={() => {
            Alert.alert(
              'Recent Entries Count',
              'How many recent entries to show on Home screen?',
              [
                { text: '3', onPress: () => updatePreference('showRecentEntriesCount', 3) },
                { text: '5', onPress: () => updatePreference('showRecentEntriesCount', 5) },
                { text: '10', onPress: () => updatePreference('showRecentEntriesCount', 10) },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Recent Entries Count</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Currently showing: {preferences.showRecentEntriesCount} entries
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Notifications Section */}
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>🔔 Notifications & Alerts</Text>
        </View>

        <View style={dynamicStyles.preferenceItem}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Sync Notifications</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Show alerts when data syncs to backend
            </Text>
          </View>
          <Switch
            value={preferences.enableSyncNotifications}
            onValueChange={(value) => updatePreference('enableSyncNotifications', value)}
            disabled={saving}
          />
        </View>

        <View style={dynamicStyles.preferenceItem}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Per Diem Warnings</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Alert when approaching $350 monthly limit
            </Text>
          </View>
          <Switch
            value={preferences.enablePerDiemWarnings}
            onValueChange={(value) => updatePreference('enablePerDiemWarnings', value)}
            disabled={saving}
          />
        </View>

        {/* Smart Features Section */}
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>🤖 Smart Features</Text>
        </View>

        <View style={dynamicStyles.preferenceItem}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Tips & Hints</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Show helpful tips throughout the app
            </Text>
          </View>
          <Switch
            value={preferences.enableTips}
            onValueChange={(value) => updatePreference('enableTips', value)}
            disabled={saving}
          />
        </View>

        <View style={[dynamicStyles.preferenceItem, { opacity: 0.5 }]}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Auto Per Diem (DISABLED)</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Automatically add Per Diem receipts - Keep OFF to prevent duplicates
            </Text>
          </View>
          <Switch
            value={false}
            onValueChange={() => {}}
            disabled={true}
          />
        </View>

        {/* Data & Sync Section */}
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>🔄 Data & Sync</Text>
        </View>

        <View style={dynamicStyles.preferenceItem}>
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Auto-Sync</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Automatically sync data to backend every {preferences.syncInterval} seconds
            </Text>
          </View>
          <Switch
            value={preferences.autoSyncEnabled}
            onValueChange={(value) => updatePreference('autoSyncEnabled', value)}
            disabled={saving}
          />
        </View>

        <TouchableOpacity 
          style={dynamicStyles.preferenceItem}
          onPress={() => {
            Alert.alert(
              'Sync Interval',
              'How often should the app sync to the backend?',
              [
                { text: '5 seconds (Fast)', onPress: () => updatePreference('syncInterval', 5) },
                { text: '15 seconds', onPress: () => updatePreference('syncInterval', 15) },
                { text: '30 seconds', onPress: () => updatePreference('syncInterval', 30) },
                { text: '1 minute (Battery saver)', onPress: () => updatePreference('syncInterval', 60) },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Sync Interval</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Currently: Every {preferences.syncInterval} seconds
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Advanced Section */}
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>⚙️ Advanced</Text>
        </View>

        <TouchableOpacity 
          style={[dynamicStyles.preferenceItem, styles.dangerItem]}
          onPress={handleResetPreferences}
        >
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={[dynamicStyles.preferenceTitle, styles.dangerText]}>
              Reset to Defaults
            </Text>
            <Text style={dynamicStyles.preferenceDescription}>
              Reset all preferences to their default values
            </Text>
          </View>
          <MaterialIcons name="refresh" size={24} color="#f44336" />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Changes are saved automatically
          </Text>
        </View>
      </ScrollView>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  dangerItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
  },
  dangerText: {
    color: '#f44336',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});

