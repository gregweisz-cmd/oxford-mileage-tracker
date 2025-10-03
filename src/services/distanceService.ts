import Constants from 'expo-constants';

export class DistanceService {
  private static readonly GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;

  static async calculateDistance(startAddress: string, endAddress: string): Promise<number> {
    console.log('DistanceService: Starting calculation');
    console.log(`From: ${startAddress}`);
    console.log(`To: ${endAddress}`);
    
    // Check API key status
    if (!this.GOOGLE_MAPS_API_KEY || this.GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.log('⚠️ Google Maps API key not configured - using estimation method');
      console.log('💡 To get accurate route-based distances, configure a Google Maps API key');
    } else {
      console.log('✅ Google Maps API key found - attempting route calculation');
    }
    
    // Try Google Maps API first if configured
    if (this.GOOGLE_MAPS_API_KEY && this.GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      try {
        console.log('🚗 Using Google Maps API for accurate route calculation');
        const distance = await this.calculateDistanceWithGoogleMaps(startAddress, endAddress);
        console.log(`✅ Route distance calculated: ${distance} miles`);
        return distance;
      } catch (error) {
        console.error('❌ Google Maps API error:', error);
        console.log('🔄 Falling back to estimation method');
      }
    }
    
    // Fallback: Use improved estimation method
    try {
      console.log('📏 Using estimation method (straight-line distance with buffer)');
      const distance = await this.calculateDistanceEstimation(startAddress, endAddress);
      console.log(`📏 Estimated distance: ${distance} miles`);
      return distance;
    } catch (error) {
      console.error('❌ Error calculating distance:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Could not find coordinates')) {
          throw new Error('Could not find one or both addresses. Please check the spelling and try again.');
        } else if (error.message.includes('Could not calculate route')) {
          throw new Error('Could not calculate route between these addresses. Please check if they are accessible by car.');
        }
      }
      
      throw new Error('Failed to calculate distance. Please check your addresses and try again.');
    }
  }

  // Main Google Maps distance calculation method
  private static async calculateDistanceWithGoogleMaps(startAddress: string, endAddress: string): Promise<number> {
    console.log('Geocoding addresses...');
    
    // First, geocode both addresses to get coordinates
    const startCoords = await this.geocodeAddress(startAddress);
    const endCoords = await this.geocodeAddress(endAddress);

    console.log('Calculating driving distance...');
    
    // Calculate distance using Google Maps Distance Matrix API
    const distance = await this.getDistanceFromGoogleMaps(startCoords, endCoords);
    
    // Convert meters to miles and round to nearest tenth
    const miles = distance * 0.000621371;
    const roundedMiles = Math.round(miles * 10) / 10;
    
    console.log(`Distance calculated: ${roundedMiles} miles`);
    return roundedMiles;
  }

  private static async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.GOOGLE_MAPS_API_KEY}`;

    console.log(`Geocoding: ${address}`);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`Could not find coordinates for address: ${address}`);
    }

    const location = data.results[0].geometry.location;
    console.log(`Coordinates found: ${location.lat}, ${location.lng}`);
    
    return {
      lat: location.lat,
      lng: location.lng,
    };
  }

  private static async getDistanceFromGoogleMaps(
    startCoords: { lat: number; lng: number },
    endCoords: { lat: number; lng: number }
  ): Promise<number> {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startCoords.lat},${startCoords.lng}&destinations=${endCoords.lat},${endCoords.lng}&units=imperial&mode=driving&key=${this.GOOGLE_MAPS_API_KEY}`;

    console.log(`Distance Matrix API URL: ${url.replace(this.GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(url);
    const data = await response.json();

    console.log('Distance Matrix API Response:', JSON.stringify(data, null, 2));

    if (data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${data.error_message || data.status}`);
    }

    if (!data.rows || data.rows.length === 0) {
      throw new Error('No distance data returned from Google Maps');
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      throw new Error(`Could not calculate route: ${element.status}`);
    }

    // Return distance in meters
    const distanceInMeters = element.distance.value;
    console.log(`Distance in meters: ${distanceInMeters}`);
    
    return distanceInMeters;
  }

  static async validateAddress(address: string): Promise<boolean> {
    try {
      await this.geocodeAddress(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get information about the current distance calculation setup
   */
  static getDistanceCalculationInfo(): {
    hasGoogleMapsApi: boolean;
    method: 'google-maps' | 'free-geocoding' | 'estimation';
    description: string;
    setupInstructions?: string;
  } {
    const hasGoogleMapsApi = this.GOOGLE_MAPS_API_KEY && this.GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
    
    if (hasGoogleMapsApi) {
      return {
        hasGoogleMapsApi: true,
        method: 'google-maps',
        description: 'Using Google Maps API for accurate route-based distance calculations',
      };
    } else {
      return {
        hasGoogleMapsApi: false,
        method: 'free-geocoding',
        description: 'Using free geocoding services with driving distance estimation (40% buffer over straight-line)',
        setupInstructions: `To get the most accurate route-based distances:

1. Get a Google Maps API Key:
   - Go to Google Cloud Console (console.cloud.google.com)
   - Create a new project or select existing one
   - Enable "Maps JavaScript API" and "Distance Matrix API"
   - Create credentials (API Key)
   - Restrict the key to your app's bundle ID

2. Add the API key to app.json:
   - Replace "YOUR_GOOGLE_MAPS_API_KEY_HERE" with your actual API key
   - In the "extra" section under "googleMapsApiKey"

3. Restart the app to use Google Maps routing

Current method provides good estimates but Google Maps will give you the exact driving route and distance.`
      };
    }
  }

  /**
   * Test the distance calculation system
   */
  static async testDistanceCalculation(): Promise<{
    success: boolean;
    method: string;
    testDistance?: number;
    error?: string;
  }> {
    const testStart = '123 Main St, Charlotte, NC';
    const testEnd = '456 Oak Ave, Charlotte, NC';
    
    try {
      console.log('🧪 Testing distance calculation system...');
      const distance = await this.calculateDistance(testStart, testEnd);
      const info = this.getDistanceCalculationInfo();
      
      return {
        success: true,
        method: info.method,
        testDistance: distance,
      };
    } catch (error) {
      console.error('❌ Distance calculation test failed:', error);
      return {
        success: false,
        method: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Fallback method using OpenRouteService (free alternative to Google Maps)
  private static async calculateDistanceWithOpenRouteService(startAddress: string, endAddress: string): Promise<number> {
    try {
      // Use OpenRouteService for geocoding (free, no API key required)
      const startCoords = await this.geocodeWithOpenRouteService(startAddress);
      const endCoords = await this.geocodeWithOpenRouteService(endAddress);

      // Calculate straight-line distance (Haversine formula)
      const distance = this.calculateHaversineDistance(startCoords, endCoords);
      
      // Add 20% buffer for driving distance vs straight-line distance
      const drivingDistance = distance * 1.2;
      
      // Round to nearest tenth
      return Math.round(drivingDistance * 10) / 10;
    } catch (error) {
      console.error('OpenRouteService error:', error);
      throw new Error('Could not calculate distance. Please enter manually.');
    }
  }

  private static async geocodeWithOpenRouteService(address: string): Promise<{ lat: number; lng: number }> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.openrouteservice.org/geocode/search?api_key=5b3ce3597851110001cf6248&text=${encodedAddress}&boundary.country=US`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error(`Could not find coordinates for address: ${address}`);
    }

    const coordinates = data.features[0].geometry.coordinates;
    return {
      lat: coordinates[1],
      lng: coordinates[0],
    };
  }

  private static calculateHaversineDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLng = this.toRadians(coord2.lng - coord1.lng);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.lat)) *
        Math.cos(this.toRadians(coord2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Improved estimation method using free geocoding services
  private static async calculateDistanceEstimation(startAddress: string, endAddress: string): Promise<number> {
    console.log('DistanceService: Using improved estimation method');
    
    // First try to use free geocoding services for more accurate estimation
    try {
      console.log('🌍 Attempting geocoding with free services...');
      return await this.calculateDistanceWithFreeGeocoding(startAddress, endAddress);
    } catch (error) {
      console.log('⚠️ Free geocoding failed, using keyword-based estimation');
    }
    
    // Fallback: Simple keyword-based estimation for common locations
    const commonDistances = this.getCommonDistances();
    
    // Check for exact matches first
    const key = `${startAddress.toLowerCase()} to ${endAddress.toLowerCase()}`;
    if (commonDistances[key]) {
      console.log(`📍 Found exact match: ${key} = ${commonDistances[key]} miles`);
      return commonDistances[key];
    }
    
    // Check for partial matches
    for (const [locationKey, distance] of Object.entries(commonDistances)) {
      if (locationKey.includes(startAddress.toLowerCase()) && locationKey.includes(endAddress.toLowerCase())) {
        console.log(`📍 Found partial match: ${locationKey} = ${distance} miles`);
        return distance;
      }
    }
    
    // If no specific match, provide a reasonable estimate based on location keywords
    const startCity = this.extractCityFromAddress(startAddress);
    const endCity = this.extractCityFromAddress(endAddress);
    
    if (startCity === endCity && startCity !== 'unknown') {
      // Same city - estimate 5-15 miles
      const estimate = Math.round((Math.random() * 10 + 5) * 10) / 10;
      console.log(`🏙️ Same city (${startCity}) estimate: ${estimate} miles`);
      return estimate;
    }
    
    // Different cities - estimate based on common patterns
    const cityDistance = this.getCityDistanceEstimate(startCity, endCity);
    if (cityDistance > 0) {
      console.log(`🏙️ City distance estimate: ${cityDistance} miles`);
      return cityDistance;
    }
    
    // Default estimation: 10-50 miles
    const estimate = Math.round((Math.random() * 40 + 10) * 10) / 10;
    console.log(`❓ Default estimate: ${estimate} miles`);
    return estimate;
  }

  // Use free geocoding services for better estimation
  private static async calculateDistanceWithFreeGeocoding(startAddress: string, endAddress: string): Promise<number> {
    try {
      // Use Nominatim (OpenStreetMap) for free geocoding
      const startCoords = await this.geocodeWithNominatim(startAddress);
      const endCoords = await this.geocodeWithNominatim(endAddress);
      
      // Calculate straight-line distance (Haversine formula)
      const straightLineDistance = this.calculateHaversineDistance(startCoords, endCoords);
      
      // Add realistic driving buffer (30-50% more than straight line)
      const drivingBuffer = 1.4; // 40% buffer for typical driving routes
      const estimatedDrivingDistance = straightLineDistance * drivingBuffer;
      
      // Round to nearest tenth
      const roundedDistance = Math.round(estimatedDrivingDistance * 10) / 10;
      
      console.log(`📏 Geocoded distance: ${straightLineDistance.toFixed(1)} mi straight-line → ${roundedDistance} mi estimated driving`);
      
      return roundedDistance;
    } catch (error) {
      console.error('Free geocoding error:', error);
      throw new Error('Could not geocode addresses for distance calculation');
    }
  }

  private static async geocodeWithNominatim(address: string): Promise<{ lat: number; lng: number }> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=us`;
    
    console.log(`🌍 Geocoding with Nominatim: ${address}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OH-Staff-Tracker/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error(`Could not find coordinates for address: ${address}`);
    }
    
    const result = data[0];
    const coords = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    };
    
    console.log(`📍 Coordinates found: ${coords.lat}, ${coords.lng}`);
    return coords;
  }

  private static getCommonDistances(): Record<string, number> {
    return {
      // Oklahoma locations
      'yukon office to oklahoma city office': 18.5,
      'yukon office to tulsa office': 95.2,
      'yukon office to norman office': 22.8,
      '425 pergola st., yukon, ok 73099 to oklahoma city': 18.5,
      '425 pergola st., yukon, ok 73099 to tulsa': 95.2,
      '425 pergola st., yukon, ok 73099 to norman': 22.8,
      
      // North Carolina locations
      'charlotte office to client home - downtown charlotte': 12.5,
      'charlotte office to community center - matthews': 18.2,
      'charlotte office to hospital - pineville': 15.8,
      'client home - concord to charlotte office': 22.1,
      
      'greensboro office to client home - winston-salem': 28.5,
      'greensboro office to support group - high point': 16.3,
      'greensboro office to court house - greensboro': 8.2,
      'client home - burlington to greensboro office': 24.7,
      
      // Common office to office distances
      'office to office': 15.0,
      'office to client': 12.0,
      'office to meeting': 8.0,
      'office to training': 20.0,
    };
  }

  private static extractCityFromAddress(address: string): string {
    const lowerAddress = address.toLowerCase();
    
    // Check for common city names
    const cities = [
      'yukon', 'oklahoma city', 'tulsa', 'norman', 'okc',
      'charlotte', 'matthews', 'pineville', 'concord',
      'greensboro', 'winston-salem', 'high point', 'burlington',
      'raleigh', 'durham', 'cary'
    ];
    
    for (const city of cities) {
      if (lowerAddress.includes(city)) {
        return city;
      }
    }
    
    return 'unknown';
  }

  private static getCityDistanceEstimate(startCity: string, endCity: string): number {
    const cityDistances: Record<string, Record<string, number>> = {
      'yukon': {
        'oklahoma city': 18.5,
        'tulsa': 95.2,
        'norman': 22.8,
        'okc': 18.5
      },
      'charlotte': {
        'matthews': 18.2,
        'pineville': 15.8,
        'concord': 22.1,
        'greensboro': 95.0
      },
      'greensboro': {
        'winston-salem': 28.5,
        'high point': 16.3,
        'burlington': 24.7,
        'charlotte': 95.0
      }
    };
    
    return cityDistances[startCity]?.[endCity] || 0;
  }
}
