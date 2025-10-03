import { MileageEntry, OxfordHouse } from '../types';
import { DatabaseService } from './database';

export interface TripChainSuggestion {
  id: string;
  type: 'nearby_house' | 'route_optimization' | 'multi_stop';
  title: string;
  description: string;
  suggestedRoute: string;
  estimatedSavings: {
    miles: number;
    minutes: number;
    fuelCost: number;
  };
  confidence: number; // 0-100
  houses: OxfordHouse[];
  optimizedStops: Array<{
    house: OxfordHouse;
    purpose: string;
    estimatedTime: number; // minutes
  }>;
}

export interface RouteOptimization {
  originalRoute: string;
  optimizedRoute: string;
  savings: {
    miles: number;
    minutes: number;
    fuelCost: number;
  };
  stops: Array<{
    house: OxfordHouse;
    purpose: string;
    estimatedTime: number;
  }>;
}

export class TripChainingAiService {
  private static readonly MAX_DETOUR_MILES = 10; // Max miles to add for a stop
  private static readonly MAX_DETOUR_MINUTES = 15; // Max minutes to add for a stop
  private static readonly FUEL_COST_PER_MILE = 0.15; // Estimated fuel cost per mile

  /**
   * Analyze a trip and suggest multi-stop optimizations
   */
  static async analyzeTripForChaining(
    startLocation: string,
    endLocation: string,
    employeeId: string,
    currentPurpose?: string
  ): Promise<TripChainSuggestion[]> {
    try {
      console.log('🔗 TripChaining: Analyzing trip for chaining opportunities', {
        startLocation,
        endLocation,
        employeeId
      });

      // Get all Oxford Houses
      const oxfordHouses = await DatabaseService.getOxfordHouses();
      
      // Get employee's historical trips for pattern analysis
      const historicalTrips = await DatabaseService.getMileageEntries(employeeId);
      
      // Get recent trips (last 30 days) for better suggestions
      const recentTrips = historicalTrips.filter(trip => {
        const tripDate = new Date(trip.date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return tripDate >= thirtyDaysAgo;
      });

      const suggestions: TripChainSuggestion[] = [];

      // 1. Find nearby Oxford Houses along the route
      const nearbyHousesSuggestions = await this.findNearbyHouses(
        startLocation,
        endLocation,
        oxfordHouses,
        recentTrips,
        employeeId
      );
      suggestions.push(...nearbyHousesSuggestions);

      // 2. Find route optimization opportunities
      const routeOptimizationSuggestions = await this.findRouteOptimizations(
        startLocation,
        endLocation,
        oxfordHouses,
        recentTrips,
        employeeId
      );
      suggestions.push(...routeOptimizationSuggestions);

      // 3. Find multi-stop patterns based on historical data
      const multiStopSuggestions = await this.findMultiStopPatterns(
        startLocation,
        endLocation,
        oxfordHouses,
        recentTrips,
        employeeId
      );
      suggestions.push(...multiStopSuggestions);

      // Sort by confidence and potential savings
      suggestions.sort((a, b) => {
        const scoreA = a.confidence * 0.7 + (a.estimatedSavings.miles / 10) * 0.3;
        const scoreB = b.confidence * 0.7 + (b.estimatedSavings.miles / 10) * 0.3;
        return scoreB - scoreA;
      });

      console.log('🔗 TripChaining: Generated suggestions:', suggestions.length);
      return suggestions.slice(0, 3); // Return top 3 suggestions

    } catch (error) {
      console.error('❌ TripChaining: Error analyzing trip:', error);
      return [];
    }
  }

  /**
   * Find Oxford Houses that are nearby the planned route
   */
  private static async findNearbyHouses(
    startLocation: string,
    endLocation: string,
    oxfordHouses: OxfordHouse[],
    recentTrips: MileageEntry[],
    employeeId: string
  ): Promise<TripChainSuggestion[]> {
    const suggestions: TripChainSuggestion[] = [];

    // Analyze which houses the employee visits frequently
    const houseVisitFrequency = this.calculateHouseVisitFrequency(recentTrips);
    
    // Find houses that are frequently visited and might be on/near the route
    for (const house of oxfordHouses) {
      const visitCount = houseVisitFrequency.get(house.id) || 0;
      
      // Only suggest houses visited at least 2 times in the last 30 days
      if (visitCount >= 2) {
        const detourDistance = await this.calculateDetourDistance(
          startLocation,
          endLocation,
          house.address
        );

        if (detourDistance.miles <= this.MAX_DETOUR_MILES && 
            detourDistance.minutes <= this.MAX_DETOUR_MINUTES) {
          
          const purpose = this.suggestPurposeForHouse(house, recentTrips);
          const fuelCost = detourDistance.miles * this.FUEL_COST_PER_MILE;
          
          suggestions.push({
            id: `nearby-${house.id}`,
            type: 'nearby_house',
            title: `Add Stop at ${house.name}`,
            description: `${house.name} is ${detourDistance.miles.toFixed(1)} miles off your route (${detourDistance.minutes} min detour)`,
            suggestedRoute: `${startLocation} → ${house.name} → ${endLocation}`,
            estimatedSavings: {
              miles: -detourDistance.miles, // Negative because it adds miles
              minutes: -detourDistance.minutes,
              fuelCost: -fuelCost
            },
            confidence: Math.min(90, 60 + (visitCount * 10)), // Higher confidence for more frequent visits
            houses: [house],
            optimizedStops: [{
              house,
              purpose,
              estimatedTime: 30 // 30 minutes estimated stop time
            }]
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Find route optimization opportunities
   */
  private static async findRouteOptimizations(
    startLocation: string,
    endLocation: string,
    oxfordHouses: OxfordHouse[],
    recentTrips: MileageEntry[],
    employeeId: string
  ): Promise<TripChainSuggestion[]> {
    const suggestions: TripChainSuggestion[] = [];

    // Look for patterns where employee visits multiple houses in one trip
    const multiHouseTrips = this.findMultiHouseTripPatterns(recentTrips);
    
    for (const pattern of multiHouseTrips) {
      if (pattern.houses.length >= 2) {
        // Check if this pattern could apply to the current trip
        const optimizedRoute = await this.optimizeRouteForPattern(
          startLocation,
          endLocation,
          pattern.houses,
          recentTrips
        );

        if (optimizedRoute.savings.miles > 0) {
          suggestions.push({
            id: `optimization-${pattern.id}`,
            type: 'route_optimization',
            title: `Optimize Route: ${pattern.name}`,
            description: `Based on your ${pattern.frequency} similar trips, this route saves ${optimizedRoute.savings.miles.toFixed(1)} miles`,
            suggestedRoute: optimizedRoute.optimizedRoute,
            estimatedSavings: optimizedRoute.savings,
            confidence: Math.min(95, 70 + (pattern.frequency * 5)),
            houses: pattern.houses,
            optimizedStops: optimizedRoute.stops
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Find multi-stop patterns based on historical data
   */
  private static async findMultiStopPatterns(
    startLocation: string,
    endLocation: string,
    oxfordHouses: OxfordHouse[],
    recentTrips: MileageEntry[],
    employeeId: string
  ): Promise<TripChainSuggestion[]> {
    const suggestions: TripChainSuggestion[] = [];

    // Find common multi-stop patterns
    const patterns = this.identifyMultiStopPatterns(recentTrips);
    
    for (const pattern of patterns) {
      if (pattern.houses.length >= 2) {
        const routeAnalysis = await this.analyzeRouteForPattern(
          startLocation,
          endLocation,
          pattern.houses
        );

        if (routeAnalysis.isFeasible) {
          suggestions.push({
            id: `pattern-${pattern.id}`,
            type: 'multi_stop',
            title: `Multi-Stop Pattern: ${pattern.name}`,
            description: `You've done this ${pattern.frequency} times. Saves ${routeAnalysis.savings.miles.toFixed(1)} miles`,
            suggestedRoute: routeAnalysis.route,
            estimatedSavings: routeAnalysis.savings,
            confidence: Math.min(90, 50 + (pattern.frequency * 8)),
            houses: pattern.houses,
            optimizedStops: pattern.stops
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Calculate how frequently an employee visits each Oxford House
   */
  private static calculateHouseVisitFrequency(trips: MileageEntry[]): Map<string, number> {
    const frequency = new Map<string, number>();
    
    for (const trip of trips) {
      // Check if trip involves an Oxford House
      const houses = this.extractOxfordHousesFromTrip(trip);
      for (const houseId of houses) {
        frequency.set(houseId, (frequency.get(houseId) || 0) + 1);
      }
    }
    
    return frequency;
  }

  /**
   * Extract Oxford House IDs from a trip's locations
   */
  private static extractOxfordHousesFromTrip(trip: MileageEntry): string[] {
    const houses: string[] = [];
    
    // Simple pattern matching for Oxford House addresses
    const oxfordHousePatterns = [
      /OH\s+\w+/i,
      /Oxford\s+House/i,
      /\d+\s+\w+\s+(St|Ave|Rd|Blvd|Dr|Way|Ln|Ct)/i
    ];
    
    const locations = [trip.startLocation, trip.endLocation];
    
    for (const location of locations) {
      for (const pattern of oxfordHousePatterns) {
        if (pattern.test(location)) {
          // Extract potential house ID (simplified)
          const match = location.match(/(OH\s+\w+|\d+\s+\w+\s+(St|Ave|Rd|Blvd|Dr|Way|Ln|Ct))/i);
          if (match) {
            houses.push(match[0]);
          }
        }
      }
    }
    
    return houses;
  }

  /**
   * Calculate detour distance and time for adding a stop
   */
  private static async calculateDetourDistance(
    startLocation: string,
    endLocation: string,
    stopLocation: string
  ): Promise<{ miles: number; minutes: number }> {
    // Simplified calculation - in a real implementation, you'd use a mapping service
    // For now, we'll use estimated values based on location patterns
    
    // This is a placeholder - in production, you'd integrate with Google Maps API or similar
    const estimatedMiles = Math.random() * 15 + 2; // 2-17 miles
    const estimatedMinutes = estimatedMiles * 2.5; // ~2.5 minutes per mile average
    
    return {
      miles: estimatedMiles,
      minutes: estimatedMinutes
    };
  }

  /**
   * Suggest a purpose for visiting a house based on historical data
   */
  private static suggestPurposeForHouse(
    house: OxfordHouse,
    recentTrips: MileageEntry[]
  ): string {
    // Find trips that involved this house
    const houseTrips = recentTrips.filter(trip => 
      trip.startLocation.includes(house.name) || 
      trip.endLocation.includes(house.name) ||
      trip.purpose.toLowerCase().includes(house.name.toLowerCase())
    );

    if (houseTrips.length === 0) {
      return 'House visit';
    }

    // Find most common purpose for this house
    const purposeCount = new Map<string, number>();
    for (const trip of houseTrips) {
      const purpose = trip.purpose.toLowerCase();
      purposeCount.set(purpose, (purposeCount.get(purpose) || 0) + 1);
    }

    // Return most common purpose
    let mostCommonPurpose = 'House visit';
    let maxCount = 0;
    
    for (const [purpose, count] of purposeCount) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonPurpose = purpose;
      }
    }

    return mostCommonPurpose;
  }

  /**
   * Find patterns of multi-house trips
   */
  private static findMultiHouseTripPatterns(trips: MileageEntry[]): Array<{
    id: string;
    name: string;
    frequency: number;
    houses: OxfordHouse[];
    stops: Array<{ house: OxfordHouse; purpose: string; estimatedTime: number }>;
  }> {
    const patterns: Array<{
      id: string;
      name: string;
      frequency: number;
      houses: OxfordHouse[];
      stops: Array<{ house: OxfordHouse; purpose: string; estimatedTime: number }>;
    }> = [];

    // Group trips by date to find multi-stop days
    const tripsByDate = new Map<string, MileageEntry[]>();
    
    for (const trip of trips) {
      const dateKey = trip.date.toISOString().split('T')[0];
      if (!tripsByDate.has(dateKey)) {
        tripsByDate.set(dateKey, []);
      }
      tripsByDate.get(dateKey)!.push(trip);
    }

    // Find days with multiple trips to different houses
    for (const [date, dayTrips] of tripsByDate) {
      if (dayTrips.length >= 2) {
        const houses = this.extractUniqueHousesFromTrips(dayTrips);
        if (houses.length >= 2) {
          // Check if this pattern already exists
          const existingPattern = patterns.find(p => 
            p.houses.length === houses.length &&
            p.houses.every(h => houses.some(house => house.id === h.id))
          );

          if (existingPattern) {
            existingPattern.frequency++;
          } else {
            patterns.push({
              id: `pattern-${date}`,
              name: `${houses.length} House Circuit`,
              frequency: 1,
              houses,
              stops: houses.map(house => ({
                house,
                purpose: this.suggestPurposeForHouse(house, dayTrips),
                estimatedTime: 30
              }))
            });
          }
        }
      }
    }

    return patterns.filter(p => p.frequency >= 2); // Only patterns done at least twice
  }

  /**
   * Extract unique houses from a set of trips
   */
  private static extractUniqueHousesFromTrips(trips: MileageEntry[]): OxfordHouse[] {
    const houseIds = new Set<string>();
    
    for (const trip of trips) {
      const houses = this.extractOxfordHousesFromTrip(trip);
      houses.forEach(id => houseIds.add(id));
    }

    // Convert house IDs back to OxfordHouse objects
    // This is simplified - in production, you'd look up actual house data
    return Array.from(houseIds).map(id => ({
      id,
      name: `OH ${id}`,
      address: `${id} Address`,
      city: 'City',
      state: 'NC',
      zipCode: '12345',
      phoneNumber: '',
      managerId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Optimize route for a specific pattern
   */
  private static async optimizeRouteForPattern(
    startLocation: string,
    endLocation: string,
    houses: OxfordHouse[],
    recentTrips: MileageEntry[]
  ): Promise<RouteOptimization> {
    // Simplified route optimization
    // In production, you'd use a proper routing algorithm
    
    const originalRoute = `${startLocation} → ${endLocation}`;
    const optimizedRoute = `${startLocation} → ${houses.map(h => h.name).join(' → ')} → ${endLocation}`;
    
    // Calculate estimated savings (simplified)
    const estimatedSavings = {
      miles: Math.random() * 20 + 5, // 5-25 miles saved
      minutes: Math.random() * 30 + 10, // 10-40 minutes saved
      fuelCost: (Math.random() * 20 + 5) * this.FUEL_COST_PER_MILE
    };

    return {
      originalRoute,
      optimizedRoute,
      savings: estimatedSavings,
      stops: houses.map(house => ({
        house,
        purpose: this.suggestPurposeForHouse(house, recentTrips),
        estimatedTime: 30
      }))
    };
  }

  /**
   * Analyze if a route pattern is feasible for the current trip
   */
  private static async analyzeRouteForPattern(
    startLocation: string,
    endLocation: string,
    houses: OxfordHouse[]
  ): Promise<{
    isFeasible: boolean;
    route: string;
    savings: { miles: number; minutes: number; fuelCost: number };
  }> {
    // Simplified feasibility check
    const isFeasible = houses.length <= 4; // Max 4 stops
    
    const route = `${startLocation} → ${houses.map(h => h.name).join(' → ')} → ${endLocation}`;
    
    const savings = {
      miles: Math.random() * 15 + 3, // 3-18 miles saved
      minutes: Math.random() * 25 + 8, // 8-33 minutes saved
      fuelCost: (Math.random() * 15 + 3) * this.FUEL_COST_PER_MILE
    };

    return {
      isFeasible,
      route,
      savings
    };
  }

  /**
   * Identify multi-stop patterns from historical trips
   */
  private static identifyMultiStopPatterns(trips: MileageEntry[]): Array<{
    id: string;
    name: string;
    frequency: number;
    houses: OxfordHouse[];
    stops: Array<{ house: OxfordHouse; purpose: string; estimatedTime: number }>;
  }> {
    return this.findMultiHouseTripPatterns(trips);
  }

  /**
   * Generate a smart trip description for a multi-stop route
   */
  static generateMultiStopDescription(
    startLocation: string,
    stops: Array<{ house: OxfordHouse; purpose: string }>,
    endLocation: string
  ): string {
    const stopDescriptions = stops.map(stop => 
      `${stop.house.name} for ${stop.purpose}`
    ).join(' to ');

    return `${startLocation} to ${stopDescriptions} to ${endLocation}`;
  }

  /**
   * Calculate total time for a multi-stop trip
   */
  static calculateMultiStopTime(
    baseTripTime: number, // minutes
    stops: Array<{ estimatedTime: number }>
  ): number {
    const stopTime = stops.reduce((total, stop) => total + stop.estimatedTime, 0);
    return baseTripTime + stopTime;
  }
}
