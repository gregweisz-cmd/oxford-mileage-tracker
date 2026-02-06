import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import UnifiedHeader from '../components/UnifiedHeader';
import { DeviceIntelligenceService, DeviceSettings, UserInterfacePreferences, OfflineSyncPattern, InputMethodPreference } from '../services/deviceIntelligenceService';
import { PerformanceOptimizationService, LoadingStrategy } from '../services/performanceOptimizationService';
import { DeviceControlService, DeviceControlSettings } from '../services/deviceControlService';
import { Employee } from '../types';
import { DatabaseService } from '../services/database';
import { useTheme } from '../contexts/ThemeContext';
import { useTips } from '../contexts/TipsContext';

interface SettingsScreenProps {
  navigation: any;
  route?: {
    params?: {
      currentEmployeeId?: string;
    };
  };
}

export default function SettingsScreen({ navigation, route }: SettingsScreenProps) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const { theme, setTheme, colors } = useTheme();
  const { showTips, setShowTips, resetAllTips } = useTips();
  // State for device settings
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings | null>(null);
  const [deviceControlSettings, setDeviceControlSettings] = useState<DeviceControlSettings | null>(null);
  const [uiPreferences, setUIPreferences] = useState<UserInterfacePreferences | null>(null);
  const [syncPattern, setSyncPattern] = useState<OfflineSyncPattern | null>(null);
  const [inputPreferences, setInputPreferences] = useState<InputMethodPreference | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState<LoadingStrategy | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreferredNameModal, setShowPreferredNameModal] = useState(false);
  const [preferredNameInput, setPreferredNameInput] = useState('');

  // Refs for keyboard handling
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadEmployee();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [currentEmployee]);

  const loadEmployee = async () => {
    const employeeId = route?.params?.currentEmployeeId;
    if (employeeId) {
      const employee = await DatabaseService.getEmployeeById(employeeId);
      setCurrentEmployee(employee);
    } else {
      // Try to get current employee from database if no route param
      const currentEmployee = await DatabaseService.getCurrentEmployee();
      if (currentEmployee) {
        setCurrentEmployee(currentEmployee);
      }
    }
  };

  const loadSettings = async () => {
    if (!currentEmployee?.id) {
      console.log('❌ SettingsScreen: No current employee ID');
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 SettingsScreen: Loading settings for employee:', currentEmployee.id);
      setLoading(true);
      
      // Initialize services first
      console.log('🔄 SettingsScreen: Initializing services...');
      await DeviceIntelligenceService.initializeTables();
      await PerformanceOptimizationService.initializeTables();
      await DeviceControlService.getInstance().initialize();
      
      // Load essential settings
      console.log('🔄 SettingsScreen: Loading essential settings...');
      const [device, deviceControl, input] = await Promise.all([
        DeviceIntelligenceService.getDeviceSettings(currentEmployee.id),
        DeviceControlService.getInstance().getCurrentSettings(),
        DeviceIntelligenceService.getInputMethodPreferences(currentEmployee.id)
      ]);

      console.log('✅ SettingsScreen: Essential settings loaded:', { device, deviceControl, input });
      
      // Set essential settings with defaults if they don't exist
      setDeviceSettings(device);
      setDeviceControlSettings(deviceControl);
      setInputPreferences(input);

    } catch (error) {
      console.error('❌ SettingsScreen: Error loading settings:', error);
      Alert.alert('Error', `Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateDeviceSettings = async (updates: Partial<DeviceSettings>) => {
    if (!currentEmployee?.id) return;

    try {
      const updated = await DeviceIntelligenceService.updateDeviceSettings(currentEmployee.id, updates);
      setDeviceSettings(updated);
    } catch (error) {
      console.error('❌ Error updating device settings:', error);
      Alert.alert('Error', 'Failed to update device settings');
    }
  };

  const updateDeviceControlSettings = async (updates: Partial<DeviceControlSettings>) => {
    try {
      await DeviceControlService.getInstance().updateSettings(updates);
      const updated = DeviceControlService.getInstance().getCurrentSettings();
      setDeviceControlSettings(updated);
      
      // Also update the device intelligence settings for persistence
      if (currentEmployee?.id) {
        await DeviceIntelligenceService.updateDeviceSettings(currentEmployee.id, updates as any);
      }
    } catch (error) {
      console.error('❌ Error updating device control settings:', error);
      Alert.alert('Error', 'Failed to update device control settings');
    }
  };

  const updateUIPreferences = async (updates: Partial<UserInterfacePreferences>) => {
    if (!currentEmployee?.id) return;

    try {
      const updated = await DeviceIntelligenceService.updateUIPreferences(currentEmployee.id, updates);
      setUIPreferences(updated);
    } catch (error) {
      console.error('❌ Error updating UI preferences:', error);
      Alert.alert('Error', 'Failed to update UI preferences');
    }
  };

  const updateSyncPattern = async (updates: Partial<OfflineSyncPattern>) => {
    if (!currentEmployee?.id) return;

    try {
      const updated = await DeviceIntelligenceService.updateOfflineSyncPattern(currentEmployee.id, updates);
      setSyncPattern(updated);
    } catch (error) {
      console.error('❌ Error updating sync pattern:', error);
      Alert.alert('Error', 'Failed to update sync pattern');
    }
  };

  const updateInputPreferences = async (updates: Partial<InputMethodPreference>) => {
    if (!currentEmployee?.id) return;

    try {
      const updated = await DeviceIntelligenceService.updateInputMethodPreferences(currentEmployee.id, updates);
      setInputPreferences(updated);
    } catch (error) {
      console.error('❌ Error updating input preferences:', error);
      Alert.alert('Error', 'Failed to update input preferences');
    }
  };

  const updateLoadingStrategy = async (updates: Partial<LoadingStrategy>) => {
    if (!currentEmployee?.id) return;

    try {
      const updated = await PerformanceOptimizationService.updateLoadingStrategy(currentEmployee.id, updates);
      setLoadingStrategy(updated);
    } catch (error) {
      console.error('❌ Error updating loading strategy:', error);
      Alert.alert('Error', 'Failed to update loading strategy');
    }
  };

  const showRecommendations = async () => {
    if (!currentEmployee?.id) return;

    try {
      const [deviceRecs, performanceRecs] = await Promise.all([
        DeviceIntelligenceService.getPersonalizedRecommendations(currentEmployee.id),
        PerformanceOptimizationService.getPerformanceRecommendations(currentEmployee.id)
      ]);

      let recommendations = '';
      
      if (deviceRecs.deviceOptimizations.length > 0) {
        recommendations += 'Device Optimizations:\n' + deviceRecs.deviceOptimizations.join('\n') + '\n\n';
      }
      
      if (deviceRecs.uiImprovements.length > 0) {
        recommendations += 'UI Improvements:\n' + deviceRecs.uiImprovements.join('\n') + '\n\n';
      }
      
      if (performanceRecs.cachingSuggestions.length > 0) {
        recommendations += 'Performance Tips:\n' + performanceRecs.cachingSuggestions.join('\n') + '\n\n';
      }

      if (recommendations) {
        Alert.alert('Personalized Recommendations', recommendations);
      } else {
        Alert.alert('Recommendations', 'Your settings are already optimized!');
      }
    } catch (error) {
      console.error('❌ Error getting recommendations:', error);
      Alert.alert('Error', 'Failed to load recommendations');
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!currentEmployee?.id) return;
            
            try {
              await Promise.all([
                DeviceIntelligenceService.updateDeviceSettings(currentEmployee.id, {}),
                DeviceIntelligenceService.updateUIPreferences(currentEmployee.id, {}),
                DeviceIntelligenceService.updateOfflineSyncPattern(currentEmployee.id, {}),
                DeviceIntelligenceService.updateInputMethodPreferences(currentEmployee.id, {})
              ]);
              
              await loadSettings();
              Alert.alert('Success', 'Settings reset to defaults');
            } catch (error) {
              console.error('❌ Error resetting settings:', error);
              Alert.alert('Error', 'Failed to reset settings');
            }
          }
        }
      ]
    );
  };


  const renderSettingRow = (
    title: string,
    subtitle: string,
    value: any,
    onPress?: () => void,
    rightElement?: React.ReactNode
  ) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.settingRight}>
        {rightElement || (
          <Text style={styles.settingValue}>{value}</Text>
        )}
        {onPress && <MaterialIcons name="chevron-right" size={24} color="#666" />}
      </View>
    </TouchableOpacity>
  );

  const renderSwitch = (title: string, subtitle: string, value: boolean, onToggle: (value: boolean) => void) => (
    <View style={styles.settingRow}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );

  const handleEditPreferredName = () => {
    if (!currentEmployee) return;
    setPreferredNameInput(currentEmployee.preferredName || currentEmployee.name.split(' ')[0] || '');
    setShowPreferredNameModal(true);
  };

  const handleSavePreferredName = async () => {
    const trimmed = preferredNameInput.trim();
    if (!trimmed || !currentEmployee?.id) {
      setShowPreferredNameModal(false);
      return;
    }
    try {
      await DatabaseService.updateEmployee(currentEmployee.id, {
        preferredName: trimmed
      } as any);
      const updated = await DatabaseService.getEmployeeById(currentEmployee.id);
      setCurrentEmployee(updated);
      setShowPreferredNameModal(false);
      Alert.alert('Success', 'Preferred name updated successfully');
    } catch (error) {
      console.error('❌ Error updating preferred name:', error);
      Alert.alert('Error', 'Failed to update preferred name');
    }
  };

  const renderEssentialSettings = () => (
    <View style={styles.sectionContent}>
      {renderSettingRow(
        'Preferred Name',
        'For app and web portal only. Legal name used on reports.',
        currentEmployee?.preferredName || currentEmployee?.name?.split(' ')[0] || 'Not set',
        handleEditPreferredName
      )}
      
      {renderSettingRow(
        'App Preferences',
        'Customize GPS, display, notifications, and features',
        '',
        () => {
          navigation.navigate('Preferences');
        }
      )}
      
      {renderSettingRow(
        'Theme',
        'Choose your preferred theme',
        theme,
        () => {
          setShowModal(true);
        }
      )}
      
      {renderSwitch(
        'Vibration',
        'Haptic feedback for interactions',
        deviceControlSettings?.vibrationEnabled ?? true,
        (value) => updateDeviceControlSettings({ vibrationEnabled: value })
      )}
      
      {renderSwitch(
        'Notifications',
        'Push notifications from the app',
        deviceControlSettings?.notificationsEnabled ?? true,
        (value) => updateDeviceControlSettings({ notificationsEnabled: value })
      )}
      
      {renderSwitch(
        'Auto Complete',
        'Suggestions as you type',
        inputPreferences?.autoCompleteEnabled ?? true,
        (value) => updateInputPreferences({ autoCompleteEnabled: value })
      )}
    </View>
  );

  const renderThemeModal = () => {
    const themeOptions = ['light', 'dark', 'auto'];

    return (
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Theme</Text>
            {themeOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => {
                  setTheme(option as 'light' | 'dark' | 'auto');
                  updateDeviceControlSettings({ theme: option as any });
                  setShowModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderPreferredNameModal = () => (
    <Modal visible={showPreferredNameModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Preferred Name</Text>
          <Text style={styles.modalSubtitle}>
            This name is only used in the app and web portal. Your legal name will always be used on expense reports and official documents.
          </Text>
          <View style={styles.modalInputWrap}>
            <TextInput
              style={styles.input}
              value={preferredNameInput}
              onChangeText={setPreferredNameInput}
              placeholder="Preferred name"
              placeholderTextColor="#999"
              autoFocus
            />
          </View>
          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalCancel, { flex: 1 }]}
              onPress={() => setShowPreferredNameModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSavePreferredName}
            >
              <Text style={styles.modalSaveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <UnifiedHeader
          title="Settings"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onHomePress={() => navigation.navigate('Home')}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <UnifiedHeader
        title="Settings"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onHomePress={() => navigation.navigate('Home')}
      />

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Essential Settings</Text>
        
        <ScrollView 
          ref={scrollViewRef}
          style={styles.settingsContainer} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {renderEssentialSettings()}
        </ScrollView>
      </KeyboardAvoidingView>

      {renderThemeModal()}
      {renderPreferredNameModal()}
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
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
  },
  resetTipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  resetTipsText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  sectionNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  sectionButtonActive: {
    backgroundColor: '#2196F3',
  },
  sectionButtonText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sectionButtonTextActive: {
    color: '#fff',
  },
  settingsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 16,
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: '#2196F3',
    marginRight: 8,
  },
  actionButtons: {
    marginTop: 24,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resetButton: {
    borderWidth: 1,
    borderColor: '#f44336',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
  },
  resetButtonText: {
    color: '#f44336',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalCancel: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingBottom: 16,
    lineHeight: 20,
  },
  modalInputWrap: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2196F3',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonPrimary: {
    backgroundColor: '#2196F3',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
});
