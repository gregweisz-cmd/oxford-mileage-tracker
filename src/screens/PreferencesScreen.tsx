import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { PreferencesService, UserPreferences } from '../services/preferencesService';
import { SyncIntegrationService } from '../services/syncIntegrationService';
import {
  SYNC_INTERVAL_OPTIONS,
  SyncInterval,
  formatSyncIntervalLabel,
} from '../utils/syncIntervalConfig';
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
  const [syncIntervalDialogOpen, setSyncIntervalDialogOpen] = useState(false);

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
      if (key === 'autoSyncEnabled' && typeof value === 'boolean') {
        SyncIntegrationService.setAutoSyncEnabled(value);
      }
      if (key === 'syncInterval') {
        SyncIntegrationService.setSyncInterval(value as SyncInterval);
      }
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
              SyncIntegrationService.setAutoSyncEnabled(defaults.autoSyncEnabled);
              SyncIntegrationService.setSyncInterval(defaults.syncInterval);
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
              Automatically uploads your entries to the Staff Portal. Manual sync on Home is optional.
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
          onPress={() => setSyncIntervalDialogOpen(true)}
          disabled={saving || !preferences.autoSyncEnabled}
        >
          <View style={dynamicStyles.preferenceLeft}>
            <Text style={dynamicStyles.preferenceTitle}>Sync Interval</Text>
            <Text style={dynamicStyles.preferenceDescription}>
              {preferences.autoSyncEnabled
                ? SYNC_INTERVAL_OPTIONS.find((o) => o.value === preferences.syncInterval)?.description ||
                  'How often changes are uploaded while the app is open'
                : 'Enable Auto-Sync to choose an interval'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
            {formatSyncIntervalLabel(preferences.syncInterval)}
          </Text>
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

      <Modal
        visible={syncIntervalDialogOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSyncIntervalDialogOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sync Interval</Text>
            {SYNC_INTERVAL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  void updatePreference('syncInterval', option.value).then(() => {
                    setSyncIntervalDialogOpen(false);
                  });
                }}
              >
                <Text style={[styles.modalOptionTitle, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.modalOptionDescription, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setSyncIntervalDialogOpen(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  modalOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalCancel: {
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
});

