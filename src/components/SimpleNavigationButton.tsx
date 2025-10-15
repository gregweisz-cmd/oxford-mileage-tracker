import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface SimpleNavigationButtonProps {
  isTracking: boolean;
  currentDistance: number;
}

const SimpleNavigationButton = React.memo(function SimpleNavigationButton({ isTracking, currentDistance }: SimpleNavigationButtonProps) {
  // Dynamic button text based on platform
  const getButtonText = () => {
    return Platform.OS === 'ios' ? 'Open Apple Maps' : 'Open Google Maps';
  };

  const handleOpenNavigation = async () => {
    try {
      // List of popular navigation apps with their URL schemes
      const navigationApps = [
        // Apple Maps (iOS) - Use native app URL scheme
        { name: 'Apple Maps', url: 'maps://', ios: true },
        // Apple Maps Web (fallback)
        { name: 'Apple Maps Web', url: 'http://maps.apple.com/', ios: true },
        // Google Maps
        { name: 'Google Maps', url: 'https://maps.google.com/', universal: true },
        // Waze
        { name: 'Waze', url: 'waze://', universal: true },
        // HERE Maps
        { name: 'HERE Maps', url: 'here-location://', universal: true },
        // MapQuest
        { name: 'MapQuest', url: 'mapquest://', universal: true },
        // Sygic
        { name: 'Sygic', url: 'com.sygic.aura://', universal: true },
        // TomTom
        { name: 'TomTom', url: 'tomtomhome://', universal: true },
        // Android Maps (fallback for Android)
        { name: 'Android Maps', url: 'geo:0,0?q=', android: true },
      ];

      let selectedApp = null;

      // On iOS, try Apple Maps first, then others
      if (Platform.OS === 'ios') {
        // Check if we can open Apple Maps (native app)
        const canOpenAppleMaps = await Linking.canOpenURL('maps://');
        if (canOpenAppleMaps) {
          selectedApp = navigationApps.find(app => app.name === 'Apple Maps');
        } else {
          // Try Apple Maps Web as fallback
          const canOpenAppleMapsWeb = await Linking.canOpenURL('http://maps.apple.com/');
          if (canOpenAppleMapsWeb) {
            selectedApp = navigationApps.find(app => app.name === 'Apple Maps Web');
          } else {
            // Try Google Maps
            const canOpenGoogleMaps = await Linking.canOpenURL('https://maps.google.com/');
            if (canOpenGoogleMaps) {
              selectedApp = navigationApps.find(app => app.name === 'Google Maps');
            }
          }
        }
      } else {
        // On Android, try Google Maps first
        const canOpenGoogleMaps = await Linking.canOpenURL('https://maps.google.com/');
        if (canOpenGoogleMaps) {
          selectedApp = navigationApps.find(app => app.name === 'Google Maps');
        } else {
          // Fallback to Android Maps
          selectedApp = navigationApps.find(app => app.name === 'Android Maps');
        }
      }

      // If no app was selected, try to find any available navigation app
      if (!selectedApp) {
        for (const app of navigationApps) {
          if ((app.ios && Platform.OS === 'ios') || (app.android && Platform.OS === 'android') || app.universal) {
            const canOpen = await Linking.canOpenURL(app.url);
            if (canOpen) {
              selectedApp = app;
              break;
            }
          }
        }
      }

      if (selectedApp) {
        await Linking.openURL(selectedApp.url);
        console.log(`🗺️ Opened ${selectedApp.name} for navigation`);
      } else {
        // Show a list of available options
        const availableApps = [];
        for (const app of navigationApps) {
          if ((app.ios && Platform.OS === 'ios') || (app.android && Platform.OS === 'android') || app.universal) {
            const canOpen = await Linking.canOpenURL(app.url);
            if (canOpen) {
              availableApps.push(app.name);
            }
          }
        }

        if (availableApps.length > 0) {
          Alert.alert(
            'Choose Navigation App',
            `Available apps: ${availableApps.join(', ')}`,
            [
              ...availableApps.map(appName => ({
                text: appName,
                onPress: async () => {
                  const app = navigationApps.find(a => a.name === appName);
                  if (app) {
                    await Linking.openURL(app.url);
                  }
                }
              })),
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert(
            'No Navigation Apps Found',
            'Please install a navigation app like Google Maps, Apple Maps, or Waze to use this feature.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error opening navigation app:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to open navigation app. Please check if you have a navigation app installed.',
        [{ text: 'OK' }]
      );
    }
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 5280)} ft`;
    }
    return `${distance.toFixed(2)} mi`;
  };

  return (
    <View style={styles.container}>
      {isTracking ? (
        <View style={styles.trackingContainer}>
          <View style={styles.distanceCard}>
            <MaterialIcons name="speed" size={32} color="#4CAF50" />
            <Text style={styles.distanceValue}>{formatDistance(currentDistance)}</Text>
            <Text style={styles.distanceLabel}>Distance Tracked</Text>
          </View>
          
          <TouchableOpacity style={styles.navigationButton} onPress={handleOpenNavigation}>
            <MaterialIcons name="navigation" size={24} color="#fff" />
                <Text style={styles.navigationButtonText}>{getButtonText()}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.idleContainer}>
          <MaterialIcons name="location-searching" size={48} color="#ccc" />
          <Text style={styles.idleText}>GPS tracking not active</Text>
          <Text style={styles.idleSubtext}>Start tracking to see distance and navigation options</Text>
        </View>
      )}
    </View>
  );
});

export default SimpleNavigationButton;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  distanceCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  distanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 4,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  navigationButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  idleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  idleText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  idleSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
  },
});
