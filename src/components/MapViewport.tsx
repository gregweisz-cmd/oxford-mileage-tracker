import React, { useState, useEffect } from 'react';
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
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

interface MapViewportProps {
  isTracking: boolean;
  currentDistance: number;
  onNavigate?: () => void;
}

export default function MapViewport({ isTracking, currentDistance, onNavigate }: MapViewportProps) {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapHtml, setMapHtml] = useState<string>('');

  useEffect(() => {
    if (isTracking) {
      fetchCurrentLocation();
    }
  }, [isTracking]);

  useEffect(() => {
    if (currentLocation) {
      generateMapHtml();
    }
  }, [currentLocation]);

  const fetchCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed to show your current position.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLocation(location.coords);
    } catch (error) {
      console.error('Error fetching current location:', error);
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const generateMapHtml = () => {
    if (!currentLocation) return;

    const lat = currentLocation.latitude;
    const lng = currentLocation.longitude;
    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey;
    
    // If no API key is configured, show a fallback message
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.log('⚠️ Google Maps API key not configured, showing fallback map');
      setMapHtml(''); // This will show the placeholder instead
      return;
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body, html { margin: 0; padding: 0; height: 100%; }
            #map { height: 100%; width: 100%; }
            .error-message {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
              background-color: #f8f9fa;
              color: #666;
              font-family: Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            function initMap() {
              try {
                const location = { lat: ${lat}, lng: ${lng} };
                const map = new google.maps.Map(document.getElementById("map"), {
                  zoom: 15,
                  center: location,
                  mapTypeId: google.maps.MapTypeId.ROADMAP,
                  disableDefaultUI: true,
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  styles: [
                    {
                      featureType: "poi",
                      elementType: "labels",
                      stylers: [{ visibility: "off" }]
                    }
                  ]
                });
                
                const marker = new google.maps.Marker({
                  position: location,
                  map: map,
                  title: "Current Location",
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#4CAF50",
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2
                  }
                });
                
                // Add click listener to open Google Maps
                map.addListener('click', function() {
                  const url = 'https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}';
                  window.open(url, '_blank');
                });
              } catch (error) {
                console.error('Map initialization error:', error);
                document.getElementById("map").innerHTML = 
                  '<div class="error-message">' +
                    '<h3>Map Unavailable</h3>' +
                    '<p>Unable to load interactive map</p>' +
                    '<p>Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>' +
                  '</div>';
              }
            }
            
            function handleMapError() {
              console.error('Google Maps API failed to load');
              document.getElementById("map").innerHTML = 
                '<div class="error-message">' +
                  '<h3>Map Service Unavailable</h3>' +
                  '<p>Google Maps API failed to load</p>' +
                  '<p>Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>' +
                '</div>';
            }
          </script>
          <script async defer 
            src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap"
            onerror="handleMapError()">
          </script>
        </body>
      </html>
    `;
    
    setMapHtml(html);
  };

  const openGoogleMapsForNavigation = () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Current location not available. Please try again.');
      return;
    }

    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${currentLocation.latitude},${currentLocation.longitude}`;
    const label = 'Current Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(err => console.error('An error occurred', err));
    }
  };

  const formatDistance = (miles: number): string => {
    if (miles < 0.1) {
      return `${(miles * 5280).toFixed(0)} ft`;
    } else {
      return `${miles.toFixed(1)} mi`;
    }
  };

  if (!isTracking) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Web-based Google Map */}
      {mapHtml ? (
        <WebView
          style={styles.map}
          source={{ html: mapHtml }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onError={(error) => {
            console.error('WebView error:', error);
            setMapHtml(''); // Fallback to placeholder
          }}
          onHttpError={(error) => {
            console.error('WebView HTTP error:', error);
            setMapHtml(''); // Fallback to placeholder
          }}
          onLoadEnd={() => {
            console.log('Map WebView loaded successfully');
          }}
          onLoadStart={() => {
            console.log('Map WebView loading...');
          }}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <MaterialIcons name="map" size={48} color="#4CAF50" />
          <Text style={styles.mapText}>
            {loading ? 'Loading Map...' : 'GPS Tracking Active'}
          </Text>
          <Text style={styles.locationText}>
            {currentLocation 
              ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
              : 'Getting location...'
            }
          </Text>
          {!Constants.expoConfig?.extra?.googleMapsApiKey || Constants.expoConfig?.extra?.googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' ? (
            <Text style={styles.apiKeyWarning}>
              Interactive map requires Google Maps API key setup
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.refreshLocationButton}
            onPress={fetchCurrentLocation}
            disabled={loading}
          >
            <MaterialIcons name="refresh" size={20} color="#4CAF50" />
            <Text style={styles.refreshLocationText}>Refresh Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Navigation Button Overlay */}
      <TouchableOpacity
        style={styles.navigationButton}
        onPress={openGoogleMapsForNavigation}
        disabled={!currentLocation || loading}
      >
        <MaterialIcons name="navigation" size={24} color="#fff" />
        <Text style={styles.navigationButtonText}>
          {loading ? 'Loading...' : 'Navigate'}
        </Text>
      </TouchableOpacity>

      {/* Tracking Stats Overlay */}
      <View style={styles.statsOverlay}>
        <View style={styles.statItem}>
          <MaterialIcons name="speed" size={20} color="#4CAF50" />
          <Text style={styles.statText}>{formatDistance(currentDistance)}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchCurrentLocation}
          disabled={loading}
        >
          <MaterialIcons 
            name="my-location" 
            size={20} 
            color={loading ? "#ccc" : "#2196F3"} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  map: {
    flex: 1,
    borderRadius: 12,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 20,
  },
  mapText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  apiKeyWarning: {
    fontSize: 11,
    color: '#FF9800',
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  navigationButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  statText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 4,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  refreshLocationButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  refreshLocationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
